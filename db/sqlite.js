/**
 * SQLite Database — P2
 * Tables: persona, voice_clone, memory
 * Uses sql.js (WASM — no native deps)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'app.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing or create new
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // ── persona table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS persona (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_url TEXT,
      system_prompt TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── voice_clone table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS voice_clone (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      provider TEXT DEFAULT 'minimax',
      voice_id TEXT,
      sample_url TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (persona_id) REFERENCES persona(id)
    )
  `);

  // ── memory table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (persona_id) REFERENCES persona(id)
    )
  `);

  // ── durable facts table — LLM-curated long-term memory per persona ──
  db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      persona_id TEXT PRIMARY KEY,
      facts_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (persona_id) REFERENCES persona(id)
    )
  `);

  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

// ── Persona CRUD ──
async function upsertPersona(p) {
  const d = await getDb();
  const existing = d.exec('SELECT id FROM persona WHERE id = ?', [p.id]);
  if (existing.length && existing[0].values.length) {
    d.run('UPDATE persona SET name=?, photo_url=?, system_prompt=?, updated_at=datetime("now") WHERE id=?',
      [p.name, p.photo_url || null, p.system_prompt || null, p.id]);
  } else {
    d.run('INSERT INTO persona (id,name,photo_url,system_prompt) VALUES (?,?,?,?)',
      [p.id, p.name, p.photo_url || null, p.system_prompt || null]);
  }
  saveDb();
}

async function getPersona(id) {
  const d = await getDb();
  const r = d.exec('SELECT * FROM persona WHERE id = ?', [id]);
  if (!r.length || !r[0].values.length) return null;
  const cols = r[0].columns;
  const vals = r[0].values[0];
  const obj = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

// ── Voice Clone ──
async function upsertVoiceClone(vc) {
  const d = await getDb();
  const existing = d.exec('SELECT id FROM voice_clone WHERE persona_id = ?', [vc.persona_id]);
  if (existing.length && existing[0].values.length) {
    d.run('UPDATE voice_clone SET provider=?, voice_id=?, sample_url=?, status=? WHERE persona_id=?',
      [vc.provider || 'minimax', vc.voice_id || null, vc.sample_url || null, vc.status || 'pending', vc.persona_id]);
  } else {
    d.run('INSERT INTO voice_clone (id,persona_id,provider,voice_id,sample_url,status) VALUES (?,?,?,?,?,?)',
      [vc.id || require('uuid').v4(), vc.persona_id, vc.provider || 'minimax', vc.voice_id || null, vc.sample_url || null, vc.status || 'pending']);
  }
  saveDb();
}

async function getVoiceClone(personaId) {
  const d = await getDb();
  const r = d.exec('SELECT * FROM voice_clone WHERE persona_id = ?', [personaId]);
  if (!r.length || !r[0].values.length) return null;
  const cols = r[0].columns;
  const vals = r[0].values[0];
  const obj = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

// ── Memory ──
async function addMemory(personaId, type, content, importance = 0.5) {
  const d = await getDb();
  d.run('INSERT INTO memory (persona_id,type,content,importance) VALUES (?,?,?,?)',
    [personaId, type, content, importance]);
  saveDb();
}

async function getMemories(personaId, limit = 20) {
  const d = await getDb();
  const r = d.exec('SELECT * FROM memory WHERE persona_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?', [personaId, limit]);
  if (!r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  });
}

// ── Facts (durable LLM-curated memory) ──
async function getFacts(personaId) {
  const d = await getDb();
  const r = d.exec('SELECT facts_json FROM facts WHERE persona_id = ?', [personaId]);
  if (!r.length || !r[0].values.length) return null;
  return r[0].values[0][0];
}

async function saveFacts(personaId, factsJson) {
  const d = await getDb();
  d.run('INSERT OR REPLACE INTO facts (persona_id, facts_json, updated_at) VALUES (?,?,datetime("now"))',
    [personaId, factsJson]);
  saveDb();
}

module.exports = { getDb, saveDb, upsertPersona, getPersona, upsertVoiceClone, getVoiceClone, addMemory, getMemories, getFacts, saveFacts };
