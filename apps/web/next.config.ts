import type { NextConfig } from 'next';

const prod = process.env.NODE_ENV === 'production';

/**
 * Politique de contenu : scripts et styles « inline » restent permis (Next.js injecte des scripts en ligne et le DSFR
 * des styles) ; tout le reste est limité à notre origine. Le mode développement a besoin de `eval` et des
 * WebSocket de rechargement à chaud.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${prod ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${prod ? '' : ' ws: wss:'}`,
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(prod ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

/**
 * Pages publiques dont le contenu ne dépend pas de la personne : un visiteur sans session peut recevoir une copie
 * conservée par le navigateur, le répartiteur de charge ou un CDN. Avec une session, l'en-tête change selon la
 * personne (menu, espaces) : ces requêtes ne passent pas par cette règle et restent non mises en cache.
 * `max-age=0` : le navigateur revalide toujours (pas de menu périmé après connexion) ; seul un cache partagé conserve.
 * Next.js remplace l'en-tête `Vary` : un CDN doit donc être réglé pour ne rien mettre en cache quand le cookie de
 * session est présent (voir docs/80-reecriture/08-administration.md).
 * Textes légaux : 1 h ; accueil, aide et statistiques (modifiables dans l'administration) : 5 min.
 */
const COOKIE_SESSION = prod ? '__Host-eclauses_session' : 'eclauses_session';
const sansSession = [{ type: 'cookie' as const, key: COOKIE_SESSION }];
const cache = (source: string, sMaxAge: number) => ({
  source,
  missing: sansSession,
  headers: [
    { key: 'Cache-Control', value: `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 24}` },
  ],
});

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // En standalone dans un monorepo, Next doit tracer depuis la racine du dépôt.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      cache('/', 300),
      cache('/cgu', 3600),
      cache('/mentions-legales', 3600),
      cache('/donnees-personnelles', 3600),
      cache('/accessibilite', 3600),
      cache('/apropos', 3600),
      cache('/support', 300),
      cache('/statistiques', 300),
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default config;
