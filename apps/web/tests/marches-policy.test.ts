import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth/session';

vi.mock('@/server/config', () => ({ grist: () => ({}), config: () => ({}) }));
const { visibleColumns } = await import('@/server/policies/marches');

const session = (over: Partial<Session>): Session => ({
  email: 'a@b.fr',
  roles: [],
  beneficiaireId: null,
  repondantId: null,
  acheteurId: null,
  acheteurEntiteId: null,
  ...over,
});
const marche = (over: Record<string, unknown>) => ({ id: 1, Acheteur: 4, Statut: 'En attente de notification', Titulaire: 0, Candidats: ['L'], ...over });

describe('visibilité des marchés', () => {
  it("l'acheteur de l'entité voit tout, pas celui d'une autre entité", () => {
    const buyer = session({ roles: ['acheteur'], acheteurEntiteId: 4 });
    expect(visibleColumns(buyer, marche({}))).toBe('all');
    expect(visibleColumns(buyer, marche({ Acheteur: 9, Statut: 'En attente de publication' }))).toBeNull();
    expect(visibleColumns(buyer, marche({ Acheteur: 9 }))).not.toBe('all');
  });

  it('un visiteur ne voit que les marchés publiés, sans statut ni nom d’acheteur', () => {
    const cols = visibleColumns(null, marche({})) as string[];
    expect(cols).toContain('Intitule_propre');
    expect(cols).not.toContain('Statut');
    expect(cols).not.toContain('Acheteur_Nom');
    expect(visibleColumns(null, marche({ Statut: 'Déclaration à valider' }))).toBeNull();
  });

  it('un bénéficiaire ne voit pas les marchés non publiés ni déjà validés', () => {
    const benef = session({ roles: ['beneficiaire'], beneficiaireId: 3 });
    expect(visibleColumns(benef, marche({ Statut: 'En attente de publication' }))).toBeNull();
    expect(visibleColumns(benef, marche({ Statut: 'Clause validée' }))).toBeNull();
    expect(visibleColumns(benef, marche({ Statut: 'En attente de déclaration des bénéficiaires' }))).not.toBeNull();
  });

  it('un titulaire ou candidat voit le statut de son marché, pas celui des autres', () => {
    const rep = session({ roles: ['repondant'], repondantId: 7 });
    const mine = visibleColumns(rep, marche({ Statut: 'Déclaration à valider', Titulaire: 7 })) as string[];
    expect(mine).toContain('Statut');
    expect(visibleColumns(rep, marche({ Statut: 'Déclaration à valider', Titulaire: 8 }))).toBeNull();
    const candidate = visibleColumns(rep, marche({ Statut: 'Clause validée', Candidats: ['L', 7] })) as string[];
    expect(candidate).toContain('Statut');
  });
});
