import { NextResponse } from 'next/server';
import { config } from '@/server/config';
import { checkCv } from '@/server/cv';
import { setOwnCv } from '@/server/beneficiaires';
import { database } from '@/server/db/client';
import { utilisateurs } from '@/server/db/schema';
import { sql } from 'drizzle-orm';
import { assertSameOrigin, handle, HttpError, requireSession } from '@/server/http';
import { enregistrerFichier, supprimerFichier } from '@/server/services/fichiers';

type Ctx = { params: Promise<{ id: string }> };

async function ownId(ctx: Ctx, sessionBenefId: number | null): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide.');
  if (sessionBenefId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');
  return id;
}

/** Dépôt du CV : le serveur reçoit le fichier, le contrôle, l'enregistre puis l'associe à la fiche. */
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

    const [user] = await database().select({ id: utilisateurs.id }).from(utilisateurs).where(sql`lower(${utilisateurs.email}) = ${session.email}`);
    const fichier = await enregistrerFichier({ contenu: bytes, nom: check.fileName!, typeMime: check.mime!, usage: 'cv', utilisateurId: user?.id ?? null });
    try {
      await setOwnCv(session, id, fichier.id);
    } catch (e) {
      await supprimerFichier(fichier.id);
      throw e;
    }
    return NextResponse.json({ attachmentId: fichier.id });
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

