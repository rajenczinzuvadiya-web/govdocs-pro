/* Colour maths (HSL based, non-destructive). Pure functions, safe to run in Node tests. */
import { clamp } from './util.js';

export function hexToRgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (!s) { const v = l * 255; return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const hexToHsl = h => rgbToHsl(...hexToRgb(h));
export const hslToHex = (h, s, l) => rgbToHex(...hslToRgb(h, clamp(s), clamp(l)));
/* Signed shortest distance between two hues, in degrees (-180..180). */
export const hdiff = (a, b) => ((a - b) % 360 + 540) % 360 - 180;

export function lum(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * r + .7152 * g + .0722 * b;
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/* White or near-black text, whichever reads better on the given colour. */
export function onColor(hex) {
  return contrast(hex, '#ffffff') >= contrast(hex, '#1f2328') ? '#ffffff' : '#1f2328';
}
export function hueName(h, s, l) {
  if (s < .12) return l > .8 ? 'White' : l < .2 ? 'Black' : 'Grey';
  const n = [[12, 'Red'], [40, 'Orange'], [62, 'Yellow'], [85, 'Lime'], [160, 'Green'], [200, 'Teal'], [255, 'Blue'], [290, 'Purple'], [345, 'Pink'], [361, 'Red']];
  for (const [m, nm] of n) if (h < m) return nm;
  return 'Red';
}
