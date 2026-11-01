import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

// Le cookie de session lu par `requireSession` vient de `next/headers` : on le simule avec un jeton réel.
let cookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'eclauses_session' && cookie ? { value: cookie } : undefined) }) }));

describe.skipIf(!hasPostgres)('pages rendues par le serveur : chargement et actions', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let s: typeof import('@/server/db/schema');
  let actions: typeof import('@/server/actions/beneficiaire');
  let loadTables: typeof import('@/server/page-data').loadTables;
  let createSession: typeof import('@/server/auth/session').createSession;
  let base: Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    s = await import('@/server/db/schema');
    actions = await import('@/server/actions/beneficiaire');
    ({ loadTables } = await import('@/server/page-data'));
    ({ createSession } = await import('@/server/auth/session'));
    ({ seedBase } = await import('./helpers/fixtures'));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    cookie = undefined;
    await t.sql.unsafe('truncate acheteurs, utilisateurs, clauses_sociales, notifications_envoyees, fichiers, limites_debit restart identity cascade');
    base = await seedBase();
  });

  const actor = (b = base.a) => ({ email: b.user.email, roles: ['beneficiaire' as const], beneficiaireId: b.benef.id, repondantId: null, acheteurId: null, acheteurEntiteId: null });
  const login = async (userId: number) => {
    cookie = await createSession(userId);
  };

  describe('chargement des tables côté serveur', () => {
    it('lit en parallèle les tables obligatoires et facultatives avec les droits de l’acteur', async () => {
      const data = await loadTables(actor() as never, ['Marches'], ['Acheteurs', 'Clauses_sociales']);
      expect(Object.keys(data).sort()).toEqual(['Acheteurs', 'Clauses_sociales', 'Marches']);
      expect(data.Marches.map((m) => m.Intitule_du_marche)).toEqual(['Rénovation du musée']);
      expect(data.Clauses_sociales[0]).toMatchObject({ Nom_de_la_clause: 'Insertion des restaurateurs' });
    });

    it('une table facultative interdite donne une liste vide, une obligatoire fait échouer la page', async () => {
      const data = await loadTables(actor() as never, [], ['Application_AuthUser']);
      expect(data.Application_AuthUser).toEqual([]);
      await expect(loadTables(actor() as never, ['Application_AuthUser'])).rejects.toMatchObject({ status: 403 });
    });

    it('un visiteur ne voit que ce que voit un visiteur', async () => {
      const data = await loadTables(null, ['Marches'], ['Beneficiaires']);
      expect(data.Beneficiaires).toEqual([]);
      expect(data.Marches[0]).not.toHaveProperty('Statut');
    });
  });

  describe('actions des pages bénéficiaire', () => {
    it('sans session : refusées sans lever d’exception, avec un message', async () => {
      const res = await actions.ajouterInteret(base.parent.id);
      expect(res).toEqual({ ok: false, message: 'Authentification requise.' });
      expect(await base.db.select().from(s.interetsMarches)).toHaveLength(0);
    });

    it('ajouter puis retirer un intérêt renvoie la liste à jour, toujours pour le compte connecté', async () => {
      await login(base.a.user.id);
      const added = await actions.ajouterInteret(base.parent.id);
      expect(added.ok && added.data).toHaveLength(1);
      const [row] = await base.db.select().from(s.interetsMarches);
      expect(row!.beneficiaireId).toBe(base.a.benef.id);
      const removed = await actions.retirerInteret(row!.id);
      expect(removed).toEqual({ ok: true, data: [] });
    });

    it('un bénéficiaire ne retire pas l’intérêt d’un autre', async () => {
      await login(base.a.user.id);
      await actions.ajouterInteret(base.parent.id);
      const [row] = await base.db.select().from(s.interetsMarches);
      await login(base.b.user.id);
      expect(await actions.retirerInteret(row!.id)).toMatchObject({ ok: false });
      expect(await base.db.select().from(s.interetsMarches)).toHaveLength(1);
    });

    it('les identifiants invalides sont refusés avant toute écriture', async () => {
      await login(base.a.user.id);
      expect(await actions.ajouterInteret(-1)).toMatchObject({ ok: false, message: 'Marché invalide.' });
      expect(await actions.retirerInteret(Number.NaN)).toMatchObject({ ok: false, message: 'Intérêt invalide.' });
    });

    it('un acheteur ne peut pas utiliser les actions bénéficiaire', async () => {
      await login(base.userAcheteur.id);
      expect(await actions.ajouterInteret(base.parent.id)).toMatchObject({ ok: false });
      expect(await actions.enregistrerProfil({ Telephone: '1' })).toMatchObject({ ok: false });
      expect(await actions.lireProfil()).toEqual({ ok: true, data: null });
    });

    it('enregistrer le profil écrit en base et renvoie la fiche à jour ; l’e-mail et les champs internes sont refusés', async () => {
      await login(base.a.user.id);
      const res = await actions.enregistrerProfil({ Telephone: '0102030405', Fiche_MAJ: true });
      expect(res.ok && res.data).toMatchObject({ Telephone: '0102030405', Courriel: 'a@benef.test' });
      const [b] = await base.db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, base.a.benef.id));
      expect(b!.telephone).toBe('0102030405');
      expect(await actions.enregistrerProfil({ Courriel: 'autre@x.test' })).toMatchObject({ ok: false });
      expect(await actions.enregistrerProfil({ Commentaire: 'x' })).toMatchObject({ ok: false });
      const lu = await actions.lireProfil();
      expect(lu.ok && lu.data).toMatchObject({ Telephone: '0102030405' });
    });
  });
});
