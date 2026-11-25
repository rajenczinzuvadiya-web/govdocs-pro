// વપરાશની ગણતરી (Google Analytics 4) — config.js માં analytics.ga ભર્યું હોય અને લાઇવ સાઇટ હોય તો જ.
// ફક્ત પેજનું નામ જાય (#/all, #/scheme/<id>…); ?q= જેવું શોધેલું લખાણ, પ્રોફાઇલ કે જવાબ ક્યારેય નહીં.
// જાહેરાતની Google સુવિધાઓ (Google signals, ad personalization) બંધ.
import { APP } from './config.js';

const ID = (APP.analytics && APP.analytics.ga) || '';
const LIVE = location.hostname === 'jankar.krupadigitalhub.in';
const on = /^G-[A-Z0-9]{4,20}$/.test(ID) && LIVE;

if (on) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
  document.head.appendChild(s);
}

let last = '';
/** દરેક પેજ બદલાય ત્યારે (app.js render) */
export function trackPage(title) {
  if (!on) return;
  // એપ: /#/<પેજ> ; અલગ પેજ (yojana/<id>/…): એનો પોતાનો રસ્તો
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  const app = location.pathname === '/' || location.pathname === '/index.html';
  const path = app ? `/#/${hash || 'home'}` : location.pathname;
  if (path === last) return;
  last = path;
  window.gtag('event', 'page_view', { page_title: title, page_location: location.origin + path, page_path: path });
}

/** ખાસ કામ: વોટ્સએપ પર મોકલ્યું, ફોન કર્યો… (કાર્ડનું id જ, બીજું કંઈ નહીં) */
export function trackEvent(name, params = {}) {
  if (on) window.gtag('event', name, params);
}
