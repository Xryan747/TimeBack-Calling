// WeChat-style shared palette + helpers
import { getServerUrl } from '../services/config';

// Upload paths are stored server-relative (/uploads/...); resolve against the server host
export function photoSrc(u) {
  if (!u) return null;
  return u.startsWith('/') ? getServerUrl() + u : u;
}

export const W = {
  bg: '#EDEDED',          // page / chat window background
  headerBg: '#F7F7F7',
  cell: '#FFFFFF',        // list row / chat input bar
  userBubble: '#95EC69',  // WeChat green bubble
  green: '#07C160',       // accents (send button, login button)
  text: '#191919',
  sub: '#8A8A8A',         // preview gray
  time: '#B2B2B2',
  line: '#E5E5E5',
};

// WeChat-style time: HH:MM today, 昨天, M/D otherwise
export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `${hh}:${mm}`;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// WeChat-style time divider for gaps in a conversation: 下午 3:24 / 昨天 下午 3:24 / 6月18日 下午 3:24
export function fmtDivider(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const h = d.getHours();
  const period = h < 6 ? '凌晨' : h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
  const hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${period} ${hh}:${mm}`;
  if (d.toDateString() === now.toDateString()) return time;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `昨天 ${time}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}
