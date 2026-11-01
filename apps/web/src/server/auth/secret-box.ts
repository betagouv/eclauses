import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Chiffrement (AES-256-GCM) des secrets stockés en base. Format : `v1.<iv>.<étiquette>.<contenu>` en base64url. */
function key(): Buffer {
  const hex = process.env.MFA_ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Configuration invalide : MFA_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux.');
  return Buffer.from(hex, 'hex');
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('Secret illisible.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
