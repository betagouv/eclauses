import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@gouvfr/dsfr/dist/dsfr.min.css';
import '@gouvfr/dsfr/dist/utility/utility.min.css';
import { DsfrScript } from '@/components/DsfrScript';

export const metadata: Metadata = {
  title: 'Eclauses',
  description: 'Clauses sociales des marchés publics du ministère de la Culture',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-fr-scheme="system">
      <body>
        {children}
        <DsfrScript />
      </body>
    </html>
  );
}
