/**
 * CosyVoice Provider
 * Alibaba open-source TTS — runs locally or via API
 * Local endpoint: http://localhost:50000/tts
 * Supports voice cloning from 3-10s audio sample
 */

const BaseProvider = require('./baseProvider');

class CosyVoiceProvider extends BaseProvider {
  constructor() {
    super('cosyvoice');
  }

  isAvailable() {
    return !!process.env.COSYVOICE_ENDPOINT;
  }

  async generateVoice(text, persona = {}) {
    const endpoint = process.env.COSYVOICE_ENDPOINT || 'http://localhost:50000';

    const speed = persona.speed === 'slow' ? 0.8 : 1.0;
    const voiceId = persona.voice_id || 'default';

    const response = await fetch(`${endpoint}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        speed,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`CosyVoice error (${response.status}): ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.audio_base64) {
      return { audioBuffer: Buffer.from(data.audio_base64, 'base64'), format: 'wav' };
    }

    // Raw audio response
    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength > 0) {
      return { audioBuffer: Buffer.from(arrayBuf), format: 'wav' };
    }

    throw new Error('CosyVoice returned no audio');
  }
}

module.exports = CosyVoiceProvider;
