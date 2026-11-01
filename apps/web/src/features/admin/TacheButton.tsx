'use client';

import { useState } from 'react';
import { lancerTacheAdmin } from '@/server/actions/admin';

interface Props {
  nom: string;
  titre: string;
  sensible: boolean;
  /** Nombre de courriers annoncé dans la confirmation (tâche d'invitation). */
  destinataires?: number;
}

export function TacheButton({ nom, titre, sensible, destinataires }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function lancer() {
    const detail = destinataires !== undefined ? ` ${destinataires} courrier${destinataires > 1 ? 's' : ''} seront envoyés.` : '';
    const question = sensible ? `${titre} : cette action envoie des courriers ou efface des données et ne peut pas être annulée.${detail} Continuer ?` : `${titre} ?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    const res = await lancerTacheAdmin(nom);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: `Terminé : ${res.data.processed} élément${res.data.processed > 1 ? 's' : ''} traité${res.data.processed > 1 ? 's' : ''}.` } : { ok: false, text: res.message });
  }

  return (
    <div>
      <button type="button" className={`fr-btn fr-btn--sm ${sensible ? 'fr-btn--secondary' : 'fr-btn--tertiary'}`} disabled={busy} onClick={lancer}>
        Lancer
      </button>
      {msg && (
        <p className={`fr-text--sm fr-mb-0 fr-mt-1w ${msg.ok ? 'fr-text-default--success' : 'fr-text-default--error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>
      )}
    </div>
  );
}
