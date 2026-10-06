/* Small helpers shared by every module. No DOM access at import time. */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clone = o => JSON.parse(JSON.stringify(o));
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const uid = p => p + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* Only ever let a well-formed #rrggbb colour reach HTML or canvas. */
export function safeHex(v, fallback = '#888888') {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
}
export const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const str = (v, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
export const fileBase = name => str(name).replace(/\.[^.]+$/, '').slice(0, 40);
export const slug = s => str(s).replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'file';
