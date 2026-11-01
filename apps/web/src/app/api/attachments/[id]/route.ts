import { grist } from '@/server/config';
import { canReadAttachment } from '@/server/beneficiaires';
import { handle, HttpError, requireSession } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const INLINE = new Set(['application/pdf']);

/** Téléchargement d'un CV, relayé par le serveur après contrôle des droits : aucun jeton dans l'URL. */
export function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide.');
    if (!(await canReadAttachment(session, id))) throw new HttpError(404, 'Fichier introuvable.');

    const upstream = await grist().downloadAttachment(id);
    const meta = await grist().attachmentMeta(id).catch(() => null);
    const type = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const name = encodeURIComponent(meta?.fileName ?? `cv-${id}`);
    const disposition = INLINE.has(type.split(';')[0]!) ? 'inline' : 'attachment';

    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${name}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  });
}
