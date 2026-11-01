import { notFound } from 'next/navigation';
import { ResourceForm } from '@/features/admin/ResourceForm';
import { toView } from '@/features/admin/view';
import { get, options } from '@/server/admin/crud';
import { resourceByKey } from '@/server/admin/resources';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ ressource: string; id: string }> }) {
  const { ressource, id } = await params;
  const resource = resourceByKey(ressource);
  if (!resource) notFound();
  const row = await get(resource, decodeURIComponent(id));
  if (!row) notFound();
  const refOptions = Object.fromEntries(await Promise.all(resource.fields.filter((f) => f.ref).map(async (f) => [f.name, await options(f.ref!)] as const)));
  // Valeurs initiales sérialisables : identifiants de liste en texte (les champs `<select>` manipulent des chaînes).
  const initial = Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('__')));
  return (
    <>
      <h1 className="fr-h3">{resource.readOnly ? resource.label : `Modifier : ${resource.label}`} — {String(row.__label)}</h1>
      {resource.intro && <p className="fr-text--sm fr-text-mention--grey">{resource.intro}</p>}
      <ResourceForm view={toView(resource)} id={decodeURIComponent(id)} initial={initial} options={refOptions} />
    </>
  );
}
