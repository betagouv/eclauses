import { headers } from 'next/headers';
import { clientIp, rateLimit } from '@/server/http';
import { etatJeton } from '@/server/services/comptes';
import ResetPasswordForm from './ResetPasswordForm';

const mask = (email: string) => {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
};

/** Lien reçu par courrier : l'état du jeton est lu côté serveur (sans le consommer) pour afficher le bon formulaire. */
export async function ResetPassword({ query }: { query: Record<string, string | undefined> }) {
  const token = String(query.token ?? '').trim();
  await rateLimit(`reset-check:${clientIp(new Request('http://x', { headers: await headers() }))}`, 30, 15 * 60_000).catch(() => undefined);
  const etat = await etatJeton(token);
  const initial = {
    token,
    valid: etat.valide,
    used: etat.utilise,
    type: etat.valide ? (etat.objectif === 'activation' ? 'creat' : 'reset') : null,
    email: etat.valide ? mask(etat.email ?? '') : null,
  };
  return <ResetPasswordForm initial={initial} />;
}
