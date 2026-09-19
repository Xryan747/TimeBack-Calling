const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const audioDir = path.join(uploadsDir, 'audio');

[photosDir, audioDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      cb(null, photosDir);
    } else if (file.fieldname === 'audio') {
      cb(null, audioDir);
    } else {
      cb(new Error('Unknown field'));
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'photo') {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Photo must be jpg, png, webp, or gif'));
    }
  } else if (file.fieldname === 'audio') {
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Audio must be mp3, wav, m4a, ogg, flac, or aac'));
    }
  } else {
    cb(new Error('Unknown field'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
});

// POST /api/upload/photo
router.post('/upload/photo', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo file provided' });
    }
    const url = `/uploads/photos/${req.file.filename}`;
    res.json({ success: true, data: { url, filename: req.file.filename } });
  });
});

// POST /api/upload/audio
router.post('/upload/audio', (req, res) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }
    const url = `/uploads/audio/${req.file.filename}`;
    res.json({ success: true, data: { url, filename: req.file.filename } });
  });
});

// POST /api/upload/video — For LiveTalking avatar creation
const videoDir = path.join(uploadsDir, 'videos');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, videoDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp4';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

router.post('/upload/video', (req, res) => {
  videoUpload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file' });
    }
    res.json({
      success: true,
      data: {
        url: `/uploads/videos/${req.file.filename}`,
        path: req.file.path,
        filename: req.file.filename,
      },
    });
  });
});

module.exports = router;
