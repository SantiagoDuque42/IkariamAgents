import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseIsland, shape } from '../shared/ikariam.js';
import { fromLegacy } from '../mayor/normalize.mjs';

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

test('parseIsland reads levels, good, wonder, towns and free spots (hypothesised response shape)', () => {
  const i = parseIsland(fx('island.response.example.json'));
  assert.equal(i.tradegood, 'sulfur');
  assert.equal(i.woodLvl, 29);
  assert.equal(i.luxLvl, 28);
  assert.equal(i.wonderLvl, 5);
  assert.equal(i.freeSpots, 2);
  assert.equal(i.towns.length, 2);
  assert.deepEqual(i.towns[1], { id: '700003', name: 'Other', player: 'Idle', playerId: '2', alliance: 'XYZ', level: 8, state: 'inactive' });
});

test('parseIsland returns null when no island object is present', () => {
  assert.equal(parseIsland([['updateGlobalData', { headerData: {} }]]), null);
});

test('shape keeps structure and command names but no values', () => {
  const s = JSON.stringify(shape([['changeView', ['island', '<div>Secret town</div>']], { gold: 123, name: 'Somebody' }]));
  assert.ok(s.includes('changeView'));
  assert.ok(!s.includes('Secret') && !s.includes('Somebody') && !s.includes('123'));
});

test('legacy v0.1 snapshot converts to mayor.snapshot.v1', () => {
  const env = fromLegacy(fx('mayor.legacy-v1.example.json'));
  assert.equal(env.schema, 'mayor.snapshot.v1');
  assert.equal(env.server, 's0-example');
  assert.equal(env.payload.cities.length, 5);
  assert.equal(env.payload.islands['800003'].tradegood, 'marble');
});
