import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { database } from '../db/client';
import { fichiers } from '../db/schema';
import { fileStore } from '../storage';

export interface FichierMeta {
  id: string;
  nomOriginal: string;
  typeMime: string;
  taille: number;
}

/** Enregistre un fichier : contenu dans le stockage, métadonnées en base. */
export async function enregistrerFichier(input: {
  contenu: Uint8Array;
  nom: string;
  typeMime: string;
  usage: string;
  utilisateurId: number | null;
}): Promise<FichierMeta> {
  const id = randomUUID();
  // Clé opaque et répartie en sous-dossiers : indépendante du nom d'origine et de l'utilisateur.
  const cle = `${input.usage}/${id.slice(0, 2)}/${id}`;
  await fileStore().put(cle, input.contenu, input.typeMime);
  const sha256 = createHash('sha256').update(input.contenu).digest('hex');
  try {
    await database().insert(fichiers).values({ id, cle, nomOriginal: input.nom, typeMime: input.typeMime, taille: input.contenu.byteLength, sha256, usage: input.usage, creeParUtilisateurId: input.utilisateurId });
  } catch (e) {
    await fileStore().delete(cle);
    throw e;
  }
  return { id, nomOriginal: input.nom, typeMime: input.typeMime, taille: input.contenu.byteLength };
}

export async function lireFichier(id: string): Promise<(FichierMeta & { flux: ReadableStream<Uint8Array> }) | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [f] = await database().select().from(fichiers).where(eq(fichiers.id, id));
  if (!f) return null;
  const flux = await fileStore().get(f.cle);
  return flux ? { id: f.id, nomOriginal: f.nomOriginal, typeMime: f.typeMime, taille: f.taille, flux } : null;
}

export async function supprimerFichier(id: string): Promise<void> {
  const [f] = await database().delete(fichiers).where(eq(fichiers.id, id)).returning({ cle: fichiers.cle });
  if (f) await fileStore().delete(f.cle);
}
