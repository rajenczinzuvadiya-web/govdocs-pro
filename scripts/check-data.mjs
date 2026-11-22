// યોજના, દસ્તાવેજ, પ્રસંગ અને ભરતીનો ડેટા સાચા ફોર્મેટમાં છે કે નહીં તે ચકાસે.
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
  // Digital Hub માં એડમિન "પુરાવા" કે "પગલાં" બંધ કરી શકે (પાના પર શું બતાવવું): ત્યાંથી આવેલા કાર્ડમાં એ ખાલી ચાલે, બંને નહીં.
  const hub = s.from === 'hub';
  for (const f of hub ? ['eligibility'] : ['eligibility', 'documents']) {
    if (!Array.isArray(s[f]) || !s[f].length) errors.push(`${at}: "${f}" ખાલી છે`);
  }
  if (!Array.isArray(s.documents)) errors.push(`${at}: "documents" યાદી હોવી જોઈએ`);
  if (!s.howToApply && !(s.steps && s.steps.length) && !(hub && s.documents && s.documents.length)) errors.push(`${at}: "howToApply" કે "steps" માંથી એક જોઈએ`);
  if ('applyLink' in s && typeof s.applyLink !== 'string') errors.push(`${at}: "applyLink" લખાણ હોવું જોઈએ`);
  if (ids.has(s.id)) errors.push(`${at}: id બે વાર છે`);
  ids.add(s.id);
  if ((s.kind || 'scheme') !== kind) errors.push(`${at}: kind "${kind}" હોવું જોઈએ`);
  if (kind === 'scheme') {
    if (!Array.isArray(s.categories) || !s.categories.length) errors.push(`${at}: "categories" ખાલી છે`);
  } else if (!groupIds.has(s.group)) {
    errors.push(`${at}: અજાણ્યો વિભાગ "${s.group}"`);
  }
  (s.categories || []).forEach((c) => cats.has(c) || errors.push(`${at}: અજાણ્યો વર્ગ "${c}"`));
  const links = [s.officialLink, s.applyLink, ...(s.sources || []).map((x) => x.url), s.image, ...(s.stepImages || []).filter(Boolean)];
  if (s.stepImages && (!Array.isArray(s.stepImages) || s.stepImages.length !== (s.steps || []).length)) errors.push(`${at}: stepImages ની ગણતરી steps જેટલી હોવી જોઈએ`);
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

// ભરતી (data/jobs.json)
const JOB_TYPES = ['bharti', 'callletter', 'answerkey', 'result'];
const { orgs, jobs } = read('jobs.json');
const orgIds = new Set(orgs.map((o) => o.id));
for (const j of jobs) {
  const at = `ભરતી "${j.id || '?'}"`;
  for (const f of ['id', 'title', 'source', 'updatedOn', 'date']) if (!j[f] || typeof j[f] !== 'string') errors.push(`${at}: "${f}" ખૂટે છે`);
  if (!JOB_TYPES.includes(j.type)) errors.push(`${at}: અજાણ્યો પ્રકાર "${j.type}"`);
  if (!orgIds.has(j.org)) errors.push(`${at}: અજાણી સંસ્થા "${j.org}"`);
  if (!j.notification && !j.applyLink) errors.push(`${at}: સત્તાવાર જાહેરાત કે અરજીની લિંક જોઈએ`);
  [j.notification, j.applyLink, j.image].forEach((u) => u && !u.startsWith('https://') && errors.push(`${at}: લિંક https:// થી શરૂ થવી જોઈએ (${u})`));
  for (const f of ['date', 'startDate', 'lastDate', 'updatedOn']) if (j[f] != null && !isDate(j[f])) errors.push(`${at}: ${f} YYYY-MM-DD હોવી જોઈએ`);
  if (j.posts != null && !(Number.isInteger(j.posts) && j.posts > 0)) errors.push(`${at}: posts આંકડો કે null હોવો જોઈએ`);
  if (ids.has(j.id)) errors.push(`${at}: id બે વાર છે`);
  ids.add(j.id);
  if (typeof j.verified !== 'boolean') errors.push(`${at}: verified true/false હોવું જોઈએ`);
  else if (!j.verified) unverified++;
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

errors.forEach((e) => console.log('❌', e));
console.log(
  `\nયોજના ${schemes.length}, દસ્તાવેજ ${documents.length}, પ્રસંગ ${events.length}, ભરતી ${jobs.length}, આજે શું નવું ${updates.length}, ફોન નંબર ${helplines.length} · ` +
    `${errors.length} ભૂલ · ${unverified} કાર્ડની ચકાસણી બાકી`
);
process.exit(errors.length ? 1 : 0);
