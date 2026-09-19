/**
 * MuseTalk Service (P6)
 * Local GPU-based talking head — replaces D-ID
 * Same interface as didService for drop-in replacement
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const MUSE_ENDPOINT = process.env.MUSETALK_ENDPOINT || 'http://localhost:8765';

async function createStream(imagePath) {
  const sessionId = uuidv4();
  // Cache the image path for this session
  const tmpDir = path.join(__dirname, '..', 'uploads', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const cachedImage = path.join(tmpDir, `${sessionId}.jpg`);

  // Copy image to cache
  if (imagePath.startsWith('http')) {
    const resp = await fetch(imagePath);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(cachedImage, buf);
  } else {
    fs.copyFileSync(path.join(__dirname, '..', imagePath), cachedImage);
  }

  console.log(`[MuseTalk] Session: ${sessionId}`);
  return {
    id: sessionId,
    session_id: sessionId,
    offer: null,     // no WebRTC — we use HTTP video
    ice_servers: null,
  };
}

async function generateVideo(sessionId, text, ttsAudioBuffer) {
  // Save TTS audio
  const tmpDir = path.join(__dirname, '..', 'uploads', 'tmp');
  const audioPath = path.join(tmpDir, `${sessionId}_tts.wav`);
  const imagePath = path.join(tmpDir, `${sessionId}.jpg`);
  const videoPath = path.join(tmpDir, `${sessionId}_out.mp4`);

  fs.writeFileSync(audioPath, ttsAudioBuffer);

  // Call MuseTalk Python server
  const resp = await fetch(`${MUSE_ENDPOINT}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imagePath,
      audio: audioPath,
      output: videoPath,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`MuseTalk error: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (data.status !== 'ok') throw new Error('MuseTalk generation failed');

  console.log(`[MuseTalk] Video: ${videoPath}`);
  return videoPath;
}

async function closeStream(sessionId) {
  // Clean up temp files
  const tmpDir = path.join(__dirname, '..', 'uploads', 'tmp');
  const files = ['.jpg', '_tts.wav', '_out.mp4'].map(ext =>
    path.join(tmpDir, `${sessionId}${ext}`)
  );
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}

module.exports = { createStream, generateVideo, closeStream };
