// 编辑数字人 — 只能更换头像
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersona, uploadPhoto } from '../services/api';
import { getServerUrl } from '../services/config';
import { photoSrc } from './wechatTheme';
import WeAvatar from '../components/WeAvatar';
import Icon from '../components/Icon';

export default function EditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [persona, setPersona] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPersona(id).then(p => {
      setPersona(p);
      setPhotoUrl(p.photo_url || '');
      setLoaded(true);
    }).catch(() => setError('加载失败'));
  }, [id]);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const result = await uploadPhoto(file);
      const res = await fetch(`${getServerUrl()}/api/personas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: result.url }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotoUrl(result.url);
        setSuccess('头像已更新！');
        setTimeout(() => navigate('/manage', { replace: true }), 1000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(`更新失败: ${err.message}`);
    }
    setSaving(false);
  }

  if (!loaded) {
    return <div style={styles.loading}><div className="spinner" /></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>← 返回</button>
        <h2 style={styles.title}>更换头像</h2>
      </div>

      <div style={styles.scroll}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Icon name="image" size={18} color="#f5f5f5" />
            <div>
              <h3 style={styles.sectionTitle}>数字人头像</h3>
              <p style={styles.sectionSubtitle}>点击头像更换照片</p>
            </div>
          </div>
          <div style={styles.sectionContent}>
            <div style={styles.avatarWrap}>
              {saving ? (
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              ) : (
                <WeAvatar src={photoSrc(photoUrl)} name={persona?.name} size={96} />
              )}
              <button style={styles.changeBtn} onClick={() => fileRef.current?.click()} disabled={saving}>
                {photoUrl ? '更换照片' : '上传照片'}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }}
            />
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

const styles = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', background: '#0f0f0f' },
  header: { padding: '50px 16px 8px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#a0a0a0', fontSize: 15, cursor: 'pointer' },
  title: { fontSize: 20, fontWeight: 600, color: '#f5f5f5' },
  scroll: { flex: 1, overflowY: 'auto', padding: '0 16px 20px', WebkitOverflowScrolling: 'touch' },
  error: { background: 'rgba(231,76,60,0.12)', color: '#e74c3c', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  success: { background: 'rgba(7,193,96,0.12)', color: '#07C160', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#f5f5f5' },
  sectionSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  sectionContent: { background: '#1a1a1a', borderRadius: 14, padding: 20, border: '1px solid #2a2a2a' },
  avatarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  changeBtn: {
    background: '#07C160', color: '#fff', border: 'none', borderRadius: 20,
    padding: '9px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  loading: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' },
};
