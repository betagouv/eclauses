import { grist } from './config';
import type { Row } from './grist/client';

export interface SiteLink {
  label: string;
  href: string;
  external: boolean;
}

export interface SiteConfig {
  title: string;
  tagline: string;
  badge: { label: string; variant: string } | null;
  logoHtml: string;
  headerLinks: SiteLink[];
  footerLinks: SiteLink[];
  footerBottomLinks: SiteLink[];
  footerDescription: string;
  footerCopyHtml: string;
}

const FALLBACK: SiteConfig = {
  title: 'Eclauses',
  tagline: '',
  badge: null,
  logoHtml: 'Ministère<br>de la Culture',
  headerLinks: [],
  footerLinks: [],
  footerBottomLinks: [],
  footerDescription: '',
  footerCopyHtml: '',
};

const TTL_MS = 5 * 60_000;
let cache: { at: number; value: SiteConfig } | undefined;

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * En-tête et pied de page : le contenu reste éditable dans Grist (tables `Application_Header`,
 * `Application_Footer` et `Application_Liens`), mis en cache quelques minutes.
 */
export async function siteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const g = grist();
    const [[header], [footer], liens] = await Promise.all([
      g.records('Application_Header', { limit: 1 }),
      g.records('Application_Footer', { limit: 1 }),
      g.records('Application_Liens'),
    ]);
    const byId = new Map<number, Row>(liens.map((l) => [l.id, l]));
    const toLinks = (list: unknown): SiteLink[] =>
      ids(list)
        .map((id) => byId.get(id))
        .filter((l): l is Row => !!l)
        .sort((a, b) => Number(a.Ordre ?? 0) - Number(b.Ordre ?? 0))
        .map((l) => ({
          label: str(l.Label).trim(),
          external: l.External === true || !!str(l.Url),
          href: str(l.Url) || (str(l.Nav) && str(l.Nav) !== 'accueil' ? `/${str(l.Nav)}` : '/'),
        }));

    const value: SiteConfig = {
      title: str(header?.Title) || FALLBACK.title,
      tagline: str(header?.Tagline),
      badge: str(header?.Badge_Label) ? { label: str(header!.Badge_Label), variant: str(header!.Badge_Variant) } : null,
      logoHtml: str(header?.Entity_Logo) || FALLBACK.logoHtml,
      headerLinks: toLinks(header?.Links),
      footerLinks: toLinks(footer?.Links),
      footerBottomLinks: toLinks(footer?.Bottom_Links),
      footerDescription: str(footer?.Description),
      footerCopyHtml: str(footer?.Copy),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.error('[site] configuration indisponible, valeurs par défaut', e instanceof Error ? e.message : e);
    return cache?.value ?? FALLBACK;
  }
}
