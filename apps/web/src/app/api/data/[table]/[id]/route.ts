import { NextResponse } from 'next/server';
import { assertSameOrigin, currentSession, handle, HttpError } from '@/server/http';
import { removeRow, updateRow } from '@/server/tables';

type Ctx = { params: Promise<{ table: string; id: string }> };

async function rowId(ctx: Ctx): Promise<{ table: string; id: number }> {
  const { table, id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identifiant invalide.');
  return { table, id: n };
}

export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const { table, id } = await rowId(ctx);
    await updateRow(await currentSession(), table, id, await req.json().catch(() => null));
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const { table, id } = await rowId(ctx);
    await removeRow(await currentSession(), table, id);
    return NextResponse.json({ ok: true });
  });
}
