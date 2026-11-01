import { database } from '@/server/db/client';
import * as s from '@/server/db/schema';

/** Jeu de données minimal d'un marché, de son acheteur, de sa clause et de ses bénéficiaires actifs. */
export async function seedBase() {
  const db = database();
  const [acheteur] = await db.insert(s.acheteurs).values({ nom: 'DRAC Test', categorie: 'services_deconcentres' }).returning();
  const [userAcheteur] = await db.insert(s.utilisateurs).values({ email: 'acheteur@culture.test' }).returning();
  const [ua] = await db.insert(s.utilisateursAcheteurs).values({ utilisateurId: userAcheteur!.id, acheteurId: acheteur!.id, nom: 'Martin', prenom: 'Camille' }).returning();
  const [clause] = await db.insert(s.clausesSociales).values({ nom: 'Insertion des restaurateurs' }).returning();

  const benef = async (email: string, over: Partial<typeof s.beneficiaires.$inferInsert> = {}) => {
    const [u] = await db.insert(s.utilisateurs).values({ email }).returning();
    const [b] = await db
      .insert(s.beneficiaires)
      .values({ nom: email.split('@')[0]!, utilisateurId: u!.id, anneeDiplome: new Date().getFullYear() - 1, ficheAJour: true, ...over })
      .returning();
    await db.insert(s.beneficiaireClauses).values({ beneficiaireId: b!.id, clauseId: clause!.id });
    return { user: u!, benef: b! };
  };
  const a = await benef('a@benef.test');
  const b = await benef('b@benef.test');
  // Fiche non à jour : ne reçoit pas les notifications de publication.
  await benef('c@benef.test', { ficheAJour: false });

  const [titulaireUser] = await db.insert(s.utilisateurs).values({ email: 'titulaire@societe.test', motDePasseHash: 'x' }).returning();
  const [titulaire] = await db.insert(s.repondants).values({ utilisateurId: titulaireUser!.id, nom: 'Z', raisonSociale: 'Entreprise Z' }).returning();

  const [parent] = await db.insert(s.marches).values({ acheteurId: acheteur!.id, intitule: 'Rénovation du musée', clauseId: clause!.id, dateLimiteOffres: '2027-03-01' }).returning();
  return { db, acheteur: acheteur!, userAcheteur: userAcheteur!, ua: ua!, clause: clause!, a, b, titulaire: titulaire!, titulaireUser: titulaireUser!, parent: parent!, benef };
}
