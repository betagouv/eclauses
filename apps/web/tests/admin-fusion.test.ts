import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedBase } from './helpers/fixtures';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

describe.skipIf(!hasPostgres)('administration : fusion de doublons', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let f: typeof import('@/server/admin/fusion');
  let s: typeof import('@/server/db/schema');
  let base: Awaited<ReturnType<typeof seedBase>>;
  const admin = { email: 'admin@culture.test', roles: ['admin' as const], beneficiaireId: null, repondantId: null, acheteurId: null, acheteurEntiteId: null, mfa: true };

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    f = await import('@/server/admin/fusion');
    s = await import('@/server/db/schema');
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.sql.unsafe('truncate utilisateurs, acheteurs, clauses_sociales, marches, specialites, audit_admin, repondants, beneficiaires restart identity cascade');
    base = await seedBase();
  });

  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };

  async function deuxMarches() {
    const [m1, m2] = await base.db.insert(s.marches).values([{ acheteurId: base.acheteur.id, intitule: 'M1', dateLimiteOffres: '2027-03-01' }, { acheteurId: base.acheteur.id, intitule: 'M2', dateLimiteOffres: '2027-03-01' }]).returning();
    return [m1!, m2!];
  }

  describe('bénéficiaires', () => {
    it('reporte intérêts, déclarations et listes, complète les champs vides et garde le consentement le plus restrictif', async () => {
      const [m1, m2] = await deuxMarches();
      const keep = base.a.benef;
      const drop = base.b.benef;
      const [sp1, sp2] = await base.db.insert(s.specialites).values([{ intitule: 'Peinture' }, { intitule: 'Pierre' }]).returning();
      await base.db.insert(s.beneficiaireSpecialites).values([{ beneficiaireId: keep.id, specialiteId: sp1!.id }, { beneficiaireId: drop.id, specialiteId: sp1!.id }, { beneficiaireId: drop.id, specialiteId: sp2!.id }]);
      await base.db.insert(s.interetsMarches).values([{ marcheId: m1.id, beneficiaireId: keep.id }, { marcheId: m1.id, beneficiaireId: drop.id }, { marcheId: m2.id, beneficiaireId: drop.id }]);
      await base.db.insert(s.declarationsBeneficiaires).values({ marcheId: m1.id, beneficiaireId: drop.id, estBeneficiaireEclauses: true });
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, consentementContactGroupements: true, telephone: null, commentaire: 'Note A' }).where(eq(s.beneficiaires.id, keep.id));
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, consentementContactGroupements: false, telephone: '0102030405', commentaire: 'Note B', alumni: true }).where(eq(s.beneficiaires.id, drop.id));

      const preview = await f.apercu('beneficiaire', keep.id, drop.id);
      expect(preview.deplaces).toMatchObject({ 'intérêts pour des marchés': 2, déclarations: 1, spécialités: 2 });
      expect(preview.avertissements[0]).toMatch(/désactivé/);

      await f.fusionner(admin, 'beneficiaire', keep.id, drop.id);

      expect(await base.db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, drop.id))).toHaveLength(0);
      const [k] = await base.db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, keep.id));
      expect(k).toMatchObject({ telephone: '0102030405', consentementAnnuaire: true, consentementContactGroupements: false, alumni: true, commentaire: 'Note A\n---\nNote B' });
      expect((await base.db.select().from(s.beneficiaireSpecialites).where(eq(s.beneficiaireSpecialites.beneficiaireId, keep.id))).map((x) => x.specialiteId).sort()).toEqual([sp1!.id, sp2!.id].sort());
      expect((await base.db.select().from(s.interetsMarches).where(eq(s.interetsMarches.beneficiaireId, keep.id))).map((x) => x.marcheId).sort()).toEqual([m1.id, m2.id].sort());
      expect((await base.db.select().from(s.declarationsBeneficiaires))[0]!.beneficiaireId).toBe(keep.id);
      // les deux profils avaient un compte : celui du doublon est désactivé et détaché
      const [u] = await base.db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, base.b.user.id));
      expect(u!.motDePasseHash).toBeNull();
      const [log] = await base.db.select().from(s.auditAdmin);
      expect(log).toMatchObject({ action: 'fusion.beneficiaire', entiteId: String(keep.id) });
    });

    it('rattache le compte du doublon quand le profil conservé n’en a pas', async () => {
      await base.db.update(s.beneficiaires).set({ utilisateurId: null }).where(eq(s.beneficiaires.id, base.a.benef.id));
      await f.fusionner(admin, 'beneficiaire', base.a.benef.id, base.b.benef.id);
      const [k] = await base.db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, base.a.benef.id));
      expect(k!.utilisateurId).toBe(base.b.user.id);
    });

    it('refuse un même profil, un profil inconnu, et les non-administrateurs', async () => {
      expect(await rejects(f.fusionner(admin, 'beneficiaire', base.a.benef.id, base.a.benef.id))).toBe(400);
      expect(await rejects(f.fusionner(admin, 'beneficiaire', base.a.benef.id, 9999))).toBe(404);
      expect(await rejects(f.fusionner({ ...admin, roles: ['beneficiaire'] }, 'beneficiaire', base.a.benef.id, base.b.benef.id))).toBe(403);
      expect(await base.db.select().from(s.beneficiaires)).toHaveLength(3);
    });

    it('détecte les doublons de même nom et prénom', async () => {
      await base.db.update(s.beneficiaires).set({ nom: 'Durand', prenom: 'Léa' }).where(eq(s.beneficiaires.id, base.a.benef.id));
      await base.db.update(s.beneficiaires).set({ nom: ' durand ', prenom: 'léa' }).where(eq(s.beneficiaires.id, base.b.benef.id));
      const d = (await f.doublonsProbables()).filter((x) => x.type === 'beneficiaire');
      expect(d).toHaveLength(1);
      expect(d[0]!.profils.map((p) => p.id)).toEqual([base.a.benef.id, base.b.benef.id]);
    });
  });

  describe('candidats', () => {
    it('reporte candidatures, accès, invitations et titularité sans violer les unicités', async () => {
      const [m1, m2] = await deuxMarches();
      const keep = base.titulaire;
      const [drop] = await base.db.insert(s.repondants).values({ nom: 'Z2', siret: '123 456', raisonSociale: 'Z bis' }).returning();
      await base.db.insert(s.candidatures).values([{ marcheId: m1.id, repondantId: keep.id }, { marcheId: m1.id, repondantId: drop!.id }, { marcheId: m2.id, repondantId: drop!.id }]);
      await base.db.insert(s.accesCoordonnees).values([{ repondantId: keep.id, marcheId: m1.id, beneficiaireId: base.a.benef.id }, { repondantId: drop!.id, marcheId: m1.id, beneficiaireId: base.a.benef.id }, { repondantId: drop!.id, marcheId: m2.id, beneficiaireId: base.a.benef.id }]);
      await base.db.insert(s.invitationsTitulaires).values({ marcheId: m2.id, email: 'x@y.fr', repondantId: drop!.id });
      await base.db.update(s.marches).set({ titulaireId: drop!.id }).where(eq(s.marches.id, m2.id));

      await f.fusionner(admin, 'repondant', keep.id, drop!.id);

      expect((await base.db.select().from(s.candidatures).where(eq(s.candidatures.repondantId, keep.id))).map((c) => c.marcheId).sort()).toEqual([m1.id, m2.id].sort());
      expect(await base.db.select().from(s.accesCoordonnees).where(eq(s.accesCoordonnees.repondantId, keep.id))).toHaveLength(2);
      expect((await base.db.select().from(s.invitationsTitulaires))[0]!.repondantId).toBe(keep.id);
      expect((await base.db.select().from(s.marches).where(eq(s.marches.id, m2.id)))[0]!.titulaireId).toBe(keep.id);
      const [k] = await base.db.select().from(s.repondants).where(eq(s.repondants.id, keep.id));
      expect(k).toMatchObject({ siret: '123 456', raisonSociale: 'Entreprise Z' });
      expect(await base.db.select().from(s.repondants).where(eq(s.repondants.id, drop!.id))).toHaveLength(0);
    });

    it('détecte les doublons de même SIRET', async () => {
      await base.db.update(s.repondants).set({ siret: '111 222' }).where(eq(s.repondants.id, base.titulaire.id));
      await base.db.insert(s.repondants).values({ nom: 'Autre', siret: '111222' });
      const d = (await f.doublonsProbables()).filter((x) => x.type === 'repondant');
      expect(d).toHaveLength(1);
    });
  });
});
