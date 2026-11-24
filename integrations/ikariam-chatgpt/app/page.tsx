import { env } from 'cloudflare:workers';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';
import { loadDashboard, knowledgeForDashboard } from '../lib/icariam/dashboard-data';
import { Dashboard } from '../components/ikariam/dashboard';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const [user, query] = await Promise.all([getChatGPTUser(), searchParams]);
  const data = await loadDashboard(user?.userId ?? null, env.DB, query.cuenta);
  return <Dashboard data={data} knowledge={knowledgeForDashboard()} signedIn={Boolean(user)} signInUrl={chatGPTSignInPath('/')} />;
}
