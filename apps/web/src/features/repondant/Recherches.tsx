import type { Session as ServerSession } from '@/server/auth/session';
import { loadTables } from '@/server/page-data';
import RecherchesList from './RecherchesList';

/**
 * « Recherche d'un bénéficiaire » : marchés, bénéficiaires visibles et référentiels lus côté serveur. Pour un répondant,
 * la lecture des bénéficiaires ne contient aucune coordonnée : elles ne sont livrées que par l'action de consultation.
 */
export async function Recherches({ session }: { session: ServerSession }) {
  const t = await loadTables(session as never, ['Repondants', 'Marches', 'Clauses_sociales', 'Beneficiaires'], ['Marches_Interets', 'T0_Referentiel_Specialites']);
  const me = t.Repondants.find((r) => r.id === session.repondantId) ?? null;
  const initial = {
    error: me ? null : session.repondantId ? "Votre fiche n’est pas accessible." : 'Impossible d’identifier votre fiche répondant.',
    me,
    marches: t.Marches,
    clauses: t.Clauses_sociales,
    beneficiaires: t.Beneficiaires,
    interets: t.Marches_Interets,
    specialites: t.T0_Referentiel_Specialites,
  };
  return <RecherchesList initial={initial} />;
}
