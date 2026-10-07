// IndexedDB wrapper for the on-device song/chart library.
// Database "riffgame" v1 with stores "songs" and "charts", both keyed by string id
// and indexed by updatedAt (ms). Everything is client-side; GitHub Pages is static.

const DB_NAME = "riffgame";
const DB_VERSION = 1;
const STORES = ["songs", "charts"];

let dbPromise = null;

function openDatabase() {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode) {
  const db = await openDatabase();
  return db.transaction(name, mode).objectStore(name);
}

export async function init() {
  await openDatabase();
}

export async function put(name, value) {
  const s = await store(name, "readwrite");
  return asPromise(s.put(value));
}

export async function get(name, id) {
  const s = await store(name, "readonly");
  return asPromise(s.get(id));
}

export async function getAll(name) {
  const s = await store(name, "readonly");
  return asPromise(s.getAll());
}

/** Returns only { id, title, updatedAt, meta } for each record. */
export async function listMetadata(name) {
  const all = await getAll(name);
  return all.map((record) => ({
    id: record.id,
    title: record.title,
    updatedAt: record.updatedAt,
    meta: record.meta,
  }));
}

// Named "remove" because `delete` is a reserved word; C# calls this via "remove".
export async function remove(name, id) {
  const s = await store(name, "readwrite");
  return asPromise(s.delete(id));
}

export async function clear(name) {
  const s = await store(name, "readwrite");
  return asPromise(s.clear());
}

// JSON-string helpers: read results cross the interop boundary as strings so the
// C# side controls (de)serialization with its own SongSerializer options.
export async function getJson(name, id) {
  const value = await get(name, id);
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export async function getAllJson(name) {
  return JSON.stringify(await getAll(name));
}

export async function listMetadataJson(name) {
  return JSON.stringify(await listMetadata(name));
}
