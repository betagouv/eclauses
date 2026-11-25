# Navigation et espaces

## Navigation interne

La navigation interne repose sur `data-nav`.

Exemple :

```html
<a href="#" data-nav="support-contact">Contact</a>
```

`setupGlobalNavHooks()` intercepte les clics, empêche le comportement par défaut et appelle :

```js
this.loadComponent(id, { anchor })
```

Une API globale existe aussi :

```js
window.gristNavigate(id, options)
```

## Navigation depuis les pages

Les pages utilisent :

```js
gristAPI.navigate('acheteur-marches-detail')
```

Le runtime ne pousse pas actuellement d'URL applicative complète dans l'historique. Il remplace le contenu du `main` par le composant demandé.

## Ancres

Un lien peut fournir `data-anchor`.

Le runtime appelle `scrollToAnchor(anchor)` après rendu :

- retire le `#` éventuel ;
- tente de trouver l'élément pendant 20 essais ;
- appelle `scrollIntoView()` ;
- ajoute `tabindex="-1"` et focus avec `preventScroll`.

## Espaces multi-rôles

Un utilisateur peut avoir plusieurs rôles dans `AuthLink.Roles`. Le runtime gère un espace actif :

- stocké en mémoire dans `session.activeSpace` ;
- persisté dans `localStorage.activeSpace` ;
- affiché dans le menu connecté.

Priorité par défaut :

1. `beneficiaire`
2. `acheteur`
3. `repondant`

Le menu connecté propose :

- Espace candidat / titulaire ;
- Espace bénéficiaire ;
- Espace acheteur ;
- Se déconnecter.

Le composant affiché doit correspondre à l'espace actif si `nav_roles` est renseigné.

