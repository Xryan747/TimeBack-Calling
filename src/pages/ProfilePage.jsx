// WeChat-style "我" page — account card (avatar + name only), 服务, 设置
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto } from '../services/api';
import WeAvatar from '../components/WeAvatar';
import BottomTabBar from '../components/BottomTabBar';
import Icon from '../components/Icon';
import { W, photoSrc } from './wechatTheme';

const ACCOUNT = 'xryan'; // login account, shown read-only

function readName() { return localStorage.getItem('account_name') || ACCOUNT; }
function readAvatar() { return localStorage.getItem('account_avatar') || ''; }

export default function ProfilePage() {
  const navigate = useNavigate();
  const [name, setName] = useState(readName());
  const [avatar, setAvatar] = useState(readAvatar());
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function pickAvatar(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const { url } = await uploadPhoto(f);
      localStorage.setItem('account_avatar', url);
      setAvatar(url);
    } catch (err) {
      alert('头像上传失败: ' + err.message);
    }
    setBusy(false);
  }

  function saveName() {
    const v = nameDraft.trim() || ACCOUNT;
    localStorage.setItem('account_name', v);
    setName(v);
    setEditingName(false);
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>我</div>

      {/* Account card — avatar + name editable, nothing else */}
      <div style={S.card}>
        <div style={S.cardRow}>
          <div style={S.avatarWrap} onClick={() => fileRef.current?.click()}>
            <WeAvatar src={photoSrc(avatar)} name={name} size={56} radius={6} />
            <span style={S.avatarHint}>{busy ? '…' : '改'}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
          <div style={S.cardMid}>
            {editingName ? (
              <div style={S.nameEditRow}>
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveName(); }}
                  style={S.nameInput}
                />
                <button style={S.nameSave} onClick={saveName}>保存</button>
              </div>
            ) : (
              <div
                style={S.nameRow}
                onClick={() => { setNameDraft(name); setEditingName(true); }}
              >
                <span style={S.name}>{name}</span>
                <span style={S.pen}><Icon name="edit" size={14} color={W.sub} /></span>
              </div>
            )}
            <div style={S.account}>账号：{ACCOUNT}</div>
          </div>
        </div>
      </div>

      {/* 服务 / 设置 */}
      <div style={S.group}>
        <div style={S.row} onClick={() => navigate('/services')}>
          <span style={S.rowLabel}>服务</span>
          <span style={S.chevron}>›</span>
        </div>
        <div style={S.row} onClick={() => navigate('/settings')}>
          <span style={S.rowLabel}>设置</span>
          <span style={S.chevron}>›</span>
        </div>
        <div style={{ ...S.row, borderBottom: 'none' }} onClick={() => navigate('/about')}>
          <span style={S.rowLabel}>关于</span>
          <span style={S.chevron}>›</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom tab bar — 联系人 / 我 */}
      <BottomTabBar />
    </div>
  );
}

const S = {
  page: { height: '100%', background: W.bg, display: 'flex', flexDirection: 'column' },
  header: {
    background: W.headerBg, padding: 'calc(var(--status-bar-h) + 10px) 16px 12px',
    fontSize: 17, fontWeight: 600, color: W.text, textAlign: 'center',
    borderBottom: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  card: { background: W.cell, padding: '20px 16px', marginBottom: 10 },
  cardRow: { display: 'flex', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative', cursor: 'pointer', flexShrink: 0 },
  avatarHint: {
    position: 'absolute', right: -2, bottom: -2,
    background: W.green, color: '#fff', fontSize: 10, width: 18, height: 18,
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid #fff',
  },
  cardMid: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  name: { fontSize: 20, fontWeight: 600, color: W.text },
  pen: { display: 'flex' },
  account: { fontSize: 13, color: W.sub, marginTop: 4 },
  nameEditRow: { display: 'flex', gap: 8 },
  nameInput: {
    flex: 1, background: '#fff', border: `0.5px solid ${W.line}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 16, color: W.text, outline: 'none', minWidth: 0,
  },
  nameSave: {
    background: W.green, color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 14, cursor: 'pointer', flexShrink: 0,
  },
  group: { background: W.cell, marginBottom: 10 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', cursor: 'pointer',
    borderBottom: `0.5px solid ${W.line}`,
  },
  rowLabel: { fontSize: 16, color: W.text },
  chevron: { fontSize: 20, color: '#C7C7C7' },
};
