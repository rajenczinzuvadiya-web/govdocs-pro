/* Letterpad page editor: works like a blank Word page on top of the company letterpad.
   Products, text boxes and images can be added anywhere, moved, resized, restacked,
   duplicated and deleted; text is typed straight onto the page. Several pages per project.
   Undo/redo covers every change to the pages. */
import { $, esc, clamp, safeHex, slug } from './util.js';
import { resolveColor } from './theme.js';
import * as M from './model.js';
import * as store from './store.js';
import { renderProduct } from './render.js';
import { drawBackground, exportPage, loadPageFonts, templateWarnings, wrapLines, fontCss, pt, drawCaption, EMPTY_AR } from './letterpad.js';
import { saveFile, canvasBlob } from './files.js';

export function createEditor(app) {
  const { S, V } = app;
  const E = { page: 0, sel: null, editing: null, zoom: 1, undo: [], redo: [] };
  const lpImgs = new Map(); // productId → { url, ar }
  const measure = document.createElement('canvas').getContext('2d');

  const p = () => S.project;
  const pages = () => p().letterpad.pages;
  const page = () => pages()[clamp(E.page, 0, pages().length - 1)];
  const selEl = () => (E.sel ? M.findEl(page(), E.sel) : null);
  const prodOf = el => p().products.find(x => x.id === el.productId);

  /* ---------- undo / redo over all pages ---------- */
  const docState = () => JSON.stringify(pages());
  function docPush(s = docState()) { E.undo.push(s); if (E.undo.length > 80) E.undo.shift(); E.redo = []; }
  let docSnap = null;
  const docBegin = () => { if (docSnap === null) docSnap = docState(); };
  function docCommit() { if (docSnap !== null) { if (docSnap !== docState()) docPush(docSnap); docSnap = null; app.save(); } }
  function docStep(from, to) {
    const s = from.pop(); if (!s) return;
    to.push(docState()); p().letterpad.pages = JSON.parse(s);
    E.page = clamp(E.page, 0, pages().length - 1); if (!selEl()) E.sel = null;
    app.save(); render();
  }
  function change(fn) { if (docSnap !== null) docCommit(); docPush(); fn(); app.save(); }

  /* ================= render ================= */
  function render() {
    const P = p(), lp = P.letterpad, tpl = app.curTemplate(), A = M.activeArea(P);
    E.page = clamp(E.page, 0, pages().length - 1);
    const pg = page();
    const prodOpts = P.products.map(x => `<option value="${esc(x.id)}">${esc(x.typeLabel)}${x.packagingId ? '' : ' (no packaging yet)'}</option>`).join('');
    const tools = `<div class="lp-tools">
      <button class="btn" data-act="addText" title="Add a text box">+ Text</button>
      <select id="addProd" aria-label="Add product"><option value="">+ Product…</option>${prodOpts}<option value="__grid">All products in a grid</option></select>
      <label class="btn">+ Image<input type="file" accept="image/*" class="hidden-input" data-up="lpImg"></label>
      <span class="sp"></span>
      <button class="btn icon" data-act="docUndo" ${E.undo.length ? '' : 'disabled'} aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
      <button class="btn icon" data-act="docRedo" ${E.redo.length ? '' : 'disabled'} aria-label="Redo" title="Redo (Ctrl+Y)">↷</button>
      <select id="zoom" aria-label="Zoom">${[[1, 'Fit'], [1.5, '150%'], [2, '200%'], [3, '300%']].map(([z, n]) => `<option value="${z}"${z === E.zoom ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="chips pages">${pages().map((_, i) => `<button class="chip" data-act="page" data-i="${i}" aria-pressed="${i === E.page}">Page ${i + 1}</button>`).join('')}<button class="chip" data-act="addPage">+ Page</button>${pages().length > 1 ? '<button class="chip danger-chip" data-act="delPage">Delete page</button>' : ''}</div>`;
    const els = pg.elements.map(elHtml).join('');
    const areaCtl = tpl ? `<h3>Header and footer guide</h3><p class="muted small">The dashed box marks the free part of the letterpad. Anything can still go anywhere; this is only a guide, and where “All products in a grid” places them.</p>
      ${app.rng('Top', 'ar.top', A.y, 0, .9, .005, app.pct)}${app.rng('Bottom', 'ar.bottom', A.y + A.h, .1, 1, .005, app.pct)}${app.rng('Left', 'ar.left', A.x, 0, .9, .005, app.pct)}${app.rng('Right', 'ar.right', A.x + A.w, .1, 1, .005, app.pct)}
      <div class="field" style="margin-top:6px"><label for="tplName">Letterpad name</label><input id="tplName" type="text" data-tp="name" value="${esc(tpl.name)}"></div>
      ${templateWarnings(tpl).map(w => `<p class="note">${esc(w)}</p>`).join('')}
      <div class="row"><button class="btn ghost danger" data-act="tplRm">Remove this letterpad</button></div>`
      : '<p class="muted small" style="margin-top:8px">The built-in header uses the company name, tagline, logo and footer below, coloured from the theme.</p>';

    V.innerHTML = `<div class="editor lp-editor"><div class="sticky"><section class="card">${tools}
      <div class="lp-scroll" id="lpScroll"><div class="lp" id="lp" style="width:${E.zoom * 100}%"><canvas class="bg" id="lpBg"></canvas><div class="lp-area" id="lpArea"></div><div class="guide-v" id="guideV" hidden></div><div class="guide-h" id="guideH" hidden></div>${els}</div></div>
      </section></div>
      <div><section class="card"><h2>Selected item</h2><div id="inspector">${inspectorHtml()}</div></section>
      <section class="card"><h2>Letterpad design</h2><p class="muted small">Use the company's own letterpad and swap it any time. Nothing on the pages moves when you do.</p>
        <div class="chips"><button class="chip" data-act="tpl" data-id="" aria-pressed="${!tpl}">Built-in header</button>${P.letterpadTemplates.map(t => `<button class="chip" data-act="tpl" data-id="${esc(t.id)}" aria-pressed="${!!tpl && tpl.id === t.id}">${esc(t.name)}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px"><label class="btn primary">Upload company letterpad<input type="file" accept="image/*" class="hidden-input" data-up="tpl"></label></div>${areaCtl}</section>
      <section class="card"><h2>Company</h2><p class="muted small">Used on labels, and on the built-in header.</p><div class="field"><label for="coName">Company name</label><input id="coName" type="text" data-co="name" value="${esc(P.company.name)}"></div><div class="field"><label for="coTag">Tagline</label><input id="coTag" type="text" data-co="tagline" value="${esc(P.company.tagline)}"></div><div class="field"><label for="coAddr">Footer (address, phone, email)</label><input id="coAddr" type="text" data-co="address" value="${esc(P.company.address)}"></div>
        <div class="row"><label class="btn">${P.company.logoId ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/*" class="hidden-input" data-up="logo"></label>${P.company.logoId ? '<button class="btn ghost danger" data-act="rmLogo">Remove logo</button>' : ''}</div></section>
      <section class="card"><h2>Page options</h2>${tpl ? '' : `<div class="lbl">Header colour</div><div class="toks" style="margin:6px 0 12px">${P.theme.palette.map((k, i) => `<button class="tk" data-act="lpHead" data-i="${i}" aria-pressed="${i === lp.headerToken}" aria-label="${esc(k.name)}" style="background:${safeHex(k.hex)}"></button>`).join('')}</div>`}
        <label class="check"><input type="checkbox" data-lpo="watermark" ${lp.watermark ? 'checked' : ''}> Faint reference image watermark</label><label class="check"><input type="checkbox" data-lpo="showReference" ${lp.showReference ? 'checked' : ''}> Show reference image${tpl ? ' in the guide corner' : ' in header'}</label><label class="check"><input type="checkbox" data-lpo="hideEmpty" ${lp.hideEmpty ? 'checked' : ''}> Leave out products without packaging when exporting</label></section>
      <section class="card"><h2>Export A4</h2><div class="row"><button class="btn primary" data-act="lpPng">Save this page as PNG (300 dpi)</button><button class="btn" data-act="lpPdf">Save PDF (${pages().length} page${pages().length > 1 ? 's' : ''})</button></div><p class="muted small" style="margin-top:8px">Letterpad exports are presentation files, not print-production artwork.</p></section></div></div>`;
    layout(); loadImages();
  }

  function elHtml(el) {
    const s = el.id === E.sel ? ' sel' : '';
    if (el.type === 'text') return `<div class="el el-text${s}" data-el="${esc(el.id)}"><div class="tx"></div><span class="hdl" data-h="e" aria-hidden="true"></span></div>`;
    if (el.type === 'image') return `<div class="el el-image${s}" data-el="${esc(el.id)}"><img alt=""><span class="hdl" data-h="se" aria-hidden="true"></span></div>`;
    const prod = prodOf(el), img = prod && prod.packagingId && lpImgs.get(prod.id);
    return `<div class="el el-product${s}" data-el="${esc(el.id)}">${prod && prod.packagingId ? `<img alt="${esc(prod.text.name)}"${img ? ` src="${esc(img.url)}"` : ''}>` : `<div class="slot"><i style="background:${safeHex(prod ? resolveColor(p(), prod) : '#cccccc')}"></i><span>No packaging</span></div>`}<canvas class="cap"></canvas><span class="hdl" data-h="se" aria-hidden="true"></span></div>`;
  }

  /* ---------- inspector for the selected element ---------- */
  function inspectorHtml() {
    const el = selEl();
    if (!el) return `<p class="muted small">Tap something on the page to select it and drag to move it; drag the corner handle to resize. Tap selected text again (or double-click) to type. On a computer: Delete, arrow keys, Ctrl+Z / Ctrl+Y, Ctrl+D to duplicate.</p>`;
    const layer = `<div class="row" style="margin-top:8px"><button class="btn" data-act="elCenter">Centre on page</button><button class="btn" data-act="elFront">Bring to front</button><button class="btn" data-act="elBack">Send to back</button><button class="btn" data-act="elDup">Duplicate</button><button class="btn ghost danger" data-act="elDel">Delete</button></div>`;
    if (el.type === 'text') {
      const sw = ['#1f2328', '#ffffff', ...p().theme.palette.map(k => k.hex)].filter((c, i, a) => a.indexOf(c) === i);
      return `<textarea id="elText" data-ei="text" aria-label="Text" rows="3">${esc(el.text)}</textarea>
        <div class="row" style="margin-top:8px"><select data-ei="font" aria-label="Font" style="width:auto">${Object.entries(M.FONTS).map(([k, f]) => `<option value="${k}"${k === el.font ? ' selected' : ''}>${f.label}</option>`).join('')}</select>
        <button class="btn icon" data-act="size" data-v="-1" aria-label="Smaller">A−</button><input type="number" data-ei="size" value="${el.size}" min="4" max="200" step="0.5" aria-label="Size in points" style="width:72px"><button class="btn icon" data-act="size" data-v="1" aria-label="Larger">A+</button>
        <button class="btn icon" data-act="bold" aria-pressed="${el.bold}" aria-label="Bold"><b>B</b></button><button class="btn icon" data-act="italic" aria-pressed="${el.italic}" aria-label="Italic"><i>I</i></button></div>
        <div class="row" style="margin-top:8px"><div class="seg">${['left', 'center', 'right'].map(a => `<button data-act="align" data-v="${a}" aria-pressed="${el.align === a}">${{ left: 'Left', center: 'Centre', right: 'Right' }[a]}</button>`).join('')}</div>
        <select data-ei="lh" aria-label="Line spacing" style="width:auto">${[[1, 'Single'], [1.3, '1.3'], [1.5, '1.5'], [2, 'Double']].map(([v, n]) => `<option value="${v}"${Math.abs(v - el.lh) < .01 ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="row" style="margin:8px 0">${sw.map(c => `<button class="tk sm" data-act="color" data-v="${safeHex(c)}" aria-pressed="${safeHex(c) === el.color}" aria-label="Colour ${safeHex(c)}" style="background:${safeHex(c)}"></button>`).join('')}<input type="color" data-ei="color" value="${safeHex(el.color)}" aria-label="Custom colour"></div>${layer}`;
    }
    const size = app.rng('Size', 'el.w', el.w, .02, 1, .005, app.pct);
    if (el.type === 'image') return `${size}${layer}`;
    const prod = prodOf(el);
    return `<div class="row"><select data-ei="productId" aria-label="Which product" style="flex:1">${p().products.map(x => `<option value="${esc(x.id)}"${x.id === el.productId ? ' selected' : ''}>${esc(x.typeLabel)}</option>`).join('')}</select><button class="btn" data-act="elEdit">Edit ${esc(prod ? prod.typeLabel : 'product')}</button></div>
      ${size}<label class="check"><input type="checkbox" data-ei="showName" ${el.showName ? 'checked' : ''}> Show name</label><label class="check"><input type="checkbox" data-ei="showDesc" ${el.showDesc ? 'checked' : ''}> Show description</label>
      <div class="row small"><label>Name size <input type="number" data-ei="nameSize" value="${el.nameSize}" min="4" max="60" step="0.5" style="width:70px"></label><label>Description size <input type="number" data-ei="descSize" value="${el.descSize}" min="4" max="60" step="0.5" style="width:70px"></label></div>
      <p class="muted small">Name and description come from the product's text, so they stay the same everywhere it appears.</p>${layer}`;
  }
  function refreshInspector() {
    const box = $('#inspector'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('textarea,input[type=number]')) return;
    box.innerHTML = inspectorHtml();
    const u = $('[data-act=docUndo]'), r = $('[data-act=docRedo]');
    if (u) u.disabled = !E.undo.length; if (r) r.disabled = !E.redo.length;
  }

  /* ---------- layout (preview) ---------- */
  function pageSize() { const lp = $('#lp'); const W = lp.clientWidth; return { lp, W, H: W * M.A4_RATIO }; }
  function layout() {
    if (!$('#lp')) return;
    const P = p(), { lp, W, H } = pageSize();
    lp.style.height = H + 'px';
    const bg = $('#lpBg'), dpr = Math.min(2, window.devicePixelRatio || 1), t = app.curTemplate();
    bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
    drawBackground(bg.getContext('2d'), bg.width, bg.height, P, { template: t && store.readyImage(t.assetId), ref: store.readyImage(P.theme.imageId), logo: store.readyImage(P.company.logoId) });
    const A = M.activeArea(P);
    Object.assign($('#lpArea').style, { left: A.x * W + 'px', top: A.y * H + 'px', width: A.w * W + 'px', height: A.h * H + 'px' });
    page().elements.forEach((el, i) => layoutEl(el, W, H, i));
  }
  function layoutEl(el, W, H, z) {
    const d = V.querySelector(`[data-el="${CSS.escape(el.id)}"]`); if (!d) return;
    if (W === undefined) ({ W, H } = pageSize());
    d.style.left = el.x * W + 'px'; d.style.top = el.y * H + 'px'; d.style.width = el.w * W + 'px';
    if (z !== undefined) d.style.zIndex = z + 1;
    if (el.type === 'text') {
      const tx = d.querySelector('.tx'), px = pt(el.size, W);
      Object.assign(tx.style, { font: fontCss(el, px), lineHeight: px * el.lh + 'px', color: el.color, textAlign: el.align });
      if (E.editing !== el.id) { measure.font = fontCss(el, px); tx.textContent = wrapLines(measure, el.text, el.w * W).join('\n'); }
      d.classList.toggle('empty', !el.text.trim());
      return;
    }
    if (el.type === 'image') {
      const im = d.querySelector('img');
      if (!im.src) store.assetURL(el.assetId).then(u => { im.src = u; }).catch(() => {});
      return;
    }
    const prod = prodOf(el); if (!prod) return;
    const info = prod.packagingId && lpImgs.get(prod.id), iw = el.w * W;
    const ih = iw * (prod.packagingId ? (info ? info.ar : 2) : EMPTY_AR);
    const im = d.querySelector('img'); if (im) im.style.height = ih + 'px';
    const sl = d.querySelector('.slot'); if (sl) { sl.style.height = ih + 'px'; sl.style.fontSize = W * .011 + 'px'; }
    /* caption drawn with the same code as the export, so preview = output */
    const cap = d.querySelector('.cap'), dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.max(iw * 1.3, W * .15);
    const ch = drawCaption(measure, el, prod, 0, 0, W, false);
    cap.width = Math.max(1, Math.round(cw * dpr)); cap.height = Math.max(1, Math.round(ch * dpr));
    Object.assign(cap.style, { width: cw + 'px', height: ch + 'px', marginLeft: (iw - cw) / 2 + 'px' });
    const cx = cap.getContext('2d'); cx.scale(dpr, dpr); drawCaption(cx, el, prod, cw / 2, 0, W, true);
  }
  async function loadImages() {
    const P = p(), used = new Set(page().elements.filter(e => e.type === 'product').map(e => e.productId));
    for (const prod of P.products) {
      if (!used.has(prod.id) || !prod.packagingId) continue;
      const c = await renderProduct(P, prod); if (!c || !$('#lp')) continue;
      const old = lpImgs.get(prod.id), url = URL.createObjectURL(await canvasBlob(c));
      lpImgs.set(prod.id, { url, ar: c.height / c.width });
      if (old) setTimeout(() => URL.revokeObjectURL(old.url), 2000);
      page().elements.filter(e => e.type === 'product' && e.productId === prod.id).forEach(e => {
        const im = V.querySelector(`[data-el="${CSS.escape(e.id)}"] img`); if (im) im.src = url;
        layoutEl(e);
      });
    }
  }

  /* ---------- selection & text editing ---------- */
  function select(id) {
    if (E.sel === id) return;
    const insp = $('#inspector');
    if (insp && insp.contains(document.activeElement)) document.activeElement.blur(); // commits a half-typed field to the old element
    if (E.editing) stopEditing();
    E.sel = id;
    V.querySelectorAll('.el').forEach(d => d.classList.toggle('sel', d.dataset.el === id));
    refreshInspector();
  }
  function startEditing(el) {
    const d = V.querySelector(`[data-el="${CSS.escape(el.id)}"]`); if (!d) return;
    docBegin(); E.editing = el.id;
    const tx = d.querySelector('.tx');
    d.classList.add('editing'); tx.textContent = el.text;
    try { tx.contentEditable = 'plaintext-only'; } catch (e) { tx.contentEditable = 'true'; }
    if (tx.contentEditable !== 'plaintext-only') tx.contentEditable = 'true';
    tx.focus();
    const r = document.createRange(); r.selectNodeContents(tx); if (el.text === 'Type here') { /* select placeholder */ } else r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function stopEditing() {
    const el = E.editing && M.findEl(page(), E.editing);
    const d = E.editing && V.querySelector(`[data-el="${CSS.escape(E.editing)}"]`);
    E.editing = null;
    if (d) { const tx = d.querySelector('.tx'); tx.contentEditable = 'false'; d.classList.remove('editing'); }
    if (el) layoutEl(el);
    docCommit(); refreshInspector();
  }

  function centreOf() {
    const sc = $('#lpScroll'), { W, H } = pageSize();
    if (!sc) return { x: .5, y: .45 };
    return { x: clamp((sc.scrollLeft + sc.clientWidth / 2) / W, .1, .9), y: clamp((sc.scrollTop + Math.min(sc.clientHeight, H) / 2) / H, .1, .9) };
  }
  function addElement(el) { change(() => M.addEl(page(), el)); E.sel = el.id; render(); return el; }

  /* ================= events ================= */
  const inEditor = e => S.tab === 'letterpad' && e.target.closest && e.target.closest('.lp-editor');

  V.addEventListener('input', e => {
    if (!inEditor(e)) return;
    const t = e.target;
    if (t.classList.contains('tx') && E.editing) {
      const el = M.findEl(page(), E.editing); el.text = t.innerText.replace(/\n$/, '');
      const ta = $('#elText'); if (ta) ta.value = el.text;
      return;
    }
    const el = selEl(); if (!el) return;
    if (t.dataset.ei) {
      const k = t.dataset.ei;
      docBegin();
      if (k === 'text') el.text = t.value;
      else if (k === 'size' || k === 'nameSize' || k === 'descSize') { const v = parseFloat(t.value); if (!Number.isFinite(v)) return; el[k] = clamp(v, 4, k === 'size' ? 200 : 60); }
      else if (k === 'color') el.color = safeHex(t.value, el.color);
      else return;
      layoutEl(el);
      return;
    }
    if (t.dataset.rg === 'el.w') { docBegin(); el.w = +t.value; t.parentNode.querySelector('output').textContent = app.pct(el.w); layoutEl(el); }
  });
  V.addEventListener('change', async e => {
    if (!inEditor(e)) return;
    const t = e.target, el = selEl();
    if (t.id === 'zoom') { E.zoom = +t.value; render(); return; }
    if (t.id === 'addProd' && t.value) {
      const v = t.value; t.value = '';
      if (v === '__grid') {
        const has = page().elements.some(x => x.type === 'product');
        if (has && !confirm('Replace the products on this page with a tidy grid of all ' + p().products.length + ' products? Text and images stay. Undo brings the old layout back.')) return;
        change(() => { const pg = page(); pg.elements = pg.elements.filter(x => x.type !== 'product').concat(M.gridLayout(p().products, M.activeArea(p()))); });
        E.sel = null; render(); return;
      }
      const c = centreOf(), w = .16;
      addElement(M.productElement(v, c.x - w / 2, c.y - .1, w));
      return;
    }
    if (!el || !t.dataset.ei && t.dataset.rg !== 'el.w') return;
    const k = t.dataset.ei;
    if (k === 'font' || k === 'lh' || k === 'productId' || k === 'showName' || k === 'showDesc') {
      docBegin();
      if (k === 'font') el.font = t.value;
      else if (k === 'lh') el.lh = +t.value;
      else if (k === 'productId') el.productId = t.value;
      else el[k] = t.checked;
      docCommit();
      if (k === 'productId') { render(); return; }
      layoutEl(el); return;
    }
    docCommit(); refreshInspector();
  });

  V.addEventListener('click', async e => {
    if (!inEditor(e)) return;
    const b = e.target.closest('[data-act]'); if (!b) return;
    const el = selEl(), pg = page();
    const upd = fn => { change(fn); layoutEl(el); refreshInspector(); };
    switch (b.dataset.act) {
      case 'addText': { const c = centreOf(); const t = addElement(M.textElement({ x: clamp(c.x - .25, 0, .5), y: c.y, w: .5, color: '#1f2328' })); requestAnimationFrame(() => startEditing(t)); break; }
      case 'docUndo': if (E.editing) stopEditing(); docStep(E.undo, E.redo); break;
      case 'docRedo': if (E.editing) stopEditing(); docStep(E.redo, E.undo); break;
      case 'page': if (E.editing) stopEditing(); E.page = +b.dataset.i; E.sel = null; render(); break;
      case 'addPage': change(() => pages().push(M.newPage())); E.page = pages().length - 1; E.sel = null; render(); break;
      case 'delPage': if (confirm('Delete page ' + (E.page + 1) + ' and everything on it? Undo brings it back.')) { change(() => pages().splice(E.page, 1)); E.page = Math.max(0, E.page - 1); E.sel = null; render(); } break;
      case 'elDel': if (el) { change(() => M.removeEl(pg, el.id)); E.sel = null; render(); } break;
      case 'elDup': if (el) { let c; change(() => { c = M.duplicateEl(pg, el.id); }); E.sel = c.id; render(); } break;
      case 'elFront': if (el) { change(() => M.restack(pg, el.id, 'front')); render(); } break;
      case 'elBack': if (el) { change(() => M.restack(pg, el.id, 'back')); render(); } break;
      case 'elCenter': if (el) upd(() => { el.x = (1 - el.w) / 2; }); break;
      case 'elEdit': if (el && el.type === 'product') { S.sel = el.productId; S.tab = 'product'; app.render(); } break;
      case 'size': if (el) upd(() => { el.size = clamp(Math.round((el.size + +b.dataset.v * (el.size >= 24 ? 2 : 1)) * 2) / 2, 4, 200); }); break;
      case 'bold': if (el) upd(() => { el.bold = !el.bold; }); break;
      case 'italic': if (el) upd(() => { el.italic = !el.italic; }); break;
      case 'align': if (el) upd(() => { el.align = b.dataset.v; }); break;
      case 'color': if (el) upd(() => { el.color = safeHex(b.dataset.v, el.color); }); break;
      case 'lpPng': {
        app.toast('Preparing A4 image…'); await loadPageFonts([pg]);
        const c = await exportPage(p(), pg, M.PRINT_WIDTH);
        const r = await saveFile(`${slug(p().name)}-letterpad${pages().length > 1 ? '-p' + (E.page + 1) : ''}.png`, await canvasBlob(c));
        if (r === 'downloaded') app.toast('Page saved as PNG'); break;
      }
      case 'lpPdf': {
        if (!window.jspdf) { app.toast('PDF tool did not load'); break; }
        app.toast('Preparing PDF…'); await loadPageFonts(pages());
        const d = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
        for (let i = 0; i < pages().length; i++) {
          if (i) d.addPage('a4');
          d.addImage((await exportPage(p(), pages()[i], M.PRINT_WIDTH)).toDataURL('image/jpeg', .93), 'JPEG', 0, 0, 210, 297);
        }
        const r = await saveFile(slug(p().name) + '-letterpad.pdf', d.output('blob')); if (r === 'downloaded') app.toast('PDF saved'); break;
      }
    }
  });

  /* ---------- drag to move, handle to resize ---------- */
  let drag = null;
  V.addEventListener('pointerdown', e => {
    if (!inEditor(e)) return;
    const d = e.target.closest('.el');
    if (!d) {
      if (e.target.closest('#lp')) { if (E.editing) stopEditing(); select(null); }
      return;
    }
    if (E.editing === d.dataset.el && e.target.closest('.tx')) return; // typing: let the caret move
    if (E.editing) stopEditing();
    const el = M.findEl(page(), d.dataset.el); if (!el) return;
    const wasSel = E.sel === el.id;
    select(el.id);
    const { W, H } = pageSize(), h = e.target.closest('.hdl');
    drag = { el, d, mode: h ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, W, H, moved: false, wasSel, snap: docState() };
    d.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  V.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / drag.W, dy = (e.clientY - drag.sy) / drag.H, el = drag.el;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    const gv = $('#guideV'), gh = $('#guideH');
    if (drag.mode === 'resize') { el.w = clamp(drag.ow + dx, .02, 1.2); }
    else {
      el.x = clamp(drag.ox + dx, -.4, 1.2); el.y = clamp(drag.oy + dy, -.3, 1.2);
      /* snap the centre to the page's vertical centre line */
      const r = drag.d.getBoundingClientRect(), wFrac = r.width / drag.W, hFrac = r.height / drag.H;
      const cx = el.x + wFrac / 2, snapX = Math.abs(cx - .5) < .008;
      if (snapX) el.x = .5 - wFrac / 2;
      const A = M.activeArea(p()), acy = A.y + A.h / 2, cy = el.y + hFrac / 2, snapY = Math.abs(cy - acy) < .006;
      if (snapY) el.y = acy - hFrac / 2;
      if (gv) { gv.hidden = !snapX; gv.style.left = drag.W / 2 + 'px'; }
      if (gh) { gh.hidden = !snapY; gh.style.top = acy * drag.H + 'px'; }
    }
    layoutEl(el, drag.W, drag.H);
  });
  const endDrag = () => {
    if (!drag) return;
    const { el, moved, wasSel, snap } = drag; drag = null;
    const gv = $('#guideV'), gh = $('#guideH'); if (gv) gv.hidden = true; if (gh) gh.hidden = true;
    if (moved) { if (snap !== docState()) docPush(snap); app.save(); refreshInspector(); }
    else if (wasSel && el.type === 'text') startEditing(el);
  };
  V.addEventListener('pointerup', endDrag);
  V.addEventListener('pointercancel', endDrag);
  V.addEventListener('dblclick', e => { if (!inEditor(e)) return; const d = e.target.closest('.el-text'); if (d && E.editing !== d.dataset.el) { const el = M.findEl(page(), d.dataset.el); if (el) startEditing(el); } });
  V.addEventListener('focusout', e => { if (E.editing && e.target.classList && e.target.classList.contains('tx')) setTimeout(() => { if (E.editing && !document.activeElement.closest('.el-text.editing')) stopEditing(); }, 0); });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (S.tab !== 'letterpad') return;
    const typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); docStep(e.shiftKey ? E.redo : E.undo, e.shiftKey ? E.undo : E.redo); return; }
    if (mod && !typing && e.key === 'y') { e.preventDefault(); docStep(E.redo, E.undo); return; }
    if (e.key === 'Escape') { if (E.editing) stopEditing(); else select(null); return; }
    if (typing) return;
    const el = selEl(); if (!el) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); change(() => M.removeEl(page(), el.id)); E.sel = null; render(); return; }
    if (mod && e.key === 'd') { e.preventDefault(); let c; change(() => { c = M.duplicateEl(page(), el.id); }); E.sel = c.id; render(); return; }
    const step = e.shiftKey ? .01 : .002, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); docBegin(); el.x += mv[0]; el.y += mv[1]; layoutEl(el); clearTimeout(E.nudge); E.nudge = setTimeout(docCommit, 500); }
  });

  return {
    render, layout,
    reset() { E.page = 0; E.sel = null; E.editing = null; E.undo = []; E.redo = []; lpImgs.forEach(v => URL.revokeObjectURL(v.url)); lpImgs.clear(); },
    addImage(assetId, w, h) { const c = centreOf(), ww = .3; addElement(M.imageElement(assetId, c.x - ww / 2, c.y - ww * (h / w) / M.A4_RATIO / 2, ww)); },
    leave() { if (E.editing) stopEditing(); docCommit(); },
    pushState: docPush,
    get state() { return E; },
  };
}
