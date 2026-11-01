// @ts-nocheck : code repris du widget Grist (grist/page/login), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  function getNextRoute() {
    try {
      const params = gristAPI?.getQueryParams
        ? gristAPI.getQueryParams()
        : new URLSearchParams(window.location.search);
      const raw = String(params?.get('next') || '').trim();
      return raw || null;
    } catch (_) {
      return null;
    }
  }

  function appendNextToUrl(url, next) {
    if (!url || !next) return url;
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('next', next);
      return u.toString();
    } catch (_) {
      return url;
    }
  }

  // --- UI state ---
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [info, setInfo] = React.useState(null);

  React.useEffect(() => {
    const isAuthed = gristAPI?.isAuthenticated ? gristAPI.isAuthenticated() : !!gristAPI?.getAuth?.();
    const next = getNextRoute();
    if (isAuthed) {
      if (next === 'home' && gristAPI?.navigate) {
        gristAPI.navigate('home');
      } else if (gristAPI?.goToDefault) {
        gristAPI.goToDefault();
      } else if (gristAPI?.navigate) {
        gristAPI.navigate('home');
      }
    }
  }, []);

  function emailLooksOk(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  }

  async function doPasswordLogin(e) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!emailLooksOk(email)) { setErr('Adresse e-mail invalide.'); return; }
    if (!password) { setErr('Mot de passe requis.'); return; }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: email, password })
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) {
        setErr(json.message || 'Échec de la connexion.');
        return;
      }
      // Rechargement complet : l'en-tête et la navigation dépendent de la session côté serveur.
      const next = getNextRoute();
      window.location.assign(next && /^[a-z0-9-]+$/.test(next) && next !== 'home' ? '/' + next : '/');
    } catch {
      setErr('Erreur réseau ou serveur.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="fr-container fr-my-6w" style={{maxWidth:'720px'}}>
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Connexion à Eclauses</h1>
      </header>

      <form onSubmit={doPasswordLogin} className="fr-card fr-p-3w fr-mt-3w">
            {err && <div className="fr-alert fr-alert--error fr-mb-3w"><p>{err}</p></div>}
            {info && <div className="fr-alert fr-alert--info fr-mb-3w"><p>{info}</p></div>}

            <div className="fr-input-group">
              <label className="fr-label" htmlFor="email-pwd">E-mail</label>
              <input
                id="email-pwd"
                className="fr-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
              />
            </div>

            <div className="fr-password">
              <label className="fr-password__label fr-label" htmlFor="storybook-password-input"> Mot de passe </label>
              <div className="fr-input-wrap">
                <input className="fr-password__input fr-input" autoCapitalize="off" autoCorrect="off" 
                aria-describedby="storybook-password-input-messages" aria-required="true" name="password" 
                autocomplete="current-password" id="pwd" type="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}/>
              </div>
              <div className="fr-messages-group" id="storybook-password-input-messages" aria-live="polite">
              </div>
              <div className="fr-password__checkbox fr-checkbox-group fr-checkbox-group--sm">
                <input aria-label="Afficher le mot de passe" id="undefined-show" type="checkbox"/>
                <label className="fr--password__checkbox fr-label" htmlFor="undefined-show"> Afficher </label>
              </div>
            </div>

            <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
              <button className="fr-btn" type="submit" disabled={loading}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </div>
          </form>

      <div className="fr-mt-3w">
        <p>
          <a href="#" data-nav="support-contact">
            Contacter le support pour demander la création de mon compte Eclauses
          </a>
        </p>
        <button
          className="fr-link"
          type="button"
          onClick={() => gristAPI?.navigate && gristAPI.navigate('mot-de-passe-oublie')}
        >
          Mot de passe oublié ?
        </button>
      </div>
    </section>
  );
};

export default Component;
