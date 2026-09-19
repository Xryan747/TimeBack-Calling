// WeChat-style conversation list
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas } from '../services/api';
import { getLastMessage as storeGetLastMessage } from '../services/messageStore';
import WeAvatar from '../components/WeAvatar';
import BottomTabBar from '../components/BottomTabBar';
import Icon from '../components/Icon';
import { W, fmtTime, photoSrc } from './wechatTheme';

export default function ChatListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const ps = await listPersonas();
      // Merge the app-local last message (IndexedDB) with the server copy — newer wins
      const merged = await Promise.all(ps.map(async (p) => {
        let localLast = null;
        try { localLast = await storeGetLastMessage(p.id); } catch {}
        const serverLast = p.last_message;
        const last = (!localLast || (serverLast && new Date(serverLast.created_at) >= new Date(localLast.createdAt)))
          ? (serverLast ? { text: serverLast.text, createdAt: serverLast.created_at } : null)
          : { text: localLast.text, createdAt: localLast.createdAt };
        return { ...p, last_message: last };
      }));
      // WeChat order: most recent conversation first; no-message personas keep creation order
      setItems(merged.sort((a, b) =>
        (b.last_message?.createdAt || '').localeCompare(a.last_message?.createdAt || '')));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = query.trim()
    ? items.filter(p =>
        (p.name || '').includes(query.trim()) ||
        (p.last_message?.text || '').includes(query.trim()))
    : items;

  return (
    <div style={S.page}>
      {/* Header — 微信 title + unread badge + "+" */}
      <div style={S.header}>
        <div style={S.titleWrap}>
          <img src="/icon-192.png" alt="" style={S.headerIcon} />
          <span style={S.headerTitle}>Timeback Calling</span>
        </div>
        <button style={S.plusBtn} onClick={() => setMenuOpen(v => !v)}>＋</button>
      </div>

      {/* Search bar */}
      <div style={S.searchWrap}>
        <div style={S.searchBox}>
          <span style={S.searchIcon}><Icon name="search" size={13} color={W.sub} /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            style={S.searchInput}
          />
        </div>
      </div>

      {/* Conversation list */}
      {loading ? (
        <div style={S.centerHint}>加载中...</div>
      ) : items.length === 0 ? (
        <div style={S.empty}>
          {error ? (
            <>
              <p style={S.emptyEmoji}>⚠️</p>
              <p style={S.emptyText}>加载失败：{error}</p>
              <button style={S.emptyBtn} onClick={() => { setLoading(true); load(); }}>重试</button>
            </>
          ) : (
            <>
              <img src="/icon-192.png" alt="" style={S.emptyIcon} />
              <p style={S.emptyTitle}>还没有数字人</p>
              <p style={S.emptyText}>点击右上角 ＋，管理数字人</p>
              <button style={S.emptyBtn} onClick={() => navigate('/manage')}>去管理</button>
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.centerHint}>未找到"{query.trim()}"相关聊天</div>
      ) : (
        <div style={S.list}>
          {filtered.map((p) => (
            <div key={p.id} style={S.row} onClick={() => navigate(`/chat/${p.id}`)}>
              <WeAvatar src={photoSrc(p.photo_url)} name={p.name} />
              <div style={S.rowMid}>
                <div style={S.rowName}>{p.name}</div>
                <div style={S.rowPreview}>{p.last_message?.text || '暂无消息'}</div>
              </div>
              <div style={S.rowTime}>{fmtTime(p.last_message?.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom tab bar — 联系人 / 我 */}
      <BottomTabBar onChatTap={() => setQuery('')} />

      {/* "+" popover menu (WeChat dark popover) */}
      {menuOpen && (
        <>
          <div style={S.backdrop} onClick={() => setMenuOpen(false)} />
          <div style={S.menu}>
            <div style={{ ...S.menuItem, borderBottom: 'none' }} onClick={() => { setMenuOpen(false); navigate('/manage'); }}>
              <Icon name="gear" size={18} color="#fff" />
              <span>管理数字人</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  page: { height: '100%', background: W.bg, display: 'flex', flexDirection: 'column', position: 'relative' },
  header: {
    background: W.headerBg, padding: 'calc(var(--status-bar-h) + 10px) 16px 12px',
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderBottom: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: 600, color: W.text },
  headerIcon: { width: 20, height: 20, borderRadius: 5, flexShrink: 0 },
  titleWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  plusBtn: {
    position: 'absolute', right: 12, top: 'calc(var(--status-bar-h) + 4px)',
    background: 'none', border: 'none', fontSize: 28, color: W.text,
    cursor: 'pointer', lineHeight: 1, padding: '4px 6px',
  },
  searchWrap: { background: W.bg, padding: '4px 12px 6px', flexShrink: 0 },
  searchBox: {
    background: W.cell, borderRadius: 6, padding: '3px 10px',
    display: 'flex', alignItems: 'center', gap: 8, height: 24,
  },
  searchIcon: { display: 'flex', opacity: 0.55 },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    fontSize: 14, color: W.text, fontFamily: 'inherit',
  },
  list: { flex: 1, overflowY: 'auto' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: W.cell, padding: '9px 16px',
    borderBottom: `0.5px solid ${W.line}`, cursor: 'pointer',
  },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 17, color: W.text, marginBottom: 4 },
  rowPreview: { fontSize: 14, color: W.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowTime: { fontSize: 12, color: W.time, alignSelf: 'flex-start', paddingTop: 3, flexShrink: 0 },
  backdrop: { position: 'absolute', inset: 0, zIndex: 20, background: 'transparent' },
  menu: {
    position: 'absolute', top: 'calc(var(--status-bar-h) + 52px)', right: 8,
    background: '#4C4C4C', borderRadius: 6, overflow: 'hidden',
    zIndex: 30, boxShadow: '0 2px 10px rgba(0,0,0,0.3)', minWidth: 170,
  },
  menuItem: {
    padding: '13px 20px', fontSize: 16, color: '#fff', cursor: 'pointer',
    borderBottom: '0.5px solid rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  centerHint: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: W.sub, fontSize: 14 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 18, opacity: 0.9, marginBottom: 6 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: W.text },
  emptyText: { color: W.sub, fontSize: 14, marginBottom: 8 },
  emptyBtn: { background: W.green, color: '#fff', border: 'none', borderRadius: 6, padding: '10px 28px', fontSize: 15, cursor: 'pointer' },
};
