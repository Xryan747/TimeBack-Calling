const express = require('express');
const fs = require('fs');
const path = require('path');
const { listPersonas, getPersona, updatePersona, deletePersona, getCallHistory, getMessages } = require('../db/database');

const router = express.Router();

// POST /api/personas 已移除 — 交付版不再支持创建新数字人

// GET /api/personas — List all personas
router.get('/personas', (req, res) => {
  try {
    const personas = listPersonas();
    res.json({ success: true, data: personas });
  } catch (err) {
    console.error('[Personas] List error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/personas/:id — Get persona detail
router.get('/personas/:id', (req, res) => {
  try {
    const persona = getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }
    res.json({ success: true, data: persona });
  } catch (err) {
    console.error('[Personas] Get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/personas/:id — Update persona
router.put('/personas/:id', async (req, res) => {
  try {
    const existing = getPersona(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '数字人不存在' });

    const { name, photoPath, audioPath, chatLogs } = req.body;

    // Update basic fields first
    const updated = updatePersona(req.params.id, {
      name: name || existing.name,
      photo_url: photoPath || existing.photo_url,
      audio_url: audioPath || existing.audio_url,
      chat_logs: chatLogs || existing.chat_logs,
    });

    // If chat logs changed, regenerate system prompt
    if (chatLogs && chatLogs !== existing.chat_logs) {
      try {
        const { analyzePersona } = require('../services/llmService');
        const analysis = await analyzePersona(chatLogs);
        updatePersona(req.params.id, {
          profile: {
            traits: analysis.traits || [],
            speechPatterns: analysis.speechPatterns || [],
            background: analysis.background || '',
          },
          system_prompt: analysis.systemPrompt,
        });
      } catch (err) {
        console.warn('[Personas] LLM re-analysis failed:', err.message);
      }
    }

    console.log(`[Personas] Updated: ${updated.id}`);
    res.json({ success: true, data: getPersona(req.params.id) });
  } catch (err) {
    console.error('[Personas] Update error:', err.message);
    res.status(500).json({ success: false, error: `更新失败: ${err.message}` });
  }
});

// DELETE /api/personas/:id — Delete persona
router.delete('/personas/:id', (req, res) => {
  try {
    const persona = deletePersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }

    // Clean up uploaded files
    if (persona.photo_url) {
      const photoPath = path.join(__dirname, '..', persona.photo_url);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    if (persona.audio_url) {
      const audioPath = path.join(__dirname, '..', persona.audio_url);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }

    console.log(`[Personas] Deleted: ${persona.id}`);
    res.json({ success: true, data: { id: persona.id } });
  } catch (err) {
    console.error('[Personas] Delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/personas/:id/calls — Get call history
router.get('/personas/:id/calls', (req, res) => {
  try {
    const persona = getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }
    const calls = getCallHistory(req.params.id);
    res.json({ success: true, data: calls });
  } catch (err) {
    console.error('[Personas] Call history error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/personas/:id/messages — Text chat history (oldest → newest)
router.get('/personas/:id/messages', (req, res) => {
  try {
    const persona = getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }
    const limit = parseInt(req.query.limit, 10) || 100;
    res.json({ success: true, data: getMessages(req.params.id, limit) });
  } catch (err) {
    console.error('[Personas] Messages error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
