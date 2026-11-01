import type { ServerSession } from '@/legacy/gristAPI';
import { acheteurBase, loadTables } from '@/server/page-data';
import ModificationForm from './ModificationForm';

/** « Modifier un marché » : le marché (`?id=`) doit relever de l'entité de l'acheteur, sinon un message d'erreur est affiché. */
export async function Modification({ session, query }: { session: ServerSession; query: Record<string, string | undefined> }) {
  const { org, error } = await acheteurBase(session as never);
  const marcheId = Number(query.id);
  const t = org ? await loadTables(session as never, ['Clauses_sociales', 'Marches'], ['T0_Referentiel_Specialites']) : ({} as Record<string, never[]>);
  const marche = Number.isInteger(marcheId) ? (t.Marches ?? []).find((m) => m.id === marcheId) : undefined;
  const problem = error ?? (!Number.isInteger(marcheId) ? 'Aucun marché sélectionné pour modification.' : !marche || marche.Acheteur !== org?.id ? 'Marché introuvable ou non rattaché à votre entité.' : null);
  const initial = { error: problem, org, marcheId: Number.isInteger(marcheId) ? marcheId : null, clauses: t.Clauses_sociales ?? [], specialites: t.T0_Referentiel_Specialites ?? [], marches: t.Marches ?? [] };
  return <ModificationForm initial={initial} />;
}
