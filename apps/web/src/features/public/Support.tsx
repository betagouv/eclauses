import type { Session as ServerSession } from '@/server/auth/session';
import { loadTables } from '@/server/page-data';
import SupportView from './SupportView';

/** Centre d'aide : questions, catégories et vidéos publiées, lues côté serveur (visiteur ou connecté). */
export async function Support({ session }: { session: ServerSession | null }) {
  const t = await loadTables(session as never, [], ['Application_FAQ_Categories', 'Application_FAQ_Questions', 'Support_Videos']);
  const initial = { categories: t.Application_FAQ_Categories, questions: t.Application_FAQ_Questions, videos: t.Support_Videos };
  return <SupportView initial={initial} session={session} />;
}
