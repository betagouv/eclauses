# Vue d'ensemble des tables Grist

Grist sert de base de données, de CMS applicatif et de support d'authentification.

Cette section décrit le modèle selon le code local DEV. Les colonnes exactes doivent être confirmées par export schema ou MCP Grist avant gel de documentation production.

## Tables application

| Table | Rôle |
|---|---|
| `Application_Composants` | Pages et composants React dynamiques. |
| `Application_Env` | Variables utilisées par les pages et le runtime. |
| `Application_Header` | Configuration du header. |
| `Application_Footer` | Configuration du footer. |
| `Application_Liens` | Liens internes/externes du header/footer. |
| `Application_FAQ_Categories` | Catégories du centre d'aide. |
| `Application_FAQ_Questions` | Questions/réponses du centre d'aide. |
| `Application_Password_Reset` | Demandes de réinitialisation de mot de passe. |

## Tables auth et acteurs

| Table | Rôle |
|---|---|
| `AuthLink` | Tokens, rôles et liaisons vers acteurs. |
| `Beneficiaires` | Profils bénéficiaires, annuaire, CV, éligibilité. |
| `Repondants` | Candidats et titulaires. |
| `Utilisateurs_Acheteurs` | Comptes acheteurs. |
| `Acheteurs` | Entités acheteuses. |

## Tables marchés et déclarations

| Table | Rôle |
|---|---|
| `Marches` | Marchés parents et lots enfants. |
| `Invitation_Titulaire` | Invitations et relances titulaires par marché/lot. |
| `Declarations_Beneficiaires` | Déclarations de bénéficiaires par lot ou marché non alloti. |
| `Declarations_Beneficiaires_Refus` | Historique des refus de déclarations. |
| `Clauses_sociales` | Référentiel des clauses. |
| `T0_Referentiel_Specialites` | Référentiel des spécialités avec tooltip. |

## Tables référentielles complémentaires

Les pages utilisent aussi des référentiels de formation, localisation, départements, régions, statuts ou classements. Ces tables doivent être listées précisément après export schema DEV.

