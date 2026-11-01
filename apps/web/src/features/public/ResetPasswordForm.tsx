// @ts-nocheck : code repris du widget Grist (grist/page/reset-password), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { definirMotDePasse } from '@/server/actions/public';

/** Choix du mot de passe (îlot) : l'état du jeton est lu par le serveur (`initial`), le jeton n'est consommé qu'à la validation. */
const Component = ({ initial }) => {
  const router = useRouter();
  const [record, setRecord] = React.useState(initial.valid ? { Token: initial.token, Type: initial.type, Email: initial.email } : null);
  const [loading, setLoading] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [acceptedCgu, setAcceptedCgu] = React.useState(false);
  const [status, setStatus] = React.useState(initial.valid ? { state: 'idle', message: '' } : { state: 'error', message: initial.used ? 'Lien déjà utilisé.' : 'Lien invalide ou expiré.' });

  const goToLogin = React.useCallback(() => {
    router.push('/login');
  }, []);

  const isCreatePurpose = React.useMemo(() => {
    const p = String(record?.Type || record?.Purpose || '').toLowerCase();
    return p.includes('creat');
  }, [record]);

  const purposeLabel = React.useMemo(() => {
    const p = String(record?.Type || record?.Purpose || '').toLowerCase();
    if (isCreatePurpose) return 'Créez votre mot de passe';
    if (p.includes('reset') || p.includes('oubli')) return 'Réinitialisez votre mot de passe';
    return 'Choisissez votre mot de passe';
  }, [record, isCreatePurpose]);

  React.useEffect(() => {
    document.title = 'Choix du mot de passe';
  }, []);

  React.useEffect(() => {
    if (status.state !== 'success') return;
    const t = setTimeout(() => {
      goToLogin();
    }, 5000);
    return () => clearTimeout(t);
  }, [status.state, goToLogin]);

  const onSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e?.nativeEvent?.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }
    if (!record) return;
    if (!password || password.length < 8) {
      setStatus({ state: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ state: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (isCreatePurpose && !acceptedCgu) {
      setStatus({ state: 'error', message: "Vous devez accepter les conditions générales d'utilisation pour activer votre espace." });
      return;
    }
    try {
      setStatus({ state: 'loading', message: 'Mise à jour…' });
      const token = record.Token || record.token || record.token_;
      const res = await definirMotDePasse(token, password);
      if (!res.ok) throw new Error(res.message);
      setStatus({ state: 'success', message: 'Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.' });
    } catch (err) {
      console.error(err);
      setStatus({ state: 'error', message: err.message || 'Impossible de mettre à jour le mot de passe.' });
    }
  };

  if (loading) {
    return (
      <main className="fr-container fr-my-6w">
        <div className="fr-grid-row">
          <div className="fr-col-12">
            <div className="fr-alert fr-alert--info">Vérification du lien…</div>
          </div>
        </div>
      </main>
    );
  }

  if (status.state === 'error' && !record) {
    return (
      <main className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error fr-mb-3w">
          <p>{status.message}</p>
        </div>
        <div className="fr-btns-group fr-btns-group--inline">
          <button
            className="fr-btn"
            type="button"
            onClick={goToLogin}
          >
            Aller à la page de connexion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fr-container fr-my-6w" style={{ maxWidth: 640 }}>
      <div className="fr-grid-row">
        <div className="fr-col-12">
          <h1 className="fr-h3 fr-mb-2w">{purposeLabel}</h1>
          <p className="fr-text--sm fr-mb-3w">
            Définissez un nouveau mot de passe pour accéder à votre espace.
          </p>
          {status.state === 'success' ? (
            <>
              <div className="fr-alert fr-alert--success fr-mb-3w">
                <p>{status.message}</p>
              </div>
              <div className="fr-btns-group fr-btns-group--inline">
                <button
                  className="fr-btn"
                  type="button"
                  onClick={goToLogin}
                >
                  Aller à la connexion
                </button>
              </div>
            </>
          ) : (
            <form
              className="fr-mb-4w"
              onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="pwd">Nouveau mot de passe</label>
                <input
                  id="pwd"
                  className="fr-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="fr-input-group fr-mt-3w">
                <label className="fr-label" htmlFor="pwd2">Confirmer le mot de passe</label>
                <input
                  id="pwd2"
                  className="fr-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {isCreatePurpose && (
                <div className="fr-checkbox-group fr-mt-3w">
                  <input
                    type="checkbox"
                    id="accept-cgu"
                    checked={acceptedCgu}
                    onChange={(e) => setAcceptedCgu(e.target.checked)}
                    required
                  />
                  <label className="fr-label" htmlFor="accept-cgu">
                    En activant mon espace, j'accepte les{' '}
                    <Link href="/cgu" className="fr-link">
                      Conditions générales d'utilisation de la plateforme Eclauses
                    </Link>.
                  </label>
                </div>
              )}
              <div className="fr-btns-group fr-btns-group--inline fr-mt-3w">
                <button
                  className="fr-btn"
                  type="button"
                  onClick={onSubmit}
                  disabled={status.state === 'loading' || (isCreatePurpose && !acceptedCgu)}
                >
                  {status.state === 'loading' ? 'Mise à jour…' : 'Valider'}
                </button>
              </div>
            </form>
          )}

          {status.state === 'error' && (
            <div className="fr-alert fr-alert--error">
              <p>{status.message}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Component;
