// યોજના કાર્ડનો ડેટા સાચા ફોર્મેટમાં છે કે નહીં તે ચકાસે.
// ચલાવો: node scripts/check-data.mjs
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../js/options.js';

const cats = new Set(CATEGORIES.map((c) => c.id));
const errors = [];
const warnings = [];
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const { schemes } = JSON.parse(readFileSync(new URL('../data/schemes.json', import.meta.url)));
const ids = new Set();

for (const s of schemes) {
  const at = `યોજના "${s.id || '?'}"`;
  for (const f of ['id', 'title', 'summary', 'benefit', 'howToApply', 'officialLink', 'source', 'updatedOn']) {
    if (!s[f] || typeof s[f] !== 'string') errors.push(`${at}: "${f}" ખૂટે છે`);
  }
  for (const f of ['categories', 'eligibility', 'documents']) {
    if (!Array.isArray(s[f]) || !s[f].length) errors.push(`${at}: "${f}" ખાલી છે`);
  }
  if (ids.has(s.id)) errors.push(`${at}: id બે વાર છે`);
  ids.add(s.id);
  (s.categories || []).forEach((c) => cats.has(c) || errors.push(`${at}: અજાણ્યો વર્ગ "${c}"`));
  if (s.officialLink && !s.officialLink.startsWith('https://')) errors.push(`${at}: officialLink https:// થી શરૂ થવી જોઈએ`);
  if (s.lastDate !== null && !isDate(s.lastDate)) errors.push(`${at}: lastDate YYYY-MM-DD કે null હોવી જોઈએ`);
  if (s.updatedOn && !isDate(s.updatedOn)) errors.push(`${at}: updatedOn YYYY-MM-DD હોવી જોઈએ`);
  if (typeof s.verified !== 'boolean') errors.push(`${at}: verified true/false હોવું જોઈએ`);
  else if (!s.verified) warnings.push(`${at}: ચકાસણી બાકી`);
}

for (const c of cats) {
  if (!schemes.some((s) => s.categories.includes(c))) warnings.push(`વર્ગ "${c}" માટે હજુ એક પણ કાર્ડ નથી`);
}

warnings.forEach((w) => console.log('⚠️ ', w));
errors.forEach((e) => console.log('❌', e));
console.log(`\n${schemes.length} કાર્ડ, ${errors.length} ભૂલ, ${warnings.length} ચેતવણી`);
process.exit(errors.length ? 1 : 0);
