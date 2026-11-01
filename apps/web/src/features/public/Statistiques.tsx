import { readTable } from '@/server/tables';

/** Statistiques d'usage et d'impact, rendues par le serveur : les indicateurs sont calculés en base au moment du rendu. */
export async function Statistiques() {
  const C = {
    LABEL: 'Label',
    DESCRIPTION: 'Description',
    VALUE: 'Valeur',
    TYPE: 'Type_d_indicateur',
    COLSPAN: 'ColSpan',
    ORDER: 'Ordre',
  };

  const TYPE_ORDER = ['Utilisable', 'Utilisé', 'Utile', 'Impactant'];
  const TYPE_BADGE_CLASS: Record<string, string> = {
    Utilisable: 'fr-badge--new fr-badge--no-icon',
    'Utilisé': 'fr-badge--info fr-badge--no-icon',
    Utile: 'fr-badge--success fr-badge--no-icon',
    Impactant: 'fr-badge--warning fr-badge--no-icon',
  };
  const TYPE_DESCRIPTON: Record<string, string> = {
    Utilisable: 'Ces indicateurs répondent à la question "Le produit est-il facile d\'utilisation" ?',
    'Utilisé': 'Ces indicateurs répondent à la question "Le produit est-il utilisé par une part importante de la cible" ?',
    Utile: 'Ces indicateurs répondent à la question "Le produit répond-il à un irritant pour nos utilisateurs" ?',
    Impactant: 'Ces indicateurs répondent à la question "Le produit répond-il à la politique publique" ?',
  }


  const normalizeType = (value: unknown) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'utilisable') return 'Utilisable';
    if (raw === 'utilisé' || raw === 'utilise') return 'Utilisé';
    if (raw === 'utile') return 'Utile';
    if (raw === 'impactant') return 'Impactant';
    return '';
  };
  const parseColSpan = (value: unknown) => {
    const n = Number(value);
    if (n === 2) return 2;
    if (n === 3) return 3;
    return 1;
  };
  const cardColClass = (colSpan: number) => {
    if (colSpan === 2) return 'fr-col-12 fr-col-lg-8';
    if (colSpan === 3) return 'fr-col-12';
    return 'fr-col-12 fr-col-md-6 fr-col-lg-4';
  };

  const rows = await readTable(null, 'Impacts').catch(() => []);
  const impacts = rows
    .map((r) => ({
      id: r.id,
      label: String(r[C.LABEL] || '').trim(),
      description: String(r[C.DESCRIPTION] || '').trim(),
      value: r[C.VALUE],
      type: normalizeType(r[C.TYPE]),
      colSpan: parseColSpan(r[C.COLSPAN]),
      order: Number(r[C.ORDER]) || 9999,
    }))
    .filter((r) => (r.label || r.description || r.value != null) && TYPE_ORDER.includes(r.type))
    .sort((a, b) => a.id - b.id);

  const sections = TYPE_ORDER.map((type) => ({
    type,
    items: impacts
      .filter((impact) => impact.type === type)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.id - b.id;
      }),
  }));

  return (
    <main className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Statistiques d'usage et d'impact</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Eclauses vise à permettre aux acheteurs de respecter la politique achat de l'Etat et d'inclure des clauses sociales adaptées aux spécificités métiers des Ministères dans leurs marchés.
        </p>
      </header>

      {impacts.length === 0 ? (
        <div className="fr-callout">
          <p className="fr-callout__text">Aucune statistique disponible pour le moment.</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.type} className="fr-mb-5w">
            <h2 className="fr-h5 fr-mb-2w">{section.type}</h2>
            <p className="fr-text--sm fr-text-mention--grey">
            {TYPE_DESCRIPTON[section.type] || ''}
           </p>
            {section.items.length === 0 ? (
              <div className="fr-callout">
                <p className="fr-callout__text">Aucun indicateur pour cette catégorie.</p>
              </div>
            ) : (
              <div className="fr-grid-row fr-grid-row--gutters">
                {section.items.map((item) => (
                  <div className={cardColClass(item.colSpan)} key={item.id}>
                    <article className="fr-card fr-card--no-arrow fr-card--shadow">
                      <div className="fr-card__body">
                        <div className="fr-card__content">
                          <p className={`fr-badge fr-badge--sm ${TYPE_BADGE_CLASS[item.type] || 'fr-badge--info'} fr-mb-1w`}>{item.type}</p>
                          <p className="fr-card__title fr-h6 fr-mb-1w">{item.label || 'Indicateur'}</p>
                          <p className="fr-display--sm fr-mb-1w">{item.value == null || item.value === '' ? '—' : String(item.value)}</p>
                          <p className="fr-card__desc fr-text--sm fr-mb-0">{item.description || '—'}</p>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </main>
  );
}
