import type { ReactNode } from 'react';
import type { ServerSession } from '@/legacy/gristAPI';
import { Annuaire } from './beneficiaire/Annuaire';
import { BeneficiaireHome } from './beneficiaire/Home';
import { Marches } from './beneficiaire/Marches';
import { Profil } from './beneficiaire/Profil';

/**
 * Pages rendues par le serveur (le contenu est dans le HTML). Toute page absente d'ici garde l'ancien
 * mode : coquille serveur, puis chargement du code et des données dans le navigateur (`PageHost`).
 */
export const SERVER_PAGES: Record<string, (props: { session: ServerSession }) => ReactNode | Promise<ReactNode>> = {
  'beneficiaire-home': () => <BeneficiaireHome />,
  'beneficiaire-profil': ({ session }) => <Profil session={session} />,
  'beneficiaire-marches': ({ session }) => <Marches session={session} />,
  'beneficiaire-annuaire': ({ session }) => <Annuaire session={session} />,
};
