/**
 * Zhipu ASR Service — GLM-ASR-2512
 * ¥0.06/min, zh-CN + dialects, direct connection in China
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ASR_API = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';

async function transcribe(audioBuffer, mimeType = 'audio/wav', filename = 'audio.wav') {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const ext = path.extname(filename) || '.wav';

  // Use Node.js native FormData + Blob
  const fileContent = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append('model', 'glm-asr-2512');
  formData.append('stream', 'false');
  formData.append('file', fileContent, `audio${ext}`);

  console.log(`[ASR] Sending ${audioBuffer.length} bytes as ${mimeType}...`);

  const response = await fetch(ASR_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ASR error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  console.log('[ASR] Response text:', JSON.stringify(data.text || '').slice(0, 100));
  return (data.text || data.transcription || '').trim();
}

module.exports = { transcribe };
