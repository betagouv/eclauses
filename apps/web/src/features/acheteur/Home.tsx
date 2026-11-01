import { and, count, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { ServerSession } from '@/legacy/gristAPI';
import { database } from '@/server/db/client';
import { marches } from '@/server/db/schema';

/** Accueil de l'espace acheteur, rendu par le serveur : l'alerte « déclarations à valider » est comptée en base. */
export async function AcheteurHome({ session }: { session: ServerSession }) {
  const [{ n: toValidateCount }] = session.acheteurEntiteId
    ? await database().select({ n: count() }).from(marches).where(and(eq(marches.acheteurId, session.acheteurEntiteId), eq(marches.statut, 'declaration_a_valider')))
    : [{ n: 0 }];
  return (
    <>
      <section className="fr-container fr-my-6w">
        <h1 className="fr-h2">Bienvenue sur votre espace <span className="fr-text--bold">Eclauses</span></h1>

        {toValidateCount > 0 && (
          <div className="fr-alert fr-alert--warning fr-mb-4w">
            <p>
              Vous avez {toValidateCount} déclaration{toValidateCount > 1 ? 's' : ''} de bénéficiaires à valider.
              {' '}
              <Link href="/acheteur-marches" className="fr-link">Voir mes marchés</Link>
            </p>
          </div>
        )}

        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><Link href="/acheteur-marches">Mes marchés</Link></h3>
                  <p className="fr-tile__desc">Déclarez et suivez un marché couvert par une clause sociale.</p>
                </div>
              </div>
              <div className="fr-tile__header">
                <div className="fr-tile__pictogram">
                  <svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px">
                    <use className="fr-artwork-decorative" href="/svg/document/contract.svg#artwork-decorative"></use>
                    <use className="fr-artwork-minor" href="/svg/document/contract.svg#artwork-minor"></use>
                    <use className="fr-artwork-major" href="/svg/document/contract.svg#artwork-major"></use>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-6">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><Link href="/acheteur-annuaire">Annuaire des bénéficiaires</Link></h3>
                  <p className="fr-tile__desc">Consulter l'annuaire des bénéficiaires des clauses sociales.</p>
                </div>
              </div>
              <div className="fr-tile__header">
                <div className="fr-tile__pictogram">
                  <svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px">
                    <use className="fr-artwork-decorative" href="/svg/digital/ecosystem.svg#artwork-decorative"></use>
                    <use className="fr-artwork-minor" href="/svg/digital/ecosystem.svg#artwork-minor"></use>
                    <use className="fr-artwork-major" href="/svg/digital/ecosystem.svg#artwork-major"></use>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
