import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { resolveIdentity } from '@/server/auth/identity';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSession } from '@/server/auth/session';
import { database } from '@/server/db/client';
import { utilisateurs } from '@/server/db/schema';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';
import { utilisateurParEmail } from '@/server/services/comptes';

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

    await rateLimit(`login:${clientIp(req)}:${mail}`);
    // Limite par compte, quelle que soit l'adresse : freine aussi une attaque répartie sur de nombreuses adresses IP.
    await rateLimit(`login-compte:${mail}`, 40, 60 * 60_000);

    const user = await utilisateurParEmail(mail);
    const check = await verifyPassword(user?.motDePasseHash ?? (await dummy()), password);
    if (!user || !check.ok) throw new HttpError(401, GENERIC);

    const session = await resolveIdentity(user.id, user.email);
    if (!session) throw new HttpError(401, GENERIC);

    // Au premier passage, on remplace un hachage historique (SHA-256 sans sel) par scrypt.
    const rehash = check.needsRehash ? { motDePasseHash: await hashPassword(password) } : {};
    await database().update(utilisateurs).set({ derniereConnexionLe: new Date(), ...rehash }).where(eq(utilisateurs.id, user.id));

    const res = NextResponse.json(session);
    res.cookies.set(SESSION_COOKIE, await createSession(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  });
}
