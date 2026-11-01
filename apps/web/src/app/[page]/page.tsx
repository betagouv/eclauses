import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { SERVER_PAGES } from '@/features/registry';
import { PageHost } from '@/legacy/PageHost';
import { pageById } from '@/legacy/pages';
import { currentSession } from '@/server/http';
import { publicEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ page: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const def = pageById((await params).page);
  return { title: def ? `${def.title} - Eclauses` : 'Eclauses' };
}

export default async function Page({ params, searchParams }: Props) {
  const { page } = await params;
  const def = pageById(page);
  if (!def || def.id === 'accueil') notFound();

  const session = await currentSession();
  if (def.auth && !session) redirect(`/login?next=${def.id}`);
  if (def.role && !session?.roles.includes(def.role)) redirect('/');

  const render = Object.hasOwn(SERVER_PAGES, def.id) ? SERVER_PAGES[def.id] : undefined;
  return (
    <AppShell session={session} currentPage={def.id}>
      {render && session ? await render({ session, query: Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) }) : <PageHost id={def.id} session={session} env={publicEnv()} />}
    </AppShell>
  );
}
