// Server URL configuration
// 支持四种模式(优先级从高到低):
//  1. 用户手动设置(设置页输入框)→ localStorage server_url
//  2. 专属 APK 预置地址(打包时 VITE_SERVER_IP 注入)→ 客户电脑固定 IP
//  3. 网页/PWA 模式 → 同源(window.location.origin)
//  4. APK 原生模式(无预置无设置)→ 默认本机 localhost:3000

const STORAGE_KEY = 'server_url';

function normalize(u) {
  let s = (u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  s = s.replace(/\/+$/, '');
  // 老版本存的是纯 host(如 192.168.1.7)→ 补默认端口 3000
  if (!/:\d+$/.test(s)) s += ':3000';
  return s;
}

// 打包时注入的服务器 IP(专属 APK):VITE_SERVER_IP=192.168.x.x vite build
const bakedHost = (import.meta.env.VITE_SERVER_IP || '').trim();

function getBase() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalize(stored);
  if (bakedHost) return normalize(bakedHost);
  const h = window.location.hostname;
  // 网页/PWA:同源(电脑浏览器打开 http://电脑IP:3000 直接可用)
  if (h && h !== 'localhost' && h !== '127.0.0.1') return window.location.origin;
  // APK(capacitor://localhost)→ 默认连本机
  return 'http://localhost:3000';
}

export function getServerUrl() {
  return getBase();
}

export function getWsUrl() {
  return getBase().replace(/^http/, 'ws');
}

// LiveTalking 数字人渲染服务地址:与聊天服务同主机,端口 8010(WebRTC 直连)
export function getLtUrl() {
  const base = getBase();
  try {
    const u = new URL(base);
    return `${u.protocol}//${u.hostname}:8010/`;
  } catch {
    return 'http://localhost:8010/';
  }
}

export function getServerHost() {
  return getBase();
}

export function setServerHost(host) {
  localStorage.setItem(STORAGE_KEY, normalize(host));
}

export function clearServerHost() {
  localStorage.removeItem(STORAGE_KEY);
}
