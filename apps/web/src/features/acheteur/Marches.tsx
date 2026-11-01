import type { ServerSession } from '@/legacy/gristAPI';
import { acheteurBase, loadTables } from '@/server/page-data';
import MarchesList from './MarchesList';

/** « Mes marchés » : marchés de l'entité, invitations et clauses lus côté serveur. */
export async function Marches({ session }: { session: ServerSession }) {
  const { org, error } = await acheteurBase(session as never);
  const t = org ? await loadTables(session as never, ['Marches', 'Clauses_sociales'], ['Invitation_Titulaire']) : ({} as Record<string, never[]>);
  const initial = {
    error,
    org,
    clauses: t.Clauses_sociales ?? [],
    marches: (t.Marches ?? []).filter((m) => org && m.Acheteur === org.id),
    invitations: t.Invitation_Titulaire ?? [],
    relanceDelayDays: process.env.RELANCE_TITULAIRE_DELAY_DAYS ?? '7',
  };
  return <MarchesList initial={initial} />;
}
