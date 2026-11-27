// "આજે શું નવું" નો તર્ક (યુઝર 27/11/26): પોસ્ટના પ્રકાર, પોસ્ટમાંથી યોજનાની છેલ્લી તારીખ, અને
// છેલ્લી તારીખવાળી યોજનાની પોસ્ટ આપોઆપ. ફક્ત તર્ક (DOM નહીં), એટલે app.js અને scripts/ બંને વાપરે.
//
// પોસ્ટ (data/updates.json) નાં ખાનાં: id, date, type, title, summary, link, source, image, categories
//   + વૈકલ્પિક: itemId (કાર્ડનું id → "પૂરી માહિતી જુઓ"), lastDate (YYYY-MM-DD, ફોર્મની છેલ્લી તારીખ).
// પોસ્ટમાં itemId + lastDate હોય તો એ યોજના પર પણ એ છેલ્લી તારીખ લાગે (કાર્ડ Digital Hub નું હોય તો પણ),
// એટલે "ફોર્મ ચાલુ" બિલ્લો, "છેલ્લી તારીખ નજીક" અને સેવ કરેલી યોજનાની યાદ આપોઆપ ચાલે.

export const NEWS_TYPES = {
  form: { label: 'ફોર્મ ચાલુ', icon: 'forms', tone: 'ok' },
  result: { label: 'પરિણામ / હપ્તો', icon: 'banknote', tone: 'info' },
  jankari: { label: 'જાણકારી', icon: 'info', tone: 'info' },
  chetavani: { label: 'ચેતવણી', icon: 'alert', tone: 'warn' },
};
export const NEWS_TYPE_IDS = Object.keys(NEWS_TYPES);

// સાદી પોસ્ટ કેટલા દિવસ દેખાય (યુઝર 26/11/26). છેલ્લી તારીખવાળી પોસ્ટ એ તારીખ સુધી.
export const NEWS_DAYS = 30;
// છેલ્લી તારીખ કેટલા દિવસમાં હોય તો "છેલ્લી તારીખ નજીક" માં
export const SOON_DAYS = 7;

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** પોસ્ટની lastDate → યોજના પર (બેમાંથી મોડી તારીખ). નવી યાદી આપે, મૂળ બદલે નહીં. */
export function applyPostDates(items, updates) {
  const best = new Map();
  for (const u of updates || []) {
    if (!u || !u.itemId || !isDate(u.lastDate)) continue;
    if (!best.has(u.itemId) || u.lastDate > best.get(u.itemId)) best.set(u.itemId, u.lastDate);
  }
  return items.map((s) => {
    const d = best.get(s.id);
    return d && s.kind !== 'doc' && (!s.lastDate || d > s.lastDate) ? { ...s, lastDate: d } : s;
  });
}

/**
 * "આજે શું નવું" ની યાદી: છેલ્લા 30 દિવસની પોસ્ટ + છેલ્લી તારીખ હજી ન ગઈ હોય એવી પોસ્ટ
 * + જે યોજનાનું ફોર્મ ચાલુ છે (છેલ્લી તારીખ આજે કે પછી) અને એની પોસ્ટ નથી, એની આપોઆપ પોસ્ટ.
 * નવી ઉપર. આપોઆપ પોસ્ટનું id માં તારીખ, એટલે નવી તારીખ આવે તો ફરી "નવું" ગણાય.
 */
export function buildNews(updates, schemes, today = todayIso()) {
  const since = addDays(today, -NEWS_DAYS);
  const posts = (updates || []).filter(
    (u) => u && u.date && u.date <= today && (u.date >= since || (isDate(u.lastDate) && u.lastDate >= today))
  );
  const linked = new Set(posts.filter((u) => u.itemId).map((u) => u.itemId));
  const auto = (schemes || [])
    .filter((s) => s.kind !== 'doc' && isDate(s.lastDate) && s.lastDate >= today && !linked.has(s.id))
    .map((s) => ({
      id: `auto-${s.id}-${s.lastDate}`,
      date: isDate(s.updatedOn) && s.updatedOn <= today ? s.updatedOn : today,
      type: 'form',
      title: s.title,
      summary: s.summary,
      categories: s.categories || [],
      itemId: s.id,
      lastDate: s.lastDate,
      image: s.image,
      auto: true,
    }));
  return [...posts, ...auto].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** છેલ્લી તારીખ નજીક (આજથી 7 દિવસમાં) એવી યોજના, પહેલાં નજીકની. */
export function dueItems(schemes, today = todayIso(), days = SOON_DAYS) {
  const until = addDays(today, days);
  return (schemes || [])
    .filter((s) => s.kind !== 'doc' && isDate(s.lastDate) && s.lastDate >= today && s.lastDate <= until)
    .sort((a, b) => (a.lastDate < b.lastDate ? -1 : a.lastDate > b.lastDate ? 1 : 0));
}
