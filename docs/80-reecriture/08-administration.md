# Espace d'administration

Back-office intégré à `apps/web`, sous `/admin`. Réservé aux comptes `utilisateurs.est_admin`.

## Sécurité
- Mot de passe puis double authentification (TOTP, RFC 6238) obligatoire ; validation valable 12 h par session.
- Secret TOTP chiffré (AES-256-GCM, clé `MFA_ENCRYPTION_KEY`, 64 caractères hexadécimaux), 8 codes de secours à usage unique, anti-rejeu, limitation 5 essais / 15 min.
- Chaque écriture (Server Action) revérifie le rôle et la double authentification (`requireAdmin`) et est journalisée dans `audit_admin`.
- Création du premier administrateur : `npx tsx scripts/create-admin.ts adresse@exemple.fr` (affiche un lien d'activation ; refuse une base non locale sans `--allow-remote-target`). Les suivants se créent depuis `/admin/comptes`.

## Écrans
- Tableau de bord : indicateurs et dernières actions.
- Moteur générique (`server/admin/resources.ts`) : liste, recherche, filtres, création, modification, suppression des référentiels, du contenu, des acheteurs, bénéficiaires, candidats, marchés, déclarations, journaux.
- Comptes (`/admin/comptes`) : liens d'activation et de réinitialisation, désactivation, droits d'administration, réinitialisation de la 2FA.
- Marché créé par l'administration pour une entité (`creation_en_autonomie = false`, mêmes courriers que pour un acheteur).
- Fusion de doublons (`/admin/fusion`) : aperçu puis fusion transactionnelle (bénéficiaires, candidats), consentement le plus restrictif conservé, détection des doublons probables.
- Tâches (`/admin/taches`) : lancement manuel des tâches d'exploitation, confirmation renforcée pour celles qui envoient des courriers ou effacent des données.

## Reste à faire
- Les mentions légales et la page données personnelles citent encore Grist.
- Plan de bascule en production (gel de Grist, courriers, DNS) non rédigé.
- Pas de contrôle automatisé des écrans admin dans `scripts/smoke.ts`.
