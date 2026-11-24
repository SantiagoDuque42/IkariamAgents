import test from 'node:test';
import assert from 'node:assert/strict';
import { wineScenario } from '../lib/icariam/scenario.mjs';

test('a late shipment does not erase an earlier shortage', () => {
  const r = wineScenario({ stock: 30, net: -10, horizon: 12, delivery: 200, eta: 5 });
  assert.equal(r.firstGap, 3);
  assert.equal(r.exhaustedBeforeDelivery, true);
  assert.equal(r.ending, 130);
  assert.deepEqual(r.points.filter(p => p.hour === 5).map(p => p.stock), [0, 200]);
});

test('a future delivery outside the horizon does not add to the balance', () => {
  const r = wineScenario({ stock: 80, net: -10, horizon: 12, delivery: 200, eta: 13 });
  assert.equal(r.arrives, false);
  assert.equal(r.ending, 0);
  assert.equal(r.toRefill, 40);
});

test('a full warehouse only receives the available portion', () => {
  const r = wineScenario({ stock: 70, net: 10, horizon: 12, delivery: 60, eta: 1, capacity: 100 });
  assert.equal(r.realDelivery, 20);
  assert.equal(r.firstGap, null);
  assert.equal(r.ending, 100);
});
