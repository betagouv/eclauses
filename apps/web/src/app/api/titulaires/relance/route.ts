import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, handle, HttpError, requireSession } from '@/server/http';
import { relancerTitulaire } from '@/server/services/marches-acheteur';

const body = z.object({ lot_id: z.number().int().positive().optional(), marche_id: z.number().int().positive().optional() });

/** Relance d'un titulaire qui n'a pas déclaré ses bénéficiaires. Réservée à l'acheteur du marché (voir le service). */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requireSession();
    const parsed = body.safeParse(await req.json().catch(() => null));
    const marcheId = parsed.success ? (parsed.data.lot_id ?? parsed.data.marche_id) : undefined;
    if (!marcheId) throw new HttpError(400, 'Marché manquant.');
    await relancerTitulaire(session, marcheId);
    return NextResponse.json({ ok: true });
  });
}
