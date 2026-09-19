// App-level settings — payment QR code + payment instructions shown in the 服务 page
const express = require('express');
const { getSettings, updateSettings } = require('../db/database');

const router = express.Router();

// GET /api/settings
router.get('/settings', (req, res) => {
  try {
    res.json({ success: true, data: getSettings() });
  } catch (err) {
    console.error('[Settings] GET error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings — { payment_qr_url, payment_note }
router.put('/settings', (req, res) => {
  try {
    const data = updateSettings(req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Settings] PUT error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
