import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingOnLine } from '../src/travel.js';

test('distance follows the selected polyline and reports GPS separation', () => {
  const line = [[12.1, -86.3], [12.1, -86.29], [12.11, -86.29]];
  const a = remainingOnLine({ lat: 12.1, lon: -86.3 }, line);
  const middle = remainingOnLine({ lat: 12.1, lon: -86.29 }, line);
  const end = remainingOnLine({ lat: 12.11, lon: -86.29 }, line);
  assert.ok(a.remaining > middle.remaining && middle.remaining > 1000);
  assert.ok(end.remaining < 1);
  assert.ok(remainingOnLine({ lat: 12.12, lon: -86.30 }, line).offset > 100);
  assert.equal(remainingOnLine({ lat: 12.1, lon: -86.3 }, []), null);
});
