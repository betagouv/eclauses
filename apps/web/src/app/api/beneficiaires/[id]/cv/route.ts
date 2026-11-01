import { NextResponse } from 'next/server';
import { config, grist } from '@/server/config';
import { checkCv } from '@/server/cv';
import { setOwnCv } from '@/server/beneficiaires';
import { assertSameOrigin, handle, HttpError, requireSession } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

async function ownId(ctx: Ctx, sessionBenefId: number | null): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide.');
  if (sessionBenefId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');
  return id;
}

/**
 * Dépôt du CV : le serveur reçoit le fichier, le contrôle, l'envoie à Grist puis l'associe à la fiche,
 * en une seule opération. Plus de jeton Grist côté navigateur, plus de passage par n8n.
 */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requireSession();
    const id = await ownId(ctx, session.beneficiaireId);

    const max = config().CV_MAX_BYTES;
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > max + 64 * 1024) throw new HttpError(413, 'Fichier trop volumineux.');

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Aucun fichier reçu.');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkCv(bytes, file.name, max);
    if (!check.ok) throw new HttpError(422, check.reason ?? 'Fichier refusé.');

    const attachmentId = await grist().uploadAttachment(new Blob([bytes], { type: check.mime }), check.fileName!);
    await setOwnCv(session, id, attachmentId);
    return NextResponse.json({ attachmentId });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requireSession();
    await setOwnCv(session, await ownId(ctx, session.beneficiaireId), null);
    return NextResponse.json({ ok: true });
  });
}
