// વોટ્સએપ ક્યાંથી ખોલવું (યુઝર 25/11/26: "મારા ફોનમાં ત્રણ વોટ્સએપ છે, શેમાંથી મોકલવું?").
// Android: wa.me ને બદલે intent લિંક — ફોનમાં એક જ વોટ્સએપ હોય તો સીધું ખૂલે, બે-ત્રણ હોય (WhatsApp, Business,
// Dual / Clone) તો ફોન પૂછે "શેમાં ખોલવું?". પ્રોફાઇલમાં કાયમ માટે એક પસંદ કરી શકાય (ફક્ત આ ફોનમાં).
// iPhone / કમ્પ્યુટર: wa.me એમ જ. KruPa Digital Hub નું src/lib/whatsApp.ts જેવું જ.
// એપ (js/app.js) અને અલગ પેજ (yojana/…, scripts/build-pages.mjs) બંનેમાં વપરાય.

export const WA_KEY = 'gj:wa-app';
const PACKAGES = { whatsapp: 'com.whatsapp', business: 'com.whatsapp.w4b' };

export const isAndroid = () => /Android/i.test(navigator.userAgent || '');

export function readWaApp() {
  try {
    const v = localStorage.getItem(WA_KEY);
    return v === 'whatsapp' || v === 'business' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
export function saveWaApp(v) {
  try {
    if (v === 'whatsapp' || v === 'business') localStorage.setItem(WA_KEY, v);
    else localStorage.removeItem(WA_KEY);
  } catch {
    /* ફોનમાં જગ્યા નથી: આપોઆપ જ રહે */
  }
}

/** wa.me / api.whatsapp.com લિંકમાંથી નંબર અને લખાણ, બીજી લિંક હોય તો null */
export function parseWa(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const text = u.searchParams.get('text') || '';
  if (u.hostname === 'wa.me') {
    const phone = u.pathname.replace(/\//g, '');
    return /^\d*$/.test(phone) ? { phone, text } : null;
  }
  if (u.hostname === 'api.whatsapp.com' && u.pathname === '/send') return { phone: (u.searchParams.get('phone') || '').replace(/\D/g, ''), text };
  return null;
}

/** Android intent લિંક (app = auto | whatsapp | business). વોટ્સએપ ન હોય તો Chrome wa.me પર જાય. */
export function waIntent(href, app = 'auto') {
  const l = parseWa(href);
  if (!l) return null;
  const q = [l.phone && `phone=${l.phone}`, l.text && `text=${encodeURIComponent(l.text)}`].filter(Boolean).join('&');
  return `intent://send${q ? `?${q}` : ''}#Intent;scheme=whatsapp;${PACKAGES[app] ? `package=${PACKAGES[app]};` : ''}S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

// યુઝર 26/11/26: કમ્પ્યુટરના વોટ્સએપમાં (Windows) લિંકથી આવેલા સંદેશમાં ✅ 📄 💰 જેવાં ચિહ્ન "?" થઈ જાય.
// ફોનમાં બરાબર દેખાય, એટલે ફક્ત કમ્પ્યુટર પરથી મોકલતી વખતે સંદેશમાંથી ચિહ્ન કાઢી નાખવાં.
const isPhone = () => isAndroid() || /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
export const plainText = (t) =>
  String(t)
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/^\*[ \t]+/gm, '*');
export function desktopWaHref(href) {
  const l = parseWa(href);
  if (!l || !l.text || !/\p{Extended_Pictographic}/u.test(l.text)) return null;
  return `https://wa.me/${l.phone}?text=${encodeURIComponent(plainText(l.text))}`;
}

/** આખા પેજ પર: Android માં દરેક wa.me લિંક intent થી ખૂલે; કમ્પ્યુટર પર સંદેશમાંથી ચિહ્ન કાઢે. */
export function installWaPicker() {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || !parseWa(a.href)) return;
      if (!isPhone()) {
        const h = desktopWaHref(a.href);
        if (h) a.href = h;
        return;
      }
      if (!isAndroid()) return;
      const intent = waIntent(a.href, readWaApp());
      if (!intent) return;
      e.preventDefault();
      location.href = intent;
    },
    true
  );
}
