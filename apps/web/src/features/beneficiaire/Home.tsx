import Link from 'next/link';

/** Accueil de l'espace bénéficiaire : trois tuiles, entièrement rendues par le serveur. */
export function BeneficiaireHome() {
  return (
    <>
    <section className="fr-container fr-my-6w">
        <h1 className="fr-h2">Bienvenue sur votre espace <span className="fr-text--bold">Eclauses</span></h1>
          <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title">
                    <Link href="/beneficiaire-profil">Mes informations</Link>
                  </h3>
                  <p className="fr-tile__desc">Mettez à jour votre fiche bénéficiaire (coordonnées, formations, mobilité...)
                </p>
                </div>
              </div>
              <div className="fr-tile__header">
                <div className="fr-tile__pictogram">
                  <svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px">
                    <use className="fr-artwork-decorative" href="/svg/digital/avatar.svg#artwork-decorative"></use>
                    <use className="fr-artwork-minor" href="/svg/digital/avatar.svg#artwork-minor"></use>
                    <use className="fr-artwork-major" href="/svg/digital/avatar.svg#artwork-major"></use>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title">
                    <Link href="/beneficiaire-marches">Marchés actifs</Link>
                  </h3>
                  <p className="fr-tile__desc">Consultez les marchés couverts par une clause sociale sur tout le territoire.
                </p>
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
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title">
                    <Link href="/beneficiaire-annuaire">Annuaire</Link>
                  </h3>
                  <p className="fr-tile__desc">Consultez l’annuaire des bénéficiaires partageant la même clause sociale.
                </p>
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
