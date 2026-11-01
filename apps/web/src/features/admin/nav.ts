/** Menu de l'administration : groupes et entrées. Les ressources génériques sont décrites dans `server/admin/resources.ts`. */
export interface NavGroup {
  titre: string;
  entrees: { href: string; libelle: string }[];
}

export const ADMIN_NAV: NavGroup[] = [
  { titre: 'Pilotage', entrees: [{ href: '/admin', libelle: 'Tableau de bord' }] },
];
