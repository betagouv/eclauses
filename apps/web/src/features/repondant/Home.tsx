import { and, count, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Session as ServerSession } from '@/server/auth/session';
import { database } from '@/server/db/client';
import { marches } from '@/server/db/schema';

/** Accueil de l'espace répondant, rendu par le serveur : l'alerte « déclarations à faire » est comptée en base. */
export async function RepondantHome({ session }: { session: ServerSession }) {
  const [{ n: toDeclareCount }] = session.repondantId
    ? await database().select({ n: count() }).from(marches).where(and(eq(marches.titulaireId, session.repondantId), eq(marches.statut, 'en_attente_declaration')))
    : [{ n: 0 }];
  return (
    <>
      <section className="fr-container fr-my-6w">
        <h1 className="fr-h2">Bienvenue sur votre espace <span className="fr-text--bold">Eclauses</span></h1>

        {toDeclareCount > 0 && (
          <div className="fr-alert fr-alert--warning fr-mb-4w">
            <p>
              Vous avez {toDeclareCount} marché{toDeclareCount > 1 ? 's' : ''} en attente de déclaration des bénéficiaires.
              <Link href="/repondant-marches" className="fr-link">Voir mes marchés</Link>
            </p>
          </div>
        )}

        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><Link href="/repondant-infos">Mes informations</Link></h3>
                  <p className="fr-tile__desc">Mettez à jour votre fiche à tout moment.</p>
                </div>
              </div>
              <div className="fr-tile__header"><div className="fr-tile__pictogram"><svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px"><use className="fr-artwork-decorative" href="/svg/digital/avatar.svg#artwork-decorative"></use><use className="fr-artwork-minor" href="/svg/digital/avatar.svg#artwork-minor"></use><use className="fr-artwork-major" href="/svg/digital/avatar.svg#artwork-major"></use></svg></div></div>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-6">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><Link href="/repondant-marches">Mes marchés</Link></h3>
                  <p className="fr-tile__desc">Liste des marchés pour lesquels vous êtes inscrits en tant que candidat ou pour lesquels vous êtes titulaire.</p>
                </div>
              </div>
              <div className="fr-tile__header"><div className="fr-tile__pictogram"><svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px"><use className="fr-artwork-decorative" href="/svg/document/contract.svg#artwork-decorative"></use><use className="fr-artwork-minor" href="/svg/document/contract.svg#artwork-minor"></use><use className="fr-artwork-major" href="/svg/document/contract.svg#artwork-major"></use></svg></div></div>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-7">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><Link href="/repondant-recherches">Recherche d'un bénéficiaire</Link></h3>
                  <p className="fr-tile__desc">Recherchez des bénéficiaires pour répondre aux clauses sociales de vos marchés.</p>
                </div>
              </div>
              <div className="fr-tile__header"><div className="fr-tile__pictogram"><svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px"><use className="fr-artwork-decorative" href="/svg/digital/ecosystem.svg#artwork-decorative"></use><use className="fr-artwork-minor" href="/svg/digital/ecosystem.svg#artwork-minor"></use><use className="fr-artwork-major" href="/svg/digital/ecosystem.svg#artwork-major"></use></svg></div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
