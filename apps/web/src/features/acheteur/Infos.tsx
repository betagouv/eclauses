import type { ServerSession } from '@/legacy/gristAPI';
import { acheteurBase } from '@/server/page-data';
import InfosForm from './InfosForm';

/** « Mes informations » (acheteur) : la fiche de l'entité est lue côté serveur. */
export async function Infos({ session }: { session: ServerSession }) {
  const { org, error } = await acheteurBase(session as never);
  return <InfosForm initial={{ rec: org, error: org ? null : (error ?? 'Impossible d’identifier votre fiche acheteur.') }} session={session} />;
}
