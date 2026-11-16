// KruPa Digital Hub (એડમિન → ગાઇડ મેનેજ, ભરતી) માં લાઇવ થયેલી યોજના, દસ્તાવેજ, પ્રસંગ અને ભરતી જાણકારના data/ માં લાવે.
// GitHub Actions દર 3 કલાકે ચલાવે છે (.github/workflows/sync-hub.yml). હાથથી: node scripts/sync-hub.mjs [feed.json]
//
// નિયમો:
// - Digital Hub નું કાર્ડ = મુખ્ય. એ જ id નું જાણકારનું કાર્ડ બદલાઈ જાય (`from: "hub"`).
// - Digital Hub માં વર્ગ (categories) કે છેલ્લી તારીખ ન ભરી હોય તો જાણકારનું જૂનું જ રહે.
// - Digital Hub માંથી આવેલું કાર્ડ ત્યાં બંધ / કાઢી નાખ્યું હોય તો અહીંથી પણ જાય. જાણકારનાં પોતાનાં કાર્ડ રહે.
// - સલામતી: Digital Hub થોડાં જ કાર્ડ આપે (ભૂલ, બંધ સાઇટ) તો કંઈ બદલાતું નથી.
import { readFileSync, writeFileSync } from 'node:fs';
import { CATEGORIES } from '../js/options.js';

export const FEED_URL = 'https://www.krupadigitalhub.in/api/jankar';
const MIN_CARDS = 20;

const CATS = new Set(CATEGORIES.map((c) => c.id));
// Digital Hub નો વિભાગ → જાણકારનો વર્ગ (એડમિને વર્ગ ન પસંદ કર્યો હોય અને જાણકારમાં જૂનું કાર્ડ ન હોય ત્યારે)
const GROUP_CATS = {
  pension: ['vrudh', 'vidhva', 'divyang'],
  women: ['mata', 'vali'],
  health: ['samanya'],
  farmer: ['khedut'],
  home: ['samanya'],
  work: ['yuvan', 'vepari'],
  student: ['vidyarthi'],
  other: ['samanya'],
};

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Digital Hub નું એક કાર્ડ → જાણકારનું કાર્ડ (ખોટું હોય તો null). */
function card(raw, kind, local, groupIds) {
  if (!raw || typeof raw.id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(raw.id)) return null;
  const cats = strs(raw.categories).filter((c) => CATS.has(c));
  const localCats = strs(local?.categories).filter((c) => CATS.has(c));
  const categories = cats.length ? cats : localCats.length ? localCats : kind === 'scheme' ? GROUP_CATS[raw.hubGroup] || ['samanya'] : [];
  const sources = (Array.isArray(raw.sources) ? raw.sources : [])
    .filter((x) => x && str(x.url).startsWith('https://'))
    .map((x) => ({ label: str(x.label) || str(x.url), url: str(x.url) }));
  const officialLink = str(raw.officialLink).startsWith('https://') ? str(raw.officialLink) : sources[0]?.url || local?.officialLink || '';
  const out = {
    id: raw.id,
    kind,
    title: str(raw.title),
    summary: str(raw.summary),
    categories,
    ...(kind === 'doc' ? { group: str(raw.group) } : {}),
    benefit: str(raw.benefit),
    eligibility: strs(raw.eligibility),
    fee: str(raw.fee),
    days: str(raw.days),
    validity: str(raw.validity),
    documents: strs(raw.documents),
    steps: strs(raw.steps),
    mistakes: strs(raw.mistakes),
    after: strs(raw.after),
    lastDate: isDate(raw.lastDate) ? raw.lastDate : isDate(local?.lastDate) ? local.lastDate : null,
    officialLink,
    source: str(raw.source) || sources[0]?.label || local?.source || '',
    sources,
    words: str(raw.words),
    ...(str(raw.video).startsWith('https://') ? { video: str(raw.video) } : {}),
    from: 'hub',
    updatedOn: isDate(raw.updatedOn) ? raw.updatedOn : local?.updatedOn || new Date().toISOString().slice(0, 10),
    verified: raw.verified === true,
  };
  if (local?.rules) out.rules = local.rules;
  const ok =
    out.title && out.summary && out.benefit && out.officialLink && out.source &&
    out.eligibility.length && out.documents.length && out.steps.length &&
    (kind === 'doc' ? groupIds.has(out.group) : out.categories.length);
  return ok ? out : null;
}

/** ફીડ + જાણકારનો હાલનો ડેટા → નવો ડેટા અને નોંધ. ફક્ત તર્ક (ફાઇલ નહીં), એટલે ચકાસી શકાય. */
export function merge(feed, { schemes: S, documents: D, events: E }) {
  const notes = [];
  const groupIds = new Set(D.groups.map((g) => g.id));
  const renamed = { ...(S.renamed || {}) };
  const localById = new Map([...S.schemes, ...D.documents].map((c) => [c.id, c]));
  const feedS = Array.isArray(feed?.schemes) ? feed.schemes : [];
  const feedD = Array.isArray(feed?.documents) ? feed.documents : [];
  const feedE = Array.isArray(feed?.events) ? feed.events : [];
  const hubBefore = [...S.schemes, ...D.documents].filter((c) => c.from === 'hub').length;
  const total = feedS.length + feedD.length;
  if (total < MIN_CARDS || total < hubBefore / 2) {
    return { skip: `Digital Hub માંથી ફક્ત ${total} કાર્ડ આવ્યાં (પહેલાં ${hubBefore}). કંઈ બદલ્યું નથી.` };
  }

  const take = (list, kind) => {
    const got = new Map();
    for (const raw of list) {
      const local = localById.get(raw?.id) || localById.get(renamed[raw?.id]);
      const c = card(raw, kind, local, groupIds);
      if (c && !got.has(c.id)) got.set(c.id, c);
      else if (raw?.id) notes.push(`અધૂરું કાર્ડ છોડ્યું: ${raw.id}`);
    }
    return got;
  };
  const hubS = take(feedS, 'scheme');
  const hubD = take(feedD, 'doc');
  const hubIds = new Set([...hubS.keys(), ...hubD.keys()]);

  // જાણકારનું કાર્ડ રહે: Digital Hub માં એ id ન હોય અને એ પહેલાં Digital Hub માંથી આવ્યું ન હોય.
  const keep = (c) => !hubIds.has(c.id) && c.from !== 'hub';
  const gone = [...S.schemes, ...D.documents].filter((c) => !keep(c) && !hubIds.has(c.id));
  gone.forEach((c) => notes.push(`Digital Hub માં બંધ, અહીંથી કાઢ્યું: ${c.id}`));
  const schemes = [...S.schemes.filter(keep), ...hubS.values()];
  const documents = [...D.documents.filter(keep), ...hubD.values()];
  const all = new Map([...schemes, ...documents].map((c) => [c.id, c]));
  for (const [from, to] of Object.entries(renamed)) if (!all.has(to)) delete renamed[from];

  // પ્રસંગ: કામની લિંક એવા કાર્ડ પર જે હવે નથી → નામ સાથેની સાદી લીટી
  const oldById = new Map([...S.schemes, ...D.documents].map((c) => [c.id, c]));
  const fixItems = (items) =>
    items
      .map((it) => {
        const id = it.itemId && (all.has(it.itemId) ? it.itemId : all.has(renamed[it.itemId]) ? renamed[it.itemId] : '');
        if (id) return { ...it, itemId: id };
        const title = str(it.title) || oldById.get(it.itemId)?.title || '';
        return title ? { title, itemId: '', type: it.type === 'scheme' ? 'scheme' : 'doc', note: str(it.note) } : null;
      })
      .filter(Boolean);
  const localEv = new Map(E.events.map((e) => [e.id, e]));
  const hubEv = new Map();
  for (const raw of feedE) {
    if (!raw || typeof raw.id !== 'string' || !str(raw.title) || hubEv.has(raw.id)) continue;
    const local = localEv.get(raw.id);
    const cats = strs(raw.categories).filter((c) => CATS.has(c));
    const items = fixItems(
      (Array.isArray(raw.items) ? raw.items : []).map((i) => ({ title: str(i?.title), itemId: str(i?.itemId), type: i?.type, note: str(i?.note) }))
    );
    if (!items.length) continue;
    hubEv.set(raw.id, {
      id: raw.id,
      title: str(raw.title),
      icon: str(raw.icon) || local?.icon || '',
      summary: str(raw.summary),
      categories: cats.length ? cats : strs(local?.categories),
      items,
      from: 'hub',
      verified: raw.verified === true,
    });
  }
  const events = [
    ...E.events.filter((e) => !hubEv.has(e.id) && e.from !== 'hub').map((e) => ({ ...e, items: fixItems(e.items) })),
    ...hubEv.values(),
  ];

  return {
    schemes: { ...S, schemes, renamed },
    documents: { ...D, documents },
    events: { ...E, events },
    notes,
    counts: { schemes: hubS.size, documents: hubD.size, events: hubEv.size },
  };
}

// ---------- ભરતી ----------
const JOB_TYPES = new Set(['bharti', 'callletter', 'answerkey', 'result']);
const link = (v) => (str(v).startsWith('https://') ? str(v) : '');

/**
 * Digital Hub ની ભરતી (feed.jobs) → data/jobs.json. ફીડમાં `jobs` ન હોય (જૂનું Digital Hub) તો null = કંઈ ન બદલવું.
 * Digital Hub માંથી આવેલી (`from: "hub"`) બધી બદલાય; જાણકારની પોતાની રહે. ખોટી / અધૂરી ભરતી છોડાય.
 */
export function mergeJobs(feed, J) {
  if (!Array.isArray(feed?.jobs)) return null;
  const orgs = Array.isArray(feed.jobOrgs) && feed.jobOrgs.length
    ? feed.jobOrgs.filter((o) => o && /^[a-z0-9-]{2,40}$/.test(o.id) && str(o.label)).map((o) => ({ id: o.id, label: str(o.label), short: str(o.short) || str(o.label) }))
    : J.orgs;
  const orgIds = new Set(orgs.map((o) => o.id));
  const got = new Map();
  for (const r of feed.jobs) {
    if (!r || typeof r.id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(r.id) || got.has(r.id)) continue;
    const j = {
      id: r.id,
      type: JOB_TYPES.has(r.type) ? r.type : 'bharti',
      org: orgIds.has(r.org) ? r.org : 'other',
      title: str(r.title),
      advtNo: str(r.advtNo),
      posts: Number.isInteger(r.posts) && r.posts > 0 ? r.posts : null,
      qualification: str(r.qualification),
      age: str(r.age),
      fee: str(r.fee),
      date: isDate(r.date) ? r.date : '',
      startDate: isDate(r.startDate) ? r.startDate : null,
      lastDate: isDate(r.lastDate) ? r.lastDate : null,
      notification: link(r.notification),
      applyLink: link(r.applyLink),
      source: str(r.source),
      from: 'hub',
      updatedOn: isDate(r.updatedOn) ? r.updatedOn : new Date().toISOString().slice(0, 10),
      verified: r.verified === true,
    };
    if (j.title && j.date && j.source && (j.notification || j.applyLink)) got.set(j.id, j);
  }
  const jobs = [...J.jobs.filter((j) => j.from !== 'hub' && !got.has(j.id)), ...got.values()];
  return { ...J, orgs, jobs };
}

// ---------- ફાઇલ સાથે ચલાવવું ----------
const same = (a, b) => JSON.stringify({ ...a, updatedOn: '' }) === JSON.stringify({ ...b, updatedOn: '' });

async function main() {
  const at = (f) => new URL('../data/' + f, import.meta.url);
  const read = (f) => JSON.parse(readFileSync(at(f)));
  const arg = process.argv[2];
  let feed;
  if (arg) feed = JSON.parse(readFileSync(arg));
  else {
    // redirect: 'manual' — લોગિન પેજ પર મોકલે (જૂનું deploy) તો એ પણ "જવાબ નહીં" ગણાય.
    const res = await fetch(FEED_URL, { headers: { accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(30000) }).catch(() => null);
    feed = res && res.ok ? await res.json().catch(() => null) : null;
    if (!feed) {
      console.log(`Digital Hub એ સાચો જવાબ ન આપ્યો (${res ? res.status : 'નેટ'}). કંઈ બદલ્યું નથી.`);
      return;
    }
  }
  const now = { schemes: read('schemes.json'), documents: read('documents.json'), events: read('events.json') };
  const out = merge(feed, now);
  if (out.skip) {
    console.log(out.skip);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  let changed = 0;
  const jobsNow = read('jobs.json');
  const jobs = mergeJobs(feed, jobsNow);
  if (jobs && !same(jobs, jobsNow)) {
    writeFileSync(at('jobs.json'), JSON.stringify({ ...jobs, updatedOn: today }, null, 2) + '\n');
    changed++;
  }
  for (const f of ['schemes', 'documents', 'events']) {
    if (same(out[f], now[f])) continue;
    writeFileSync(at(f + '.json'), JSON.stringify({ ...out[f], updatedOn: today }, null, 2) + '\n');
    changed++;
  }
  out.notes.forEach((n) => console.log('•', n));
  const c = out.counts;
  console.log(`Digital Hub: યોજના ${c.schemes}, દસ્તાવેજ ${c.documents}, પ્રસંગ ${c.events}${jobs ? `, ભરતી ${jobs.jobs.filter((j) => j.from === 'hub').length}` : ''} · ${changed ? `${changed} ફાઇલ બદલાઈ` : 'નવું કંઈ નથી'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
