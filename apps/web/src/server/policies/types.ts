import type { Row } from '../compat/engine';
import type { Session } from '../auth/session';

/** Utilisateur connecté, ou `null` pour un visiteur anonyme. */
export type Actor = Session | null;

export interface ReadQuery {
  ids?: number[];
}

/**
 * Politique d'une table : ce que chaque rôle peut lire, créer, modifier ou supprimer. Elle remplace
 * les règles d'accès (ACL) du document Grist. Une opération absente est refusée.
 */
export interface TablePolicy {
  read?(actor: Actor, query: ReadQuery): Promise<Row[]>;
  create?(actor: Actor, fields: Record<string, unknown>): Promise<number>;
  update?(actor: Actor, id: number, fields: Record<string, unknown>): Promise<void>;
  remove?(actor: Actor, id: number): Promise<void>;
}
