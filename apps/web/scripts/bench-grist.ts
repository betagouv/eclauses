/** Mesure la latence des appels Grist utilisés par l'application (document défini dans .env.local). */
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile('.env.local');
const g = new GristClient({
  baseUrl: process.env.GRIST_BASE_URL!,
  docId: process.env.GRIST_DOC_ID!,
  apiKey: process.env.GRIST_API_KEY!,
});

async function bench(label: string, fn: () => Promise<unknown>, n = 10) {
  await fn(); // chauffe la connexion
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await fn();
    t.push(performance.now() - t0);
  }
  t.sort((a, b) => a - b);
  const med = t[Math.floor(n / 2)]!;
  console.log(`${label.padEnd(52)} médiane ${med.toFixed(0).padStart(4)} ms   min ${t[0]!.toFixed(0).padStart(4)}   max ${t[n - 1]!.toFixed(0).padStart(4)}`);
}

await bench('GET /tables (aller-retour minimal)', () => g.tables());
await bench('records Beneficiaires : une fiche (filtre id)', () => g.records('Beneficiaires', { filter: { id: [309] } }));
await bench('records Beneficiaires : toutes les fiches', () => g.records('Beneficiaires'));
await bench('records Beneficiaires : consentantes (filtre Bool)', () =>
  g.records('Beneficiaires', { filter: { Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur: [true] } }),
);
await bench('sql : une fiche par id', () => g.sql('SELECT id, NOM FROM Beneficiaires WHERE id = ?1', [309]));
await bench('sql : agrégat sur toutes les fiches', () => g.sql('SELECT COUNT(*) AS n, MAX(Annee_de_diplome) AS a FROM Beneficiaires'));
await bench('records T0_Referentiel_Specialites', () => g.records('T0_Referentiel_Specialites'));
await bench('4 référentiels en parallèle', () =>
  Promise.all(['Formations', 'Specialites', 'Departements', 'Regions'].map((r) => g.records(`T0_Referentiel_${r}`))),
);
await bench('3 requêtes SQL en séquence (résolution des rôles)', async () => {
  await g.sql('SELECT id FROM Beneficiaires WHERE lower(Courriel) = ?1', ['x@y.fr']);
  await g.sql('SELECT id FROM Repondants WHERE lower(Email) = ?1', ['x@y.fr']);
  await g.sql('SELECT id FROM Utilisateurs_Acheteurs WHERE lower(Email) = ?1', ['x@y.fr']);
});
await bench('3 requêtes SQL en parallèle', () =>
  Promise.all([
    g.sql('SELECT id FROM Beneficiaires WHERE lower(Courriel) = ?1', ['x@y.fr']),
    g.sql('SELECT id FROM Repondants WHERE lower(Email) = ?1', ['x@y.fr']),
    g.sql('SELECT id FROM Utilisateurs_Acheteurs WHERE lower(Email) = ?1', ['x@y.fr']),
  ]),
);
const rows = await g.records('Beneficiaires');
console.log(`\nBeneficiaires : ${rows.length} lignes, ${(JSON.stringify(rows).length / 1024).toFixed(0)} Ko en JSON`);
