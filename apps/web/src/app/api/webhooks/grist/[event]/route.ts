import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { EVENTS } from '@/server/events/handlers';
import { handle, HttpError } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ event: string }> };

function authorized(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Réception des webhooks Grist (remplace les webhooks n8n). Le secret est configuré dans l'en-tête
 * `Authorization` du webhook Grist. Toujours 200 une fois le lot lu : les échecs de ligne sont
 * journalisés, car Grist rejouerait sinon tout le lot et enverrait des doublons.
 */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    if (!authorized(req)) throw new HttpError(401, 'Non autorisé.');
    const { event } = await ctx.params;
    const handler = Object.hasOwn(EVENTS, event) ? EVENTS[event] : undefined;
    if (!handler) throw new HttpError(404, 'Événement inconnu.');
    const rows = await req.json().catch(() => null);
    if (!Array.isArray(rows)) throw new HttpError(400, 'Charge utile invalide : liste de lignes attendue.');
    return NextResponse.json(await handler(rows));
  });
}
