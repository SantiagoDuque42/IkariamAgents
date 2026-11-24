import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { runTool, ToolError } from '../../../lib/icariam/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const user = await getChatGPTUser();
  if (!user) return Response.json({ message: 'Inicia sesión para guardar planes.' }, { status: 401, headers });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ message: 'Formato de plan inválido.' }, { status: 415, headers });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: 'Origen inválido.' }, { status: 403, headers });
  if (Number(request.headers.get('content-length')) > 24000) {
    return Response.json({ message: 'El plan es demasiado largo.' }, { status: 413, headers });
  }
  try {
    const body = await request.text();
    if (body.length > 24000) return Response.json({ message: 'El plan es demasiado largo.' }, { status: 413, headers });
    const args = JSON.parse(body);
    const saved = await runTool('save_entry', {
      account_id: args?.account_id, entry_id: args?.entry_id, expected_revision: args?.expected_revision,
      kind: 'plan', data: args?.data,
    }, user.userId, env.DB);
    return Response.json(saved, { headers });
  } catch (error) {
    if (error instanceof ToolError) {
      return Response.json({ message: error.message }, { status: error.code === 'revision_conflict' ? 409 : 400, headers });
    }
    if (error instanceof SyntaxError) return Response.json({ message: 'Plan inválido.' }, { status: 400, headers });
    console.error('Ikariam plan save failed');
    return Response.json({ message: 'No se ha podido guardar el plan.' }, { status: 500, headers });
  }
}
