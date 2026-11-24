import knowledge from '../../../data/knowledge.json';
export async function GET(){return Response.json({name:'Ikariam',version:knowledge.version,reviewed_at:knowledge.reviewed_at,modules:knowledge.modules.length,sources:knowledge.sources.length,game_connection:false});}
