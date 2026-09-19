/**
 * Shared IndexedDB opener — one local database for everything this device keeps.
 *
 * Stores:
 * - messages: chat history (local-first browsing, server copy is the backup)
 * - facts:    the customer's memories extracted from chats/calls — lives ONLY
 *             on this device (privacy), rides along with each message so the
 *             digital human remembers, and is replaced by the LLM-merged list.
 */

const DB_NAME = 'timeback-chat';
const DB_VERSION = 2;

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('persona_time', ['personaId', 'createdAt'], { unique: false });
      }
      if (!db.objectStoreNames.contains('facts')) {
        const store = db.createObjectStore('facts', { keyPath: 'id' });
        store.createIndex('persona_time', ['personaId', 'createdAt'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
