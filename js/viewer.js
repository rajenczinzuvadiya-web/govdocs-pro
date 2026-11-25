// ફોટો મોટો જુઓ (યુઝર 25/11/26: કમ્પ્યુટરમાં ફોટાનું લખાણ વંચાતું નથી, ઝૂમ કરી જોવું છે).
// આખી સ્ક્રીન પર ફોટો: + / − બટન, માઉસનું વ્હીલ, બે વાર ક્લિક / ટેપ, બે આંગળીથી પિંચ, પકડીને ખસેડો. Esc / ✕ થી બંધ.
import { icon } from './icons.js';

const MIN = 1;
const MAX = 6;
let box = null;
let lastFocus = null;

export function openViewer(src, alt = '') {
  closeViewer();
  lastFocus = document.activeElement;
  box = document.createElement('div');
  box.className = 'viewer';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'ફોટો મોટો');
  box.innerHTML = `
    <div class="vw-bar">
      <button type="button" data-vz="-1" aria-label="નાનું">${icon('zoomout')}</button>
      <span class="vw-pct" aria-live="polite">100%</span>
      <button type="button" data-vz="1" aria-label="મોટું">${icon('zoomin')}</button>
      <button type="button" data-vz="0" class="vw-fit">આખો</button>
      <button type="button" data-vclose aria-label="બંધ કરો">${icon('close')}</button>
    </div>
    <div class="vw-stage"><img alt="" draggable="false"></div>`;
  const img = box.querySelector('img');
  img.src = src;
  img.alt = alt;
  document.body.appendChild(box);
  document.body.classList.add('vw-open');
  const stage = box.querySelector('.vw-stage');
  const pct = box.querySelector('.vw-pct');
  let s = 1;
  let x = 0;
  let y = 0;

  const clamp = () => {
    const r = img.getBoundingClientRect();
    const w = r.width / s;
    const h = r.height / s;
    const mx = Math.max(0, (w * s - stage.clientWidth) / 2);
    const my = Math.max(0, (h * s - stage.clientHeight) / 2);
    x = Math.min(mx, Math.max(-mx, x));
    y = Math.min(my, Math.max(-my, y));
  };
  const apply = () => {
    if (s <= MIN) (s = MIN), (x = 0), (y = 0);
    img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    clamp();
    img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    pct.textContent = `${Math.round(s * 100)}%`;
    stage.classList.toggle('zoomed', s > MIN);
  };
  // (cx, cy) = સ્ક્રીન પરનું બિંદુ, ત્યાં જ ઝૂમ થાય
  const zoomTo = (ns, cx, cy) => {
    ns = Math.min(MAX, Math.max(MIN, ns));
    const r = stage.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2);
    const py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
    x = px - ((px - x) * ns) / s;
    y = py - ((py - y) * ns) / s;
    s = ns;
    apply();
  };

  box.addEventListener('click', (e) => {
    const z = e.target.closest('[data-vz]');
    if (z) {
      const d = Number(z.dataset.vz);
      if (d === 0) (s = 1), apply();
      else zoomTo(s * (d > 0 ? 1.5 : 1 / 1.5));
      return;
    }
    if (e.target.closest('[data-vclose]') || (e.target === stage && s === MIN)) closeViewer();
  });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomTo(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener('dblclick', (e) => zoomTo(s > MIN ? MIN : 2.5, e.clientX, e.clientY));

  // પકડીને ખસેડો (એક આંગળી / માઉસ), બે આંગળીથી પિંચ
  const pts = new Map();
  let pinch = null;
  let lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s };
    }
    if (e.pointerType === 'touch' && pts.size === 1) {
      const now = Date.now();
      if (now - lastTap < 300) zoomTo(s > MIN ? MIN : 2.5, e.clientX, e.clientY);
      lastTap = now;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const nx = e.clientX;
    const ny = e.clientY;
    if (pts.size === 2 && pinch) {
      pts.set(e.pointerId, { x: nx, y: ny });
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo((pinch.s * d) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (s > MIN) {
      x += nx - p.x;
      y += ny - p.y;
      apply();
    }
    pts.set(e.pointerId, { x: nx, y: ny });
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  box.querySelector('[data-vclose]').focus();
}

export function closeViewer() {
  if (!box) return false;
  box.remove();
  box = null;
  document.body.classList.remove('vw-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  return true;
}

document.addEventListener('keydown', (e) => {
  if (!box) return;
  if (e.key === 'Escape') {
    e.stopImmediatePropagation();
    closeViewer();
  } else if (e.key === '+' || e.key === '=') box.querySelector('[data-vz="1"]').click();
  else if (e.key === '-') box.querySelector('[data-vz="-1"]').click();
}, true);
