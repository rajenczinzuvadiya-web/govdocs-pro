/* Browser end-to-end check.
   Usage: NODE_PATH=$(npm root -g) node packaging-studio/tests/e2e.cjs <base-url> [letterpad.png] [out-dir]
   Serves nothing itself: start a static server at the repo root first (e.g. npx http-server -p 8123). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [base, letterpad, outDir = '.'] = process.argv.slice(2);
if (!base) { console.error('Base URL required'); process.exit(2); }
const url = base.replace(/\/$/, '') + '/packaging-studio/';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('#pv');
  ok((await page.textContent('#saveState')).includes('Saved'), 'app starts and autosaves');

  // reference image: a pink disc
  const pink = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 200); x.fillStyle = '#d9467a'; x.beginPath(); x.arc(100, 100, 80, 0, 7); x.fill(); return c.toDataURL(); });
  const refPath = path.join(outDir, 'ref-pink.png'); fs.writeFileSync(refPath, Buffer.from(pink.split(',')[1], 'base64'));
  await page.click('[data-tab=theme]');
  await page.setInputFiles('[data-up=ref]', refPath);
  await page.waitForFunction(() => document.querySelector('.theme-name') && /Pink|Red/.test(document.querySelector('.theme-name').textContent));
  ok(true, 'reference image analysed into a pink/red theme');

  // packaging switch keeps text
  await page.click('[data-tab=product]');
  await page.fill('#tx-name', 'Rose Shampoo'); await page.press('#tx-name', 'Tab');
  await page.click('[data-act=pkg][data-id=ph-bottle-b]');
  ok(await page.inputValue('#tx-name') === 'Rose Shampoo', 'switching bottle keeps product text');
  await page.click('[data-act=undo]');
  ok(await page.getAttribute('[data-act=pkg][data-id=ph-bottle-a]', 'aria-pressed') === 'true', 'undo brings bottle A back');

  // letterpad template
  await page.click('[data-tab=letterpad]');
  if (letterpad) {
    await page.setInputFiles('[data-up=tpl]', letterpad);
    await page.waitForSelector('[data-rg="ar.top"]');
    ok(true, 'company letterpad uploaded as template');
    ok((await page.$$('.note')).length > 0, 'low-resolution letterpad warning shown');
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'desktop-letterpad.png'), fullPage: false });

  // exports
  const dl = async act => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(`[data-act=${act}]`)]); const f = path.join(outDir, d.suggestedFilename()); await d.saveAs(f); return f; };
  const png = await dl('lpPng'); ok(fs.statSync(png).size > 50000, 'A4 PNG exported (' + path.basename(png) + ')');
  const pdf = await dl('lpPdf'); ok(fs.readFileSync(pdf).subarray(0, 4).toString() === '%PDF', 'A4 PDF exported');

  // checks
  await page.click('[data-tab=checks]');
  await page.click('[data-act=runChecks]');
  await page.waitForSelector('.check .mark', { timeout: 60000 });
  const res = await page.$$eval('#view .card:first-child .check', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  res.forEach(r => ok(r.startsWith('✓'), 'in-app check: ' + r.slice(2)));

  // project file round trip
  await page.click('[data-tab=project]');
  await page.fill('#verName', 'V1'); await page.click('[data-act=saveVer]');
  const proj = await dl('expProj');
  const pj = JSON.parse(fs.readFileSync(proj, 'utf8'));
  ok(pj.format === 'packaging-studio' && Object.keys(pj.assets).length >= (letterpad ? 2 : 1), 'project file bundles its images (' + Object.keys(pj.assets).length + ')');
  page.once('dialog', d => d.accept('Scratch'));
  await page.click('[data-act=newProj]');
  await page.waitForFunction(() => document.querySelector('#projName').value === 'Scratch');
  await page.setInputFiles('[data-up=proj]', proj);
  await page.waitForFunction(() => document.querySelector('#projName').value !== 'Scratch');
  ok(await page.inputValue('#projName') === pj.project.name, 'project file reopens');

  // reload keeps everything
  await page.reload(); await page.waitForSelector('#pv');
  ok(await page.inputValue('#tx-name') === 'Rose Shampoo', 'reload keeps work');

  // phone layout
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(url); await pp.waitForSelector('#pv'); await pp.waitForTimeout(600);
  await pp.screenshot({ path: path.join(outDir, 'phone-product.png') });
  ok(await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on phone');
  await pp.click('[data-tab=letterpad]'); await pp.waitForTimeout(900);
  await pp.screenshot({ path: path.join(outDir, 'phone-letterpad.png') });

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
