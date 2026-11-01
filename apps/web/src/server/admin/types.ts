import type { PgTable } from 'drizzle-orm/pg-core';

/** Types des champs éditables d'une ressource d'administration. */
export type FieldType = 'text' | 'textarea' | 'number' | 'bool' | 'date' | 'datetime' | 'enum' | 'ref' | 'multi';

export interface Field {
  /** Propriété Drizzle de la colonne (ou nom de la liste pour `multi`). */
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Affichée mais jamais modifiable (identifiants, dates système). */
  readonly?: boolean;
  /** Affichée dans la liste. */
  list?: boolean;
  help?: string;
  /** Pour `enum` : code stocké -> libellé. */
  options?: Record<string, string>;
  /** Pour `ref` et `multi` : clé de la ressource désignée. */
  ref?: string;
  /** Pour `multi` : table de jointure et colonnes. */
  join?: { table: PgTable; owner: string; other: string };
  max?: number;
  /** Texte HTML (contenu publié) : un avertissement est affiché dans le formulaire. */
  html?: boolean;
  /** Ne jamais journaliser la valeur (textes longs, secrets). */
  noAudit?: boolean;
}

export interface Resource {
  key: string;
  label: string;
  labelPluriel: string;
  groupe: string;
  table: PgTable;
  /** Colonne d'identité ; `cle` (texte) pour les paramètres. */
  idProp?: string;
  fields: Field[];
  /** Colonnes de la table où chercher (recherche insensible à la casse). */
  search: string[];
  /** Propriétés dont l'assemblage donne le libellé d'une ligne (listes déroulantes, titres). */
  labelProps: string[];
  orderBy?: string;
  canCreate?: boolean;
  canDelete?: boolean;
  /** Lecture seule : ni création, ni modification, ni suppression. */
  readOnly?: boolean;
  /**
   * La ligne est rattachée à un compte (`utilisateurs`) par cette colonne : le formulaire a un champ « e-mail » virtuel,
   * qui crée ou met à jour le compte.
   */
  account?: { fkProp: string; label: string; required?: boolean };
  /** Texte d'aide en tête de page. */
  intro?: string;
}
