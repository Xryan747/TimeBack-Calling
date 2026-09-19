/**
 * TTS Service
 * Current: Uses iOS native TTS (free, accessible, decent quality)
 * Future: Fish Audio, Zhipu-Realtime, or domestic TTS can be plugged in
 */

async function textToSpeech() {
  // Fast fallback to iOS native TTS via frontend
  throw new Error('TTS unavailable — using iOS native voice');
}

module.exports = { textToSpeech };
