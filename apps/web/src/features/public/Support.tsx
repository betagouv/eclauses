import type { Session as ServerSession } from '@/server/auth/session';
import { loadTables } from '@/server/page-data';
import { JsonLd } from '@/components/JsonLd';
import SupportView from './SupportView';

const texte = (md: unknown) => String(md ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*#>]/g, '').replace(/\s+/g, ' ').trim();

/** Centre d'aide : questions, catégories et vidéos publiées, lues côté serveur (visiteur ou connecté). */
export async function Support({ session }: { session: ServerSession | null }) {
  const t = await loadTables(session as never, [], ['Application_FAQ_Categories', 'Application_FAQ_Questions', 'Support_Videos']);
  const initial = { categories: t.Application_FAQ_Categories, questions: t.Application_FAQ_Questions, videos: t.Support_Videos };
  // Données structurées : seulement les questions publiques, quelle que soit la session qui charge la page.
  const publiques = (t.Application_FAQ_Questions as Record<string, unknown>[]).filter((q) => q.Audience === 'public' && q.Question && q.Answer).slice(0, 50);
  return (
    <>
      {publiques.length > 0 && (
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: publiques.map((q) => ({ '@type': 'Question', name: texte(q.Question), acceptedAnswer: { '@type': 'Answer', text: texte(q.Answer) } })) }} />
      )}
      <SupportView initial={initial} session={session} />
    </>
  );
}
