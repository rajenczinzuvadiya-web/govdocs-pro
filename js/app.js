import { APP } from './config.js';
import { CATEGORIES, CATEGORY_BY_ID, JATI, OCCUPATIONS, INCOME, DISTRICTS } from './options.js';
import { store } from './store.js';
import { matches, sortForProfile, isExpired, daysLeft, deadlineText, formatDate } from './match.js';
import * as voice from './speak.js';

const state = {
  schemes: [],
  updates: [],
  profile: store.getProfile(),
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
const findScheme = (id) => state.schemes.find((s) => s.id === id);
const visible = (list) => list.filter((s) => !isExpired(s));

function appUrl() {
  return location.origin + location.pathname;
}

// ---------- ડેટા ----------

async function loadData() {
  try {
    const [s, u] = await Promise.all([
      fetch('data/schemes.json', { cache: 'no-cache' }).then((r) => r.json()),
      fetch('data/updates.json', { cache: 'no-cache' }).then((r) => r.json()),
    ]);
    state.schemes = s.schemes || [];
    state.updates = u.updates || [];
    state.error = false;
  } catch {
    state.error = true;
  }
  state.loaded = true;
}

// ---------- કાર્ડ ----------

function categoryTags(ids) {
  return ids
    .filter((id) => CATEGORY_BY_ID[id])
    .map((id) => `<span class="tag">${CATEGORY_BY_ID[id].icon} ${esc(CATEGORY_BY_ID[id].label)}</span>`)
    .join('');
}

function badges(s) {
  const d = deadlineText(s);
  let out = `<span class="badge badge-${d.tone}">${esc(d.text)}</span>`;
  if (!s.verified) out += `<span class="badge badge-draft">ચકાસણી બાકી</span>`;
  if (store.isSaved(s.id)) out += `<span class="badge badge-saved">⭐ સેવ</span>`;
  return out;
}

function schemeCard(s) {
  return `
    <a class="card" href="#/scheme/${encodeURIComponent(s.id)}">
      <div class="tags">${categoryTags(s.categories)}</div>
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

function viewHome() {
  const p = state.profile;
  if (!p || !p.categories || !p.categories.length) return viewOnboarding();
  const mine = sortForProfile(visible(state.schemes).filter((s) => matches(s, p)), p);
  const incomplete = !p.age && !p.district;
  return `
    ${reminderBanner()}
    <section class="page-head">
      <h1>મારા માટે</h1>
      <p class="muted">તમને લાગુ પડી શકે એવી <strong>${mine.length}</strong> યોજના</p>
      <div class="tags tags-edit">${categoryTags(p.categories)} <a class="link" href="#/profile">બદલો</a></div>
    </section>
    ${incomplete ? `<a class="banner banner-info" href="#/profile">👤 ઉંમર અને જિલ્લો ઉમેરો, એટલે વધુ સાચી યોજના દેખાશે →</a>` : ''}
    ${list(mine, 'તમારા વર્ગ માટે હજુ કાર્ડ નથી. જલ્દી ઉમેરાશે. ત્યાં સુધી <a href="#/all">બધી યોજના</a> જુઓ.')}
    <p class="muted small center"><a class="link" href="#/about">આ એપ વિશે અને જરૂરી સૂચના</a></p>`;
}

let allFilter = { q: '', cat: '' };

function filteredAll() {
  const q = allFilter.q.trim().toLowerCase();
  return visible(state.schemes).filter((s) => {
    if (allFilter.cat && !s.categories.includes(allFilter.cat)) return false;
    if (!q) return true;
    return [s.title, s.summary, s.benefit, ...(s.documents || [])].join(' ').toLowerCase().includes(q);
  });
}

function viewAll() {
  const chips = [{ id: '', icon: '📋', label: 'બધી' }, ...CATEGORIES]
    .map(
      (c) =>
        `<button type="button" class="chip ${allFilter.cat === c.id ? 'active' : ''}" data-action="filter" data-cat="${c.id}">${c.icon} ${esc(c.label)}</button>`
    )
    .join('');
  return `
    <section class="page-head">
      <h1>બધી યોજના</h1>
      <input id="search" class="search" type="search" placeholder="🔍 યોજના કે ડોક્યુમેન્ટ શોધો…" value="${esc(allFilter.q)}" aria-label="શોધો">
      <div class="chips">${chips}</div>
    </section>
    <div id="all-list">${list(filteredAll(), 'કંઈ મળ્યું નહીં.')}</div>`;
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

function speechText(s) {
  const d = s.lastDate ? `છેલ્લી તારીખ ${formatDate(s.lastDate)}.` : 'આ ચાલુ યોજના છે.';
  return [
    s.title + '.',
    s.summary,
    'શું મળશે. ' + s.benefit,
    'કોણ લાયક. ' + s.eligibility.join(' '),
    'કયા ડોક્યુમેન્ટ જોઈએ. ' + s.documents.join(', ') + '.',
    'ક્યાં અરજી કરવી. ' + s.howToApply,
    d,
  ].join('\n');
}

function shareText(s) {
  const d = s.lastDate ? `છેલ્લી તારીખ: ${formatDate(s.lastDate)}` : 'ચાલુ યોજના';
  return [
    `*${s.title}*`,
    s.summary,
    '',
    `✅ શું મળશે: ${s.benefit}`,
    `📄 ડોક્યુમેન્ટ: ${s.documents.join(', ')}`,
    `📅 ${d}`,
    `🔗 સત્તાવાર લિંક: ${s.officialLink}`,
    '',
    `આવી માહિતી ગુજરાતીમાં મેળવવા એપ: ${appUrl()}`,
  ].join('\n');
}

function viewScheme(id) {
  const s = findScheme(id);
  if (!s) return `<div class="empty">આ યોજના મળી નહીં. <a href="#/">પાછા જાઓ</a></div>`;
  const saved = store.isSaved(s.id);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(shareText(s));
  return `
    <a class="back" href="#/" data-action="back">← પાછા</a>
    <article class="detail">
      <div class="tags">${categoryTags(s.categories)}</div>
      <h1>${esc(s.title)}</h1>
      <p class="lead">${esc(s.summary)}</p>
      <div class="badges">${badges(s)}</div>

      <div class="actions">
        <button class="btn btn-primary btn-big" data-action="speak" data-id="${esc(s.id)}">🔊 સાંભળો</button>
        <button class="btn btn-big" data-action="save" data-id="${esc(s.id)}">${saved ? '⭐ સેવ થયેલ' : '☆ સેવ કરો'}</button>
        <a class="btn btn-wa btn-big" href="${wa}" target="_blank" rel="noopener">WhatsApp પર શેર</a>
      </div>

      ${!s.verified ? `<div class="banner banner-draft">⚠️ આ કાર્ડની માહિતી હજુ ચકાસવાની બાકી છે. અરજી કરતાં પહેલાં સત્તાવાર લિંક જરૂર જુઓ.</div>` : ''}

      <section><h2>✅ શું મળશે</h2><p>${esc(s.benefit)}</p></section>
      <section><h2>👥 કોણ લાયક</h2><ul>${s.eligibility.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></section>
      <section><h2>📄 કયા ડોક્યુમેન્ટ જોઈએ</h2><ul class="checklist">${s.documents.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>
      <section><h2>📍 ક્યાં અરજી કરવી</h2><p>${esc(s.howToApply)}</p></section>
      <section><h2>📅 છેલ્લી તારીખ</h2><p>${s.lastDate ? esc(formatDate(s.lastDate)) : 'ચાલુ યોજના (કોઈ નક્કી છેલ્લી તારીખ નથી)'}</p></section>

      <a class="btn btn-big btn-block" href="${esc(s.officialLink)}" target="_blank" rel="noopener">સત્તાવાર વેબસાઇટ ખોલો ↗</a>

      <footer class="source">
        <p>સ્રોત: ${esc(s.source)} · છેલ્લે અપડેટ: ${esc(formatDate(s.updatedOn))}</p>
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
      <section><h2>🔒 તમારી માહિતી</h2>
        <p>લોગિન નથી. પ્રોફાઇલ અને સેવ કરેલી યોજનાઓ ફક્ત તમારા ફોનમાં રહે છે; અમારા સર્વર પર જતી નથી. <a class="link" href="privacy.html">પ્રાઇવસી પોલિસી</a></p>
      </section>
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
    }[name]?.() ?? viewHome();
  }
  $view.innerHTML = html;
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
    a.setAttribute('aria-current', a.dataset.route === name ? 'page' : 'false');
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
  if (e.target.id === 'search') {
    allFilter.q = e.target.value;
    document.getElementById('all-list').innerHTML = list(filteredAll(), 'કંઈ મળ્યું નહીં.');
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
    allFilter.cat = el.dataset.cat;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === el));
    document.getElementById('all-list').innerHTML = list(filteredAll(), 'કંઈ મળ્યું નહીં.');
  }

  if (action === 'reset') {
    if (!confirm('તમારી પ્રોફાઇલ અને સેવ કરેલી યોજનાઓ આ ફોનમાંથી કાઢી નાખીએ?')) return;
    store.setProfile(null);
    store.setNotified({});
    store.getSaved().forEach((sid) => store.toggleSaved(sid));
    state.profile = null;
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

// શેર કરેલી લિંકથી સીધા કાર્ડ પર આવ્યા હોય તો "પાછા" હોમ પર લઈ જાય, એપની બહાર નહીં
let inAppNavigations = 0;
window.addEventListener('hashchange', () => {
  inAppNavigations++;
  render();
});

// ---------- શરૂઆત ----------

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
