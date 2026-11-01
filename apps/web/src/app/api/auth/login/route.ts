import { NextResponse } from 'next/server';
import { z } from 'zod';
import { grist } from '@/server/config';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { resolveIdentity } from '@/server/auth/identity';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/server/auth/session';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';

const body = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(200) });

const GENERIC = 'Adresse email ou mot de passe invalide.';

// Pour un compte inconnu, on vérifie quand même un mot de passe factice : le temps de réponse ne doit
// pas révéler si l'adresse existe.
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword('mot de passe factice'));

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Entrées invalides (email ou mot de passe manquant).');
    const { email, password } = parsed.data;
    const mail = email.toLowerCase();

    rateLimit(`login:${clientIp(req)}:${mail}`);

    const [user] = await grist().sql<{ id: number; Hash_Password: string | null }>(
      'SELECT id, Hash_Password FROM Application_AuthUser WHERE lower(Email) = ?1 LIMIT 1',
      [mail],
    );
    const check = await verifyPassword(user?.Hash_Password ?? (await dummy()), password);
    if (!user || !check.ok) throw new HttpError(401, GENERIC);

    const session = await resolveIdentity(mail);
    if (!session) throw new HttpError(401, GENERIC);

    // Au premier passage, on remplace le SHA-256 sans sel par un hachage scrypt.
    const fields: Record<string, unknown> = { Derniere_connexion: Math.floor(Date.now() / 1000) };
    if (check.needsRehash) fields.Hash_Password = await hashPassword(password);
    const persist = grist().updateRecords('Application_AuthUser', [{ id: user.id, fields }]);
    // Le nouveau hachage doit être enregistré avant de répondre ; la date de connexion peut attendre.
    if (check.needsRehash) await persist;
    else persist.catch((e) => console.error('[login] date de connexion non enregistrée', e));

    const res = NextResponse.json(session);
    res.cookies.set(SESSION_COOKIE, await signSession(session), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  });
}
