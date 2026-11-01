// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-marches-modification), typé progressivement.
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
    PARENT: 'Marche_parent',
    LOTS: 'Lots',
  };

  const { toOptions, parseDate, formatDate } = gristAPI.helpers;
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
  const asRefIds = (v) => asArray(v)
    .filter((x) => x !== 'L' && x != null && x !== '')
    .map((x) => (typeof x === 'number' ? x : Number(x)))
    .filter((x) => Number.isFinite(x));

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [org, setOrg] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [optsClauses, setOptsClauses] = React.useState([]);
  const [optsSpecs, setOptsSpecs] = React.useState([]);

  const [marcheId, setMarcheId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [editLots, setEditLots] = React.useState([]);
  const [editIsAllotted, setEditIsAllotted] = React.useState(false);
  const [editingLotKey, setEditingLotKey] = React.useState(null);
  const [deletedLotIds, setDeletedLotIds] = React.useState([]);
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const goBack = () => gristAPI.navigate && gristAPI.navigate('acheteur-marches');

  const compareByLot = (a, b) => {
    const lotA = String(a?.[M.LOT] ?? '').trim();
    const lotB = String(b?.[M.LOT] ?? '').trim();
    return lotA.localeCompare(lotB, 'fr', { numeric: true, sensitivity: 'base' });
  };

  const lotToForm = (lot, fallback = {}) => ({
    _key: lot?.id ? `lot-${lot.id}` : `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    _isNew: !lot?.id,
    id: lot?.id || null,
    [M.INTITULE]: lot?.[M.INTITULE] || fallback[M.INTITULE] || '',
    [M.INTITULE_LOT]: lot?.[M.INTITULE_LOT] || '',
    [M.LOT]: lot?.[M.LOT] || '',
    [M.CLAUSE]: lot?.[M.CLAUSE] || '',
    [M.SPECS]: asRefIds(lot?.[M.SPECS]),
    [M.ADR]: lot?.[M.ADR] || '',
    [M.PUB]: ymd(lot?.[M.PUB]) || fallback[M.PUB] || '',
    [M.DLRO]: ymd(lot?.[M.DLRO]) || fallback[M.DLRO] || '',
    [M.DNOTPREV]: ymd(lot?.[M.DNOTPREV]) || fallback[M.DNOTPREV] || '',
    [M.STATUS]: lot?.[M.STATUS] || fallback[M.STATUS] || 'En attente de publication',
  });

  const getLotsForParent = (row, allRows = rows) => {
    if (!row) return [];
    const byId = new Map((allRows || []).map(r => [r.id, r]));
    const ids = asRefIds(row[M.LOTS]);
    const fromRefList = ids.map((id) => byId.get(id)).filter(Boolean);
    const lots = fromRefList.length
      ? fromRefList
      : (allRows || []).filter((r) => Number(r[M.PARENT]) === Number(row.id));
    return lots.slice().sort(compareByLot);
  };

  const clauseLabel = (id) => {
    const o = optsClauses.find(x => String(x.value) === String(id));
    return o ? o.label : String(id ?? '—');
  };
  const specLabel = (id) => {
    const o = optsSpecs.find(x => String(x.value) === String(id));
    return o ? o.label : String(id ?? '—');
  };
  const specLabels = (ids) => {
    const labels = asRefIds(ids).map((id) => specLabel(id)).filter(Boolean);
    return labels.length ? labels.join(', ') : '—';
  };

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

        const rawId = (() => {
          try { return sessionStorage.getItem('acheteurMarcheEditId'); } catch (_) { return ''; }
        })();
        const id = Number(rawId);
        if (!Number.isFinite(id)) {
          setErr('Aucun marché sélectionné pour modification.');
          return;
        }
        setMarcheId(id);

        const uaRows = await gristAPI.getData(T.UA);
        const me = uaRows.find(r => r.id === auth.acheteurId);
        if (!me?.Entite_de_rattachement) {
          setErr("Votre compte n'est rattaché à aucune entité acheteuse.");
          return;
        }

        const [achRows, c, specs, ms] = await Promise.all([
          gristAPI.getData(T.ACH),
          gristAPI.getData(T.C),
          gristAPI.getData(T.SPECS).catch(() => []),
          gristAPI.getData(T.M),
        ]);
        const entite = achRows.find(a => a.id === me.Entite_de_rattachement);
        if (!entite) {
          setErr("Entité acheteuse introuvable.");
          return;
        }
        setOrg(entite);
        setOptsClauses(toOptions(c || []));
        setOptsSpecs(toOptionsWithTooltip(specs || []));
        setRows(ms || []);

        const row = (ms || []).find(r => Number(r.id) === id);
        if (!row || Number(row[M.ACHETEUR]) !== Number(entite.id)) {
          setErr('Marché introuvable ou non rattaché à votre entité.');
          return;
        }

        setEditForm({
          [M.INTITULE]: row[M.INTITULE] || '',
          [M.CLAUSE]: row[M.CLAUSE] || '',
          [M.SPECS]: asRefIds(row[M.SPECS]),
          [M.ADR]: row[M.ADR] || '',
          [M.PUB]: ymd(row[M.PUB]),
          [M.DLRO]: ymd(row[M.DLRO]),
          [M.DNOTPREV]: ymd(row[M.DNOTPREV]),
          [M.EXEC_END]: ymd(row[M.EXEC_END]),
        });

        const lots = getLotsForParent(row, ms || []);
        const fallback = {
          [M.INTITULE]: row[M.INTITULE] || '',
          [M.PUB]: ymd(row[M.PUB]),
          [M.DLRO]: ymd(row[M.DLRO]),
          [M.DNOTPREV]: ymd(row[M.DNOTPREV]),
          [M.STATUS]: row[M.STATUS] || 'En attente de publication',
        };
        setEditIsAllotted(lots.length > 0);
        setEditLots(lots.map((lot) => lotToForm(lot, fallback)));
      } catch (e) {
        setErr(e.message || 'Chargement impossible.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateEditLot = (key, updates) => {
    setEditLots((prev) => prev.map((lot) => lot._key === key ? { ...lot, ...updates } : lot));
  };
  const addEditLot = () => {
    const lot = lotToForm(null, {
      [M.INTITULE]: editForm[M.INTITULE] || '',
      [M.PUB]: editForm[M.PUB] || '',
      [M.DLRO]: editForm[M.DLRO] || '',
      [M.DNOTPREV]: editForm[M.DNOTPREV] || '',
      [M.STATUS]: 'En attente de publication',
    });
    setEditIsAllotted(true);
    setEditLots((prev) => [...prev, lot]);
    setEditingLotKey(lot._key);
  };
  const deleteEditLot = (lot) => {
    if (!lot) return;
    if (!lot._isNew && lot.id) {
      setDeletedLotIds((prev) => prev.includes(lot.id) ? prev : [...prev, lot.id]);
    }
    setEditLots((prev) => prev.filter((item) => item._key !== lot._key));
    if (editingLotKey === lot._key) setEditingLotKey(null);
  };
  const validateLotBeforeClose = (lot) => {
    const prefix = `editLot-${lot._key}-`;
    const lotErrors = {};
    if (isBlank(lot[M.LOT])) lotErrors[`${prefix}${M.LOT}`] = 'Champ requis.';
    if (isBlank(lot[M.INTITULE_LOT])) lotErrors[`${prefix}${M.INTITULE_LOT}`] = 'Champ requis.';
    if (!lot[M.CLAUSE]) lotErrors[`${prefix}${M.CLAUSE}`] = 'Champ requis.';
    if (!Array.isArray(lot[M.SPECS]) || !lot[M.SPECS].length) lotErrors[`${prefix}${M.SPECS}`] = 'Champ requis.';
    if (isBlank(lot[M.ADR])) lotErrors[`${prefix}${M.ADR}`] = 'Champ requis.';
    setErrors((prev) => {
      const cleaned = Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(prefix)));
      return { ...cleaned, ...lotErrors };
    });
    if (Object.keys(lotErrors).length) return false;
    setEditingLotKey(null);
    return true;
  };

  async function saveEdit() {
    if (!org || !marcheId) return;
    setErr(null);
    setErrors({});
    const nextErrors = {};

    if (isBlank(editForm[M.INTITULE])) nextErrors[M.INTITULE] = 'Champ requis.';
    if (isBlank(editForm[M.DLRO])) nextErrors[M.DLRO] = 'Champ requis.';
    if (isBlank(editForm[M.DNOTPREV])) nextErrors[M.DNOTPREV] = 'Champ requis.';
    if (!isValidDateStr(editForm[M.DLRO])) nextErrors[M.DLRO] = 'Format invalide (AAAA-MM-JJ).';
    const dlroDate = parseDate(editForm[M.DLRO]);
    if (dlroDate) {
      const dlro0 = new Date(dlroDate);
      dlro0.setHours(0, 0, 0, 0);
      if (dlro0 < today()) {
        nextErrors[M.DLRO] = 'La date limite de remise des offres ne peut pas être antérieure au jour J.';
      }
    }
    if (!isValidDateStr(editForm[M.DNOTPREV])) nextErrors[M.DNOTPREV] = 'Format invalide (AAAA-MM-JJ).';

    if (editIsAllotted) {
      if (!editLots.length) nextErrors.editLots = 'Ajoutez au moins un lot.';
      editLots.forEach((lot) => {
        if (isBlank(lot[M.LOT])) nextErrors[`editLot-${lot._key}-${M.LOT}`] = 'Champ requis.';
        if (isBlank(lot[M.INTITULE_LOT])) nextErrors[`editLot-${lot._key}-${M.INTITULE_LOT}`] = 'Champ requis.';
        if (!lot[M.CLAUSE]) nextErrors[`editLot-${lot._key}-${M.CLAUSE}`] = 'Champ requis.';
        if (!Array.isArray(lot[M.SPECS]) || !lot[M.SPECS].length) nextErrors[`editLot-${lot._key}-${M.SPECS}`] = 'Champ requis.';
        if (isBlank(lot[M.ADR])) nextErrors[`editLot-${lot._key}-${M.ADR}`] = 'Champ requis.';
      });
    } else {
      if (!editForm[M.CLAUSE]) nextErrors[M.CLAUSE] = 'Champ requis.';
      if (!Array.isArray(editForm[M.SPECS]) || !editForm[M.SPECS].length) nextErrors[M.SPECS] = 'Champ requis.';
      if (isBlank(editForm[M.ADR])) nextErrors[M.ADR] = 'Champ requis.';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const updates = {
        [M.INTITULE]: editForm[M.INTITULE] || null,
        [M.PUB]: editForm[M.PUB] || null,
        [M.DLRO]: editForm[M.DLRO] || null,
        [M.DNOTPREV]: editForm[M.DNOTPREV] || null,
        [M.CLAUSE]: editIsAllotted ? null : (editForm[M.CLAUSE] ? Number(editForm[M.CLAUSE]) : null),
        [M.SPECS]: editIsAllotted ? null : toRefList(editForm[M.SPECS]),
        [M.ADR]: editIsAllotted ? null : (editForm[M.ADR] || null),
      };

      await gristAPI.updateRecord(T.M, marcheId, updates);

      for (const lotId of deletedLotIds) {
        await gristAPI.deleteRecord(T.M, lotId);
      }
      if (editIsAllotted) {
        for (const lot of editLots) {
          const lotPayload = {
            [M.INTITULE]: editForm[M.INTITULE] || null,
            [M.PARENT]: marcheId,
            [M.ACHETEUR]: org.id,
            [M.INTITULE_LOT]: lot[M.INTITULE_LOT] || null,
            [M.LOT]: lot[M.LOT] || null,
            [M.CLAUSE]: lot[M.CLAUSE] ? Number(lot[M.CLAUSE]) : null,
            [M.SPECS]: toRefList(lot[M.SPECS]),
            [M.ADR]: lot[M.ADR] || null,
            [M.PUB]: editForm[M.PUB] || null,
            [M.DLRO]: editForm[M.DLRO] || null,
            [M.DNOTPREV]: editForm[M.DNOTPREV] || null,
            [M.STATUS]: lot[M.STATUS] || 'En attente de publication',
          };
          if (lot._isNew || !lot.id) {
            await gristAPI.addRecord(T.M, lotPayload);
          } else {
            await gristAPI.updateRecord(T.M, lot.id, lotPayload);
          }
        }
      }
      goBack();
    } catch (e) {
      setErr(e.message || 'Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement du marché…</p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error fr-mb-3w"><p><strong>Erreur :</strong> {err}</p></div>
        <button className="fr-btn fr-btn--secondary" onClick={goBack}>Retour aux marchés</button>
      </section>
    );
  }

  return (
    <section className="fr-container fr-my-6w">
      <div className="fr-grid-row fr-grid-row--middle fr-mb-4w">
        <div className="fr-col">
          <h1 className="fr-h3 fr-mb-1w">Modifier le marché</h1>
          <p className="fr-text--sm fr-mb-0">
            <span className="fr-text-default--error" aria-hidden="true">*</span> Champs obligatoires
          </p>
        </div>
        <div className="fr-col-auto">
          <button className="fr-btn fr-btn--sm fr-btn--secondary fr-icon-arrow-left-line fr-btn--icon-left" onClick={goBack}>
            Retour aux marchés
          </button>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="e-intitule">Intitulé du marché <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="e-intitule" className="fr-input" type="text"
                   value={editForm[M.INTITULE] || ''} onChange={(e)=>setEditForm({...editForm, [M.INTITULE]: e.target.value})}/>
            {errors[M.INTITULE] && <p className="fr-error-text">{errors[M.INTITULE]}</p>}
          </div>

          {!editIsAllotted && (
            <>
              <div className="fr-select-group">
                <label className="fr-label" htmlFor="e-parent-clause">Clause sociale <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <select id="e-parent-clause" className="fr-select"
                        value={editForm[M.CLAUSE] || ''} onChange={(e)=>setEditForm({...editForm, [M.CLAUSE]: e.target.value})}>
                  <option value="">—</option>
                  {optsClauses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {errors[M.CLAUSE] && <p className="fr-error-text">{errors[M.CLAUSE]}</p>}
              </div>
              <div className="fr-input-group">
                {ComboBox ? (
                  <ComboBox
                    id="e-parent-specs"
                    label="Spécialités du marché"
                    required
                    options={optsSpecs}
                    multiple
                    value={editForm[M.SPECS] || []}
                    onChange={(vals) => setEditForm({
                      ...editForm,
                      [M.SPECS]: (vals || []).map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => Number.isFinite(v)),
                    })}
                    placeholder="Choisir des spécialités"
                    searchPlaceholder="Rechercher une spécialité"
                    summaryMode="list"
                  />
                ) : (
                  <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                )}
                {errors[M.SPECS] && <p className="fr-error-text">{errors[M.SPECS]}</p>}
              </div>
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="e-parent-adr">Lieu d’exécution <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <input id="e-parent-adr" className="fr-input" type="text"
                       value={editForm[M.ADR] || ''} onChange={(e)=>setEditForm({...editForm, [M.ADR]: e.target.value})}/>
                {errors[M.ADR] && <p className="fr-error-text">{errors[M.ADR]}</p>}
              </div>
            </>
          )}

          <div className="fr-input-group">
            <label className="fr-label" htmlFor="e-dlro">Date limite de remise des offres <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="e-dlro" className="fr-input" type="date"
                   min={ymd(today())}
                   value={editForm[M.DLRO] || ''} onChange={(e)=>setEditForm({...editForm, [M.DLRO]: e.target.value})}/>
            {errors[M.DLRO] && <p className="fr-error-text">{errors[M.DLRO]}</p>}
          </div>

          <div className="fr-input-group">
            <label className="fr-label" htmlFor="e-dnotprev">Date de notification prévisionnelle <span className="fr-text-default--error" aria-hidden="true">*</span></label>
            <input id="e-dnotprev" className="fr-input" type="date"
                   value={editForm[M.DNOTPREV] || ''} onChange={(e)=>setEditForm({...editForm, [M.DNOTPREV]: e.target.value})}/>
            {errors[M.DNOTPREV] && <p className="fr-error-text">{errors[M.DNOTPREV]}</p>}
          </div>

          {editIsAllotted && (
            <section className="fr-mb-3w">
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 className="fr-h5 fr-mb-0">Lots couverts par une clause sociale</h2>
                </div>
              </div>
              {errors.editLots && <p className="fr-error-text">{errors.editLots}</p>}
              <div className="fr-grid-row fr-grid-row--gutters">
                {editLots.map((lot) => {
                  const isEditingLot = editingLotKey === lot._key;
                  return (
                    <div className="fr-col-12" key={lot._key}>
                      <div
                        className="fr-p-3w"
                        style={{
                          position:'relative',
                          border:'1px solid var(--border-default-grey)',
                          background:'var(--background-default-grey)',
                        }}
                      >
                        <div
                          className="fr-btns-group fr-btns-group--inline fr-btns-group--right fr-btns-group--icon-left fr-btns-group--sm"
                          style={{position:'absolute', top:'.5rem', right:'.5rem', zIndex:1}}
                        >
                          {!isEditingLot ? (
                            <button
                              type="button"
                              className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line fr-btn--icon-left"
                              title="Modifier ce lot"
                              aria-label={`Modifier le lot ${lot[M.LOT] || ''}`}
                              onClick={() => setEditingLotKey(lot._key)}
                            >
                              Modifier ce lot
                            </button>
                          ) : (
                              <button
                                type="button"
                                className="fr-btn fr-btn--sm fr-icon-check-line fr-btn--icon-left"
                                onClick={() => validateLotBeforeClose(lot)}
                              >
                                Enregistrer le lot
                              </button>
                          )}
                          <button
                            type="button"
                            className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-delete-bin-line fr-btn--icon-left"
                            title="Supprimer ce lot"
                            aria-label={`Supprimer le lot ${lot[M.LOT] || ''}`}
                            onClick={() => deleteEditLot(lot)}
                          >
                            Supprimer ce lot
                          </button>
                        </div>

                        {!isEditingLot ? (
                          <div className="fr-pr-8w">
                            <p className="fr-text--bold fr-mb-1w">
                              Lot {lot[M.LOT] || '—'} - {lot[M.INTITULE_LOT] || 'Sans intitulé'}
                            </p>
                            <p className="fr-text--sm fr-mb-1w"><strong>Clause :</strong> {clauseLabel(lot[M.CLAUSE])}</p>
                            <p className="fr-text--sm fr-mb-1w"><strong>Spécialités :</strong> {specLabels(lot[M.SPECS])}</p>
                            <p className="fr-text--sm fr-mb-0"><strong>Lieu d'exécution :</strong> {lot[M.ADR] || '—'}</p>
                          </div>
                        ) : (
                          <div className="fr-pr-8w">
                            <div className="fr-grid-row fr-grid-row--gutters">
                              <div className="fr-col-12 fr-col-md-3">
                                <div className="fr-input-group">
                                  <label className="fr-label" htmlFor={`e-lot-${lot._key}`}>Numéro de lot <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                                  <input id={`e-lot-${lot._key}`} className="fr-input" type="text" value={lot[M.LOT]} onChange={(e)=>updateEditLot(lot._key, { [M.LOT]: e.target.value })}/>
                                  {errors[`editLot-${lot._key}-${M.LOT}`] && <p className="fr-error-text">{errors[`editLot-${lot._key}-${M.LOT}`]}</p>}
                                </div>
                              </div>
                              <div className="fr-col-12 fr-col-md-9">
                                <div className="fr-input-group">
                                  <label className="fr-label" htmlFor={`e-intitule-lot-${lot._key}`}>Intitulé du lot <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                                  <input id={`e-intitule-lot-${lot._key}`} className="fr-input" type="text" value={lot[M.INTITULE_LOT]} onChange={(e)=>updateEditLot(lot._key, { [M.INTITULE_LOT]: e.target.value })}/>
                                  {errors[`editLot-${lot._key}-${M.INTITULE_LOT}`] && <p className="fr-error-text">{errors[`editLot-${lot._key}-${M.INTITULE_LOT}`]}</p>}
                                </div>
                              </div>
                              <div className="fr-col-12 fr-col-md-6">
                                <div className="fr-select-group">
                                  <label className="fr-label" htmlFor={`e-clause-${lot._key}`}>Clause sociale <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                                  <select id={`e-clause-${lot._key}`} className="fr-select" value={lot[M.CLAUSE]} onChange={(e)=>updateEditLot(lot._key, { [M.CLAUSE]: e.target.value })}>
                                    <option value="">—</option>
                                    {optsClauses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                  {errors[`editLot-${lot._key}-${M.CLAUSE}`] && <p className="fr-error-text">{errors[`editLot-${lot._key}-${M.CLAUSE}`]}</p>}
                                </div>
                              </div>
                              <div className="fr-col-12 fr-col-md-6">
                                <div className="fr-input-group">
                                  {ComboBox ? (
                                    <ComboBox
                                      id={`e-specs-${lot._key}`}
                                      label="Spécialités du marché"
                                      required
                                      options={optsSpecs}
                                      multiple
                                      value={lot[M.SPECS] || []}
                                      onChange={(vals) => updateEditLot(lot._key, {
                                        [M.SPECS]: (vals || []).map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => Number.isFinite(v)),
                                      })}
                                      placeholder="Choisir des spécialités"
                                      searchPlaceholder="Rechercher une spécialité"
                                      summaryMode="list"
                                    />
                                  ) : (
                                    <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                                  )}
                                  {errors[`editLot-${lot._key}-${M.SPECS}`] && <p className="fr-error-text">{errors[`editLot-${lot._key}-${M.SPECS}`]}</p>}
                                </div>
                              </div>
                              <div className="fr-col-12 fr-col-md-6">
                                <div className="fr-input-group">
                                  <label className="fr-label" htmlFor={`e-adr-${lot._key}`}>Lieu d’exécution <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                                  <input id={`e-adr-${lot._key}`} className="fr-input" type="text" value={lot[M.ADR]} onChange={(e)=>updateEditLot(lot._key, { [M.ADR]: e.target.value })}/>
                                  {errors[`editLot-${lot._key}-${M.ADR}`] && <p className="fr-error-text">{errors[`editLot-${lot._key}-${M.ADR}`]}</p>}
                                </div>
                              </div>
                            </div>
                          </div>

                        )}


                      </div>
                    </div>
                  );
                })}
                <div className="fr-col">
                  <button className="fr-btn fr-btn--sm fr-btn--secondary fr-icon-add-line fr-btn--icon-left" onClick={addEditLot}>
                    Ajouter un lot
                  </button>
                </div>
              </div>
            </section>
          )}

          <div className="fr-btns-group fr-btns-group--inline fr-btns-group--right fr-mt-4w">
            <button className="fr-btn" onClick={saveEdit} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button className="fr-btn fr-btn--secondary" onClick={goBack} disabled={saving}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Component;
