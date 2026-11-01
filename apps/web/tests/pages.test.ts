import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES } from '@/legacy/pages';

describe('registre des pages', () => {
  const host = readFileSync(new URL('../src/legacy/PageHost.tsx', import.meta.url), 'utf8');

  const server = readFileSync(new URL('../src/features/registry.tsx', import.meta.url), 'utf8');
  // L'accueil public a sa propre route (`app/page.tsx`) et n'est ni dans le registre serveur ni dans PageHost.
  const dedicated = new Set(['accueil']);

  it('chaque page déclarée est rendue par le serveur ou chargée par PageHost, jamais les deux', () => {
    for (const page of PAGES.filter((p) => !dedicated.has(p.id))) {
      const inHost = host.includes(`import('./pages/${page.id}')`);
      const inServer = server.includes(`'${page.id}':`) || new RegExp(`\\b${page.id}: `).test(server);
      expect(inHost || inServer, `${page.id} : aucun rendu`).toBe(true);
      expect(inHost && inServer, `${page.id} : défini deux fois`).toBe(false);
    }
  });

  it('chaque page de l’espace a un rôle et les identifiants sont uniques', () => {
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    for (const page of PAGES.filter((p) => /^(acheteur|repondant|beneficiaire)-/.test(p.id))) {
      expect(page.auth, page.id).toBe(true);
      expect(page.id.startsWith(`${page.role}-`), page.id).toBe(true);
    }
  });
});
