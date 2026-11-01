import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/server/auth/password';

describe('mots de passe', () => {
  it('vérifie un mot de passe haché avec scrypt', async () => {
    const stored = await hashPassword('Un mot de passe solide 42');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword(stored, 'Un mot de passe solide 42')).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword(stored, 'autre')).ok).toBe(false);
  });

  it('accepte le format historique SHA-256 et demande un nouveau hachage', async () => {
    const legacy = createHash('sha256').update('ancien-mdp').digest('hex');
    expect(await verifyPassword(legacy, 'ancien-mdp')).toEqual({ ok: true, needsRehash: true });
    expect((await verifyPassword(legacy, 'mauvais')).ok).toBe(false);
  });

  it('refuse les valeurs vides ou inconnues', async () => {
    expect((await verifyPassword(null, 'x')).ok).toBe(false);
    expect((await verifyPassword('n-importe-quoi', 'x')).ok).toBe(false);
    expect((await verifyPassword('', '')).ok).toBe(false);
  });
});
