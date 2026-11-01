import { grist } from '../config';
import type { Session } from './session';

type Id = number | null;
const asId = (v: unknown): Id => (typeof v === 'number' && v > 0 ? v : null);

/**
 * Détermine les rôles d'une adresse e-mail. Reprend les règles d'`AuthLink.Roles` et de `loadAuth`
 * du widget : un bénéficiaire doit être éligible et ne pas être marqué « à supprimer », un répondant
 * ne doit pas être marqué « à supprimer ».
 */
export async function resolveIdentity(email: string): Promise<Session | null> {
  const g = grist();
  const mail = email.trim().toLowerCase();

  // Les trois recherches sont indépendantes : on les lance en parallèle (≈ 3 fois plus rapide).
  const [[benef], [repondant], [acheteur]] = await Promise.all([
    g.sql<{ id: number }>(
      'SELECT id FROM Beneficiaires WHERE lower(Courriel) = ?1 AND COALESCE(Eligible,0) = 1 AND COALESCE(Doit_supprimer,0) = 0 LIMIT 1',
      [mail],
    ),
    g.sql<{ id: number }>(
      'SELECT id FROM Repondants WHERE lower(Email) = ?1 AND COALESCE(Doit_supprimer,0) = 0 LIMIT 1',
      [mail],
    ),
    g.sql<{ id: number; Entite_de_rattachement: number }>(
      'SELECT id, Entite_de_rattachement FROM Utilisateurs_Acheteurs WHERE lower(Email) = ?1 LIMIT 1',
      [mail],
    ),
  ]);

  const roles: Session['roles'] = [];
  if (benef) roles.push('beneficiaire');
  if (repondant) roles.push('repondant');
  if (acheteur) roles.push('acheteur');
  if (!roles.length) return null;

  return {
    email: mail,
    roles,
    beneficiaireId: asId(benef?.id),
    repondantId: asId(repondant?.id),
    acheteurId: asId(acheteur?.id),
    acheteurEntiteId: asId(acheteur?.Entite_de_rattachement),
  };
}
