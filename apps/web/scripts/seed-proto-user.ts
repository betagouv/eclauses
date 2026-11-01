/**
 * Crée dans le document DEV un bénéficiaire de test et son compte (idempotent). Le mot de passe est
 * généré et écrit dans `.env.local` (PROTO_TEST_EMAIL / PROTO_TEST_PASSWORD), jamais affiché.
 * Refuse de tourner sur un autre document que DEV.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { GristClient } from '../src/server/grist/client';
import { hashPassword } from '../src/server/auth/password';

process.loadEnvFile('.env.local');

const DEV_DOC = '<ID du document DEV>';
if (process.env.GRIST_DOC_ID !== DEV_DOC) {
  console.error('Refus : ce script ne s’exécute que sur le document DEV.');
  process.exit(1);
}

const g = new GristClient({
  baseUrl: process.env.GRIST_BASE_URL!,
  docId: process.env.GRIST_DOC_ID!,
  apiKey: process.env.GRIST_API_KEY!,
});

const email = 'proto.rewrite@oriatec.fr';
// Les autres comptes de test utilisent le domaine réservé `.test` : aucun courrier réel ne peut en partir.
const acheteurEmail = 'proto.acheteur@example.test';
const repondantEmail = 'proto.repondant@example.test';
const [benef] = await g.records('Beneficiaires', { filter: { Courriel: [email] } });
if (!benef) {
  const [id] = await g.addRecords('Beneficiaires', [
    {
      NOM: 'PROTO',
      Prenom: 'Rewrite',
      Courriel: email,
      Annee_de_diplome: String(new Date().getFullYear() - 1),
      Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur: true,
      Je_consens_a_etre_contacte_pour_rejoindre_des_groupements: false,
    },
  ]);
  console.log('Bénéficiaire créé, id', id);
}

const [user] = await g.records('Application_AuthUser', { filter: { Email: [email] } });
if (!user) {
  const password = randomBytes(12).toString('base64url');
  await g.addRecords('Application_AuthUser', [{ Email: email, Hash_Password: await hashPassword(password) }]);
  const env = readFileSync('.env.local', 'utf8');
  if (!env.includes('PROTO_TEST_PASSWORD')) {
    appendFileSync('.env.local', `PROTO_TEST_EMAIL=${email}\nPROTO_TEST_PASSWORD=${password}\n`);
  }
  console.log('Compte créé (mot de passe dans .env.local)');
} else {
  console.log('Compte déjà présent');
}

/** Crée un compte de connexion si besoin et renvoie son mot de passe (écrit dans .env.local) ou null s'il existait. */
async function ensureAccount(mail: string, envPrefix: string): Promise<void> {
  const [existing] = await g.records('Application_AuthUser', { filter: { Email: [mail] } });
  if (existing) return;
  const password = randomBytes(12).toString('base64url');
  await g.addRecords('Application_AuthUser', [{ Email: mail, Hash_Password: await hashPassword(password) }]);
  appendFileSync('.env.local', `${envPrefix}_EMAIL=${mail}\n${envPrefix}_PASSWORD=${password}\n`);
  console.log(`Compte créé : ${mail}`);
}

const [acheteurUser] = await g.records('Utilisateurs_Acheteurs', { filter: { Email: [acheteurEmail] } });
if (!acheteurUser) {
  await g.addRecords('Utilisateurs_Acheteurs', [
    { Nom: 'PROTO', Prenom: 'Acheteur', Email: acheteurEmail, Entite_de_rattachement: 4 },
  ]);
  console.log('Utilisateur acheteur créé');
}
await ensureAccount(acheteurEmail, 'PROTO_ACHETEUR');

const [repondant] = await g.records('Repondants', { filter: { Email: [repondantEmail] } });
if (!repondant) {
  await g.addRecords('Repondants', [{ Nom: 'PROTO', Prenom: 'Repondant', Email: repondantEmail }]);
  console.log('Répondant créé');
}
await ensureAccount(repondantEmail, 'PROTO_REPONDANT');
