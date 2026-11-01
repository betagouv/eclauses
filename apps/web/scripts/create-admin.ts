/**
 * Crée (ou promeut) un administrateur et affiche le lien d'activation de son compte : la personne choisit elle-même
 * son mot de passe, puis active la double authentification à sa première connexion à /admin.
 *
 *   npx tsx scripts/create-admin.ts prenom.nom@exemple.fr
 *
 * Sans `DATABASE_URL` locale, passer `--allow-remote-target` (production : à faire depuis un poste de confiance).
 */
import { eq } from 'drizzle-orm';
import { database } from '../src/server/db/client';
import { utilisateurs } from '../src/server/db/schema';
import { assurerUtilisateur, creerJeton } from '../src/server/services/comptes';

process.loadEnvFile('.env.local');
const [email] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!email?.includes('@')) {
  console.error('Usage : npx tsx scripts/create-admin.ts adresse@exemple.fr');
  process.exit(1);
}
const local = ['localhost', '127.0.0.1', 'db'].includes(new URL(process.env.DATABASE_URL!).hostname);
if (!local && !process.argv.includes('--allow-remote-target')) {
  console.error('Refus : la base n’est pas locale (--allow-remote-target pour l’accepter).');
  process.exit(1);
}
const { id } = await assurerUtilisateur(email);
await database().update(utilisateurs).set({ estAdmin: true }).where(eq(utilisateurs.id, id));
const { url } = await creerJeton(id, 'activation');
console.log(`Administrateur : ${email.trim().toLowerCase()}\nLien d'activation (valable 30 jours, usage unique) :\n${url}`);
process.exit(0);
