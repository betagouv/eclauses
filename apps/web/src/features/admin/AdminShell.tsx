import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/LogoutButton';
import { ADMIN_NAV } from './nav';

/** Cadre de l'administration : bandeau, menu latéral par groupe, contenu. Distinct des espaces utilisateurs. */
export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <>
      <header role="banner" className="fr-header">
        <div className="fr-header__body">
          <div className="fr-container">
            <div className="fr-header__body-row">
              <div className="fr-header__brand">
                <div className="fr-header__service">
                  <Link href="/admin" title="Administration Eclauses">
                    <p className="fr-header__service-title">
                      Administration Eclauses <span className="fr-badge fr-badge--sm fr-badge--warning fr-ml-1w">Accès restreint</span>
                    </p>
                  </Link>
                </div>
                <div className="fr-header__navbar">
                  <button type="button" className="fr-btn--menu fr-btn" data-fr-opened="false" aria-controls="admin-modal-menu" aria-haspopup="menu" id="admin-btn-menu" title="Menu">
                    Menu
                  </button>
                </div>
              </div>
              <div className="fr-header__tools">
                <div className="fr-header__tools-links">
                  <ul className="fr-btns-group">
                    <li><span className="fr-btn fr-btn--tertiary-no-outline fr-icon-account-circle-line">{email}</span></li>
                    <li><Link className="fr-btn" href="/">Quitter l’administration</Link></li>
                    <li><LogoutButton /></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fr-header__menu fr-modal" id="admin-modal-menu" aria-labelledby="admin-btn-menu">
          <div className="fr-container">
            <button type="button" className="fr-btn--close fr-btn" aria-controls="admin-modal-menu" title="Fermer">
              Fermer
            </button>
            <div className="fr-header__menu-links" />
          </div>
        </div>
      </header>
      <div className="fr-container fr-my-4w">
        <div className="fr-grid-row fr-grid-row--gutters">
          <nav className="fr-col-12 fr-col-md-3" aria-label="Menu de l’administration">
            {ADMIN_NAV.map((g) => (
              <div key={g.titre} className="fr-mb-3w">
                <p className="fr-text--bold fr-mb-1w">{g.titre}</p>
                <ul className="fr-raw-list">
                  {g.entrees.map((e) => (
                    <li key={e.href} className="fr-mb-1v">
                      <Link className="fr-link" href={e.href}>{e.libelle}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <main id="contenu" className="fr-col-12 fr-col-md-9">{children}</main>
        </div>
      </div>
    </>
  );
}
