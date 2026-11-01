// @ts-nocheck : code repris du widget Grist (grist/page/apropos), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    try {
      setAuthed(!!(gristAPI?.isAuthenticated && gristAPI.isAuthenticated()));
      document.title = 'Eclauses — À propos';
    } catch (_) {}
  }, []);

  function go(id) {
    try { if (gristAPI?.navigate) gristAPI.navigate(id); } catch (e) { console.warn(e); }
  }

  return (
    <main className="fr-container fr-my-6w">
      {/* Hero */}
      <header className="fr-mb-6w">
        <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle">
          <div className="fr-col-12 fr-col-md-7">
            <h1 className="fr-h2 fr-mb-2w">À propos d’<span className="fr-text--lead">Eclauses</span></h1>
            <p className="fr-text--lg">
              Eclauses accompagne les jeunes diplômés en conservation-restauration d’œuvres d’art
              dans leur insertion professionnelle&nbsp;: mise à jour de profil, accès aux marchés
              publics intégrant des <strong>clauses sociales</strong>, et annuaire des professionnels.
            </p>
            <div className="fr-btns-group fr-btns-group--inline fr-btns-group--icon-left fr-mt-3w">
              {authed ? (
                <button className="fr-btn fr-icon-account-line" onClick={() => go('espace-beneficiaire')}>
                  Accéder à mon espace
                </button>
              ) : (
                <button className="fr-btn fr-icon-lock-line" onClick={() => go('login')}>
                  Se connecter / Obtenir mon lien
                </button>
              )}
              <button className="fr-btn fr-btn--secondary fr-icon-question-line" onClick={() => go('faq')}>
                FAQ
              </button>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-5">
            <div className="fr-callout">
              <h2 className="fr-callout__title fr-h6">Objectifs</h2>
              <ul className="fr-callout__text fr-list">
                <li>Faciliter l’accès aux marchés compatibles avec votre profil.</li>
                <li>Valoriser les compétences via un profil complet (CV, spécialités, mobilité).</li>
                <li>Mettre en relation les acteurs du secteur grâce à l’annuaire.</li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* Fonctionnalités clés */}
      <section className="fr-mb-6w">
        <h2 className="fr-h4 fr-mb-3w">Fonctionnalités clés</h2>
        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-4">
            <article className="fr-card fr-enlarge-link">
              <div className="fr-card__body">
                <h3 className="fr-card__title fr-text--md">
                  <a href="#" onClick={(e) => { e.preventDefault(); go('profil'); }}>
                    Mon profil
                  </a>
                </h3>
                <p className="fr-card__desc fr-text--sm">
                  Coordonnées, formation, spécialités, zones de mobilité, CV. Mettez à jour votre fiche à tout moment.
                </p>
              </div>
            </article>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <article className="fr-card fr-enlarge-link">
              <div className="fr-card__body">
                <h3 className="fr-card__title fr-text--md">
                  <a href="#" onClick={(e) => { e.preventDefault(); go('marches'); }}>
                    Marchés actifs
                  </a>
                </h3>
                <p className="fr-card__desc fr-text--sm">
                  Liste et carte des marchés encore réalisables et filtrés par vos clauses sociales.
                </p>
              </div>
            </article>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <article className="fr-card fr-enlarge-link">
              <div className="fr-card__body">
                <h3 className="fr-card__title fr-text--md">
                  <a href="#" onClick={(e) => { e.preventDefault(); go('annuaire'); }}>
                    Annuaire
                  </a>
                </h3>
                <p className="fr-card__desc fr-text--sm">
                  Recherchez des pairs partageant des clauses communes (selon consentement).
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Component;
