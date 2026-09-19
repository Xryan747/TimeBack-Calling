import { useEffect, useState } from 'react';

export default function TranscriptOverlay({ userText, aiText }) {
  const [visibleUser, setVisibleUser] = useState('');
  const [visibleAi, setVisibleAi] = useState('');
  const [userKey, setUserKey] = useState(0);
  const [aiKey, setAiKey] = useState(0);

  useEffect(() => {
    if (userText) {
      setVisibleUser(userText);
      setVisibleAi('');
      setUserKey(k => k + 1);
    }
  }, [userText]);

  useEffect(() => {
    if (aiText) {
      setVisibleAi(aiText);
      setVisibleUser('');
      setAiKey(k => k + 1);
    }
  }, [aiText]);

  return (
    <div style={styles.overlay}>
      {visibleUser && (
        <div key={`u-${userKey}`} style={styles.bubbleUser}>
          <span style={styles.label}>你说：</span>
          {visibleUser}
        </div>
      )}
      {visibleAi && (
        <div key={`a-${aiKey}`} style={styles.bubbleAi}>
          <span style={styles.label}>对方：</span>
          {visibleAi}
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute',
    bottom: 200,
    left: 16,
    right: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    zIndex: 15,
    pointerEvents: 'none',
  },
  bubbleUser: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 16,
    fontSize: 15,
    maxWidth: '80%',
    textAlign: 'center',
    animation: 'fadeIn 0.3s ease',
  },
  bubbleAi: {
    background: 'rgba(7, 193, 96, 0.2)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 16,
    fontSize: 15,
    maxWidth: '80%',
    textAlign: 'center',
    animation: 'fadeIn 0.3s ease',
    border: '1px solid rgba(7, 193, 96, 0.3)',
  },
  label: {
    fontSize: 12,
    opacity: 0.7,
    marginRight: 4,
  },
};
