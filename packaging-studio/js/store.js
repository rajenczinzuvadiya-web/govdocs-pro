/* Storage on this device (IndexedDB).
   kv:     projects index, each project's JSON, the current project id
   assets: image / dieline / letterpad blobs, stored once and referenced by id from any project or version */
import { uid } from './util.js';

const DB_NAME = 'packaging-studio', DB_VER = 1;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    let out;
    const q = fn(s);
    if (q) q.onsuccess = () => { out = q.result; };
    t.oncomplete = () => res(out ?? null);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Storage aborted'));
  });
}
export const kvGet = k => tx('kv', 'readonly', s => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));
export const kvDel = k => tx('kv', 'readwrite', s => s.delete(k));

/* ---------- projects ---------- */
export async function listProjects() { return (await kvGet('projects')) || []; }
export async function saveProject(p) {
  await kvSet('project:' + p.id, JSON.stringify(p));
  const list = (await listProjects()).filter(x => x.id !== p.id);
  list.unshift({ id: p.id, name: p.name, updated: p.updated });
  await kvSet('projects', list);
  await kvSet('current', p.id);
}
export async function loadProject(id) { const s = await kvGet('project:' + id); return s ? JSON.parse(s) : null; }
export async function deleteProject(id) {
  await kvDel('project:' + id);
  await kvSet('projects', (await listProjects()).filter(x => x.id !== id));
}

/* ---------- assets ---------- */
async function hashId(blob) {
  try {
    const buf = await blob.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    return 'a-' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return uid('a'); // no SubtleCrypto (non-secure context): still unique, just not de-duplicated
  }
}
/* Stores a blob and returns its id. Identical files share one id, so versions never duplicate images. */
export async function putAsset(blob, meta = {}) {
  const id = meta.id || await hashId(blob);
  const existing = await tx('assets', 'readonly', s => s.getKey(id));
  if (!existing) await tx('assets', 'readwrite', s => s.put({ id, blob, type: blob.type, name: meta.name || '', w: meta.w || 0, h: meta.h || 0, added: Date.now() }));
  return id;
}
export const getAsset = id => (id ? tx('assets', 'readonly', s => s.get(id)) : Promise.resolve(null));
export const allAssetIds = () => tx('assets', 'readonly', s => s.getAllKeys());
export const deleteAsset = id => tx('assets', 'readwrite', s => s.delete(id));

const urlCache = new Map(), imgCache = new Map();
export function assetURL(id) {
  if (!urlCache.has(id)) urlCache.set(id, getAsset(id).then(a => {
    if (!a) { urlCache.delete(id); throw new Error('Missing file ' + id); }
    return URL.createObjectURL(a.blob);
  }));
  return urlCache.get(id);
}
export function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Image failed to load'));
    i.src = src;
  });
}
export function assetImage(id) {
  if (!id) return Promise.reject(new Error('No image'));
  if (!imgCache.has(id)) imgCache.set(id, assetURL(id).then(loadImg).catch(e => { imgCache.delete(id); throw e; }));
  return imgCache.get(id);
}
/* Synchronous access to an image that is already loaded (for live redraws). */
const ready = new Map();
export async function primeImage(id) {
  if (!id || ready.has(id)) return ready.get(id) || null;
  try { const i = await assetImage(id); ready.set(id, i); return i; } catch (e) { return null; }
}
export const readyImage = id => (id ? ready.get(id) || null : null);

/* Remove stored files no project or version refers to any more. */
export async function collectGarbage(keep) {
  let n = 0;
  for (const id of await allAssetIds()) if (!keep.has(id)) { await deleteAsset(id); n++; }
  return n;
}
