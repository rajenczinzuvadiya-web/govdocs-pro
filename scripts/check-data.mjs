// યોજના, દસ્તાવેજ અને પ્રસંગનો ડેટા સાચા ફોર્મેટમાં છે કે નહીં તે ચકાસે.
// ચલાવો: node scripts/check-data.mjs
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../js/options.js';

const cats = new Set(CATEGORIES.map((c) => c.id));
const errors = [];
let unverified = 0;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const read = (f) => JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url)));

const { schemes } = read('schemes.json');
const { documents, groups } = read('documents.json');
const { events } = read('events.json');
const groupIds = new Set(groups.map((g) => g.id));
const ids = new Set();

function checkItem(s, kind) {
  const at = `${kind === 'doc' ? 'દસ્તાવેજ' : 'યોજના'} "${s.id || '?'}"`;
  for (const f of ['id', 'title', 'summary', 'benefit', 'officialLink', 'source', 'updatedOn']) {
    if (!s[f] || typeof s[f] !== 'string') errors.push(`${at}: "${f}" ખૂટે છે`);
  }
  for (const f of ['eligibility', 'documents']) {
    if (!Array.isArray(s[f]) || !s[f].length) errors.push(`${at}: "${f}" ખાલી છે`);
  }
  if (!s.howToApply && !(s.steps && s.steps.length)) errors.push(`${at}: "howToApply" કે "steps" માંથી એક જોઈએ`);
  if (ids.has(s.id)) errors.push(`${at}: id બે વાર છે`);
  ids.add(s.id);
  if ((s.kind || 'scheme') !== kind) errors.push(`${at}: kind "${kind}" હોવું જોઈએ`);
  if (kind === 'scheme') {
    if (!Array.isArray(s.categories) || !s.categories.length) errors.push(`${at}: "categories" ખાલી છે`);
  } else if (!groupIds.has(s.group)) {
    errors.push(`${at}: અજાણ્યો વિભાગ "${s.group}"`);
  }
  (s.categories || []).forEach((c) => cats.has(c) || errors.push(`${at}: અજાણ્યો વર્ગ "${c}"`));
  const links = [s.officialLink, ...(s.sources || []).map((x) => x.url)];
  links.forEach((u) => u && !u.startsWith('https://') && errors.push(`${at}: લિંક https:// થી શરૂ થવી જોઈએ (${u})`));
  if (s.lastDate != null && !isDate(s.lastDate)) errors.push(`${at}: lastDate YYYY-MM-DD કે null હોવી જોઈએ`);
  if (s.updatedOn && !isDate(s.updatedOn)) errors.push(`${at}: updatedOn YYYY-MM-DD હોવી જોઈએ`);
  if (typeof s.verified !== 'boolean') errors.push(`${at}: verified true/false હોવું જોઈએ`);
  else if (!s.verified) unverified++;
}

schemes.forEach((s) => checkItem(s, 'scheme'));
documents.forEach((s) => checkItem(s, 'doc'));

for (const c of cats) {
  if (!schemes.some((s) => s.categories.includes(c))) errors.push(`વર્ગ "${c}" માટે એક પણ યોજના નથી`);
}

for (const e of events) {
  const at = `પ્રસંગ "${e.id}"`;
  if (!e.title || !e.items || !e.items.length) errors.push(`${at}: નામ કે કામની યાદી ખૂટે છે`);
  (e.categories || []).forEach((c) => cats.has(c) || errors.push(`${at}: અજાણ્યો વર્ગ "${c}"`));
  e.items.forEach((it, i) => {
    if (it.itemId && !ids.has(it.itemId)) errors.push(`${at}: કામ ${i + 1} ની લિંક "${it.itemId}" કોઈ કાર્ડ પર નથી`);
    if (!it.itemId && !it.title) errors.push(`${at}: કામ ${i + 1} માં નામ કે લિંક નથી`);
  });
}

errors.forEach((e) => console.log('❌', e));
console.log(
  `\nયોજના ${schemes.length}, દસ્તાવેજ ${documents.length}, પ્રસંગ ${events.length} · ` +
    `${errors.length} ભૂલ · ${unverified} કાર્ડની ચકાસણી બાકી`
);
process.exit(errors.length ? 1 : 0);
