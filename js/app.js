import { APP } from './config.js';
import { CATEGORIES, CATEGORY_BY_ID, JATI, OCCUPATIONS, INCOME, DISTRICTS } from './options.js';
import { store } from './store.js';
import { matches, sortForProfile, isExpired, daysLeft, deadlineText, formatDate } from './match.js';
import * as voice from './speak.js';

const state = {
  schemes: [],
  updates: [],
  docs: [],
  docGroups: [],
  events: [],
  helplines: [],
  profile: store.getProfile(),
  seen: new Set(store.getSeen() || []),
  installPrompt: null,
  loaded: false,
  error: false,
};

const $view = document.getElementById('view');
const $toast = document.getElementById('toast');

// ---------- નાના સાધનો ----------

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
const findScheme = (id) => state.schemes.find((s) => s.id === id) || state.docs.find((s) => s.id === id);
const isDoc = (s) => s.kind === 'doc';
const visible = (list) => list.filter((s) => !isExpired(s));

function appUrl() {
  return location.origin + location.pathname;
}

// ---------- ડેટા ----------

async function loadData() {
  try {
    const get = (f) => fetch('data/' + f, { cache: 'no-cache' }).then((r) => r.json());
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
    migrateRenamed(s.renamed || {});
    state.dataUpdatedOn = s.updatedOn || null;
    state.error = false;
    // પહેલી વાર એપ ખોલી હોય તો બધું "જોયેલું" ગણવું; પછી ઉમેરાય તે જ "નવું" દેખાય
    if (store.getSeen() === null) {
      // વર્ઝન 0.1 વાપરનારને ત્યારનાં કાર્ડ જ "જોયેલાં" ગણવાં, એટલે નવાં ઉમેરાયેલાં "નવું" દેખાય
      const ids = state.profile ? V01_IDS : allItems().map((x) => x.id);
      state.seen = new Set(ids);
      store.setSeen([...state.seen]);
    }
  } catch {
    state.error = true;
  }
  try {
    const h = await fetch('data/helplines.json', { cache: 'no-cache' }).then((r) => r.json());
    state.helplines = h.helplines || [];
  } catch {
    /* નંબરનું પેજ ખાલી દેખાશે */
  }
  state.loaded = true;
}

const V01_IDS = [
  'pm-kisan', 'ikhedut', 'digital-gujarat-scholarship', 'nsp', 'ojas', 'pmegp', 'pmmvy', 'vahli-dikri',
  'ganga-swarupa', 'vrudh-pension', 'ayushman', 'pmay-g', 'ration-card', 'birth-certificate', 'udid',
  'sant-surdas', 'pm-svanidhi', 'udyam',
];

// બદલાયેલાં id (જૂનું કાર્ડ નવા વધુ વિગતવાળા કાર્ડથી બદલાયું) — સેવ કરેલું સાચવી રાખવું
function migrateRenamed(map) {
  const saved = store.getSaved();
  if (saved.some((id) => map[id])) {
    store.setSaved([...new Set(saved.map((id) => map[id] || id))]);
  }
}

const allItems = () => [...state.schemes, ...state.docs];
const isNew = (s) => !state.seen.has(s.id);

function markSeen(id) {
  if (state.seen.has(id)) return;
  state.seen.add(id);
  store.setSeen([...state.seen]);
}

// ---------- કાર્ડ ----------

function categoryTags(ids) {
  return ids
    .filter((id) => CATEGORY_BY_ID[id])
    .map((id) => `<span class="tag">${CATEGORY_BY_ID[id].icon} ${esc(CATEGORY_BY_ID[id].label)}</span>`)
    .join('');
}

function docGroupTag(id) {
  const g = state.docGroups.find((x) => x.id === id);
  return g ? `<span class="tag tag-doc">${g.icon} ${esc(g.label)}</span>` : '';
}

function badges(s) {
  const d = deadlineText(s);
  let out = isNew(s) ? `<span class="badge badge-new">🆕 નવું</span>` : '';
  if (!isDoc(s)) out += `<span class="badge badge-${d.tone}">${esc(d.text)}</span>`;
  if (!s.verified) out += `<span class="badge badge-draft">ચકાસણી બાકી</span>`;
  if (store.isSaved(s.id)) out += `<span class="badge badge-saved">⭐ સેવ</span>`;
  return out;
}

function schemeCard(s) {
  return `
    <a class="card" href="#/scheme/${encodeURIComponent(s.id)}">
      <div class="tags">${isDoc(s) ? docGroupTag(s.group) : categoryTags(s.categories)}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.summary)}</p>
      <div class="badges">${badges(s)}</div>
    </a>`;
}

function list(schemes, empty) {
  if (!schemes.length) return `<div class="empty">${empty}</div>`;
  return `<div class="cards">${schemes.map(schemeCard).join('')}</div>`;
}

// ---------- યાદ (છેલ્લી તારીખ) ----------

function dueSoon() {
  return store
    .getSaved()
    .map(findScheme)
    .filter((s) => s && s.lastDate)
    .filter((s) => {
      const d = daysLeft(s);
      return d >= 0 && d <= APP.reminderDays;
    })
    .sort((a, b) => daysLeft(a) - daysLeft(b));
}

function reminderBanner() {
  const due = dueSoon();
  if (!due.length) return '';
  return `
    <section class="banner banner-urgent" role="alert">
      <strong>⏰ છેલ્લી તારીખ નજીક છે</strong>
      <ul>${due
        .map((s) => `<li><a href="#/scheme/${encodeURIComponent(s.id)}">${esc(s.title)}</a>: ${esc(deadlineText(s).text)}</li>`)
        .join('')}</ul>
    </section>`;
}

// એપ ખોલતી વખતે: દિવસમાં એક વાર ફોનનું નોટિફિકેશન (પરવાનગી હોય તો)
async function notifyDue() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
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
        badge: 'icons/icon-192.png',
        tag: 'due-' + s.id,
        data: { url: appUrl() + '#/scheme/' + encodeURIComponent(s.id) },
      });
      notified[s.id] = today;
    }
    store.setNotified(notified);
  } catch {
    /* નોટિફિકેશન ન બતાવી શકાય તો banner તો છે જ */
  }
}

// ---------- સ્ક્રીન ----------

function viewOnboarding() {
  return `
    <section class="hero">
      <h1>નમસ્તે 🙏</h1>
      <p class="lead">${esc(APP.tagline)}</p>
      <p>તમે કોણ છો? <strong>એક કે વધુ</strong> પસંદ કરો, એટલે ફક્ત તમારા કામની માહિતી દેખાશે.</p>
    </section>
    <form id="onboard" class="stack">
      <div class="choice-grid">${categoryChoices([])}</div>
      <button class="btn btn-primary btn-big" type="submit">આગળ વધો →</button>
      <p class="muted small">લોગિન નથી. તમારી માહિતી ફક્ત તમારા ફોનમાં જ રહે છે.</p>
    </form>`;
}

function categoryChoices(selected) {
  return CATEGORIES.map(
    (c) => `
    <label class="choice">
      <input type="checkbox" name="categories" value="${c.id}" ${selected.includes(c.id) ? 'checked' : ''}>
      <span class="choice-body">
        <span class="choice-icon" aria-hidden="true">${c.icon}</span>
        <span class="choice-label">${esc(c.label)}</span>
        <span class="choice-hint">${esc(c.hint)}</span>
      </span>
    </label>`
  ).join('');
}

function versionLine() {
  const d = state.dataUpdatedOn ? ` · માહિતી અપડેટ: ${esc(formatDate(state.dataUpdatedOn))}` : '';
  return `વર્ઝન ${esc(APP.version)}${d}`;
}

function viewHome() {
  const p = state.profile;
  if (!p || !p.categories || !p.categories.length) return viewOnboarding();
  // નવી યોજના સૌથી ઉપર, પછી પોતાના વર્ગની અને નજીકની છેલ્લી તારીખવાળી
  const mine = sortForProfile(visible(state.schemes).filter((s) => matches(s, p)), p).sort(
    (a, b) => Number(isNew(b)) - Number(isNew(a))
  );
  const incomplete = !p.age && !p.district;
  const fresh = mine.filter(isNew).length;
  return `
    ${reminderBanner()}
    ${installBanner()}
    <section class="page-head">
      <h1>મારા માટે</h1>
      <p class="muted">તમને લાગુ પડી શકે એવી <strong>${mine.length}</strong> યોજના${fresh ? `, તેમાંથી <strong class="new-count">${fresh} નવી</strong>` : ''}</p>
      <div class="tags tags-edit">${categoryTags(p.categories)} <a class="link" href="#/profile">બદલો</a></div>
    </section>
    ${incomplete ? `<a class="banner banner-info" href="#/profile">👤 ઉંમર અને જિલ્લો ઉમેરો, એટલે વધુ સાચી યોજના દેખાશે →</a>` : ''}
    <div class="quick">
      <a class="quick-btn" href="#/help"><span aria-hidden="true">📞</span>જરૂરી ફોન નંબર</a>
      <a class="quick-btn" href="${shareAppLink()}" target="_blank" rel="noopener"><span aria-hidden="true">📲</span>એપ ગ્રુપમાં મોકલો</a>
    </div>
    ${todayStrip()}
    ${myEventsRow(p)}
    <h2 class="list-title">📋 તમારા માટેની યોજના</h2>
    ${list(mine, 'તમારા વર્ગ માટે હજુ કાર્ડ નથી. જલ્દી ઉમેરાશે. ત્યાં સુધી <a href="#/all">બધી યોજના</a> જુઓ.')}
    <p class="muted small center"><a class="link" href="#/about">આ એપ વિશે અને જરૂરી સૂચના</a></p>
    <p class="muted small center">${versionLine()}</p>`;
}

function todayStrip() {
  const latest = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!latest) return '';
  return `
    <a class="today-strip ${latest.type === 'chetavani' ? 'warn' : ''}" href="#/today">
      <span class="today-label">📰 આજનું</span>
      <span class="today-title">${esc(latest.title)}</span>
      <span class="today-more">બધું જુઓ →</span>
    </a>`;
}

function myEventsRow(p) {
  const cats = p.categories || [];
  const mine = state.events.filter((e) => e.categories.some((c) => cats.includes(c)));
  if (!mine.length) return '';
  return `
    <section class="events-row">
      <h2 class="list-title">🧭 તમારા જીવનના પ્રસંગ</h2>
      <div class="chips">${mine
        .map((e) => `<a class="chip" href="#/event/${encodeURIComponent(e.id)}">${e.icon} ${esc(e.title)}</a>`)
        .join('')}</div>
    </section>`;
}

function shareAppLink() {
  const text = [
    `*${APP.name}* 📲`,
    'સરકારી યોજના, સહાય, ભરતી અને જરૂરી માહિતી, સરળ ગુજરાતીમાં અને બોલીને.',
    'ખેડૂત, વિદ્યાર્થી, માતા, વડીલ — દરેક માટે.',
    '',
    `મફત એપ: ${appUrl()}`,
  ].join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

function installBanner() {
  if (!state.installPrompt) return '';
  return `<button class="banner banner-install" data-action="install">📲 એપ ફોનમાં ઇન્સ્ટોલ કરો, એટલે હોમ સ્ક્રીન પરથી સીધી ખુલશે</button>`;
}

function viewHelp() {
  const rows = state.helplines
    .map(
      (h) => `
      <a class="help-row" href="tel:${esc(h.number)}">
        <span class="help-icon" aria-hidden="true">${esc(h.icon)}</span>
        <span class="help-text"><strong>${esc(h.display || h.number)}</strong><span>${esc(h.title)}</span></span>
        <span class="help-call">📞 ફોન</span>
      </a>`
    )
    .join('');
  return `
    <a class="back" href="#/" data-action="back">← પાછા</a>
    <section class="page-head">
      <h1>📞 જરૂરી ફોન નંબર</h1>
      <p class="muted">નંબર પર ટેપ કરો એટલે સીધો ફોન લાગશે. બધા નંબર મફત છે.</p>
    </section>
    <div class="help-list">${rows || '<div class="empty">નંબર લોડ ન થયા.</div>'}</div>
    <p class="note">⚠️ ફ્રોડથી સાવધાન: કોઈ સરકારી અધિકારી ફોન પર OTP, PIN કે પૈસા માંગતા નથી.</p>`;
}

const filters = { all: { q: '', cat: '' }, docs: { q: '', cat: '' } };

function searchText(s) {
  const catLabels = (s.categories || []).map((c) => (CATEGORY_BY_ID[c] ? CATEGORY_BY_ID[c].label : ''));
  const group = state.docGroups.find((g) => g.id === s.group);
  return [s.title, s.summary, s.benefit, s.howToApply, s.words, ...(s.documents || []), ...catLabels, group && group.label]
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
  if (el) el.innerHTML = list(filtered(scope), 'કંઈ મળ્યું નહીં.');
}

function filterPage(scope, title, placeholder, chipItems, intro) {
  const f = filters[scope];
  const chips = chipItems
    .map(
      (c) =>
        `<button type="button" class="chip ${f.cat === c.id ? 'active' : ''}" data-action="filter" data-scope="${scope}" data-cat="${c.id}">${c.icon} ${esc(c.label)}</button>`
    )
    .join('');
  return `
    <section class="page-head">
      <h1>${title}</h1>
      ${intro ? `<p class="muted">${intro}</p>` : ''}
      <input class="search" data-scope="${scope}" type="search" placeholder="${placeholder}" value="${esc(f.q)}" aria-label="શોધો">
      <div class="chips">${chips}</div>
    </section>
    <div id="${scope}-list">${list(filtered(scope), 'કંઈ મળ્યું નહીં.')}</div>`;
}

function viewDocs() {
  return filterPage(
    'docs',
    '🪪 દસ્તાવેજ ગાઈડ',
    '🔍 દાખલો કે કાર્ડ શોધો… (જેમ કે આવક, આધાર)',
    [{ id: '', icon: '📋', label: 'બધા' }, ...state.docGroups],
    'કયો દાખલો કે કાર્ડ ક્યાંથી, કયા પુરાવાથી અને કેટલા દિવસમાં નીકળે.'
  );
}

function viewEvents() {
  const cats = (state.profile && state.profile.categories) || [];
  const sorted = [...state.events].sort(
    (a, b) => Number(b.categories.some((c) => cats.includes(c))) - Number(a.categories.some((c) => cats.includes(c)))
  );
  return `
    <section class="page-head">
      <h1>🧭 જીવનના પ્રસંગ</h1>
      <p class="muted">પ્રસંગ પસંદ કરો: શું કઢાવવું અને કઈ સહાય મળી શકે તેનું લિસ્ટ મળશે.</p>
    </section>
    <div class="event-grid">${sorted
      .map(
        (e) => `
      <a class="event-card" href="#/event/${encodeURIComponent(e.id)}">
        <span class="event-icon" aria-hidden="true">${e.icon}</span>
        <span class="event-title">${esc(e.title)}</span>
        <span class="event-count">${e.items.length} કામ</span>
      </a>`
      )
      .join('')}</div>`;
}

function eventItemTitle(it) {
  const linked = it.itemId ? findScheme(it.itemId) : null;
  return it.title || (linked ? linked.title : '');
}

function viewEvent(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return `<div class="empty">આ પ્રસંગ મળ્યો નહીં. <a href="#/events">બધા પ્રસંગ</a></div>`;
  const key = 'event:' + e.id;
  const ready = store.getDocs(key);
  const row = (it, i) => {
    const linked = it.itemId ? findScheme(it.itemId) : null;
    const done = ready.includes(i);
    return `
      <li class="event-item ${done ? 'done' : ''}">
        <button type="button" class="doc-tick" data-action="event-tick" data-id="${esc(key)}" data-i="${i}" aria-pressed="${done}" aria-label="થઈ ગયું">
          <span class="doc-box" aria-hidden="true"></span>
        </button>
        <div class="event-item-body">
          <span class="tag ${it.type === 'scheme' ? '' : 'tag-doc'}">${it.type === 'scheme' ? '🎁 સહાય / યોજના' : '📄 દસ્તાવેજ / કામ'}</span>
          ${linked ? `<a class="event-item-title" href="#/scheme/${encodeURIComponent(linked.id)}">${esc(eventItemTitle(it))} →</a>` : `<strong class="event-item-title">${esc(eventItemTitle(it))}</strong>`}
          ${it.note ? `<span class="muted small">${esc(it.note)}</span>` : ''}
        </div>
      </li>`;
  };
  const docs = e.items.map((it, i) => [it, i]).filter(([it]) => it.type !== 'scheme');
  const helps = e.items.map((it, i) => [it, i]).filter(([it]) => it.type === 'scheme');
  return `
    <a class="back" href="#/events" data-action="back">← પાછા</a>
    <article class="detail">
      <h1>${e.icon} ${esc(e.title)}</h1>
      <p class="lead">${esc(e.summary)}</p>
      <p class="muted small" id="event-progress">${eventProgress(e, ready)}</p>
      ${docs.length ? `<section><h2>📄 કરવાનાં કામ / દસ્તાવેજ</h2><ul class="event-list">${docs.map(([it, i]) => row(it, i)).join('')}</ul></section>` : ''}
      ${helps.length ? `<section><h2>🎁 મળી શકે એવી સહાય</h2><ul class="event-list">${helps.map(([it, i]) => row(it, i)).join('')}</ul></section>` : ''}
      <p class="note">દરેક કામ પર ટેપ કરો એટલે તેની પૂરી વિગત, પુરાવા અને પગલાં દેખાશે. થઈ જાય એટલે ☐ પર ✓ કરો.</p>
    </article>`;
}

function eventProgress(e, ready) {
  const n = ready.filter((i) => i < e.items.length).length;
  return n === e.items.length ? '✅ બધું થઈ ગયું!' : `${n} / ${e.items.length} થઈ ગયું`;
}

function viewAll() {
  return filterPage('all', '📋 બધી યોજના', '🔍 યોજના શોધો… (જેમ કે પેન્શન, લોન)', [
    { id: '', icon: '📋', label: 'બધી' },
    ...CATEGORIES,
  ]);
}

function viewToday() {
  const items = [...state.updates].sort((a, b) => (a.date < b.date ? 1 : -1));
  const body = items.length
    ? items
        .map(
          (u) => `
      <article class="card card-static ${u.type === 'chetavani' ? 'card-warn' : ''}">
        <div class="tags"><span class="tag">${u.type === 'chetavani' ? '⚠️ ચેતવણી' : 'ℹ️ જાણકારી'}</span><span class="muted small">${esc(formatDate(u.date))}</span></div>
        <h3>${esc(u.title)}</h3>
        <p>${esc(u.summary)}</p>
        <div class="row">
          <button class="btn" data-action="speak-update" data-id="${esc(u.id)}">🔊 સાંભળો</button>
          ${u.link ? `<a class="btn" href="${esc(u.link)}" target="_blank" rel="noopener">મૂળ સ્રોત ↗</a>` : ''}
        </div>
        ${u.source ? `<p class="muted small">સ્રોત: ${esc(u.source)}</p>` : ''}
      </article>`
        )
        .join('')
    : '<div class="empty">આજે કોઈ નવી માહિતી નથી.</div>';
  return `
    <section class="page-head"><h1>આજનું</h1><p class="muted">નવી યોજના, ભરતી અને જરૂરી ચેતવણી</p></section>
    <div class="cards">${body}</div>`;
}

function viewSaved() {
  const saved = store.getSaved().map(findScheme).filter(Boolean);
  return `
    ${reminderBanner()}
    <section class="page-head">
      <h1>સેવ કરેલ</h1>
      <p class="muted">⭐ સેવ કરેલી યોજનાની છેલ્લી તારીખ પહેલાં યાદ કરાવીશું.</p>
    </section>
    ${list(saved, 'હજુ કંઈ સેવ નથી કર્યું. યોજના ખોલીને ⭐ સેવ કરો દબાવો.')}`;
}

// યોજના અને દસ્તાવેજમાં શબ્દો જુદા (KruPa ગાઈડ મુજબ)
const KIND_TEXT = {
  scheme: { benefit: '✅ શું મળશે', who: '👥 કોણ લાયક', steps: '📝 અરજીનાં પગલાં', where: '📍 ક્યાં અરજી કરવી', link: 'સત્તાવાર વેબસાઇટ ખોલો ↗' },
  doc: { benefit: '✅ ક્યાં કામ આવે', who: '👥 કોણ કઢાવી શકે', steps: '📝 કઢાવવાનાં પગલાં', where: '📍 ક્યાંથી કઢાવવું', link: 'અરજીની વેબસાઇટ ખોલો ↗' },
};
const kindText = (s) => KIND_TEXT[isDoc(s) ? 'doc' : 'scheme'];

// બોલતી વખતે ⚠️ નિશાન ન વાંચે
const forSpeech = (t) => String(t || '').replace(/⚠️\s*ચકાસો/g, '').replace(/⚠️/g, '');

function speechText(s) {
  const k = kindText(s);
  const plain = (t) => t.replace(/^[^઀-૿A-Za-z0-9]+\s*/u, '');
  const parts = [
    s.title + '.',
    s.summary,
    plain(k.benefit) + '. ' + s.benefit,
    plain(k.who) + '. ' + s.eligibility.join(' '),
    s.fee ? 'ફી. ' + s.fee + '.' : '',
    s.days ? 'કેટલા દિવસ. ' + s.days + '.' : '',
    'કયા પુરાવા જોઈએ. ' + s.documents.join(', ') + '.',
    s.howToApply ? plain(k.where) + '. ' + s.howToApply : '',
    s.steps && s.steps.length ? plain(k.steps) + '. ' + s.steps.map((t, i) => `પગલું ${i + 1}. ${t}`).join(' ') : '',
    isDoc(s) ? '' : s.lastDate ? `છેલ્લી તારીખ ${formatDate(s.lastDate)}.` : 'આ ચાલુ યોજના છે.',
  ];
  return forSpeech(parts.filter(Boolean).join('\n'));
}

function shareText(s) {
  const k = kindText(s);
  const lines = [
    `*${s.title}*`,
    s.summary,
    '',
    `${k.benefit}: ${s.benefit}`,
    `📄 પુરાવા: ${s.documents.join(', ')}`,
  ];
  if (s.fee) lines.push(`💰 ફી: ${s.fee}`);
  if (!isDoc(s)) lines.push(`📅 ${s.lastDate ? 'છેલ્લી તારીખ: ' + formatDate(s.lastDate) : 'ચાલુ યોજના'}`);
  lines.push(`🔗 ${s.officialLink}`, '', `પૂરાં પગલાં અને આવી માહિતી ગુજરાતીમાં: ${appUrl()}#/scheme/${encodeURIComponent(s.id)}`);
  return lines.join('\n');
}

function docChecklist(s) {
  const ready = store.getDocs(s.id);
  const items = s.documents
    .map(
      (d, i) => `
      <li><button type="button" class="doc ${ready.includes(i) ? 'done' : ''}" data-action="doc" data-id="${esc(s.id)}" data-i="${i}" aria-pressed="${ready.includes(i)}">
        <span class="doc-box" aria-hidden="true"></span><span>${esc(d)}</span>
      </button></li>`
    )
    .join('');
  return `
    <p class="muted small" id="doc-progress">${docProgress(s, ready)}</p>
    <ul class="checklist">${items}</ul>`;
}

function docProgress(s, ready) {
  const n = ready.filter((i) => i < s.documents.length).length;
  if (n === s.documents.length) return '✅ બધા પુરાવા તૈયાર છે!';
  return `તૈયાર હોય તેના પર ટેપ કરો: ${n} / ${s.documents.length} તૈયાર`;
}

function facts(s) {
  const rows = [
    ['💰 ફી', s.fee],
    ['⏱️ કેટલા દિવસ', s.days],
    ['📆 માન્યતા', s.validity],
  ].filter(([, v]) => v);
  if (!rows.length) return '';
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

const bullets = (arr) => `<ul>${arr.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

// કયા પ્રસંગમાં આ કામ આવે છે
function relatedEvents(s) {
  const evs = state.events.filter((e) => e.items.some((it) => it.itemId === s.id));
  if (!evs.length) return '';
  return `<section><h2>🧭 આ કયા પ્રસંગમાં કામ આવે</h2><div class="chips chips-wrap">${evs
    .map((e) => `<a class="chip" href="#/event/${encodeURIComponent(e.id)}">${e.icon} ${esc(e.title)}</a>`)
    .join('')}</div></section>`;
}

function viewScheme(id) {
  const s = findScheme(id);
  if (!s) return `<div class="empty">આ માહિતી મળી નહીં. <a href="#/">પાછા જાઓ</a></div>`;
  const k = kindText(s);
  const saved = store.isSaved(s.id);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(shareText(s));
  const badgeHtml = badges(s);
  markSeen(s.id);
  const sources = (s.sources && s.sources.length ? s.sources : [{ label: s.source, url: s.officialLink }])
    .map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`)
    .join(' · ');
  return `
    <a class="back" href="${isDoc(s) ? '#/docs' : '#/'}" data-action="back">← પાછા</a>
    <article class="detail">
      <div class="tags">${isDoc(s) ? docGroupTag(s.group) : categoryTags(s.categories)}</div>
      <h1>${esc(s.title)}</h1>
      <p class="lead">${esc(s.summary)}</p>
      <div class="badges">${badgeHtml}</div>

      <div class="actions">
        <button class="btn btn-primary btn-big" data-action="speak" data-id="${esc(s.id)}">🔊 સાંભળો</button>
        <button class="btn btn-big" data-action="save" data-id="${esc(s.id)}">${saved ? '⭐ સેવ થયેલ' : '☆ સેવ કરો'}</button>
        <a class="btn btn-wa btn-big" href="${wa}" target="_blank" rel="noopener">WhatsApp પર શેર</a>
      </div>

      ${!s.verified ? `<div class="banner banner-draft">⚠️ આ માહિતી હજુ ચકાસવાની બાકી છે. ⚠️ નિશાનવાળી વાત ખાસ ચકાસો. અરજી કરતાં પહેલાં સત્તાવાર વેબસાઇટ કે કચેરીમાં ખાતરી કરો.</div>` : ''}

      <section><h2>${k.benefit}</h2><p>${esc(s.benefit)}</p></section>
      <section><h2>${k.who}</h2>${bullets(s.eligibility)}</section>
      ${facts(s)}
      <section>
        <h2>📄 કયા પુરાવા જોઈએ</h2>
        ${docChecklist(s)}
      </section>
      ${s.howToApply ? `<section><h2>${k.where}</h2><p>${esc(s.howToApply)}</p></section>` : ''}
      ${s.steps && s.steps.length ? `<section><h2>${k.steps}</h2><ol class="steps">${s.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></section>` : ''}
      ${s.mistakes && s.mistakes.length ? `<section class="box-warn"><h2>🚫 આ ભૂલો ન કરો</h2>${bullets(s.mistakes)}</section>` : ''}
      ${s.after && s.after.length ? `<section><h2>📬 અરજી પછી</h2>${bullets(s.after)}</section>` : ''}
      ${isDoc(s) ? '' : `<section><h2>📅 છેલ્લી તારીખ</h2><p>${s.lastDate ? esc(formatDate(s.lastDate)) : 'ચાલુ યોજના (કોઈ નક્કી છેલ્લી તારીખ નથી)'}</p></section>`}
      ${relatedEvents(s)}

      <a class="btn btn-big btn-block" href="${esc(s.officialLink)}" target="_blank" rel="noopener">${k.link}</a>

      <div class="operator-help">🧑‍💻 ફોર્મ ભરવામાં મદદ જોઈએ? નજીકના <strong>KruPa Digital Hub</strong> ઓપરેટર કે CSC સેન્ટરની મદદ લો.</div>

      <footer class="source">
        <p>સ્રોત: ${sources} · છેલ્લે અપડેટ: ${esc(formatDate(s.updatedOn))}</p>
        <p>ખાતરી માટે કચેરીમાં પૂછો. આ ખાનગી માહિતી એપ છે, સરકાર સાથે જોડાયેલી નથી.</p>
        <p><strong>અમે ક્યારેય પૈસા, OTP કે આધાર નંબર માંગતા નથી.</strong></p>
      </footer>
    </article>`;
}

function viewProfile() {
  const p = state.profile || { categories: [] };
  const opt = (items, val) =>
    items.map((i) => {
      const id = typeof i === 'string' ? i : i.id;
      const label = typeof i === 'string' ? i : i.label;
      return `<option value="${esc(id)}" ${val === id ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
  return `
    <section class="page-head">
      <h1>👤 મારી પ્રોફાઇલ</h1>
      <p class="muted">બધું વૈકલ્પિક છે. જેટલું ભરશો, એટલી સાચી યોજના દેખાશે. માહિતી ફક્ત આ ફોનમાં જ રહે છે.</p>
    </section>
    <form id="profile" class="stack">
      <fieldset>
        <legend>તમે કોણ છો? (એક કે વધુ)</legend>
        <div class="choice-grid">${categoryChoices(p.categories || [])}</div>
      </fieldset>
      <label class="field">ઉંમર (વર્ષ)
        <input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(p.age || '')}">
      </label>
      <label class="field">જાતિ
        <select name="jati"><option value="">— પસંદ કરો —</option>${opt(JATI, p.jati)}</select>
      </label>
      <label class="field">જિલ્લો
        <select name="district"><option value="">— પસંદ કરો —</option>${opt(DISTRICTS, p.district)}</select>
      </label>
      <label class="field">તાલુકો
        <input name="taluka" type="text" value="${esc(p.taluka || '')}" autocomplete="off">
      </label>
      <label class="field">વ્યવસાય
        <select name="occupation"><option value="">— પસંદ કરો —</option>${opt(OCCUPATIONS, p.occupation)}</select>
      </label>
      <label class="field">કુટુંબની વાર્ષિક આવક
        <select name="income"><option value="">— પસંદ કરો —</option>${opt(INCOME, p.income)}</select>
      </label>
      <p class="note">🔒 અમે આધાર નંબર, બેંક વિગત કે ફોન નંબર ક્યારેય નથી માંગતા.</p>
      <button class="btn btn-primary btn-big" type="submit">સેવ કરો</button>
      ${state.profile ? `<button class="btn btn-ghost" type="button" data-action="reset">મારી બધી માહિતી ફોનમાંથી કાઢી નાખો</button>` : ''}
    </form>`;
}

function viewAbout() {
  return `
    <a class="back" href="#/" data-action="back">← પાછા</a>
    <article class="detail">
      <h1>${esc(APP.name)} વિશે</h1>
      <p class="lead">ગામના દરેક માણસને તેના માટે કઈ યોજના, સહાય, નોકરી અને માહિતી છે તે સરળ ગુજરાતીમાં, બોલીને અને સામેથી જણાવવાની એપ.</p>
      <section><h2>⚠️ જરૂરી સૂચના</h2>
        <ul>
          <li>આ <strong>ખાનગી માહિતી એપ</strong> છે. તે કોઈ સરકારી વિભાગ સાથે જોડાયેલી નથી.</li>
          <li>દરેક માહિતી સત્તાવાર સ્રોતમાંથી લીધી છે, અને દરેક કાર્ડ પર સ્રોતની લિંક છે. અરજી કરતાં પહેલાં સત્તાવાર વેબસાઇટ કે કચેરીમાં ખાતરી કરો.</li>
          <li><strong>અમે ક્યારેય પૈસા, OTP કે આધાર નંબર માંગતા નથી.</strong> કોઈ આ એપના નામે માંગે તો તે ફ્રોડ છે. ફ્રોડ થાય તો 1930 પર ફોન કરો.</li>
        </ul>
      </section>
      <section><h2>🤝 KruPa Digital Hub</h2>
        <p>યોજના ગાઈડ, દસ્તાવેજ ગાઈડ અને પ્રસંગની માહિતી KruPa Digital Hub ની ગાઈડ પરથી લીધી છે. ફોર્મ ભરવામાં મદદ માટે નજીકના KruPa ઓપરેટર કે CSC સેન્ટરનો સંપર્ક કરો.</p>
      </section>
      <a class="btn btn-big btn-block" href="#/help">📞 જરૂરી ફોન નંબર</a>
      <section><h2>🔒 તમારી માહિતી</h2>
        <p>લોગિન નથી. પ્રોફાઇલ અને સેવ કરેલી યોજનાઓ ફક્ત તમારા ફોનમાં રહે છે; અમારા સર્વર પર જતી નથી. <a class="link" href="privacy.html">પ્રાઇવસી પોલિસી</a></p>
      </section>
      <p class="muted small">${versionLine()}</p>
    </article>`;
}

function viewLoading() {
  return `<div class="empty">લોડ થાય છે…</div>`;
}

function viewError() {
  return `<div class="empty">માહિતી લોડ ન થઈ. ઇન્ટરનેટ ચાલુ કરીને ફરી પ્રયત્ન કરો.<br><br><button class="btn btn-primary" data-action="retry">ફરી પ્રયત્ન કરો</button></div>`;
}

// ---------- રૂટિંગ ----------

function currentRoute() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  return { name: parts[0] || 'home', arg: decodeURIComponent(parts[1] || '') };
}

function render() {
  voice.stop();
  const { name, arg } = currentRoute();
  let html;
  if (!state.loaded) html = viewLoading();
  else if (state.error && !state.schemes.length) html = viewError();
  else {
    html = {
      home: viewHome,
      all: viewAll,
      today: viewToday,
      saved: viewSaved,
      scheme: () => viewScheme(arg),
      profile: viewProfile,
      about: viewAbout,
      help: viewHelp,
      docs: viewDocs,
      events: viewEvents,
      event: () => viewEvent(arg),
    }[name]?.() ?? viewHome();
  }
  $view.innerHTML = html;
  const item = name === 'scheme' ? findScheme(arg) : null;
  const tab = { event: 'events', today: 'home', help: 'home', scheme: item && isDoc(item) ? 'docs' : 'all' }[name] || name;
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === tab);
    a.setAttribute('aria-current', a.dataset.route === tab ? 'page' : 'false');
  });
  window.scrollTo(0, 0);
}

// ---------- ઘટનાઓ ----------

function readCategories(form) {
  return [...form.querySelectorAll('input[name="categories"]:checked')].map((i) => i.value);
}

$view.addEventListener('submit', (e) => {
  const form = e.target;
  e.preventDefault();
  if (form.id === 'onboard') {
    const categories = readCategories(form);
    if (!categories.length) return toast('ઓછામાં ઓછું એક પસંદ કરો.');
    state.profile = { categories };
    store.setProfile(state.profile);
    location.hash = '#/';
    render();
  }
  if (form.id === 'profile') {
    const fd = new FormData(form);
    const categories = readCategories(form);
    if (!categories.length) return toast('ઓછામાં ઓછું એક વર્ગ પસંદ કરો.');
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
  const scope = e.target.dataset && e.target.dataset.scope;
  if (scope && filters[scope]) {
    filters[scope].q = e.target.value;
    refreshList(scope);
  }
});

async function askNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    /* જૂના બ્રાઉઝર */
  }
}

let voiceHintShown = false;
function startSpeaking(btn, text) {
  if (voice.isSpeaking()) {
    voice.stop();
    return;
  }
  if (!voice.canSpeak()) return toast('આ ફોનમાં વાંચીને સંભળાવવાની સુવિધા નથી.');
  const label = btn.textContent;
  btn.textContent = '⏹ બંધ કરો';
  voice.speak(text, () => (btn.textContent = label));
  if (!voice.hasGujaratiVoice() && !voiceHintShown) {
    voiceHintShown = true;
    toast('ગુજરાતી અવાજ ન આવે તો ફોનના Settings → Text-to-speech માં ગુજરાતી ભાષા ઉમેરો.');
  }
}

$view.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  if (action === 'back') {
    e.preventDefault();
    if (inAppNavigations > 0) history.back();
    else location.hash = '#/';
  }

  if (action === 'speak') startSpeaking(el, speechText(findScheme(id)));

  if (action === 'speak-update') {
    const u = state.updates.find((x) => x.id === id);
    if (u) startSpeaking(el, u.title + '.\n' + u.summary);
  }

  if (action === 'save') {
    const s = findScheme(id);
    const nowSaved = store.toggleSaved(id);
    el.textContent = nowSaved ? '⭐ સેવ થયેલ' : '☆ સેવ કરો';
    toast(nowSaved ? (s.lastDate ? 'સેવ થયું. છેલ્લી તારીખ પહેલાં યાદ કરાવીશું.' : 'સેવ થયું ✓') : 'સેવમાંથી કાઢ્યું');
    if (nowSaved && s.lastDate) askNotificationPermission();
  }

  if (action === 'filter') {
    const scope = el.dataset.scope;
    filters[scope].cat = el.dataset.cat;
    document.querySelectorAll(`.chip[data-scope="${scope}"]`).forEach((c) => c.classList.toggle('active', c === el));
    refreshList(scope);
  }

  if (action === 'event-tick') {
    const i = Number(el.dataset.i);
    const ready = store.toggleDoc(id, i);
    const done = ready.includes(i);
    el.setAttribute('aria-pressed', String(done));
    el.closest('.event-item').classList.toggle('done', done);
    const ev = state.events.find((x) => 'event:' + x.id === id);
    const prog = document.getElementById('event-progress');
    if (ev && prog) prog.textContent = eventProgress(ev, ready);
  }

  if (action === 'reset') {
    if (!confirm('તમારી પ્રોફાઇલ અને સેવ કરેલી યોજનાઓ આ ફોનમાંથી કાઢી નાખીએ?')) return;
    store.clearAll();
    state.profile = null;
    state.seen = new Set(state.schemes.map((x) => x.id));
    store.setSeen([...state.seen]);
    location.hash = '#/';
    render();
  }

  if (action === 'doc') {
    const i = Number(el.dataset.i);
    const ready = store.toggleDoc(id, i);
    const done = ready.includes(i);
    el.classList.toggle('done', done);
    el.setAttribute('aria-pressed', String(done));
    const prog = document.getElementById('doc-progress');
    if (prog) prog.textContent = docProgress(findScheme(id), ready);
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

  if (action === 'retry') {
    state.loaded = false;
    render();
    await loadData();
    render();
  }
});

// શેર કરેલી લિંકથી સીધા કાર્ડ પર આવ્યા હોય તો "પાછા" હોમ પર લઈ જાય, એપની બહાર નહીં
let inAppNavigations = 0;
window.addEventListener('hashchange', () => {
  inAppNavigations++;
  render();
});

// ---------- શરૂઆત ----------

// અક્ષરનું કદ: સામાન્ય → મોટા → ખૂબ મોટા
const TEXT_SIZES = { m: 'સામાન્ય', l: 'મોટા', xl: 'ખૂબ મોટા' };
function applyTextSize(size) {
  document.documentElement.dataset.size = size;
}
applyTextSize(store.getTextSize());
document.getElementById('text-size').addEventListener('click', () => {
  const order = Object.keys(TEXT_SIZES);
  const next = order[(order.indexOf(store.getTextSize()) + 1) % order.length];
  store.setTextSize(next);
  applyTextSize(next);
  toast(`અક્ષર: ${TEXT_SIZES[next]}`);
});

// Android Chrome "ઇન્સ્ટોલ કરો" બટન બતાવવા દે ત્યારે
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  if (currentRoute().name === 'home' && state.loaded) render();
});
window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  toast('એપ ઇન્સ્ટોલ થઈ ગઈ ✓');
});

document.title = APP.name;
document.querySelectorAll('[data-app-name]').forEach((n) => (n.textContent = APP.name));

render();
loadData().then(() => {
  render();
  notifyDue();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
