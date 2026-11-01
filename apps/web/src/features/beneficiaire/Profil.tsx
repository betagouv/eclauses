import { isNotNull } from 'drizzle-orm';
import type { ServerSession } from '@/legacy/gristAPI';
import { database } from '@/server/db/client';
import { beneficiaires } from '@/server/db/schema';
import { loadTables } from '@/server/page-data';
import { readTable } from '@/server/tables';
import ProfilForm from './ProfilForm';

/** « Mes informations » : la fiche et les référentiels sont lus ici, en parallèle, avant d'envoyer le HTML. */
export async function Profil({ session }: { session: ServerSession }) {
  const id = session.beneficiaireId;
  const [own, refs, years] = await Promise.all([
    id ? readTable(session as never, 'Beneficiaires', [id]) : Promise.resolve([]),
    loadTables(session as never, [], ['T0_Referentiel_Formations', 'T0_Referentiel_Specialites', 'T0_Referentiel_Departements', 'T0_Referentiel_Regions']),
    // Années de diplôme déjà présentes : suggestions du champ « Année de diplôme ».
    database().selectDistinct({ y: beneficiaires.anneeDiplome }).from(beneficiaires).where(isNotNull(beneficiaires.anneeDiplome)),
  ]);
  const initial = {
    rec: own[0] ?? null,
    formations: refs.T0_Referentiel_Formations,
    specialites: refs.T0_Referentiel_Specialites,
    departements: refs.T0_Referentiel_Departements,
    regions: refs.T0_Referentiel_Regions,
    years: years.map((r) => String(r.y)).sort(),
  };
  return <ProfilForm initial={initial} session={session} />;
}
