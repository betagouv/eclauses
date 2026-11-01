import { sql } from 'drizzle-orm';
import { beneficiaires, repondants, utilisateurs } from './schema';

/**
 * Règles de conservation des données, auparavant des colonnes formules de Grist. Elles dépendent
 * de la date du jour : on les évalue à la lecture, on ne les stocke pas.
 */

/** Éligible tant que 5 ans et 6 mois ne se sont pas écoulés depuis la diplomation. */
export const beneficiaireEligible = sql<boolean>`coalesce(${beneficiaires.dateDiplomation} + interval '5 years 6 months' > current_date, false)`;

/** Données à effacer 10 ans après la diplomation. */
export const beneficiaireADetruire = sql<boolean>`coalesce(${beneficiaires.dateDiplomation} + interval '10 years' < current_date, false)`;

/** Répondant inactif depuis 5 ans (dernière mise à jour du mot de passe). */
export const repondantADetruire = sql<boolean>`coalesce(${utilisateurs.motDePasseModifieLe} + interval '5 years' < now(), false) and ${repondants.anonymiseLe} is null`;
