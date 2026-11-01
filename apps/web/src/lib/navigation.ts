/** Navigation entre pages : un identifiant de page du widget est une route de l'application. */
let navigator: ((path: string) => void) | null = null;

export function setNavigator(fn: (path: string) => void): void {
  navigator = fn;
}

export function pagePath(pageId: string): string {
  return pageId === 'home' || pageId === 'accueil' ? '/' : `/${pageId}`;
}

export function navigate(pageId: string): void {
  const path = pagePath(pageId);
  if (navigator) navigator(path);
  else window.location.assign(path);
}

/** Page d'accueil selon la session : le serveur redirige vers l'espace du rôle. */
export function goToDefault(): void {
  navigate('home');
}
