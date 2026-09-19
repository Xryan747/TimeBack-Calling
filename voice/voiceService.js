/**
 * Voice Service — unified TTS entry point
 * Fallback chain: MiniMax → CosyVoice → iOS native TTS
 */

const MiniMaxProvider = require('./minimaxProvider');
const CosyVoiceProvider = require('./cosyvoiceProvider');

const providers = [
  new MiniMaxProvider(),
  new CosyVoiceProvider(),
];

/**
 * normalizeWav — 就地归一化 WAV(16bit PCM)响度
 * MiniMax 原始输出峰值只有 ~0.33(-9.6 dBFS),比正常内容轻很多——
 * 按峰值提到 0.95(最多放大 3 倍),不改变采样率/时长。
 * 非 PCM16 的 WAV(或非 wav 格式)原样返回。
 */
function normalizeWav(buffer, targetPeak = 0.95, maxGain = 3.0) {
  try {
    if (buffer.length < 44) return buffer;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return buffer;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let off = 12, fmt = null, dataOff = -1, dataLen = 0;
    while (off + 8 <= buffer.length) {
      const id = buffer.toString('ascii', off, off + 4);
      const size = view.getUint32(off + 4, true);
      if (id === 'fmt ') fmt = off + 8;
      if (id === 'data') { dataOff = off + 8; dataLen = size; }
      off += 8 + size + (size % 2);
    }
    if (fmt === null || dataOff < 0) return buffer;
    if (view.getUint16(fmt, true) !== 1 || view.getUint16(fmt + 14, true) !== 16) return buffer; // 只处理 16bit PCM
    const n = Math.floor(dataLen / 2);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.abs(view.getInt16(dataOff + i * 2, true));
      if (s > peak) peak = s;
    }
    if (peak < 1) return buffer; // 静音,不动
    const gain = Math.min((targetPeak * 32767) / peak, maxGain);
    if (gain <= 1.0) return buffer; // 已经够响,不动
    for (let i = 0; i < n; i++) {
      const s = Math.round(view.getInt16(dataOff + i * 2, true) * gain);
      view.setInt16(dataOff + i * 2, Math.max(-32768, Math.min(32767, s)), true);
    }
  } catch { /* 解析失败保持原样 */ }
  return buffer;
}

/**
 * generateVoice
 * Tries each provider in order, falls back to null (frontend TTS)
 * @param {string} text
 * @param {object} persona — { nickname, speed, emotion, voice_id }
 * @returns {Promise<{audioBuffer: Buffer|null, format: string, provider: string}>}
 */
async function generateVoice(text, persona = {}) {
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;

    try {
      console.log(`[Voice] Trying ${provider.name}...`);
      const result = await provider.generateVoice(text, persona);
      if (result.audioBuffer && result.format === 'wav') normalizeWav(result.audioBuffer);
      console.log(`[Voice] ${provider.name} OK — ${result.audioBuffer.length} bytes`);
      return { ...result, provider: provider.name };
    } catch (err) {
      console.warn(`[Voice] ${provider.name} failed:`, err.message);
    }
  }

  // Fallback: no audio — frontend will use iOS native TTS
  console.log('[Voice] No provider available — fallback to iOS native TTS');
  return { audioBuffer: null, format: 'mp3', provider: 'ios-native' };
}

module.exports = { generateVoice };
