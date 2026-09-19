require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { initDb, listPersonas } = require('./db/database');
const { upsertPersona } = require('./db/sqlite');
const personasRouter = require('./routes/personas');
const uploadRouter = require('./routes/upload');
const setupCallHandler = require('./websocket/callHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', personasRouter);
app.use('/api', uploadRouter);
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/asr'));
app.use('/api', require('./routes/voiceClone'));
// /api/lt-avatar 已移除 — 交付版不再支持创建新数字人形象

// Serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 云端单端口方案:把 NMS(:8080)的流媒体转发出去,
// 手机/浏览器经公网网关只连本端口即可拉流(长连接,直通管道)。
// HLS 不走 NMS:LT 的 rtmp.py 会起独立 ffmpeg 把 rtmp remux 成 2 秒一片的 HLS
// 写到 ../media/hls(见 rtmp.py 的 _hls_dir),下面 static 直接从磁盘发 m3u8+ts ——
// 安卓/iOS 手机必须用系统原生 HLS 播放器(WebView 里 flv.js/MSE 和网页内录音不共存,
// 见 player.html 的 NATIVE_HLS)。桌面 Chrome 没有这个坑,继续下面代理走 FLV 低延迟。
// 本地链路没有 NMS 也没有 hls 目录,static 404 自然落到代理(NMS 不在 → 502),本地不会用到。
const hlsDir = process.env.HLS_DIR || path.join(__dirname, '..', 'media', 'hls');
app.use('/live', express.static(hlsDir, {
  fallthrough: true,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
}));
// 通配 /live/*:FLV 是 /live/livestream.flv(HLS 的 m3u8/ts 已被上面 static 接走)
app.get('/live/*', (req, res) => {
  const sub = req.params[0] || '';
  const upstream = http.request({ host: 'localhost', port: 8080, path: `/live/${sub}` });
  upstream.on('response', (u) => {
    if (u.statusCode !== 200) { res.status(u.statusCode || 502).end(); return; }
    const ct = sub.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl'
      : sub.endsWith('.ts') ? 'video/mp2t'
      : 'video/x-flv';
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    u.pipe(res);
    // 客户端断开时立刻拆掉上游连接,避免僵尸流
    res.on('close', () => upstream.destroy());
  });
  upstream.on('error', () => { if (!res.headersSent) res.status(502).end('stream down'); });
  upstream.end();
});

// Serve Vite build output (dist/)
// index.html 每次都要求浏览器重新验证:部署新版本后,手机 Safari 若还在用缓存的
// 旧 index.html,会引用已经删掉的旧哈希资源 → 满屏 404
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  next();
});
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  const indexPath = path.join(distDir, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// WebSocket call handler
setupCallHandler(wss);

// Initialize database
initDb();

// Sync personas into sqlite — memory/facts tables have a FK to persona(id),
// and personas are the source of truth in data.json
listPersonas().forEach(p => {
  upsertPersona(p).catch(e => console.warn('[SQLite] persona sync failed:', e.message));
});

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Digital Human Call Platform`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Zhipu API key: ${process.env.ZHIPU_API_KEY ? '✓ configured' : '✗ missing'}`);
  console.log(`[Server] Fish Audio key: ${process.env.FISH_AUDIO_API_KEY ? '✓ configured' : '✗ missing'}`);
  console.log(`[Server] D-ID API key: ${process.env.DID_API_KEY ? '✓ configured' : '✗ missing'}`);
});
