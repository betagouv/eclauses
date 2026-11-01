import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Accueil } from '@/features/accueil/Accueil';
import { homeOf } from '@/legacy/pages';
import { currentSession } from '@/server/http';
import { activeSpace } from '@/server/space';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Eclauses' };

/** Visiteur : page d'accueil publique. Utilisateur connecté : accueil de son espace. */
export default async function Home() {
  const session = await currentSession();
  const space = await activeSpace(session);
  if (space) redirect(`/${homeOf(space)}`);
  return (
    <AppShell session={session} currentPage="accueil">
      <Accueil session={session} />
    </AppShell>
  );
}
