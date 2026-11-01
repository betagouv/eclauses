// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-infos), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  // --- Contexte widget ---
  const auth = gristAPI.getAuth ? gristAPI.getAuth() : null;
  const H = (typeof helpers !== 'undefined') ? helpers : {};
  const { includesI, emailLooksOk } = H;

  const TABLE = 'Acheteurs';

  // Définition des champs possibles (on ne rendra que ceux trouvés dans la table)
  const FIELD_DEFS = [
    { key: 'ORGANISME', label: "Nom de l’organisation", candidates: ['Organisme','Nom','Nom_organisme','Nom_de_l_organisme','Authority','Autorite','Autorite_adjudicatrice'] },
    { key: 'SERVICE',   label: "Service / Direction",     candidates: ['Service','Departement','Direction','Unite','Unité'] },
    { key: 'EMAIL',     label: "Courriel",                candidates: ['Email','Courriel','Mail','E_mail','Adresse_mail'] },
    { key: 'TEL',       label: "Téléphone",               candidates: ['Telephone','Téléphone','Tel','Phone'] },
    { key: 'ADRESSE',   label: "Adresse postale",         candidates: ['Adresse','Adresse_postale','Adresse1','Adresse_ligne_1'] },
    { key: 'CP',        label: "Code postal",             candidates: ['Code_postal','CP','Postal','Zip'] },
    { key: 'VILLE',     label: "Ville",                   candidates: ['Ville','Commune','City'] },
    { key: 'SITE',      label: "Site web",                candidates: ['Site_web','Site','URL','Url','Website'] },
  ];

  // --- State ---
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  const [rows, setRows] = React.useState([]);
  const [rowId, setRowId] = React.useState(null);

  const [colMap, setColMap] = React.useState({});     // { ORGANISME: 'Organisme', EMAIL:'Email', ... }
  const [form, setForm] = React.useState({});         // valeurs éditables pour les colonnes trouvées

  // --- Helpers ---
  function pickColumns(sample) {
    const keys = Object.keys(sample || {});
    const map = {};
    FIELD_DEFS.forEach(fd => {
      const found = fd.candidates.find(c => keys.includes(c));
      if (found) map[fd.key] = found;
    });
    return map;
  }

  function seedFormFrom(rec, map) {
    const next = {};
    Object.entries(map).forEach(([k, col]) => {
      next[col] = rec[col] ?? '';
    });
    return next;
  }

  function setField(colName, value) {
    setForm(prev => ({ ...prev, [colName]: value }));
  }

  // --- Load ---
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setMsg(null);

        if (!auth || !(auth.role === 'acheteur' || auth.acheteurId)) {
          throw new Error("Accès réservé aux acheteurs. Connectez-vous avec un compte acheteur.");
        }

        const data = await gristAPI.getData(TABLE);
        const list = Array.isArray(data) ? data : [];
        if (!mounted) return;
        setRows(list);

        // Sélection de la ligne à éditer
        let rec = null;

        // 1) par ID de l'entité depuis l'auth (`acheteurId` est l'identifiant de l'utilisateur, pas de l'entité)
        if (auth.acheteurEntiteId != null) {
          rec = list.find(r => r.id === auth.acheteurEntiteId) || null;
        }

        // 2) fallback par email
        if (!rec && auth.email) {
          const low = String(auth.email).toLowerCase();
          rec = list.find(r => String(r.Email || r.Courriel || '').toLowerCase() === low) || null;
        }

        // 3) s'il n'y a qu'une seule ligne
        if (!rec && list.length === 1) {
          rec = list[0];
        }

        if (!rec) {
          throw new Error("Impossible d’identifier votre fiche acheteur. Vérifiez l’association de votre compte.");
        }

        setRowId(rec.id);

        const map = pickColumns(rec);
        setColMap(map);

        const seeded = seedFormFrom(rec, map);
        setForm(seeded);
      } catch (e) {
        if (mounted) setErr(e.message || 'Erreur de chargement');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  async function save() {
    if (!rowId) return;
    setErr(null); setMsg(null);

    // Validation légère côté client
    const emailCol = colMap.EMAIL;
    if (emailCol && !emailLooksOk(form[emailCol])) {
      setErr("Le format de l’adresse e-mail semble invalide.");
      return;
    }

    // On ne met à jour que les colonnes réellement mappées
    const updates = {};
    Object.values(colMap).forEach(col => { updates[col] = form[col] ?? null; });

    try {
      await gristAPI.updateRecord(TABLE, rowId, updates);
      setMsg("Informations enregistrées avec succès.");
    } catch (e) {
      setErr(e.message || "Échec de l’enregistrement.");
    }
  }

  // --- UI ---
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement des informations…</p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error"><p><strong>Erreur&nbsp;:</strong> {err}</p></div>
      </section>
    );
  }

  const emailCol = colMap.EMAIL;
  const emailVal = emailCol ? (form[emailCol] || '') : (auth?.email || '');

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Mes informations — Acheteur</h1>
        <p className="fr-text--xs fr-text-mention--grey">Table&nbsp;: <code>{TABLE}</code> — ID&nbsp;#{rowId}</p>
      </header>

      {msg && <div className="fr-alert fr-alert--success fr-mb-3w"><p>{msg}</p></div>}

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12">
          <div className="fr-fieldset">
            <div className="fr-fieldset__content">

              {/* ORGANISME */}
              {colMap.ORGANISME && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="org">{FIELD_DEFS.find(f=>f.key==='ORGANISME').label}</label>
                  <input id="org" className="fr-input" type="text"
                    value={form[colMap.ORGANISME] || ''}
                    onChange={(e)=>setField(colMap.ORGANISME, e.target.value)} />
                </div>
              )}

              {/* SERVICE */}
              {colMap.SERVICE && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="service">{FIELD_DEFS.find(f=>f.key==='SERVICE').label}</label>
                  <input id="service" className="fr-input" type="text"
                    value={form[colMap.SERVICE] || ''}
                    onChange={(e)=>setField(colMap.SERVICE, e.target.value)} />
                </div>
              )}

              {/* EMAIL */}
              {colMap.EMAIL && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="email">{FIELD_DEFS.find(f=>f.key==='EMAIL').label}</label>
                  <input id="email" className="fr-input" type="email"
                    value={emailVal}
                    onChange={(e)=>setField(colMap.EMAIL, e.target.value)} />
                  {!emailLooksOk(emailVal) && <p className="fr-error-text">Format d’e-mail invalide.</p>}
                </div>
              )}

              {/* TEL */}
              {colMap.TEL && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="tel">{FIELD_DEFS.find(f=>f.key==='TEL').label}</label>
                  <input id="tel" className="fr-input" type="tel"
                    value={form[colMap.TEL] || ''}
                    onChange={(e)=>setField(colMap.TEL, e.target.value)} />
                </div>
              )}

              {/* ADRESSE */}
              {colMap.ADRESSE && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="adr">{FIELD_DEFS.find(f=>f.key==='ADRESSE').label}</label>
                  <input id="adr" className="fr-input" type="text"
                    value={form[colMap.ADRESSE] || ''}
                    onChange={(e)=>setField(colMap.ADRESSE, e.target.value)} />
                </div>
              )}

              {/* CP + VILLE */}
              <div className="fr-grid-row fr-grid-row--gutters">
                {colMap.CP && (
                  <div className="fr-col-12 fr-col-md-4">
                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="cp">{FIELD_DEFS.find(f=>f.key==='CP').label}</label>
                      <input id="cp" className="fr-input" type="text"
                        value={form[colMap.CP] || ''}
                        onChange={(e)=>setField(colMap.CP, e.target.value)} />
                    </div>
                  </div>
                )}
                {colMap.VILLE && (
                  <div className="fr-col-12 fr-col-md-8">
                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="ville">{FIELD_DEFS.find(f=>f.key==='VILLE').label}</label>
                      <input id="ville" className="fr-input" type="text"
                        value={form[colMap.VILLE] || ''}
                        onChange={(e)=>setField(colMap.VILLE, e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* SITE WEB */}
              {colMap.SITE && (
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="site">{FIELD_DEFS.find(f=>f.key==='SITE').label}</label>
                  <input id="site" className="fr-input" type="url" placeholder="https://…"
                    value={form[colMap.SITE] || ''}
                    onChange={(e)=>setField(colMap.SITE, e.target.value)} />
                </div>
              )}

              <div className="fr-mt-4w">
                <button className="fr-btn" onClick={save}>Enregistrer mes informations</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Component;
