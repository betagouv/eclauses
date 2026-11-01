import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin/AdminShell';
import { currentSession } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Toute l'administration passe ici : connexion, rôle administrateur, puis double authentification validée. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login?next=admin');
  if (!session.roles.includes('admin')) notFound();
  if (!session.mfa) redirect('/admin/verification');
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
