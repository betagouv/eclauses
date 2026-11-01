import { notFound } from 'next/navigation';
import { ResourceList } from '@/features/admin/ResourceList';
import { list } from '@/server/admin/crud';
import { resourceByKey } from '@/server/admin/resources';

type Props = { params: Promise<{ ressource: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: Props) {
  const resource = resourceByKey((await params).ressource);
  if (!resource) notFound();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  const filters = Object.fromEntries(Object.keys(sp).filter((k) => k.startsWith('f_')).map((k) => [k.slice(2), one(k)]));
  const query = { q: one('q'), filters };
  const result = await list(resource, { ...query, page: Number(one('page')) || 1 });
  return <ResourceList resource={resource} result={result} query={query} ok={one('ok') || undefined} />;
}
