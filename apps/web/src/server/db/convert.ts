/** Conversions entre les dates de la base et les secondes epoch attendues par les pages. */

/** `date` (AAAA-MM-JJ) ou instant -> secondes epoch ; `null` si vide. */
export function toEpoch(v: string | Date | null | undefined): number | null {
  if (v == null || v === '') return null;
  const ms = v instanceof Date ? v.getTime() : Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Valeur saisie (secondes epoch, AAAA-MM-JJ ou ISO) -> instant ; `null` si vide, `undefined` si illisible. */
export function toDate(v: unknown): Date | null | undefined {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? new Date(v * 1000) : undefined;
  if (typeof v === 'string') {
    const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
    return Number.isNaN(ms) ? undefined : new Date(ms);
  }
  return undefined;
}

/** Valeur saisie -> `date` SQL (AAAA-MM-JJ). */
export function toDay(v: unknown): string | null | undefined {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : d;
}
