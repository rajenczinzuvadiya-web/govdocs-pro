/* Architecture checks from the master prompt, plus checks for this phase.
   Every check runs on a copy of the project, so the user's work is never changed. */
import { clone } from './util.js';
import { rgbToHsl } from './color.js';
import { setTheme, resolveColor, editToken } from './theme.js';
import { snap, switchPackaging, setLabel, setText, undo, getPkg, normalizeProject, setLetterpadTemplate, activeArea, addCustomProduct, deleteCustomProduct, addEl, productElement, textElement } from './model.js';
import { kvSet, kvGet, kvDel } from './store.js';
import { renderProduct, baseCanvas } from './render.js';
import { exportProjectFile, importProjectFile } from './files.js';

export async function runChecks(project) {
  const res = [];
  const P = () => { const c = clone(project); c.products.forEach(x => (x.history = [])); return c; };
  const sh = p => p.products.find(x => x.type === 'shampoo');
  const t = async (name, fn) => { try { const r = await fn(); res.push([name, r === true, r === true ? '' : String(r)]); } catch (e) { res.push([name, false, e.message]); } };
  const strip = (o, ...ks) => { const c = snap(o); ks.forEach(k => delete c[k]); return JSON.stringify(c); };
  const other = h => (h + 150) % 360;
  const newTheme = p => setTheme(p, { h: other(p.theme.base.h), s: .6, l: .5 });

  await t('1. Change reference → product colour changes', () => {
    const p = P(), pr = sh(p), b = resolveColor(p, pr); newTheme(p);
    return b !== resolveColor(p, pr) || 'Colour did not change';
  });
  await t('2. Bottle A → Bottle B, everything else stays', () => {
    const p = P(), pr = sh(p);
    if (pr.alternatives.length < 2) return 'Shampoo needs at least 2 packaging models';
    const before = strip(pr, 'packagingId'), nx = pr.alternatives.find(i => i !== pr.packagingId);
    switchPackaging(pr, nx);
    return (pr.packagingId === nx && strip(pr, 'packagingId') === before) || 'Other fields changed';
  });
  await t('3. Change label → packaging stays', () => {
    const p = P(), pr = sh(p), pk = pr.packagingId, alts = JSON.stringify(pr.alternatives), nl = p.labels.find(l => l.id !== pr.labelId).id;
    setLabel(pr, nl);
    return (pr.labelId === nl && pr.packagingId === pk && JSON.stringify(pr.alternatives) === alts) || 'Packaging changed';
  });
  await t('4. Change text → packaging and colour stay', () => {
    const p = P(), pr = sh(p), b = strip(pr, 'text'), c0 = resolveColor(p, pr);
    setText(pr, 'name', 'Test name');
    return (strip(pr, 'text') === b && resolveColor(p, pr) === c0 && pr.text.name === 'Test name') || 'Something else changed';
  });
  await t('5. Change theme → every product updates', () => {
    const p = P(), b = p.products.map(x => resolveColor(p, x)), f = p.products.map(x => strip(x));
    newTheme(p);
    const changed = p.products.map(x => resolveColor(p, x)).filter((c, i) => c !== b[i]).length;
    const intact = p.products.every((x, i) => strip(x) === f[i]);
    return (changed === p.products.length && intact) || `${changed}/${p.products.length} changed, other data intact: ${intact}`;
  });
  await t('6. Undo packaging change', () => {
    const p = P(), pr = sh(p), o = pr.packagingId, full = strip(pr), nx = pr.alternatives.find(i => i !== o);
    if (!nx) return 'Needs 2 packaging models';
    switchPackaging(pr, nx); undo(pr);
    return (pr.packagingId === o && strip(pr) === full) || 'Undo did not restore';
  });
  await t('7. Save → reopen → no data lost', async () => {
    const s = JSON.stringify(project);
    await kvSet('check-roundtrip', s);
    const back = await kvGet('check-roundtrip');
    await kvDel('check-roundtrip');
    return back === s || 'Stored data differs';
  });
  await t('8. Recolour really changes pixels and keeps greys', async () => {
    const p = P(), pr = sh(p);
    if (!pr.packagingId) return 'No packaging';
    const pkg = getPkg(p, pr.packagingId);
    const a = await renderProduct(p, pr, { label: false }); newTheme(p);
    const b = await renderProduct(p, pr, { label: false }), base = await baseCanvas(pkg);
    if (!a || !b || !base) return 'Packaging image could not be loaded';
    const get = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const da = get(a), db = get(b), bd = get(base);
    let diff = 0, greyMoved = 0, greys = 0;
    for (let i = 0; i < da.length; i += 16) {
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1]) diff++;
      if (bd[i + 3] > 250 && rgbToHsl(bd[i], bd[i + 1], bd[i + 2])[1] < pkg.recolor.neutral * .8) { greys++; if (Math.abs(db[i] - bd[i]) > 2) greyMoved++; }
    }
    return (diff > 100 && greyMoved === 0) || `changed px ${diff}, greys moved ${greyMoved}/${greys}`;
  });
  await t('9. Change letterpad → page contents and products stay', () => {
    const p = P(), f = p.products.map(x => strip(x)), pagesBefore = JSON.stringify(p.letterpad.pages);
    p.letterpadTemplates.push({ id: 'lpt-check', name: 'Check', assetId: 'a-check0000', w: 2480, h: 3508, area: { x: .1, y: .25, w: .8, h: .5 } });
    setLetterpadTemplate(p, null);
    const a0 = JSON.stringify(activeArea(p));
    setLetterpadTemplate(p, 'lpt-check');
    const moved = JSON.stringify(activeArea(p)) !== a0;
    const same = p.products.every((x, i) => strip(x) === f[i]) && JSON.stringify(p.letterpad.pages) === pagesBefore;
    return (same && moved) || 'Something changed when the letterpad changed';
  });
  await t('10. Hand-edited colour survives a new reference', () => {
    const p = P();
    editToken(p, 2, '#c0392b');
    const off = JSON.stringify(p.theme.palette[2].offset), before = p.theme.palette[2].hex;
    newTheme(p);
    return (JSON.stringify(p.theme.palette[2].offset) === off && p.theme.palette[2].hex !== before) || 'Edit lost or colour did not follow the new theme';
  });
  await t('11. Project file → reopen → identical', async () => {
    const p = P(), back = await importProjectFile(await (await exportProjectFile(p)).text());
    return JSON.stringify(normalizeProject(clone(p))) === JSON.stringify(back) || 'Re-opened project differs';
  });
  await t('12. Hostile project file is neutralised', () => {
    const p = P();
    p.name = '<img src=x onerror=alert(1)>';
    p.theme.palette[0].hex = '"><script>alert(1)</script>';
    p.packaging[0].recolor.source = 'red;background:url(x)';
    p.theme.imageId = 'javascript:alert(1)';
    const n = normalizeProject(JSON.parse(JSON.stringify(p)));
    const hexOk = n.theme.palette.every(k => /^#[0-9a-f]{6}$/.test(k.hex)) && /^#[0-9a-f]{6}$/.test(n.packaging[0].recolor.source);
    return (hexOk && n.theme.imageId === null) || 'Unsafe values got through';
  });
  await t('13. Change packaging → letterpad layout stays', () => {
    const p = P(), pr = sh(p), pagesBefore = JSON.stringify(p.letterpad.pages);
    const nx = pr.alternatives.find(i => i !== pr.packagingId);
    if (!nx) return 'Needs 2 packaging models';
    switchPackaging(pr, nx);
    return JSON.stringify(p.letterpad.pages) === pagesBefore || 'Letterpad changed';
  });
  await t('14. Extra products, placed anywhere and more than once', () => {
    const p = P(), x = addCustomProduct(p, 'Check product'), pg = p.letterpad.pages[0];
    addEl(pg, productElement(x.id, .05, .05, .1)); addEl(pg, productElement(x.id, .8, .85, .2));
    addEl(pg, textElement({ text: 'ગુજરાતી લખાણ', x: .1, y: .5 }));
    const n = normalizeProject(JSON.parse(JSON.stringify(p)));
    const onPage = n.letterpad.pages[0].elements.filter(e => e.productId === x.id).length;
    const txt = n.letterpad.pages[0].elements.some(e => e.type === 'text' && e.text === 'ગુજરાતી લખાણ');
    deleteCustomProduct(n, x.id);
    const gone = !n.letterpad.pages[0].elements.some(e => e.productId === x.id) && n.products.length === p.products.length - 1;
    return (n.products.length >= 11 && onPage === 2 && txt && gone) || `products ${n.products.length}, placed ${onPage}, text kept ${txt}, removed cleanly ${gone}`;
  });
  return res;
}
