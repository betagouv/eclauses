import { sql } from 'drizzle-orm';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { HttpError } from '../http';
import { JOBS, type JobResult } from '../jobs';
import { auditer } from './audit';

/** Indicateurs du tableau de bord et lancement manuel des tâches d'exploitation. */

const rowsOf = <T>(r: unknown) => r as unknown as T[];

export interface Indicateurs {
  marchesParStatut: { statut: string; n: number }[];
  declarationsAValider: number;
  comptesNonActives: number;
  beneficiaires: { total: number; eligibles: number };
  repondants: number;
  acheteurs: number;
  envois7j: number;
  derniersJournaux: { id: number; email: string; action: string; entite: string; entiteId: string | null; creeLe: string }[];
}

export async function indicateurs(): Promise<Indicateurs> {
  const db = database();
  const one = async (q: ReturnType<typeof sql>) => rowsOf<{ n: number }>(await db.execute(q))[0]!.n;
  const statuts = rowsOf<{ statut: string; n: number }>(await db.execute(sql`select statut::text as statut, count(*)::int as n from marches where parent_id is null group by 1 order by 2 desc`));
  const journaux = rowsOf<{ id: number; email: string; action: string; entite: string; entite_id: string | null; cree_le: Date }>(await db.execute(sql`select id, email, action, entite, entite_id, cree_le from audit_admin order by id desc limit 8`));
  return {
    marchesParStatut: statuts,
    declarationsAValider: await one(sql`select count(*)::int as n from marches where parent_id is null and statut = 'declaration_a_valider'`),
    comptesNonActives: await one(sql`select count(*)::int as n from utilisateurs where mot_de_passe_hash is null`),
    beneficiaires: {
      total: await one(sql`select count(*)::int as n from beneficiaires where anonymise_le is null`),
      eligibles: await one(sql`select count(*)::int as n from beneficiaires where anonymise_le is null and fiche_a_jour`),
    },
    repondants: await one(sql`select count(*)::int as n from repondants where anonymise_le is null`),
    acheteurs: await one(sql`select count(*)::int as n from acheteurs`),
    envois7j: await one(sql`select count(*)::int as n from notifications_envoyees where envoye_le > now() - interval '7 days'`),
    derniersJournaux: journaux.map((j) => ({ id: j.id, email: j.email, action: j.action, entite: j.entite, entiteId: j.entite_id, creeLe: new Date(j.cree_le).toISOString() })),
  };
}

export interface Tache {
  nom: string;
  titre: string;
  description: string;
  /** Envoie des courriers ou efface des données : confirmation renforcée. */
  sensible: boolean;
}

export const TACHES: Tache[] = [
  { nom: 'purge-resets', titre: 'Purger les liens expirés', description: 'Supprime les liens d’activation et de réinitialisation expirés ou déjà utilisés.', sensible: false },
  { nom: 'purge-sessions', titre: 'Purger les sessions expirées', description: 'Efface les sessions terminées et les compteurs de limitation échus.', sensible: false },
  { nom: 'purge-fichiers', titre: 'Purger les fichiers orphelins', description: 'Supprime les CV téléversés il y a plus d’un jour et rattachés à aucun bénéficiaire.', sensible: true },
  { nom: 'archive-marches', titre: 'Archiver les marchés', description: 'Passe en « archivé » les marchés dont la clause est validée depuis assez longtemps.', sensible: false },
  { nom: 'anonymise-beneficiaires', titre: 'Anonymiser les bénéficiaires', description: 'Efface les données personnelles et le compte des bénéficiaires dont la durée de conservation est dépassée.', sensible: true },
  { nom: 'anonymise-repondants', titre: 'Anonymiser les candidats', description: 'Efface les données personnelles des candidats inactifs depuis plus de 5 ans.', sensible: true },
  { nom: 'delete-ineligible-accounts', titre: 'Supprimer les comptes inéligibles', description: 'Supprime les comptes des bénéficiaires qui ne sont plus éligibles.', sensible: true },
  { nom: 'invitations-comptes', titre: 'Inviter les bénéficiaires à activer leur compte', description: 'Envoie un courrier à chaque bénéficiaire dont le compte n’est pas encore activé et qui n’a pas déjà reçu cette invitation.', sensible: true },
];

/** Nombre de courriers que lancerait la tâche d'invitation, sans rien envoyer. */
export async function destinatairesInvitations(): Promise<number> {
  const r = rowsOf<{ n: number }>(
    await database().execute(sql`
      select count(*)::int as n from beneficiaires b join utilisateurs u on u.id = b.utilisateur_id
       where u.mot_de_passe_hash is null
         and not exists (select 1 from notifications_envoyees n where n.evenement = 'invitation-compte' and n.cle = u.id::text)`),
  );
  return r[0]!.n;
}

export async function lancerTache(admin: Session, nom: string): Promise<JobResult> {
  if (!admin.roles.includes('admin')) throw new HttpError(403, 'Accès refusé.');
  const job = JOBS[nom];
  if (!job || !TACHES.some((t) => t.nom === nom)) throw new HttpError(404, 'Tâche inconnue.');
  const res = await job();
  await auditer(admin, 'tache', 'tache', nom, { traites: res.processed });
  return res;
}
