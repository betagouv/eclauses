'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fusionApercu, fusionExecuter } from '@/server/actions/admin';
import type { Apercu } from '@/server/admin/fusion';

interface Props {
  type: 'beneficiaire' | 'repondant';
  conserveId?: number;
  supprimeId?: number;
}

/** Fusion en deux temps : on affiche d'abord ce qui sera déplacé, puis on confirme. */
export function FusionForm({ type, conserveId, supprimeId }: Props) {
  const router = useRouter();
  const [a, setA] = useState(conserveId ? String(conserveId) : '');
  const [b, setB] = useState(supprimeId ? String(supprimeId) : '');
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function voir() {
    setMsg(null);
    setApercu(null);
    setBusy(true);
    const res = await fusionApercu(type, Number(a), Number(b));
    setBusy(false);
    if (res.ok) setApercu(res.data);
    else setMsg({ ok: false, text: res.message });
  }

  async function fusionner() {
    if (!apercu || !window.confirm(`Fusionner « ${apercu.supprime.libelle} » dans « ${apercu.conserve.libelle} » ? Le profil ${apercu.supprime.id} sera supprimé définitivement.`)) return;
    setBusy(true);
    const res = await fusionExecuter(type, Number(a), Number(b));
    setBusy(false);
    if (res.ok) {
      setApercu(null);
      setMsg({ ok: true, text: 'Fusion effectuée.' });
      router.refresh();
    } else setMsg({ ok: false, text: res.message });
  }

  return (
    <div className="fr-mb-4w">
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom">
        <div className="fr-col-6 fr-col-md-3">
          <label className="fr-label" htmlFor={`a-${type}`}>Numéro du profil à conserver</label>
          <input id={`a-${type}`} className="fr-input" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="fr-col-6 fr-col-md-3">
          <label className="fr-label" htmlFor={`b-${type}`}>Numéro du doublon à supprimer</label>
          <input id={`b-${type}`} className="fr-input" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        <div className="fr-col-auto">
          <button type="button" className="fr-btn fr-btn--secondary" disabled={busy || !a || !b} onClick={voir}>Voir ce qui sera fusionné</button>
        </div>
      </div>
      {apercu && (
        <div className="fr-callout fr-mt-2w">
          <p className="fr-callout__text">
            Conservé : <strong>{apercu.conserve.libelle}</strong> ({apercu.conserve.email ?? 'sans compte'}).<br />
            Supprimé : <strong>{apercu.supprime.libelle}</strong> ({apercu.supprime.email ?? 'sans compte'}).
          </p>
          <p className="fr-text--sm">
            Reporté sur le profil conservé : {Object.entries(apercu.deplaces).map(([k, v]) => `${v} ${k}`).join(', ') || 'rien'}.
          </p>
          {apercu.avertissements.map((w) => (
            <p key={w} className="fr-text--sm fr-text-default--warning">{w}</p>
          ))}
          <button type="button" className="fr-btn" disabled={busy} onClick={fusionner}>Fusionner</button>
        </div>
      )}
      {msg && (
        <p className={msg.ok ? 'fr-text-default--success' : 'fr-text-default--error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>
      )}
    </div>
  );
}
