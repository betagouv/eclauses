import { NextResponse } from 'next/server';
import { z } from 'zod';
import { grist } from '@/server/config';
import { hashPassword } from '@/server/auth/password';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';

const body = z.object({ token: z.string().trim().min(20).max(64), password: z.string().min(8).max(200) });

/** Lien reçu par courrier : vérifier le jeton sans le consommer (la page l'affiche avant de demander le mot de passe). */
export function GET(req: Request) {
  return handle(async () => {
    rateLimit(`reset-check:${clientIp(req)}`, 30, 15 * 60_000);
    const token = new URL(req.url).searchParams.get('token') ?? '';
    const [row] = token.length >= 20 ? await grist().records('Application_Password_Reset', { filter: { Token: [token] } }) : [];
    const used = !!row && row.Used === true;
    const valid = !!row && row.Expire !== true;
    return NextResponse.json({
      valid,
      used,
      type: valid ? String(row!.Type ?? '') : null,
      email: valid ? maskEmail(String(row!.Email)) : null,
    });
  });
}

/** Définit (ou redéfinit) le mot de passe d'un compte à partir du jeton reçu par courrier. */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    const { token, password } = parsed.data;

    const [reset] = await grist().records('Application_Password_Reset', { filter: { Token: [token] } });
    if (!reset || reset.Expire === true) throw new HttpError(400, 'Lien invalide ou expiré.');
    const email = String(reset.Email).trim().toLowerCase();

    const hash = await hashPassword(password);
    const [user] = await grist().sql<{ id: number }>('SELECT id FROM Application_AuthUser WHERE lower(Email) = ?1 LIMIT 1', [email]);
    if (user) await grist().updateRecords('Application_AuthUser', [{ id: user.id, fields: { Hash_Password: hash } }]);
    else await grist().addRecords('Application_AuthUser', [{ Email: email, Hash_Password: hash }]);

    // Le lien ne sert qu'une fois.
    await grist().updateRecords('Application_Password_Reset', [{ id: reset.id, fields: { Used: true } }]);
    return NextResponse.json({ status: 'ok' });
  });
}

function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}
