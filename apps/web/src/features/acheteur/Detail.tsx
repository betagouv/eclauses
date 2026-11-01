import type { Session as ServerSession } from '@/server/auth/session';
import { acheteurBase, loadTables } from '@/server/page-data';
import DetailView from './DetailView';

/** « Détail d'un marché » : le marché (`?id=`), ses lots, déclarations, refus et invitations sont lus côté serveur. */
export async function Detail({ session, query }: { session: ServerSession; query: Record<string, string | undefined> }) {
  const { org, error } = await acheteurBase(session as never);
  const marcheId = Number(query.id);
  const t = org
    ? await loadTables(session as never, ['Clauses_sociales', 'Marches'], ['T0_Referentiel_Specialites', 'Declarations_Beneficiaires', 'Declarations_Beneficiaires_Refus', 'Beneficiaires', 'Invitation_Titulaire'])
    : ({} as Record<string, never[]>);
  const marche = Number.isInteger(marcheId) ? (t.Marches ?? []).find((m) => m.id === marcheId) : undefined;
  const problem = error ?? (!Number.isInteger(marcheId) ? 'Aucun marché sélectionné.' : !marche || marche.Acheteur !== org?.id ? 'Marché introuvable ou non rattaché à votre entité.' : null);
  const initial = {
    error: problem,
    org,
    marcheId: Number.isInteger(marcheId) ? marcheId : null,
    clauses: t.Clauses_sociales ?? [],
    specialites: t.T0_Referentiel_Specialites ?? [],
    marches: t.Marches ?? [],
    declarations: t.Declarations_Beneficiaires ?? [],
    refus: t.Declarations_Beneficiaires_Refus ?? [],
    beneficiaires: t.Beneficiaires ?? [],
    invitations: t.Invitation_Titulaire ?? [],
    relanceDelayDays: process.env.RELANCE_TITULAIRE_DELAY_DAYS ?? '7',
  };
  return <DetailView initial={initial} session={session} />;
}
