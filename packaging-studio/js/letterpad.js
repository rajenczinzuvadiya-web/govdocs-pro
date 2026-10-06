/* A4 letterpad pages. The background is either a built-in header drawn from the company profile
   or the company's own letterpad uploaded as a template. On top sit free elements (products,
   text boxes, images) placed anywhere, like a blank Word page. Swapping the letterpad never
   moves an element. */
import { onColor } from './color.js';
import { resolveColor } from './theme.js';
import { activeArea, getTemplate, A4_RATIO, FONTS, PT_PER_PAGE } from './model.js';
import { assetImage } from './store.js';
import { renderProduct, fitFont, rrPath, SERIF, SANS } from './render.js';

export const TEXT_INK = '#1f2328', TEXT_MUTED = '#5e6570';
export const EMPTY_AR = 1.25; // placeholder box for a product with no packaging yet
export const pt = (size, W) => size / PT_PER_PAGE * W;

async function opt(id) { try { return id ? await assetImage(id) : null; } catch (e) { return null; } }
export async function letterpadImages(p) {
  const t = getTemplate(p);
  return { template: t ? await opt(t.assetId) : null, ref: await opt(p.theme.imageId), logo: await opt(p.company.logoId) };
}

function coverCircle(x, im, cx, cy, r, stroke, lw) {
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  const s = Math.max(2 * r / im.naturalWidth, 2 * r / im.naturalHeight);
  x.drawImage(im, cx - im.naturalWidth * s / 2, cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
  x.restore();
  x.lineWidth = lw; x.strokeStyle = stroke; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
}
function watermark(x, im, W, H, A) {
  x.save(); x.globalAlpha = .06;
  const w = W * A.w * .75, h = w * im.naturalHeight / im.naturalWidth;
  x.drawImage(im, (A.x + A.w / 2) * W - w / 2, (A.y + A.h / 2) * H - h / 2, w, h);
  x.restore();
}

export function drawBackground(x, W, H, p, imgs) {
  const lp = p.letterpad, A = activeArea(p);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  if (getTemplate(p)) {
    if (imgs.template) x.drawImage(imgs.template, 0, 0, W, H);
    if (lp.watermark && imgs.ref) watermark(x, imgs.ref, W, H, A);
    if (lp.showReference && imgs.ref) { const r = W * .045; coverCircle(x, imgs.ref, (A.x + A.w) * W - r - W * .01, A.y * H + r + W * .01, r, '#ffffff', W * .003); }
    return;
  }
  const head = p.theme.palette[lp.headerToken].hex, hc = onColor(head), hh = H * .11;
  if (lp.watermark && imgs.ref) watermark(x, imgs.ref, W, H, A);
  x.fillStyle = head; x.fillRect(0, 0, W, hh);
  x.fillStyle = p.theme.palette[1].hex; x.fillRect(0, hh, W, H * .006);
  let tx = W * .06;
  if (imgs.logo) { const lh = hh * .5, lw = Math.min(W * .2, lh * imgs.logo.naturalWidth / imgs.logo.naturalHeight); x.drawImage(imgs.logo, tx, hh / 2 - lh / 2, lw, lh); tx += lw + W * .03; }
  x.fillStyle = hc; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  fitFont(x, p.company.name, W * .6, W * .05, SERIF, 400); x.fillText(p.company.name, tx, hh * .56);
  x.font = `500 ${W * .017}px ${SANS}`; x.globalAlpha = .85; x.fillText(p.company.tagline || '', tx, hh * .8); x.globalAlpha = 1;
  if (lp.showReference && imgs.ref) { const r = hh * .34; coverCircle(x, imgs.ref, W - W * .06 - r, hh / 2, r, hc, W * .003); }
  x.fillStyle = head; x.fillRect(W * .06, H * .93, W * .88, H * .002);
  x.fillStyle = TEXT_MUTED; x.textAlign = 'center'; x.font = `500 ${W * .014}px ${SANS}`; x.fillText(p.company.address || '', W / 2, H * .955);
}

/* ---------- text layout (shared rule for every text on the page) ----------
   Greedy word wrap per paragraph; a word wider than the box is split by grapheme so
   Gujarati letters are never cut through a conjunct. */
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = s => (seg ? [...seg.segment(s)].map(g => g.segment) : [...s]);
export function wrapLines(x, text, max) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const word of para.split(/ +/)) {
      const t = cur ? cur + ' ' + word : word;
      if (x.measureText(t).width <= max || !cur && x.measureText(word).width <= max) { cur = t; continue; }
      if (cur) out.push(cur);
      cur = '';
      if (x.measureText(word).width <= max) { cur = word; continue; }
      for (const g of graphemes(word)) { if (cur && x.measureText(cur + g).width > max) { out.push(cur); cur = g; } else cur += g; }
    }
    out.push(cur);
  }
  return out;
}
export const fontCss = (el, px) => `${el.italic ? 'italic ' : ''}${el.bold ? 700 : 400} ${px}px ${FONTS[el.font].css}`;

/* Draws a text element; returns its height in pixels. */
export function drawText(x, el, W, H, draw = true) {
  const px = pt(el.size, W), bw = el.w * W, lh = px * el.lh;
  x.font = fontCss(el, px);
  const lines = wrapLines(x, el.text, bw);
  if (draw) {
    x.fillStyle = el.color; x.textBaseline = 'middle'; x.textAlign = el.align;
    const ax = el.align === 'center' ? el.x * W + bw / 2 : el.align === 'right' ? el.x * W + bw : el.x * W;
    lines.forEach((ln, i) => x.fillText(ln, ax, el.y * H + i * lh + lh / 2));
  }
  return lines.length * lh;
}

/* Product caption (name + description) under the picture. Returns height used. */
export function drawCaption(x, el, prod, cx, top, W, draw = true) {
  let y = top, h = 0;
  const tw = Math.max(el.w * W * 1.3, W * .15);
  const block = (s, size, wt, col, maxLines) => {
    if (!s) return;
    const px = pt(size, W), lh = px * 1.15;
    x.font = `${wt} ${px}px ${FONTS.sans.css}`;
    let lines = wrapLines(x, s, tw);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
    if (draw) { x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; lines.forEach((ln, i) => x.fillText(ln, cx, y + i * lh + lh / 2)); }
    y += lines.length * lh; h += lines.length * lh;
  };
  y += W * .006; h += W * .006;
  if (el.showName) block(prod.text.name, el.nameSize, 600, TEXT_INK, 2);
  if (el.showDesc) block(prod.text.description, el.descSize, 400, TEXT_MUTED, 3);
  return h;
}

/* Flattens one page. This is the only place elements are merged into one image. */
export async function exportPage(p, page, W) {
  const H = Math.round(W * A4_RATIO), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  drawBackground(x, W, H, p, await letterpadImages(p));
  const cache = new Map();
  for (const el of page.elements) {
    if (el.type === 'text') { drawText(x, el, W, H); continue; }
    if (el.type === 'image') {
      const im = await opt(el.assetId); if (!im) continue;
      const w = el.w * W; x.drawImage(im, el.x * W, el.y * H, w, w * im.naturalHeight / im.naturalWidth); continue;
    }
    const prod = p.products.find(q => q.id === el.productId); if (!prod) continue;
    if (!cache.has(prod.id)) cache.set(prod.id, prod.packagingId ? await renderProduct(p, prod) : null);
    const r = cache.get(prod.id);
    if (!r && p.letterpad.hideEmpty) continue;
    const iw = el.w * W, ih = iw * (r ? r.height / r.width : EMPTY_AR), left = el.x * W, top = el.y * H;
    if (r) x.drawImage(r, left, top, iw, ih);
    else {
      x.save(); x.setLineDash([W * .006, W * .004]); x.strokeStyle = '#b9bfc7'; x.lineWidth = W * .0015;
      x.stroke(rrPath(left, top, iw, ih, iw * .08)); x.restore();
      x.fillStyle = resolveColor(p, prod); x.beginPath(); x.arc(left + iw / 2, top + ih / 2, iw * .13, 0, Math.PI * 2); x.fill();
    }
    drawCaption(x, el, prod, left + iw / 2, top + ih, W);
  }
  return c;
}

/* Make sure every font used on a page is loaded before drawing it to canvas. */
export async function loadPageFonts(pages) {
  const want = new Set(['600 20px "Schibsted Grotesk"', '400 20px "Schibsted Grotesk"']);
  pages.forEach(pg => pg.elements.forEach(e => {
    if (e.type !== 'text') return;
    FONTS[e.font].css.split(',').slice(0, 2).forEach(f => want.add(`${e.italic ? 'italic ' : ''}${e.bold ? 700 : 400} 20px ${f.trim()}`));
  }));
  try { await Promise.race([Promise.all([...want].map(f => document.fonts.load(f, 'Aaઅક્ષ'))), new Promise(r => setTimeout(r, 4000))]); } catch (e) { /* fall back to system fonts */ }
}

/* Quality notes for an uploaded letterpad, shown to the user before they rely on it for print. */
export function templateWarnings(t) {
  const out = [];
  if (!t.w || !t.h) return out;
  const ratio = t.h / t.w;
  if (Math.abs(ratio - A4_RATIO) / A4_RATIO > .03) out.push(`This image is not A4 shaped (ratio ${ratio.toFixed(2)}, A4 is 1.41). It will be stretched to fit.`);
  const dpi = Math.round(t.w / 8.27);
  if (dpi < 300) out.push(`About ${dpi} dpi on A4. Fine for screen and WhatsApp; for printing ask the designer for at least 2480 × 3508 px or the original PDF.`);
  return out;
}
