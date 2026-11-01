import { TacheButton } from '@/features/admin/TacheButton';
import { destinatairesInvitations, TACHES } from '@/server/admin/pilotage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tâches - Administration Eclauses' };

export default async function Page() {
  const invitations = await destinatairesInvitations();
  return (
    <>
      <h1 className="fr-h3">Tâches d’exploitation</h1>
      <p className="fr-text--sm fr-text-mention--grey">Ces tâches tournent normalement chaque nuit (planificateur). Elles peuvent aussi être lancées ici ; chaque lancement est journalisé.</p>
      <div className="fr-table fr-table--no-caption">
        <div className="fr-table__wrapper">
          <div className="fr-table__container">
            <div className="fr-table__content">
              <table>
                <caption>Tâches d’exploitation</caption>
                <thead>
                  <tr>
                    <th scope="col">Tâche</th>
                    <th scope="col">Effet</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {TACHES.map((t) => (
                    <tr key={t.nom}>
                      <td>{t.titre}</td>
                      <td>
                        {t.description}
                        {t.nom === 'invitations-comptes' && <strong> Destinataires actuels : {invitations}.</strong>}
                      </td>
                      <td><TacheButton nom={t.nom} titre={t.titre} sensible={t.sensible} destinataires={t.nom === 'invitations-comptes' ? invitations : undefined} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
