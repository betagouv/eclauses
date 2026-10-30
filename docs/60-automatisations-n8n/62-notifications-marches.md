# Notifications marchés

## Publication parent

Dans le modèle multi-lots, la publication est au niveau du marché parent.

L'email de publication doit :

- présenter le marché parent ;
- présenter l'acheteur ;
- afficher la date limite de remise des offres ;
- afficher la liste HTML des lots concernés ;
- diriger vers l'espace Eclauses.

La liste des lots peut être préparée dans une donnée comme `Lots_Detail_HTML` pour éviter une expression n8n complexe dans le template HTML.

### Marché sans lot (non alloti)

Un marché sans lot est un marché parent sans `Marche_parent` et avec zéro lot. Il n'a pas de liste de lots (`Lots_Detail` est vide). Le mail de publication doit alors :

- dire « un nouveau marché avec clause sociale » (sans « comprenant des lots ») ;
- afficher la clause sociale du marché au lieu du bloc « Lots concernés » ;
- renvoyer vers l'espace Eclauses sans citer la page « Lots actifs ».

Le workflow corrigé (`n8n/PROD - Eclauses - corrige mails.json`) distingue les deux cas avec `Nb_lots` et `Est_Alloti`. La clause et les destinataires viennent de `Clauses_sociales_parent_ou_enfants` ; les formules à corriger sont dans [deploiement/correctifs-mails-sans-lot.md](../../deploiement/correctifs-mails-sans-lot.md).

### Destinataires

Les destinataires sont les bénéficiaires de la clause du marché (`Clauses_sociales.Beneficiaires_Actif`, fiche à jour). Le flux envoie un mail par destinataire. Une liste vide ne doit envoyer aucun mail.

### Points d'attention

- Le webhook Grist est déclenché à chaque mise à jour d'une ligne de `Marches`. Le flux n'écrit aucun marqueur « déjà notifié » : tant que `Doit_Notifier_Publication` est vrai, une nouvelle mise à jour peut renvoyer le mail à tous les bénéficiaires.
- Le flux ne lit que `body[0]`. Une mise à jour groupée de plusieurs lignes ne notifie que la première.

## Inscription candidat

Le lien d'inscription contient l'identifiant du parent. Le formulaire se charge ensuite d'afficher les lots enfants ou le marché non alloti.

