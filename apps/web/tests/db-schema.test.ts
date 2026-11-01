import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { beneficiaireADetruire, beneficiaireEligible } from '@/server/db/expr';
import { acheteurs, beneficiaires, fichiers, marches, notificationsEnvoyees, repondants, utilisateurs } from '@/server/db/schema';
import { hasPostgres, temporaryDatabase } from './helpers/pg';

describe.skipIf(!hasPostgres)('schéma PostgreSQL', () => {
  let t: Awaited<ReturnType<typeof temporaryDatabase>>;
  beforeAll(async () => {
    t = await temporaryDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const rejects = async (p: PromiseLike<unknown>) => {
    try {
      await p;
    } catch (e) {
      const cause = (e as { cause?: { code?: string } }).cause;
      return cause?.code ?? (e as { code?: string }).code ?? 'erreur';
    }
    return null;
  };

  it("refuse deux comptes dont l'e-mail ne diffère que par la casse", async () => {
    await t.db.insert(utilisateurs).values({ email: 'Marie@Example.test' });
    expect(await rejects(t.db.insert(utilisateurs).values({ email: 'marie@example.test' }))).toBe('23505');
  });

  it("calcule la date de diplomation et l'éligibilité", async () => {
    const year = new Date().getFullYear();
    const [recent, ancien, vieux] = await t.db
      .insert(beneficiaires)
      .values([
        { nom: 'Récent', anneeDiplome: year - 1 },
        { nom: 'Ancien', anneeDiplome: year - 6 },
        { nom: 'Très ancien', anneeDiplome: year - 11 },
      ])
      .returning({ id: beneficiaires.id, date: beneficiaires.dateDiplomation });
    expect(recent.date).toBe(`${year - 1}-09-15`);
    const rows = await t.db
      .select({ id: beneficiaires.id, eligible: beneficiaireEligible, detruire: beneficiaireADetruire })
      .from(beneficiaires);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by[recent.id]).toMatchObject({ eligible: true, detruire: false });
    expect(by[ancien.id]).toMatchObject({ eligible: false, detruire: false });
    expect(by[vieux.id]).toMatchObject({ eligible: false, detruire: true });
  });

  it("un bénéficiaire sans année de diplôme n'est ni éligible ni à détruire", async () => {
    const [b] = await t.db.insert(beneficiaires).values({ nom: 'Sans année' }).returning({ id: beneficiaires.id });
    const [r] = await t.db.select({ eligible: beneficiaireEligible, detruire: beneficiaireADetruire }).from(beneficiaires).where(eq(beneficiaires.id, b.id));
    expect(r).toEqual({ eligible: false, detruire: false });
  });

  it("modélise un marché parent et ses lots, et protège le parent d'une suppression", async () => {
    const [a] = await t.db.insert(acheteurs).values({ nom: 'Entité', categorie: 'services_deconcentres' }).returning();
    const [parent] = await t.db.insert(marches).values({ acheteurId: a.id, intitule: 'Parent' }).returning();
    const [lot] = await t.db.insert(marches).values({ acheteurId: a.id, parentId: parent.id, intitule: 'Parent', numeroLot: '1' }).returning();
    expect(lot.statut).toBe('en_attente_notification');
    expect(lot.creationEnAutonomie).toBe(false);
    expect(await rejects(t.db.delete(marches).where(eq(marches.id, parent.id)))).toBe('23503');
  });

  it("rejette un statut hors énumération", async () => {
    const [a] = await t.db.select().from(acheteurs).limit(1);
    expect(await rejects(t.db.execute(sql`insert into marches (acheteur_id, intitule, statut) values (${a.id}, 'x', 'inconnu')`))).toBe('22P02');
  });

  it("n'enregistre qu'une fois un courrier pour le même événement", async () => {
    await t.db.insert(notificationsEnvoyees).values({ evenement: 'marche-publie', cle: '42' });
    expect(await rejects(t.db.insert(notificationsEnvoyees).values({ evenement: 'marche-publie', cle: '42' }))).toBe('23505');
    await t.db.insert(notificationsEnvoyees).values({ evenement: 'marche-publie', cle: '43' });
  });

  it("garde le bénéficiaire quand le compte est supprimé, et un seul profil par compte", async () => {
    const [u] = await t.db.insert(utilisateurs).values({ email: 'benef@example.test' }).returning();
    const [b] = await t.db.insert(beneficiaires).values({ nom: 'Lié', utilisateurId: u.id }).returning();
    expect(await rejects(t.db.insert(beneficiaires).values({ nom: 'Doublon', utilisateurId: u.id }))).toBe('23505');
    await t.db.delete(utilisateurs).where(eq(utilisateurs.id, u.id));
    const [after] = await t.db.select().from(beneficiaires).where(eq(beneficiaires.id, b.id));
    expect(after.utilisateurId).toBeNull();
  });

  it('référence un fichier par un identifiant opaque', async () => {
    const [f] = await t.db.insert(fichiers).values({ cle: 'cv/abc', nomOriginal: 'cv.pdf', typeMime: 'application/pdf', taille: 10, sha256: 'x', usage: 'cv' }).returning();
    expect(f.id).toMatch(/^[0-9a-f-]{36}$/);
    const [b] = await t.db.insert(beneficiaires).values({ nom: 'Avec CV', cvFichierId: f.id }).returning();
    expect(b.cvFichierId).toBe(f.id);
    await t.db.delete(fichiers).where(eq(fichiers.id, f.id));
    const [after] = await t.db.select().from(beneficiaires).where(eq(beneficiaires.id, b.id));
    expect(after.cvFichierId).toBeNull();
  });

  it('un répondant peut exister sans compte (anonymisé)', async () => {
    const [r] = await t.db.insert(repondants).values({ nom: 'Anonymisé' }).returning();
    expect(r.utilisateurId).toBeNull();
  });
});
