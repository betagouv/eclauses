import Link from 'next/link';
import { labelOf, type ListResult, type Row } from '@/server/admin/crud';
import type { Resource } from '@/server/admin/types';

const fmt = (f: Resource['fields'][number], v: unknown, labels?: Record<string, string>): string => {
  if (v == null || v === '') return '—';
  switch (f.type) {
    case 'bool':
      return v ? 'Oui' : 'Non';
    case 'datetime':
      return new Date(String(v)).toLocaleString('fr-FR');
    case 'enum':
      return f.options?.[String(v)] ?? String(v);
    case 'ref':
      return labels?.[String(v)] ?? `#${String(v)}`;
    default: {
      const s = String(v);
      return s.length > 80 ? `${s.slice(0, 77)}…` : s;
    }
  }
};

const MESSAGES: Record<string, string> = { cree: 'Élément créé.', modifie: 'Modifications enregistrées.', supprime: 'Élément supprimé.' };

/** Liste paginée d'une ressource, avec recherche, filtres simples et liens vers la fiche. */
export function ResourceList({ resource, result, query, ok }: { resource: Resource; result: ListResult & { labels: Record<string, Record<string, string>> }; query: { q: string; filters: Record<string, string> }; ok?: string }) {
  const columns = resource.fields.filter((f) => f.list);
  const filterable = columns.filter((f) => f.type === 'bool' || f.type === 'enum');
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set('q', query.q);
    for (const [k, v] of Object.entries(query.filters)) if (v) p.set(`f_${k}`, v);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    return `/admin/${resource.key}${qs ? `?${qs}` : ''}`;
  };
  const idOf = (row: Row) => String(row[resource.idProp ?? 'id']);

  return (
    <>
      <h1 className="fr-h3">{resource.labelPluriel}</h1>
      {resource.intro && <p className="fr-text--sm fr-text-mention--grey">{resource.intro}</p>}
      {ok && MESSAGES[ok] && (
        <div className="fr-alert fr-alert--success fr-alert--sm fr-mb-2w" role="status">
          <p>{MESSAGES[ok]}</p>
        </div>
      )}
      <form method="get" className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom fr-mb-2w">
        <div className="fr-col-12 fr-col-md-5">
          <label className="fr-label" htmlFor="q">Rechercher</label>
          <input id="q" name="q" className="fr-input" type="search" defaultValue={query.q} />
        </div>
        {filterable.map((f) => (
          <div key={f.name} className="fr-col-6 fr-col-md-2">
            <label className="fr-label" htmlFor={`f_${f.name}`}>{f.label}</label>
            <select id={`f_${f.name}`} name={`f_${f.name}`} className="fr-select" defaultValue={query.filters[f.name] ?? ''}>
              <option value="">Tous</option>
              {f.type === 'bool' ? (
                <>
                  <option value="1">Oui</option>
                  <option value="0">Non</option>
                </>
              ) : (
                Object.entries(f.options ?? {}).map(([c, l]) => (
                  <option key={c} value={c}>{l}</option>
                ))
              )}
            </select>
          </div>
        ))}
        <div className="fr-col-auto">
          <button className="fr-btn" type="submit">Filtrer</button>
        </div>
        {resource.canCreate && !resource.readOnly && (
          <div className="fr-col-auto">
            <Link className="fr-btn fr-btn--secondary fr-icon-add-line fr-btn--icon-left" href={`/admin/${resource.key}/nouveau`}>Nouveau</Link>
          </div>
        )}
      </form>
      <p className="fr-text--sm">{result.total} résultat{result.total > 1 ? 's' : ''}</p>
      <div className="fr-table fr-table--no-caption">
        <div className="fr-table__wrapper">
          <div className="fr-table__container">
            <div className="fr-table__content">
              <table>
                <caption>{resource.labelPluriel}</caption>
                <thead>
                  <tr>
                    <th scope="col">Réf.</th>
                    {resource.account && <th scope="col">E-mail</th>}
                    {columns.map((f) => (
                      <th key={f.name} scope="col">{f.label}</th>
                    ))}
                    <th scope="col"><span className="fr-sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={idOf(row)}>
                      <td>{idOf(row)}</td>
                      {resource.account && <td>{String(row.email || '—')}{row.email && !row.compteActive ? ' (non activé)' : ''}</td>}
                      {columns.map((f) => (
                        <td key={f.name}>{fmt(f, row[f.name], result.labels[f.name])}</td>
                      ))}
                      <td>
                        <Link className="fr-link" href={`/admin/${resource.key}/${encodeURIComponent(idOf(row))}`}>
                          {resource.readOnly ? 'Voir' : 'Modifier'}
                          <span className="fr-sr-only"> {labelOf(resource, row)}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!result.rows.length && (
                    <tr>
                      <td colSpan={columns.length + 3}>Aucun résultat.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {result.pages > 1 && (
        <nav className="fr-pagination" aria-label="Pagination">
          <ul className="fr-pagination__list">
            {result.page > 1 && (
              <li><Link className="fr-pagination__link fr-pagination__link--prev" href={href(result.page - 1)}>Précédente</Link></li>
            )}
            <li><span className="fr-pagination__link" aria-current="page">Page {result.page} sur {result.pages}</span></li>
            {result.page < result.pages && (
              <li><Link className="fr-pagination__link fr-pagination__link--next" href={href(result.page + 1)}>Suivante</Link></li>
            )}
          </ul>
        </nav>
      )}
    </>
  );
}
