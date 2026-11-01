import { NextResponse } from 'next/server';
import { assertSameOrigin, clientIp, currentSession, handle, rateLimit } from '@/server/http';
import { createRow, readTable } from '@/server/tables';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ table: string }> };

/** `GET /api/data/Marches?id=12&id=13` : lecture soumise à la politique d'accès de la table. */
export function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const actor = await currentSession();
    const { table } = await ctx.params;
    const ids = new URL(req.url).searchParams
      .getAll('id')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    return NextResponse.json(await readTable(actor, table, ids.length ? ids : undefined));
  });
}

/** Création d'une ligne. Les visiteurs anonymes (inscription, mot de passe oublié) sont limités en débit. */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const actor = await currentSession();
    if (!actor) await rateLimit(`create:${clientIp(req)}`, 10, 10 * 60_000);
    const { table } = await ctx.params;
    const id = await createRow(actor, table, await req.json().catch(() => null));
    return NextResponse.json({ id });
  });
}
