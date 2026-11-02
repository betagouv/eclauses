import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const LEN = 32;

/** Format : `scrypt$N$r$p$sel(base64)$hash(base64)`. */
export const MOT_DE_PASSE_MIN = 10;
export const MESSAGE_MOT_DE_PASSE = `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères.`;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(plain, salt, LEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export interface PasswordCheck {
  ok: boolean;
  /** Vrai si le mot de passe est valide mais stocké au format historique (SHA-256 sans sel). */
  needsRehash: boolean;
}

const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

export async function verifyPassword(stored: string | null | undefined, plain: string): Promise<PasswordCheck> {
  const fail = { ok: false, needsRehash: false };
  if (!stored || !plain) return fail;

  if (LEGACY_SHA256.test(stored)) {
    const candidate = createHash('sha256').update(plain).digest();
    const expected = Buffer.from(stored, 'hex');
    return timingSafeEqual(candidate, expected) ? { ok: true, needsRehash: true } : fail;
  }

  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return fail;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(plain, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return timingSafeEqual(actual, expected) ? { ok: true, needsRehash: false } : fail;
}
