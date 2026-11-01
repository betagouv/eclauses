import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, clientIp, handle, HttpError, rateLimit } from '@/server/http';
import { consommerJeton, etatJeton } from '@/server/services/comptes';

const body = z.object({ token: z.string().trim().min(20).max(128), password: z.string().min(8).max(200) });

/** Lien reçu par courrier : vérifier le jeton sans le consommer (la page l'affiche avant de demander le mot de passe). */
export function GET(req: Request) {
  return handle(async () => {
    await rateLimit(`reset-check:${clientIp(req)}`, 30, 15 * 60_000);
    const etat = await etatJeton(new URL(req.url).searchParams.get('token') ?? '');
    return NextResponse.json({
      valid: etat.valide,
      used: etat.utilise,
      // La page distingue la création d'un espace (« creat ») d'une réinitialisation.
      type: etat.valide ? (etat.objectif === 'activation' ? 'creat' : 'reset') : null,
      email: etat.valide ? maskEmail(etat.email ?? '') : null,
    });
  });
}

/** Définit (ou redéfinit) le mot de passe d'un compte à partir du jeton reçu par courrier. */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (!(await consommerJeton(parsed.data.token, parsed.data.password))) throw new HttpError(400, 'Lien invalide ou expiré.');
    return NextResponse.json({ status: 'ok' });
  });
}

function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}
