'use client';

import { useState } from 'react';
import { confirmerMfa, demarrerMfa, demarrerMfaCourrier, envoyerCodeMfa, verifierMfa } from '@/server/actions/admin-auth';

type Methode = 'app' | 'courrier';

/**
 * Seconde étape de connexion : activation (première fois) au choix par application d'authentification (QR code) ou
 * par code reçu par e-mail, puis saisie du code à chaque connexion. Les codes de secours sont affichés une seule fois.
 */
export function VerificationForm({ active, methode }: { active: boolean; methode: Methode }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  // Méthode en cours d'activation (choisie par l'administrateur) ; sinon celle du compte déjà activé.
  const [choix, setChoix] = useState<Methode | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [backup, setBackup] = useState<string[] | null>(null);

  const courrier = active ? methode === 'courrier' : choix === 'courrier';
  const done = () => window.location.assign('/admin');

  async function startApp() {
    setBusy(true);
    setErr(null);
    const res = await demarrerMfa();
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    setChoix('app');
    setSetup(res.data);
  }

  async function startCourrier() {
    setBusy(true);
    setErr(null);
    const res = await demarrerMfaCourrier();
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    setChoix('courrier');
    setEnvoye(true);
    setInfo('Un code à 6 chiffres vient de vous être envoyé par e-mail.');
  }

  async function sendCode() {
    setBusy(true);
    setErr(null);
    setInfo(null);
    const res = await envoyerCodeMfa();
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    setEnvoye(true);
    setInfo('Un code à 6 chiffres vient de vous être envoyé par e-mail. Il est valable 10 minutes.');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = !active ? await confirmerMfa(code) : await verifierMfa(code);
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    if (!active && res.data && 'codesSecours' in res.data) setBackup(res.data.codesSecours);
    else done();
  }

  if (backup) {
    return (
      <div className="fr-container fr-my-6w" style={{ maxWidth: 640 }}>
        <h1 className="fr-h3">Double authentification activée</h1>
        <div className="fr-alert fr-alert--warning fr-mb-3w">
          <p>Conservez ces codes de secours en lieu sûr : chacun ne sert qu’une fois et ils ne seront plus affichés.</p>
        </div>
        <ul className="fr-mb-3w" style={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>
          {backup.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button className="fr-btn" type="button" onClick={done}>
          J’ai conservé ces codes, accéder à l’administration
        </button>
      </div>
    );
  }

  // Compte activé : le champ reste toujours visible, pour pouvoir saisir un code de secours si le courrier n'arrive pas.
  const showForm = active ? true : choix === 'app' ? !!setup : choix === 'courrier';

  return (
    <div className="fr-container fr-my-6w" style={{ maxWidth: 640 }}>
      <h1 className="fr-h3">Vérification en deux étapes</h1>
      {err && <div className="fr-alert fr-alert--error fr-mb-2w"><p>{err}</p></div>}
      {info && <div className="fr-alert fr-alert--info fr-mb-2w"><p>{info}</p></div>}

      {!active && !choix && (
        <>
          <p>Pour accéder à l’administration, activez d’abord la double authentification. Choisissez comment recevoir votre code :</p>
          <div className="fr-grid-row fr-grid-row--gutters">
            <div className="fr-col-12 fr-col-md-6">
              <div className="fr-card fr-p-3w">
                <h2 className="fr-h6">Application d’authentification</h2>
                <p className="fr-text--sm">FreeOTP, Google Authenticator, Microsoft Authenticator… Le code est généré sur votre téléphone, même sans réseau.</p>
                <button className="fr-btn" type="button" onClick={startApp} disabled={busy}>
                  Utiliser une application
                </button>
              </div>
            </div>
            <div className="fr-col-12 fr-col-md-6">
              <div className="fr-card fr-p-3w">
                <h2 className="fr-h6">Code reçu par e-mail</h2>
                <p className="fr-text--sm">Un code à 6 chiffres est envoyé à votre adresse à chaque connexion. Aucune application à installer.</p>
                <button className="fr-btn fr-btn--secondary" type="button" onClick={startCourrier} disabled={busy}>
                  Recevoir un code par e-mail
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {active && courrier && (
        <div className="fr-mb-2w">
          <p>Pour accéder à l’administration, recevez un code de vérification par e-mail.</p>
          <button className={`fr-btn${envoye ? ' fr-btn--secondary' : ''}`} type="button" onClick={sendCode} disabled={busy}>
            {envoye ? 'Renvoyer le code' : 'Recevoir le code par e-mail'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="fr-card fr-p-3w">
          {!active && choix === 'app' && setup && (
            <div className="fr-mb-3w">
              <p>1. Scannez ce QR code avec votre application d’authentification, ou saisissez la clé : <code>{setup.secret}</code></p>
              <div aria-label="QR code" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <p className="fr-mt-2w">2. Saisissez le code à 6 chiffres affiché pour confirmer.</p>
            </div>
          )}
          {!active && choix === 'courrier' && (
            <div className="fr-mb-2w">
              <p>Saisissez le code reçu par e-mail pour confirmer l’activation.</p>
              <button className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" type="button" onClick={sendCode} disabled={busy}>
                Renvoyer le code
              </button>
            </div>
          )}
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="code">
              {active ? 'Code à 6 chiffres (ou code de secours)' : 'Code à 6 chiffres'}
            </label>
            <input id="code" className="fr-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button className="fr-btn fr-mt-2w" type="submit" disabled={busy}>
            {active ? 'Valider' : 'Confirmer l’activation'}
          </button>
        </form>
      )}
    </div>
  );
}
