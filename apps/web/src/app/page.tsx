import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Accueil } from '@/features/accueil/Accueil';
import { homeOf, pageById } from '@/lib/pages';
import { JsonLd } from '@/components/JsonLd';
import { metadataFor, SITE_NAME, siteUrl } from '@/lib/seo';
import { currentSession } from '@/server/http';
import { activeSpace } from '@/server/space';

export const dynamic = 'force-dynamic';
export const metadata = metadataFor('accueil');

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
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'GovernmentOrganization', name: 'Ministère de la Culture', url: 'https://www.culture.gouv.fr' },
            { '@type': 'WebSite', name: SITE_NAME, url: siteUrl(), inLanguage: 'fr-FR', publisher: { '@type': 'GovernmentOrganization', name: 'Ministère de la Culture' } },
          ],
        }}
      />
      <Accueil session={session} />
    </AppShell>
  );
}
