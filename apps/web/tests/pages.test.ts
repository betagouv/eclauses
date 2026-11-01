import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES } from '@/legacy/pages';

describe('registre des pages', () => {
  const host = readFileSync(new URL('../src/legacy/PageHost.tsx', import.meta.url), 'utf8');

  it('chaque page déclarée a son module chargé par PageHost', () => {
    for (const page of PAGES) expect(host, page.id).toContain(`import('./pages/${page.id}')`);
  });

  it('chaque page de l’espace a un rôle et les identifiants sont uniques', () => {
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    for (const page of PAGES.filter((p) => /^(acheteur|repondant|beneficiaire)-/.test(p.id))) {
      expect(page.auth, page.id).toBe(true);
      expect(page.id.startsWith(`${page.role}-`), page.id).toBe(true);
    }
  });
});
