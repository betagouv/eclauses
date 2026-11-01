'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { registerComponent, setEnv, setSession, type ServerSession } from './gristAPI';
import { setNavigator } from './navigation';
import ComboBox from './components/ComboBox';

registerComponent('ComboBox', ComboBox);

/**
 * Prépare le contexte attendu par le code repris du widget (session, navigation, composants
 * partagés) avant d'afficher la page. Le contexte est posé pendant le rendu : les pages lisent
 * `gristAPI.getAuth()` de façon synchrone dans leurs effets.
 */
export interface HostProps {
  session: ServerSession | null;
  env: Record<string, string>;
}

export function LegacyHost({ session, env, children }: HostProps & { children: ReactNode }) {
  const router = useRouter();
  setSession(session);
  setEnv(env);
  setNavigator((path) => router.push(path));
  return <div className="component-container fr-container--fluid">{children}</div>;
}
