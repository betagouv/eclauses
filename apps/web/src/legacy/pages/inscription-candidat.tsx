// @ts-nocheck : code repris du widget Grist (grist/page/inscription-candidat), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  // ===== Tables & colonnes =====
  const TABLE = 'Repondants';
  const MARCHES = 'Marches';
  const VERIFY_URL_ENV_KEY = 'N8N_CANDIDAT_VERIFICATION_INSCRIPTION';
  const COL = {
    NOM: 'Nom',
    PRENOM: 'Prenom',
    EMAIL: 'Email',
    TEL: 'Telephone',
    RAISOC: 'Raison_sociale',
    SIRET: 'Siret',
    CAND: 'Candidat_aux_marches',    // RefList('Marches')
    TIT:  'Titulaire_aux_marches',   // RefList('Marches')
    INTITULE_LOT: 'Intitule_propre',
    INTITULE: 'Intitule_du_marche',
    LOT: 'Numero_de_lot',
    LOT_TITLE: 'Intitule_du_lot',
    PARENT: 'Marche_parent',
    CLAUSE: 'Clauses_sociales',
    STATUS: 'Statut',
  };

  // ===== Utils =====
  const emailLooksOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  const isClosedStatus = (v) => ['Clause validée', 'Archivé'].includes(String(v || ''));

  // ===== State =====
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]       = React.useState(null);
  const [msg, setMsg]       = React.useState(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [step, setStep] = React.useState('email'); // 'email' | 'form'
  const [checkingEmail, setCheckingEmail] = React.useState(false);
  const [emailInput, setEmailInput] = React.useState('');
  const [verifiedEmail, setVerifiedEmail] = React.useState('');
  const [formErrors, setFormErrors] = React.useState({});

  const [marcheId, setMarcheId] = React.useState(null);
  const [marcheLabel, setMarcheLabel] = React.useState(null);
  const [marcheValid, setMarcheValid] = React.useState(true);
  const [lotOptions, setLotOptions] = React.useState([]);
  const [selectedLotIds, setSelectedLotIds] = React.useState([]);

  const [form, setForm] = React.useState({
    [COL.NOM]: '',
    [COL.PRENOM]: '',
    [COL.EMAIL]: '',
    [COL.TEL]: '',
    [COL.RAISOC]: '',
    [COL.SIRET]: '',
  });

  React.useEffect(() => {
    let alive = true;
    (async () => {

      try {

        const params = gristAPI.getQueryParams ? gristAPI.getQueryParams() : new URLSearchParams(window.location.search);
        const raw = params.get('marche') || params.get('marche_');
        const n = raw != null ? Number(raw) : null;
        setMarcheId(Number.isFinite(n) ? n : null);
        
        const marches = await gristAPI.getData(MARCHES);
        if (!alive) return;
        const requested = (marches || []).find(r => r.id === n);
        const parent = requested?.[COL.PARENT]
          ? (marches || []).find(r => Number(r.id) === Number(requested[COL.PARENT]))
          : requested;
        if (parent && !parent[COL.PARENT]) {
          const allChildren = (marches || []).filter(r => Number(r[COL.PARENT]) === Number(parent.id));
          const children = allChildren
            .filter((lot) => lot[COL.CLAUSE])
            .filter((lot) => !isClosedStatus(lot[COL.STATUS]))
            .sort((a, b) => String(a[COL.LOT] || '').localeCompare(String(b[COL.LOT] || ''), 'fr', { numeric: true, sensitivity: 'base' }));

          const fallbackNonAllotted = allChildren.length === 0 && parent[COL.CLAUSE] && !isClosedStatus(parent[COL.STATUS])
            ? [parent]
            : [];
          const options = children.length ? children : fallbackNonAllotted;

          setMarcheLabel(parent[COL.INTITULE] || parent[COL.INTITULE_LOT] || `Marché #${parent.id}`);
          setLotOptions(options);
          setSelectedLotIds(options.length === 1 ? [options[0].id] : []);
          setMarcheValid(options.length > 0);
        } else {
          setMarcheLabel(null);
          setLotOptions([]);
          setSelectedLotIds([]);
          setMarcheValid(false);
        }

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setMarcheValid(false);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function seedForm(rec) {
    setForm({
      [COL.NOM]:    rec[COL.NOM]    || '',
      [COL.PRENOM]: rec[COL.PRENOM] || '',
      [COL.EMAIL]:  rec[COL.EMAIL]  || '',
      [COL.TEL]:    rec[COL.TEL]    || '',
      [COL.RAISOC]: rec[COL.RAISOC] || '',
      [COL.SIRET]:  rec[COL.SIRET]  || '',
    });
  }

  function setField(name, value) {
    setMsg(null);
    setErr(null);
    setFormErrors((prev) => ({ ...prev, [name]: null }));
    setForm(prev => ({ ...prev, [name]: value }));
  }
  function goBackToEmailStep() {
    setErr(null);
    setMsg(null);
    const currentEmail = String(form[COL.EMAIL] || verifiedEmail || emailInput || '').trim().toLowerCase();
    setEmailInput(currentEmail);
    setStep('email');
  }
  function toggleLot(lotId) {
    setErr(null);
    setSelectedLotIds((prev) => prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId]);
  }
  const selectedLots = React.useMemo(
    () => lotOptions.filter((lot) => selectedLotIds.includes(lot.id)),
    [lotOptions, selectedLotIds]
  );
  const hasOnlyParentOption = lotOptions.length === 1 && Number(lotOptions[0]?.id) === Number(marcheId);
  const lotLabel = (lot) => {
    const num = lot?.[COL.LOT] ? `Lot ${lot[COL.LOT]} - ` : '';
    return `${num}${lot?.[COL.LOT_TITLE] || lot?.[COL.INTITULE_LOT] || lot?.[COL.INTITULE] || marcheLabel || 'Marché sans intitulé'}`;
  };

  async function verifyEmailFirst() {
    setErr(null);
    setMsg(null);
    const email = String(emailInput || '').trim().toLowerCase();
    if (!emailLooksOk(email)) {
      setErr("Adresse e-mail invalide.");
      return;
    }
    if (!selectedLotIds.length) {
      setErr(hasOnlyParentOption ? "Le marché n'est pas sélectionné." : "Sélectionnez au moins un lot.");
      return;
    }

    try {
      setCheckingEmail(true);
      const res = await fetch('/api/candidats/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          marcheId,
          lotIds: selectedLotIds,
          marcheIds: selectedLotIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Erreur de vérification.');

      const status = String(data?.status || '').toLowerCase();
      if (status === 'exist') {
        setSubmitted(true);
        setMsg(hasOnlyParentOption
          ? "Vous disposez déjà d'un compte Eclauses avec cet email. Le marché a été ajouté dans votre liste de marchés en candidature. Vous pouvez vous connecter à votre compte."
          : "Vous disposez déjà d'un compte Eclauses avec cet email. Les lots sélectionnés ont été ajoutés dans votre liste de marchés en candidature. Vous pouvez vous connecter à votre compte.");
        return;
      }
      if (status === 'new') {
        setVerifiedEmail(email);
        setForm((prev) => ({ ...prev, [COL.EMAIL]: email }));
        setStep('form');
        return;
      }
      throw new Error("Réponse de vérification invalide.");
    } catch (e) {
      setErr(e.message || "Impossible de vérifier l'adresse e-mail.");
    } finally {
      setCheckingEmail(false);
    }
  }

  async function save() {
    setErr(null); setMsg(null); setFormErrors({});

    const nextErrors = {};
    if (!String(form[COL.RAISOC] || '').trim()) nextErrors[COL.RAISOC] = 'Champ requis.';
    if (!String(form[COL.SIRET] || '').trim()) nextErrors[COL.SIRET] = 'Champ requis.';
    if (!String(form[COL.PRENOM] || '').trim()) nextErrors[COL.PRENOM] = 'Champ requis.';
    if (!String(form[COL.NOM] || '').trim()) nextErrors[COL.NOM] = 'Champ requis.';
    if (!String(form[COL.EMAIL] || '').trim()) nextErrors[COL.EMAIL] = 'Champ requis.';
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      setErr("Merci de compléter tous les champs obligatoires (sauf téléphone).");
      return;
    }

    if (!emailLooksOk(form[COL.EMAIL])) {
      setErr("Adresse e-mail invalide.");
      return;
    }
    if (!selectedLotIds.length) {
      setErr(hasOnlyParentOption ? "Le marché n'est pas sélectionné." : "Sélectionnez au moins un lot.");
      return;
    }

    const payload = {
      [COL.NOM]:    form[COL.NOM]    || null,
      [COL.PRENOM]: form[COL.PRENOM] || null,
      [COL.EMAIL]:  String(form[COL.EMAIL] || '').trim().toLowerCase() || null,
      [COL.TEL]:    form[COL.TEL]    || null,
      [COL.RAISOC]: form[COL.RAISOC] || null,
      [COL.SIRET]:  form[COL.SIRET]  || null,
    };

    const candList = selectedLotIds.length ? ['L', ...selectedLotIds] : [];

    try {
      await gristAPI.addRecord(TABLE, {
        ...payload,
        [COL.CAND]: candList,
      });
      setMsg("Votre inscription est enregistrée. Vous allez recevoir un e-mail pour initialiser votre mot de passe.");
      setSubmitted(true);
    } catch (e) {
      setErr(e.message || "Échec de l’enregistrement.");
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
  if (!marcheValid) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error">
          <p>Ce lien d'inscription n'est plus valide : le marché est clos, ne contient aucun lot disponible ou l'URL est erronée.</p>
        </div>
      </section>
    );
  }
  const renderError = err ? (
    <div className="fr-alert fr-alert--error fr-mb-3w"><p><strong>Erreur :</strong> {err}</p></div>
  ) : null;

  return (
    <main className="fr-container fr-my-6w">
      <section className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <h1 className="fr-h3 fr-mb-1w">Inscription à Eclauses pour une consultation</h1>
      </header>
      {renderError}

      {!submitted && (

        <><div className="fr-alert fr-alert--info fr-mb-3w">
            <p>Vous vous inscrivez pour la consultation <strong>{marcheLabel}</strong>.</p>
          </div>

          {step === 'email' && (
            <div className="fr-grid-row fr-grid-row--gutters">
              <div className="fr-col-12">
                <div className="fr-card fr-p-3w">
                  <fieldset className="fr-fieldset fr-mb-3w" aria-labelledby="lots-legend">
                    <legend className="fr-fieldset__legend fr-text--regular" id="lots-legend">
                      {hasOnlyParentOption ? 'Marché concerné' : 'Choisissez les lots pour lesquels vous souhaitez rechercher des bénéficiaires'}
                      <span className="fr-text-default--error" aria-hidden="true">*</span>
                    </legend>
                    <div className="fr-fieldset__content">
                      {hasOnlyParentOption ? (
                        <p className="fr-text--sm fr-mb-0">
                          <strong>{lotLabel(lotOptions[0])}</strong>
                        </p>
                      ) : (
                        lotOptions.map((lot) => (
                          <div className="fr-checkbox-group fr-checkbox-group--sm" key={lot.id}>
                            <input
                              type="checkbox"
                              id={`lot-${lot.id}`}
                              checked={selectedLotIds.includes(lot.id)}
                              onChange={() => toggleLot(lot.id)}
                            />
                            <label className="fr-label" htmlFor={`lot-${lot.id}`}>
                              {lotLabel(lot)}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </fieldset>
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="email-first">E-mail professionnel</label>
                    <input
                      id="email-first"
                      className="fr-input"
                      type="email"
                      value={emailInput}
                      onChange={(e) => { setErr(null); setEmailInput(e.target.value.toLowerCase()); }}
                    />
                    {emailInput && !emailLooksOk(emailInput) && (
                      <p className="fr-error-text">Format d’e-mail invalide.</p>
                    )}
                  </div>
                  <div className="fr-btns-group fr-btns-group--inline fr-mt-2w">
                    <button className="fr-btn" onClick={verifyEmailFirst} disabled={checkingEmail}>
                      {checkingEmail ? 'Vérification…' : 'Continuer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'form' && (
            <div className="fr-grid-row fr-grid-row--gutters">
              {/* Formulaire principal */}
              <div className="fr-col-12">
                <div className="fr-callout">
                  <p className="fr-callout__text">Cette inscription vous donnera accès à votre espace, dans lequel vous pourrez :</p>
                  <ul className="fr-list fr-callout__text">
                    <li>Effectuer une recherche de bénéficiaires en filtrant l’annuaire selon vos critères</li>
                    <li>Accéder au profil détaillé des bénéficiaires</li>
                    <li>Entrer en contact avec des bénéficiaires pour répondre aux obligations sociales du marché</li>
                    <li>Déclarer le bénéficiaire retenu</li>
                  </ul>
                </div>
                <div className="fr-fieldset">
                  <div className="fr-fieldset__content">
                    <p className="fr-text--sm fr-mb-2w">
                      <span className="fr-text-default--error" aria-hidden="true">*</span> Champs obligatoires
                    </p>

                    <div className="fr-callout fr-callout--blue-cumulus fr-mb-3w">
                      <p className="fr-callout__text">
                        {hasOnlyParentOption ? 'Marché sélectionné' : 'Lots sélectionnés'} : <strong>{selectedLots.map(lotLabel).join(', ')}</strong>
                      </p>
                      {!hasOnlyParentOption && (
                        <button className="fr-btn fr-btn--secondary fr-btn--sm fr-mt-2w" onClick={goBackToEmailStep}>
                          Modifier les lots sélectionnés
                        </button>
                      )}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="rs">Raison sociale <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                      <input id="rs" className="fr-input" type="text"
                        value={form[COL.RAISOC]} onChange={(e) => setField(COL.RAISOC, e.target.value)} />
                      {formErrors[COL.RAISOC] && <p className="fr-error-text">{formErrors[COL.RAISOC]}</p>}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="rs">SIRET <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                      <input id="siret" className="fr-input" type="text"
                        value={form[COL.SIRET]} onChange={(e) => setField(COL.SIRET, e.target.value)} />
                      {formErrors[COL.SIRET] && <p className="fr-error-text">{formErrors[COL.SIRET]}</p>}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="prenom">Prénom <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                      <input id="prenom" className="fr-input" type="text"
                        value={form[COL.PRENOM]} onChange={(e) => setField(COL.PRENOM, e.target.value)} />
                      {formErrors[COL.PRENOM] && <p className="fr-error-text">{formErrors[COL.PRENOM]}</p>}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="nom">Nom <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                      <input id="nom" className="fr-input" type="text"
                        value={form[COL.NOM]} onChange={(e) => setField(COL.NOM, e.target.value)} />
                      {formErrors[COL.NOM] && <p className="fr-error-text">{formErrors[COL.NOM]}</p>}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="email">E-mail <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                      <input id="email" className="fr-input" type="email"
                        value={form[COL.EMAIL] || verifiedEmail} disabled />
                      {formErrors[COL.EMAIL] && <p className="fr-error-text">{formErrors[COL.EMAIL]}</p>}
                      {form[COL.EMAIL] && !emailLooksOk(form[COL.EMAIL]) && (
                        <p className="fr-error-text">Format d’e-mail invalide.</p>
                      )}
                    </div>

                    <div className="fr-input-group">
                      <label className="fr-label" htmlFor="tel">Téléphone</label>
                      <input id="tel" className="fr-input" type="text"
                        value={form[COL.TEL]} onChange={(e) => setField(COL.TEL, e.target.value)} />
                    </div>

                    <div className="fr-btns-group fr-btns-group--inline fr-mt-4w">
                      <button className="fr-btn" onClick={save}>Enregistrer</button>
                      <button className="fr-btn fr-btn--secondary" onClick={goBackToEmailStep}>Corriger mon email</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
      )}
      {submitted && (
        <div className="fr-alert fr-alert--success fr-mt-4w">
          <p>{msg || "Votre inscription est enregistrée. Vous allez recevoir un e-mail pour initialiser votre mot de passe."}</p>
        </div>
      )}
    </section>
    </main>
  );
};

export default Component;
