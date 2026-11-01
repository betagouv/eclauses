// @ts-nocheck : code repris du widget Grist (grist/page/beneficiaire-marches), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const ComboBox = gristAPI.getComponent ? gristAPI.getComponent('ComboBox') : null;
  // ===== Tables & colonnes =====
  const T = {
    MARCHES: 'Marches',
    ACHETEURS: 'Acheteurs',
    CLAUSES: 'Clauses_sociales',
    BENEF: 'Beneficiaires',
    INTERETS: 'Marches_Interets',       // si absente -> fallback Suivi
    SPECS: 'T0_Referentiel_Specialites' // libellés des spécialités
  };

  const C = {
    INTITULE: 'Intitule_Lot',
    INTITULE_MARCHE: 'Intitule_du_marche',
    INTITULE_LOT: 'Intitule_du_lot',
    INTITULE_PROPRE: 'Intitule_propre',
    LOT: 'Numero_de_lot',
    PARENT: 'Marche_parent',
    LOTS: 'Lots',
    EST_LOT: 'Est_lot',
    STATUS: 'Statut',
    AA: 'Acheteur',
    PUB: 'Date_de_publication',
    DLRO: 'Date_Limite_de_Remise_des_Offres',
    DNOTPREV: 'Date_de_notification_previsionnelle',
    EXEC_END: 'Date_de_fin_d_execution',
    CLAUSE: 'Clauses_sociales',
    ADR_EXEC: 'Lieu_d_execution',
    LAT: 'Latitude',
    LNG: 'Longitude',
    ADR_GEO: 'Adresse_geocodee',
    SUIVI: 'Suivi',
    SPECS: 'Specialites_du_marche',     // ReferenceList
    DOCS: 'Lien_vers_les_documents_de_consultation',
  };

  const BENEF_CLAUSES_COL = 'Clauses_sociales_de_rattachement';
  const INTERET = { MARCHE: 'Marche', BENEF: 'Beneficiaire' };

  // ===== Utils =====
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const norm = (s) => String(s || '').toLowerCase();
  const includesI = (h, n) => norm(h).includes(norm(n));
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const validLatLng = (lat, lng) =>
    typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0); // Exclure les coordonnées (0, 0)

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'string') { const d = new Date(v); return isNaN(d) ? null : d; }
    if (typeof v === 'number') {
      if (v > 1e12) return new Date(v);
      if (v > 1e9)  return new Date(v * 1000);
      if (v > 1e4)  return new Date(v);
      return new Date(v * 24 * 60 * 60 * 1000);
    }
    return null;
  }
  function formatDate(d) { return d ? d.toLocaleDateString('fr-FR') : '—'; }
  function daysLeft(target) {
    if (!target) return null;
    const end = new Date(target.getTime()); end.setHours(23,59,59,999);
    const diff = end - Date.now();
    return Math.ceil(diff / (24*60*60*1000));
  }
  function pickLabelField(rows) {
    if (!rows || !rows.length) return 'id';
    const s = rows[0] || {};
    for (const k of ['label','name','Nom','nom','title','Title','Libellé','Libelle','libelle','Intitule','Intitulé'])
      if (typeof s[k] === 'string') return k;
    for (const k of Object.keys(s))
      if (typeof s[k] === 'string') return k;
    return 'id';
  }
  function toOptions(rows) {
    const key = pickLabelField(rows);
    return (rows || []).map(r => ({ value: r.id, label: String(r[key] ?? r.id), tooltip: r.Tooltip || '' }));
  }
  function labelFrom(options, id) {
    const o = options.find(o => o.value === id);
    return o ? o.label : String(id ?? '—');
  }

  // ===== Leaflet loader =====
  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L && window.L.map) return resolve(window.L);
      const cssId = 'leaflet-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
      const jsId = 'leaflet-js';
      if (document.getElementById(jsId)) {
        const check = () => window.L && window.L.map ? resolve(window.L) : setTimeout(check, 50);
        return check();
      }
      const script = document.createElement('script');
      script.id = jsId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Échec Leaflet'));
      document.body.appendChild(script);
    });
  }

  // ===== State =====
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const [marches, setMarches] = React.useState([]);
  const [acheteurs, setAcheteurs] = React.useState([]);
  const [clauses, setClauses] = React.useState([]);
  const [benefRows, setBenefRows] = React.useState([]);
  const [currentBenefId, setCurrentBenefId] = React.useState(null);

  const [specRows, setSpecRows] = React.useState([]);
  const [optsSpecs, setOptsSpecs] = React.useState([]);

  // Intérêts
  const [interestMode, setInterestMode] = React.useState('table'); // 'table' | 'suivi'
  const [interestRows, setInterestRows] = React.useState([]);
  const [interestedSet, setInterestedSet] = React.useState(new Set());
  const [interestIdx, setInterestIdx] = React.useState(new Map());

  // UI
  const [search, setSearch] = React.useState('');
  const [tri, setTri] = React.useState('dlCandAsc');
  const [showOnlyFav, setShowOnlyFav] = React.useState(false);
  const [selectedSpecIds, setSelectedSpecIds] = React.useState([]);
  const [tab, setTab] = React.useState('liste'); // 'liste' | 'carte'

  const optsAcheteurs = React.useMemo(() => toOptions(acheteurs), [acheteurs]);
  const optsClauses   = React.useMemo(() => toOptions(clauses),   [clauses]);
  const validClauseIdSet = React.useMemo(() => new Set((clauses || []).map(r => r.id)), [clauses]);
  const rowById = React.useMemo(() => {
    const map = new Map();
    (marches || []).forEach((row) => map.set(row.id, row));
    return map;
  }, [marches]);

  const isLot = React.useCallback((row) => {
    if (!row) return false;
    const estLot = row[C.EST_LOT];
    if (estLot === true || estLot === 1 || estLot === '1' || String(estLot).toLowerCase() === 'true') return true;
    return row[C.PARENT] != null && row[C.PARENT] !== '';
  }, []);

  const getLotsForParent = React.useCallback((row) => {
    if (!row) return [];
    const ids = asArray(row[C.LOTS]).filter(isNum);
    if (ids.length) return ids.map((id) => rowById.get(id)).filter(Boolean);
    return (marches || []).filter((m) => Number(m[C.PARENT]) === Number(row.id));
  }, [marches, rowById]);

  const expandToLotIds = React.useCallback((ids) => {
    const out = new Set();
    asArray(ids).filter(isNum).forEach((id) => {
      const row = rowById.get(id);
      if (!row) return;
      const childLots = isLot(row) ? [] : getLotsForParent(row);
      if (isLot(row) || !childLots.length) {
        out.add(row.id);
        return;
      }
      childLots.forEach((lot) => out.add(lot.id));
    });
    return out;
  }, [rowById, isLot, getLotsForParent]);

  const lots = React.useMemo(() => {
    return (marches || []).filter((row) => isLot(row) || getLotsForParent(row).length === 0);
  }, [marches, isLot, getLotsForParent]);

  const parentForLot = React.useCallback((row) => {
    if (!row || !isLot(row)) return null;
    return rowById.get(row[C.PARENT]) || null;
  }, [rowById, isLot]);

  const valueFor = React.useCallback((row, col) => {
    const value = row?.[col];
    if (value != null && value !== '') return value;
    const parent = parentForLot(row);
    return parent?.[col];
  }, [parentForLot]);

  const parentTitle = React.useCallback((row) => {
    const parent = parentForLot(row);
    return parent?.[C.INTITULE_PROPRE]
      || parent?.[C.INTITULE_MARCHE]
      || parent?.[C.INTITULE]
      || row?.[C.INTITULE_PROPRE]
      || row?.[C.INTITULE_MARCHE]
      || row?.[C.INTITULE]
      || 'Marché non renseigné';
  }, [parentForLot]);

  const lotTitle = React.useCallback((row) => {
    if (!row) return '—';
    const lotNo = String(row[C.LOT] || '').trim();
    const lotName = row[C.INTITULE_LOT] || row[C.INTITULE] || row[C.INTITULE_PROPRE] || `Lot #${row.id}`;
    return lotNo ? `Lot ${lotNo} - ${lotName}` : lotName;
  }, []);

  const buildInterestMaps = React.useCallback((rows) => {
    const idx = new Map();
    (rows || []).forEach((r) => {
      const marcheId = r[INTERET.MARCHE];
      if (!isNum(marcheId)) return;
      const row = rowById.get(marcheId);
      if (!row) return;
      const childLots = isLot(row) ? [] : getLotsForParent(row);
      if (isLot(row) || !childLots.length) {
        idx.set(row.id, r.id);
        return;
      }
      childLots.forEach((lot) => idx.set(lot.id, r.id));
    });
    return { idx, set: new Set([...idx.keys()]) };
  }, [rowById, isLot, getLotsForParent]);

  // Map
  const mapRef = React.useRef(null);
  const markersLayerRef = React.useRef(null);
  const leafletReadyRef = React.useRef(false);
  const mapElRef = React.useRef(null);
  const mapHostRef = React.useCallback((el) => {
    mapElRef.current = el;
    if (el && leafletReadyRef.current && !mapRef.current) {
      initMap();
    }
  }, []);

  // Modale lot
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalRow, setModalRow]   = React.useState(null);

  // ===== Load =====
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setErr(null);

        const auth = gristAPI?.getAuth ? gristAPI.getAuth() : null;

        const [m, a, c, b, s] = await Promise.all([
          gristAPI.getData(T.MARCHES),
          gristAPI.getData(T.ACHETEURS).catch(() => []),
          gristAPI.getData(T.CLAUSES).catch(() => []),
          gristAPI.getData(T.BENEF).catch(() => []),
          gristAPI.getData(T.SPECS).catch(() => []),
        ]);

        // Intérêts
        let interets = [];
        interets = await gristAPI.getData(T.INTERETS);
        if (!Array.isArray(interets)) interets = [];

        if (!mounted) return;

        setMarches(Array.isArray(m) ? m : []);
        setAcheteurs(Array.isArray(a) ? a : []);
        setClauses(Array.isArray(c) ? c : []);
        setBenefRows(Array.isArray(b) ? b : []);
        setSpecRows(Array.isArray(s) ? s : []);
        setOptsSpecs(toOptions(Array.isArray(s) ? s : []));
        setInterestRows(interets);

        // Bénéficiaire courant
        let id = auth?.beneficiaireId || null;
        if (!id && auth?.email) {
          const low = String(auth.email).toLowerCase();
          const byMail = (b || []).find(r => String(r.Courriel || '').toLowerCase() === low);
          if (byMail) id = byMail.id;
        }
        if (!id && b && b.length === 1) id = b[0].id;
        setCurrentBenefId(id || null);

        // Prépare Leaflet
        loadLeaflet().then(() => {
          leafletReadyRef.current = true;
          if (mapElRef.current && !mapRef.current) initMap();
        }).catch(() => {});
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || 'Erreur de chargement');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // initMap : création unique quand container dispo
  function initMap() {
    if (!window.L || !mapElRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    map.setView([46.603354, 1.888334], 6); // Vue France entière
    requestAnimationFrame(() => { try { map.invalidateSize(true); } catch(_) {} });
  }

  // Clauses du bénéficiaire authentifié
  const benefClauseIds = React.useMemo(() => {
    const b = (benefRows || []).find(r => r.id === currentBenefId);
    const raw = b ? asArray(b[BENEF_CLAUSES_COL]) : [];
    return raw.filter((x) => isNum(x) && validClauseIdSet.has(x));
  }, [benefRows, currentBenefId, validClauseIdSet]);

  // Construire intérêts
  React.useEffect(() => {
    if (!currentBenefId) {
      setInterestedSet(new Set());
      setInterestIdx(new Map());
      return;
    }
    if (interestMode === 'table') {
      const mine = (interestRows || []).filter(r => r[INTERET.BENEF] === currentBenefId);
      const { idx, set } = buildInterestMaps(mine);
      setInterestIdx(idx);
      setInterestedSet(set);
    } else {
      const set = new Set((marches || [])
        .filter(m => asArray(m[C.SUIVI]).includes('Intéressé'))
        .map(m => m.id));
      setInterestedSet(expandToLotIds([...set]));
      setInterestIdx(new Map());
    }
  }, [interestRows, interestMode, currentBenefId, marches, expandToLotIds, buildInterestMaps]);

  // Combobox géré par composant partagé

  // Filtrage
  const filtered = React.useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const clauseSet = new Set(benefClauseIds);

    function actif(row) {
      const dReal = parseDate(valueFor(row, C.DLRO));
      if (!dReal) return true;
      return dReal >= today;
    }

    function clauseOk(row) {
      const id = row[C.CLAUSE];
      return clauseSet.size && id != null && clauseSet.has(id);
    }
    function statusOk(row) {
      const status = String(row[C.STATUS] || '');
      return !status || status === 'En attente de notification';
    }

    function matchSearch(row) {
      if (!search) return true;
      const aa = labelFrom(optsAcheteurs, valueFor(row, C.AA));
      const parent = parentTitle(row);
      const lot = lotTitle(row);
      const propre = row[C.INTITULE_PROPRE] || '';
      const adr = valueFor(row, C.ADR_EXEC) || '';
      const base = [parent, lot, propre, adr, aa].join(' ');
      return includesI(base, search) || includesI(aa, search) || includesI(propre, search) || includesI(adr, search);
    }
    function specOk(row) {
      if (!selectedSpecIds.length) return true;
      const specs = asArray(row[C.SPECS]).filter(isNum);
      return specs.some(id => selectedSpecIds.includes(id));
    }
    function favOk(row) {
      return !showOnlyFav || interestedSet.has(row.id);
    }

    return lots
      .filter(actif)
      .filter(statusOk)
      .filter(clauseOk)
      .filter(matchSearch)
      .filter(specOk)
      .filter(favOk);
  }, [lots, benefClauseIds, search, optsAcheteurs, showOnlyFav, interestedSet, selectedSpecIds, parentTitle, lotTitle, valueFor]);

  // Tri
  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const byDate = (col, asc = true) => (a, b) => {
      const da = parseDate(valueFor(a, col)); const db = parseDate(valueFor(b, col));
      const ta = da ? da.getTime() : 0; const tb = db ? db.getTime() : 0;
      return asc ? (ta - tb) : (tb - ta);
    };
    switch (tri) {
      case 'dlCandAsc':  return arr.sort(byDate(C.DLRO, true));
      case 'dlCandDesc': return arr.sort(byDate(C.DLRO, false));
      case 'realAsc':    return arr.sort(byDate(C.EXEC_END, true));
      case 'realDesc':   return arr.sort(byDate(C.EXEC_END, false));
      case 'aaAsc':      return arr.sort((a,b) =>
        labelFrom(optsAcheteurs, valueFor(a, C.AA)).localeCompare(labelFrom(optsAcheteurs, valueFor(b, C.AA)), 'fr', { sensitivity:'base' })
      );
      case 'titleAsc':   return arr.sort((a,b) => {
        const ta = `${parentTitle(a)} ${lotTitle(a)}`;
        const tb = `${parentTitle(b)} ${lotTitle(b)}`;
        return ta.localeCompare(tb, 'fr', { sensitivity:'base' });
      });
      default: return arr;
    }
  }, [filtered, tri, optsAcheteurs, parentTitle, lotTitle, valueFor]);

  // Sync Carte
  React.useEffect(() => {
    const ready = leafletReadyRef.current && mapRef.current && markersLayerRef.current && window.L && mapElRef.current;
    if (!ready) return;

    const L = window.L;
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const bounds = [];
    let markersCount = 0;
    let skippedCount = 0;

    sorted.forEach((row) => {
      const lat = row[C.LAT];
      const lng = row[C.LNG];

      // Validation stricte des coordonnées (exclut aussi 0,0)
      if (!validLatLng(lat, lng)) {
        skippedCount++;
        return;
      }

      // Marker standard sans différenciation
      const marker = L.marker([lat, lng]).addTo(layer);

      // Ouvrir modale au clic (pas de popup)
      marker.on('click', () => openModal(row));

      bounds.push([lat, lng]);
      markersCount++;
    });

    // Ajuster la vue de la carte
    if (bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 10);
    } else {
      // Vue par défaut : France entière
      map.setView([46.603354, 1.888334], 6);
    }

    // Afficher un avertissement si des marchés/lots n'ont pas de coordonnées
    if (skippedCount > 0) {
      console.warn(`${skippedCount} marché(s) ou lot(s) ignoré(s) : coordonnées GPS manquantes ou invalides`);
    }

    requestAnimationFrame(() => { try { map.invalidateSize(true); } catch(_) {} });
  }, [sorted, optsAcheteurs, interestedSet]);

  // Recalcule la carte quand on revient sur l’onglet carte
  React.useEffect(() => {
    if (tab === 'carte' && mapRef.current) {
      requestAnimationFrame(() => { try { mapRef.current.invalidateSize(true); } catch(_) {} });
    }
  }, [tab]);

  // Modale lot
  function openModal(row) { setModalRow(row); setModalOpen(true); }
  function closeModal()   { setModalOpen(false); setModalRow(null); }

  async function toggleInterestModal(row) {
    if (!currentBenefId) { setErr("Vous devez être connecté."); return; }
    const marcheId = row.id;
    try {
        const idx = new Map(interestIdx);
        const set = new Set(interestedSet);
        if (set.has(marcheId)) {
          const recId = idx.get(marcheId);
          if (recId != null) await gristAPI.deleteRecord(T.INTERETS, recId);
          let interets = await gristAPI.getData(T.INTERETS);
          if (!Array.isArray(interets)) interets = [];
          const mine = (interets || []).filter(r => r[INTERET.BENEF] === currentBenefId);
          const next = buildInterestMaps(mine);
          setInterestIdx(next.idx);
          setInterestedSet(next.set);
        } else {
          await gristAPI.addRecord(T.INTERETS, {
            [INTERET.MARCHE]: marcheId,
            [INTERET.BENEF]: currentBenefId,
          });
          let interets = await gristAPI.getData(T.INTERETS);
          if (!Array.isArray(interets)) interets = [];

          const mine = (interets || []).filter(r => r[INTERET.BENEF] === currentBenefId);
          const { idx, set } = buildInterestMaps(mine);
          setInterestIdx(idx);
          setInterestedSet(set);
        }
      
    } catch (e) {
      setErr(e?.message || "Impossible de changer l'état de favori.");
    }
  }

  async function toggleInterest(row, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    await toggleInterestModal(row);
  }

  // ===== UI =====
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement des marchés…</p>
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
  if (!currentBenefId || !benefClauseIds.length) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--warning">
          <p>Accès restreint ou aucune clause sociale enregistrée. Vérifiez vos clauses dans <strong>Mon profil</strong>.</p>
        </div>
      </section>
    );
  }

  const count = sorted.length;
  return (
    <main className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Marchés actifs</h1>
      </header>

      {/* Filtres */}
      <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters fr-mb-3w">
        <div className="fr-col-12 fr-col-md-5">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="search">Rechercher</label>
            <input id="search" className="fr-input" type="search" placeholder="Intitulé, acheteur, adresse…"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="fr-col-6 fr-col-md-3">
          <div className="fr-select-group">
            <label className="fr-label" htmlFor="tri">Trier par</label>
            <select id="tri" className="fr-select" value={tri} onChange={(e) => setTri(e.target.value)}>
              <option value="dlCandAsc">Date limite de candidature ↑</option>
              <option value="dlCandDesc">Date limite de candidature ↓</option>
              <option value="aaAsc">Autorité adjudicatrice (A→Z)</option>
              <option value="titleAsc">Titre (A→Z)</option>
            </select>
          </div>
        </div>
        <div className="fr-col-6 fr-col-md-4">
        {ComboBox ? (
            <ComboBox
              id="spec-combobox"
              label="Spécialités"
              options={optsSpecs}
              multiple
              value={selectedSpecIds}
              onChange={(vals) => setSelectedSpecIds(vals)}
              placeholder="Choisir des spécialités"
              searchPlaceholder="Rechercher une spécialité"
              summaryMode="list"
            />
          ) : (
            <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
          )}
        </div>
        <div className="fr-col-12 fr-mt-2w">
          <div className="fr-checkbox-group fr-mt-4w fr-mt-md-0">
            <input type="checkbox" id="onlyFav" checked={showOnlyFav} onChange={(e) => setShowOnlyFav(e.target.checked)} />
            <label className="fr-label" htmlFor="onlyFav">Afficher uniquement les favoris</label>
          </div>
        </div>
      </div>

      <div className="fr-alert fr-alert--info fr-mb-3w">
        <p><strong>{count}</strong> marché(s) ou lot(s) actif(s) correspondant à vos critères.</p>
      </div>

      {/* Liste + Carte via onglets */}
      <div className="fr-tabs">
        <ul className="fr-tabs__list" role="tablist">
          <li role="presentation">
            <button
              className={`fr-tabs__tab ${tab === 'liste' ? 'fr-tabs__tab--selected' : ''}`}
              id="tab-btn-liste"
              role="tab"
              aria-selected={tab === 'liste'}
              aria-controls="tab-panel-liste"
              onClick={() => setTab('liste')}
            >
              Liste
            </button>
          </li>
          <li role="presentation">
            <button
              className={`fr-tabs__tab ${tab === 'carte' ? 'fr-tabs__tab--selected' : ''}`}
              id="tab-btn-carte"
              role="tab"
              aria-selected={tab === 'carte'}
              aria-controls="tab-panel-carte"
              onClick={() => setTab('carte')}
            >
              Carte
            </button>
          </li>
        </ul>

        <div
          id="tab-panel-liste"
          role="tabpanel"
          aria-labelledby="tab-btn-liste"
          className={`fr-tabs__panel ${tab === 'liste' ? 'fr-tabs__panel--selected' : ''}`}
          hidden={tab !== 'liste'}
          style={{display: tab === 'liste' ? 'block' : 'none'}}
        >
          {count === 0 ? (
            <div className="fr-callout">
              <p className="fr-callout__text">Aucun marché ou lot actif ne correspond à vos critères.</p>
            </div>
          ) : (
            <div className="fr-grid-row fr-grid-row--gutters">
              {sorted.map((row) => {
                const id = row.id;
                const aaLabel = labelFrom(optsAcheteurs, valueFor(row, C.AA));
                const title = lotTitle(row);
                const parent = parentTitle(row);
                const dCand = parseDate(valueFor(row, C.DLRO));
                const leftCand = daysLeft(dCand);
                const isFav = interestedSet.has(id);

                const specLabels = asArray(row[C.SPECS])
                  .filter(isNum)
                  .map(specId => labelFrom(optsSpecs, specId))
                  .filter(Boolean);

                return (
                  <div key={id} className="fr-col-12" onClick={(e)=>e.stopPropagation()}>
                    <article className="fr-card" onClick={(e)=>e.stopPropagation()}>
                      <div className="fr-card__body">
                        <div className="fr-grid-row">
                          <div className="fr-col">
                            <h2 className="fr-card__title fr-text--md fr-mt-2w">
                              <a href="#" onClick={(e) => { e.preventDefault(); openModal(row); }}>
                                {title}
                              </a>
                            </h2>
                            <p className="fr-text--sm fr-mb-1w"><strong>Marché :</strong> {parent}</p>
                            <p className="fr-text">{aaLabel}</p>
                          </div>
                          <div className="fr-col-auto fr-pt-2w">
                            <button
                              type="button"
                              className="fr-btn fr-btn--tertiary-no-outline"
                              style={{padding:'0.25rem', minWidth:'auto', pointerEvents:'auto'}}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInterest(row, e); }}
                              onMouseDown={(e)=> { e.preventDefault(); e.stopPropagation(); }}
                              onPointerDown={(e)=> { e.preventDefault(); e.stopPropagation(); }}
                              aria-pressed={isFav}
                              aria-label={isFav ? 'Retirer des favoris' : 'Marquer comme favori'}
                            >
                              <span className={`fr-icon-${isFav ? 'star-fill' : 'star-line'}`}></span>
                            </button>
                          </div>
                        </div>

                        <ul className="fr-tags-group fr-mt-1w fr-mb-2w">
                          {dCand ? (
                            <li className={`fr-tag fr-tag--sm ${leftCand != null && leftCand <= 7 ? 'fr-tag--warning' : ''}`}>
                              Date limite de remise des offres : {formatDate(dCand)}{leftCand != null ? ` (${leftCand} j)` : ''}
                            </li>
                          ) : (
                            <li className={`fr-tag fr-tag--sm ${leftCand != null && leftCand <= 7 ? 'fr-tag--warning' : ''}`}>
                              Date limite de remise des offres : -
                            </li>
                          )}
                          {specLabels.length > 0 && (
                            <li className="fr-tag fr-tag--sm">
                              Spécialités : {specLabels.join(', ')}
                            </li>
                          )}
                        </ul>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          id="tab-panel-carte"
          role="tabpanel"
          aria-labelledby="tab-btn-carte"
          className={`fr-tabs__panel ${tab === 'carte' ? 'fr-tabs__panel--selected' : ''}`}
          hidden={tab !== 'carte'}
          style={{display: tab === 'carte' ? 'block' : 'none'}}
        >
          <div style={{height: '520px', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-default-grey)'}}>
            <div ref={mapHostRef} style={{height: '100%', width: '100%'}} />
          </div>
          <p className="fr-hint-text fr-mt-1w">Cliquez sur un marqueur pour voir les détails du marché ou du lot.</p>
        </div>
      </div>

      {/* Modale marché/lot */}
      {modalOpen && modalRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="marche-modal-title"
             className="fr-overlay" style={{
               position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
               display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1.5rem',
               overflowY:'auto'
             }}
             onClick={closeModal}
        >
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'880px', paddingTop:'1rem', paddingBottom:'2rem'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey, #fff)', maxHeight:'85vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="marche-modal-title" className="fr-h4 fr-mb-0">
                    {lotTitle(modalRow)}
                  </h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeModal} aria-label="Fermer">
                    Fermer
                  </button>
                </div>
              </div>

              <dl className="fr-description-list fr-mb-2w">
                <dt className="fr-text--bold">{isLot(modalRow) ? 'Marché parent' : 'Marché'}</dt><dd>{parentTitle(modalRow)}</dd>
                <dt className="fr-text--bold">Pouvoir adjudicateur</dt><dd>{labelFrom(optsAcheteurs, valueFor(modalRow, C.AA))}</dd>
                <dt className="fr-text--bold">Adresse d'exécution</dt><dd>{valueFor(modalRow, C.ADR_EXEC) || '—'}</dd>
                <dt className="fr-text--bold">Clause sociale</dt><dd>{labelFrom(optsClauses, modalRow[C.CLAUSE])}</dd>
                <dt className="fr-text--bold">Publication</dt><dd>{formatDate(parseDate(valueFor(modalRow, C.PUB)))}</dd>
                <dt className="fr-text--bold">Date limite de remise des offres</dt><dd>{formatDate(parseDate(valueFor(modalRow, C.DLRO)))}</dd>
                <dt className="fr-text--bold">Fin d’exécution prévisionnelle</dt><dd>{formatDate(parseDate(valueFor(modalRow, C.EXEC_END)))}</dd>
                {valueFor(modalRow, C.DOCS) ? (
                  <>
                    <dt className="fr-text--bold">Lien vers les documents de consultation</dt>
                    <dd><a href={valueFor(modalRow, C.DOCS)} target="_blank" rel="noopener noreferrer">{valueFor(modalRow, C.DOCS)}</a></dd>
                  </>
                ) : null}
                <dt className="fr-text--bold">Spécialités</dt>
                <dd>{asArray(modalRow[C.SPECS]).filter(isNum).map(id => labelFrom(optsSpecs, id)).filter(Boolean).join(', ') || '—'}</dd>
              </dl>

              <div className="fr-btns-group fr-btns-group--right">
                <button className="fr-btn" onClick={() => toggleInterestModal(modalRow)}>
                  {interestedSet.has(modalRow.id) ? 'Retirer des favoris' : 'Marquer comme favori'}
                </button>
                <button className="fr-btn fr-btn--secondary" onClick={closeModal}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Component;
