import { getChatGPTUser } from '../../../chatgpt-auth';
import players from '../../../../data/atlas-players.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!await getChatGPTUser()) {
    return Response.json({ message: 'Inicia sesión para consultar a otros jugadores.' }, { status: 401, headers });
  }
  return Response.json(players, { headers });
}
