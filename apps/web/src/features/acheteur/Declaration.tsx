import type { Session as ServerSession } from '@/server/auth/session';
import { acheteurBase, loadTables } from '@/server/page-data';
import DeclarationForm from './DeclarationForm';

/** « Déclarer un marché » : entité et référentiels lus côté serveur. */
export async function Declaration({ session }: { session: ServerSession }) {
  const { org, error } = await acheteurBase(session as never);
  const t = org ? await loadTables(session as never, ['Clauses_sociales'], ['T0_Referentiel_Specialites', 'Marches']) : ({} as Record<string, never[]>);
  const initial = { error, org, clauses: t.Clauses_sociales ?? [], specialites: t.T0_Referentiel_Specialites ?? [], marches: t.Marches ?? [] };
  return <DeclarationForm initial={initial} />;
}
