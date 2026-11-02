import { describe, expect, it } from 'vitest';
import { indexable, metadataFor, pagesIndexables } from '@/lib/seo';
import { PAGES } from '@/lib/pages';

describe('référencement', () => {
  it('seules des pages publiques utiles sont indexables : ni espaces connectés, ni formulaires de compte', () => {
    for (const p of PAGES.filter((x) => x.auth)) expect(indexable(p.id), p.id).toBe(false);
    for (const id of ['login', 'reset-password', 'mot-de-passe-oublie', 'support-contact', 'inconnue']) expect(indexable(id), id).toBe(false);
    expect(pagesIndexables()).toContain('accueil');
    expect(pagesIndexables()).not.toContain('login');
  });

  it('chaque page indexable a sa description, son adresse canonique sans paramètres et un partage complet', () => {
    const descriptions = new Set<string>();
    for (const id of pagesIndexables()) {
      const m = metadataFor(id);
      expect(m.description, id).toBeTruthy();
      expect(m.alternates?.canonical, id).toBe(id === 'accueil' ? '/' : `/${id}`);
      expect(m.openGraph, id).toBeTruthy();
      descriptions.add(String(m.description));
    }
    expect(descriptions.size).toBe(pagesIndexables().length);
  });

  it('les pages non indexables portent noindex', () => {
    expect(metadataFor('login').robots).toEqual({ index: false, follow: false });
    expect(metadataFor('page-inexistante').robots).toEqual({ index: false, follow: false });
  });
});
