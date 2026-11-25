// અલગ પેજ (યુઝર 25/11/26: "Google માં આવવા અને જાહેરાતની કમાણી માટે દરેક યોજનાનું અલગ પેજ").
// data/*.json પરથી:
//   yojana/<id>/index.html, dastavej/<id>/index.html, prasang/<id>/index.html  — એક કાર્ડ = એક સાદું પેજ
//   yojana/, dastavej/, prasang/ (યાદી), privacy.html, terms.html, about.html, disclaimer.html, dmca.html, 404.html
//   sitemap.xml (બધાં પેજ)
// દર વખતે આખું ફરી બને (જૂનું કાઢીને), એટલે Digital Hub માંથી કાઢેલું કાર્ડ અહીંથી પણ જાય.
// GitHub Action (sync-hub.yml) sync પછી આપોઆપ ચલાવે. હાથથી: node scripts/build-pages.mjs
// "⚠️ ચકાસો" એપ જેવું જ કાઢે (calm). લખાણ આપણું, ફક્ત સત્તાવાર લિંક; પેજ પર જાહેરાત નથી (હાલ).

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { APP } from '../js/config.js';
import { CATEGORIES, CATEGORY_BY_ID } from '../js/options.js';
import { INFO_PAGES, INFO_LINKS, INFO_UPDATED } from '../js/pages.js';

export const SITE = 'https://jankar.krupadigitalhub.in';
const ROOT = new URL('../', import.meta.url);
const at = (p) => new URL(p, ROOT);
const read = (f) => JSON.parse(readFileSync(at('data/' + f)));

// ---------- નાનાં સાધન ----------
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const UNSURE_RE = /\s*⚠\uFE0F?(?:\s*ચકાસો)?/gu;
export const calm = (v) =>
  typeof v === 'string'
    ? v.replace(UNSURE_RE, '').trim()
    : Array.isArray(v)
      ? v.map(calm).filter((x) => x !== '')
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, calm(x)]))
        : v;
const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');
export const ddmmyy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
const clip = (t, n) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** કાર્ડ (યોજના / દસ્તાવેજ) કે પ્રસંગનું સરનામું — એપ (js/app.js) પણ આ જ વાપરે */
export const pagePath = (kind, id) => `/${{ scheme: 'yojana', doc: 'dastavej', event: 'prasang' }[kind]}/${id}/`;

// ---------- ખોખું ----------
const contactHtml = () => {
  const c = APP.contact || {};
  return [
    c.whatsapp && `વોટ્સએપ <a href="https://wa.me/${esc(c.whatsapp)}">${esc(c.whatsapp.replace(/^91/, ''))}</a>`,
    c.email && `ઈમેલ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
  ]
    .filter(Boolean)
    .join(' · ');
};
const FOOT_LINKS = [
  ['/yojana/', 'યોજના'],
  ['/dastavej/', 'દસ્તાવેજ'],
  ['/prasang/', 'જીવનના પ્રસંગ'],
  ...INFO_LINKS.filter((l) => l.route !== 'contact').map((l) => [`/${l.route}.html`, l.label]),
  ['/#/contact', 'સંપર્ક'],
];

function shell({ path, title, description, image, appHref, body, jsonld = [] }) {
  const url = SITE + path;
  const img = https(image) || `${SITE}/icons/share.jpg`;
  return `<!doctype html>
<html lang="gu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clip(description, 160))}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#1e2f6b">
<link rel="icon" href="/icons/icon-192.png" type="image/png">
<link rel="manifest" href="/manifest.json">
<link rel="preload" href="/fonts/hind-vadodara-gujarati-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/page.css">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(APP.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(clip(description, 200))}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="gu_IN">
<meta name="twitter:card" content="summary_large_image">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top">
  <a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="36" height="36">${esc(APP.name)}</a>
  <a class="open" href="${esc(appHref || '/')}">એપમાં ખોલો</a>
</header>
<main>
${body}
</main>
<footer class="foot">
  <nav aria-label="માહિતી">${FOOT_LINKS.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}</nav>
  <p>© 2026 KruPa Digital Hub · સરકારી સાઇટ નથી</p>
</footer>
<script type="module">import { installWaPicker } from '/js/wa.js'; installWaPicker();</script>
</body>
</html>
`;
}

const crumbs = (list) => ({
  html: `<nav class="crumb" aria-label="તમે અહીં છો">${list.map(([h, l], i) => (i < list.length - 1 ? `<a href="${h}">${esc(l)}</a> ›` : `<span>${esc(l)}</span>`)).join(' ')}</nav>`,
  ld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map(([h, l], i) => ({ '@type': 'ListItem', position: i + 1, name: l, item: SITE + h })) },
});

const waShare = (title, url) => `https://wa.me/?text=${encodeURIComponent(`*${title}*\nકોને મળે, લાભ અને જરૂરી પુરાવા, ગુજરાતીમાં:\n${url}`)}`;

// ---------- એક કાર્ડ ----------
function cardPage(s, ctx) {
  const kind = s.kind === 'doc' ? 'doc' : 'scheme';
  const path = pagePath(kind, s.id);
  const list = kind === 'doc' ? ['/dastavej/', 'દસ્તાવેજ'] : ['/yojana/', 'યોજના'];
  const cr = crumbs([['/', APP.name], list, [path, s.title]]);
  const group = kind === 'doc' ? ctx.groups.get(s.group) : null;
  const cats = (s.categories || []).map((c) => CATEGORY_BY_ID[c]).filter(Boolean);
  const facts = [
    ['ફી', s.fee],
    ['માન્યતા', s.validity],
    ['છેલ્લી તારીખ', ddmmyy(s.lastDate)],
  ].filter(([, v]) => v);
  const sources = (s.sources && s.sources.length ? s.sources : s.officialLink ? [{ label: s.source || 'સત્તાવાર સાઇટ', url: s.officialLink }] : []).filter((x) => https(x.url));
  const inEvents = ctx.events.filter((e) => (e.items || []).some((it) => it.itemId === s.id));
  const related = ctx.cards
    .filter((x) => x.id !== s.id && x.kind === s.kind && (kind === 'doc' ? x.group === s.group : (x.categories || []).some((c) => c !== 'samanya' && (s.categories || []).includes(c))))
    .slice(0, 6);
  const expired = s.lastDate && s.lastDate < ctx.today;
  const desc = [s.summary, s.benefit && `લાભ: ${s.benefit}`].filter(Boolean).join(' ');
  const word = kind === 'doc' ? 'કેવી રીતે કઢાવવું, કયા પુરાવા' : 'કોને મળે, લાભ અને પુરાવા';
  const body = `
${cr.html}
${https(s.image) ? `<img class="hero" src="${esc(s.image)}" alt="${esc(s.title)}" width="1280" height="720">` : ''}
<h1>${esc(s.title)}</h1>
${s.summary ? `<p class="lead">${esc(s.summary)}</p>` : ''}
<div>${group ? `<a class="tag" href="/dastavej/#${esc(group.id)}">${esc(group.label)}</a>` : ''}${cats.map((c) => `<a class="tag" href="/yojana/#${esc(c.id)}">${esc(c.label)}</a>`).join('')}</div>
${expired ? `<p class="due">છેલ્લી તારીખ (${ddmmyy(s.lastDate)}) પૂરી થઈ ગઈ છે. નવી તારીખ માટે સત્તાવાર સાઇટ જુઓ.</p>` : s.lastDate ? `<p class="due">છેલ્લી તારીખ: ${ddmmyy(s.lastDate)}</p>` : ''}
<div class="grid">
  <div>
    ${s.benefit ? `<section class="box benefit"><h2>${kind === 'doc' ? 'શેમાં કામ આવે' : 'લાભ'}</h2><p>${esc(s.benefit)}</p></section>` : ''}
    ${(s.eligibility || []).length ? `<section class="box"><h2>${kind === 'doc' ? 'કોણ કઢાવી શકે' : 'કોને મળે'}</h2><ul>${s.eligibility.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
    ${(s.documents || []).length ? `<section class="box"><h2>જરૂરી પુરાવા (${s.documents.length})</h2><ol>${s.documents.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></section>` : ''}
  </div>
  <div>
    ${facts.length ? `<section class="box"><h2>ટૂંકી વિગત</h2><dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}
    ${sources.length ? `<section class="box"><h2>સત્તાવાર લિંક</h2><ul>${sources.map((x) => `<li><a href="${esc(x.url)}" rel="noopener" target="_blank">${esc(x.label || new URL(x.url).hostname)}</a></li>`).join('')}</ul><p class="note" style="margin-top:.5rem">અરજી હંમેશાં સત્તાવાર સાઇટ પર, ગ્રામ પંચાયત કે VCE પાસે જ કરો.</p></section>` : ''}
    ${inEvents.length ? `<section class="box"><h2>આ પ્રસંગમાં કામ આવે</h2><ul class="links">${inEvents.map((e) => `<li><a href="${pagePath('event', e.id)}"><b>${esc(e.icon || '')} ${esc(e.title)}</b></a></li>`).join('')}</ul></section>` : ''}
  </div>
</div>
<div class="cta">
  <a class="btn btn-main" href="/#/scheme/${esc(encodeURIComponent(s.id))}">જાણકાર એપમાં ખોલો: સેવ કરો, પુરાવાનું ✓ લિસ્ટ</a>
  <a class="btn btn-wa" href="${esc(waShare(s.title, SITE + path))}">વોટ્સએપ પર મોકલો</a>
</div>
${related.length ? `<h2 class="sec">${kind === 'doc' ? 'બીજા દસ્તાવેજ' : 'બીજી યોજના'}</h2><ul class="links two">${related.map((x) => `<li><a href="${pagePath(kind, x.id)}"><b>${esc(x.title)}</b>${x.summary ? `<small>${esc(clip(x.summary, 110))}</small>` : ''}</a></li>`).join('')}</ul>` : ''}
<p class="note">માહિતી: ${esc(ddmmyy(s.updatedOn) || ddmmyy(ctx.today))} સુધીની, સરકારી સાઇટ પરથી આપણા સરળ શબ્દોમાં. ${esc(APP.name)} સરકારી એપ નથી; નિયમ, ફી કે તારીખ બદલાઈ શકે — અરજી પહેલાં સત્તાવાર સાઇટ પર ખાતરી કરો. ભૂલ દેખાય તો <a href="/#/contact?about=${esc(encodeURIComponent(s.id))}">જણાવો</a>.</p>`;
  return {
    path,
    lastmod: s.updatedOn || ctx.today,
    html: shell({
      path,
      title: `${s.title} — ${word} | ${APP.name}`,
      description: desc || s.title,
      image: s.image,
      appHref: `/#/scheme/${encodeURIComponent(s.id)}`,
      body,
      jsonld: [cr.ld],
    }),
  };
}

// ---------- એક પ્રસંગ ----------
function eventPage(e, ctx) {
  const path = pagePath('event', e.id);
  const cr = crumbs([['/', APP.name], ['/prasang/', 'જીવનના પ્રસંગ'], [path, e.title]]);
  const items = (e.items || []).map((it) => {
    const card = it.itemId ? ctx.byId.get(it.itemId) : null;
    const name = it.title || (card && card.title) || '';
    const link = card ? pagePath(card.kind === 'doc' ? 'doc' : 'scheme', card.id) : '';
    return { name, link, note: it.note, type: it.type };
  }).filter((x) => x.name);
  const part = (type, title) => {
    const l = items.filter((x) => (type === 'doc' ? x.type !== 'scheme' : x.type === 'scheme'));
    return l.length ? `<section class="box"><h2>${title} (${l.length})</h2><ol class="steps">${l.map((x) => `<li>${x.link ? `<a href="${x.link}"><b>${esc(x.name)}</b></a>` : `<b>${esc(x.name)}</b>`}${x.note ? `<small>${esc(x.note)}</small>` : ''}</li>`).join('')}</ol></section>` : '';
  };
  const others = ctx.events.filter((x) => x.id !== e.id);
  const body = `
${cr.html}
${https(e.image) ? `<img class="hero" src="${esc(e.image)}" alt="${esc(e.title)}" width="1280" height="720">` : ''}
<h1>${esc(e.icon || '')} ${esc(e.title)}</h1>
${e.summary ? `<p class="lead">${esc(e.summary)}</p>` : ''}
<div class="grid"><div>${part('doc', 'કરવાનાં કામ અને દસ્તાવેજ')}</div><div>${part('scheme', 'મળી શકે એવી સહાય')}</div></div>
<div class="cta">
  <a class="btn btn-main" href="/#/event/${esc(encodeURIComponent(e.id))}">જાણકાર એપમાં ખોલો: ✓ કરતા જાઓ</a>
  <a class="btn btn-wa" href="${esc(waShare(e.title, SITE + path))}">વોટ્સએપ પર મોકલો</a>
</div>
${others.length ? `<h2 class="sec">બીજા પ્રસંગ</h2><ul class="links two">${others.map((x) => `<li><a href="${pagePath('event', x.id)}"><b>${esc(x.icon || '')} ${esc(x.title)}</b>${x.summary ? `<small>${esc(clip(x.summary, 110))}</small>` : ''}</a></li>`).join('')}</ul>` : ''}
<p class="note">${esc(APP.name)} સરકારી એપ નથી. દરેક કામની સાચી વિગત એના પેજ પર અને સત્તાવાર સાઇટ પર જુઓ.</p>`;
  return {
    path,
    lastmod: ctx.eventsUpdated || ctx.today,
    html: shell({ path, title: `${e.title} — કયા દસ્તાવેજ અને કઈ સહાય | ${APP.name}`, description: e.summary || e.title, image: e.image, appHref: `/#/event/${encodeURIComponent(e.id)}`, body, jsonld: [cr.ld] }),
  };
}

// ---------- યાદી ----------
function listPage(kind, ctx) {
  const conf = {
    scheme: { path: '/yojana/', title: 'ગુજરાતની સરકારી યોજના', lead: 'કોને મળે, કેટલો લાભ અને કયા પુરાવા — સરળ ગુજરાતીમાં.', app: '/#/all' },
    doc: { path: '/dastavej/', title: 'દસ્તાવેજ અને દાખલા', lead: 'આવક, જાતિ, આધાર, રેશનકાર્ડ જેવા દસ્તાવેજ ક્યાં કામ આવે અને કયા પુરાવા જોઈએ.', app: '/#/docs' },
    event: { path: '/prasang/', title: 'જીવનના પ્રસંગ', lead: 'જન્મ, લગ્ન, ભણતર, અવસાન જેવા પ્રસંગે કયા દસ્તાવેજ કઢાવવા અને કઈ સહાય મળી શકે.', app: '/#/events' },
  }[kind];
  const cr = crumbs([['/', APP.name], [conf.path, conf.title]]);
  const item = (x, k) => `<li><a href="${pagePath(k, x.id)}"><b>${esc(k === 'event' ? `${x.icon || ''} ${x.title}` : x.title)}</b>${x.summary ? `<small>${esc(clip(x.summary, 120))}</small>` : ''}</a></li>`;
  let sections;
  if (kind === 'event') sections = `<ul class="links two">${ctx.events.map((e) => item(e, 'event')).join('')}</ul>`;
  else if (kind === 'doc')
    sections = [...ctx.groups.values()]
      .map((g) => [g, ctx.docs.filter((d) => d.group === g.id)])
      .filter(([, l]) => l.length)
      .map(([g, l]) => `<h2 class="sec" id="${esc(g.id)}">${esc(g.label)} (${l.length})</h2><ul class="links two">${l.map((x) => item(x, 'doc')).join('')}</ul>`)
      .join('');
  else
    sections = CATEGORIES.map((c) => [c, ctx.schemes.filter((s) => (s.categories || []).includes(c.id))])
      .filter(([, l]) => l.length)
      .map(([c, l]) => `<h2 class="sec" id="${esc(c.id)}">${esc(c.label)} માટે (${l.length})</h2><ul class="links two">${l.map((x) => item(x, 'scheme')).join('')}</ul>`)
      .join('');
  const body = `${cr.html}<h1>${esc(conf.title)}</h1><p class="lead">${esc(conf.lead)}</p>${sections}
<div class="cta"><a class="btn btn-main" href="${conf.app}">જાણકાર એપમાં શોધો</a></div>`;
  return { path: conf.path, lastmod: ctx.today, html: shell({ path: conf.path, title: `${conf.title} — ${APP.name}`, description: conf.lead, appHref: conf.app, body, jsonld: [cr.ld] }) };
}

// ---------- નિયમોનાં પેજ (Play Store અને Google માટે સાચું લખાણ, રીડાયરેક્ટ નહીં) ----------
function infoPage(route) {
  const pg = INFO_PAGES[route];
  const path = `/${route}.html`;
  const fill = (t) => esc(t).replace(/\{APP\}/g, esc(APP.name)).replace(/\{CONTACT\}/g, contactHtml());
  const cr = crumbs([['/', APP.name], [path, pg.title]]);
  const body = `${cr.html}<h1>${esc(pg.title)}</h1><p class="lead">${pg.sub ? esc(pg.sub) : `અમલ તારીખ: ${INFO_UPDATED}`}</p>
<article class="box info">${pg.parts
    .map(
      (x) => `<section><h2>${fill(x.title)}</h2>${x.text ? `<p>${fill(x.text)}</p>` : ''}${x.points ? `<ul>${x.points.map((t) => `<li>${fill(t)}</li>`).join('')}</ul>` : ''}${x.after ? `<p>${fill(x.after)}</p>` : ''}</section>`
    )
    .join('')}</article>`;
  return { path, lastmod: null, html: shell({ path, title: `${pg.title} — ${APP.name}`, description: pg.sub || `${APP.name} ની ${pg.title}.`, appHref: `/#/${route}`, body, jsonld: [cr.ld] }) };
}

function notFound() {
  return shell({
    path: '/404.html',
    title: `પેજ મળ્યું નહીં — ${APP.name}`,
    description: 'આ પેજ હવે નથી.',
    appHref: '/',
    // Digital Hub માં હમણાં ચાલુ થયેલું કાર્ડ: પેજ હજી બન્યું નથી (sync થોડી મિનિટમાં) → એ જ કાર્ડ એપમાં ખોલો
    body: `<script>(function(){var m=location.pathname.match(/^\\/(yojana|dastavej|prasang)\\/([a-z0-9-]{1,80})\\/?$/);if(m)location.replace('/#/'+(m[1]==='prasang'?'event':'scheme')+'/'+m[2]);})();</script>
<h1>પેજ મળ્યું નહીં</h1><p class="lead">આ યોજના કે પેજ હવે નથી, અથવા લિંક બદલાઈ છે.</p><div class="cta"><a class="btn btn-main" href="/">જાણકાર ખોલો</a><a class="btn" href="/yojana/">બધી યોજના</a></div>`,
  });
}

// ---------- બધું ----------
export function buildAll(data, today = new Date().toISOString().slice(0, 10)) {
  const schemes = calm(data.schemes.schemes || []).filter((s) => ID_RE.test(s.id || ''));
  const docs = calm(data.documents.documents || []).filter((s) => ID_RE.test(s.id || ''));
  const events = calm(data.events.events || []).filter((e) => ID_RE.test(e.id || ''));
  const cards = [...schemes.map((s) => ({ ...s, kind: 'scheme' })), ...docs.map((s) => ({ ...s, kind: 'doc' }))];
  const ctx = {
    today,
    schemes,
    docs,
    events,
    cards,
    byId: new Map(cards.map((c) => [c.id, c])),
    groups: new Map((data.documents.groups || []).map((g) => [g.id, g])),
    eventsUpdated: data.events.updatedOn,
  };
  const pages = [
    ...cards.map((c) => cardPage(c, ctx)),
    ...events.map((e) => eventPage(e, ctx)),
    listPage('scheme', ctx),
    listPage('doc', ctx),
    listPage('event', ctx),
    ...INFO_LINKS.filter((l) => INFO_PAGES[l.route]).map((l) => infoPage(l.route)),
  ];
  const urls = [{ path: '/', lastmod: today, pr: '1.0' }, ...pages.map((p) => ({ path: p.path, lastmod: p.lastmod, pr: /^\/(yojana|dastavej|prasang)\/$/.test(p.path) ? '0.9' : p.path.endsWith('.html') ? '0.3' : '0.8' }))];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(SITE + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pr}</priority></url>`).join('\n')}
</urlset>
`;
  return { pages, sitemap, notFound: notFound() };
}

function main() {
  const data = { schemes: read('schemes.json'), documents: read('documents.json'), events: read('events.json') };
  // તારીખ ડેટાની (આજની નહીં): કંઈ ન બદલાય તો ફાઇલ પણ ન બદલાય, ને દર કલાકે નકામો commit ન થાય.
  const today = [data.schemes.updatedOn, data.documents.updatedOn, data.events.updatedOn].filter(Boolean).sort().pop() || '2026-11-25';
  const out = buildAll(data, today);
  for (const dir of ['yojana', 'dastavej', 'prasang']) rmSync(at(dir + '/'), { recursive: true, force: true });
  for (const p of out.pages) {
    const file = p.path.endsWith('/') ? p.path + 'index.html' : p.path;
    const url = at(file.slice(1));
    mkdirSync(new URL('./', url), { recursive: true });
    writeFileSync(url, p.html);
  }
  writeFileSync(at('sitemap.xml'), out.sitemap);
  writeFileSync(at('404.html'), out.notFound);
  console.log(`અલગ પેજ: ${out.pages.length} (+ sitemap.xml, 404.html)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
