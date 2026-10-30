import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeocoder } from '../src/geocoder.js';
function storage() { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; }
test('geocoder makes no request until invoked, bounds queries, caches repeated searches and rate limits', async () => {
  let requests = [], time = 100000;
  const geocode = createGeocoder({ endpoint: 'https://nominatim.openstreetmap.org/search', storage: storage(), now: () => time,
    fetcher: async url => { requests.push(url); return { ok: true, json: async () => [
      { lat: '12.1', lon: '-86.3', display_name: 'Lugar de prueba' }, { lat: '0', lon: '0', display_name: 'Fuera de área' }
    ] }; } });
  assert.equal(requests.length, 0);
  await assert.rejects(geocode('ab'), /3 caracteres/);
  assert.equal(requests.length, 0);
  assert.equal((await geocode('Mercado')).length, 1);
  assert.equal(requests[0].searchParams.get('bounded'), '1');
  assert.equal(requests[0].searchParams.get('countrycodes'), 'ni');
  await geocode('Mercado'); assert.equal(requests.length, 1);
  await assert.rejects(geocode('Otro lugar'), /Espera/);
  time += 1201;
  await geocode('Otro lugar'); assert.equal(requests.length, 2);
});
test('concurrent queries and failed server requests do not create false results', async () => {
  let finish;
  const geocode = createGeocoder({ endpoint: 'https://nominatim.openstreetmap.org/search', storage: storage(), now: () => 100000,
    fetcher: () => new Promise(resolve => { finish = resolve; }) });
  const request = geocode('Mercado');
  await assert.rejects(geocode('Hospital'), /Espera/);
  finish({ ok: false, status: 429 });
  await assert.rejects(request, /ocupado/);
});

test('offline searches reuse saved results but never send new queries', async () => {
  let connected = true, calls = 0;
  const search = createGeocoder({ endpoint: 'https://nominatim.openstreetmap.org/search', storage: storage(),
    now: () => 100000, online: () => connected,
    fetcher: async () => { calls++; return { ok: true, json: async () => [{ lat: '12.1', lon: '-86.3', display_name: 'Mercado' }] }; } });
  await search('Mercado'); connected = false;
  assert.equal((await search('Mercado'))[0].name, 'Mercado');
  await assert.rejects(search('Lugar nuevo'), /Sin conexión/);
  assert.equal(calls, 1);
});

test('blocked storage and invalid responses are handled without inventing places', async () => {
  const blockedStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  const search = createGeocoder({ endpoint: 'https://nominatim.openstreetmap.org/search', storage: blockedStorage,
    now: () => 100000, fetcher: async () => ({ ok: true, json: async () => ({ error: 'Unavailable' }) }) });
  await assert.rejects(search('Mercado'), /respuesta inesperada/);
  const empty = createGeocoder({ endpoint: 'https://nominatim.openstreetmap.org/search', storage: null,
    now: () => 100000, fetcher: async () => ({ ok: true, json: async () => [null, { lat: 'bad', lon: '-86.3', display_name: 'Invalid' }] }) });
  assert.deepEqual(await empty('Mercado'), []);
});
