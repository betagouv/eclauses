import { LocalFileStore } from './local';
import { S3FileStore } from './s3';
import type { FileStore } from './types';

let store: FileStore | undefined;

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Configuration incomplète pour le stockage S3 : ${name}`);
  return v;
};

/** Pilote choisi par `STORAGE_DRIVER` : `local` (par défaut, dossier `STORAGE_LOCAL_DIR`) ou `s3`. */
export function fileStore(): FileStore {
  if (!store) {
    const driver = process.env.STORAGE_DRIVER ?? 'local';
    if (driver === 'local') store = new LocalFileStore(process.env.STORAGE_LOCAL_DIR ?? './var/fichiers');
    else if (driver === 's3') {
      store = new S3FileStore({
        bucket: required('S3_BUCKET'),
        region: process.env.S3_REGION ?? 'fr-par',
        endpoint: process.env.S3_ENDPOINT,
        accessKeyId: required('S3_ACCESS_KEY_ID'),
        secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
    } else throw new Error(`Pilote de stockage non pris en charge : ${driver}`);
  }
  return store;
}

export type { FileStore };
