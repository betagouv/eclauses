// @ts-nocheck : code repris du widget Grist (grist/page/support-contact), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
import { gristAPI } from '@/legacy/gristAPI';
const { useState, useEffect, useMemo, useCallback } = React;
const helpers = gristAPI.helpers;

const Component = () => {
  const [contactNom, setContactNom] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactMessage, setContactMessage] = React.useState('');
  const [contactFile, setContactFile] = React.useState(null);
  const [contactSending, setContactSending] = React.useState(false);
  const [contactMsg, setContactMsg] = React.useState(null);
  const [contactErr, setContactErr] = React.useState(null);

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
  const escapeHtml = (v) => String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const goSupport = () => {
    if (gristAPI?.navigate) gristAPI.navigate('support');
  };

  const submitContact = async (e) => {
    e.preventDefault();
    setContactErr(null);
    setContactMsg(null);

    if (!contactNom.trim()) {
      setContactErr('Le nom est requis.');
      return;
    }
    if (!emailOk(contactEmail)) {
      setContactErr('Adresse e-mail invalide.');
      return;
    }
    if (!contactMessage.trim()) {
      setContactErr('Le message est requis.');
      return;
    }

    try {
      setContactSending(true);

      const fd = new FormData();
      fd.append('nom', contactNom.trim());
      fd.append('email', contactEmail.trim());
      fd.append('message', contactMessage.trim());
      fd.append('message_html', escapeHtml(contactMessage.trim()).replace(/\r\n|\r|\n/g, '<br>'));
      fd.append('source', 'support-contact-page');
      if (contactFile) fd.append('piece_jointe', contactFile, contactFile.name || 'piece_jointe');

      const res = await fetch('/api/support/contact', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Envoi impossible (${res.status}).`);
      }

      setContactNom('');
      setContactEmail('');
      setContactMessage('');
      setContactFile(null);
      setContactMsg('Votre demande a bien été envoyée au support.');
    } catch (error) {
      setContactErr(error?.message || "Impossible d'envoyer le message au support.");
    } finally {
      setContactSending(false);
    }
  };

  return (
    <main className="fr-container fr-my-6w" style={{ maxWidth: 760 }}>
      <header className="fr-mb-4w">
        <button
          className="fr-btn fr-btn--tertiary-no-outline fr-icon-arrow-left-line fr-btn--icon-left fr-mb-3w"
          type="button"
          onClick={goSupport}
        >
          Retour au centre d'aide
        </button>
        <h1 className="fr-h3 fr-mb-1w">Contacter le support</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Utilisez ce formulaire pour demander la création de votre compte ou signaler une difficulté.
        </p>
      </header>

      {contactMsg && (
        <div className="fr-alert fr-alert--success fr-mb-3w">
          <p>{contactMsg}</p>
        </div>
      )}
      {contactErr && (
        <div className="fr-alert fr-alert--error fr-mb-3w">
          <p>{contactErr}</p>
        </div>
      )}

      <form className="fr-card fr-p-3w" onSubmit={submitContact}>
        <div className="fr-input-group">
          <label className="fr-label" htmlFor="support-nom">
            Nom
            <span className="fr-hint-text">Champ obligatoire</span>
          </label>
          <input
            id="support-nom"
            className="fr-input"
            type="text"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            required
          />
        </div>

        <div className="fr-input-group">
          <label className="fr-label" htmlFor="support-email">
            Email
            <span className="fr-hint-text">Champ obligatoire</span>
          </label>
          <input
            id="support-email"
            className="fr-input"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
        </div>

        <div className="fr-input-group">
          <label className="fr-label" htmlFor="support-message">
            Message
            <span className="fr-hint-text">Champ obligatoire</span>
          </label>
          <textarea
            id="support-message"
            className="fr-input"
            rows="7"
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            required
          />
        </div>

        <div className="fr-upload-group">
          <label className="fr-label" htmlFor="support-piece-jointe">Pièce jointe (optionnel)</label>
          <input
            id="support-piece-jointe"
            className="fr-upload"
            type="file"
            onChange={(e) => setContactFile((e.target.files && e.target.files[0]) || null)}
          />
        </div>

        <div className="fr-btns-group fr-btns-group--inline fr-mt-3w">
          <button className="fr-btn" type="submit" disabled={contactSending}>
            {contactSending ? 'Envoi…' : 'Envoyer au support'}
          </button>
          <button className="fr-btn fr-btn--secondary" type="button" onClick={goSupport} disabled={contactSending}>
            Annuler
          </button>
        </div>
      </form>
    </main>
  );
};

export default Component;
