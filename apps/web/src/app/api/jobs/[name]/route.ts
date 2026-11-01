import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle, HttpError } from '@/server/http';
import { JOBS } from '@/server/jobs';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ name: string }> };

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Tâches planifiées (conservation des données, nettoyage). À appeler par le planificateur de la
 * plateforme (Scaleway Jobs, cron) avec `Authorization: Bearer $CRON_SECRET`, de préférence une fois
 * par nuit, ou `all` pour tout enchaîner.
 */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    if (!authorized(req)) throw new HttpError(401, 'Non autorisé.');
    const { name } = await ctx.params;
    if (name === 'all') {
      const results = [];
      for (const job of Object.values(JOBS)) results.push(await job());
      return NextResponse.json({ results });
    }
    const job = Object.hasOwn(JOBS, name) ? JOBS[name] : undefined;
    if (!job) throw new HttpError(404, 'Tâche inconnue.');
    return NextResponse.json(await job());
  });
}
