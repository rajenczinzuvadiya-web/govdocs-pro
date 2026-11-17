// Play Store માટેના ફોટા બનાવે: store/feature-graphic.png (1024x500) અને store/screenshots/*.png (1080x1920).
// પહેલાં એપ ચલાવો:  python3 -m http.server 8099   પછી:  node scripts/store-images.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const U = process.env.APP_URL || 'http://localhost:8099/';
const OUT = new URL('../store/', import.meta.url).pathname;
const profile = JSON.stringify({ categories: ['khedut', 'vrudh', 'samanya'], age: '', district: 'રાજકોટ' });

const shots = [
  ['1-home', '#/'],
  ['2-yojana', '#/all'],
  ['3-vigat', '#/scheme/ganga-swarupa-sahay'],
  ['4-dastavej', '#/docs'],
  ['5-prasang', '#/event/balak-no-janm'],
  ['6-swagat', 'welcome'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
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
  await p.screenshot({ path: `${OUT}screenshots/${name}.png` });
}

// Feature graphic: store/feature-bg.png (ચોપડી + માણસ) પર જમણી બાજુ નામ, એપના જ font માં
const fg = await (await b.newContext({ viewport: { width: 1024, height: 500 } })).newPage();
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
