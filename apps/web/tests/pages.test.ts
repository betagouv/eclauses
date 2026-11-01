import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES } from '@/lib/pages';

describe('registre des pages', () => {
  const server = readFileSync(new URL('../src/features/registry.tsx', import.meta.url), 'utf8');
  // L'accueil public a sa propre route (`app/page.tsx`).
  const dedicated = new Set(['accueil']);
  const rendered = (id: string) => server.includes(`'${id}':`) || new RegExp(`\\b${id}: `).test(server);

  it('chaque page déclarée est rendue par le serveur, une seule fois', () => {
    for (const page of PAGES.filter((p) => !dedicated.has(p.id))) {
      expect(rendered(page.id), `${page.id} : aucun rendu`).toBe(true);
      const count = server.split(`'${page.id}':`).length - 1 + (new RegExp(`^  ${page.id}: `, 'm').test(server) ? 1 : 0);
      expect(count, `${page.id} : défini ${count} fois`).toBe(1);
    }
  });

  it('chaque page de l’espace a un rôle et les identifiants sont uniques', () => {
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    for (const page of PAGES.filter((p) => /^(acheteur|repondant|beneficiaire)-/.test(p.id))) {
      expect(page.auth, page.id).toBe(true);
      expect(page.id.startsWith(`${page.role}-`), page.id).toBe(true);
    }
  });

  it('les pages réservées à un espace sont dans le registre protégé, les pages publiques dans le registre public', () => {
    const [authedSection, publicSection] = [server.slice(server.indexOf('export const SERVER_PAGES')), server.slice(server.indexOf('export const PUBLIC_SERVER_PAGES'), server.indexOf('export const SERVER_PAGES'))];
    for (const page of PAGES.filter((p) => !dedicated.has(p.id))) {
      const inAuthed = authedSection.includes(`'${page.id}':`);
      const inPublic = new RegExp(`'${page.id}':|\\b${page.id}: `).test(publicSection);
      expect(page.auth ? inAuthed && !inPublic : inPublic && !inAuthed, page.id).toBe(true);
    }
  });
});
