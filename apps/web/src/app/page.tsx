import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Accueil } from '@/features/accueil/Accueil';
import { homeOf, pageById } from '@/lib/pages';
import { currentSession } from '@/server/http';
import { activeSpace } from '@/server/space';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Eclauses' };

/** Visiteur : page d'accueil publique. Utilisateur connecté : accueil de son espace. */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Anciens liens (« ?page=inscription-candidat&marche=12 ») : déjà publiés dans des consultations et des courriers.
  const { page, ...rest } = await searchParams;
  const legacy = typeof page === 'string' ? pageById(page) : undefined;
  if (legacy && legacy.id !== 'accueil') {
    const qs = new URLSearchParams(Object.entries(rest).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : (v ?? []).map((x) => [k, x]))));
    redirect(`/${legacy.id}${qs.size ? `?${qs}` : ''}`);
  }
  const session = await currentSession();
  const space = await activeSpace(session);
  if (space) redirect(`/${homeOf(space)}`);
  if (session?.roles.includes('admin')) redirect('/admin');
  return (
    <AppShell session={session} currentPage="accueil">
      <Accueil session={session} />
    </AppShell>
  );
}
