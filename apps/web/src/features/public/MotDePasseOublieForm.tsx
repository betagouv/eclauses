// @ts-nocheck : code repris du widget Grist (grist/page/mot-de-passe-oublie), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { demanderReinitialisation } from '@/server/actions/public';

/** Demande de lien de réinitialisation (îlot) : l'action ne révèle jamais si l'adresse a un compte. */
const Component = () => {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState({ state: 'idle', message: '' });

  React.useEffect(() => {
    document.title = 'Mot de passe oublié';
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus({ state: 'error', message: 'Merci de renseigner votre adresse e-mail.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus({ state: 'error', message: 'Adresse e-mail invalide.' });
      return;
    }
    try {
      setStatus({ state: 'loading', message: 'Envoi du lien…' });
      const res = await demanderReinitialisation(value);
      if (!res.ok) throw new Error(res.message);
      setStatus({ state: 'success', message: 'Si un compte associé à cet e-mail existe, un lien de réinitialisation vous a été envoyé.' });
    } catch (err) {
      console.error(err);
      setStatus({ state: 'error', message: err?.message || 'Impossible d’enregistrer la demande. Réessayez dans quelques instants.' });
    }
  };

  return (
    <main className="fr-container fr-my-6w" style={{ maxWidth: 640 }}>
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12">
          <h1 className="fr-h3 fr-mb-2w">Mot de passe oublié</h1>
          <p className="fr-text--sm fr-mb-3w">
            Saisissez votre adresse e-mail. Vous recevrez un lien pour choisir un nouveau mot de passe.
          </p>


          {status.state === 'success' && (
            <div className="fr-alert fr-alert--success">
              <p>{status.message}</p>
            </div>
          )}
          {status.state === 'error' && (
            <div className="fr-alert fr-alert--error">
              <p>{status.message}</p>
            </div>
          )}
          {status.state === 'idle' && (
            <div className="fr-alert fr-alert--info fr-alert--sm">
              <p>Un e-mail vous sera envoyé uniquement si l'adresse saisie correspond à un compte Eclauses.</p>
            </div>
          )}
          <form className="fr-mb-4w fr-mt-3w" onSubmit={onSubmit}>
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                className="fr-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="fr-btns-group fr-btns-group--inline fr-mt-3w">
              <button className="fr-btn" type="submit" disabled={status.state === 'loading'}>
                {status.state === 'loading' ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </main>
  );
};

export default Component;
