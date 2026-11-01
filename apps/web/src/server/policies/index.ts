import { HttpError } from '../http';
import { beneficiaires } from './beneficiaires';
import { marches } from './marches';
import {
  accesCoordonnees,
  acheteurs,
  clauses,
  declarations,
  faqCategories,
  faqQuestions,
  impacts,
  interets,
  invitations,
  passwordReset,
  referentiel,
  refus,
  repondants,
  supportVideos,
  utilisateursAcheteurs,
} from './others';
import type { TablePolicy } from './types';

/**
 * Registre des tables exposées au navigateur. Une table absente d'ici est refusée : on ouvre
 * explicitement chaque table et chaque opération, jamais l'inverse.
 */
const REGISTRY: Record<string, TablePolicy> = {
  Beneficiaires: beneficiaires,
  Marches: marches,
  Acheteurs: acheteurs,
  Utilisateurs_Acheteurs: utilisateursAcheteurs,
  Repondants: repondants,
  Invitation_Titulaire: invitations,
  Declarations_Beneficiaires: declarations,
  Declarations_Beneficiaires_Refus: refus,
  Marches_Interets: interets,
  Acces_Coordonnees: accesCoordonnees,
  Clauses_sociales: clauses,
  Application_Password_Reset: passwordReset,
  Application_FAQ_Categories: faqCategories,
  Application_FAQ_Questions: faqQuestions,
  Support_Videos: supportVideos,
  Impacts: impacts,
  T0_Referentiel_Formations: referentiel('T0_Referentiel_Formations'),
  T0_Referentiel_Specialites: referentiel('T0_Referentiel_Specialites'),
  T0_Referentiel_Departements: referentiel('T0_Referentiel_Departements'),
  T0_Referentiel_Regions: referentiel('T0_Referentiel_Regions'),
  T0_Referentiel_Informations: referentiel('T0_Referentiel_Informations'),
};

export function policyFor(table: string): TablePolicy {
  const policy = Object.hasOwn(REGISTRY, table) ? REGISTRY[table] : undefined;
  if (!policy) throw new HttpError(403, `Table non exposée : ${table}`);
  return policy;
}

export const exposedTables = () => Object.keys(REGISTRY);
