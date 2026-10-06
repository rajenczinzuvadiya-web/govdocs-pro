/* Project data model and pure operations. Every editable part of a product is a separate
   field (packaging, label, colour token, text, placement), so changing one never touches
   the others. Images live in the asset store; the project only holds their ids. */
import { clone, clamp, uid, safeHex, num, str } from './util.js';
import { setTheme, tokenHex } from './theme.js';

export const SCHEMA = 2;
export const TYPES = [['soap', 'Soap'], ['tea', 'Tea'], ['juice', 'Juice'], ['biscuit', 'Biscuit'], ['shampoo', 'Shampoo'], ['serum', 'Serum'], ['namkeen', 'Namkeen'], ['sharbat', 'Sharbat'], ['oil', 'Oil'], ['facewash', 'Facewash']];
export const DEFAULT_TOKEN = [0, 9, 4, 3, 2, 1, 7, 6, 8, 5];
export const KINDS = ['Plastic bottle', 'Glass bottle', 'Tube', 'Pouch', 'Paper pouch', 'Cardboard box', 'Paper box', 'Wrapper', 'Carton', 'Jar', 'Custom'];
export const TEXT_KEYS = ['name', 'subtitle', 'description', 'quantity', 'ingredients', 'mrp', 'barcode', 'legal', 'custom'];
const SPEC_KEYS = ['w', 'h', 'd', 'labelW', 'labelH', 'bleed', 'safe', 'notes', 'dielineName'];

/* Area of the A4 page where products may sit, as fractions of the page.
   Product placement is stored relative to this area, so a new letterpad keeps the layout. */
export const BUILTIN_AREA = { x: .04, y: .14, w: .92, h: .76 };
export const TEMPLATE_AREA = { x: .04, y: .19, w: .92, h: .58 };
export const A4_RATIO = Math.SQRT2;
export const PRINT_WIDTH = 2480; // A4 at 300 dpi

export function gridPos(i) {
  const col = i % 5, row = Math.floor(i / 5);
  return { x: .1 + col * .2, y: row ? .73 : .27, w: .15 };
}
export const emptyText = label => Object.fromEntries(TEXT_KEYS.map(k => [k, k === 'name' ? label : '']));
export function newProduct(i) {
  const [type, label] = TYPES[i];
  return { id: type, slot: i, type, typeLabel: label, packagingId: null, alternatives: [], labelId: 'lbl-classic', colorIndex: DEFAULT_TOKEN[i], adjust: { h: 0, s: 0, l: 0 }, text: emptyText(label), placement: gridPos(i), stage: 'mockup', history: [] };
}
export const newSpec = () => ({ w: '', h: '', d: '', labelW: '', labelH: '', bleed: '3', safe: '3', dielineId: null, dielineName: '', notes: '' });
export function placeholderPkg(id, name, builtin, labelArea) {
  return { id, name, kind: 'Plastic bottle', source: 'placeholder', builtin, assetId: null, labelArea, recolor: { enabled: true, source: '#2e8a96', tol: 28, neutral: .14 }, spec: newSpec(), history: [] };
}
export const BUILTIN_LABELS = [
  { id: 'lbl-classic', name: 'Classic panel', kind: 'template', layout: 'classic' },
  { id: 'lbl-band', name: 'Colour band', kind: 'template', layout: 'band' },
  { id: 'lbl-minimal', name: 'Minimal', kind: 'template', layout: 'minimal' },
];

export function defaultProject(name = 'Master packaging project') {
  const p = {
    schema: SCHEMA, id: uid('proj'), name,
    company: { name: 'Company name', tagline: 'Your tagline here', address: 'Address · Phone · Email', logoId: null },
    theme: null,
    packaging: [
      placeholderPkg('ph-bottle-a', 'Outline bottle A (flip cap)', 'bottleA', { x: .29, y: .41, w: .42, h: .4 }),
      placeholderPkg('ph-bottle-b', 'Outline bottle B (pump)', 'bottleB', { x: .25, y: .51, w: .5, h: .36 }),
    ],
    labels: clone(BUILTIN_LABELS),
    products: TYPES.map((_, i) => newProduct(i)),
    letterpadTemplates: [],
    letterpad: { templateId: null, headerToken: 7, watermark: true, showReference: true, hideEmpty: true },
    versions: [], updated: Date.now(),
  };
  setTheme(p, { h: 187, s: .53, l: .38, label: 'Starter teal' });
  const sh = p.products.find(x => x.type === 'shampoo');
  sh.alternatives = ['ph-bottle-a', 'ph-bottle-b'];
  sh.packagingId = 'ph-bottle-a';
  Object.assign(sh.text, { subtitle: 'Gentle daily care', description: 'Mild cleansing formula', quantity: '200 ml', ingredients: 'Aqua, mild surfactants, fruit extract' });
  return p;
}

/* ---------- lookups ---------- */
export const getPkg = (p, id) => p.packaging.find(k => k.id === id);
export const getLabel = (p, id) => p.labels.find(l => l.id === id);
export const getTemplate = (p, id = p.letterpad.templateId) => p.letterpadTemplates.find(t => t.id === id) || null;
export const activeArea = p => { const t = getTemplate(p); return t ? t.area : BUILTIN_AREA; };

/* ---------- product operations (each one records undo history) ---------- */
export const snap = o => { const c = clone(o); delete c.history; return c; };
const HISTORY_MAX = 30;
export function pushHistory(o, s = JSON.stringify(snap(o))) {
  o.history.push(s);
  if (o.history.length > HISTORY_MAX) o.history.shift();
}
export function switchPackaging(prod, id) {
  if (prod.packagingId === id) return;
  pushHistory(prod);
  if (!prod.alternatives.includes(id)) prod.alternatives.push(id);
  prod.packagingId = id;
}
export function removePackaging(prod) {
  pushHistory(prod);
  prod.alternatives = prod.alternatives.filter(i => i !== prod.packagingId);
  prod.packagingId = prod.alternatives[0] || null;
}
export function setLabel(prod, id) { if (prod.labelId === id) return; pushHistory(prod); prod.labelId = id; }
export function setToken(prod, i) { if (prod.colorIndex === i) return; pushHistory(prod); prod.colorIndex = i; }
export function setText(prod, k, v) { pushHistory(prod); prod.text[k] = v; }
/* Works for products and packaging models alike: both carry their own history. */
export function undo(o) {
  const s = o.history.pop();
  if (!s) return false;
  const h = o.history;
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, JSON.parse(s));
  o.history = h;
  return true;
}
export function restoreRevision(o, i) {
  const s = o.history[i];
  if (!s) return false;
  pushHistory(o);
  const h = o.history;
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, JSON.parse(s));
  o.history = h;
  return true;
}
export function resetProduct(prod) {
  pushHistory(prod);
  const fresh = newProduct(prod.slot), h = prod.history;
  Object.assign(prod, fresh);
  prod.history = h;
}
export function setLetterpadTemplate(p, id) { p.letterpad.templateId = id && getTemplate(p, id) ? id : null; }

/* Full project snapshot for a version (undo stacks are not kept). Assets are referenced by id. */
export function projectSnapshot(p) {
  const c = clone(p);
  delete c.versions;
  c.products.forEach(x => (x.history = []));
  c.packaging.forEach(x => (x.history = []));
  return JSON.stringify(c);
}

/* Every asset id a project (and its saved versions) still refers to. */
export function assetIds(p, out = new Set()) {
  const add = v => { if (typeof v === 'string' && v) out.add(v); };
  add(p.theme && p.theme.imageId);
  add(p.company && p.company.logoId);
  (p.packaging || []).forEach(k => { add(k.assetId); add(k.spec && k.spec.dielineId); });
  (p.labels || []).forEach(l => add(l.assetId));
  (p.letterpadTemplates || []).forEach(t => add(t.assetId));
  (p.versions || []).forEach(v => { try { assetIds(JSON.parse(v.data), out); } catch (e) { /* skip broken version */ } });
  return out;
}

/* ---------- normalisation: coerce any loaded/imported project into a safe, complete shape ---------- */
const area = (a, d) => {
  a = a && typeof a === 'object' ? a : d;
  const x = clamp(num(a.x, d.x)), y = clamp(num(a.y, d.y));
  return { x, y, w: clamp(num(a.w, d.w), .05, 1 - x), h: clamp(num(a.h, d.h), .05, 1 - y) };
};
const assetRef = v => (typeof v === 'string' && /^a-[\w-]{4,80}$/.test(v) ? v : null);
const id = (v, fb) => (typeof v === 'string' && /^[\w-]{1,80}$/.test(v) ? v : fb);

function normPkg(k) {
  const d = placeholderPkg(id(k.id, uid('pkg')), str(k.name, 'Packaging'), null, { x: .25, y: .38, w: .5, h: .36 });
  const builtin = ['bottleA', 'bottleB'].includes(k.builtin) ? k.builtin : null;
  const rc = k.recolor || {};
  const spec = Object.assign(newSpec(), Object.fromEntries(SPEC_KEYS.map(s => [s, str(k.spec && k.spec[s])])));
  spec.dielineId = assetRef(k.spec && k.spec.dielineId);
  if (!spec.bleed && !(k.spec && 'bleed' in k.spec)) spec.bleed = '3';
  return {
    ...d, builtin, assetId: assetRef(k.assetId), kind: KINDS.includes(k.kind) ? k.kind : 'Custom',
    source: k.source === 'placeholder' ? 'placeholder' : 'upload', labelArea: area(k.labelArea, d.labelArea),
    recolor: { enabled: rc.enabled !== false, source: safeHex(rc.source, '#2e8a96'), tol: clamp(num(rc.tol, 28), 5, 90), neutral: clamp(num(rc.neutral, .14), 0, .5) },
    spec, history: Array.isArray(k.history) ? k.history.filter(h => typeof h === 'string') : [],
  };
}
function normLabel(l) {
  if (l.kind === 'image') return { id: id(l.id, uid('lbl')), name: str(l.name, 'Artwork'), kind: 'image', assetId: assetRef(l.assetId), showName: !!l.showName, showFooter: !!l.showFooter };
  return { id: id(l.id, uid('lbl')), name: str(l.name, 'Label'), kind: 'template', layout: ['classic', 'band', 'minimal'].includes(l.layout) ? l.layout : 'classic' };
}
function normProduct(x, i, pkgIds, labelIds) {
  const d = newProduct(i);
  const alternatives = (Array.isArray(x.alternatives) ? x.alternatives : []).filter(a => pkgIds.has(a));
  const pid = pkgIds.has(x.packagingId) ? x.packagingId : alternatives[0] || null;
  if (pid && !alternatives.includes(pid)) alternatives.push(pid);
  const t = x.text || {};
  const pl = x.placement || {};
  return {
    ...d, packagingId: pid, alternatives, labelId: labelIds.has(x.labelId) ? x.labelId : 'lbl-classic',
    colorIndex: Math.round(clamp(num(x.colorIndex, d.colorIndex), 0, 9)),
    adjust: { h: clamp(num(x.adjust && x.adjust.h), -30, 30), s: clamp(num(x.adjust && x.adjust.s), -40, 40), l: clamp(num(x.adjust && x.adjust.l), -30, 30) },
    text: Object.fromEntries(TEXT_KEYS.map(k => [k, str(t[k], d.text[k])])),
    placement: { x: clamp(num(pl.x, d.placement.x)), y: clamp(num(pl.y, d.placement.y)), w: clamp(num(pl.w, d.placement.w), .03, .6) },
    stage: ['mockup', 'print', 'mfg'].includes(x.stage) ? x.stage : 'mockup',
    history: Array.isArray(x.history) ? x.history.filter(h => typeof h === 'string') : [],
  };
}

export function normalizeProject(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.products) || !d.theme) throw new Error('Not a project from this system');
  const p = defaultProject();
  p.id = id(d.id, p.id);
  p.name = str(d.name, p.name).slice(0, 120);
  const c = d.company || {};
  p.company = { name: str(c.name), tagline: str(c.tagline), address: str(c.address), logoId: assetRef(c.logoId) };
  const th = d.theme, b = th.base || {};
  p.theme = null;
  setTheme(p, { h: num(b.h, 187), s: clamp(num(b.s, .5)), l: clamp(num(b.l, .4)), imageId: assetRef(th.imageId), label: str(th.label) });
  (Array.isArray(th.palette) ? th.palette : []).slice(0, 10).forEach((t, i) => {
    const o = t && t.offset;
    if (o && typeof o === 'object') {
      p.theme.palette[i].offset = { h: num(o.h), s: num(o.s), l: num(o.l) };
      p.theme.palette[i].hex = tokenHex(p.theme.palette[i]);
    }
  });
  if (Array.isArray(d.packaging)) p.packaging = d.packaging.filter(k => k && typeof k === 'object').map(normPkg);
  const labels = (Array.isArray(d.labels) ? d.labels : []).filter(l => l && typeof l === 'object').map(normLabel);
  BUILTIN_LABELS.forEach(b => { if (!labels.some(l => l.id === b.id)) labels.unshift(clone(b)); });
  p.labels = labels;
  const pkgIds = new Set(p.packaging.map(k => k.id)), labelIds = new Set(p.labels.map(l => l.id));
  p.products = TYPES.map(([type], i) => normProduct(d.products.find(x => x && x.type === type) || {}, i, pkgIds, labelIds));
  p.letterpadTemplates = (Array.isArray(d.letterpadTemplates) ? d.letterpadTemplates : []).filter(t => t && assetRef(t.assetId)).map(t => ({
    id: id(t.id, uid('lpt')), name: str(t.name, 'Letterpad'), assetId: t.assetId, w: num(t.w), h: num(t.h), area: area(t.area, TEMPLATE_AREA),
  }));
  const lp = d.letterpad || {};
  p.letterpad = {
    templateId: p.letterpadTemplates.some(t => t.id === lp.templateId) ? lp.templateId : null,
    headerToken: Math.round(clamp(num(lp.headerToken, 7), 0, 9)),
    watermark: lp.watermark !== false, showReference: lp.showReference !== false, hideEmpty: lp.hideEmpty !== false,
  };
  p.versions = (Array.isArray(d.versions) ? d.versions : []).filter(v => v && typeof v.data === 'string').map(v => ({
    id: id(v.id, uid('v')), name: str(v.name, 'Version').slice(0, 80), date: num(v.date, Date.now()), final: !!v.final, data: v.data,
  }));
  p.updated = num(d.updated, Date.now());
  return p;
}
