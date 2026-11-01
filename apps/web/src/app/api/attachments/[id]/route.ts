import { canReadCv } from '@/server/beneficiaires';
import { handle, HttpError, requireSession } from '@/server/http';
import { lireFichier } from '@/server/services/fichiers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const INLINE = new Set(['application/pdf']);

/** Téléchargement d'un CV, relayé par le serveur après contrôle des droits : aucun lien public. */
export function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const id = (await ctx.params).id;
    if (!(await canReadCv(session, id))) throw new HttpError(404, 'Fichier introuvable.');
    const fichier = await lireFichier(id);
    if (!fichier) throw new HttpError(404, 'Fichier introuvable.');

    const name = encodeURIComponent(fichier.nomOriginal);
    return new Response(fichier.flux, {
      headers: {
        'Content-Type': fichier.typeMime,
        'Content-Length': String(fichier.taille),
        'Content-Disposition': `${INLINE.has(fichier.typeMime) ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  });
}
