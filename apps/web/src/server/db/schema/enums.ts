import { pgEnum } from 'drizzle-orm/pg-core';

/** Valeurs stables en base ; les libellés affichés vivent dans `labels.ts`. */
export const statutMarche = pgEnum('statut_marche', [
  'en_attente_publication',
  'en_attente_notification',
  'en_attente_declaration',
  'declaration_a_valider',
  'clause_validee',
  'archive',
]);

export const statutDeclaration = pgEnum('statut_declaration', ['declare', 'valide', 'brouillon']);

export const statutInvitation = pgEnum('statut_invitation', ['en_attente', 'traitee']);

export const categorieAcheteur = pgEnum('categorie_acheteur', [
  'administration_centrale',
  'services_a_competence_nationale',
  'services_deconcentres',
  'operateurs_etablissements_publics',
]);

export const audience = pgEnum('audience', ['public', 'beneficiaire', 'acheteur', 'repondant']);

export const typeIndicateur = pgEnum('type_indicateur', ['utilisable', 'utilise', 'utile', 'impactant']);

export const objectifJeton = pgEnum('objectif_jeton', ['activation', 'reinitialisation']);

export const zoneLien = pgEnum('zone_lien', ['entete', 'pied', 'pied_bas']);
