export default function PersonaCard({ persona, onClick, onDelete }) {
  const traits = persona.profile?.traits || [];

  return (
    <div className="card" style={styles.card} onClick={onClick}>
      <div style={styles.photoWrap}>
        {persona.photo_url ? (
          <img src={persona.photo_url} alt={persona.name} style={styles.photo} />
        ) : (
          <div style={styles.photoPlaceholder}>
            <span style={{ fontSize: 36 }}>👤</span>
          </div>
        )}
      </div>
      <div style={styles.info}>
        <div style={styles.topRow}>
          <h3 style={styles.name}>{persona.name}</h3>
          <button style={styles.deleteBtn} onClick={onDelete} title="删除">
            🗑
          </button>
        </div>
        {traits.length > 0 && (
          <div style={styles.traits}>
            {traits.slice(0, 3).map((t, i) => (
              <span key={i} style={styles.tag}>{t}</span>
            ))}
          </div>
        )}
        <p style={styles.date}>
          创建于 {new Date(persona.created_at).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </div>
  );
}

const styles = {
  card: {
    display: 'flex',
    padding: 16,
    gap: 14,
    cursor: 'pointer',
    transition: 'transform 0.15s, background 0.15s',
  },
  photoWrap: {
    width: 80,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
    background: '#222',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a1a',
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 17,
    fontWeight: 600,
    color: '#f5f5f5',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 8px',
    opacity: 0.5,
  },
  traits: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    padding: '2px 10px',
    borderRadius: 10,
    background: 'rgba(7, 193, 96, 0.15)',
    color: '#07C160',
    fontSize: 12,
    fontWeight: 500,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
};
