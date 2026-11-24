import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../strategist/engine/engine.js';

test('cost model matches the in-game Town Hall 19→20 cost (confirmed 23 Nov 2026)', () => {
  const st = E.defaultState();
  const city = { b: { carpentering: 12, architect: 14 } };
  assert.deepEqual(E.upgradeCost(city, 'townHall', 20, st.research), { wood: 28817, wine: 0, marble: 29458, glass: 0, sulfur: 0 });
});

test('housing formula: Town Hall 19 capital = 1,796 (with Holiday and Well Digging)', () => {
  const st = E.defaultState();
  assert.equal(E.maxPop({ capital: true, b: { townHall: 19 } }, st), 1796);
  assert.equal(E.maxPop({ capital: false, b: { townHall: 20 } }, st), 1878);
});

test('wine consumption reproduces observed wineSpendings (24 Nov 2026 snapshot)', () => {
  // [wine press level, serving level, observed wine/h]
  for (const [press, serve, observed] of [[22, 18, 117], [0, 14, 99], [0, 13, 88], [16, 14, 83], [0, 12, 78]]) {
    assert.ok(Math.abs(E.wineUse({ b: { vineyard: press } }, serve) - observed) < 1, `press ${press} serve ${serve}`);
  }
});

test('simulation runs on the example state', () => {
  const r = E.simulate(E.defaultState(), 'economy', 3);
  assert.equal(r.daily.length, 4);
  assert.ok(r.events.length > 0);
});
