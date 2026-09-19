/**
 * JSON file-based database
 * Simple persistence without native dependencies
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

let data = { personas: [], calls: [], messages: [], settings: {} };
let initialized = false;

function initDb() {
  if (initialized) return;
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      data.personas = parsed.personas || [];
      data.calls = parsed.calls || [];
      data.messages = parsed.messages || [];
      data.settings = parsed.settings || {};
    } catch (err) {
      console.warn('[DB] Could not parse data.json, starting fresh:', err.message);
      data = { personas: [], calls: [], messages: [], settings: {} };
    }
  }
  initialized = true;
  console.log(`[DB] Loaded ${data.personas.length} personas, ${data.calls.length} calls, ${data.messages.length} messages`);
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Persona queries
function listPersonas() {
  return [...data.personas]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      audio_url: p.audio_url,
      profile: p.profile || {},
      created_at: p.created_at,
      last_message: getLastMessage(p.id),
    }));
}

function getPersona(id) {
  const persona = data.personas.find(p => p.id === id);
  if (!persona) return null;
  return { ...persona, profile: persona.profile || {} };
}

function insertPersona(persona) {
  const record = {
    id: persona.id,
    name: persona.name,
    photo_url: persona.photo_url || null,
    audio_url: persona.audio_url || null,
    profile: persona.profile || {},
    system_prompt: persona.system_prompt || '',
    chat_logs: persona.chat_logs || null,
    created_at: persona.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  data.personas.push(record);
  save();
  return getPersona(record.id);
}

function updatePersona(id, updates) {
  const idx = data.personas.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const persona = data.personas[idx];
  if (updates.name !== undefined) persona.name = updates.name;
  if (updates.photo_url !== undefined) persona.photo_url = updates.photo_url;
  if (updates.audio_url !== undefined) persona.audio_url = updates.audio_url;
  if (updates.chat_logs !== undefined) persona.chat_logs = updates.chat_logs;
  if (updates.profile !== undefined) persona.profile = updates.profile;
  if (updates.system_prompt !== undefined) persona.system_prompt = updates.system_prompt;
  if (updates.lt_avatar_id !== undefined) persona.lt_avatar_id = updates.lt_avatar_id;
  persona.updated_at = new Date().toISOString();
  save();
  return persona;
}

function deletePersona(id) {
  const idx = data.personas.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const persona = data.personas[idx];
  data.personas.splice(idx, 1);
  // Also delete associated calls and chat messages
  data.calls = data.calls.filter(c => c.persona_id !== id);
  data.messages = data.messages.filter(m => m.persona_id !== id);
  save();
  return persona;
}

// Call history queries
function insertCallHistory(call) {
  const record = {
    id: call.id,
    persona_id: call.persona_id,
    started_at: new Date().toISOString(),
    ended_at: null,
    transcript: call.transcript || [],
  };
  data.calls.push(record);
  save();
  return record;
}

function updateCallEnd(callId) {
  const call = data.calls.find(c => c.id === callId);
  if (call) {
    call.ended_at = new Date().toISOString();
    // Update transcript from session if passed
    save();
  }
}

function updateCallTranscript(callId, transcript) {
  const call = data.calls.find(c => c.id === callId);
  if (call) {
    call.transcript = transcript;
    save();
  }
}

function getCallHistory(personaId) {
  return data.calls
    .filter(c => c.persona_id === personaId)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

// Text chat message store
function appendMessage({ personaId, role, text }) {
  const record = {
    id: uuidv4(),
    persona_id: personaId,
    role, // 'user' | 'ai'
    text,
    created_at: new Date().toISOString(),
  };
  data.messages.push(record);
  save();
  return record;
}

function getMessages(personaId, limit = 100) {
  const lim = Math.max(1, Math.min(limit, 500));
  return data.messages
    .filter(m => m.persona_id === personaId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-lim);
}

function getLastMessage(personaId) {
  const msgs = data.messages.filter(m => m.persona_id === personaId);
  if (!msgs.length) return null;
  return msgs.reduce((a, b) => (new Date(a.created_at) >= new Date(b.created_at) ? a : b));
}

// App-level settings (payment QR, payment note) — configured by the app provider
function getSettings() {
  return { ...(data.settings || {}) };
}

function updateSettings(patch) {
  const allowed = ['payment_qr_url', 'payment_note'];
  allowed.forEach(k => { if (patch && patch[k] !== undefined) data.settings[k] = patch[k]; });
  save();
  return getSettings();
}

module.exports = {
  initDb,
  listPersonas,
  getPersona,
  insertPersona,
  updatePersona,
  deletePersona,
  insertCallHistory,
  updateCallEnd,
  updateCallTranscript,
  getCallHistory,
  appendMessage,
  getMessages,
  getLastMessage,
  getSettings,
  updateSettings,
};
