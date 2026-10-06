/* Render pipeline: packaging model → recolour → label/artwork. Nothing is baked in: every
   call rebuilds the product from its separate parts. */
import { clamp } from './util.js';
import { hexToHsl, hslToHex, hslToRgb, rgbToHsl, hdiff, onColor } from './color.js';
import { resolveColor } from './theme.js';
import { getPkg, getLabel } from './model.js';
import { assetImage } from './store.js';

export const SERIF = '"DM Serif Display", Georgia, serif', SANS = '"Schibsted Grotesk", system-ui, sans-serif';

/* ---------- placeholder packaging outlines (clearly marked, replaceable) ---------- */
function cyl(x, x0, x1, h, s, l) {
  const g = x.createLinearGradient(x0, 0, x1, 0);
  [[0, -.17], [.16, 0], [.33, .13], [.56, .02], [.86, -.1], [1, -.18]].forEach(([o, d]) => g.addColorStop(o, `hsl(${h},${s * 100}%,${clamp(l + d) * 100}%)`));
  return g;
}
function shine(x, path, x0, y0, w, h) {
  x.save(); x.clip(path);
  const g = x.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(x0, y0, w, h); x.restore();
}
export function rrPath(x0, y0, w, h, r) {
  const p = new Path2D();
  if (p.roundRect) p.roundRect(x0, y0, w, h, r);
  else { r = Math.min(r, w / 2, h / 2); p.moveTo(x0 + r, y0); p.arcTo(x0 + w, y0, x0 + w, y0 + h, r); p.arcTo(x0 + w, y0 + h, x0, y0 + h, r); p.arcTo(x0, y0 + h, x0, y0, r); p.arcTo(x0, y0, x0 + w, y0, r); p.closePath(); }
  return p;
}
const DRAW = {
  bottleA(x) {
    const body = new Path2D();
    body.moveTo(170, 168); body.lineTo(230, 168); body.bezierCurveTo(232, 215, 305, 215, 305, 280); body.lineTo(305, 720); body.quadraticCurveTo(305, 775, 250, 775); body.lineTo(150, 775); body.quadraticCurveTo(95, 775, 95, 720); body.lineTo(95, 280); body.bezierCurveTo(95, 215, 168, 215, 170, 168); body.closePath();
    x.fillStyle = cyl(x, 95, 305, 187, .53, .38); x.fill(body); shine(x, body, 118, 190, 30, 570);
    const neck = rrPath(166, 128, 68, 46, 6); x.fillStyle = cyl(x, 166, 234, 215, .05, .78); x.fill(neck);
    const cap = rrPath(148, 40, 104, 96, 16); x.fillStyle = cyl(x, 148, 252, 215, .05, .86); x.fill(cap);
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(148, 118, 104, 4);
  },
  bottleB(x) {
    const body = rrPath(75, 330, 250, 445, 72); x.fillStyle = cyl(x, 75, 325, 187, .53, .38); x.fill(body); shine(x, body, 100, 340, 32, 420);
    const collar = rrPath(160, 282, 80, 58, 8); x.fillStyle = cyl(x, 160, 240, 215, .05, .8); x.fill(collar);
    x.fillStyle = 'rgba(0,0,0,.07)'; for (let y = 292; y < 336; y += 9) x.fillRect(160, y, 80, 2);
    x.fillStyle = cyl(x, 191, 209, 215, .04, .84); x.fillRect(191, 150, 18, 134);
    const head = rrPath(160, 112, 82, 46, 10); x.fillStyle = cyl(x, 160, 242, 215, .05, .86); x.fill(head);
    const noz = rrPath(236, 120, 72, 20, 6); x.fillStyle = cyl(x, 236, 308, 215, .05, .82); x.fill(noz); x.fillRect(296, 132, 12, 22);
  },
};

/* ---------- recolour engine ----------
   Moves only pixels whose hue is near the source colour. Greys/whites/blacks below the
   neutral threshold are never touched; lightness is remapped (not flattened) so highlights,
   shadows and transparency survive. */
export function recolor(src, rc, target) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0);
  if (!rc.enabled) return c;
  const im = x.getImageData(0, 0, c.width, c.height), p = im.data;
  const [sh, ss, sl] = hexToHsl(rc.source), [th, ts, tl] = hexToHsl(target);
  const tol = rc.tol, nt = rc.neutral, sr = ts / Math.max(ss, .05);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const [h, s, l] = rgbToHsl(p[i], p[i + 1], p[i + 2]);
    if (s < nt) continue;
    const dh = hdiff(h, sh), ad = Math.abs(dh);
    let w = ad <= tol ? 1 : ad <= tol + 15 ? 1 - (ad - tol) / 15 : 0;
    if (!w) continue;
    w *= Math.min(1, (s - nt) / .08);
    const nl = tl >= sl ? 1 - (1 - l) * (1 - tl) / Math.max(1 - sl, .01) : l * tl / Math.max(sl, .01);
    const [r, g, b] = hslToRgb(th + dh * .5, clamp(s * sr), clamp(nl));
    p[i] += (r - p[i]) * w; p[i + 1] += (g - p[i + 1]) * w; p[i + 2] += (b - p[i + 2]) * w;
  }
  x.putImageData(im, 0, 0);
  return c;
}

/* ---------- text helpers ---------- */
export function fitFont(x, s, max, size, fam, wt) {
  x.font = `${wt} ${size}px ${fam}`;
  while (size > 6 && x.measureText(s).width > max) { size *= .92; x.font = `${wt} ${size}px ${fam}`; }
  return size;
}
export function line(x, s, cx, y, size, fam, wt, col, max) {
  if (!s) return y;
  fitFont(x, s, max, size, fam, wt);
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText(s, cx, y);
  return y;
}
export function wrap(x, s, cx, y, max, size, fam, wt, col, maxLines) {
  if (!s) return y;
  x.font = `${wt} ${size}px ${fam}`; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const words = String(s).split(/\s+/);
  let lines = [], cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (x.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
  lines.forEach((ln, i) => { fitFont(x, ln, max, size, fam, wt); x.fillText(ln, cx, y + i * size * 1.12); });
  return y + (lines.length - 1) * size * 1.12;
}

/* ---------- label / artwork layer ---------- */
function barcodeArea(x, bx, by, bw, bh, u) {
  x.fillStyle = '#fff'; x.fillRect(bx, by, bw, bh); x.fillStyle = '#1f2328';
  let px = bx + bw * .08, k = 0;
  const end = bx + bw * .92;
  while (px < end) { const w = u * (.35 + ((k * 7) % 5) * .18); x.fillRect(px, by + bh * .12, w, bh * .58); px += w + u * (.4 + ((k * 3) % 4) * .15); k++; }
  x.font = `500 ${u * 2.6}px ${SANS}`; x.textAlign = 'center'; x.fillText('barcode area', bx + bw / 2, by + bh * .92);
}
function footerRow(x, L, u, t, col) {
  const y = L.y + L.h - u * 5;
  x.textAlign = 'left'; x.fillStyle = col;
  x.font = `700 ${u * 6}px ${SANS}`; x.fillText(t.quantity || 'Qty ___', L.x + u * 6, y - u * 6);
  x.font = `500 ${u * 4}px ${SANS}`; x.fillText('MRP ₹ ' + (t.mrp || '___'), L.x + u * 6, y);
  barcodeArea(x, L.x + L.w - u * 40, y - u * 15, u * 34, u * 17, u);
}
async function optImage(id) { try { return id ? await assetImage(id) : null; } catch (e) { return null; } }

export async function drawLabel(x, p, prod, pkg, lab, color, c) {
  const a = pkg.labelArea, L = { x: a.x * c.width, y: a.y * c.height, w: a.w * c.width, h: a.h * c.height }, t = prod.text, u = L.w / 100, cx = L.x + L.w / 2;
  if (lab.layout === 'none') return;
  if (lab.kind === 'image') {
    const i = await optImage(lab.assetId);
    if (i) { const r = Math.min(L.w / i.naturalWidth, L.h / i.naturalHeight), w = i.naturalWidth * r, h = i.naturalHeight * r; x.drawImage(i, cx - w / 2, L.y + (L.h - h) / 2, w, h); }
    /* Text stays editable even on uploaded artwork: drawn on light plates so it reads on any art. */
    if (lab.showName && t.name) {
      const ph = u * 22;
      x.save(); x.globalAlpha = .88; x.fillStyle = '#ffffff'; x.fill(rrPath(L.x + u * 4, L.y + u * 4, L.w - u * 8, ph, u * 3)); x.restore();
      wrap(x, t.name, cx, L.y + u * 4 + ph * .5, L.w * .84, u * 12, SERIF, 400, '#1f2328', 1);
      if (t.subtitle) line(x, t.subtitle, cx, L.y + u * 4 + ph * .85, u * 5, SANS, 500, '#1f2328', L.w * .8);
    }
    if (lab.showFooter) {
      x.save(); x.globalAlpha = .88; x.fillStyle = '#ffffff'; x.fill(rrPath(L.x + u * 2, L.y + L.h - u * 27, L.w - u * 4, u * 25, u * 3)); x.restore();
      footerRow(x, L, u, t, '#1f2328');
    }
    return;
  }
  const [ch, cs, cl] = hexToHsl(color);
  const logo = await optImage(p.company.logoId);
  const drawTop = async (y, col) => {
    if (logo) { const lh = u * 11, lw = Math.min(L.w * .5, logo.naturalWidth / logo.naturalHeight * lh); x.drawImage(logo, cx - lw / 2, y, lw, lh); return y + lh + u * 4; }
    line(x, p.company.name, cx, y + u * 6, u * 5.5, SANS, 600, col, L.w * .84);
    return y + u * 10;
  };
  if (lab.layout === 'classic') {
    x.save(); x.fillStyle = hslToHex(ch, cs * .45, .965); x.globalAlpha = .95; x.fill(rrPath(L.x, L.y, L.w, L.h, u * 5)); x.restore();
    x.lineWidth = u * .6; x.strokeStyle = hslToHex(ch, cs, clamp(cl * .75, .18, .45)); x.stroke(rrPath(L.x, L.y, L.w, L.h, u * 5));
    const ink = hslToHex(ch, cs * .7, .17), acc = hslToHex(ch, cs, clamp(cl, .28, .46));
    let y = await drawTop(L.y + u * 6, ink);
    y = wrap(x, t.name, cx, y + u * 15, L.w * .84, u * 16, SERIF, 400, acc, 2);
    y = wrap(x, t.subtitle, cx, y + u * 9, L.w * .82, u * 6, SANS, 500, ink, 2);
    x.fillStyle = acc; x.fillRect(cx - L.w * .12, y + u * 5, L.w * .24, u * .8);
    wrap(x, t.ingredients, cx, y + u * 12, L.w * .8, u * 4, SANS, 400, ink, 3);
    footerRow(x, L, u, t, ink);
    return;
  }
  if (lab.layout === 'band') {
    const oc = onColor(color);
    await drawTop(L.y + u * 2, oc);
    const by = L.y + L.h * .24, bh = L.h * .42, dark = hslToHex(ch, cs, clamp(cl * .55, .13, .3));
    x.fillStyle = dark; x.fillRect(L.x - u * 3, by, L.w + u * 6, bh);
    const bo = onColor(dark);
    const yy = wrap(x, t.name, cx, by + bh * .42, L.w * .86, u * 16, SERIF, 400, bo, 2);
    wrap(x, t.subtitle, cx, yy + u * 9, L.w * .82, u * 6, SANS, 500, bo, 2);
    wrap(x, t.ingredients, cx, by + bh + u * 8, L.w * .82, u * 4, SANS, 400, oc, 2);
    footerRow(x, L, u, t, oc);
    return;
  }
  const oc = onColor(color);
  let y = await drawTop(L.y + u * 2, oc);
  y = wrap(x, t.name, cx, y + u * 20, L.w * .9, u * 19, SERIF, 400, oc, 2);
  y = wrap(x, t.subtitle, cx, y + u * 10, L.w * .84, u * 6, SANS, 500, oc, 2);
  x.fillStyle = oc; x.fillRect(cx - u * 6, y + u * 6, u * 12, u * .7);
  wrap(x, t.ingredients, cx, y + u * 14, L.w * .8, u * 4, SANS, 400, oc, 3);
  footerRow(x, L, u, t, oc);
}

/* ---------- pipeline ---------- */
const baseCache = new Map(), rcCache = new Map();
export async function baseCanvas(pkg) {
  const key = pkg.builtin ? 'builtin:' + pkg.builtin : pkg.assetId;
  if (!key) return null;
  if (baseCache.has(key)) return baseCache.get(key);
  const c = document.createElement('canvas');
  if (pkg.builtin) { c.width = 400; c.height = 800; DRAW[pkg.builtin](c.getContext('2d')); }
  else {
    const i = await optImage(pkg.assetId);
    if (!i) return null;
    c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0);
  }
  baseCache.set(key, c);
  return c;
}
export async function renderProduct(p, prod, { original = false, label = true } = {}) {
  const pkg = getPkg(p, prod.packagingId);
  if (!pkg) return null;
  const base = await baseCanvas(pkg);
  if (!base) return null;
  const color = resolveColor(p, prod);
  let body = base;
  if (!original) {
    const k = JSON.stringify([pkg.builtin || pkg.assetId, pkg.recolor, color]);
    body = rcCache.get(k);
    if (!body) { body = recolor(base, pkg.recolor, color); if (rcCache.size > 60) rcCache.clear(); rcCache.set(k, body); }
  }
  const out = document.createElement('canvas');
  out.width = base.width; out.height = base.height;
  const x = out.getContext('2d');
  x.drawImage(body, 0, 0);
  if (!original && label) { const lab = getLabel(p, prod.labelId); if (lab) await drawLabel(x, p, prod, pkg, lab, color, out); }
  return out;
}
