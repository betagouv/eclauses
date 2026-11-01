/**
 * Ouvre une session pour un compte de la base LOCALE et affiche le jeton (à passer en cookie
 * `eclauses_session`) : permet de tester des pages sans connaître le mot de passe. Refuse toute base
 * non locale. Usage : npx tsx scripts/dev-session.ts <beneficiaire|acheteur|repondant> [indice] [--login]
 * Avec `--login`, fixe un mot de passe local aléatoire au compte et affiche « e-mail mot-de-passe » pour se
 * connecter par le formulaire (navigateur piloté, par exemple) au lieu d'afficher un jeton.
 */
import { randomBytes } from 'node:crypto';
import { eq, isNotNull } from 'drizzle-orm';
import { hashPassword } from '../src/server/auth/password';
import { createSession } from '../src/server/auth/session';
import { database } from '../src/server/db/client';
import { beneficiaires, repondants, utilisateurs, utilisateursAcheteurs } from '../src/server/db/schema';

process.loadEnvFile('.env.local');
if (!['localhost', '127.0.0.1', 'db'].includes(new URL(process.env.DATABASE_URL!).hostname)) {
  console.error('Refus : base non locale.');
  process.exit(1);
}
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [role = 'beneficiaire', index = '0'] = argv;
const db = database();
const pick = {
  beneficiaire: () => db.select({ u: beneficiaires.utilisateurId }).from(beneficiaires).where(isNotNull(beneficiaires.utilisateurId)),
  acheteur: () => db.select({ u: utilisateursAcheteurs.utilisateurId }).from(utilisateursAcheteurs),
  repondant: () => db.select({ u: repondants.utilisateurId }).from(repondants).where(isNotNull(repondants.utilisateurId)),
}[role as 'beneficiaire'];
if (!pick) {
  console.error('Rôle inconnu.');
  process.exit(1);
}
const rows = await pick();
const row = rows[Number(index)];
if (!row?.u) {
  console.error('Aucun compte.');
  process.exit(1);
}
if (process.argv.includes('--login')) {
  const password = randomBytes(9).toString('base64url');
  const [u] = await db.update(utilisateurs).set({ motDePasseHash: await hashPassword(password), motDePasseModifieLe: new Date() }).where(eq(utilisateurs.id, row.u)).returning({ email: utilisateurs.email });
  console.log(`${u!.email} ${password}`);
} else {
  console.log(await createSession(row.u));
}
process.exit(0);
