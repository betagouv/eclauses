import Link from 'next/link';
import { CompteActions } from '@/features/admin/CompteActions';
import { lister } from '@/server/admin/comptes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comptes - Administration Eclauses' };

const PROFILS = { beneficiaire: 'Bénéficiaire', repondant: 'Candidat / titulaire', acheteur: 'Acheteur' } as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  const etat = (['actif', 'non_active', 'admin'] as const).find((e) => e === one('etat')) ?? '';
  const profil = (['beneficiaire', 'repondant', 'acheteur'] as const).find((p) => p === one('profil')) ?? '';
  const q = one('q');
  const res = await lister({ q, etat, profil, page: Number(one('page')) || 1 });
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (etat) p.set('etat', etat);
    if (profil) p.set('profil', profil);
    if (page > 1) p.set('page', String(page));
    return `/admin/comptes${p.size ? `?${p}` : ''}`;
  };
  return (
    <>
      <h1 className="fr-h3">Comptes de connexion</h1>
      <p className="fr-text--sm fr-text-mention--grey">Un compte est créé avec chaque profil ; il n’est « activé » que lorsque la personne a choisi son mot de passe. Les profils (bénéficiaire, acheteur…) se modifient dans leurs écrans.</p>
      <form method="get" className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom fr-mb-2w">
        <div className="fr-col-12 fr-col-md-4">
          <label className="fr-label" htmlFor="q">Adresse e-mail</label>
          <input id="q" name="q" className="fr-input" type="search" defaultValue={q} />
        </div>
        <div className="fr-col-6 fr-col-md-3">
          <label className="fr-label" htmlFor="etat">État</label>
          <select id="etat" name="etat" className="fr-select" defaultValue={etat}>
            <option value="">Tous</option>
            <option value="actif">Activés</option>
            <option value="non_active">Non activés</option>
            <option value="admin">Administrateurs</option>
          </select>
        </div>
        <div className="fr-col-6 fr-col-md-3">
          <label className="fr-label" htmlFor="profil">Profil</label>
          <select id="profil" name="profil" className="fr-select" defaultValue={profil}>
            <option value="">Tous</option>
            {Object.entries(PROFILS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="fr-col-auto"><button className="fr-btn" type="submit">Filtrer</button></div>
      </form>
      <p className="fr-text--sm">{res.total} compte{res.total > 1 ? 's' : ''}</p>
      <div className="fr-table fr-table--no-caption">
        <div className="fr-table__wrapper">
          <div className="fr-table__container">
            <div className="fr-table__content">
              <table>
                <caption>Comptes de connexion</caption>
                <thead>
                  <tr>
                    <th scope="col">Adresse e-mail</th>
                    <th scope="col">Profils</th>
                    <th scope="col">État</th>
                    <th scope="col">Dernière connexion</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((c) => (
                    <tr key={c.id}>
                      <td>{c.email}</td>
                      <td>
                        {c.profils.map((p) => PROFILS[p]).join(', ') || '—'}
                        {c.estAdmin && <span className="fr-badge fr-badge--sm fr-badge--warning fr-ml-1w">Administrateur{c.mfa ? '' : ' (2FA à activer)'}</span>}
                      </td>
                      <td>{c.active ? 'Activé' : 'Non activé'}</td>
                      <td>{c.derniereConnexionLe ? new Date(c.derniereConnexionLe).toLocaleDateString('fr-FR') : '—'}</td>
                      <td><CompteActions id={c.id} email={c.email} active={c.active} estAdmin={c.estAdmin} mfa={c.mfa} /></td>
                    </tr>
                  ))}
                  {!res.rows.length && (
                    <tr><td colSpan={5}>Aucun compte.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {res.pages > 1 && (
        <nav className="fr-pagination" aria-label="Pagination">
          <ul className="fr-pagination__list">
            {res.page > 1 && <li><Link className="fr-pagination__link fr-pagination__link--prev" href={href(res.page - 1)}>Précédente</Link></li>}
            <li><span className="fr-pagination__link" aria-current="page">Page {res.page} sur {res.pages}</span></li>
            {res.page < res.pages && <li><Link className="fr-pagination__link fr-pagination__link--next" href={href(res.page + 1)}>Suivante</Link></li>}
          </ul>
        </nav>
      )}
    </>
  );
}
