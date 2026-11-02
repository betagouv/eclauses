# Plan de bascule : de Grist + n8n vers l'application PostgreSQL

Ce plan décrit comment passer la production d'Eclauses de Grist (base) + widgets + n8n (courriers, tâches) à `apps/web` (PostgreSQL, fichiers sur S3, courriers et tâches intégrés). Il est découpé en phases, sans dates : chaque phase a une sortie claire, et la suivante ne démarre pas tant que celle-ci n'est pas atteinte.

Règles du dépôt qui s'appliquent : aucune écriture ni suppression dans Grist PROD, aucun changement des flux n8n PROD sans validation explicite (voir `AGENTS.md`). L'import lit Grist en lecture seule.

## Principes

- **Grist reste la source de secours** jusqu'à la fin de la période de surveillance : on ne l'efface pas, on le met en lecture seule.
- **Une répétition complète avant la vraie bascule**, sur l'infrastructure cible, avec une copie de PROD.
- **Pas de synchronisation retour** : une fois la nouvelle application utilisée, les écritures n'existent que chez elle. Le retour arrière n'est donc possible que pendant une courte fenêtre (voir « Retour arrière »).
- **Aucun courrier parasite** : l'import marque comme « déjà envoyés » les courriers dont l'état est déjà atteint dans Grist (publication, à valider, validée…).

## Décisions à prendre avant de commencer

| Sujet | À décider | Pourquoi |
|---|---|---|
| Hébergement | Produit Scaleway pour l'application (conteneur serverless, instance…) | Détermine le déploiement et le planificateur |
| Base | PostgreSQL géré (version 16 ou supérieure), région, sauvegardes | Données personnelles : sauvegarde et restauration testées |
| Fichiers | Bucket S3 (Scaleway Object Storage), privé | Les CV ne doivent jamais être publics |
| Courriers | Scaleway Transactional Email (ou autre SMTP) et domaine d'envoi | SPF, DKIM, DMARC à configurer avant la bascule |
| Domaine | `eclauses.beta.gouv.fr` pointe vers la nouvelle application | DNS et certificat |
| Fenêtre | Créneau de faible activité, annoncé aux utilisateurs | Durée de l'arrêt d'écriture |
| Pages légales | Textes validés (hébergeur, données, accessibilité) | Elles citent encore Grist |

## Phase 0 : préparer l'environnement cible

Sortie : une instance « préproduction » complète, vide, qui démarre et répond.

1. Créer la base PostgreSQL gérée, un utilisateur applicatif dédié (pas le propriétaire), accès réseau limité à l'application.
2. Créer le bucket S3 privé et une clé d'accès limitée à ce bucket (`STORAGE_DRIVER=s3`, `S3_*`).
3. Configurer le domaine d'envoi des courriers : SPF, DKIM, DMARC ; envoyer un courrier de test depuis `MAIL_TRANSPORT=smtp`.
4. Construire l'image (`Dockerfile` à la racine) et la déployer. Au démarrage, elle applique les migrations (`migrate.mjs`) puis lance le serveur.
5. Renseigner les variables d'environnement (jamais dans le dépôt) :
   - `DATABASE_URL`, `POSTGRES_PASSWORD` (si utile), `STORAGE_DRIVER`, `S3_*`.
   - `PUBLIC_URL` (adresse publique exacte : elle sert aux liens des courriers, aux liens canoniques et au plan du site).
   - `MAIL_TRANSPORT=smtp`, `SMTP_*`, `MAIL_FROM`, `SUPPORT_TO`.
   - `MFA_ENCRYPTION_KEY` (64 caractères hexadécimaux, à conserver dans le coffre : la perdre rend les secrets 2FA illisibles).
   - `CRON_SECRET`, `TRUSTED_PROXIES` (nombre de proxys réellement devant l'application).
6. Vérifier `GET /api/health`, `GET /robots.txt`, `GET /sitemap.xml`, et les en-têtes de sécurité (politique de contenu, HSTS).
7. Régler le répartiteur de charge ou CDN : ne rien mettre en cache quand le cookie `__Host-eclauses_session` est présent.
8. Brancher le planificateur : un appel quotidien (nuit) à `POST /api/jobs/all` avec `Authorization: Bearer $CRON_SECRET`. Vérifier qu'il répond 200.
9. Mettre en place surveillance et alertes : disponibilité de `/api/health`, erreurs applicatives, espace disque de la base, échecs d'envoi de courrier.
10. Sauvegardes : activer les sauvegardes automatiques de la base et **tester une restauration** sur une base vide.

## Phase 1 : répétition générale (copie de PROD)

Sortie : un rapport de répétition signé, avec les durées mesurées.

1. Import depuis Grist PROD vers la préproduction (lecture seule côté Grist) :
   ```bash
   cd apps/web
   npx tsx scripts/import-grist.ts --allow-remote-target
   ```
   Source : `GRIST_BASE_URL`, `GRIST_DOC_ID` (`<ID du document PROD>`, à revérifier avant), `GRIST_API_KEY` (dans `.gristkey`, jamais copiée ailleurs). `--replace` est refusé sur une cible distante : la cible doit être vide.
2. Contrôle de parité des formules réimplémentées :
   ```bash
   npx tsx scripts/verify-import.ts
   ```
   Attendu : aucun écart non expliqué. Le seul écart connu sur PROD (1 sur 2815) est expliqué ; tout écart nouveau est analysé avant de continuer.
3. Comparer les volumes, table par table, entre Grist et PostgreSQL (le script les affiche) ; vérifier le nombre de CV transférés et ouvrir un échantillon.
4. Créer le premier administrateur et activer sa double authentification :
   ```bash
   npx tsx scripts/create-admin.ts prenom.nom@exemple.fr --allow-remote-target
   ```
   Se connecter à `/admin`, activer la 2FA, conserver les codes de secours.
5. Dérouler les parcours avec des comptes réels de l'équipe (volontaires prévenus) :
   - bénéficiaire : connexion avec l'ancien mot de passe (le hachage historique est accepté puis remplacé), mise à jour de la fiche, dépôt d'un CV, intérêt pour un marché ;
   - acheteur : création d'un marché alloti, publication, invitation d'un titulaire, validation d'une déclaration ;
   - candidat/titulaire : inscription, déclaration de bénéficiaires, consultation de coordonnées ;
   - mot de passe oublié, formulaire de support ;
   - administration : liste des comptes, fusion d'un doublon test, lancement d'une tâche sans effet de bord.
6. Vérifier les courriers réellement reçus (objet, liens vers `PUBLIC_URL`, expéditeur, dossier spam).
7. Mesurer : durée de l'import (donc de la fenêtre de bascule), temps de réponse des pages, durée de la restauration de la base.
8. Corriger, puis refaire l'import à vide si la correction touche les données.
9. Vider la préproduction de ses données personnelles une fois la répétition terminée (ou la protéger comme la production).

## Phase 2 : préparer l'annonce et le terrain

Sortie : tout le monde sait ce qui change et quand.

1. Faire valider et publier les pages légales (mentions légales, données personnelles, accessibilité) avec le nouvel hébergeur et le nouveau traitement.
2. Corriger le texte de la FAQ qui parle encore de « MagicLink » et vérifier les autres réponses.
3. Informer les utilisateurs (bénéficiaires, acheteurs, titulaires) : date et heure de la fenêtre, interruption brève, conservation de leur mot de passe, nouvelle adresse de contact.
4. Réduire le TTL du DNS (par exemple à 5 minutes) au moins une journée avant la bascule.
5. Préparer le support : qui répond, consignes pour les problèmes de connexion et de courrier.
6. Geler les évolutions de Grist (pas de changement de structure) jusqu'à la bascule.

## Phase 3 : jour de bascule

Sortie : l'application PostgreSQL sert la production ; Grist est en lecture seule.

Critère de départ (go/no-go) : répétition validée, préproduction saine, sauvegarde de la base prête, équipe disponible, aucune évolution de Grist en cours.

1. **Arrêt des écritures dans Grist.** Mettre le document Grist PROD en lecture seule pour tous sauf les propriétaires (réglage fait par vous dans l'interface de Grist ; le code ne le fait pas). Afficher le message de maintenance aux utilisateurs.
2. **Arrêter les flux n8n PROD** (désactivation, avec votre validation explicite : aucun courrier ne doit partir de l'ancien système après l'arrêt). Noter l'heure exacte.
3. **Import final** vers la base de production, lecture seule côté Grist :
   ```bash
   cd apps/web
   npx tsx scripts/import-grist.ts --allow-remote-target
   ```
   Les courriers déjà atteints dans Grist sont marqués envoyés : pas de rafale de courriers.
4. **Contrôle de parité** : `npx tsx scripts/verify-import.ts`, plus la comparaison des volumes. Aucun écart non expliqué, sinon arrêt et décision (voir « Retour arrière »).
5. **Premier administrateur** et 2FA (comme en répétition), puis création des autres depuis `/admin/comptes`.
6. **Sauvegarde immédiate** de la base importée (point de restauration « J0 »).
7. **Bascule du DNS** vers la nouvelle application ; vérifier le certificat HTTPS.
8. **Contrôles de fumée en production** (lecture et connexions de l'équipe, sans créer de données de test inutiles) :
   - accueil, connexion d'un compte de l'équipe de chaque profil, une fiche, un marché, un CV ;
   - courrier « mot de passe oublié » reçu, lien correct ;
   - `/api/health`, `robots.txt`, `sitemap.xml`, `/admin` avec 2FA.
9. Activer le planificateur des tâches nocturnes.
10. Retirer le message de maintenance et prévenir les utilisateurs que le service est ouvert.

## Phase 4 : surveillance renforcée

Sortie : une période sans incident bloquant.

- Pendant les premiers jours : surveiller erreurs applicatives, échecs d'envoi de courrier, taux de connexion refusée, demandes au support.
- Vérifier le premier passage des tâches nocturnes (journal d'audit et sorties) : aucune anonymisation ni suppression inattendue (comparer les nombres traités avec ce qu'annonçaient les formules de Grist).
- Contrôler que les utilisateurs qui n'avaient jamais activé leur compte peuvent le faire (liens d'activation valables 30 jours).
- Vérifier chaque semaine la sauvegarde et un test de restauration.
- Traiter les doublons signalés dans `/admin/fusion` au fil de l'eau.

## Retour arrière

| Moment | Possible ? | Comment |
|---|---|---|
| Avant le changement de DNS | Oui, sans perte | Réactiver n8n, rendre Grist de nouveau modifiable, annuler la bascule |
| Après le DNS, avant toute écriture réelle dans la nouvelle application | Oui, sans perte | Remettre l'ancien DNS, réactiver n8n, rendre Grist modifiable |
| Après des écritures réelles | Difficile : il n'y a pas de synchronisation retour | Corriger en avant ; sinon, retour à Grist avec perte volontaire des écritures récentes, après décision du responsable |

Fenêtre de décision recommandée : pendant la première journée, le responsable fixe un point « on garde » ou « on revient ». Au-delà, on ne revient plus : on corrige.

## Après la période de surveillance

1. **Grist** : le conserver en lecture seule pour la durée de conservation retenue, puis l'archiver ; ne rien supprimer sans validation.
2. **n8n** : désinstaller les flux (désactivés d'abord), après avoir exporté et archivé leurs définitions dans le dépôt.
3. **Copies locales** : supprimer la base `eclauses_prod_copy` et le dossier `apps/web/var/fichiers-prod` des postes de travail, ainsi que les bases de préproduction contenant des données réelles.
4. **Dépôt** : fusionner la branche `rewrite-postgres` dans `main`, mettre à jour `AGENTS.md` (Grist et n8n ne sont plus l'application en place), supprimer ou archiver `grist/`, `grist-dsfr-react-app/` et les exports n8n.
5. **Clés** : révoquer la clé API Grist de l'import quand elle n'est plus nécessaire.
6. **Évolutions** : remplacer la couche de compatibilité `compat/` par des modèles typés ; ajouter une image de partage et un favicon.

## Check-list courte du jour J

- [ ] Répétition validée et rapport signé
- [ ] Sauvegarde de la base testée en restauration
- [ ] Variables d'environnement en place, `MFA_ENCRYPTION_KEY` dans le coffre
- [ ] Courriers de test reçus (SPF, DKIM, DMARC)
- [ ] Pages légales validées et publiées
- [ ] Utilisateurs prévenus, TTL du DNS réduit
- [ ] Grist en lecture seule, n8n arrêté (heure notée)
- [ ] Import final et parité vérifiés
- [ ] Administrateur créé, 2FA active, codes de secours conservés
- [ ] Sauvegarde « J0 » faite
- [ ] DNS basculé, HTTPS valide
- [ ] Contrôles de fumée passés, planificateur actif
- [ ] Point « on garde / on revient » fixé
