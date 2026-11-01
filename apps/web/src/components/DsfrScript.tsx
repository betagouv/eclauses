'use client';

import { useEffect } from 'react';

/** Charge le JavaScript du DSFR (onglets, modales, menus) une seule fois dans le navigateur. */
export function DsfrScript() {
  useEffect(() => {
    void import('@gouvfr/dsfr/dist/dsfr.module.min.js');
  }, []);
  return null;
}
