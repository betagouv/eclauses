import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';
import { verifierCandidat } from '@/server/services/candidats';

const body = z.object({
  email: z.string().trim().email().max(320),
  lotIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheId: z.number().int().positive().optional(),
});

/** Avant l'inscription d'un candidat : son adresse est-elle déjà connue ? (voir `verifierCandidat`) */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await rateLimit(`candidat-check:${clientIp(req)}`, 20, 15 * 60_000);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Requête invalide.');
    const marcheIds = [...new Set([...(parsed.data.lotIds ?? []), ...(parsed.data.marcheIds ?? [])])];
    return NextResponse.json({ status: await verifierCandidat({ email: parsed.data.email, marcheIds }) });
  });
}
