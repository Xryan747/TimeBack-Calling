// 管理已有数字人 — list all personas, tap to edit, delete with confirm
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, deletePersona } from '../services/api';
import WeAvatar from '../components/WeAvatar';
import { W, photoSrc } from './wechatTheme';

export default function ManagePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await listPersonas());
    } catch (e) {
      alert('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(p) {
    if (!confirm(`确定删除数字人「${p.name}」吗？相关聊天记录也会一并删除。`)) return;
    try {
      await deletePersona(p.id);
      load();
    } catch (e) {
      alert('删除失败: ' + e.message);
    }
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>‹</button>
        <span style={S.headerTitle}>管理数字人</span>
      </div>

      {loading ? (
        <div style={S.hint}>加载中...</div>
      ) : items.length === 0 ? (
        <div style={S.empty}>
          <p style={S.hint}>还没有数字人</p>
        </div>
      ) : (
        <div style={S.list}>
          {items.map(p => (
            <div key={p.id} style={S.row} onClick={() => navigate(`/edit/${p.id}`)}>
              <WeAvatar src={photoSrc(p.photo_url)} name={p.name} size={44} />
              <div style={S.rowMid}>
                <div style={S.rowName}>{p.name}</div>
              </div>
              <button
                style={S.delBtn}
                onClick={(e) => { e.stopPropagation(); remove(p); }}
              >
                删除
              </button>
              <span style={S.chevron}>›</span>
            </div>
          ))}
        </div>
      )}
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
  createBtn: { background: 'none', border: 'none', fontSize: 15, color: W.green, cursor: 'pointer', padding: '4px 6px' },
  hint: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: W.sub, fontSize: 14 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyBtn: { background: W.green, color: '#fff', border: 'none', borderRadius: 6, padding: '10px 28px', fontSize: 15, cursor: 'pointer' },
  list: { flex: 1, overflowY: 'auto' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: W.cell, padding: '10px 16px',
    borderBottom: `0.5px solid ${W.line}`, cursor: 'pointer',
  },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 17, color: W.text },
  delBtn: {
    background: 'none', border: '1px solid #FA5151', color: '#FA5151',
    borderRadius: 4, padding: '4px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0,
  },
  chevron: { fontSize: 20, color: '#C7C7C7' },
};
