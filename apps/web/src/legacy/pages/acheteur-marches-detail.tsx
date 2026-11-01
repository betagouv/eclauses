// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-marches-detail), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const T = {
    UA: 'Utilisateurs_Acheteurs',
    ACH: 'Acheteurs',
    M: 'Marches',
    C: 'Clauses_sociales',
    SPECS: 'T0_Referentiel_Specialites',
    DB: 'Declarations_Beneficiaires',
    REFUS: 'Declarations_Beneficiaires_Refus',
    BEN: 'Beneficiaires',
    INV: 'Invitation_Titulaire',
  };

  const M = {
    INTITULE: 'Intitule_du_marche',
    INTITULE_PROP: 'Intitule_propre',
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
    INVIT: 'Invitation_Titulaire_Marche',
    BENEFICIAIRES: 'Beneficiaires',
    PARENT: 'Marche_parent',
    LOTS: 'Lots',
    STATUT_GLOBAL: 'Statut_global',
    NB_LOTS_DECL: 'Nb_lots_en_attente_declaration',
    NB_LOTS_A_VALIDER: 'Nb_lots_a_valider',
    NB_LOTS_VALIDES: 'Nb_lots_valides',
  };
  const B = {
    NOM: 'NOM',
    PRENOM: 'Prenom',
    COURRIEL: 'Courriel',
    EMAIL: 'Email',
    TEL: 'Telephone',
    CV: 'curriculum_vitae',
    ANNEE_DIP: 'Annee_diplome',
    SOUS_SPEC: 'Sous_specialite',
    MEMOIRE: 'Memoire',
    AUTRES_INFOS: 'Autres_informations',
    CONTACT_GROUPEMENT: 'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements',
  };
  const INV = { MARCHE: 'Marche', LAST_REMINDER: 'Derniere_relance_le' };
  const DB = { MARCHE: 'Marche', STATUT: 'Statut' };
  const REFUS = { MARCHE: 'Marche', REFUSE_LE: 'Refuse_le', REFUSE_PAR: 'Refuse_par', RAISON: 'Raison' };

  const { toOptions, parseDate, formatDate } = gristAPI.helpers;
  const toOptionsWithTooltip = (rows) => toOptions(rows || []).map((opt) => {
    const row = (rows || []).find((r) => String(r.id) === String(opt.value));
    return { ...opt, tooltip: row?.Tooltip || '' };
  });
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const asRefIds = (v) => asArray(v)
    .filter((x) => x !== 'L' && x != null && x !== '')
    .map((x) => (typeof x === 'number' ? x : Number(x)))
    .filter((x) => Number.isFinite(x));
  const toBool = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
  const isFalseLike = (v) => v === false || v === 0 || v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
  const fullName = (r) => {
    const n = String(r?.__nom || r?.[B.NOM] || r?.Nom || '').trim();
    const p = String(r?.__prenom || r?.[B.PRENOM] || r?.PRENOM || '').trim();
    return (p && n) ? `${p} ${n}` : (p || n || 'Sans nom');
  };
  const canShowContacts = (row) => !isFalseLike(row?.[B.CONTACT_GROUPEMENT]);
  const formatDateOrDash = (v) => {
    const d = parseDate(v);
    return d ? formatDate(d) : '—';
  };
  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const ymd = (v) => {
    const d = v instanceof Date ? v : parseDate(v);
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const RELANCE_DELAY_DAYS = (() => {
    const raw = gristAPI.getEnv ? gristAPI.getEnv('RELANCE_TITULAIRE_DELAY_DAYS', '7') : '7';
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 7;
  })();

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [org, setOrg] = React.useState(null);
  const [acheteurUserId, setAcheteurUserId] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [optsClauses, setOptsClauses] = React.useState([]);
  const [optsSpecs, setOptsSpecs] = React.useState([]);
  const [declRows, setDeclRows] = React.useState([]);
  const [refusRows, setRefusRows] = React.useState([]);
  const [benefRows, setBenefRows] = React.useState([]);
  const [invRows, setInvRows] = React.useState([]);
  const [marcheId, setMarcheId] = React.useState(null);
  const [inviteFor, setInviteFor] = React.useState(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteExecEnd, setInviteExecEnd] = React.useState('');
  const [invitePlaceNotified, setInvitePlaceNotified] = React.useState(false);
  const [inviting, setInviting] = React.useState(false);
  const [relancingId, setRelancingId] = React.useState(null);
  const [relancedId, setRelancedId] = React.useState(null);
  const [declFor, setDeclFor] = React.useState(null);
  const [declConfirmations, setDeclConfirmations] = React.useState({});
  const [validating, setValidating] = React.useState(false);
  const [refuseFor, setRefuseFor] = React.useState(null);
  const [refuseReason, setRefuseReason] = React.useState('');
  const [refuseError, setRefuseError] = React.useState(null);
  const [refusing, setRefusing] = React.useState(false);
  const [benefDetail, setBenefDetail] = React.useState(null);
  const [cvPreviewOpen, setCvPreviewOpen] = React.useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = React.useState(null);
  const [cvPreviewFrameUrl, setCvPreviewFrameUrl] = React.useState(null);
  const [cvPreviewLoading, setCvPreviewLoading] = React.useState(false);
  const [cvPreviewError, setCvPreviewError] = React.useState(null);
  const cvPreviewObjectUrlRef = React.useRef(null);
  const declModalBodyRef = React.useRef(null);

  const goBack = () => gristAPI.navigate && gristAPI.navigate('acheteur-marches');
  const rowById = React.useMemo(() => new Map((rows || []).map((r) => [r.id, r])), [rows]);
  const marche = rowById.get(marcheId);
  const benefMap = React.useMemo(() => new Map((benefRows || []).map((b) => [b.id, b])), [benefRows]);
  const clauseLabel = (id) => optsClauses.find((o) => String(o.value) === String(id))?.label || String(id ?? '—');
  const specLabel = (id) => optsSpecs.find((o) => String(o.value) === String(id))?.label || String(id ?? '—');
  const specLabels = (ids) => {
    const labels = asRefIds(ids).map(specLabel).filter(Boolean);
    return labels.length ? labels.join(', ') : '—';
  };
  const STATUS_OPTIONS = [
    { value: 'En attente de notification', label: 'En attente de notification', cls: 'fr-badge--new' },
    { value: 'En attente de déclaration des bénéficiaires', label: 'En attente de déclaration des bénéficiaires', cls: 'fr-badge--warning' },
    { value: 'Déclaration à valider', label: 'Déclaration à valider', cls: 'fr-badge--info' },
    { value: 'Clause validée', label: 'Clause validée', cls: 'fr-badge--success' },
    { value: 'Archivé', label: 'Archivé', cls: 'fr-badge--grey' },
    { value: 'En attente de publication', label: 'En attente de publication', cls: 'fr-badge--new' },
  ];
  const renderStatus = (v) => {
    if (!v) return <span className="fr-badge fr-badge--sm fr-badge--grey">Non renseigné</span>;
    const opt = STATUS_OPTIONS.find((o) => o.value === v);
    return <span className={`fr-badge fr-badge--sm ${opt?.cls || 'fr-badge--grey'}`}>{opt?.label || v}</span>;
  };
  const STATUS_ORDER = [
    'En attente de publication',
    'En attente de notification',
    'En attente de déclaration des bénéficiaires',
    'Déclaration à valider',
    'Clause validée',
    'Archivé',
  ];
  const statusRank = (status) => {
    const normalized = String(status || '');
    const idx = STATUS_ORDER.indexOf(normalized);
    return idx === -1 ? STATUS_ORDER.length : idx;
  };
  const getWeakestStatus = (items, fallback) => {
    const statuses = (items || []).map((row) => String(row?.[M.STATUS] || '')).filter(Boolean);
    return STATUS_ORDER.find((status) => statuses.some((s) => statusRank(s) === statusRank(status))) || fallback || '';
  };

  const compareByLot = (a, b) => String(a?.[M.LOT] || '').localeCompare(String(b?.[M.LOT] || ''), 'fr', { numeric: true, sensitivity: 'base' });
  const compareByStatusThenLot = (a, b) => {
    const rankA = statusRank(a?.[M.STATUS]);
    const rankB = statusRank(b?.[M.STATUS]);
    if (rankA !== rankB) return rankA - rankB;
    return compareByLot(a, b);
  };
  const getLotsForParent = (row, allRows = rows) => {
    if (!row) return [];
    const byId = new Map((allRows || []).map((r) => [r.id, r]));
    const fromRefs = asRefIds(row[M.LOTS]).map((id) => byId.get(id)).filter(Boolean);
    const lots = fromRefs.length ? fromRefs : (allRows || []).filter((r) => Number(r[M.PARENT]) === Number(row.id));
    return lots.slice().sort(compareByStatusThenLot);
  };
  const hasInvitationInRows = (row, invitations = invRows) => {
    if (!row?.id) return false;
    return (invitations || []).some((inv) => Number(inv[INV.MARCHE]) === Number(row.id));
  };
  const getLastReminderDate = (row) => {
    let best = null;
    (invRows || []).forEach((inv) => {
      if (Number(inv[INV.MARCHE]) !== Number(row?.id)) return;
      const d = parseDate(inv[INV.LAST_REMINDER]);
      if (!d) return;
      d.setHours(0,0,0,0);
      if (!best || d.getTime() > best.getTime()) best = d;
    });
    return best;
  };
  const canRelanceTitulaire = (row) => {
    if (!hasInvitationInRows(row)) return false;
    const last = getLastReminderDate(row);
    if (!last) return true;
    return Math.floor((today().getTime() - last.getTime()) / 86400000) >= RELANCE_DELAY_DAYS;
  };
  const renderLastReminder = (row) => {
    const last = getLastReminderDate(row);
    if (!last) return null;
    return <p className="fr-text--xs fr-text-mention--grey fr-mt-1w fr-mb-0">Dernière relance : {formatDate(last)}</p>;
  };
  const getDeclsFor = (row) => {
    const ids = asRefIds(row?.[M.BENEFICIAIRES]);
    const fromRefs = (declRows || []).filter((d) => ids.includes(d.id));
    if (fromRefs.length) return fromRefs;
    return (declRows || []).filter((d) => Number(d[DB.MARCHE]) === Number(row?.id));
  };

  async function load() {
    setLoading(true); setErr(null);
    try {
      const auth = gristAPI.getAuth();
      const roles = Array.isArray(auth?.roles) ? auth.roles : [];
      if (!auth || !roles.includes('acheteur') || !auth.acheteurId) throw new Error("Accès refusé : rôle 'acheteur' requis.");
      const rawId = (() => { try { return sessionStorage.getItem('acheteurMarcheDetailId'); } catch (_) { return ''; } })();
      const id = Number(rawId);
      if (!Number.isFinite(id)) throw new Error('Aucun marché sélectionné.');
      setMarcheId(id);
      const [uaRows, achRows, clauses, specs, ms, db, refus, bens, invs] = await Promise.all([
        gristAPI.getData(T.UA),
        gristAPI.getData(T.ACH),
        gristAPI.getData(T.C),
        gristAPI.getData(T.SPECS).catch(() => []),
        gristAPI.getData(T.M),
        gristAPI.getData(T.DB).catch(() => []),
        gristAPI.getData(T.REFUS).catch(() => []),
        gristAPI.getData(T.BEN).catch(() => []),
        gristAPI.getData(T.INV).catch(() => []),
      ]);
      const me = (uaRows || []).find((r) => r.id === auth.acheteurId);
      const entite = (achRows || []).find((a) => a.id === me?.Entite_de_rattachement);
      if (!entite) throw new Error('Entité acheteuse introuvable.');
      const row = (ms || []).find((r) => Number(r.id) === id);
      if (!row || Number(row[M.ACHETEUR]) !== Number(entite.id)) throw new Error('Marché introuvable ou non rattaché à votre entité.');
      setOrg(entite);
      setAcheteurUserId(auth.acheteurId);
      setRows(ms || []);
      setOptsClauses(toOptions(clauses || []));
      setOptsSpecs(toOptionsWithTooltip(specs || []));
      setDeclRows(db || []);
      setRefusRows(refus || []);
      setBenefRows(bens || []);
      setInvRows(invs || []);
    } catch (e) {
      setErr(e.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }
  React.useEffect(() => { load(); }, []);

  async function reloadData() {
    const [ms, db, refus, bens, invs] = await Promise.all([
      gristAPI.getData(T.M),
      gristAPI.getData(T.DB).catch(() => []),
      gristAPI.getData(T.REFUS).catch(() => []),
      gristAPI.getData(T.BEN).catch(() => []),
      gristAPI.getData(T.INV).catch(() => []),
    ]);
    setRows(ms || []);
    setDeclRows(db || []);
    setRefusRows(refus || []);
    setBenefRows(bens || []);
    setInvRows(invs || []);
    return { rows: ms || [], invitations: invs || [] };
  }

  async function inviteTitulaire(row) {
    const normalizedEmail = String(inviteEmail || '').trim().toLowerCase();
    if (!row?.id || !emailOk(normalizedEmail)) return;
    if (!invitePlaceNotified) {
      setErr("Merci de confirmer que le titulaire a bien été notifié sur PLACE.");
      return;
    }
    try {
      setInviting(true); setErr(null); setMsg(null);
      await gristAPI.addRecord(T.INV, { Marche: row.id, Email: normalizedEmail });
      await gristAPI.updateRecord(T.M, row.id, { [M.STATUS]: 'En attente de déclaration des bénéficiaires', [M.EXEC_END]: inviteExecEnd || null });
      const parent = row[M.PARENT] ? rowById.get(Number(row[M.PARENT])) : null;
      if (parent) {
        const invitationsWithCurrent = [...invRows, { [INV.MARCHE]: row.id }];
        const allInvited = getLotsForParent(parent).every((lot) => hasInvitationInRows(lot, invitationsWithCurrent));
        if (allInvited) await gristAPI.updateRecord(T.M, parent.id, { [M.STATUS]: 'En attente de déclaration des bénéficiaires' });
      }
      setInviteFor(null);
      setInviteEmail('');
      setInviteExecEnd('');
      setInvitePlaceNotified(false);
      setMsg('Le titulaire a été déclaré.');
      await reloadData();
    } catch (e) {
      setErr(e.message || "Impossible d'enregistrer l'invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function relancerTitulaire(row) {
    if (!row?.id || !canRelanceTitulaire(row)) return;
    try {
      setRelancingId(row.id); setErr(null); setMsg(null);
      const res = await fetch('/api/titulaires/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marche_id: row.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Relance impossible (${res.status}).`);
      const nowStr = ymd(new Date());
      await Promise.all((invRows || [])
        .filter((inv) => Number(inv[INV.MARCHE]) === Number(row.id))
        .map((inv) => gristAPI.updateRecord(T.INV, inv.id, { [INV.LAST_REMINDER]: nowStr })));
      setRelancedId(row.id);
      setTimeout(() => setRelancedId(null), 2500);
      setMsg('La relance a été envoyée.');
      await reloadData();
    } catch (e) {
      setErr(e.message || 'Impossible de relancer le titulaire.');
    } finally {
      setRelancingId(null);
    }
  }

  async function validateDeclaration(row) {
    if (!row?.id) return;
    const missingConfirmation = getDeclsFor(row).some((d) => {
      const isE = toBool(d.Est_beneficiaire_eclauses);
      const confirmations = declConfirmations[d.id] || {};
      return (!isE && !confirmations.eligible) || !confirmations.contract;
    });
    if (missingConfirmation) {
      setErr('Merci de confirmer les deux points obligatoires avant de valider la déclaration.');
      return;
    }
    try {
      setValidating(true); setErr(null); setMsg(null);
      for (const d of getDeclsFor(row)) {
        await gristAPI.updateRecord(T.DB, d.id, { Statut: 'validé' });
      }
      await gristAPI.updateRecord(T.M, row.id, { [M.STATUS]: 'Clause validée' });
      const parent = row[M.PARENT] ? rowById.get(Number(row[M.PARENT])) : null;
      if (parent) {
        const allValidated = getLotsForParent(parent).every((lot) => Number(lot.id) === Number(row.id) || String(lot[M.STATUS] || '') === 'Clause validée');
        if (allValidated) await gristAPI.updateRecord(T.M, parent.id, { [M.STATUS]: 'Clause validée' });
      }
      setDeclFor(null);
      setDeclConfirmations({});
      setMsg('Déclaration validée.');
      await reloadData();
    } catch (e) {
      setErr(e.message || 'Impossible de valider la déclaration.');
    } finally {
      setValidating(false);
    }
  }

  function openRefuseDeclaration(row) {
    if (!row?.id) return;
    setRefuseFor(row);
    setRefuseReason('');
    setRefuseError(null);
    setDeclFor(null);
    setDeclConfirmations({});
  }

  function closeRefuseDeclaration() {
    setRefuseFor(null);
    setRefuseReason('');
    setRefuseError(null);
  }

  async function refuseDeclaration(row) {
    if (!row?.id) return;
    const reason = String(refuseReason || '').trim();
    if (!reason) {
      setRefuseError('Le motif de refus est obligatoire.');
      return;
    }
    const decls = getDeclsFor(row);
    if (!decls.length) {
      setRefuseError('Aucune déclaration à refuser.');
      return;
    }
    try {
      setRefusing(true); setErr(null); setMsg(null);
      await gristAPI.addRecord(T.REFUS, {
        [REFUS.MARCHE]: row.id,
        [REFUS.REFUSE_LE]: new Date().toISOString(),
        [REFUS.REFUSE_PAR]: acheteurUserId || null,
        [REFUS.RAISON]: reason,
      });
      for (const d of decls) {
        await gristAPI.updateRecord(T.DB, d.id, { [DB.STATUT]: 'brouillon' });
      }
      await gristAPI.updateRecord(T.M, row.id, { [M.STATUS]: 'En attente de déclaration des bénéficiaires' });
      closeRefuseDeclaration();
      setMsg('La déclaration a été refusée. Le titulaire peut la corriger.');
      await reloadData();
    } catch (e) {
      setRefuseError(e.message || 'Impossible de refuser la déclaration.');
    } finally {
      setRefusing(false);
    }
  }

  function openDeclarationModal(row) {
    const nextConfirmations = {};
    getDeclsFor(row).forEach((d) => {
      const isE = toBool(d.Est_beneficiaire_eclauses);
      nextConfirmations[d.id] = { eligible: isE, contract: false };
    });
    setDeclConfirmations(nextConfirmations);
    setDeclFor(row);
    setErr(null);
  }

  function closeDeclarationModal() {
    setDeclFor(null);
    setDeclConfirmations({});
  }

  function updateDeclConfirmation(id, key, value) {
    const scrollTop = declModalBodyRef.current?.scrollTop;
    setDeclConfirmations((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
    }));
    requestAnimationFrame(() => {
      if (declModalBodyRef.current && scrollTop != null) {
        declModalBodyRef.current.scrollTop = scrollTop;
      }
    });
  }

  function canValidateDeclaration(row) {
    const decls = getDeclsFor(row);
    if (!decls.length) return false;
    return decls.every((d) => {
      const isE = toBool(d.Est_beneficiaire_eclauses);
      const confirmations = declConfirmations[d.id] || {};
      return (isE || confirmations.eligible) && confirmations.contract;
    });
  }

  async function openBenefDetail(row) {
    if (!row) return;
    const detail = { ...row };
    const cv = asRefIds(detail[B.CV])[0];
    detail.cv_url = cv ? gristAPI.attachmentUrl(cv) : undefined;
    setBenefDetail(detail);
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
      if (cvPreviewObjectUrlRef.current) URL.revokeObjectURL(cvPreviewObjectUrlRef.current);
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

	  const Beneficiaires = ({ row }) => {
	    const list = getDeclsFor(row);
	    if (!list.length) return <p className="fr-text--sm fr-mb-0">Aucun bénéficiaire déclaré.</p>;
	    return (
      <div className="fr-grid-row fr-grid-row--gutters">
        {list.map((d) => {
          const isE = toBool(d.Est_beneficiaire_eclauses);
          const b = isE ? benefMap.get(d.Beneficiaire) : null;
          const nom = isE ? (b?.NOM || b?.Nom || '—') : (d.Nom || '—');
	          const prenom = isE ? (b?.Prenom || b?.PRENOM || '—') : (d.Prenom || '—');
	          const email = isE ? (b?.Courriel || b?.Email || '—') : (d.Email || d.Courriel || '—');
	          const detail = b || d;
	          const statut = String(d.Statut || 'déclaré');
	          const statutCls = statut.toLowerCase() === 'validé' ? 'fr-badge--success' : 'fr-badge--info';
          const nameLabel = `${prenom} ${nom}`.trim() || '—';
	          return (
	            <div className="fr-col-12 fr-col-md-6" key={`decl-${row.id}-${d.id}`}>
	              <div className="fr-card fr-card--sm">
	                <div className="fr-card__body">
	                  <div className="fr-card__content">
	                    <p className={`fr-badge fr-badge--sm ${statutCls} fr-mb-1w`}>{statut}</p>
                    {!isE && <p className="fr-text--sm fr-mb-1w"><strong>Type :</strong> Bénéficiaire externe</p>}
	                    <p className="fr-text--sm fr-mb-1w"><strong>Bénéficiaire :</strong> {isE ? nameLabel : `${nameLabel} (bénéficiaire externe)`}</p>
                    <p className="fr-text--sm fr-mb-0"><strong>Email :</strong> {email}</p>
                    {isE && (
                      <button
                        type="button"
                        className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-eye-line fr-btn--icon-left fr-mt-2w"
                        onClick={() => openBenefDetail({ ...detail, __nom: nom, __prenom: prenom, __email: email })}
                      >
                        Voir la fiche
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
	    );
	  };

  const DeclarationConfirmations = ({ row }) => {
    const list = getDeclsFor(row);
    if (!list.length) return null;
    return (
      <div className="fr-mt-3w">
        <h3 className="fr-h6 fr-mb-2w">Confirmations avant validation</h3>
        {list.map((d) => {
          const isE = toBool(d.Est_beneficiaire_eclauses);
          const b = isE ? benefMap.get(d.Beneficiaire) : null;
          const nom = isE ? (b?.NOM || b?.Nom || '—') : (d.Nom || '—');
          const prenom = isE ? (b?.Prenom || b?.PRENOM || '—') : (d.Prenom || '—');
          const label = `${prenom} ${nom}`.trim() || `Bénéficiaire #${d.id}`;
          const confirmations = declConfirmations[d.id] || {};
          const eligibleChecked = isE || Boolean(confirmations.eligible);
          return (
            <fieldset className="fr-fieldset fr-mb-2w" key={`confirm-${d.id}`}>
              <legend className="fr-fieldset__legend">{label}</legend>
              <div className="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  type="checkbox"
                  id={`confirm-eligible-${d.id}`}
                  checked={eligibleChecked}
                  disabled={isE}
                  onChange={(e) => updateDeclConfirmation(d.id, 'eligible', e.target.checked)}
                />
                <label className="fr-label" htmlFor={`confirm-eligible-${d.id}`}>
                  Je confirme que le bénéficiaire est éligible à la clause sociale du marché
                </label>
              </div>
              <div className="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  type="checkbox"
                  id={`confirm-contract-${d.id}`}
                  checked={Boolean(confirmations.contract)}
                  onChange={(e) => updateDeclConfirmation(d.id, 'contract', e.target.checked)}
                />
                <label className="fr-label" htmlFor={`confirm-contract-${d.id}`}>
                  Je confirme qu'il existe une relation contractuelle entre le titulaire et le bénéficiaire (DC2, DC4 ou embauche directe)
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  };

	  const LotCard = ({ row, parent }) => {
	    const decls = getDeclsFor(row);
	    const invited = hasInvitationInRows(row);
	    const relanceAllowed = canRelanceTitulaire(row);
	    const isDeclarationToValidate = String(row[M.STATUS] || '') === 'Déclaration à valider';
	    return (
      <div className="fr-col-12">
        <div className="fr-card">
          <div className="fr-card__body">
            <div className="fr-card__content">
              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-md-8">
                  <div className="fr-mb-1w">{renderStatus(row[M.STATUS])}</div>
                  <h3 className="fr-h6 fr-mb-2w">
                    {parent ? `Lot ${row[M.LOT] || '—'} - ${row[M.INTITULE_LOT] || 'Sans intitulé'}` : (row[M.INTITULE] || 'Marché')}
                  </h3>
                  <p className="fr-text--sm fr-mb-1w"><strong>Clause :</strong> {clauseLabel(row[M.CLAUSE])}</p>
                  <p className="fr-text--sm fr-mb-1w"><strong>Spécialités :</strong> {specLabels(row[M.SPECS])}</p>
                  <p className="fr-text--sm fr-mb-1w"><strong>Lieu :</strong> {row[M.ADR] || '—'}</p>
                  <p className="fr-text--sm fr-mb-1w"><strong>Fin d’exécution :</strong> {formatDateOrDash(row[M.EXEC_END])}</p>
                </div>
                <div className="fr-col-12 fr-col-md-4">
                  <ul className="fr-btns-group fr-btns-group--right fr-btns-group--sm fr-btns-group--icon-left">
                    {!invited && (
	                      <li><button className="fr-btn fr-icon-checkbox-line" onClick={() => { setInviteFor(row); setInviteExecEnd(ymd(row[M.EXEC_END]) || ''); setInvitePlaceNotified(false); }}>Déclarer le titulaire</button></li>
                    )}
                    {invited && row[M.STATUS] === 'En attente de notification' && (
                      <li><button className="fr-btn fr-btn--secondary" disabled>Titulaire déclaré</button></li>
                    )}
                    {row[M.STATUS] === 'En attente de déclaration des bénéficiaires' && (
                      <li>
                        <button
                          className={`fr-btn fr-icon-refresh-line ${relancedId === row.id ? 'fr-btn--secondary' : 'fr-btn--primary'}`}
                          onClick={() => relancerTitulaire(row)}
                          disabled={!relanceAllowed || relancingId === row.id || relancedId === row.id}
                          title={!relanceAllowed ? `Relance possible ${RELANCE_DELAY_DAYS} jours après la dernière relance.` : undefined}
                        >
                          {relancingId === row.id ? 'Relance…' : (relancedId === row.id ? 'Relance envoyée' : 'Relancer le titulaire')}
                        </button>
                        {renderLastReminder(row)}
                      </li>
                    )}
	                    {isDeclarationToValidate && (
	                      <li><button className="fr-btn fr-icon-eye-line" onClick={() => openDeclarationModal(row)}>Consulter la déclaration</button></li>
	                    )}
                  </ul>
                </div>
              </div>
	              {decls.length > 0 && !isDeclarationToValidate && (
	                <section className="fr-mt-3w">
                  <h4 className="fr-h6 fr-mb-2w">Bénéficiaires déclarés</h4>
                  <Beneficiaires row={row} />
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <section className="fr-container fr-my-6w"><p>Chargement du marché…</p></section>;
  if (err && !marche) return <section className="fr-container fr-my-6w"><div className="fr-alert fr-alert--error fr-mb-3w"><p>{err}</p></div><button className="fr-btn fr-btn--secondary" onClick={goBack}>Retour</button></section>;

  const lots = getLotsForParent(marche);
  const isAlloti = lots.length > 0;
  const rootDecls = getDeclsFor(marche);
  const rootInvited = hasInvitationInRows(marche);
  const rootRelanceAllowed = canRelanceTitulaire(marche);
  const rootDeclarationToValidate = String(marche?.[M.STATUS] || '') === 'Déclaration à valider';
  const displayStatus = isAlloti
    ? getWeakestStatus(lots, marche?.[M.STATUT_GLOBAL] || marche?.[M.STATUS])
    : (marche?.[M.STATUT_GLOBAL] || marche?.[M.STATUS]);

  return (
    <section className="fr-container fr-my-6w">
      {marche?.[M.STATUS] === 'En attente de notification' && (
        <div className="fr-alert fr-alert--info fr-mb-3w">
          <p>
            Si vous souhaitez modifier les informations du marché, merci de contacter le
            {' '}
            <a href="#" data-nav="support" className="fr-link">support Eclauses</a>.
          </p>
        </div>
      )}
      <div className="fr-grid-row fr-grid-row--middle fr-mb-4w">
        <div className="fr-col">
          <h1 className="fr-h3 fr-mb-1w">{marche?.[M.INTITULE_PROP] || marche?.[M.INTITULE] || 'Détail du marché'}</h1>
          <div>{renderStatus(displayStatus)}</div>
        </div>
        <div className="fr-col-auto">
          <button className="fr-btn fr-btn--secondary fr-icon-arrow-left-line fr-btn--icon-left" onClick={goBack}>Retour aux marchés</button>
        </div>
      </div>

      {msg && <div className="fr-alert fr-alert--success fr-mb-3w"><p>{msg}</p></div>}
      {err && <div className="fr-alert fr-alert--error fr-mb-3w"><p>{err}</p></div>}

      <section className="fr-mb-4w">
        <h2 className="fr-h5 fr-mb-2w">Informations du marché</h2>
        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-8">
            <dl className="fr-text--sm">
              <dt className="fr-text--bold">Intitulé</dt><dd>{marche?.[M.INTITULE] || '—'}</dd>
              <dt className="fr-text--bold">Date limite de remise des offres</dt><dd>{formatDateOrDash(marche?.[M.DLRO])}</dd>
              <dt className="fr-text--bold">Date de notification prévisionnelle</dt><dd>{formatDateOrDash(marche?.[M.DNOTPREV])}</dd>
              <dt className="fr-text--bold">Documents de consultation</dt>
              <dd>{marche?.[M.LIEN_DOCS] ? <a className="fr-link" href={marche[M.LIEN_DOCS]} target="_blank" rel="noreferrer">Ouvrir le lien</a> : '—'}</dd>
              {!isAlloti && (
                <>
                  <dt className="fr-text--bold">Clause sociale</dt><dd>{clauseLabel(marche?.[M.CLAUSE])}</dd>
                  <dt className="fr-text--bold">Spécialités</dt><dd>{specLabels(marche?.[M.SPECS])}</dd>
                  <dt className="fr-text--bold">Lieu d’exécution</dt><dd>{marche?.[M.ADR] || '—'}</dd>
                  <dt className="fr-text--bold">Date de fin d’exécution prévisionnelle</dt><dd>{formatDateOrDash(marche?.[M.EXEC_END])}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="fr-col-12 fr-col-md-4">
            {!isAlloti && (
              <ul className="fr-btns-group fr-btns-group--right fr-btns-group--sm fr-btns-group--icon-left">
                {!rootInvited && (
                  <li>
                    <button className="fr-btn fr-icon-checkbox-line" onClick={() => { setInviteFor(marche); setInviteExecEnd(ymd(marche?.[M.EXEC_END]) || ''); setInvitePlaceNotified(false); }}>
                      Déclarer le titulaire
                    </button>
                  </li>
                )}
                {rootInvited && marche?.[M.STATUS] === 'En attente de notification' && (
                  <li><button className="fr-btn fr-btn--secondary" disabled>Titulaire déclaré</button></li>
                )}
                {marche?.[M.STATUS] === 'En attente de déclaration des bénéficiaires' && (
                  <li>
                    <button
                      className={`fr-btn fr-icon-refresh-line ${relancedId === marche.id ? 'fr-btn--secondary' : 'fr-btn--primary'}`}
                      onClick={() => relancerTitulaire(marche)}
                      disabled={!rootRelanceAllowed || relancingId === marche.id || relancedId === marche.id}
                      title={!rootRelanceAllowed ? `Relance possible ${RELANCE_DELAY_DAYS} jours après la dernière relance.` : undefined}
                    >
                      {relancingId === marche.id ? 'Relance…' : (relancedId === marche.id ? 'Relance envoyée' : 'Relancer le titulaire')}
                    </button>
                    {renderLastReminder(marche)}
                  </li>
                )}
                {rootDeclarationToValidate && (
                  <li><button className="fr-btn fr-icon-eye-line" onClick={() => openDeclarationModal(marche)}>Consulter la déclaration</button></li>
                )}
              </ul>
            )}
          </div>
        </div>

        {!isAlloti && rootDecls.length > 0 && !rootDeclarationToValidate && (
          <section className="fr-mt-3w">
            <h3 className="fr-h6 fr-mb-2w">Bénéficiaires déclarés</h3>
            <Beneficiaires row={marche} />
          </section>
        )}
      </section>

      {isAlloti && (
        <section>
          <h2 className="fr-h5 fr-mb-2w">Lots du marché</h2>
          <div className="fr-grid-row fr-grid-row--gutters">
            {lots.map((row) => <LotCard key={`managed-${row.id}`} row={row} parent />)}
          </div>
        </section>
      )}

      {inviteFor && (
        <div role="dialog" aria-modal="true" aria-labelledby="invite-title" className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
             onClick={() => { setInviteFor(null); setInvitePlaceNotified(false); }}>
          <div className="fr-container fr-container--fluid fr-container-md" style={{maxWidth:'640px'}} onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)'}}>
              <h2 id="invite-title" className="fr-h4">Déclarer le titulaire</h2>
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="invite-email">E-mail du titulaire</label>
                <input id="invite-email" className="fr-input" type="email" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value.toLowerCase())} />
                <p className="fr-hint-text">En cas de groupement, déclarez uniquement le mandataire.</p>
                {!emailOk(inviteEmail) && inviteEmail && <p className="fr-error-text">Adresse invalide.</p>}
              </div>
              <div className="fr-input-group">
                <label className="fr-label" htmlFor="invite-exec-end">Date de fin d'exécution prévisionnelle</label>
                <input id="invite-exec-end" className="fr-input" type="date" value={inviteExecEnd} onChange={(e)=>setInviteExecEnd(e.target.value)} />
              </div>
              <div className="fr-checkbox-group fr-checkbox-group--sm fr-mb-2w">
                <input
                  type="checkbox"
                  id="invite-place-notified"
                  checked={invitePlaceNotified}
                  onChange={(e)=>setInvitePlaceNotified(e.target.checked)}
                />
                <label className="fr-label" htmlFor="invite-place-notified">J'ai bien notifié le titulaire sur PLACE</label>
              </div>
              <div className="fr-btns-group fr-btns-group--right">
                <button className="fr-btn" onClick={() => inviteTitulaire(inviteFor)} disabled={inviting || !emailOk(inviteEmail) || !invitePlaceNotified}>{inviting ? 'Enregistrement…' : 'Déclarer le titulaire'}</button>
                <button className="fr-btn fr-btn--secondary" onClick={() => { setInviteFor(null); setInvitePlaceNotified(false); }}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {declFor && (
        <div role="dialog" aria-modal="true" aria-labelledby="decl-title" className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeDeclarationModal}>
          <div className="fr-container fr-container--fluid fr-container-md" style={{maxWidth:'840px'}} onClick={(e)=>e.stopPropagation()}>
            <div
              ref={declModalBodyRef}
              className="fr-card fr-p-3w"
              style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}
            >
              <h2 id="decl-title" className="fr-h4">Bénéficiaires déclarés</h2>
              <Beneficiaires row={declFor} />
              <DeclarationConfirmations row={declFor} />
              <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
                <button className="fr-btn" onClick={() => validateDeclaration(declFor)} disabled={validating || !canValidateDeclaration(declFor)}>{validating ? 'Validation…' : 'Valider les bénéficiaires'}</button>
                <button className="fr-btn fr-btn--secondary" onClick={() => openRefuseDeclaration(declFor)} disabled={validating}>Refuser la déclaration</button>
                <button className="fr-btn fr-btn--secondary" onClick={closeDeclarationModal}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {refuseFor && (
        <div role="dialog" aria-modal="true" aria-labelledby="refuse-title" className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeRefuseDeclaration}>
          <div className="fr-container fr-container--fluid fr-container-md" style={{maxWidth:'640px'}} onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)'}}>
              <h2 id="refuse-title" className="fr-h4">Refuser la déclaration</h2>
              <div className={`fr-input-group ${refuseError ? 'fr-input-group--error' : ''}`}>
                <label className="fr-label" htmlFor="refuse-reason">
                  Indiquer le motif du refus <span className="fr-text-default--error" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="refuse-reason"
                  className="fr-input"
                  rows="5"
                  value={refuseReason}
                  onChange={(e) => { setRefuseReason(e.target.value); setRefuseError(null); }}
                  required
                />
                {refuseError && <p className="fr-error-text">{refuseError}</p>}
              </div>
              <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
                <button className="fr-btn" onClick={() => refuseDeclaration(refuseFor)} disabled={refusing}>
                  {refusing ? 'Refus…' : 'Confirmer le refus'}
                </button>
                <button className="fr-btn fr-btn--secondary" onClick={closeRefuseDeclaration} disabled={refusing}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {benefDetail && (
        <div role="dialog" aria-modal="true" aria-labelledby="benef-detail-title" className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={() => { setBenefDetail(null); closeCvPreview(); }}>
          <div className="fr-container fr-container--fluid fr-container-md" style={{maxWidth:'860px', width:'100%'}} onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w" style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="benef-detail-title" className="fr-h4 fr-mb-0">{fullName(benefDetail)}</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={() => { setBenefDetail(null); closeCvPreview(); }}>Fermer</button>
                </div>
              </div>

              {!canShowContacts(benefDetail) && (
                <div className="fr-alert fr-alert--warning fr-alert--sm fr-mb-4w">
                  <p>Cette personne ne souhaite pas être contactée pour rejoindre un groupement.</p>
                </div>
              )}

              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-lg-7">
                  <dl className="fr-description-list fr-mb-2w">
                    {canShowContacts(benefDetail) && (benefDetail.__email || benefDetail[B.COURRIEL] || benefDetail[B.EMAIL]) && (
                      <>
                        <dt><strong>E-mail</strong></dt>
                        <dd><a href={`mailto:${benefDetail.__email || benefDetail[B.COURRIEL] || benefDetail[B.EMAIL]}`}>{benefDetail.__email || benefDetail[B.COURRIEL] || benefDetail[B.EMAIL]}</a></dd>
                      </>
                    )}
                    {canShowContacts(benefDetail) && benefDetail[B.TEL] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Téléphone</strong></dt><dd>{benefDetail[B.TEL]}</dd>
                      </>
                    )}
                    {benefDetail['Formation_Libelle'] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Formation</strong></dt><dd>{benefDetail['Formation_Libelle']}</dd>
                      </>
                    )}
                    {benefDetail[B.ANNEE_DIP] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Année de diplôme</strong></dt><dd>{benefDetail[B.ANNEE_DIP]}</dd>
                      </>
                    )}
                    {asArray(benefDetail['Specialite_Libelles']).filter((x)=>x !== 'L').join(', ') && (
                      <>
                        <dt className="fr-mt-2w"><strong>Spécialité</strong></dt>
                        <dd>{asArray(benefDetail['Specialite_Libelles']).filter((x)=>x !== 'L').join(', ')}</dd>
                      </>
                    )}
                    {benefDetail[B.SOUS_SPEC] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Sous-spécialité</strong></dt><dd>{benefDetail[B.SOUS_SPEC]}</dd>
                      </>
                    )}
                    {benefDetail[B.MEMOIRE] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Mémoire</strong></dt><dd>{benefDetail[B.MEMOIRE]}</dd>
                      </>
                    )}
                    {benefDetail[B.AUTRES_INFOS] && (
                      <>
                        <dt className="fr-mt-2w"><strong>Autres informations</strong></dt><dd>{benefDetail[B.AUTRES_INFOS]}</dd>
                      </>
                    )}
                    <dt className="fr-mt-2w"><strong>CV</strong></dt>
                    {benefDetail.cv_url ? (
                      <dd>
                        <button
                          className="fr-btn fr-btn--secondary fr-btn--sm"
                          type="button"
                          onClick={() => openCvPreview(benefDetail.cv_url)}
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
                      {asArray(benefDetail['Departement_Libelles']).filter((x)=>x !== 'L').join(', ') || '—'}
                    </p>
                    <p className="fr-text--sm fr-mt-2w"><strong>Régions de mobilité</strong></p>
                    <p className="fr-text--sm">
                      {asArray(benefDetail['Region_Libelles']).filter((x)=>x !== 'L').join(', ') || '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="fr-btns-group fr-btns-group--right fr-mt-2w">
                <button className="fr-btn" onClick={() => { setBenefDetail(null); closeCvPreview(); }}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cvPreviewOpen && cvPreviewUrl && (
        <div role="dialog" aria-modal="true" aria-labelledby="cv-preview-title" className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflow:'auto' }}
             onClick={closeCvPreview}>
          <div className="fr-container fr-container--fluid fr-container-lg" style={{maxWidth:'1100px', width:'100%'}} onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-2w" style={{background:'var(--background-default-grey,#fff)'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="cv-preview-title" className="fr-h5 fr-mb-0">Aperçu du CV</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" type="button" onClick={closeCvPreview}>Fermer</button>
                </div>
              </div>
              <div style={{height:'80vh', border:'1px solid var(--border-default-grey)'}}>
                {cvPreviewLoading && <p className="fr-text--sm fr-p-2w">Chargement du CV…</p>}
                {!cvPreviewLoading && cvPreviewError && <p className="fr-text--sm fr-p-2w">{cvPreviewError}</p>}
                {!cvPreviewLoading && !cvPreviewError && cvPreviewFrameUrl && (
                  <iframe title="Aperçu du CV" src={cvPreviewFrameUrl} style={{width:'100%', height:'100%', border:0}} />
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
