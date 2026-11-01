import { RESOURCES } from '@/server/admin/resources';

/** Menu de l'administration : les écrans dédiés, puis un groupe par famille de ressources générées. */
export interface NavGroup {
  titre: string;
  entrees: { href: string; libelle: string }[];
}

const GROUPES = ['Acheteurs', 'Bénéficiaires', 'Candidats et titulaires', 'Marchés', 'Référentiels', 'Contenu', 'Exploitation'];

export const ADMIN_NAV: NavGroup[] = [
  { titre: 'Pilotage', entrees: [{ href: '/admin', libelle: 'Tableau de bord' }, { href: '/admin/comptes', libelle: 'Comptes de connexion' }] },
  ...GROUPES.map((g) => ({ titre: g, entrees: RESOURCES.filter((r) => r.groupe === g).map((r) => ({ href: `/admin/${r.key}`, libelle: r.labelPluriel })) })),
];
