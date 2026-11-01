import Link from 'next/link';
import { indicateurs } from '@/server/admin/pilotage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tableau de bord - Administration Eclauses' };

const STATUTS: Record<string, string> = {
  en_attente_publication: 'En attente de publication',
  en_attente_notification: 'En attente de notification',
  en_attente_declaration: 'En attente de déclaration',
  declaration_a_valider: 'Déclaration à valider',
  clause_validee: 'Clause validée',
  archive: 'Archivé',
};

function Tuile({ titre, valeur, href, detail }: { titre: string; valeur: number; href?: string; detail?: string }) {
  const corps = (
    <div className="fr-tile fr-tile--sm fr-p-2w" style={{ height: '100%' }}>
      <p className="fr-h2 fr-mb-0">{valeur}</p>
      <p className="fr-text--sm fr-mb-0">{titre}</p>
      {detail && <p className="fr-text--xs fr-text-mention--grey fr-mb-0">{detail}</p>}
    </div>
  );
  return <div className="fr-col-6 fr-col-md-3">{href ? <Link href={href} style={{ backgroundImage: 'none' }}>{corps}</Link> : corps}</div>;
}

export default async function Page() {
  const i = await indicateurs();
  return (
    <>
      <h1 className="fr-h3">Tableau de bord</h1>
      <div className="fr-grid-row fr-grid-row--gutters fr-mb-4w">
        <Tuile titre="Déclarations à valider" valeur={i.declarationsAValider} href="/admin/marches" />
        <Tuile titre="Comptes non activés" valeur={i.comptesNonActives} href="/admin/comptes?etat=non_active" />
        <Tuile titre="Bénéficiaires" valeur={i.beneficiaires.total} href="/admin/beneficiaires" detail={`${i.beneficiaires.eligibles} avec une fiche à jour`} />
        <Tuile titre="Candidats et titulaires" valeur={i.repondants} href="/admin/repondants" />
        <Tuile titre="Acheteurs" valeur={i.acheteurs} href="/admin/acheteurs" />
        <Tuile titre="Courriers (7 derniers jours)" valeur={i.envois7j} href="/admin/envois" />
      </div>
      <h2 className="fr-h5">Marchés par statut</h2>
      <ul>
        {i.marchesParStatut.map((m) => (
          <li key={m.statut}>{STATUTS[m.statut] ?? m.statut} : {m.n}</li>
        ))}
        {!i.marchesParStatut.length && <li>Aucun marché.</li>}
      </ul>
      <h2 className="fr-h5">Dernières actions d’administration</h2>
      {i.derniersJournaux.length ? (
        <ul>
          {i.derniersJournaux.map((j) => (
            <li key={j.id}>
              {new Date(j.creeLe).toLocaleString('fr-FR')} — {j.email} : {j.action} ({j.entite}{j.entiteId ? ` ${j.entiteId}` : ''})
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucune action enregistrée.</p>
      )}
      <p><Link href="/admin/audit">Voir tout le journal</Link></p>
    </>
  );
}
