import type { Metadata } from 'next';
import { pageById } from './pages';

/** Adresse publique du site (liens canoniques, plan du site, partage). */
export const siteUrl = (): string => (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Eclauses';

const DESCRIPTION_PAR_DEFAUT = 'Eclauses accompagne les acheteurs et les entreprises du ministère de la Culture dans la mise en œuvre des clauses sociales des marchés publics.';

/** Description propre à chaque page publique (environ 150 caractères) : celle qui s'affiche dans les résultats de recherche. */
const DESCRIPTIONS: Record<string, string> = {
  accueil: 'Eclauses met en relation les acheteurs, les entreprises titulaires et les jeunes diplômés en insertion pour appliquer les clauses sociales des marchés publics du ministère de la Culture.',
  support: 'Centre d’aide Eclauses : questions fréquentes sur la connexion, les rôles et les données personnelles, tutoriels vidéo et contact de l’équipe.',
  statistiques: 'Chiffres clés des clauses sociales du ministère de la Culture : marchés, bénéficiaires et heures d’insertion suivis dans Eclauses.',
  apropos: 'À propos d’Eclauses : le service du ministère de la Culture pour développer l’insertion professionnelle grâce aux clauses sociales des marchés publics.',
  cgu: 'Conditions générales d’utilisation de la plateforme Eclauses du ministère de la Culture.',
  'mentions-legales': 'Mentions légales de la plateforme Eclauses du ministère de la Culture : éditeur, hébergeur et responsable de publication.',
  'donnees-personnelles': 'Politique de protection des données personnelles de la plateforme Eclauses : finalités, durées de conservation et exercice de vos droits.',
  accessibilite: 'Déclaration d’accessibilité de la plateforme Eclauses du ministère de la Culture.',
  'inscription-candidat': 'Entreprises candidates à un marché public du ministère de la Culture : créez votre espace Eclauses pour déclarer les bénéficiaires de la clause sociale.',
};

/** Pages sans intérêt pour un moteur de recherche (formulaires, comptes) : jamais indexées. */
const NON_INDEXABLES = new Set(['login', 'mot-de-passe-oublie', 'reset-password', 'support-contact']);

export const indexable = (id: string): boolean => {
  const def = pageById(id);
  return !!def && !def.auth && !NON_INDEXABLES.has(id);
};

/** Identifiants des pages à publier dans le plan du site (l'accueil est la route `/`). */
export const pagesIndexables = (): string[] => ['accueil', 'support', 'statistiques', 'apropos', 'inscription-candidat', 'cgu', 'mentions-legales', 'donnees-personnelles', 'accessibilite'].filter(indexable);

export const cheminDe = (id: string): string => (id === 'accueil' ? '/' : `/${id}`);

/** Titre, description, adresse canonique (sans paramètres), partage et consigne d'indexation d'une page. */
export function metadataFor(id: string): Metadata {
  const def = pageById(id);
  if (!def) return { title: SITE_NAME, robots: { index: false, follow: false } };
  const title = id === 'accueil' ? `${SITE_NAME} - Clauses sociales des marchés publics du ministère de la Culture` : `${def.title} - ${SITE_NAME}`;
  const description = DESCRIPTIONS[id] ?? DESCRIPTION_PAR_DEFAUT;
  if (!indexable(id)) return { title, robots: { index: false, follow: false } };
  return {
    title: id === 'accueil' ? { absolute: title } : title,
    description,
    alternates: { canonical: cheminDe(id) },
    openGraph: { title, description, url: cheminDe(id), siteName: SITE_NAME, locale: 'fr_FR', type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}
