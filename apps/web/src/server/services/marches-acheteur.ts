import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { declarationsBeneficiaires, declarationsRefus, invitationsTitulaires, marches, marcheSpecialites } from '../db/schema';
import { HttpError } from '../http';
import { loadMarcheInfo } from '../mail/describe';
import { titulaireRelance } from '../mail/templates';
import { sendMail } from '../mail/transport';
import { creerJeton, utilisateurParEmail } from './comptes';
import { invitationCreee, marcheModifie, refusCree } from './notifications';

/**
 * Opérations d'un acheteur sur ses marchés. Elles regroupent des enchaînements que les anciennes pages
 * faisaient en plusieurs appels depuis le navigateur (créer un marché puis ses lots, inviter puis
 * changer les statuts…) : chacune s'exécute ici, en une transaction, après contrôle du rôle et de la
 * propriété du marché, et déclenche les courriers correspondants une fois les données enregistrées.
 */

type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

const fail = (status: number, message: string) => new HttpError(status, message);

function entiteDe(s: Session): number {
  if (!s.roles.includes('acheteur') || !s.acheteurEntiteId) throw fail(403, 'Accès refusé.');
  return s.acheteurEntiteId;
}

/** Le marché appartient-il à l'entité de l'acheteur ? Renvoie la ligne, sinon 403 (sans révéler l'existence). */
async function marchePropre(db: Pick<Tx, 'select'>, s: Session, id: number) {
  const entite = entiteDe(s);
  const [m] = await db.select().from(marches).where(eq(marches.id, id));
  if (!m || m.acheteurId !== entite) throw fail(403, 'Ce marché ne relève pas de votre entité.');
  return m;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');
const id = z.number().int().positive();
const text = (max = 500) => z.string().trim().min(1, 'Champ requis.').max(max);

const lotSchema = z.object({
  numero: text(50),
  intitule: text(),
  clauseId: id,
  specialiteIds: z.array(id).min(1, 'Champ requis.').max(50),
  lieu: text(),
});

const baseSchema = z.object({
  intitule: text(),
  datePublication: day.nullish(),
  dateLimiteOffres: day,
  dateNotificationPrevisionnelle: day,
  // Marché simple : clause, spécialités et lieu portés par le marché. Marché alloti : portés par chaque lot.
  clauseId: id.nullish(),
  specialiteIds: z.array(id).max(50).nullish(),
  lieu: z.string().trim().max(500).nullish(),
});

const todayStr = () => new Date().toISOString().slice(0, 10);

function checkMarche(input: z.infer<typeof baseSchema>, lots: z.infer<typeof lotSchema>[]) {
  if (input.dateLimiteOffres < todayStr()) throw fail(400, 'La date limite de remise des offres ne peut pas être antérieure au jour J.');
  if (lots.length) {
    const numeros = lots.map((l) => l.numero.toLowerCase());
    if (new Set(numeros).size !== numeros.length) throw fail(400, 'Deux lots portent le même numéro.');
  } else if (!input.clauseId || !input.specialiteIds?.length || !input.lieu) {
    throw fail(400, 'La clause, les spécialités et le lieu d’exécution sont requis.');
  }
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw fail(400, r.error.issues[0]?.message ?? 'Données invalides.');
  return r.data;
}

async function setSpecialites(tx: Pick<Tx, 'delete' | 'insert'>, marcheId: number, ids: number[] | null | undefined) {
  await tx.delete(marcheSpecialites).where(eq(marcheSpecialites.marcheId, marcheId));
  if (ids?.length) await tx.insert(marcheSpecialites).values([...new Set(ids)].map((specialiteId) => ({ marcheId, specialiteId })));
}

export const declarationSchema = baseSchema.extend({ lots: z.array(lotSchema).max(100).default([]) });

/* ------------------------------------------------------------------ Déclarer / modifier ---- */


/**
 * Crée un marché (et ses lots) « en attente de publication ». `autonomie` vaut vrai quand l'acheteur le crée depuis le
 * site, faux quand l'équipe le crée depuis l'administration (statistique « création en autonomie »).
 */
export async function creerMarche(entite: number, utilisateurId: number | null, autonomie: boolean, data: z.infer<typeof declarationSchema>): Promise<{ id: number }> {
  checkMarche(data, data.lots);
  const parentId = await database().transaction(async (tx) => {
    const common = { acheteurId: entite, datePublication: data.datePublication ?? null, dateLimiteOffres: data.dateLimiteOffres, dateNotificationPrevisionnelle: data.dateNotificationPrevisionnelle, statut: 'en_attente_publication' as const, creationEnAutonomie: autonomie, creeParUtilisateurId: utilisateurId };
    const [parent] = await tx
      .insert(marches)
      .values({ ...common, intitule: data.intitule, clauseId: data.lots.length ? null : data.clauseId!, lieuExecution: data.lots.length ? null : data.lieu! })
      .returning({ id: marches.id });
    if (!data.lots.length) await setSpecialites(tx, parent!.id, data.specialiteIds);
    for (const lot of data.lots) {
      const [l] = await tx
        .insert(marches)
        .values({ ...common, parentId: parent!.id, intitule: data.intitule, numeroLot: lot.numero, intituleLot: lot.intitule, clauseId: lot.clauseId, lieuExecution: lot.lieu })
        .returning({ id: marches.id });
      await setSpecialites(tx, l!.id, lot.specialiteIds);
    }
    return parent!.id;
  });
  await marcheModifie(parentId);
  return { id: parentId };
}

/** Déclare un marché (et ses lots) pour l'entité de l'acheteur connecté. */
export async function declarerMarche(s: Session, input: unknown): Promise<{ id: number }> {
  const entite = entiteDe(s);
  const data = parse(declarationSchema, input);
  const utilisateur = await utilisateurParEmail(s.email);
  return creerMarche(entite, utilisateur?.id ?? null, true, data);
}

/** Création par l'équipe, pour l'entité de son choix : l'indicateur d'autonomie est faux. */
export async function declarerMarchePourEntite(admin: Session, entiteId: number, input: unknown): Promise<{ id: number }> {
  if (!admin.roles.includes('admin')) throw fail(403, 'Accès refusé.');
  const data = parse(declarationSchema, input);
  const utilisateur = await utilisateurParEmail(admin.email);
  return creerMarche(entiteId, utilisateur?.id ?? null, false, data);
}

export const modificationSchema = baseSchema.extend({
  lots: z.array(lotSchema.extend({ id: id.nullish() })).max(100).default([]),
  lotsSupprimes: z.array(id).max(100).default([]),
});

/** Modifie un marché : champs communs, ajout, mise à jour et suppression de ses lots. */
export async function modifierMarche(s: Session, marcheId: number, input: unknown): Promise<void> {
  const data = parse(modificationSchema, input);
  checkMarche(data, data.lots);
  await database().transaction(async (tx) => {
    const m = await marchePropre(tx, s, marcheId);
    if (m.parentId) throw fail(400, 'Modifiez le marché parent, pas un lot.');
    const children = await tx.select({ id: marches.id, statut: marches.statut }).from(marches).where(eq(marches.parentId, marcheId));
    const childIds = new Set(children.map((c) => c.id));
    const statutDe = new Map(children.map((c) => [c.id, c.statut]));

    const dates = { datePublication: data.datePublication ?? null, dateLimiteOffres: data.dateLimiteOffres, dateNotificationPrevisionnelle: data.dateNotificationPrevisionnelle };
    const allotti = data.lots.length > 0;
    await tx
      .update(marches)
      .set({ ...dates, intitule: data.intitule, clauseId: allotti ? null : data.clauseId!, lieuExecution: allotti ? null : data.lieu!, modifieLe: new Date() })
      .where(eq(marches.id, marcheId));
    await setSpecialites(tx, marcheId, allotti ? null : data.specialiteIds);

    for (const lotId of data.lotsSupprimes) {
      if (!childIds.has(lotId)) throw fail(403, 'Ce lot ne relève pas de ce marché.');
      await tx.delete(marches).where(eq(marches.id, lotId));
    }
    for (const lot of data.lots) {
      const values = { ...dates, acheteurId: m.acheteurId, parentId: marcheId, intitule: data.intitule, numeroLot: lot.numero, intituleLot: lot.intitule, clauseId: lot.clauseId, lieuExecution: lot.lieu };
      if (lot.id) {
        if (!childIds.has(lot.id)) throw fail(403, 'Ce lot ne relève pas de ce marché.');
        await tx.update(marches).set({ ...values, statut: statutDe.get(lot.id) ?? 'en_attente_publication', modifieLe: new Date() }).where(eq(marches.id, lot.id));
        await setSpecialites(tx, lot.id, lot.specialiteIds);
      } else {
        const [created] = await tx.insert(marches).values({ ...values, statut: 'en_attente_publication', creationEnAutonomie: m.creationEnAutonomie }).returning({ id: marches.id });
        await setSpecialites(tx, created!.id, lot.specialiteIds);
      }
    }
  });
}

/** Supprime un marché et ses lots (leurs invitations et déclarations partent avec eux). */
export async function supprimerMarche(s: Session, marcheId: number): Promise<void> {
  await database().transaction(async (tx) => {
    await marchePropre(tx, s, marcheId);
    await tx.delete(marches).where(eq(marches.parentId, marcheId));
    await tx.delete(marches).where(eq(marches.id, marcheId));
  });
}

/* ------------------------------------------------------------------ Publication ----------- */

const publicationSchema = z.object({ datePublication: day, lien: z.string().trim().min(1, 'Le lien vers les documents de consultation est requis.').max(2000) });

/** Déclare la publication : le marché et ses lots passent « en attente de notification », ce qui prévient les bénéficiaires. */
export async function publierMarche(s: Session, marcheId: number, input: unknown): Promise<void> {
  const data = parse(publicationSchema, input);
  const lien = /^https?:\/\//i.test(data.lien) ? data.lien : `https://${data.lien}`;
  await database().transaction(async (tx) => {
    await marchePropre(tx, s, marcheId);
    await tx
      .update(marches)
      .set({ datePublication: data.datePublication, lienDocuments: lien, statut: 'en_attente_notification', modifieLe: new Date() })
      .where(sql`${marches.id} = ${marcheId} or ${marches.parentId} = ${marcheId}`);
  });
  await marcheModifie(marcheId);
}

/* ------------------------------------------------------------------ Titulaire ------------- */

const invitationSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320), dateFinExecution: day.nullish() });

/** Déclare le titulaire d'un marché ou d'un lot : invitation par courrier, puis statuts du lot et du marché parent. */
export async function inviterTitulaire(s: Session, marcheId: number, input: unknown): Promise<void> {
  const data = parse(invitationSchema, input);
  const { invitationId, parentId } = await database().transaction(async (tx) => {
    const m = await marchePropre(tx, s, marcheId);
    const [inv] = await tx.insert(invitationsTitulaires).values({ marcheId, email: data.email }).returning({ id: invitationsTitulaires.id });
    await tx.update(marches).set({ statut: 'en_attente_declaration', dateFinExecution: data.dateFinExecution ?? null, modifieLe: new Date() }).where(eq(marches.id, marcheId));
    if (m.parentId) {
      const lots = await tx.select({ id: marches.id }).from(marches).where(eq(marches.parentId, m.parentId));
      const invited = new Set((await tx.select({ marcheId: invitationsTitulaires.marcheId }).from(invitationsTitulaires).where(inArray(invitationsTitulaires.marcheId, lots.map((l) => l.id)))).map((r) => r.marcheId));
      const allInvited = lots.length > 0 && lots.every((l) => invited.has(l.id));
      const [parent] = await tx.select({ statut: marches.statut }).from(marches).where(eq(marches.id, m.parentId));
      if (allInvited) await tx.update(marches).set({ statut: 'en_attente_declaration', modifieLe: new Date() }).where(eq(marches.id, m.parentId));
      else if (parent?.statut === 'en_attente_declaration') await tx.update(marches).set({ statut: 'en_attente_notification', modifieLe: new Date() }).where(eq(marches.id, m.parentId));
    }
    return { invitationId: inv!.id, parentId: m.parentId };
  });
  await invitationCreee(invitationId);
  await marcheModifie(marcheId);
  // Le statut du parent a pu changer : il peut alors être à notifier (ou à notifier de nouveau).
  if (parentId) await marcheModifie(parentId);
}

/** Relance du titulaire : un courrier, au plus une fois par délai (`RELANCE_TITULAIRE_DELAY_DAYS`, 7 jours par défaut). */
export async function relancerTitulaire(s: Session, marcheId: number): Promise<void> {
  const db = database();
  await marchePropre(db, s, marcheId);
  const [invitation] = await db.select().from(invitationsTitulaires).where(eq(invitationsTitulaires.marcheId, marcheId)).orderBy(asc(invitationsTitulaires.id)).limit(1);
  if (!invitation) throw fail(404, 'Aucun titulaire déclaré pour ce marché.');
  const delai = Number(process.env.RELANCE_TITULAIRE_DELAY_DAYS ?? 7) * 86_400_000;
  const derniere = invitation.derniereRelanceLe?.getTime() ?? 0;
  if (Date.now() - derniere < delai) throw fail(429, 'Une relance a déjà été envoyée récemment.');
  const info = await loadMarcheInfo(marcheId);
  if (!info) throw fail(404, 'Marché introuvable.');

  const user = await utilisateurParEmail(invitation.email);
  let url: string | null = null;
  if (!user?.motDePasseHash) {
    if (!user) throw fail(404, 'Compte du titulaire introuvable.');
    url = (await creerJeton(user.id, 'activation')).url;
  }
  await sendMail({ to: invitation.email, ...titulaireRelance(info, url) });
  await db.update(invitationsTitulaires).set({ derniereRelanceLe: new Date() }).where(eq(invitationsTitulaires.marcheId, marcheId));
}

/* ------------------------------------------------------------------ Déclarations ---------- */

/** Parent à mettre à jour avec ses lots : renvoie son identifiant si tous les autres lots sont déjà dans `statut`. */
async function parentSiTousLots(tx: Pick<Tx, 'select'>, m: { id: number; parentId: number | null }, statut: 'clause_validee') {
  if (!m.parentId) return null;
  const autres = await tx.select({ statut: marches.statut }).from(marches).where(and(eq(marches.parentId, m.parentId), ne(marches.id, m.id)));
  return autres.every((l) => l.statut === statut) ? m.parentId : null;
}

/** Valide la déclaration des bénéficiaires : le lot ou marché passe « clause validée », le parent aussi si tous ses lots le sont. */
export async function validerDeclaration(s: Session, marcheId: number): Promise<void> {
  const { declarations, parentId } = await database().transaction(async (tx) => {
    const m = await marchePropre(tx, s, marcheId);
    if (m.statut !== 'declaration_a_valider') throw fail(409, 'Aucune déclaration à valider pour ce marché.');
    const declarations = await tx.select({ id: declarationsBeneficiaires.id }).from(declarationsBeneficiaires).where(eq(declarationsBeneficiaires.marcheId, marcheId));
    if (!declarations.length) throw fail(409, 'Aucune déclaration à valider pour ce marché.');
    await tx.update(declarationsBeneficiaires).set({ statut: 'valide' }).where(eq(declarationsBeneficiaires.marcheId, marcheId));
    await tx.update(marches).set({ statut: 'clause_validee', modifieLe: new Date() }).where(eq(marches.id, marcheId));
    const parentId = await parentSiTousLots(tx, m, 'clause_validee');
    if (parentId) await tx.update(marches).set({ statut: 'clause_validee', modifieLe: new Date() }).where(eq(marches.id, parentId));
    return { declarations, parentId };
  });
  await marcheModifie(marcheId);
  if (parentId) await marcheModifie(parentId);
}

const refusSchema = z.object({ raison: z.string().trim().min(1, 'Le motif de refus est obligatoire.').max(2000) });

/** Refuse la déclaration : motif enregistré, déclarations remises en brouillon, le titulaire peut corriger. */
export async function refuserDeclaration(s: Session, marcheId: number, input: unknown): Promise<void> {
  const data = parse(refusSchema, input);
  const utilisateur = await utilisateurParEmail(s.email);
  const refusId = await database().transaction(async (tx) => {
    const m = await marchePropre(tx, s, marcheId);
    if (m.statut !== 'declaration_a_valider') throw fail(409, 'Aucune déclaration à refuser pour ce marché.');
    const declarations = await tx.select({ id: declarationsBeneficiaires.id }).from(declarationsBeneficiaires).where(eq(declarationsBeneficiaires.marcheId, marcheId));
    if (!declarations.length) throw fail(409, 'Aucune déclaration à refuser.');
    const [refus] = await tx.insert(declarationsRefus).values({ marcheId, raison: data.raison, refuseParUtilisateurId: utilisateur?.id ?? null }).returning({ id: declarationsRefus.id });
    await tx.update(declarationsBeneficiaires).set({ statut: 'brouillon' }).where(eq(declarationsBeneficiaires.marcheId, marcheId));
    await tx.update(marches).set({ statut: 'en_attente_declaration', modifieLe: new Date() }).where(eq(marches.id, marcheId));
    return refus!.id;
  });
  await refusCree(refusId);
  await marcheModifie(marcheId);
}
