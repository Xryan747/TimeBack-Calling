// 服务 — payment QR code + payment instructions (configured by the app provider)
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, updateSettings, uploadPhoto } from '../services/api';
import { W, photoSrc } from './wechatTheme';

export default function ServicesPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setQrUrl(s.payment_qr_url || '');
      setNote(s.payment_note || '');
    }).catch(e => alert('加载服务信息失败: ' + e.message));
  }, []);

  async function pickQr(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const { url } = await uploadPhoto(f);
      setQrUrl(url);
    } catch (err) {
      alert('付款码上传失败: ' + err.message);
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    try {
      const s = await updateSettings({ payment_qr_url: qrUrl, payment_note: note });
      setSettings(s);
      setEditing(false);
      alert('已保存');
    } catch (err) {
      alert('保存失败: ' + err.message);
    }
    setBusy(false);
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>‹</button>
        <span style={S.headerTitle}>服务</span>
        <button style={S.editBtn} onClick={() => {
          if (editing) { setQrUrl(settings?.payment_qr_url || ''); setNote(settings?.payment_note || ''); }
          setEditing(v => !v);
        }}>
          {editing ? '取消' : '编辑'}
        </button>
      </div>

      {!settings ? (
        <div style={S.hint}>加载中...</div>
      ) : editing ? (
        // Edit mode — provider uploads the payment QR and writes the instructions
        <div style={S.body}>
          <div style={S.section}>
            <div style={S.sectionTitle}>付款码</div>
            <button style={S.uploadBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? '上传中...' : qrUrl ? '重新上传付款码' : '上传付款码图片'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickQr} />
            {qrUrl && <img src={photoSrc(qrUrl)} style={S.qrPreview} alt="付款码预览" />}
          </div>
          <div style={S.section}>
            <div style={S.sectionTitle}>付款说明</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：扫码付款后请截图联系客服，金额 X 元，备注姓名..."
              style={S.noteInput}
              rows={5}
            />
          </div>
          <button style={S.saveBtn} onClick={save} disabled={busy}>
            {busy ? '保存中...' : '保存'}
          </button>
        </div>
      ) : (
        // View mode — what the customer sees
        <div style={S.body}>
          <div style={S.section}>
            <div style={S.sectionTitle}>付款码</div>
            {settings.payment_qr_url ? (
              <img src={photoSrc(settings.payment_qr_url)} style={S.qrView} alt="付款码" />
            ) : (
              <div style={S.placeholder}>尚未设置付款码</div>
            )}
          </div>
          {settings.payment_note ? (
            <div style={S.section}>
              <div style={S.sectionTitle}>付款说明</div>
              <div style={S.noteView}>{settings.payment_note}</div>
            </div>
          ) : null}
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
  editBtn: { background: 'none', border: 'none', fontSize: 15, color: W.green, cursor: 'pointer', padding: '4px 6px' },
  hint: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: W.sub, fontSize: 14 },
  body: { flex: 1, overflowY: 'auto', padding: '16px 16px calc(24px + var(--safe-bottom))' },
  section: {
    background: W.cell, borderRadius: 8, padding: 16, marginBottom: 12,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 15, fontWeight: 600, color: W.text },
  uploadBtn: {
    background: W.green, color: '#fff', border: 'none', borderRadius: 6,
    padding: '10px 20px', fontSize: 15, cursor: 'pointer',
  },
  qrPreview: { width: 160, height: 160, objectFit: 'contain', borderRadius: 6, border: `0.5px solid ${W.line}` },
  qrView: { width: 200, height: 200, objectFit: 'contain', borderRadius: 6 },
  placeholder: { color: W.sub, fontSize: 14, padding: '30px 0' },
  noteInput: {
    width: '100%', boxSizing: 'border-box', background: '#fff',
    border: `0.5px solid ${W.line}`, borderRadius: 6, padding: 10,
    fontSize: 15, color: W.text, outline: 'none', resize: 'vertical',
    lineHeight: 1.5, fontFamily: 'inherit',
  },
  noteView: {
    width: '100%', boxSizing: 'border-box', fontSize: 15, color: W.text,
    lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  saveBtn: {
    width: '100%', background: W.green, color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 0', fontSize: 16, cursor: 'pointer', marginTop: 4,
  },
};
