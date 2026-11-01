/**
 * Mémoire des notifications déjà envoyées. Un webhook Grist « update » se déclenche à chaque
 * modification de la ligne : sans cela, un marché resté « à valider » renverrait le courrier à
 * chaque édition. La mémoire est celle du processus : un redémarrage peut provoquer un doublon.
 * Pour une garantie forte, il faudra une table d'envois dans Grist.
 */
const seen = new Map<string, number>();
const TTL_MS = 24 * 60 * 60_000;

export function alreadySent(key: string): boolean {
  const at = seen.get(key);
  if (at && Date.now() - at < TTL_MS) return true;
  seen.delete(key);
  return false;
}

export function markSent(key: string): void {
  seen.set(key, Date.now());
  if (seen.size > 5000) for (const [k, t] of seen) if (Date.now() - t > TTL_MS) seen.delete(k);
}

/** L'état qui déclenchait l'envoi a disparu : un nouvel envoi redevient possible. */
export function reset(key: string): void {
  seen.delete(key);
}

/** Vide la mémoire (tests). */
export function clearAll(): void {
  seen.clear();
}
