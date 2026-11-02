# Espace d'administration

Back-office intégré à `apps/web`, sous `/admin`. Réservé aux comptes `utilisateurs.est_admin`.

## Sécurité
- Mot de passe puis double authentification (TOTP, RFC 6238) obligatoire ; validation valable 12 h par session.
- Secret TOTP chiffré (AES-256-GCM, clé `MFA_ENCRYPTION_KEY`, 64 caractères hexadécimaux), 8 codes de secours à usage unique, anti-rejeu, limitation 5 essais / 15 min.
- Chaque écriture (Server Action) revérifie le rôle et la double authentification (`requireAdmin`) et est journalisée dans `audit_admin`.
- Création du premier administrateur : `npx tsx scripts/create-admin.ts adresse@exemple.fr` (affiche un lien d'activation ; refuse une base non locale sans `--allow-remote-target`). Les suivants se créent depuis `/admin/comptes`.

- Premier enrôlement 2FA : outre le code de l'application, un code à 8 chiffres envoyé par courrier à l'administrateur est exigé (le mot de passe seul ne suffit pas).

## Durcissement transverse (audit du 2026-11-02)
- Adresse IP : `TRUSTED_PROXIES` (défaut 1) = nombre de proxys ; on retient l'entrée de `X-Forwarded-For` ajoutée par le dernier proxy de confiance. Connexion limitée aussi par compte (40 essais / h).
- En-têtes de sécurité dans `next.config.ts` (CSP, `frame-ancestors 'none'`, HSTS en production, etc.).
- Dépôts de fichiers : `Content-Length` exigé et plafonné avant lecture (`formDataLimite`).
- Mot de passe : 10 caractères minimum ; cookie `__Host-eclauses_session` en production ; HTML d'en-tête et de pied de page assaini (`assainirHtml`) ; « mot de passe oublié » ne révèle plus l'existence du compte par son temps de réponse.

## Cache des pages publiques
- `next.config.ts` : accueil, aide, statistiques (5 min) et textes légaux, à propos (1 h) reçoivent `Cache-Control: public, max-age=0, s-maxage=…, stale-while-revalidate` **uniquement pour une requête sans cookie de session**. Les requêtes avec session restent `no-store`.
- Un modification faite dans l'administration est visible au plus tard après ce délai pour les visiteurs.
- À régler sur le CDN / répartiteur de charge (Next.js remplace l'en-tête `Vary`) : ne rien mettre en cache quand le cookie `__Host-eclauses_session` est présent.

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

## Écarts avec n8n corrigés (2026-11-02)
- Anonymisation d'un bénéficiaire : spécialités, départements, régions, commentaire interne et missions proposées sont aussi effacés.
- Bénéficiaires non éligibles : le compte de connexion est supprimé (la fiche reste), sauf s'il sert aussi à un candidat, un acheteur ou un administrateur.
- Relance d'un titulaire dont l'espace n'est pas activé : objet « Relance : actions requises suite à votre titularisation sur un marché », comme dans n8n.
- Décision : un bénéficiaire déclaré ne reçoit **aucun** courrier (le flux `beneficiaire/declarer/valide` n'existe plus, ni dans le code ni à reprendre dans n8n).
