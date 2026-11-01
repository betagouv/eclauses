# Port complet de l'application

Date : 2026-11-01. Branche `rewrite`. Code dans `apps/web/`. Document Grist utilisé pour tous les essais : **DEV** (`<ID du document DEV>`). Rien n'a été déployé ni modifié en PROD.

## Ce qui est porté

L'application est un seul service Next.js (TypeScript) qui remplace le widget Grist, les 22 flux n8n et le proxy d'upload. Grist reste la base de données : ses tables et ses formules ne bougent pas.

| Ancien | Nouveau |
|---|---|
| Widget Grist + `Application_Composants` | Pages Next.js, une route par page (`/acheteur-marches`) |
| ACL du document Grist | Politiques d'accès en code (`src/server/policies`), testées |
| Flux n8n déclenchés par des webhooks Grist | Gestionnaires d'événements (`src/server/events`), même déclencheurs |
| Flux n8n appelés par les pages | Routes API (`/api/auth/reset`, `/api/support/contact`, `/api/titulaires/relance`, `/api/candidats/check`) |
| Planificateurs n8n | Tâches `/api/jobs/<nom>` appelées par un planificateur |
| Connexion par `AuthLink` et jeton dans l'URL | Session signée dans un cookie `HttpOnly` |

### Pages (29 sur 29 utiles)

Toutes les pages actives du widget sont reprises, code inchangé sauf les points d'intégration (voir plus bas). Chaque page se charge à la demande.

- **Public (13)** : `accueil`, `login`, `mot-de-passe-oublie`, `reset-password`, `inscription-candidat`, `support`, `support-contact`, `statistiques`, `apropos`, `cgu`, `mentions-legales`, `donnees-personnelles`, `accessibilite`.
- **Bénéficiaire (4)** : `beneficiaire-home`, `-profil`, `-marches`, `-annuaire`.
- **Acheteur (8)** : `acheteur-home`, `-marches`, `-annuaire`, `-infos`, `-statistiques`, `-marches-declaration`, `-marches-modification`, `-marches-detail`.
- **Répondant (4)** : `repondant-home`, `-infos`, `-marches`, `-recherches`.

Non portées, volontairement : `acheteur-marches-old` (ancienne version, présente dans Grist mais inutilisée), `espace-acheteur`, `espace-beneficiaire`, `espace-repondant`, `home` et `home-grist-dsfr` (anciens conteneurs du widget, remplacés par la navigation de l'application).

L'en-tête, le menu de l'espace, le sélecteur d'espace (utilisateur à plusieurs rôles) et le pied de page sont reconstruits. Leur contenu reste éditable dans Grist (`Application_Header`, `Application_Footer`, `Application_Liens`), mis en cache cinq minutes.

## Flux n8n repris

| Flux n8n | Déclencheur | Reprise |
|---|---|---|
| Login | Page de connexion | `POST /api/auth/login` |
| Réinitialisation du mot de passe | Page `reset-password` | `GET/POST /api/auth/reset` |
| Mot de passe oublié | Webhook `Application_Password_Reset` (ajout) | événement `mot-de-passe-oublie` |
| Inscription d'un candidat | Webhook `Repondants` (ajout) | événement `inscription-candidat` |
| Vérification d'un candidat | Page `inscription-candidat` | `POST /api/candidats/check` |
| Invitation d'un titulaire | Webhook `Invitation_Titulaire` (ajout) | événement `invitation-titulaire` |
| Relance d'un titulaire | Pages acheteur | `POST /api/titulaires/relance` |
| Déclaration à valider | Webhook `Marches` (mise à jour) | événement `marche-a-valider` |
| Clause validée | Webhook `Marches` (mise à jour) | événement `marche-validee` |
| Publication d'un marché | Webhook `Marches` (mise à jour) | événement `marche-publie` |
| Bénéficiaire déclaré | Webhook `Declarations_Beneficiaires` (mise à jour) | événement `beneficiaire-declare` |
| Déclaration refusée | Webhook `Declarations_Beneficiaires_Refus` (ajout) | événement `declaration-refusee` |
| Consultation de coordonnées | Webhook `Acces_Coordonnees` (ajout) | événement `consultation-coordonnees` |
| Invitation des comptes (action manuelle) | Webhook `ActionsManuelles` | événement `invitation-comptes` |
| Contact du support | Page `support-contact` | `POST /api/support/contact` |
| Dépôt et liaison du CV | Page `beneficiaire-profil` | `POST /api/beneficiaires/{id}/cv` |
| Purge des liens expirés, anonymisation des bénéficiaires et répondants, suppression des comptes non éligibles, archivage des marchés | Planificateurs | tâches `purge-resets`, `anonymise-beneficiaires`, `anonymise-repondants`, `delete-ineligible-accounts`, `archive-marches` |

Les anciens flux `AuthLink` (création de jeton, purge) n'ont plus lieu d'être : la session est un cookie.

## Droits d'accès

Le serveur écrit dans Grist avec une clé de service (propriétaire) ; chaque lecture et écriture du navigateur passe par la politique de la table. Une table absente du registre est refusée.

| Table | Lecture | Écriture |
|---|---|---|
| `Beneficiaires` | sa fiche ; fiches consentantes à l'annuaire, éligibles, coordonnées masquées sans consentement au contact ; jamais les colonnes internes | sa fiche, liste de champs fermée ; e-mail intangible |
| `Marches` | acheteur : son entité en entier ; bénéficiaire : colonnes publiques sauf marchés non publiés ou validés ; titulaire ou candidat : colonnes publiques et statut ; visiteur : marchés publiés | acheteur : son entité, entité et indicateur de création posés par le serveur ; répondant : uniquement la soumission « Déclaration à valider » |
| `Invitation_Titulaire`, `Declarations_Beneficiaires_Refus` | acheteur : marchés de son entité | acheteur : marchés de son entité |
| `Declarations_Beneficiaires` | acheteur de l'entité ; répondant auteur | titulaire du marché (répondant posé par le serveur) ; acheteur et répondant : statut |
| `Repondants` | sa fiche | inscription publique (champs limités, marchés publiés) ; sa fiche, e-mail intangible |
| `Utilisateurs_Acheteurs`, `Acheteurs` | sa fiche ; nom des entités | nom |
| `Marches_Interets`, `Acces_Coordonnees` | les siennes | bénéficiaire : créer ou supprimer un intérêt ; répondant : consulter des coordonnées |
| `Application_Password_Reset` | aucune (vérification par le jeton, `/api/auth/reset`) | demande publique, adresse seule, limitée en débit |
| Référentiels, `Clauses_sociales` | utilisateur connecté | aucune |
| FAQ, vidéos, impacts | public (entrées publiées ; colonnes limitées pour les impacts) | aucune |

Protections communes : en-tête `Origin` exigé sur les écritures, limitation de débit sur les routes publiques, colonnes calculées et inconnues refusées, mots de passe en scrypt (l'ancien SHA-256 sans sel est accepté puis remplacé), réponse identique pour un compte inconnu ou un mauvais mot de passe.

## Écarts avec l'existant

Améliorations voulues :

- **Notification de publication non répétée** : après l'envoi, `Ne_Doit_Pas_Notifier` est posé dans Grist. L'ancien flux renvoyait le courrier à chaque modification du marché (3 marchés de DEV sont dans ce cas).
- **Une déclaration à valider ou une clause validée ne prévient qu'une fois** par passage dans cet état (mémoire du processus).
- **Marchés sans lot** : vocabulaire « marché » ou « lot » selon le cas dans tous les courriers, bloc « Clause sociale » au lieu des lots dans la publication. Une seule fonction décrit un marché pour tous les gabarits.
- **Un lot de webhook peut contenir plusieurs lignes** : toutes sont traitées (l'ancien flux ne lisait que la première).
- **Courrier « candidat a consulté vos coordonnées »** : le titre vient de la ligne concernée, plus de `body[2]`.
- **Pas de courrier vers une adresse vide** quand aucun bénéficiaire n'est actif.
- **Pièce jointe du support** acceptée et transmise (types et taille contrôlés), adresse de réponse posée.
- **Un candidat ne peut s'inscrire que sur des marchés publiés** ; un répondant ne peut plus changer son e-mail ; le titulaire d'une déclaration est contrôlé.

Anomalies de l'ancien code corrigées en reprenant les pages :

- `acheteur-infos` cherchait l'entité avec l'identifiant de l'utilisateur au lieu de celui de l'entité (il éditait l'entité d'un autre quand les numéros coïncidaient) ; il utilise désormais l'entité.
- `beneficiaire-profil` : HTML invalide (`<h3>` dans un `<p>`) ; plusieurs pages utilisaient `class`, `for`, `autocapitalize` au lieu des attributs React.

Colonnes de marché visibles en plus des règles de Grist, pour que les pages fonctionnent : `Est_lot`, `Est_marche_parent`, `Lot_Label`, `Intitule_Lot`, `Lots`, `Nb_lots`, `Marche_racine`, `Lien_Inscription_Candidat`, `Acheteur_Nom`. Elles décrivent la structure parent et lots, sans donnée sensible.

## Vérifications faites

Contre le document DEV, en développement et dans le conteneur Docker (image de 236 Mo, utilisateur non root, système de fichiers en lecture seule) :

- 41 tests unitaires : droits de lecture des marchés, bénéficiaires, CV, mots de passe, registre des pages, **17 scénarios de courriers** (publication avec et sans lot, validation, déclaration, refus, consultation, invitation, inscription, mot de passe oublié) et 5 tâches de conservation, sur un faux Grist ;
- `smoke.ts` (31 contrôles : bénéficiaire, profil, CV), `smoke-roles.ts` (38 contrôles : visiteur, acheteur, répondant) et `smoke-flows.ts` (18 contrôles : lien reçu par courrier, usage unique, support, vérification de candidat) ;
- `dry-run-events.ts` : les gestionnaires rejoués sur des lignes **réelles** de DEV, sans envoi ni écriture, pour vérifier que les champs lus existent dans les données (formules comprises) ;
- affichage de chaque page dans un navigateur, par rôle (visiteur, bénéficiaire, acheteur, répondant) : aucune erreur de console, y compris les pages détail et modification d'un marché de test.

Aucun courrier réel n'a été envoyé : le transport par défaut journalise seulement.

## Ce qui n'est pas vérifié

- **L'envoi réel par SMTP** (Scaleway Transactional Email) : le code est en place (`MAIL_TRANSPORT=smtp`), non essayé faute d'identifiants.
- **Les webhooks Grist vers l'application** : testés avec des charges réalistes et le secret, pas depuis Grist lui-même.
- **Les parcours d'écriture complets de l'interface** (déclarer un marché, inviter un titulaire, valider une déclaration) : les pages se chargent et les politiques d'écriture sont testées, mais je n'ai pas déroulé ces formulaires de bout en bout dans DEV, car cela envoie de vrais courriers par les flux n8n de DEV.
- **La charge** et l'accessibilité (RGAA) de l'ensemble.
- **Le pare-feu de l'instance Grist** depuis une adresse Scaleway.

## Mise en production

1. **Secrets du conteneur** : `GRIST_DOC_ID`, `GRIST_API_KEY` (clé propriétaire), `SESSION_SECRET`, `WEBHOOK_SECRET`, `CRON_SECRET`, `PUBLIC_URL`, et pour les courriers `MAIL_TRANSPORT=smtp`, `SMTP_*`, `MAIL_FROM`. Voir `apps/web/.env.example`.
2. **Avant d'activer les webhooks** : repérer les marchés dont `Doit_Notifier_Publication` est vrai (arriérés d'anciennes publications) et poser `Ne_Doit_Pas_Notifier` sur ceux déjà notifiés ; sinon la première modification déclencherait un courrier à tous les bénéficiaires.
3. **Webhooks Grist** (dans le document, en remplacement de ceux de n8n) : URL `{PUBLIC_URL}/api/webhooks/grist/{événement}`, en-tête `Authorization: Bearer {WEBHOOK_SECRET}` :

   | Table | Événement | Événement applicatif |
   |---|---|---|
   | `Marches` | mise à jour | `marche-publie`, `marche-a-valider`, `marche-validee` (trois webhooks ; supprimer le doublon actuel de `marche/a_valider`) |
   | `Declarations_Beneficiaires` | mise à jour | `beneficiaire-declare` |
   | `Declarations_Beneficiaires_Refus` | ajout | `declaration-refusee` |
   | `Acces_Coordonnees` | ajout | `consultation-coordonnees` |
   | `Invitation_Titulaire` | ajout | `invitation-titulaire` |
   | `Repondants` | ajout | `inscription-candidat` |
   | `Application_Password_Reset` | ajout | `mot-de-passe-oublie` |
   | `ActionsManuelles` | mise à jour | `invitation-comptes` |

4. **Tâches planifiées** : un appel par nuit à `POST {PUBLIC_URL}/api/jobs/all` avec `Authorization: Bearer {CRON_SECRET}` (Scaleway Serverless Jobs ou cron du conteneur).
5. **Document Grist** : une fois l'ancien widget retiré, retirer l'accès « éditeur » donné à Tout le monde. Seule la clé de service garde l'accès.
6. **Bascule** : désactiver les flux n8n et les webhooks vers n8n le jour où les nouveaux webhooks sont activés, pour ne pas envoyer chaque courrier deux fois.

## Limites connues

- Sessions sans révocation avant 24 h ; limiteur de débit et mémoire des notifications dans le processus : une seule instance. Pour plusieurs instances ou une garantie forte, ajouter un stockage partagé et une table d'envois dans Grist.
- `gristAPI` côté navigateur est une couche de transition pour réutiliser le code des pages ; les pages sont à typer et à découper progressivement.
- Lecture de toutes les lignes d'une table à chaque affichage (jusqu'à 275 bénéficiaires, 1,2 Mo) : acceptable aujourd'hui ; au-delà, passer par le point d'accès SQL avec une liste de colonnes.
