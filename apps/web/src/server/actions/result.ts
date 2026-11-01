/**
 * Résultat d'une Server Action. En production Next.js masque le message d'une exception levée par une
 * action : les erreurs attendues (droits, validation) sont donc renvoyées comme valeur.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const status = (e as { status?: number }).status;
    // Seules les erreurs que nous avons levées (HttpError) ont un message destiné à l'utilisateur.
    if (typeof status === 'number' && status < 500) return { ok: false, message: (e as Error).message };
    console.error('[action]', e);
    return { ok: false, message: 'Une erreur est survenue, veuillez réessayer.' };
  }
}
