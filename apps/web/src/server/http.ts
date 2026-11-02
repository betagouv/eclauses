import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { database } from './db/client';
import { readSession, SESSION_COOKIE, type Session } from './auth/session';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function currentSession(): Promise<Session | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new HttpError(401, 'Authentification requise.');
  return session;
}

/** Enveloppe commune des routes : convertit les erreurs en réponses JSON sans fuite d'information. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ message: e.message, details: e.details }, { status: e.status });
    }
    console.error('[erreur]', e);
    return NextResponse.json({ message: 'Erreur interne.' }, { status: 500 });
  }
}

/**
 * Protection CSRF des requêtes qui modifient des données : le cookie est en SameSite=Lax, et on exige
 * en plus que l'en-tête Origin (envoyé par les navigateurs sur les requêtes POST/PATCH/DELETE)
 * corresponde à l'hôte de la requête.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin) throw new HttpError(403, 'Origine manquante.');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Origine refusée.');
}

/**
 * Adresse du client. `X-Forwarded-For` est librement forgeable par le client : seules les entrées ajoutées par nos
 * propres proxys sont fiables, c'est-à-dire les dernières. `TRUSTED_PROXIES` (défaut 1) = nombre de proxys devant
 * l'application ; on prend l'adresse située juste avant eux.
 */
export const clientIp = (req: Request): string => {
  const chain = (req.headers.get('x-forwarded-for') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const proxies = Math.max(0, Number(process.env.TRUSTED_PROXIES ?? 1) || 0);
  if (!chain.length) return 'local';
  return chain[Math.max(0, chain.length - Math.max(1, proxies))]!;
};

/**
 * Lit un corps `multipart` en refusant d'abord ce qui dépasse `max` octets : la taille annoncée est exigée (un envoi
 * sans `Content-Length` est refusé) pour ne jamais charger en mémoire un corps de taille inconnue.
 */
export async function formDataLimite(req: Request, max: number): Promise<FormData | null> {
  const declared = req.headers.get('content-length');
  if (declared === null || !/^\d+$/.test(declared)) throw new HttpError(411, 'Taille de la requête manquante.');
  if (Number(declared) > max) throw new HttpError(413, 'Fichier trop volumineux.');
  return req.formData().catch(() => null);
}

/**
 * Limiteur partagé entre instances (compteur en base) : `max` essais par `windowMs` et par clé. Le
 * compteur est incrémenté de façon atomique ; la fenêtre redémarre à son expiration.
 */
export async function rateLimit(key: string, max = 8, windowMs = 15 * 60_000): Promise<void> {
  const rows = await database().execute<{ compteur: number }>(sql`
    insert into limites_debit (cle, compteur, fin_fenetre)
    values (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    on conflict (cle) do update set
      compteur = case when limites_debit.fin_fenetre < now() then 1 else limites_debit.compteur + 1 end,
      fin_fenetre = case when limites_debit.fin_fenetre < now() then now() + ${windowMs} * interval '1 millisecond' else limites_debit.fin_fenetre end
    returning compteur`);
  if (Number(rows[0]?.compteur) > max) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard.');
}
