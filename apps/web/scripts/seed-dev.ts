/**
 * Données de démonstration pour la base PostgreSQL LOCALE (idempotent). Refuse toute autre base que
 * localhost. Les comptes utilisent le domaine réservé `.test` : aucun courrier réel ne peut partir.
 * Les mots de passe sont générés et écrits dans `.env.local` (SEED_*_PASSWORD), jamais affichés.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../src/server/auth/password';
import { createDatabase } from '../src/server/db/client';
import * as s from '../src/server/db/schema';

process.loadEnvFile('.env.local');
const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', 'db'].includes(new URL(url).hostname)) {
  console.error('Refus : ce script ne s’exécute que sur une base locale.');
  process.exit(1);
}
const { db, sql: pg } = createDatabase(url, { max: 4 });
const env = readFileSync('.env.local', 'utf8');

async function password(key: string): Promise<string> {
  const existing = new RegExp(`^${key}=(.+)$`, 'm').exec(env)?.[1];
  if (existing) return existing;
  const value = randomBytes(9).toString('base64url');
  appendFileSync('.env.local', `\n${key}=${value}\n`);
  return value;
}

async function account(email: string, key: string) {
  const hash = await hashPassword(await password(key));
  const [existing] = await db.select().from(s.utilisateurs).where(sql`lower(${s.utilisateurs.email}) = ${email}`);
  if (existing) {
    await db.update(s.utilisateurs).set({ motDePasseHash: hash }).where(sql`${s.utilisateurs.id} = ${existing.id}`);
    return existing;
  }
  const [u] = await db.insert(s.utilisateurs).values({ email, motDePasseHash: hash, motDePasseModifieLe: new Date() }).returning();
  return u!;
}

const year = new Date().getFullYear();
await db.transaction(async (tx) => {
  const [formation] = await tx.insert(s.formations).values({ intitule: 'Master Restauration' }).returning();
  const [region] = await tx.insert(s.regions).values({ intitule: 'Île-de-France', chefLieu: 'Paris', latitude: 48.85, longitude: 2.35 }).returning();
  const [dep] = await tx.insert(s.departements).values({ numero: '75', nom: 'Paris', regionId: region!.id, libelleAffichage: '75 - Paris', latitude: 48.85, longitude: 2.35 }).returning();
  const [clause] = await tx.insert(s.clausesSociales).values({ nom: 'Insertion - restauration du patrimoine', gabaritArticle: 'Article à insérer au CCAP…' }).returning();
  const [spec] = await tx.insert(s.specialites).values({ intitule: 'Peinture', clauseId: clause!.id }).returning();
  const [entite] = await tx.insert(s.acheteurs).values({ nom: 'DRAC Démo', ministere: 'Culture', categorie: 'services_deconcentres' }).returning();

  const ua = await account('demo.acheteur@example.test', 'SEED_ACHETEUR_PASSWORD');
  await tx.insert(s.utilisateursAcheteurs).values({ utilisateurId: ua.id, acheteurId: entite!.id, nom: 'Martin', prenom: 'Camille' });

  const rep = await account('demo.repondant@example.test', 'SEED_REPONDANT_PASSWORD');
  const [repondant] = await tx.insert(s.repondants).values({ utilisateurId: rep.id, nom: 'Durand', prenom: 'Alex', raisonSociale: 'Peinture & Cie', siret: '12345678901234' }).returning();

  const beneficiaire = async (email: string, key: string, nom: string, consent: boolean) => {
    const u = await account(email, key);
    const [b] = await tx
      .insert(s.beneficiaires)
      .values({ utilisateurId: u.id, nom, prenom: 'Démo', formationId: formation!.id, anneeDiplome: year - 1, consentementAnnuaire: consent, consentementContactGroupements: consent, ficheAJour: true })
      .returning();
    await tx.insert(s.beneficiaireClauses).values({ beneficiaireId: b!.id, clauseId: clause!.id });
    await tx.insert(s.beneficiaireSpecialites).values({ beneficiaireId: b!.id, specialiteId: spec!.id });
    await tx.insert(s.beneficiaireDepartements).values({ beneficiaireId: b!.id, departementId: dep!.id });
    return b!;
  };
  await beneficiaire('demo.beneficiaire@example.test', 'SEED_BENEFICIAIRE_PASSWORD', 'BENEFICIAIRE', true);
  await beneficiaire('demo.discret@example.test', 'SEED_DISCRET_PASSWORD', 'DISCRET', false);

  const [parent] = await tx.insert(s.marches).values({ acheteurId: entite!.id, intitule: 'Restauration du château', clauseId: clause!.id, dateLimiteOffres: `${year + 1}-03-01`, lieuExecution: 'Paris', latitude: 48.85, longitude: 2.35 }).returning();
  await tx.insert(s.marches).values([
    { acheteurId: entite!.id, parentId: parent!.id, intitule: 'Restauration du château', numeroLot: '1', intituleLot: 'Maçonnerie', clauseId: clause!.id, statut: 'en_attente_declaration', titulaireId: repondant!.id },
    { acheteurId: entite!.id, parentId: parent!.id, intitule: 'Restauration du château', numeroLot: '2', intituleLot: 'Peinture', clauseId: clause!.id },
  ]);
  await tx.insert(s.marches).values({ acheteurId: entite!.id, intitule: 'Entretien des vitraux', clauseId: clause!.id, statut: 'clause_validee', titulaireId: repondant!.id, dateFinExecution: `${year + 1}-12-31` });

  const [cat] = await tx.insert(s.faqCategories).values({ titre: 'Démarrer', slug: 'demarrer', publie: true, ordre: 1 }).returning();
  await tx.insert(s.faqQuestions).values({ categorieId: cat!.id, question: 'Comment créer mon profil ?', reponse: '<p>Depuis votre espace.</p>', publie: true, audience: 'public' });
  await tx.insert(s.impacts).values({ libelle: 'Activation des clauses sociales', typeIndicateur: 'utile', indicateur: 'clauses_activees', ordre: 1 });
  await tx.insert(s.parametres).values([{ cle: 'site_titre', valeur: 'Eclauses' }, { cle: 'site_badge_libelle', valeur: 'Bêta' }, { cle: 'mentions_rgpd', valeur: '<p>Mentions de démonstration.</p>' }]).onConflictDoNothing();
  await tx.insert(s.liens).values([{ zone: 'entete', libelle: 'FAQ', url: '/faq', ordre: 1 }, { zone: 'pied', libelle: 'legifrance.gouv.fr', url: 'https://legifrance.gouv.fr', externe: true, ordre: 1 }]);
});
console.log('Données de démonstration créées (comptes demo.*@example.test, mots de passe dans .env.local).');
await pg.end();
