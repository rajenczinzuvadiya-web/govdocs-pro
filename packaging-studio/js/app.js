/* UI layer. Reads and writes the project through model/theme operations only; rendering goes
   through render.js and letterpad.js. No product design is hard-coded here. */
import { $, esc, clone, clamp, uid, safeHex, fileBase, slug } from './util.js';
import { hexToHsl, hslToHex, rgbToHex, rgbToHsl, onColor } from './color.js';
import { setTheme, editToken, resetToken, resolveColor, extractBase } from './theme.js';
import * as M from './model.js';
import * as store from './store.js';
import { renderProduct, baseCanvas } from './render.js';
import { createEditor } from './editor.js';
import { saveFile, canvasBlob, storeImageFile, storeRawFile, hasTransparency, exportProjectFile, importProjectFile, projectFileName } from './files.js';
import { runChecks } from './checks.js';

const S = { project: null, projects: [], tab: 'product', sel: 'shampoo', original: false, pick: false, checks: null, installEvt: null };
const V = $('#view');
const curProd = () => S.project.products.find(p => p.id === S.sel);
const curPkg = () => M.getPkg(S.project, curProd().packagingId);
const curTemplate = () => M.getTemplate(S.project);

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }

/* ---------- autosave ---------- */
let saveTimer = null;
function save() {
  S.project.updated = Date.now();
  $('#saveState').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await store.saveProject(S.project); S.projects = await store.listProjects(); $('#saveState').textContent = 'Saved on this device'; }
    catch (e) { $('#saveState').textContent = 'Not saved: storage blocked'; }
  }, 400);
}
async function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await store.saveProject(S.project); } }

/* ---------- edit sessions: a slider drag becomes one undo step ---------- */
let editSnap = null;
function beginEdit(o) { if (o && (!editSnap || editSnap.o !== o)) { commitEdit(false); editSnap = { o, s: JSON.stringify(M.snap(o)) }; } }
function commitEdit(doSave = true) {
  if (editSnap) { const { o, s } = editSnap; if (s !== JSON.stringify(M.snap(o))) M.pushHistory(o, s); editSnap = null; }
  if (doSave) save();
}

async function primeAll() {
  const p = S.project, t = curTemplate();
  await Promise.all([p.theme.imageId, p.company.logoId, t && t.assetId].map(store.primeImage));
}
function applyAccent() {
  const c = S.project.theme.palette[2].hex;
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--on-accent', onColor(c));
  $('#brandSwatch').style.background = c;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c;
}
function render() {
  applyAccent();
  $('#projName').value = S.project.name;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
  ({ theme: renderTheme, product: renderProductTab, letterpad: () => editor.render(), project: renderProject, checks: renderChecks })[S.tab]();
}
function rng(label, key, val, min, max, step, fmt) {
  return `<div class="range"><span>${esc(label)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${+val}" data-rg="${key}" aria-label="${esc(label)}"><output>${esc(fmt(+val))}</output></div>`;
}
const pct = v => Math.round(v * 100) + '%';
const FMT = { la: pct, ar: pct, 'rc.tol': v => Math.round(v) + '°', 'rc.neutral': pct, 'adj.h': v => Math.round(v) + '°', 'adj.s': v => Math.round(v), 'adj.l': v => Math.round(v), 'lp.w': pct };
const fmtFor = k => FMT[k] || FMT[k.split('.')[0]] || (v => v);
const dot = (c, extra = '') => `<span class="dot" style="background:${safeHex(c)}${extra}"></span>`;
const editor = createEditor({ S, V, save, toast, curTemplate, rng, pct, render: () => render() });

/* ================= Theme tab ================= */
const SAMPLES = [['Pink apple', '#d9467a'], ['Orange', '#f0862a'], ['Mango', '#f3b31c'], ['Strawberry', '#d42a3c'], ['Green leaf', '#4f9a3a']];
async function renderTheme() {
  const p = S.project, t = p.theme;
  const usedBy = i => p.products.filter(x => x.colorIndex === i).map(x => x.typeLabel).join(', ') || 'Not used';
  const refUrl = t.imageId ? await store.assetURL(t.imageId).catch(() => null) : null;
  V.innerHTML = `<section class="card"><h2>Main reference image</h2><p class="muted small">Upload the image the company gave you. Its colour family becomes 10 coordinated tokens, and every product follows its token automatically.</p>
  <div class="ref">${refUrl ? `<img src="${esc(refUrl)}" alt="Reference image">` : '<div class="ph">No image yet</div>'}<div><div class="theme-name">${esc(t.label)}</div><div class="muted small">Base hue ${Math.round(t.base.h)}° · saturation ${Math.round(t.base.s * 100)}% · lightness ${Math.round(t.base.l * 100)}%</div>
  <div class="row" style="margin-top:10px"><label class="btn primary">Upload reference image<input type="file" accept="image/*" data-up="ref" class="hidden-input"></label>${t.imageId ? '<button class="btn" data-act="regen">Re-analyse</button>' : ''}</div></div></div>
  <h3>No image yet? Try a starting colour</h3><div class="chips">${SAMPLES.map(([n, h]) => `<button class="chip" data-act="sample" data-hex="${h}">${dot(h)}${esc(n)}</button>`).join('')}</div></section>
  <section class="card"><h2>Colour tokens</h2><p class="muted small">Products point to a token, never to a fixed colour. Tap a token to fine-tune it. Your edit is kept as a shift, so it still applies when the reference image changes.</p>
  <div class="palette">${t.palette.map((k, i) => `<div class="tok"><label class="tok-in"><input type="color" value="${safeHex(k.hex)}" data-tok="${i}" aria-label="Edit ${esc(k.name)}"><span class="sw" style="background:${safeHex(k.hex)}"></span><b>${esc(k.name)}${k.offset ? ' · edited' : ''}</b><span>${safeHex(k.hex)}</span><span>${esc(usedBy(i))}</span></label>${k.offset ? `<button class="btn ghost small-btn" data-act="tokReset" data-i="${i}">Reset</button>` : ''}</div>`).join('')}</div></section>`;
}

/* ================= Product tab ================= */
function renderProductTab() {
  const p = S.project, prod = curProd(), pkg = curPkg(), color = resolveColor(p, prod), lab = M.getLabel(p, prod.labelId);
  const prodChips = p.products.map(x => `<button class="chip" data-act="selProd" data-id="${esc(x.id)}" aria-pressed="${x.id === S.sel}">${dot(resolveColor(p, x), x.packagingId ? '' : ';opacity:.35')}${esc(x.typeLabel)}</button>`).join('');
  const preview = pkg ? `<div class="pv${S.pick ? ' picking' : ''}"><canvas id="pv" aria-label="Product preview"></canvas><div class="badges"><span class="badge">Mockup preview</span>${pkg.source === 'placeholder' ? '<span class="badge warn">Placeholder outline</span>' : ''}</div></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="baBtn">${S.original ? 'Showing original' : 'Hold to compare original'}</button><button class="btn" data-act="undo" ${prod.history.length ? '' : 'disabled'}>Undo${prod.history.length ? ' (' + prod.history.length + ')' : ''}</button></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="dlPng">Save PNG</button><button class="btn ghost" data-act="dlBare">PNG without label</button></div>
    ${S.pick ? '<p class="note">Tap the part of the packaging whose colour should change.</p>' : ''}
    ${pkg.source === 'placeholder' ? '<p class="note">This is a neutral outline for testing the system. Replace it with the real packaging image from the company or manufacturer.</p>' : ''}`
    : `<div class="empty-state"><p><b>No packaging for ${esc(prod.typeLabel)} yet</b></p><p class="muted small">Upload the real packaging photo, ideally a transparent PNG shot straight on.</p><label class="btn primary">Upload packaging image<input type="file" accept="image/*" class="hidden-input" data-up="pkg"></label></div>`;

  const libOpts = p.packaging.filter(k => !prod.alternatives.includes(k.id));
  const pkgSec = `<h2>Packaging model</h2><p class="muted small">Switching changes only the packaging. Text, colour, label and letterpad position stay as they are.</p>
    <div class="chips">${prod.alternatives.map(id => { const k = M.getPkg(p, id); return k ? `<button class="chip" data-act="pkg" data-id="${esc(k.id)}" aria-pressed="${k.id === prod.packagingId}">${esc(k.name)}</button>` : ''; }).join('') || '<span class="muted small">None yet</span>'}</div>
    <div class="row" style="margin-top:8px"><label class="btn">Upload packaging<input type="file" accept="image/*" class="hidden-input" data-up="pkg"></label>
    ${libOpts.length ? `<select id="libAdd" style="width:auto;flex:1;min-width:160px"><option value="">Add from library…</option>${libOpts.map(k => `<option value="${esc(k.id)}">${esc(k.name)}</option>`).join('')}</select>` : ''}
    ${pkg ? `<button class="btn ghost danger" data-act="rmPkg">Remove from ${esc(prod.typeLabel)}</button>` : ''}</div>
    ${pkg ? `<details${S.openPkg ? ' open' : ''} id="pkgDetails"><summary>Packaging model settings</summary><p class="muted small">These belong to the model and apply to every product that uses it.</p>
      <div class="grid2"><div class="field"><label for="pkName">Name</label><input id="pkName" type="text" data-pk="name" value="${esc(pkg.name)}"></div><div class="field"><label for="pkKind">Material / type</label><select id="pkKind" data-pk="kind">${M.KINDS.map(k => `<option${k === pkg.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></div></div>
      <h3>Label area</h3>${['x', 'y', 'w', 'h'].map(k => rng('Label ' + { x: 'left', y: 'top', w: 'width', h: 'height' }[k], 'la.' + k, pkg.labelArea[k], 0, 1, .005, pct)).join('')}
      <h3>Recolour</h3><label class="check"><input type="checkbox" data-pk="rc.enabled" ${pkg.recolor.enabled ? 'checked' : ''}> Recolour this packaging to the theme</label>
      <div class="row" style="margin:6px 0 10px">${dot(pkg.recolor.source, ';width:28px;height:28px')}<span class="small">Colour to replace ${safeHex(pkg.recolor.source)}</span><button class="btn" data-act="pick">${S.pick ? 'Cancel picking' : 'Pick from preview'}</button></div>
      ${rng('Tolerance', 'rc.tol', pkg.recolor.tol, 5, 90, 1, FMT['rc.tol'])}${rng('Protect greys', 'rc.neutral', pkg.recolor.neutral, 0, .5, .01, pct)}
      <p class="muted small">Whites, blacks, greys and metallic parts below the grey threshold are never touched. Highlights, shadows and transparency are kept.</p>
      <button class="btn" data-act="pkgUndo" ${pkg.history.length ? '' : 'disabled'}>Undo model setting${pkg.history.length ? ' (' + pkg.history.length + ')' : ''}</button></details>` : ''}`;

  const colSec = `<h2>Colour</h2><p class="muted small">Token from the theme. When the reference changes, this product updates by itself.</p>
    <div class="toks">${p.theme.palette.map((k, i) => `<button class="tk" data-act="tok" data-i="${i}" aria-pressed="${i === prod.colorIndex}" title="${esc(k.name)}" aria-label="${esc(k.name)}" style="background:${safeHex(k.hex)}"></button>`).join('')}</div>
    <div class="row small" style="margin:8px 0">${dot(color)}${esc(p.theme.palette[prod.colorIndex].name)} → ${safeHex(color)}</div>
    ${rng('Hue shift', 'adj.h', prod.adjust.h, -30, 30, 1, FMT['adj.h'])}${rng('Saturation', 'adj.s', prod.adjust.s, -40, 40, 1, FMT['adj.s'])}${rng('Lightness', 'adj.l', prod.adjust.l, -30, 30, 1, FMT['adj.l'])}
    <button class="btn ghost" data-act="resetAdj">Reset manual adjustment</button>`;

  const labSec = `<h2>Label / artwork</h2><p class="muted small">Separate from the packaging. The same label moves onto any packaging model.</p>
    <div class="chips">${p.labels.map(l => `<button class="chip" data-act="lab" data-id="${esc(l.id)}" aria-pressed="${l.id === prod.labelId}">${esc(l.name)}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><label class="btn">Upload label artwork<input type="file" accept="image/*" class="hidden-input" data-up="lab"></label></div>
    ${lab && lab.kind === 'image' ? `<h3>Text on this artwork</h3><label class="check"><input type="checkbox" data-lb="showName" ${lab.showName ? 'checked' : ''}> Show product name and subtitle</label><label class="check"><input type="checkbox" data-lb="showFooter" ${lab.showFooter ? 'checked' : ''}> Show quantity, MRP and barcode area</label>` : ''}`;

  const tf = (k, label, area) => `<div class="field"><label for="tx-${k}">${label}</label>${area ? `<textarea id="tx-${k}" data-tx="${k}">${esc(prod.text[k])}</textarea>` : `<input id="tx-${k}" type="text" data-tx="${k}" value="${esc(prod.text[k])}">`}</div>`;
  const txtSec = `<h2>Product text</h2>${tf('name', 'Product name')}${tf('subtitle', 'Subtitle')}<div class="grid2">${tf('quantity', 'Quantity')}${tf('mrp', 'MRP')}</div>${tf('description', 'Letterpad description')}${tf('ingredients', 'Ingredients / info', 1)}${tf('barcode', 'Barcode number')}${tf('legal', 'Manufacturing / legal text', 1)}${tf('custom', 'Custom text', 1)}`;

  const sp = pkg ? pkg.spec : null;
  const ready = sp ? [['Real packaging asset (not a placeholder)', pkg.source !== 'placeholder'], ['Package dimensions entered', !!(sp.w && sp.h)], ['Label size entered', !!(sp.labelW && sp.labelH)], ['Dieline file attached', !!sp.dielineId], ['Barcode number entered', !!prod.text.barcode], ['Legal text entered', !!prod.text.legal]] : [];
  const stg = prod.stage || 'mockup';
  const outSec = `<h2>Output stage</h2><div class="seg">${[['mockup', 'Design / mockup'], ['print', 'Print artwork'], ['mfg', 'Manufacturing']].map(([k, n]) => `<button data-act="stage" data-s="${k}" aria-pressed="${k === stg}">${n}</button>`).join('')}</div>
    ${stg === 'mockup' ? '<p class="small" style="margin-top:10px">This view is a visual mockup for client approval. It is not a print or manufacturing file.</p>' : !pkg ? '<p class="note">Add a packaging model first.</p>' : `
    <p class="note">The browser does not produce final print files. Use this to collect the real specification, then hand it to a designer who finishes the artwork in Illustrator on the manufacturer's dieline, in CMYK.</p>
    <div class="grid3">${[['w', 'Width mm'], ['h', 'Height mm'], ['d', 'Depth mm']].map(([k, n]) => `<div class="field"><label>${n}</label><input type="number" inputmode="decimal" data-sp="${k}" value="${esc(sp[k])}"></div>`).join('')}</div>
    <div class="grid2">${[['labelW', 'Label width mm'], ['labelH', 'Label height mm'], ['bleed', 'Bleed mm'], ['safe', 'Safe area mm']].map(([k, n]) => `<div class="field"><label>${n}</label><input type="number" inputmode="decimal" data-sp="${k}" value="${esc(sp[k])}"></div>`).join('')}</div>
    <div class="row" style="margin-bottom:10px"><label class="btn">${sp.dielineId ? 'Replace dieline' : 'Attach dieline (PDF, SVG, image)'}<input type="file" accept=".pdf,.svg,.ai,image/*" class="hidden-input" data-up="die"></label>${sp.dielineId ? `<button class="btn ghost" data-act="dlDie">Download ${esc(sp.dielineName || 'dieline')}</button>` : ''}</div>
    <div class="field"><label>Notes for printer / designer</label><textarea data-sp="notes">${esc(sp.notes)}</textarea></div>
    <h3>Handoff readiness</h3>${ready.map(([n, ok]) => `<div class="check"><span class="mark ${ok ? 'y' : 'n'}">${ok ? '✓' : '!'}</span>${n}</div>`).join('')}
    <p class="muted small" style="margin-top:8px">${ready.every(r => r[1]) ? 'Ready to hand to a designer. Final files still need checking in professional software and printer approval.' : 'Missing items must come from the company or manufacturer.'}</p>`}`;

  const others = p.products.filter(x => x.id !== prod.id);
  const actSec = `<h2>Product actions</h2><div class="row"><select id="copySel" aria-label="Copy to product" style="width:auto;flex:1;min-width:150px">${others.map(x => `<option value="${esc(x.id)}">${esc(x.typeLabel)}</option>`).join('')}</select><button class="btn" data-act="copyTo">Copy label and colour style</button></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost danger" data-act="resetProd">Reset ${esc(prod.typeLabel)}</button>${prod.custom ? `<button class="btn ghost danger" data-act="delProduct">Delete ${esc(prod.typeLabel)}</button>` : ''}</div>
    <h3>Revision history</h3>${prod.history.length ? `<ul class="list">${prod.history.slice().reverse().slice(0, 8).map((h, ri) => { const o = JSON.parse(h), i = prod.history.length - 1 - ri; return `<li><span class="small">${esc(M.getPkg(p, o.packagingId)?.name || 'No packaging')} · ${esc(M.getLabel(p, o.labelId)?.name || '')} · ${esc(p.theme.palette[o.colorIndex]?.name || '')} · ${esc(o.text?.name || '')}</span><button class="btn" data-act="hist" data-i="${i}">Restore</button></li>`; }).join('')}</ul>` : '<p class="muted small">Changes will appear here.</p>'}`;

  V.innerHTML = `<div class="chips" style="margin-bottom:12px">${prodChips}<button class="chip" data-act="addProduct">+ Add product</button></div><div class="editor"><div class="sticky"><section class="card">${preview}</section></div><div>
    <section class="card">${pkgSec}</section><section class="card">${colSec}</section><section class="card">${labSec}</section><section class="card">${txtSec}</section><section class="card">${outSec}</section><section class="card">${actSec}</section></div></div>`;
  const det = $('#pkgDetails'); if (det) det.addEventListener('toggle', () => { S.openPkg = det.open; });
  updatePreview();
}
let pvTok = 0;
async function updatePreview() {
  const cv = $('#pv'); if (!cv) return;
  const tok = ++pvTok, c = await renderProduct(S.project, curProd(), { original: S.original });
  if (tok !== pvTok) return;
  if (!c) { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'note', textContent: 'The packaging image could not be loaded on this device. Upload it again.' })); return; }
  cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
}

/* ================= Project tab ================= */
function renderProject() {
  const p = S.project;
  V.innerHTML = `<section class="card"><h2>Projects on this device</h2><p class="muted small">One project per company or job. Each keeps its own theme, products, letterpad and versions.</p>
  <ul class="list">${S.projects.map(x => `<li><div><b>${esc(x.name)}</b>${x.id === p.id ? ' <span class="tag final">Open</span>' : ''}<div class="muted small">Last change ${new Date(x.updated).toLocaleString()}</div></div><div class="row">${x.id === p.id ? '' : `<button class="btn" data-act="projOpen" data-id="${esc(x.id)}">Open</button><button class="btn ghost danger" data-act="projDel" data-id="${esc(x.id)}">Delete</button>`}</div></li>`).join('')}</ul>
  <div class="row" style="margin-top:8px"><button class="btn primary" data-act="newProj">New project</button><button class="btn" data-act="dupProj">Duplicate this project</button></div></section>
  <section class="card"><h2>Versions of “${esc(p.name)}”</h2><p class="muted small">A version is a full snapshot of all 10 products, the theme and the letterpad. Restoring never deletes other versions.</p>
  <div class="row"><input type="text" id="verName" aria-label="Version name" placeholder="V${p.versions.length + 1}" style="flex:1;min-width:140px"><button class="btn primary" data-act="saveVer">Save version</button></div>
  <ul class="list" style="margin-top:8px">${p.versions.slice().reverse().map(v => `<li><div><b>${esc(v.name)}</b> ${v.final ? '<span class="tag final">Final</span>' : ''}<div class="muted small">${new Date(v.date).toLocaleString()}</div></div><div class="row"><button class="btn" data-act="verRestore" data-id="${esc(v.id)}">Restore</button><button class="btn ghost" data-act="verFinal" data-id="${esc(v.id)}">${v.final ? 'Unmark' : 'Mark final'}</button><button class="btn ghost danger" data-act="verDel" data-id="${esc(v.id)}">Delete</button></div></li>`).join('') || '<li class="muted small">No versions saved yet.</li>'}</ul></section>
  <section class="card"><h2>Project file</h2><p class="muted small">Work autosaves on this device only. Save a project file to back up, or to move the project to another phone or computer. The file includes all images. Project files from the Phase 1 prototype open too.</p>
  <div class="row"><button class="btn" data-act="expProj">Save project file</button><label class="btn">Open project file<input type="file" accept=".json,application/json" class="hidden-input" data-up="proj"></label></div></section>
  <section class="card"><h2>Storage</h2><p class="muted small">Images stay stored while any project or version uses them. Clean up removes files nothing uses any more.</p><button class="btn" data-act="gc">Clean up unused files</button></section>`;
}

/* ================= Checks tab ================= */
function renderChecks() {
  const r = S.checks;
  V.innerHTML = `<section class="card"><h2>Architecture checks</h2><p class="muted small">These run on a copy of your project, so nothing you made is changed. All must pass before expanding to all 10 products.</p><button class="btn primary" data-act="runChecks">Run checks</button>
  ${r ? `<p class="small" style="margin-top:12px"><b>${r.filter(x => x[1]).length} of ${r.length} passed</b></p><div>${r.map(([n, ok, msg]) => `<div class="check"><span class="mark ${ok ? 'y' : 'n'}">${ok ? '✓' : '✕'}</span><div>${esc(n)}${msg ? `<div class="muted small">${esc(msg)}</div>` : ''}</div></div>`).join('')}</div>` : ''}</section>
  <section class="card"><h2>What this app does not do</h2><div class="small"><p>It does not turn a photo into a manufacturing file. Print artwork is finished in Illustrator on the manufacturer's dieline, in CMYK.</p><p>Labels sit flat on the packaging. Wrapping a label around a curved bottle realistically needs Photoshop smart objects or a 3D tool like Blender.</p><p>There is no 3D model rendering yet. GLB/GLTF support is a separate future module.</p><p>Masking is by colour and grey protection. A brush mask for protecting specific areas is planned for the next phase.</p><p>Letterpads are uploaded as images. PDF letterpads must be exported to PNG at 300 dpi first.</p></div></section>`;
}

/* ================= events ================= */
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  commitEdit(false); if (S.tab === 'letterpad') editor.leave(); S.tab = b.dataset.tab; S.pick = false; render(); window.scrollTo({ top: 0 });
});
$('#projName').addEventListener('change', e => { S.project.name = e.target.value.trim() || 'Untitled project'; save(); });
$('#installBtn').addEventListener('click', async () => { if (!S.installEvt) return; S.installEvt.prompt(); await S.installEvt.userChoice.catch(() => null); S.installEvt = null; $('#installBtn').hidden = true; });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; $('#installBtn').hidden = false; });

function setArea(t, side, v) {
  const a = t.area; let l = a.x, r = a.x + a.w, tp = a.y, b = a.y + a.h;
  if (side === 'left') l = Math.min(v, r - .05); if (side === 'right') r = Math.max(v, l + .05);
  if (side === 'top') tp = Math.min(v, b - .05); if (side === 'bottom') b = Math.max(v, tp + .05);
  t.area = { x: clamp(l), y: clamp(tp), w: clamp(r - l, .05, 1), h: clamp(b - tp, .05, 1) };
}

V.addEventListener('input', e => {
  const el = e.target, p = S.project;
  if (el.dataset.rg && !el.dataset.rg.startsWith('el.')) {
    const k = el.dataset.rg, v = +el.value, out = el.parentNode.querySelector('output');
    out.textContent = fmtFor(k)(v);
    if (k.startsWith('la.')) { const pkg = curPkg(); beginEdit(pkg); pkg.labelArea[k.slice(3)] = v; updatePreview(); }
    else if (k.startsWith('rc.')) { const pkg = curPkg(); beginEdit(pkg); pkg.recolor[k.slice(3)] = v; updatePreview(); }
    else if (k.startsWith('adj.')) { const prod = curProd(); beginEdit(prod); prod.adjust[k.slice(4)] = v; updatePreview(); }
    else if (k.startsWith('ar.')) { setArea(curTemplate(), k.slice(3), v); editor.layout(); }
    return;
  }
  if (el.dataset.tx) { const prod = curProd(); beginEdit(prod); prod.text[el.dataset.tx] = el.value; updatePreview(); return; }
  if (el.dataset.tok) { const i = +el.dataset.tok; editToken(p, i, el.value); el.nextElementSibling.style.background = p.theme.palette[i].hex; return; }
});

V.addEventListener('change', async e => {
  const el = e.target, p = S.project;
  if (el.dataset.rg || el.dataset.tx) {
    commitEdit();
    if (el.dataset.rg && /^(adj|la|rc)\./.test(el.dataset.rg)) renderProductTab();
    if (el.dataset.rg && el.dataset.rg.startsWith('ar.')) editor.render();
    return;
  }
  if (el.dataset.tok) { save(); renderTheme(); applyAccent(); return; }
  if (el.dataset.pk) {
    const pkg = curPkg(), k = el.dataset.pk;
    M.pushHistory(pkg);
    if (k === 'rc.enabled') pkg.recolor.enabled = el.checked; else pkg[k] = k === 'kind' ? el.value : el.value.slice(0, 60);
    save(); renderProductTab(); return;
  }
  if (el.dataset.lb) { const lab = M.getLabel(p, curProd().labelId); lab[el.dataset.lb] = el.checked; save(); updatePreview(); return; }
  if (el.dataset.sp) { curPkg().spec[el.dataset.sp] = el.value; save(); renderProductTab(); return; }
  if (el.dataset.co) { p.company[el.dataset.co] = el.value; save(); editor.layout(); return; }
  if (el.dataset.tp) { curTemplate().name = el.value.trim() || 'Letterpad'; save(); editor.render(); return; }
  if (el.dataset.lpo) { p.letterpad[el.dataset.lpo] = el.checked; save(); editor.layout(); return; }
  if (el.id === 'libAdd' && el.value) { M.switchPackaging(curProd(), el.value); save(); renderProductTab(); return; }
  if (el.dataset.up) {
    const f = el.files && el.files[0];
    if (!f) { toast('No file was received'); return; }
    toast('Reading ' + f.name + '…');
    try { await handleUpload(el.dataset.up, f); }
    catch (err) { toast('Could not read ' + f.name + ': ' + (err && err.message || 'unknown error')); }
    el.value = '';
  }
});

async function handleUpload(kind, f) {
  const p = S.project, prod = curProd();
  if (kind === 'ref') {
    const { id, img } = await storeImageFile(f, { max: 800, type: 'image/jpeg' });
    const b = extractBase(img);
    setTheme(p, { h: b.h, s: b.s, l: b.l, imageId: id });
    await primeAll(); save(); render();
    toast(b.neutral ? 'Mostly neutral image: tokens are grey based' : 'Theme extracted: ' + p.theme.label);
    return;
  }
  if (kind === 'pkg') {
    const { id: assetId, img } = await storeImageFile(f, { max: 1600 });
    const b = extractBase(img), id = uid('pkg');
    p.packaging.push({ id, name: fileBase(f.name) || 'Packaging', kind: 'Custom', source: 'upload', builtin: null, assetId, labelArea: { x: .25, y: .38, w: .5, h: .36 }, recolor: { enabled: !b.neutral, source: hslToHex(b.h, b.s, b.l), tol: 28, neutral: .14 }, spec: M.newSpec(), history: [] });
    M.switchPackaging(prod, id); S.openPkg = true; save(); renderProductTab();
    toast(hasTransparency(img) ? 'Packaging added. Set its material and label area under settings.' : 'Added. Tip: a transparent PNG places cleaner on the letterpad.');
    return;
  }
  if (kind === 'lab') {
    const { id: assetId } = await storeImageFile(f, { max: 1600 });
    const id = uid('lbl');
    p.labels.push({ id, name: fileBase(f.name).slice(0, 30) || 'Artwork', kind: 'image', assetId, showName: false, showFooter: false });
    M.setLabel(prod, id); save(); renderProductTab(); return;
  }
  if (kind === 'die') {
    if (f.size > 25e6) { toast('Dieline file is over 25 MB. Keep it with the project files instead.'); return; }
    const sp = curPkg().spec; sp.dielineId = await storeRawFile(f); sp.dielineName = f.name.slice(0, 80);
    save(); renderProductTab(); toast('Dieline attached'); return;
  }
  if (kind === 'logo') { const { id } = await storeImageFile(f, { max: 1000 }); p.company.logoId = id; await primeAll(); save(); editor.render(); return; }
  if (kind === 'lpImg') { const { id, w, h } = await storeImageFile(f, { max: 2400 }); editor.addImage(id, w, h); return; }
  if (kind === 'tpl') {
    const { id: assetId, w, h } = await storeImageFile(f); // full resolution: this is the print background
    const t = { id: uid('lpt'), name: fileBase(f.name) || 'Letterpad', assetId, w, h, area: { ...M.TEMPLATE_AREA } };
    p.letterpadTemplates.push(t); M.setLetterpadTemplate(p, t.id); p.letterpad.watermark = false;
    await primeAll(); save(); editor.render();
    toast('Letterpad added. Set the header and footer guide so you can see the free area.');
    return;
  }
  if (kind === 'proj') {
    const np = await importProjectFile(await f.text());
    if (S.projects.some(x => x.id === np.id) && np.id !== p.id) np.id = uid('proj');
    if (np.id === p.id && !confirm('This file is the project that is open now. Replace what is open with the file?')) return;
    await flushSave(); await openProject(np); toast('Project opened');
  }
}

V.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, p = S.project, prod = curProd();
  switch (a) {
    case 'selProd': S.sel = b.dataset.id; S.pick = false; S.original = false; renderProductTab(); break;
    case 'pkg': M.switchPackaging(prod, b.dataset.id); save(); renderProductTab(); break;
    case 'rmPkg': M.removePackaging(prod); save(); renderProductTab(); break;
    case 'pkgUndo': if (M.undo(curPkg())) { save(); renderProductTab(); toast('Model setting undone'); } break;
    case 'tok': M.setToken(prod, +b.dataset.i); save(); renderProductTab(); break;
    case 'resetAdj': M.pushHistory(prod); prod.adjust = { h: 0, s: 0, l: 0 }; save(); renderProductTab(); break;
    case 'lab': M.setLabel(prod, b.dataset.id); save(); renderProductTab(); break;
    case 'undo': if (M.undo(prod)) { save(); renderProductTab(); toast('Undone'); } break;
    case 'hist': if (M.restoreRevision(prod, +b.dataset.i)) { save(); renderProductTab(); toast('Revision restored'); } break;
    case 'pick': S.pick = !S.pick; renderProductTab(); break;
    case 'stage': prod.stage = b.dataset.s; save(); renderProductTab(); break;
    case 'dlPng': case 'dlBare': {
      const c = await renderProduct(p, prod, { label: a === 'dlPng' }); if (!c) break;
      const r = await saveFile(`${prod.type}-${slug(curPkg().name)}${a === 'dlBare' ? '-no-label' : ''}.png`, await canvasBlob(c));
      if (r === 'downloaded') toast('PNG saved'); break;
    }
    case 'dlDie': { const sp = curPkg().spec, asset = await store.getAsset(sp.dielineId); if (asset) await saveFile(sp.dielineName || 'dieline', asset.blob); else toast('Dieline file is missing on this device'); break; }
    case 'copyTo': { const t = p.products.find(x => x.id === $('#copySel').value); if (!t) break; M.pushHistory(t); t.labelId = prod.labelId; t.adjust = clone(prod.adjust); save(); toast('Label and colour style copied to ' + t.typeLabel); break; }
    case 'resetProd': if (confirm('Reset ' + prod.typeLabel + '? Packaging models stay in the library, and Undo brings it back.')) { M.resetProduct(prod); save(); renderProductTab(); } break;
    case 'sample': { const [h, s, l] = hexToHsl(b.dataset.hex); setTheme(p, { h, s, l, label: b.textContent.trim() }); save(); render(); break; }
    case 'regen': { if (!p.theme.imageId) break; const im = await store.assetImage(p.theme.imageId), bb = extractBase(im); setTheme(p, { h: bb.h, s: bb.s, l: bb.l, imageId: p.theme.imageId }); save(); render(); break; }
    case 'tokReset': resetToken(p, +b.dataset.i); save(); render(); break;
    case 'tpl': M.setLetterpadTemplate(p, b.dataset.id || null); await primeAll(); save(); editor.render(); break;
    case 'tplRm': { const t = curTemplate(); if (!t || !confirm('Remove “' + t.name + '” from this project? Saved versions that use it keep their copy.')) break; p.letterpadTemplates = p.letterpadTemplates.filter(x => x.id !== t.id); M.setLetterpadTemplate(p, null); save(); editor.render(); break; }
    case 'lpHead': p.letterpad.headerToken = +b.dataset.i; save(); editor.render(); break;
    case 'rmLogo': p.company.logoId = null; save(); editor.render(); break;
    case 'addProduct': { const n = prompt('Name of the new product (for example: Hair oil, Lip balm)'); if (!n || !n.trim()) break; const x = M.addCustomProduct(p, n.trim().slice(0, 40)); S.sel = x.id; save(); renderProductTab(); toast(x.typeLabel + ' added. Add it to the letterpad from the Letterpad tab.'); break; }
    case 'delProduct': if (prod.custom && confirm('Delete ' + prod.typeLabel + '? It is also removed from the letterpad pages. Saved versions keep it.')) { M.deleteCustomProduct(p, prod.id); S.sel = 'shampoo'; save(); renderProductTab(); } break;
    case 'saveVer': { const n = $('#verName').value.trim() || 'V' + (p.versions.length + 1); p.versions.push({ id: uid('v'), name: n.slice(0, 80), date: Date.now(), final: false, data: M.projectSnapshot(p) }); save(); renderProject(); toast('Saved ' + n); break; }
    case 'verRestore': {
      const v = p.versions.find(x => x.id === b.dataset.id); if (!v) break;
      p.versions.push({ id: uid('v'), name: 'Backup before restoring ' + v.name, date: Date.now(), final: false, data: M.projectSnapshot(p) });
      const d = M.normalizeProject(JSON.parse(v.data)); d.id = p.id; d.name = p.name; d.versions = p.versions;
      S.project = d; editor.reset(); await primeAll(); save(); render(); toast('Restored ' + v.name); break;
    }
    case 'verFinal': { const v = p.versions.find(x => x.id === b.dataset.id); if (v) { v.final = !v.final; save(); renderProject(); } break; }
    case 'verDel': if (confirm('Delete this version?')) { p.versions = p.versions.filter(x => x.id !== b.dataset.id); save(); renderProject(); } break;
    case 'expProj': { await flushSave(); const r = await saveFile(projectFileName(p), await exportProjectFile(p)); if (r === 'downloaded') toast('Project file saved'); break; }
    case 'newProj': { const n = prompt('Name for the new project', 'New project'); if (n === null) break; await flushSave(); await openProject(M.defaultProject(n.trim() || 'New project')); toast('New project started'); break; }
    case 'dupProj': { await flushSave(); const d = M.normalizeProject(clone(p)); d.id = uid('proj'); d.name = p.name + ' (copy)'; await openProject(d); toast('Duplicated'); break; }
    case 'projOpen': { await flushSave(); const d = await store.loadProject(b.dataset.id); if (!d) { toast('That project could not be read'); break; } await openProject(M.normalizeProject(d)); break; }
    case 'projDel': { const x = S.projects.find(q => q.id === b.dataset.id); if (!x || !confirm('Delete “' + x.name + '” from this device? This cannot be undone. Save a project file first if you may need it.')) break; await store.deleteProject(x.id); S.projects = await store.listProjects(); renderProject(); break; }
    case 'gc': {
      await flushSave();
      const keep = new Set();
      for (const x of S.projects) { const d = await store.loadProject(x.id); if (d) M.assetIds(d, keep); }
      M.assetIds(S.project, keep);
      const n = await store.collectGarbage(keep); toast(n ? `Removed ${n} unused file${n > 1 ? 's' : ''}` : 'Nothing to clean up'); break;
    }
    case 'runChecks': b.disabled = true; b.textContent = 'Running…'; S.checks = await runChecks(S.project); renderChecks(); break;
  }
});

/* before/after hold */
V.addEventListener('pointerdown', e => { if (e.target.id === 'baBtn') { S.original = true; e.target.textContent = 'Showing original'; updatePreview(); } });
['pointerup', 'pointerleave', 'pointercancel'].forEach(t => V.addEventListener(t, e => { if (S.original && e.target.id === 'baBtn') { S.original = false; e.target.textContent = 'Hold to compare original'; updatePreview(); } }));
/* colour picking on the preview */
V.addEventListener('click', async e => {
  if (e.target.id !== 'pv' || !S.pick) return;
  const cv = e.target, r = cv.getBoundingClientRect();
  const px = Math.floor((e.clientX - r.left) / r.width * cv.width), py = Math.floor((e.clientY - r.top) / r.height * cv.height);
  const pkg = curPkg(), base = await baseCanvas(pkg); if (!base) return;
  const d = base.getContext('2d').getImageData(px, py, 1, 1).data;
  if (d[3] < 128) { toast('That spot is transparent. Tap the packaging itself.'); return; }
  if (rgbToHsl(d[0], d[1], d[2])[1] < pkg.recolor.neutral) { toast('That colour is grey or white, which is protected. Pick a coloured area.'); return; }
  M.pushHistory(pkg); pkg.recolor.source = rgbToHex(d[0], d[1], d[2]); S.pick = false; save(); renderProductTab();
});

window.addEventListener('resize', () => { if (S.tab === 'letterpad') editor.layout(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { commitEdit(false); if (S.tab === 'letterpad') editor.leave(); flushSave().catch(() => {}); } });

/* ================= start ================= */
async function openProject(p) {
  S.project = p; S.checks = null; S.sel = 'shampoo'; editor.reset();
  await primeAll(); await store.saveProject(p); S.projects = await store.listProjects(); render();
}
(async () => {
  let p = null;
  try {
    const cur = await store.kvGet('current');
    if (cur) p = await store.loadProject(cur);
    if (p) p = M.normalizeProject(p);
  } catch (e) { p = null; }
  if (!p) p = M.defaultProject();
  try { await Promise.race([Promise.all([document.fonts.load('40px "DM Serif Display"'), document.fonts.load('600 20px "Schibsted Grotesk"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fonts optional */ }
  try { await openProject(p); $('#saveState').textContent = 'Saved on this device'; }
  catch (e) { S.project = p; await primeAll(); render(); $('#saveState').textContent = 'Storage blocked: work will not be kept'; }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
