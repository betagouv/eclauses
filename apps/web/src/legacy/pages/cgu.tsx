// @ts-nocheck : code repris du widget Grist (grist/page/cgu), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const lastUpdate = '24 juin 2026';
  const toc = [
    { id: 'application', label: "Champ d'application" },
    { id: 'objet', label: 'Objet de la plateforme' },
    { id: 'definitions', label: 'Définitions' },
    { id: 'fonctionnalites', label: 'Fonctionnalités' },
    { id: 'responsabilites', label: 'Responsabilités' },
    { id: 'mise-a-jour', label: 'Mise à jour des CGU' },
  ];

  return (
    <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters">
          <div className="fr-col">
            <h1 className="fr-h2">Conditions générales d'utilisation</h1>
            <p className="fr-text--sm fr-text-mention--grey">En vigueur à partir du 1er juillet 2026</p>
            <p className="fr-text--sm fr-text-mention--grey">Dernière mise à jour : {lastUpdate}</p>
          </div>
          <div className="fr-col-auto">
            <button className="fr-btn fr-btn--secondary" onClick={() => window.print()}>
              Imprimer la page
            </button>
          </div>
        </div>
      </header>

      <div className="fr-grid-row fr-grid-row--gutters">
        <aside className="fr-col-12 fr-col-md-4">
          <nav className="fr-sidemenu fr-sidemenu--sticky-full-height" aria-label="Sommaire des conditions générales d'utilisation">
            <div className="fr-sidemenu__inner">
              <button className="fr-sidemenu__btn" aria-controls="cgu-menu">Sommaire</button>
              <div className="fr-collapse" id="cgu-menu">
                <ul className="fr-sidemenu__list">
                  {toc.map((it) => (
                    <li key={it.id} className="fr-sidemenu__item">
                      <a className="fr-sidemenu__link" href={`#${it.id}`}>{it.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </aside>

        <div className="fr-col-12 fr-col-md-8">
          <section id="application" className="fr-mb-6w">
            <h2 className="fr-h3">Article 1 - Champ d'application</h2>
            <p>
              Les présentes conditions générales d'utilisation (ci-après « CGU ») précisent le cadre juridique de Eclauses (ci-après la « Plateforme ») et définissent les conditions d'accès et d'utilisation des Services par l'Utilisateur.
            </p>
          </section>

          <section id="objet" className="fr-mb-6w">
            <h2 className="fr-h3">Article 2 - Objet de la Plateforme</h2>
            <p>
              La Plateforme est un produit numérique de la mission ministérielle des achats (MMA) du ministère de la Culture qui met en relation des candidats à des marchés publics et des bénéficiaires de clauses sociales concernant des métiers culture.
            </p>
            <p>
              Elle a pour objectif d'accompagner les néodiplômés en conservation-restauration de biens culturels dans leur insertion professionnelle, notamment en constituant un annuaire pour leur donner de la visibilité auprès des candidats et titulaires des marchés publics.
            </p>
          </section>

          <section id="definitions" className="fr-mb-6w">
            <h2 className="fr-h3">Article 3 - Définitions</h2>
            <dl className="fr-text--sm">
              <dt className="fr-text--bold">Éditeur</dt>
              <dd>Désigne la personne morale qui met à la disposition du public la Plateforme, à savoir la MMA du ministère de la Culture.</dd>
              <dt className="fr-text--bold">Plateforme</dt>
              <dd>Désigne le produit numérique Eclauses.</dd>
              <dt className="fr-text--bold">Services</dt>
              <dd>Désigne les fonctionnalités prévues par la Plateforme pour répondre à ses finalités.</dd>
              <dt className="fr-text--bold">Utilisateur</dt>
              <dd>Désigne toute personne physique, candidat, titulaire ou bénéficiaire, qui s'inscrit sur la Plateforme.</dd>
            </dl>
          </section>

          <section id="fonctionnalites" className="fr-mb-6w">
            <h2 className="fr-h3">Article 4 - Fonctionnalités</h2>

            <section className="fr-mb-4w">
              <h3 className="fr-h5">4.1 Connexion au compte</h3>
              <p>L'Utilisateur peut se connecter à son compte en renseignant les informations suivantes :</p>
              <ul className="fr-list">
                <li>Adresse électronique</li>
                <li>Mot de passe</li>
              </ul>
            </section>

            <section>
              <h3 className="fr-h5">4.2 Accès à la Plateforme</h3>
              <p>La Plateforme est accessible aux candidats, titulaires et bénéficiaires et aux acheteurs.</p>
              <p>
                L'Utilisateur peut accéder à tout moment à ses informations personnelles et ajouter son Curriculum Vitae (CV). Il peut accéder à un annuaire qui recense les bénéficiaires qui ont partagé leurs informations et partagent une clause sociale commune.
              </p>
              <p>Cet annuaire permet aux candidats et aux titulaires des marchés publics de prendre attache avec les jeunes diplômés.</p>
            </section>
          </section>

          <section id="responsabilites" className="fr-mb-6w">
            <h2 className="fr-h3">Article 5 - Responsabilités</h2>

            <section className="fr-mb-4w">
              <h3 className="fr-h5">5.1 Responsabilités de l'Éditeur</h3>
              <p>
                Les sources des informations diffusées sur la Plateforme sont réputées fiables, mais l'Éditeur ne garantit pas qu'elle soit exempte de défauts, d'erreurs ou d'omissions.
              </p>
              <p>
                L'Éditeur s'engage à sécuriser la Plateforme, notamment en prenant toutes les mesures nécessaires permettant de garantir la sécurité et la confidentialité des informations fournies. Les règles relatives au mot de passe renseigné par l'Utilisateur lors de son inscription ou lors de la modification du mot de passe sont conformes aux recommandations de la CNIL et de l'ANSSI.
              </p>
              <p>
                L'Éditeur n'est pas tenu responsable de tout contenu ou document déposé sur la Plateforme par l'Utilisateur. Il n'est en aucun cas tenu responsable de la décision de sélection des titulaires du marché public.
              </p>
              <p>
                L'Éditeur fournit les moyens nécessaires et raisonnables pour assurer un accès continu à la Plateforme. Il se réserve le droit de faire évoluer, de modifier ou de suspendre, sans préavis, la Plateforme pour des raisons de maintenance ou pour tout autre motif jugé nécessaire.
              </p>
              <p>
                En cas de manquement à une ou plusieurs des stipulations des présentes CGU, l'Éditeur se réserve le droit de suspendre ou de supprimer le compte de l'Utilisateur responsable.
              </p>
            </section>

            <section>
              <h3 className="fr-h5">5.2 Responsabilités de l'Utilisateur</h3>
              <p>
                L'Utilisateur s'assure de garder son mot de passe secret. Toute divulgation du mot de passe, quelle que soit sa forme, est interdite. Il assume les risques liés à l'utilisation de son adresse courriel et de son mot de passe et prend toutes les précautions en lien avec la cybersécurité (liens frauduleux, tentative de phishing, usurpation d'identité). En aucun cas, la Plateforme ne demande à l'Utilisateur de lui communiquer des informations personnelles.
              </p>
              <p>
                L'Utilisateur est seul responsable de tout contenu, document ou information qu'il dépose sur la Plateforme. Il s'assure de ne déposer que des pièces justificatives en lien avec son cursus, à savoir son CV.
              </p>
              <p>
                L'Utilisateur s'engage à transmettre des données et informations exactes et tenues à jour. Il est rappelé que toute personne procédant à une fausse déclaration pour elle-même ou pour autrui s'expose notamment aux sanctions prévues à l'article 441-1 du code pénal.
              </p>
              <p>
                L'Utilisateur s'engage à ne pas mettre en ligne de contenus ou informations contraires au cadre juridique en vigueur, notamment le RGPD. Il s'engage notamment à ne pas communiquer de données sensibles ou de secrets protégés par la loi, et à ne pas publier de contenus illicites dans les zones de champs libres.
              </p>
            </section>
          </section>

          <section id="mise-a-jour" className="fr-mb-6w">
            <h2 className="fr-h3">Article 6 - Mise à jour des conditions générales d'utilisation</h2>
            <p>
              Les termes des présentes CGU peuvent être amendés à tout moment, sans préavis, en fonction des modifications apportées à la Plateforme, de l'évolution de la législation ou pour tout autre motif jugé nécessaire.
            </p>
            <p>Chaque modification donne lieu à une nouvelle version qui est acceptée par les parties.</p>
          </section>

          <div className="fr-mt-6w">
            <a
              className="fr-link fr-icon-arrow-up-s-line fr-link--icon-left"
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Haut de page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Component;
