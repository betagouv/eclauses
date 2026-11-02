import { describe, expect, it } from 'vitest';
import config from '../next.config';

describe('en-têtes de cache des pages publiques', () => {
  it('seules les pages statiques sont mises en cache, et seulement pour un visiteur sans session', async () => {
    const rules = await config.headers!();
    const cached = rules.filter((r) => r.headers.some((h) => h.key === 'Cache-Control'));
    expect(cached.map((r) => r.source).sort()).toEqual(['/', '/accessibilite', '/apropos', '/cgu', '/donnees-personnelles', '/mentions-legales', '/statistiques', '/support'].sort());
    for (const r of cached) {
      expect(r.missing?.[0]).toMatchObject({ type: 'cookie' });
      expect(r.headers.find((h) => h.key === 'Cache-Control')!.value).toMatch(/^public, max-age=0, s-maxage=\d+/);
    }
    for (const prive of ['/login', '/admin/x', '/api/auth/me', '/acheteur-marches']) expect(cached.some((r) => r.source === prive), prive).toBe(false);
  });
});
