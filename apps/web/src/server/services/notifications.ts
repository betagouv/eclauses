import { and, eq, inArray, sql } from 'drizzle-orm';
import * as compat from '../compat/others';
import { marches, EVENT_PUBLIE } from '../compat/marches';
import * as specs from '../compat/specs';
import { database } from '../db/client';
import { beneficiaireADetruire, beneficiaireEligible } from '../db/expr';
import { beneficiaireClauses, beneficiaires, invitationsTitulaires, marches as marchesTable, repondants, utilisateurs } from '../db/schema';
import { describeMarche, loadMarcheInfo } from '../mail/describe';
import * as t from '../mail/templates';
import { sendMail } from '../mail/transport';
import { assurerUtilisateur, creerJeton, utilisateurParEmail } from './comptes';
import { liberer, reserver } from './envois';

/**
 * Courriers déclenchés par les opérations métier. Ils remplacent les webhooks Grist et les flux n8n :
 * chaque écriture qui peut déclencher un courrier appelle la fonction correspondante, qui relit
 * l'état en base et n'envoie qu'une fois grâce à `envois`. Une erreur d'envoi est journalisée et ne fait
 * pas échouer l'opération métier qui l'a provoquée.
 */
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const frDate = (v: unknown): string | null =>
  typeof v === 'number' && v > 0 ? new Date(v * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : null;

async function send(to: string, rendered: { subject: string; html: string }) {
  await sendMail({ to, ...rendered });
}

/** Exécute un envoi sans jamais propager l'erreur à l'appelant. */
export async function sansEchec(nom: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[notification] ${nom} :`, e instanceof Error ? e.message : e);
  }
}

const emailsUtilisateursAcheteurs = async (ids: number[]) =>
  (await specs.utilisateursAcheteurs.read({ ids })).map((u) => ({ email: text(u.Email), nom: [text(u.Prenom), text(u.Nom)].filter(Boolean).join(' ') })).filter((u) => u.email);

/* ------------------------------------------------------------------ Marchés ------------- */

/**
 * Destinataires d'une publication : les bénéficiaires rattachés à l'une des clauses du marché (celle du
 * marché et celles de ses lots), comme `Beneficiaires_actifs_publication` en production, avec une
 * adresse e-mail et encore dans leur durée de conservation (éligibles, non à supprimer).
 */
export async function destinatairesPublication(clauseIds: number[]): Promise<string[]> {
  if (!clauseIds.length) return [];
  const rows = await database()
    .selectDistinct({ email: utilisateurs.email })
    .from(beneficiaireClauses)
    .innerJoin(beneficiaires, eq(beneficiaires.id, beneficiaireClauses.beneficiaireId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, beneficiaires.utilisateurId))
    .where(and(inArray(beneficiaireClauses.clauseId, clauseIds), beneficiaireEligible, sql`not ${beneficiaireADetruire}`));
  return rows.map((r) => r.email).filter((e) => e.includes('@'));
}

/** Publication d'un marché parent : prévenir les bénéficiaires des clauses concernées. */
async function marchePublie(id: number) {
  const row = await marches.byId(id);
  if (!row || row.Doit_Notifier_Publication !== true) return;
  const clauseIds = [...new Set([Number(row.Clauses_sociales), ...(row.Clauses_sociales_lots as number[])].filter(Boolean))];
  if (!clauseIds.length) return;
  if (!(await reserver(EVENT_PUBLIE, id))) return;

  const clauseId = Number(row.Clauses_sociales_parent_ou_enfants) || clauseIds[0]!;
  const [clause] = await specs.clauses.read({ ids: [clauseId] });
  const recipients = await destinatairesPublication(clauseIds);
  const alloti = Number(row.Nb_lots) > 0;
  const lots = alloti
    ? ((row.Lots_Detail as Record<string, unknown>[]) ?? []).map((l) => ({
        label: text(l.Lot_Label) || text(l.Intitule_propre) || `Lot ${l.Numero_de_lot ?? ''}`.trim(),
        clause: text(l.Clauses_sociales_Label),
      }))
    : [];
  const rendered = t.marchePublie({ info: describeMarche(row), alloti, deadline: frDate(row.Date_Limite_de_Remise_des_Offres), lots, clause: text(clause?.Nom_de_la_clause) || null });
  for (const to of recipients) await send(to, rendered);
}

/** Déclaration soumise : prévenir les utilisateurs de l'entité acheteuse. */
async function marcheAValider(id: number) {
  const row = await marches.byId(id);
  if (!row) return;
  if (row.A_valider !== true) return liberer('marche-a-valider', id);
  if (!(await reserver('marche-a-valider', id))) return;
  const info = describeMarche(row);
  for (const u of await emailsUtilisateursAcheteurs(row.Acheteur_Utilisateurs_Acheteurs as number[])) await send(u.email, t.declarationAValider(info, u.nom));
}

/** Clause validée : prévenir le titulaire et les utilisateurs de l'entité acheteuse. */
async function marcheValidee(id: number) {
  const row = await marches.byId(id);
  if (!row) return;
  if (row.Clause_validee !== true) return liberer('marche-validee', id);
  if (!(await reserver('marche-validee', id))) return;
  const info = describeMarche(row);
  const titulaireId = Number(row.Titulaire);
  if (titulaireId) {
    const [titulaire] = await specs.repondants.read({ ids: [titulaireId] });
    if (text(titulaire?.Email)) await send(text(titulaire!.Email), t.clauseActiveeTitulaire(info));
  }
  for (const u of await emailsUtilisateursAcheteurs(row.Acheteur_Utilisateurs_Acheteurs as number[])) await send(u.email, t.clauseActiveeAcheteur(info));
}

/** À appeler après toute création ou modification d'un marché. */
export const marcheModifie = (id: number) =>
  sansEchec(`marché ${id}`, async () => {
    await marchePublie(id);
    await marcheAValider(id);
    await marcheValidee(id);
  });

/* ------------------------------------------------------------------ Déclarations -------- */

/* Un bénéficiaire déclaré ne reçoit aucun courrier : seuls le titulaire (refus) et l'acheteur sont prévenus. */

export const refusCree = (id: number) =>
  sansEchec(`refus ${id}`, async () => {
    const [row] = await compat.refus.read({ ids: [id] });
    const info = row ? await loadMarcheInfo(Number(row.Marche)) : null;
    const to = text(row?.Marche_Titulaire_Email);
    if (info && to) await send(to, t.declarationRefusee(info, text(row!.Raison)));
  });

export const accesCoordonneesCree = (id: number) =>
  sansEchec(`accès ${id}`, async () => {
    const [row] = await compat.accesCoordonnees.read({ ids: [id] });
    const to = text(row?.Beneficiaire__Courriel);
    if (!row || !to) return;
    const title = text(row.Marche_Intitule_propre) || (await loadMarcheInfo(Number(row.Marche)))?.marcheTitle || 'Marché';
    await send(to, t.consultationCoordonnees(title));
  });

/* ------------------------------------------------------------------ Comptes ------------- */

/** Un acheteur désigne un titulaire : le compte est créé si besoin, rattaché au marché, et prévenu. */
export const invitationCreee = (id: number) =>
  sansEchec(`invitation ${id}`, async () => {
    const [inv] = await compat.invitations.read({ ids: [id] });
    const email = text(inv?.Email).toLowerCase();
    const marcheId = Number(inv?.Marche);
    const info = marcheId ? await loadMarcheInfo(marcheId) : null;
    if (!email || !info) return;
    if (!(await reserver('invitation-titulaire', id))) return;

    const db = database();
    const { id: userId } = await assurerUtilisateur(email);
    let [repondant] = await db.select({ id: repondants.id }).from(repondants).where(eq(repondants.utilisateurId, userId));
    if (!repondant) [repondant] = await db.insert(repondants).values({ utilisateurId: userId }).returning({ id: repondants.id });
    await db.update(marchesTable).set({ titulaireId: repondant!.id }).where(eq(marchesTable.id, marcheId));
    await db.update(invitationsTitulaires).set({ repondantId: repondant!.id }).where(eq(invitationsTitulaires.id, id));

    const user = await utilisateurParEmail(email);
    if (user?.motDePasseHash) return send(email, t.titulaireInvitation(info, null));
    const { url } = await creerJeton(userId, 'activation');
    await send(email, t.titulaireInvitation(info, url));
  });

/** Inscription d'un candidat : lui envoyer le lien pour créer son mot de passe. */
export const candidatInscrit = (repondantId: number) =>
  sansEchec(`candidat ${repondantId}`, async () => {
    const [row] = await specs.repondants.read({ ids: [repondantId] });
    const email = text(row?.Email).toLowerCase();
    // Un titulaire créé par une invitation reçoit déjà son propre courrier.
    if (!row || !email || (row.Titulaire_aux_marches as number[]).length) return;
    const user = await utilisateurParEmail(email);
    if (!user || user.motDePasseHash) return;
    if (!(await reserver('inscription-candidat', repondantId))) return;
    const { url } = await creerJeton(user.id, 'activation');
    await send(email, t.finalizeInscription(url));
  });

/** Mot de passe oublié : lien envoyé seulement si un compte existe, sans rien révéler à l'appelant. */
export const motDePasseOublie = (email: string) =>
  sansEchec('mot de passe oublié', async () => {
    const user = await utilisateurParEmail(email);
    if (!user) return;
    const { url } = await creerJeton(user.id, 'reinitialisation');
    await send(user.email, t.resetPassword(url));
  });

/**
 * Invitations à créer son espace pour les bénéficiaires dont le compte n'est pas encore activé
 * (déclenchée par l'équipe via la tâche `invitations-comptes`). Retourne le nombre de courriers.
 */
export async function inviterBeneficiaires(): Promise<number> {
  const rows = await database()
    .select({ userId: utilisateurs.id, email: utilisateurs.email, nom: beneficiaires.nom, prenom: beneficiaires.prenom })
    .from(beneficiaires)
    .innerJoin(utilisateurs, eq(utilisateurs.id, beneficiaires.utilisateurId));
  let sent = 0;
  for (const r of rows) {
    const user = await utilisateurParEmail(r.email);
    if (!user || user.motDePasseHash) continue;
    if (!(await reserver('invitation-compte', r.userId))) continue;
    try {
      const { url } = await creerJeton(r.userId, 'activation');
      await send(r.email, t.accountInvitation([text(r.prenom), text(r.nom)].filter(Boolean).join(' '), url));
      sent++;
    } catch (e) {
      await liberer('invitation-compte', r.userId);
      console.error('[invitations-comptes]', e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
