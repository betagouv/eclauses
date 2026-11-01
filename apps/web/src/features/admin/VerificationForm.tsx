'use client';

import { useState } from 'react';
import { confirmerMfa, demarrerMfa, verifierMfa } from '@/server/actions/admin-auth';

/** Seconde étape de connexion : activation (première fois, avec QR code et codes de secours) ou saisie du code. */
export function VerificationForm({ active }: { active: boolean }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);

  const done = () => window.location.assign('/admin');

  async function start() {
    setBusy(true);
    setErr(null);
    const res = await demarrerMfa();
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    setSetup(res.data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = setup ? await confirmerMfa(code) : await verifierMfa(code);
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    if (setup && res.data && 'codesSecours' in res.data) setBackup(res.data.codesSecours);
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

  return (
    <div className="fr-container fr-my-6w" style={{ maxWidth: 640 }}>
      <h1 className="fr-h3">Vérification en deux étapes</h1>
      {!active && !setup && (
        <>
          <p>Pour accéder à l’administration, activez d’abord la double authentification avec une application d’authentification (FreeOTP, Google Authenticator, Microsoft Authenticator…).</p>
          {err && <div className="fr-alert fr-alert--error fr-mb-2w"><p>{err}</p></div>}
          <button className="fr-btn" type="button" onClick={start} disabled={busy}>
            Commencer l’activation
          </button>
        </>
      )}
      {(active || setup) && (
        <form onSubmit={submit} className="fr-card fr-p-3w">
          {setup && (
            <div className="fr-mb-3w">
              <p>1. Scannez ce QR code avec votre application d’authentification, ou saisissez la clé : <code>{setup.secret}</code></p>
              <div aria-label="QR code" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <p className="fr-mt-2w">2. Saisissez le code à 6 chiffres affiché pour confirmer.</p>
            </div>
          )}
          {err && <div className="fr-alert fr-alert--error fr-mb-2w"><p>{err}</p></div>}
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="code">
              {setup ? 'Code à 6 chiffres' : 'Code à 6 chiffres (ou code de secours)'}
            </label>
            <input id="code" className="fr-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button className="fr-btn fr-mt-2w" type="submit" disabled={busy}>
            {setup ? 'Confirmer l’activation' : 'Valider'}
          </button>
        </form>
      )}
    </div>
  );
}
