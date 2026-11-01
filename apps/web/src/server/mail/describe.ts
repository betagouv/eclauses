import type { Row } from '../compat/engine';
import { esc } from './layout';

/**
 * Description d'un marché pour les courriers. Une seule fonction pour tous les gabarits : un lot est
 * présenté avec son marché parent, un marché sans lot n'a ni ligne « Lot » ni vocabulaire de lot.
 */
export interface MarcheInfo {
  id: number;
  isLot: boolean;
  /** « lot » ou « marché », pour accorder les phrases. */
  noun: 'lot' | 'marché';
  /** « du lot » ou « du marché ». */
  ofNoun: 'du lot' | 'du marché';
  marcheTitle: string;
  lotLabel: string | null;
  acheteur: string;
  titulaire: string;
  titulaireEmail: string | null;
  clauseIds: number[];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

export function describeMarche(row: Row): MarcheInfo {
  const isLot = row.Est_lot === true || (typeof row.Marche_parent === 'number' && row.Marche_parent > 0);
  const title = str(row.Marche_parent_Intitule_propre) || str(row.Intitule_propre) || str(row.Intitule_du_marche, 'Marché non renseigné');
  return {
    id: row.id,
    isLot,
    noun: isLot ? 'lot' : 'marché',
    ofNoun: isLot ? 'du lot' : 'du marché',
    marcheTitle: title,
    lotLabel: isLot ? str(row.Lot_Label) || str(row.Intitule_du_lot) || `Lot ${row.Numero_de_lot ?? ''}`.trim() : null,
    acheteur: str(row.Acheteur_Nom, 'Acheteur non renseigné'),
    titulaire: str(row.Titulaire_Label, 'Titulaire non renseigné'),
    titulaireEmail: null,
    clauseIds: [],
  };
}

export async function loadMarcheInfo(id: number): Promise<MarcheInfo | null> {
  // Import tardif : `compat/marches` dépend de `mail/layout`, comme ce module.
  const { marches } = await import('../compat/marches');
  const row = await marches.byId(id);
  return row ? describeMarche(row) : null;
}

/** Lignes « Marché / Lot / … » d'un courrier. */
export function marcheList(info: MarcheInfo, extra: { label: string; value: string }[] = []): string {
  const items = [`<li>Marché : ${esc(info.marcheTitle)}</li>`];
  if (info.isLot && info.lotLabel) items.push(`<li>Lot : ${esc(info.lotLabel)}</li>`);
  for (const e of extra) items.push(`<li>${esc(e.label)} : ${esc(e.value)}</li>`);
  return `<ul>${items.join('')}</ul>`;
}
