import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {runTool} from '../outputs/service-test.mjs';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_daily_ink.sql',import.meta.url),'utf8'));
 class Prepared{
  constructor(query,values=[]){this.query=query;this.values=values;}
  bind(...values){return new Prepared(this.query,values);}
  first(){return sql.prepare(this.query).get(...this.values)??null;}
  all(){return {results:sql.prepare(this.query).all(...this.values)};}
  run(){const r=sql.prepare(this.query).run(...this.values);return {meta:{changes:Number(r.changes)}};}
 }
 return {prepare:q=>new Prepared(q),batch:async queries=>{sql.exec('BEGIN');try{const r=queries.map(q=>q.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}},close:()=>sql.close()};
}
const date=new Date(Date.now()-60000).toISOString();
const reject=code=>e=>e.code===code;
test('Registros aislados por usuario, revisiones e historial atómicos',async()=>{
 const db=database();const call=(name,args={},owner='owner-a')=>runTool(name,args,owner,db);
 assert.equal((await call('icariam_status')).module_count,20);
 await assert.rejects(call('list_accounts',{},null),reject('unauthenticated'));
 const a=await call('save_account',{account_id:'test',expected_revision:0,data:{alias:'Prueba local',observed_at:date,treasury:1000,gold_net_per_hour:-20}});assert.equal(a.revision,1);
 await assert.rejects(call('save_account',{account_id:'test',expected_revision:1,data:{treasury:900}}),reject('observation_required'));
 const b=await call('save_city',{account_id:'test',city_id:'capital',expected_revision:0,observed_at:date,data:{name:'Capital',stocks:{wine:100,wood:80},net_per_hour:{wine:-10,wood:5},capacity:{wine:1000,wood:100}}});assert.equal(b.revision,1);
 const patch={account_id:'test',city_id:'capital',expected_revision:1,observed_at:date,data:{stocks:{wood:90}}};
 const concurrent=await Promise.allSettled([call('save_city',patch),call('save_city',patch)]);
 assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.equal(concurrent.find(x=>x.status==='rejected').reason.code,'revision_conflict');
 const city=(await call('get_account',{account_id:'test'})).records.find(x=>x.kind==='city');assert.equal(city.data.stocks.wine,100);assert.equal(city.revision,2);
 const hist=(await call('get_history',{account_id:'test',kind:'city',record_id:'capital'})).history;assert.equal(hist.length,2);assert.equal(hist[0].data.stocks.wood,90);
 assert.deepEqual((await call('list_accounts',{},'owner-b')).accounts,[]);
 await assert.rejects(call('get_account',{account_id:'test'},'owner-b'),reject('not_found'));
 assert.ok((await call('audit_account',{account_id:'test'})).issues.some(x=>x.type==='depletion'));
 await assert.rejects(call('save_city',{...patch,expected_revision:2,observed_at:'2020-01-01T00:00:00Z'}),reject('stale_observation'));
 db.close();
});

test('El plugin expone el catálogo y comparte las reglas de ambos modos del simulador',async()=>{
 const land=await runTool('combat_catalog',{mode:'land'},'owner-a');
 const sea=await runTool('combat_catalog',{mode:'naval'},'owner-a');
 assert.equal(land.units.land.length,24);
 assert.equal(sea.units.naval.length,21);
 assert.equal(sea.units.naval.find(u=>u.id==='steam_ram').accuracy,0.9);
 assert.ok(sea.units.naval.some(u=>u.faction==='barbarian'&&u.estimated));
 assert.ok(land.examples.some(e=>e.id==='demacia-2026-10-28'));
 const input={mode:'naval',fieldLevel:29,seed:38,maxRounds:2,
  sides:[{army:{steam_ram:40,ram_ship:50}},{army:{fire_ship:42,ram_ship:50}}]};
 const result=await runTool('simulate_battle',input,'owner-a');
 assert.equal(result.field.tier,5);
 assert.ok(result.rounds.length);
 assert.deepEqual(result,await runTool('simulate_battle',input,'owner-a'));
 await assert.rejects(runTool('simulate_battle',{...input,
  sides:[{army:{hoplite:60}},input.sides[1]]},'owner-a'),reject('unknown_unit'));
});

test('El mapa ficticio conserva cobertura, distingue fichas ausentes y filtra por coordenadas', async()=>{
 const search=(query, user='owner-a')=>runTool('search_atlas_map',query,user);
 await assert.rejects(search({},null),reject('unauthenticated'));
 await assert.rejects(search({x:2}),reject('invalid_input'));
 const world=await search({limit:2});
 assert.equal(world.server,'s74-es');
 assert.equal(world.coverage.islands,3);
 assert.equal(world.coverage.with_wonder,3);
 assert.equal(world.coverage.occupied_slots_listed,1);
 assert.equal(world.coverage.with_city_list,2);
 assert.equal(world.coverage.city_records_listed,1);
 assert.equal(world.matched,3);
 assert.equal(world.next_offset,2);
 assert.equal(world.islands.length,2);
 assert.deepEqual((await search({limit:2,offset:2})).islands,
  (await search({limit:4})).islands.slice(2));
 const {islands:[island]}=await search({x:2,y:2});
 assert.equal(island.wonder,'Templo de Poseidón');
 assert.equal(island.sawmill_level,3);
 assert.equal(island.cities.length,1);
 const db=database();
 await runTool('save_account',{account_id:'test-atlas',data:{
  alias:'Mi cuenta',player_name:'Jugador de prueba',server_settings:{server_code:'s74-es'}
 }},'owner-a',db);
 await runTool('save_city',{account_id:'test-atlas',city_id:'test-city',observed_at:date,data:{
  name:'Ciudad de prueba',coordinates:{x:2,y:2}
 }},'owner-a',db);
 const query={account_id:'test-atlas',x:2,y:2};
 const ownerMap=await runTool('search_atlas_map',query,'owner-a',db);
 assert.deepEqual(ownerMap.islands[0].own_cities_absent_from_list,['Ciudad de prueba']);
 await assert.rejects(runTool('search_atlas_map',query,'owner-b',db),reject('not_found'));
 db.close();
 assert.equal((await search({x:1,y:2})).islands[0].cities.length,0);
 const detailed=await search({limit:2,include_cities:true});
 assert.equal(detailed.islands[0].cities,null);
 const alliance=await search({alliance:'DEMO',limit:50});
 assert.equal(alliance.matched,1);
 assert.equal(alliance.islands[0].coordinates,'2:2');
 assert.match((await search({alliance:'UNKNOWN'})).notes.at(-1),/exclusivamente/);
 const filtered=await search({x:2,y:2,radius:2,resource:'marmol',wonder:'Poseidon',min_resource_level:2,min_sawmill_level:3,min_free_slots:10});
 assert.equal(filtered.islands[0].coordinates,'2:2');
 assert.ok(filtered.islands.every(island=>island.resource==='Mármol'&&island.distance<=2&&island.free_slots>=10));
});
