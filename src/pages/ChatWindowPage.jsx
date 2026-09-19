// WeChat-style text chat window with the digital human (same persona as the video call)
// History is local-first: stored in the app's local DB (IndexedDB), merged with the server copy.
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersona, getMessages } from '../services/api';
import { getWsUrl } from '../services/config';
import {
  getMessages as storeGetMessages,
  saveMessage as storeSaveMessage,
  saveMessages as storeSaveMessages,
  deleteMessage as storeDeleteMessage,
} from '../services/messageStore';
import { getFacts, replaceFacts } from '../services/factStore';
import WeAvatar from '../components/WeAvatar';
import Icon from '../components/Icon';
import { W, fmtDivider, photoSrc } from './wechatTheme';

const PAGE = 100;
const GAP = 3 * 60 * 1000; // 3 minutes without a message → time divider above the next one

export default function ChatWindowPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState(null);
  const [msgs, setMsgs] = useState([]); // {id, personaId, role:'user'|'ai', text, createdAt}
  const [input, setInput] = useState('');
  const [awaiting, setAwaiting] = useState(false); // LLM in flight → typing dots
  const [wsOpen, setWsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false); // "+" panel with 视频通话
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const wsRef = useRef(null);
  const listRef = useRef(null);
  const firstOpenRef = useRef(true);
  const atBottomRef = useRef(true);
  const tempRef = useRef({}); // optimistic tempId → text (swapped on user_ack)

  // Load persona + history: local DB first (instant), then merge server copy
  useEffect(() => {
    let alive = true;
    getPersona(id).then(p => { if (alive) setPersona(p); }).catch(() => {});

    (async () => {
      // 1. Local history — what this device already has
      try {
        const local = await storeGetMessages(id, { limit: PAGE + 1 });
        if (!alive) return;
        setHasMore(local.length > PAGE);
        setMsgs(local.slice(0, PAGE));
      } catch (e) { console.warn('[Store] local load failed:', e.message); }

      // 2. Merge server history — recover messages from other sessions/devices
      try {
        const remote = await getMessages(id);
        if (!alive) return;
        setMsgs(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          const fresh = [];
          for (const m of remote) {
            const rec = { id: m.id, personaId: id, role: m.role, text: m.text, createdAt: m.created_at };
            if (!map.has(rec.id)) { map.set(rec.id, rec); fresh.push(rec); }
          }
          if (fresh.length) storeSaveMessages(fresh).catch(() => {});
          return [...map.values()].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        });
      } catch (e) { console.warn('[Store] remote merge failed:', e.message); }
    })();

    return () => { alive = false; };
  }, [id]);

  // WebSocket with auto-reconnect
  useEffect(() => {
    let closed = false;
    const connect = () => {
      if (closed) return;
      let ws;
      try { ws = new WebSocket(getWsUrl()); } catch { setTimeout(connect, 2000); return; }
      wsRef.current = ws;

      ws.onopen = () => {
        setWsOpen(true);
        ws.send(JSON.stringify({ type: 'start_chat', personaId: id }));
        if (!firstOpenRef.current) {
          // Reconnect: recover turns completed while offline (server persists before sending)
          getMessages(id).then(remote => {
            setMsgs(prev => {
              const map = new Map(prev.map(m => [m.id, m]));
              const fresh = [];
              for (const m of remote) {
                const rec = { id: m.id, personaId: id, role: m.role, text: m.text, createdAt: m.created_at };
                if (!map.has(rec.id)) { map.set(rec.id, rec); fresh.push(rec); }
              }
              if (fresh.length) storeSaveMessages(fresh).catch(() => {});
              return [...map.values()].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
            });
          }).catch(() => {});
        }
        firstOpenRef.current = false;
      };

      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'user_ack') {
          // Swap the optimistic temp message for the persisted record
          const d = m.data;
          const tempId = Object.keys(tempRef.current).find(k => tempRef.current[k] === d.text);
          setMsgs(prev => prev.map(x =>
            (x.id === tempId) ? { ...x, id: d.id, createdAt: d.createdAt } : x));
          if (tempId) {
            delete tempRef.current[tempId];
            storeSaveMessage({ id: d.id, personaId: id, role: 'user', text: d.text, createdAt: d.createdAt }).catch(() => {});
            storeDeleteMessage(tempId).catch(() => {});
          }
        } else if (m.type === 'text_reply') {
          setAwaiting(false);
          const msg = {
            id: m.data.id || ('ai-' + (m.data.createdAt || Date.now())),
            personaId: id, role: 'ai', text: m.data.text, createdAt: m.data.createdAt,
          };
          setMsgs(prev => [...prev, msg]);
          storeSaveMessage(msg).catch(() => {});
        } else if (m.type === 'text_reply_error') {
          setAwaiting(false);
        } else if (m.type === 'chat_new_facts') {
          // Server extracted this turn's memories and merged them with ours — adopt the new list
          if (Array.isArray(m.data?.facts)) replaceFacts(id, m.data.facts).catch(() => {});
        }
      };

      ws.onclose = () => { setWsOpen(false); if (!closed) setTimeout(connect, 2000); };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();
    return () => { closed = true; try { wsRef.current?.close(); } catch {} };
  }, [id]);

  // Auto-scroll to bottom only when the user is already near the bottom
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs, awaiting]);

  function send() {
    const t = input.trim();
    if (!t || awaiting || !wsOpen) return;
    const tempId = 'u-' + Date.now();
    const msg = { id: tempId, personaId: id, role: 'user', text: t, createdAt: new Date().toISOString() };
    tempRef.current[tempId] = t;
    setMsgs(prev => [...prev, msg]);
    storeSaveMessage(msg).catch(() => {});
    setInput('');
    setAwaiting(true);
    setPanelOpen(false);
    // Send with this device's memory (facts) so the mom remembers — the DB lives on this phone
    const sendMsg = (facts) => {
      const payload = { type: 'text_chat', text: t };
      if (facts) payload.facts = facts;
      if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(payload));
    };
    getFacts(id).then(sendMsg).catch(() => sendMsg());
  }

  // Page further back into local history
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const oldest = msgs[0]?.createdAt || null;
      const older = await storeGetMessages(id, { limit: PAGE, before: oldest });
      if (!older.length) { setHasMore(false); return; }
      setHasMore(older.length === PAGE);
      const el = listRef.current;
      const prevHeight = el ? el.scrollHeight : 0;
      setMsgs(prev => {
        const ids = new Set(prev.map(m => m.id));
        const fresh = older.filter(m => !ids.has(m.id));
        return [...fresh, ...prev];
      });
      // Keep the viewport anchored where the user was reading
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (e) { console.warn('[Store] loadMore failed:', e.message); }
    setLoadingMore(false);
  }

  const avatar = <WeAvatar src={photoSrc(persona?.photo_url)} name={persona?.name} size={38} radius={4} />;
  // My avatar — same as the account set in 我 page
  const myAvatar = <WeAvatar src={photoSrc(localStorage.getItem('account_avatar') || '')} name={localStorage.getItem('account_name') || 'xryan'} size={38} radius={4} />;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>‹</button>
        <WeAvatar src={photoSrc(persona?.photo_url)} name={persona?.name} size={32} radius={4} />
        <div style={S.headerName}>{persona?.name || ''}</div>
        <div style={S.headerSpacer} />
        {/* 一键发起视频通话 */}
        <button
          style={S.callBtn}
          onClick={() => navigate(`/call/${id}`, { replace: true })}
          title="视频通话"
        >
          <Icon name="camera" size={20} color={W.text} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        style={S.list}
        onScroll={() => {
          const el = listRef.current;
          if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasMore && (
          <button style={S.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '加载中...' : '查看更早的消息'}
          </button>
        )}
        {msgs.map((m, i) => {
          // 3+ minutes since the previous message → small time label above this one
          const prev = i > 0 ? msgs[i - 1] : null;
          const showTime = !prev || (new Date(m.createdAt) - new Date(prev.createdAt)) >= GAP;
          return (
            <div key={m.id} style={S.msgBlock}>
              {showTime && <div style={S.timeDivider}>{fmtDivider(m.createdAt)}</div>}
              {m.role === 'user' ? (
                <div style={S.userRow}>
                  <div style={S.userBubble}>{m.text}</div>
                  {myAvatar}
                </div>
              ) : (
                <div style={S.aiRow}>
                  {avatar}
                  <div style={S.aiBubble}>{m.text}</div>
                </div>
              )}
            </div>
          );
        })}
        {awaiting && (
          <div style={S.aiRow}>
            {avatar}
            <div style={S.aiBubble}>
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* "+" panel — 视频通话 entry */}
      {panelOpen && (
        <div style={S.panel}>
          <button style={S.panelItem} onClick={() => navigate(`/call/${id}`, { replace: true })}>
            <span style={S.panelIcon}>
              <Icon name="camera" size={30} color={W.text} />
            </span>
            <span style={S.panelLabel}>视频通话</span>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div style={S.inputBar}>
        <button style={S.toolBtn} onClick={() => setPanelOpen(v => !v)}>＋</button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; guard against Chinese IME composition confirm
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          }}
          placeholder="发消息..."
          style={S.input}
        />
        <button
          style={{ ...S.sendBtn, opacity: (input.trim() && !awaiting && wsOpen) ? 1 : 0.4 }}
          onClick={send}
          disabled={!input.trim() || awaiting || !wsOpen}
        >
          发送
        </button>
      </div>
    </div>
  );
}

const S = {
  page: { height: '100%', background: W.bg, display: 'flex', flexDirection: 'column', position: 'relative' },
  header: {
    background: W.headerBg, padding: 'calc(var(--status-bar-h) + 8px) 12px 8px',
    display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  backBtn: { background: 'none', border: 'none', fontSize: 30, color: W.text, cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: 'inherit' },
  headerName: { fontSize: 17, fontWeight: 500, color: W.text },
  headerSpacer: { flex: 1 },
  callBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 6, flexShrink: 0,
  },
  list: { flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 12 },
  loadMoreBtn: {
    background: 'none', border: 'none', color: W.sub, fontSize: 13,
    cursor: 'pointer', padding: '4px 0', margin: '0 auto',
  },
  msgBlock: { display: 'flex', flexDirection: 'column', gap: 10 },
  timeDivider: {
    textAlign: 'center', fontSize: 11, color: W.time,
    alignSelf: 'center', lineHeight: 1,
  },
  userRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-start' },
  aiRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  userBubble: {
    maxWidth: '65%', background: W.userBubble, padding: '10px 12px',
    borderRadius: 6, fontSize: 16, lineHeight: 1.4, color: W.text,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  aiBubble: {
    maxWidth: '65%', background: '#fff', padding: '10px 12px',
    borderRadius: 6, fontSize: 16, lineHeight: 1.4, color: W.text,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  panel: {
    background: '#F7F7F7', borderTop: `0.5px solid ${W.line}`,
    padding: '14px 16px', display: 'flex', justifyContent: 'center', flexShrink: 0,
  },
  panelItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  panelIcon: {
    width: 56, height: 56, borderRadius: 12, background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none',
  },
  panelLabel: { fontSize: 13, color: W.text },
  inputBar: {
    background: '#F7F7F7', padding: '8px 10px calc(8px + var(--safe-bottom))',
    display: 'flex', gap: 8, alignItems: 'center',
    borderTop: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  toolBtn: {
    width: 36, height: 36, borderRadius: '50%', background: '#fff',
    border: `0.5px solid ${W.line}`, fontSize: 22, color: W.text, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  input: {
    flex: 1, background: '#fff', borderRadius: 6, padding: '9px 12px',
    fontSize: 16, border: 'none', outline: 'none', color: W.text, fontFamily: 'inherit',
  },
  sendBtn: {
    background: W.green, color: '#fff', border: 'none', borderRadius: 6,
    padding: '9px 16px', fontSize: 15, cursor: 'pointer', flexShrink: 0,
  },
};
