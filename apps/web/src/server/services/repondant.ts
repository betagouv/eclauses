import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { beneficiaireADetruire, beneficiaireEligible } from '../db/expr';
import { accesCoordonnees, beneficiaireClauses, beneficiaires, candidatures, declarationsBeneficiaires, marches, utilisateurs } from '../db/schema';
import { HttpError } from '../http';
import { accesCoordonneesCree, declarationModifiee, marcheModifie } from './notifications';

/**
 * Opérations d'un répondant (candidat ou titulaire). Comme pour l'acheteur, chaque enchaînement s'exécute en une
 * transaction après contrôle du rôle et du lien avec le marché ; les courriers partent une fois les données écrites.
 */

type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];
const fail = (status: number, message: string) => new HttpError(status, message);

function repondantDe(s: Session): number {
  if (!s.roles.includes('repondant') || !s.repondantId) throw fail(403, 'Accès refusé.');
  return s.repondantId;
}

/** Marché dont ce répondant est le titulaire, sinon 403. */
async function marcheDuTitulaire(db: Pick<Tx, 'select'>, s: Session, marcheId: number) {
  const rep = repondantDe(s);
  const [m] = await db.select().from(marches).where(eq(marches.id, marcheId));
  if (!m || m.titulaireId !== rep) throw fail(403, 'Vous n’êtes pas titulaire de ce marché.');
  return m;
}

/* ------------------------------------------------------------------ Déclarer ---------------- */

const personne = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis.').max(200),
  prenom: z.string().trim().min(1, 'Le prénom est requis.').max(200),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(320),
});
const declaration = z.object({
  eclauses: z.array(z.number().int().positive()).max(200).default([]),
  manuels: z.array(personne).max(200).default([]),
});

/**
 * Soumet la déclaration des bénéficiaires d'un marché ou d'un lot : brouillons repris, bénéficiaires Eclauses (doivent
 * relever de la clause du marché) et personnes saisies à la main ajoutés, puis le marché passe « à valider » et l'acheteur est prévenu.
 */
export async function declarerBeneficiaires(s: Session, marcheId: number, input: unknown): Promise<void> {
  const parsed = declaration.safeParse(input);
  if (!parsed.success) throw fail(400, parsed.error.issues[0]?.message ?? 'Données invalides.');
  const data = parsed.data;
  const rep = repondantDe(s);

  const created = await database().transaction(async (tx) => {
    const m = await marcheDuTitulaire(tx, s, marcheId);
    if (m.statut !== 'en_attente_declaration') throw fail(409, 'Ce marché n’attend pas de déclaration de bénéficiaires.');

    const mine = await tx.select().from(declarationsBeneficiaires).where(and(eq(declarationsBeneficiaires.marcheId, marcheId), eq(declarationsBeneficiaires.repondantId, rep)));
    const drafts = mine.filter((d) => d.statut === 'brouillon');
    const alreadyDeclared = new Set(mine.map((d) => d.beneficiaireId).filter((x): x is number => !!x));
    const toAdd = [...new Set(data.eclauses)].filter((id) => !alreadyDeclared.has(id));

    if (toAdd.length) {
      if (!m.clauseId) throw fail(400, 'Ce marché n’a pas de clause sociale : aucun bénéficiaire Eclauses ne peut être déclaré.');
      const valid = await tx
        .select({ id: beneficiaireClauses.beneficiaireId })
        .from(beneficiaireClauses)
        .where(and(eq(beneficiaireClauses.clauseId, m.clauseId), inArray(beneficiaireClauses.beneficiaireId, toAdd)));
      if (valid.length !== toAdd.length) throw fail(400, 'Un des bénéficiaires choisis ne relève pas de la clause de ce marché.');
    }
    if (!drafts.length && !toAdd.length && !data.manuels.length) throw fail(400, 'Ajoutez au moins un bénéficiaire.');

    if (drafts.length) await tx.update(declarationsBeneficiaires).set({ statut: 'declare' }).where(inArray(declarationsBeneficiaires.id, drafts.map((d) => d.id)));
    const rows = [
      ...toAdd.map((beneficiaireId) => ({ repondantId: rep, marcheId, estBeneficiaireEclauses: true, beneficiaireId, statut: 'declare' as const })),
      ...data.manuels.map((p) => ({ repondantId: rep, marcheId, estBeneficiaireEclauses: false, nom: p.nom, prenom: p.prenom, email: p.email, statut: 'declare' as const })),
    ];
    const inserted = rows.length ? await tx.insert(declarationsBeneficiaires).values(rows).returning({ id: declarationsBeneficiaires.id }) : [];
    await tx.update(marches).set({ statut: 'declaration_a_valider', modifieLe: new Date() }).where(eq(marches.id, marcheId));
    return [...drafts.map((d) => d.id), ...inserted.map((i) => i.id)];
  });
  for (const id of created) await declarationModifiee(id);
  await marcheModifie(marcheId);
}

/** Retire une déclaration non validée, tant que le marché attend encore la déclaration. */
export async function retirerDeclaration(s: Session, declarationId: number): Promise<void> {
  const rep = repondantDe(s);
  await database().transaction(async (tx) => {
    const [d] = await tx.select().from(declarationsBeneficiaires).where(eq(declarationsBeneficiaires.id, declarationId));
    if (!d || d.repondantId !== rep) throw fail(403, 'Accès refusé.');
    if (d.statut === 'valide') throw fail(409, 'Une déclaration validée ne peut plus être retirée.');
    const [m] = await tx.select({ statut: marches.statut }).from(marches).where(eq(marches.id, d.marcheId));
    if (m?.statut !== 'en_attente_declaration') throw fail(409, 'Le marché n’attend plus de déclaration : elle ne peut plus être modifiée.');
    await tx.delete(declarationsBeneficiaires).where(eq(declarationsBeneficiaires.id, declarationId));
  });
}

/* ------------------------------------------------------------------ Coordonnées ------------- */

/**
 * Consultation des coordonnées d'un bénéficiaire pour un marché auquel le répondant candidate ou qu'il détient. La
 * consultation est enregistrée (une seule fois par marché et bénéficiaire), le bénéficiaire en est prévenu, et seules
 * les personnes qui acceptent d'être contactées livrent leurs coordonnées.
 */
export async function consulterCoordonnees(s: Session, marcheId: number, beneficiaireId: number): Promise<{ Courriel: string; Telephone: string }> {
  const rep = repondantDe(s);
  const db = database();
  const [m] = await db.select({ titulaireId: marches.titulaireId }).from(marches).where(eq(marches.id, marcheId));
  const [cand] = await db.select({ r: candidatures.repondantId }).from(candidatures).where(and(eq(candidatures.marcheId, marcheId), eq(candidatures.repondantId, rep)));
  if (!m || (m.titulaireId !== rep && !cand)) throw fail(403, 'Ce marché ne vous concerne pas.');

  const [b] = await db
    .select({ id: beneficiaires.id, email: utilisateurs.email, telephone: beneficiaires.telephone, consentContact: beneficiaires.consentementContactGroupements })
    .from(beneficiaires)
    .leftJoin(utilisateurs, eq(utilisateurs.id, beneficiaires.utilisateurId))
    .where(and(eq(beneficiaires.id, beneficiaireId), eq(beneficiaires.consentementAnnuaire, true), beneficiaireEligible, sql`not ${beneficiaireADetruire}`));
  if (!b || !b.consentContact) throw fail(403, 'Cette personne ne souhaite pas être contactée.');

  const [existing] = await db.select({ id: accesCoordonnees.id }).from(accesCoordonnees).where(and(eq(accesCoordonnees.repondantId, rep), eq(accesCoordonnees.marcheId, marcheId), eq(accesCoordonnees.beneficiaireId, beneficiaireId)));
  if (!existing) {
    const [created] = await db.insert(accesCoordonnees).values({ repondantId: rep, marcheId, beneficiaireId, afficheEmail: true, afficheTelephone: true }).onConflictDoNothing().returning({ id: accesCoordonnees.id });
    if (created) await accesCoordonneesCree(created.id);
  }
  return { Courriel: b.email ?? '', Telephone: b.telephone ?? '' };
}
