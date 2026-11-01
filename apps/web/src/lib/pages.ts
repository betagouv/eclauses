export type Role = 'acheteur' | 'repondant' | 'beneficiaire';

export interface PageDef {
  id: string;
  title: string;
  /** Page réservée aux utilisateurs connectés. */
  auth: boolean;
  /** Espace auquel la page appartient (rôle requis). */
  role?: Role;
  /** Position dans le menu de l'espace ; absent = hors menu. */
  nav?: number;
}

/**
 * Pages de l'application : reprend `Application_Composants` du document Grist (titre, accès, menu).
 * L'identifiant de page est aussi la route (`/acheteur-marches`).
 */
export const PAGES: PageDef[] = [
  // Public
  { id: 'accueil', title: 'Accueil', auth: false },
  { id: 'login', title: 'Connexion', auth: false },
  { id: 'mot-de-passe-oublie', title: 'Mot de passe oublié ?', auth: false },
  { id: 'reset-password', title: 'Réinitialisation du mot de passe', auth: false },
  { id: 'inscription-candidat', title: 'Inscription Candidat', auth: false },
  { id: 'support', title: "Centre d'aide", auth: false },
  { id: 'support-contact', title: "Centre d'aide - Contact", auth: false },
  { id: 'statistiques', title: 'Statistiques', auth: false },
  { id: 'apropos', title: 'À propos', auth: false },
  { id: 'cgu', title: "Conditions générales d'utilisation", auth: false },
  { id: 'mentions-legales', title: 'Mentions légales', auth: false },
  { id: 'donnees-personnelles', title: 'Données personnelles', auth: false },
  { id: 'accessibilite', title: 'Accessibilité', auth: false },
  // Bénéficiaire
  { id: 'beneficiaire-home', title: 'Accueil', auth: true, role: 'beneficiaire' },
  { id: 'beneficiaire-profil', title: 'Mes informations', auth: true, role: 'beneficiaire', nav: 1 },
  { id: 'beneficiaire-marches', title: 'Marchés actifs', auth: true, role: 'beneficiaire', nav: 2 },
  { id: 'beneficiaire-annuaire', title: 'Annuaire', auth: true, role: 'beneficiaire', nav: 3 },
  // Acheteur
  { id: 'acheteur-home', title: 'Accueil', auth: true, role: 'acheteur' },
  { id: 'acheteur-marches', title: 'Mes marchés', auth: true, role: 'acheteur', nav: 1 },
  { id: 'acheteur-annuaire', title: 'Annuaire des bénéficiaires', auth: true, role: 'acheteur', nav: 2 },
  { id: 'acheteur-infos', title: 'Mes informations', auth: true, role: 'acheteur' },
  { id: 'acheteur-statistiques', title: 'Statistiques', auth: true, role: 'acheteur' },
  { id: 'acheteur-marches-declaration', title: 'Mes marchés - Déclarer un marché', auth: true, role: 'acheteur' },
  { id: 'acheteur-marches-modification', title: 'Mes marchés - Modifier un marché', auth: true, role: 'acheteur' },
  { id: 'acheteur-marches-detail', title: 'Mes marchés - Détail du marché', auth: true, role: 'acheteur' },
  // Répondant (candidat / titulaire)
  { id: 'repondant-home', title: 'Accueil', auth: true, role: 'repondant' },
  { id: 'repondant-infos', title: 'Mes informations', auth: true, role: 'repondant', nav: 1 },
  { id: 'repondant-marches', title: 'Mes marchés', auth: true, role: 'repondant', nav: 2 },
  { id: 'repondant-recherches', title: "Recherche d'un bénéficiaire", auth: true, role: 'repondant', nav: 3 },
];

export const pageById = (id: string): PageDef | undefined => PAGES.find((p) => p.id === id);

export const SPACES: { role: Role; label: string }[] = [
  { role: 'beneficiaire', label: 'Espace bénéficiaire' },
  { role: 'acheteur', label: 'Espace acheteur' },
  { role: 'repondant', label: 'Espace candidat / titulaire' },
];

/** Espace ouvert par défaut quand l'utilisateur a plusieurs rôles (même priorité que le widget). */
export const SPACE_PRIORITY: Role[] = ['beneficiaire', 'acheteur', 'repondant'];

export const homeOf = (role: Role): string => `${role}-home`;

export function navFor(role: Role): PageDef[] {
  return PAGES.filter((p) => p.role === role && p.nav).sort((a, b) => a.nav! - b.nav!);
}
