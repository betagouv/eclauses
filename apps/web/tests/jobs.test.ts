import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

describe.skipIf(!hasPostgres)('tâches planifiées', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let jobs: typeof import('@/server/jobs');
  let s: typeof import('@/server/db/schema');
  let db: ReturnType<(typeof import('@/server/db/client'))['database']>;
  const year = new Date().getFullYear();

  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'eclauses-jobs-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.STORAGE_LOCAL_DIR = dir;
    t = await useTemporaryDatabase();
    jobs = await import('@/server/jobs');
    s = await import('@/server/db/schema');
    db = (await import('@/server/db/client')).database();
  });
  afterAll(async () => {
    await t?.drop();
    await rm(dir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await t.sql.unsafe('truncate utilisateurs, beneficiaires, acheteurs, fichiers restart identity cascade');
  });

  const user = async (email: string, over: Partial<typeof s.utilisateurs.$inferInsert> = {}) =>
    (await db.insert(s.utilisateurs).values({ email, motDePasseHash: 'x', ...over }).returning())[0]!;

  it('anonymise les bénéficiaires de plus de 10 ans, supprime leur compte, garde la ligne', async () => {
    const u = await user('vieux@benef.test');
    const [vieux] = await db.insert(s.beneficiaires).values({ nom: 'Vieux', prenom: 'Paul', telephone: '0102', anneeDiplome: year - 11, utilisateurId: u.id }).returning();
    const [recent] = await db.insert(s.beneficiaires).values({ nom: 'Récent', anneeDiplome: year - 1 }).returning();
    const res = await jobs.JOBS['anonymise-beneficiaires']!();
    expect(res.processed).toBe(1);
    const [after] = await db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, vieux!.id));
    expect(after).toMatchObject({ nom: `Beneficiaire #${vieux!.id}`, prenom: null, telephone: null, utilisateurId: null });
    expect(after!.anonymiseLe).toBe(new Date().toISOString().slice(0, 10));
    expect(await db.select().from(s.utilisateurs)).toHaveLength(0);
    const [r] = await db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, recent!.id));
    expect(r!.nom).toBe('Récent');
    // Rejouée, la tâche ne retraite pas la ligne déjà anonymisée.
    expect((await jobs.JOBS['anonymise-beneficiaires']!()).processed).toBe(0);
  });

  it('retire l’accès des bénéficiaires non éligibles sans supprimer leur fiche', async () => {
    const u = await user('ancien@benef.test');
    const ok = await user('ok@benef.test');
    await db.insert(s.beneficiaires).values([
      { nom: 'Ancien', anneeDiplome: year - 6, utilisateurId: u.id },
      { nom: 'Éligible', anneeDiplome: year - 1, utilisateurId: ok.id },
    ]);
    await db.insert(s.sessions).values({ empreinte: 'e1', utilisateurId: u.id, expireLe: new Date(Date.now() + 3600_000) });
    expect((await jobs.JOBS['delete-ineligible-accounts']!()).processed).toBe(1);
    const [a] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, u.id));
    expect(a!.motDePasseHash).toBeNull();
    expect(await db.select().from(s.sessions)).toHaveLength(0);
    const [b] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, ok.id));
    expect(b!.motDePasseHash).toBe('x');
    expect(await db.select().from(s.beneficiaires)).toHaveLength(2);
  });

  it('anonymise les répondants sans connexion depuis plus de 5 ans', async () => {
    const old = await user('vieux@rep.test', { derniereConnexionLe: new Date(Date.now() - 6 * 365 * 86400_000) });
    const fresh = await user('frais@rep.test', { derniereConnexionLe: new Date() });
    await db.insert(s.repondants).values([{ utilisateurId: old.id, nom: 'Vieux', siret: '123' }, { utilisateurId: fresh.id, nom: 'Frais' }]);
    expect((await jobs.JOBS['anonymise-repondants']!()).processed).toBe(1);
    const rows = await db.select().from(s.repondants);
    const anon = rows.find((r) => r.anonymiseLe)!;
    expect(anon).toMatchObject({ siret: null, utilisateurId: null });
    expect(rows.find((r) => r.nom === 'Frais')!.utilisateurId).toBe(fresh.id);
  });

  it('archive les marchés validés terminés depuis plus de quatre ans et demi, pas les autres', async () => {
    const [a] = await db.insert(s.acheteurs).values({ nom: 'A' }).returning();
    const day = (years: number) => new Date(Date.now() - years * 365.25 * 86400_000).toISOString().slice(0, 10);
    await db.insert(s.marches).values([
      { acheteurId: a!.id, intitule: 'Ancien validé', statut: 'clause_validee', dateFinExecution: day(5) },
      { acheteurId: a!.id, intitule: 'Récent validé', statut: 'clause_validee', dateFinExecution: day(2) },
      { acheteurId: a!.id, intitule: 'Ancien non validé', statut: 'en_attente_declaration', dateFinExecution: day(5) },
    ]);
    expect((await jobs.JOBS['archive-marches']!()).processed).toBe(1);
    const rows = await db.select().from(s.marches);
    expect(Object.fromEntries(rows.map((m) => [m.intitule, m.statut]))).toEqual({
      'Ancien validé': 'archive',
      'Récent validé': 'clause_validee',
      'Ancien non validé': 'en_attente_declaration',
    });
  });

  it('purge les jetons expirés ou utilisés et les sessions expirées', async () => {
    const u = await user('x@y.test');
    await db.insert(s.jetonsAuth).values([
      { utilisateurId: u.id, objectif: 'activation', empreinte: 'a', expireLe: new Date(Date.now() - 1000) },
      { utilisateurId: u.id, objectif: 'activation', empreinte: 'b', expireLe: new Date(Date.now() + 86400_000) },
    ]);
    await db.insert(s.sessions).values([
      { empreinte: 's1', utilisateurId: u.id, expireLe: new Date(Date.now() - 1000) },
      { empreinte: 's2', utilisateurId: u.id, expireLe: new Date(Date.now() + 86400_000) },
    ]);
    expect((await jobs.JOBS['purge-resets']!()).processed).toBe(1);
    expect((await jobs.JOBS['purge-sessions']!()).processed).toBe(1);
    expect((await db.select().from(s.jetonsAuth)).map((j) => j.empreinte)).toEqual(['b']);
  });

  it('supprime les fichiers jamais rattachés à une fiche, garde ceux d’un CV et les dépôts récents', async () => {
    const { enregistrerFichier, lireFichier } = await import('@/server/services/fichiers');
    const mk = (nom: string) => enregistrerFichier({ contenu: new Uint8Array([1, 2, 3]), nom, typeMime: 'application/pdf', usage: 'cv', utilisateurId: null });
    const [orphelin, recent, utilise] = [await mk('orphelin.pdf'), await mk('recent.pdf'), await mk('utilise.pdf')];
    await db.insert(s.beneficiaires).values({ nom: 'A', cvFichierId: utilise.id });
    await t.sql.unsafe(`update fichiers set cree_le = now() - interval '2 days' where id in ('${orphelin.id}', '${utilise.id}')`);
    expect((await jobs.JOBS['purge-fichiers']!()).processed).toBe(1);
    expect(await lireFichier(orphelin.id)).toBeNull();
    expect(await lireFichier(recent.id)).not.toBeNull();
    expect(await lireFichier(utilise.id)).not.toBeNull();
  });
});
