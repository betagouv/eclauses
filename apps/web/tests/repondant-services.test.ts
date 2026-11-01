import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth/session';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

let cookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'eclauses_session' && cookie ? { value: cookie } : undefined) }) }));

describe.skipIf(!hasPostgres)('opérations du répondant', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let svc: typeof import('@/server/services/repondant');
  let actions: typeof import('@/server/actions/repondant');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let createSession: typeof import('@/server/auth/session').createSession;
  let base: Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    svc = await import('@/server/services/repondant');
    actions = await import('@/server/actions/repondant');
    s = await import('@/server/db/schema');
    outbox = (await import('@/server/mail/transport')).outbox;
    ({ createSession } = await import('@/server/auth/session'));
    ({ seedBase } = await import('./helpers/fixtures'));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    cookie = undefined;
    outbox.length = 0;
    await t.sql.unsafe('truncate acheteurs, utilisateurs, clauses_sociales, notifications_envoyees, fichiers, limites_debit restart identity cascade');
    base = await seedBase();
    // Marché dont le répondant est titulaire, en attente de déclaration (déjà notifié : pas de courrier de publication).
    await base.db.update(s.marches).set({ titulaireId: base.titulaire.id, statut: 'en_attente_declaration' }).where(eq(s.marches.id, base.parent.id));
    await base.db.insert(s.notificationsEnvoyees).values({ evenement: 'marche-publie', cle: String(base.parent.id) });
  });

  const repondant = (): Session => ({ email: 'titulaire@societe.test', roles: ['repondant'], beneficiaireId: null, repondantId: base.titulaire.id, acheteurId: null, acheteurEntiteId: null });
  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };
  const row = async () => (await base.db.select().from(s.marches).where(eq(s.marches.id, base.parent.id)))[0]!;
  const decls = () => base.db.select().from(s.declarationsBeneficiaires).where(eq(s.declarationsBeneficiaires.marcheId, base.parent.id));
  const manuel = { nom: 'Martin', prenom: 'Alex', email: 'Alex@Exemple.test' };

  describe('déclarer des bénéficiaires', () => {
    it('Eclauses et saisie manuelle : déclarations créées, marché « à valider », acheteur prévenu', async () => {
      await svc.declarerBeneficiaires(repondant(), base.parent.id, { eclauses: [base.a.benef.id], manuels: [manuel] });
      const d = await decls();
      expect(d.map((x) => [x.estBeneficiaireEclauses, x.beneficiaireId, x.email, x.statut]).sort()).toEqual([[false, null, 'alex@exemple.test', 'declare'], [true, base.a.benef.id, null, 'declare']]);
      expect(d.every((x) => x.repondantId === base.titulaire.id)).toBe(true);
      expect((await row()).statut).toBe('declaration_a_valider');
      expect(outbox.map((m) => m.to)).toEqual(['acheteur@culture.test']);
    });

    it('reprend les brouillons laissés par un refus, sans les dupliquer', async () => {
      const [b] = await base.db.insert(s.declarationsBeneficiaires).values({ repondantId: base.titulaire.id, marcheId: base.parent.id, beneficiaireId: base.a.benef.id, estBeneficiaireEclauses: true, statut: 'brouillon' }).returning();
      await svc.declarerBeneficiaires(repondant(), base.parent.id, { eclauses: [base.a.benef.id], manuels: [] });
      const d = await decls();
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ id: b!.id, statut: 'declare' });
    });

    it('refuse un bénéficiaire hors de la clause du marché, sans rien écrire', async () => {
      const [autre] = await base.db.insert(s.beneficiaires).values({ nom: 'Hors clause', anneeDiplome: new Date().getFullYear() - 1 }).returning();
      expect(await rejects(svc.declarerBeneficiaires(repondant(), base.parent.id, { eclauses: [base.a.benef.id, autre!.id], manuels: [] }))).toBe(400);
      expect(await decls()).toHaveLength(0);
      expect((await row()).statut).toBe('en_attente_declaration');
    });

    it('refuse une déclaration vide, une saisie invalide, un autre répondant, un autre statut, un autre rôle', async () => {
      expect(await rejects(svc.declarerBeneficiaires(repondant(), base.parent.id, { eclauses: [], manuels: [] }))).toBe(400);
      expect(await rejects(svc.declarerBeneficiaires(repondant(), base.parent.id, { manuels: [{ nom: '', prenom: 'x', email: 'a@b.fr' }] }))).toBe(400);
      expect(await rejects(svc.declarerBeneficiaires(repondant(), base.parent.id, { manuels: [{ nom: 'x', prenom: 'y', email: 'pas-un-mail' }] }))).toBe(400);
      const [autreUser] = await base.db.insert(s.utilisateurs).values({ email: 'autre@societe.test' }).returning();
      const [autre] = await base.db.insert(s.repondants).values({ utilisateurId: autreUser!.id }).returning();
      expect(await rejects(svc.declarerBeneficiaires({ ...repondant(), repondantId: autre!.id }, base.parent.id, { manuels: [manuel] }))).toBe(403);
      expect(await rejects(svc.declarerBeneficiaires({ ...repondant(), roles: ['beneficiaire'] }, base.parent.id, { manuels: [manuel] }))).toBe(403);
      await base.db.update(s.marches).set({ statut: 'declaration_a_valider' }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(svc.declarerBeneficiaires(repondant(), base.parent.id, { manuels: [manuel] }))).toBe(409);
      expect(await decls()).toHaveLength(0);
    });

    it('retirer : seulement ses déclarations non validées, tant que le marché attend', async () => {
      const [d] = await base.db.insert(s.declarationsBeneficiaires).values({ repondantId: base.titulaire.id, marcheId: base.parent.id, email: 'x@y.test', statut: 'declare' }).returning();
      const [validee] = await base.db.insert(s.declarationsBeneficiaires).values({ repondantId: base.titulaire.id, marcheId: base.parent.id, email: 'z@y.test', statut: 'valide' }).returning();
      expect(await rejects(svc.retirerDeclaration(repondant(), validee!.id))).toBe(409);
      const [autreUser] = await base.db.insert(s.utilisateurs).values({ email: 'autre@societe.test' }).returning();
      const [autre] = await base.db.insert(s.repondants).values({ utilisateurId: autreUser!.id }).returning();
      expect(await rejects(svc.retirerDeclaration({ ...repondant(), repondantId: autre!.id }, d!.id))).toBe(403);
      await base.db.update(s.marches).set({ statut: 'declaration_a_valider' }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(svc.retirerDeclaration(repondant(), d!.id))).toBe(409);
      await base.db.update(s.marches).set({ statut: 'en_attente_declaration' }).where(eq(s.marches.id, base.parent.id));
      await svc.retirerDeclaration(repondant(), d!.id);
      expect((await decls()).map((x) => x.id)).toEqual([validee!.id]);
    });
  });

  describe('consulter les coordonnées', () => {
    const consent = (over: Partial<typeof s.beneficiaires.$inferInsert> = {}) =>
      base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, consentementContactGroupements: true, telephone: '0102030405', ...over }).where(eq(s.beneficiaires.id, base.a.benef.id));

    it('livre les coordonnées d’une personne consentante, enregistre la consultation une fois et la prévient', async () => {
      await consent();
      expect(await svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id)).toEqual({ Courriel: 'a@benef.test', Telephone: '0102030405' });
      expect(await svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id)).toMatchObject({ Courriel: 'a@benef.test' });
      expect(await base.db.select().from(s.accesCoordonnees)).toHaveLength(1);
      expect(outbox.map((m) => m.to)).toEqual(['a@benef.test']);
    });

    it('un candidat (non titulaire) du marché peut consulter ; un répondant étranger au marché non', async () => {
      await consent();
      await base.db.update(s.marches).set({ titulaireId: null }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id))).toBe(403);
      await base.db.insert(s.candidatures).values({ marcheId: base.parent.id, repondantId: base.titulaire.id });
      expect(await svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id)).toMatchObject({ Courriel: 'a@benef.test' });
    });

    it('refuse une personne sans consentement au contact, hors annuaire ou hors durée de conservation, sans rien enregistrer', async () => {
      await consent({ consentementContactGroupements: false });
      expect(await rejects(svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id))).toBe(403);
      await consent({ consentementAnnuaire: false });
      expect(await rejects(svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id))).toBe(403);
      await consent({ anneeDiplome: new Date().getFullYear() - 8 });
      expect(await rejects(svc.consulterCoordonnees(repondant(), base.parent.id, base.a.benef.id))).toBe(403);
      expect(await base.db.select().from(s.accesCoordonnees)).toHaveLength(0);
      expect(outbox).toHaveLength(0);
    });
  });

  describe('actions', () => {
    it('sans session : refusées avec un message ; avec la session : succès, et la fiche enregistrée vient de la session', async () => {
      expect(await actions.declarer(base.parent.id, { manuels: [manuel] })).toEqual({ ok: false, message: 'Authentification requise.' });
      cookie = await createSession(base.titulaireUser.id);
      expect(await actions.declarer(base.parent.id, { manuels: [manuel] })).toEqual({ ok: true, data: null });
      const maj = await actions.enregistrerRepondant({ Telephone: '0600000000', Raison_sociale: 'Nouvelle raison' });
      expect(maj.ok && maj.data).toMatchObject({ Telephone: '0600000000', Raison_sociale: 'Nouvelle raison', Email: 'titulaire@societe.test' });
      expect(await actions.enregistrerRepondant({ Email: 'autre@x.test' })).toMatchObject({ ok: false });
    });

    it('un bénéficiaire ne peut pas utiliser les actions répondant', async () => {
      cookie = await createSession(base.a.user.id);
      expect(await actions.declarer(base.parent.id, { manuels: [manuel] })).toMatchObject({ ok: false });
      expect(await actions.coordonnees(base.parent.id, base.a.benef.id)).toMatchObject({ ok: false });
      expect(await actions.enregistrerRepondant({ Telephone: '1' })).toMatchObject({ ok: false });
    });
  });
});
