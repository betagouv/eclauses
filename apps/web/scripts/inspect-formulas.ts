// Lecture seule du DEV : formules et valeurs distinctes, pour cadrer la migration vers PostgreSQL.
import { grist } from '../src/server/config';

const WANTED: Record<string, string[]> = {
  Beneficiaires: ['Eligible', 'Doit_supprimer', 'Date_de_diplomation', 'Compte_active', 'Email_1', 'Courriel_ecole_eclauses', 'Annuaire', 'Connecte_6_derniers_mois', 'Date_de_suppression'],
  Repondants: ['Doit_supprimer'],
  Marches: ['Doit_archiver', 'Doit_Notifier_Publication', 'A_valider', 'Clause_validee', 'Statut_global', 'Est_lot', 'Marche_racine', 'Intitule_propre', 'Lot_Label', 'Doit_Geocoder', 'ID_Marche', 'Candidats', 'Titulaire_Label'],
  Acheteurs: ['Autonome'],
};

async function main() {
  const g = grist();
  for (const [table, cols] of Object.entries(WANTED)) {
    const res = await fetch(`${process.env.GRIST_BASE_URL}/api/docs/${process.env.GRIST_DOC_ID}/tables/${table}/columns`, { headers: { Authorization: `Bearer ${process.env.GRIST_API_KEY}` } });
    const all = ((await res.json()) as { columns: { id: string; fields: { type: string; formula?: string } }[] }).columns;
    for (const c of all.filter((x) => cols.includes(x.id))) console.log(`${table}.${c.id} [${c.fields.type}] = ${String(c.fields.formula || '').replace(/\s+/g, ' ').slice(0, 400)}`);
  }
  const distinct = async (table: string, col: string) => {
    const rows = await g.records(table);
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r[col]), (m.get(String(r[col])) ?? 0) + 1);
    console.log(`DISTINCT ${table}.${col}:`, JSON.stringify([...m]));
  };
  await distinct('Marches', 'Statut');
  await distinct('Declarations_Beneficiaires', 'Statut');
  await distinct('Invitation_Titulaire', 'Status');
  await distinct('Application_FAQ_Questions', 'Audience');
  await distinct('Support_Videos', 'Audience');
  await distinct('Acheteurs', 'Categorie');
  await distinct('Impacts', 'Type_d_indicateur');
  await distinct('Application_Liens', 'Variant');
  const counts: Record<string, number> = {};
  for (const t of ['Beneficiaires', 'Marches', 'Acheteurs', 'Repondants', 'Utilisateurs_Acheteurs', 'Application_AuthUser', 'AuthLink', 'Invitation_Titulaire', 'Declarations_Beneficiaires', 'Marches_Interets', 'Acces_Coordonnees', 'Clauses_sociales']) counts[t] = (await g.records(t)).length;
  console.log('COUNTS', JSON.stringify(counts));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
