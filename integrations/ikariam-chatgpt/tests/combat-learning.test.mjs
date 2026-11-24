import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { simulateCombat, COMBAT_MODEL_VERSION } from '../lib/icariam/combat.mjs';
import { compareBattleReport, reviewCombatReports } from '../lib/icariam/combat-validation.mjs';

const bytes=readFileSync(new URL('../data/combat-units.json',import.meta.url));
const {land,naval}=JSON.parse(bytes);
const catalogSha256=createHash('sha256').update(bytes).digest('hex');

test('land bombers target artillery before air defence',()=>{
  const units=[
    {id:'front',name:'Front',role:'front',hp:1000000,damage:0,armor:0,size:1,accuracy:1},
    {id:'bomb',name:'Bomber',role:'air',hp:1000,damage:100,armor:0,size:1,accuracy:1},
    {id:'defence',name:'Air defence',role:'antiAir',hp:50,damage:0,armor:0,size:1,accuracy:1},
    {id:'artillery',name:'Artillery',role:'artillery',hp:50,damage:0,armor:0,size:1,accuracy:1},
  ];
  const result=simulateCombat({mode:'land',units,maxRounds:1,sides:[
    {army:{front:30,bomb:1}},{army:{front:30,artillery:1,defence:1}},
  ]});
  assert.equal(result.sides[1].remaining.artillery,0);
  assert.equal(result.sides[1].remaining.defence,1);
  assert.equal(result.modelVersion,COMBAT_MODEL_VERSION);
  assert.ok(result.assumptions.length>=4);
});

test('swordsmen deploy before spearmen on the flank and as front substitutes',()=>{
  const input={mode:'land',units:land,fieldLevel:5,maxRounds:1};
  const result=simulateCombat({...input,sides:[
    {army:{hoplite:150,swordsman:60,spearman:60}}, {army:{hoplite:150}},
  ]});
  assert.equal(result.rounds[0].sides[0].formations.flank.swordsman,60);
  assert.equal(result.rounds[0].sides[0].formations.reserve.spearman,60);
  const substitute=simulateCombat({...input,sides:[
    {army:{swordsman:150,spearman:150}}, {army:{hoplite:150}},
  ]});
  assert.equal(substitute.rounds[0].sides[0].formations.front.swordsman,150);
});

test('ranged substitutes use slingers before archers, preserving RCL priority',()=>{
  const result=simulateCombat({mode:'land',units:land,fieldLevel:1,maxRounds:1,
    sides:[{army:{slinger:90,archer:90}},{army:{hoplite:90}}]});
  assert.equal(result.rounds[0].sides[0].formations.front.slinger,90);
  assert.equal(result.rounds[0].sides[0].formations.ranged.archer,90);
});

function fixture(){
  const scenario={mode:'land',units:land,fieldLevel:1,maxRounds:1,seed:8,
    sides:[{army:{hoplite:30}},{army:{hoplite:30}}]};
  const result=simulateCombat(scenario);
  return {id:'fictitious-case',scenario,
    observed:{round:1,remaining:result.rounds[0].sides.map(s=>({...s.remaining}))},
    provenance:{datasetType:'synthetic',partition:'holdout',gameVersion:'test-only',
      environment:'live',world:'demo-world',observedAt:'2026-11-24T18:00:00Z',
      source:'synthetic-self-comparison',catalogSha256}};
}

test('comparator measures known residual and distinguishes synthetic validation',()=>{
  const item=fixture();const baseline=compareBattleReport(item);
  assert.equal(baseline.remainingUnitsMAE,0);
  assert.equal(baseline.outcomeAgreement,null);
  item.observed.remaining[0].hoplite--;
  const changed=compareBattleReport(item);
  assert.equal(changed.bySide[0].hoplite.error,1);
  assert.equal(changed.remainingUnitsMAE,0.5);
  const review=reviewCombatReports([item]);
  assert.equal(review.realLiveHoldoutCases,0);
  assert.equal(review.fidelityStatus,'not_validated_against_real_holdouts');
});

test('comparator rejects incomplete, impossible and unversioned reports',()=>{
  const item=fixture();delete item.observed.remaining[0].hoplite;
  assert.throws(()=>compareBattleReport(item),/partial_report/);
  const impossible=fixture();impossible.observed.remaining[0].hoplite=31;
  assert.throws(()=>compareBattleReport(impossible),/invalid_report_counts/);
  const unversioned=fixture();delete unversioned.provenance.gameVersion;
  assert.throws(()=>compareBattleReport(unversioned),/incomplete_provenance/);
  assert.throws(()=>reviewCombatReports([fixture(),fixture()]),/duplicate_or_missing/);
});

test('reports used for development cannot reappear in holdout',()=>{
  const a=fixture();a.provenance.partition='development';
  const b=fixture();b.id='different-id-same-report';
  assert.throws(()=>reviewCombatReports([a,b]),/development_holdout_leak/);
});

test('catalog review fingerprint matches public statistics without certifying inherited values',()=>{
  const review=JSON.parse(readFileSync(new URL('../data/combat-catalog-review.json',import.meta.url)));
  assert.equal(review.catalog_sha256,catalogSha256);
  assert.equal(review.units.length,land.length+naval.length);
  assert.equal(review.real_holdout_validation,'not_available');
});
