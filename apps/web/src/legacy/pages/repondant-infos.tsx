// @ts-nocheck : code repris du widget Grist (grist/page/repondant-infos), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  // ===== Tables & colonnes =====
  const TABLE = 'Repondants';
  const COL = {
    NOM: 'Nom',
    PRENOM: 'Prenom',
    EMAIL: 'Email',
    TEL: 'Telephone',
    RAISOC: 'Raison_sociale',
    SIRET: 'Siret',
    CAND: 'Candidat_aux_marches',    // RefList('Marches')
    TIT:  'Titulaire_aux_marches',   // RefList('Marches')
  };

  // ===== Utils =====
  const emailLooksOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);

  // ===== State =====
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]       = React.useState(null);
  const [msg, setMsg]       = React.useState(null);

  const [rows, setRows]     = React.useState([]);
  const [currentId, setCurrentId] = React.useState(null);

  const [form, setForm] = React.useState({
    [COL.NOM]: '',
    [COL.PRENOM]: '',
    [COL.EMAIL]: '',
    [COL.TEL]: '',
    [COL.RAISOC]: '',
    [COL.SIRET]: '',
  });

  // ===== Load =====
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null); setMsg(null);

        const auth = gristAPI.getAuth ? gristAPI.getAuth() : null;
        const roles = Array.isArray(auth?.roles) ? auth.roles : [];
        if (!auth || !roles.includes('repondant')) {
          throw new Error("Accès refusé : rôle 'répondant' requis.");
        }

        const data = await gristAPI.getData(TABLE);
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);

        // id depuis auth; si la vue ACL est réduite à 1 ligne, on accepte cette ligne
        let id = auth?.repondantId || null;
        if (!id && data && data.length === 1) {
          id = data[0].id;
        }
        if (!id) throw new Error("Impossible d’identifier votre fiche répondant.");

        setCurrentId(id);

        const rec = (data || []).find(r => r.id === id);
        if (!rec) throw new Error("Votre fiche n’est pas accessible avec ce lien.");

        seedForm(rec);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Erreur de chargement');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function seedForm(rec) {
    setForm({
      [COL.NOM]:    rec[COL.NOM]    || '',
      [COL.PRENOM]: rec[COL.PRENOM] || '',
      [COL.EMAIL]:  rec[COL.EMAIL]  || '',
      [COL.TEL]:    rec[COL.TEL]    || '',
      [COL.RAISOC]: rec[COL.RAISOC] || '',
      [COL.SIRET]:  rec[COL.SIRET]  || '',
    });
  }

  function setField(name, value) { setMsg(null); setErr(null); setForm(prev => ({ ...prev, [name]: value })); }

  async function save() {
    if (!currentId) return;
    setErr(null); setMsg(null);

    if (!emailLooksOk(form[COL.EMAIL])) {
      setErr("Adresse e-mail invalide.");
      return;
    }

    const updates = {
      [COL.NOM]:    form[COL.NOM]    || null,
      [COL.PRENOM]: form[COL.PRENOM] || null,
      [COL.EMAIL]:  form[COL.EMAIL]  || null,
      [COL.TEL]:    form[COL.TEL]    || null,
      [COL.RAISOC]: form[COL.RAISOC] || null,
      [COL.SIRET]:  form[COL.SIRET]  || null,
    };

    try {
      await gristAPI.updateRecord(TABLE, currentId, updates);
      setMsg("Informations enregistrées avec succès.");
      // rafraîchit localement
      const data = await gristAPI.getData(TABLE);
      setRows(Array.isArray(data) ? data : []);
      const rec = (data || []).find(r => r.id === currentId);
      if (rec) seedForm(rec);
    } catch (e) {
      setErr(e.message || "Échec de l’enregistrement.");
    }
  }

  // ===== Computed =====
  const rec = React.useMemo(
    () => (rows || []).find(r => r.id === currentId) || null,
    [rows, currentId]
  );
  const nbCandidats = asArray(rec?.[COL.CAND]).length;
  const nbTitulaires = asArray(rec?.[COL.TIT]).length;

  // ===== UI =====
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement…</p>
      </section>
    );
  }
  if (err) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error"><p><strong>Erreur :</strong> {err}</p></div>
      </section>
    );
  }

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Mes informations</h1>
      </header>

      {msg && <div className="fr-alert fr-alert--success fr-mb-3w"><p>{msg}</p></div>}

      <div className="fr-grid-row fr-grid-row--gutters">
        {/* Formulaire principal */}
        <div className="fr-col-12 fr-col-xl-8 fr-col-lg-10">
          <div className="fr-fieldset">
            <div className="fr-fieldset__content">
                <div className="fr-input-group">
                <label className="fr-label" htmlFor="rs">Raison sociale</label>
                <input id="rs" className="fr-input" type="text"
                  value={form[COL.RAISOC]} onChange={(e)=>setField(COL.RAISOC, e.target.value)} />
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="rs">SIRET</label>
                <input id="siret" className="fr-input" type="text"
                  value={form[COL.SIRET]} onChange={(e)=>setField(COL.SIRET, e.target.value)} />
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="prenom">Prénom</label>
                <input id="prenom" className="fr-input" type="text"
                  value={form[COL.PRENOM]} onChange={(e)=>setField(COL.PRENOM, e.target.value)} />
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="nom">Nom</label>
                <input id="nom" className="fr-input" type="text"
                  value={form[COL.NOM]} onChange={(e)=>setField(COL.NOM, e.target.value)} />
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="email">E-mail</label>
                <input id="email" className="fr-input" type="email"
                  value={form[COL.EMAIL]} disabled />
                <p className="fr-hint-text">Pour modifier cette information, contacter le <a href="#" data-nav="support">support Eclauses.</a></p>
                  
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="tel">Téléphone</label>
                <input id="tel" className="fr-input" type="text"
                  value={form[COL.TEL]} onChange={(e)=>setField(COL.TEL, e.target.value)} />
              </div>


              <div className="fr-mt-4w">
                <button className="fr-btn" onClick={save}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Component;
