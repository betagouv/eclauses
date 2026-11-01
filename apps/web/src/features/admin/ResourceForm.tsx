'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { enregistrer, supprimer } from '@/server/actions/admin';
import type { ResourceView } from './view';

type Option = { value: string; label: string };
type Values = Record<string, unknown>;

/** Formulaire généré à partir de la description d'une ressource : un champ par colonne éditable. */
export function ResourceForm({ view, id, initial, options }: { view: ResourceView; id: string | number | null; initial: Values; options: Record<string, Option[]> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));
  const creating = id == null;
  const editable = !view.readOnly;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await enregistrer(view.key, id, values);
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    router.push(`/admin/${view.key}?ok=${creating ? 'cree' : 'modifie'}`);
    router.refresh();
  }

  async function del() {
    if (id == null || !window.confirm('Supprimer définitivement cet élément ?')) return;
    setBusy(true);
    const res = await supprimer(view.key, id);
    setBusy(false);
    if (!res.ok) return setErr(res.message);
    router.push(`/admin/${view.key}?ok=supprime`);
    router.refresh();
  }

  const control = (f: ResourceView['fields'][number]) => {
    const id_ = `f-${f.name}`;
    const value = values[f.name];
    const disabled = !editable || f.readonly || (view.textId && !creating && f.name === 'cle');
    switch (f.type) {
      case 'textarea':
        return <textarea id={id_} className="fr-input" rows={f.html ? 8 : 4} value={String(value ?? '')} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />;
      case 'number':
        return <input id={id_} className="fr-input" type="number" step="any" value={value == null ? '' : String(value)} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />;
      case 'date':
        return <input id={id_} className="fr-input" type="date" value={String(value ?? '')} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />;
      case 'datetime':
        return <input id={id_} className="fr-input" value={value ? new Date(String(value)).toLocaleString('fr-FR') : '—'} disabled readOnly />;
      case 'bool':
        return (
          <div className="fr-checkbox-group">
            <input id={id_} type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => set(f.name, e.target.checked)} />
            <label className="fr-label" htmlFor={id_}>{f.label}</label>
          </div>
        );
      case 'enum':
        return (
          <select id={id_} className="fr-select" value={String(value ?? '')} disabled={disabled} onChange={(e) => set(f.name, e.target.value)}>
            <option value="">—</option>
            {Object.entries(f.options ?? {}).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        );
      case 'ref':
        return (
          <select id={id_} className="fr-select" value={String(value ?? '')} disabled={disabled} onChange={(e) => set(f.name, e.target.value)}>
            <option value="">—</option>
            {(options[f.name] ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'multi':
        return (
          <select id={id_} className="fr-select" multiple size={8} value={((value as number[]) ?? []).map(String)} disabled={disabled} onChange={(e) => set(f.name, [...e.target.selectedOptions].map((o) => o.value))}>
            {(options[f.name] ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      default:
        return <input id={id_} className="fr-input" type="text" maxLength={f.max} value={String(value ?? '')} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />;
    }
  };

  return (
    <form onSubmit={submit}>
      {err && (
        <div className="fr-alert fr-alert--error fr-mb-3w" role="alert">
          <p>{err}</p>
        </div>
      )}
      {view.account && (
        <div className="fr-input-group fr-mb-3w">
          <label className="fr-label" htmlFor="f-email">
            {view.account.label}
            {view.account.required && ' *'}
            <span className="fr-hint-text">Changer l’adresse change l’identifiant de connexion de la personne.</span>
          </label>
          <input id="f-email" className="fr-input" type="email" value={String(values.email ?? '')} disabled={!editable} onChange={(e) => set('email', e.target.value)} />
        </div>
      )}
      {view.fields.map((f) => (
        <div key={f.name} className="fr-input-group fr-mb-3w">
          {f.type !== 'bool' && (
            <label className="fr-label" htmlFor={`f-${f.name}`}>
              {f.label}
              {f.required && ' *'}
              {f.help && <span className="fr-hint-text">{f.help}</span>}
              {f.html && <span className="fr-hint-text">Contenu HTML publié tel quel sur le site : n’y collez que du texte de confiance.</span>}
            </label>
          )}
          {control(f)}
        </div>
      ))}
      <ul className="fr-btns-group fr-btns-group--inline">
        {editable && (
          <li>
            <button className="fr-btn" type="submit" disabled={busy}>{creating ? 'Créer' : 'Enregistrer'}</button>
          </li>
        )}
        <li>
          <Link className="fr-btn fr-btn--secondary" href={`/admin/${view.key}`}>Retour à la liste</Link>
        </li>
        {!creating && view.canDelete && (
          <li>
            <button className="fr-btn fr-btn--tertiary" type="button" onClick={del} disabled={busy}>Supprimer</button>
          </li>
        )}
      </ul>
    </form>
  );
}
