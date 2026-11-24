import {env} from 'cloudflare:workers';
import {runTool,toolDefinitions,ToolError} from '../../lib/icariam/service';
export async function POST(request:Request){
 let body:any;
 if(Number(request.headers.get('content-length')??0)>100000)return new Response('Solicitud demasiado grande',{status:413});
 try {const text=await request.text();if(text.length>100000)return new Response('Solicitud demasiado grande',{status:413});body=JSON.parse(text);}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON inválido'}});}
 const id=body?.id??null;
 const reply=(result:unknown)=>Response.json({jsonrpc:'2.0',id,result},{headers:{'Cache-Control':'no-store'}});
 if(Array.isArray(body)||body?.jsonrpc!=='2.0'||typeof body?.method!=='string')return Response.json({jsonrpc:'2.0',id,error:{code:-32600,message:'Solicitud inválida'}});
 switch(body.method){
 case 'server/discover':return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 case 'initialize':return reply({protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'Ikariam',version:'1.0.0'},instructions:'Gestión y planificación de Ikariam sobre datos aportados. Empieza por icariam_status y search_knowledge. No hay conexión directa al juego.'});
 case 'notifications/initialized':case 'notifications/cancelled':return new Response(null,{status:204});
 case 'ping':return reply({});
 case 'tools/list':return reply({tools:toolDefinitions});
 case 'tools/call':{
 try{const result=await runTool(body.params?.name,body.params?.arguments??{},request.headers.get('oai-authenticated-user-id'),env.DB);return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false});}
 catch(error:any){const known=error instanceof ToolError;console.error('Ikariam tool error',known?error.code:'internal_error');return reply({content:[{type:'text',text:JSON.stringify({code:known?error.code:'operation_failed',message:known?error.message:'No se ha podido completar la operación. Comprueba los datos y vuelve a intentarlo.'})}],isError:true});}
 }
 default:return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Método no soportado'}});
 }
}
export async function GET(){return Response.json({name:'Ikariam',protocol:'2026-07-28',transport:'JSON-RPC POST',game_connection:false},{headers:{'Cache-Control':'no-store'}});}
