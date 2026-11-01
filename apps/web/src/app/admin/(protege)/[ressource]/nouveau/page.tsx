import { notFound } from 'next/navigation';
import { ResourceForm } from '@/features/admin/ResourceForm';
import { toView } from '@/features/admin/view';
import { options } from '@/server/admin/crud';
import { resourceByKey } from '@/server/admin/resources';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ ressource: string }> }) {
  const resource = resourceByKey((await params).ressource);
  if (!resource || !resource.canCreate || resource.readOnly) notFound();
  const refOptions = Object.fromEntries(await Promise.all(resource.fields.filter((f) => f.ref).map(async (f) => [f.name, await options(f.ref!)] as const)));
  return (
    <>
      <h1 className="fr-h3">Nouveau : {resource.label}</h1>
      {resource.intro && <p className="fr-text--sm fr-text-mention--grey">{resource.intro}</p>}
      <ResourceForm view={toView(resource)} id={null} initial={{}} options={refOptions} />
    </>
  );
}
