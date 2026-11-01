import type { Session as ServerSession } from '@/server/auth/session';
import { loadTables } from '@/server/page-data';
import MarchesList from './MarchesList';

/** « Mes marchés » (répondant) : fiche, marchés, bénéficiaires, déclarations et refus lus côté serveur. */
export async function Marches({ session }: { session: ServerSession }) {
  const t = await loadTables(session as never, ['Repondants', 'Marches', 'Clauses_sociales', 'Beneficiaires'], ['T0_Referentiel_Specialites', 'Marches_Interets', 'Declarations_Beneficiaires', 'Declarations_Beneficiaires_Refus']);
  const me = t.Repondants.find((r) => r.id === session.repondantId) ?? null;
  const initial = {
    error: me ? null : session.repondantId ? "Votre fiche n’est pas accessible." : 'Impossible d’identifier votre fiche répondant.',
    me,
    marches: t.Marches,
    clauses: t.Clauses_sociales,
    beneficiaires: t.Beneficiaires,
    specialites: t.T0_Referentiel_Specialites,
    interets: t.Marches_Interets,
    declarations: t.Declarations_Beneficiaires,
    refus: t.Declarations_Beneficiaires_Refus,
  };
  return <MarchesList initial={initial} />;
}
