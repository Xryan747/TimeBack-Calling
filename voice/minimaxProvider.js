/**
 * MiniMax Voice Provider
 * API: https://api.minimax.chat/v1/t2a_v2
 * Domestic TTS — accessible in China, good quality
 */

const BaseProvider = require('./baseProvider');

class MiniMaxProvider extends BaseProvider {
  constructor() {
    super('minimax');
  }

  isAvailable() {
    return !!process.env.MINIMAX_API_KEY;
  }

  /**
   * cloneVoice — upload audio sample, get back a voice_id
   * @param {Buffer} audioBuffer — WAV/MP3 10-30s sample
   * @param {string} voiceName — name for the cloned voice
   * @returns {Promise<string>} voice_id
   */
  async cloneVoice(audioBuffer, voiceName = 'cloned-voice') {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not configured');

    // Step 1: Upload file → file_id
    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'sample.wav');
    uploadForm.append('purpose', 'voice_clone');

    const uploadResp = await fetch('https://api.minimax.chat/v1/files/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: uploadForm,
    });

    if (!uploadResp.ok) {
      const err = await uploadResp.text();
      throw new Error(`Upload failed (${uploadResp.status}): ${err.slice(0, 200)}`);
    }

    const uploadData = await uploadResp.json();
    const fileId = uploadData.file?.file_id || uploadData.file_id;
    if (!fileId) {
      console.log('Upload response:', JSON.stringify(uploadData).slice(0, 300));
      throw new Error('MiniMax upload returned no file_id');
    }
    console.log(`[MiniMax] File uploaded: ${fileId}`);

    // Step 2: Clone voice
    const cloneResp = await fetch('https://api.minimax.chat/v1/voice_clone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        voice_name: voiceName,
        language: 'zh-CN',
      }),
    });

    const cloneData = await cloneResp.json();
    console.log('Clone response:', JSON.stringify(cloneData).slice(0, 300));

    if (!cloneResp.ok || (cloneData.base_resp && cloneData.base_resp.status_code !== 0)) {
      throw new Error(`Clone failed: ${cloneData.base_resp?.status_msg || cloneResp.status}`);
    }

    const voiceId = cloneData.voice_id || cloneData.data?.voice_id;
    if (!voiceId) throw new Error('No voice_id in clone response');

    console.log(`[MiniMax] Voice cloned: ${voiceId}`);
    return voiceId;
  }

  async generateVoice(text, persona = {}) {
    const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY_2;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not configured');

    const speed = persona.speed === 'slow' ? 0.8 : 1.0;
    const voiceId = persona.voice_id || process.env.MINIMAX_VOICE_ID || 'female-qn-qingse';

    const response = await fetch('https://api.minimax.chat/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-01-turbo',
        text,
        voice_setting: {
          voice_id: voiceId,
          speed,
          pitch: 0,
          volume: 1.5,
        },
        audio_setting: {
          sample_rate: 24000,
          format: 'wav',  // wav 是 PCM,node 端可直接做响度归一化(mp3 解不了码)
          bitrate: 128000,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`MiniMax error (${response.status}): ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`MiniMax: ${data.base_resp?.status_msg || 'unknown error'}`);
    }

    // MiniMax returns hex-encoded audio (audio_setting.format 现在是 wav)
    if (data.data?.audio) {
      const audioBuffer = Buffer.from(data.data.audio, 'hex');
      return { audioBuffer, format: 'wav' };
    }

    // Or it might return a URL
    if (data.audio_file) {
      const audioResp = await fetch(data.audio_file);
      const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
      return { audioBuffer, format: 'wav' };
    }

    throw new Error('MiniMax returned no audio');
  }
}

module.exports = MiniMaxProvider;
