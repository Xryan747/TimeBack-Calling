/**
 * Voice Clone Service
 * Upload audio → MiniMax clone → store voice_id → use in TTS
 */

const MiniMaxProvider = require('../voice/minimaxProvider');
const { upsertVoiceClone, getVoiceClone } = require('../db/sqlite');

const minimax = new MiniMaxProvider();

async function cloneVoice(personaId, audioBuffer, voiceName) {
  if (!minimax.isAvailable()) {
    throw new Error('MINIMAX_API_KEY not configured — cannot clone voice');
  }

  // Clone via MiniMax
  const voiceId = await minimax.cloneVoice(audioBuffer, voiceName);

  // Store in DB
  await upsertVoiceClone({
    persona_id: personaId,
    provider: 'minimax',
    voice_id: voiceId,
    status: 'ready',
  });

  return voiceId;
}

async function getClonedVoiceId(personaId) {
  const vc = await getVoiceClone(personaId);
  if (vc && vc.status === 'ready' && vc.voice_id) {
    return vc.voice_id;
  }
  return null;
}

module.exports = { cloneVoice, getClonedVoiceId };
