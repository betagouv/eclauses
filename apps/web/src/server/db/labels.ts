/** Libellés affichés pour les valeurs d'énumération stockées en base. */

export const STATUT_MARCHE_LABELS = {
  en_attente_publication: 'En attente de publication',
  en_attente_notification: 'En attente de notification',
  en_attente_declaration: 'En attente de déclaration des bénéficiaires',
  declaration_a_valider: 'Déclaration à valider',
  clause_validee: 'Clause validée',
  archive: 'Archivé',
} as const;

export const STATUT_DECLARATION_LABELS = { declare: 'déclaré', valide: 'validé', brouillon: 'brouillon' } as const;

export const CATEGORIE_ACHETEUR_LABELS = {
  administration_centrale: 'Administration centrale',
  services_a_competence_nationale: 'Services à compétence nationale',
  services_deconcentres: 'Services déconcentrés',
  operateurs_etablissements_publics: 'Opérateurs et établissements publics',
} as const;

export type InverseMap<T extends Record<string, string>> = { [L in T[keyof T]]: { [K in keyof T]: T[K] extends L ? K : never }[keyof T] };

/** Retrouve le code stocké à partir du libellé d'origine Grist (utilisé par l'import et la couche de compatibilité). */
export function codeFromLabel<T extends Record<string, string>>(labels: T, label: unknown): keyof T | undefined {
  return (Object.keys(labels) as (keyof T)[]).find((k) => labels[k] === label);
}
