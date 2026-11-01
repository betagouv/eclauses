import { redirect } from 'next/navigation';
import { currentSession } from '@/server/http';
import LoginForm from './LoginForm';

/** Connexion : un utilisateur déjà connecté est renvoyé à l'accueil de son espace, sans afficher le formulaire. */
export async function Login({ query }: { query: Record<string, string | undefined> }) {
  if (await currentSession()) redirect('/');
  const next = String(query.next ?? '').trim();
  // Seul un identifiant de page est accepté (jamais une adresse complète : pas de redirection ouverte).
  return <LoginForm next={/^[a-z0-9-]+$/.test(next) ? next : null} />;
}
