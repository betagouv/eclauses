import { LocalFileStore } from './local';
import type { FileStore } from './types';

let store: FileStore | undefined;

/** Pilote choisi par `STORAGE_DRIVER` (`local` par défaut). Un pilote `s3` s'ajoutera ici. */
export function fileStore(): FileStore {
  if (!store) {
    const driver = process.env.STORAGE_DRIVER ?? 'local';
    if (driver !== 'local') throw new Error(`Pilote de stockage non pris en charge : ${driver}`);
    store = new LocalFileStore(process.env.STORAGE_LOCAL_DIR ?? './var/fichiers');
  }
  return store;
}

export type { FileStore };
