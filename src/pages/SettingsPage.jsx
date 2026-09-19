// 设置 — 服务器地址配置 + 退出账号
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerHost, setServerHost, clearServerHost } from '../services/config';
import { W } from './wechatTheme';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [serverInput, setServerInput] = useState(getServerHost());
  const [saved, setSaved] = useState('');

  function logout() {
    if (!confirm('确定要退出账号吗？')) return;
    localStorage.removeItem('auth');
    navigate('/', { replace: true });
  }

  function saveServer() {
    if (!serverInput.trim()) { setSaved('地址不能为空'); return; }
    setServerHost(serverInput);
    setSaved('已保存: ' + getServerHost());
  }

  function resetServer() {
    clearServerHost();
    setServerInput(getServerHost());
    setSaved('已恢复默认: ' + getServerHost());
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>‹</button>
        <span style={S.headerTitle}>设置</span>
        <span style={S.headerSpacer} />
      </div>

      <div style={S.group}>
        <div style={S.rowLabel}>服务器地址</div>
        <div style={S.row}>
          <input
            type="text"
            value={serverInput}
            onChange={(e) => setServerInput(e.target.value)}
            placeholder="例如: 192.168.1.200:3000"
            style={S.input}
          />
        </div>
        {saved && <div style={S.savedHint}>{saved}</div>}
        <div style={S.btnRow}>
          <button style={S.saveBtn} onClick={saveServer}>保存</button>
          <button style={S.resetBtn} onClick={resetServer}>恢复默认</button>
        </div>
      </div>

      <div style={S.group}>
        <div style={S.row} onClick={logout}>
          <span style={S.rowLabelRed}>退出账号</span>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { height: '100%', background: W.bg, display: 'flex', flexDirection: 'column' },
  header: {
    background: W.headerBg, padding: 'calc(var(--status-bar-h) + 8px) 12px 8px',
    display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  backBtn: { background: 'none', border: 'none', fontSize: 30, color: W.text, cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: 'inherit' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: W.text },
  headerSpacer: { width: 38 },
  group: { background: W.cell, marginTop: 10, paddingBottom: 12 },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '10px 16px',
  },
  rowLabel: { fontSize: 13, color: W.sub, padding: '12px 16px 4px' },
  input: {
    flex: 1, border: `0.5px solid ${W.line}`, borderRadius: 6, background: '#fff',
    padding: '10px 12px', fontSize: 15, color: W.text, outline: 'none', fontFamily: 'inherit',
  },
  savedHint: { fontSize: 13, color: W.green, padding: '4px 16px' },
  btnRow: { display: 'flex', gap: 10, padding: '8px 16px 0' },
  saveBtn: { background: W.green, color: '#fff', border: 'none', borderRadius: 6, padding: '9px 0', flex: 2, fontSize: 15, cursor: 'pointer' },
  resetBtn: { background: '#fff', color: W.text, border: `0.5px solid ${W.line}`, borderRadius: 6, padding: '9px 0', flex: 1, fontSize: 15, cursor: 'pointer' },
};
