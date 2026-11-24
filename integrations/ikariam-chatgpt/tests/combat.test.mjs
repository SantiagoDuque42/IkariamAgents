import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { battlefield, garrisonLimit, simulateCombat } from '../lib/icariam/combat.mjs';

const { land, naval } = JSON.parse(readFileSync(new URL('../data/combat-units.json', import.meta.url)));

test('field brackets and garrison use town, harbor and wall levels', () => {
  assert.deepEqual([1,5,10,17,25].map((n) => battlefield('land', n).tier), [1,2,3,4,5]);
  assert.deepEqual([0,8,15,22,29].map((n) => battlefield('naval', n).tier), [1,2,3,4,5]);
  assert.deepEqual(battlefield('naval',29).lanes.front, { slots: 7, capacity: 25 });
  assert.equal(garrisonLimit('land', 25, 15), 2250);
  assert.equal(garrisonLimit('naval', 20), 625);
});

test('large garrison moves to the open field while support is excluded', () => {
  const input = { mode:'land', units:land, fieldLevel:1, wallLevel:1, maxRounds:1 };
  const deployed = simulateCombat({ ...input, sides:[
    {army:{hoplite:500}}, {army:{hoplite:300,cook:1000}},
  ]});
  assert.equal(deployed.rounds[0].openField, false);
  assert.equal(deployed.rounds[0].sides[1].formations.wall.muralla, 3);
  const open = simulateCombat({ ...input, sides:[
    {army:{hoplite:500}}, {army:{hoplite:351,cook:1000}},
  ]});
  assert.equal(open.rounds[0].openField, true);
  assert.equal(open.rounds[0].wallRemaining, 0);
  assert.equal(open.rounds[0].fieldTier, 5);
});

test('wall-only defender loses after a single breach, while other sections survive', () => {
  const units = [...land.filter((u) => u.id === 'hoplite'), {
    id:'siege-example', name:'Artillería de prueba', role:'artillery',
    size:5, damage:1000, armor:0, hp:100, accuracy:1, ammo:3,
  }];
  const result = simulateCombat({ mode:'land', units, fieldLevel:1, wallLevel:1,
    wallStats:{hp:501,armor:0,damage:0}, sides:[{army:{hoplite:1,'siege-example':1}}, {army:{}}] });
  assert.equal(result.winner, 'attack');
  assert.equal(result.rounds.length, 1);
  assert.ok(result.rounds[0].wallRemaining > 0 && result.rounds[0].wallRemaining < 3);
});

test('identical seed yields reproducible rounds and naval equipment is per type', () => {
  const sides = [
    { army:{steam_ram:120,fire_ship:60,ballista_ship:68,tender:20}, upgrades:{steam_ram:{weapon:35,defense:35}} },
    { army:{steam_ram:120,fire_ship:60,ballista_ship:68,tender:20} },
  ];
  const input = { mode:'naval', units:naval, fieldLevel:29, seed:741, sides, maxRounds:4 };
  const result = simulateCombat(input);
  assert.deepEqual(result, simulateCombat(input));
  const noBoost = simulateCombat({ ...input, sides:[{army:sides[0].army}, sides[1]] });
  assert.notDeepEqual(result.rounds, noBoost.rounds);
  for (const [i,s] of result.sides.entries()) {
    for (const [id,start] of Object.entries(sides[i].army)) {
      assert.equal(s.remaining[id] + (s.losses[id] ?? 0), start);
    }
  }
});

test('a barbarian army does not flee by morale and unsupported troops are marked', () => {
  const units = [...land, {id:'sin-datos',name:'Sin datos',role:'front',damage:null}];
  const result = simulateCombat({ mode:'land', units, fieldLevel:2, seed:71, sides:[
    {army:{hoplite:500,cook:10}}, {army:{'barbarian-axe-swinger':100,'sin-datos':5}},
  ], maxRounds:2 });
  assert.equal(result.excluded[1]['sin-datos'],5);
  assert.equal(result.sides[1].morale,100);
  assert.ok(result.warnings.some((s) => s.includes('Sin datos')));
  assert.ok(result.warnings.some((s) => s.includes('estimadas')));
});

test('ammunition covers reserve units and is preserved if there is no valid target', () => {
  const units = land.map((unit) => unit.id === 'catapult'
    ? { ...unit, damage:1, weapons:[{ damage:1,accuracy:1,ammo:5 }] } : unit.id === 'hoplite'
    ? { ...unit, hp:1000000, armor:0, damage:0 } : unit);
  const result = simulateCombat({ mode:'land', units, fieldLevel:25, maxRounds:11, sides:[
    {army:{hoplite:350,catapult:60,gyrocopter:60,cook:20}}, {army:{hoplite:350,cook:20}},
  ]});
  assert.equal(result.rounds[0].sides[0].formations.artillery.catapult,30);
  assert.equal(result.rounds[0].sides[0].formations.reserve.catapult,30);
  assert.equal(result.rounds[0].sides[0].ammo.catapult,270);
  assert.equal(result.rounds[9].sides[0].ammo.catapult,0);
  assert.equal(result.sides[0].ammo.gyrocopter,240);
});
