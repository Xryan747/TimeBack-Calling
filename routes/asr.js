const express = require('express');
const multer = require('multer');
const { transcribe } = require('../services/asrService');

const router = express.Router();

// Multer: store audio in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// POST /api/asr — Transcribe audio
router.post('/asr', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No audio file' });
    }

    console.log(`[ASR] Received ${req.file.size} bytes (${req.file.mimetype}), transcribing...`);
    const tAsr = Date.now();
    const text = await transcribe(
      req.file.buffer,
      req.file.mimetype || 'audio/wav',
      req.file.originalname || 'audio.wav'
    );

    console.log(`[Perf] ASR ${Date.now() - tAsr} ms`);
    console.log(`[ASR] Result: "${text}"`);
    res.json({ success: true, data: { text } });
  } catch (err) {
    console.error('[ASR] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
