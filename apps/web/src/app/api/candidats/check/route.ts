import { NextResponse } from 'next/server';
import { z } from 'zod';
import { grist } from '@/server/config';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';
import { listIds } from '@/server/policies/common';

const body = z.object({
  email: z.string().trim().email().max(320),
  lotIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheIds: z.array(z.number().int().positive()).max(200).optional(),
  marcheId: z.number().int().positive().optional(),
});

/**
 * Avant l'inscription d'un candidat : son adresse est-elle déjà connue ? Si oui, les marchés choisis
 * sont ajoutés à sa liste de candidatures (comme le faisait le flux n8n) et la page n'a pas à créer de compte.
 */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(`candidat-check:${clientIp(req)}`, 20, 15 * 60_000);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Requête invalide.');
    const email = parsed.data.email.toLowerCase();
    const wanted = [...new Set([...(parsed.data.lotIds ?? []), ...(parsed.data.marcheIds ?? [])])];

    const [existing] = await grist().records('Repondants', { filter: { Email: [email] }, limit: 1 });
    if (!existing) return NextResponse.json({ status: 'new' });

    // Seuls les marchés publiés peuvent être ajoutés ainsi.
    const published = wanted.length
      ? (await grist().records('Marches', { filter: { id: wanted, Statut: ['En attente de notification'] } })).map((m) => m.id)
      : [];
    const next = [...new Set([...listIds(existing.Candidat_aux_marches), ...published])];
    if (published.length) {
      await grist().updateRecords('Repondants', [{ id: existing.id, fields: { Candidat_aux_marches: ['L', ...next] } }]);
    }
    return NextResponse.json({ status: 'exist' });
  });
}
