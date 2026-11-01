/** Réglages publics transmis aux pages : jamais de secret ici. */
export function publicEnv(): Record<string, string> {
  return {
    PUBLIC_URL: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
    RELANCE_TITULAIRE_DELAY_DAYS: process.env.RELANCE_TITULAIRE_DELAY_DAYS ?? '7',
  };
}
