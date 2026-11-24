import knowledge from '../../data/knowledge.json';
import atlasSnapshot from '../../data/atlas-map.json';
import combatUnits from '../../data/combat-units.json';
import combatExamples from '../../data/combat-examples.json';
import combatReview from '../../data/combat-catalog-review.json';
import {createAtlasMap} from './atlas-map.mjs';
import {simulateCombat} from './combat.mjs';
import {auditRecords,calculate,containsSecret,mergeData,searchKnowledge,toolDefinitions,validateInput} from './engine.mjs';
export {toolDefinitions};
type Row={owner_id:string;account_id:string;kind:string;record_id:string;data:string;revision:number;updated_at:string};
const kb=knowledge;
const atlasMap=createAtlasMap(atlasSnapshot);
export class ToolError extends Error {code:string;constructor(code:string,message:string){super(message);this.code=code;}}
const pack=(r:Row)=>({account_id:r.account_id,kind:r.kind,record_id:r.record_id,data:JSON.parse(r.data),revision:r.revision,updated_at:r.updated_at});
const selection='SELECT * FROM icariam_records WHERE owner_id = ? AND account_id = ?';
export async function runTool(name:string,raw:unknown,userId:string|null,db?:D1Database){
 let a:any;try{a=validateInput(name,raw);}catch(e:any){throw new ToolError('invalid_input',e?.issues?.map((x:any)=>x.path.join('.')+': '+x.message).join('; ')??e.message);}
 if(name==='icariam_status')return {name:'Ikariam',version:kb.version,knowledge_reviewed_at:kb.reviewed_at,module_count:kb.modules.length,source_count:kb.sources.length,connection:'Sin conexión a Gameforge. Registro y cálculo con datos aportados.',authenticated:!!userId,storage_ready:!!db,coverage_note:kb.coverage_note,...(userId?{atlas_map:atlasMap.metadata}:{})};
 if(name==='search_knowledge')return {matches:searchKnowledge(kb,a.query,a.limit??6),coverage_note:kb.coverage_note,reviewed_at:kb.reviewed_at};
 if(name==='read_knowledge'){const module=kb.modules.find(m=>m.id===a.module_id);if(!module)throw new ToolError('not_found','Módulo desconocido. Usa search_knowledge.');return {...module,sources:kb.sources.filter(s=>module.source_ids.includes(s.id)),coverage_note:kb.coverage_note};}
 if(name==='calculate')return calculate(a);
 if(name==='combat_catalog'){
  const mode=a.mode as 'land'|'naval'|undefined;
  return {units:mode?{[mode]:combatUnits[mode]}:combatUnits,examples:combatExamples.filter(e=>!mode||e.mode===mode),reviewed_at:combatReview.reviewed_at,review:combatReview};
 }
 if(name==='simulate_battle'){
  const units=combatUnits[a.mode as 'land'|'naval'];
  const known=new Set(units.map(unit=>unit.id));
  for(const side of a.sides)for(const id of [...Object.keys(side.army),...Object.keys(side.upgrades??{})]){
   if(!known.has(id))throw new ToolError('unknown_unit','Unidad fuera del catálogo de esta modalidad: '+id+'.');
  }
  try{return simulateCombat({...a,units});}
  catch(error){throw new ToolError('invalid_input',error instanceof Error?error.message:'No se puede simular este escenario.');}
 }
 if(!userId)throw new ToolError('unauthenticated','Se necesita la identidad de ChatGPT para acceder a registros.');
 if(name==='search_atlas_map'&&!a.account_id)return atlasMap.search(a);
 if(!db)throw new ToolError('storage_unavailable','El registro persistente no está disponible.');
 const owner=userId;
 if(name==='list_accounts'){const r=await db.prepare("SELECT * FROM icariam_records WHERE owner_id = ? AND kind = 'account' ORDER BY updated_at DESC LIMIT 100").bind(owner).all<Row>();return {accounts:r.results.map(pack)};}
 const account=await db.prepare(selection+" AND kind = 'account' AND record_id = ?").bind(owner,a.account_id,a.account_id).first<Row>();
 if(name!=='save_account'&&!account)throw new ToolError('not_found','La cuenta no está registrada para el usuario actual.');
 if(name==='search_atlas_map'){
  const profile=JSON.parse(account!.data);
  if(profile.server_settings?.server_code!=='s74-es')throw new ToolError('world_mismatch','El mapa corresponde a Atlas España (s74-es).');
  const r=await db.prepare(selection+" AND kind = 'city'").bind(owner,a.account_id).all<Row>();
  return atlasMap.search(a,r.results.map(row=>JSON.parse(row.data)),profile.player_name??profile.alias);
 }
 if(name==='get_account'||name==='audit_account'){
 const r=await db.prepare(selection+' ORDER BY kind, updated_at DESC LIMIT 501').bind(owner,a.account_id).all<Row>();
 if(r.results.length>500)throw new ToolError('record_limit','La cuenta supera los 500 registros; leer una selección antes de auditar.');
 const records=r.results.map(pack);
 return name==='get_account'?{records,connection:'Datos aportados, no estado en vivo del juego.'}:auditRecords(records,a.horizon_hours??24);
 }
 if(name==='get_history'){const r=await db.prepare('SELECT revision,data,saved_at FROM icariam_history WHERE owner_id=? AND account_id=? AND kind=? AND record_id=? ORDER BY revision DESC LIMIT ?').bind(owner,a.account_id,a.kind,a.record_id,a.limit??20).all<{revision:number;data:string;saved_at:string}>();return {history:r.results.map(x=>({...x,data:JSON.parse(x.data)}))};}
 const kind=name==='save_account'?'account':name==='save_city'?'city':a.kind;
 const key=name==='save_account'?a.account_id:name==='save_city'?a.city_id:a.entry_id;
 const old=name==='save_account'?account:await db.prepare(selection+' AND kind=? AND record_id=?').bind(owner,a.account_id,kind,key).first<Row>();
 if(old&&a.expected_revision===undefined)throw new ToolError('revision_required','Lee el registro y aporta expected_revision para actualizarlo.');
 if((a.expected_revision??0)!==(old?.revision??0))throw new ToolError('revision_conflict','El registro ha cambiado. Vuelve a leerlo y concilia los datos.');
 const previous=old?JSON.parse(old.data):{};
 const patch={...a.data};
 if(containsSecret(patch))throw new ToolError('secret_rejected','La ficha no debe contener contraseñas, cookies ni tokens.');
 if(kind==='account'&&['treasury','gold_net_per_hour','research_points','research_per_hour','merchant_ships_available','merchant_capacity','freighters_available','freighter_capacity'].some(k=>k in patch)&&!patch.observed_at)throw new ToolError('observation_required','Incluye observed_at para los datos numéricos de la cuenta.');
 if(kind==='account'&&!old&&!patch.alias)throw new ToolError('required_field','Una cuenta nueva necesita alias.');
 if(kind==='city'&&!old&&!patch.name)throw new ToolError('required_field','Una ciudad nueva necesita nombre.');
 if(kind!=='account'&&kind!=='city'&&!old&&!patch.title)throw new ToolError('required_field','Un registro nuevo necesita título.');
 if(kind!=='account'&&kind!=='city'&&!old&&!patch.status)patch.status='proposed';
 const observedAt=kind==='city'?a.observed_at:patch.observed_at;
 const marks={...previous._field_observed_at};
 if(observedAt){const leaves=(obj:any,prefix=''):string[]=>Object.entries(obj).flatMap(([k,v])=>k==='observed_at'?[]:v&&typeof v==='object'&&!Array.isArray(v)?leaves(v,prefix+k+'.'):[prefix+k]);
 for(const field of leaves(patch)){if(marks[field]&&Date.parse(observedAt)<Date.parse(marks[field]))throw new ToolError('stale_observation','No se puede sustituir un dato con una observación más antigua. Guarda el dato histórico como informe.');marks[field]=observedAt;}
 patch.observed_at=observedAt;patch._field_observed_at=marks;}
 const data=mergeData(previous,patch);
 if(kind==='city')for(const res of ['wood','wine','marble','crystal','sulfur'])if(data.stocks?.[res]!==undefined&&data.capacity?.[res]!==undefined&&data.stocks[res]>data.capacity[res])throw new ToolError('inconsistent_data','El inventario de '+res+' supera la capacidad registrada. Revisa ambos datos.');
 const json=JSON.stringify(data);if(json.length>40000)throw new ToolError('too_large','Registro demasiado grande.');
 const now=new Date().toISOString(),revision=(old?.revision??0)+1,historyId=crypto.randomUUID();
 let mutation:D1PreparedStatement;
 if(old)mutation=db.prepare('UPDATE icariam_records SET data=?,revision=?,updated_at=? WHERE owner_id=? AND account_id=? AND kind=? AND record_id=? AND revision=?').bind(json,revision,now,owner,a.account_id,kind,key,old.revision);
 else mutation=db.prepare('INSERT INTO icariam_records (owner_id,account_id,kind,record_id,data,revision,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(owner,a.account_id,kind,key,json,revision,now);
 // History insertion is conditional on this exact update, so concurrent stale writers create no false revision.
 const hist=db.prepare('INSERT INTO icariam_history (id,owner_id,account_id,kind,record_id,revision,data,saved_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM icariam_records WHERE owner_id=? AND account_id=? AND kind=? AND record_id=? AND revision=? AND updated_at=?) AND changes()=1').bind(historyId,owner,a.account_id,kind,key,revision,json,now,owner,a.account_id,kind,key,revision,now);
 const result=await db.batch([mutation,hist]);
 if(result[0].meta.changes!==1)throw new ToolError('revision_conflict','Otro cambio ha actualizado este registro. Vuelve a leer antes de guardar.');
 return {saved:true,account_id:a.account_id,kind,record_id:key,data,revision,updated_at:now,game_action_executed:false};
}
