import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { config } from '../config';

export const SESSION_COOKIE = 'eclauses_session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const sessionSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.enum(['beneficiaire', 'repondant', 'acheteur'])),
  beneficiaireId: z.number().int().nullable(),
  repondantId: z.number().int().nullable(),
  acheteurId: z.number().int().nullable(),
  acheteurEntiteId: z.number().int().nullable(),
});

export type Session = z.infer<typeof sessionSchema>;

const key = () => new TextEncoder().encode(config().SESSION_SECRET);

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    const parsed = sessionSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
