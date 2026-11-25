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

const RETIRED = ['steps', 'stepImages', 'mistakes', 'after', 'days', 'applyLink', 'howToApply'];

function checkItem(s, kind) {
  const at = `${kind === 'doc' ? 'દસ્તાવેજ' : 'યોજના'} "${s.id || '?'}"`;
  for (const f of ['id', 'title', 'summary', 'benefit', 'officialLink', 'source', 'updatedOn']) {
    if (!s[f] || typeof s[f] !== 'string') errors.push(`${at}: "${f}" ખૂટે છે`);
  }
  // યોજના / દસ્તાવેજ = કોને મળે + લાભ + જરૂરી પુરાવા (યુઝર 24/11/26). પગલાં, અરજીની લિંક, અરજી પછી, દિવસ, ભૂલો હવે નથી.
  for (const f of ['eligibility', 'documents']) {
    if (!Array.isArray(s[f]) || !s[f].length) errors.push(`${at}: "${f}" ખાલી છે`);
  }
  for (const f of RETIRED) if (f in s) errors.push(`${at}: "${f}" હવે રાખતા નથી`);
  if (ids.has(s.id)) errors.push(`${at}: id બે વાર છે`);
  ids.add(s.id);
  if ((s.kind || 'scheme') !== kind) errors.push(`${at}: kind "${kind}" હોવું જોઈએ`);
  if (kind === 'scheme') {
    if (!Array.isArray(s.categories) || !s.categories.length) errors.push(`${at}: "categories" ખાલી છે`);
  } else if (!groupIds.has(s.group)) {
    errors.push(`${at}: અજાણ્યો વિભાગ "${s.group}"`);
  }
  (s.categories || []).forEach((c) => cats.has(c) || errors.push(`${at}: અજાણ્યો વર્ગ "${c}"`));
  const links = [s.officialLink, ...(s.sources || []).map((x) => x.url), s.image];
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
  if (e.image && !e.image.startsWith('https://')) errors.push(`${at}: ફોટાની લિંક https:// થી શરૂ થવી જોઈએ (${e.image})`);
  e.items.forEach((it, i) => {
    if (it.itemId && !ids.has(it.itemId)) errors.push(`${at}: કામ ${i + 1} ની લિંક "${it.itemId}" કોઈ કાર્ડ પર નથી`);
    if (!it.itemId && !it.title) errors.push(`${at}: કામ ${i + 1} માં નામ કે લિંક નથી`);
  });
}


// આજે શું નવું (data/updates.json) અને ફોન નંબર (data/helplines.json)
const { updates } = read('updates.json');
const upIds = new Set();
for (const u of updates) {
  const at = `આજે શું નવું "${u.id || '?'}"`;
  for (const f of ['id', 'title', 'summary', 'date']) if (!u[f] || typeof u[f] !== 'string') errors.push(`${at}: "${f}" ખૂટે છે`);
  if (!['jankari', 'chetavani'].includes(u.type)) errors.push(`${at}: અજાણ્યો પ્રકાર "${u.type}"`);
  if (u.date && !isDate(u.date)) errors.push(`${at}: date YYYY-MM-DD હોવી જોઈએ`);
  [u.link, u.image].forEach((x) => x && !x.startsWith('https://') && errors.push(`${at}: લિંક https:// થી શરૂ થવી જોઈએ (${x})`));
  if (upIds.has(u.id)) errors.push(`${at}: id બે વાર છે`);
  upIds.add(u.id);
}
const { helplines } = read('helplines.json');
if (helplines.length < 5) errors.push(`ફોન નંબર: ફક્ત ${helplines.length} છે`);
for (const h of helplines) {
  if (!/^[0-9]{3,12}$/.test(h.number || '')) errors.push(`ફોન નંબર "${h.number}": ફક્ત આંકડા જોઈએ`);
  if (!h.title) errors.push(`ફોન નંબર "${h.number}": નામ ખૂટે છે`);
}

// ધ્યાન રાખો (data/dhyan.json): હોમની ફરતી પટ્ટી — સૂચના, ફ્રોડ, સામાન્ય ભૂલ, જાણકારી
const { items: dhyan } = read('dhyan.json');
if (!Array.isArray(dhyan) || !dhyan.length) errors.push('ધ્યાન રાખો: યાદી ખાલી છે');
const dhIds = new Set();
for (const d of dhyan || []) {
  const at = `ધ્યાન રાખો "${d.id}"`;
  if (!d.id || typeof d.id !== 'string' || dhIds.has(d.id)) errors.push(`${at}: id ખૂટે છે કે બે વાર છે`);
  dhIds.add(d.id);
  if (!['suchna', 'fraud', 'bhool', 'jankari'].includes(d.type)) errors.push(`${at}: અજાણ્યો પ્રકાર "${d.type}"`);
  if (!d.text || typeof d.text !== 'string' || d.text.length > 220) errors.push(`${at}: લખાણ ખાલી કે 220 અક્ષરથી લાંબું`);
  if (d.link && !String(d.link).startsWith('https://')) errors.push(`${at}: લિંક https:// થી શરૂ થવી જોઈએ`);
}

// ફરજિયાત દસ્તાવેજ (data/essentials.json): દરેક id યોજના / દસ્તાવેજમાં હોવું જોઈએ, "why" ટૂંકું
const essentials = read('essentials.json');
const cardIds = new Set([...schemes, ...documents].map((s) => s.id));
const checkEss = (list, at) => {
  if (!Array.isArray(list) || !list.length) return errors.push(`ફરજિયાત દસ્તાવેજ ${at}: યાદી ખાલી છે`);
  const seen = new Set();
  for (const x of list) {
    if (!cardIds.has(x.id)) errors.push(`ફરજિયાત દસ્તાવેજ ${at}: "${x.id}" કાર્ડ નથી`);
    if (seen.has(x.id)) errors.push(`ફરજિયાત દસ્તાવેજ ${at}: "${x.id}" બે વાર`);
    seen.add(x.id);
    if (!x.why || x.why.length > 120) errors.push(`ફરજિયાત દસ્તાવેજ ${at}: "${x.id}" નું "why" ખાલી કે લાંબું`);
  }
};
checkEss(essentials.all, 'બધા માટે');
for (const [c, list] of Object.entries(essentials.roles || {})) {
  if (!cats.has(c)) errors.push(`ફરજિયાત દસ્તાવેજ: અજાણ્યો વર્ગ "${c}"`);
  checkEss(list, c);
}

errors.forEach((e) => console.log('❌', e));
console.log(
  `\nયોજના ${schemes.length}, દસ્તાવેજ ${documents.length}, પ્રસંગ ${events.length}, આજે શું નવું ${updates.length}, ફોન નંબર ${helplines.length} · ` +
    `${errors.length} ભૂલ · ${unverified} કાર્ડની ચકાસણી બાકી`
);
process.exit(errors.length ? 1 : 0);
