import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Session } from '@/server/auth/session';
import { activeSpace } from '@/server/space';
import { siteConfig, type SiteLink } from '@/server/site';
import { homeOf, navFor, SPACES } from '@/lib/pages';
import { LogoutButton } from './LogoutButton';

const FooterLink = ({ l, className }: { l: SiteLink; className: string }) =>
  l.external ? (
    <a className={className} href={l.href} target="_blank" rel="noopener noreferrer" title={`${l.label} - nouvelle fenêtre`}>
      {l.label}
    </a>
  ) : (
    <Link className={className} href={l.href}>
      {l.label}
    </Link>
  );

/** En-tête, menu de l'espace actif, contenu et pied de page. */
export async function AppShell({ session, currentPage, children }: { session: Session | null; currentPage?: string; children: ReactNode }) {
  const [site, space] = await Promise.all([siteConfig(), activeSpace(session)]);
  const nav = space ? navFor(space) : [];
  const spaces = session ? SPACES.filter((s) => session.roles.includes(s.role)) : [];

  return (
    <>
      <a className="fr-skiplinks" href="#contenu" style={{ position: 'absolute', left: '-9999px' }}>
        Aller au contenu
      </a>
      <header role="banner" className="fr-header">
        <div className="fr-header__body">
          <div className="fr-container">
            <div className="fr-header__body-row">
              <div className="fr-header__brand fr-enlarge-link">
                <div className="fr-header__brand-top">
                  <div className="fr-header__logo">
                    <p className="fr-logo" dangerouslySetInnerHTML={{ __html: site.logoHtml }} />
                  </div>
                  <div className="fr-header__navbar">
                    <button type="button" className="fr-btn--menu fr-btn" data-fr-opened="false" aria-controls="modal-menu" aria-haspopup="menu" id="btn-menu" title="Menu">
                      Menu
                    </button>
                  </div>
                </div>
                <div className="fr-header__service">
                  <Link href="/" title={`Accueil - ${site.title}`}>
                    <p className="fr-header__service-title">
                      {site.title}
                      {site.badge && <span className={`fr-badge fr-badge--sm ${site.badge.variant} fr-ml-1w`}>{site.badge.label}</span>}
                    </p>
                  </Link>
                  {site.tagline && <p className="fr-header__service-tagline">{site.tagline}</p>}
                </div>
              </div>
              <div className="fr-header__tools">
                <div className="fr-header__tools-links">
                  <ul className="fr-btns-group">
                    {site.headerLinks.map((l) => (
                      <li key={l.href + l.label}>
                        <Link className="fr-btn" href={l.href}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                    {session ? (
                      <>
                        {spaces.length > 1 &&
                          spaces.map((s) => (
                            <li key={s.role}>
                              <a className={`fr-btn ${s.role === space ? 'fr-btn--secondary' : 'fr-btn--tertiary'}`} href={`/api/space/${s.role}`}>
                                {s.label}
                              </a>
                            </li>
                          ))}
                        <li>
                          <LogoutButton />
                        </li>
                      </>
                    ) : (
                      <li>
                        <Link className="fr-btn fr-icon-lock-line" href="/login">
                          Se connecter
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fr-header__menu fr-modal" id="modal-menu" aria-labelledby="btn-menu">
          <div className="fr-container">
            <button type="button" className="fr-btn--close fr-btn" aria-controls="modal-menu" title="Fermer">
              Fermer
            </button>
            <div className="fr-header__menu-links" />
            {space && (
              <nav className="fr-nav" role="navigation" aria-label="Menu principal">
                <ul className="fr-nav__list">
                  <li className="fr-nav__item">
                    <Link className="fr-nav__link" href={`/${homeOf(space)}`} aria-current={currentPage === homeOf(space) ? 'page' : undefined}>
                      Accueil
                    </Link>
                  </li>
                  {nav.map((p) => (
                    <li className="fr-nav__item" key={p.id}>
                      <Link className="fr-nav__link" href={`/${p.id}`} aria-current={currentPage === p.id ? 'page' : undefined}>
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </header>

      <main id="contenu" role="main">
        {children}
      </main>

      <footer className="fr-footer" role="contentinfo" id="footer">
        <div className="fr-container">
          <div className="fr-footer__body">
            <div className="fr-footer__brand fr-enlarge-link">
              <p className="fr-logo" dangerouslySetInnerHTML={{ __html: site.logoHtml }} />
            </div>
            <div className="fr-footer__content">
              {site.footerDescription && <p className="fr-footer__content-desc">{site.footerDescription}</p>}
              <ul className="fr-footer__content-list">
                {site.footerLinks.map((l) => (
                  <li className="fr-footer__content-item" key={l.href + l.label}>
                    <FooterLink l={l} className="fr-footer__content-link" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="fr-footer__bottom">
            <ul className="fr-footer__bottom-list">
              {site.footerBottomLinks.map((l) => (
                <li className="fr-footer__bottom-item" key={l.href + l.label}>
                  <FooterLink l={l} className="fr-footer__bottom-link" />
                </li>
              ))}
            </ul>
            {site.footerCopyHtml && (
              <div className="fr-footer__bottom-copy">
                <p dangerouslySetInnerHTML={{ __html: site.footerCopyHtml }} />
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
