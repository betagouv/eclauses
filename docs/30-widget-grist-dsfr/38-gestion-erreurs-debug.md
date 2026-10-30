# Gestion des erreurs et debug

## Erreurs d'initialisation

Si `ReactApp.init()` échoue, le runtime affiche :

```text
Erreur initialisation
```

avec le message de l'exception.

Causes fréquentes :

- Grist Plugin API non disponible ;
- accès Grist insuffisant ;
- table `Application_Composants` absente ou inaccessible ;
- composant invalide dans `Application_Composants`.

## Erreurs de composant

`showComponentError()` affiche :

- l'identifiant du composant ;
- le message ;
- la stack trace si disponible.

Erreurs courantes :

- composant non défini : il faut déclarer `const Component = () => {}` ou `function Component() {}` ;
- import non supporté ;
- plugin Babel indisponible ;
- syntaxe JSX invalide ;
- référence à une variable non définie dans la page.

## Debug

`Application_Env.DEBUG` active `debugLog()`.

À documenter dans les runbooks :

- comment activer temporairement DEBUG en DEV ;
- comment lire les erreurs console ;
- comment retrouver un composant par `template_id` ;
- comment vérifier si un composant est page ou shared component.

