import type { ServerSession } from '@/legacy/gristAPI';
import { acheteurBase, loadTables } from '@/server/page-data';
import AnnuaireList from './AnnuaireList';

/** Annuaire des bénéficiaires pour l'acheteur : fiches visibles, marchés de l'entité, clauses et référentiels lus côté serveur. */
export async function Annuaire({ session }: { session: ServerSession }) {
  const { org, error } = await acheteurBase(session as never);
  const t = org
    ? await loadTables(session as never, ['Beneficiaires', 'Marches'], ['Clauses_sociales', 'T0_Referentiel_Departements', 'T0_Referentiel_Regions', 'T0_Referentiel_Specialites'])
    : ({} as Record<string, never[]>);
  const initial = {
    error,
    org,
    beneficiaires: t.Beneficiaires ?? [],
    marches: t.Marches ?? [],
    clauses: t.Clauses_sociales ?? [],
    departements: t.T0_Referentiel_Departements ?? [],
    regions: t.T0_Referentiel_Regions ?? [],
    specialites: t.T0_Referentiel_Specialites ?? [],
  };
  return <AnnuaireList initial={initial} />;
}
