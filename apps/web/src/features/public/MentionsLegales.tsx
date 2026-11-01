import { BackToTop, PrintButton } from '@/components/PageActions';

/** Page statique rendue par le serveur (aucun JavaScript propre, sauf impression et retour en haut). */
export function MentionsLegales() {
  const lastUpdate = '24 juin 2026';
  const items = [
    { id: 'editeur', label: 'Éditeur de la plateforme' },
    { id: 'publication', label: 'Directeur de la publication' },
    { id: 'hebergement', label: 'Hébergement' },
    { id: 'accessibilite', label: 'Accessibilité' },
    { id: 'en-savoir-plus', label: 'En savoir plus' },
    { id: 'signalement', label: 'Signaler un dysfonctionnement' },
  ];

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters">
          <div className="fr-col">
            <h1 className="fr-h2">Mentions légales</h1>
            <p className="fr-text--sm fr-text-mention--grey">Dernière mise à jour : {lastUpdate}</p>
          </div>
          <div className="fr-col-auto">
            <PrintButton className="fr-btn fr-btn--secondary">
              Imprimer la page
            </PrintButton>
          </div>
        </div>
      </header>

      <div className="fr-grid-row fr-grid-row--gutters">
        <aside className="fr-col-12 fr-col-md-4">
          <nav className="fr-sidemenu fr-sidemenu--sticky-full-height" aria-label="Sommaire des mentions légales">
            <div className="fr-sidemenu__inner">
              <button className="fr-sidemenu__btn" aria-controls="ml-menu">Sommaire</button>
              <div className="fr-collapse" id="ml-menu">
                <ul className="fr-sidemenu__list">
                  {items.map((it) => (
                    <li key={it.id} className="fr-sidemenu__item">
                      <a className="fr-sidemenu__link" href={`#${it.id}`}>{it.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </aside>

        <div className="fr-col-12 fr-col-md-8">
          <section id="editeur" className="fr-mb-6w">
            <h2 className="fr-h3">Éditeur de la plateforme</h2>
            <p>
              La mission ministérielle des achats (MMA) au sein du ministère de la Culture :
            </p>
            <p>
              182 rue Saint-Honoré<br />
              75001 Paris<br />
              France
            </p>
            <p>Téléphone : <a href="tel:+33140158000">01 40 15 80 00</a></p>
          </section>

          <section id="publication" className="fr-mb-6w">
            <h2 className="fr-h3">Directeur de la publication</h2>
            <p>Monsieur Renaud SOUCHE, en sa qualité de chef de la mission.</p>
          </section>

          <section id="hebergement" className="fr-mb-6w">
            <h2 className="fr-h3">Hébergement de la plateforme GRIST utilisée par l'équipe</h2>
            <p>Grist est un tableur-base de données open source.</p>
            <div className="fr-table fr-table--bordered fr-table--layout-fixed">
              <table>
                <caption>Informations de sécurité et d'hébergement</caption>
                <thead>
                  <tr>
                    <th scope="col">Point de sécurité</th>
                    <th scope="col">Réponse</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Hébergement</th>
                    <td>SecNumCloud - Outscale (qualification ANSSI)</td>
                  </tr>
                  <tr>
                    <th scope="row">Homologation</th>
                    <td>
                      Instance <a href="https://grist.numerique.gouv.fr/" target="_blank" rel="noopener">grist.numerique.gouv.fr</a> homologuée RGS en janvier 2026 pour une durée de 12 mois
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Cotation DICT</th>
                    <td>2333</td>
                  </tr>
                  <tr>
                    <th scope="row">Bug Bounty</th>
                    <td>Programme actif : des failles ont déjà été remontées et corrigées rapidement.</td>
                  </tr>
                  <tr>
                    <th scope="row">Code source</th>
                    <td>
                      <a href="https://github.com/gristlabs/grist-core/" target="_blank" rel="noopener">Open source Apache 2.0</a>, auditable, pas de boîte noire
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Données</th>
                    <td>Aucune transmission à des tiers, aucune exploitation à des fins commerciales.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="accessibilite" className="fr-mb-6w">
            <h2 className="fr-h3">Accessibilité</h2>
            <p>
              La conformité aux normes d'accessibilité numérique est un objectif ultérieur mais nous tâchons de rendre cette plateforme accessible à toutes et à tous.
            </p>
          </section>

          <section id="en-savoir-plus" className="fr-mb-6w">
            <h2 className="fr-h3">En savoir plus</h2>
            <p>
              Pour en savoir plus sur la politique d'accessibilité numérique de l'État :{' '}
              <a href="https://accessibilite.numerique.gouv.fr/" target="_blank" rel="noopener">
                accessibilite.numerique.gouv.fr
              </a>
            </p>
          </section>

          <section id="signalement" className="fr-mb-6w">
            <h2 className="fr-h3">Signaler un dysfonctionnement</h2>
            <p>
              Si vous rencontrez un défaut d'accessibilité vous empêchant d'accéder à un contenu ou une fonctionnalité de la plateforme, merci de nous en faire part :{' '}
              <a href="mailto:contact@eclauses.beta.gouv.fr">contact@eclauses.beta.gouv.fr</a>
            </p>
            <p>
              Si vous n'obtenez pas de réponse rapide de notre part, vous êtes en droit de faire parvenir vos doléances ou une demande de saisine au Défenseur des droits.
            </p>
          </section>

          <div className="fr-mt-6w">
            <BackToTop className="fr-link fr-icon-arrow-up-s-line fr-link--icon-left">
              Haut de page
            </BackToTop>
          </div>
        </div>
      </div>
    </section>
  );
}
