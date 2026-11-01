import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { FileStore } from './types';

/** Stockage dans un dossier du serveur (volume Docker). Les clés sont des chemins relatifs opaques. */
export class LocalFileStore implements FileStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Chemin absolu d'une clé, en refusant toute sortie du dossier racine. */
  private path(cle: string): string {
    if (!cle || cle.startsWith('/') || cle.includes('\0') || cle.split('/').includes('..')) throw new Error('Clé de fichier invalide.');
    const full = resolve(join(this.root, cle));
    if (!full.startsWith(this.root + sep)) throw new Error('Clé de fichier invalide.');
    return full;
  }

  async put(cle: string, contenu: Uint8Array, _typeMime?: string): Promise<void> {
    const target = this.path(cle);
    await mkdir(dirname(target), { recursive: true });
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit.
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, contenu, { mode: 0o600 });
    await rename(tmp, target);
  }

  async get(cle: string): Promise<ReadableStream<Uint8Array> | null> {
    const target = this.path(cle);
    if (!(await this.exists(cle))) return null;
    return Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;
  }

  async delete(cle: string): Promise<void> {
    await rm(this.path(cle), { force: true });
  }

  async exists(cle: string): Promise<boolean> {
    try {
      return (await stat(this.path(cle))).isFile();
    } catch {
      return false;
    }
  }
}
