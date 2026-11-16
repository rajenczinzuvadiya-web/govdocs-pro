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
