import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { PageHost } from '@/legacy/PageHost';
import { pageById } from '@/legacy/pages';
import { currentSession } from '@/server/http';
import { publicEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const def = pageById((await params).page);
  return { title: def ? `${def.title} - Eclauses` : 'Eclauses' };
}

export default async function Page({ params }: Props) {
  const { page } = await params;
  const def = pageById(page);
  if (!def || def.id === 'accueil') notFound();

  const session = await currentSession();
  if (def.auth && !session) redirect(`/login?next=${def.id}`);
  if (def.role && !session?.roles.includes(def.role)) redirect('/');

  return (
    <AppShell session={session} currentPage={def.id}>
      <PageHost id={def.id} session={session} env={publicEnv()} />
    </AppShell>
  );
}
