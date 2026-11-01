// @ts-nocheck : code repris du widget Grist (grist/page/acheteur-home), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const [toValidateCount, setToValidateCount] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      try {
        const auth = gristAPI.getAuth ? gristAPI.getAuth() : null;
        if (!auth?.acheteurId) return;
        const [uaRows, achRows, marches] = await Promise.all([
          gristAPI.getData('Utilisateurs_Acheteurs'),
          gristAPI.getData('Acheteurs'),
          gristAPI.getData('Marches'),
        ]);
        const me = (uaRows || []).find((r) => r.id === auth.acheteurId);
        const org = (achRows || []).find((a) => a.id === me?.Entite_de_rattachement);
        if (!org) return;
        const count = (marches || []).filter((m) =>
          Number(m.Acheteur) === Number(org.id) &&
          String(m.Statut || '') === 'Déclaration à valider'
        ).length;
        setToValidateCount(count);
      } catch (e) {
        console.warn('acheteur-home alert load failed', e);
      }
    })();
  }, []);

  return (
    <>
      <section className="fr-container fr-my-6w">
        <h1 className="fr-h2">Bienvenue sur votre espace <span className="fr-text--bold">Eclauses</span></h1>

        {toValidateCount > 0 && (
          <div className="fr-alert fr-alert--warning fr-mb-4w">
            <p>
              Vous avez {toValidateCount} déclaration{toValidateCount > 1 ? 's' : ''} de bénéficiaires à valider.
              {' '}
              <a href="#" data-nav="acheteur-marches" className="fr-link">Voir mes marchés</a>
            </p>
          </div>
        )}

        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-5">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><a data-nav="acheteur-marches" href="#">Mes marchés</a></h3>
                  <p className="fr-tile__desc">Déclarez et suivez un marché couvert par une clause sociale.</p>
                </div>
              </div>
              <div className="fr-tile__header">
                <div className="fr-tile__pictogram">
                  <svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px">
                    <use className="fr-artwork-decorative" href="/svg/document/contract.svg#artwork-decorative"></use>
                    <use className="fr-artwork-minor" href="/svg/document/contract.svg#artwork-minor"></use>
                    <use className="fr-artwork-major" href="/svg/document/contract.svg#artwork-major"></use>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-4">
            <div className="fr-tile fr-tile--horizontal fr-enlarge-link" id="tile-6">
              <div className="fr-tile__body">
                <div className="fr-tile__content">
                  <h3 className="fr-tile__title"><a data-nav="acheteur-annuaire" href="#">Annuaire des bénéficiaires</a></h3>
                  <p className="fr-tile__desc">Consulter l'annuaire des bénéficiaires des clauses sociales.</p>
                </div>
              </div>
              <div className="fr-tile__header">
                <div className="fr-tile__pictogram">
                  <svg aria-hidden="true" className="fr-artwork" viewBox="0 0 80 80" width="80px" height="80px">
                    <use className="fr-artwork-decorative" href="/svg/digital/ecosystem.svg#artwork-decorative"></use>
                    <use className="fr-artwork-minor" href="/svg/digital/ecosystem.svg#artwork-minor"></use>
                    <use className="fr-artwork-major" href="/svg/digital/ecosystem.svg#artwork-major"></use>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Component;
