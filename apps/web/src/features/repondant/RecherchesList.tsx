// @ts-nocheck : code repris du widget Grist (grist/page/repondant-recherches), typé progressivement.
'use client';
// Îlot interactif « Recherche d'un bénéficiaire » (répondant) : le serveur lit les marchés, bénéficiaires et référentiels
// (`initial`). Les coordonnées ne sont PAS dans la page : elles ne sont livrées, une par une, que par l'action
// « consulter les coordonnées », qui enregistre la consultation et en prévient la personne.
import React from 'react';
import ComboBox from '@/components/ComboBox';
import { attachmentUrl } from '@/lib/urls';
import { coordonnees } from '@/server/actions/repondant';

const Component = ({ initial }) => {
  // ===== Tables / colonnes =====
  const T = {
    REP: 'Repondants',
    M: 'Marches',
    C: 'Clauses_sociales',
    B: 'Beneficiaires',
    MI: 'Marches_Interets',
    LOG: 'Acces_Coordonnees',
    SPECS: 'T0_Referentiel_Specialites',
  };

  const R = {
    CAND_LIST: 'Candidat_aux_marches',  // RefList(Marches)
    TIT_LIST:  'Titulaire_aux_marches', // RefList(Marches)
    NOM: 'Nom', PRENOM: 'Prenom',
  };

  const M = {
    INTITULE: 'Intitule_du_marche',
    INTIT_PROPRE: 'Intitule_propre',
    INTITULE_LOT: 'Intitule_du_lot',
    LOT: 'Numero_de_lot',
    CLAUSE: 'Clauses_sociales',         // Ref -> Clauses_sociales
    PARENT: 'Marche_parent',
    LOTS: 'Lots',
    STATUS: 'Statut',
  };

  const B = {
    NOM: 'NOM',
    PRENOM: 'Prenom',
    EMAIL: 'Courriel',
    TEL: 'Telephone',
    AUTRES: 'Autres_informations',
    CLAUSES: 'Clauses_sociales_de_rattachement', // RefList(Clauses_sociales)
    SPECIALITE_ECOLE: 'Specialite_ecole',
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

  const LOG = {
    REP: 'Repondant',
    MARCHE: 'Marche',
    BENEF: 'Beneficiaire',
    AFF_EMAIL: 'Affiche_email',
    AFF_TEL: 'Affiche_telephone',
  };

  const I = {
    MARCHE: 'Marche',
    BENEF: 'Beneficiaire',
  };

  // ===== Utils =====
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const norm = (s) => String(s || '').toLowerCase();
  const includesI = (h, n) => norm(h).includes(norm(n));
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const toBool = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
  const isFalseLike = (v) => v === false || v === 0 || v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
  const isClosedStatus = (v) => ['Clause validée', 'Archivé'].includes(String(v || ''));

  function pickLabelField(rows) {
    if (!rows || !rows.length) return 'id';
    const s = rows[0] || {};
    const pref = ['Intitule_propre'];
    for (const k of pref) if (typeof s[k] === 'string') return k;
    for (const k of Object.keys(s)) if (typeof s[k] === 'string') return k;
    return 'id';
  }
  function toOptions(rows) {
    const key = pickLabelField(rows);
    return (rows || []).map(r => ({ value: r.id, label: String(r[key] ?? r.id), tooltip: r.Tooltip || '' }));
  }
  const labelFrom = (opts, id) => (opts.find(o => o.value === id)?.label ?? String(id ?? '—'));
  const fullName = (r) => {
    const n = (r[B.NOM] || '').trim(); const p = (r[B.PRENOM] || '').trim();
    return (p && n) ? `${p} ${n}` : (p || n || 'Sans nom');
  };

  // ===== State =====
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(initial.error);

  const [repRows, setRepRows] = React.useState(initial.me ? [initial.me] : []);
  const [marchesRows, setMarchesRows] = React.useState(initial.marches);
  const [clauseRows, setClauseRows] = React.useState(initial.clauses);
  const [benefRows, setBenefRows] = React.useState(initial.beneficiaires);
  const [interestRows, setInterestRows] = React.useState(initial.interets);

  const [currentRepId, setCurrentRepId] = React.useState(initial.me ? initial.me.id : null);
  const [me, setMe] = React.useState(initial.me);

  const [optsMarches, setOptsMarches] = React.useState(() => toOptions(buildMarcheOptions(initial.me, initial.marches)));
  const [optsClauses, setOptsClauses] = React.useState(() => toOptions(initial.clauses));
  const [specOptions, setSpecOptions] = React.useState(() => toOptions(initial.specialites));
  const [selectedSpecIds, setSelectedSpecIds] = React.useState([]);

  // Marché choisi
  const [selectedMarcheId, setSelectedMarcheId] = React.useState(() => {
    const options = buildMarcheOptions(initial.me, initial.marches);
    return options.length === 1 ? String(options[0].id) : '';
  });

  // Recherche
  const [search, setSearch] = React.useState('');

  // Modale fiche
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalRow, setModalRow]   = React.useState(null);
  const [cvPreviewOpen, setCvPreviewOpen] = React.useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = React.useState(null);
  const [cvPreviewFrameUrl, setCvPreviewFrameUrl] = React.useState(null);
  const [cvPreviewLoading, setCvPreviewLoading] = React.useState(false);
  const [cvPreviewError, setCvPreviewError] = React.useState(null);
  const cvPreviewObjectUrlRef = React.useRef(null);
  const [revealedFor, setRevealedFor] = React.useState(new Map()); // benefId -> coordonnées livrées par l'action (jamais dans la page)

  // Options de marché ou lot (candidatures et marchés détenus), calculées à partir des lignes lues : calcul pur.
  function buildMarcheOptions(mine, m) {
    if (!mine) return [];
    // options marchés/lots (candidats + titulaires)
    const ids = [...new Set([...asArray(mine[R.CAND_LIST]), ...asArray(mine[R.TIT_LIST])].filter(isNum))];
    const allMarches = Array.isArray(m) ? m : [];
    const rowById = new Map(allMarches.map(row => [row.id, row]));
    const seen = new Set();
    const marcheOptions = [];
    ids.forEach((id) => {
      const row = rowById.get(id);
      if (!row) return;
      const refIds = asArray(row[M.LOTS])
        .filter((x) => x !== 'L' && x != null && x !== '')
        .map((x) => (typeof x === 'number' ? x : Number(x)))
        .filter((x) => Number.isFinite(x));
      const children = row[M.PARENT]
        ? [row]
        : (refIds.length
        ? refIds.map(childId => rowById.get(childId)).filter(Boolean)
        : allMarches.filter(child => Number(child[M.PARENT]) === Number(row.id)));
      const availableRows = children.length ? children : [row];
      availableRows
        .filter((marche) => marche?.[M.CLAUSE])
        .filter((marche) => !isClosedStatus(marche?.[M.STATUS]))
        .forEach((marche) => {
          if (!marche?.id || seen.has(marche.id)) return;
          seen.add(marche.id);
          marcheOptions.push(marche);
      });
    });
    marcheOptions.sort((a, b) => {
      const parentA = Number(a[M.PARENT]) || Number(a.id) || 0;
      const parentB = Number(b[M.PARENT]) || Number(b.id) || 0;
      if (parentA !== parentB) return parentA - parentB;
      return String(a[M.LOT] || '').localeCompare(String(b[M.LOT] || ''), 'fr', { numeric: true, sensitivity: 'base' });
    });
    return marcheOptions;
  }

  React.useEffect(() => { document.title = 'Recherche d’un bénéficiaire - Eclauses'; }, []);

  // Clause du marché sélectionné
  const selectedMarche = React.useMemo(
    () => (marchesRows || []).find(m => String(m.id) === String(selectedMarcheId)) || null,
    [marchesRows, selectedMarcheId]
  );
  const selectedClauseId = selectedMarche ? selectedMarche[M.CLAUSE] : null;

  // Liste filtrée des bénéficiaires (par clause du marché + recherche)
  const filteredBenefs = React.useMemo(() => {
    if (!selectedClauseId) return [];
    const interestedIds = new Set(
      (interestRows || [])
        .filter(i => String(i[I.MARCHE]) === String(selectedMarcheId))
        .map(i => i[I.BENEF])
        .filter(isNum)
    );
    const specSet = new Set((selectedSpecIds || []).map(v => String(v)));
    const q = norm(search);
    return (benefRows || [])
      .filter(b => toBool(b[B.ELIGIBLE]) && !toBool(b[B.DOIT_SUPPRIMER]))
      .filter(b => asArray(b[B.CLAUSES]).includes(selectedClauseId))
      .filter(b => {
        if (specSet.size) {
          const specs = asArray(b[B.SPECS])
            .map(v => (typeof v === 'number' ? v : Number(v)))
            .filter(v => Number.isFinite(v));
          const match = specs.some(id => specSet.has(String(id)));
          if (!match) return false;
        }
        if (!q) return true;
        return includesI(b[B.NOM] || '', q) ||
               includesI(b[B.PRENOM] || '', q) ||
               includesI(b[B.EMAIL] || '', q) ||
               includesI(b[B.SPECIALITE_ECOLE] || '', q) ||
               includesI(b[B.AUTRES] || '', q);
      })
      .map((b) => ({ ...b, __isInterested: interestedIds.has(b.id) }))
      .sort((a, b) => {
        if (a.__isInterested !== b.__isInterested) return a.__isInterested ? -1 : 1;
        return fullName(a).localeCompare(fullName(b), 'fr', {sensitivity:'base'});
      });
  }, [benefRows, selectedClauseId, search, selectedSpecIds, interestRows, selectedMarcheId]);

  // === Modale fiche ===
  async function openModal(row) { 

    const cv = row[B.CV]?.filter((x)=>x!=='L')[0];
    row.cv_url = cv === undefined ? undefined : attachmentUrl(cv);

    setModalRow(row); setModalOpen(true); 
    
    }
  function closeModal() {
    setModalOpen(false);
    setModalRow(null);
    closeCvPreview();
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

  React.useEffect(() => () => {
    if (cvPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(cvPreviewObjectUrlRef.current);
      cvPreviewObjectUrlRef.current = null;
    }
  }, []);

  async function revealContacts(benefId) {
    if (!currentRepId || !selectedMarcheId || !isNum(benefId)) return;
    try {
      const res = await coordonnees(Number(selectedMarcheId), benefId);
      if (!res.ok) throw new Error(res.message);
      setRevealedFor((prev) => new Map(prev).set(benefId, res.data));
    } catch (e) {
      setErr(e.message || "Impossible d’enregistrer l’accès aux coordonnées.");
    }
  }

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
  if (!me || !currentRepId) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--warning"><p>Fiche répondant introuvable.</p></div>
      </section>
    );
  }

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-3w">
        <h1 className="fr-h3 fr-mb-1w">Recherche de bénéficiaires</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Choisissez un marché ou un lot, puis consultez les bénéficiaires de sa clause sociale.
        </p>
      </header>

      {/* Sélection du marché ou du lot */}
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-4">
          <div className="fr-select-group">
            <label className="fr-label" htmlFor="marche">Marché ou lot</label>
            <select id="marche" className="fr-select"
                    value={selectedMarcheId}
                    onChange={(e)=>setSelectedMarcheId(e.target.value)}>
              {optsMarches.length ?
                    <option value="">— Sélectionner un marché ou un lot —</option> : <option value="">— Aucun marché ou lot accessible —</option>}
              {optsMarches.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {selectedMarche && (
          <>
            <div className="fr-col-12 fr-col-md-4">
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="search">Rechercher</label>
                <input id="search" className="fr-input" type="search"
                       placeholder="Nom, prénom, e-mail, spécialité, mot-clé…"
                       value={search} onChange={(e)=>setSearch(e.target.value)} />
                
              </div>
            </div>
            <div className="fr-col-12 fr-col-md-4">
              {ComboBox ? (
                <ComboBox
                  id="specs-filter"
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
          </>
        )}
      </div>
      <p className="fr-hint-text fr-mt-1w fr-mb-3w">
        Clause : <strong>{labelFrom(optsClauses, selectedClauseId)}</strong>
      </p>

      {/* Liste */}
      {!selectedMarche ? (
        <div className="fr-callout"><p className="fr-callout__text">Veuillez choisir un marché ou un lot.</p></div>
      ) : (
        <>

          {filteredBenefs.length === 0 ? (
            <div className="fr-callout"><p className="fr-callout__text">Aucun résultat pour cette clause et ces critères.</p></div>
          ) : (
            <div className="fr-grid-row fr-grid-row--gutters">
              {filteredBenefs.map((r) => {
                const nomComplet = fullName(r);
                const speList = asArray(r["Specialite_Libelles"]).filter((x)=>x!=='L').join(', ');
                const sousSpec = r[B.SOUS_SPEC];
                return (
                  <div key={r.id} className="fr-col-12 fr-col-md-6">
                    <article className="fr-card fr-enlarge-link" onClick={() => openModal(r)}>
                      <div className="fr-card__body">
                            {r.__isInterested && (
                              <p className="fr-badge fr-badge--sm fr-badge--new fr-badge--no-icon fr-mt-2w">★ Intérêt exprimé</p>
                            )}
                            <h2 className="fr-card__title fr-text--md fr-mt-2w">
                              <a href="#" onClick={(e) => { e.preventDefault(); openModal(r); }}>{nomComplet}</a>
                            </h2>
                        <p className="fr-card__desc"><strong>Spécialité : </strong>{speList || '—'}</p>
                        {sousSpec && (<p className="fr-card__desc"><strong>Sous-spécialité : </strong>{sousSpec}</p>)}
                        {/* Pas d'email/tel visibles ici */}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modale fiche (coordonnées masquées) */}
      {modalOpen && modalRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="benef-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeModal}
        >
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'880px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="benef-modal-title" className="fr-h4 fr-mb-0">{fullName(modalRow)}</h2>
                  <p className="fr-text--xs fr-text-mention--grey">Clause : <strong>{labelFrom(optsClauses, selectedClauseId)}</strong></p>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeModal}>Fermer</button>
                </div>
              </div>

              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-lg-7">
                  {isFalseLike(modalRow?.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements) && (
                    <div className="fr-alert fr-alert--warning fr-alert--sm fr-mb-3w">
                      <p>Cette personne ne souhaite pas être contactée pour rejoindre un groupement.</p>
                    </div>
                  )}
                  <dl className="fr-description-list fr-mb-2w">
                    {modalRow['Formation_Libelle'] && (
                      <>
                        <dt><strong>Formation</strong></dt><dd>{modalRow['Formation_Libelle']}</dd>
                      </>
                    )}
                    {modalRow[B.ANNEE_DIP] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Année de diplôme</strong></dt><dd>{modalRow[B.ANNEE_DIP]}</dd>
                      </>
                    )}
                    {asArray(modalRow["Specialite_Libelles"]).filter((x)=>x!=='L').join(', ') && (
                      <>
                        <dt className="fr-mt-2w"><strong>Spécialité</strong></dt>
                        <dd>{asArray(modalRow["Specialite_Libelles"]).filter((x)=>x!=='L').join(', ')}</dd>
                      </>
                    )}
                    {modalRow[B.SOUS_SPEC] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Sous-spécialité</strong></dt><dd>{modalRow[B.SOUS_SPEC]}</dd>
                      </>
                    )}
                    {modalRow[B.MEMOIRE] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Mémoire</strong></dt><dd>{modalRow[B.MEMOIRE]}</dd>
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


              {/* Coordonnées masquées / bouton pour révéler et logguer */}
              <div className="fr-callout fr-mb-2w fr-mt-2w">
                {!isFalseLike(modalRow?.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements) && revealedFor.has(modalRow.id) ? (
                  <>
                    <p><strong>Email :</strong> {revealedFor.get(modalRow.id)?.Courriel || '—'}</p>
                    <p><strong>Téléphone :</strong> {revealedFor.get(modalRow.id)?.Telephone || '—'}</p>
                  </>
                ) : (
                  <>
                    <p className="fr-text--sm">Les coordonnées sont masquées.</p>
                    {!isFalseLike(modalRow?.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements) && (
                      <button className="fr-btn" onClick={() => revealContacts(modalRow.id)}>
                        Afficher les coordonnées
                      </button>
                    )}
                  </>
                )}
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
