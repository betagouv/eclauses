import type { ServerSession } from '@/legacy/gristAPI';
import { loadTables } from '@/server/page-data';
import AnnuaireList from './AnnuaireList';

/** « Annuaire » : fiches visibles par ce bénéficiaire, clauses et référentiels lus côté serveur. */
export async function Annuaire({ session }: { session: ServerSession }) {
  const t = await loadTables(session as never, ['Beneficiaires'], ['Clauses_sociales', 'T0_Referentiel_Departements', 'T0_Referentiel_Specialites']);
  const initial = {
    beneficiaires: t.Beneficiaires,
    clauses: t.Clauses_sociales,
    departements: t.T0_Referentiel_Departements,
    specialites: t.T0_Referentiel_Specialites,
  };
  return <AnnuaireList initial={initial} session={session} />;
}
