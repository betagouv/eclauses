// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-marches), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  // ===== Tables / Colonnes (strict) =====
  const T = {
    UA: 'Utilisateurs_Acheteurs',
    ACH: 'Acheteurs',
    M:  'Marches',
    C:  'Clauses_sociales',
    // INIT: 'InitLink',              // ← plus utilisé
    INV: 'Invitation_Titulaire',      // ← NOUVELLE TABLE
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

    PARENT: 'Marche_parent',
    LOTS: 'Lots',
    STATUT_GLOBAL: 'Statut_global',
    NB_LOTS_VALIDES: 'Nb_lots_valides',
  };
  const INV = {
    MARCHE: 'Marche',
    LAST_REMINDER: 'Derniere_relance_le',
  };

  const { toOptions, parseDate, formatDate } = gristAPI.helpers;

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
  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''));  
  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const formatDateOrDash = (v) => {
    const d = parseDate(v);
    return d ? formatDate(d) : '—';
  };
  const RELANCE_DELAY_DAYS = (() => {
    const raw = gristAPI.getEnv ? gristAPI.getEnv('RELANCE_TITULAIRE_DELAY_DAYS', '7') : '7';
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 7;
  })();

  // ===== State =====
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const [org, setOrg] = React.useState(null);
  const [rows, setRows] = React.useState([]);

  const [optsClauses, setOptsClauses] = React.useState([]);
  const [invRows, setInvRows] = React.useState([]);
  const [msg, setMsg] = React.useState(null);
  const [copiedId, setCopiedId] = React.useState(null);
  const [relancingId, setRelancingId] = React.useState(null);
  const [relancedId, setRelancedId] = React.useState(null);

  // Filtres globaux
  const [search, setSearch] = React.useState('');
  const [clauseFilter, setClauseFilter] = React.useState('');

  // Invitation (modale)
  const [inviteFor, setInviteFor] = React.useState(null);
  const [inviteForRow, setInviteForRow] = React.useState(null);

  const [hasInvited, setHasInvited] = React.useState(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteExecEnd, setInviteExecEnd] = React.useState('');
  const [invitePlaceNotified, setInvitePlaceNotified] = React.useState(false);
  const [inviting, setInviting] = React.useState(false);
  const [modalInviteOpen, setModalInviteOpen] = React.useState(false);
  const [inviteMsg, setInviteMsg] = React.useState(null);   // ← message court en cas de succès
  const [modalTitulaireLotsOpen, setModalTitulaireLotsOpen] = React.useState(false);
  const [titulaireLotsFor, setTitulaireLotsFor] = React.useState(null);

  const [modalPubOpen, setModalPubOpen] = React.useState(false);
  const [pubLink, setPubLink] = React.useState('');
  const [pubDate, setPubDate] = React.useState('');
  const [pubFor, setPubFor] = React.useState(null);
  const [pubMarche, setPubMarche] = React.useState(null);

  // Suppression
  const [deletingId, setDeletingId] = React.useState(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteRowItem, setDeleteRowItem] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      const auth = gristAPI.getAuth();
      const roles = Array.isArray(auth?.roles) ? auth.roles : [];
      if (!auth || !roles.includes('acheteur') || !auth.acheteurId) {
        setErr("Accès refusé : rôle 'acheteur' requis.");
        setLoading(false);
        return;
      }

      const uaRows = await gristAPI.getData(T.UA);
      const me = uaRows.find(r => r.id === auth.acheteurId);
      if (!me?.Entite_de_rattachement) {
        setErr("Votre compte n'est rattaché à aucune entité acheteuse.");
        setLoading(false);
        return;
      }
      const achRows = await gristAPI.getData(T.ACH);
      const entite = achRows.find(a => a.id === me.Entite_de_rattachement);
      if (!entite) {
        setErr("Entité acheteuse introuvable.");
        setLoading(false);
        return;
      }
      setOrg(entite);

      const c = await gristAPI.getData(T.C);
      setOptsClauses(toOptions(c || []));

      const [ms, invs] = await Promise.all([
        gristAPI.getData(T.M),
        gristAPI.getData(T.INV).catch(() => []),
      ]);
      const mine = (ms || []).filter(m => m[M.ACHETEUR] === entite.id);
      setRows(mine);
      setInvRows(invs || []);

      setLoading(false);
    })();
  }, []);

  const clauseLabel = React.useCallback((id) => {
    const o = optsClauses.find(x => x.value === id);
    return o ? o.label : String(id ?? '—');
  }, [optsClauses]);
  const invById = React.useMemo(() => {
    const map = new Map();
    (invRows || []).forEach(inv => map.set(inv.id, inv));
    return map;
  }, [invRows]);
  const rowById = React.useMemo(() => {
    const map = new Map();
    (rows || []).forEach(r => map.set(r.id, r));
    return map;
  }, [rows]);
  const isLot = React.useCallback((row) => Boolean(row?.[M.PARENT]), []);
  const getLotsForParent = React.useCallback((row) => {
    if (!row) return [];
    const ids = asArray(row[M.LOTS])
      .filter((x) => x !== 'L' && x != null && x !== '')
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x));
    const fromRefList = ids.map((id) => rowById.get(id)).filter(Boolean);
    const lots = fromRefList.length
      ? fromRefList
      : (rows || []).filter((r) => Number(r[M.PARENT]) === Number(row.id));
    return lots.slice().sort(compareByLot);
  }, [rowById, rows]);
  const getDisplayStatus = React.useCallback((row) => row?.[M.STATUT_GLOBAL] || row?.[M.STATUS] || '', []);
  const getConsultationDisplayStatus = React.useCallback((row) => {
    const lots = getLotsForParent(row);
    if (lots.length > 0 && lots.some((lot) => String(lot[M.STATUS] || '') === 'En attente de notification')) {
      return 'En attente de notification';
    }
    return getDisplayStatus(row);
  }, [getDisplayStatus, getLotsForParent]);
  const getMarketClauses = React.useCallback((row) => {
    const lots = getLotsForParent(row);
    const ids = (lots.length ? lots : [row])
      .map((r) => r?.[M.CLAUSE])
      .filter((id) => id != null && id !== '');
    return [...new Set(ids)];
  }, [getLotsForParent]);
  function compareByLot(a, b) {
    const lotA = String(a?.[M.LOT] ?? '').trim();
    const lotB = String(b?.[M.LOT] ?? '').trim();
    const nA = Number(lotA);
    const nB = Number(lotB);
    const numA = Number.isFinite(nA);
    const numB = Number.isFinite(nB);
    if (numA && numB && nA !== nB) return nA - nB;
    return lotA.localeCompare(lotB, 'fr', { numeric: true, sensitivity: 'base' });
  }

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
    const opt = STATUS_OPTIONS.find(o => o.value === v);
    const cls = opt?.cls || 'fr-badge--grey';
    const label = opt?.label || v;
    return <span className={`fr-badge fr-badge--sm ${cls}`}>{label}</span>;
  };

  const copyLink = (row) => {
    const url = row?.[M.LIEN] || '';
    if (!url) {
      setErr("Aucun lien d'inscription candidat disponible pour ce marché.");
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(row?.id || null);
      setTimeout(() => setCopiedId(null), 2500);
      setErr(null);
    }).catch((e) => console.log(e) && setErr("Impossible de copier le lien."));
  };
  const hasInvitation = (row) => {
    if (!row?.id) return false;
    return (invRows || []).some((inv) => Number(inv[INV.MARCHE]) === Number(row.id));
  };
  const hasInvitationInRows = (row, invitations) => {
    if (!row?.id) return false;
    return (invitations || []).some((inv) => Number(inv[INV.MARCHE]) === Number(row.id));
  };
  const getInvitationRowsForMarche = React.useCallback((row) => {
    if (!row) return [];
    const ids = asArray(row[M.INVIT])
      .filter((x) => x !== 'L' && x != null && x !== '')
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x));
    const fromRefs = ids.map((id) => invById.get(id)).filter((inv) => Number(inv?.[INV.MARCHE]) === Number(row.id));
    const fromRows = (invRows || []).filter((inv) => Number(inv[INV.MARCHE]) === Number(row.id));
    return fromRefs.length ? fromRefs : fromRows;
  }, [invById, invRows]);
  const getLastReminderDate = React.useCallback((row) => {
    const invites = getInvitationRowsForMarche(row);
    let bestTs = null;
    invites.forEach((inv) => {
      const d = parseDate(inv?.[INV.LAST_REMINDER]);
      if (!d) return;
      d.setHours(0, 0, 0, 0);
      const ts = d.getTime();
      if (bestTs == null || ts > bestTs) bestTs = ts;
    });
    return bestTs == null ? null : new Date(bestTs);
  }, [getInvitationRowsForMarche, parseDate]);
  const canRelanceTitulaire = React.useCallback((row) => {
    if (!row || !hasInvitation(row)) return false;
    const last = getLastReminderDate(row);
    if (!last) return true;
    const now = today();
    const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);
    return diffDays >= RELANCE_DELAY_DAYS;
  }, [getLastReminderDate, RELANCE_DELAY_DAYS]);
  async function relancerTitulaire(row) {
    if (!row || !row.id) return;
    if (!canRelanceTitulaire(row)) return;

    try {
      setErr(null);
      setMsg(null);
      setRelancingId(row.id);

      const res = await fetch('/api/titulaires/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marche_id: row.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Relance impossible (${res.status}).`);
      }

      const invites = getInvitationRowsForMarche(row);
      if (invites.length) {
        const nowStr = ymd(new Date());
        await Promise.all(invites.map((inv) => gristAPI.updateRecord(T.INV, inv.id, { [INV.LAST_REMINDER]: nowStr })));
      }

      setRelancedId(row.id);
      setTimeout(() => setRelancedId(null), 2500);
      await reloadMine();
    } catch (e) {
      setErr(e.message || 'Impossible de relancer le titulaire.');
    } finally {
      setRelancingId(null);
    }
  }

  const applyCommonFilters = React.useCallback((list) => {
    const s = (search || '').toLowerCase();
    const cf = clauseFilter ? Number(clauseFilter) : null;

    return list.filter(r => {
      const lots = getLotsForParent(r);
      const clauseIds = getMarketClauses(r);
      if (cf !== null && !clauseIds.includes(cf)) return false;
      if (s) {
        const hay = [
          r[M.INTITULE_PROP] || '',
          r[M.INTITULE] || '',
          r[M.ADR] || '',
          ...lots.map(l => [l[M.LOT] || '', l[M.INTITULE_LOT] || '', l[M.ADR] || '', clauseLabel(l[M.CLAUSE])].join(' ')),
          clauseIds.map(clauseLabel).join(' ')
        ].join(' • ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [search, clauseFilter, clauseLabel, getLotsForParent, getMarketClauses]);

  const compareByDlroThenLot = React.useCallback((a, b) => {
    const da = parseDate(a[M.DLRO])?.getTime() || 0;
    const db = parseDate(b[M.DLRO])?.getTime() || 0;
    if (da !== db) return da - db;

    const lotA = String(a[M.LOT] ?? '').trim();
    const lotB = String(b[M.LOT] ?? '').trim();
    const hasA = lotA !== '';
    const hasB = lotB !== '';
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    if (!hasA && !hasB) return 0;

    const nA = Number(lotA);
    const nB = Number(lotB);
    const numA = Number.isFinite(nA);
    const numB = Number.isFinite(nB);
    if (numA && numB && nA !== nB) return nA - nB;

    return lotA.localeCompare(lotB, 'fr', { numeric: true, sensitivity: 'base' });
  }, [parseDate]);

  const lists = React.useMemo(() => {
    const base = (Array.isArray(rows) ? rows : []).filter(r => !isLot(r));
    const notif = [];
    const pub = [];
    const decl = [];
    const avalider = [];
    const valide = [];

    base.forEach(r => {
      const status = (getDisplayStatus(r) || '').toString();
      const lots = getLotsForParent(r);
      if (lots.length > 0) {
        const lotStatuses = lots.map((lot) => String(lot[M.STATUS] || ''));
        const hasLotWithoutTitulaire = lots.some((lot) => !hasInvitation(lot));
        const hasLotDecl = lotStatuses.includes('En attente de déclaration des bénéficiaires');
        const hasLotAValider = lotStatuses.includes('Déclaration à valider');
        const allLotsValides = lots.length > 0 && lotStatuses.every((s) => s === 'Clause validée' || s === 'Archivé');
        const allLotsArchives = lots.length > 0 && lotStatuses.every((s) => s === 'Archivé');

        if (status === 'En attente de publication') pub.push(r);
        if (status === 'En attente de notification' || (status !== 'En attente de publication' && hasLotWithoutTitulaire)) notif.push(r);
        if (hasLotDecl || status === 'En attente de déclaration des bénéficiaires') decl.push(r);
        if (hasLotAValider || status === 'Déclaration à valider') avalider.push(r);
        if (allLotsValides || allLotsArchives || status === 'Clause validée' || status === 'Archivé') valide.push(r);
        return;
      }

      if (status === 'En attente de publication') { pub.push(r); return; }
      if (status === 'En attente de notification') { notif.push(r); return; }
      if (status === 'Déclaration à valider') { avalider.push(r); return; }
      if (status === 'En attente de déclaration des bénéficiaires') { decl.push(r); return; }
      if (status === 'Clause validée') { valide.push(r); return; }
      if (status === 'Archivé') { valide.push(r); return; }
      // fallback : sans statut on range en notification
      console.log("Statut inconnu", r);
    });

    pub.sort(compareByDlroThenLot);
    notif.sort(compareByDlroThenLot);
    decl.sort((a,b) => (parseDate(a[M.DNOTPREV])?.getTime()||0) - (parseDate(b[M.DNOTPREV])?.getTime()||0));
    avalider.sort((a,b) => (parseDate(a[M.EXEC_END])?.getTime()||0) - (parseDate(b[M.EXEC_END])?.getTime()||0));
    valide.sort((a,b) => (parseDate(b[M.EXEC_END])?.getTime()||0) - (parseDate(a[M.EXEC_END])?.getTime()||0));
    const enCours = [...decl, ...avalider].filter((row, idx, arr) => arr.findIndex((item) => item.id === row.id) === idx);
    enCours.sort((a,b) => (parseDate(a[M.DNOTPREV])?.getTime()||0) - (parseDate(b[M.DNOTPREV])?.getTime()||0));

    return {
      pub: applyCommonFilters(pub),
      notif: applyCommonFilters(notif),
      decl: applyCommonFilters(decl),
      avalider: applyCommonFilters(avalider),
      enCours: applyCommonFilters(enCours),
      valide: applyCommonFilters(valide),
    };
  }, [rows, invRows, applyCommonFilters, compareByDlroThenLot, getDisplayStatus, getLotsForParent, isLot]);

  const goToDeclarationsToValidate = React.useCallback((e) => {
    e.preventDefault();
    const tabsRoot = document.querySelector('.fr-tabs');
    if (tabsRoot) {
      const targetPanelId = 'tab-decl';
      const tabButtons = tabsRoot.querySelectorAll('[role="tab"]');
      const tabPanels = tabsRoot.querySelectorAll('[role="tabpanel"]');

      tabButtons.forEach((btn) => {
        const isTarget = btn.getAttribute('aria-controls') === targetPanelId;
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        btn.classList.toggle('fr-tabs__tab--selected', isTarget);
      });

      tabPanels.forEach((panel) => {
        const isTarget = panel.id === targetPanelId;
        panel.classList.toggle('fr-tabs__panel--selected', isTarget);
        if (isTarget) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
    }

    setTimeout(() => {
      const target = document.getElementById('section-declaration-a-valider');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }, []);

  // ===== CRUD =====
  async function reloadMine() {
    const [ms, invs] = await Promise.all([
      gristAPI.getData(T.M),
      gristAPI.getData(T.INV).catch(() => []),
    ]);
    setRows((ms || []).filter(m => m[M.ACHETEUR] === org.id));
    setInvRows(invs || []);
    return { marches: ms || [], invitations: invs || [] };
  }

  function openPubModal(row) {
    setPubFor(row.id);
    setPubMarche(row);
    setPubDate(ymd(row[M.PUB]) || '');
    setPubLink(row[M.LIEN_DOCS] || '');
    setModalPubOpen(true);
    setErr(null); setMsg(null);
  }
  function closePubModal() {
    setModalPubOpen(false);
    setPubFor(null);
    setPubMarche(null);
    setPubDate('');
    setPubLink('');
  }

  async function savePublication(marcheId) {
    if (!marcheId) return;
    setErr(null); setMsg(null);
    if (!pubDate || !isValidDateStr(pubDate)) {
      setErr("La date de publication est requise.");
      return;
    }
    const raw = String(pubLink || '').trim();
    if (!raw) {
      setErr("Le lien vers les documents de consultation est requis.");
      return;
    }
    try {
      const fixedLink = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : '';
      await gristAPI.updateRecord(T.M, marcheId, {
        [M.PUB]: pubDate,
        [M.LIEN_DOCS]: fixedLink || null,
        [M.STATUS]: 'En attente de notification',
      });
      const lots = getLotsForParent(rowById.get(marcheId) || pubMarche);
      for (const lot of lots) {
        await gristAPI.updateRecord(T.M, lot.id, {
          [M.PUB]: pubDate,
          [M.LIEN_DOCS]: fixedLink || null,
          [M.STATUS]: 'En attente de notification',
        });
      }
      setMsg("Publication déclarée. Retrouvez ce marché dans l'onglet 'Consultation et passation'.");
      closePubModal();
      await reloadMine();
    } catch (e) {
      setErr(e.message || "Impossible d'enregistrer la publication.");
    }
  }

  // Invitation via modale → écrit dans Invitation_Titulaire
  function openInviteModal(row) {
    setInviteFor(row.id);
    setInviteForRow(row);
    setHasInvited(hasInvitation(row));
    setInviteEmail('');
    setInviteExecEnd(ymd(row[M.EXEC_END]) || '');
    setInvitePlaceNotified(false);
    setInviteMsg(null);
    setModalInviteOpen(true);
  }
  function openTitulaireLotsModal(row) {
    setTitulaireLotsFor(row);
    setModalTitulaireLotsOpen(true);
    setErr(null);
  }
  function closeTitulaireLotsModal() {
    setModalTitulaireLotsOpen(false);
    setTitulaireLotsFor(null);
  }
  function openInviteModalFromLot(row) {
    closeTitulaireLotsModal();
    openInviteModal(row);
  }
  function closeInviteModal() {
    setModalInviteOpen(false);
    setInviteFor(null);
    setInviteForRow(null);
    setHasInvited(null);
    setInviteEmail('');
    setInviteExecEnd('');
    setInvitePlaceNotified(false);
    setInviteMsg(null);
  }
  async function inviteTitulaire(marcheId) {
    const normalizedEmail = String(inviteEmail || '').trim().toLowerCase();
    if (!emailOk(normalizedEmail)) {
      setErr("Adresse e-mail titulaire invalide.");
      return;
    }
    if (!invitePlaceNotified) {
      setErr("Merci de confirmer que le titulaire a bien été notifié sur PLACE.");
      return;
    }
    try {
      setInviting(true);
      // ⬇️ Remplace InitLink par Invitation_Titulaire : Grist génère le Token
      await gristAPI.addRecord(T.INV, { Marche: marcheId, Email: normalizedEmail });
      const invitationsWithCurrent = [...(invRows || []), { [INV.MARCHE]: marcheId }];
      const invitedRow = inviteForRow || rowById.get(marcheId);
      const parentId = invitedRow?.[M.PARENT];
      const parentRow = parentId ? rowById.get(Number(parentId)) : null;

      if (!parentRow) {
        await gristAPI.updateRecord(T.M, marcheId, { [M.STATUS]: 'En attente de déclaration des bénéficiaires', [M.EXEC_END]: inviteExecEnd || null });
      } else {
        await gristAPI.updateRecord(T.M, marcheId, { [M.STATUS]: 'En attente de déclaration des bénéficiaires', [M.EXEC_END]: inviteExecEnd || null });
        const lots = getLotsForParent(parentRow);
        const allLotsInvited = lots.length > 0 && lots.every((lot) => hasInvitationInRows(lot, invitationsWithCurrent));
        if (allLotsInvited) {
          await gristAPI.updateRecord(T.M, parentRow.id, { [M.STATUS]: 'En attente de déclaration des bénéficiaires' });
        } else if (parentRow[M.STATUS] === 'En attente de déclaration des bénéficiaires') {
          await gristAPI.updateRecord(T.M, parentRow.id, { [M.STATUS]: 'En attente de notification' });
        }
      }
      setInviteMsg("Le titulaire a été déclaré et invité à rejoindre Eclauses.");
      const refreshed = await reloadMine();
      if (parentRow) {
        closeInviteModal();
        const refreshedRows = refreshed?.marches || [];
        const refreshedInvitations = refreshed?.invitations || invitationsWithCurrent;
        const refreshedById = new Map(refreshedRows.map((row) => [row.id, row]));
        const refreshedParent = refreshedById.get(parentRow.id) || parentRow;
        const lots = getLotsForParent(parentRow);
        const allLotsInvited = lots.length > 0 && lots.every((lot) => hasInvitationInRows(lot, refreshedInvitations));
        if (!allLotsInvited) {
          setTitulaireLotsFor(refreshedParent);
          setModalTitulaireLotsOpen(true);
        }
      } else {
        setTimeout(closeInviteModal, 1200);
      }
    } catch (e) {
      setErr(e.message || "Impossible d’enregistrer l’invitation.");
    } finally {
      setInviting(false);
    }
  }

  function goToDetailMarche(row) {
    if (!row?.id) return;
    try { sessionStorage.setItem('acheteurMarcheDetailId', String(row.id)); } catch (_) {}
    if (gristAPI.navigate) gristAPI.navigate('acheteur-marches-detail');
  }
  function goToEditMarche(row) {
    if (!row?.id) return;
    try { sessionStorage.setItem('acheteurMarcheEditId', String(row.id)); } catch (_) {}
    if (gristAPI.navigate) gristAPI.navigate('acheteur-marches-modification');
  }

  function openDeleteModal(row) {
    setDeleteRowItem(row);
    setDeleteOpen(true);
  }
  function closeDeleteModal() {
    setDeleteOpen(false);
    setDeleteRowItem(null);
  }
  async function deleteRowConfirmed() {
    const id = deleteRowItem?.id;
    if (!id) return;
    setErr(null);
    try {
      setDeletingId(id);
      const lots = getLotsForParent(deleteRowItem);
      for (const lot of lots) {
        await gristAPI.deleteRecord(T.M, lot.id);
      }
      await gristAPI.deleteRecord(T.M, id);
      const deletedIds = new Set([id, ...lots.map(l => l.id)]);
      setRows(rows.filter(r => !deletedIds.has(r.id)));
      closeDeleteModal();
    } catch (e) {
      setErr(e.message || 'Suppression impossible.');
    } finally {
      setDeletingId(null);
    }
  }

  // ===== Lignes =====
  function RowViewConsultation({r}) {
    const dlro = parseDate(r[M.DLRO]);
    const aa = r[M.INTITULE_PROP] || r[M.INTITULE] || '—';
    const status = renderStatus(getConsultationDisplayStatus(r));
    const lots = getLotsForParent(r);
    const isAllotted = lots.length > 0;
    const clauseTxt = getMarketClauses(r).map(clauseLabel).join(', ') || '—';
    return (
      <div className="fr-col-12">
        <div className="fr-card fr-card--horizontal">
          <div className="fr-card__body">
            <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
              <div className="fr-col-12 fr-col-md-8">
                <div className="fr-card__content">
                  <div className="fr-mb-1w">{status}</div>
                  <h3 className="fr-card__title fr-text--md">{aa}</h3>
                  <p className="fr-card__desc fr-text--sm">
                    Date limite de remise des offres : <strong>{dlro ? formatDate(dlro) : '—'}</strong>
                  </p>
                  { lots.length > 0 ? (
	                     <p className="fr-card__desc fr-text--sm">
	                      Nombre de lots : <strong>{lots.length}</strong>
	                    </p>
	                  ) : (
	                    <p className="fr-card__desc fr-text--sm">
	                      Clause sociale : <strong>{clauseTxt}</strong>
	                    </p>
	                    )}
	                </div>
              </div>
              <div className="fr-col-12 fr-col-md-4">
                <div className="fr-card__footer">
                  <ul className="fr-btns-group fr-btns-group--right fr-btns-group--icon-left fr-btns-group--sm">
                    <li>
                      <button
                        className="fr-btn fr-btn--primary fr-btn--sm fr-icon-checkbox-line"
                        onClick={()=>isAllotted ? openTitulaireLotsModal(r) : openInviteModal(r)}
                      >
                        {isAllotted ? 'Déclarer les titulaires' : 'Déclarer le titulaire'}
                      </button>
                    </li>
                     <li>
                        <button
                          className={`fr-btn fr-btn--secondary ${copiedId === r.id ? 'fr-icon-check-line' : 'fr-icon-clipboard-line'}`}
                          onClick={()=>copyLink(r)}
                        >
                          {copiedId === r.id ? 'Lien copié' : "Copier le lien d'inscription des candidats"}
                        </button>
                      </li>
                    <li>
                      <button className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-eye-line" onClick={()=>goToDetailMarche(r)}>
                        Détail du marché
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
  }

  const getLotStatusGroups = (row) => {
    const lots = getLotsForParent(row);
    const groups = [
      {
        key: 'decl',
        label: 'En attente de déclaration des bénéficiaires',
        cls: 'fr-badge--warning',
        lots: lots.filter((lot) => String(lot[M.STATUS] || '') === 'En attente de déclaration des bénéficiaires'),
      },
      {
        key: 'avalider',
        label: 'Déclaration à valider',
        cls: 'fr-badge--info',
        lots: lots.filter((lot) => String(lot[M.STATUS] || '') === 'Déclaration à valider'),
      },
      {
        key: 'valide',
        label: 'Clause sociale validée',
        cls: 'fr-badge--success',
        lots: lots.filter((lot) => String(lot[M.STATUS] || '') === 'Clause validée'),
      },
    ];
    return groups;
  };
  const statusBadgeClass = (status) => {
    const opt = STATUS_OPTIONS.find((o) => o.value === status);
    return opt?.cls || 'fr-badge--grey';
  };

  function RowViewExecutionMarket({r, archived = false}) {
    const lots = getLotsForParent(r);
    const dExecEnd = lots.map(l => parseDate(l[M.EXEC_END])).filter(Boolean).sort((a,b)=>b-a)[0] || parseDate(r[M.EXEC_END]);
    const aa = r[M.INTITULE_PROP] || r[M.INTITULE] || '—';
    const displayStatus = getDisplayStatus(r);
    const groups = getLotStatusGroups(r);
    if (archived) {
      return (
        <div className="fr-col-12">
          <div className="fr-card fr-card--horizontal">
            <div className="fr-card__body">
              <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
                <div className="fr-col-12 fr-col-md-8">
                  <div className="fr-card__content">
                    <div className="fr-mb-1w">{renderStatus(displayStatus)}</div>
                    <h3 className="fr-card__title fr-text--md">{aa}</h3>
                    {lots.length == 0 && (
                     <p className="fr-card__desc fr-text--sm">Fin d’exécution prévisionnelle : <strong>{dExecEnd ? formatDate(dExecEnd) : '—'}</strong></p>
                    )}
                  </div>
                </div>
                <div className="fr-col-12 fr-col-md-4">
                  <div className="fr-card__footer">
                    <ul className="fr-btns-group fr-btns-group--right fr-btns-group--icon-left fr-btns-group--sm">
                      <li>
                        <button className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-eye-line" onClick={()=>goToDetailMarche(r)}>
                          Détails du marché
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
    }

    return (
      <div className="fr-col-12">
        <div className="fr-card fr-card--horizontal">
          <div className="fr-card__body">
            <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
              <div className="fr-col-12 fr-col-md-8">
                <div className="fr-mb-3w">
                  <h3 className="fr-h6 fr-mt-3w fr-mb-2w">{aa}</h3>
                  {lots.length > 0 ? (
                    <div className="fr-mt-3w">
                    <strong>Etat des lots du marché :</strong>
                    <ul className="fr-mb-0">
	                      {groups.map((group) => (
	                        <li key={group.key}>
	                          <p className={`fr-badge fr-badge--sm ${group.lots.length ? group.cls : 'fr-badge--grey'}`}>
	                            {group.label} : {group.lots.length}
	                          </p>
	                        </li>
	                      ))}
                    </ul>
                    </div>
                  ) : (
                    <>
                    <p className="fr-card__desc fr-text--sm">Fin d’exécution prévisionnelle : <strong>{dExecEnd ? formatDate(dExecEnd) : '—'}</strong></p>
                    <ul className="fr-badges-group fr-mt-3w fr-mb-0">
                      <li>
                        <p className={`fr-badge fr-badge--sm ${statusBadgeClass(displayStatus)}`}>
                          {displayStatus || 'Statut non renseigné'}
                        </p>
                      </li>
                    </ul>
                    </>
                  )}
                </div>
              </div>
              <div className="fr-col-12 fr-col-md-4">
                <div className="fr-card__footer">
                  <ul className="fr-btns-group fr-btns-group--right fr-btns-group--icon-left fr-btns-group--sm">
                    <li>
                      <button className={`fr-btn ${archived ? 'fr-btn--secondary' : 'fr-btn--primary'} fr-btn--sm fr-icon-eye-line`} onClick={()=>goToDetailMarche(r)}>
                        {archived ? 'Détails du marché' : 'Gérer le marché'}
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

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Mes marchés</h1>
      </header>

      {msg && (
        <div className="fr-alert fr-alert--success fr-mb-4w">
          <p>{msg}</p>
          <button className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" onClick={() => setMsg(null)}>Fermer</button>
        </div>
      )}

      

      {/* Filtres globaux */}
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom fr-mt-3w fr-mb-3w">
        
        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-select-group">
            <label className="fr-label" htmlFor="f-clause">Filtrer par clause</label>
            <select id="f-clause" className="fr-select"
                    value={clauseFilter} onChange={(e)=>setClauseFilter(e.target.value)}>
              <option value="">Toutes les clauses</option>
              {optsClauses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <button className="fr-btn fr-icon-add-line fr-btn--icon-left" onClick={()=>gristAPI.navigate && gristAPI.navigate('acheteur-marches-declaration')}>
            Déclarer un marché
          </button>
        </div>
      </div>

      {lists.avalider.length > 0 && (
        <div className="fr-alert fr-alert--warning fr-mb-3w">
          <p>
            Attention, vous avez des déclarations de bénéficiaires à valider.
            {' '}
            <a href="#section-declaration-a-valider" className="fr-link" onClick={goToDeclarationsToValidate}>Aller à la section “En cours de validation
”</a>.
          </p>
        </div>
      )}

      {/* Tabs par statut */}
      <div className="fr-tabs fr-mt-4w">
        <ul className="fr-tabs__list" role="tablist">
          <li role="presentation">
            <button
              className="fr-tabs__tab fr-tabs__tab--selected"
              aria-selected="true"
              role="tab"
              aria-controls="tab-pub"
            >
              Préparation du marché <span className="fr-badge fr-badge--sm fr-ml-1w">{lists.pub.length}</span>
            </button>

          </li>
          <li role="presentation">
            <button
              className="fr-tabs__tab"
              aria-selected="false"
              role="tab"
              aria-controls="tab-notif"
            >
              Consultation et passation <span className="fr-badge fr-badge--sm fr-ml-1w">{lists.notif.length}</span>
            </button>
          </li>
          <li role="presentation">
            <button
              className="fr-tabs__tab"
              aria-selected="false"
              role="tab"
              aria-controls="tab-decl"
            >
              Exécution <span className="fr-badge fr-badge--sm fr-ml-1w">{(lists.enCours.length + lists.valide.length)}</span>
            </button>
          </li>
          
        </ul>

        <div id="tab-pub" className="fr-tabs__panel fr-tabs__panel--selected" role="tabpanel">
          {lists.pub.length === 0 ? (
            <div className="fr-callout"><p className="fr-callout__text">Aucun marché en attente de publication.</p></div>
          ) : (
            <div className="fr-grid-row fr-grid-row--gutters">
              {lists.pub.map(r => (
                <div className="fr-col-12" key={r.id}>
                  <div className="fr-card fr-card--horizontal">
                    <div className="fr-card__body">
                      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
                        <div className="fr-col-12 fr-col-md-8">
                          <div className="fr-card__content">
                            <div className="fr-mb-1w">{renderStatus(getDisplayStatus(r))}</div>
                            <h3 className="fr-card__title fr-text--md">{r[M.INTITULE_PROP] || r[M.INTITULE] || '—'}</h3>
                            <p className="fr-card__desc fr-text--sm">
                              Date limite de remise des offres : <strong>{formatDate(parseDate(r[M.DLRO]))}</strong>
                            </p>

                            { getLotsForParent(r).length > 0 ? (
	                     <p className="fr-card__desc fr-text--sm">
	                      Nombre de lots : <strong>{getLotsForParent(r).length}</strong>
	                    </p>
	                  ) : (
	                    <p className="fr-card__desc fr-text--sm">
	                      Clause sociale : <strong>{getMarketClauses(r).map(clauseLabel).join(', ') || '—'}</strong>
	                    </p>
	                    )}
	                          </div>
                        </div>
                        <div className="fr-col-12 fr-col-md-4">
                          <div className="fr-card__footer">
                            <ul className="fr-btns-group fr-btns-group--sm fr-btns-group--icon-left fr-btns-group--right fr-mt-2w">
                              <li>
	                                <button className="fr-btn fr-btn--primary fr-icon-checkbox-line" onClick={()=>openPubModal(r)}>
	                                  Déclarer la publication du marché
	                                </button>
                              </li>
                              <li>
                                <button
                                  className={`fr-btn fr-btn--secondary ${copiedId === r.id ? 'fr-icon-check-line' : 'fr-icon-clipboard-line'}`}
                                  onClick={()=>copyLink(r)}
                                >
                                  {copiedId === r.id ? 'Lien copié' : "Copier le lien d'inscription des candidats"}
                                </button>
                              </li>
                              <li>
                                <button className="fr-btn fr-btn--secondary fr-icon-edit-line" onClick={()=>goToEditMarche(r)}>
                                  Modifier
                                </button>
                              </li>
                              <li>
                                <button className="fr-btn fr-btn--secondary fr-icon-delete-bin-line" onClick={()=>openDeleteModal(r)}>
                                  Supprimer
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
        </div>

        <div id="tab-notif" className="fr-tabs__panel" role="tabpanel" hidden>

          {lists.notif.length === 0 ? (
            <div className="fr-callout"><p className="fr-callout__text">Aucun marché en attente de notification.</p></div>
          ) : (
            <div className="fr-grid-row fr-grid-row--gutters">
              {lists.notif.map(r => <RowViewConsultation key={r.id} r={r}/>)}
            </div>
          )}
        </div>

        <div id="tab-decl" className="fr-tabs__panel" role="tabpanel" hidden>
          <h2 id="section-declaration-a-valider" className="fr-h5 fr-mb-2w">En cours de validation</h2>
          {lists.enCours.length === 0 ? (
            <div className="fr-callout fr-mb-4w"><p className="fr-callout__text">Aucun marché en cours de validation.</p></div>
          ) : (
            <div className="fr-grid-row fr-grid-row--gutters fr-mb-4w">
              {lists.enCours.map(r => <RowViewExecutionMarket key={r.id} r={r} />)}
            </div>
          )}

          <h2 className="fr-h5 fr-mb-2w">Clause sociale validée ou archivée</h2>
          {lists.valide?.length ? (
            <div className="fr-grid-row fr-grid-row--gutters">
              {lists.valide.map(r => <RowViewExecutionMarket key={r.id} r={r} archived />)}
            </div>
          ) : (
            <div className="fr-callout"><p className="fr-callout__text">Aucun marché dont la clause sociale est validée ou archivée.</p></div>
          )}
        </div>
      </div>

      {/* ==== MODALE CHOIX LOT TITULAIRE ==== */}
      {modalTitulaireLotsOpen && titulaireLotsFor && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulaire-lots-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'1rem', overflow:'auto' }}
             onClick={closeTitulaireLotsModal}>
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'760px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="titulaire-lots-modal-title" className="fr-h4 fr-mb-0">Déclarer les titulaires</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeTitulaireLotsModal}>Fermer</button>
                </div>
              </div>

              <p className="fr-text--sm fr-mb-2w">
                {titulaireLotsFor[M.INTITULE] || titulaireLotsFor[M.INTITULE_PROP] || `Marché #${titulaireLotsFor.id}`}
              </p>

              <div className="fr-grid-row fr-grid-row--gutters">
                {getLotsForParent(titulaireLotsFor).map((lot) => {
                  const invited = hasInvitation(lot);
                  return (
                    <div className="fr-col-12" key={`titulaire-lot-${lot.id}`}>
                      <div className="fr-p-2w" style={{border:'1px solid var(--border-default-grey)', background:'var(--background-default-grey)'}}>
                        <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters">
                          <div className="fr-col">
                            <p className="fr-text--bold fr-mb-1w">Lot {lot[M.LOT] || '—'} - {lot[M.INTITULE_LOT] || 'Sans intitulé'}</p>
                            <p className="fr-text--sm fr-mb-0">Clause sociale : <strong>{clauseLabel(lot[M.CLAUSE])}</strong></p>
                          </div>
                          <div className="fr-col-auto">
                            <button
                              className="fr-btn fr-btn--sm fr-icon-checkbox-line fr-btn--icon-left"
                              onClick={() => openInviteModalFromLot(lot)}
                              disabled={invited}
                            >
                              {invited ? 'Titulaire déclaré' : 'Déclarer le titulaire de ce lot'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==== MODALE INVITATION ==== */}
      {modalInviteOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="invite-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'1rem', overflow:'auto' }}
             onClick={closeInviteModal}>
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'720px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="invite-modal-title" className="fr-h4 fr-mb-0">Déclarer le titulaire</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeInviteModal}>Fermer</button>
                </div>
              </div>

               {!hasInvited && (
                <>
	                  <div className="fr-input-group">
	                    <label className="fr-label" htmlFor="invite-email">E-mail du titulaire</label>
	                    <input id="invite-email" className="fr-input" type="email" placeholder="email@domaine.fr"
	                          value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value.toLowerCase())} />
	                    <p className="fr-hint-text">En cas de groupement, déclarez uniquement le mandataire.</p>
	                    {!emailOk(inviteEmail) && inviteEmail && <p className="fr-error-text">Adresse invalide.</p>}
	                  </div>
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="invite-exec-end">Date de fin d'exécution prévisionnelle</label>
                    <input id="invite-exec-end" className="fr-input" type="date"
	                          value={inviteExecEnd} onChange={(e)=>setInviteExecEnd(e.target.value)} />
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

	                <div className="fr-btns-group fr-btns-group--right fr-mt-2w">
	                  <button className="fr-btn" onClick={()=>inviteTitulaire(inviteFor)} disabled={inviting || !emailOk(inviteEmail) || !invitePlaceNotified}>
                    {inviting ? 'Invitation…' : 'Déclarer le titulaire'}
                  </button>
                  <button className="fr-btn fr-btn--secondary" onClick={closeInviteModal}>Fermer</button>
                </div>
                </>
               )}
              
            </div>
          </div>
        </div>
      )}

      {/* ==== MODALE DÉCLARATION DE PUBLICATION ==== */}
      {modalPubOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="pub-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'1rem', overflow:'auto' }}
             onClick={closePubModal}>
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'720px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="pub-modal-title" className="fr-h4 fr-mb-0">Déclarer la publication du marché</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closePubModal}>Fermer</button>
                </div>
              </div>

              {pubMarche && (
                <>
                <div className="fr-alert fr-alert--warning fr-mb-2w">
                  <p>Attention ! Veillez à vérifier les informations de ce marché, toute modification ultérieure nécessitera l'intervention du support Eclauses.</p>
                </div>
                {(() => {
                  const lots = getLotsForParent(pubMarche);
                  return (
                    <>
                <dl className="fr-text--sm fr-mb-2w">
                  <dt className="fr-text--bold">Intitulé du marché</dt>
                  <dd>{pubMarche[M.INTITULE] || '—'}</dd>
	                  { lots.length > 0 && (
	                     <dt className="fr-text--bold">Nombre de lot</dt>
	                  )}
	                  <dd>{lots.length || '—'}</dd>
                  <dt className="fr-text--bold">Clauses sociales</dt>
                  <dd>{getMarketClauses(pubMarche).map(clauseLabel).join(', ') || '—'}</dd>
                  <dt className="fr-text--bold">Date limite de remise des offres</dt>
                  <dd>{formatDateOrDash(pubMarche[M.DLRO])}</dd>
                  <dt className="fr-text--bold">Date de notification prévisionnelle</dt>
                  <dd>{formatDateOrDash(pubMarche[M.DNOTPREV])}</dd>
                </dl>
                    </>
                  );
                })()}
                </>
              )}

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="pub-date">Date de publication <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <input
                  id="pub-date"
                  className="fr-input"
                  type="date"
                  value={pubDate}
                  onChange={(e)=>setPubDate(e.target.value)}
                />
              </div>

              <div className="fr-input-group">
                <label className="fr-label" htmlFor="pub-link">Lien vers les documents de consultation <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                <input id="pub-link" className="fr-input" type="url" placeholder="https://…"
                       value={pubLink} onChange={(e)=>setPubLink(e.target.value)} />
              </div>

              <p className="fr-text--sm fr-mb-2w">
                    <span className="fr-text-default--error" aria-hidden="true">*</span> Champs obligatoires
                  </p>

              <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
                <button className="fr-btn" onClick={()=>savePublication(pubFor)} disabled={!pubFor || !pubDate || !String(pubLink || '').trim()}>
                  Valider la publication
                </button>
                <button className="fr-btn fr-btn--secondary" onClick={closePubModal}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==== MODALE SUPPRESSION ==== */}
      {deleteOpen && deleteRowItem && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'1rem', overflow:'auto' }}
             onClick={closeDeleteModal}>
          <div className="fr-container fr-container--fluid fr-container-md"
               style={{maxWidth:'640px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="delete-modal-title" className="fr-h4 fr-mb-0">Supprimer ce marché ?</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={closeDeleteModal}>Fermer</button>
                </div>
              </div>

              <p className="fr-text--sm">
                Vous êtes sur le point de supprimer <strong>{deleteRowItem[M.INTITULE_PROP] || deleteRowItem[M.INTITULE] || `Marché #${deleteRowItem.id}`}</strong>.
                Cette action est définitive.
              </p>

              <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
                <button className="fr-btn fr-btn--secondary" onClick={closeDeleteModal} disabled={deletingId===deleteRowItem.id}>
                  Annuler
                </button>
                <button className="fr-btn fr-btn--danger" onClick={deleteRowConfirmed} disabled={deletingId===deleteRowItem.id}>
                  {deletingId===deleteRowItem.id ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default Component;
