import type { Row } from './grist/client';
import type { Actor } from './policies/types';
import { policyFor } from './policies';
import { HttpError } from './http';

/** Point d'entrée de lecture : équivalent de `gristAPI.getData`, filtré par la politique de la table. */
export async function readTable(actor: Actor, table: string, ids?: number[]): Promise<Row[]> {
  const read = policyFor(table).read;
  if (!read) throw new HttpError(403, `Lecture non autorisée : ${table}`);
  return read(actor, { ids });
}

export async function createRow(actor: Actor, table: string, fields: unknown): Promise<number> {
  const create = policyFor(table).create;
  if (!create) throw new HttpError(403, `Création non autorisée : ${table}`);
  return create(actor, asFields(fields));
}

export async function updateRow(actor: Actor, table: string, id: number, fields: unknown): Promise<void> {
  const update = policyFor(table).update;
  if (!update) throw new HttpError(403, `Modification non autorisée : ${table}`);
  return update(actor, id, asFields(fields));
}

export async function removeRow(actor: Actor, table: string, id: number): Promise<void> {
  const remove = policyFor(table).remove;
  if (!remove) throw new HttpError(403, `Suppression non autorisée : ${table}`);
  return remove(actor, id);
}

function asFields(fields: unknown): Record<string, unknown> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new HttpError(400, 'Données invalides.');
  return fields as Record<string, unknown>;
}
