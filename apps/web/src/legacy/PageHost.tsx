'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { LegacyHost, type HostProps } from './LegacyHost';

/** Chaque page reprise du widget est chargée à la demande (un seul gros fichier par page). */
export const LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  accueil: () => import('./pages/accueil'),
  login: () => import('./pages/login'),
  'mot-de-passe-oublie': () => import('./pages/mot-de-passe-oublie'),
  'reset-password': () => import('./pages/reset-password'),
  'inscription-candidat': () => import('./pages/inscription-candidat'),
  support: () => import('./pages/support'),
  'support-contact': () => import('./pages/support-contact'),
  statistiques: () => import('./pages/statistiques'),
  apropos: () => import('./pages/apropos'),
  cgu: () => import('./pages/cgu'),
  'mentions-legales': () => import('./pages/mentions-legales'),
  'donnees-personnelles': () => import('./pages/donnees-personnelles'),
  accessibilite: () => import('./pages/accessibilite'),
  'beneficiaire-home': () => import('./pages/beneficiaire-home'),
  'beneficiaire-profil': () => import('./pages/beneficiaire-profil'),
  'beneficiaire-marches': () => import('./pages/beneficiaire-marches'),
  'beneficiaire-annuaire': () => import('./pages/beneficiaire-annuaire'),
  'acheteur-home': () => import('./pages/acheteur-home'),
  'acheteur-marches': () => import('./pages/acheteur-marches'),
  'acheteur-annuaire': () => import('./pages/acheteur-annuaire'),
  'acheteur-infos': () => import('./pages/acheteur-infos'),
  'acheteur-statistiques': () => import('./pages/acheteur-statistiques'),
  'acheteur-marches-declaration': () => import('./pages/acheteur-marches-declaration'),
  'acheteur-marches-modification': () => import('./pages/acheteur-marches-modification'),
  'acheteur-marches-detail': () => import('./pages/acheteur-marches-detail'),
  'repondant-home': () => import('./pages/repondant-home'),
  'repondant-infos': () => import('./pages/repondant-infos'),
  'repondant-marches': () => import('./pages/repondant-marches'),
  'repondant-recherches': () => import('./pages/repondant-recherches'),
};

const COMPONENTS = Object.fromEntries(
  Object.entries(LOADERS).map(([id, load]) => [id, dynamic(load, { ssr: false })]),
) as Record<string, ComponentType>;

export function PageHost({ id, session, env }: HostProps & { id: string }) {
  const Page = COMPONENTS[id];
  if (!Page) return null;
  return (
    <LegacyHost session={session} env={env}>
      <Page />
    </LegacyHost>
  );
}
