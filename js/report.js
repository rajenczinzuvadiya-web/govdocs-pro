// ભૂલની આપોઆપ નોંધ (યુઝર 19/11/26): એપમાં ભૂલ આવે તો KruPa Digital Hub ના એડમિન → "🐞 આપોઆપ નોંધાયેલી ભૂલો" માં જાય.
// ફક્ત ભૂલનું લખાણ, કોડની જગ્યા, પેજ (#/...), એપ વર્ઝન અને ફોને પોતે બનાવેલો 8 અક્ષરનો નંબર. નામ, મોબાઇલ નંબર,
// પ્રોફાઇલ કે શોધેલું લખાણ ક્યારેય નહીં. એક પેજ ખોલવા દીઠ વધુમાં વધુ 3, એક જ ભૂલ એક વાર. સર્વર પણ દિવસની મર્યાદા રાખે છે.
import { APP } from './config.js';

const URL_ = APP.krupa.digitalHub + '/api/jankar/error';
const MAX = 3;
// આ જ સરનામું Digital Hub ના src/lib/jankarError.ts (JANKAR_ORIGIN) માં છે: બદલો તો બંનેમાં.
const LIVE = 'https://jankar.krupadigitalhub.in';
const sent = new Set();

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /AbortError|The user aborted a request/i,
  /Failed to fetch|NetworkError|Load failed|network error/i, // નેટ નથી: એપની ભૂલ નથી
];

export const isNoise = (message, stack = '') => NOISE.some((re) => re.test(message) || re.test(stack));

function phoneId() {
  try {
    let id = localStorage.getItem('jankar-err-id');
    if (!/^[0-9a-f]{8}$/.test(id || '')) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('jankar-err-id', id);
    }
    return id;
  } catch {
    return '00000000';
  }
}

export function reportError(error, source) {
  try {
    if (location.origin !== LIVE) return; // ફક્ત લાઇવ એપમાંથી (ટેસ્ટ કે કમ્પ્યુટર પરની નકલમાંથી નહીં)
    if (!navigator.onLine) return;
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error && error.message || error));
    const message = String(err.message || '').slice(0, 300);
    const stack = String(err.stack || '').slice(0, 2000);
    if (!message || isNoise(message, stack) || sent.has(message) || sent.size >= MAX) return;
    sent.add(message);
    fetch(URL_, {
      method: 'POST',
      // text/plain: બ્રાઉઝરને પહેલાં પરવાનગી પૂછવી ન પડે
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ message, stack, source, page: location.hash.split('?')[0] || '/', version: APP.version, id: phoneId() }),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    // નોંધ મોકલવામાં જ ભૂલ: કંઈ ન કરવું
  }
}

window.addEventListener('error', (e) => reportError(e.error || e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
