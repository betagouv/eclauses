import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

export const clientIp = (req: Request): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Limiteur en mémoire (une seule instance) : `max` essais par `windowMs` et par clé. */
export function rateLimit(key: string, max = 8, windowMs = 15 * 60_000): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard.');
}
