// Play Store માટેના ફોટા બનાવે: store/feature-graphic.png (1024x500) અને store/screenshots/*.png (1080x1920).
// ચલાવો:  node scripts/store-images.mjs   (server ની જરૂર નથી: ફાઇલો સીધી browser ને અપાય છે)
// ચાલુ server પરથી લેવું હોય તો:  APP_URL=http://localhost:8099/ node scripts/store-images.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = new URL('../', import.meta.url).pathname;
const LOCAL = 'http://jankar.local/';
const U = process.env.APP_URL || LOCAL;
const OUT = new URL('../store/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
// APP_URL ન હોય તો jankar.local ની દરેક માંગ repo ની ફાઇલમાંથી
async function serveLocal(ctx) {
  if (U !== LOCAL) return;
  await ctx.route(LOCAL + '**', (route) => {
    let path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const f = join(ROOT, path);
    if (!f.startsWith(ROOT) || !existsSync(f)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) });
  });
}
const profile = JSON.stringify({ categories: ['khedut', 'vrudh', 'samanya'], age: '', district: 'રાજકોટ' });

const shots = [
  ['1-home', '#/'],
  ['2-yojana', '#/all'],
  ['3-vigat', '#/scheme/ganga-swarupa-sahay'],
  ['4-dastavej', '#/docs'],
  ['5-prasang', '#/event/balak-no-janm'],
  ['6-farajiyat', '#/must'],
  ['7-shodho', '#/find'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
await serveLocal(ctx);
const p = await ctx.newPage();
await p.goto(U, { waitUntil: 'networkidle' });
for (const [name, route] of shots) {
  await p.evaluate(([prof, welcome]) => {
    localStorage.setItem('gj:theme', '"light"');
    localStorage.setItem('gj:seen', '[]');
    if (welcome) localStorage.removeItem('gj:profile');
    else localStorage.setItem('gj:profile', prof);
  }, [profile, route === 'welcome']);
  await p.goto(U + (route === 'welcome' ? '#/' : route), { waitUntil: 'networkidle' });
  await p.reload({ waitUntil: 'networkidle' });
  // હોમના ફોટામાં "સૂચન" બટન "ફક્ત માહિતી" લીટી પર ચડી ભૂલ જેવું લાગે (28/11/26) — ફક્ત આ ફોટામાં છુપાવો
  if (name === '1-home') await p.addStyleTag({ content: '.fab { visibility: hidden; }' });
  await p.screenshot({ path: `${OUT}screenshots/${name}.png` });
}

// Feature graphic: store/feature-bg.png (ચોપડી + માણસ) પર જમણી બાજુ નામ, એપના જ font માં
const fgCtx = await b.newContext({ viewport: { width: 1024, height: 500 }, serviceWorkers: 'block' });
await serveLocal(fgCtx);
const fg = await fgCtx.newPage();
await fg.goto(U, { waitUntil: 'networkidle' });
await fg.evaluate(() => {
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;background:url(store/feature-bg.png) center/cover;font-family:'Hind Vadodara',sans-serif">
      <div style="position:absolute;left:52%;right:4%;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
        <div style="font-size:120px;font-weight:700;line-height:1.05;color:#fff;text-shadow:0 4px 18px rgba(10,20,60,.45)">જાણકાર</div>
        <div style="margin-top:14px;font-size:30px;font-weight:600;color:#f4b56a;text-shadow:0 2px 10px rgba(10,20,60,.5)">KruPa Digital Hub</div>
      </div>
    </div>`;
});
await fg.waitForTimeout(300);
await fg.screenshot({ path: `${OUT}feature-graphic.png` });
await b.close();
console.log('PASS: store/ માં ફોટા બન્યા');
