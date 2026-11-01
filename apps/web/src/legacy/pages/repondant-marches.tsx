// @ts-nocheck : code repris du widget Grist (grist/page/repondant-marches), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  // ===== Tables & Colonnes =====
  const T = {
    REP:   'Repondants',
    M:     'Marches',
    C:     'Clauses_sociales',
    SPECS: 'T0_Referentiel_Specialites',
    B:     'Beneficiaires',
    MI:    'Marches_Interets',
    DECL:  'Declarations_Beneficiaires',  // ⇐ table proposée ci-dessus
    REFUS: 'Declarations_Beneficiaires_Refus',
  };

  const M = {
    INTITULE: 'Intitule_du_marche',
    INTITULE_PROP: 'Intitule_propre',
    INTITULE_LOT: 'Intitule_du_lot',
    LOT: 'Numero_de_lot',
    ACHETEUR: 'Acheteur',
    CLAUSE: 'Clauses_sociales',
    ADR: 'Lieu_d_execution',
    PUB: 'Date_de_publication',
    DLRO: 'Date_Limite_de_Remise_des_Offres',
    DNOTPREV: 'Date_de_notification_previsionnelle',
    EXEC_END: 'Date_de_fin_d_execution',
    STATUS: 'Statut',
    LIEN: 'Lien_Inscription_Candidat',
    INVIT: 'Invitation_Titulaire_Marche',
    LIEN_DOCS: 'Lien_vers_les_documents_de_consultation',
    SPECS: 'Specialites_du_marche',
    PARENT: 'Marche_parent',
    LOTS: 'Lots',

    TITULAIRE: 'Titulaire',
    BENEFICIAIRES: 'Beneficiaires',
    ACHETEUR_NOM: 'Acheteur_Nom',
  };

  const R = {
    NOM: 'Nom', PRENOM: 'Prenom', EMAIL: 'Email', TEL: 'Telephone', RAISOC: 'Raison_sociale',
    CAND_LIST: 'Candidat_aux_marches',      // RefList(Marches)
    TIT_LIST:  'Titulaire_aux_marches',     // RefList(Marches)
  };

  const D = {
    REP: 'Repondant',
    MARCHE: 'Marche',
    ECLAUSES: 'Est_beneficiaire_eclauses',
    B: 'Beneficiaire',
    NOM: 'Nom', PRENOM: 'Prenom', EMAIL: 'Email',
    STATUT: 'Statut',        // 'déclaré' | 'validé'
  };
  const REFUS = {
    MARCHE: 'Marche',
    REFUSE_LE: 'Refuse_le',
    RAISON: 'Raison',
  };

  const I = {
    MARCHE: 'Marche',
    BENEF: 'Beneficiaire',
  };

  const B = {
    NOM: 'NOM',
    PRENOM: 'Prenom',
    EMAIL: 'Courriel',
    CLAUSES: 'Clauses_sociales_de_rattachement', // RefList(Clauses_sociales)
    ELIGIBLE: 'Eligible',
    DOIT_SUPPRIMER: 'Doit_supprimer',
  };


  // ===== Utils =====
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const norm = (s) => String(s || '').toLowerCase();
  const includesI = (h, n) => norm(h).includes(norm(n));
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const toBool = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');

  const parseDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'string') { const d = new Date(v); return isNaN(d) ? null : d; }
    if (typeof v === 'number') {
      if (v > 1e12) return new Date(v);
      if (v > 1e9) return new Date(v * 1000);
      if (v > 1e4) return new Date(v);
      return new Date(v * 24*60*60*1000);
    }
    return null;
  };
  const formatDate = (d) => d ? d.toLocaleDateString('fr-FR') : '—';

  function pickLabelField(rows) {
    if (!rows || !rows.length) return 'id';
    const s = rows[0] || {};
    const pref = ['label','name','Nom','nom','Intitule','Intitulé','title','Title','Libellé','Libelle','libelle'];
    for (const k of pref) if (typeof s[k] === 'string') return k;
    for (const k of Object.keys(s)) if (typeof s[k] === 'string') return k;
    return 'id';
  }
  function toOptions(rows) {
    const key = pickLabelField(rows);
    return (rows || []).map(r => ({ value: r.id, label: String(r[key] ?? r.id), tooltip: r.Tooltip || '' }));
  }
  const labelFrom = (opts, id) => (opts.find(o => o.value === id)?.label ?? String(id ?? '—'));

  // ===== State =====
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const [repRows, setRepRows] = React.useState([]);
  const [currentRepId, setCurrentRepId] = React.useState(null);
  const [me, setMe] = React.useState(null);

  const [marchesRows, setMarchesRows] = React.useState([]);
  const [clauseRows, setClauseRows] = React.useState([]);
  const [benefRows, setBenefRows] = React.useState([]);
  const [interestRows, setInterestRows] = React.useState([]);

  const [optsClauses, setOptsClauses] = React.useState([]);
  const [optsSpecs, setOptsSpecs] = React.useState([]);
  const specLabel = React.useCallback((id) => labelFrom(optsSpecs, id), [optsSpecs]);

  // résumés issues de la fiche répondant
  const [candIds, setCandIds] = React.useState([]);  // marchés candidature
  const [titIds,  setTitIds]  = React.useState([]);  // marchés titulaires

  // déclarations (filtrées dynamiquement pour chaque marché dans la modale)
  const [declRows, setDeclRows] = React.useState([]);
  const [refusRows, setRefusRows] = React.useState([]);

  // recherche bénéficiaires (Eclauses) dans la modale
  const [searchBen, setSearchBen] = React.useState('');

  // Modale déclaration
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMarche, setModalMarche] = React.useState(null);
  const [manualNom, setManualNom] = React.useState('');
  const [manualPrenom, setManualPrenom] = React.useState('');
  const [manualEmail, setManualEmail] = React.useState('');
  const [pendingEclauses, setPendingEclauses] = React.useState([]);
  const [pendingManuals, setPendingManuals] = React.useState([]);
  const [showManualForm, setShowManualForm] = React.useState(false);
  const [modalSuccess, setModalSuccess] = React.useState(false);
  const successTimerRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  // Modale détail
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailMarche, setDetailMarche] = React.useState(null);
  const [detailType, setDetailType] = React.useState('');

  // ===== Load =====
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true); setErr(null);

        const auth = gristAPI.getAuth ? gristAPI.getAuth() : null;
        if (!auth || !Array.isArray(auth.roles) || !auth.roles.includes('repondant')) {
          throw new Error("Accès refusé : rôle 'répondant' requis.");
        }

        const [rep, m, c, specs, b, mi, d, refus] = await Promise.all([
          gristAPI.getData(T.REP),
          gristAPI.getData(T.M),
          gristAPI.getData(T.C),
          gristAPI.getData(T.SPECS).catch(()=>[]),
          gristAPI.getData(T.B),
          gristAPI.getData(T.MI).catch(()=>[]),
          gristAPI.getData(T.DECL).catch(()=>[]),   // si table pas encore créée → vide
          gristAPI.getData(T.REFUS).catch(()=>[])
        ]);
        if (!alive) return;

        setRepRows(Array.isArray(rep) ? rep : []);
        setMarchesRows(Array.isArray(m) ? m : []);
        setClauseRows(Array.isArray(c) ? c : []);
        setBenefRows(Array.isArray(b) ? b : []);
        setInterestRows(Array.isArray(mi) ? mi : []);
        setDeclRows(Array.isArray(d) ? d : []);
        setRefusRows(Array.isArray(refus) ? refus : []);

        setOptsClauses(toOptions(c || []));
        setOptsSpecs(toOptions(specs || []));

        // identifie mon répondant
        let id = auth.repondantId || null;
        if (!id && rep && rep.length === 1) id = rep[0].id;
        if (!id) throw new Error("Impossible d’identifier votre fiche répondant.");
        setCurrentRepId(id);

        const mine = rep.find(r => r.id === id);
        if (!mine) throw new Error("Votre fiche n’est pas accessible.");
        setMe(mine);

        setCandIds(asArray(mine[R.CAND_LIST]).filter(isNum));
        setTitIds(asArray(mine[R.TIT_LIST]).filter(isNum));

      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Erreur de chargement');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  // état par marché titulaire
  function statusBadgeForTit(marche) {
    const status = String(marche?.[M.STATUS] || '').trim();
    if (status === 'En attente de déclaration des bénéficiaires') {
      return { label: status, cls: 'fr-badge--warning' };
    }
    if (status === 'Déclaration à valider') {
      return { label: "Déclaration en cours de validation par l'acheteur", cls: 'fr-badge--info' };
    }
    if (status === 'Clause validée' || status === 'Clauses validées') {
      return { label: status, cls: 'fr-badge--success' };
    }
    if (status === 'Archivé') {
      return { label: status, cls: 'fr-badge--grey' };
    }
    return { label: status || 'Statut non renseigné', cls: 'fr-badge--grey' };
  }

  const clauseLabel = React.useCallback((id) => {
    const o = optsClauses.find(x => x.value === id);
    return o ? o.label : String(id ?? '—');
  }, [optsClauses]);
  const rowById = React.useMemo(() => {
    const map = new Map();
    (marchesRows || []).forEach(m => map.set(m.id, m));
    return map;
  }, [marchesRows]);
  const isLot = React.useCallback((row) => Boolean(row?.[M.PARENT]), []);
  const getLotsForParent = React.useCallback((row) => {
    if (!row) return [];
    const ids = asArray(row[M.LOTS])
      .filter((x) => x !== 'L' && x != null && x !== '')
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x));
    const fromRefs = ids.map(id => rowById.get(id)).filter(Boolean);
    const lots = fromRefs.length ? fromRefs : (marchesRows || []).filter(m => Number(m[M.PARENT]) === Number(row.id));
    return lots.slice().sort((a, b) => String(a[M.LOT] || '').localeCompare(String(b[M.LOT] || ''), 'fr', { numeric: true, sensitivity: 'base' }));
  }, [marchesRows, rowById]);
  const lotsFromIds = React.useCallback((ids) => {
    const seen = new Set();
    const lots = [];
    (ids || []).forEach((id) => {
      const row = rowById.get(id);
      if (!row) return;
      const childLots = isLot(row) ? [] : getLotsForParent(row);
      const candidates = isLot(row) || !childLots.length ? [row] : childLots;
      candidates.forEach((lot) => {
        if (!lot?.id || seen.has(lot.id)) return;
        seen.add(lot.id);
        lots.push(lot);
      });
    });
    return lots;
  }, [getLotsForParent, isLot, rowById]);
  const parentForLot = React.useCallback((lot) => lot?.[M.PARENT] ? rowById.get(Number(lot[M.PARENT])) : null, [rowById]);
  const lotTitle = React.useCallback((row) => row?.[M.INTITULE_PROP] || `${row?.[M.LOT] ? `Lot ${row[M.LOT]} - ` : ''}${row?.[M.INTITULE_LOT] || row?.[M.INTITULE] || '—'}`, []);
  const parentTitle = React.useCallback((row) => parentForLot(row)?.[M.INTITULE] || row?.[M.INTITULE] || '—', [parentForLot]);
  const marcheKind = React.useCallback((row) => isLot(row) ? 'lot' : 'marché', [isLot]);
  const titularStatusOrder = {
    'En attente de déclaration des bénéficiaires': 0,
    'Déclaration à valider': 1,
    'Clause validée': 2,
    'Archivé': 3,
  };
  const titularStatusRank = (row) => {
    const status = String(row?.[M.STATUS] || '').trim();
    return Object.prototype.hasOwnProperty.call(titularStatusOrder, status) ? titularStatusOrder[status] : 99;
  };

  // ===== Sélections “dérivées” : une ligne répondant = un lot =====
  const candMarches = React.useMemo(
    () => lotsFromIds(candIds)
      .filter(m => m[M.STATUS] === 'En attente de notification'),
    [candIds, lotsFromIds]
  );
  const titMarches = React.useMemo(
    () => lotsFromIds(titIds).slice().sort((a, b) => {
      const rankA = titularStatusRank(a);
      const rankB = titularStatusRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return String(parentTitle(a)).localeCompare(String(parentTitle(b)), 'fr', { sensitivity: 'base' });
    }),
    [titIds, lotsFromIds, parentTitle]
  );
  const benefsToDeclareCount = React.useMemo(
    () => titMarches.filter((m) => m[M.STATUS] === 'En attente de déclaration des bénéficiaires').length,
    [titMarches]
  );

  // ===== Ouverture modale =====
  function openDeclareModal(marche) {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setModalMarche(marche);
    setManualNom(''); setManualPrenom(''); setManualEmail('');
    setSearchBen('');
    setPendingEclauses([]);
    setPendingManuals([]);
    setShowManualForm(false);
    setModalSuccess(false);
    setModalOpen(true);
  }
  function closeDeclareModal() {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setModalOpen(false);
    setModalMarche(null);
    setSearchBen('');
    setPendingEclauses([]);
    setPendingManuals([]);
    setShowManualForm(false);
    setModalSuccess(false);
  }

  function openDetailModal(marche, type) {
    setDetailMarche(marche);
    setDetailType(type || '');
    setDetailOpen(true);
  }
  function closeDetailModal() {
    setDetailOpen(false);
    setDetailMarche(null);
    setDetailType('');
  }

  // ===== Ajouts dans Declarations_Beneficiaires =====
  async function addManualDeclaration() {
    if (!currentRepId || !modalMarche) return;
    if (!manualNom || !manualPrenom || !manualEmail) {
      setErr('Nom / Prénom / Email requis.');
      return;
    }
    setPendingManuals(prev => ([
      ...prev,
      { nom: manualNom, prenom: manualPrenom, email: manualEmail }
    ]));
    setManualNom(''); setManualPrenom(''); setManualEmail('');
    setSearchBen('');
    setShowManualForm(false);
  }

  async function addEclausesDeclaration(benefId) {
    if (!currentRepId || !modalMarche || !isNum(benefId)) return;
    setPendingEclauses(prev => {
      if (prev.includes(benefId)) return prev;
      return [...prev, benefId];
    });
    setSearchBen('');
  }

  function removePendingEclauses(benefId) {
    setPendingEclauses(prev => prev.filter(id => id !== benefId));
  }
  function removePendingManual(idx) {
    setPendingManuals(prev => prev.filter((_, i) => i !== idx));
  }

  async function validateDeclarationBatch() {
    if (!currentRepId || !modalMarche) return;
    const draftDecls = (declRows || []).filter((d) =>
      d[D.REP] === currentRepId &&
      d[D.MARCHE] === modalMarche.id &&
      String(d[D.STATUT] || '').toLowerCase() === 'brouillon'
    );
    if (!pendingEclauses.length && !pendingManuals.length && !draftDecls.length) return;
    try {
      for (const d of draftDecls) {
        await gristAPI.updateRecord(T.DECL, d.id, { [D.STATUT]: 'déclaré' });
      }
      for (const benefId of pendingEclauses) {
        await gristAPI.addRecord(T.DECL, {
          [D.MARCHE]: modalMarche.id,
          [D.ECLAUSES]: true,
          [D.B]: benefId,
          [D.STATUT]: 'déclaré',
        });
      }
      for (const m of pendingManuals) {
        await gristAPI.addRecord(T.DECL, {
          [D.MARCHE]: modalMarche.id,
          [D.ECLAUSES]: false,
          [D.NOM]: m.nom,
          [D.PRENOM]: m.prenom,
          [D.EMAIL]: m.email,
          [D.STATUT]: 'déclaré',
        });
      }
      await gristAPI.updateRecord(T.M, modalMarche.id, { [M.STATUS]: 'Déclaration à valider' });
      await reloadDecls();
      await reloadMarches();
      setPendingEclauses([]);
      setPendingManuals([]);
      setShowManualForm(false);
      setSearchBen('');
      setModalSuccess(true);
      successTimerRef.current = setTimeout(() => {
        closeDeclareModal();
      }, 5000);
    } catch (e) {
      setErr(e.message || "Échec de l’enregistrement.");
    }
  }

  async function deleteDeclaration(declId) {
    try {
      await gristAPI.deleteRecord(T.DECL, declId);
      await reloadDecls();
    } catch (e) {
      setErr(e.message || "Échec de la suppression.");
    }
  }

  async function reloadDecls() {
    const [d, refus] = await Promise.all([
      gristAPI.getData(T.DECL).catch(()=>[]),
      gristAPI.getData(T.REFUS).catch(()=>[]),
    ]);
    setDeclRows(Array.isArray(d) ? d : []);
    setRefusRows(Array.isArray(refus) ? refus : []);
  }

  async function reloadMarches() {
    const m = await gristAPI.getData(T.M).catch(()=>[]);
    setMarchesRows(Array.isArray(m) ? m : []);
  }

  // ===== Recherche des bénéficiaires (Eclauses) pour la clause du marché
  const benefCandidates = React.useMemo(() => {
    if (!modalMarche) return [];
    const marcheClauseId = modalMarche[M.CLAUSE];
    const clauseMatch = (r) => asArray(r[B.CLAUSES]).includes(marcheClauseId);
    const q = norm(searchBen);
    const interestedIds = new Set(
      (interestRows || [])
        .filter(i => i[I.MARCHE] === modalMarche.id)
        .map(i => i[I.BENEF])
        .filter(isNum)
    );
    const alreadyDeclaredIds = new Set(
      (declRows || [])
        .filter(d => d[D.REP] === currentRepId && d[D.MARCHE] === modalMarche.id && !!d[D.ECLAUSES])
        .map(d => d[D.B])
        .filter(isNum)
    );
    pendingEclauses.forEach(id => alreadyDeclaredIds.add(id));
	    return (benefRows || [])
	      .filter(r => toBool(r[B.ELIGIBLE]) && !toBool(r[B.DOIT_SUPPRIMER]))
	      .filter(r => clauseMatch(r))
      .filter(r => !alreadyDeclaredIds.has(r.id))
      .filter(r => {
        if (!q) return true;
        return includesI(r[B.NOM] || '', q) ||
               includesI(r[B.PRENOM] || '', q) ||
               includesI(r[B.EMAIL] || '', q);
      })
      .map(r => ({ ...r, __isInterested: interestedIds.has(r.id) }))
      .sort((a, b) => {
        if (a.__isInterested !== b.__isInterested) return a.__isInterested ? -1 : 1;
        return (String(a[B.NOM]||'') + String(a[B.PRENOM]||''))
          .localeCompare(String(b[B.NOM]||'') + String(b[B.PRENOM]||''));
      });
  }, [benefRows, modalMarche, searchBen, declRows, currentRepId, pendingEclauses, interestRows]);

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
  if (!currentRepId || !me) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--warning"><p>Fiche répondant introuvable.</p></div>
      </section>
    );
  }

  // Helpers d’affichage
  const dlro = (row) => formatDate(parseDate(row[M.DLRO]));
  const clause = (row) => labelFrom(optsClauses, row[M.CLAUSE]);
  const modalDecls = modalMarche
    ? (declRows || []).filter(d => d[D.REP] === currentRepId && d[D.MARCHE] === modalMarche.id)
    : [];
  const modalDraftDecls = modalDecls.filter((d) => String(d[D.STATUT] || '').toLowerCase() === 'brouillon');
  const modalRefusal = modalMarche
    ? (refusRows || [])
        .filter((r) => Number(r[REFUS.MARCHE]) === Number(modalMarche.id))
        .sort((a, b) => (parseDate(b[REFUS.REFUSE_LE])?.getTime() || 0) - (parseDate(a[REFUS.REFUSE_LE])?.getTime() || 0))[0]
    : null;
  const detailDecls = detailMarche
    ? (declRows || []).filter(d => d[D.REP] === currentRepId && d[D.MARCHE] === detailMarche.id)
    : [];

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Mes marchés</h1>
      </header>

      {benefsToDeclareCount > 0 && (
        <div className="fr-alert fr-alert--warning fr-mb-4w">
          <p>
            Vous avez {benefsToDeclareCount} bénéficiaire{benefsToDeclareCount > 1 ? 's' : ''} à déclarer.
            Les marchés concernés sont affichés en premier dans la section Titulaire.
          </p>
        </div>
      )}

      {/* Candidatures */}
      <section className="fr-mb-6w">
        <h2 className="fr-h4 fr-mb-2w">Candidature(s) en cours</h2>
        {candMarches.length === 0 ? (
          <div className="fr-callout"><p className="fr-callout__text">Aucun marché en candidature.</p></div>
        ) : (
          <div className="fr-grid-row fr-grid-row--gutters">
            {candMarches.map(m => (
              <div className="fr-col-12" key={m.id}>
                <div className="fr-card fr-card--horizontal">
                  <div className="fr-card__body">
                    <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
                      <div className="fr-col-12 fr-col-md-8">
                        <div className="fr-card__content">
                          <h3 className="fr-card__title fr-text--md">
                            <a href="#" onClick={(e)=>{ e.preventDefault(); openDetailModal(m, 'candidature'); }}>
                              {lotTitle(m)}
                            </a>
                          </h3>
                          <p className="fr-card__desc fr-text--sm">
                            Marché : <strong>{parentTitle(m)}</strong>
                          </p>
                          <p className="fr-card__desc fr-text--sm">
                            Acheteur : <strong>{m[M.ACHETEUR_NOM]}</strong>
                          </p>
                          <p className="fr-card__desc fr-text--sm">Date limite de remise des offres : {dlro(m)}</p>
                        </div>
                      </div>
                      <div className="fr-col-12 fr-col-md-4">
                        <div className="fr-card__footer">
                          <ul className="fr-btns-group fr-btns-group--right fr-btns-group--sm fr-btns-group--icon-left">
                            <li>
                              <button className="fr-btn fr-btn--secondary fr-btn--s fr-icon-eye-line" onClick={()=>openDetailModal(m, 'candidature')}>
                                Détails du {marcheKind(m)}
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Titulaire */}
      <section>
        <h2 className="fr-h4 fr-mb-2w">Titulaire</h2>
        {titMarches.length === 0 ? (
          <div className="fr-callout"><p className="fr-callout__text">Aucun marché en titulaire.</p></div>
        ) : (
          <div className="fr-grid-row fr-grid-row--gutters">
            {titMarches.map(m => {
              const etat = statusBadgeForTit(m);
              const canDeclare = m[M.STATUS] === 'En attente de déclaration des bénéficiaires';
              return (
                <div className="fr-col-12" key={m.id}>
                  <div className="fr-card fr-card--horizontal">
                    <div className="fr-card__body">
                      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
                        <div className="fr-col-12 fr-col-md-8">
                          <div className="fr-card__content">
                            <p className={`fr-badge fr-badge--sm ${etat.cls} fr-mb-1w`}>{etat.label}</p>
                            <h3 className="fr-card__title fr-text--md">
                              <a href="#" onClick={(e)=>{ e.preventDefault(); openDetailModal(m, 'titulaire'); }}>
                                {lotTitle(m)}
                              </a>
                            </h3>
                            <p className="fr-card__desc fr-text--sm">
                              Marché : <strong>{parentTitle(m)}</strong>
                            </p>
                            <p className="fr-card__desc fr-text--sm">
                              Acheteur : <strong>{m[M.ACHETEUR_NOM]}</strong>
                            </p>
                          </div>
                        </div>
                        <div className="fr-col-12 fr-col-md-4">
                          <div className="fr-card__footer">
                            <ul className="fr-btns-group fr-btns-group--right fr-btns-group--sm fr-btns-group--icon-left">
                              <li>
                                {canDeclare && (
                                  <button
                                    className="fr-btn fr-btn--sm fr-icon-checkbox-line"
                                    onClick={() => openDeclareModal(m)}
                                    title="Déclarer mes bénéficiaires"
                                  >
                                    Déclarer des bénéficiaires
                                  </button>
                                )}
                              </li>
                              <li>
                                <button className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-eye-line" onClick={()=>openDetailModal(m, 'titulaire')}>
                                  Détails du {marcheKind(m)}
                                </button>
                              </li>
                            
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modale Déclaration */}
      {modalOpen && modalMarche && (
        <div role="dialog" aria-modal="true" aria-labelledby="decl-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeDeclareModal}
        >
          <div className="fr-container fr-container--fluid fr-container-lg"
               style={{maxWidth:'960px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              {modalSuccess ? (
                <div className="fr-alert fr-alert--success">
                  <p>Merci pour votre déclaration. Vos bénéficiaires ont bien été enregistrés et doivent maintenant être validés par l'acheteur.</p>
                </div>
              ) : (
                <>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="decl-modal-title" className="fr-h4 fr-mb-0">
                    Déclarer des bénéficiaires — {lotTitle(modalMarche)}
                  </h2>
                  {isLot(modalMarche) && (
                    <p className="fr-text--xs fr-text-mention--grey">
                      Marché : <strong>{parentTitle(modalMarche)}</strong>
                    </p>
                  )}
                  <p className="fr-text--xs fr-text-mention--grey">
                    Clause : <strong>{clause(modalMarche)}</strong>
                  </p>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeDeclareModal}>Fermer</button>
                </div>
              </div>

              {modalRefusal && (
                <div className="fr-alert fr-alert--warning fr-mb-3w">
                  <p>
                    <strong>Déclaration refusée le {formatDate(parseDate(modalRefusal[REFUS.REFUSE_LE]))}</strong>
                  </p>
                  <p>{modalRefusal[REFUS.RAISON] || 'Motif non renseigné.'}</p>
                </div>
              )}

              <h3 className="fr-h6 fr-mb-2w">Ajouter des bénéficiaires à ce {marcheKind(modalMarche)}</h3>

              <div className="fr-input-group fr-mb-2w">
                <label className="fr-label" htmlFor="search-ben">Rechercher (nom, prénom, email)</label>
                <input id="search-ben" className="fr-input" type="search"
                  value={searchBen} onChange={(e)=>setSearchBen(e.target.value)} />
              </div>

              {searchBen !== "" && (
                <>
                  {benefCandidates.length === 0 ? (
                    <div className="fr-callout">
                      <p className="fr-callout__text">Aucun résultat dans l'annuaire, vous pouvez ajouter manuellement un bénéficiaire.</p>
                      <div className="fr-mt-2w">
                        <button className="fr-btn fr-btn--secondary" onClick={() => setShowManualForm(true)}>
                          Ajouter manuellement
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="fr-grid-row fr-grid-row--gutters fr-mb-3w">
                      {benefCandidates.slice(0, 50).map(b => (
                        <div className="fr-col-12 fr-col-md-6" key={b.id}>
                          <div className="fr-card fr-card--sm">
                            <div className="fr-card__body">
                              <div className="fr-card__content">
                                {b.__isInterested && (
                                  <p className="fr-badge fr-badge--sm fr-badge--new fr-badge--no-icon fr-mt-1w">★ Intérêt exprimé</p>
                                )}
                                <p className="fr-text--sm fr-mb-1w"><strong>Nom :</strong> {b[B.NOM] || '—'}</p>
                                <p className="fr-text--sm fr-mb-1w"><strong>Prénom :</strong> {b[B.PRENOM] || '—'}</p>
                                <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {b[B.EMAIL] || '—'}</p>
                              </div>
                              <div className="fr-card__footer">
                                <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                                  <li>
                                    <button className="fr-btn fr-btn--sm" onClick={()=>addEclausesDeclaration(b.id)}>Ajouter</button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {benefCandidates.length > 50 && <p className="fr-hint-text fr-mt-1w">Affichage limité à 50 résultats — affinez la recherche.</p>}
                    </div>
                  )}
                </>
              )}

              {showManualForm && (
                <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
                  <div className="fr-col-12 fr-col-md-4">
                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="m-nom">Nom</label>
                      <input id="m-nom" className="fr-input" type="text" value={manualNom} onChange={(e)=>setManualNom(e.target.value)} />
                    </div>
                  </div>
                  <div className="fr-col-12 fr-col-md-4">
                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="m-prenom">Prénom</label>
                      <input id="m-prenom" className="fr-input" type="text" value={manualPrenom} onChange={(e)=>setManualPrenom(e.target.value)} />
                    </div>
                  </div>
                  <div className="fr-col-12 fr-col-md-4">
                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="m-email">E-mail</label>
                      <input id="m-email" className="fr-input" type="email" value={manualEmail} onChange={(e)=>setManualEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="fr-col-12 fr-mt-1w">
                    <div className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                      <button className="fr-btn" onClick={addManualDeclaration} disabled={!manualNom || !manualPrenom || !manualEmail}>Ajouter</button>
                      <button className="fr-btn fr-btn--secondary" onClick={() => setShowManualForm(false)}>Fermer</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Déclarations existantes pour ce marché / répondant */}
              <section className="fr-mt-2w">
                <h3 className="fr-h6 fr-mb-2w">Déclarations pour ce {marcheKind(modalMarche)}</h3>
                {modalDecls.length === 0 && pendingEclauses.length === 0 && pendingManuals.length === 0 ? (
                  <div className="fr-callout">
                    <p className="fr-callout__text">Ajoutez vos bénéficiaires via l’outil de recherche.</p>
                  </div>
                ) : (
                  <div className="fr-grid-row fr-grid-row--gutters">
                    {pendingEclauses.map(id => {
                      const b = benefRows.find(x => x.id === id) || {};
                      const nom = b[B.NOM] || '';
                      const prenom = b[B.PRENOM] || '';
                      const email = b[B.EMAIL] || '';
                      return (
                        <div className="fr-col-12 fr-col-md-6" key={`pend-e-${id}`}>
                          <div className="fr-card fr-card--sm">
                            <div className="fr-card__body">
                              <div className="fr-card__content">
                                <p className="fr-badge fr-badge--sm fr-badge--info fr-mb-1w">À enregistrer</p>
                                <p className="fr-text--sm fr-mb-1w"><strong>Type :</strong> Eclauses</p>
                                <p className="fr-text--sm fr-mb-1w"><strong>Bénéficiaire :</strong> {(prenom + ' ' + nom).trim() || '—'}</p>
                                <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {email || '—'}</p>
                              </div>
                              <div className="fr-card__footer">
                                <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                                  <li>
                                    <button className="fr-btn fr-btn--sm fr-btn--tertiary" onClick={() => removePendingEclauses(id)}>Supprimer</button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {pendingManuals.map((m, idx) => (
                      <div className="fr-col-12 fr-col-md-6" key={`pend-m-${idx}`}>
                        <div className="fr-card fr-card--sm">
                          <div className="fr-card__body">
                            <div className="fr-card__content">
                              <p className="fr-badge fr-badge--sm fr-badge--info fr-mb-1w">À enregistrer</p>
                              <p className="fr-text--sm fr-mb-1w"><strong>Type :</strong> Externe</p>
                              <p className="fr-text--sm fr-mb-1w"><strong>Bénéficiaire :</strong> {`${m.prenom} ${m.nom}`.trim() || '—'}</p>
                              <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {m.email || '—'}</p>
                            </div>
                            <div className="fr-card__footer">
                              <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                                <li>
                                  <button className="fr-btn fr-btn--sm fr-btn--tertiary" onClick={() => removePendingManual(idx)}>Supprimer</button>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                      {modalDecls.map(d => {
                        const isE = !!d[D.ECLAUSES];
                        const benef = isE ? (benefRows.find(b => b.id === d[D.B]) || {}) : {};
                        const nom = isE ? (benef[B.NOM] || '') : (d[D.NOM] || '');
                        const prenom = isE ? (benef[B.PRENOM] || '') : (d[D.PRENOM] || '');
                        const email = isE ? (benef[B.EMAIL] || '') : (d[D.EMAIL] || '');
                        const statut = String(d[D.STATUT] || 'déclaré');
                        const isValid = statut.toLowerCase() === 'validé';
                        return (
                          <div className="fr-col-12 fr-col-md-6" key={d.id}>
                            <div className="fr-card fr-card--sm">
                              <div className="fr-card__body">
                                <div className="fr-card__content">
                                  <p className={`fr-badge fr-badge--sm ${isValid ? 'fr-badge--success' : 'fr-badge--info'} fr-mb-1w`}>{statut}</p>
                                  <p className="fr-text--sm fr-mb-1w"><strong>Type :</strong> {isE ? 'Eclauses' : 'Externe'}</p>
                                  <p className="fr-text--sm fr-mb-1w"><strong>Bénéficiaire :</strong> {(prenom + ' ' + nom).trim() || '—'}</p>
                                  <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {email || '—'}</p>
                                </div>
                              <div className="fr-card__footer">
                                <ul className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                                  <li>
                                    <button className="fr-btn fr-btn--sm fr-btn--tertiary" onClick={()=>deleteDeclaration(d.id)}>Supprimer</button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="fr-btns-group fr-btns-group--right fr-mt-2w">
                <button className="fr-btn" onClick={validateDeclarationBatch} disabled={!pendingEclauses.length && !pendingManuals.length && !modalDraftDecls.length}>
                  Valider ma déclaration
                </button>
              </div>

              
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale Détail */}
      {detailOpen && detailMarche && (
        <div role="dialog" aria-modal="true" aria-labelledby="detail-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeDetailModal}
        >
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'720px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="detail-modal-title" className="fr-h4 fr-mb-0">
                    Détails du {marcheKind(detailMarche)}
                  </h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeDetailModal}>Fermer</button>
                </div>
              </div>

              <dl className="fr-text--sm">
                <dt className="fr-text--bold">Intitulé du marché</dt>
                <dd>{parentTitle(detailMarche)}</dd>
                <dt className="fr-text--bold">Intitulé du lot</dt>
                <dd>{detailMarche[M.INTITULE_LOT] || '—'}</dd>
                <dt className="fr-text--bold">Numéro de lot</dt>
                <dd>{detailMarche[M.LOT] || '—'}</dd>
                <dt className="fr-text--bold">Clause sociale</dt>
                <dd>{clauseLabel(detailMarche[M.CLAUSE])}</dd>
                <dt className="fr-text--bold">Lieu d’exécution</dt>
                <dd>{detailMarche[M.ADR] || '—'}</dd>
                <dt className="fr-text--bold">Spécialités du marché</dt>
                <dd>
                  {asArray(detailMarche[M.SPECS])
                    .filter((x) => x !== 'L' && x != null && x !== '')
                    .map((x) => {
                      const n = Number(x);
                      return Number.isFinite(n) ? n : x;
                    })
                    .map((id) => specLabel(id))
                    .join(', ') || '—'}
                </dd>
                <dt className="fr-text--bold">Date limite de remise des offres</dt>
                <dd>{formatDate(parseDate(detailMarche[M.DLRO]))}</dd>
                <dt className="fr-text--bold">Date de notification prévisionnelle</dt>
                <dd>{formatDate(parseDate(detailMarche[M.DNOTPREV]))}</dd>
                <dt className="fr-text--bold">Lien des documents de consultation</dt>
                <dd>
                  {detailMarche[M.LIEN_DOCS] ? (
                    <a className="fr-link" href={detailMarche[M.LIEN_DOCS]} target="_blank" rel="noreferrer">
                      Ouvrir le lien
                    </a>
                  ) : '—'}
                </dd>
              </dl>

              {(['Clause validée', 'Archivé'].includes(statusBadgeForTit(detailMarche).label)) && (
                <section className="fr-mt-2w">
                  <h3 className="fr-h6 fr-mb-2w">Bénéficiaires déclarés</h3>
                  {detailDecls.length === 0 ? (
                    <div className="fr-callout"><p className="fr-callout__text">Aucun bénéficiaire déclaré.</p></div>
                  ) : (
                    <div className="fr-grid-row fr-grid-row--gutters">
                      {detailDecls.map(d => {
                        const isE = !!d[D.ECLAUSES];
                        const benef = isE ? (benefRows.find(b => b.id === d[D.B]) || {}) : {};
                        const nom = isE ? (benef[B.NOM] || '') : (d[D.NOM] || '');
                        const prenom = isE ? (benef[B.PRENOM] || '') : (d[D.PRENOM] || '');
                        const email = isE ? (benef[B.EMAIL] || '') : (d[D.EMAIL] || '');
                        const statut = String(d[D.STATUT] || 'déclaré');
                        const isValid = statut.toLowerCase() === 'validé';
                        return (
                          <div className="fr-col-12 fr-col-md-6" key={`decl-${d.id}`}>
                            <div className="fr-card fr-card--sm">
                              <div className="fr-card__body">
                                <div className="fr-card__content">
                                  <p className={`fr-badge fr-badge--sm ${isValid ? 'fr-badge--success' : 'fr-badge--info'} fr-mb-1w`}>{statut}</p>
                                  <p className="fr-text--sm fr-mb-1w"><strong>Type :</strong> {isE ? 'Eclauses' : 'Externe'}</p>
                                  <p className="fr-text--sm fr-mb-1w"><strong>Bénéficiaire :</strong> {(prenom + ' ' + nom).trim() || '—'}</p>
                                  <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {email || '—'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              <div className="fr-btns-group fr-btns-group--right fr-btns-group--sm fr-mt-2w">
                <button className="fr-btn fr-btn--secondary" onClick={closeDetailModal}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Component;
