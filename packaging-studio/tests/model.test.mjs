/* Unit tests for the pure modules. Run: node --test packaging-studio/tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsl, hslToHex, onColor, hdiff } from '../js/color.js';
import { setTheme, editToken, resetToken, resolveColor } from '../js/theme.js';
import * as M from '../js/model.js';

const strip = (o, ...ks) => { const c = M.snap(o); ks.forEach(k => delete c[k]); return JSON.stringify(c); };
const shampoo = p => p.products.find(x => x.type === 'shampoo');

test('colour round trip and helpers', () => {
  const [h, s, l] = hexToHsl('#d9467a');
  assert.equal(hslToHex(h, s, l), '#d9467a');
  assert.equal(onColor('#ffffff'), '#1f2328');
  assert.equal(onColor('#111111'), '#ffffff');
  assert.equal(hdiff(10, 350), 20);
});

test('theme gives 10 distinct tokens and every product follows a theme change', () => {
  const p = M.defaultProject();
  assert.equal(new Set(p.theme.palette.map(t => t.hex)).size, 10);
  const before = p.products.map(x => resolveColor(p, x));
  setTheme(p, { h: 20, s: .8, l: .55 });
  p.products.forEach((x, i) => assert.notEqual(resolveColor(p, x), before[i]));
});

test('hand-edited token keeps its shift across a new reference, and resets', () => {
  const p = M.defaultProject();
  editToken(p, 2, '#aa2244');
  assert.equal(p.theme.palette[2].hex, '#aa2244');
  const off = p.theme.palette[2].offset;
  setTheme(p, { h: 30, s: .7, l: .5 });
  assert.deepEqual(p.theme.palette[2].offset, off);
  assert.notEqual(p.theme.palette[2].hex, '#aa2244');
  resetToken(p, 2);
  assert.equal(p.theme.palette[2].hex, p.theme.palette[2].gen);
});

test('switching packaging changes nothing else, and undo restores it', () => {
  const p = M.defaultProject(), pr = shampoo(p), before = strip(pr, 'packagingId'), full = strip(pr);
  M.switchPackaging(pr, 'ph-bottle-b');
  assert.equal(pr.packagingId, 'ph-bottle-b');
  assert.equal(strip(pr, 'packagingId'), before);
  assert.ok(M.undo(pr));
  assert.equal(strip(pr), full);
});

test('label and text changes are independent', () => {
  const p = M.defaultProject(), pr = shampoo(p), pk = pr.packagingId, c0 = resolveColor(p, pr);
  M.setLabel(pr, 'lbl-band');
  M.setText(pr, 'name', 'Rose shampoo');
  assert.equal(pr.packagingId, pk);
  assert.equal(resolveColor(p, pr), c0);
  assert.equal(pr.labelId, 'lbl-band');
});

test('packaging model settings have their own undo', () => {
  const p = M.defaultProject(), k = p.packaging[0], s0 = JSON.stringify(M.snap(k));
  M.pushHistory(k); k.labelArea.x = .5;
  assert.ok(M.undo(k));
  assert.equal(JSON.stringify(M.snap(k)), s0);
});

test('changing letterpad template keeps every page element', () => {
  const p = M.defaultProject(), before = JSON.stringify(p.letterpad.pages);
  p.letterpadTemplates.push({ id: 'lpt-a', name: 'A', assetId: 'a-0123456789', w: 2480, h: 3508, area: { x: .05, y: .2, w: .9, h: .55 } });
  M.setLetterpadTemplate(p, 'lpt-a');
  assert.deepEqual(M.activeArea(p), { x: .05, y: .2, w: .9, h: .55 });
  assert.equal(JSON.stringify(p.letterpad.pages), before);
  M.setLetterpadTemplate(p, 'missing');
  assert.equal(p.letterpad.templateId, null);
});

test('default project has one page with all 10 products in a grid inside the guide area', () => {
  const p = M.defaultProject(), els = p.letterpad.pages[0].elements, A = M.BUILTIN_AREA;
  assert.equal(els.length, 10);
  assert.deepEqual(els.map(e => e.productId), p.products.map(x => x.id));
  els.forEach(e => { assert.ok(e.x >= A.x && e.x + e.w <= A.x + A.w + 1e-9); assert.ok(e.y >= A.y && e.y < A.y + A.h); });
});

test('elements: add anywhere, duplicate, restack, remove', () => {
  const p = M.defaultProject(), pg = p.letterpad.pages[0];
  const t = M.addEl(pg, M.textElement({ text: 'નમસ્તે', x: -.1, y: 1.1 }));
  const d = M.duplicateEl(pg, t.id);
  assert.notEqual(d.id, t.id); assert.equal(d.text, 'નમસ્તે');
  M.restack(pg, d.id, 'back'); assert.equal(pg.elements[0].id, d.id);
  M.restack(pg, d.id, 'front'); assert.equal(pg.elements.at(-1).id, d.id);
  M.removeEl(pg, t.id); assert.equal(M.findEl(pg, t.id), null);
  const n = M.normalizeProject(JSON.parse(JSON.stringify(p)));
  const kept = M.findEl(n.letterpad.pages[0], d.id);
  assert.equal(kept.text, 'નમસ્તે'); assert.equal(kept.y, d.y);
});

test('more than 10 products; custom ones can be deleted, standard ones cannot', () => {
  const p = M.defaultProject();
  const a = M.addCustomProduct(p, 'Hair oil'), b = M.addCustomProduct(p, 'Lip balm');
  M.addEl(p.letterpad.pages[0], M.productElement(a.id, .1, .1, .1));
  M.addEl(p.letterpad.pages[0], M.productElement(a.id, .6, .6, .2));
  let n = M.normalizeProject(JSON.parse(JSON.stringify(p)));
  assert.equal(n.products.length, 12);
  assert.equal(n.letterpad.pages[0].elements.filter(e => e.productId === a.id).length, 2);
  assert.ok(M.deleteCustomProduct(n, a.id));
  assert.equal(n.letterpad.pages[0].elements.filter(e => e.productId === a.id).length, 0);
  assert.equal(M.deleteCustomProduct(n, 'soap'), false);
  assert.ok(n.products.some(x => x.id === b.id));
});

test('older projects (product placement, no pages) become one page of elements', () => {
  const p = JSON.parse(JSON.stringify(M.defaultProject()));
  delete p.letterpad.pages;
  p.products.forEach((x, i) => (x.placement = { x: .1 + (i % 5) * .2, y: i < 5 ? .27 : .73, w: .15 }));
  const n = M.normalizeProject(p), els = n.letterpad.pages[0].elements;
  assert.equal(els.length, 10);
  const soap = els.find(e => e.productId === 'soap'), A = M.BUILTIN_AREA;
  assert.ok(Math.abs(soap.x + soap.w / 2 - (A.x + .1 * A.w)) < 1e-9);
  assert.ok(Math.abs(soap.w - .15 * A.w) < 1e-9);
});

test('hostile elements are dropped or cleaned', () => {
  const p = JSON.parse(JSON.stringify(M.defaultProject()));
  p.letterpad.pages[0].elements.push(
    { type: 'text', text: 'x', color: 'red;}</style>', font: 'evil', size: 99999, align: 'javascript' },
    { type: 'image', assetId: 'http://x' }, { type: 'product', productId: 'nope' }, { type: 'script' });
  const els = M.normalizeProject(p).letterpad.pages[0].elements;
  assert.equal(els.length, 11);
  const t = els.at(-1);
  assert.equal(t.color, '#1f2328'); assert.equal(t.font, 'sans'); assert.equal(t.size, 200); assert.equal(t.align, 'left');
});

test('normalizeProject is idempotent and survives JSON round trip', () => {
  const p = M.defaultProject();
  p.versions.push({ id: 'v-1', name: 'V1', date: 1, final: false, data: M.projectSnapshot(p) });
  const a = M.normalizeProject(JSON.parse(JSON.stringify(p)));
  const b = M.normalizeProject(JSON.parse(JSON.stringify(a)));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('normalizeProject neutralises hostile values', () => {
  const p = JSON.parse(JSON.stringify(M.defaultProject()));
  p.packaging[0].recolor.source = '"><script>x</script>';
  p.theme.imageId = 'javascript:alert(1)';
  p.company.logoId = '../../etc';
  p.products[0].colorIndex = 99;
  p.products[0].packagingId = 'does-not-exist';
  p.letterpadTemplates = [{ id: 'x', assetId: '<svg onload=1>' }];
  const n = M.normalizeProject(p);
  assert.match(n.packaging[0].recolor.source, /^#[0-9a-f]{6}$/);
  assert.equal(n.theme.imageId, null);
  assert.equal(n.company.logoId, null);
  assert.equal(n.products[0].colorIndex, 9);
  assert.equal(n.products[0].packagingId, null);
  assert.equal(n.letterpadTemplates.length, 0);
  assert.throws(() => M.normalizeProject({ hello: 1 }));
});

test('assetIds finds ids in the project and in saved versions', () => {
  const p = M.defaultProject();
  p.theme.imageId = 'a-ref00000';
  const snap = JSON.parse(M.projectSnapshot(p));
  snap.company.logoId = 'a-logo0000';
  p.versions.push({ id: 'v', name: 'V', date: 1, final: false, data: JSON.stringify(snap) });
  p.theme.imageId = null;
  assert.deepEqual([...M.assetIds(p)].sort(), ['a-logo0000', 'a-ref00000']);
});
