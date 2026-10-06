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

test('changing letterpad template keeps product placements', () => {
  const p = M.defaultProject(), f = p.products.map(x => JSON.stringify(x.placement));
  p.letterpadTemplates.push({ id: 'lpt-a', name: 'A', assetId: 'a-0123456789', w: 2480, h: 3508, area: { x: .05, y: .2, w: .9, h: .55 } });
  M.setLetterpadTemplate(p, 'lpt-a');
  assert.deepEqual(M.activeArea(p), { x: .05, y: .2, w: .9, h: .55 });
  assert.deepEqual(p.products.map(x => JSON.stringify(x.placement)), f);
  M.setLetterpadTemplate(p, 'missing');
  assert.equal(p.letterpad.templateId, null);
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
