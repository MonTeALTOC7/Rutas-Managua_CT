import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNetwork, plan, nearby, searchRoutes, searchStops, legGeometry, distance } from '../src/planner.js';

function fixture({ shared = true, eligible = true } = {}) {
  const stops = {
    a: { id: 'a', name: 'Origen', lat: 12.1, lon: -86.3 },
    b: { id: 'b', name: 'Cambio', lat: 12.1, lon: -86.29 },
    c: { id: 'c', name: 'Destino', lat: 12.1, lon: -86.28 },
    other: { id: 'other', name: 'Cambio', lat: 12.1, lon: -86.29, parent: 'b' }
  };
  const variant = (id, ids, shapeId) => ({ id, routeId: id, shapeId, headsign: stops[ids.at(-1)].name,
    stops: ids, planningEligible: eligible, positions: ids.map((s, i) => ({ point: [stops[s].lat, stops[s].lon], along: i * 1000, segment: 0 })) });
  return createNetwork({ routes: [{ id: '1', name: 'Ruta 1' }, { id: '2', name: 'Ruta 2' }], stops,
    shapes: { s1: [[12.1, -86.3], [12.1, -86.29]], s2: [[12.1, -86.29], [12.1, -86.28]] },
    variants: [variant('1', ['a', 'b'], 's1'), variant('2', [shared ? 'b' : 'other', 'c'], 's2')] });
}
test('direct journey follows stop order; return cannot reverse its line', () => {
  const n = fixture();
  const forward = plan(n, n.stops.a, n.stops.b, { radius: 30 });
  assert.equal(forward.length, 1);
  assert.deepEqual([forward[0].legs[0].boardId, forward[0].legs[0].alightId], ['a', 'b']);
  assert.equal(plan(n, n.stops.b, n.stops.a, { radius: 30 }).length, 0);
  assert.deepEqual(legGeometry(n, forward[0].legs[0]), [[12.1, -86.3], [12.1, -86.29]]);
});
test('one transfer is supported only through exactly the same stop_id', () => {
  const n = fixture();
  const result = plan(n, n.stops.a, n.stops.c, { radius: 30 });
  assert.equal(result[0].legs.length, 2);
  assert.equal(result[0].legs[0].alightId, result[0].legs[1].boardId);
  assert.equal(plan(n, n.stops.a, n.stops.c, { radius: 30, transfers: false }).length, 0);
  const separate = fixture({ shared: false });
  // Identical name, coordinates and parent-like reference still don't prove a transfer.
  assert.equal(plan(separate, separate.stops.a, separate.stops.c, { radius: 30 }).length, 0);
});
test('excluded variants, distant endpoints and outside-area points cannot create plans', () => {
  const n = fixture({ eligible: false });
  assert.equal(plan(n, n.stops.a, n.stops.b, { radius: 30 }).length, 0);
  assert.equal(plan(fixture(), { lat: 20, lon: -90 }, n.stops.b).length, 0);
  assert.equal(nearby(n, { lat: 12.3, lon: -86.5 }, 300).length, 0);
  assert.equal(nearby(n, n.stops.a, 30)[0].stop.id, 'a');
});

const raw = await readFile(new URL('../public/data/network.json', import.meta.url), 'utf8');
const data = JSON.parse(raw), actual = createNetwork(data);
test('real snapshot has provenance and no service-time fields', () => {
  assert.equal(data.routes.length, 46);
  assert.equal(data.variants.length, 92);
  assert.equal(Object.keys(data.stops).length, 1712);
  assert.equal(data.variants.filter(v => v.planningEligible).length, 83);
  assert.equal(data.source.feedEnd, '2023-01-31');
  assert.equal(data.source.sha256, '72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4');
  assert.doesNotMatch(raw, /"(?:arrival_time|departure_time|headway_secs|opening_hours|service_id|trip_id|direction_id)"/);
  for (const v of data.variants) {
    assert.equal(v.stops.length, v.positions.length);
    assert.ok(data.shapes[v.shapeId]);
    for (const id of v.stops) assert.ok(data.stops[id]);
    if (v.planningEligible) {
      assert.equal(v.issues.length, 0);
      assert.ok(v.positions.every((p, i) => p.offset <= 80 && (!i || p.along >= v.positions[i - 1].along)));
    }
  }
});
test('real route 110 uses different shapes for each direction', () => {
  const variants = data.variants.filter(v => v.routeId === '110');
  const n = createNetwork({ ...data, variants });
  const outgoing = variants.find(v => v.headsign === 'Aldea SOS');
  const a = n.stops[outgoing.stops[0]], b = n.stops[outgoing.stops.at(-1)];
  const ida = plan(n, a, b, { radius: 150, transfers: false });
  const regreso = plan(n, b, a, { radius: 150, transfers: false });
  assert.ok(ida.length && regreso.length);
  assert.equal(n.variantsById.get(ida[0].legs[0].variantId).shapeId, 'relation/3751865');
  assert.equal(n.variantsById.get(regreso[0].legs[0].variantId).shapeId, 'relation/3751885');
  const line = legGeometry(n, ida[0].legs[0]);
  assert.ok(line.length > 50);
  assert.ok(distance(a, { lat: line[0][0], lon: line[0][1] }) <= 80);
});
test('route identity and accented place searches remain distinct and usable', () => {
  assert.equal(searchRoutes(actual, '125')[0].id, '125');
  assert.deepEqual(searchRoutes(actual, '125CS').map(r => r.id), ['125CS']);
  assert.deepEqual(searchRoutes(actual, '172CS').map(r => r.id), ['172CS']);
  assert.equal(searchRoutes(actual, '261')[0].id, 'MR4');
  assert.ok(searchStops(actual, 'policia').length);
  assert.equal(searchStops(actual, '').length, 0);
});
test('real network produces only valid increasing legs and identical-stop transfers', () => {
  const a = actual.stops['node/3227474896'], b = actual.stops['node/3230468200'];
  const results = plan(actual, a, b, { radius: 600 });
  assert.ok(results.length > 0);
  for (const result of results) {
    for (const leg of result.legs) {
      assert.ok(leg.from < leg.to && leg.meters > 0);
      assert.ok(actual.variantsById.get(leg.variantId).planningEligible);
    }
    if (result.legs.length === 2) assert.equal(result.legs[0].alightId, result.legs[1].boardId);
  }
});
