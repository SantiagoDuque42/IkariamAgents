import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,validateInput,toolDefinitions,mergeData,searchKnowledge,auditRecords} from '../lib/icariam/engine.mjs';
const kb=JSON.parse(readFileSync(new URL('../data/knowledge.json',import.meta.url)));
test('Cálculos de agotamiento, desbordamiento y tasas nulas',()=>{
 assert.equal(calculate(validateInput('calculate',{operation:'projection',stock:100,net_per_hour:-20,hours:8})).hours_until_empty,5);
 assert.equal(calculate(validateInput('calculate',{operation:'projection',stock:90,net_per_hour:10,hours:3,capacity:100})).overflow,20);
 assert.equal(calculate(validateInput('calculate',{operation:'research_eta',points:0,target:10,net_per_hour:0})).hours,null);
 assert.equal(calculate(validateInput('calculate',{operation:'research_eta',points:20,target:10,net_per_hour:0})).hours,0);
});
test('El transporte distingue sin barcos, cero carga y oleadas',()=>{
 assert.equal(calculate(validateInput('calculate',{operation:'transport',amount:1000,capacity_per_ship:500,available_ships:0})).waves,null);
 assert.equal(calculate(validateInput('calculate',{operation:'transport',amount:0,capacity_per_ship:500,available_ships:0})).last_delivery_hours,0);
 assert.equal(calculate(validateInput('calculate',{operation:'transport',amount:2000,capacity_per_ship:500,available_ships:2,one_way_hours:1,load_hours:0.25})).last_delivery_hours,3.5);
});
test('No existen fechas listas inventadas ni recursos duplicados',()=>{
 const x=calculate(validateInput('calculate',{operation:'shortfall',resources:[{resource:'wood',stock:0,cost:100,net_per_hour:0},{resource:'marble',stock:0,cost:100,net_per_hour:10}]}));
 assert.equal(x.hours_until_all_ready,null);assert.equal(x.resources[1].hours_until_ready,10);
 assert.throws(()=>calculate(validateInput('calculate',{operation:'shortfall',resources:[{resource:'wood',stock:0,cost:1},{resource:'wood',stock:0,cost:1}]})));
});
test('Corrupción usa colonias excluyendo capital y límites del modelo',()=>{
 assert.equal(calculate(validateInput('calculate',{operation:'corruption_estimate',colonies:3,residence_level:2})).estimated_percent,25);
 assert.equal(calculate(validateInput('calculate',{operation:'corruption_estimate',colonies:3,residence_level:4})).estimated_percent,0);
});
test('Validación rechaza fechas futuras, costes negativos y claves extra',()=>{
 assert.throws(()=>validateInput('calculate',{operation:'transport',amount:3,capacity_per_ship:0,available_ships:2}));
 assert.throws(()=>validateInput('calculate',{operation:'payback',investment:-1,increment_per_hour:1}));
 assert.throws(()=>validateInput('save_account',{account_id:'a',data:{password:'x'}}));
 assert.throws(()=>validateInput('save_city',{account_id:'a',city_id:'b',observed_at:'2099-01-01T00:00:00Z',data:{name:'Test'}}));
 assert.throws(()=>mergeData({},JSON.parse('{"__proto__":{"a":1}}')));
});
test('Cambios parciales conservan observaciones y edificios anteriores',()=>{
 assert.deepEqual(mergeData({stocks:{wood:50,wine:20},name:'A'},{stocks:{wood:10}}),{stocks:{wood:10,wine:20},name:'A'});
});
test('Auditoría distingue datos ausentes y observaciones incompatibles',()=>{
 const time='2026-11-20T00:00:00Z';
 const rows=[{kind:'account',record_id:'a',data:{}},{kind:'city',record_id:'b',data:{name:'B',observed_at:time,stocks:{wine:100},net_per_hour:{wine:-10}}}];
 const report=auditRecords(rows,24,Date.parse(time));assert.equal(report.issues[0].type,'depletion');
 const mixed=structuredClone(rows);mixed[1].data._field_observed_at={'stocks.wine':time,'net_per_hour.wine':'2026-11-19T00:00:00Z'};
 assert.equal(auditRecords(mixed,24,Date.parse(time)).issues.some(x=>x.type==='depletion'),false);
 assert.equal(auditRecords([{kind:'city',record_id:'c',data:{observed_at:time}}],24,Date.parse(time)).gaps.length,1);
});
test('Conocimiento completo y búsqueda española con acentos',()=>{
 assert.equal(kb.modules.length,20);assert.equal(kb.sources.length,51);
 assert.ok(searchKnowledge(kb,'corrupción',3).some(x=>x.id==='expansion'));
 assert.ok(searchKnowledge(kb,'Cronos',3).some(x=>x.id==='versiones'));
 for(const m of kb.modules)for(const id of m.source_ids)assert.ok(kb.sources.some(s=>s.id===id));
 for(const t of toolDefinitions)assert.ok(t.inputSchema&&t.description&&t.annotations);
 assert.equal(toolDefinitions.length,14);
 assert.ok(toolDefinitions.some(t=>t.name==='combat_catalog'&&t.annotations.readOnlyHint));
 assert.ok(toolDefinitions.some(t=>t.name==='simulate_battle'&&t.annotations.readOnlyHint));
});
