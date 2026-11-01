'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { compteActivation, compteAdmin, compteDesactiver, compteMfa, compteReinitialisation } from '@/server/actions/admin';
import type { ActionResult } from '@/server/actions/result';

interface Props {
  id: number;
  email: string;
  active: boolean;
  estAdmin: boolean;
  mfa: boolean;
}

/** Actions sur un compte : chacune demande confirmation, affiche le résultat, puis recharge la liste. */
export function CompteActions({ id, email, active, estAdmin, mfa }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, confirm: string, fn: () => Promise<ActionResult<null>>) {
    if (!window.confirm(confirm)) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: `${label} : fait.` } : { ok: false, text: res.message });
    if (res.ok) router.refresh();
  }

  const btn = (label: string, confirm: string, fn: () => Promise<ActionResult<null>>, secondary = true) => (
    <button type="button" className={`fr-btn fr-btn--sm ${secondary ? 'fr-btn--tertiary' : 'fr-btn--secondary'} fr-mr-1w fr-mb-1w`} disabled={busy} onClick={() => run(label, confirm, fn)}>
      {label}
    </button>
  );

  return (
    <div>
      {!active ? btn('Envoyer le lien d’activation', `Envoyer un lien d’activation à ${email} ?`, () => compteActivation(id), false) : btn('Envoyer un lien de réinitialisation', `Envoyer un lien de réinitialisation du mot de passe à ${email} ?`, () => compteReinitialisation(id))}
      {active && btn('Désactiver', `Désactiver la connexion de ${email} ? Son mot de passe est retiré et ses sessions sont fermées ; son profil et son historique restent.`, () => compteDesactiver(id))}
      {estAdmin ? btn('Retirer les droits d’administration', `Retirer les droits d’administration de ${email} ?`, () => compteAdmin(id, false)) : btn('Rendre administrateur', `Donner les droits d’administration à ${email} ? Cette personne pourra lire et modifier toutes les données.`, () => compteAdmin(id, true))}
      {estAdmin && mfa && btn('Réinitialiser la double authentification', `Effacer la double authentification de ${email} ? Elle devra la réactiver à sa prochaine connexion.`, () => compteMfa(id))}
      {msg && (
        <p className={`fr-text--sm fr-mb-0 ${msg.ok ? 'fr-text-default--success' : 'fr-text-default--error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>
      )}
    </div>
  );
}
