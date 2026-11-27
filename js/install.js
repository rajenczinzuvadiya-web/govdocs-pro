// "એપ ઇન્સ્ટોલ કરો" પટ્ટી (યુઝર 27/11/26: KruPa Digital Hub ના InstallBanner જેવી).
// વેબસાઇટ બ્રાઉઝરમાં ખૂલે ત્યારે નીચે પટ્ટી: જાણકાર આઇકન + એક લીટી + બટન + ✕ (7 દિવસ ન દેખાય).
// ફોનમાં ઇન્સ્ટોલ થયેલી એપમાં (Play Store / હોમ સ્ક્રીન) ક્યારેય નહીં.
//
// નિર્ણય (યુઝરે પૂછ્યું, 27/11/26): Play Store પર એપ લાઇવ થાય (config.js → playStore.live) એટલે
//   Android ફોન  → બટન સીધું Play Store ખોલે (અપડેટ આપોઆપ, રેટિંગ, ડાઉનલોડ ગણાય, ફોનમાં બે એપ ન બને);
//   કમ્પ્યુટર    → બ્રાઉઝરનું ઇન્સ્ટોલ (Play Store કમ્પ્યુટર પર નથી);
//   iPhone       → "Add to Home Screen" ની રીત (Play Store નથી).
// ત્યાં સુધી Android માં પણ બ્રાઉઝરનું ઇન્સ્ટોલ.
import { APP } from './config.js';
import { icon } from './icons.js';

const DISMISS_KEY = 'gj:install-dismissed';
const DISMISS_DAYS = 7;
const SHOW_AFTER_MS = 2500;
// ઇન્સ્ટોલનું બટન ન આવે (Chrome ઘણી વાર થોડી વાર પછી આપે) તો Android માં આટલી વાર પછી મેનુની રીત બતાવવી
const MANUAL_AFTER_MS = 8000;

let deferred = null;
let installed = false;
let hasPlayApp = false;
let manualReady = false;
let shown = false;
let forced = false;

const ua = navigator.userAgent;
const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
// Facebook / Instagram ની અંદરનું બ્રાઉઝર: ત્યાં ઇન્સ્ટોલ થતું નથી, ખોટી રીત ન બતાવવી
const inAppBrowser = /FBAN|FBAV|Instagram|Line\//.test(ua);

export function isStandalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

const playLive = () => Boolean(APP.playStore && APP.playStore.live && APP.playStore.id);
export const playLink = () => `https://play.google.com/store/apps/details?id=${encodeURIComponent(APP.playStore.id)}`;

/** હાલ શું બતાવવું: 'play' | 'prompt' | 'ios' | 'android' | '' */
export function installState() {
  if (installed || isStandalone() || hasPlayApp) return '';
  if (playLive() && isAndroid) return 'play';
  if (deferred) return 'prompt';
  if (isIos && !inAppBrowser) return 'ios';
  if (isAndroid && manualReady && !inAppBrowser) return 'android';
  return '';
}

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

function bannerHtml(st) {
  const desk = !isAndroid && !isIos;
  const lines = {
    play: ['<small>પ્લે સ્ટોર પરથી મફત ડાઉનલોડ કરો</small>'],
    prompt: [desk ? '<small>કમ્પ્યુટર પર અલગ બારીમાં, સીધી ખોલો</small>' : '<small>ફોનની હોમ સ્ક્રીન પરથી સીધી, ઝડપથી ખોલો</small>'],
    ios: ['<small>નીચે શેર બટન ⬆ દબાવો, પછી</small>', '<small><b>Add to Home Screen</b></small>'],
    android: ['<small>ઉપર જમણે ⋮ દબાવો, પછી</small>', '<small><b>Install app / Add to Home screen</b></small>'],
  }[st];
  const btn =
    st === 'play' || st === 'prompt'
      ? `<button type="button" class="ib-go" data-install-go>${st === 'play' ? 'ડાઉનલોડ' : 'ઇન્સ્ટોલ'}</button>`
      : '';
  return `
    <img src="icons/icon-192.png" alt="" width="44" height="44">
    <div class="ib-t"><b>જાણકાર એપ</b>${lines.join('')}</div>
    ${btn}
    <button type="button" class="ib-x" data-install-close aria-label="બંધ કરો">${icon('close', 'ic-sm')}</button>`;
}

function render() {
  const st = installState();
  let el = document.getElementById('install-bar');
  const want = st && (forced || (shown && !dismissedRecently()));
  if (!want) {
    if (el) el.remove();
    document.documentElement.classList.remove('ib-on');
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'install-bar';
    el.className = 'install-bar';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'એપ ઇન્સ્ટોલ કરો');
    document.body.appendChild(el);
  }
  if (el.dataset.state !== st) {
    el.dataset.state = st;
    el.innerHTML = bannerHtml(st);
  }
  document.documentElement.classList.add('ib-on');
}

async function go() {
  const st = installState();
  if (st === 'play') {
    window.open(playLink(), '_blank', 'noopener');
    return;
  }
  if (st === 'prompt' && deferred) {
    const ev = deferred;
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferred = null; // એક વાર જ ચાલે; Chrome ફરી પૂછી શકે ત્યારે નવું event આપે
      if (outcome !== 'accepted') close();
    } catch {
      deferred = null;
    }
    render();
    return;
  }
  // iPhone / Android ની રીત: પટ્ટી ફરી બતાવો (✕ કર્યું હોય તો પણ)
  forced = true;
  render();
}

function close() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage બંધ: આવતી વખતે ફરી દેખાશે */
  }
  forced = false;
  shown = false;
  render();
}

/** પ્રોફાઇલ મેનુ માટે: ઇન્સ્ટોલ કરી શકાય? (✕ કર્યા પછી પણ મેનુમાં રહે) */
export const canInstall = () => Boolean(installState());

export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Chrome ની નાની પટ્ટીને બદલે આપણી પટ્ટી
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    render();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-install-close]')) return close();
    if (e.target.closest('[data-install-go], [data-install]')) go();
  });
  // Play Store ની એપ પહેલેથી ફોનમાં હોય તો પટ્ટી નહીં (manifest → related_applications)
  if (playLive() && navigator.getInstalledRelatedApps) {
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        hasPlayApp = apps.some((a) => a.id === APP.playStore.id);
        render();
      })
      .catch(() => {});
  }
  setTimeout(() => {
    shown = true;
    render();
  }, SHOW_AFTER_MS);
  setTimeout(() => {
    manualReady = true;
    render();
  }, MANUAL_AFTER_MS);
}
