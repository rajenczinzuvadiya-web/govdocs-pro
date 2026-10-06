/* A4 letterpad: either a built-in header drawn from the company profile, or the company's own
   letterpad uploaded as a template. Products are placed inside the template's product area
   (stored relative to that area), so swapping the letterpad keeps the arrangement. */
import { onColor } from './color.js';
import { resolveColor } from './theme.js';
import { activeArea, getTemplate, A4_RATIO } from './model.js';
import { assetImage } from './store.js';
import { renderProduct, fitFont, wrap, rrPath, SERIF, SANS } from './render.js';

export const TEXT_INK = '#1f2328', TEXT_MUTED = '#5e6570';

/* Page-space rectangle (pixels) for a product, given its image aspect ratio (h / w). */
export function itemGeom(p, it, W, H, ar) {
  const A = activeArea(p);
  const iw = it.placement.w * A.w * W, ih = iw * ar;
  return { cx: (A.x + it.placement.x * A.w) * W, cy: (A.y + it.placement.y * A.h) * H, iw, ih };
}
export const nameWidth = (iw, W) => Math.max(iw * 1.3, W * .15);

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

/* Flattens the page. This is the only place products are merged into one image. */
export async function exportLetterpad(p, W) {
  const H = Math.round(W * A4_RATIO), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  drawBackground(x, W, H, p, await letterpadImages(p));
  for (const it of p.products) {
    let r = null;
    if (it.packagingId) r = await renderProduct(p, it);
    if (!r && p.letterpad.hideEmpty) continue;
    const g = itemGeom(p, it, W, H, r ? r.height / r.width : 1.25);
    if (r) x.drawImage(r, g.cx - g.iw / 2, g.cy - g.ih / 2, g.iw, g.ih);
    else {
      x.save(); x.setLineDash([W * .006, W * .004]); x.strokeStyle = '#b9bfc7'; x.lineWidth = W * .0015;
      x.stroke(rrPath(g.cx - g.iw / 2, g.cy - g.ih / 2, g.iw, g.ih, g.iw * .08)); x.restore();
      x.fillStyle = resolveColor(p, it); x.beginPath(); x.arc(g.cx, g.cy, g.iw * .13, 0, Math.PI * 2); x.fill();
    }
    const tw = nameWidth(g.iw, W), ty = g.cy + g.ih / 2 + W * .008 + W * .017;
    x.textAlign = 'center'; fitFont(x, it.text.name, tw, W * .017, SANS, 600); x.fillStyle = TEXT_INK; x.fillText(it.text.name, g.cx, ty);
    wrap(x, it.text.description, g.cx, ty + W * .016, tw, W * .012, SANS, 400, TEXT_MUTED, 2);
  }
  return c;
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
