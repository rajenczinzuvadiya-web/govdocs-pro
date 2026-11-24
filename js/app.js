import { APP } from './config.js';
import { CATEGORIES, CATEGORY_BY_ID, JATI, OCCUPATIONS, INCOME, DISTRICTS } from './options.js';
import { store } from './store.js';
import { matches, sortForProfile, isExpired, daysLeft, deadlineText, formatDate } from './match.js';
import { icon, tile, glyph, linePath, socialIcon } from './icons.js';
import { INFO_PAGES, INFO_LINKS, INFO_UPDATED } from './pages.js';
import { sendFeedback } from './feedback.js';

const state = {
  schemes: [],
  docs: [],
  docGroups: [],
  events: [],
  updates: [],
  helplines: [],
  profile: store.getProfile(),
  seen: new Set(store.getSeen() || []),
  installPrompt: null,
  // ફરજિયાત દસ્તાવેજ (data/essentials.json): બધા માટે + વર્ગ પ્રમાણે
  essentials: { all: [], roles: {} },
  loaded: false,
  error: false,
};

const $view = document.getElementById('view');
const $toast = document.getElementById('toast');
const $modal = document.getElementById('modal');

// ---------- નાનાં સાધનો ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 3200);
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const visible = (list) => list.filter((s) => !isExpired(s));
const allItems = () => [...state.schemes, ...state.docs];
const findItem = (id) => state.schemes.find((s) => s.id === id) || state.docs.find((s) => s.id === id);
const isDoc = (s) => s.kind === 'doc';
const isNew = (s) => !state.seen.has(s.id);
const itemHref = (s) => `#/scheme/${encodeURIComponent(s.id)}`;
const appUrl = () => location.origin + location.pathname;

function markSeen(id) {
  if (state.seen.has(id)) return;
  state.seen.add(id);
  store.setSeen([...state.seen]);
}

// ---------- ડેટા ----------

// "⚠️ ચકાસો" ફક્ત એડમિન માટેનું નિશાન (Digital Hub ગાઇડ મેનેજ): લોકોને ન દેખાય (યુઝર 24/11/26).
// લખાણમાંથી કાઢી નાખે; ફક્ત "⚠️ ચકાસો" હોય તે ખાનું ખાલી = દેખાય નહીં. રકમ / "મફત" નું નાનું લેબલ
// ન ચકાસાયેલી વિગત પરથી ન બને, એટલે એ જાણ `unsure` માં રહે.
const UNSURE_RE = /\s*⚠\uFE0F?(?:\s*ચકાસો)?/gu;
const calm = (v) =>
  typeof v === 'string'
    ? v.replace(UNSURE_RE, '').trim()
    : Array.isArray(v)
      ? v.map(calm).filter((x) => x !== '')
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, calm(x)]))
        : v;
const calmCard = (s) => ({ ...calm(s), unsure: { benefit: /⚠/.test(s.benefit || ''), fee: /⚠/.test(s.fee || '') } });

async function loadData() {
  const get = (f) => fetch('data/' + f, { cache: 'no-cache' }).then((r) => r.json());
  try {
    const [s, u, d, ev] = await Promise.all([
      get('schemes.json'),
      get('updates.json'),
      get('documents.json').catch(() => ({})),
      get('events.json').catch(() => ({})),
    ]);
    const es = await get('essentials.json').catch(() => ({}));
    state.essentials = { all: es.all || [], roles: es.roles || {} };
    state.schemes = (s.schemes || []).map(calmCard);
    state.updates = u.updates || [];
    state.docs = (d.documents || []).map(calmCard);
    state.docGroups = d.groups || [];
    state.events = (ev.events || []).map(calm);
    state.dataUpdatedOn = s.updatedOn || null;
    state.error = false;
    // પહેલી વાર: હાલનું બધું "જોયેલું", પછી આવે તે જ "નવું"
    if (store.getSeen() === null) {
      state.seen = new Set(allItems().map((x) => x.id));
      store.setSeen([...state.seen]);
    }
  } catch {
    state.error = true;
  }
  try {
    state.helplines = (await get('helplines.json')).helplines || [];
  } catch {
    /* નંબરનું પેજ ખાલી સંદેશ બતાવશે */
  }
  state.loaded = true;
}

// ---------- નાના ભાગ (બધાં પેજમાં) ----------

function pageHead(title, sub = '', ic = '', back = '') {
  return `
    <div class="page-head">
      ${back ? `<a class="back-btn" href="${back}" data-action="back" aria-label="પાછા">${icon('arrow')}</a>` : ''}
      ${ic ? `<span class="ph-icon">${icon(ic, 'ic')}</span>` : ''}
      <div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    </div>`;
}

// રંગીન tile, અંદર line આઇકન (હોમ અને સ્વાગતનાં મોટાં બટન)
const lineTile = (name, tone) => `<span class="tile tone-${tone}" aria-hidden="true">${icon(name)}</span>`;

const catTile = (id, size = '') => {
  const c = CATEGORY_BY_ID[id];
  return c ? tile(c.icon, c.tone, size) : tile('clipboard', 'slate', size);
};
const groupOf = (id) => state.docGroups.find((g) => g.id === id);
const groupTile = (id, size = '') => {
  const g = groupOf(id);
  return g ? tile(g.icon, g.tone, size) : tile('clipboard', 'slate', size);
};
// Digital Hub માં મૂકેલો ફોટો (https) — હોય તો રંગીન tile ને બદલે ફોટો
const pic = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');
function itemTile(s, profile) {
  if (pic(s.image)) return `<span class="tile pic" aria-hidden="true"><img src="${esc(pic(s.image))}" alt="" loading="lazy" decoding="async"></span>`;
  if (isDoc(s)) return groupTile(s.group);
  const cats = (profile && profile.categories) || [];
  return catTile(s.categories.find((c) => cats.includes(c)) || s.categories[0]);
}

// ---------- થંબનેલ (યુઝર 22/11/26: YouTube ની જેમ મોટો ફોટો, જેથી લોકો ક્લિક કરે) ----------
// Digital Hub નો ફોટો હોય તો ફોટો; ન હોય (કે ન ખૂલે) તો આપોઆપ થંબનેલ: રંગ + મોટો આઇકન + ટૂંકું નામ + ₹ રકમ.

// ટૂંકું નામ: "(" કે " — " પહેલાંનો ભાગ ("વૃદ્ધ પેન્શન (નિરાધાર…)" → "વૃદ્ધ પેન્શન")
const shortTitle = (t) => String(t || '').split(/\s*\(|\s+[—–-]\s+/)[0].trim() || String(t || '');
// લાભની ₹ રકમ — ફક્ત લાભ ચકાસાયેલો હોય (calmCard) અને આખા લાભમાં એક જ રકમ હોય ત્યારે
// (ઉંમર / પ્રકાર પ્રમાણે જુદી રકમ હોય તો એક રકમ મોટા અક્ષરે બતાવવી ગેરમાર્ગે દોરે, Play ની "ભ્રામક દાવા" નીતિ)
function rupee(s) {
  const b = String(s.benefit || '');
  if (!b || (s.unsure && s.unsure.benefit) || /\d\s*\/\s*\d/.test(b)) return '';
  const all = b.match(/₹\s?\d+(?:,\d+)*(?:\s*(?:લાખ|કરોડ))?/g) || [];
  return all.length === 1 ? all[0].replace(/\s+/g, ' ') : '';
}
// કાર્ડનો રંગ, આઇકન અને ઉપરનું નાનું લેબલ
function itemLook(s, profile) {
  if (isDoc(s)) {
    const g = groupOf(s.group);
    return g ? { ic: g.icon, tone: g.tone, label: g.label } : { ic: 'clipboard', tone: 'slate', label: 'દસ્તાવેજ' };
  }
  const cats = (profile && profile.categories) || [];
  const c = CATEGORY_BY_ID[s.categories.find((x) => cats.includes(x)) || s.categories[0]];
  return c ? { ic: c.icon, tone: c.tone, label: c.label } : { ic: 'clipboard', tone: 'slate', label: 'યોજના' };
}
const safeTone = (t) => (/^[a-z]+$/.test(t || '') ? t : 'blue');

/**
 * થંબનેલ (16:9). o = { img, tone, ic, emo, label, name, big, chip, badges, cls }
 * ફોટો ઉપર રહે; ફોટો ન ખૂલે તો `img` નીકળી જાય ને નીચેનું આપોઆપ થંબનેલ દેખાય (setupThumbFallback).
 */
function thumb(o) {
  const src = pic(o.img);
  return `<span class="thumb tone-${safeTone(o.tone)}${o.cls ? ' ' + o.cls : ''}">
    <span class="th-auto" aria-hidden="true">
      ${o.emo ? `<span class="th-emo">${esc(o.emo)}</span>` : glyph(o.ic, 'th-ic')}
      ${o.label ? `<span class="th-lab">${esc(o.label)}</span>` : ''}
      ${o.big ? `<b class="th-big">${esc(o.big)}</b>` : ''}
      ${o.name ? `<b class="th-name">${esc(o.name)}</b>` : ''}
      ${o.chip ? `<span class="th-chip">${esc(o.chip)}</span>` : ''}
    </span>
    ${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ''}
    ${o.badges ? `<span class="th-badges">${o.badges}</span>` : ''}
  </span>`;
}

// યોજના / દસ્તાવેજનું થંબનેલ. badges = true હોય તો "નવું", તારીખ, ★ સેવ ઉપર.
function itemThumb(s, { badges = true, cls = '' } = {}) {
  const look = itemLook(s, state.profile);
  const b = [];
  if (badges) {
    if (isNew(s)) b.push(`<span class="thb thb-new">${icon('sparkle', 'ic-sm')}નવું</span>`);
    if (!isDoc(s)) {
      const d = deadlineText(s);
      if (d.tone !== 'ok') b.push(`<span class="thb thb-${d.tone}">${icon('clock', 'ic-sm')}${esc(d.text)}</span>`);
    }
    if (store.isSaved(s.id)) b.push(`<span class="thb thb-saved">${icon('starfill', 'ic-sm')}સેવ</span>`);
  }
  let chip = '';
  if (isDoc(s)) chip = /^મફત/.test(s.fee || '') && !(s.unsure && s.unsure.fee) ? 'મફત' : '';
  else chip = rupee(s);
  return thumb({ img: s.image, tone: look.tone, ic: look.ic, label: look.label, name: shortTitle(s.title), chip, badges: b.join(''), cls });
}

// કાર્ડ: ઉપર થંબનેલ, નીચે નામ + એક લીટી + ›
function tcard(href, th, title, line, extra = '') {
  return `<li><a class="tcard" href="${href}">${th}<span class="tc-body"><span class="tc-text"><span class="tc-title">${esc(title)}</span>${line ? `<span class="tc-line">${esc(line)}</span>` : ''}${extra}</span>${icon('chev', 'ic-sm chev')}</span></a></li>`;
}

function itemCard(s) {
  const line = isDoc(s) ? s.summary || (groupOf(s.group) || {}).label || '' : s.summary;
  return tcard(itemHref(s), itemThumb(s), s.title, line);
}

function eventCard(e, mine) {
  const n = store.getDocs('event:' + e.id).filter((i) => i < e.items.length).length;
  const badges = mine ? `<span class="thb thb-mine">તમારા માટે</span>` : '';
  return tcard(`#/event/${e.id}`, thumb({ img: e.image, tone: 'blue', emo: e.icon, name: e.title, badges }), e.title, n ? `${n} / ${e.items.length} થઈ ગયું` : `${e.items.length} કામ`);
}

function helpCard(h) {
  const num = h.display || h.number;
  return tcard(`tel:${esc(h.number)}`, thumb({ tone: h.tone || 'green', ic: 'phone', big: num, cls: 'th-num' }), h.title, '', `<span class="tc-call">${icon('call', 'ic-sm')}ફોન કરો</span>`);
}

function itemList(items, empty) {
  if (!items.length) return `<div class="empty">${empty}</div>`;
  return `<ul class="tgrid">${items.map((s) => itemCard(s)).join('')}</ul>`;
}

// ફૂટર: દરેક પેજના છેલ્લે (સ્ક્રીનના તળિયે), એક જ જગ્યાએથી. KruPa Digital Hub ના ફૂટર જેવું:
// અમારી એપ · અમને ફોલો કરો · માહિતીનાં પેજ · ©
const COPY_FROM = 2026;
// ફૂટર: ફક્ત નિયમોનાં પેજ અને © (યુઝર 17/11/26: "વધારાનું કાઢી નાખો"). એપ અને ફોલો હોમ પર છે.
// યુઝર 19/11/26: એક સ્ક્રીન પર એક લિંક બે વાર નહીં, "સંપર્ક" અને "અમારા વિશે" મેનુમાં છે એટલે ફૂટરમાં નહીં.
const FOOT_SKIP = new Set(['about', 'contact']);
function renderFooter() {
  const y = new Date().getFullYear();
  document.getElementById('foot').innerHTML = `
    <nav class="foot-links" aria-label="માહિતી">${INFO_LINKS.filter((l) => !FOOT_SKIP.has(l.route)).map((l) => `<a href="#/${l.route}">${esc(l.label)}</a>`).join('')}</nav>
    <p class="fcopy">© ${y > COPY_FROM ? `${COPY_FROM}–${y}` : COPY_FROM} KruPa Digital Hub</p>`;
}

// ---------- છેલ્લી તારીખની યાદ ----------

function dueSoon() {
  return store
    .getSaved()
    .map(findItem)
    .filter((s) => s && s.lastDate)
    .filter((s) => {
      const d = daysLeft(s);
      return d >= 0 && d <= APP.reminderDays;
    })
    .sort((a, b) => daysLeft(a) - daysLeft(b));
}

function reminderNote() {
  const due = dueSoon();
  if (!due.length) return '';
  return `
    <div class="note note-danger mt" role="alert">${icon('bell')}
      <div><strong>છેલ્લી તારીખ નજીક છે</strong>
        <ul>${due.map((s) => `<li><a href="${itemHref(s)}">${esc(s.title)}</a>: ${esc(deadlineText(s).text)}</li>`).join('')}</ul>
      </div>
    </div>`;
}

async function notifyDue() {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const notified = store.getNotified();
  const today = todayISO();
  const due = dueSoon().filter((s) => notified[s.id] !== today);
  if (!due.length) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    for (const s of due) {
      await reg.showNotification(s.title, {
        body: deadlineText(s).text + ' — અરજી કરવાનું ભૂલશો નહીં.',
        icon: 'icons/icon-192.png',
        tag: 'due-' + s.id,
        data: { url: appUrl() + itemHref(s) },
      });
      notified[s.id] = today;
    }
    store.setNotified(notified);
  } catch {
    /* નોટિફિકેશન ન બતાવી શકાય તો હોમ પરની સૂચના તો છે જ */
  }
}

// ---------- પ્રોફાઇલ / સેટિંગ ----------

function categoryChoices(selected) {
  return CATEGORIES.map(
    (c) => `
    <label class="choice">
      <input type="checkbox" name="categories" value="${c.id}" ${selected.includes(c.id) ? 'checked' : ''}>
      <span class="choice-body">${tile(c.icon, c.tone)}<span><b>${esc(c.label)}</b><small>${esc(c.hint)}</small></span></span>
    </label>`
  ).join('');
}

// સ્વાગત પેજ નથી (યુઝર 24/11/26): અક્ષરનું કદ અને દેખાવ પ્રોફાઇલ પેજના "સેટિંગ" માં.
const TEXT_SIZES = [
  [100, 'સામાન્ય'],
  [110, 'મોટા'],
  [120, 'ખૂબ મોટા'],
];
// દેખાવ: 0 લાઇટ, 2 વચ્ચેનો (આછો રાખોડી), 3 ડાર્ક — KruPa ની પહેલી ગોઠવણી જેવું
const LOOKS = [
  [0, 'લાઇટ'],
  [2, 'વચ્ચેનો'],
  [3, 'ડાર્ક'],
];

// ---------- હોમ (KruPa Digital Hub ના હોમ જેવું) ----------

let homeQuery = '';

function shelfHead(ic, title, href, label) {
  return `<div class="shelf-head"><h2 class="box-title">${icon(ic)}${title}</h2>${href ? `<a class="shelf-link" href="${href}">${label} ${icon('chev', 'ic-sm')}</a>` : ''}</div>`;
}

function homeResults() {
  const q = homeQuery.trim().toLowerCase();
  if (!q) return '';
  const hits = [...visible(state.schemes), ...state.docs].filter((s) => searchText(s).includes(q)).slice(0, 30);
  return `
    <h2 class="section-title">${icon('search')}શોધનું પરિણામ <span class="count">${hits.length}</span></h2>
    ${itemList(hits, 'કંઈ મળ્યું નહીં. બીજો શબ્દ લખી જુઓ, જેમ કે "પેન્શન" કે "aavak".')}`;
}

// હોમ (યુઝર 24/11/26): ટૂંકું — "શું જાણવું છે?" (શોધ + 4 ભાગ) અને "તમે કોણ છો?" (વર્ગ). પછી તરત બીજી એપ અને ફોલો.
// ફોન નંબર હોમ પર નહીં: ઉપરની પટ્ટીમાં "ઇમરજન્સી નંબર" બટન.
const schemesFor = (c) => visible(state.schemes).filter((s) => (s.categories || []).includes(c));
const essentialCount = () => state.essentials.all.filter((x) => findItem(x.id)).length;

function homeAsk() {
  const tiles = [
    ['#/all', 'book', 'indigo', 'યોજના', `${visible(state.schemes).length} યોજના`],
    ['#/docs', 'folder', 'sky', 'દસ્તાવેજ', `${state.docs.length} દસ્તાવેજ`],
    ['#/events', 'calendar', 'pink', 'જીવનના પ્રસંગ', `${state.events.length} પ્રસંગ`],
    ['#/must', 'idcard', 'green', 'ફરજિયાત દસ્તાવેજ', `દરેક પાસે હોવા જોઈએ`],
  ];
  return `<ul class="qgrid">${tiles
    .map(([href, ic, tone, t, line]) => `<li><a class="qtile" href="${href}">${tile(ic, tone)}<span><b>${t}</b><small>${line}</small></span>${icon('chev', 'ic-sm chev')}</a></li>`)
    .join('')}</ul>`;
}

function homeWho(p) {
  const mine = (p && p.categories) || [];
  return `
    <section class="who" aria-labelledby="who-h">
      <h2 class="box-title" id="who-h">${icon('users')}તમે કોણ છો?</h2>
      <ul class="rgrid">${CATEGORIES.map(
        (c) => `<li><a class="rtile${mine.includes(c.id) ? ' on' : ''}" href="#/for/${c.id}">${tile(c.icon, c.tone)}<span><b>${esc(c.label)}</b><small>${schemesFor(c.id).length} યોજના${mine.includes(c.id) ? ' · તમે' : ''}</small></span></a></li>`
      ).join('')}</ul>
    </section>`;
}

function viewHome() {
  const p = state.profile;
  const latest = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return `
    ${state.installPrompt ? `<button class="note note-info btn-block" style="border:0;cursor:pointer;text-align:left;margin-bottom:1rem" data-action="install">${icon('plus')}<span><strong>એપ ફોનમાં ઇન્સ્ટોલ કરો</strong>: હોમ સ્ક્રીન પરથી સીધી ખૂલશે.</span></button>` : ''}
    ${reminderNote()}
    <section class="scard">
      <div class="scard-in">
        <h2>શું જાણવું છે?</h2>
        <label class="search-big">${icon('search')}
          <input id="home-search" type="search" placeholder="યોજના કે દાખલો શોધો… (જેમ કે પેન્શન, આવક)" value="${esc(homeQuery)}" aria-label="શોધો">
        </label>
        ${homeAsk()}
      </div>
    </section>
    ${latest ? `
      <a class="tip ${latest.type === 'chetavani' ? 'warn' : ''}" href="#/today">${icon(latest.type === 'chetavani' ? 'alert' : 'bulb')}
        <span><b>${latest.type === 'chetavani' ? 'ચેતવણી' : 'આજે નવું'}:</b> ${esc(latest.title)} <span class="go">જુઓ →</span></span>
      </a>` : ''}
    <div id="home-results">${homeResults()}</div>
    ${homeWho(p)}
    ${otherApps()}
    ${followUs()}`;
}

// ---------- વર્ગ પ્રમાણે: #/for/<વર્ગ> (હોમના "તમે કોણ છો?") ----------

function essentialsFor(c) {
  const seen = new Set();
  return [...(state.essentials.roles[c] || []), ...state.essentials.all].filter((x) => findItem(x.id) && !seen.has(x.id) && seen.add(x.id));
}

function viewFor(c) {
  const cat = CATEGORY_BY_ID[c];
  if (!cat) return viewHome();
  const mine = ((state.profile && state.profile.categories) || []).includes(c);
  const schemes = sortForProfile(schemesFor(c), state.profile || {});
  const extra = (state.essentials.roles[c] || []).filter((x) => findItem(x.id));
  const events = state.events.filter((e) => (e.categories || []).includes(c));
  return `
    ${pageHead(`${cat.label} માટે`, cat.hint, '', '#/')}
    <div class="actions">
      <button class="btn" type="button" data-action="mine-cat" data-cat="${c}" aria-pressed="${mine}">${icon(mine ? 'published' : 'user')}<span>${mine ? 'મારી પ્રોફાઇલમાં છે' : 'મારી પ્રોફાઇલમાં રાખો'}</span></button>
    </div>
    <section class="shelf mt">
      ${shelfHead('book', `યોજના <span class="count">${schemes.length}</span>`, `#/all?c=${c}`, 'યાદીમાં જુઓ')}
      ${itemList(schemes, 'આ વર્ગ માટે હજુ યોજના નથી. <a href="#/all">બધી યોજના જુઓ</a>')}
    </section>
    ${extra.length ? `
    <section class="shelf mt">
      ${shelfHead('idcard', `${esc(cat.label)} માટે જરૂરી દસ્તાવેજ`, '#/must', 'બધા ફરજિયાત દસ્તાવેજ')}
      ${mustList(extra, 'must:' + c)}
    </section>` : ''}
    ${events.length ? `
    <section class="shelf mt">
      ${shelfHead('calendar', 'જીવનના પ્રસંગ', '#/events', 'બધા પ્રસંગ')}
      <ul class="tgrid compact">${events.map((e) => eventCard(e, false)).join('')}</ul>
    </section>` : ''}`;
}

// ---------- ફરજિયાત દસ્તાવેજ: #/must (યુઝર 24/11/26: "સામાન્ય માણસે આ દસ્તાવેજ કઢાવી લેવા જ જોઈએ") ----------
// ✓ = "મારી પાસે છે", ફક્ત આ ફોનમાં (store.toggleDoc, ચેકલિસ્ટ જેવું).

function mustList(list, key) {
  const have = store.getDocs(key);
  return `<ul class="must">${list
    .map((x, i) => {
      const s = findItem(x.id);
      const done = have.includes(i);
      return `<li class="${done ? 'done' : ''}">
        <button type="button" class="must-tick" data-action="must" data-id="${esc(key)}" data-i="${i}" aria-pressed="${done}" aria-label="${esc(s.title)}: મારી પાસે છે"><span class="box"></span></button>
        <a href="${itemHref(s)}"><b>${esc(shortTitle(s.title))}</b><small>${esc(x.why)}</small></a>${icon('chev', 'ic-sm chev')}
      </li>`;
    })
    .join('')}</ul>`;
}

function mustProgress(list, key) {
  const n = store.getDocs(key).filter((i) => i < list.length).length;
  return n === list.length ? '✓ બધા દસ્તાવેજ તમારી પાસે છે' : `જે તમારી પાસે હોય તેના પર ✓ કરો · ${n} / ${list.length}`;
}

function viewMust() {
  const all = state.essentials.all.filter((x) => findItem(x.id));
  const mine = ((state.profile && state.profile.categories) || []).filter((c) => (state.essentials.roles[c] || []).some((x) => findItem(x.id)));
  const others = CATEGORIES.map((c) => c.id).filter((c) => !mine.includes(c) && (state.essentials.roles[c] || []).some((x) => findItem(x.id)));
  const role = (c, open) => {
    const list = state.essentials.roles[c].filter((x) => findItem(x.id));
    return part(esc(CATEGORY_BY_ID[c].label), 'user', mustList(list, 'must:' + c), { open, n: list.length });
  };
  return `
    ${pageHead('ફરજિયાત દસ્તાવેજ', 'દરેક પાસે હોવા જ જોઈએ. સહાય કે કામ વખતે દોડાદોડી ન થાય.', 'idcard', '#/')}
    <section class="card mt">
      <h2 class="box-title">${icon('users')}દરેક માટે <span class="count">${all.length}</span></h2>
      <p class="progress" id="must-progress">${mustProgress(all, 'must:all')}</p>
      ${mustList(all, 'must:all')}
    </section>
    <h2 class="section-title mt">${icon('list')}તમારા કામ પ્રમાણે વધારાના</h2>
    <div class="parts-main">${[...mine.map((c) => role(c, true)), ...others.map((c) => role(c, false))].join('')}</div>`;
}

// "અમારી બીજી એપ" (યુઝર 17/11/26): હોમના છેલ્લે KruPa ની બીજી બે એપ — Digital Hub અને Doc Hub પણ
// પોતાના મુખ્ય પાને બાકીની બે એ જ રીતે બતાવે છે. સાદી લિંક, નવા ટૅબમાં.
function otherApps() {
  const k = APP.krupa || {};
  const apps = [
    k.digitalHub && { id: 'digitalhub', href: k.digitalHub, logo: 'icons/digital-hub.png', name: 'KruPa Digital Hub', head: 'આપનું કામ, <em>હવે ઝડપી અને સરળ</em>', line: 'ગુજરાતનાં સરકારી ફોર્મ ભરો અને પ્રિન્ટ કરો.' },
    k.docHub && { id: 'dochub', href: k.docHub, logo: 'icons/doc-hub.png', name: 'KruPa Doc Hub', head: 'સમય બચાવો, <em>સરળ અને ઝડપી કામ</em>', line: 'ઝેરોક્ષ / પ્રિન્ટની દુકાન માટે: ફોટો → સીધો, સાફ A4 / PDF' },
  ].filter(Boolean);
  if (!apps.length) return '';
  return `
    <section class="oapps" aria-label="અમારી બીજી એપ" data-other-app>
      <p class="oapps-kick">અમારી બીજી એપ</p>
      <div class="oapps-grid">${apps.map((a) => `
        <a class="oapp" href="${esc(a.href)}" target="_blank" rel="noopener" data-other="${a.id}">
          <img src="${a.logo}" alt="" width="64" height="64">
          <b>${esc(a.name)}</b>
          <span class="oapp-head">${a.head}</span>
          <small>${esc(a.line)}</small>
          <span class="oapp-go">જુઓ ${icon('arrow', 'ic-sm')}</span>
        </a>`).join('')}
      </div>
    </section>`;
}

// "અમને ફોલો કરો" (હોમના છેલ્લે, Digital Hub અને Doc Hub જેવું): KruPa ની ચાર ચેનલ
function followUs() {
  const links = APP.social || [];
  if (!links.length) return '';
  return `
    <section class="follow" aria-label="અમને ફોલો કરો" data-follow-us>
      <p class="oapps-kick">અમને ફોલો કરો</p>
      <p class="follow-name">KruPa Digital Hub</p>
      <div class="follow-grid">${links
        .map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener" style="background:${esc(l.color)}" data-social="${esc(l.id)}">${socialIcon(l.id)}${esc(l.action)}</a>`)
        .join('')}</div>
    </section>`;
}

// ---------- યાદી: યોજના અને દસ્તાવેજ ----------

const filters = { all: { q: '', cat: '' }, docs: { q: '', cat: '' } };

function searchText(s) {
  const cats = (s.categories || []).map((c) => (CATEGORY_BY_ID[c] ? CATEGORY_BY_ID[c].label : ''));
  const g = groupOf(s.group);
  return [s.title, s.summary, s.benefit, s.howToApply, s.words, ...(s.documents || []), ...cats, g && g.label]
    .join(' ')
    .toLowerCase();
}

function filtered(scope) {
  const f = filters[scope];
  const q = f.q.trim().toLowerCase();
  const items = scope === 'docs' ? state.docs : visible(state.schemes);
  return items.filter((s) => {
    if (f.cat && !(scope === 'docs' ? s.group === f.cat : s.categories.includes(f.cat))) return false;
    return !q || searchText(s).includes(q);
  });
}

function refreshList(scope) {
  const el = document.getElementById(scope + '-list');
  if (el) el.innerHTML = listBody(scope);
  const n = document.getElementById(scope + '-count');
  if (n) n.textContent = countLabel(scope);
}

function listBody(scope) {
  const items = filtered(scope);
  return itemList(items, `કંઈ મળ્યું નહીં. <button type="button" class="btn-link" data-action="clear-filter" data-scope="${scope}" style="border:0;background:none;cursor:pointer;font:inherit">બધું બતાવો</button>`);
}

const countLabel = (scope) => `કુલ ${filtered(scope).length} ${{ docs: 'દસ્તાવેજ' }[scope] ?? 'યોજના'}`;

// "કોના માટે: બધા ▾" — એપનું પોતાનું નાનું લિસ્ટ, ✓ પસંદ કરેલા પર (KruPa BoxSelect #352)
function filterSelect(scope, label, chips, counts) {
  const f = filters[scope];
  const current = chips.find((c) => c.id === f.cat);
  const opts = [{ id: '', label: 'બધા' }, ...chips];
  return `
    <div class="dd" data-dd="${scope}">
      <button type="button" class="dd-btn" data-action="dd-toggle" aria-haspopup="listbox" aria-expanded="false"><span>${label}:</span><b>${esc(current ? current.label : 'બધા')}</b>${icon('chevdown', 'ic-sm')}</button>
      <div class="dd-list" role="listbox" aria-label="${label}">${opts
        .map(
          (c) =>
            `<button type="button" role="option" data-action="filter" data-scope="${scope}" data-cat="${c.id}" aria-selected="${f.cat === c.id}"><span class="tick">${f.cat === c.id ? '✓' : ''}</span>${esc(c.label)}<span class="n">${c.id ? counts(c.id) : ''}</span></button>`
        )
        .join('')}</div>
    </div>`;
}

function listPage(scope, title, sub, ic, placeholder, chips, label) {
  const f = filters[scope];
  const counts = (id) =>
    (scope === 'docs' ? state.docs.filter((s) => s.group === id) : visible(state.schemes).filter((s) => s.categories.includes(id))).length;
  return `
    ${pageHead(title, sub, ic, '#/')}
    <div class="fbar">
      <label class="search-box">${icon('search')}
        <input class="search" data-scope="${scope}" type="search" placeholder="${placeholder}" value="${esc(f.q)}" aria-label="શોધો">
      </label>
      ${filterSelect(scope, label, chips, counts)}
      <span class="fcount" id="${scope}-count">${countLabel(scope)}</span>
    </div>
    <div id="${scope}-list">${listBody(scope)}</div>`;
}

function viewAll(params) {
  if (params.get('c') !== null) filters.all.cat = params.get('c');
  if (params.get('q') !== null) filters.all.q = params.get('q');
  return listPage('all', 'યોજના ગાઇડ', 'કોને મળે, કેટલો લાભ, કયા પુરાવા અને અરજી કેવી રીતે કરવી.', 'book', 'યોજના શોધો… (જેમ કે પેન્શન, લોન)', CATEGORIES, 'કોના માટે');
}

function viewDocs(params) {
  if (params && params.get('q') !== null) filters.docs.q = params.get('q');
  return listPage('docs', 'દસ્તાવેજ ગાઇડ', 'કયો દાખલો કે કાર્ડ ક્યાંથી, કયા પુરાવાથી અને કેટલા દિવસમાં નીકળે.', 'folder', 'દાખલો કે કાર્ડ શોધો… (જેમ કે આવક, આધાર)', state.docGroups, 'વિભાગ');
}

// ---------- પ્રસંગ ----------

function viewEvents() {
  const cats = (state.profile && state.profile.categories) || [];
  const isMine = (e) => e.categories.some((c) => cats.includes(c));
  const sorted = [...state.events].sort((a, b) => Number(isMine(b)) - Number(isMine(a)));
  return `
    ${pageHead('જીવનના પ્રસંગ', 'પ્રસંગ પસંદ કરો: શું કઢાવવું અને કઈ સહાય મળી શકે તેનું લિસ્ટ.', 'calendar')}
    <ul class="tgrid compact">${sorted.map((e) => eventCard(e, isMine(e))).join('')}</ul>`;
}

function eventItemTitle(it) {
  const linked = it.itemId ? findItem(it.itemId) : null;
  return it.title || (linked ? linked.title : '');
}

function eventProgress(e, ready) {
  const n = ready.filter((i) => i < e.items.length).length;
  return n === e.items.length ? '✓ બધું થઈ ગયું' : `${n} / ${e.items.length} થઈ ગયું`;
}

function viewEvent(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return `<div class="empty">આ પ્રસંગ મળ્યો નહીં. <a href="#/events">બધા પ્રસંગ</a></div>`;
  const key = 'event:' + e.id;
  const ready = store.getDocs(key);
  const row = ([it, i]) => {
    const linked = it.itemId ? findItem(it.itemId) : null;
    const done = ready.includes(i);
    return `
      <li class="ev-item ${done ? 'done' : ''}">
        <button type="button" class="ev-tick" data-action="event-tick" data-id="${key}" data-i="${i}" aria-pressed="${done}" aria-label="થઈ ગયું"><span class="box"></span></button>
        <div class="ev-body">
          ${linked ? `<a href="${itemHref(linked)}">${esc(eventItemTitle(it))} ${icon('chev', 'ic-sm')}</a>` : `<b>${esc(eventItemTitle(it))}</b>`}
          ${it.note ? `<span class="muted">${esc(it.note)}</span>` : ''}
        </div>
      </li>`;
  };
  const pairs = e.items.map((it, i) => [it, i]);
  const docs = pairs.filter(([it]) => it.type !== 'scheme');
  const helps = pairs.filter(([it]) => it.type === 'scheme');
  return `
    <nav class="crumb"><a class="back-btn" href="#/events" data-action="back" aria-label="પાછા">${icon('arrow')}</a><a href="#/events">જીવનના પ્રસંગ</a></nav>
    <div class="detail-head has-pic">${thumb({ img: e.image, tone: 'blue', emo: e.icon, name: e.title, cls: 'hero' })}
      <div><h1>${esc(e.title)}</h1><p class="lead">${esc(e.summary)}</p></div>
    </div>
    <p class="progress mt" id="event-progress">${eventProgress(e, ready)}</p>
    <div class="parts one" style="margin-top:1rem">
      <div class="parts-main">
        ${docs.length ? `<section class="part"><h2><span class="sq">${icon('forms')}</span>કરવાનાં કામ / દસ્તાવેજ</h2><ul class="ev-list">${docs.map(row).join('')}</ul></section>` : ''}
        ${helps.length ? `<section class="part"><h2><span class="sq">${icon('gift')}</span>મળી શકે એવી સહાય</h2><ul class="ev-list">${helps.map(row).join('')}</ul></section>` : ''}
      </div>
    </div>
    <p class="mt"><a class="btn" href="#/contact?event=${encodeURIComponent(e.id)}">${icon('message')}ભૂલ / સૂચન જણાવો</a></p>`;
}

// વોટ્સએપ સંદેશ (યુઝર 20/11/26: ગોઠવણી બરાબર ન હતી): એક ખાનું એક લીટી, ખાલી ખાનું નહીં,
// એપની લિંક પહેલી (વોટ્સએપ પહેલી લિંકનું કાર્ડ બતાવે), સત્તાવાર લિંક છેલ્લે.
const waLine = (t) => String(t || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();
const waJoin = (blocks) => blocks.filter((b) => b && b.length).map((b) => b.join('\n')).join('\n\n');

// ---------- વિગતનું પેજ ----------

const KIND_TEXT = {
  scheme: { benefit: 'લાભ', who: 'કોને મળે', list: 'યોજના ગાઈડ', listHref: '#/all' },
  doc: { benefit: 'ક્યાં કામ આવે', who: 'કોણ કઢાવી શકે', list: 'દસ્તાવેજ ગાઈડ', listHref: '#/docs' },
};
const kindText = (s) => KIND_TEXT[isDoc(s) ? 'doc' : 'scheme'];

function shareText(s) {
  const k = kindText(s);
  const docs = (s.documents || []).map(waLine).filter(Boolean);
  const facts = [
    s.fee && `💰 ફી: ${waLine(s.fee)}`,
    !isDoc(s) && `📅 ${s.lastDate ? 'છેલ્લી તારીખ: ' + formatDate(s.lastDate) : 'ચાલુ યોજના'}`,
  ].filter(Boolean);
  // યુઝર 24/11/26: પગલાં અને અરજીની લિંક નહીં — લાભ, પુરાવા અને એપની લિંક પૂરતાં.
  return waJoin([
    [`*${waLine(s.title)}*`, waLine(s.summary)].filter(Boolean),
    s.benefit ? [`✅ *${k.benefit}*`, waLine(s.benefit)] : null,
    docs.length ? [`📄 *પુરાવા (${docs.length})*`, ...docs.map((d, i) => `${i + 1}. ${d}`)] : null,
    facts,
    ['📱 વધુ માહિતી ગુજરાતીમાં:', `${appUrl()}${itemHref(s)}`],
  ]);
}

const dots = (arr) => `<ul class="dots">${arr.map((t) => `<li><span>${esc(t)}</span></li>`).join('')}</ul>`;
// ખૂલતો-બંધ થતો વિભાગ (યુઝર 17/11/26: બધા ખુલ્લા હોય તો જગ્યા રોકે). પહેલો ખુલ્લો, બાકીના નામ + ગણતરી સાથે બંધ.
const part = (title, ic, body, { cls = '', open = false, n = 0 } = {}) => `
  <details class="part ${cls}"${open ? ' open' : ''}><summary><h2><span class="sq">${icon(ic)}</span>${title}${n ? `<span class="n">${n}</span>` : ''}</h2>${icon('chevdown', 'ic chev')}</summary><div class="part-body">${body}</div></details>`;

function docProgress(s, ready) {
  const n = ready.filter((i) => i < s.documents.length).length;
  return n === s.documents.length ? '✓ બધા પુરાવા તૈયાર છે' : `તૈયાર હોય તેના પર ટેપ કરો · ${n} / ${s.documents.length} તૈયાર`;
}

function docChecklist(s) {
  const ready = store.getDocs(s.id);
  return `
    <p class="progress" id="doc-progress">${docProgress(s, ready)}</p>
    <ul class="checks">${s.documents
      .map(
        (d, i) => `
      <li><button type="button" class="check ${ready.includes(i) ? 'done' : ''}" data-action="doc" data-id="${esc(s.id)}" data-i="${i}" aria-pressed="${ready.includes(i)}">
        <span class="box"></span><span>${esc(d)}</span></button></li>`
      )
      .join('')}</ul>`;
}

function viewItem(id) {
  const s = findItem(id);
  if (!s) return `<div class="empty">આ માહિતી મળી નહીં. <a href="#/">હોમ પર જાઓ</a></div>`;
  const k = kindText(s);
  const wasNew = isNew(s);
  markSeen(s.id);
  const saved = store.isSaved(s.id);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(shareText(s));
  const events = state.events.filter((e) => e.items.some((it) => it.itemId === s.id));
  // યુઝર 24/11/26: ફક્ત યોજના + જરૂરી પુરાવા. પગલાં, અરજીની લિંક, અરજી પછી, કેટલા દિવસ, ભૂલો નહીં.
  const small = [
    ['banknote', 'ફી', s.fee],
    ['hourglass', 'માન્યતા', s.validity],
    ['calendar', 'છેલ્લી તારીખ', s.lastDate ? formatDate(s.lastDate) : ''],
  ].filter(([, , v]) => v);
  const sources = (s.sources && s.sources.length ? s.sources : [{ label: s.source, url: s.officialLink }])
    .map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`)
    .join('');
  return `
    <nav class="crumb">
      <a class="back-btn" href="${k.listHref}" data-action="back" aria-label="પાછા">${icon('arrow')}</a>
      <a href="${k.listHref}">${k.list}</a>${isDoc(s) && groupOf(s.group) ? ` › <span>${esc(groupOf(s.group).label)}</span>` : ''}
    </nav>
    <div class="detail-head has-pic">
      ${itemThumb(s, { badges: false, cls: 'hero' })}
      <div>
        <h1>${esc(s.title)}</h1>
        <p class="lead">${esc(s.summary)}</p>
      </div>
    </div>
    ${events.length ? `<div class="related"><span>આ પ્રસંગમાં કામ આવે:</span>${events.map((e) => `<a class="chip" href="#/event/${e.id}"><span aria-hidden="true">${e.icon}</span>${esc(e.title)}</a>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="btn" data-action="save" data-id="${esc(s.id)}" aria-pressed="${saved}">${icon('star', saved ? 'ic filled' : 'ic')}<span>${saved ? 'સેવ થયેલ' : 'સેવ કરો'}</span></button>
      <a class="btn btn-ok" href="${wa}" target="_blank" rel="noopener">${icon('share')}વોટ્સએપ પર મોકલો</a>
    </div>
    <div class="facts-main">
      ${s.eligibility.length ? `<div class="fact"><span class="sq">${icon('users')}</span><div><div class="k">${k.who}</div><div class="v">${s.eligibility.map(esc).join('<br>')}</div></div></div>` : ''}
      ${s.benefit ? `<div class="fact good"><span class="sq">${icon('gift')}</span><div><div class="k">${k.benefit}</div><div class="v">${esc(s.benefit)}</div></div></div>` : ''}
    </div>
    ${small.length ? `<div class="facts-small">${small.map(([ic, kk, v]) => `<div class="fact">${icon(ic)}<div><div class="k">${kk}</div><div class="v">${esc(v)}</div></div></div>`).join('')}</div>` : ''}
    <div class="parts">
      <div class="parts-main">
        ${(s.documents || []).length ? `<section class="card docs-card"><h2 class="box-title">${icon('list')}કયા પુરાવા જોઈએ <span class="count">${s.documents.length}</span></h2>${docChecklist(s)}</section>` : ''}
      </div>
      <aside class="parts-side">
        <div class="card side-box">
          <h3>${icon('alert')}માહિતીમાં ભૂલ છે?</h3>
          <p class="small muted">ફી, તારીખ કે નિયમ બદલાયા હોય તો જણાવો, અમે ચકાસીને સુધારીશું.</p>
          <a class="btn btn-block" href="#/contact?about=${encodeURIComponent(s.id)}">${icon('message')}ભૂલ / સૂચન જણાવો</a>
        </div>
        <div class="card side-box">
          <h3>${icon('book')}સ્રોત</h3>
          <div class="sources">${sources}<span>છેલ્લે અપડેટ: ${esc(formatDate(s.updatedOn))}</span></div>
        </div>
      </aside>
    </div>`;
}

// ---------- સેવ, આજનું, ફોન નંબર, પ્રોફાઇલ, એપ વિશે ----------

function viewSaved() {
  const saved = store.getSaved().map(findItem).filter(Boolean);
  return `
    ${pageHead('સેવ કરેલ', 'સેવ કરેલી યોજનાની છેલ્લી તારીખ પહેલાં યાદ કરાવીશું.', 'star')}
    ${reminderNote()}
    <div class="mt">${itemList(saved, 'હજુ કંઈ સેવ નથી કર્યું. યોજના કે દાખલો ખોલીને "સેવ કરો" દબાવો.')}</div>`;
}

function viewToday() {
  const items = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return `
    ${pageHead('આજે શું નવું આવ્યું?', 'નવી માહિતી અને જરૂરી ચેતવણી', 'bell', '#/')}
    <div class="news">${
      items.length
        ? items
            .map(
              (u) => `
      <article class="card ${u.type === 'chetavani' ? 'warn' : ''}">
        ${pic(u.image) ? `<img class="news-pic" src="${esc(pic(u.image))}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="when">${icon(u.type === 'chetavani' ? 'alert' : 'info', 'ic-sm')}${u.type === 'chetavani' ? 'ચેતવણી' : 'જાણકારી'} · ${esc(formatDate(u.date))}</span>
        <h3>${esc(u.title)}</h3>
        <p class="muted">${esc(u.summary)}</p>
        ${u.link ? `<div class="row"><a class="btn" href="${esc(u.link)}" target="_blank" rel="noopener">${icon('external')}મૂળ સ્રોત</a></div>` : ''}
      </article>`
            )
            .join('')
        : '<div class="empty">હમણાં કોઈ નવી માહિતી નથી.</div>'
    }</div>`;
}

function viewHelp() {
  return `
    ${pageHead('જરૂરી ફોન નંબર', '', 'phone', '#/')}
    ${state.helplines.length ? `<ul class="tgrid compact">${state.helplines.map(helpCard).join('')}</ul>` : '<div class="empty">નંબર લોડ ન થયા.</div>'}`;
}

function viewProfile() {
  const p = state.profile || { categories: [] };
  const z = store.getZoom();
  const lv = lookLevel();
  const opt = (items, val) =>
    items
      .map((i) => {
        const id = typeof i === 'string' ? i : i.id;
        const label = typeof i === 'string' ? i : i.label;
        return `<option value="${esc(id)}" ${val === id ? 'selected' : ''}>${esc(label)}</option>`;
      })
      .join('');
  return `
    ${pageHead('પ્રોફાઇલ અને સેટિંગ', 'બધું વૈકલ્પિક છે, ફક્ત આ ફોનમાં રહે છે.', 'user', '#/')}
    <form id="profile" class="stack">
      <fieldset class="card">
        <legend>તમે કોણ છો? (એક કે વધુ)</legend>
        <div class="choice-grid">${categoryChoices(p.categories || [])}</div>
      </fieldset>
      <div class="card form-grid">
        <label class="field">ઉંમર (વર્ષ)<input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(p.age || '')}"></label>
        <label class="field">જાતિ<select name="jati"><option value="">— પસંદ કરો —</option>${opt(JATI, p.jati)}</select></label>
        <label class="field">જિલ્લો<select name="district"><option value="">— પસંદ કરો —</option>${opt(DISTRICTS, p.district)}</select></label>
        <label class="field">તાલુકો<input name="taluka" type="text" value="${esc(p.taluka || '')}" autocomplete="off"></label>
        <label class="field">વ્યવસાય<select name="occupation"><option value="">— પસંદ કરો —</option>${opt(OCCUPATIONS, p.occupation)}</select></label>
        <label class="field">કુટુંબની વાર્ષિક આવક<select name="income"><option value="">— પસંદ કરો —</option>${opt(INCOME, p.income)}</select></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${icon('published')}સેવ કરો</button>
      <div class="card stack" id="settings">
        <h2 class="h2">${icon('eye')}અક્ષરનું કદ</h2>
        <div class="size-pick">${TEXT_SIZES.map(([v, label]) => `<button type="button" data-action="text-size" data-size="${v}" aria-pressed="${z === v}">અ<span>${label}</span></button>`).join('')}</div>
        <h2 class="h2">${icon('sun')}દેખાવ અને રંગ</h2>
        <div class="look-pick">${LOOKS.map(([v, label]) => `<button type="button" class="l${v}" data-action="look" data-level="${v}" aria-pressed="${lv === v}"><i></i>${label}</button>`).join('')}</div>
      </div>
      ${state.profile ? `<button class="btn btn-ghost btn-block" type="button" data-action="reset">${icon('trash')}મારી બધી માહિતી ફોનમાંથી કાઢી નાખો</button>` : ''}
    </form>`;
}

// માહિતીનાં પેજ (js/pages.js): અમારા વિશે, ગોપનીયતા નીતિ, નિયમો અને શરતો, ડિસ્ક્લેમર, કોપીરાઇટ નીતિ
function contactHtml() {
  const c = APP.contact || {};
  const parts = [
    c.whatsapp && `વોટ્સએપ <a href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">${esc(c.whatsapp.replace(/^91/, ''))}</a>`,
    c.email && `ઈમેલ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'એપના મેનુમાં "સંપર્ક અને સૂચન" જુઓ.';
}

function viewInfo(route) {
  const pg = INFO_PAGES[route];
  const link = INFO_LINKS.find((l) => l.route === route);
  const fill = (t) => esc(t).replace(/\{APP\}/g, esc(APP.name)).replace(/\{CONTACT\}/g, contactHtml());
  return `
    ${pageHead(pg.title, pg.sub ? esc(pg.sub) : `અમલ તારીખ: ${INFO_UPDATED}`, link.ic, '#/')}
    <article class="card info-doc">${pg.parts
      .map(
        (x, i) => `
      <section>
        <h2><span class="n">${i + 1}</span>${fill(x.title)}</h2>
        ${x.text ? `<p>${fill(x.text)}</p>` : ''}
        ${x.points ? `<ul>${x.points.map((t) => `<li>${fill(t)}</li>`).join('')}</ul>` : ''}
        ${x.after ? `<p>${fill(x.after)}</p>` : ''}
      </section>`
      )
      .join('')}
    </article>`;
}

// ---------- સંપર્ક ----------

const hasContact = () => Boolean(APP.contact && (APP.contact.whatsapp || APP.contact.email));

function contactLink(text, subject = APP.name) {
  const c = APP.contact || {};
  if (c.whatsapp) return `https://wa.me/${encodeURIComponent(c.whatsapp)}?text=${encodeURIComponent(text)}`;
  if (c.email) return `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return '';
}

function viewContact(params) {
  const c = APP.contact || {};
  const item = params && params.get('about') ? findItem(params.get('about')) : null;
  const ev = params && params.get('event') ? state.events.find((x) => x.id === params.get('event')) : null;
  const title = item ? item.title : ev ? ev.title : '';
  const page = item ? itemHref(item) : ev ? `#/event/${ev.id}` : '#/contact';
  const rows = [
    c.whatsapp && `<a class="help-row" href="${contactLink(`${APP.name} વિશે:\n`)}" target="_blank" rel="noopener">${lineTile('chat', 'green')}<div><div class="num">વોટ્સએપ</div><div class="t">${esc(c.whatsapp.replace(/^91/, ''))}</div></div>${icon('chev', 'ic chev')}</a>`,
    c.email && `<a class="help-row" href="mailto:${esc(c.email)}">${lineTile('message', 'blue')}<div><div class="num">ઈમેલ</div><div class="t">${esc(c.email)}</div></div>${icon('chev', 'ic chev')}</a>`,
  ].filter(Boolean);
  return `
    ${pageHead('સંપર્ક અને સૂચન', 'ભૂલ દેખાય, તકલીફ હોય કે સૂચન હોય તો લખો.', 'message', '#/')}
    <div class="contact-grid">
      <form id="contact-form" class="card stack" data-title="${esc(title)}" data-page="${esc(page)}" novalidate>
        ${title ? `<p class="subject">${icon('info', 'ic-sm')}વિષય: <b>${esc(title)}</b></p>` : ''}
        <div class="seg" role="radiogroup" aria-label="પ્રકાર">
          <label><input type="radio" name="kind" value="problem" checked><span>${icon('alert', 'ic-sm')}ભૂલ / તકલીફ</span></label>
          <label><input type="radio" name="kind" value="suggestion"><span>${icon('bulb', 'ic-sm')}સૂચન</span></label>
        </div>
        <div class="form-grid">
          <label class="field">નામ<input name="name" type="text" maxlength="60" autocomplete="name"></label>
          <label class="field">મોબાઇલ નંબર<input name="phone" type="tel" inputmode="numeric" maxlength="14" autocomplete="tel" placeholder="જવાબ જોઈએ તો"></label>
        </div>
        <label class="field">શું લખવું છે?<textarea name="message" rows="5" maxlength="1000" placeholder="દા.ત. ફી બદલાઈ છે, નવી યોજના ઉમેરો"></textarea></label>
        <p class="small muted">આધાર કે બેંક નંબર ન લખો. <a href="#/privacy">ગોપનીયતા નીતિ</a></p>
        <p class="small report-msg" role="status" hidden></p>
        <button class="btn btn-primary btn-block btn-lg" type="submit">${icon('published')}મોકલો</button>
      </form>
      ${rows.length ? `<div class="help-list one">${rows.join('')}</div>` : ''}
    </div>`;
}

// ---------- ખોખું: બાજુનું મેનુ, નીચેનાં ટેબ, "વધુ", 👤 મેનુ, ઝૂમ, દેખાવ, શોધ (KruPa Digital Hub જેવું) ----------

const NAV = [
  { route: 'home', href: '#/', ic: 'home', label: 'હોમ' },
  { route: 'all', href: '#/all', ic: 'book', label: 'યોજના ગાઇડ', short: 'યોજના' },
  { route: 'docs', href: '#/docs', ic: 'folder', label: 'દસ્તાવેજ ગાઇડ', short: 'દસ્તાવેજ' },
  { route: 'events', href: '#/events', ic: 'calendar', label: 'જીવનના પ્રસંગ', short: 'પ્રસંગ' },
  { route: 'saved', href: '#/saved', ic: 'star', label: 'સેવ કરેલ' },
  { route: 'help', href: '#/help', ic: 'call', label: 'જરૂરી ફોન નંબર' },
  { group: 'મદદ' },
  { route: 'contact', href: '#/contact', ic: 'message', label: 'સંપર્ક અને સૂચન' },
  { route: 'about', href: '#/about', ic: 'info', label: 'અમારા વિશે' },
];
const tabRoutes = () => ['home', 'all', 'docs', 'events'];
const navItems = () => NAV;

function navLinks() {
  const k = APP.krupa || {};
  const op = [
    k.digitalHub && `<a class="nl" href="${esc(k.digitalHub)}" target="_blank" rel="noopener">${icon('forms')}<span>KruPa Digital Hub<small>VCE: ફોર્મ ભરો અને પ્રિન્ટ</small></span>${icon('external', 'ext')}</a>`,
    k.docHub && `<a class="nl" href="${esc(k.docHub)}" target="_blank" rel="noopener">${icon('copy')}<span>KruPa Doc Hub<small>ઝેરોક્ષ દુકાન: ફોટો પરથી A4</small></span>${icon('external', 'ext')}</a>`,
  ].filter(Boolean);
  return (
    navItems().map((n) => (n.group ? `<p class="group">${n.group}</p>` : `<a class="nl" href="${n.href}" data-route="${n.route}">${icon(n.ic)}<span>${n.label}</span></a>`)).join('') +
    (op.length ? `<p class="group">ઓપરેટર માટે</p>${op.join('')}` : '')
  );
}

function renderChrome() {
  document.getElementById('side-nav').innerHTML = navLinks();
  document.getElementById('tabs').innerHTML = `<div class="tabs-in">${navItems().filter((n) => tabRoutes().includes(n.route))
    .map((n) => `<a class="tab" href="${n.href}" data-route="${n.route}"><span class="pill">${icon(n.ic)}</span><span>${n.short || n.label}</span></a>`)
    .join('')}<button type="button" class="tab" id="more-btn" data-route="more" aria-haspopup="dialog"><span class="pill">${icon('menu')}</span><span>વધુ</span></button></div>`;
  renderFooter();
  renderTopZoom();
}

function setActiveNav(tab) {
  const inTabs = tabRoutes().includes(tab);
  document.querySelectorAll('[data-route]').forEach((a) => {
    const on = a.dataset.route === tab || (a.dataset.route === 'more' && !inTabs && tab !== 'scheme');
    a.classList.toggle('active', on);
    if (on && a.tagName === 'A') a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

const $drawer = document.getElementById('drawer');
function openDrawer() {
  $drawer.innerHTML = `
    <div class="drawer" role="dialog" aria-modal="true" aria-label="મેનુ">
      <button class="drawer-bg" type="button" data-drawer-close aria-label="બંધ કરો"></button>
      <aside>
        <div class="drawer-head"><a class="side-brand" href="#/"><img src="icons/icon-192.png" alt="" width="32" height="32"><span class="wordmark">${esc(APP.name)}</span></a>
          <button type="button" data-drawer-close aria-label="બંધ કરો">${icon('close')}</button></div>
        <nav class="side-nav">${navLinks()}</nav>
      </aside>
    </div>`;
  setActiveNav(currentTab());
  const c = $drawer.querySelector('aside button');
  if (c) c.focus();
}
const closeDrawer = () => ($drawer.innerHTML = '');
$drawer.addEventListener('click', (e) => {
  if (e.target.closest('[data-drawer-close]') || e.target.closest('a')) closeDrawer();
});
document.getElementById('tabs').addEventListener('click', (e) => {
  if (e.target.closest('#more-btn')) openDrawer();
});

// ઝૂમ − 100% + (કમ્પ્યુટર: ઉપરની પટ્ટીમાં, ફોન: 👤 મેનુમાં)
const ZOOMS = [80, 90, 100, 110, 120];
function zoomStepper() {
  const z = store.getZoom();
  return `<span class="stepper">
      <button type="button" data-zoom="-1" aria-label="નાનું" ${z <= ZOOMS[0] ? 'disabled' : ''}>${icon('minus', 'ic-sm')}</button>
      <span>${z}%</span>
      <button type="button" data-zoom="1" aria-label="મોટું" ${z >= ZOOMS[ZOOMS.length - 1] ? 'disabled' : ''}>${icon('plus', 'ic-sm')}</button>
    </span>`;
}
function renderTopZoom() {
  document.getElementById('top-zoom').innerHTML = zoomStepper();
}
function stepZoom(d) {
  const i = ZOOMS.indexOf(store.getZoom()) + d;
  if (ZOOMS[i]) store.setZoom(ZOOMS[i]);
  applyLook();
  renderTopZoom();
  if (pmOpen()) renderPm();
}
document.getElementById('top-zoom').addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) stepZoom(Number(z.dataset.zoom));
});

// દેખાવ: 0 લાઇટ · 1 આછો · 2 વચ્ચેનો · 3 ડાર્ક · 4 કાળો (KruPa #246)
const SHADE_NAMES = ['લાઇટ', 'આછો', 'વચ્ચેનો', 'ડાર્ક', 'કાળો'];
function systemDark() {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
function lookLevel() {
  const t = store.getTheme();
  const dark = t === 'dark' || (t === 'auto' && systemDark());
  const sh = store.getShade();
  if (dark) return sh === 'black' ? 4 : 3;
  return sh === 'softer' ? 2 : sh === 'soft' ? 1 : 0;
}
function setLookLevel(l) {
  store.setTheme(l >= 3 ? 'dark' : 'light');
  store.setShade(['', 'soft', 'softer', '', 'black'][l] || '');
  applyLook();
}

function applyLook() {
  const z = store.getZoom();
  const root = document.documentElement;
  if (z === 100) delete root.dataset.zoom;
  else root.dataset.zoom = String(z);
  const t = store.getTheme();
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && systemDark());
  const sh = store.getShade();
  const shade = dark ? (sh === 'black' ? 'black' : '') : sh === 'soft' || sh === 'softer' ? sh : '';
  if (shade) root.dataset.shade = shade;
  else delete root.dataset.shade;
  document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#0a0f1c' : '#ffffff');
}

let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  $modal.innerHTML = `<div class="overlay" data-close="1"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $modal.querySelector('button, a, input');
  if (first) first.focus();
}
function closeModal() {
  $modal.innerHTML = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// 👤 ▾ મેનુ: ઉપર જમણે નીચે ખૂલે (KruPa ProfileMenu). પેજની લિંક બાજુના મેનુમાં છે.
const $pm = document.getElementById('pm-panel');
const $pmBtn = document.getElementById('menu-btn');
const pmOpen = () => !$pm.hidden;
function pmHtml() {
  const p = state.profile;
  const cats = p && p.categories ? p.categories.map((c) => (CATEGORY_BY_ID[c] ? CATEGORY_BY_ID[c].label : '')).filter(Boolean).join(', ') : '';
  const lv = lookLevel();
  return `
    <div class="pm-head"><b>મારી પ્રોફાઇલ</b><small>${cats ? esc(cats) : 'હજુ પસંદ નથી કર્યું'}</small></div>
    <div class="menu-list">
      <a href="#/profile">${icon('user')}પ્રોફાઇલ બદલો</a>
      <a href="#/saved">${icon('star')}સેવ કરેલ</a>
      <a href="${shareAppLink()}" target="_blank" rel="noopener">${icon('share')}એપ વોટ્સએપ પર મોકલો</a>
      <div class="menu-sep"></div>
      <div class="menu-setting only-phone">ઝૂમ ${zoomStepper()}</div>
      <label class="shade"><span class="shade-top">દેખાવ <small>${SHADE_NAMES[lv]}</small></span>
        <input type="range" min="0" max="4" step="1" value="${lv}" data-shade-range aria-label="દેખાવ: લાઇટથી કાળો">
        <span class="shade-ends"><span>લાઇટ</span><span>કાળો</span></span>
      </label>
    </div>`;
}
function renderPm() {
  $pm.innerHTML = pmHtml();
}
function openPm() {
  renderPm();
  $pm.hidden = false;
  $pmBtn.setAttribute('aria-expanded', 'true');
}
function closePm() {
  if (!pmOpen()) return;
  $pm.hidden = true;
  $pmBtn.setAttribute('aria-expanded', 'false');
}
$pmBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (pmOpen()) closePm();
  else openPm();
});
$pm.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) {
    e.stopPropagation();
    stepZoom(Number(z.dataset.zoom));
    return;
  }
  if (e.target.closest('a')) closePm();
});
$pm.addEventListener('input', (e) => {
  if (!e.target.matches('[data-shade-range]')) return;
  setLookLevel(Number(e.target.value));
  $pm.querySelector('.shade-top small').textContent = SHADE_NAMES[Number(e.target.value)];
});

// આખી એપમાં શોધ (ઉપરની પટ્ટી): યોજના, દસ્તાવેજ, પ્રસંગ
const $topbar = document.querySelector('.topbar');
const $gs = document.getElementById('gsearch');
const $gr = document.getElementById('gresults');
let gsHits = [];
let gsOn = -1;
function gsearchHits(q) {
  const events = state.events
    .filter((e) => [e.title, e.summary].join(' ').toLowerCase().includes(q))
    .map((e) => ({ href: `#/event/${e.id}`, html: `<span class="emo" aria-hidden="true" style="font-size:1.2rem">${e.icon}</span><span><b>${esc(e.title)}</b><small>જીવનનો પ્રસંગ</small></span>` }));
  const items = [...visible(state.schemes), ...state.docs]
    .filter((s) => searchText(s).includes(q))
    .map((s) => ({ href: itemHref(s), html: `${itemTile(s, state.profile).replace('class="tile', 'class="tile sm')}<span><b>${esc(s.title)}</b><small>${isDoc(s) ? 'દસ્તાવેજ' : 'યોજના'}</small></span>` }));
  return [...items, ...events];
}
function renderGs() {
  const q = $gs.value.trim().toLowerCase();
  if (!q) {
    $gr.hidden = true;
    return;
  }
  const all = gsearchHits(q);
  gsHits = all.slice(0, 8);
  gsOn = gsHits.length ? 0 : -1;
  $gr.innerHTML = gsHits.length
    ? gsHits.map((h, i) => `<a href="${h.href}" class="${i === gsOn ? 'on' : ''}">${h.html}</a>`).join('') +
      (all.length > gsHits.length ? `<a class="all" href="#/all?q=${encodeURIComponent($gs.value.trim())}">બધાં ${all.length} પરિણામ જુઓ</a>` : '')
    : `<p>કંઈ મળ્યું નહીં. બીજો શબ્દ લખી જુઓ, જેમ કે "પેન્શન" કે "aavak".</p>`;
  $gr.hidden = false;
}
function closeGs(clear) {
  $gr.hidden = true;
  if (clear) $gs.value = '';
  $topbar.classList.remove('searching');
}
$gs.addEventListener('input', renderGs);
$gs.addEventListener('focus', () => $gs.value && renderGs());
$gs.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGs(true);
    $gs.blur();
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && gsHits.length) {
    e.preventDefault();
    gsOn = (gsOn + (e.key === 'ArrowDown' ? 1 : -1) + gsHits.length) % gsHits.length;
    $gr.querySelectorAll('a').forEach((a, i) => a.classList.toggle('on', i === gsOn));
  } else if (e.key === 'Enter' && gsHits[gsOn]) {
    e.preventDefault();
    location.hash = gsHits[gsOn].href;
    closeGs(true);
    $gs.blur();
  }
});
$gr.addEventListener('click', (e) => {
  if (e.target.closest('a')) closeGs(true);
});
document.getElementById('search-open').addEventListener('click', () => {
  $topbar.classList.add('searching');
  $gs.focus();
});
document.getElementById('search-close').addEventListener('click', () => closeGs(true));
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
    if (document.body.classList.contains('bare')) return;
    e.preventDefault();
    if (getComputedStyle(document.getElementById('top-search')).display === 'none') $topbar.classList.add('searching');
    $gs.focus();
    $gs.select();
  }
});

// બહાર ક્લિક = ખુલ્લાં મેનુ / લિસ્ટ બંધ
document.addEventListener('click', (e) => {
  if (!e.target.closest('.pm')) closePm();
  if (!e.target.closest('.top-search') && !e.target.closest('#search-open')) $gr.hidden = true;
  if (!e.target.closest('.dd')) document.querySelectorAll('.dd.open').forEach(closeDd);
});

// 🔔 આજે શું નવું: નહીં જોયેલી પોસ્ટનો નંબર
function renderBell() {
  const seen = store.getSeenUpdates();
  const n = seen ? state.updates.filter((u) => !seen.includes(u.id)).length : state.updates.length;
  const b = document.getElementById('bell-badge');
  b.textContent = n > 9 ? '9+' : String(n);
  b.hidden = !n;
  document.getElementById('bell').setAttribute('aria-label', n ? `આજે શું નવું: ${n}` : 'આજે શું નવું');
}

// 📞 ઇમરજન્સી નંબર (યુઝર 24/11/26): હોમ પર નહીં, ઉપરની પટ્ટીના બટનથી પૉપઅપ. ટેપ કરો એટલે ફોન લાગે.
function openHelplines() {
  const list = state.helplines;
  openModal(`
    <div class="dialog-head"><h2>ઇમરજન્સી નંબર</h2><button class="top-btn" type="button" data-close="1" aria-label="બંધ કરો">${icon('close')}</button></div>
    ${list.length
      ? `<div class="help-list one mt">${list.map((h) => `<a class="help-row" href="tel:${esc(h.number)}">${lineTile('call', safeTone(h.tone || 'green'))}<div><div class="num">${esc(h.display || h.number)}</div><div class="t">${esc(h.title)}</div></div>${icon('chev', 'ic chev')}</a>`).join('')}</div>`
      : '<p>નંબર લોડ ન થયા. ઇન્ટરનેટ ચાલુ કરીને ફરી ખોલો.</p>'}`);
}
const $sos = document.getElementById('sos-btn');
if ($sos) $sos.addEventListener('click', openHelplines);

// ⬆ ઉપર જાઓ (1.2 સ્ક્રીન નીચે ગયા પછી)
const $totop = document.getElementById('totop');
window.addEventListener('scroll', () => ($totop.hidden = window.scrollY < innerHeight * 1.2), { passive: true });
$totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));

function closeDd(dd) {
  dd.classList.remove('open');
  const b = dd.querySelector('.dd-btn');
  if (b) b.setAttribute('aria-expanded', 'false');
}

function appConfirm(msg, okLabel, danger = false) {
  return new Promise((resolve) => {
    openModal(`
      <h2>ખાતરી કરો</h2>
      <p>${esc(msg)}</p>
      <div class="row">
        <button class="btn" data-confirm="0">ના</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="1">${esc(okLabel)}</button>
      </div>`);
    confirmResolve = resolve;
  });
}
let confirmResolve = null;

function shareAppLink() {
  const text = [`*${APP.name}*`, APP.about, '', `મફત એપ: ${appUrl()}`].join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

$modal.addEventListener('click', (e) => {
  const c = e.target.closest('[data-confirm]');
  if (c) {
    const r = confirmResolve;
    confirmResolve = null;
    closeModal();
    if (r) r(c.dataset.confirm === '1');
    return;
  }
  const close = e.target.closest('[data-close]');
  if (close && (close !== e.currentTarget.firstElementChild || e.target === close)) {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    closeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($modal.innerHTML) {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    closeModal();
  }
  if ($drawer.innerHTML) closeDrawer();
  if (pmOpen()) {
    closePm();
    $pmBtn.focus();
  }
  document.querySelectorAll('.dd.open').forEach(closeDd);
});

// ---------- રૂટિંગ ----------

function currentRoute() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/');
  return { name: parts[0] || 'home', arg: decodeURIComponent(parts[1] || ''), params: new URLSearchParams(query) };
}

const VIEW_NAMES = ['home', 'all', 'docs', 'events', 'event', 'scheme', 'saved', 'today', 'help', 'profile', 'contact', 'for', 'must', ...Object.keys(INFO_PAGES)];
const views_known = (n) => VIEW_NAMES.includes(n);

function currentTab() {
  const { name, arg } = currentRoute();
  const item = name === 'scheme' ? findItem(arg) : null;
  return { event: 'events', scheme: item && isDoc(item) ? 'docs' : 'all', for: 'home', must: 'docs' }[name] || (views_known(name) ? name : 'home');
}

function render() {
  const { name, arg, params } = currentRoute();
  let html;
  if (!state.loaded) html = '<div class="empty">લોડ થાય છે…</div>';
  else if (state.error && !state.schemes.length)
    html = `<div class="empty">માહિતી લોડ ન થઈ. ઇન્ટરનેટ ચાલુ કરીને ફરી પ્રયત્ન કરો.<br><br><button class="btn btn-primary" data-action="retry">ફરી પ્રયત્ન કરો</button></div>`;
  else {
    const views = {
      home: viewHome,
      all: () => viewAll(params),
      docs: () => viewDocs(params),
      events: viewEvents,
      event: () => viewEvent(arg),
      scheme: () => viewItem(arg),
      saved: viewSaved,
      today: viewToday,
      help: viewHelp,
      profile: viewProfile,
      contact: () => viewContact(params),
      for: () => viewFor(arg),
      must: viewMust,
    };
    html = INFO_PAGES[name] ? viewInfo(name) : (views[name] || viewHome)();
  }
  $view.innerHTML = html;
  setActiveNav(currentTab());
  if (name === 'today' && state.loaded) store.setSeenUpdates(state.updates.map((u) => u.id));
  renderBell();
  window.scrollTo(0, 0);
}

// ---------- ઘટનાઓ ----------

const readCategories = (form) => [...form.querySelectorAll('input[name="categories"]:checked')].map((i) => i.value);

$view.addEventListener('submit', (e) => {
  const form = e.target;
  e.preventDefault();
  if (form.id === 'contact-form') return sendContact(form);
  const categories = readCategories(form);
  if (form.id === 'profile') {
    const fd = new FormData(form);
    state.profile = {
      categories,
      age: fd.get('age') || '',
      jati: fd.get('jati') || '',
      district: fd.get('district') || '',
      taluka: (fd.get('taluka') || '').trim(),
      occupation: fd.get('occupation') || '',
      income: fd.get('income') || '',
    };
    store.setProfile(state.profile);
    toast('પ્રોફાઇલ સેવ થઈ ✓');
    location.hash = '#/';
  }
});

$view.addEventListener('input', (e) => {
  if (e.target.id === 'home-search') {
    homeQuery = e.target.value;
    document.getElementById('home-results').innerHTML = homeResults();
    return;
  }
  const scope = e.target.dataset && e.target.dataset.scope;
  if (scope && filters[scope]) {
    filters[scope].q = e.target.value;
    refreshList(scope);
  }
});

// ---------- ભૂલ / સૂચન (js/feedback.js): "સંપર્ક અને સૂચન" પેજનું ફોર્મ ----------
// યુઝર 24/11/26: પૉપઅપ નહીં, એક જ પેજ — નામ, મોબાઇલ નંબર (જવાબ માટે, વૈકલ્પિક), ભૂલ / સૂચન અને લખાણ.
// કાર્ડ પરનું "ભૂલ / સૂચન જણાવો" આ પેજ ખોલે છે (?about=<કાર્ડ> થી વિષય ભરાઈ જાય).
const MOBILE_RE = /^[6-9]\d{9}$/;

async function sendContact(form) {
  const msg = form.querySelector('.report-msg');
  const say = (html) => {
    msg.hidden = false;
    msg.innerHTML = html;
  };
  const message = form.message.value.trim();
  const name = form.name.value.trim();
  const phone = form.phone.value.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '');
  const kind = form.kind.value === 'suggestion' ? 'suggestion' : 'problem';
  if (phone && !MOBILE_RE.test(phone)) return say('મોબાઇલ નંબર 10 આંકડાનો લખો (અથવા ખાલી રાખો).');
  if (message.length < 5) return say('થોડું વિગતે લખો.');
  const title = form.dataset.title || '';
  const page = form.dataset.page || '#/contact';
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  const r = await sendFeedback({ kind, message, title, page, name, phone });
  btn.disabled = false;
  if (r === 'ok') {
    form.reset();
    say(`✓ આભાર, મોકલ્યું.${phone ? ' જરૂર હશે તો વોટ્સએપ પર જવાબ આપીશું.' : ''}`);
    toast('આભાર, એડમિનને મોકલ્યું.');
    return;
  }
  const wa = contactLink(`${APP.name}: ${title ? `"${title}" ` : ''}${kind === 'problem' ? 'ભૂલ' : 'સૂચન'}\n${message}${name ? `\n\nનામ: ${name}` : ''}\n\nપેજ: ${appUrl()}${page}`);
  say(`${r === 'limit' ? 'આજે ઘણા સંદેશ ગયા છે.' : 'હાલ મોકલી શકાયું નહીં.'}${wa ? ` <a href="${wa}" target="_blank" rel="noopener">વોટ્સએપ પર મોકલો</a>` : ' થોડી વાર પછી ફરી પ્રયત્ન કરો.'}`);
}

let inAppNavigations = 0;

$view.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  if (action === 'back') {
    e.preventDefault();
    if (inAppNavigations > 0) history.back();
    else location.hash = el.getAttribute('href') || '#/';
  }

  if (action === 'mine-cat') {
    const c = el.dataset.cat;
    const cats = (state.profile && state.profile.categories) || [];
    const on = !cats.includes(c);
    state.profile = { ...(state.profile || {}), categories: on ? [...cats, c] : cats.filter((x) => x !== c) };
    store.setProfile(state.profile);
    toast(on ? 'પ્રોફાઇલમાં ઉમેર્યું ✓' : 'પ્રોફાઇલમાંથી કાઢ્યું');
    render();
  }
  if (action === 'must') {
    const i = Number(el.dataset.i);
    const ready = store.toggleDoc(id, i);
    const done = ready.includes(i);
    el.setAttribute('aria-pressed', String(done));
    el.closest('li').classList.toggle('done', done);
    const prog = document.getElementById('must-progress');
    if (prog && id === 'must:all') prog.textContent = mustProgress(state.essentials.all.filter((x) => findItem(x.id)), id);
  }
  if (action === 'text-size') {
    store.setZoom(Number(el.dataset.size));
    applyLook();
    render();
  }
  if (action === 'save') {
    const s = findItem(id);
    const now = store.toggleSaved(id);
    el.setAttribute('aria-pressed', String(now));
    el.innerHTML = `${icon('star', now ? 'ic filled' : 'ic')}<span>${now ? 'સેવ થયેલ' : 'સેવ કરો'}</span>`;
    toast(now ? (s.lastDate ? 'સેવ થયું. છેલ્લી તારીખ પહેલાં યાદ કરાવીશું.' : 'સેવ થયું ✓') : 'સેવમાંથી કાઢ્યું');
    if (now && s.lastDate && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  if (action === 'doc') {
    const i = Number(el.dataset.i);
    const ready = store.toggleDoc(id, i);
    const done = ready.includes(i);
    el.classList.toggle('done', done);
    el.setAttribute('aria-pressed', String(done));
    const prog = document.getElementById('doc-progress');
    if (prog) prog.textContent = docProgress(findItem(id), ready);
  }

  if (action === 'event-tick') {
    const i = Number(el.dataset.i);
    const ready = store.toggleDoc(id, i);
    const done = ready.includes(i);
    el.setAttribute('aria-pressed', String(done));
    el.closest('.ev-item').classList.toggle('done', done);
    const ev = state.events.find((x) => 'event:' + x.id === id);
    const prog = document.getElementById('event-progress');
    if (ev && prog) prog.textContent = eventProgress(ev, ready);
  }

  if (action === 'filter') {
    const scope = el.dataset.scope;
    filters[scope].cat = el.dataset.cat;
    const dd = el.closest('.dd');
    if (dd) {
      dd.querySelectorAll('[role=option]').forEach((o) => {
        const on = o === el;
        o.setAttribute('aria-selected', String(on));
        o.querySelector('.tick').textContent = on ? '✓' : '';
      });
      dd.querySelector('.dd-btn b').textContent = el.dataset.cat ? el.childNodes[1].textContent : 'બધા';
      closeDd(dd);
      dd.querySelector('.dd-btn').focus();
    }
    refreshList(scope);
  }

  if (action === 'dd-toggle') {
    const dd = el.closest('.dd');
    const open = !dd.classList.contains('open');
    document.querySelectorAll('.dd.open').forEach(closeDd);
    if (open) {
      dd.classList.add('open');
      el.setAttribute('aria-expanded', 'true');
      const sel = dd.querySelector('[aria-selected=true]');
      if (sel) sel.focus();
    }
  }

  if (action === 'look') {
    setLookLevel(Number(el.dataset.level));
    render();
  }

  if (action === 'clear-filter') {
    const scope = el.dataset.scope;
    filters[scope] = { q: '', cat: '' };
    render();
  }

  if (action === 'install' && state.installPrompt) {
    state.installPrompt.prompt();
    try {
      await state.installPrompt.userChoice;
    } catch {
      /* ignore */
    }
    state.installPrompt = null;
    el.remove();
  }

  if (action === 'reset') {
    const ok = await appConfirm('તમારી પ્રોફાઇલ, સેવ કરેલું અને ✓ ચેકલિસ્ટ આ ફોનમાંથી કાઢી નાખીએ?', 'હા, કાઢી નાખો', true);
    if (!ok) return;
    store.clearAll();
    state.profile = null;
    state.seen = new Set(allItems().map((x) => x.id));
    store.setSeen([...state.seen]);
    location.hash = '#/';
    render();
  }

  if (action === 'retry') {
    state.loaded = false;
    render();
    await loadData();
    render();
  }
});

// થંબનેલનો ફોટો ન ખૂલે (ખોટી લિંક, નેટ નથી) તો ફોટો કાઢો: નીચેનું આપોઆપ થંબનેલ દેખાય.
document.addEventListener(
  'error',
  (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.parentElement && t.parentElement.classList.contains('thumb')) t.remove();
  },
  true
);

window.addEventListener('hashchange', () => {
  inAppNavigations++;
  closeModal();
  closeDrawer();
  closePm();
  closeGs(false);
  render();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  if (currentRoute().name === 'home' && state.loaded) render();
});
window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  toast('એપ ઇન્સ્ટોલ થઈ ગઈ ✓');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  applyLook();
  if (pmOpen()) renderPm();
});

// ---------- શરૂઆત ----------

applyLook();
renderChrome();
document.querySelectorAll('path[data-i]').forEach((p) => p.setAttribute('d', linePath(p.dataset.i)));
document.title = APP.name;
render();
loadData().then(() => {
  render();
  notifyDue();
});

if ('serviceWorker' in navigator) {
  // નવું વર્ઝન આવે એટલે એક વાર આપોઆપ ફરી ખોલવું (પહેલી વાર ઇન્સ્ટોલ વખતે નહીં)
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
