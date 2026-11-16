// icons/icon.svg પરથી એપના PNG આઇકન બનાવે (192, 512 અને maskable 512).  ચલાવો: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = new URL('../icons/', import.meta.url).pathname;
const svg = readFileSync(dir + 'icon.svg', 'utf8');
// maskable: આખો ચોરસ ભરેલો, ચિત્ર વચ્ચે નાનું (ફોન ગોળ કાપે તો પણ ન કપાય)
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<g id="art">', '<g id="art" transform="translate(64 64) scale(.75)">');
const b = await chromium.launch();
for (const [name, size, src] of [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['icon-maskable-512.png', 512, maskable]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`);
  await p.screenshot({ path: dir + name, omitBackground: true });
}
await b.close();
console.log('PASS: આઇકન બન્યા');
