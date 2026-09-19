const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createAvatar, pollTask } = require('../services/ltAvatarService');
const { getPersona, updatePersona } = require('../db/database');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer for video uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', 'videos');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${uuidv4()}_${file.originalname}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// POST /api/lt-avatar — Upload video + create LiveTalking avatar
router.post('/lt-avatar', upload.single('video'), async (req, res) => {
  try {
    const { personaId, avatarName } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: '请上传视频文件' });
    if (!personaId) return res.status(400).json({ success: false, error: 'Missing personaId' });

    const videoPath = req.file.path;
    const name = avatarName || req.file.originalname.replace(/\.[^.]+$/, '');

    console.log(`[LT Avatar] Creating avatar "${name}" from ${videoPath}`);

    // Derive avatar_id from name immediately — same as LT will use
    const avatarId = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');

    // Link avatar to persona NOW (don't wait for LT processing)
    updatePersona(personaId, { lt_avatar_id: avatarId });
    console.log(`[LT Avatar] Linked ${avatarId} to persona ${personaId}`);

    // Submit to LiveTalking for processing (can take minutes)
    createAvatar(videoPath, name)
      .then(({ taskId }) => pollTask(taskId))
      .then(() => console.log(`[LT Avatar] Done: ${avatarId}`))
      .catch(err => console.error('[LT Avatar]', err.message));

    res.json({ success: true, data: { avatarId, status: 'processing' } });
  } catch (err) {
    console.error('[LT Avatar] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
