/**
 * POST /api/voice-clone
 * Upload audio sample → MiniMax voice cloning
 */

const express = require('express');
const multer = require('multer');
const { cloneVoice, getClonedVoiceId } = require('../services/voiceCloneService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/voice-clone — Clone voice from audio sample
router.post('/voice-clone', upload.single('audio'), async (req, res) => {
  try {
    const { personaId, voiceName } = req.body;
    if (!req.file?.buffer) return res.status(400).json({ success: false, error: '请上传音频文件' });
    if (!personaId) return res.status(400).json({ success: false, error: 'Missing personaId' });

    console.log(`[VoiceClone] Cloning for ${personaId}, ${req.file.size} bytes`);
    const voiceId = await cloneVoice(personaId, req.file.buffer, voiceName || 'my-voice');

    res.json({ success: true, data: { voiceId } });
  } catch (err) {
    console.error('[VoiceClone] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice-clone/:personaId — Check if cloned voice exists
router.get('/voice-clone/:personaId', async (req, res) => {
  try {
    const voiceId = await getClonedVoiceId(req.params.personaId);
    res.json({ success: true, data: { voiceId: voiceId || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
