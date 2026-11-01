import { FusionForm } from '@/features/admin/FusionForm';
import { doublonsProbables } from '@/server/admin/fusion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fusion de doublons - Administration Eclauses' };

export default async function Page() {
  const doublons = await doublonsProbables();
  return (
    <>
      <h1 className="fr-h3">Fusion de doublons</h1>
      <p>Reporte sur un profil toutes les données d’un second profil (déclarations, intérêts, consultations, candidatures, listes), complète les champs vides et garde le consentement le plus restrictif, puis supprime le doublon. L’opération est définitive et journalisée.</p>
      <h2 className="fr-h5">Bénéficiaires</h2>
      <FusionForm type="beneficiaire" />
      <h2 className="fr-h5">Candidats et titulaires</h2>
      <FusionForm type="repondant" />
      <h2 className="fr-h5">Doublons probables</h2>
      <p className="fr-text--sm fr-text-mention--grey">Bénéficiaires de même nom et prénom, candidats de même SIRET. Le numéro est celui du profil (visible dans les listes).</p>
      {doublons.length ? (
        <ul>
          {doublons.map((d) => (
            <li key={`${d.type}-${d.cle}`}>
              {d.type === 'beneficiaire' ? 'Bénéficiaire' : 'Candidat'} « {d.cle} » : {d.profils.map((p) => `n° ${p.id} (${p.email ?? 'sans compte'})`).join(' · ')}
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucun doublon probable.</p>
      )}
    </>
  );
}
