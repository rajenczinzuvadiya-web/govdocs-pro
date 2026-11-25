// વોટ્સએપ / Facebook પર લિંક મોકલો ત્યારે દેખાતો ફોટો (1200 × 630) — icons/share.jpg. યુઝર 25/11/26.
// દેખાવ બદલાય ત્યારે: node scripts/share-image.mjs   (Playwright, server વગર)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = new URL('../', import.meta.url);
const b64 = (f) => readFileSync(new URL(f, root)).toString('base64');
const html = `<!doctype html><html lang="gu"><head><meta charset="utf-8"><style>
@font-face { font-family: H; src: url(data:font/woff2;base64,${b64('fonts/hind-vadodara-gujarati-700-normal.woff2')}) format('woff2'); font-weight: 700; }
@font-face { font-family: H; src: url(data:font/woff2;base64,${b64('fonts/hind-vadodara-gujarati-400-normal.woff2')}) format('woff2'); font-weight: 400; }
@font-face { font-family: L; src: url(data:font/woff2;base64,${b64('fonts/hind-vadodara-latin-700-normal.woff2')}) format('woff2'); font-weight: 700; }
html, body { margin: 0; }
.c { width: 1200px; height: 630px; box-sizing: border-box; padding: 70px 80px; display: flex; align-items: center; gap: 64px;
  background: radial-gradient(circle at 85% 15%, rgba(255,255,255,.16), transparent 45%), linear-gradient(135deg, #2b4bb8, #1e2f6b 70%); color: #fff; font-family: H, L, sans-serif; }
img { width: 260px; height: 260px; border-radius: 56px; box-shadow: 0 18px 50px rgba(0,0,0,.35); flex: none; }
h1 { margin: 0; font-size: 132px; line-height: 1.05; font-weight: 700; }
p { margin: 18px 0 0; font-size: 44px; line-height: 1.35; font-weight: 400; opacity: .95; }
small { display: inline-block; margin-top: 34px; padding: 10px 26px; border-radius: 999px; background: #f59e0b; color: #1e2f6b; font-size: 30px; font-weight: 700; }
</style></head><body><div class="c"><img src="data:image/png;base64,${b64('icons/icon-512.png')}" alt="">
<div><h1>જાણકાર</h1><p>યોજના, સહાય અને દાખલાની માહિતી<br>સરળ ગુજરાતીમાં</p><small>KruPa Digital Hub</small></div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const jpg = await page.screenshot({ type: 'jpeg', quality: 86 });
await browser.close();
writeFileSync(new URL('icons/share.jpg', root), jpg);
console.log(`icons/share.jpg ${Math.round(jpg.length / 1024)} KB`);
