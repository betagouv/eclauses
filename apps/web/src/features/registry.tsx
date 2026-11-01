import type { ReactNode } from 'react';
import type { ServerSession } from '@/legacy/gristAPI';
import { AcheteurHome } from './acheteur/Home';
import { Annuaire as AcheteurAnnuaire } from './acheteur/Annuaire';
import { Declaration } from './acheteur/Declaration';
import { Detail } from './acheteur/Detail';
import { Infos } from './acheteur/Infos';
import { Marches as AcheteurMarches } from './acheteur/Marches';
import { Modification } from './acheteur/Modification';
import { Statistiques } from './acheteur/Statistiques';
import { Annuaire } from './beneficiaire/Annuaire';
import { BeneficiaireHome } from './beneficiaire/Home';
import { Marches } from './beneficiaire/Marches';
import { Profil } from './beneficiaire/Profil';

/**
 * Pages rendues par le serveur (le contenu est dans le HTML). Toute page absente d'ici garde l'ancien
 * mode : coquille serveur, puis chargement du code et des données dans le navigateur (`PageHost`).
 */
export type ServerPageProps = { session: ServerSession; query: Record<string, string | undefined> };

export const SERVER_PAGES: Record<string, (props: ServerPageProps) => ReactNode | Promise<ReactNode>> = {
  'acheteur-home': ({ session }) => <AcheteurHome session={session} />,
  'acheteur-marches': ({ session }) => <AcheteurMarches session={session} />,
  'acheteur-annuaire': ({ session }) => <AcheteurAnnuaire session={session} />,
  'acheteur-infos': ({ session }) => <Infos session={session} />,
  'acheteur-statistiques': ({ session }) => <Statistiques session={session} />,
  'acheteur-marches-declaration': ({ session }) => <Declaration session={session} />,
  'acheteur-marches-modification': ({ session, query }) => <Modification session={session} query={query} />,
  'acheteur-marches-detail': ({ session, query }) => <Detail session={session} query={query} />,
  'beneficiaire-home': () => <BeneficiaireHome />,
  'beneficiaire-profil': ({ session }) => <Profil session={session} />,
  'beneficiaire-marches': ({ session }) => <Marches session={session} />,
  'beneficiaire-annuaire': ({ session }) => <Annuaire session={session} />,
};
