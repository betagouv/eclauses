'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { LegacyHost, type HostProps } from './LegacyHost';

/** Chaque page reprise du widget est chargée à la demande (un seul gros fichier par page). */
export const LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
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
