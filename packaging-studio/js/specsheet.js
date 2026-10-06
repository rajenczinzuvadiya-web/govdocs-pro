/* Colour specification sheet: a PDF the company or printer can work from. It lists every
   theme token and every product's final colour as HEX, RGB and an approximate CMYK, with
   room for the printer's agreed code (Pantone or CMYK). Screen colours are not print
   colours, so the sheet says that on every page. */
import { hexToRgb } from './color.js';
import { resolveColor } from './theme.js';
import { getPkg, getLabel } from './model.js';
import { assetImage } from './store.js';
import { renderProduct } from './render.js';
import { wrapLines } from './letterpad.js';

/* Naive sRGB → CMYK. Only a starting point: the printer's profile decides the real values. */
export function approxCmyk(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255), k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(v => Math.round(v * 100));
}
export const fmtRgb = hex => 'RGB ' + hexToRgb(hex).join(', ');
export const fmtCmyk = hex => { const [c, m, y, k] = approxCmyk(hex); return `CMYK ≈ ${c} / ${m} / ${y} / ${k}`; };

const FONT = '"Schibsted Grotesk", "Noto Sans Gujarati", system-ui, sans-serif';
const INK = '#1f2328', MUTED = '#5e6570', LINE = '#d6dae0';
const W = 1654, H = Math.round(W * Math.SQRT2), M = 110; // A4 at 200 dpi
const DISCLAIMER = 'Screen colours (sRGB). CMYK values are an approximate conversion. Approve against a printed proof or a physical Pantone swatch before production.';

function pageCanvas() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  return { c, x };
}
function text(x, s, px, y, size, { wt = 400, col = INK, max = W - M - px, lines = 1 } = {}) {
  x.font = `${wt} ${size}px ${FONT}`; x.fillStyle = col; x.textAlign = 'left'; x.textBaseline = 'top';
  let out = wrapLines(x, String(s ?? ''), max);
  if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] += '…'; }
  out.forEach((ln, i) => x.fillText(ln, px, y + i * size * 1.3));
  return y + out.length * size * 1.3;
}
function swatch(x, hex, px, y, w, h) {
  x.fillStyle = hex; x.fillRect(px, y, w, h);
  x.strokeStyle = LINE; x.lineWidth = 2; x.strokeRect(px, y, w, h);
}
function footer(x, n, total, project) {
  x.fillStyle = LINE; x.fillRect(M, H - 150, W - 2 * M, 2);
  const y = text(x, DISCLAIMER, M, H - 132, 22, { col: MUTED, lines: 2, max: W - 2 * M });
  x.textAlign = 'right'; x.font = `500 22px ${FONT}`; x.fillStyle = MUTED; x.fillText(`${project} · page ${n} of ${total}`, W - M, y + 8);
}
function fitImage(x, img, px, y, w, h) {
  const r = Math.min(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r;
  x.drawImage(img, px + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export async function buildSpecSheet(p) {
  const pages = [];
  /* ---- page 1: project and theme ---- */
  {
    const { c, x } = pageCanvas();
    let y = M;
    y = text(x, 'Colour specification', M, y, 64, { wt: 700 }) + 10;
    y = text(x, `${p.name} · ${p.company.name || ''}`, M, y, 30, { col: MUTED }) + 4;
    y = text(x, 'Prepared ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), M, y, 26, { col: MUTED }) + 40;
    let ref = null; try { ref = p.theme.imageId ? await assetImage(p.theme.imageId) : null; } catch (e) { /* no reference */ }
    if (ref) { x.save(); x.strokeStyle = LINE; x.lineWidth = 2; fitImage(x, ref, M, y, 260, 260); x.strokeRect(M, y, 260, 260); x.restore(); }
    const tx = ref ? M + 300 : M;
    text(x, 'Theme', tx, y, 34, { wt: 700 });
    text(x, `${p.theme.label} · base hue ${Math.round(p.theme.base.h)}°`, tx, y + 50, 28, { col: MUTED });
    const ty = text(x, 'Every product colour is one of these ten tokens, plus any small adjustment shown on its own row.', tx, y + 95, 26, { col: MUTED, lines: 3, max: W - M - tx });
    y = Math.max(ref ? y + 260 : 0, ty) + 50;
    const cols = 2, cw = (W - 2 * M - 40) / cols, rh = 130;
    p.theme.palette.forEach((t, i) => {
      const px = M + (i % cols) * (cw + 40), py = y + Math.floor(i / cols) * rh;
      swatch(x, t.hex, px, py, 100, 100);
      text(x, `${t.name}${t.offset ? ' (edited)' : ''}`, px + 125, py + 2, 28, { wt: 700, max: cw - 130 });
      text(x, `${t.hex.toUpperCase()} · ${fmtRgb(t.hex)}`, px + 125, py + 38, 23, { col: MUTED, max: cw - 130 });
      text(x, fmtCmyk(t.hex), px + 125, py + 68, 23, { col: MUTED, max: cw - 130 });
    });
    y += Math.ceil(p.theme.palette.length / cols) * rh + 30;
    const todo = p.products.filter(q => !q.packagingId).map(q => q.typeLabel);
    if (todo.length) {
      y = text(x, 'No packaging yet (not on the following pages)', M, y, 30, { wt: 700 }) + 6;
      text(x, todo.join(', '), M, y, 26, { col: MUTED, lines: 4, max: W - 2 * M });
    }
    pages.push({ c, x });
  }
  /* ---- product pages: four rows each; only products that have packaging ---- */
  const list = p.products.filter(q => q.packagingId).length ? p.products.filter(q => q.packagingId) : p.products;
  const per = 4, rowH = (H - M - 200 - 120) / per;
  for (let i = 0; i < list.length; i += per) {
    const { c, x } = pageCanvas();
    text(x, 'Products', M, M - 20, 40, { wt: 700 });
    for (let j = 0; j < per && i + j < list.length; j++) {
      const prod = list[i + j], top = M + 60 + j * rowH, color = resolveColor(p, prod);
      const pkg = getPkg(p, prod.packagingId), lab = getLabel(p, prod.labelId), tok = p.theme.palette[prod.colorIndex];
      if (j) { x.fillStyle = LINE; x.fillRect(M, top - 10, W - 2 * M, 2); }
      const box = rowH - 50;
      let img = null; if (pkg) { try { img = await renderProduct(p, prod); } catch (e) { img = null; } }
      if (img) fitImage(x, img, M, top + 10, 300, box);
      else {
        x.save(); x.setLineDash([12, 8]); x.strokeStyle = LINE; x.lineWidth = 2; x.strokeRect(M + 40, top + 30, 220, box - 40); x.restore();
        x.font = `400 24px ${FONT}`; x.fillStyle = MUTED; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('No packaging', M + 150, top + 10 + box / 2);
      }
      const sx = M + 340;
      swatch(x, color, sx, top + 14, 150, 150);
      const tx = sx + 180, mx = W - M - tx;
      let y = text(x, `${prod.text.name || prod.typeLabel}`, tx, top + 10, 36, { wt: 700, max: mx });
      y = text(x, `${prod.typeLabel}${pkg ? ` · ${pkg.name} · ${pkg.kind}` : ''}${pkg && pkg.source === 'placeholder' ? ' (placeholder outline)' : ''}`, tx, y + 2, 24, { col: MUTED, max: mx }) + 10;
      y = text(x, `${color.toUpperCase()} · ${fmtRgb(color)} · ${fmtCmyk(color)}`, tx, y, 26, { wt: 600, max: mx }) + 2;
      const a = prod.adjust, adj = a.h || a.s || a.l ? ` + adjustment (hue ${a.h}°, saturation ${a.s}, lightness ${a.l})` : '';
      y = text(x, `Token: ${tok.name}${adj}`, tx, y, 23, { col: MUTED, max: mx, lines: 2 });
      if (pkg && pkg.recolor.enabled) y = text(x, `Photo colour ${pkg.recolor.source.toUpperCase()} replaced with ${color.toUpperCase()}; whites, greys and blacks kept.`, tx, y, 23, { col: MUTED, max: mx, lines: 2 });
      if (lab) y = text(x, `Label: ${lab.name}`, tx, y, 23, { col: MUTED, max: mx });
      const sp = pkg && pkg.spec, dims = sp && sp.w && sp.h ? `${sp.w} × ${sp.h}${sp.d ? ' × ' + sp.d : ''} mm` : '';
      if (dims || prod.text.quantity) y = text(x, [dims && 'Size ' + dims, prod.text.quantity && 'Contents ' + prod.text.quantity].filter(Boolean).join(' · '), tx, y, 23, { col: MUTED, max: mx });
      y += 12;
      x.font = `700 26px ${FONT}`; x.fillStyle = INK; x.textBaseline = 'top'; x.textAlign = 'left';
      const lbl = 'Printer colour code: ';
      x.fillText(lbl, tx, y);
      const lw = x.measureText(lbl).width;
      if (prod.printColor) text(x, prod.printColor, tx + lw, y, 26, { max: mx - lw });
      else { x.fillStyle = INK; x.fillRect(tx + lw, y + 30, Math.min(420, mx - lw), 2); }
    }
    pages.push({ c, x });
  }
  pages.forEach((pg, i) => footer(pg.x, i + 1, pages.length, p.name));
  return pages.map(pg => pg.c);
}
