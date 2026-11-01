import { NextResponse } from 'next/server';
import { SPACE_COOKIE } from '@/server/space';
import { currentSession } from '@/server/http';
import { homeOf, SPACES } from '@/legacy/pages';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ role: string }> };

/** Changement d'espace (bénéficiaire, acheteur, candidat) pour un utilisateur ayant plusieurs rôles. */
export async function GET(req: Request, ctx: Ctx) {
  const { role } = await ctx.params;
  const session = await currentSession();
  const space = SPACES.find((s) => s.role === role);
  // Derrière un proxy, l'URL de la requête est interne : on redirige vers l'adresse publique.
  const origin = (process.env.PUBLIC_URL ?? new URL(req.url).origin).replace(/\/$/, '');
  if (!session || !space || !session.roles.includes(space.role)) return NextResponse.redirect(new URL('/', origin));
  const res = NextResponse.redirect(new URL(`/${homeOf(space.role)}`, origin));
  res.cookies.set(SPACE_COOKIE, space.role, { path: '/', sameSite: 'lax', maxAge: 365 * 86400 });
  return res;
}
