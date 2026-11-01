import { grist } from './config';
import { prepareFields } from './grist/schema';

export interface JobResult {
  job: string;
  processed: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const truthy = (v: unknown) => v === true || v === 1 || v === '1';

/** Supprime les demandes de lien (activation, mot de passe oublié) expirées ou utilisées. */
async function purgeResets(): Promise<JobResult> {
  const expired = (await grist().records('Application_Password_Reset', { filter: { Expire: [true] } })).map((r) => r.id);
  if (expired.length) await grist().deleteRecords('Application_Password_Reset', expired);
  return { job: 'purge-resets', processed: expired.length };
}

/** Bénéficiaires dont la durée de conservation est dépassée : données personnelles effacées. */
async function anonymiseBeneficiaires(): Promise<JobResult> {
  const rows = (await grist().records('Beneficiaires', { filter: { Doit_supprimer: [true] } })).filter((r) => truthy(r.Doit_supprimer));
  for (const row of rows) {
    const fields = await prepareFields('Beneficiaires', {
      NOM: `Beneficiaire #${row.id}`,
      Prenom: null,
      Formation: null,
      Annee_de_diplome: null,
      Specialite_ecole: null,
      Specialite: null,
      Sous_specialite: null,
      Intitule_du_memoire: null,
      Courriel: null,
      Telephone: null,
      Departement_de_residence: null,
      Regions_ou_vous_etes_mobile: null,
      curriculum_vitae: null,
      Autres_informations: null,
      Date_de_suppression: today(),
    });
    await grist().updateRecords('Beneficiaires', [{ id: row.id, fields }]);
  }
  return { job: 'anonymise-beneficiaires', processed: rows.length };
}

/** Répondants à supprimer : données effacées et compte de connexion supprimé. */
async function anonymiseRepondants(): Promise<JobResult> {
  const rows = (await grist().records('Repondants', { filter: { Doit_supprimer: [true] } })).filter((r) => truthy(r.Doit_supprimer));
  for (const row of rows) {
    const fields = await prepareFields('Repondants', {
      Nom: `Repondant #${row.id}`,
      Email: null,
      Telephone: null,
      Raison_sociale: null,
      Siret: null,
      Prenom: null,
      Date_de_suppression: today(),
    });
    await grist().updateRecords('Repondants', [{ id: row.id, fields }]);
    const account = Number(row.Account);
    if (account > 0) await grist().deleteRecords('Application_AuthUser', [account]);
  }
  return { job: 'anonymise-repondants', processed: rows.length };
}

/** Bénéficiaires devenus non éligibles : leur compte de connexion est supprimé. */
async function deleteIneligibleAccounts(): Promise<JobResult> {
  const rows = await grist().records('Beneficiaires', { filter: { Eligible: [false] } });
  const accounts = [...new Set(rows.map((r) => Number(r.Account)).filter((a) => a > 0))];
  if (accounts.length) await grist().deleteRecords('Application_AuthUser', accounts);
  return { job: 'delete-ineligible-accounts', processed: accounts.length };
}

/** Marchés validés dont l'exécution est terminée depuis plus de quatre ans et demi : archivés. */
async function archiveMarches(): Promise<JobResult> {
  const rows = (await grist().records('Marches', { filter: { Doit_archiver: [true] } })).filter((r) => r.Statut === 'Clause validée');
  for (const row of rows) await grist().updateRecords('Marches', [{ id: row.id, fields: { Statut: 'Archivé' } }]);
  return { job: 'archive-marches', processed: rows.length };
}

export const JOBS: Record<string, () => Promise<JobResult>> = {
  'purge-resets': purgeResets,
  'anonymise-beneficiaires': anonymiseBeneficiaires,
  'anonymise-repondants': anonymiseRepondants,
  'delete-ineligible-accounts': deleteIneligibleAccounts,
  'archive-marches': archiveMarches,
};
