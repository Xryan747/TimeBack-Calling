/**
 * Local fact store — the memories extracted from what the customer tells the
 * digital human (reminiscences, favorite foods, age, recent events...).
 *
 * These facts live ONLY on this device (IndexedDB) — the customer's private
 * memories never accumulate on the server. They ride along with each chat
 * message / call start so the mom can remember them, and after each turn the
 * server returns the LLM-merged list, which replaces the local one.
 *
 * Record: { id, personaId, content, createdAt }
 */

import { openDb } from './db';

const STORE = 'facts';

export async function getFacts(personaId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('persona_time');
    const req = idx.getAll(IDBKeyRange.bound([personaId, ''], [personaId, '￿']));
    req.onsuccess = () => resolve((req.result || []).map(r => r.content));
    req.onerror = () => reject(req.error);
  });
}

/** Replace the whole fact list for a persona (server returns the merged list after each turn). */
export async function replaceFacts(personaId, facts) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    const idx = os.index('persona_time');
    const delReq = idx.openCursor(IDBKeyRange.bound([personaId, ''], [personaId, '￿']));
    delReq.onsuccess = () => {
      const cur = delReq.result;
      if (cur) { cur.delete(); cur.continue(); return; }
      // Old list gone — write the new one in one go
      const list = (facts || []).slice(0, 15).map(f => String(f).trim()).filter(Boolean);
      list.forEach((f, i) => os.put({
        id: `${personaId}-${i}`, personaId, content: f, createdAt: new Date().toISOString(),
      }));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deletePersonaFacts(personaId) {
  return replaceFacts(personaId, []);
}
