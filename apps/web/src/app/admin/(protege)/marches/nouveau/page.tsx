import Link from 'next/link';
import DeclarationForm from '@/features/acheteur/DeclarationForm';
import { options } from '@/server/admin/crud';
import { requireAdmin } from '@/server/admin/guard';
import { declarerPourEntite } from '@/server/actions/admin';
import * as specs from '@/server/compat/specs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouveau marché - Administration Eclauses' };

/** Création d'un marché par l'équipe : choix de l'entité acheteuse, puis le même formulaire que pour l'acheteur. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const entiteId = Number((await searchParams).entite);
  const entites = await options('acheteurs');

  if (!Number.isInteger(entiteId) || !entites.some((e) => e.value === String(entiteId))) {
    return (
      <>
        <h1 className="fr-h3">Nouveau marché</h1>
        <p>Pour quelle entité acheteuse créez-vous ce marché ? Il sera enregistré comme créé par l’administration (et non en autonomie par l’acheteur).</p>
        <form method="get" className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom">
          <div className="fr-col-12 fr-col-md-8">
            <label className="fr-label" htmlFor="entite">Entité acheteuse</label>
            <select id="entite" name="entite" className="fr-select" required defaultValue="">
              <option value="" disabled>Choisir…</option>
              {entites.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="fr-col-auto">
            <button className="fr-btn" type="submit">Continuer</button>
          </div>
        </form>
        <p className="fr-mt-2w"><Link href="/admin/marches">Retour aux marchés</Link></p>
      </>
    );
  }

  // Formulaire de l'acheteur, réutilisé tel quel : entité fixée, création enregistrée comme faite par l'administration.
  const [clauses, specialites] = await Promise.all([specs.clauses.read(), specs.specialites.read()]);
  const initial = {
    error: null,
    org: { id: entiteId, Nom: entites.find((e) => e.value === String(entiteId))!.label },
    clauses: clauses.map((c) => ({ id: c.id, Nom_de_la_clause: c.Nom_de_la_clause })),
    specialites,
    marches: [],
  };
  return <DeclarationForm initial={initial} declarerAction={declarerPourEntite.bind(null, entiteId)} retour="/admin/marches" />;
}
