// Lecture seule : affiche les formules Grist demandées (« Table.Colonne »), pour les reproduire en SQL/TypeScript.
export {};
const [, , ...wanted] = process.argv;
const byTable = new Map<string, string[]>();
for (const w of wanted) {
  const [t, c] = w.split('.');
  byTable.set(t, [...(byTable.get(t) ?? []), c]);
}
for (const [table, cols] of byTable) {
  const res = await fetch(`${process.env.GRIST_BASE_URL}/api/docs/${process.env.GRIST_DOC_ID}/tables/${table}/columns`, {
    headers: { Authorization: `Bearer ${process.env.GRIST_API_KEY}` },
  });
  const all = ((await res.json()) as { columns: { id: string; fields: { type: string; formula?: string } }[] }).columns;
  for (const c of all.filter((x) => cols.includes(x.id))) console.log(`### ${table}.${c.id} [${c.fields.type}]\n${c.fields.formula}\n`);
}
