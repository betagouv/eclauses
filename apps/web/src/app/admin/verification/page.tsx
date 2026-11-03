import { notFound, redirect } from 'next/navigation';
import { VerificationForm } from '@/features/admin/VerificationForm';
import { statutMfa } from '@/server/admin/mfa';
import { currentSession } from '@/server/http';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vérification en deux étapes - Administration Eclauses', robots: { index: false, follow: false } };

/** Seconde étape : réservée aux administrateurs connectés (les autres reçoivent une page introuvable, sans rien révéler). */
export default async function Page() {
  const session = await currentSession();
  if (!session) redirect('/login?next=admin');
  if (!session.roles.includes('admin')) notFound();
  if (session.mfa) redirect('/admin');
  const { active, methode } = await statutMfa(session.email);
  return <VerificationForm active={active} methode={methode} />;
}
