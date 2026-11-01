// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-marches-declaration), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const ComboBox = gristAPI.getComponent ? gristAPI.getComponent('ComboBox') : null;

  const T = {
    UA: 'Utilisateurs_Acheteurs',
    ACH: 'Acheteurs',
    M: 'Marches',
    C: 'Clauses_sociales',
    SPECS: 'T0_Referentiel_Specialites',
  };

  const M = {
    INTITULE: 'Intitule_du_marche',
    INTITULE_LOT: 'Intitule_du_lot',
    LOT: 'Numero_de_lot',
    ACHETEUR: 'Acheteur',
    CLAUSE: 'Clauses_sociales',
    SPECS: 'Specialites_du_marche',
    ADR: 'Lieu_d_execution',
    PUB: 'Date_de_publication',
    DLRO: 'Date_Limite_de_Remise_des_Offres',
    DNOTPREV: 'Date_de_notification_previsionnelle',
    EXEC_END: 'Date_de_fin_d_execution',
    STATUS: 'Statut',
    LIEN_DOCS: 'Lien_vers_les_documents_de_consultation',
    PARENT: 'Marche_parent',
  };

  const { toOptions, parseDate } = gristAPI.helpers;
  const toOptionsWithTooltip = (rows) => toOptions(rows || []).map((opt) => {
    const row = (rows || []).find((r) => String(r.id) === String(opt.value));
    return { ...opt, tooltip: row?.Tooltip || '' };
  });
  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const ymd = (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : parseDate(v);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  };
  const isValidDateStr = (v) => {
    if (!v) return true;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    if (!m) return false;
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12) return false;
    const max = new Date(y, mo, 0).getDate();
    return d >= 1 && d <= max;
  };
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const isBlank = (v) => String(v ?? '').trim() === '';
  const toRefList = (v) => {
    const ids = asArray(v)
      .filter((x) => x !== 'L' && x != null && x !== '')
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x));
    return ids.length ? ['L', ...ids] : null;
  };

  const emptyLotForm = () => ({
    [M.INTITULE_LOT]: '',
    [M.LOT]: '',
    [M.CLAUSE]: '',
    [M.SPECS]: [],
    [M.ADR]: '',
  });

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [org, setOrg] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [optsClauses, setOptsClauses] = React.useState([]);
  const [optsSpecs, setOptsSpecs] = React.useState([]);

  const [creating, setCreating] = React.useState(false);
  const [newErrors, setNewErrors] = React.useState({});
  const [newIsAllotted, setNewIsAllotted] = React.useState(false);
  const [newLots, setNewLots] = React.useState([emptyLotForm()]);
  const [newForm, setNewForm] = React.useState({
    [M.INTITULE]: '',
    [M.LIEN_DOCS]: '',
    [M.CLAUSE]: '',
    [M.SPECS]: [],
    [M.ADR]: '',
    [M.PUB]: ymd(new Date()),
    [M.DLRO]: '',
    [M.DNOTPREV]: '',
    [M.STATUS]: '',
  });

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const auth = gristAPI.getAuth();
        const roles = Array.isArray(auth?.roles) ? auth.roles : [];
        if (!auth || !roles.includes('acheteur') || !auth.acheteurId) {
          setErr("Accès refusé : rôle 'acheteur' requis.");
          return;
        }

        const uaRows = await gristAPI.getData(T.UA);
        const me = uaRows.find(r => r.id === auth.acheteurId);
        if (!me?.Entite_de_rattachement) {
          setErr("Votre compte n'est rattaché à aucune entité acheteuse.");
          return;
        }

        const achRows = await gristAPI.getData(T.ACH);
        const entite = achRows.find(a => a.id === me.Entite_de_rattachement);
        if (!entite) {
          setErr("Entité acheteuse introuvable.");
          return;
        }
        setOrg(entite);

        const [c, specs, ms] = await Promise.all([
          gristAPI.getData(T.C),
          gristAPI.getData(T.SPECS).catch(() => []),
          gristAPI.getData(T.M).catch(() => []),
        ]);
        setOptsClauses(toOptions(c || []));
        setOptsSpecs(toOptionsWithTooltip(specs || []));
        setRows(ms || []);
      } catch (e) {
        setErr(e.message || 'Chargement impossible.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateNewLot = (idx, updates) => {
    setNewLots((prev) => prev.map((lot, i) => i === idx ? { ...lot, ...updates } : lot));
  };
  const addNewLot = () => setNewLots((prev) => [...prev, emptyLotForm()]);
  const removeNewLot = (idx) => setNewLots((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  const resetNewLots = () => setNewLots([emptyLotForm()]);

  const recordIdFromAddResult = (result) => {
    if (typeof result === 'number' && Number.isFinite(result)) return result;
    if (typeof result === 'string' && result && Number.isFinite(Number(result))) return Number(result);
    if (Array.isArray(result)) {
      for (const item of result) {
        const id = recordIdFromAddResult(item);
        if (id) return id;
      }
    }
    if (result && typeof result === 'object') {
      return recordIdFromAddResult(result.id ?? result.rowId ?? result.recordId);
    }
    return null;
  };
  async function addMarcheAndGetId(payload) {
    const beforeIds = new Set((rows || []).map((r) => r.id));
    const result = await gristAPI.addRecord(T.M, payload);
    const directId = recordIdFromAddResult(result);
    if (directId) return directId;

    const afterRows = await gristAPI.getData(T.M);
    const created = (afterRows || [])
      .filter((r) => !beforeIds.has(r.id))
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (created?.id) return created.id;
    throw new Error("Marché créé, mais impossible de récupérer son identifiant pour créer les lots.");
  }

  async function createMarche() {
    if (!org) return;
    setErr(null);
    setNewErrors({});
    const nextErrors = {};
    if (isBlank(newForm[M.INTITULE])) nextErrors[M.INTITULE] = 'Champ requis.';
    if (isBlank(newForm[M.DLRO])) nextErrors[M.DLRO] = 'Champ requis.';
    if (isBlank(newForm[M.DNOTPREV])) nextErrors[M.DNOTPREV] = 'Champ requis.';

    const lots = newIsAllotted
      ? (newLots || []).filter((lot) => ![
          lot[M.LOT], lot[M.INTITULE_LOT], lot[M.CLAUSE], lot[M.ADR],
          ...(Array.isArray(lot[M.SPECS]) ? lot[M.SPECS] : [])
        ].every(isBlank))
      : [];

    if (newIsAllotted) {
      if (!lots.length) nextErrors.lots = 'Ajoutez au moins un lot.';
      lots.forEach((lot, idx) => {
        if (isBlank(lot[M.LOT])) nextErrors[`lot-${idx}-${M.LOT}`] = 'Champ requis.';
        if (isBlank(lot[M.INTITULE_LOT])) nextErrors[`lot-${idx}-${M.INTITULE_LOT}`] = 'Champ requis.';
        if (!lot[M.CLAUSE]) nextErrors[`lot-${idx}-${M.CLAUSE}`] = 'Champ requis.';
        if (!Array.isArray(lot[M.SPECS]) || !lot[M.SPECS].length) nextErrors[`lot-${idx}-${M.SPECS}`] = 'Champ requis.';
        if (isBlank(lot[M.ADR])) nextErrors[`lot-${idx}-${M.ADR}`] = 'Champ requis.';
      });
    } else {
      if (!newForm[M.CLAUSE]) nextErrors[M.CLAUSE] = 'Champ requis.';
      if (!Array.isArray(newForm[M.SPECS]) || !newForm[M.SPECS].length) nextErrors[M.SPECS] = 'Champ requis.';
      if (isBlank(newForm[M.ADR])) nextErrors[M.ADR] = 'Champ requis.';
    }

    if (!isValidDateStr(newForm[M.DLRO])) nextErrors[M.DLRO] = 'Format invalide (AAAA-MM-JJ).';
    const dlroDate = parseDate(newForm[M.DLRO]);
    if (dlroDate) {
      const dlro0 = new Date(dlroDate);
      dlro0.setHours(0, 0, 0, 0);
      if (dlro0 < today()) {
        nextErrors[M.DLRO] = 'La date limite de remise des offres ne peut pas être antérieure au jour J.';
      }
    }
    if (!isValidDateStr(newForm[M.DNOTPREV])) nextErrors[M.DNOTPREV] = 'Format invalide (AAAA-MM-JJ).';
    if (Object.keys(nextErrors).length) {
      setNewErrors(nextErrors);
      return;
    }

    const payload = {
      [M.INTITULE]: newForm[M.INTITULE] || null,
      [M.CLAUSE]: !newIsAllotted && newForm[M.CLAUSE] ? Number(newForm[M.CLAUSE]) : null,
      [M.SPECS]: !newIsAllotted ? toRefList(newForm[M.SPECS]) : null,
      [M.ADR]: !newIsAllotted ? (newForm[M.ADR] || null) : null,
      [M.PUB]: newForm[M.PUB] || null,
      [M.DLRO]: newForm[M.DLRO] || null,
      [M.DNOTPREV]: newForm[M.DNOTPREV] || null,
      [M.ACHETEUR]: org.id,
      [M.STATUS]: 'En attente de publication',
    };

    try {
      setCreating(true);
      const parentId = await addMarcheAndGetId(payload);
      for (const lot of lots) {
        await gristAPI.addRecord(T.M, {
          [M.INTITULE]: newForm[M.INTITULE] || null,
          [M.PARENT]: parentId,
          [M.ACHETEUR]: org.id,
          [M.INTITULE_LOT]: lot[M.INTITULE_LOT] || null,
          [M.LOT]: lot[M.LOT] || null,
          [M.CLAUSE]: lot[M.CLAUSE] ? Number(lot[M.CLAUSE]) : null,
          [M.SPECS]: toRefList(lot[M.SPECS]),
          [M.ADR]: lot[M.ADR] || null,
          [M.PUB]: newForm[M.PUB] || null,
          [M.DLRO]: newForm[M.DLRO] || null,
          [M.DNOTPREV]: newForm[M.DNOTPREV] || null,
          [M.STATUS]: 'En attente de publication',
        });
      }
      if (gristAPI.navigate) gristAPI.navigate('acheteur-marches');
    } catch (e) {
      setErr(e.message || "Échec de création du marché.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement du formulaire…</p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error fr-mb-3w"><p><strong>Erreur :</strong> {err}</p></div>
        <button className="fr-btn fr-btn--secondary" onClick={() => gristAPI.navigate && gristAPI.navigate('acheteur-marches')}>
          Retour aux marchés
        </button>
      </section>
    );
  }

  return (
    <section className="fr-container fr-my-6w">
      <div className="fr-grid-row fr-grid-row--middle fr-mb-4w">
        <div className="fr-col">
          <h1 className="fr-h3 fr-mb-1w">Déclarer un marché</h1>
          <p className="fr-text--sm fr-mb-0">
            <span className="fr-text-default--error" aria-hidden="true">*</span> Champs obligatoires
          </p>
        </div>
        <div className="fr-col-auto">
          <button className="fr-btn fr-btn--sm fr-btn--secondary fr-icon-arrow-left-line fr-btn--icon-left" onClick={() => gristAPI.navigate && gristAPI.navigate('acheteur-marches')}>
            Retour aux marchés
          </button>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="n-intitule">Intitulé du marché <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="n-intitule" className="fr-input" type="text"
                   value={newForm[M.INTITULE]} onChange={(e)=>setNewForm({...newForm, [M.INTITULE]: e.target.value})}/>
            {newErrors[M.INTITULE] && <p className="fr-error-text">{newErrors[M.INTITULE]}</p>}
          </div>

          <div className="fr-input-group">
            <label className="fr-label" htmlFor="n-cand">Date limite de remise des offres <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="n-cand" className="fr-input" type="date"
                   min={ymd(today())}
                   value={newForm[M.DLRO]} onChange={(e)=>setNewForm({...newForm, [M.DLRO]: e.target.value})}/>
            {newErrors[M.DLRO] && <p className="fr-error-text">{newErrors[M.DLRO]}</p>}
          </div>

          <div className="fr-input-group">
            <label className="fr-label" htmlFor="n-notif">Date de notification prévisionnelle <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="n-notif" className="fr-input" type="date"
                   value={newForm[M.DNOTPREV]} onChange={(e)=>setNewForm({...newForm, [M.DNOTPREV]: e.target.value})}/>
            {newErrors[M.DNOTPREV] && <p className="fr-error-text">{newErrors[M.DNOTPREV]}</p>}
          </div>

          <div className="fr-checkbox-group fr-checkbox-group--sm fr-mb-3w">
            <input
              type="checkbox"
              id="n-is-allotted"
              checked={newIsAllotted}
              onChange={(e) => {
                const checked = e.target.checked;
                setNewIsAllotted(checked);
                setNewErrors({});
                if (!checked) resetNewLots();
              }}
            />
            <label className="fr-label" htmlFor="n-is-allotted">Marché alloti</label>
          </div>

          {!newIsAllotted && (
            <>
              <div className="fr-select-group">
                <label className="fr-label" htmlFor="n-clause">Clause sociale <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <select id="n-clause" className="fr-select" value={newForm[M.CLAUSE]} onChange={(e)=>setNewForm({...newForm, [M.CLAUSE]: e.target.value})}>
                  <option value="">—</option>
                  {optsClauses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {newErrors[M.CLAUSE] && <p className="fr-error-text">{newErrors[M.CLAUSE]}</p>}
              </div>
              <div className="fr-input-group">
                {ComboBox ? (
                  <ComboBox
                    id="n-specs-single"
                    label="Spécialités du marché"
                    required
                    options={optsSpecs}
                    multiple
                    value={newForm[M.SPECS] || []}
                    onChange={(vals) => setNewForm({
                      ...newForm,
                      [M.SPECS]: (vals || []).map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => Number.isFinite(v)),
                    })}
                    placeholder="Choisir des spécialités"
                    searchPlaceholder="Rechercher une spécialité"
                    summaryMode="list"
                  />
                ) : (
                  <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                )}
                {newErrors[M.SPECS] && <p className="fr-error-text">{newErrors[M.SPECS]}</p>}
              </div>
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="n-adr-single">Lieu d’exécution <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <input id="n-adr-single" className="fr-input" type="text" value={newForm[M.ADR]} onChange={(e)=>setNewForm({...newForm, [M.ADR]: e.target.value})}/>
                {newErrors[M.ADR] && <p className="fr-error-text">{newErrors[M.ADR]}</p>}
              </div>
            </>
          )}

          {newIsAllotted && (
            <>
              <h2 className="fr-h5 fr-mt-4w fr-mb-2w">Déclarer les lots couverts par une clause sociale</h2>
              {newErrors.lots && <p className="fr-error-text">{newErrors.lots}</p>}
              {newLots.map((lot, idx) => (
                <div
                  className="fr-p-3w fr-mb-2w"
                  key={`new-lot-${idx}`}
                  style={{
                    position:'relative',
                    border:'1px solid var(--border-default-grey)',
                    background:'var(--background-default-grey)',
                  }}
                >
                  {newLots.length > 1 && (
                    <button
                      type="button"
                      className="fr-btn fr-btn--tertiary-no-outline fr-btn--icon-left fr-btn--sm fr-icon-delete-bin-line"
                      title="Retirer ce lot"
                      aria-label={`Retirer le lot ${idx + 1}`}
                      onClick={()=>removeNewLot(idx)}
                      style={{position:'absolute', top:'.5rem', right:'.5rem', zIndex:1}}
                    >Supprimer ce lot</button>
                  )}
                  <div className="fr-pr-5w">
                    <div className="fr-grid-row fr-grid-row--gutters">
                      <div className="fr-col-12 fr-col-md-3">
                        <div className="fr-input-group">
                          <label className="fr-label" htmlFor={`n-lot-${idx}`}>Numéro de lot <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                          <input id={`n-lot-${idx}`} className="fr-input" type="text" value={lot[M.LOT]} onChange={(e)=>updateNewLot(idx, { [M.LOT]: e.target.value })}/>
                          {newErrors[`lot-${idx}-${M.LOT}`] && <p className="fr-error-text">{newErrors[`lot-${idx}-${M.LOT}`]}</p>}
                        </div>
                      </div>
                      <div className="fr-col-12 fr-col-md-9">
                        <div className="fr-input-group">
                          <label className="fr-label" htmlFor={`n-intitule-lot-${idx}`}>Intitulé du lot <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                          <input id={`n-intitule-lot-${idx}`} className="fr-input" type="text" value={lot[M.INTITULE_LOT]} onChange={(e)=>updateNewLot(idx, { [M.INTITULE_LOT]: e.target.value })}/>
                          {newErrors[`lot-${idx}-${M.INTITULE_LOT}`] && <p className="fr-error-text">{newErrors[`lot-${idx}-${M.INTITULE_LOT}`]}</p>}
                        </div>
                      </div>
                      <div className="fr-col-12 fr-col-md-6">
                        <div className="fr-select-group">
                          <label className="fr-label" htmlFor={`n-clause-${idx}`}>Clause sociale <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                          <select id={`n-clause-${idx}`} className="fr-select" value={lot[M.CLAUSE]} onChange={(e)=>updateNewLot(idx, { [M.CLAUSE]: e.target.value })}>
                            <option value="">—</option>
                            {optsClauses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {newErrors[`lot-${idx}-${M.CLAUSE}`] && <p className="fr-error-text">{newErrors[`lot-${idx}-${M.CLAUSE}`]}</p>}
                        </div>
                      </div>
                      <div className="fr-col-12 fr-col-md-6">
                        <div className="fr-input-group">
                          {ComboBox ? (
                            <ComboBox
                              id={`n-specs-${idx}`}
                              label="Spécialités du marché"
                              required
                              options={optsSpecs}
                              multiple
                              value={lot[M.SPECS] || []}
                              onChange={(vals) => updateNewLot(idx, {
                                [M.SPECS]: (vals || []).map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => Number.isFinite(v)),
                              })}
                              placeholder="Choisir des spécialités"
                              searchPlaceholder="Rechercher une spécialité"
                              summaryMode="list"
                            />
                          ) : (
                            <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                          )}
                          {newErrors[`lot-${idx}-${M.SPECS}`] && <p className="fr-error-text">{newErrors[`lot-${idx}-${M.SPECS}`]}</p>}
                        </div>
                      </div>
                      <div className="fr-col-12 fr-col-md-6">
                        <div className="fr-input-group">
                          <label className="fr-label" htmlFor={`n-adr-${idx}`}>Lieu d’exécution <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                          <input id={`n-adr-${idx}`} className="fr-input" type="text" value={lot[M.ADR]} onChange={(e)=>updateNewLot(idx, { [M.ADR]: e.target.value })}/>
                          {newErrors[`lot-${idx}-${M.ADR}`] && <p className="fr-error-text">{newErrors[`lot-${idx}-${M.ADR}`]}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button className="fr-btn fr-btn--sm fr-btn--secondary fr-icon-add-line fr-btn--icon-left" onClick={addNewLot}>
                Ajouter un lot
              </button>
            </>
          )}

          <div className="fr-btns-group fr-btns-group--inline fr-btns-group--right fr-mt-4w">
            <button className="fr-btn" onClick={createMarche} disabled={creating}>
              {creating ? 'Création…' : 'Créer le marché'}
            </button>
            <button className="fr-btn fr-btn--secondary" onClick={() => gristAPI.navigate && gristAPI.navigate('acheteur-marches')} disabled={creating}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Component;
