/**
 * Rejoue les gestionnaires d'événements sur des lignes RÉELLES du document DEV, sans rien envoyer
 * ni écrire : les courriers sont seulement journalisés et les écritures Grist sont neutralisées.
 * Sert à vérifier que les champs lus existent bien dans les données Grist (formules comprises).
 * Les adresses ne sont jamais affichées, seulement leur nombre.
 */
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile('.env.local');
process.env.MAIL_TRANSPORT = 'log';

const writes: string[] = [];
GristClient.prototype.updateRecords = async function (table, rows) {
  writes.push(`${table}#${rows.map((r) => r.id)} ${Object.keys(rows[0]!.fields)}`);
};
GristClient.prototype.addRecords = async function (table) {
  throw new Error(`écriture interdite en essai à blanc : ${table}`);
};

const { grist } = await import('../src/server/config');
const { outbox } = await import('../src/server/mail/transport');
const ev = await import('../src/server/events/handlers');

const g = grist();
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const show = (label: string, res: { done: number; failed: number }) => {
  console.log(`\n## ${label} — ${res.done} ligne(s) traitée(s), ${res.failed} échec(s), ${outbox.length} courrier(s)`);
  const first = outbox[0];
  if (first) console.log(`   objet : ${first.subject}\n   extrait : ${strip(first.html).slice(0, 330)}…`);
  outbox.length = 0;
};

const marches = await g.records('Marches');
const pick = (pred: (m: Record<string, unknown>) => boolean) => marches.find(pred);

const aValider = pick((m) => m.A_valider === true);
if (aValider) show(`a valider (marché ${aValider.id})`, await ev.marcheAValider([aValider]));
const validee = pick((m) => m.Clause_validee === true);
if (validee) show(`clause validée (marché ${validee.id})`, await ev.marcheValidee([validee]));
const publiable = marches.filter((m) => m.Doit_Notifier_Publication === true);
console.log(`\nMarchés prêts à notifier dans DEV : ${publiable.length}`);
for (const m of publiable.slice(0, 2)) show(`publication (marché ${m.id}, ${Number(m.Nb_lots) > 0 ? 'alloti' : 'sans lot'})`, await ev.marchePublie([m]));
// Même marché, forcé comme publiable, pour voir le rendu des deux cas quels que soient les données.
for (const m of [pick((x) => Number(x.Nb_lots) > 0 && x.Est_marche_parent === true), pick((x) => Number(x.Nb_lots) === 0 && x.Est_marche_parent === true && !!x.Clauses_sociales)].filter(Boolean)) {
  show(`publication forcée (marché ${m!.id}, ${Number(m!.Nb_lots) > 0 ? 'alloti' : 'sans lot'})`, await ev.marchePublie([{ ...m!, Doit_Notifier_Publication: true }]));
}

const decls = await g.records('Declarations_Beneficiaires');
const validees = decls.filter((d) => d.Statut === 'validé' && d.Email_envoi);
if (validees[0]) show(`bénéficiaire déclaré (déclaration ${validees[0].id})`, await ev.beneficiaireDeclare([validees[0]]));
const refus = (await g.records('Declarations_Beneficiaires_Refus'))[0];
if (refus) show(`déclaration refusée (refus ${refus.id})`, await ev.declarationRefusee([refus]));
const acces = (await g.records('Acces_Coordonnees')).slice(0, 2);
if (acces.length) show(`consultation de coordonnées (${acces.length})`, await ev.consultationCoordonnees(acces));

console.log(`\nÉcritures Grist neutralisées : ${writes.length}`, writes.slice(0, 4));
