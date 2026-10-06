/* Theme engine: reference image → base hue → 10 colour tokens.
   Products point at a token index, never at a fixed colour. A hand edit to a token is
   stored as an offset from the generated colour, so it survives a new reference image. */
import { clamp } from './util.js';
import { hexToHsl, hslToHex, hdiff, hueName, rgbToHsl } from './color.js';

/* [name, hue shift, saturation multiplier, lightness ('b' = base, 'b-' = base - 5%)] */
export const ROLES = [
  ['Light', 0, .75, .86], ['Soft', 0, .85, .74], ['Core', 0, 1, 'b'], ['Warm', -12, .95, 'b-'], ['Vivid', 0, 1.15, .5],
  ['Dusty', 0, .42, .6], ['Cool', 12, .9, .56], ['Deep', 0, 1, .36], ['Dark', 5, .85, .25], ['Earthy', -25, .45, .33],
];

export function genPalette(h, s, l) {
  s = clamp(s, .35, .9);
  const bl = clamp(l, .42, .62);
  return ROLES.map(([name, dh, sm, L]) => {
    const ll = L === 'b' ? bl : L === 'b-' ? bl - .05 : L;
    return { name, gen: hslToHex(h + dh, clamp(s * sm, .08, .95), ll) };
  });
}

export function tokenHex(t) {
  if (!t.offset) return t.gen;
  const [h, s, l] = hexToHsl(t.gen);
  return hslToHex(h + t.offset.h, s + t.offset.s, l + t.offset.l);
}

/* Regenerates the palette from a base colour. Hand edits (offsets) are kept per token. */
export function setTheme(p, { h, s, l, imageId = null, label = '' }) {
  const old = (p.theme && p.theme.palette) || [];
  const palette = genPalette(h, s, l).map((t, i) => {
    const tok = { ...t, offset: old[i] && old[i].offset ? { ...old[i].offset } : null };
    tok.hex = tokenHex(tok);
    return tok;
  });
  p.theme = { base: { h, s, l }, imageId, label: label || hueName(h, s, l), palette };
}

export function editToken(p, i, hex) {
  const t = p.theme.palette[i];
  const [gh, gs, gl] = hexToHsl(t.gen), [h, s, l] = hexToHsl(hex);
  t.offset = { h: hdiff(h, gh), s: s - gs, l: l - gl };
  t.hex = tokenHex(t);
}
export function resetToken(p, i) {
  const t = p.theme.palette[i];
  t.offset = null;
  t.hex = t.gen;
}

export function resolveColor(p, prod) {
  const t = p.theme.palette[prod.colorIndex] || p.theme.palette[0];
  const [h, s, l] = hexToHsl(t.hex);
  const a = prod.adjust;
  return hslToHex(h + a.h, s + a.s / 100, l + a.l / 100);
}

/* Dominant saturated hue of an image (browser only). */
export function extractBase(img) {
  const n = 80, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data;
  const bins = Array.from({ length: 36 }, () => ({ w: 0, sx: 0, sy: 0, s: [], l: [] }));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (s < .2 || l < .12 || l > .92) continue;
    const b = bins[Math.floor(h / 10) % 36], w = s * (1 - Math.abs(l - .5));
    b.w += w; b.sx += Math.cos(h * Math.PI / 180) * w; b.sy += Math.sin(h * Math.PI / 180) * w; b.s.push(s); b.l.push(l);
  }
  let best = -1, bw = 0;
  for (let i = 0; i < 36; i++) {
    const w = bins[i].w + .5 * (bins[(i + 35) % 36].w + bins[(i + 1) % 36].w);
    if (w > bw) { bw = w; best = i; }
  }
  if (best < 0) return { h: 0, s: .1, l: .5, neutral: true };
  let sx = 0, sy = 0; const S = [], L = [];
  [bins[(best + 35) % 36], bins[best], bins[(best + 1) % 36]].forEach(b => { sx += b.sx; sy += b.sy; S.push(...b.s); L.push(...b.l); });
  const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  let h = Math.atan2(sy, sx) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { h, s: med(S), l: med(L) };
}
