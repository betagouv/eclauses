/**
 * Remplaçant côté navigateur de l'objet `gristAPI` que le widget Grist injectait dans les pages.
 * Il expose la même surface (getData, updateRecord, getAuth, getComponent…) mais passe par les routes
 * du serveur, qui appliquent les droits. Cela permet de reprendre le code des pages existantes avec
 * un minimum de changements.
 */
import helpers from './components/helpers';
import { goToDefault, navigate } from './navigation';

export interface LegacyAuth {
  email: string;
  token: null;
  expiresAt: null;
  beneficiaireId: number | null;
  repondantId: number | null;
  acheteurId: number | null;
  acheteurEntiteId: number | null;
  roles: string[];
}

export interface ServerSession {
  email: string;
  roles: string[];
  beneficiaireId: number | null;
  repondantId: number | null;
  acheteurId: number | null;
  acheteurEntiteId: number | null;
}

let auth: LegacyAuth | null = null;
let env: Record<string, string> = {};
const components = new Map<string, unknown>();

export function setSession(session: ServerSession | null): void {
  auth = session ? { ...session, token: null, expiresAt: null } : null;
}

/** Réglages publics fournis par le serveur (URL publique, délai de relance…). */
export function setEnv(values: Record<string, string>): void {
  env = values;
}

export function registerComponent(name: string, component: unknown): void {
  components.set(name, component);
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Erreur ${res.status}`);
  }
  return (await res.json()) as T;
}

const unsupported = (name: string) => async () => {
  throw new Error(`gristAPI.${name} n'est pas disponible : l'écriture passe par des routes dédiées.`);
};

export const gristAPI = {
  /** Lecture soumise aux politiques d'accès du serveur. `id` restreint à une ou plusieurs lignes. */
  async getData(table: string, opts: { id?: number | number[] } = {}): Promise<Record<string, unknown>[]> {
    const qs = new URLSearchParams();
    for (const id of [opts.id ?? []].flat()) qs.append('id', String(id));
    const suffix = qs.size ? `?${qs}` : '';
    return json(await fetch(`/api/data/${encodeURIComponent(table)}${suffix}`, { cache: 'no-store' }));
  },

  async updateRecord(table: string, id: number, fields: Record<string, unknown>): Promise<boolean> {
    await json(
      await fetch(`/api/data/${encodeURIComponent(table)}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    );
    return true;
  },

  addRecord: unsupported('addRecord'),
  deleteRecord: unsupported('deleteRecord'),

  getAuth: (): LegacyAuth | null => auth,
  isAuthenticated: (): boolean => !!auth,
  refreshAuth: async (): Promise<LegacyAuth | null> => auth,

  getEnv: (key: string, fallback = ''): string => env[key] ?? fallback,
  getQueryParams: (): URLSearchParams => new URLSearchParams(window.location.search),

  navigate,
  goToDefault,
  getSelection: (): null => null,

  getComponent: (name: string): unknown => components.get(name) ?? null,
  helpers,

  /** Dépôt du CV : le serveur contrôle le fichier, l'envoie à Grist et l'associe à la fiche. */
  async uploadCV(benefId: number, file: File): Promise<{ attachmentId: number }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return json(await fetch(`/api/beneficiaires/${benefId}/cv`, { method: 'POST', body: form }));
  },

  async clearCV(benefId: number): Promise<void> {
    await json(await fetch(`/api/beneficiaires/${benefId}/cv`, { method: 'DELETE' }));
  },

  attachmentUrl: (id: number): string => `/api/attachments/${id}`,
};

export default gristAPI;
