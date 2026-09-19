const { v4: uuidv4 } = require('uuid');
const { analyzePersona } = require('./llmService');
const { insertPersona, getPersona } = require('../db/database');

async function createPersona({ name, photoPath, audioPath, chatLogs }) {
  // Analyze chat logs with LLM
  let profile;
  let systemPrompt;

  if (chatLogs && chatLogs.trim().length >= 10) {
    try {
      const analysis = await analyzePersona(chatLogs);
      profile = {
        traits: analysis.traits || [],
        speechPatterns: analysis.speechPatterns || [],
        background: analysis.background || '',
      };
      systemPrompt = analysis.systemPrompt;
      if (!name || name === '未命名') {
        name = analysis.name || '未命名';
      }
    } catch (err) {
      console.error('[PersonaService] LLM analysis failed, using fallback:', err.message);
      profile = { traits: [], speechPatterns: [], background: '' };
      systemPrompt = `你是${name || '一个数字人'}。请用自然的口语化中文回复，保持温暖亲切的语气。`;
    }
  } else {
    profile = { traits: [], speechPatterns: [], background: '' };
    systemPrompt = `你是${name || '一个数字人'}。请用自然的口语化中文回复，保持温暖亲切的语气。`;
  }

  const persona = {
    id: uuidv4(),
    name: name || '未命名',
    photo_url: photoPath || null,
    audio_url: audioPath || null,
    profile,
    system_prompt: systemPrompt,
    chat_logs: chatLogs || null,
  };

  return insertPersona(persona);
}

module.exports = { createPersona };
