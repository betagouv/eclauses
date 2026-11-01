import type { Session as ServerSession } from '@/server/auth/session';
import { loadTables } from '@/server/page-data';
import MarchesList from './MarchesList';

/** « Marchés actifs » : marchés, intérêts et référentiels lus en parallèle côté serveur. */
export async function Marches({ session }: { session: ServerSession }) {
  const t = await loadTables(
    session as never,
    ['Marches', 'Marches_Interets'],
    ['Acheteurs', 'Clauses_sociales', 'Beneficiaires', 'T0_Referentiel_Specialites'],
  );
  const initial = {
    marches: t.Marches,
    interets: t.Marches_Interets,
    acheteurs: t.Acheteurs,
    clauses: t.Clauses_sociales,
    beneficiaires: t.Beneficiaires,
    specialites: t.T0_Referentiel_Specialites,
  };
  return <MarchesList initial={initial} session={session} />;
}
