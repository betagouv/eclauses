export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const publicUrl = (): string => (process.env.PUBLIC_URL ?? 'https://eclauses.beta.gouv.fr').replace(/\/$/, '');

export const link = (href: string, label: string): string =>
  `<a href="${esc(href)}"><strong>${esc(label)}</strong></a>`;

const SIGNATURE = `
<p>Bien cordialement,</p>
<p><strong>L'équipe Eclauses</strong><br/>
Expérimentation de l'Atelier numérique de la Culture et de la Mission ministérielle des achats<br/>
<a href="https://eclauses.beta.gouv.fr">https://eclauses.beta.gouv.fr</a></p>
<p>Ministère de la Culture<br/>
182, rue Saint-Honoré, 75001 Paris<br/>
Tél : 01 40 15 76 99 – 06 58 30 34 72<br/>
<a href="https://www.culture.gouv.fr">www.culture.gouv.fr</a></p>
<img src="https://eclauses.beta.gouv.fr/logo.png" alt="Eclauses" />`;

/** Corps commun des courriers : salutation, contenu, signature. */
export function layout(body: string, greeting = 'Bonjour,'): string {
  return `<p>${esc(greeting)}</p>\n${body}\n${SIGNATURE}`;
}

export const CONTEXTE_CLAUSE =
  "<p>La plateforme Eclauses permet le suivi de l'exécution des clauses sociales portées par le ministère de la Culture, et notamment la clause visant à <strong>favoriser l'insertion professionnelle des néo-diplômés en conservation-restauration de biens culturels.</strong></p>";
