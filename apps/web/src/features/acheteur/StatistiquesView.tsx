// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-statistiques), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import helpers from '@/legacy/components/helpers';

const Component = ({ initial }) => {
  // === Tables & colonnes ===
  const TABLE = {
    UA: 'Utilisateurs_Acheteurs',
    ACH: 'Acheteurs',
    M:  'Marches',
    C:  'Clauses_sociales',
  };

  const COL_M = {
    INTITULE: 'Intitule',
    INTITULE_PROP: 'Intitule_propre',
    ACHETEUR: 'Acheteur', // ref -> Acheteurs
    PUB: 'Date_de_publication',
    DL_CAND: 'Date_limite_de_candidature',
    DL_REAL: 'Date_Limite_de_Realisation_de_l_Operation',
    CLAUSE: 'Clauses_sociales', // ref -> Clauses_sociales
  };

  const { toOptions, pickLabelField, parseDate, formatDate, daysLeft } = helpers;

  // === State ===
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(initial.error);

  const [userUA, setUserUA] = React.useState(initial.ua);     // ligne Utilisateurs_Acheteurs
  const [org, setOrg] = React.useState(initial.org);           // ligne Acheteurs (entité)
  const [marches, setMarches] = React.useState(initial.marches);     // marchés de l'entité
  const [clauses, setClauses] = React.useState(initial.clauses);     // référentiel clauses
  const [optsClauses, setOptsClauses] = React.useState(() => toOptions(initial.clauses));

  React.useEffect(() => { document.title = 'Statistiques - Eclauses'; }, []);

  // === Derivations ===
  const todayStart = React.useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, []);

  const nbTotal = marches.length;

  const nbActifs = React.useMemo(() => {
    return marches.filter(m => {
      const d = parseDate(m[COL_M.DL_REAL]);
      return !d || d >= todayStart; // actif si pas de date ou date future
    }).length;
  }, [marches, todayStart]);

  const nbCandidaturesOuvertes = React.useMemo(() => {
    return marches.filter(m => {
      const d = parseDate(m[COL_M.DL_CAND]);
      return d && d >= todayStart;
    }).length;
  }, [marches, todayStart]);

  const clausesCount = React.useMemo(() => {
    const map = new Map();
    for (const m of marches) {
      const id = m[COL_M.CLAUSE];
      if (id == null) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    // tableau trié par desc
    return Array.from(map.entries()).sort((a,b) => b[1]-a[1]);
  }, [marches]);

  const nbClausesCouverts = clausesCount.length;

  const nextDeadlines = React.useMemo(() => {
    return marches
      .filter(m => {
        const d = parseDate(m[COL_M.DL_CAND]);
        return d && d >= todayStart;
      })
      .sort((a,b) => {
        const da = parseDate(a[COL_M.DL_CAND])?.getTime() || 0;
        const db = parseDate(b[COL_M.DL_CAND])?.getTime() || 0;
        return da - db;
      })
      .slice(0, 5);
  }, [marches, todayStart]);

  const lastPublished = React.useMemo(() => {
    return marches
      .slice()
      .sort((a,b) => {
        const da = parseDate(a[COL_M.PUB])?.getTime() || 0;
        const db = parseDate(b[COL_M.PUB])?.getTime() || 0;
        return db - da;
      })
      .slice(0, 5);
  }, [marches]);

  const clauseLabel = React.useCallback((id) => {
    const found = optsClauses.find(o => o.value === id);
    return found ? found.label : String(id ?? '—');
  }, [optsClauses]);

  // === UI ===
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement du tableau de bord acheteur…</p>
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

  const nomEntite = org?.Nom || '—';

  return (
    <section className="fr-container fr-my-6w">
      {/* En-tête */}
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Statistiques</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Entité : <strong>{nomEntite}</strong>
        </p>
      </header>

      {/* KPIs */}
      <div className="fr-grid-row fr-grid-row--gutters fr-mb-4w">
        <div className="fr-col-12 fr-col-md-3">
          <article className="fr-card fr-card--sm fr-card--no-arrow">
            <div className="fr-card__body">
              <p className="fr-card__title fr-text--md">Marchés totaux</p>
              <p className="fr-display--sm fr-mb-0">{nbTotal}</p>
            </div>
          </article>
        </div>
        <div className="fr-col-12 fr-col-md-3">
          <article className="fr-card fr-card--sm fr-card--no-arrow">
            <div className="fr-card__body">
              <p className="fr-card__title fr-text--md">Marchés actifs</p>
              <p className="fr-display--sm fr-mb-0">{nbActifs}</p>
            </div>
          </article>
        </div>
        <div className="fr-col-12 fr-col-md-3">
          <article className="fr-card fr-card--sm fr-card--no-arrow">
            <div className="fr-card__body">
              <p className="fr-card__title fr-text--md">Candidatures ouvertes</p>
              <p className="fr-display--sm fr-mb-0">{nbCandidaturesOuvertes}</p>
            </div>
          </article>
        </div>
        <div className="fr-col-12 fr-col-md-3">
          <article className="fr-card fr-card--sm fr-card--no-arrow">
            <div className="fr-card__body">
              <p className="fr-card__title fr-text--md">Clauses couvertes</p>
              <p className="fr-display--sm fr-mb-0">{nbClausesCouverts}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default Component;
