import { APP } from './config.js';
import { CATEGORIES, CATEGORY_BY_ID, JATI, OCCUPATIONS, INCOME, DISTRICTS } from './options.js';
import { store } from './store.js';
import { matches, sortForProfile, isExpired, daysLeft, deadlineText, formatDate } from './match.js';
import { icon, tile, linePath, socialIcon } from './icons.js';
import { INFO_PAGES, INFO_LINKS, INFO_UPDATED } from './pages.js';

const state = {
  schemes: [],
  docs: [],
  docGroups: [],
  events: [],
  jobs: [],
  jobOrgs: [],
  updates: [],
  helplines: [],
  profile: store.getProfile(),
  seen: new Set(store.getSeen() || []),
  installPrompt: null,
  // સ્વાગતનું પગલું (0 = પૂરું). પ્રોફાઇલ ન હોય તો હોમ પર સ્વાગત ખૂલે છે.
  welcomeStep: 0,
  welcomeDraft: { categories: [], age: '', district: '' },
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
const findItem = (id) => state.schemes.find((s) => s.id === id) || state.docs.find((s) => s.id === id) || state.jobs.find((s) => s.id === id);
const isDoc = (s) => s.kind === 'doc';
const isNew = (s) => !state.seen.has(s.id);
const isJob = (s) => s.kind === 'job';
const itemHref = (s) => `#/${isJob(s) ? 'job' : 'scheme'}/${encodeURIComponent(s.id)}`;
const appUrl = () => location.origin + location.pathname;

function markSeen(id) {
  if (state.seen.has(id)) return;
  state.seen.add(id);
  store.setSeen([...state.seen]);
}

// ---------- ડેટા ----------

async function loadData() {
  const get = (f) => fetch('data/' + f, { cache: 'no-cache' }).then((r) => r.json());
  try {
    const [s, u, d, ev] = await Promise.all([
      get('schemes.json'),
      get('updates.json'),
      get('documents.json').catch(() => ({})),
      get('events.json').catch(() => ({})),
    ]);
    const jb = await get('jobs.json').catch(() => ({}));
    state.jobOrgs = jb.orgs || [];
    state.jobs = (jb.jobs || []).map((j) => ({ ...j, kind: 'job', summary: jobLine(j) }));
    state.schemes = s.schemes || [];
    state.updates = u.updates || [];
    state.docs = d.documents || [];
    state.docGroups = d.groups || [];
    state.events = ev.events || [];
    state.dataUpdatedOn = s.updatedOn || null;
    state.error = false;
    // પહેલી વાર: હાલનું બધું "જોયેલું", પછી આવે તે જ "નવું"
    if (store.getSeen() === null) {
      state.seen = new Set([...allItems(), ...state.jobs].map((x) => x.id));
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
  if (isJob(s)) return jobTile(s);
  const cats = (profile && profile.categories) || [];
  return catTile(s.categories.find((c) => cats.includes(c)) || s.categories[0]);
}

function itemCard(s, profile = state.profile) {
  const meta = [];
  if (!isDoc(s)) {
    const d = deadlineText(s);
    if (d.tone !== 'ok') meta.push(`<span class="pill-tag pt-${d.tone}">${icon('clock', 'ic-sm')}${esc(d.text)}</span>`);
  }
  if (store.isSaved(s.id)) meta.push(`<span class="pill-tag pt-saved">${icon('star', 'ic-sm')}સેવ</span>`);
  return `
    <li>
      <a class="item" href="${itemHref(s)}">
        ${isNew(s) ? `<span class="corner corner-new">${icon('sparkle', 'ic-sm')}નવું</span>` : ''}
        ${itemTile(s, profile)}
        <span class="item-body">
          <span class="item-title">${esc(s.title)}</span>
          <span class="item-line">${esc(s.summary)}</span>
          ${meta.length ? `<span class="item-meta">${meta.join('')}</span>` : ''}
        </span>
        ${icon('chev', 'ic chev')}
      </a>
    </li>`;
}

function itemList(items, empty) {
  if (!items.length) return `<div class="empty">${empty}</div>`;
  return `<ul class="list">${items.map((s) => itemCard(s)).join('')}</ul>`;
}

// ફૂટર: દરેક પેજના છેલ્લે (સ્ક્રીનના તળિયે), એક જ જગ્યાએથી. KruPa Digital Hub ના ફૂટર જેવું:
// અમારી એપ · અમને ફોલો કરો · માહિતીનાં પેજ · ©
const extLink = (href, text) => `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a></li>`;
const COPY_FROM = 2026;
function renderFooter() {
  const k = APP.krupa || {};
  const y = new Date().getFullYear();
  const col = (title, items) => (items.length ? `<div class="fcol"><p class="fhead">${title}</p><ul>${items.join('')}</ul></div>` : '');
  document.getElementById('foot').innerHTML = `
    <div class="foot-in">
      <div class="fbrand">
        <a href="#/"><img src="icons/icon-192.png" alt="" width="36" height="36"><b>${esc(APP.name)}</b></a>
        <p>${esc(APP.about)}</p>
      </div>
      ${col('અમારી એપ', [k.digitalHub && extLink(k.digitalHub, 'KruPa Digital Hub'), k.docHub && extLink(k.docHub, 'KruPa Doc Hub')].filter(Boolean))}
      ${col('અમને ફોલો કરો', (APP.social || []).map((l) => extLink(l.href, l.label)))}
      ${col('માહિતી', INFO_LINKS.map((l) => `<li><a href="#/${l.route}">${esc(l.label)}</a></li>`))}
    </div>
    <p class="fcopy">© ${y > COPY_FROM ? `${COPY_FROM}–${y}` : COPY_FROM} KruPa Digital Hub. સર્વ હક્ક સ્વાધીન.</p>`;
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

// ---------- પહેલી વાર ----------

function categoryChoices(selected) {
  return CATEGORIES.map(
    (c) => `
    <label class="choice">
      <input type="checkbox" name="categories" value="${c.id}" ${selected.includes(c.id) ? 'checked' : ''}>
      <span class="choice-body">${tile(c.icon, c.tone)}<span><b>${esc(c.label)}</b><small>${esc(c.hint)}</small></span></span>
    </label>`
  ).join('');
}

// સ્વાગત: 3 પગલાં (પરિચય → તમે કોણ છો → અક્ષરનું કદ). પહેલી વાર કોઈ જાણકાર સેટ કરી આપે તે રીતે.
const WELCOME_STEPS = 3;
const TEXT_SIZES = [
  [100, 'સામાન્ય'],
  [110, 'મોટા'],
  [120, 'ખૂબ મોટા'],
];

function welcomeSteps(step) {
  return `<div class="steps" aria-label="પગલું ${step} / ${WELCOME_STEPS}">${Array.from({ length: WELCOME_STEPS }, (_, i) => `<span class="${i < step ? 'on' : ''}"></span>`).join('')}<b>પગલું ${step} / ${WELCOME_STEPS}</b></div>`;
}

// રંગીન tile પર સફેદ ભરેલા આઇકન (KruPa #135)
const FEATURES = [
  ['book', 'indigo', 'યોજના ગાઇડ', 'કોને મળે, કેટલો લાભ, કયા પુરાવા'],
  ['idcard', 'sky', 'દસ્તાવેજ ગાઇડ', 'આવક, જાતિ, આધાર જેવા દાખલા કેમ કઢાવવા'],
  ['calendar', 'pink', 'જીવનના પ્રસંગ', 'જન્મ, લગ્ન, ઘડપણમાં શું કરવું તેનું લિસ્ટ'],
  ['mobile', 'green', 'વોટ્સએપ પર મોકલો', 'કોઈ પણ માહિતી એક ટેપમાં બીજાને મોકલો'],
];
const featureItems = () => FEATURES.map(([ic, tone, t, d]) => `<li>${tile(ic, tone)}<span><b>${t}</b><small>${d}</small></span></li>`).join('');

// દેખાવ: 0 લાઇટ, 2 વચ્ચેનો (આછો રાખોડી), 3 ડાર્ક — KruPa ની પહેલી ગોઠવણી જેવું
const LOOKS = [
  [0, 'લાઇટ'],
  [2, 'વચ્ચેનો'],
  [3, 'ડાર્ક'],
];

function welcomeBrand() {
  return `
    <section class="wl-brand">
      <div>
        <div class="wl-logo"><img src="icons/icon-192.png" alt="" width="72" height="72"><b>${esc(APP.name)}</b></div>
        <p class="about">${esc(APP.about)}</p>
        <div class="wl-words" aria-hidden="true"><span>સરળ</span><span>ગુજરાતી</span><span>મફત</span></div>
        <ul class="wl-feats">${featureItems()}</ul>
      </div>
    </section>`;
}

function welcomeBody(step) {
  if (step === 1)
    return `
      ${welcomeSteps(1)}
      <h1>${esc(APP.name)} માં સ્વાગત છે</h1>
      <p class="lead">તમે કોણ છો તે પસંદ કરો, એટલે તમારા માટેની યોજના પહેલાં દેખાશે.</p>
      <ul class="feature-grid phone-only">${featureItems()}</ul>
      <button class="btn btn-primary btn-block btn-lg mt" type="button" data-action="welcome-next">શરૂ કરો ${icon('chev')}</button>`;
  if (step === 2) {
    const w = state.welcomeDraft;
    const opt = (list, val) => list.map((d) => `<option ${d === val ? 'selected' : ''}>${esc(d)}</option>`).join('');
    return `
      ${welcomeSteps(2)}
      <form id="onboard" class="stack">
        <fieldset class="card">
          <legend>તમે કોણ છો? એક કે વધુ પસંદ કરો</legend>
          <div class="choice-grid wl-choices">${categoryChoices(w.categories)}</div>
        </fieldset>
        <div class="card form-grid">
          <label class="field">ઉંમર (વર્ષ), વૈકલ્પિક<input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(w.age)}"></label>
          <label class="field">જિલ્લો, વૈકલ્પિક<select name="district"><option value="">— પસંદ કરો —</option>${opt(DISTRICTS, w.district)}</select></label>
        </div>
        <div class="row-split">
          <button class="btn" type="button" data-action="welcome-back">${icon('arrow', 'ic flip')}પાછા</button>
          <button class="btn btn-primary btn-lg" type="submit">આગળ ${icon('chev')}</button>
        </div>
      </form>`;
  }
  const z = store.getZoom();
  const lv = lookLevel();
  return `
      ${welcomeSteps(3)}
      <div class="card stack">
        <h2 class="h2">${icon('eye')}અક્ષર કેટલા મોટા જોઈએ?</h2>
        <div class="size-pick">${TEXT_SIZES.map(([v, label]) => `<button type="button" data-action="text-size" data-size="${v}" aria-pressed="${z === v}">અ<span>${label}</span></button>`).join('')}</div>
      </div>
      <div class="card stack mt">
        <h2 class="h2">${icon('sun')}દેખાવ</h2>
        <div class="look-pick">${LOOKS.map(([v, label]) => `<button type="button" class="l${v}" data-action="look" data-level="${v}" aria-pressed="${lv === v}"><i></i>${label}</button>`).join('')}</div>
      </div>
      <div class="row-split mt">
        <button class="btn" type="button" data-action="welcome-back">${icon('arrow', 'ic flip')}પાછા</button>
        <button class="btn btn-primary btn-lg" type="button" data-action="welcome-done">${icon('published')}પૂરું, એપ ખોલો</button>
      </div>`;
}

function viewWelcome() {
  return `
    <div class="wl">
      ${welcomeBrand()}
      <section class="wl-main"><div class="wl-in">${welcomeBody(state.welcomeStep)}</div></section>
    </div>`;
}

// ---------- હોમ (KruPa Digital Hub ના હોમ જેવું) ----------

let homeQuery = '';
let homeTab = 'mine';
let homeMore = false;

function homeResults() {
  const q = homeQuery.trim().toLowerCase();
  if (!q) return '';
  const hits = [...visible(state.schemes), ...state.docs].filter((s) => searchText(s).includes(q)).slice(0, 30);
  return `
    <h2 class="section-title">${icon('search')}શોધનું પરિણામ <span class="count">${hits.length}</span></h2>
    ${itemList(hits, 'કંઈ મળ્યું નહીં. બીજો શબ્દ લખી જુઓ, જેમ કે "પેન્શન" કે "aavak".')}`;
}

// એક હાર: tile + નામ + નાની લીટી + › (KruPa ના હોમની યાદી જેવું)
function rowItem(s) {
  let tag = '';
  if (!isDoc(s)) {
    const d = deadlineText(s);
    if (d.tone === 'urgent' || d.tone === 'soon') tag = `<span class="tag ${d.tone}">${esc(d.text)}</span>`;
  }
  if (!tag && isNew(s)) tag = '<span class="tag">નવું</span>';
  const sub = isDoc(s) ? (groupOf(s.group) || {}).label || 'દસ્તાવેજ' : s.summary;
  return `<li><a class="ri" href="${itemHref(s)}">${itemTile(s, state.profile)}<span><b>${esc(s.title)}</b><small>${esc(sub)}</small></span>${tag}${icon('chev', 'ic-sm chev')}</a></li>`;
}

function homeTabItems(p) {
  const mine = sortForProfile(visible(state.schemes).filter((s) => matches(s, p)), p);
  if (homeTab === 'new') return mine.filter(isNew);
  if (homeTab === 'saved') return store.getSaved().map(findItem).filter(Boolean);
  return mine.sort((a, b) => Number(isNew(b)) - Number(isNew(a)));
}

function homeMineBox(p) {
  const mine = sortForProfile(visible(state.schemes).filter((s) => matches(s, p)), p);
  const fresh = mine.filter(isNew).length;
  const savedN = store.getSaved().length;
  const tabs = [
    ['mine', 'user', `તમારા માટે ${mine.length}`],
    ['new', 'sparkle', `નવી ${fresh}`],
    ['saved', 'star', `સેવ ${savedN}`],
  ];
  const items = homeTabItems(p);
  const LIMIT = 8;
  const shown = homeMore ? items : items.slice(0, LIMIT);
  const empty = {
    mine: 'તમારા વર્ગ માટે હજુ યોજના નથી. <a href="#/all">બધી યોજના જુઓ</a>',
    new: 'છેલ્લી મુલાકાત પછી કોઈ નવી યોજના નથી.',
    saved: 'હજુ કંઈ સેવ નથી. યોજના ખોલીને "સેવ કરો" દબાવો.',
  }[homeTab];
  return `
    <section id="home-mine">
      <h2 class="box-title">${icon('book')}તમારા માટેની યોજના</h2>
      <div class="rbox">
        <div class="rtabs" role="group" aria-label="યાદી પસંદ કરો">${tabs.map(([id, ic, label]) => `<button type="button" data-action="home-tab" data-tab="${id}" aria-pressed="${homeTab === id}">${icon(ic, 'ic-sm')}${label}</button>`).join('')}</div>
        ${shown.length ? `<ul class="rlist">${shown.map(rowItem).join('')}</ul>` : `<p class="rempty">${empty}</p>`}
        ${items.length > LIMIT && !homeMore ? `<button type="button" class="rmore" data-action="home-more">${icon('chevdown', 'ic-sm')}વધુ ${items.length - LIMIT} બતાવો</button>` : ''}
      </div>
    </section>`;
}

function homeEventsBox(p) {
  const isMine = (e) => e.categories.some((c) => p.categories.includes(c));
  const evs = [...state.events].sort((a, b) => Number(isMine(b)) - Number(isMine(a))).slice(0, 6);
  return `
    <section>
      <h2 class="box-title">${icon('calendar')}જીવનના પ્રસંગ</h2>
      <div class="rbox">
        <ul class="rlist">${evs
          .map((e) => {
            const n = store.getDocs('event:' + e.id).filter((i) => i < e.items.length).length;
            return `<li><a class="ri" href="#/event/${e.id}"><span class="emo" aria-hidden="true">${e.icon}</span><span><b>${esc(e.title)}</b><small>${n ? `${n} / ${e.items.length} થઈ ગયું` : `${e.items.length} કામ`}</small></span>${isMine(e) ? '<span class="tag">તમારા માટે</span>' : ''}${icon('chev', 'ic-sm chev')}</a></li>`;
          })
          .join('')}</ul>
        <a class="rmore" href="#/events">બધા ${state.events.length} પ્રસંગ ${icon('arrow', 'ic-sm')}</a>
      </div>
    </section>`;
}

function homeDocsBox() {
  const docs = state.docs.slice(0, 6);
  return `
    <section>
      <h2 class="box-title">${icon('folder')}દસ્તાવેજ ગાઇડ</h2>
      <div class="rbox">
        <ul class="rlist">${docs.map(rowItem).join('')}</ul>
        <a class="rmore" href="#/docs">બધા ${state.docs.length} દસ્તાવેજ ${icon('arrow', 'ic-sm')}</a>
      </div>
      <h2 class="box-title" style="margin-top:1.5rem">${icon('phone')}જરૂરી ફોન નંબર</h2>
      <div class="rbox">
        <ul class="rlist">${state.helplines
          .slice(0, 3)
          .map((h) => `<li><a class="ri" href="tel:${esc(h.number)}">${tile('phone', h.tone || 'green')}<span><b>${esc(h.display || h.number)}</b><small>${esc(h.title)}</small></span>${icon('chev', 'ic-sm chev')}</a></li>`)
          .join('')}</ul>
        <a class="rmore" href="#/help">બધા નંબર ${icon('arrow', 'ic-sm')}</a>
      </div>
    </section>`;
}

function viewHome() {
  const p = state.profile;
  if (state.welcomeStep || !p || !p.categories || !p.categories.length) {
    if (!state.welcomeStep) state.welcomeStep = 1;
    return viewWelcome();
  }
  const latest = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  const count = (c) => visible(state.schemes).filter((s) => s.categories.includes(c)).length;
  return `
    ${state.installPrompt ? `<button class="note note-info btn-block" style="border:0;cursor:pointer;text-align:left;margin-bottom:1rem" data-action="install">${icon('plus')}<span><strong>એપ ફોનમાં ઇન્સ્ટોલ કરો</strong>: હોમ સ્ક્રીન પરથી સીધી ખૂલશે.</span></button>` : ''}
    ${reminderNote()}
    <section class="scard">
      <div class="scard-in">
        <h2>શું જાણવું છે?</h2>
        <label class="search-big">${icon('search')}
          <input id="home-search" type="search" placeholder="યોજના કે દાખલો શોધો… (જેમ કે પેન્શન, આવક)" value="${esc(homeQuery)}" aria-label="શોધો">
        </label>
        <div class="mchips">
          ${p.categories.map((c) => `<a class="mchip" href="#/all?c=${c}">${esc(CATEGORY_BY_ID[c].label)} <span class="count">${count(c)}</span></a>`).join('')}
          <a class="mchip" href="#/docs">દસ્તાવેજ <span class="count">${state.docs.length}</span></a>
          <a class="mlink" href="#/all">બધી યોજના ${icon('arrow', 'ic-sm')}</a>
        </div>
      </div>
    </section>
    ${latest ? `
      <a class="tip ${latest.type === 'chetavani' ? 'warn' : ''}" href="#/today">${icon(latest.type === 'chetavani' ? 'alert' : 'bulb')}
        <span><b>${latest.type === 'chetavani' ? 'ચેતવણી' : 'આજે નવું'}:</b> ${esc(latest.title)} <span class="go">જુઓ →</span></span>
      </a>` : ''}
    <div id="home-results">${homeResults()}</div>
    <div class="home-grid">
      ${homeJobsBox()}
      ${homeMineBox(p)}
      ${homeEventsBox(p)}
      ${homeDocsBox()}
    </div>
    ${otherApps()}
    ${followUs()}`;
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

const filters = { all: { q: '', cat: '' }, docs: { q: '', cat: '' }, jobs: { q: '', cat: '' } };

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
  if (scope === 'jobs') return visibleJobs().filter((j) => (!f.cat || j.type === f.cat) && (!q || jobSearchText(j).includes(q)));
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

const countLabel = (scope) => `કુલ ${filtered(scope).length} ${{ docs: 'દસ્તાવેજ', jobs: '' }[scope] ?? 'યોજના'}`.trim();

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
    (scope === 'jobs' ? visibleJobs().filter((j) => j.type === id) : scope === 'docs' ? state.docs.filter((s) => s.group === id) : visible(state.schemes).filter((s) => s.categories.includes(id))).length;
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
    <div class="event-grid">${sorted
      .map((e) => {
        const n = store.getDocs('event:' + e.id).filter((i) => i < e.items.length).length;
        return `
      <a class="event-card" href="#/event/${e.id}">
        ${isMine(e) ? `<span class="corner">તમારા માટે</span>` : ''}
        <span class="emo" aria-hidden="true">${e.icon}</span>
        <b>${esc(e.title)}</b>
        <span class="muted">${n ? `${n} / ${e.items.length} થઈ ગયું` : `${e.items.length} કામ`}</span>
      </a>`;
      })
      .join('')}</div>`;
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
    <div class="detail-head"><span class="tile" style="background:var(--primary-soft);font-size:1.6rem">${e.icon}</span>
      <div><h1>${esc(e.title)}</h1><p class="lead">${esc(e.summary)}</p></div>
    </div>
    <p class="progress mt" id="event-progress">${eventProgress(e, ready)}</p>
    <div class="parts one" style="margin-top:1rem">
      <div class="parts-main">
        ${docs.length ? `<section class="part"><h2><span class="sq">${icon('forms')}</span>કરવાનાં કામ / દસ્તાવેજ</h2><ul class="ev-list">${docs.map(row).join('')}</ul></section>` : ''}
        ${helps.length ? `<section class="part"><h2><span class="sq">${icon('gift')}</span>મળી શકે એવી સહાય</h2><ul class="ev-list">${helps.map(row).join('')}</ul></section>` : ''}
      </div>
    </div>`;
}

// ---------- ભરતી (નવી ભરતી, કોલ લેટર, આન્સર કી, પરિણામ) ----------
// ડેટા: data/jobs.json. ફક્ત સત્તાવાર સાઇટની લિંક; લખાણ આપણું.

const JOB_TYPES = {
  bharti: { label: 'ભરતી', icon: 'briefcase', tone: 'blue' },
  callletter: { label: 'કોલ લેટર', icon: 'idcard', tone: 'teal' },
  answerkey: { label: 'આન્સર કી', icon: 'clipboard', tone: 'amber' },
  result: { label: 'પરિણામ', icon: 'certificate', tone: 'green' },
};
const JOB_CHIPS = Object.entries(JOB_TYPES).map(([id, t]) => ({ id, label: t.label }));
// કોલ લેટર, આન્સર કી, પરિણામ કેટલા દિવસ દેખાય
const JOB_SHOW_DAYS = 45;

const jobOrg = (j) => state.jobOrgs.find((o) => o.id === j.org) || { label: j.org, short: j.org };
const jobTile = (j, size = '') => tile(JOB_TYPES[j.type].icon, JOB_TYPES[j.type].tone, size);

function jobLine(j) {
  const org = jobOrg(j).short || jobOrg(j).label;
  if (j.type === 'bharti') return [org, j.posts ? `${j.posts} જગ્યા` : '', j.lastDate ? `છેલ્લી તારીખ ${formatDate(j.lastDate)}` : ''].filter(Boolean).join(' · ');
  return [org, JOB_TYPES[j.type].label, formatDate(j.date)].filter(Boolean).join(' · ');
}

function jobSearchText(j) {
  const o = jobOrg(j);
  return [j.title, j.advtNo, j.qualification, o.label, o.short, JOB_TYPES[j.type].label].join(' ').toLowerCase();
}

function visibleJobs() {
  const since = new Date(Date.now() - JOB_SHOW_DAYS * 864e5).toISOString().slice(0, 10);
  return state.jobs
    .filter((j) => (j.type === 'bharti' ? !isExpired(j) : (j.date || '') >= since))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function viewJobs(params) {
  if (params && params.get('t') !== null) filters.jobs.cat = params.get('t');
  if (!state.jobs.length) {
    return `${pageHead('ભરતી', 'સરકારી ભરતી, કોલ લેટર, આન્સર કી અને પરિણામ', 'briefcase', '#/')}
      <div class="empty">નવી ભરતી ટૂંક સમયમાં અહીં આવશે.</div>`;
  }
  return listPage('jobs', 'ભરતી', 'સરકારી ભરતી, કોલ લેટર, આન્સર કી અને પરિણામ', 'briefcase', 'ભરતી શોધો… (જેમ કે ક્લાર્ક, પોલીસ)', JOB_CHIPS, 'પ્રકાર');
}

function jobShareText(j) {
  const lines = [`*${j.title}*`, jobOrg(j).label];
  if (j.posts) lines.push(`👥 જગ્યા: ${j.posts}`);
  if (j.qualification) lines.push(`🎓 લાયકાત: ${j.qualification}`);
  if (j.lastDate) lines.push(`📅 છેલ્લી તારીખ: ${formatDate(j.lastDate)}`);
  lines.push(`🔗 ${j.applyLink || j.notification}`, '', `વિગત ગુજરાતીમાં: ${appUrl()}${itemHref(j)}`);
  return lines.join('\n');
}

function viewJob(id) {
  const j = state.jobs.find((x) => x.id === id);
  if (!j) return `<div class="empty">આ ભરતી મળી નહીં. <a href="#/jobs">બધી ભરતી</a></div>`;
  markSeen(j.id);
  const t = JOB_TYPES[j.type];
  const org = jobOrg(j);
  const saved = store.isSaved(j.id);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(jobShareText(j));
  const d = j.lastDate ? deadlineText(j) : null;
  const facts = [
    ['users', 'જગ્યા', j.posts ? String(j.posts) : ''],
    ['forms', 'જાહેરાત ક્રમાંક', j.advtNo],
    ['calendar', 'ફોર્મ શરૂ', j.startDate ? formatDate(j.startDate) : ''],
    ['clock', 'છેલ્લી તારીખ', j.lastDate ? formatDate(j.lastDate) : ''],
    ['banknote', 'ફી', j.fee],
    ['hourglass', 'ઉંમર', j.age],
  ].filter(([, , v]) => v);
  const isPdf = /\.pdf($|\?)/i.test(j.notification || '');
  return `
    <nav class="crumb"><a class="back-btn" href="#/jobs" data-action="back" aria-label="પાછા">${icon('arrow')}</a><a href="#/jobs">ભરતી</a>${j.type === 'bharti' ? '' : ` › <span>${esc(t.label)}</span>`}</nav>
    <div class="detail-head${pic(j.image) ? ' has-pic' : ''}">
      ${pic(j.image) ? `<img class="hero-pic" src="${esc(pic(j.image))}" alt="${esc(j.title)}" decoding="async">` : jobTile(j)}
      <div><h1>${esc(j.title)}</h1><p class="lead">${esc(org.label)}</p></div>
    </div>
    ${d && d.tone !== 'ok' ? `<p class="progress mt">${icon('clock', 'ic-sm')} ${esc(d.text)}</p>` : ''}
    <div class="actions">
      ${j.applyLink ? `<a class="btn btn-kesari" href="${esc(j.applyLink)}" target="_blank" rel="noopener">${icon('external')}${j.type === 'bharti' ? 'સત્તાવાર સાઇટ પર અરજી' : `${esc(t.label)} જુઓ`}</a>` : ''}
      ${j.notification ? `<a class="btn" href="${esc(j.notification)}" target="_blank" rel="noopener">${icon('forms')}સત્તાવાર જાહેરાત${isPdf ? ' (PDF)' : ''}</a>` : ''}
      <button class="btn" data-action="save" data-id="${esc(j.id)}" aria-pressed="${saved}">${icon('star', saved ? 'ic filled' : 'ic')}<span>${saved ? 'સેવ થયેલ' : 'સેવ કરો'}</span></button>
      <a class="btn btn-ok" href="${wa}" target="_blank" rel="noopener">${icon('share')}વોટ્સએપ પર મોકલો</a>
    </div>
    ${j.qualification ? `<div class="facts-main"><div class="fact"><span class="sq">${icon('book')}</span><div><div class="k">લાયકાત</div><div class="v">${esc(j.qualification)}</div></div></div></div>` : ''}
    ${facts.length ? `<div class="facts-small">${facts.map(([ic, k, v]) => `<div class="fact">${icon(ic)}<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div></div>`).join('')}</div>` : ''}
    <div class="card side-box mt">
      <h3>${icon('book')}સ્રોત</h3>
      <div class="sources"><a href="${esc(j.notification || j.applyLink)}" target="_blank" rel="noopener">${esc(j.source)}</a><span>છેલ્લે અપડેટ: ${esc(formatDate(j.updatedOn))}</span>${j.verified ? '' : '<span>ચકાસણી બાકી: અરજી પહેલાં સત્તાવાર જાહેરાત વાંચો.</span>'}</div>
    </div>`;
}

function homeJobsBox() {
  const jobs = visibleJobs().slice(0, 6);
  if (!jobs.length) return '';
  return `
    <section>
      <h2 class="box-title">${icon('briefcase')}નવી ભરતી</h2>
      <div class="rbox">
        <ul class="rlist">${jobs.map(rowItem).join('')}</ul>
        <a class="rmore" href="#/jobs">બધી ${visibleJobs().length} ભરતી ${icon('arrow', 'ic-sm')}</a>
      </div>
    </section>`;
}

// ---------- વિગતનું પેજ ----------

const KIND_TEXT = {
  scheme: { benefit: 'લાભ', who: 'કોને મળે', steps: 'અરજીનાં પગલાં', where: 'ક્યાં અરજી કરવી', apply: 'સત્તાવાર સાઇટ પર અરજી', list: 'યોજના ગાઈડ', listHref: '#/all' },
  doc: { benefit: 'ક્યાં કામ આવે', who: 'કોણ કઢાવી શકે', steps: 'કઢાવવાનાં પગલાં', where: 'ક્યાંથી કઢાવવું', apply: 'અરજીની વેબસાઇટ ખોલો', list: 'દસ્તાવેજ ગાઈડ', listHref: '#/docs' },
};
const kindText = (s) => KIND_TEXT[isDoc(s) ? 'doc' : 'scheme'];

function shareText(s) {
  const k = kindText(s);
  const lines = [`*${s.title}*`, s.summary, '', `✅ ${k.benefit}: ${s.benefit}`, `📄 પુરાવા: ${s.documents.join(', ')}`];
  if (s.fee) lines.push(`💰 ફી: ${s.fee}`);
  if (!isDoc(s)) lines.push(`📅 ${s.lastDate ? 'છેલ્લી તારીખ: ' + formatDate(s.lastDate) : 'ચાલુ યોજના'}`);
  lines.push(`🔗 ${s.officialLink}`, '', `પૂરાં પગલાં ગુજરાતીમાં: ${appUrl()}${itemHref(s)}`);
  return lines.join('\n');
}

const dots = (arr) => `<ul class="dots">${arr.map((t) => `<li><span>${esc(t)}</span></li>`).join('')}</ul>`;
const part = (title, ic, body, cls = '') => `<section class="part ${cls}"><h2><span class="sq">${icon(ic)}</span>${title}</h2>${body}</section>`;

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

// પગલાનો ફોટો (Digital Hub ના screenshot): stepImages[i]
const stepPic = (s, i) => {
  const u = pic((s.stepImages || [])[i]);
  return u ? `<img class="step-pic" src="${esc(u)}" alt="પગલું ${i + 1}" loading="lazy" decoding="async">` : '';
};

function viewItem(id) {
  const s = findItem(id);
  if (!s) return `<div class="empty">આ માહિતી મળી નહીં. <a href="#/">હોમ પર જાઓ</a></div>`;
  const k = kindText(s);
  const wasNew = isNew(s);
  markSeen(s.id);
  const saved = store.isSaved(s.id);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(shareText(s));
  const events = state.events.filter((e) => e.items.some((it) => it.itemId === s.id));
  const small = [
    ['clock', 'કેટલા દિવસ', s.days],
    ['banknote', 'ફી', s.fee],
    ['hourglass', 'માન્યતા', s.validity],
    ...(isDoc(s) ? [] : [['calendar', 'છેલ્લી તારીખ', s.lastDate ? formatDate(s.lastDate) : 'ચાલુ યોજના']]),
  ].filter(([, , v]) => v);
  const sources = (s.sources && s.sources.length ? s.sources : [{ label: s.source, url: s.officialLink }])
    .map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`)
    .join('');
  return `
    <nav class="crumb">
      <a class="back-btn" href="${k.listHref}" data-action="back" aria-label="પાછા">${icon('arrow')}</a>
      <a href="${k.listHref}">${k.list}</a>${isDoc(s) && groupOf(s.group) ? ` › <span>${esc(groupOf(s.group).label)}</span>` : ''}
    </nav>
    <div class="detail-head${pic(s.image) ? ' has-pic' : ''}">
      ${pic(s.image) ? `<img class="hero-pic" src="${esc(pic(s.image))}" alt="${esc(s.title)}" decoding="async">` : itemTile(s, state.profile)}
      <div>
        <h1>${esc(s.title)}</h1>
        <p class="lead">${esc(s.summary)}</p>
      </div>
    </div>
    ${events.length ? `<div class="related"><span>આ પ્રસંગમાં કામ આવે:</span>${events.map((e) => `<a class="chip" href="#/event/${e.id}"><span aria-hidden="true">${e.icon}</span>${esc(e.title)}</a>`).join('')}</div>` : ''}
    <div class="actions">
      <a class="btn btn-kesari" href="${esc(s.officialLink)}" target="_blank" rel="noopener">${icon('external')}${k.apply}</a>
      <button class="btn" data-action="save" data-id="${esc(s.id)}" aria-pressed="${saved}">${icon('star', saved ? 'ic filled' : 'ic')}<span>${saved ? 'સેવ થયેલ' : 'સેવ કરો'}</span></button>
      <a class="btn btn-ok" href="${wa}" target="_blank" rel="noopener">${icon('share')}વોટ્સએપ પર મોકલો</a>
    </div>
    <div class="facts-main">
      <div class="fact">${'<span class="sq">' + icon('users') + '</span>'}<div><div class="k">${k.who}</div><div class="v">${s.eligibility.map(esc).join('<br>')}</div></div></div>
      <div class="fact good"><span class="sq">${icon('gift')}</span><div><div class="k">${k.benefit}</div><div class="v">${esc(s.benefit)}</div></div></div>
    </div>
    ${small.length ? `<div class="facts-small">${small.map(([ic, kk, v]) => `<div class="fact">${icon(ic)}<div><div class="k">${kk}</div><div class="v">${esc(v)}</div></div></div>`).join('')}</div>` : ''}
    <div class="parts">
      <div class="parts-main">
        ${part('કયા પુરાવા જોઈએ', 'list', docChecklist(s))}
        ${s.howToApply ? part(k.where, 'pin', `<p>${esc(s.howToApply)}</p>`) : ''}
        ${s.steps && s.steps.length ? part(k.steps, 'forms', `<ol class="timeline">${s.steps.map((t, i) => `<li><span class="num">${i + 1}</span><div class="txt">${esc(t)}${stepPic(s, i)}</div></li>`).join('')}</ol>`) : ''}
        ${s.mistakes && s.mistakes.length ? part('આ ભૂલો ન કરો', 'alert', dots(s.mistakes), 'warn') : ''}
        ${s.after && s.after.length ? part('અરજી પછી', 'hourglass', dots(s.after)) : ''}
      </div>
      <aside class="parts-side">
        ${reportLink(s) ? `<div class="card side-box">
          <h3>${icon('alert')}માહિતીમાં ભૂલ છે?</h3>
          <p class="small muted">ફી, તારીખ કે નિયમ બદલાયા હોય તો જણાવો, અમે ચકાસીને સુધારીશું.</p>
          <a class="btn" href="${reportLink(s)}" target="_blank" rel="noopener">${icon('message')}ભૂલ જણાવો</a>
        </div>` : ''}
        <div class="card side-box">
          <h3>${icon('book')}સ્રોત</h3>
          <div class="sources">${sources}<span>છેલ્લે અપડેટ: ${esc(formatDate(s.updatedOn))}</span>${s.verified ? '' : '<span>ચકાસણી બાકી: અરજી પહેલાં સત્તાવાર સાઇટ પર ખાતરી કરો.</span>'}</div>
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
    <div class="help-list">${
      state.helplines
        .map(
          (h) => `
      <a class="help-row" href="tel:${esc(h.number)}">
        <span class="tile tone-${esc(h.tone || 'blue')}">${icon('phone')}</span>
        <div><div class="num">${esc(h.display || h.number)}</div><div class="t">${esc(h.title)}</div></div>
        <span class="call">${icon('phone', 'ic-sm')}ફોન</span>
      </a>`
        )
        .join('') || '<div class="empty">નંબર લોડ ન થયા.</div>'
    }</div>`;
}

function viewProfile() {
  const p = state.profile || { categories: [] };
  const opt = (items, val) =>
    items
      .map((i) => {
        const id = typeof i === 'string' ? i : i.id;
        const label = typeof i === 'string' ? i : i.label;
        return `<option value="${esc(id)}" ${val === id ? 'selected' : ''}>${esc(label)}</option>`;
      })
      .join('');
  return `
    ${pageHead('મારી પ્રોફાઇલ', 'બધું વૈકલ્પિક છે.', 'user', '#/')}
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
  const others = INFO_LINKS.filter((l) => l.route !== route);
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
    </article>
    <nav class="info-more" aria-label="બીજાં પેજ">${others.map((l) => `<a href="#/${l.route}">${icon(l.ic, 'ic-sm')}${esc(l.label)}</a>`).join('')}</nav>`;
}

// ---------- સંપર્ક ----------

const hasContact = () => Boolean(APP.contact && (APP.contact.whatsapp || APP.contact.email));

function contactLink(text, subject = APP.name) {
  const c = APP.contact || {};
  if (c.whatsapp) return `https://wa.me/${encodeURIComponent(c.whatsapp)}?text=${encodeURIComponent(text)}`;
  if (c.email) return `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return '';
}

const reportLink = (s) =>
  contactLink(`${APP.name}: "${s.title}" માં ભૂલ છે.\nશું ખોટું છે:\n\nસાચી માહિતીની લિંક (હોય તો):\n\nકાર્ડ: ${appUrl()}${itemHref(s)}`, 'માહિતીમાં ભૂલ: ' + s.title);

function viewContact() {
  const c = APP.contact || {};
  const rows = [
    c.whatsapp && `<a class="help-row" href="${contactLink(`${APP.name} વિશે:\n`)}" target="_blank" rel="noopener">${lineTile('chat', 'green')}<div><div class="num">વોટ્સએપ</div><div class="t">સૂચન, ભૂલ કે નવી યોજનાની માહિતી મોકલો</div></div>${icon('chev', 'ic chev')}</a>`,
    c.email && `<a class="help-row" href="mailto:${esc(c.email)}">${lineTile('message', 'blue')}<div><div class="num">ઈમેલ</div><div class="t">${esc(c.email)}</div></div>${icon('chev', 'ic chev')}</a>`,
  ].filter(Boolean);
  return `
    ${pageHead('સંપર્ક અને સૂચન', 'ભૂલ દેખાય કે સૂચન હોય તો જણાવો.', 'message', '#/')}
    ${rows.length ? `<div class="help-list">${rows.join('')}</div>` : `<div class="empty">સંપર્કની વિગત ટૂંક સમયમાં ઉમેરાશે.</div>`}`;
}

// ---------- ખોખું: બાજુનું મેનુ, નીચેનાં ટેબ, "વધુ", 👤 મેનુ, ઝૂમ, દેખાવ, શોધ (KruPa Digital Hub જેવું) ----------

const NAV = [
  { route: 'home', href: '#/', ic: 'home', label: 'હોમ' },
  { route: 'jobs', href: '#/jobs', ic: 'briefcase', label: 'ભરતી' },
  { route: 'all', href: '#/all', ic: 'book', label: 'યોજના ગાઇડ', short: 'યોજના' },
  { route: 'docs', href: '#/docs', ic: 'folder', label: 'દસ્તાવેજ ગાઇડ', short: 'દસ્તાવેજ' },
  { route: 'events', href: '#/events', ic: 'calendar', label: 'જીવનના પ્રસંગ', short: 'પ્રસંગ' },
  { route: 'saved', href: '#/saved', ic: 'star', label: 'સેવ કરેલ' },
  { route: 'today', href: '#/today', ic: 'bell', label: 'આજે શું નવું' },
  { route: 'help', href: '#/help', ic: 'phone', label: 'જરૂરી ફોન નંબર' },
  { group: 'મદદ' },
  { route: 'contact', href: '#/contact', ic: 'message', label: 'સંપર્ક અને સૂચન' },
  { route: 'about', href: '#/about', ic: 'info', label: 'અમારા વિશે' },
];
// ભરતી હોય ત્યારે જ "ભરતી" ટેબ (નહીં તો નીચે "પ્રસંગ")
const tabRoutes = () => (state.jobs.length ? ['home', 'jobs', 'all', 'docs'] : ['home', 'all', 'docs', 'events']);
const navItems = () => NAV.filter((n) => n.route !== 'jobs' || state.jobs.length);

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
  const jobs = visibleJobs()
    .filter((j) => jobSearchText(j).includes(q))
    .map((j) => ({ href: itemHref(j), html: `${jobTile(j, 'sm')}<span><b>${esc(j.title)}</b><small>${esc(JOB_TYPES[j.type].label)}</small></span>` }));
  return [...jobs, ...items, ...events];
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

const VIEW_NAMES = ['home', 'jobs', 'job', 'all', 'docs', 'events', 'event', 'scheme', 'saved', 'today', 'help', 'profile', 'contact', ...Object.keys(INFO_PAGES)];
const views_known = (n) => VIEW_NAMES.includes(n);

function currentTab() {
  const { name, arg } = currentRoute();
  const item = name === 'scheme' ? findItem(arg) : null;
  return { event: 'events', job: 'jobs', scheme: item && isDoc(item) ? 'docs' : 'all' }[name] || (views_known(name) ? name : 'home');
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
      jobs: () => viewJobs(params),
      job: () => viewJob(arg),
      all: () => viewAll(params),
      docs: () => viewDocs(params),
      events: viewEvents,
      event: () => viewEvent(arg),
      scheme: () => viewItem(arg),
      saved: viewSaved,
      today: viewToday,
      help: viewHelp,
      profile: viewProfile,
      contact: viewContact,
    };
    html = INFO_PAGES[name] ? viewInfo(name) : (views[name] || viewHome)();
  }
  $view.innerHTML = html;
  const firstRun = !state.loaded && !(state.profile && state.profile.categories && state.profile.categories.length);
  document.body.classList.toggle('bare', (firstRun || Boolean(state.welcomeStep)) && (name === 'home' || !views_known(name)));
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
  const categories = readCategories(form);
  if (!categories.length) return toast('ઓછામાં ઓછું એક પસંદ કરો.');
  if (form.id === 'onboard') {
    const fd = new FormData(form);
    state.welcomeDraft = { categories, age: fd.get('age') || '', district: fd.get('district') || '' };
    state.profile = { ...(state.profile || {}), ...state.welcomeDraft };
    store.setProfile(state.profile);
    state.welcomeStep = 3;
    render();
  }
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

  if (action === 'welcome-next') {
    state.welcomeStep = 2;
    render();
  }
  if (action === 'welcome-back') {
    const form = document.getElementById('onboard');
    if (form) state.welcomeDraft.categories = readCategories(form);
    state.welcomeStep = Math.max(1, state.welcomeStep - 1);
    render();
  }
  if (action === 'welcome-done') {
    state.welcomeStep = 0;
    toast('તૈયાર ✓ હવે તમારા માટેની યોજના નીચે દેખાશે.');
    render();
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

  if (action === 'home-tab') {
    homeTab = el.dataset.tab;
    homeMore = false;
    const box = document.getElementById('home-mine');
    if (box) box.outerHTML = homeMineBox(state.profile);
  }
  if (action === 'home-more') {
    homeMore = true;
    const box = document.getElementById('home-mine');
    if (box) box.outerHTML = homeMineBox(state.profile);
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
    state.welcomeStep = 1;
    state.welcomeDraft = { categories: [], age: '', district: '' };
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
  if (state.jobs.length) renderChrome();
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
