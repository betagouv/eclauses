# Iframe Grist et affichage

## Structure

Le wrapper utilise :

```html
<div class="frame-wrap">
  <iframe id="embed" data-src="..."></iframe>
</div>
```

`.frame-wrap` occupe toute la fenêtre et masque les débordements. L'iframe est positionnée en absolu.

## Recadrage

Les variables CSS suivantes pilotent l'affichage :

- `--offset-x` ;
- `--offset-y` ;
- `--zoom`.

Dans l'état actuel, le zoom n'est pas appliqué par `transform`. Le recadrage est fait avec `left` et `top` négatifs :

```css
#embed {
  left: calc(-1px * var(--offset-x));
  top: calc(-1px * var(--offset-y));
}
```

Ce choix évite de casser le positionnement des menus, dropdowns et popovers qui peuvent se baser sur les coordonnées viewport.

## Responsive

Le tableau `CONFIG` définit les offsets par largeur :

- `sm` et `md` : `y = 38` ;
- `lg`, `xl`, `xxl` : `y = 54`.

La fonction `applyConfig()` est appelée au chargement et après un resize avec debounce.

## Point de maintenance

Toute modification de l'URL Grist dans `data-src` doit être documentée dans la checklist de déploiement. L'URL actuelle du wrapper local pointe vers le document PROD connu ; il faut vérifier l'URL cible avant publication.

