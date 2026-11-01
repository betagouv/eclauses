// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-annuaire), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const ComboBox = gristAPI.getComponent ? gristAPI.getComponent('ComboBox') : null;
  // ===== Tables / colonnes
  const TABLE = {
    UA: 'Utilisateurs_Acheteurs',
    ACH: 'Acheteurs',
    BENEF: 'Beneficiaires',
    CLAUSES: 'Clauses_sociales',
    MARCHES: 'Marches',
    DEPTS: 'T0_Referentiel_Departements',
    REGIONS: 'T0_Referentiel_Regions',
    SPECS: 'T0_Referentiel_Specialites',
  };
  const COL = {
    NOM: 'NOM',
    PRENOM: 'Prenom',
    COURRIEL: 'Courriel',
    TEL: 'Telephone',
    SPECIALITE_ECOLE: 'Specialite_ecole',
    AUTRES_INFOS: 'Autres_informations',
    SPECS: 'Specialite',
    CV: 'curriculum_vitae',
    CONSENT_ANN: 'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur',
    ELIGIBLE: 'Eligible',
    DOIT_SUPPRIMER: 'Doit_supprimer',
    CLAUSES_BENEF: 'Clauses_sociales_de_rattachement', // ref list
    CLAUSE_MARCHE: 'Clauses_sociales',                 // ref sur Marches
    ACHE_MARCHE: 'Acheteur',                           // ref Acheteurs
    LAT: 'Latitude',
    LNG: 'Longitude',
    ADR_GEO: 'Adresse_geocodee',
    SOUS_SPEC: 'Sous_specialite',
  };

  // ===== Utils
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const toBool  = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
  const isFalseLike = (v) => v === false || v === 0 || v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
  const includesIci = (h, n) => String(h || '').toLowerCase().includes(String(n || '').toLowerCase());
  const fullName = (r) => {
    const n = (r[COL.NOM] || '').trim();
    const p = (r[COL.PRENOM] || '').trim();
    return (p && n) ? `${p} ${n}` : (p || n || 'Sans nom');
  };
  const pickLabelField = (rows) => {
    if (!rows || !rows.length) return 'id';
    const s = rows[0] || {};
    const pref = ['label','name','Nom','nom','title','Title','Intitule','Intitulé','Libellé','Libelle','libelle'];
    for (const k of pref) if (k in s && typeof s[k] === 'string') return k;
    for (const k of Object.keys(s)) if (typeof s[k] === 'string') return k;
    return 'id';
  };
  const isValidId = (x) => typeof x === 'number' && isFinite(x);
  const sanitizeIds = (values, validSet) =>
    asArray(values).filter(v => isValidId(v) && (!validSet || validSet.has(v)));
  const mapById = (rows) => {
    const m = new Map();
    (rows || []).forEach(r => m.set(r.id, r));
    return m;
  };

  // ===== Leaflet loader (CSS+JS)
  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L && window.L.map) return resolve(window.L);
      const cssId = 'leaflet-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
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
      script.onerror = () => reject(new Error('Échec de chargement Leaflet'));
      document.body.appendChild(script);
    });
  }

  // ===== State
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState(null);

  const [benefRows, setBenefRows]     = React.useState([]);
  const [clausesRows, setClausesRows] = React.useState([]);
  const [marchesRows, setMarchesRows] = React.useState([]);
  const [deptsRows, setDeptsRows]     = React.useState([]);
  const [regionsRows, setRegionsRows] = React.useState([]);
  const [specOptions, setSpecOptions] = React.useState([]);
  const [selectedSpecIds, setSelectedSpecIds] = React.useState([]);
  const [acheteurEntiteId, setAcheteurEntiteId] = React.useState(null);

  const [validClauseIdSet, setValidClauseIdSet] = React.useState(new Set());
  const [search, setSearch] = React.useState('');
  const [onlyConsent, setOnlyConsent] = React.useState(true);
  const [tab, setTab] = React.useState('liste'); // 'liste' | 'residences' | 'mobilites'
  const benefByIdRef = React.useRef(new Map());

  // Leaflet refs (2 cartes)
  const depMapRef = React.useRef(null);
  const depLayerRef = React.useRef(null);
  const depElRef = React.useRef(null);

  const regMapRef = React.useRef(null);
  const regLayerRef = React.useRef(null);
  const regElRef = React.useRef(null);


  // Modale fiche
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalRow, setModalRow]   = React.useState(null);
  const [cvPreviewOpen, setCvPreviewOpen] = React.useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = React.useState(null);
  const [cvPreviewFrameUrl, setCvPreviewFrameUrl] = React.useState(null);
  const [cvPreviewLoading, setCvPreviewLoading] = React.useState(false);
  const [cvPreviewError, setCvPreviewError] = React.useState(null);
  const cvPreviewObjectUrlRef = React.useRef(null);

  // ===== Load
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null);

        const auth = gristAPI.getAuth ? gristAPI.getAuth() : null;
        const roles = Array.isArray(auth?.roles) ? auth.roles : [];
        if (!auth || !roles.includes('acheteur') || !auth.acheteurId) {
          throw new Error("Accès refusé : rôle 'acheteur' requis.");
        }

        const [uaRows, achRows, benef, cls, marches, depts, regs, specs] = await Promise.all([
          gristAPI.getData(TABLE.UA).catch(() => []),
          gristAPI.getData(TABLE.ACH).catch(() => []),
          gristAPI.getData(TABLE.BENEF),
          gristAPI.getData(TABLE.CLAUSES).catch(() => []),
          gristAPI.getData(TABLE.MARCHES),
          gristAPI.getData(TABLE.DEPTS).catch(() => []),
          gristAPI.getData(TABLE.REGIONS).catch(() => []),
          gristAPI.getData(TABLE.SPECS).catch(() => []),
        ]);

        if (!alive) return;

        const me = (uaRows || []).find(r => r.id === auth.acheteurId);
        if (!me?.Entite_de_rattachement) {
          throw new Error("Votre compte n'est rattaché à aucune entité acheteuse.");
        }
        const entite = (achRows || []).find(a => a.id === me.Entite_de_rattachement);
        if (!entite) {
          throw new Error('Entité acheteuse introuvable.');
        }

        setAcheteurEntiteId(entite.id);
        setBenefRows(Array.isArray(benef) ? benef : []);
        setClausesRows(Array.isArray(cls) ? cls : []);
        setMarchesRows(Array.isArray(marches) ? marches : []);
        setDeptsRows(Array.isArray(depts) ? depts : []);
        setRegionsRows(Array.isArray(regs) ? regs : []);
        setValidClauseIdSet(new Set((cls || []).map(r => r.id)));
        const specKey = pickLabelField(specs || []);
        setSpecOptions((specs || []).map(r => ({ value: r.id, label: String(r[specKey] ?? r.id), tooltip: r.Tooltip || '' })));

        // Précharge Leaflet pour les cartes
        loadLeaflet().catch(() => {});
      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Erreur de chargement');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ===== Clauses de l’acheteur (depuis ses marchés)
  const acheteurClauseIdSet = React.useMemo(() => {
    const set = new Set();
    if (!acheteurEntiteId) return set;
    (marchesRows || []).forEach(m => {
      if (m[COL.ACHE_MARCHE] === acheteurEntiteId && isValidId(m[COL.CLAUSE_MARCHE])) {
        set.add(m[COL.CLAUSE_MARCHE]);
      }
    });
    return set;
  }, [marchesRows, acheteurEntiteId]);

  // ===== Options labels (clauses)
  const clauseLabelMap = React.useMemo(() => {
    const key = pickLabelField(clausesRows);
    const map = new Map();
    (clausesRows || []).forEach(r => map.set(r.id, String(r[key] ?? r.id)));
    return map;
  }, [clausesRows]);
  const clauseLabel = (id) => clauseLabelMap.get(id) || null;

  // ===== Filtrage annuaire (intersection clauses acheteur)
  const filtered = React.useMemo(() => {
    if (!acheteurClauseIdSet.size) return [];
    const valid = validClauseIdSet;
    const clauseAcheteur = acheteurClauseIdSet;
    const specSet = new Set((selectedSpecIds || []).map(v => String(v)));
	    const res = (benefRows || []).filter(r => {
	      if (!toBool(r[COL.ELIGIBLE])) return false;
	      if (toBool(r[COL.DOIT_SUPPRIMER])) return false;
	      const benClauses = sanitizeIds(r[COL.CLAUSES_BENEF], valid);
      const intersect = benClauses.some(id => clauseAcheteur.has(id));
      if (!intersect) return false;
      if (onlyConsent && !toBool(r[COL.CONSENT_ANN])) return false;
      if (specSet.size) {
        const specs = sanitizeIds(r[COL.SPECS], new Set(specOptions.map(o => o.value)));
        const match = specs.some(id => specSet.has(String(id)));
        if (!match) return false;
      }

      if (search) {
        const labels = benClauses.map(clauseLabel).filter(Boolean);
        const hay = [
          fullName(r),
          r[COL.COURRIEL] || '',
          r[COL.TEL] || '',
          r[COL.SPECIALITE_ECOLE] || '',
          r[COL.AUTRES_INFOS] || '',
          ...labels,
        ].join(' • ');
        return includesIci(hay, search);
      }
      return true;
    });
    res.sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr', {sensitivity:'base'}));
    benefByIdRef.current = mapById(res);
    return res;
  }, [benefRows, onlyConsent, search, validClauseIdSet, acheteurClauseIdSet, selectedSpecIds, specOptions]);

  // ===== Résumé clauses sélectionnées (pour bandeaux)
  const acheteurClauseLabels = React.useMemo(() => {
    return Array.from(acheteurClauseIdSet).map(clauseLabel).filter(Boolean);
  }, [acheteurClauseIdSet, clauseLabelMap]);

  // ====== Cartes: calcul des agrégats
  // Départements (centroïdes depuis table de référence)
  const deptsById = React.useMemo(() => mapById(deptsRows), [deptsRows]);
  const deptCounts = React.useMemo(() => {
    const counts = new Map(); // deptId -> n
    filtered.forEach(b => {
      const ids = sanitizeIds(b['Departement_de_residence'], null);
      ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return counts;
  }, [filtered]);
  const deptBenefMap = React.useMemo(() => {
    const map = new Map();
    filtered.forEach(b => {
      const ids = sanitizeIds(b['Departement_de_residence'], null);
      ids.forEach(id => {
        if (id == 1) return; // ignorer "Autre"
        const list = map.get(id) || [];
        list.push(b);
        map.set(id, list);
      });
    });
    return map;
  }, [filtered]);

  // Régions (centroïdes depuis table de référence)
  const regionsById = React.useMemo(() => mapById(regionsRows), [regionsRows]);
  const regionCounts = React.useMemo(() => {
    const counts = new Map(); // regionId -> n
    filtered.forEach(b => {
      const ids = sanitizeIds(b['Regions_ou_vous_etes_mobile'], null);
      ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return counts;
  }, [filtered]);
  const regionBenefMap = React.useMemo(() => {
    const map = new Map();
    filtered.forEach(b => {
      const ids = sanitizeIds(b['Regions_ou_vous_etes_mobile'], null);
      ids.forEach(id => {
        const list = map.get(id) || [];
        list.push(b);
        map.set(id, list);
      });
    });
    return map;
  }, [filtered]);

  // ===== Rendu des cartes (création & màj)
  React.useEffect(() => {
    if (tab !== 'residences') {
      if (depMapRef.current) {
        try { depMapRef.current.remove(); } catch (_) {}
      }
      depMapRef.current = null;
      depLayerRef.current = null;
      return;
    }
    let mounted = true;

    (async () => {
      const L = await loadLeaflet().catch(() => null);
      if (!L || !depElRef.current) return;
      if (!mounted) return;

      // init carte si besoin
      if (!depMapRef.current) {
        const m = L.map(depElRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(m);
        depMapRef.current = m;
        depLayerRef.current = L.layerGroup().addTo(m);
        m.setView([46.6, 2.5], 5);
        setTimeout(() => m.invalidateSize(), 80);
      }

      // update markers
      const m = depMapRef.current;
      const layer = depLayerRef.current;
      layer.clearLayers();

      const bounds = [];
      let maxN = 0;
      deptCounts.forEach((n, id) => { if (n > maxN) maxN = n; });

      deptCounts.forEach((n, id) => {
        if (id == 1) return; // ignorer "Autre"
        const row = deptsById.get(id);
        if (!row) return;
        const lat = row[COL.LAT], lng = row[COL.LNG];
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const radius = 20000 + (maxN ? (n / maxN) * 30000 : 0); // 20–50 km
        const benefList = deptBenefMap.get(id) || [];
        const htmlList = benefList.map(b => `<li><a href="#" className="popup-benef" data-id="${b.id}">${fullName(b)}</a></li>`).join('');
        const popupHtml = `
          <div style="min-width:220px">
            <strong>${row['Departement_Nom'] || row['Affichage'] || ('Département #' + id)}</strong><br/>
            ${n} bénéficiaire(s)
            ${benefList.length ? `<ul style="list-style:none;margin:0;padding:0;">${htmlList}</ul>` : ''}
          </div>
        `;
        const circle = L.circle([lat, lng], { radius })
          .bindPopup(popupHtml);
        circle.addTo(layer);
        bounds.push([lat, lng]);
      });

      if (bounds.length >= 2) m.fitBounds(bounds, { padding: [20, 20] });
      else if (bounds.length === 1) m.setView(bounds[0], 7);
      else m.setView([46.6, 2.5], 5);

      setTimeout(() => { try { m.invalidateSize(true); } catch(_){} }, 80);
      m.off('popupopen').on('popupopen', (e) => {
        const node = e.popup && e.popup._contentNode;
        if (!node) return;
        node.querySelectorAll('.popup-benef').forEach(a => {
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            const id = Number(a.getAttribute('data-id'));
            const row = benefByIdRef.current.get(id) || filtered.find(b => b.id === id);
            if (row) openModal(row);
          });
        });
      });
    })();

    return () => { mounted = false; };
  }, [tab, deptCounts, deptsById]);

  React.useEffect(() => {
    if (tab !== 'mobilites') {
      if (regMapRef.current) {
        try { regMapRef.current.remove(); } catch (_) {}
      }
      regMapRef.current = null;
      regLayerRef.current = null;
      return;
    }
    let mounted = true;

    (async () => {
      const L = await loadLeaflet().catch(() => null);
      if (!L || !regElRef.current) return;
      if (!mounted) return;

      if (!regMapRef.current) {
        const m = L.map(regElRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(m);
        regMapRef.current = m;
        regLayerRef.current = L.layerGroup().addTo(m);
        m.setView([46.6, 2.5], 5);
        setTimeout(() => m.invalidateSize(), 80);
      }

      const m = regMapRef.current;
      const layer = regLayerRef.current;
      layer.clearLayers();

      const bounds = [];
      let maxN = 0;
      regionCounts.forEach((n, id) => { if (n > maxN) maxN = n; });

      regionCounts.forEach((n, id) => {
        const row = regionsById.get(id);
        if (!row) return;
        const lat = row[COL.LAT], lng = row[COL.LNG];
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const radius = 30000 + (maxN ? (n / maxN) * 40000 : 0); // 30–70 km
        const benefList = regionBenefMap.get(id) || [];
        const htmlList = benefList.map(b => `<li><a href="#" className="popup-benef" data-id="${b.id}">${fullName(b)}</a></li>`).join('');
        const popupHtml = `
          <div style="min-width:220px">
            <strong>${row['Intitule'] || ('Région #' + id)}</strong><br/>
            ${n} bénéficiaire(s) mobiles
            ${benefList.length ? `<ul style="list-style:none;margin:0;padding:0;">${htmlList}</ul>` : ''}
          </div>
        `;
        const circle = L.circle([lat, lng], { radius })
          .bindPopup(popupHtml);
        circle.addTo(layer);
        bounds.push([lat, lng]);
      });

      if (bounds.length >= 2) m.fitBounds(bounds, { padding: [20, 20] });
      else if (bounds.length === 1) m.setView(bounds[0], 7);
      else m.setView([46.6, 2.5], 5);

      setTimeout(() => { try { m.invalidateSize(true); } catch(_){} }, 80);
      m.off('popupopen').on('popupopen', (e) => {
        const node = e.popup && e.popup._contentNode;
        if (!node) return;
        node.querySelectorAll('.popup-benef').forEach(a => {
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            const id = Number(a.getAttribute('data-id'));
            const row = benefByIdRef.current.get(id) || filtered.find(b => b.id === id);
            if (row) openModal(row);
          });
        });
      });
    })();

    return () => { mounted = false; };
  }, [tab, regionCounts, regionsById]);

  // Nettoyage global (changement de page / démontage du composant)
  React.useEffect(() => {
    return () => {
      if (depMapRef.current) {
        try { depMapRef.current.remove(); } catch (_) {}
      }
      if (regMapRef.current) {
        try { regMapRef.current.remove(); } catch (_) {}
      }
      depMapRef.current = null;
      depLayerRef.current = null;
      regMapRef.current = null;
      regLayerRef.current = null;
    };
  }, []);


  // ===== Modale fiche =====
  async function openModal(row) {
    const cv = row[COL.CV]?.filter((x)=>x!=='L')[0];
    row.cv_url = cv === undefined ? undefined : gristAPI.attachmentUrl(cv);

    setModalRow(row); setModalOpen(true);
  }
  function closeCvPreview() {
    setCvPreviewOpen(false);
    setCvPreviewUrl(null);
    setCvPreviewFrameUrl(null);
    setCvPreviewLoading(false);
    setCvPreviewError(null);
    if (cvPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(cvPreviewObjectUrlRef.current);
      cvPreviewObjectUrlRef.current = null;
    }
  }
  async function openCvPreview(url) {
    if (!url) return;
    setCvPreviewUrl(url);
    setCvPreviewOpen(true);
    setCvPreviewFrameUrl(null);
    setCvPreviewError(null);
    setCvPreviewLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erreur de chargement du CV (${res.status}).`);
      const blob = await res.blob();
      const contentType = String(blob.type || res.headers.get('Content-Type') || '').toLowerCase();
      if (contentType.includes('word') || contentType.includes('officedocument')) {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'cv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        setCvPreviewError('Prévisualisation impossible. Le fichier a été téléchargé sur votre ordinateur.');
        return;
      }
      if (cvPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(cvPreviewObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      cvPreviewObjectUrlRef.current = objectUrl;
      setCvPreviewFrameUrl(objectUrl);
    } catch (e) {
      setCvPreviewError(e?.message || "Impossible d'afficher le CV.");
    } finally {
      setCvPreviewLoading(false);
    }
  }
  function closeModal()    {
    setModalOpen(false);
    setModalRow(null);
    closeCvPreview();
  }

  React.useEffect(() => () => {
    if (cvPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(cvPreviewObjectUrlRef.current);
      cvPreviewObjectUrlRef.current = null;
    }
  }, []);

  // ===== UI
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement de l’annuaire…</p>
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
  if (!acheteurClauseIdSet.size) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--info">
          <p>Aucune clause trouvée sur vos marchés. Créez ou associez des marchés pour voir des correspondances.</p>
        </div>
      </section>
    );
  }

  const count = filtered.length;
  const canShowContacts = (row) => !isFalseLike(row?.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements);

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-3w">
        <h1 className="fr-h3 fr-mb-1w">Annuaire des bénéficiaires</h1>
        
      </header>

      {/* Barre outils commune */}
      <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters fr-mb-2w">
        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="search">Rechercher</label>
            <input id="search" className="fr-input" type="search" placeholder="Nom, e-mail, téléphone, spécialité…"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          {ComboBox ? (
            <ComboBox
              id="spec-filter"
              label="Spécialités"
              options={specOptions}
              multiple
              value={selectedSpecIds}
              onChange={(vals) => setSelectedSpecIds(
                (vals || []).map(v => (typeof v === 'number' ? v : Number(v))).filter(v => Number.isFinite(v))
              )}
              placeholder="Choisir des spécialités"
              searchPlaceholder="Rechercher une spécialité"
              summaryMode="list"
            />
          ) : (
            <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="fr-tabs">
        <ul className="fr-tabs__list" role="tablist" aria-label="Vues">
          <li role="presentation">
            <button className={`fr-tabs__tab ${tab==='liste' ? 'fr-tabs__tab--selected' : ''}`}
                    role="tab" aria-selected={tab==='liste'}
                    onClick={() => setTab('liste')}>
              Liste
            </button>
          </li>
          <li role="presentation">
            <button className={`fr-tabs__tab ${tab==='residences' ? 'fr-tabs__tab--selected' : ''}`}
                    role="tab" aria-selected={tab==='residences'}
                    onClick={() => setTab('residences')}>
              Carte des résidences
            </button>
          </li>
          <li role="presentation">
            <button className={`fr-tabs__tab ${tab==='mobilites' ? 'fr-tabs__tab--selected' : ''}`}
                    role="tab" aria-selected={tab==='mobilites'}
                    onClick={() => setTab('mobilites')}>
              Carte des mobilités
            </button>
          </li>
        </ul>

        {/* Pane: Liste */}
        {tab === 'liste' && (
          <div className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
            
            {count === 0 ? (
              <div className="fr-callout">
                <p className="fr-callout__text">
                  Aucun profil ne correspond actuellement à vos critères.
                </p>
              </div>
            ) : (
              <div className="fr-grid-row fr-grid-row--gutters">
                {filtered.map((r) => {
                  const nomComplet = fullName(r);
                  const specList = asArray(r["gristHelper_Display3"]).filter((x)=>x!=='L').join(', ');
                  const sous_spec = r[COL.SOUS_SPEC];

                  return (
                    <div key={r.id} className="fr-col-12 fr-col-md-6">
                      <article className="fr-card fr-enlarge-link fr-card--sm fr-card--horizontal" onClick={() => openModal(r)}>
                        <div className="fr-card__body">
                          <h2 className="fr-card__title fr-text--md">
                            <a href="#" onClick={(e) => { e.preventDefault(); openModal(r); }}>{nomComplet}</a>
                          </h2>
                          <p className="fr-card__desc"><strong>Spécialité : </strong>{specList || '—'}</p>
                          {sous_spec && (<p className="fr-card__desc"><strong>Sous-spécialité : </strong>{sous_spec}</p>)}
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pane: Carte des résidences */}
        {tab === 'residences' && (
          <div className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
            <div style={{height:'560px', borderRadius:'8px', overflow:'hidden', border:'1px solid var(--border-default-grey)'}}>
              <div ref={depElRef} style={{height:'100%', width:'100%'}} />
            </div>
            <p className="fr-hint-text fr-mt-1w">Cercles proportionnels au nombre de bénéficiaires par département (centroïdes).</p>
          </div>
        )}

        {/* Pane: Carte des mobilités */}
        {tab === 'mobilites' && (
          <div className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
            <div style={{height:'560px', borderRadius:'8px', overflow:'hidden', border:'1px solid var(--border-default-grey)'}}>
              <div ref={regElRef} style={{height:'100%', width:'100%'}} />
            </div>
            <p className="fr-hint-text fr-mt-1w">Cercles proportionnels au nombre de bénéficiaires par région de mobilité (centroïdes).</p>
          </div>
        )}
      </div>


      {/* Modale fiche (scrollable sur petits écrans) */}
      {modalOpen && modalRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="benef-modal-title"
             className="fr-overlay"
             style={{
               position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
               display:'flex', alignItems:'center', justifyContent:'center',
               padding:'1rem', overflow:'auto'        // <- overlay scrollable
             }}
             onClick={closeModal}
        >
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'860px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{
                   background:'var(--background-default-grey, #fff)',
                   maxHeight:'90vh', overflowY:'auto'   // <- contenu scrollable
                 }}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="benef-modal-title" className="fr-h4 fr-mb-0">
                    {fullName(modalRow)}
                  </h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline"
                          onClick={closeModal}
                          aria-label="Fermer">Fermer</button>
                </div>
              </div>

              {!canShowContacts(modalRow) && (
                <div className="fr-alert fr-alert--warning fr-alert--sm fr-mb-4w">
                  <p>Cette personne ne souhaite pas être contactée pour rejoindre un groupement.</p>
                </div>
              )}

              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-lg-7">
                  <dl className="fr-description-list fr-mb-2w">
                    {canShowContacts(modalRow) && modalRow[COL.COURRIEL] && (
                      <>
                        <dt><strong>E-mail</strong></dt>
                        <dd><a href={`mailto:${modalRow[COL.COURRIEL]}`}>{modalRow[COL.COURRIEL]}</a></dd>
                      </>
                    )}
                    {canShowContacts(modalRow) && modalRow[COL.TEL] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Téléphone</strong></dt><dd>{modalRow[COL.TEL]}</dd>
                      </>
                    )}
                    {modalRow['gristHelper_Display2'] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Formation</strong></dt><dd>{modalRow['gristHelper_Display2']}</dd>
                      </>
                    )}
                    {modalRow[COL.ANNEE_DIP] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Année de diplôme</strong></dt><dd>{modalRow[COL.ANNEE_DIP]}</dd>
                      </>
                    )}
                    {asArray(modalRow["gristHelper_Display3"]).filter((x)=>x!=='L').join(', ') && (
                      <>
                        <dt className="fr-mt-2w"><strong>Spécialité</strong></dt>
                        <dd>{asArray(modalRow["gristHelper_Display3"]).filter((x)=>x!=='L').join(', ')}</dd>
                      </>
                    )}
                    {modalRow[COL.SOUS_SPEC] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Sous-spécialité</strong></dt><dd>{modalRow[COL.SOUS_SPEC]}</dd>
                      </>
                    )}
                    {modalRow[COL.MEMOIRE] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Mémoire</strong></dt><dd>{modalRow[COL.MEMOIRE]}</dd>
                      </>
                    )}
                    {modalRow[COL.AUTRES_INFOS] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Autres informations</strong></dt><dd>{modalRow[COL.AUTRES_INFOS]}</dd>
                      </>
                    )}
                    <dt className="fr-mt-2w"><strong>CV</strong></dt>
                    {modalRow.cv_url ? (
                      <dd>
                        <button
                          className="fr-btn fr-btn--secondary fr-btn--sm"
                          type="button"
                          onClick={() => openCvPreview(modalRow.cv_url)}
                        >
                          Voir le CV
                        </button>
                      </dd>
                    ) : (
                      <dd>Aucun fichier.</dd>
                    )}
                  </dl>
                </div>
                <div className="fr-col-12 fr-col-lg-5">
                  <div className="fr-card fr-p-2w fr-background-alt--blue-france">
                    <h3 className="fr-h6 fr-mb-1w">Localisations</h3>
                    <p className="fr-text--sm fr-mb-1w"><strong>Départements</strong></p>
                    <p className="fr-text--sm">
                      {asArray(modalRow["gristHelper_Display4"]).filter((x)=>x!=='L').join(', ') || '—'}
                    </p>
                    <p className="fr-text--sm fr-mt-2w"><strong>Régions de mobilité</strong></p>
                    <p className="fr-text--sm">
                      {asArray(modalRow["gristHelper_Display5"]).filter((x)=>x!=='L').join(', ') || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="fr-btns-group fr-btns-group--right fr-mt-2w">
                <button className="fr-btn" onClick={closeModal}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cvPreviewOpen && cvPreviewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-preview-title"
          className="fr-overlay"
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,.45)',
            zIndex:10000,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding:'1rem',
            overflow:'auto'
          }}
          onClick={closeCvPreview}
        >
          <div
            className="fr-container fr-container--fluid fr-container-lg"
            style={{ maxWidth:'1100px', width:'100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fr-card fr-p-2w" style={{ background:'var(--background-default-grey,#fff)' }}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="cv-preview-title" className="fr-h5 fr-mb-0">Aperçu du CV</h2>
                </div>
                <div className="fr-col-auto">
                  <button
                    className="fr-btn fr-btn--tertiary-no-outline"
                    type="button"
                    onClick={closeCvPreview}
                  >
                    Fermer
                  </button>
                </div>
              </div>
              <div style={{ height:'80vh', border:'1px solid var(--border-default-grey)' }}>
                {cvPreviewLoading && <p className="fr-text--sm fr-p-2w">Chargement du CV…</p>}
                {!cvPreviewLoading && cvPreviewError && <p className="fr-text--sm fr-p-2w">{cvPreviewError}</p>}
                {!cvPreviewLoading && !cvPreviewError && cvPreviewFrameUrl && (
                  <iframe
                    title="Aperçu du CV"
                    src={cvPreviewFrameUrl}
                    style={{ width:'100%', height:'100%', border:0 }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Component;
