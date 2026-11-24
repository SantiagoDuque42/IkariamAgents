import {z} from 'zod';
export const resourceNames=['wood','wine','marble','crystal','sulfur'];
const id=z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const gridPoint=z.number().int().min(0).max(1000);
const money=z.number().finite().min(0).max(1e15);
const rate=z.number().finite().min(-1e12).max(1e12);
const stamp=z.string().datetime({offset:true}).refine(x=>Date.parse(x)<=Date.now()+300_000,'La observación no puede estar en el futuro.');
const optionalResources=z.object(Object.fromEntries(resourceNames.map(k=>[k,money.optional()]))).strict();
const optionalRates=z.object(Object.fromEntries(resourceNames.map(k=>[k,rate.optional()]))).strict();
const expected=z.number().int().min(0).max(1e9).optional();
const accountData=z.object({
 alias:z.string().min(1).max(100).optional(),player_name:z.string().max(100).optional(),community:z.string().max(50).optional(),world:z.string().max(100).optional(),
 time_zone:z.string().max(80).refine(x=>{try{new Intl.DateTimeFormat('es',{timeZone:x});return true;}catch{return false;}},'Zona horaria inválida.').optional(),
 observed_at:stamp.optional(),goals:z.array(z.string().max(500)).max(30).optional(),game_version:z.string().max(60).optional(),
 server_settings:z.record(z.string().max(80),z.union([z.string().max(200),z.number().finite(),z.boolean()])).optional(),
 treasury:money.optional(),gold_net_per_hour:rate.optional(),research_points:money.optional(),research_per_hour:money.optional(),
 merchant_ships_available:z.number().int().min(0).max(1e7).optional(),merchant_capacity:money.positive().optional(),freighters_available:z.number().int().min(0).max(1e7).optional(),freighter_capacity:money.positive().optional(),
 notes:z.string().max(6000).optional()
}).strict().refine(x=>Object.keys(x).length>0,'Aporta al menos un campo.');
const cityData=z.object({
 name:z.string().min(1).max(100).optional(),coordinates:z.object({x:z.number().int().min(0).max(1000),y:z.number().int().min(0).max(1000)}).strict().optional(),
 capital:z.boolean().optional(),island_resource:z.enum(['wine','marble','crystal','sulfur']).optional(),buildings:z.record(z.string().max(80),z.number().int().min(0).max(10000)).optional(),
 stocks:optionalResources.optional(),net_per_hour:optionalRates.optional(),capacity:optionalResources.optional(),protected:optionalResources.optional(),
 population:money.optional(),satisfaction:rate.optional(),corruption_pct:z.number().finite().min(0).max(100).optional(),
 source:z.string().min(1).max(300).optional(),notes:z.string().max(6000).optional()
}).strict().refine(x=>Object.keys(x).length>0,'Aporta al menos un campo.');
const entryKind=z.enum(['task','note','plan','research','army','fleet','trade','report']);
const entryData=z.object({title:z.string().min(1).max(200).optional(),content:z.string().max(16000).optional(),status:z.enum(['proposed','pending','in_progress','done','cancelled']).optional(),priority:z.enum(['urgent','high','normal','low']).optional(),due_at:z.string().datetime({offset:true}).nullable().optional(),observed_at:stamp.optional(),source:z.string().max(300).optional()}).strict().refine(x=>Object.keys(x).length>0,'Aporta al menos un campo.');
const calcs=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('projection'),stock:money,net_per_hour:rate,hours:z.number().finite().min(0).max(8760),capacity:money.optional()}).strict(),
 z.object({operation:z.literal('shortfall'),resources:z.array(z.object({resource:z.enum(resourceNames),stock:money,cost:money,net_per_hour:rate.optional()}).strict()).min(1).max(5)}).strict(),
 z.object({operation:z.literal('transport'),amount:money,capacity_per_ship:money.positive(),available_ships:z.number().int().min(0).max(1e7),one_way_hours:z.number().finite().min(0).max(8760).optional(),load_hours:z.number().finite().min(0).max(8760).optional()}).strict(),
 z.object({operation:z.literal('payback'),investment:money,increment_per_hour:z.number().finite().positive().max(1e12)}).strict(),
 z.object({operation:z.literal('research_eta'),points:money,target:money,net_per_hour:money}).strict(),
 z.object({operation:z.literal('corruption_estimate'),colonies:z.number().int().min(0).max(20),residence_level:z.number().int().min(0).max(1000),government_penalty_pct:z.number().finite().min(-100).max(100).optional()}).strict()
]);
const combatMode=z.enum(['land','naval']);
const combatUpgrade=z.number().int().min(0).max(600);
const combatSide=z.object({
 army:z.record(id,z.number().int().min(0).max(100000)).refine(x=>Object.keys(x).length<=40,'Demasiadas unidades distintas.'),
 weapon:combatUpgrade.optional(),
 defense:combatUpgrade.optional(),
 upgrades:z.record(id,z.object({weapon:combatUpgrade.optional(),defense:combatUpgrade.optional()}).strict())
  .refine(x=>Object.keys(x).length<=40,'Demasiadas mejoras distintas.').optional(),
 forge:z.number().int().min(0).max(5).optional()
}).strict();
const schemas={
 icariam_status:z.object({}).strict(),
 search_knowledge:z.object({query:z.string().max(300),limit:z.number().int().min(1).max(10).optional()}).strict(),
 read_knowledge:z.object({module_id:id}).strict(),
 list_accounts:z.object({}).strict(),
 get_account:z.object({account_id:id}).strict(),
 save_account:z.object({account_id:id,expected_revision:expected,data:accountData}).strict(),
 save_city:z.object({account_id:id,city_id:id,expected_revision:expected,observed_at:stamp,data:cityData}).strict(),
 save_entry:z.object({account_id:id,entry_id:id,kind:entryKind,expected_revision:expected,data:entryData}).strict(),
 get_history:z.object({account_id:id,kind:z.enum(['account','city',...entryKind.options]),record_id:id,limit:z.number().int().min(1).max(50).optional()}).strict(),
 audit_account:z.object({account_id:id,horizon_hours:z.number().finite().min(1).max(168).optional()}).strict(),
 combat_catalog:z.object({mode:combatMode.optional()}).strict(),
 simulate_battle:z.object({
  mode:combatMode,sides:z.array(combatSide).min(2).max(2),
  fieldLevel:z.number().int().min(0).max(100).optional(),
  wallLevel:z.number().int().min(0).max(100).optional(),
  wallStats:z.object({
   hp:z.number().int().min(1).max(10000000).optional(),
   armor:z.number().int().min(0).max(10000000).optional(),
   damage:z.number().int().min(0).max(10000000).optional()
  }).strict().optional(),
  maxRounds:z.number().int().min(1).max(70).optional(),
  seed:z.number().int().min(0).max(4294967295).optional()
 }).strict().refine(x=>Object.values(x.sides[0].army).some(n=>n>0)&&
  (Object.values(x.sides[1].army).some(n=>n>0)||(x.mode==='land'&&(x.wallLevel??0)>0)),
  'Introduce tropas atacantes y tropas defensoras o una muralla.'),
 search_atlas_map:z.object({
  account_id:id.optional(),
  x:gridPoint.optional(),
  y:gridPoint.optional(),
  radius:z.number().int().min(0).max(200).optional(),
  resource:z.string().trim().min(1).max(30).optional(),
  min_resource_level:z.number().int().min(1).max(1000).optional(),
  min_sawmill_level:z.number().int().min(1).max(1000).optional(),
  wonder:z.string().trim().min(1).max(100).optional(),
  alliance:z.string().trim().min(1).max(50).optional(),
  min_free_slots:z.number().int().min(0).max(200).optional(),
  include_cities:z.boolean().optional(),
  limit:z.number().int().min(1).max(50).optional(),
  offset:z.number().int().min(0).max(10000).optional()
 }).strict().superRefine((query,ctx)=>{
  if((query.x===undefined)!==(query.y===undefined)||(query.radius!==undefined&&query.x===undefined)){
   ctx.addIssue({code:'custom',message:'Indica X e Y juntas. El radio requiere ambas coordenadas.'});
  }
 }),
 calculate:calcs
};
// Convert our deliberately small Zod subset to JSON Schema for MCP discovery.
function jschema(s){
 const d=s._def,t=d.typeName;
 if(t==='ZodOptional'||t==='ZodDefault'||t==='ZodNullable'){const x=jschema(d.innerType);return t==='ZodNullable'?{anyOf:[x,{type:'null'}]}:x;}
 if(t==='ZodEffects')return jschema(d.schema);
 if(t==='ZodObject'){const shape=d.shape();return {type:'object',properties:Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,jschema(v)])),required:Object.entries(shape).filter(([,v])=>!v.isOptional()).map(([k])=>k),additionalProperties:false};}
 if(t==='ZodString'){const out={type:'string'};for(const c of d.checks||[]){if(c.kind==='min')out.minLength=c.value;if(c.kind==='max')out.maxLength=c.value;if(c.kind==='regex')out.pattern=c.regex.source;if(c.kind==='datetime')out.format='date-time';}return out;}
 if(t==='ZodNumber'){const out={type:(d.checks||[]).some(c=>c.kind==='int')?'integer':'number'};for(const c of d.checks||[]){if(c.kind==='min')out[c.inclusive?'minimum':'exclusiveMinimum']=c.value;if(c.kind==='max')out[c.inclusive?'maximum':'exclusiveMaximum']=c.value;}return out;}
 if(t==='ZodBoolean')return {type:'boolean'};
 if(t==='ZodEnum')return {type:'string',enum:d.values};
 if(t==='ZodLiteral')return {type:typeof d.value,const:d.value};
 if(t==='ZodArray'){const x={type:'array',items:jschema(d.type)};if(d.minLength)x.minItems=d.minLength.value;if(d.maxLength)x.maxItems=d.maxLength.value;return x;}
 if(t==='ZodRecord')return {type:'object',additionalProperties:jschema(d.valueType)};
 if(t==='ZodUnion')return {anyOf:d.options.map(jschema)};
 if(t==='ZodDiscriminatedUnion')return {type:'object',oneOf:[...d.options.values()].map(jschema)};
 throw new Error('Unsupported schema '+t);
}
const descriptions={
 icariam_status:'Estado y alcance de Ikariam: módulos, fuentes y conexión. No consulta el juego.',
 search_knowledge:'Busca conceptos y guías de Ikariam en la base revisada. Query vacío devuelve el índice. Devuelve módulos y fuentes.',
 read_knowledge:'Lee un módulo completo de conocimiento de Ikariam con fuentes, fecha y límites de vigencia.',
 list_accounts:'Lista únicamente las cuentas de Ikariam registradas por el usuario actual en Ikariam.',
 get_account:'Lee ficha, ciudades y planes registrados de una cuenta. Son observaciones aportadas, no datos en vivo de Gameforge.',
 save_account:'Crea o modifica parcialmente una ficha. No inventar datos. Para datos numéricos actuales incluir observed_at. Para modificar hace falta expected_revision de la última lectura; 0 para crear.',
 save_city:'Registra una observación parcial de ciudad con fecha. Funde solo campos aportados y conserva la fecha por campo e historial. expected_revision debe coincidir para actualizar; 0 para crear.',
 save_entry:'Guarda o actualiza tarea, plan, nota, investigación, ejército, flota, oferta o informe. No ejecuta acciones en el juego. Para actualizar requiere expected_revision.',
 get_history:'Lee el historial de revisiones de un registro de la cuenta del usuario actual.',
 audit_account:'Detecta riesgos con las últimas observaciones: vino, oro, capacidad, corrupción y antigüedad. No presume tasas faltantes ni ejecuta acciones.',
 combat_catalog:'Lista las unidades terrestres, bárbaras y navales del simulador de Ikariam con estadísticas, fuentes y ejemplos. mode: land para tierra, naval para mar.',
 simulate_battle:'Simula por rondas dos formaciones de Ikariam con unidades del catálogo, moral, reservas, munición, muralla terrestre y Fragua. sides[0] atacante, sides[1] defensor. army usa ID de unidad y cantidad. fieldLevel indica Intendencia en tierra o el mayor nivel de Puerto/Astillero en mar. Indica mejoras de taller por bando o ID de unidad y, si los has medido, los valores por tramo de muralla. Devuelve estimaciones de combate dentro del juego.',
 search_atlas_map:'Consulta la copia fechada del mapa de Atlas España (s74-es) de IkaDatos. Admite coordenada exacta (X e Y), radio en casillas, recurso y nivel mínimo, nivel mínimo de aserradero, maravilla, alianza observada, mínimo de plazas y paginación. Con account_id contrasta las ciudades propias registradas. Devuelve cobertura y fecha; verifica las plazas en el juego.',
 calculate:'Cálculos deterministas de proyección, recursos pendientes, capacidad de transporte, retorno, investigación y corrupción colonial de referencia. Usa datos efectivos aportados; no inventa costes ni bonificaciones.'
};
const writes=new Set(['save_account','save_city','save_entry']);
export const toolDefinitions=Object.entries(schemas).map(([name,schema])=>({name,description:descriptions[name],inputSchema:jschema(schema),annotations:{readOnlyHint:!writes.has(name),destructiveHint:false,idempotentHint:!writes.has(name),openWorldHint:false}}));
export function validateInput(name,args){if(!schemas[name])throw new Error('Herramienta desconocida.');return schemas[name].parse(args??{});}
export function mergeData(previous,patch){const out={...previous};for(const [k,v] of Object.entries(patch)){if(['__proto__','prototype','constructor'].includes(k))throw new Error('Campo inválido.');if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=mergeData(previous?.[k]??{},v);else out[k]=v;}return out;}
export function containsSecret(data){return /(?:password|contraseña|authorization|cookie|access[_ -]?token|refresh[_ -]?token|sessionid)\s*[:=]/i.test(JSON.stringify(data)) || Object.keys(data).some(k=>/password|cookie|token|secret/i.test(k));}
export function calculate(a){
 switch(a.operation){
 case 'projection': {if(a.capacity!==undefined&&a.stock>a.capacity)throw new Error('El inventario inicial supera la capacidad indicada.');const raw=a.stock+a.net_per_hour*a.hours;return {operation:a.operation,projected_stock:Math.max(0,Math.min(a.capacity??Infinity,raw)),unconstrained_stock:raw,hours_until_empty:a.net_per_hour<0?a.stock/-a.net_per_hour:null,hours_until_full:a.capacity!==undefined&&a.net_per_hour>0?(a.capacity-a.stock)/a.net_per_hour:null,overflow:Math.max(0,a.capacity===undefined?0:raw-a.capacity),assumption:'Flujo neto constante, sin nuevos envíos, consumos puntuales ni cambios de bonificaciones. El modelo deja de describir la actividad tras agotamiento.'};}
 case 'shortfall': {if(new Set(a.resources.map(r=>r.resource)).size!==a.resources.length)throw new Error('Recurso duplicado.');const rows=a.resources.map(r=>{const missing=Math.max(0,r.cost-r.stock);return {resource:r.resource,missing,hours_until_ready:missing===0?0:r.net_per_hour>0?missing/r.net_per_hour:null};});return {resources:rows,hours_until_all_ready:rows.some(r=>r.hours_until_ready===null)?null:Math.max(...rows.map(r=>r.hours_until_ready)),assumption:'Sin reservas, otros gastos ni envíos; tasas netas constantes. null significa que no se puede calcular una fecha con estos datos.'};}
 case 'transport': {const needed=Math.ceil(a.amount/a.capacity_per_ship),waves=needed===0?0:a.available_ships>0?Math.ceil(needed/a.available_ships):null;return {ships_needed:needed,available_ships:a.available_ships,waves,last_delivery_hours:waves===0?0:waves===null||a.one_way_hours===undefined||a.load_hours===undefined?null:(2*waves-1)*a.one_way_hours+waves*a.load_hours,assumption:'Un único tipo de barco, flota inicialmente disponible, oleadas secuenciales, carga y ruta constantes, descarga sin espera. Cada oleada requiere que el jugador inicie un nuevo envío; no se programa automáticamente. Devuelve entrega final, no retorno final; no incluye bloqueos ni consumos durante el viaje.'};}
 case 'payback':return {hours:a.investment/a.increment_per_hour,days:a.investment/a.increment_per_hour/24,assumption:'Inversión y ganancia en la misma unidad de valor; retorno simple sin cambios de producción.'};
 case 'research_eta':{const missing=Math.max(0,a.target-a.points);return {missing_points:missing,hours:missing===0?0:a.net_per_hour>0?missing/a.net_per_hour:null,assumption:'Producción neta constante, sin experimentos, recompensas ni prerrequisitos adicionales.'};}
 case 'corruption_estimate':return {estimated_percent:Math.max(0,Math.min(100,Math.floor(100*(1-(a.residence_level+1)/(a.colonies+1))+(a.government_penalty_pct??0)))),reference_only:true,source_url:'https://ikariam.fandom.com/wiki/Corruption',assumption:'Modelo colonial de la wiki: excluir capital del número de colonias y contrastar con la interfaz; no aplicar automáticamente a la capital.'};
 }
}
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stops=new Set(['de','la','el','los','las','en','un','una','y','o','como','que','para','del','mi','a']);
export function searchKnowledge(kb,query,limit=6){const words=norm(query).split(/[^a-z0-9]+/).filter(x=>x.length>1&&!stops.has(x));const rows=kb.modules.map(m=>{const title=norm(m.title+' '+m.tags.join(' ')),all=norm(m.content+' '+m.summary);return {m,score:words.reduce((n,w)=>n+(title.includes(w)?5:all.includes(w)?1:0),0)};}).filter(x=>!words.length||x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);return rows.map(({m,score})=>({id:m.id,title:m.title,summary:m.summary,score,reviewed_at:m.reviewed_at,source_ids:m.source_ids}));}
export function auditRecords(records,horizon=24,now=Date.now()){
 const issues=[],gaps=[];
 for(const r of records){const d=r.data,marks=d._field_observed_at??{};
 const fieldDate=path=>marks[path]??d.observed_at;
 const fieldAge=path=>{const date=fieldDate(path);return date?Math.max(0,(now-Date.parse(date))/36e5):null;};
 if(r.kind==='account'){
 if(d.treasury!==undefined&&d.gold_net_per_hour<0){const a=fieldAge('treasury'),b=fieldAge('gold_net_per_hour');issues.push({priority:'high',type:'treasury_burn',hours_at_observation:d.treasury/-d.gold_net_per_hour,age_hours:Math.max(a??0,b??0),message:'Tesorería negativa: estimación desde los datos observados; verificar antes de actuar.'});}
 }
 if(r.kind!=='city')continue;
 const city=d.name??r.record_id;
 const observed=Object.values(marks).length?Math.min(...Object.values(marks).map(x=>Date.parse(x))):Date.parse(d.observed_at??'');
 const age=Number.isFinite(observed)?Math.max(0,(now-observed)/36e5):null;
 if(age===null||age>24)issues.push({priority:'normal',type:'stale_data',city,oldest_field_age_hours:age,message:'Hay datos sin fecha reciente; no se ha actualizado el inventario por proyección.'});
 for(const res of resourceNames){const stock=d.stocks?.[res],net=d.net_per_hour?.[res],cap=d.capacity?.[res],protectedAmount=d.protected?.[res];
 if(stock===undefined||net===undefined){if(res==='wine')gaps.push({city,missing:stock===undefined?'stocks.wine':'net_per_hour.wine'});continue;}
 const stockDate=fieldDate('stocks.'+res),netDate=fieldDate('net_per_hour.'+res);
 if(!stockDate||!netDate||stockDate!==netDate){gaps.push({city,resource:res,missing:'observación conjunta de inventario y flujo neto'});continue;}
 const stale=(fieldAge('stocks.'+res)??Infinity)>24;
 if(net<0&&stock/-net<=horizon)issues.push({priority:res==='wine'?'urgent':'high',type:'depletion',city,resource:res,hours_from_observation:stock/-net,observed_at:stockDate,needs_refresh:stale});
 if(cap!==undefined&&net>0&&(cap-stock)/net<=horizon)issues.push({priority:'high',type:'overflow',city,resource:res,hours_from_observation:Math.max(0,(cap-stock)/net),observed_at:stockDate,needs_refresh:stale});
 if(protectedAmount!==undefined&&stock>protectedAmount)issues.push({priority:'low',type:'exposed_stock',city,resource:res,amount:stock-protectedAmount,message:'Exceso sobre protección registrada; no implica ataque observado.'});
 }
 if(d.corruption_pct>0)issues.push({priority:'high',type:'corruption',city,percent:d.corruption_pct});
 if(d.satisfaction<0)issues.push({priority:'high',type:'negative_satisfaction',city,value:d.satisfaction});
 }
 const order={urgent:0,high:1,normal:2,low:3};issues.sort((a,b)=>order[a.priority]-order[b.priority]);
 return {horizon_hours:horizon,issues,gaps,account_loaded:records.some(r=>r.kind==='account'),assumption:'Auditoría de observaciones registradas, no del estado en vivo. Los plazos parten de la fecha indicada y las tasas deben permanecer constantes. Datos ausentes no equivalen a cero.'};
}
