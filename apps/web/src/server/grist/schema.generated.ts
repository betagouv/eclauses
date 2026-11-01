// Fichier généré par scripts/gen-schema.ts : ne pas modifier à la main.
// Document : <ID du document DEV>

export interface Beneficiaires {
  id: number;
  NOM: string;
  Prenom: string;
  Formation: number;
  Annee_de_diplome: string;
  Specialite_ecole: string;
  Specialite: ['L', ...number[]] | null;
  Sous_specialite: string;
  Intitule_du_memoire: string;
  Courriel: string;
  Telephone: string;
  Departement_de_residence: ['L', ...number[]] | null;
  Regions_ou_vous_etes_mobile: ['L', ...number[]] | null;
  curriculum_vitae: ['L', ...number[]] | null;
  Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur: boolean;
  Je_consens_a_etre_contacte_pour_rejoindre_des_groupements: boolean;
  NOM_Prenom: unknown; /** formule */
  Autres_informations: string;
  Clef_secrete: string;
  Email_1: string; /** formule */
  Courriel_ecole_eclauses: unknown; /** formule */
  Missions_proposees: string;
  Commentaire: string;
  Derniere_modification: string;
  alumni: boolean;
  Email_2: unknown; /** formule */
  Fiche_MAJ: boolean;
  Clauses_sociales_de_rattachement: ['L', ...number[]] | null;
  html_annuaire_clause: unknown; /** formule */
  Departement_de_residence_Adresse_geocodee: unknown; /** formule */
  Regions_ou_vous_etes_mobile_Adresse_geocodee: unknown; /** formule */
  Annuaire: ['L', ...number[]] | null; /** formule */
  Autre_Formation: string;
  A: string;
  Account: number; /** formule */
  Date_de_derniere_connexion: number | null; /** formule */
  Compte_active: boolean; /** formule */
  Connecte_6_derniers_mois: unknown; /** formule */
  B: unknown; /** formule */
  Eligible: boolean; /** formule */
  Date_de_diplomation: number | null; /** formule */
  Doit_supprimer: boolean; /** formule */
  Date_de_suppression: number | null;
}

export interface T0_Referentiel_Informations {
  id: number;
  Mentions_RGPD: string;
}

export interface Z_Libs {
  id: number;
  fill_template: unknown; /** formule */
  lien_envoyer_mail: unknown; /** formule */
  C: unknown; /** formule */
}

export interface Z_Gabarits {
  id: number;
  Nom: string;
  Corps: string;
  Test_annuaire: unknown; /** formule */
  Objet: string;
  Test_candidat: string; /** formule */
}

export interface Z_Tests {
  id: number;
  Statut: string;
  Contexte: string;
  Lien_a_cliquer: string;
  Verification: string;
  Type_de_test: string;
}

export interface Marches {
  id: number;
  Intitule_du_marche: string;
  Acheteur: number;
  Lien_vers_les_documents_de_consultation: string;
  Date_de_publication: number | null;
  Date_Limite_de_Remise_des_Offres: number | null;
  Intitule_propre: unknown; /** formule */
  Date_de_notification_previsionnelle: number | null;
  Clauses_sociales: number;
  Lieu_d_execution: string;
  Latitude: number;
  Longitude: number;
  Adresse_geocodee: string;
  html_statistiques: unknown; /** formule */
  Doit_Geocoder: unknown; /** formule */
  Suivi: ['L', ...string[]] | null;
  Numero_de_lot: string;
  Specialites_du_marche: ['L', ...number[]] | null;
  Date_de_fin_d_execution: number | null;
  Candidats: ['L', ...number[]] | null; /** formule */
  Intitule_Lot: unknown; /** formule */
  Statut: string;
  Lien_Inscription_Candidat: unknown; /** formule */
  Invitation_Titulaire_Marche: number; /** formule */
  A_valider: boolean; /** formule */
  Beneficiaires: ['L', ...number[]] | null;
  Clause_validee: boolean; /** formule */
  Acheteur_Utilisateurs_Acheteurs: ['L', ...number[]] | null; /** formule */
  Acheteur_Utilisateurs_Acheteurs_Email: unknown; /** formule */
  Titulaire: number;
  Acheteur_Nom: string; /** formule */
  Doit_Notifier_Publication: boolean; /** formule */
  Intitule_du_lot: string;
  Titulaire_Label: unknown; /** formule */
  Creation_en_autonomie: boolean;
  ID_Marche: unknown; /** formule */
  Ne_Doit_Pas_Notifier: boolean;
  Marche_parent: number;
  Lots: ['L', ...number[]] | null; /** formule */
  Est_lot: boolean; /** formule */
  Est_marche_parent: boolean; /** formule */
  Marche_racine: number; /** formule */
  Lots_eclauses: ['L', ...number[]] | null; /** formule */
  Nb_lots: number; /** formule */
  Nb_lots_eclauses: number; /** formule */
  Nb_lots_en_attente_declaration: number; /** formule */
  Nb_lots_a_valider: number; /** formule */
  Nb_lots_valides: number; /** formule */
  Tous_lots_valides: boolean; /** formule */
  Statut_global: string; /** formule */
  Titulaires_lots: ['L', ...number[]] | null; /** formule */
  Beneficiaires_tous_lots: ['L', ...number[]] | null; /** formule */
  Lots_avec_lieux_differents: boolean;
  Lots_avec_clauses_differentes: boolean;
  Marche_parent_Intitule_propre: string; /** formule */
  Lot_Label: string; /** formule */
  Clauses_sociales_lots: ['L', ...number[]] | null; /** formule */
  Lots_Detail: unknown; /** formule */
  Lots_Detail_HTML: string; /** formule */
  Lots_Detail_Texte: string; /** formule */
  Beneficiaires_Actif_Publication: unknown; /** formule */
  Clauses_sociales_parent_ou_enfants: number; /** formule */
  Doit_archiver: boolean; /** formule */
}

export interface Z_Documents_de_l_equipe {
  id: number;
  Nom: string;
  Description: string;
  Document: ['L', ...number[]] | null;
  Derniere_mise_a_jour: number | null;
}

export interface T0_Referentiel_Regions {
  id: number;
  Intitule: string;
  Chef_lieux: string;
  Latitude: number;
  Longitude: number;
  Adresse_geocodee: string;
  Doit_Geocoder: unknown; /** formule */
}

export interface T0_Referentiel_Formations {
  id: number;
  Intitule: string;
}

export interface T0_Referentiel_Specialites {
  id: number;
  Intitule: string;
  Clause_sociale: number;
  Tooltip: string;
}

export interface T0_Referentiel_Departements {
  id: number;
  Departement_Numero: string;
  Departement_Nom: string;
  Region: string;
  Affichage: string;
  Chef_lieu: string;
  Villes_Principales: string;
  Superficie_km2_: number;
  Population_2023_: number;
  Densite_hab_km2_: number;
  Latitude: number;
  Longitude: number;
  Adresse_geocodee: string;
  Geocode: boolean;
}

export interface Acheteurs {
  id: number;
  Nom: string;
  Ministere: string;
  Marches_Clauses_sociales: ['L', ...number[]] | null; /** formule */
  Marches_Clauses_sociales_Beneficiaires: ['L', ...number[]] | null; /** formule */
  Marches: ['L', ...number[]] | null; /** formule */
  Utilisateurs_Acheteurs: ['L', ...number[]] | null;
  Categorie: string;
  Autonome: boolean; /** formule */
  A_marches: boolean; /** formule */
  Connecte_6_derniers_mois: boolean; /** formule */
}

export interface Repondants {
  id: number;
  Nom: string;
  Email: string;
  Telephone: string;
  Raison_sociale: string;
  Candidat_aux_marches: ['L', ...number[]] | null;
  Titulaire_aux_marches: ['L', ...number[]] | null;
  Clauses_Sociales: ['L', ...number[]] | null; /** formule */
  Siret: string;
  Prenom: string;
  Label: unknown; /** formule */
  Invitations_Titulaire: ['L', ...number[]] | null; /** formule */
  Connecte_6_derniers_mois: boolean; /** formule */
  Account: number; /** formule */
  Account_Derniere_mise_a_jour: number | null; /** formule */
  Doit_supprimer: boolean; /** formule */
  Date_de_suppression: number | null;
}

export interface Clauses_sociales {
  id: number;
  Nom_de_la_clause: string;
  Gabarit_d_article_de_marche: string;
  Nb_de_marches_totals: unknown; /** formule */
  Nb_de_beneficiaires_potentiels: unknown; /** formule */
  Nb_de_beneficiaires_consentants: string; /** formule */
  Nb_de_beneficiaires_contactables: unknown; /** formule */
  html_statistique: string; /** formule */
  Nb_de_marches_actifs: unknown; /** formule */
  html_gabarit_annuaire_clause: string;
  Documents: ['L', ...number[]] | null; /** formule */
  Marches: ['L', ...number[]] | null; /** formule */
  Beneficiaires_Actif: unknown; /** formule */
  Beneficiaires: ['L', ...number[]] | null; /** formule */
}

export interface Z_HTML_Page {
  id: number;
  Clause_Statistiques: string;
  Beneficiaire_Dashboard: string;
  Marche_Statistiques: string;
}

export interface Application_Composants {
  id: number;
  template_id: string;
  template_name: string;
  component_code: string;
  component_type: string;
  show_in_nav: boolean;
  nav_order: number;
  default_component: boolean;
  requires_auth: boolean;
  nav_roles: ['L', ...string[]] | null;
  show_in_nav_when_authed: boolean;
  hide_in_nav_when_authed: boolean;
  Lien_direct: string; /** formule */
  dev: boolean;
}

export interface AuthLink {
  id: number;
  Email: string;
  Beneficiaire: number;
  Repondant: number;
  Token: string;
  Cree_a: number | null;
  Expire_le: number | null;
  Acheteur: number;
  Direct_Lien: string;
  Expire: boolean; /** formule */
  Roles: ['L', ...string[]] | null; /** formule */
  Acheteur_Entite: number; /** formule */
  Lien: string; /** formule */
  A: unknown; /** formule */
}

export interface Application_FAQ_Categories {
  id: number;
  Title: string;
  Slug: string; /** formule */
  Order: number;
  Published: boolean;
  Description: string;
  Clause: number; /** formule */
}

export interface Application_FAQ_Questions {
  id: number;
  Question: string;
  Answer: string;
  Category: number;
  Keywords: string;
  Order: number;
  Published: boolean;
  Updated_at: number | null;
  Audience: string;
  Auteur: string;
  Clause2: number;
  A: unknown; /** formule */
}

export interface Utilisateurs_Acheteurs {
  id: number;
  Nom: string;
  Prenom: string;
  Email: string;
  Entite_de_rattachement: number;
  Account: number; /** formule */
  Account_Derniere_mise_a_jour: number | null; /** formule */
  Connecte_6_derniers_mois: boolean; /** formule */
}

export interface Application_AuthUser {
  id: number;
  Email: string;
  Derniere_mise_a_jour: number | null;
  Hash_Password: string;
  Derniere_connexion: number | null;
}

export interface Declarations_Beneficiaires {
  id: number;
  Repondant: number;
  Marche: number;
  Est_beneficiaire_eclauses: boolean;
  Beneficiaire: number;
  Nom: string;
  Prenom: string;
  Email: string;
  Statut: string;
  Cree_le: number | null;
  Marche_Acheteur: number; /** formule */
  Marche_Acheteur_Nom: string; /** formule */
  Marche_Titulaire_Label: unknown; /** formule */
  Beneficiaire__Courriel: string; /** formule */
  Email_envoi: unknown; /** formule */
  Marche_Intitule_propre: unknown; /** formule */
  Marche_Marche_parent_Intitule_propre: string; /** formule */
  Marche_Numero_de_lot: string; /** formule */
  Marche_Intitule_du_lot: string; /** formule */
  Marche_Lot_Label: string; /** formule */
}

export interface Acces_Coordonnees {
  id: number;
  Repondant: number;
  Marche: number;
  Beneficiaire: number;
  Affiche_email: boolean;
  Affiche_telephone: boolean;
  Cree_a: number | null;
  Beneficiaire__Courriel: string; /** formule */
  Marche_Intitule_propre: unknown; /** formule */
}

export interface Invitation_Titulaire {
  id: number;
  Marche: number;
  Email: string;
  Status: string;
  Cree_a: number | null;
  Processed_At: number | null;
  Token: string;
  Marche_Intitule_propre: unknown; /** formule */
  Marche_Acheteur_Nom: string; /** formule */
  Derniere_relance_le: number | null;
  Application_Password_Reset: number; /** formule */
  Application_Password_Reset_Lien: string; /** formule */
  AuthUser: number; /** formule */
  Marche_Marche_parent_Intitule_propre: string; /** formule */
  Marche_Numero_de_lot: string; /** formule */
  Marche_Lot_Label: string; /** formule */
  Marche_Intitule_du_lot: string; /** formule */
}

export interface Marches_Interets {
  id: number;
  Marche: number;
  Beneficiaire: number;
  Cree_a: number | null;
  Marche_Candidats: ['L', ...number[]] | null; /** formule */
  Marche_Titulaire: number; /** formule */
}

export interface Application_AI_Conversations {
  id: number;
  component: number;
  title: string;
  model: string;
  active: boolean;
  session_id: string;
  started_at: number | null;
}

export interface Application_AI_Messages {
  id: number;
  conversation: number;
  turn_index: number;
  role: string;
  content_md: string;
  proposal_type: string;
  proposed_code: string;
  applied: boolean; /** formule */
  applied_at: number | null; /** formule */
  tokens_input: number; /** formule */
  tokens_output: number;
  created_at: number | null;
}

export interface Application_Password_Reset {
  id: number;
  Email: string;
  Token: string;
  Cree_a: number | null;
  Expire_le: number | null;
  Direct_Lien: string;
  Expire: boolean; /** formule */
  Lien: string; /** formule */
  Is_Reset: boolean;
  Type: unknown; /** formule */
  create_send: boolean;
  error_create_send: string;
  Used: boolean;
  Existe: boolean; /** formule */
}

export interface Application_Env {
  id: number;
  Key: string;
  Value: string;
}

export interface Application_Header {
  id: number;
  Title: string;
  Badge_Label: string;
  Badge_Variant: string;
  Tagline: unknown; /** formule */
  Links: ['L', ...number[]] | null;
  Entity_Logo: string;
}

export interface Application_Footer {
  id: number;
  Description: string;
  Links: ['L', ...number[]] | null;
  Bottom_Links: ['L', ...number[]] | null;
  Copy: string;
  Entity_Logo: string;
}

export interface Application_Liens {
  id: number;
  Label: string;
  Url: string;
  Nav: string; /** formule */
  Variant: string;
  External: boolean;
  Ordre: number;
  Target: unknown; /** formule */
  Page: number;
}

export interface TECHNIQUE_THIBAUD {
  id: number;
  A: unknown; /** formule */
  B: unknown; /** formule */
  C: unknown; /** formule */
}

export interface MC_Resume_des_niveaux {
  id: number;
  Entites_beneficiaires_Prescriptrices: string;
  En_rouge: unknown;
  Entites_dont_le_nom_ne_respecte_pas_l_ordre_alphabetique: string;
}

export interface Liste_des_Entites_beneficiaires {
  id: number;
  Ministere: string;
  Structure: string;
  Entite: string;
  Entites_beneficiaires_Niv3: string;
  Entites_achats_dans_APPACH: string;
  Entites_achats_dans_PLACE: string;
}

export interface Chemin_complet_PLACE_Restit {
  id: number;
  PLACE_Chemin_complet: string;
  Structure: string;
  Entite: string;
}

export interface Impacts {
  id: number;
  Label: string;
  Valeur: unknown; /** formule */
  Description: string;
  Valeur_manuelle: string;
  Valeur_automatique: string;
  Type_d_indicateur: string;
  ColSpan: number;
  Ordre: number;
}

export interface Support_Videos {
  id: number;
  Label: string;
  Description: string;
  Order: number;
  Published: boolean;
  Audience: string;
  Updated_at: number | null;
  Auteur: string;
  Clause: number;
  URL: string;
}

export interface Declarations_Beneficiaires_Refus {
  id: number;
  Marche: number;
  Refuse_le: number | null;
  Marche_Acheteur: number; /** formule */
  Marche_Acheteur_Nom: string; /** formule */
  Marche_Titulaire_Label: unknown; /** formule */
  Beneficiaire__Courriel: string; /** formule */
  Email_envoi: unknown; /** formule */
  Marche_Intitule_propre: unknown; /** formule */
  Marche_Marche_parent_Intitule_propre: string; /** formule */
  Marche_Numero_de_lot: string; /** formule */
  Marche_Intitule_du_lot: string; /** formule */
  Marche_Lot_Label: string; /** formule */
  Raison: string;
  Refuse_par: number;
  Marche_Titulaire: number; /** formule */
  Marche_Titulaire_Email: string; /** formule */
}

export interface ActionsManuelles {
  id: number;
  Declencher_envoi_creation_de_compte: boolean;
  A: string;
}

export interface Schema {
  Beneficiaires: Beneficiaires;
  T0_Referentiel_Informations: T0_Referentiel_Informations;
  Z_Libs: Z_Libs;
  Z_Gabarits: Z_Gabarits;
  Z_Tests: Z_Tests;
  Marches: Marches;
  Z_Documents_de_l_equipe: Z_Documents_de_l_equipe;
  T0_Referentiel_Regions: T0_Referentiel_Regions;
  T0_Referentiel_Formations: T0_Referentiel_Formations;
  T0_Referentiel_Specialites: T0_Referentiel_Specialites;
  T0_Referentiel_Departements: T0_Referentiel_Departements;
  Acheteurs: Acheteurs;
  Repondants: Repondants;
  Clauses_sociales: Clauses_sociales;
  Z_HTML_Page: Z_HTML_Page;
  Application_Composants: Application_Composants;
  AuthLink: AuthLink;
  Application_FAQ_Categories: Application_FAQ_Categories;
  Application_FAQ_Questions: Application_FAQ_Questions;
  Utilisateurs_Acheteurs: Utilisateurs_Acheteurs;
  Application_AuthUser: Application_AuthUser;
  Declarations_Beneficiaires: Declarations_Beneficiaires;
  Acces_Coordonnees: Acces_Coordonnees;
  Invitation_Titulaire: Invitation_Titulaire;
  Marches_Interets: Marches_Interets;
  Application_AI_Conversations: Application_AI_Conversations;
  Application_AI_Messages: Application_AI_Messages;
  Application_Password_Reset: Application_Password_Reset;
  Application_Env: Application_Env;
  Application_Header: Application_Header;
  Application_Footer: Application_Footer;
  Application_Liens: Application_Liens;
  TECHNIQUE_THIBAUD: TECHNIQUE_THIBAUD;
  MC_Resume_des_niveaux: MC_Resume_des_niveaux;
  Liste_des_Entites_beneficiaires: Liste_des_Entites_beneficiaires;
  Chemin_complet_PLACE_Restit: Chemin_complet_PLACE_Restit;
  Impacts: Impacts;
  Support_Videos: Support_Videos;
  Declarations_Beneficiaires_Refus: Declarations_Beneficiaires_Refus;
  ActionsManuelles: ActionsManuelles;
}

export type TableName = keyof Schema;
