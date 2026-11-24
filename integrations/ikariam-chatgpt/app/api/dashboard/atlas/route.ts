import { getChatGPTUser } from '../../../chatgpt-auth';
import { atlasIsland, atlasPoints } from '../../../../lib/icariam/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!await getChatGPTUser()) return Response.json({ message: 'Inicia sesión para abrir Atlas.' }, { status: 401, headers });
  const query = new URL(request.url).searchParams;
  if (!query.has('x') && !query.has('y')) return Response.json(atlasPoints(), { headers });
  const x = Number(query.get('x'));
  const y = Number(query.get('y'));
  if (![x, y].every((value) => Number.isInteger(value) && value >= 1 && value <= 100)) {
    return Response.json({ message: 'Indica dos coordenadas entre 1 y 100.' }, { status: 400, headers });
  }
  const island = atlasIsland(x, y);
  if (!island) return Response.json({ message: 'IkaDatos no registra ninguna isla en esa casilla.' }, { status: 404, headers });
  return Response.json(island, { headers });
}
