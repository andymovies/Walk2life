// Almacenamiento local: todo vive en el móvil del caminante. Nada sale de aquí.
// IndexedDB con dos almacenes: "kv" (estado en JSON) y "blobs" (fotos y audios).

const NOMBRE = 'credencial';
let dbp;

function abrir() {
  if (!dbp) {
    dbp = new Promise((ok, ko) => {
      const r = indexedDB.open(NOMBRE, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('kv');
        r.result.createObjectStore('blobs');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  }
  return dbp;
}

async function tx(store, modo, fn) {
  const db = await abrir();
  return new Promise((ok, ko) => {
    const t = db.transaction(store, modo);
    const res = fn(t.objectStore(store));
    t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error);
  });
}

export const kv = {
  get: (k) => tx('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
};

export const blobs = {
  get: (k) => tx('blobs', 'readonly', (s) => s.get(k)),
  set: (k, v) => tx('blobs', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('blobs', 'readwrite', (s) => s.delete(k)),
  keys: () => tx('blobs', 'readonly', (s) => s.getAllKeys()),
  async guardar(blob, prefijo = 'b') {
    const id = `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await this.set(id, blob);
    return id;
  },
};

// Pide al navegador que no borre los datos por falta de espacio o por inactividad.
export async function pedirPersistencia() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

export async function espacio() {
  try {
    if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
  } catch {}
  return null;
}

// URLs temporales para mostrar blobs guardados sin duplicarlos en memoria.
const urls = new Map();
export async function urlBlob(id) {
  if (!id) return '';
  if (urls.has(id)) return urls.get(id);
  const b = await blobs.get(id);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urls.set(id, u);
  return u;
}
