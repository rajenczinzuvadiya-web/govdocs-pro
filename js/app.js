import { APP } from './config.js';
import { CATEGORIES, CATEGORY_BY_ID, JATI, OCCUPATIONS, INCOME, DISTRICTS } from './options.js';
import { store } from './store.js';
import { matches, sortForProfile, isExpired, daysLeft, deadlineText, formatDate } from './match.js';
import * as voice from './speak.js';
import { icon, tile, linePath } from './icons.js';

const state = {
  schemes: [],
  docs: [],
  docGroups: [],
  events: [],
  updates: [],
  helplines: [],
  renamed: {},
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
// જૂની લિંક (બદલાયેલું id) પણ નવા કાર્ડ પર ખૂલે — KruPa Digital Hub નાં id સાથે મેળ (`renamed`)
const findOne = (id) => state.schemes.find((s) => s.id === id) || state.docs.find((s) => s.id === id);
const findItem = (id) => findOne(id) || (state.renamed[id] ? findOne(state.renamed[id]) : undefined);
const isDoc = (s) => s.kind === 'doc';
const isNew = (s) => !state.seen.has(s.id);
const itemHref = (s) => `#/scheme/${encodeURIComponent(s.id)}`;
const appUrl = () => location.origin + location.pathname;

function markSeen(id) {
  if (state.seen.has(id)) return;
  state.seen.add(id);
  store.setSeen([...state.seen]);
}

// વર્ઝન 0.1 વખતનાં કાર્ડ (જૂના યુઝરને બાકીનાં "નવું" દેખાય)
const V01_IDS = [
  'pm-kisan', 'ikhedut-yojana', 'digital-gujarat-scholarship', 'nsp', 'ojas', 'pmegp', 'pm-matru-vandana',
  'vhali-dikri', 'ganga-swarupa-sahay', 'vrudh-pension', 'ayushman-pmjay-ma', 'pm-awas-gramin', 'ration-card',
  'birth-certificate', 'udid-card', 'sant-surdas-divyang-sahay', 'pm-svanidhi', 'udyam-registration',
];

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
    state.schemes = s.schemes || [];
    state.updates = u.updates || [];
    state.docs = d.documents || [];
    state.docGroups = d.groups || [];
    state.events = ev.events || [];
    state.dataUpdatedOn = s.updatedOn || null;
    state.error = false;
    // જૂનું કાર્ડ નવા વધુ વિગતવાળા કાર્ડથી બદલાયું હોય તો સેવ કરેલું સાચવવું
    const renamed = s.renamed || {};
    state.renamed = renamed;
    const saved = store.getSaved();
    if (saved.some((id) => renamed[id])) store.setSaved([...new Set(saved.map((id) => renamed[id] || id))]);
    // જોયેલાં કાર્ડ પણ નવા id પર (નહીં તો નામ બદલાયેલું કાર્ડ "નવું" દેખાય)
    if ([...state.seen].some((id) => renamed[id])) {
      state.seen = new Set([...state.seen].map((id) => renamed[id] || id));
      store.setSeen([...state.seen]);
    }
    if (store.getSeen() === null) {
      state.seen = new Set(state.profile ? V01_IDS : allItems().map((x) => x.id));
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
function itemTile(s, profile) {
  if (isDoc(s)) return groupTile(s.group);
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

function draftNote(items) {
  if (!items.some((s) => !s.verified)) return '';
  return `<p class="note note-warn mt">${icon('alert')}<span>આ માહિતીની સત્તાવાર સાઇટ પરથી ચકાસણી હજુ બાકી છે. અરજી હંમેશાં સત્તાવાર સાઇટ પર જ કરો.</span></p>`;
}

function footer() {
  return `
    <footer class="foot">
      <span>© ${new Date().getFullYear()} ${esc(APP.name)} · ખાનગી એપ — કોઈ સરકારી વિભાગની સત્તાવાર એપ નથી.</span>
      <a href="#/about">એપ વિશે</a>
      <a href="#/guide">કેવી રીતે વાપરવી</a>
      <a href="privacy.html">પ્રાઇવસી</a>
      <a href="terms.html">નિયમો</a>
      <span>વર્ઝન ${esc(APP.version)}${state.dataUpdatedOn ? ` · માહિતી ${esc(formatDate(state.dataUpdatedOn))}` : ''}</span>
    </footer>`;
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

const FEATURES = [
  ['book', 'indigo', 'યોજના ગાઈડ', 'કોને મળે, કેટલો લાભ, કયા પુરાવા'],
  ['folder', 'sky', 'દસ્તાવેજ ગાઈડ', 'આવક, જાતિ, આધાર જેવા દાખલા કેમ કઢાવવા'],
  ['calendar', 'pink', 'જીવનના પ્રસંગ', 'જન્મ, લગ્ન, ઘડપણમાં શું કરવું તેનું લિસ્ટ'],
  ['speaker', 'green', 'સાંભળો અને મોકલો', 'એપ વાંચીને સંભળાવે, વોટ્સએપ પર મોકલો'],
];

function viewWelcome() {
  const step = state.welcomeStep;
  if (step === 1)
    return `
    <section class="welcome">
      <div class="welcome-hero">
        <img src="icons/icon-192.png" alt="" width="72" height="72">
        <p class="greet">નમસ્તે 🙏</p>
        <h1>${esc(APP.name)} માં સ્વાગત છે</h1>
        <p class="lead">${esc(APP.about)}</p>
      </div>
      ${welcomeSteps(1)}
      <ul class="feature-grid">${FEATURES.map(([ic, tone, t, d]) => `<li>${lineTile(ic, tone)}<span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ul>
      <p class="note note-info mt">${icon('lock')}<span>લોગિન નથી. માહિતી ફક્ત આ ફોનમાં રહે છે. આ ખાનગી માહિતી એપ છે, સરકારી નથી.</span></p>
      <button class="btn btn-primary btn-block btn-lg mt" type="button" data-action="welcome-next">શરૂ કરો ${icon('chev')}</button>
    </section>
    ${footer()}`;
  if (step === 2) {
    const w = state.welcomeDraft;
    const opt = (list, val) => list.map((d) => `<option ${d === val ? 'selected' : ''}>${esc(d)}</option>`).join('');
    return `
    <section class="welcome">
      ${welcomeSteps(2)}
      <form id="onboard" class="stack">
        <fieldset class="card">
          <legend>તમે કોણ છો? એક કે વધુ પસંદ કરો</legend>
          <div class="choice-grid">${categoryChoices(w.categories)}</div>
        </fieldset>
        <div class="card form-grid">
          <label class="field">ઉંમર (વર્ષ) — વૈકલ્પિક<input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(w.age)}"></label>
          <label class="field">જિલ્લો — વૈકલ્પિક<select name="district"><option value="">— પસંદ કરો —</option>${opt(DISTRICTS, w.district)}</select></label>
        </div>
        <div class="row-split">
          <button class="btn" type="button" data-action="welcome-back">${icon('arrow')}પાછા</button>
          <button class="btn btn-primary btn-lg" type="submit">આગળ ${icon('chev')}</button>
        </div>
      </form>
    </section>
    ${footer()}`;
  }
  const z = store.getZoom();
  return `
    <section class="welcome">
      ${welcomeSteps(3)}
      <div class="card stack">
        <h2 class="h2">${icon('eye')}અક્ષર કેટલા મોટા જોઈએ?</h2>
        <div class="size-pick">${TEXT_SIZES.map(([v, label]) => `<button type="button" data-action="text-size" data-size="${v}" aria-pressed="${z === v}">અ<span>${label}</span></button>`).join('')}</div>
        <p class="muted">પછી ગમે ત્યારે ઉપર જમણી બાજુના મેનુમાંથી બદલી શકાશે.</p>
      </div>
      <div class="card stack mt">
        <h2 class="h2">${icon('speaker')}અવાજ ચકાસો</h2>
        <p class="muted">દબાવો એટલે ફોન ગુજરાતીમાં બોલશે. ન બોલે તો ફોનના સેટિંગમાં ગુજરાતી અવાજ ઉમેરવો પડશે.</p>
        <button class="btn" type="button" data-action="voice-test">${icon('speaker')}<span>સાંભળો</span></button>
      </div>
      <div class="row-split mt">
        <button class="btn" type="button" data-action="welcome-back">${icon('arrow')}પાછા</button>
        <button class="btn btn-primary btn-lg" type="button" data-action="welcome-done">${icon('published')}પૂરું, એપ ખોલો</button>
      </div>
    </section>
    ${footer()}`;
}

// ---------- હોમનાં મોટાં બટન ----------

function quickTiles() {
  const savedN = store.getSaved().length;
  const items = [
    ['#/all', 'book', 'indigo', 'યોજના', `${visible(state.schemes).length} ગાઈડ`],
    ['#/docs', 'folder', 'sky', 'દસ્તાવેજ', `${state.docs.length} દાખલા/કાર્ડ`],
    ['#/events', 'calendar', 'pink', 'જીવનના પ્રસંગ', `${state.events.length} પ્રસંગ`],
    ['#/help', 'phone', 'green', 'ફોન નંબર', 'ટેપ કરો, ફોન લાગે'],
    ['#/today', 'bell', 'amber', 'આજનું', 'નવી માહિતી, ચેતવણી'],
    ['#/saved', 'star', 'orange', 'સેવ કરેલ', savedN ? `${savedN} સેવ` : 'હજુ કંઈ નથી'],
  ];
  return `<nav class="quick" aria-label="ઝડપી મેનુ">${items.map(([href, ic, tone, t, d]) => `<a href="${href}">${lineTile(ic, tone)}<b>${t}</b><small>${d}</small></a>`).join('')}</nav>`;
}

// ---------- હોમ ----------

let homeQuery = '';

function homeResults() {
  const q = homeQuery.trim().toLowerCase();
  if (!q) return '';
  const hits = [...visible(state.schemes), ...state.docs].filter((s) => searchText(s).includes(q)).slice(0, 30);
  return `
    <h2 class="section-title">${icon('search')}શોધનું પરિણામ <span class="count">${hits.length}</span></h2>
    ${itemList(hits, 'કંઈ મળ્યું નહીં. બીજો શબ્દ લખી જુઓ, જેમ કે "પેન્શન" કે "aavak".')}`;
}

function viewHome() {
  const p = state.profile;
  if (state.welcomeStep || !p || !p.categories || !p.categories.length) {
    if (!state.welcomeStep) state.welcomeStep = 1;
    return viewWelcome();
  }
  const mine = sortForProfile(visible(state.schemes).filter((s) => matches(s, p)), p).sort(
    (a, b) => Number(isNew(b)) - Number(isNew(a))
  );
  const fresh = mine.filter(isNew).length;
  const myEvents = state.events.filter((e) => e.categories.some((c) => p.categories.includes(c)));
  const latest = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return `
    <p class="greet">નમસ્તે 🙏</p>
    ${state.installPrompt ? `<button class="note note-info mt btn-block" style="border:0;cursor:pointer;text-align:left" data-action="install">${icon('plus')}<span><strong>એપ ફોનમાં ઇન્સ્ટોલ કરો</strong> — હોમ સ્ક્રીન પરથી સીધી ખુલશે.</span></button>` : ''}
    ${reminderNote()}
    <section class="card home-search">
      <h2>${icon('search')}શું જાણવું છે?</h2>
      <label class="search-box">${icon('search')}
        <input class="search" id="home-search" type="search" placeholder="યોજના કે દાખલો શોધો… (જેમ કે પેન્શન, આવક)" value="${esc(homeQuery)}" aria-label="શોધો">
      </label>
      <div class="my-cats">${p.categories
        .map((c) => `<a class="chip" href="#/all?c=${c}">${catTile(c, 'sm')}${esc(CATEGORY_BY_ID[c].label)}</a>`)
        .join('')}<a class="chip" href="#/profile">${icon('fill', 'ic-sm')}બદલો</a></div>
    </section>
    <div id="home-results">${homeResults()}</div>
    ${quickTiles()}
    ${latest ? `
      <a class="today-strip ${latest.type === 'chetavani' ? 'warn' : ''}" href="#/today">
        ${icon(latest.type === 'chetavani' ? 'alert' : 'bell')}
        <div><b>આજનું</b><span>${esc(latest.title)}</span></div>
        ${icon('chev', 'ic chev')}
      </a>` : ''}
    ${myEvents.length ? `
      <section class="event-strip">
        <h2><a href="#/events">${icon('calendar')}તમારા જીવનના પ્રસંગ ${icon('chev', 'ic-sm')}</a></h2>
        <div class="chips">${myEvents.map((e) => `<a class="chip" href="#/event/${e.id}"><span aria-hidden="true">${e.icon}</span>${esc(e.title)}</a>`).join('')}</div>
      </section>` : ''}
    <h2 class="section-title">${icon('book')}તમારા માટેની યોજના <span class="count">${mine.length}${fresh ? ` · ${fresh} નવી` : ''}</span></h2>
    ${!p.age && !p.district ? `<a class="note note-info" href="#/profile" style="text-decoration:none;margin-bottom:.75rem">${icon('user')}<span>ઉંમર અને જિલ્લો ઉમેરો, એટલે વધુ સાચી યોજના દેખાશે.</span></a>` : ''}
    ${itemList(mine, 'તમારા વર્ગ માટે હજુ યોજના નથી. <a href="#/all">બધી યોજના જુઓ</a>')}
    ${draftNote(mine)}
    ${footer()}`;
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
}

function listBody(scope) {
  const items = filtered(scope);
  return `<p class="progress" style="margin-bottom:.75rem">${items.length} ${scope === 'docs' ? 'દસ્તાવેજ' : 'યોજના'}</p>
    ${itemList(items, `કંઈ મળ્યું નહીં. <button type="button" class="btn-link" data-action="clear-filter" data-scope="${scope}" style="border:0;background:none;cursor:pointer;font:inherit">બધું બતાવો</button>`)}`;
}

function listPage(scope, title, sub, ic, placeholder, chips) {
  const f = filters[scope];
  const counts = (id) => (scope === 'docs' ? state.docs.filter((s) => s.group === id) : visible(state.schemes).filter((s) => s.categories.includes(id))).length;
  return `
    ${pageHead(title, sub, ic)}
    <label class="search-box">${icon('search')}
      <input class="search" data-scope="${scope}" type="search" placeholder="${placeholder}" value="${esc(f.q)}" aria-label="શોધો">
    </label>
    <div class="chips">
      <button type="button" class="chip ${f.cat === '' ? 'active' : ''}" data-action="filter" data-scope="${scope}" data-cat="">બધું</button>
      ${chips
        .map(
          (c) =>
            `<button type="button" class="chip ${f.cat === c.id ? 'active' : ''}" data-action="filter" data-scope="${scope}" data-cat="${c.id}">${esc(c.label)} <span class="count">${counts(c.id)}</span></button>`
        )
        .join('')}
    </div>
    <div id="${scope}-list" class="mt">${listBody(scope)}</div>
    ${draftNote(scope === 'docs' ? state.docs : state.schemes)}
    ${footer()}`;
}

function viewAll(params) {
  if (params.get('c') !== null) filters.all.cat = params.get('c');
  return listPage('all', 'યોજના ગાઈડ', 'કોને મળે, કેટલો લાભ, કયા પુરાવા અને અરજી કેવી રીતે કરવી.', 'book', 'યોજના શોધો… (જેમ કે પેન્શન, લોન)', CATEGORIES);
}

function viewDocs() {
  return listPage('docs', 'દસ્તાવેજ ગાઈડ', 'કયો દાખલો કે કાર્ડ ક્યાંથી, કયા પુરાવાથી અને કેટલા દિવસમાં નીકળે.', 'folder', 'દાખલો કે કાર્ડ શોધો… (જેમ કે આવક, આધાર)', state.docGroups);
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
      .join('')}</div>
    ${footer()}`;
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
    <div class="parts" style="margin-top:1rem">
      <div class="parts-main">
        ${docs.length ? `<section class="part"><h2><span class="sq">${icon('forms')}</span>કરવાનાં કામ / દસ્તાવેજ</h2><ul class="ev-list">${docs.map(row).join('')}</ul></section>` : ''}
        ${helps.length ? `<section class="part"><h2><span class="sq">${icon('gift')}</span>મળી શકે એવી સહાય</h2><ul class="ev-list">${helps.map(row).join('')}</ul></section>` : ''}
      </div>
      <aside class="parts-side">
        <div class="note note-info">${icon('info')}<span>કામ પર ટેપ કરો એટલે પુરાવા અને પગલાં દેખાશે. થઈ જાય એટલે ☐ પર ✓ કરો — આ ફોનમાં યાદ રહેશે.</span></div>
      </aside>
    </div>
    ${footer()}`;
}

// ---------- વિગતનું પેજ ----------

const KIND_TEXT = {
  scheme: { benefit: 'લાભ', who: 'કોને મળે', steps: 'અરજીનાં પગલાં', where: 'ક્યાં અરજી કરવી', apply: 'સત્તાવાર સાઇટ પર અરજી', list: 'યોજના ગાઈડ', listHref: '#/all' },
  doc: { benefit: 'ક્યાં કામ આવે', who: 'કોણ કઢાવી શકે', steps: 'કઢાવવાનાં પગલાં', where: 'ક્યાંથી કઢાવવું', apply: 'અરજીની વેબસાઇટ ખોલો', list: 'દસ્તાવેજ ગાઈડ', listHref: '#/docs' },
};
const kindText = (s) => KIND_TEXT[isDoc(s) ? 'doc' : 'scheme'];
const forSpeech = (t) => String(t || '').replace(/⚠️\s*ચકાસો/g, '').replace(/⚠️/g, '');

function speechText(s) {
  const k = kindText(s);
  const parts = [
    s.title + '.',
    s.summary,
    `${k.benefit}. ${s.benefit}`,
    `${k.who}. ${s.eligibility.join(' ')}`,
    s.fee ? `ફી. ${s.fee}.` : '',
    s.days ? `કેટલા દિવસ. ${s.days}.` : '',
    `કયા પુરાવા જોઈએ. ${s.documents.join(', ')}.`,
    s.howToApply ? `${k.where}. ${s.howToApply}` : '',
    s.steps && s.steps.length ? `${k.steps}. ` + s.steps.map((t, i) => `પગલું ${i + 1}. ${t}`).join(' ') : '',
    isDoc(s) ? '' : s.lastDate ? `છેલ્લી તારીખ ${formatDate(s.lastDate)}.` : 'આ ચાલુ યોજના છે.',
  ];
  return forSpeech(parts.filter(Boolean).join('\n'));
}

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
    <div class="detail-head">
      ${itemTile(s, state.profile)}
      <div>
        <h1>${esc(s.title)}</h1>
        <p class="lead">${esc(s.summary)}</p>
      </div>
    </div>
    ${events.length ? `<div class="related"><span>આ પ્રસંગમાં કામ આવે:</span>${events.map((e) => `<a class="chip" href="#/event/${e.id}"><span aria-hidden="true">${e.icon}</span>${esc(e.title)}</a>`).join('')}</div>` : ''}
    <div class="actions">
      <a class="btn btn-kesari" href="${esc(s.officialLink)}" target="_blank" rel="noopener">${icon('external')}${k.apply}</a>
      <button class="btn" data-action="speak" data-id="${esc(s.id)}">${icon('speaker')}<span>સાંભળો</span></button>
      <button class="btn" data-action="save" data-id="${esc(s.id)}" aria-pressed="${saved}">${icon('star', saved ? 'ic filled' : 'ic')}<span>${saved ? 'સેવ થયેલ' : 'સેવ કરો'}</span></button>
      <a class="btn btn-ok" href="${wa}" target="_blank" rel="noopener">${icon('share')}વોટ્સએપ પર મોકલો</a>
    </div>
    ${!s.verified ? `<p class="note note-warn mt">${icon('alert')}<span>આ માહિતીની ચકાસણી હજુ બાકી છે${/⚠️/.test(JSON.stringify(s)) ? ' — ⚠️ વાળી વાત ખાસ ચકાસો' : ''}. અરજી પહેલાં સત્તાવાર સાઇટ કે કચેરીમાં ખાતરી કરો.</span></p>` : ''}
    <div class="facts-main">
      <div class="fact">${'<span class="sq">' + icon('users') + '</span>'}<div><div class="k">${k.who}</div><div class="v">${s.eligibility.map(esc).join('<br>')}</div></div></div>
      <div class="fact good"><span class="sq">${icon('gift')}</span><div><div class="k">${k.benefit}</div><div class="v">${esc(s.benefit)}</div></div></div>
    </div>
    ${small.length ? `<div class="facts-small">${small.map(([ic, kk, v]) => `<div class="fact">${icon(ic)}<div><div class="k">${kk}</div><div class="v">${esc(v)}</div></div></div>`).join('')}</div>` : ''}
    <div class="parts">
      <div class="parts-main">
        ${part('કયા પુરાવા જોઈએ', 'list', docChecklist(s))}
        ${s.howToApply ? part(k.where, 'pin', `<p>${esc(s.howToApply)}</p>`) : ''}
        ${s.steps && s.steps.length ? part(k.steps, 'forms', `<ol class="timeline">${s.steps.map((t, i) => `<li><span class="num">${i + 1}</span><div class="txt">${esc(t)}</div></li>`).join('')}</ol>`) : ''}
        ${s.mistakes && s.mistakes.length ? part('આ ભૂલો ન કરો', 'alert', dots(s.mistakes), 'warn') : ''}
        ${s.after && s.after.length ? part('અરજી પછી', 'hourglass', dots(s.after)) : ''}
      </div>
      <aside class="parts-side">
        <div class="card side-box">
          <h3>${icon('help')}ફોર્મ ભરવામાં મદદ</h3>
          <p class="small muted">નજીકના <strong>KruPa Digital Hub</strong> ઓપરેટર કે CSC સેન્ટરની મદદ લો.</p>
        </div>
        ${reportLink(s) ? `<div class="card side-box">
          <h3>${icon('alert')}માહિતીમાં ભૂલ છે?</h3>
          <p class="small muted">ફી, તારીખ કે નિયમ બદલાયા હોય તો જણાવો, અમે ચકાસીને સુધારીશું.</p>
          <a class="btn" href="${reportLink(s)}" target="_blank" rel="noopener">${icon('message')}ભૂલ જણાવો</a>
        </div>` : ''}
        <div class="card side-box">
          <h3>${icon('shield')}ધ્યાન રાખો</h3>
          <p class="small muted">અમે ક્યારેય પૈસા, OTP કે આધાર નંબર માંગતા નથી. અરજી હંમેશાં સત્તાવાર સાઇટ પર જ કરો.</p>
        </div>
        <div class="card side-box">
          <h3>${icon('book')}સ્રોત</h3>
          <div class="sources">${sources}<span>છેલ્લે અપડેટ: ${esc(formatDate(s.updatedOn))}</span></div>
        </div>
      </aside>
    </div>
    ${footer()}`;
}

// ---------- સેવ, આજનું, ફોન નંબર, પ્રોફાઇલ, એપ વિશે ----------

function viewSaved() {
  const saved = store.getSaved().map(findItem).filter(Boolean);
  return `
    ${pageHead('સેવ કરેલ', 'સેવ કરેલી યોજનાની છેલ્લી તારીખ પહેલાં યાદ કરાવીશું.', 'star')}
    ${reminderNote()}
    <div class="mt">${itemList(saved, 'હજુ કંઈ સેવ નથી કર્યું. યોજના કે દાખલો ખોલીને "સેવ કરો" દબાવો.')}</div>
    ${footer()}`;
}

function viewToday() {
  const items = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return `
    ${pageHead('આજનું', 'નવી માહિતી અને જરૂરી ચેતવણી', 'bell', '#/')}
    <div class="news">${
      items.length
        ? items
            .map(
              (u) => `
      <article class="card ${u.type === 'chetavani' ? 'warn' : ''}">
        <span class="when">${icon(u.type === 'chetavani' ? 'alert' : 'info', 'ic-sm')}${u.type === 'chetavani' ? 'ચેતવણી' : 'જાણકારી'} · ${esc(formatDate(u.date))}</span>
        <h3>${esc(u.title)}</h3>
        <p class="muted">${esc(u.summary)}</p>
        <div class="row">
          <button class="btn" data-action="speak-update" data-id="${esc(u.id)}">${icon('speaker')}<span>સાંભળો</span></button>
          ${u.link ? `<a class="btn" href="${esc(u.link)}" target="_blank" rel="noopener">${icon('external')}મૂળ સ્રોત</a>` : ''}
        </div>
      </article>`
            )
            .join('')
        : '<div class="empty">આજે કોઈ નવી માહિતી નથી.</div>'
    }</div>
    ${footer()}`;
}

function viewHelp() {
  return `
    ${pageHead('જરૂરી ફોન નંબર', 'નંબર પર ટેપ કરો એટલે સીધો ફોન લાગશે.', 'phone', '#/')}
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
    }</div>
    <p class="note note-warn mt">${icon('shield')}<span>કોઈ સરકારી અધિકારી ફોન પર OTP, PIN કે પૈસા માંગતા નથી. ફ્રોડ થાય તો તરત 1930 પર ફોન કરો.</span></p>
    ${footer()}`;
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
    ${pageHead('મારી પ્રોફાઇલ', 'બધું વૈકલ્પિક છે. માહિતી ફક્ત આ ફોનમાં રહે છે.', 'user', '#/')}
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
      <p class="note note-ok">${icon('lock')}<span>અમે આધાર નંબર, બેંક વિગત કે ફોન નંબર ક્યારેય નથી માંગતા.</span></p>
      <button class="btn btn-primary btn-block" type="submit">${icon('published')}સેવ કરો</button>
      ${state.profile ? `<button class="btn btn-ghost btn-block" type="button" data-action="reset">${icon('trash')}મારી બધી માહિતી ફોનમાંથી કાઢી નાખો</button>` : ''}
    </form>
    ${footer()}`;
}

function viewAbout() {
  return `
    ${pageHead(`${esc(APP.name)} વિશે`, '', 'info', '#/')}
    <div class="stack">
      <div class="card"><p>ગામના દરેક માણસને તેના માટે કઈ યોજના, સહાય, દાખલા અને માહિતી છે તે સરળ ગુજરાતીમાં, બોલીને અને સામેથી જણાવતી એપ.</p></div>
      <div class="note note-warn">${icon('alert')}<div>
        <ul style="padding-left:1.1rem;margin:0">
          <li>આ <strong>ખાનગી માહિતી એપ</strong> છે — કોઈ સરકારી વિભાગની સત્તાવાર એપ નથી.</li>
          <li>દરેક કાર્ડ પર સત્તાવાર સ્રોતની લિંક છે. અરજી પહેલાં સત્તાવાર સાઇટ કે કચેરીમાં ખાતરી કરો.</li>
          <li><strong>અમે ક્યારેય પૈસા, OTP કે આધાર નંબર માંગતા નથી.</strong> કોઈ આ એપના નામે માંગે તો તે ફ્રોડ છે — 1930 પર ફોન કરો.</li>
        </ul></div></div>
      <div class="card"><h2 class="section-title" style="margin-top:0">${icon('users')}KruPa Digital Hub</h2>
        <p>${esc(APP.name)} એ KruPa Digital Hub ની એપ છે. યોજના ગાઈડ, દસ્તાવેજ ગાઈડ અને પ્રસંગની માહિતી KruPa Digital Hub ની ગાઈડ પરથી લીધી છે. ફોર્મ ભરવામાં મદદ માટે નજીકના KruPa ઓપરેટર કે CSC સેન્ટરનો સંપર્ક કરો.</p></div>
      <div class="card"><h2 class="section-title" style="margin-top:0">${icon('lock')}તમારી માહિતી</h2>
        <p>લોગિન નથી. પ્રોફાઇલ, સેવ કરેલું અને ✓ ચેકલિસ્ટ ફક્ત આ ફોનમાં રહે છે; અમારા સર્વર પર જતું નથી. <a href="privacy.html">પ્રાઇવસી પોલિસી</a></p></div>
      <div class="card"><h2 class="section-title" style="margin-top:0">${icon('book')}માહિતી ક્યાંથી આવે છે</h2>
        <p>દરેક કાર્ડ સરકારી વેબસાઇટ, સરકારી ઠરાવ અને KruPa Digital Hub ની ગાઈડ પરથી સરળ ગુજરાતીમાં લખાય છે. કાર્ડની નીચે "સ્રોત" માં મૂળ લિંક અને છેલ્લે અપડેટની તારીખ છે. સત્તાવાર સાઇટ પરથી ચકાસાય નહીં ત્યાં સુધી કાર્ડ પર "ચકાસણી બાકી" લખેલું રહે છે.</p>
        <p class="mt muted">હાલમાં: ${state.schemes.length} યોજના, ${state.docs.length} દસ્તાવેજ, ${state.events.length} પ્રસંગ · ${allItems().filter((x) => x.verified).length} ચકાસેલાં</p></div>
      <div class="menu-list card">
        <a href="#/guide">${icon('help')}એપ કેવી રીતે વાપરવી</a>
        <a href="#/contact">${icon('message')}સંપર્ક અને સૂચન</a>
        <a href="privacy.html">${icon('lock')}પ્રાઇવસી પોલિસી</a>
        <a href="terms.html">${icon('forms')}નિયમો અને શરતો</a>
      </div>
      <p class="muted center">વર્ઝન ${esc(APP.version)}${state.dataUpdatedOn ? ` · માહિતી ${esc(formatDate(state.dataUpdatedOn))}` : ''}</p>
    </div>
    ${footer()}`;
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
    ${pageHead('સંપર્ક અને સૂચન', 'ભૂલ દેખાય, નવી યોજના ખબર પડે કે કંઈ સમજાય નહીં તો જણાવો.', 'message', '#/')}
    ${rows.length ? `<div class="help-list">${rows.join('')}</div>` : `<div class="empty">સંપર્કની વિગત ટૂંક સમયમાં ઉમેરાશે.</div>`}
    <div class="card mt">
      <h2 class="h2">${icon('help')}ફોર્મ ભરવામાં મદદ</h2>
      <p class="mt">આ એપ ફક્ત માહિતી આપે છે, અરજી નથી કરતી. ફોર્મ ભરવા માટે નજીકના <strong>KruPa Digital Hub</strong> ઓપરેટર, CSC સેન્ટર કે ગ્રામ પંચાયતના VCE ની મદદ લો.</p>
    </div>
    <p class="note note-warn mt">${icon('shield')}<span>અમે ક્યારેય પૈસા, OTP કે આધાર નંબર માંગતા નથી. કોઈ માંગે તો 1930 પર ફોન કરો.</span></p>
    ${footer()}`;
}

// ---------- એપ કેવી રીતે વાપરવી (VCE / જાણકાર બીજાને શીખવી શકે) ----------

const GUIDE = [
  ['home', 'મારા માટે', 'પ્રોફાઇલ પ્રમાણે તમને લાગુ પડતી યોજના અહીં દેખાય છે. "નવું" લખેલું હોય તે છેલ્લી મુલાકાત પછી ઉમેરાયેલું છે.'],
  ['search', 'શોધો', 'ઉપરના ખાનામાં "પેન્શન", "આવક", "લોન" જેવો શબ્દ લખો.'],
  ['book', 'યોજના ખોલો', 'કાર્ડ પર ટેપ કરો: કોને મળે, લાભ, ફી, કેટલા દિવસ, પુરાવા અને અરજીનાં પગલાં દેખાશે.'],
  ['list', 'પુરાવાનું લિસ્ટ', 'જે પુરાવો તૈયાર હોય તેના પર ટેપ કરો, ✓ થઈ જશે. આ ફોનમાં યાદ રહે છે.'],
  ['speaker', 'સાંભળો', '"સાંભળો" દબાવો એટલે એપ આખી માહિતી ગુજરાતીમાં વાંચી સંભળાવશે.'],
  ['share', 'વોટ્સએપ પર મોકલો', 'કોઈને કામ આવે એવી યોજના એક બટનથી વોટ્સએપમાં મોકલો.'],
  ['star', 'સેવ કરો', 'જરૂરી યોજના સેવ કરો, પછી "સેવ" ટેબમાં મળશે.'],
  ['calendar', 'જીવનના પ્રસંગ', 'બાળકનો જન્મ, લગ્ન, ઘડપણ જેવા પ્રસંગે શું કઢાવવું અને કઈ સહાય મળે તેનું લિસ્ટ.'],
  ['user', 'પ્રોફાઇલ અને અક્ષર', 'ઉપર જમણી બાજુના મેનુમાંથી પ્રોફાઇલ બદલો, અક્ષર મોટા કરો કે રાત્રે ડાર્ક દેખાવ કરો.'],
  ['external', 'અરજી', 'અરજી હંમેશાં "સત્તાવાર સાઇટ પર અરજી" બટનથી સરકારી સાઇટ પર જ કરો.'],
];

function viewGuide() {
  return `
    ${pageHead('એપ કેવી રીતે વાપરવી', '10 નાની વાત. પહેલી વાર કોઈને એપ બતાવો ત્યારે આ પેજ સાથે જુઓ.', 'help', '#/')}
    <ol class="guide-list">${GUIDE.map(([ic, t, d], i) => `<li><span class="num">${i + 1}</span><div><b>${icon(ic, 'ic-sm')}${t}</b><p>${d}</p></div></li>`).join('')}</ol>
    <div class="card mt stack">
      <h2 class="h2">${icon('phone')}ફોનમાં ઇન્સ્ટોલ કરવી</h2>
      <ol class="plain-steps">
        <li>Chrome માં એપની લિંક ખોલો.</li>
        <li>ઉપર જમણી બાજુ ⋮ (ત્રણ ટપકાં) દબાવો.</li>
        <li>"Add to Home screen" કે "Install app" દબાવો.</li>
        <li>હોમ સ્ક્રીન પર એપનું આઇકન આવી જશે. નેટ વગર પણ ખૂલશે.</li>
      </ol>
    </div>
    <div class="card mt stack">
      <h2 class="h2">${icon('speaker')}અવાજ ન આવે તો</h2>
      <ol class="plain-steps">
        <li>ફોનના Settings ખોલો.</li>
        <li>"Text-to-speech" શોધો.</li>
        <li>Google ના Speech Services માં ગુજરાતી ભાષા ડાઉનલોડ કરો.</li>
      </ol>
    </div>
    ${footer()}`;
}

// ---------- પ્રોફાઇલ મેનુ, ઝૂમ, થીમ, પુષ્ટિ (વચ્ચે ખૂલતા પૉપઅપ) ----------

const ZOOMS = [80, 90, 100, 110, 120];
const THEMES = [
  ['auto', 'ઓટો', 'refresh'],
  ['light', 'લાઈટ', 'sun'],
  ['dark', 'ડાર્ક', 'moon'],
];

function applyLook() {
  const z = store.getZoom();
  if (z === 100) delete document.documentElement.dataset.zoom;
  else document.documentElement.dataset.zoom = String(z);
  const t = store.getTheme();
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
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

function menuHtml() {
  const z = store.getZoom();
  const t = store.getTheme();
  return `
    <div class="dialog-head"><h2>મેનુ</h2><button class="icon-btn" data-close="1" aria-label="બંધ કરો">${icon('close')}</button></div>
    <div class="menu-list">
      <a href="#/profile" data-close="1">${icon('user')}મારી પ્રોફાઇલ</a>
      <a href="#/help" data-close="1">${icon('phone')}જરૂરી ફોન નંબર</a>
      <a href="#/today" data-close="1">${icon('bell')}આજનું</a>
      <a href="${shareAppLink()}" target="_blank" rel="noopener" data-close="1">${icon('share')}એપ વોટ્સએપ ગ્રુપમાં મોકલો</a>
      <div class="menu-sep"></div>
      <div class="menu-setting">ઝૂમ
        <span class="stepper">
          <button type="button" data-zoom="-1" aria-label="નાનું" ${z <= ZOOMS[0] ? 'disabled' : ''}>${icon('minus')}</button>
          <span>${z}%</span>
          <button type="button" data-zoom="1" aria-label="મોટું" ${z >= ZOOMS[ZOOMS.length - 1] ? 'disabled' : ''}>${icon('plus')}</button>
        </span>
      </div>
      <div class="menu-setting">દેખાવ
        <span class="seg">${THEMES.map(([id, label, ic]) => `<button type="button" data-theme-set="${id}" aria-pressed="${t === id}">${icon(ic, 'ic-sm')}${label}</button>`).join('')}</span>
      </div>
      <div class="menu-sep"></div>
      <a href="#/guide" data-close="1">${icon('help')}એપ કેવી રીતે વાપરવી</a>
      <a href="#/contact" data-close="1">${icon('message')}સંપર્ક અને સૂચન</a>
      <a href="#/about" data-close="1">${icon('info')}એપ વિશે</a>
      <a href="privacy.html">${icon('lock')}પ્રાઇવસી પોલિસી</a>
      <a href="terms.html">${icon('forms')}નિયમો અને શરતો</a>
      ${operatorLinks()}
    </div>`;
}

// ઓપરેટર માટેની KruPa એપ: ગ્રામજનોને નહીં, એટલે મેનુમાં છેલ્લે અને નાનો ભાગ
function operatorLinks() {
  const k = APP.krupa || {};
  if (!k.digitalHub && !k.docHub) return '';
  return `
      <div class="menu-sep"></div>
      <p class="menu-label">ઓપરેટર માટે</p>
      ${k.digitalHub ? `<a href="${esc(k.digitalHub)}" target="_blank" rel="noopener">${icon('forms')}<span>KruPa Digital Hub<small>VCE: ફોર્મ ભરો અને પ્રિન્ટ</small></span></a>` : ''}
      ${k.docHub ? `<a href="${esc(k.docHub)}" target="_blank" rel="noopener">${icon('copy')}<span>KruPa Doc Hub<small>ઝેરોક્ષ દુકાન: ફોટો પરથી A4</small></span></a>` : ''}`;
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
  const text = [`*${APP.name}*`, APP.about, 'ગુજરાતીમાં વાંચીને સંભળાવે પણ છે.', '', `મફત એપ: ${appUrl()}`].join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

$modal.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) {
    const i = ZOOMS.indexOf(store.getZoom()) + Number(z.dataset.zoom);
    if (ZOOMS[i]) store.setZoom(ZOOMS[i]);
    applyLook();
    $modal.querySelector('.dialog').innerHTML = menuHtml();
    return;
  }
  const th = e.target.closest('[data-theme-set]');
  if (th) {
    store.setTheme(th.dataset.themeSet);
    applyLook();
    $modal.querySelector('.dialog').innerHTML = menuHtml();
    return;
  }
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
  if (e.key === 'Escape' && $modal.innerHTML) {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    closeModal();
  }
});
document.getElementById('menu-btn').addEventListener('click', () => openModal(menuHtml()));

// ---------- રૂટિંગ ----------

function currentRoute() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/');
  return { name: parts[0] || 'home', arg: decodeURIComponent(parts[1] || ''), params: new URLSearchParams(query) };
}

function render() {
  voice.stop();
  const { name, arg, params } = currentRoute();
  let html;
  if (!state.loaded) html = '<div class="empty">લોડ થાય છે…</div>';
  else if (state.error && !state.schemes.length)
    html = `<div class="empty">માહિતી લોડ ન થઈ. ઇન્ટરનેટ ચાલુ કરીને ફરી પ્રયત્ન કરો.<br><br><button class="btn btn-primary" data-action="retry">ફરી પ્રયત્ન કરો</button></div>`;
  else {
    const views = {
      home: viewHome,
      all: () => viewAll(params),
      docs: viewDocs,
      events: viewEvents,
      event: () => viewEvent(arg),
      scheme: () => viewItem(arg),
      saved: viewSaved,
      today: viewToday,
      help: viewHelp,
      profile: viewProfile,
      about: viewAbout,
      guide: viewGuide,
      contact: viewContact,
    };
    html = (views[name] || viewHome)();
  }
  $view.innerHTML = html;
  const item = name === 'scheme' ? findItem(arg) : null;
  const tab = { event: 'events', scheme: item && isDoc(item) ? 'docs' : 'all' }[name] || name;
  document.querySelectorAll('.nav a[data-route]').forEach((a) => {
    const on = a.dataset.route === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
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

let voiceHintShown = false;
function startSpeaking(btn, text) {
  if (voice.isSpeaking()) {
    voice.stop();
    return;
  }
  if (!voice.canSpeak()) return toast('આ ફોનમાં વાંચીને સંભળાવવાની સુવિધા નથી.');
  const label = btn.innerHTML;
  btn.innerHTML = `${icon('stop')}<span>બંધ કરો</span>`;
  voice.speak(text, () => (btn.innerHTML = label));
  if (!voice.hasGujaratiVoice() && !voiceHintShown) {
    voiceHintShown = true;
    toast('ગુજરાતી અવાજ ન આવે તો ફોનના Settings → Text-to-speech માં ગુજરાતી ભાષા ઉમેરો.');
  }
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
  if (action === 'voice-test') startSpeaking(el, `નમસ્તે. ${APP.name} માં આપનું સ્વાગત છે. આ એપ યોજનાની માહિતી ગુજરાતીમાં વાંચીને સંભળાવશે.`);

  if (action === 'speak') startSpeaking(el, speechText(findItem(id)));

  if (action === 'speak-update') {
    const u = state.updates.find((x) => x.id === id);
    if (u) startSpeaking(el, u.title + '.\n' + u.summary);
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
    document.querySelectorAll(`.chip[data-scope="${scope}"]`).forEach((c) => c.classList.toggle('active', c === el));
    refreshList(scope);
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
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyLook);

// ---------- શરૂઆત ----------

applyLook();
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
