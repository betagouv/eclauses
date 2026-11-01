/**
 * Stockage de fichiers. Le métier ne connaît que cette interface : on passe du dossier local à S3 en
 * changeant `STORAGE_DRIVER`, sans toucher au reste du code.
 */
export interface FileStore {
  /** Enregistre le contenu sous `cle` (écrase si elle existe). */
  put(cle: string, contenu: Uint8Array, typeMime: string): Promise<void>;
  /** Flux du contenu ; `null` si la clé n'existe pas. */
  get(cle: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(cle: string): Promise<void>;
  exists(cle: string): Promise<boolean>;
}
