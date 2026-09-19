import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, deletePersona } from '../services/api';
import { getServerHost, setServerHost, clearServerHost } from '../services/config';
import PersonaCard from '../components/PersonaCard';

export default function HomePage() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverInput, setServerInput] = useState(getServerHost());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  async function loadPersonas() {
    try {
      setLoading(true);
      setError(null);
      const data = await listPersonas();
      setPersonas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('确定要删除这个数字人吗？')) return;
    try {
      await deletePersona(id);
      setPersonas(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(`删除失败: ${err.message}`);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>数字人通话</h1>
          <span style={styles.subtitle}>{personas.length} 个数字人</span>
        </div>
        <button
          style={styles.settingsBtn}
          onClick={() => setShowSettings(!showSettings)}
        >⚙</button>
      </header>

      {showSettings && (
        <div style={styles.settingsPanel}>
          <p style={styles.settingsLabel}>服务器地址（默认已连云端，一般不用改）</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="例如: http://192.168.1.5:3000"
              style={{ flex: 1, fontSize: 14 }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => {
                setServerHost(serverInput);
                setShowSettings(false);
                loadPersonas();
              }}
            >保存</button>
            <button
              className="btn btn-ghost"
              style={{ padding: '8px 12px', fontSize: 13 }}
              onClick={() => {
                clearServerHost();
                setServerInput(getServerHost());
                setShowSettings(false);
                loadPersonas();
              }}
            >恢复默认</button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {loading && (
          <>
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          </>
        )}

        {error && (
          <div style={styles.empty}>
            <p style={{ fontSize: 40 }}>⚠️</p>
            <p style={styles.emptyText}>加载失败: {error}</p>
            <button className="btn btn-ghost" onClick={loadPersonas}>重试</button>
          </div>
        )}

        {!loading && !error && personas.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: 64 }}>📹</p>
            <p style={styles.emptyTitle}>创建你的第一个数字人</p>
            <p style={styles.emptyText}>上传照片和聊天记录，生成专属的数字人进行视频通话</p>
          </div>
        )}

        {!loading && personas.map(p => (
          <PersonaCard
            key={p.id}
            persona={p}
            onClick={() => navigate(`/call/${p.id}`)}
            onDelete={(e) => handleDelete(p.id, e)}
          />
        ))}
      </div>

      <button
        style={styles.fab}
        onClick={() => navigate('/create')}
      >
        <span style={styles.fabIcon}>+</span>
        <span style={styles.fabText}>创建数字人</span>
      </button>
    </div>
  );
}

const styles = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '50px 16px 120px',
    overflow: 'hidden',
    background: '#0f0f0f',
  },
  header: {
    padding: '8px 0 20px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    padding: '4px 8px',
    color: '#a0a0a0',
  },
  settingsPanel: {
    background: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f5f5f5',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    paddingBottom: 20,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 16,
    color: '#f5f5f5',
  },
  emptyText: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 8,
    lineHeight: 1.5,
  },
  fab: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: 448,
    padding: '14px 0',
    background: '#07C160',
    color: '#fff',
    border: 'none',
    borderRadius: 28,
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 20px rgba(7, 193, 96, 0.4)',
    zIndex: 10,
  },
  fabIcon: {
    fontSize: 22,
    fontWeight: 300,
  },
  fabText: {},
};
