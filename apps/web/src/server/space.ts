import { cookies } from 'next/headers';
import type { Session } from './auth/session';
import { SPACE_PRIORITY, type Role } from '@/lib/pages';

export const SPACE_COOKIE = 'eclauses_space';

/** Espace actif : le choix mémorisé s'il est encore permis, sinon le premier rôle par priorité. */
export async function activeSpace(session: Session | null): Promise<Role | null> {
  if (!session) return null;
  const saved = (await cookies()).get(SPACE_COOKIE)?.value;
  if (saved && (session.roles as string[]).includes(saved)) return saved as Role;
  return SPACE_PRIORITY.find((r) => session.roles.includes(r)) ?? null;
}
