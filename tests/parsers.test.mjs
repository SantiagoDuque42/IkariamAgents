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

import { reloadLink, parseIslandHtml, parseEmbedded, levelKeys } from '../shared/ikariam.js';

test('reloadLink finds the page the game asks to load (shape seen 24 Nov 2026)', () => {
  const r = [['custom', ['reload', { link: '/index.php?view=island&islandId=800001', isDevHost: 0 }]], ['updateBacklink', { link: 'x', title: 'y' }], ['popupData', null]];
  assert.equal(reloadLink(r), '/index.php?view=island&islandId=800001');
  assert.equal(reloadLink([['updateGlobalData', {}]]), null);
});

test('parseEmbedded reads the command list embedded in a full page', () => {
  const resp = readFileSync(new URL('./fixtures/island.response.example.json', import.meta.url), 'utf8');
  const html = `<html><script>ikariam.getClass(ajax.Responder, ${JSON.stringify(JSON.parse(resp))});</script></html>`;
  const i = parseEmbedded(html);
  assert.equal(i.woodLvl, 29); assert.equal(i.freeSpots, 2); assert.equal(i.towns.length, 2);
});

test('parseIslandHtml reads levels by name, also with escaped quotes', () => {
  const html = 'x = JSON.parse("{\\"id\\":\\"600001\\",\\"tradegood\\":\\"2\\",\\"resourceLevel\\":\\"29\\",\\"tradegoodLevel\\":\\"28\\",\\"wonderLevel\\":\\"5\\"}")';
  const i = parseIslandHtml(html);
  assert.equal(i.woodLvl, 29); assert.equal(i.luxLvl, 28); assert.equal(i.tradegood, 'marble'); assert.equal(i.wonderLvl, 5);
  assert.equal(parseIslandHtml('<html>nothing</html>'), null);
  assert.deepEqual(levelKeys(html).sort(), ['resourceLevel', 'tradegood', 'tradegoodLevel', 'wonderLevel']);
});

import { readIsland } from '../shared/ikariam.js';
const islandPage = id => `<script>ikariam.getClass(ajax.Responder, ${JSON.stringify([['updateGlobalData', {}], ['updateBackgroundData', { id: String(id), name: 'I' + id, xCoord: '1', yCoord: '2', tradegood: '2', resourceLevel: '29', tradegoodLevel: '28', cities: [] }]])});</script>`;

test('readIsland: reload answer → loads the requested island page and checks its id', async () => {
  const calls = [];
  const client = { get: async () => [['custom', ['reload', { link: '/index.php', isDevHost: 0 }]]], getText: async p => { calls.push(p); return islandPage(3009); } };
  const r = await readIsland(client, '3009');
  assert.equal(r.via, 'page-json'); assert.equal(r.island.id, '3009'); assert.equal(r.island.luxLvl, 28);
  assert.deepEqual(calls, ['/index.php?view=island&islandId=3009']);
});

test('readIsland: a page showing another island is rejected (bug seen 25 Nov 2026)', async () => {
  const client = { get: async () => [['custom', ['reload', { link: '/index.php' }]]], getText: async () => islandPage(3038) };
  const r = await readIsland(client, '3009');
  assert.equal(r.island, null); assert.equal(r.diag.wrongIsland, '3038');
});
