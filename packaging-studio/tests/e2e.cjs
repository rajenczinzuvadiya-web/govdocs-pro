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

  // extra product
  page.once('dialog', d => d.accept('Hair Oil'));
  await page.click('[data-act=addProduct]');
  await page.waitForSelector('#tx-name');
  ok(await page.inputValue('#tx-name') === 'Hair Oil', 'extra (11th) product added');

  // letterpad template
  await page.click('[data-tab=letterpad]');
  await page.waitForSelector('#lp .el');
  if (letterpad) {
    await page.setInputFiles('[data-up=tpl]', letterpad);
    await page.waitForSelector('[data-rg="ar.top"]');
    ok(true, 'company letterpad uploaded as template');
    ok((await page.$$('.note')).length > 0, 'low-resolution letterpad warning shown');
  }
  const count = () => page.$$eval('#lp .el', e => e.length);
  const n0 = await count();

  // place the extra product twice, anywhere
  const hairId = await page.$eval('#addProd', s => [...s.options].find(o => o.text.startsWith('Hair Oil')).value);
  await page.selectOption('#addProd', hairId);
  await page.selectOption('#addProd', hairId);
  ok(await count() === n0 + 2, 'same product placed twice');

  // drag the shampoo element and resize it with the corner handle
  const shampooEl = await page.$$eval('#lp .el-product', els => els.findIndex(e => e.querySelector('img')));
  const el = (await page.$$('#lp .el-product'))[shampooEl];
  let b0 = await el.boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 3); await page.mouse.down();
  await page.mouse.move(b0.x + b0.width / 2 - 120, b0.y + b0.height / 3 + 150, { steps: 8 }); await page.mouse.up();
  let b1 = await el.boundingBox();
  ok(Math.abs(b1.x - (b0.x - 120)) < 6 && Math.abs(b1.y - (b0.y + 150)) < 6, 'product dragged freely across the page');
  const h = await el.$('.hdl'), hb = await h.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
  await page.mouse.move(hb.x + 60, hb.y + 60, { steps: 6 }); await page.mouse.up();
  const b2 = await el.boundingBox();
  ok(b2.width > b1.width + 40, 'product resized with handle (' + Math.round(b1.width) + ' → ' + Math.round(b2.width) + ' px)');

  // undo / redo
  await page.click('[data-act=docUndo]');
  const b3 = await (await page.$$('#lp .el-product'))[shampooEl].boundingBox();
  ok(Math.abs(b3.width - b1.width) < 3, 'undo reverts the resize');
  await page.click('[data-act=docRedo]');
  const b4 = await (await page.$$('#lp .el-product'))[shampooEl].boundingBox();
  ok(Math.abs(b4.width - b2.width) < 3, 'redo re-applies it');

  // text box: type Gujarati + English, make it bigger and bold
  await page.click('[data-act=addText]');
  await page.waitForSelector('.el-text.editing .tx');
  await page.keyboard.type('અમારી નવી પ્રોડક્ટ શ્રેણી – Pink Apple Range');
  await page.click('#lpArea', { force: true }).catch(() => {});
  await page.mouse.click(5, 5);
  const txt = await page.$eval('#lp .el-text:last-of-type .tx', e => e.textContent);
  ok(txt.includes('અમારી') && txt.includes('Pink Apple'), 'text typed straight onto the page (Gujarati + English)');
  const tEl = (await page.$$('#lp .el-text')).at(-1), tb = await tEl.boundingBox();
  await page.mouse.click(tb.x + 10, tb.y + 5);
  await page.waitForSelector('#elText');
  await page.click('[data-act=bold]');
  for (let i = 0; i < 6; i++) await page.click('[data-act=size][data-v="1"]');
  await page.click('[data-act=align][data-v=center]');
  await page.click('[data-act=elCenter]');
  const fs1 = await page.$eval('#lp .el-text:last-of-type .tx', e => getComputedStyle(e).fontWeight + ' ' + getComputedStyle(e).textAlign);
  ok(fs1 === '700 center', 'text made bold and centred (' + fs1 + ')');
  await page.screenshot({ path: path.join(outDir, 'desktop-letterpad.png') });

  // second page
  await page.click('[data-act=addPage]');
  ok(await count() === 0, 'new blank page');
  await page.click('[data-act=addText]');
  await page.waitForSelector('.el-text.editing .tx');
  await page.keyboard.type('Page two notes');
  await page.mouse.click(5, 5);
  await page.click('[data-act=page][data-i="0"]');

  // exports
  const dl = async act => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click(`[data-act=${act}]`)]); const f = path.join(outDir, d.suggestedFilename()); await d.saveAs(f); return f; };
  const png = await dl('lpPng'); ok(fs.statSync(png).size > 50000, 'A4 PNG of page 1 exported (' + path.basename(png) + ')');
  const pdf = await dl('lpPdf'); const pdfData = fs.readFileSync(pdf).toString('latin1');
  ok(pdfData.startsWith('%PDF') && (pdfData.match(/\/Type \/Page\b/g) || []).length === 2, 'PDF exported with 2 pages');

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
  await page.click('[data-tab=letterpad]'); await page.waitForSelector('#lp .el-text');
  ok((await page.$$eval('#lp .el-text .tx', e => e.map(x => x.textContent).join(' '))).includes('અમારી'), 'reload keeps letterpad text');
  ok(await page.$$eval('[data-act=page]', e => e.length) === 2, 'reload keeps both pages');

  // phone layout
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(url); await pp.waitForSelector('#pv'); await pp.waitForTimeout(600);
  await pp.screenshot({ path: path.join(outDir, 'phone-product.png') });
  ok(await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on phone');
  await pp.click('[data-tab=letterpad]'); await pp.waitForTimeout(1200);
  await pp.screenshot({ path: path.join(outDir, 'phone-letterpad.png') });
  ok(await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on phone letterpad');
  const pe = await pp.$('#lp .el-product img'); const pb = await pe.boundingBox();
  await pp.tap('#lp .el-product'); await pp.waitForSelector('#lp .el.sel');
  ok(true, 'tap selects an element on phone');

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
