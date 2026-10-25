import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Run the actual reader script against controllable image loading. A new src
// can retain the previous bitmap until decoding finishes, as in Ben's report.
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(await readFile(new URL('src/comics.json', root)));
const current = await readFile(new URL('src/comic-panels.js', root), 'utf8');
// Normalize only the display URL in the historical control; retain its stale
// bitmap behavior so the regression must still fail for the original reason.
const before = (await readFile(new URL('./fixtures/reader-before-image-fix.js', import.meta.url), 'utf8')).replaceAll('c.image','(c.display||c.image)');
const [a, b, c] = fixture;

async function reader(source) {
  const nodes = new Map(), events = new Map(), pending = [];
  const location = { origin: 'http://comic.test', hash: '' };
  const document = { title: 'Comic Panels', activeElement: null };
  class Element {
    constructor() { this.style = { visibility: 'visible' }; this.handlers = new Map(); this.classList = { toggle() {} }; }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    focus() { document.activeElement = this; }
    replaceWith(node) { assert.equal(nodes.get(this.id), this); nodes.set(this.id, node); }
    matches() { return false; }
  }
  class ControlledImage extends Element {
    constructor(width, height) { super(); this.width = width; this.height = height; this.currentSrc = ''; }
    decode() { return new Promise((resolve, reject) => pending.push({ image: this, src: this.src, resolve, reject })); }
  }
  const ids = ['finalist-grid', 'comic-reader', 'reader-title', 'reader-position', 'reader-context', 'reader-download', 'reader-prev', 'reader-next', 'reader-message', 'copy-fallback', 'copy-url', 'reader-copy', 'reader-close', 'collection-pagination', 'gallery-prev', 'gallery-next', 'gallery-position'];
  for (const id of ids) { const el = new Element(); el.id = id; nodes.set(id, el); }
  const initialImage = new ControlledImage(2000, 1500); initialImage.id = 'reader-image'; nodes.set(initialImage.id, initialImage);
  const anchors = new Map(fixture.map(comic => [comic.id, Object.assign(new Element(), { dataset: { comic: comic.id } })]));
  const content = new Element(), note = new Element(), dialog = nodes.get('comic-reader');
  dialog.open = false; dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; };
  document.getElementById = id => nodes.get(id);
  document.querySelector = selector => selector === '.reader-content' ? content : selector === '.reader-note' ? note : null;
  nodes.get('finalist-grid').querySelector = selector => anchors.get(selector.match(/data-comic="([^"]+)"/)[1]);
  nodes.get('finalist-grid').children = fixture.map(() => new Element());
  const entries = [{ hash: '', state: null }]; let cursor = 0;
  const navigate = url => { location.hash = new URL(url, location.origin).hash; };
  const history = {
    get state() { return entries[cursor].state; },
    pushState(state, _, url) { entries.splice(++cursor); entries[cursor] = { state, hash: new URL(url, location.origin).hash }; navigate(url); },
    replaceState(state, _, url) { entries[cursor] = { state, hash: new URL(url, location.origin).hash }; navigate(url); },
    back() { if (cursor) { location.hash = entries[--cursor].hash; events.get('popstate')(); } }
  };
  await vm.runInNewContext(source, {
    document, location, history, Image: ControlledImage, URL, URLSearchParams,
    getComputedStyle: () => ({ gridTemplateColumns: '400px 400px 400px' }),
    navigator: { clipboard: { async writeText() {} } },
    fetch: async () => ({ ok: true, json: async () => fixture }),
    addEventListener: (name, callback) => events.set(name, callback),
    requestAnimationFrame: callback => callback(), window: { scrollTo() {} }, scrollY: 0
  });
  const image = () => nodes.get('reader-image');
  const open = comic => nodes.get('finalist-grid').handlers.get('click')({ target: { closest: () => anchors.get(comic.id) }, button: 0, preventDefault() {} });
  const close = () => nodes.get('reader-close').handlers.get('click')();
  const key = key => dialog.handlers.get('keydown')({ key, target: new Element(), preventDefault() {} });
  async function settle(img, fail = false) {
    if (!fail) { img.currentSrc = img.src; img.complete = true; img.naturalWidth = 2000; }
    for (const task of pending.filter(task => task.image === img)) fail ? task.reject(new Error('Fixture image failed')) : task.resolve();
    await Promise.resolve();
  }
  function noStale(comic) {
    const img = image();
    assert.equal(img.src, (comic.display||comic.image));
    assert.ok(img.style.visibility === 'hidden' || !img.currentSrc || img.currentSrc === (comic.display||comic.image), 'previous bitmap is visible under the newly selected comic');
  }
  return { nodes, document, anchors, image, open, close, key, settle, noStale };
}

async function closeThenOpen(source) {
  const r = await reader(source);
  r.open(a); await r.settle(r.image()); r.close();
  assert.equal(r.document.activeElement, r.anchors.get(a.id), 'close restores gallery focus');
  r.open(b); r.noStale(b);
  return r;
}

// Negative control: the fixture must expose the original retained-bitmap bug.
await assert.rejects(closeThenOpen(before), /previous bitmap is visible/);

const reopened = await closeThenOpen(current);
assert.equal(reopened.image().style.visibility, 'hidden');
await reopened.settle(reopened.image());
assert.equal(reopened.image().style.visibility, 'visible'); reopened.noStale(b);

// A still loading when closed must not reveal itself over the newly opened B.
const overlap = await reader(current);
overlap.open(a); const oldA = overlap.image(); overlap.close(); overlap.open(b); const newB = overlap.image();
assert.notEqual(oldA, newB); await overlap.settle(oldA);
assert.equal(newB.style.visibility, 'hidden'); overlap.noStale(b);
await overlap.settle(newB); assert.equal(newB.style.visibility, 'visible'); overlap.noStale(b);

// Rapid keyboard navigation, with decodes completing out of order.
const rapid = await reader(current);
rapid.open(a); const first = rapid.image(); rapid.key('ArrowRight'); const second = rapid.image(); rapid.key('ArrowRight'); const third = rapid.image();
assert.equal(rapid.document.activeElement, rapid.nodes.get('reader-title'));
await rapid.settle(third); rapid.noStale(c);
await rapid.settle(first); await rapid.settle(second); rapid.noStale(c);
assert.equal(rapid.image(), third); assert.equal(third.style.visibility, 'visible');
rapid.key('ArrowLeft'); rapid.noStale(b);

// Reopening the same comic also owns a new request; an old decode cannot reveal it.
const same = await reader(current);
same.open(a); const stale = same.image(); same.close(); same.open(a); const fresh = same.image();
await same.settle(stale); assert.equal(fresh.style.visibility, 'hidden');
await same.settle(fresh); same.noStale(a); assert.equal(fresh.style.visibility, 'visible');

// Failed obsolete requests do not reveal the current pending image. A current
// failure retains its own native alt-text fallback, never the previous artwork.
const failure = await reader(current);
failure.open(a); const failedA = failure.image(); failure.key('ArrowRight'); const failedB = failure.image();
await failure.settle(failedA, true); assert.equal(failedB.style.visibility, 'hidden');
await failure.settle(failedB, true); assert.equal(failedB.style.visibility, 'visible');
assert.equal(failedB.alt, b.alt); failure.noStale(b);

console.log('PASS: original bug detected; A-close-B, overlapping decodes, rapid navigation, same-comic reopen, error fallback and focus contracts.');
