import { readTable } from '@/server/tables';
import InscriptionForm from './InscriptionForm';

const CLOSED = new Set(['Clause validée', 'Archivé']);

/** Inscription d'un candidat : le marché (`?marche=`) et les lots ouverts aux candidatures sont déterminés côté serveur. */
export async function InscriptionCandidat({ query }: { query: Record<string, string | undefined> }) {
  const n = Number(query.marche ?? query.marche_);
  const marches = await readTable(null, 'Marches').catch(() => []);
  const requested = Number.isFinite(n) ? marches.find((r) => r.id === n) : undefined;
  const parent = requested?.Marche_parent ? marches.find((r) => Number(r.id) === Number(requested.Marche_parent)) : requested;

  let initial = { marcheId: Number.isFinite(n) ? n : null, marcheLabel: null as string | null, lotOptions: [] as typeof marches, marcheValid: false };
  if (parent && !parent.Marche_parent) {
    const allChildren = marches.filter((r) => Number(r.Marche_parent) === Number(parent.id));
    const children = allChildren
      .filter((lot) => lot.Clauses_sociales)
      .filter((lot) => !CLOSED.has(String(lot.Statut || '')))
      .sort((a, b) => String(a.Numero_de_lot || '').localeCompare(String(b.Numero_de_lot || ''), 'fr', { numeric: true, sensitivity: 'base' }));
    const simple = allChildren.length === 0 && parent.Clauses_sociales && !CLOSED.has(String(parent.Statut || '')) ? [parent] : [];
    const options = children.length ? children : simple;
    initial = { ...initial, marcheLabel: String(parent.Intitule_du_marche || parent.Intitule_propre || `Marché #${parent.id}`), lotOptions: options, marcheValid: options.length > 0 };
  }
  return <InscriptionForm initial={initial} />;
}
