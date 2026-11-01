import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '@/server/db/client';
import { candidatures, marches, repondants } from '@/server/db/schema';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';
import { utilisateurParEmail } from '@/server/services/comptes';

const body = z.object({
  email: z.string().trim().email().max(320),
  lotIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheId: z.number().int().positive().optional(),
});

/**
 * Avant l'inscription d'un candidat : son adresse est-elle déjà connue ? Si oui, les marchés choisis
 * sont ajoutés à ses candidatures et la page n'a pas à créer de compte.
 */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await rateLimit(`candidat-check:${clientIp(req)}`, 20, 15 * 60_000);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Requête invalide.');
    const wanted = [...new Set([...(parsed.data.lotIds ?? []), ...(parsed.data.marcheIds ?? [])])];

    const user = await utilisateurParEmail(parsed.data.email);
    const db = database();
    const [existing] = user ? await db.select({ id: repondants.id }).from(repondants).where(eq(repondants.utilisateurId, user.id)) : [];
    if (!existing) return NextResponse.json({ status: 'new' });

    // Seuls les marchés publiés peuvent être ajoutés ainsi.
    const published = wanted.length ? await db.select({ id: marches.id }).from(marches).where(and(inArray(marches.id, wanted), eq(marches.statut, 'en_attente_notification'))) : [];
    if (published.length) {
      await db.insert(candidatures).values(published.map((m) => ({ marcheId: m.id, repondantId: existing.id }))).onConflictDoNothing();
    }
    return NextResponse.json({ status: 'exist' });
  });
}
