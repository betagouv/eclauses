import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Mot de passe à usage unique basé sur le temps (RFC 6238, HMAC-SHA1, 6 chiffres, pas de 30 s), compatible avec les applications d'authentification usuelles. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error('Secret invalide.');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateSecret = (): string => base32Encode(randomBytes(20));

export const stepOf = (nowMs: number): number => Math.floor(nowMs / 1000 / STEP_SECONDS);

export function codeFor(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Pas du code accepté (le pas courant, ou l'un des voisins pour tolérer le décalage d'horloge), ou `null`.
 * `lastStep` : un pas déjà utilisé, ou plus ancien, est refusé (un code espionné ne se rejoue pas).
 */
export function verifyCode(secret: string, code: string, nowMs = Date.now(), lastStep: number | null = null): number | null {
  const given = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const current = stepOf(nowMs);
  for (const step of [current, current - 1, current + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    const expected = Buffer.from(codeFor(secret, step));
    if (timingSafeEqual(expected, Buffer.from(given))) return step;
  }
  return null;
}

export const otpauthUrl = (email: string, secret: string, issuer = 'Eclauses'): string =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
