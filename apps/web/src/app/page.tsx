import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageHost } from '@/legacy/PageHost';
import { homeOf } from '@/legacy/pages';
import { currentSession } from '@/server/http';
import { publicEnv } from '@/server/env';
import { activeSpace } from '@/server/space';

export const dynamic = 'force-dynamic';

/** Visiteur : page d'accueil publique. Utilisateur connecté : accueil de son espace. */
export default async function Home() {
  const session = await currentSession();
  const space = await activeSpace(session);
  if (space) redirect(`/${homeOf(space)}`);
  return (
    <AppShell session={session} currentPage="accueil">
      <PageHost id="accueil" session={session} env={publicEnv()} />
    </AppShell>
  );
}
