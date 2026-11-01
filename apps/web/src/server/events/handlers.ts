import type { Row } from '../grist/client';
import { grist } from '../config';
import { decodeRows } from '../grist/schema';
import { createActivation, markActivationSent, resetUrl } from '../accounts';
import { describeMarche, loadMarcheInfo, type MarcheInfo } from '../mail/describe';
import * as t from '../mail/templates';
import { sendMail } from '../mail/transport';
import { alreadySent, markSent, reset } from './dedupe';

type Payload = Row[];

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const truthy = (v: unknown) => v === true || v === 1 || v === '1';
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
/** Adresses d'une cellule de liste (avec ou sans marqueur « L »), sans doublon ni valeur vide. */
const emails = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.includes('@')).map((x) => x.trim()) : [];

/** Date Grist (secondes) -> jj/mm/aaaa. */
const frDate = (v: unknown): string | null =>
  typeof v === 'number' && v > 0 ? new Date(v * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : null;

async function marcheRow(id: number): Promise<Row | undefined> {
  const [row] = await grist().records('Marches', { filter: { id: [id] } });
  return row ? (await decodeRows('Marches', [row]))[0] : undefined;
}

async function send(to: string, rendered: { subject: string; html: string }): Promise<void> {
  await sendMail({ to, ...rendered });
}

/** Chaque ligne d'un lot de webhook est traitée ; une erreur sur l'une n'empêche pas les autres. */
async function each(rows: Payload, fn: (row: Row) => Promise<void>): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await fn(row);
      done++;
    } catch (e) {
      failed++;
      console.error('[événement] échec sur la ligne', row.id, e instanceof Error ? e.message : e);
    }
  }
  return { done, failed };
}

/* ------------------------------------------------------------------ Marchés ------------- */

/** Publication d'un marché : prévenir les bénéficiaires de la clause. */
export const marchePublie = (rows: Payload) =>
  each(rows, async (row) => {
    if (!truthy(row.Doit_Notifier_Publication)) return;
    const key = `publie:${row.id}`;
    if (alreadySent(key)) return;

    const decoded = (await decodeRows('Marches', [row]))[0]!;
    const info = describeMarche(decoded);
    const clauseId = num(row.Clauses_sociales_parent_ou_enfants) || num(row.Clauses_sociales);
    if (!clauseId) return;

    const [clause] = await decodeRows('Clauses_sociales', await grist().records('Clauses_sociales', { filter: { id: [clauseId] } }));
    const recipients = [...new Set(emails(clause?.Beneficiaires_Actif))];

    const alloti = num(row.Nb_lots) > 0 || truthy(row.Est_Alloti);
    const lots = alloti
      ? ((Array.isArray(row.Lots_Detail) ? row.Lots_Detail : []) as Record<string, unknown>[]).map((l) => ({
          label: text(l.Lot_Label) || text(l.Intitule_propre) || `Lot ${l.Numero_de_lot ?? ''}`.trim(),
          clause: text(l.Clauses_sociales_Label),
        }))
      : [];
    const rendered = t.marchePublie({
      info,
      alloti,
      deadline: frDate(row.Date_Limite_de_Remise_des_Offres),
      lots,
      clause: text(clause?.Nom_de_la_clause) || null,
    });

    markSent(key);
    for (const to of recipients) await send(to, rendered);
    // La notification est faite : on le note dans Grist pour ne pas la renvoyer à la prochaine modification.
    await grist().updateRecords('Marches', [{ id: row.id, fields: { Ne_Doit_Pas_Notifier: true } }]);
  });

/** Déclaration soumise : prévenir les utilisateurs de l'entité acheteuse. */
export const marcheAValider = (rows: Payload) =>
  each(rows, async (row) => {
    const key = `a_valider:${row.id}`;
    if (!truthy(row.A_valider)) return reset(key);
    if (alreadySent(key)) return;
    const decoded = (await decodeRows('Marches', [row]))[0]!;
    const info = describeMarche(decoded);
    markSent(key);
    const users = await grist().records('Utilisateurs_Acheteurs', { filter: { id: ids(decoded.Acheteur_Utilisateurs_Acheteurs) } });
    for (const u of users) {
      if (!text(u.Email)) continue;
      await send(text(u.Email), t.declarationAValider(info, [text(u.Prenom), text(u.Nom)].filter(Boolean).join(' ')));
    }
  });

/** Clause validée : prévenir le titulaire et les utilisateurs de l'entité acheteuse. */
export const marcheValidee = (rows: Payload) =>
  each(rows, async (row) => {
    const key = `validee:${row.id}`;
    if (!truthy(row.Clause_validee)) return reset(key);
    if (alreadySent(key)) return;
    const decoded = (await decodeRows('Marches', [row]))[0]!;
    const info = describeMarche(decoded);
    markSent(key);

    if (num(row.Titulaire)) {
      const [titulaire] = await grist().records('Repondants', { filter: { id: [num(row.Titulaire)] } });
      if (text(titulaire?.Email)) await send(text(titulaire!.Email), t.clauseActiveeTitulaire(info));
    }
    const users = await grist().records('Utilisateurs_Acheteurs', { filter: { id: ids(decoded.Acheteur_Utilisateurs_Acheteurs) } });
    for (const u of users) if (text(u.Email)) await send(text(u.Email), t.clauseActiveeAcheteur(info));
  });

/* ------------------------------------------------------------------ Déclarations -------- */

/** Bénéficiaire déclaré puis validé par l'acheteur. */
export const beneficiaireDeclare = (rows: Payload) =>
  each(rows, async (row) => {
    const key = `decl_valide:${row.id}`;
    if (text(row.Statut) !== 'validé') return reset(key);
    if (alreadySent(key)) return;
    const to = text(row.Email_envoi);
    const info = await loadMarcheInfo(num(row.Marche));
    if (!to || !info) return;
    markSent(key);
    await send(to, t.beneficiaireDeclare(info));
  });

export const declarationRefusee = (rows: Payload) =>
  each(rows, async (row) => {
    const info = await loadMarcheInfo(num(row.Marche));
    const to = text(row.Marche_Titulaire_Email);
    if (!info || !to) return;
    await send(to, t.declarationRefusee(info, text(row.Raison)));
  });

/** Un candidat a consulté les coordonnées d'un ou plusieurs bénéficiaires. */
export const consultationCoordonnees = (rows: Payload) =>
  each(rows, async (row) => {
    const to = text(row.Beneficiaire__Courriel);
    if (!to) return;
    const title = text(row.Marche_Intitule_propre) || (await loadMarcheInfo(num(row.Marche)))?.marcheTitle || 'Marché';
    await send(to, t.consultationCoordonnees(title));
  });

/* ------------------------------------------------------------------ Comptes ------------- */

/** Un acheteur déclare un titulaire : créer le compte si besoin et le prévenir. */
export const invitationTitulaire = (rows: Payload) =>
  each(rows, async (row) => {
    const email = text(row.Email).toLowerCase();
    const marcheId = num(row.Marche);
    const info = await loadMarcheInfo(marcheId);
    if (!email || !info) return;

    const [existing] = await grist().records('Repondants', { filter: { Email: [email] } });
    if (existing) {
      const current = ids(existing.Titulaire_aux_marches);
      await grist().updateRecords('Repondants', [
        { id: existing.id, fields: { Titulaire_aux_marches: ['L', ...new Set([...current, marcheId])] } },
      ]);
      await send(email, t.titulaireInvitation(info, null));
      return;
    }

    // Le titulaire est créé déjà rattaché au marché : l'événement « inscription » le reconnaît ainsi.
    const [id] = await grist().addRecords('Repondants', [{ Email: email, Titulaire_aux_marches: ['L', marcheId] }]);
    void id;
    const activation = await createActivation(email);
    try {
      await send(email, t.titulaireInvitation(info, activation.url));
      await markActivationSent(activation.id);
    } catch (e) {
      await markActivationSent(activation.id, e instanceof Error ? e.message : 'Envoi impossible');
      throw e;
    }
  });

/** Inscription d'un candidat : lui envoyer le lien pour créer son mot de passe. */
export const inscriptionCandidat = (rows: Payload) =>
  each(rows, async (row) => {
    const email = text(row.Email).toLowerCase();
    // Un titulaire créé par une invitation reçoit déjà son propre courrier.
    if (!email || ids(row.Titulaire_aux_marches).length) return;
    const activation = await createActivation(email);
    try {
      await send(email, t.finalizeInscription(activation.url));
      await markActivationSent(activation.id);
    } catch (e) {
      await markActivationSent(activation.id, e instanceof Error ? e.message : 'Envoi impossible');
      throw e;
    }
  });

/** Mot de passe oublié : envoyer le lien si un compte existe pour cette adresse. */
export const motDePasseOublie = (rows: Payload) =>
  each(rows, async (row) => {
    if (!truthy(row.Is_Reset) || !truthy(row.Existe)) return;
    const email = text(row.Email);
    const token = text(row.Token);
    if (!email || !token) return;
    await send(email, t.resetPassword(resetUrl(token)));
  });

/** Action manuelle de l'équipe : envoyer les invitations de création de compte en attente. */
export const invitationComptes = (rows: Payload) =>
  each(rows, async (row) => {
    if (!truthy(row.Declencher_envoi_creation_de_compte)) return;
    const pending = (await grist().records('Application_Password_Reset', { filter: { Type: ['creat'] } })).filter(
      (r) => !truthy(r.create_send) && !truthy(r.Expire),
    );
    for (const reset of pending) {
      const email = text(reset.Email);
      const [benef] = await grist().records('Beneficiaires', { filter: { Courriel: [email] } });
      if (!benef) {
        await markActivationSent(reset.id, 'Bénéficiaire introuvable');
        continue;
      }
      try {
        await send(email, t.accountInvitation([text(benef.Prenom), text(benef.NOM)].filter(Boolean).join(' '), resetUrl(text(reset.Token))));
        await markActivationSent(reset.id);
      } catch (e) {
        await markActivationSent(reset.id, e instanceof Error ? e.message : 'Envoi impossible');
      }
    }
    await grist().updateRecords('ActionsManuelles', [{ id: row.id, fields: { Declencher_envoi_creation_de_compte: false } }]);
  });

export const EVENTS: Record<string, (rows: Payload) => Promise<{ done: number; failed: number }>> = {
  'marche-publie': marchePublie,
  'marche-a-valider': marcheAValider,
  'marche-validee': marcheValidee,
  'beneficiaire-declare': beneficiaireDeclare,
  'declaration-refusee': declarationRefusee,
  'consultation-coordonnees': consultationCoordonnees,
  'invitation-titulaire': invitationTitulaire,
  'inscription-candidat': inscriptionCandidat,
  'mot-de-passe-oublie': motDePasseOublie,
  'invitation-comptes': invitationComptes,
};

export type { MarcheInfo };
