// icons/icon-source.png (1024 x 1024, આખો ચોરસ) પરથી બધા આઇકન બનાવે:
//   icons/icon-192.png, icons/icon-512.png  — ગોળ ખૂણા (એપ અને બ્રાઉઝર)
//   icons/icon-maskable-512.png             — આખો ચોરસ, ચિત્ર થોડું નાનું (ફોન ગોળ કાપે તો પણ ન કપાય)
//   store/play-icon-512.png                 — આખો ચોરસ (Play Store ખૂણા જાતે ગોળ કરે)
// ચલાવો: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../', import.meta.url).pathname;
const src = 'data:image/png;base64,' + readFileSync(root + 'icons/icon-source.png').toString('base64');

const html = (size, kind) => `<style>html,body{margin:0;background:transparent}
  .box{position:relative;width:${size}px;height:${size}px;overflow:hidden;${kind === 'round' ? 'border-radius:22%;' : ''}}
  .box img{position:absolute;inset:0;width:100%;height:100%}
  .mask{background:linear-gradient(180deg,#21357c,#161c56)}
  .art{transform:scale(.84);-webkit-mask-image:radial-gradient(ellipse 50% 50% at center,#000 86%,transparent 100%)}</style>
  <div class="box ${kind === 'maskable' ? 'mask' : ''}">${kind === 'maskable' ? `<img class="art" src="${src}">` : `<img src="${src}">`}</div>`;

const b = await chromium.launch();
for (const [out, size, kind] of [
  ['icons/icon-192.png', 192, 'round'],
  ['icons/icon-512.png', 512, 'round'],
  ['icons/icon-maskable-512.png', 512, 'maskable'],
  ['store/play-icon-512.png', 512, 'square'],
]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(html(size, kind));
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  await p.screenshot({ path: root + out, omitBackground: true });
}
await b.close();
console.log('PASS: આઇકન બન્યા');
