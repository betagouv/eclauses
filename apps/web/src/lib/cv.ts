/** Dépôt et retrait du CV depuis le navigateur : routes HTTP, car le fichier est contrôlé (type, taille) en flux côté serveur. */
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Erreur ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function uploadCV(beneficiaireId: number, file: File): Promise<{ attachmentId: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return json(await fetch(`/api/beneficiaires/${beneficiaireId}/cv`, { method: 'POST', body: form }));
}

export async function clearCV(beneficiaireId: number): Promise<void> {
  await json(await fetch(`/api/beneficiaires/${beneficiaireId}/cv`, { method: 'DELETE' }));
}
