/* Project data model and pure operations. Every editable part of a product is a separate
   field (packaging, label, colour token, text, placement), so changing one never touches
   the others. Images live in the asset store; the project only holds their ids. */
import { clone, clamp, uid, safeHex, num, str } from './util.js';
import { setTheme, tokenHex } from './theme.js';

export const SCHEMA = 3;
export const TYPES = [['soap', 'Soap'], ['tea', 'Tea'], ['juice', 'Juice'], ['biscuit', 'Biscuit'], ['shampoo', 'Shampoo'], ['serum', 'Serum'], ['namkeen', 'Namkeen'], ['sharbat', 'Sharbat'], ['oil', 'Oil'], ['facewash', 'Facewash']];
export const DEFAULT_TOKEN = [0, 9, 4, 3, 2, 1, 7, 6, 8, 5];
export const KINDS = ['Plastic bottle', 'Glass bottle', 'Tube', 'Pouch', 'Paper pouch', 'Cardboard box', 'Paper box', 'Wrapper', 'Carton', 'Jar', 'Custom'];
export const TEXT_KEYS = ['name', 'subtitle', 'description', 'quantity', 'ingredients', 'mrp', 'barcode', 'legal', 'custom'];
const SPEC_KEYS = ['w', 'h', 'd', 'labelW', 'labelH', 'bleed', 'safe', 'notes', 'dielineName'];

/* Guide area of the A4 page (fractions of the page): the part of a letterpad that is free of
   header and footer. Elements may go anywhere; the area is only a guide and the default grid. */
export const BUILTIN_AREA = { x: .04, y: .14, w: .92, h: .76 };
export const TEMPLATE_AREA = { x: .04, y: .19, w: .92, h: .58 };
export const A4_RATIO = Math.SQRT2;
export const PRINT_WIDTH = 2480; // A4 at 300 dpi


/* ---------- letterpad elements (a page works like a blank Word page) ----------
   Positions are fractions of the A4 page: x, y = top-left, w = width. Product and image
   heights follow their picture's aspect ratio; text height follows its content. */
export const FONTS = {
  sans: { label: 'Sans', css: '"Schibsted Grotesk", "Noto Sans Gujarati", system-ui, sans-serif' },
  serif: { label: 'Serif (headings)', css: '"DM Serif Display", "Noto Serif Gujarati", Georgia, serif' },
  guj: { label: 'Gujarati', css: '"Hind Vadodara", "Noto Sans Gujarati", system-ui, sans-serif' },
};
export const PT_PER_PAGE = 595; // A4 width in points: font sizes are stored in pt
export const productElement = (productId, x, y, w) => ({ id: uid('el'), type: 'product', productId, x, y, w, showName: true, showDesc: true, nameSize: 10, descSize: 7 });
export const textElement = (o = {}) => ({ id: uid('el'), type: 'text', x: .1, y: .3, w: .5, text: 'Type here', font: 'sans', size: 12, bold: false, italic: false, color: '#1f2328', align: 'left', lh: 1.3, ...o });
export const imageElement = (assetId, x, y, w) => ({ id: uid('el'), type: 'image', assetId, x, y, w });
export const newPage = (elements = []) => ({ id: uid('pg'), elements });

/* All given products in a tidy grid inside area A (default product aspect assumed 2:1). */
export function gridLayout(products, A) {
  const n = products.length;
  if (!n) return [];
  const cols = Math.min(5, n), rows = Math.ceil(n / cols), cw = A.w / cols, ch = A.h / rows;
  const w = Math.min(cw * .72, ch * .74 * A4_RATIO / 2);
  return products.map((x, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    return productElement(x.id, A.x + col * cw + (cw - w) / 2, A.y + row * ch + ch * .04, w);
  });
}
/* Phase 1/2 stored a product position relative to the product area; convert to page space. */
function placementToElement(x, A) {
  const pl = x.placement || {};
  const w = clamp(num(pl.w, .15), .03, .6) * A.w, cx = A.x + num(pl.x, .5) * A.w, cy = A.y + num(pl.y, .5) * A.h;
  return productElement(x.id, cx - w / 2, cy - w * 2 / A4_RATIO / 2, w);
}
export const emptyText = label => Object.fromEntries(TEXT_KEYS.map(k => [k, k === 'name' ? label : '']));
export function newProduct(i) {
  const [type, label] = TYPES[i];
  return { id: type, slot: i, type, typeLabel: label, custom: false, packagingId: null, alternatives: [], labelId: 'lbl-classic', colorIndex: DEFAULT_TOKEN[i], adjust: { h: 0, s: 0, l: 0 }, text: emptyText(label), stage: 'mockup', history: [] };
}
/* Products beyond the 10 standard types. */
export function newCustomProduct(label, slot) {
  return { ...newProduct(0), id: uid('prd'), slot, type: 'custom', typeLabel: label, custom: true, colorIndex: slot % 10, text: emptyText(label) };
}
export const newSpec = () => ({ w: '', h: '', d: '', labelW: '', labelH: '', bleed: '3', safe: '3', dielineId: null, dielineName: '', notes: '' });
export function placeholderPkg(id, name, builtin, labelArea) {
  return { id, name, kind: 'Plastic bottle', source: 'placeholder', builtin, assetId: null, labelArea, recolor: { enabled: true, source: '#2e8a96', tol: 28, neutral: .14 }, spec: newSpec(), history: [] };
}
export const BUILTIN_LABELS = [
  { id: 'lbl-classic', name: 'Classic panel', kind: 'template', layout: 'classic' },
  { id: 'lbl-band', name: 'Colour band', kind: 'template', layout: 'band' },
  { id: 'lbl-minimal', name: 'Minimal', kind: 'template', layout: 'minimal' },
  /* For finished product photos whose label is already printed: only the colour follows the theme. */
  { id: 'lbl-none', name: 'No label (photo as is)', kind: 'template', layout: 'none' },
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
    letterpad: { templateId: null, headerToken: 7, watermark: true, showReference: true, hideEmpty: true, pages: [] },
    versions: [], updated: Date.now(),
  };
  setTheme(p, { h: 187, s: .53, l: .38, label: 'Starter teal' });
  const sh = p.products.find(x => x.type === 'shampoo');
  sh.alternatives = ['ph-bottle-a', 'ph-bottle-b'];
  sh.packagingId = 'ph-bottle-a';
  Object.assign(sh.text, { subtitle: 'Gentle daily care', description: 'Mild cleansing formula', quantity: '200 ml', ingredients: 'Aqua, mild surfactants, fruit extract' });
  p.letterpad.pages = [newPage(gridLayout(p.products, BUILTIN_AREA))];
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
  const fresh = prod.custom ? { ...newCustomProduct(prod.typeLabel, prod.slot), id: prod.id } : newProduct(prod.slot), h = prod.history;
  Object.assign(prod, fresh);
  prod.history = h;
}
export function addCustomProduct(p, label) {
  const x = newCustomProduct(label, p.products.length);
  p.products.push(x);
  return x;
}
/* Only added products can be deleted; the 10 standard types always stay. Their letterpad elements go too. */
export function deleteCustomProduct(p, id) {
  const x = p.products.find(q => q.id === id);
  if (!x || !x.custom) return false;
  p.products = p.products.filter(q => q.id !== id);
  p.letterpad.pages.forEach(pg => (pg.elements = pg.elements.filter(e => !(e.type === 'product' && e.productId === id))));
  return true;
}

/* ---------- element operations (array order = stacking order, last is on top) ---------- */
export const findEl = (page, id) => page.elements.find(e => e.id === id) || null;
export function addEl(page, el) { page.elements.push(el); return el; }
export function removeEl(page, id) { page.elements = page.elements.filter(e => e.id !== id); }
export function duplicateEl(page, id) {
  const e = findEl(page, id);
  if (!e) return null;
  const c = { ...clone(e), id: uid('el'), x: e.x + .02, y: e.y + .02 };
  page.elements.splice(page.elements.indexOf(e) + 1, 0, c);
  return c;
}
export function restack(page, id, where) {
  const i = page.elements.findIndex(e => e.id === id);
  if (i < 0) return;
  const [e] = page.elements.splice(i, 1);
  const j = where === 'front' ? page.elements.length : where === 'back' ? 0 : where === 'up' ? Math.min(i + 1, page.elements.length) : Math.max(i - 1, 0);
  page.elements.splice(j, 0, e);
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
  ((p.letterpad && p.letterpad.pages) || []).forEach(pg => (pg.elements || []).forEach(e => e.type === 'image' && add(e.assetId)));
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
  return { id: id(l.id, uid('lbl')), name: str(l.name, 'Label'), kind: 'template', layout: ['classic', 'band', 'minimal', 'none'].includes(l.layout) ? l.layout : 'classic' };
}
function normProduct(x, i, pkgIds, labelIds) {
  const d = x.custom ? newCustomProduct(str(x.typeLabel, 'Product').slice(0, 40), i) : newProduct(i);
  if (x.custom) d.id = id(x.id, d.id);
  const alternatives = (Array.isArray(x.alternatives) ? x.alternatives : []).filter(a => pkgIds.has(a));
  const pid = pkgIds.has(x.packagingId) ? x.packagingId : alternatives[0] || null;
  if (pid && !alternatives.includes(pid)) alternatives.push(pid);
  const t = x.text || {};
  return {
    ...d, packagingId: pid, alternatives, labelId: labelIds.has(x.labelId) ? x.labelId : 'lbl-classic',
    colorIndex: Math.round(clamp(num(x.colorIndex, d.colorIndex), 0, 9)),
    adjust: { h: clamp(num(x.adjust && x.adjust.h), -30, 30), s: clamp(num(x.adjust && x.adjust.s), -40, 40), l: clamp(num(x.adjust && x.adjust.l), -30, 30) },
    text: Object.fromEntries(TEXT_KEYS.map(k => [k, str(t[k], d.text[k])])),
    stage: ['mockup', 'print', 'mfg'].includes(x.stage) ? x.stage : 'mockup',
    history: Array.isArray(x.history) ? x.history.filter(h => typeof h === 'string') : [],
  };
}

const FONT_KEYS = Object.keys(FONTS);
function normEl(e, prodIds) {
  if (!e || typeof e !== 'object') return null;
  const base = { id: id(e.id, uid('el')), x: clamp(num(e.x, .1), -.5, 1.5), y: clamp(num(e.y, .1), -.5, 1.5), w: clamp(num(e.w, .2), .01, 2) };
  if (e.type === 'product') {
    if (!prodIds.has(e.productId)) return null;
    return { ...base, type: 'product', productId: e.productId, showName: e.showName !== false, showDesc: e.showDesc !== false, nameSize: clamp(num(e.nameSize, 10), 4, 60), descSize: clamp(num(e.descSize, 7), 4, 60) };
  }
  if (e.type === 'image') { const a = assetRef(e.assetId); return a ? { ...base, type: 'image', assetId: a } : null; }
  if (e.type === 'text') {
    return { ...base, type: 'text', text: str(e.text).slice(0, 20000), font: FONT_KEYS.includes(e.font) ? e.font : 'sans', size: clamp(num(e.size, 12), 4, 200), bold: !!e.bold, italic: !!e.italic, color: safeHex(e.color, '#1f2328'), align: ['left', 'center', 'right'].includes(e.align) ? e.align : 'left', lh: clamp(num(e.lh, 1.3), .8, 3) };
  }
  return null;
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
  BUILTIN_LABELS.forEach((b, i) => { if (!labels.some(l => l.id === b.id)) labels.splice(i, 0, clone(b)); });
  p.labels = labels;
  const pkgIds = new Set(p.packaging.map(k => k.id)), labelIds = new Set(p.labels.map(l => l.id));
  const std = TYPES.map(([type], i) => normProduct(d.products.find(x => x && x.type === type && !x.custom) || {}, i, pkgIds, labelIds));
  const custom = d.products.filter(x => x && x.custom).slice(0, 200).map((x, i) => normProduct(x, TYPES.length + i, pkgIds, labelIds));
  p.products = [...std, ...custom];
  p.letterpadTemplates = (Array.isArray(d.letterpadTemplates) ? d.letterpadTemplates : []).filter(t => t && assetRef(t.assetId)).map(t => ({
    id: id(t.id, uid('lpt')), name: str(t.name, 'Letterpad'), assetId: t.assetId, w: num(t.w), h: num(t.h), area: area(t.area, TEMPLATE_AREA),
  }));
  const lp = d.letterpad || {};
  p.letterpad = {
    templateId: p.letterpadTemplates.some(t => t.id === lp.templateId) ? lp.templateId : null,
    headerToken: Math.round(clamp(num(lp.headerToken, 7), 0, 9)),
    watermark: lp.watermark !== false, showReference: lp.showReference !== false, hideEmpty: lp.hideEmpty !== false,
    pages: [],
  };
  const prodIds = new Set(p.products.map(x => x.id));
  if (Array.isArray(lp.pages) && lp.pages.length) {
    p.letterpad.pages = lp.pages.slice(0, 50).filter(pg => pg && typeof pg === 'object').map(pg => ({
      id: id(pg.id, uid('pg')),
      elements: (Array.isArray(pg.elements) ? pg.elements : []).slice(0, 500).map(e => normEl(e, prodIds)).filter(Boolean),
    }));
  }
  if (!p.letterpad.pages.length) {
    /* Older projects: one page from each product's area-relative placement. */
    const A = activeArea(p);
    p.letterpad.pages = [newPage(d.products.filter(x => x && prodIds.has(x.type === 'custom' || x.custom ? x.id : x.type))
      .map(x => placementToElement({ ...x, id: x.custom ? x.id : x.type }, A)))];
  }
  p.versions = (Array.isArray(d.versions) ? d.versions : []).filter(v => v && typeof v.data === 'string').map(v => ({
    id: id(v.id, uid('v')), name: str(v.name, 'Version').slice(0, 80), date: num(v.date, Date.now()), final: !!v.final, data: v.data,
  }));
  p.updated = num(d.updated, Date.now());
  return p;
}
