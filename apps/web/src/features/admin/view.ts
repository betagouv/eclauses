import type { Field, Resource } from '@/server/admin/types';

/** Description d'une ressource transmissible au navigateur (sans table ni accès à la base). */
export interface ResourceView {
  key: string;
  label: string;
  labelPluriel: string;
  intro?: string;
  canDelete: boolean;
  readOnly: boolean;
  account?: { label: string; required: boolean };
  textId: boolean;
  fields: Pick<Field, 'name' | 'label' | 'type' | 'required' | 'readonly' | 'help' | 'options' | 'ref' | 'html' | 'max' | 'list'>[];
}

export function toView(r: Resource): ResourceView {
  return {
    key: r.key,
    label: r.label,
    labelPluriel: r.labelPluriel,
    intro: r.intro,
    canDelete: !!r.canDelete && !r.readOnly,
    readOnly: !!r.readOnly,
    account: r.account ? { label: r.account.label, required: !!r.account.required } : undefined,
    textId: !!r.idProp && r.idProp !== 'id',
    fields: r.fields.map(({ name, label, type, required, readonly, help, options, ref, html, max, list }) => ({ name, label, type, required, readonly, help, options, ref, html, max, list })),
  };
}
