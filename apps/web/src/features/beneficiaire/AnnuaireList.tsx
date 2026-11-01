// @ts-nocheck : code repris du widget Grist (grist/page/beneficiaire-annuaire), typé progressivement.
'use client';
// Îlot interactif de l'« Annuaire » : le serveur lit les fiches visibles, les clauses et les référentiels
// et les passe en `initial` ; le premier rendu (côté serveur) contient déjà la liste.
import React from 'react';
import ComboBox from '@/components/ComboBox';
import { attachmentUrl } from '@/lib/urls';

const Component = ({ initial, session }) => {
  // ===== Tables & colonnes =====
  const TABLE = {
    BENEF: 'Beneficiaires',
    CLAUSES: 'Clauses_sociales',
    DEPTS: 'T0_Referentiel_Departements',
    SPECS: 'T0_Referentiel_Specialites',
  };

  const CLAUSE_COL = 'Clauses_sociales_de_rattachement';

  const COL = {
    NOM: 'NOM',
    PRENOM: 'Prenom',
    COURRIEL: 'Courriel',
    TEL: 'Telephone',
    SPECIALITE_ECOLE: 'Specialite_ecole',
    AUTRES_INFOS: 'Autres_informations',
    DEPARTEMENTS: 'Departement_de_residence',
    REGIONS_MOB: 'Regions_ou_vous_etes_mobile',
    CV: 'curriculum_vitae',
    FORMATION: 'Formation',
    ANNEE_DIP: 'Annee_de_diplome',
    SPECS: 'Specialite',
    SOUS_SPEC: 'Sous_specialite',
    MEMOIRE: 'Intitule_du_memoire',
    ELIGIBLE: 'Eligible',
    DOIT_SUPPRIMER: 'Doit_supprimer',
  };

  // ===== Utils =====
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const toBool  = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
  const isFalseLike = (v) => v === false || v === 0 || v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
  const includesIci = (h, n) => String(h || '').toLowerCase().includes(String(n || '').toLowerCase());
  const norm = (s) => String(s || '').toLowerCase();
  const fullName = (r) => {
    const n = (r[COL.NOM] || '').trim();
    const p = (r[COL.PRENOM] || '').trim();
    return (p && n) ? `${p} ${n}` : (p || n || 'Sans nom');
  };
  const pickLabelField = (rows) => {
    if (!rows || !rows.length) return 'id';
    const s = rows[0] || {};
    const pref = ['label','name','Nom','nom','title','Title','Libellé','Libelle','libelle','Intitule','Intitulé'];
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
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const [benefRows, setBenefRows] = React.useState(initial.beneficiaires);
  const [currentBenefId, setCurrentBenefId] = React.useState(
    session.beneficiaireId || (initial.beneficiaires.length === 1 ? initial.beneficiaires[0].id : null),
  );

  const [clauseOptions, setClauseOptions] = React.useState(() => {
    const labelKey = pickLabelField(initial.clauses);
    return initial.clauses.map(r => ({ value: r.id, label: String(r[labelKey] ?? r.id) }));
  });
  const [validClauseIdSet, setValidClauseIdSet] = React.useState(() => new Set(initial.clauses.map(r => r.id)));

  const [deptsRows, setDeptsRows] = React.useState(initial.departements);
  const deptsByIdRef = React.useRef(mapById(initial.departements));

  const [search, setSearch] = React.useState('');

  const [tab, setTab] = React.useState('liste'); // 'liste' | 'residences'

  // Sélection unique de clause
  const [selectedClauseId, setSelectedClauseId] = React.useState(null);
  const [specOptions, setSpecOptions] = React.useState(() => {
    const specLabelKey = pickLabelField(initial.specialites);
    return initial.specialites.map(r => ({ value: r.id, label: String(r[specLabelKey] ?? r.id), tooltip: r.Tooltip || '' }));
  });
  const [selectedSpecIds, setSelectedSpecIds] = React.useState([]);
  // Combobox géré par composant partagé

  // Leaflet refs
  const depMapRef = React.useRef(null);
  const depLayerRef = React.useRef(null);
  const depElRef = React.useRef(null);

  // Modale fiche
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalRow, setModalRow]   = React.useState(null);
  const [cvPreviewOpen, setCvPreviewOpen] = React.useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = React.useState(null);
  const [cvPreviewFrameUrl, setCvPreviewFrameUrl] = React.useState(null);
  const [cvPreviewLoading, setCvPreviewLoading] = React.useState(false);
  const [cvPreviewError, setCvPreviewError] = React.useState(null);
  const cvPreviewObjectUrlRef = React.useRef(null);

  // ===== Carte : Leaflet se charge dans le navigateur, après l'affichage de la liste =====
  React.useEffect(() => {
    document.title = 'Annuaire - Eclauses';
    loadLeaflet().catch(() => {});
  }, []);

  // Labels clauses
  const clauseLabel = React.useCallback((id) => {
    const o = clauseOptions.find(o => o.value === id);
    return o ? o.label : null;
  }, [clauseOptions]);

  const currentBenef = React.useMemo(
    () => (benefRows || []).find(r => r.id === currentBenefId) || null,
    [benefRows, currentBenefId]
  );

  // Clauses du bénéficiaire courant
  const currentClauseIds = React.useMemo(
    () => sanitizeIds(currentBenef && currentBenef[CLAUSE_COL], validClauseIdSet),
    [currentBenef, validClauseIdSet]
  );

  // Init/màj du choix unique (par défaut = 1er)
  React.useEffect(() => {
    if (!currentClauseIds || currentClauseIds.length === 0) {
      setSelectedClauseId(null);
      return;
    }
    if (selectedClauseId && currentClauseIds.includes(selectedClauseId)) return;
    setSelectedClauseId(currentClauseIds[0]);
  }, [JSON.stringify(currentClauseIds)]);

  // Filtrage : on ne garde que ceux qui ont LA clause sélectionnée
  const filtered = React.useMemo(() => {
    const clauseFilterId = selectedClauseId || null;
    const res = (benefRows || []).filter(r => {
	      if (!r) return false;
	      if (!toBool(r[COL.ELIGIBLE])) return false;
	      if (toBool(r[COL.DOIT_SUPPRIMER])) return false;
	      const rClauses = sanitizeIds(r[CLAUSE_COL], validClauseIdSet);
      if (clauseFilterId == null || !rClauses.includes(clauseFilterId)) return false;

      if (selectedSpecIds.length) {
        const specs = sanitizeIds(r[COL.SPECS], new Set(specOptions.map(o => o.value)));
        const match = specs.some(id => selectedSpecIds.includes(id));
        if (!match) return false;
      }

      if (search) {
        const hay = [
          fullName(r),
          r[COL.COURRIEL] || '',
          r[COL.TEL] || '',
          r[COL.SPECIALITE_ECOLE] || '',
          r[COL.AUTRES_INFOS] || '',
          clauseLabel(clauseFilterId) || ''
        ].join(' • ');
        return includesIci(hay, search);
      }
      return true;
    });
    res.sort((a, b) => a[COL.NOM].localeCompare(b[COL.NOM], 'fr', {sensitivity:'base'}));
    return res;
  }, [benefRows, currentBenefId, selectedClauseId, search, clauseLabel, validClauseIdSet, selectedSpecIds, specOptions]);

  const count = filtered.length;

  // ====== Carte des résidences (agrégats) ======
  const deptCounts = React.useMemo(() => {
    const counts = new Map(); // deptId -> n
    filtered.forEach(b => {
      const ids = sanitizeIds(b[COL.DEPARTEMENTS], null).filter(id => id !== 1);
      console.log(ids);
      // si "Autre" (id 1 ou vide), on ignore
      if (!ids || !ids.length) return;
      ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return counts;
  }, [filtered]);

  React.useEffect(() => {
    if (tab !== 'residences') {
      // On quitte l'onglet : nettoyer la map pour forcer une ré-init au prochain retour
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

      if (!depMapRef.current) {
        const m = L.map(depElRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(m);
        depMapRef.current = m;
        depLayerRef.current = L.layerGroup().addTo(m);
        m.setView([46.6, 2.5], 6);
        setTimeout(() => m.invalidateSize(), 80);
      }

      const m = depMapRef.current;
      const layer = depLayerRef.current;
      layer.clearLayers();

      const bounds = [];
      let maxN = 0;
      deptCounts.forEach((n) => { if (n > maxN) maxN = n; });

      deptCounts.forEach((n, id) => {
        if (id == 1) return;
        const row = deptsByIdRef.current.get(id);
        if (!row) return;
        const lat = row['Latitude'], lng = row['Longitude'];

        if(lat == 0 && lng == 0) return;
        
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const radius = 22000 + (maxN ? (n / maxN) * 42000 : 0);
        const label = row['Departement_Nom'] || row['Affichage'] || ('Département #' + id);
        L.circle([lat, lng], { radius })
          .bindPopup(`<strong>${label}</strong><br/>${n} bénéficiaire(s)`)
          .addTo(layer);
        bounds.push([lat, lng]);
      });

      if (bounds.length >= 2) m.fitBounds(bounds, { padding: [20, 20] });
      else if (bounds.length === 1) m.setView(bounds[0], 9);
      else m.setView([46.6, 2.5], 6);

      // Toujours invalider à chaque passage sur l’onglet pour corriger les tailles après masquage
      setTimeout(() => { try { m.invalidateSize(true); } catch(_){} }, 80);
    })();

    return () => {
      mounted = false;
      // si on change d’onglet, on détruit la map pour éviter un attachement sur un container supprimé
      if (depMapRef.current && tab !== 'residences') {
        try { depMapRef.current.remove(); } catch(_) {}
        depMapRef.current = null;
        depLayerRef.current = null;
      }
    };
  }, [tab, deptCounts]);

  // Fermer le sélecteur de spécialités en cliquant à l’extérieur

  // ===== Modale fiche =====
  async function openModal(row) { 
    
    const cv = row[COL.CV]?.filter((x)=>x!=='L')[0];
    row.cv_url = cv === undefined ? undefined : attachmentUrl(cv);

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

  // ===== UI =====
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement de l'annuaire…</p>
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
  if (!currentBenefId) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--info">
          <p>Aucun bénéficiaire courant détecté.</p>
        </div>
      </section>
    );
  }
  const canShowContacts = (row) => !isFalseLike(row?.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements);

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-3w">
        <h1 className="fr-h3 fr-mb-1w">Annuaire des bénéficiaires</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Bénéficiaires partageant <strong>la clause sociale sélectionnée</strong> avec vous.
        </p>

        {/* Sélecteur de clause si > 1 */}
        {Array.isArray(currentClauseIds) && currentClauseIds.length > 1 && (
          <div className="fr-select-group fr-mt-2w">
            <label className="fr-label" htmlFor="my-clause">Ma clause</label>
            <select
              id="my-clause"
              className="fr-select"
              value={String(selectedClauseId ?? '')}
              onChange={(e) => setSelectedClauseId(e.target.value ? Number(e.target.value) : null)}
            >
              {currentClauseIds.map(id => (
                <option key={id} value={id}>{clauseLabel(id) || id}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Barre outils */}
      <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters fr-mb-3w">
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
              id="spec-combo"
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
        </ul>

        {/* Liste */}
        {tab === 'liste' && (
          <div className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
            <div className="fr-alert fr-alert--info fr-mb-3w">
              <p><strong>{count}</strong> bénéficiaire(s) correspondants.</p>
            </div>

            {count === 0 ? (
              <div className="fr-callout">
                <p className="fr-callout__text">Aucun profil ne correspond aux critères actuels.</p>
              </div>
            ) : (
              <div className="fr-grid-row fr-grid-row--gutters">
                {filtered.map((r) => {
                  const nomComplet = fullName(r);
                  const sous_spec = r[COL.SOUS_SPEC];

                  return (
                    <div key={r.id} className="fr-col-12 fr-col-md-6">
                      <article className="fr-card fr-enlarge-link fr-card--sm fr-card--horizontal" onClick={() => openModal(r)}>
                        <div className="fr-card__body">
                          <h2 className="fr-card__title fr-text--md">
                            <a href="#" onClick={(e) => { e.preventDefault(); openModal(r); }}>{nomComplet}</a>
                          </h2>
                        <p className="fr-card__desc"><strong>Spécialité : </strong>{asArray(r["Specialite_Libelles"]).filter((x)=>x!=='L').join(', ') || '—'}</p>
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

        {/* Carte des résidences */}
        {tab === 'residences' && (
          <div className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
            <div style={{height:'560px', borderRadius:'8px', overflow:'hidden', border:'1px solid var(--border-default-grey)'}}>
              <div ref={depElRef} style={{height:'100%', width:'100%'}} />
            </div>
            <p className="fr-hint-text fr-mt-1w">Cercles proportionnels au nombre de bénéficiaires par département.</p>
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
                        <dt><strong>E-mail</strong></dt><dd><a href={`mailto:${modalRow[COL.COURRIEL]}`}>{modalRow[COL.COURRIEL]}</a></dd>
                      </>
                    )}
                    {canShowContacts(modalRow) && modalRow[COL.TEL] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Téléphone</strong></dt><dd>{modalRow[COL.TEL]}</dd>
                      </>
                    )}
                    {modalRow['Formation_Libelle'] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Formation</strong></dt><dd>{modalRow['Formation_Libelle']}</dd>
                      </>
                    )}
                    {modalRow[COL.ANNEE_DIP] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Année de diplôme</strong></dt><dd>{modalRow[COL.ANNEE_DIP]}</dd>
                      </>
                    )}
                    {asArray(modalRow["Specialite_Libelles"]).filter((x)=>x!=='L').length > 0 && (
                      <>
                        <dt className="fr-mt-2w"><strong>Spécialité</strong></dt>
                        <dd>{asArray(modalRow["Specialite_Libelles"]).filter((x)=>x!=='L').join(', ')}</dd>
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
                      {asArray(modalRow["Departement_Libelles"]).filter((x)=>x!=='L').join(', ') || '—'}
                    </p>
                    <p className="fr-text--sm fr-mt-2w"><strong>Régions de mobilité</strong></p>
                    <p className="fr-text--sm">
                      {asArray(modalRow["Region_Libelles"]).filter((x)=>x!=='L').join(', ') || '—'}
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
