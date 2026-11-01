import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { beneficiaires, repondants, sessions, utilisateurs } from '../db/schema';
import { HttpError } from '../http';
import { auditer } from './audit';

/**
 * Fusion de doublons : tout ce qui se rattache au profil « supprimé » est reporté sur le profil
 * « conservé », puis le doublon disparaît. Les champs vides sont complétés, les consentements gardent
 * la valeur la plus restrictive. Une seule transaction : en cas d'erreur, rien ne change.
 */

export type TypeFusion = 'beneficiaire' | 'repondant';
type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

const fail = (status: number, message: string) => new HttpError(status, message);
const rowsOf = <T>(r: unknown) => r as unknown as T[];
const vide = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export interface Doublon {
  type: TypeFusion;
  cle: string;
  profils: { id: number; libelle: string; email: string | null }[];
}

/** Profils qui ont probablement été saisis deux fois : même nom et prénom (bénéficiaires), même SIRET (répondants). */
export async function doublonsProbables(): Promise<Doublon[]> {
  const db = database();
  const b = rowsOf<{ cle: string; ids: number[]; libelles: string[]; emails: (string | null)[] }>(
    await db.execute(sql`
      select lower(trim(b.nom)) || ' ' || lower(trim(coalesce(b.prenom, ''))) as cle,
             array_agg(b.id order by b.id) as ids,
             array_agg(trim(b.nom || ' ' || coalesce(b.prenom, '')) order by b.id) as libelles,
             array_agg(u.email order by b.id) as emails
        from beneficiaires b left join utilisateurs u on u.id = b.utilisateur_id
       where b.anonymise_le is null and trim(b.nom) <> ''
       group by 1 having count(*) > 1 order by 1 limit 200`),
  );
  const r = rowsOf<{ cle: string; ids: number[]; libelles: string[]; emails: (string | null)[] }>(
    await db.execute(sql`
      select regexp_replace(r.siret, '\\s', '', 'g') as cle,
             array_agg(r.id order by r.id) as ids,
             array_agg(coalesce(nullif(trim(r.raison_sociale), ''), u.email, '#' || r.id) order by r.id) as libelles,
             array_agg(u.email order by r.id) as emails
        from repondants r left join utilisateurs u on u.id = r.utilisateur_id
       where r.anonymise_le is null and coalesce(trim(r.siret), '') <> ''
       group by 1 having count(*) > 1 order by 1 limit 200`),
  );
  const make = (type: TypeFusion) => (x: (typeof b)[number]): Doublon => ({ type, cle: x.cle, profils: x.ids.map((id, i) => ({ id, libelle: x.libelles[i], email: x.emails[i] })) });
  return [...b.map(make('beneficiaire')), ...r.map(make('repondant'))];
}

export interface Apercu {
  conserve: { id: number; libelle: string; email: string | null };
  supprime: { id: number; libelle: string; email: string | null };
  deplaces: Record<string, number>;
  avertissements: string[];
}

async function profil(tx: Tx, type: TypeFusion, id: number) {
  if (type === 'beneficiaire') {
    const [p] = await tx.select().from(beneficiaires).where(eq(beneficiaires.id, id)).for('update');
    if (!p) throw fail(404, 'Bénéficiaire introuvable.');
    const [u] = p.utilisateurId ? await tx.select().from(utilisateurs).where(eq(utilisateurs.id, p.utilisateurId)) : [];
    return { p, u, libelle: [p.prenom, p.nom].filter(Boolean).join(' ') };
  }
  const [p] = await tx.select().from(repondants).where(eq(repondants.id, id)).for('update');
  if (!p) throw fail(404, 'Candidat introuvable.');
  const [u] = p.utilisateurId ? await tx.select().from(utilisateurs).where(eq(utilisateurs.id, p.utilisateurId)) : [];
  return { p, u, libelle: p.raisonSociale || [p.prenom, p.nom].filter(Boolean).join(' ') || u?.email || `#${p.id}` };
}

const comptes: Record<TypeFusion, [string, string[]][]> = {
  beneficiaire: [
    ['intérêts pour des marchés', ['interets_marches']],
    ['consultations de coordonnées', ['acces_coordonnees']],
    ['déclarations', ['declarations_beneficiaires']],
    ['spécialités', ['beneficiaire_specialites']],
    ['départements', ['beneficiaire_departements']],
    ['régions', ['beneficiaire_regions']],
    ['clauses', ['beneficiaire_clauses']],
  ],
  repondant: [
    ['candidatures', ['candidatures']],
    ['consultations de coordonnées', ['acces_coordonnees']],
    ['déclarations', ['declarations_beneficiaires']],
    ['invitations', ['invitations_titulaires']],
    ['marchés dont il est titulaire', ['marches']],
  ],
};
const colonne = (table: string, type: TypeFusion) => (table === 'marches' ? 'titulaire_id' : type === 'beneficiaire' ? 'beneficiaire_id' : 'repondant_id');

async function compter(tx: Tx, type: TypeFusion, id: number) {
  const out: Record<string, number> = {};
  for (const [label, [table]] of comptes[type]) {
    const [r] = rowsOf<{ n: number }>(await tx.execute(sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.identifier(colonne(table, type))} = ${id}`));
    if (r.n) out[label] = r.n;
  }
  return out;
}

async function verifier(tx: Tx, type: TypeFusion, conserveId: number, supprimeId: number) {
  if (conserveId === supprimeId) throw fail(400, 'Choisissez deux profils différents.');
  const c = await profil(tx, type, conserveId);
  const s = await profil(tx, type, supprimeId);
  const avertissements: string[] = [];
  if (c.u && s.u) avertissements.push(`Les deux profils ont un compte : celui de ${s.u.email} sera désactivé et détaché, la personne se connectera avec ${c.u.email}.`);
  else if (s.u) avertissements.push(`Le compte ${s.u.email} sera rattaché au profil conservé.`);
  return { c, s, avertissements };
}

export async function apercu(type: TypeFusion, conserveId: number, supprimeId: number): Promise<Apercu> {
  return database().transaction(async (tx) => {
    const { c, s, avertissements } = await verifier(tx, type, conserveId, supprimeId);
    return {
      conserve: { id: c.p.id, libelle: c.libelle, email: c.u?.email ?? null },
      supprime: { id: s.p.id, libelle: s.libelle, email: s.u?.email ?? null },
      deplaces: await compter(tx, type, supprimeId),
      avertissements,
    };
  });
}

/** Report des lignes liées, sans créer de doublon sur les contraintes d'unicité (les lignes en double disparaissent avec le profil supprimé). */
async function reporter(tx: Tx, type: TypeFusion, keep: number, drop: number) {
  const q = (s: ReturnType<typeof sql>) => tx.execute(s);
  if (type === 'beneficiaire') {
    for (const [table, col] of [['beneficiaire_specialites', 'specialite_id'], ['beneficiaire_departements', 'departement_id'], ['beneficiaire_regions', 'region_id'], ['beneficiaire_clauses', 'clause_id']] as const) {
      await q(sql`insert into ${sql.identifier(table)} (beneficiaire_id, ${sql.identifier(col)}) select ${keep}, ${sql.identifier(col)} from ${sql.identifier(table)} where beneficiaire_id = ${drop} on conflict do nothing`);
    }
    await q(sql`update interets_marches i set beneficiaire_id = ${keep} where i.beneficiaire_id = ${drop} and not exists (select 1 from interets_marches k where k.beneficiaire_id = ${keep} and k.marche_id = i.marche_id)`);
    await q(sql`update acces_coordonnees a set beneficiaire_id = ${keep} where a.beneficiaire_id = ${drop} and not exists (select 1 from acces_coordonnees k where k.beneficiaire_id = ${keep} and k.marche_id = a.marche_id and k.repondant_id = a.repondant_id)`);
    await q(sql`update declarations_beneficiaires set beneficiaire_id = ${keep} where beneficiaire_id = ${drop}`);
    return;
  }
  await q(sql`update candidatures c set repondant_id = ${keep} where c.repondant_id = ${drop} and not exists (select 1 from candidatures k where k.repondant_id = ${keep} and k.marche_id = c.marche_id)`);
  await q(sql`update acces_coordonnees a set repondant_id = ${keep} where a.repondant_id = ${drop} and not exists (select 1 from acces_coordonnees k where k.repondant_id = ${keep} and k.marche_id = a.marche_id and k.beneficiaire_id = a.beneficiaire_id)`);
  await q(sql`update declarations_beneficiaires set repondant_id = ${keep} where repondant_id = ${drop}`);
  await q(sql`update invitations_titulaires set repondant_id = ${keep} where repondant_id = ${drop}`);
  await q(sql`update marches set titulaire_id = ${keep} where titulaire_id = ${drop}`);
}

export async function fusionner(admin: Session, type: TypeFusion, conserveId: number, supprimeId: number): Promise<{ deplaces: Record<string, number> }> {
  if (!admin.roles.includes('admin')) throw fail(403, 'Accès refusé.');
  const resultat = await database().transaction(async (tx) => {
    const { c, s } = await verifier(tx, type, conserveId, supprimeId);
    const deplaces = await compter(tx, type, supprimeId);

    // Compte : si seul le doublon en a un, il passe au profil conservé ; si les deux en ont, celui du doublon est désactivé et détaché.
    let compteAttache: number | null = c.p.utilisateurId;
    if (s.p.utilisateurId) {
      if (type === 'beneficiaire') await tx.update(beneficiaires).set({ utilisateurId: null }).where(eq(beneficiaires.id, supprimeId));
      else await tx.update(repondants).set({ utilisateurId: null }).where(eq(repondants.id, supprimeId));
      if (!c.p.utilisateurId) compteAttache = s.p.utilisateurId;
      else {
        await tx.update(utilisateurs).set({ motDePasseHash: null }).where(eq(utilisateurs.id, s.p.utilisateurId));
        await tx.update(sessions).set({ revoqueLe: new Date() }).where(and(eq(sessions.utilisateurId, s.p.utilisateurId), isNull(sessions.revoqueLe)));
      }
    }

    await reporter(tx, type, conserveId, supprimeId);

    if (type === 'beneficiaire') {
      const a = c.p as typeof beneficiaires.$inferSelect;
      const b = s.p as typeof beneficiaires.$inferSelect;
      const pick = <K extends keyof typeof a>(k: K) => (vide(a[k]) ? b[k] : a[k]);
      const notes = [a.commentaire, b.commentaire].filter((x, i, l) => !vide(x) && l.indexOf(x) === i).join('\n---\n');
      await tx
        .update(beneficiaires)
        .set({
          utilisateurId: compteAttache,
          prenom: pick('prenom'),
          telephone: pick('telephone'),
          formationId: pick('formationId'),
          autreFormation: pick('autreFormation'),
          anneeDiplome: pick('anneeDiplome'),
          specialiteEcole: pick('specialiteEcole'),
          sousSpecialite: pick('sousSpecialite'),
          intituleMemoire: pick('intituleMemoire'),
          autresInformations: pick('autresInformations'),
          missionsProposees: pick('missionsProposees'),
          commentaire: notes || null,
          cvFichierId: pick('cvFichierId'),
          consentementAnnuaire: a.consentementAnnuaire && b.consentementAnnuaire,
          consentementContactGroupements: a.consentementContactGroupements && b.consentementContactGroupements,
          alumni: a.alumni || b.alumni,
          modifieLe: new Date(),
        })
        .where(eq(beneficiaires.id, conserveId));
      await tx.delete(beneficiaires).where(eq(beneficiaires.id, supprimeId));
    } else {
      const a = c.p as typeof repondants.$inferSelect;
      const b = s.p as typeof repondants.$inferSelect;
      const pick = <K extends keyof typeof a>(k: K) => (vide(a[k]) ? b[k] : a[k]);
      await tx
        .update(repondants)
        .set({ utilisateurId: compteAttache, nom: pick('nom'), prenom: pick('prenom'), telephone: pick('telephone'), raisonSociale: pick('raisonSociale'), siret: pick('siret') })
        .where(eq(repondants.id, conserveId));
      await tx.delete(repondants).where(eq(repondants.id, supprimeId));
    }
    return { deplaces, supprime: { id: supprimeId, email: s.u?.email ?? null }, compteDesactive: !!(c.p.utilisateurId && s.p.utilisateurId) };
  });
  await auditer(admin, `fusion.${type}`, type, conserveId, { supprimeId, supprimeEmail: resultat.supprime.email, deplaces: resultat.deplaces, compteDesactive: resultat.compteDesactive });
  return { deplaces: resultat.deplaces };
}
