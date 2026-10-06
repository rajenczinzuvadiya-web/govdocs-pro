/* Getting files in and out: uploads, downloads/share, project files (with their images
   bundled), and migration of Phase 1 (pkg.html, schema 1) project files. */
import { uid, slug } from './util.js';
import { SCHEMA, normalizeProject, assetIds, BUILTIN_AREA } from './model.js';
import { putAsset, getAsset, loadImg } from './store.js';

export const FORMAT = 'packaging-studio';

/* ---------- download / share ---------- */
export async function saveFile(filename, blob) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* fall through to download */ }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
export const canvasBlob = (c, type = 'image/png', q = .92) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode image'))), type, q));

/* ---------- uploads ---------- */
/* Decodes an uploaded image, optionally downsizes it, and stores it. Returns id + size. */
export async function storeImageFile(file, { max = 0, type = 'image/png' } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG or JPG)');
  const url = URL.createObjectURL(file);
  try {
    const i = await loadImg(url);
    let w = i.naturalWidth, h = i.naturalHeight, blob = file;
    if (max && Math.max(w, h) > max) {
      const k = max / Math.max(w, h), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      blob = await canvasBlob(c, type); w = c.width; h = c.height;
    }
    const id = await putAsset(blob, { name: file.name, w, h });
    return { id, w, h, img: i };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export async function storeRawFile(file) { return putAsset(file, { name: file.name }); }
export function hasTransparency(img) {
  const c = document.createElement('canvas'), n = 120, k = n / Math.max(img.naturalWidth, img.naturalHeight);
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/* ---------- project files ---------- */
const toDataURL = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
const fromDataURL = async u => (await fetch(u)).blob();
const isDataURL = v => typeof v === 'string' && /^data:[\w/+.-]+;base64,/.test(v);

/* One self-contained JSON file: the project plus every file it (or any version) refers to. */
export async function exportProjectFile(p) {
  const assets = {};
  for (const id of assetIds(p)) {
    const a = await getAsset(id);
    if (a) assets[id] = { type: a.type, name: a.name, w: a.w, h: a.h, data: await toDataURL(a.blob) };
  }
  return new Blob([JSON.stringify({ format: FORMAT, schema: SCHEMA, exported: new Date().toISOString(), project: p, assets })], { type: 'application/json' });
}
export const projectFileName = p => slug(p.name || 'project') + '.json';

export async function importProjectFile(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { throw new Error('That is not a project file'); }
  if (d && d.format === FORMAT && d.project) {
    const remap = {};
    for (const [id, a] of Object.entries(d.assets || {})) {
      if (!a || !isDataURL(a.data)) continue;
      remap[id] = await putAsset(await fromDataURL(a.data), { name: String(a.name || ''), w: +a.w || 0, h: +a.h || 0 });
    }
    return normalizeProject(remapIds(d.project, remap));
  }
  if (d && d.schema === 1 && Array.isArray(d.products)) return normalizeProject(await migrateV1(d));
  throw new Error('That is not a project file from this system');
}
/* Asset ids are content hashes, so they normally match; remap covers non-secure-context ids. */
function remapIds(p, map) {
  if (!Object.keys(map).some(k => map[k] !== k)) return p;
  const s = JSON.stringify(p);
  return JSON.parse(Object.entries(map).reduce((acc, [a, b]) => acc.split(JSON.stringify(a)).join(JSON.stringify(b)), s));
}

/* ---------- Phase 1 (pkg.html) migration: inline data URLs → asset store ---------- */
async function inline(v) {
  if (!isDataURL(v)) return null;
  const blob = await fromDataURL(v);
  let w = 0, h = 0;
  if (blob.type.startsWith('image/')) { try { const u = URL.createObjectURL(blob), i = await loadImg(u); w = i.naturalWidth; h = i.naturalHeight; URL.revokeObjectURL(u); } catch (e) { /* not decodable */ } }
  return putAsset(blob, { w, h });
}
export async function migrateV1(d) {
  d.theme = d.theme || {};
  d.theme.imageId = await inline(d.theme.image); delete d.theme.image;
  (d.theme.palette || []).forEach(t => { t.offset = null; });
  d.company = d.company || {};
  d.company.logoId = await inline(d.company.logo); delete d.company.logo;
  for (const k of d.packaging || []) {
    k.assetId = await inline(k.src); delete k.src;
    if (k.spec) { k.spec.dielineId = await inline(k.spec.dieline); delete k.spec.dieline; }
  }
  for (const l of d.labels || []) if (l.kind === 'image') { l.assetId = await inline(l.src); delete l.src; }
  /* Phase 1 placed products relative to the whole page; convert to the product area. */
  /* normalizeProject then turns these into page elements. */
  const A = BUILTIN_AREA;
  (d.products || []).forEach(x => {
    const pl = x.placement;
    if (pl) x.placement = { x: (pl.x - A.x) / A.w, y: (pl.y - A.y) / A.h, w: pl.w / A.w };
    x.history = [];
  });
  d.letterpadTemplates = [];
  d.letterpad = { ...(d.letterpad || {}), templateId: null, pages: [] };
  const versions = [];
  for (const v of d.versions || []) {
    try { versions.push({ ...v, data: JSON.stringify(normalizeProject(await migrateV1(JSON.parse(v.data)))) }); } catch (e) { /* drop unreadable version */ }
  }
  d.versions = versions;
  d.id = d.id || uid('proj');
  return d;
}
