/**
 * Local message store — IndexedDB
 *
 * Chat history lives in the app's local database (works in the browser and
 * inside the Capacitor WebView on the customer's phone — persists across
 * restarts, browsable offline). The server copy remains the backup + LLM
 * context seed; this local store is the primary browsing source.
 *
 * Record: { id, personaId, role: 'user'|'ai', text, createdAt }
 */

import { openDb } from './db';

const STORE = 'messages';
const PAGE = 100;

export async function saveMessage(msg) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(msg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMessages(msgs) {
  for (const m of msgs) await saveMessage(m);
}

export async function deleteMessage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get messages for a persona.
 * - limit: page size
 * - before: createdAt upper bound (exclusive) for paging into older history
 * Returns chronological order (oldest → newest).
 */
export async function getMessages(personaId, { limit = PAGE, before = null } = {}) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('persona_time');
    const range = before
      ? IDBKeyRange.bound([personaId, ''], [personaId, before], false, true)
      : IDBKeyRange.bound([personaId, ''], [personaId, '￿'], false, false);
    const req = idx.openCursor(range, 'prev'); // newest first
    const out = [];
    req.onsuccess = () => {
      const cur = req.result;
      if (cur && out.length < limit) {
        out.push(cur.value);
        cur.continue();
      } else {
        resolve(out.reverse());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLastMessage(personaId) {
  const all = await getMessages(personaId, { limit: 1 });
  return all[0] || null;
}

export async function deletePersonaMessages(personaId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index('persona_time');
    const req = idx.openCursor(IDBKeyRange.bound([personaId, ''], [personaId, '￿']));
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { cur.delete(); cur.continue(); }
      else resolve();
    };
    req.onerror = () => reject(req.error);
  });
}
