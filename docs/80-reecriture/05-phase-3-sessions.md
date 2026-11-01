# Phase 3 : sessions révocables et limiteur de débit partagé

Branche `rewrite-postgres`.

## Sessions

- Le cookie (`httpOnly`, `SameSite=Lax`, `Secure` en production) contient un **jeton aléatoire opaque**. La table `sessions` n'en garde que l'empreinte SHA-256, avec l'expiration (24 h) et une date de révocation. Plus de secret de signature (`SESSION_SECRET` et la bibliothèque `jose` sont retirés) et plus aucun identifiant métier côté navigateur.
- **Les rôles sont recalculés à chaque requête** depuis la base : un bénéficiaire qui cesse d'être éligible, un répondant à supprimer ou un compte supprimé perdent l'accès immédiatement, sans attendre l'expiration.
- **Révocation côté serveur** : la déconnexion révoque la session ; un nouveau mot de passe (lien d'activation ou de réinitialisation) révoque toutes les sessions du compte ; la tâche `delete-ineligible-accounts` supprime déjà les sessions des comptes retirés.
- `purge-sessions` efface les sessions expirées ou révoquées.

## Limiteur de débit

- Table `limites_debit` (clé, compteur, fin de fenêtre). L'incrément est un `INSERT … ON CONFLICT DO UPDATE` atomique : aucun essai perdu sous concurrence, partagé entre instances et conservé après un redémarrage.
- Mêmes seuils qu'avant (connexion, jeton, vérification de candidat, support, création publique). `rateLimit` est maintenant asynchrone.
- `purge-sessions` efface aussi les compteurs échus.

## Vérifié

- 12 tests (`tests/sessions.test.ts`) : empreinte seule en base, jeton invalide, déconnexion, expiration, rôles recalculés, compte supprimé, mot de passe changé, sessions des autres comptes préservées ; limiteur par clé, sous concurrence (12 appels simultanés pour un seuil de 5 : exactement 5 passent), fenêtre échue, purge.
- `scripts/smoke.ts` : cookie rejoué après déconnexion refusé, session ouverte avant une réinitialisation fermée par le nouveau mot de passe, rafale de connexions limitée (429).

## À savoir

- Pas de limite du nombre de sessions par compte ni d'expiration glissante (24 h fixes) : à décider avec l'équipe.
- Chaque requête authentifiée fait une lecture de session et le calcul des rôles (4 requêtes SQL courtes). Si la charge l'exige, un cache de quelques secondes est possible, au prix d'une révocation un peu différée.
