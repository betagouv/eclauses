import { asc } from 'drizzle-orm';
import { database } from './db/client';
import { liens, parametres } from './db/schema';

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

/** Vide le cache (après une modification depuis l'administration, et dans les tests). */
export const resetSiteCache = () => {
  cache = undefined;
};

/**
 * En-tête et pied de page : textes dans `parametres`, liens dans `liens` (par zone), mis en cache
 * quelques minutes.
 */
export async function siteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const db = database();
    const [params, links] = await Promise.all([db.select().from(parametres), db.select().from(liens).orderBy(asc(liens.ordre), asc(liens.id))]);
    const p = new Map(params.map((x) => [x.cle, x.valeur]));
    const zone = (z: 'entete' | 'pied' | 'pied_bas'): SiteLink[] =>
      links.filter((l) => l.zone === z).map((l) => ({ label: l.libelle.trim(), href: l.url, external: l.externe }));
    const badge = p.get('site_badge_libelle');
    const value: SiteConfig = {
      title: p.get('site_titre') || FALLBACK.title,
      tagline: p.get('site_accroche') ?? '',
      badge: badge ? { label: badge, variant: p.get('site_badge_variante') ?? '' } : null,
      logoHtml: assainirHtml(p.get('site_logo_html') ?? '') || FALLBACK.logoHtml,
      headerLinks: zone('entete'),
      footerLinks: zone('pied'),
      footerBottomLinks: zone('pied_bas'),
      footerDescription: p.get('pied_description') ?? '',
      footerCopyHtml: assainirHtml(p.get('pied_copyright_html') ?? ''),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.error('[site] configuration indisponible, valeurs par défaut', e instanceof Error ? e.message : e);
    return cache?.value ?? FALLBACK;
  }
}

const BALISES = new Set(['br', 'b', 'strong', 'i', 'em', 'span', 'a', 'p', 'small', 'sup', 'sub']);

/**
 * HTML des textes d'en-tête et de pied de page, modifiables dans l'administration : seules des balises de mise en
 * forme simples sont conservées, sans attribut (hors `href` http, https ou mailto sur les liens). Tout le reste, dont
 * les scripts et les gestionnaires `on…`, est supprimé.
 */
export function assainirHtml(html: string): string {
  const texte = (t: string) => t.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  let dernier = 0;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
    out += texte(html.slice(dernier, m.index));
    dernier = m.index + m[0].length;
    const nom = m[2]!.toLowerCase();
    if (!BALISES.has(nom)) continue;
    if (m[1]) {
      out += `</${nom}>`;
      continue;
    }
    const href = nom === 'a' ? /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3]!) : null;
    const url = (href?.[1] ?? href?.[2] ?? '').trim();
    out += nom === 'a' && /^(https?:|mailto:)/i.test(url) ? `<a href="${url.replace(/"/g, '&quot;')}" rel="noreferrer">` : `<${nom}>`;
  }
  return out + texte(html.slice(dernier));
}
