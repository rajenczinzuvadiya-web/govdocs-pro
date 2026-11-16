// icons/icon.svg પરથી એપના PNG આઇકન બનાવે (192, 512 અને maskable 512).  ચલાવો: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = new URL('../icons/', import.meta.url).pathname;
const svg = readFileSync(dir + 'icon.svg', 'utf8');
// "જા" સાચા અક્ષરમાં દેખાય તે માટે એપનો જ font
const font = readFileSync(new URL('../fonts/hind-vadodara-gujarati-700-normal.woff2', import.meta.url)).toString('base64');
const fontCss = `@font-face{font-family:'Hind Vadodara';font-weight:700;src:url(data:font/woff2;base64,${font}) format('woff2')}`;
// maskable: આખો ચોરસ ભરેલો, ચિત્ર વચ્ચે નાનું (ફોન ગોળ કાપે તો પણ ન કપાય)
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<g id="art">', '<g id="art" transform="translate(64 64) scale(.75)">');
const b = await chromium.launch();
for (const [name, size, src] of [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['icon-maskable-512.png', 512, maskable]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<style>${fontCss}html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: dir + name, omitBackground: true });
}
await b.close();
console.log('PASS: આઇકન બન્યા');
