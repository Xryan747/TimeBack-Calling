import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const VALID_USER = 'wanghongsheng';
const VALID_PASS = '123456';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    // Simulate brief auth check
    setTimeout(() => {
      if (username === VALID_USER && password === VALID_PASS) {
        localStorage.setItem('auth', 'true');
        navigate('/chat', { replace: true });
      } else {
        setError('账号或密码错误');
      }
      setLoading(false);
    }, 600);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo area */}
        <div style={styles.logo}>
          <img src="/icon-192.png" alt="Timeback Calling" style={styles.logoIcon} />
          <h1 style={styles.title}>Timeback Calling</h1>
          <p style={styles.subtitle}>找回那些熟悉的声音</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.inputGroup}>
            <span style={styles.inputIcon}><Icon name="user" size={16} color="#8A8A8A" /></span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="账号"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <span style={styles.inputIcon}><Icon name="lock" size={16} color="#8A8A8A" /></span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>

      <p style={styles.footer}>v1.0 · Digital Human Call</p>
    </div>
  );
}

const styles = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px 24px 40px',
    background: '#EDEDED',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    textAlign: 'center',
    marginBottom: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoIcon: {
    width: 84,
    height: 84,
    borderRadius: 20,
    marginBottom: 18,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#191919',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  error: {
    background: 'rgba(231,76,60,0.1)',
    color: '#e74c3c',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #E5E5E5',
    padding: '0 14px',
    transition: 'border-color 0.2s',
  },
  inputIcon: {
    display: 'flex',
    marginRight: 10,
    opacity: 0.5,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#191919',
    fontSize: 16,
    padding: '14px 0',
    outline: 'none',
    fontFamily: 'inherit',
  },
  btn: {
    width: '100%',
    padding: '14px 0',
    background: '#07C160',
    color: '#fff',
    border: 'none',
    borderRadius: 24,
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 44,
    fontSize: 12,
    color: '#B2B2B2',
  },
};
