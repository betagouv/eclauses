import type { Session as ServerSession } from '@/server/auth/session';
import { readTable } from '@/server/tables';
import InfosForm from './InfosForm';

/** « Mes informations » (répondant) : la fiche est lue côté serveur. */
export async function Infos({ session }: { session: ServerSession }) {
  const id = session.repondantId;
  const [rec] = id ? await readTable(session as never, 'Repondants', [id]) : [];
  return <InfosForm initial={{ rec: rec ?? null, error: id ? "Votre fiche n’est pas accessible." : 'Impossible d’identifier votre fiche répondant.' }} session={session} />;
}
