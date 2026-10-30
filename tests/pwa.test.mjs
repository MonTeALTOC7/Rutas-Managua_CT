import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('PWA manifest includes correct scope and actual PNG install icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    const bytes = await readFile(new URL(`../public/${icon.src}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  }
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable'));
});
test('service worker excludes all third-party requests and unlisted same-origin requests', async () => {
  const template = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8');
  const listeners = {}, cached = [];
  const cache = { addAll: async assets => cached.push(...assets), match: async key => ({ cached: key }) };
  vm.runInNewContext(template.replace('__VERSION__', 'test').replace('/*__ASSETS__*/[]', '["./index.html","./data/network.json"]'), {
    URL, Set,
    self: { registration: { scope: 'http://localhost:4173/' }, location: { origin: 'http://localhost:4173' },
      clients: { claim: async () => {} }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: () => { throw new Error('Unexpected fetch'); }
  });
  let installing; listeners.install({ waitUntil: promise => { installing = promise; } }); await installing;
  assert.equal(cached.length, 2);
  for (const url of ['https://tile.openstreetmap.org/12/1/1.png', 'https://nominatim.openstreetmap.org/search?q=abc', 'http://localhost:4173/api/geocode?q=abc']) {
    let intercepted = false;
    listeners.fetch({ request: { url, method: 'GET' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
  let response;
  listeners.fetch({ request: { url: 'http://localhost:4173/', method: 'GET', mode: 'navigate' }, respondWith: p => { response = p; } });
  assert.equal((await response).cached, 'http://localhost:4173/index.html');
  for (const url of ['http://localhost:4173/?source=installed', 'http://localhost:4173/index.html?source=bookmark']) {
    let entry;
    listeners.fetch({ request: { url, method: 'GET', mode: 'navigate' }, respondWith: p => { entry = p; } });
    assert.equal((await entry).cached, 'http://localhost:4173/index.html');
  }
  let otherPage = false;
  listeners.fetch({ request: { url: 'http://localhost:4173/missing?source=bookmark', method: 'GET', mode: 'navigate' }, respondWith: () => { otherPage = true; } });
  assert.equal(otherPage, false);
});
