import type { ServerSession } from '@/legacy/gristAPI';
import { acheteurBase, loadTables } from '@/server/page-data';
import StatistiquesView from './StatistiquesView';

/** Statistiques de l'entité acheteuse : marchés et clauses lus côté serveur. */
export async function Statistiques({ session }: { session: ServerSession }) {
  const { ua, org, error } = await acheteurBase(session as never);
  const t = org ? await loadTables(session as never, ['Marches'], ['Clauses_sociales']) : { Marches: [], Clauses_sociales: [] };
  const initial = {
    ua,
    org,
    error,
    clauses: t.Clauses_sociales,
    marches: t.Marches.filter((m) => org && m.Acheteur === org.id),
  };
  return <StatistiquesView initial={initial} />;
}
