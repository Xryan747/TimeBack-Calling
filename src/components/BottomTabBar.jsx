// Shared bottom tab bar — 联系人 / 我, persistent across the two root pages
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { W } from '../pages/wechatTheme';

export default function BottomTabBar({ onChatTap }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathname === '/me' ? 'me' : 'chat';

  return (
    <div style={S.tabBar}>
      <div style={S.tabItem} onClick={() => {
        if (pathname === '/chat') { onChatTap?.(); } else navigate('/chat');
      }}>
        <span style={S.tabIcon}>
          <Icon name="chat" size={22} color={active === 'chat' ? W.green : W.sub} />
        </span>
        <span style={{ ...S.tabLabel, color: active === 'chat' ? W.green : W.sub }}>联系人</span>
      </div>
      <div style={S.tabItem} onClick={() => navigate('/me')}>
        <span style={S.tabIcon}>
          <Icon name="user" size={22} color={active === 'me' ? W.green : W.sub} />
        </span>
        <span style={{ ...S.tabLabel, color: active === 'me' ? W.green : W.sub }}>我</span>
      </div>
    </div>
  );
}

const S = {
  tabBar: {
    background: W.cell, borderTop: `0.5px solid ${W.line}`,
    display: 'flex', padding: '6px 0 calc(4px + var(--safe-bottom))', flexShrink: 0,
  },
  tabItem: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    cursor: 'pointer', background: 'none', border: 'none',
  },
  tabIcon: { display: 'flex', lineHeight: 1 },
  tabLabel: { fontSize: 11 },
};
