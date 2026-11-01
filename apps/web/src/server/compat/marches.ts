import { eq, inArray } from 'drizzle-orm';
import { database } from '../db/client';
import { STATUT_MARCHE_LABELS } from '../db/labels';
import * as s from '../db/schema';
import { publicUrl } from '../mail/layout';
import { LegacyTable, type Row } from './engine';

const L = STATUT_MARCHE_LABELS;
export const EVENT_PUBLIE = 'marche-publie';

/**
 * Marchés au format des pages. Les agrégats de lots et de statut, calculés par des formules dans
 * Grist, le sont ici à partir d'un instantané des tables liées (quelques centaines de lignes).
 */
export const marches = new LegacyTable({
  table: s.marches,
  fields: {
    Intitule_du_marche: { prop: 'intitule', kind: 'text' },
    Acheteur: { prop: 'acheteurId', kind: 'ref', readonly: true },
    Marche_parent: { prop: 'parentId', kind: 'ref' },
    Numero_de_lot: { prop: 'numeroLot', kind: 'text' },
    Intitule_du_lot: { prop: 'intituleLot', kind: 'text' },
    Clauses_sociales: { prop: 'clauseId', kind: 'ref' },
    Statut: { prop: 'statut', kind: 'enum', labels: L },
    Titulaire: { prop: 'titulaireId', kind: 'ref' },
    Lien_vers_les_documents_de_consultation: { prop: 'lienDocuments', kind: 'text' },
    Date_de_publication: { prop: 'datePublication', kind: 'date' },
    Date_Limite_de_Remise_des_Offres: { prop: 'dateLimiteOffres', kind: 'date' },
    Date_de_notification_previsionnelle: { prop: 'dateNotificationPrevisionnelle', kind: 'date' },
    Date_de_fin_d_execution: { prop: 'dateFinExecution', kind: 'date' },
    Lieu_d_execution: { prop: 'lieuExecution', kind: 'text' },
    Latitude: { prop: 'latitude', kind: 'num' },
    Longitude: { prop: 'longitude', kind: 'num' },
    Adresse_geocodee: { prop: 'adresseGeocodee', kind: 'text' },
    Lots_avec_lieux_differents: { prop: 'lotsLieuxDifferents', kind: 'bool' },
    Lots_avec_clauses_differentes: { prop: 'lotsClausesDifferentes', kind: 'bool' },
    Suivi: { prop: 'suivi', kind: 'texts' },
    Creation_en_autonomie: { prop: 'creationEnAutonomie', kind: 'bool', readonly: true },
  },
  lists: {
    Specialites_du_marche: { table: s.marcheSpecialites, owner: 'marcheId', other: 'specialiteId' },
  },
  computed: computeMarches,
});

async function computeMarches(rows: Row[]): Promise<void> {
  const db = database();
  const [all, decls, cands, invs, ach, usersAch, reps, clausesRows, sent] = await Promise.all([
    db.select().from(s.marches),
    db.select({ id: s.declarationsBeneficiaires.id, marcheId: s.declarationsBeneficiaires.marcheId }).from(s.declarationsBeneficiaires),
    db.select().from(s.candidatures),
    db.select({ id: s.invitationsTitulaires.id, marcheId: s.invitationsTitulaires.marcheId }).from(s.invitationsTitulaires),
    db.select({ id: s.acheteurs.id, nom: s.acheteurs.nom }).from(s.acheteurs),
    db.select({ id: s.utilisateursAcheteurs.id, acheteurId: s.utilisateursAcheteurs.acheteurId }).from(s.utilisateursAcheteurs),
    db.select({ id: s.repondants.id, nom: s.repondants.nom, prenom: s.repondants.prenom, raisonSociale: s.repondants.raisonSociale, email: s.utilisateurs.email })
      .from(s.repondants)
      .leftJoin(s.utilisateurs, eq(s.utilisateurs.id, s.repondants.utilisateurId)),
    db.select({ id: s.clausesSociales.id, nom: s.clausesSociales.nom }).from(s.clausesSociales),
    db.select({ cle: s.notificationsEnvoyees.cle }).from(s.notificationsEnvoyees).where(eq(s.notificationsEnvoyees.evenement, EVENT_PUBLIE)),
  ]);
  const byId = new Map(all.map((m) => [m.id, m]));
  const acheteurNom = new Map(ach.map((a) => [a.id, a.nom]));
  const clauseNom = new Map(clausesRows.map((c) => [c.id, c.nom]));
  const notified = new Set(sent.map((x) => x.cle));
  const today = new Date().toISOString().slice(0, 10);

  const repLabel = (id: number | null) => {
    const r = reps.find((x) => x.id === id);
    if (!r) return '';
    return r.raisonSociale || r.email || '';
  };
  const intitulePropre = (m: (typeof all)[number]): string => {
    if (!m.parentId) return m.intitule;
    const parent = byId.get(m.parentId);
    const lot = m.numeroLot ? ` - Lot ${m.numeroLot}` : '';
    const titre = m.intituleLot ? ` : ${m.intituleLot}` : '';
    return `${parent?.intitule ?? ''}${lot}${titre}`;
  };
  const lotLabel = (m: (typeof all)[number]): string => {
    if (!m.parentId) return '';
    const lot = m.numeroLot ? `Lot ${m.numeroLot}` : 'Lot';
    const titre = m.intituleLot || intitulePropre(m);
    return titre ? `${lot} - ${titre}` : lot;
  };
  const children = (id: number) => all.filter((m) => m.parentId === id);

  for (const row of rows) {
    const m = byId.get(row.id)!;
    const isLot = !!m.parentId;
    const lots = children(m.id);
    const lotsEclauses = lots.filter((l) => l.clauseId);
    const parent = m.parentId ? byId.get(m.parentId) : undefined;
    const racine = parent ?? m;
    const lotsOfScope = isLot ? [m] : lotsEclauses;
    const clauseIds = [...new Set(lotsOfScope.map((l) => l.clauseId).filter((x): x is number => !!x))];
    const statuts = lotsEclauses.map((l) => l.statut);

    let global = m.statut;
    if (!isLot && lotsEclauses.length) {
      if (statuts.every((x) => x === 'clause_validee')) global = 'clause_validee';
      else if (statuts.includes('declaration_a_valider')) global = 'declaration_a_valider';
      else if (statuts.includes('en_attente_declaration')) global = 'en_attente_declaration';
      else if (statuts.includes('en_attente_notification')) global = 'en_attente_notification';
    }

    const alreadyNotified = notified.has(String(m.id));
    Object.assign(row, {
      Intitule_propre: intitulePropre(m),
      Intitule_Lot: isLot ? (m.numeroLot === '' || m.numeroLot == null ? (parent?.intitule ?? '') : `Lot ${m.numeroLot} - ${m.intituleLot ?? ''}`) : m.intitule,
      Lot_Label: lotLabel(m),
      Marche_parent_Intitule_propre: parent ? intitulePropre(parent) || parent.intitule : intitulePropre(m) || m.intitule,
      Est_lot: isLot,
      Est_marche_parent: !isLot,
      Marche_racine: racine.id,
      Lots: lots.map((l) => l.id),
      Nb_lots: lots.length,
      Lots_eclauses: lotsEclauses.map((l) => l.id),
      Nb_lots_eclauses: lotsEclauses.length,
      Nb_lots_en_attente_declaration: statuts.filter((x) => x === 'en_attente_declaration').length,
      Nb_lots_a_valider: statuts.filter((x) => x === 'declaration_a_valider').length,
      Nb_lots_valides: statuts.filter((x) => x === 'clause_validee').length,
      Statut_global: L[global],
      Titulaires_lots: [...new Set(lotsEclauses.map((l) => l.titulaireId).filter((x): x is number => !!x))],
      Beneficiaires: decls.filter((d) => d.marcheId === m.id).map((d) => d.id),
      Beneficiaires_tous_lots: lotsEclauses.flatMap((l) => decls.filter((d) => d.marcheId === l.id).map((d) => d.id)),
      Clauses_sociales_lots: clauseIds,
      Clauses_sociales_parent_ou_enfants: m.clauseId ?? clauseIds[0] ?? 0,
      Lots_Detail: lotsOfScope.map((l) => ({
        id: l.id,
        Numero_de_lot: l.numeroLot ?? '',
        Intitule_du_lot: l.intituleLot ?? '',
        Intitule_propre: intitulePropre(l),
        Lot_Label: lotLabel(l),
        Clauses_sociales: l.clauseId ?? null,
        Clauses_sociales_Label: l.clauseId ? (clauseNom.get(l.clauseId) ?? '') : '',
      })),
      Candidats: cands.filter((c) => c.marcheId === m.id).map((c) => c.repondantId),
      Invitation_Titulaire_Marche: invs.find((i) => i.marcheId === m.id)?.id ?? 0,
      Acheteur_Nom: acheteurNom.get(m.acheteurId) ?? '',
      Acheteur_Utilisateurs_Acheteurs: usersAch.filter((u) => u.acheteurId === m.acheteurId).map((u) => u.id),
      Titulaire_Label: repLabel(m.titulaireId),
      A_valider: m.statut === 'declaration_a_valider',
      Clause_validee: m.statut === 'clause_validee',
      Ne_Doit_Pas_Notifier: alreadyNotified,
      Doit_Notifier_Publication: !isLot && m.statut === 'en_attente_notification' && !alreadyNotified,
      Doit_archiver: !!m.dateFinExecution && m.statut === 'clause_validee' && addMonths(m.dateFinExecution, 54) < today,
      Lien_Inscription_Candidat: `${publicUrl()}/inscription-candidat?marche=${racine.id}`,
    });
  }
}

function addMonths(day: string, months: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function marcheIdsOfEntite(acheteurId: number | null): Promise<Set<number>> {
  if (!acheteurId) return new Set();
  const rows = await database().select({ id: s.marches.id }).from(s.marches).where(eq(s.marches.acheteurId, acheteurId));
  return new Set(rows.map((r) => r.id));
}

export { inArray };
