import * as s from '../db/schema';
import { CATEGORIE_ACHETEUR_LABELS, STATUT_DECLARATION_LABELS, STATUT_MARCHE_LABELS } from '../db/labels';
import { INDICATEURS } from '../services/indicateurs';
import type { Field, Resource } from './types';

const text = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'text', ...o });
const area = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'textarea', ...o });
const num = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'number', ...o });
const bool = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'bool', ...o });
const date = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'date', ...o });
const stamp = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'datetime', readonly: true, ...o });
const enm = (name: string, label: string, options: Record<string, string>, o: Partial<Field> = {}): Field => ({ name, label, type: 'enum', options, ...o });
const ref = (name: string, label: string, to: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'ref', ref: to, ...o });
const multi = (name: string, label: string, to: string, join: Field['join'], o: Partial<Field> = {}): Field => ({ name, label, type: 'multi', ref: to, join, ...o });

const AUDIENCES = { public: 'Public', beneficiaire: 'Bénéficiaires', acheteur: 'Acheteurs', repondant: 'Candidats et titulaires' };
const ZONES = { entete: 'En-tête', pied: 'Pied de page', pied_bas: 'Bas de page' };
const TYPES = { utilisable: 'Utilisable', utilise: 'Utilisé', utile: 'Utile', impactant: 'Impactant' };
const INDICATEUR_CODES = Object.fromEntries(Object.keys(INDICATEURS).map((k) => [k, k.replaceAll('_', ' ')]));
const INVITATION = { en_attente: 'En attente', traitee: 'Traitée' };

/**
 * Ressources d'administration décrites une fois : liste, recherche, création, modification, suppression sont générés.
 * Les écrans qui portent de la logique (comptes, fusion, marchés alloti, tâches) sont écrits à part.
 */
export const RESOURCES: Resource[] = [
  /* ------------------------------------------------------------ Référentiels */
  { key: 'formations', label: 'Formation', labelPluriel: 'Formations', groupe: 'Référentiels', table: s.formations, labelProps: ['intitule'], search: ['intitule'], orderBy: 'intitule', canCreate: true, canDelete: true, fields: [text('intitule', 'Intitulé', { required: true, list: true, max: 300 })] },
  {
    key: 'regions', label: 'Région', labelPluriel: 'Régions', groupe: 'Référentiels', table: s.regions, labelProps: ['intitule'], search: ['intitule', 'chefLieu'], orderBy: 'intitule', canCreate: true, canDelete: true,
    fields: [text('intitule', 'Intitulé', { required: true, list: true }), text('chefLieu', 'Chef-lieu', { list: true }), num('latitude', 'Latitude'), num('longitude', 'Longitude'), text('adresseGeocodee', 'Adresse géocodée')],
  },
  {
    key: 'departements', label: 'Département', labelPluriel: 'Départements', groupe: 'Référentiels', table: s.departements, labelProps: ['numero', 'nom'], search: ['numero', 'nom'], orderBy: 'numero', canCreate: true, canDelete: true,
    fields: [
      text('numero', 'Numéro', { required: true, list: true, max: 10 }), text('nom', 'Nom', { required: true, list: true }), ref('regionId', 'Région', 'regions', { list: true }),
      text('libelleAffichage', 'Libellé affiché'), text('chefLieu', 'Chef-lieu'), text('villesPrincipales', 'Villes principales'),
      num('superficieKm2', 'Superficie (km²)'), num('population2023', 'Population 2023'), num('densiteHabKm2', 'Densité (hab/km²)'), num('latitude', 'Latitude'), num('longitude', 'Longitude'), text('adresseGeocodee', 'Adresse géocodée'),
    ],
  },
  { key: 'clauses', label: 'Clause sociale', labelPluriel: 'Clauses sociales', groupe: 'Référentiels', table: s.clausesSociales, labelProps: ['nom'], search: ['nom'], orderBy: 'nom', canCreate: true, canDelete: true, fields: [text('nom', 'Nom', { required: true, list: true }), area('gabaritArticle', 'Gabarit d’article de marché', { noAudit: true }), area('gabaritAnnuaireHtml', 'Gabarit de l’annuaire (HTML)', { html: true, noAudit: true })] },
  { key: 'specialites', label: 'Spécialité', labelPluriel: 'Spécialités', groupe: 'Référentiels', table: s.specialites, labelProps: ['intitule'], search: ['intitule'], orderBy: 'intitule', canCreate: true, canDelete: true, fields: [text('intitule', 'Intitulé', { required: true, list: true }), ref('clauseId', 'Clause sociale', 'clauses', { list: true }), text('infobulle', 'Infobulle')] },

  /* ------------------------------------------------------------ Contenu */
  { key: 'faq-categories', label: 'Catégorie de FAQ', labelPluriel: 'Catégories de FAQ', groupe: 'Contenu', table: s.faqCategories, labelProps: ['titre'], search: ['titre'], orderBy: 'ordre', canCreate: true, canDelete: true, fields: [text('titre', 'Titre', { required: true, list: true }), text('slug', 'Identifiant dans l’adresse', { required: true, help: 'Minuscules et tirets (ex. « connexion »). Doit être unique.' }), area('description', 'Description'), num('ordre', 'Ordre', { list: true }), bool('publie', 'Publiée', { list: true })] },
  {
    key: 'faq-questions', label: 'Question de FAQ', labelPluriel: 'Questions de FAQ', groupe: 'Contenu', table: s.faqQuestions, labelProps: ['question'], search: ['question', 'reponse', 'motsCles'], orderBy: 'ordre', canCreate: true, canDelete: true,
    fields: [
      text('question', 'Question', { required: true, list: true, max: 500 }), area('reponse', 'Réponse', { required: true, help: 'Mise en forme simple : **gras**, *italique*, [texte](https://adresse), [texte](interne:page), [texte](faq:numero).' }),
      ref('categorieId', 'Catégorie', 'faq-categories', { list: true }), ref('clauseId', 'Clause sociale', 'clauses'), text('motsCles', 'Mots-clés'), enm('audience', 'Public concerné', AUDIENCES, { required: true, list: true }),
      text('auteur', 'Auteur'), num('ordre', 'Ordre'), bool('publie', 'Publiée', { list: true }), stamp('modifieLe', 'Modifiée le'),
    ],
  },
  { key: 'videos', label: 'Vidéo d’aide', labelPluriel: 'Vidéos d’aide', groupe: 'Contenu', table: s.supportVideos, labelProps: ['libelle'], search: ['libelle', 'description'], orderBy: 'ordre', canCreate: true, canDelete: true, fields: [text('libelle', 'Titre', { required: true, list: true }), area('description', 'Description'), text('url', 'Adresse de la vidéo', { required: true, max: 2000 }), enm('audience', 'Public concerné', AUDIENCES, { required: true, list: true }), ref('clauseId', 'Clause sociale', 'clauses'), text('auteur', 'Auteur'), num('ordre', 'Ordre'), bool('publie', 'Publiée', { list: true })] },
  {
    key: 'impacts', label: 'Indicateur d’impact', labelPluriel: 'Indicateurs d’impact', groupe: 'Contenu', table: s.impacts, labelProps: ['libelle'], search: ['libelle', 'description'], orderBy: 'ordre', canCreate: true, canDelete: true,
    intro: 'La valeur affichée sur la page « Statistiques » est la valeur manuelle si elle est renseignée, sinon celle de l’indicateur calculé.',
    fields: [text('libelle', 'Libellé', { required: true, list: true }), area('description', 'Description'), enm('typeIndicateur', 'Catégorie', TYPES, { required: true, list: true }), text('valeurManuelle', 'Valeur manuelle'), enm('indicateur', 'Indicateur calculé', INDICATEUR_CODES, { list: true }), num('largeurColonnes', 'Largeur (1 à 3 colonnes)'), num('ordre', 'Ordre', { list: true })],
  },
  { key: 'liens', label: 'Lien', labelPluriel: 'Liens de l’en-tête et du pied de page', groupe: 'Contenu', table: s.liens, labelProps: ['libelle'], search: ['libelle', 'url'], orderBy: 'ordre', canCreate: true, canDelete: true, fields: [enm('zone', 'Emplacement', ZONES, { required: true, list: true }), text('libelle', 'Libellé', { required: true, list: true }), text('url', 'Adresse', { required: true, list: true, help: 'Page de l’application (/support) ou adresse externe (https://…).' }), text('variante', 'Variante de style'), bool('externe', 'Lien externe (nouvel onglet)'), num('ordre', 'Ordre', { list: true })] },
  {
    key: 'parametres', label: 'Texte du site', labelPluriel: 'Textes du site', groupe: 'Contenu', table: s.parametres, idProp: 'cle', labelProps: ['cle'], search: ['cle', 'valeur'], orderBy: 'cle', canCreate: true, canDelete: true,
    intro: 'Clés connues : site_titre, site_accroche, site_badge_libelle, site_badge_variante, site_logo_html, pied_description, pied_copyright_html, mentions_rgpd.',
    fields: [text('cle', 'Clé', { required: true, list: true, max: 100 }), area('valeur', 'Valeur', { required: true, html: true, noAudit: true })],
  },

  /* ------------------------------------------------------------ Données métier */
  {
    key: 'acheteurs', label: 'Entité acheteuse', labelPluriel: 'Entités acheteuses', groupe: 'Acheteurs', table: s.acheteurs, labelProps: ['nom'], search: ['nom', 'ministere'], orderBy: 'nom', canCreate: true, canDelete: true,
    fields: [text('nom', 'Nom', { required: true, list: true }), text('ministere', 'Ministère', { list: true }), enm('categorie', 'Catégorie', CATEGORIE_ACHETEUR_LABELS, { list: true })],
  },
  {
    key: 'utilisateurs-acheteurs', label: 'Utilisateur acheteur', labelPluriel: 'Utilisateurs acheteurs', groupe: 'Acheteurs', table: s.utilisateursAcheteurs, labelProps: ['prenom', 'nom'], search: ['nom', 'prenom'], orderBy: 'nom', canCreate: true, canDelete: false,
    account: { fkProp: 'utilisateurId', label: 'Adresse e-mail (identifiant de connexion)', required: true },
    intro: 'Un utilisateur acheteur reçoit un lien d’activation par courrier depuis l’écran « Comptes ».',
    fields: [text('nom', 'Nom', { required: true, list: true }), text('prenom', 'Prénom', { list: true }), ref('acheteurId', 'Entité acheteuse', 'acheteurs', { required: true, list: true })],
  },
  {
    key: 'repondants', label: 'Répondant', labelPluriel: 'Répondants (candidats et titulaires)', groupe: 'Candidats et titulaires', table: s.repondants, labelProps: ['raisonSociale', 'nom'], search: ['nom', 'prenom', 'raisonSociale', 'siret'], orderBy: 'raisonSociale', canCreate: true, canDelete: false,
    account: { fkProp: 'utilisateurId', label: 'Adresse e-mail (identifiant de connexion)', required: true },
    fields: [text('raisonSociale', 'Raison sociale', { list: true }), text('nom', 'Nom', { list: true }), text('prenom', 'Prénom'), text('telephone', 'Téléphone'), text('siret', 'SIRET', { list: true }), stamp('creeLe', 'Créé le'), { ...date('anonymiseLe', 'Anonymisé le', { readonly: true }) }],
  },
  {
    key: 'beneficiaires', label: 'Bénéficiaire', labelPluriel: 'Bénéficiaires', groupe: 'Bénéficiaires', table: s.beneficiaires, labelProps: ['nom', 'prenom'], search: ['nom', 'prenom', 'specialiteEcole'], orderBy: 'nom', canCreate: true, canDelete: false,
    account: { fkProp: 'utilisateurId', label: 'Adresse e-mail (identifiant de connexion)' },
    intro: 'Les champs « Commentaire » et « Missions proposées » sont internes : jamais visibles des utilisateurs.',
    fields: [
      text('nom', 'Nom', { required: true, list: true }), text('prenom', 'Prénom', { list: true }), text('telephone', 'Téléphone'),
      ref('formationId', 'Formation', 'formations', { list: true }), text('autreFormation', 'Autre formation'), num('anneeDiplome', 'Année de diplôme', { list: true }), date('dateDiplomation', 'Date de diplomation', { readonly: true }),
      text('specialiteEcole', 'Spécialité (école)'), text('sousSpecialite', 'Sous-spécialité'), text('intituleMemoire', 'Intitulé du mémoire'), area('autresInformations', 'Autres informations'),
      multi('specialites', 'Spécialités', 'specialites', { table: s.beneficiaireSpecialites, owner: 'beneficiaireId', other: 'specialiteId' }),
      multi('departements', 'Départements de résidence', 'departements', { table: s.beneficiaireDepartements, owner: 'beneficiaireId', other: 'departementId' }),
      multi('regions', 'Régions de mobilité', 'regions', { table: s.beneficiaireRegions, owner: 'beneficiaireId', other: 'regionId' }),
      multi('clauses', 'Clauses sociales de rattachement', 'clauses', { table: s.beneficiaireClauses, owner: 'beneficiaireId', other: 'clauseId' }),
      bool('consentementAnnuaire', 'Consent à figurer dans l’annuaire', { list: true }), bool('consentementContactGroupements', 'Consent à être contacté pour des groupements'),
      bool('alumni', 'Alumni'), bool('ficheAJour', 'Fiche à jour', { list: true }), area('missionsProposees', 'Missions proposées (interne)', { noAudit: true }), area('commentaire', 'Commentaire (interne)', { noAudit: true }),
      stamp('creeLe', 'Créé le'), stamp('modifieLe', 'Modifié le'), date('anonymiseLe', 'Anonymisé le', { readonly: true }),
    ],
  },
  {
    key: 'marches', label: 'Marché', labelPluriel: 'Marchés et lots', groupe: 'Marchés', table: s.marches, labelProps: ['intitule', 'numeroLot'], search: ['intitule', 'intituleLot', 'lieuExecution'], orderBy: 'id', canCreate: false, canDelete: false,
    nouveauHref: '/admin/marches/nouveau',
    intro: 'Le bouton « Nouveau » crée un marché ou un marché alloti. Changer le statut à la main ne déclenche pas les courriers : préférez les actions des utilisateurs.',
    fields: [
      text('intitule', 'Intitulé', { required: true, list: true, max: 500 }), ref('parentId', 'Marché parent (lot)', 'marches', { list: true }), text('numeroLot', 'Numéro de lot', { list: true }), text('intituleLot', 'Intitulé du lot'),
      ref('acheteurId', 'Entité acheteuse', 'acheteurs', { required: true, list: true }), ref('clauseId', 'Clause sociale', 'clauses'), enm('statut', 'Statut', STATUT_MARCHE_LABELS, { required: true, list: true }), ref('titulaireId', 'Titulaire', 'repondants'),
      text('lienDocuments', 'Lien des documents de consultation'), date('datePublication', 'Date de publication'), date('dateLimiteOffres', 'Date limite de remise des offres', { list: true }), date('dateNotificationPrevisionnelle', 'Notification prévisionnelle'), date('dateFinExecution', 'Fin d’exécution'),
      text('lieuExecution', 'Lieu d’exécution'), num('latitude', 'Latitude'), num('longitude', 'Longitude'), text('adresseGeocodee', 'Adresse géocodée'),
      multi('specialites', 'Spécialités', 'specialites', { table: s.marcheSpecialites, owner: 'marcheId', other: 'specialiteId' }),
      bool('lotsLieuxDifferents', 'Lots avec lieux différents'), bool('lotsClausesDifferentes', 'Lots avec clauses différentes'),
      bool('creationEnAutonomie', 'Créé par l’acheteur (statistique)', { help: 'Vrai si l’acheteur l’a créé depuis le site, faux si l’équipe l’a créé depuis l’administration.' }), stamp('creeLe', 'Créé le'), stamp('modifieLe', 'Modifié le'),
    ],
  },
  {
    key: 'declarations', label: 'Déclaration de bénéficiaire', labelPluriel: 'Déclarations de bénéficiaires', groupe: 'Marchés', table: s.declarationsBeneficiaires, labelProps: ['nom', 'prenom'], search: ['nom', 'prenom', 'email'], orderBy: 'id', canCreate: false, canDelete: true,
    fields: [ref('marcheId', 'Marché', 'marches', { list: true, readonly: true }), ref('repondantId', 'Répondant', 'repondants', { list: true, readonly: true }), ref('beneficiaireId', 'Bénéficiaire Eclauses', 'beneficiaires', { list: true }), bool('estBeneficiaireEclauses', 'Bénéficiaire inscrit sur Eclauses'), text('nom', 'Nom'), text('prenom', 'Prénom'), text('email', 'E-mail'), enm('statut', 'Statut', STATUT_DECLARATION_LABELS, { required: true, list: true }), stamp('creeLe', 'Créée le')],
  },
  { key: 'refus', label: 'Refus de déclaration', labelPluriel: 'Refus de déclarations', groupe: 'Marchés', table: s.declarationsRefus, labelProps: ['id'], search: ['raison'], orderBy: 'id', readOnly: true, fields: [ref('marcheId', 'Marché', 'marches', { list: true }), text('raison', 'Motif', { list: true }), stamp('refuseLe', 'Refusé le', { list: true })] },
  { key: 'invitations', label: 'Invitation de titulaire', labelPluriel: 'Invitations de titulaires', groupe: 'Marchés', table: s.invitationsTitulaires, labelProps: ['email'], search: ['email'], orderBy: 'id', canDelete: true, fields: [ref('marcheId', 'Marché', 'marches', { list: true, readonly: true }), text('email', 'E-mail', { list: true, readonly: true }), enm('statut', 'Statut', INVITATION, { list: true }), stamp('creeLe', 'Créée le', { list: true }), stamp('derniereRelanceLe', 'Dernière relance')] },
  { key: 'acces', label: 'Consultation de coordonnées', labelPluriel: 'Consultations de coordonnées', groupe: 'Marchés', table: s.accesCoordonnees, labelProps: ['id'], search: [], orderBy: 'id', readOnly: true, fields: [ref('repondantId', 'Répondant', 'repondants', { list: true }), ref('beneficiaireId', 'Bénéficiaire', 'beneficiaires', { list: true }), ref('marcheId', 'Marché', 'marches', { list: true }), stamp('creeLe', 'Consultée le', { list: true })] },
  { key: 'interets', label: 'Intérêt pour un marché', labelPluriel: 'Intérêts pour des marchés', groupe: 'Marchés', table: s.interetsMarches, labelProps: ['id'], search: [], orderBy: 'id', canDelete: true, readOnly: false, fields: [ref('marcheId', 'Marché', 'marches', { list: true, readonly: true }), ref('beneficiaireId', 'Bénéficiaire', 'beneficiaires', { list: true, readonly: true }), stamp('creeLe', 'Le', { list: true })] },

  /* ------------------------------------------------------------ Exploitation */
  { key: 'envois', label: 'Courrier envoyé', labelPluriel: 'Courriers déjà envoyés', groupe: 'Exploitation', table: s.notificationsEnvoyees, labelProps: ['evenement', 'cle'], search: ['evenement', 'cle'], orderBy: 'id', canDelete: true, intro: 'Chaque ligne empêche un courrier d’être envoyé deux fois. Supprimer une ligne autorise un nouvel envoi à la prochaine modification de l’élément concerné.', fields: [text('evenement', 'Événement', { list: true, readonly: true }), text('cle', 'Élément concerné', { list: true, readonly: true }), stamp('envoyeLe', 'Envoyé le', { list: true })] },
  { key: 'audit', label: 'Action d’administration', labelPluriel: 'Journal d’audit', groupe: 'Exploitation', table: s.auditAdmin, labelProps: ['action'], search: ['email', 'action', 'entite', 'entiteId'], orderBy: 'id', readOnly: true, fields: [stamp('creeLe', 'Date', { list: true }), text('email', 'Administrateur', { list: true }), text('action', 'Action', { list: true }), text('entite', 'Objet', { list: true }), text('entiteId', 'Identifiant', { list: true })] },
];

export const resourceByKey = (key: string): Resource | undefined => RESOURCES.find((r) => r.key === key);
