// ફોનમાં જ સેવ (localStorage). પ્રાઇવેટ મોડમાં storage ન મળે તો એપ ચાલુ રહે, ફક્ત સેવ ન થાય.

const PREFIX = 'gj:';
const memory = {};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return key in memory ? memory[key] : fallback;
  }
}

function write(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage બંધ છે — memory માં રહેશે */
  }
}

export const store = {
  getProfile: () => read('profile', null),
  setProfile: (p) => write('profile', p),

  getSaved: () => read('saved', []),
  setSaved: (ids) => write('saved', ids),
  isSaved: (id) => read('saved', []).includes(id),
  toggleSaved(id) {
    const saved = read('saved', []);
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    write('saved', next);
    return next.includes(id);
  },

  // જોયેલી યોજનાઓ ("નવું" નિશાન માટે). null = પહેલી વાર એપ ખોલી.
  getSeen: () => read('seen', null),
  setSeen: (ids) => write('seen', ids),

  // ડોક્યુમેન્ટ ચેકલિસ્ટ: { schemeId: [તૈયાર ડોક્યુમેન્ટના નંબર] }
  getDocs: (id) => read('docs', {})[id] || [],
  toggleDoc(id, i) {
    const all = read('docs', {});
    const list = all[id] || [];
    all[id] = list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
    write('docs', all);
    return all[id];
  },

  // ઝૂમ (80–120) અને દેખાવ (auto / light / dark) — આ ફોન પૂરતું
  getZoom: () => {
    const z = Number(read('zoom', 100));
    return [80, 90, 100, 110, 120].includes(z) ? z : 100;
  },
  setZoom: (z) => write('zoom', z),
  getTheme: () => {
    const t = read('theme', 'auto');
    return ['auto', 'light', 'dark'].includes(t) ? t : 'auto';
  },
  setTheme: (t) => write('theme', t),
  // દેખાવ slider નો આછો / કાળો ભાગ: '' | 'soft' | 'softer' | 'black'
  getShade: () => {
    const v = read('shade', '');
    return ['soft', 'softer', 'black'].includes(v) ? v : '';
  },
  setShade: (v) => write('shade', v),

  // "આજનું" માં જોયેલી પોસ્ટ (ઘંટડી પરનો નંબર). null = પહેલી વાર.
  getSeenUpdates: () => read('seenUpdates', null),
  setSeenUpdates: (ids) => write('seenUpdates', ids),

  clearAll() {
    ['profile', 'saved', 'notified', 'seen', 'docs'].forEach((k) => {
      delete memory[k];
      try { localStorage.removeItem(PREFIX + k); } catch { /* ignore */ }
    });
  },

  // દરેક યોજના માટે છેલ્લે નોટિફિકેશન ક્યારે બતાવ્યું (દિવસમાં એક જ વાર)
  getNotified: () => read('notified', {}),
  setNotified: (map) => write('notified', map),
};
