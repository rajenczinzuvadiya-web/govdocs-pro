// પ્રોફાઇલ પ્રમાણે યોજના લાગુ પડે છે કે નહીં, અને તારીખના હિસાબ.
import { INCOME } from './options.js';

const DAY = 24 * 60 * 60 * 1000;

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** છેલ્લી તારીખને કેટલા દિવસ બાકી (null = ચાલુ યોજના, નેગેટિવ = પૂરી થઈ) */
export function daysLeft(scheme) {
  if (!scheme.lastDate) return null;
  const end = new Date(scheme.lastDate + 'T00:00:00');
  return Math.round((end - today()) / DAY);
}

export function isExpired(scheme) {
  const d = daysLeft(scheme);
  return d !== null && d < 0;
}

/**
 * યોજના આ પ્રોફાઇલને લાગુ પડે છે?
 * નિયમ: પ્રોફાઇલમાં જે માહિતી ન ભરી હોય તેના આધારે યોજના છુપાવવી નહીં.
 */
export function matches(scheme, profile) {
  if (!profile) return true;
  const cats = profile.categories || [];
  const inCategory =
    scheme.categories.includes('samanya') || scheme.categories.some((c) => cats.includes(c));
  if (!inCategory) return false;

  const r = scheme.rules || {};
  const age = Number(profile.age);
  if (profile.age !== '' && profile.age != null && !Number.isNaN(age)) {
    if (r.minAge != null && age < r.minAge) return false;
    if (r.maxAge != null && age > r.maxAge) return false;
  }
  if (r.jati && profile.jati && !r.jati.includes(profile.jati)) return false;
  if (r.maxIncome != null && profile.income) {
    const band = INCOME.find((b) => b.id === profile.income);
    if (band && band.min >= r.maxIncome) return false;
  }
  return true;
}

/** વધુ લાગુ પડતી યોજના પહેલાં: પોતાના વર્ગની, પછી નજીકની છેલ્લી તારીખ */
export function sortForProfile(list, profile) {
  const cats = (profile && profile.categories) || [];
  const score = (s) => (s.categories.some((c) => cats.includes(c)) ? 0 : 1);
  return [...list].sort((a, b) => {
    const sa = score(a), sb = score(b);
    if (sa !== sb) return sa - sb;
    const da = daysLeft(a), db = daysLeft(b);
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return 0;
  });
}

/** તારીખ DD/MM/YY (KruPa નિયમ) */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/** કાર્ડ પર બતાવવાનો તારીખનો સંદેશ */
export function deadlineText(scheme) {
  const d = daysLeft(scheme);
  if (d === null) return { text: 'ચાલુ યોજના', tone: 'ok' };
  if (d < 0) return { text: 'છેલ્લી તારીખ પૂરી થઈ', tone: 'over' };
  if (d === 0) return { text: 'આજે છેલ્લો દિવસ!', tone: 'urgent' };
  if (d <= 7) return { text: `ફક્ત ${d} દિવસ બાકી`, tone: 'urgent' };
  return { text: `છેલ્લી તારીખ: ${formatDate(scheme.lastDate)}`, tone: 'soon' };
}

// ---------- તમારા માટે યોજના શોધો (#/find, યુઝર 25/11/26) ----------
// જવાબ (બધા વૈકલ્પિક): cats (પ્રોફાઇલના વર્ગ), gender m/f/o, age (પ્રોફાઇલમાં હોય તો), occupation, area village/city, jati, divyang yes/no,
// student yes/no, bpl yes/no, income (INCOME id), widow yes/no, kids yes/no (18 થી નાનાં બાળક / સગર્ભા).
// ન ભરેલા જવાબને આધારે યોજના છુપાવવી નહીં (matches() નો જ નિયમ).

const FARM = ['ખેતી', 'ખેત મજૂરી', 'પશુપાલન'];

/** જવાબ પરથી વ્યક્તિ કયા વર્ગમાં આવે (options.js ના CATEGORIES ids) */
export function personCats(a = {}) {
  const age = Number(a.age);
  const hasAge = a.age !== '' && a.age != null && !Number.isNaN(age);
  // "તમે કોણ છો?" (પ્રોફાઇલના વર્ગ) — યુઝર 25/11/26 (3): યોજના શોધો અને પ્રોફાઇલ એક જ જવાબ
  const out = new Set(['samanya', ...(Array.isArray(a.cats) ? a.cats : [])]);
  if (a.occupation === 'નિવૃત્ત') out.add('vrudh');
  if (FARM.includes(a.occupation)) out.add('khedut');
  if (a.student === 'yes' || a.occupation === 'અભ્યાસ') out.add('vidyarthi');
  if (a.occupation === 'નોકરી શોધું છું' || (hasAge && age >= 18 && age <= 35 && a.occupation !== 'નિવૃત્ત')) out.add('yuvan');
  if (a.occupation === 'નાનો વેપાર / દુકાન') out.add('vepari');
  if (a.occupation === 'શિક્ષક') out.add('shikshak');
  if (a.kids === 'yes') {
    out.add('vali');
    if (a.gender !== 'm') out.add('mata');
  }
  if (hasAge && age >= 60) out.add('vrudh');
  if (a.widow === 'yes') out.add('vidhva');
  if (a.gender === 'm') out.delete('vidhva'), out.delete('mata');
  if (a.divyang === 'yes') out.add('divyang');
  return [...out];
}

const FEMALE_ONLY = /મહિલા|વિધવા|સગર્ભા|ધાત્રી|ગંગા સ્વરૂપા/;
const GIRL = /દીકરી|કન્યા|વિદ્યાર્થિની/;
const textOf = (s) => [s.title, s.summary, ...(s.eligibility || [])].join(' ');

/**
 * લાગુ પડતી યોજના, વધુ નજીકની પહેલાં. દરેક પર `why` = કેમ બતાવી (વર્ગ ids).
 * ક્રમ: પોતાના ખાસ વર્ગની (સામાન્ય સિવાય) → BPL / ગામ-શહેર મળતું હોય → છેલ્લી તારીખ નજીક.
 */
export function findSchemes(schemes, a = {}) {
  const cats = personCats(a);
  const profile = { categories: cats, age: a.age ?? '', jati: a.jati || '', income: a.income || '' };
  const out = [];
  for (const s of schemes) {
    if (isExpired(s)) continue;
    const title = s.title || '';
    if (a.gender === 'm' && (FEMALE_ONLY.test(title) || s.categories.every((c) => c === 'mata' || c === 'vidhva'))) continue;
    let mine = s.categories.filter((c) => c !== 'samanya' && cats.includes(c));
    if (a.gender === 'm' && GIRL.test(title)) mine = mine.filter((c) => c !== 'vidyarthi');
    if (!mine.length && !s.categories.includes('samanya')) continue;
    if (!matches(s, profile)) continue;
    const text = textOf(s);
    let bonus = 0;
    if (a.bpl === 'yes' && /BPL|બીપીએલ/.test(text)) bonus++;
    if (a.area === 'village' && /ગ્રામ્ય|ગામ/.test(text)) bonus++;
    if (a.area === 'city' && /શહેર/.test(text)) bonus++;
    out.push({ s, why: mine, score: mine.length * 10 + bonus });
  }
  return out.sort((x, y) => {
    if (x.score !== y.score) return y.score - x.score;
    const dx = daysLeft(x.s), dy = daysLeft(y.s);
    if (dx !== null && dy !== null) return dx - dy;
    return dx !== null ? -1 : dy !== null ? 1 : 0;
  });
}
