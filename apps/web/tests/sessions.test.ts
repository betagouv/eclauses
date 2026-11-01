import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

// `rateLimit` n'a pas besoin de `next/headers` ; on neutralise l'import côté serveur pour les tests.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

describe.skipIf(!hasPostgres)('sessions et limiteur de débit', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let ses: typeof import('@/server/auth/session');
  let s: typeof import('@/server/db/schema');
  let http: typeof import('@/server/http');
  let comptes: typeof import('@/server/services/comptes');
  let db: ReturnType<(typeof import('@/server/db/client'))['database']>;
  const year = new Date().getFullYear();

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    ses = await import('@/server/auth/session');
    s = await import('@/server/db/schema');
    http = await import('@/server/http');
    comptes = await import('@/server/services/comptes');
    db = (await import('@/server/db/client')).database();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.sql.unsafe('truncate utilisateurs, beneficiaires, acheteurs, limites_debit restart identity cascade');
  });

  const benefAccount = async (anneeDiplome = year - 1) => {
    const [u] = await db.insert(s.utilisateurs).values({ email: 'b@benef.test', motDePasseHash: 'x' }).returning();
    const [b] = await db.insert(s.beneficiaires).values({ nom: 'B', utilisateurId: u!.id, anneeDiplome }).returning();
    return { user: u!, benef: b! };
  };

  describe('sessions', () => {
    it('le navigateur ne porte qu’un jeton opaque ; la base n’en garde que l’empreinte', async () => {
      const { user } = await benefAccount();
      const jeton = await ses.createSession(user.id);
      const [row] = await db.select().from(s.sessions);
      expect(row!.empreinte).not.toBe(jeton);
      expect(row!.empreinte).toHaveLength(64);
      expect(await ses.readSession(jeton)).toMatchObject({ email: 'b@benef.test', roles: ['beneficiaire'] });
    });

    it('jeton inconnu, vide ou trafiqué : pas de session', async () => {
      expect(await ses.readSession(undefined)).toBeNull();
      expect(await ses.readSession('court')).toBeNull();
      expect(await ses.readSession('x'.repeat(43))).toBeNull();
    });

    it('la déconnexion révoque la session côté serveur', async () => {
      const { user } = await benefAccount();
      const jeton = await ses.createSession(user.id);
      await ses.revokeSession(jeton);
      expect(await ses.readSession(jeton)).toBeNull();
    });

    it('une session expirée est refusée', async () => {
      const { user } = await benefAccount();
      const jeton = await ses.createSession(user.id);
      await db.update(s.sessions).set({ expireLe: new Date(Date.now() - 1000) });
      expect(await ses.readSession(jeton)).toBeNull();
    });

    it('les rôles sont recalculés à chaque requête : un compte devenu non éligible perd l’accès aussitôt', async () => {
      const { user, benef } = await benefAccount();
      const jeton = await ses.createSession(user.id);
      expect(await ses.readSession(jeton)).not.toBeNull();
      await db.update(s.beneficiaires).set({ anneeDiplome: year - 7 }).where(eq(s.beneficiaires.id, benef.id));
      expect(await ses.readSession(jeton)).toBeNull();
    });

    it('un compte supprimé ne laisse aucune session valide', async () => {
      const { user } = await benefAccount();
      const jeton = await ses.createSession(user.id);
      await db.delete(s.utilisateurs).where(eq(s.utilisateurs.id, user.id));
      expect(await ses.readSession(jeton)).toBeNull();
    });

    it('un nouveau mot de passe ferme toutes les sessions ouvertes', async () => {
      const { user } = await benefAccount();
      const [a, b] = [await ses.createSession(user.id), await ses.createSession(user.id)];
      const { jeton } = await comptes.creerJeton(user.id, 'reinitialisation');
      expect(await comptes.consommerJeton(jeton, 'nouveau-mot-de-passe')).toBe(true);
      expect(await ses.readSession(a)).toBeNull();
      expect(await ses.readSession(b)).toBeNull();
    });

    it('révoquer toutes les sessions d’un compte laisse celles des autres', async () => {
      const { user } = await benefAccount();
      const [other] = await db.insert(s.utilisateurs).values({ email: 'c@benef.test', motDePasseHash: 'x' }).returning();
      await db.insert(s.beneficiaires).values({ nom: 'C', utilisateurId: other!.id, anneeDiplome: year - 1 });
      const mine = await ses.createSession(user.id);
      const theirs = await ses.createSession(other!.id);
      await ses.revokeAllSessions(user.id);
      expect(await ses.readSession(mine)).toBeNull();
      expect(await ses.readSession(theirs)).not.toBeNull();
    });
  });

  describe('limiteur de débit', () => {
    const status = async (p: Promise<unknown>) => {
      try {
        await p;
        return 200;
      } catch (e) {
        return (e as { status?: number }).status ?? 500;
      }
    };

    it('refuse au-delà du maximum, par clé', async () => {
      for (let i = 0; i < 3; i++) expect(await status(http.rateLimit('login:a', 3))).toBe(200);
      expect(await status(http.rateLimit('login:a', 3))).toBe(429);
      expect(await status(http.rateLimit('login:b', 3))).toBe(200);
    });

    it('compte correctement sous concurrence (aucun essai perdu)', async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => status(http.rateLimit('burst', 5))));
      expect(results.filter((r) => r === 200)).toHaveLength(5);
      expect(results.filter((r) => r === 429)).toHaveLength(7);
    });

    it('repart à zéro quand la fenêtre est échue', async () => {
      for (let i = 0; i < 2; i++) await http.rateLimit('fenetre', 2);
      expect(await status(http.rateLimit('fenetre', 2))).toBe(429);
      await t.sql.unsafe("update limites_debit set fin_fenetre = now() - interval '1 second' where cle = 'fenetre'");
      expect(await status(http.rateLimit('fenetre', 2))).toBe(200);
    });

    it('la tâche de purge efface les compteurs échus', async () => {
      await http.rateLimit('vieux', 5);
      await t.sql.unsafe("update limites_debit set fin_fenetre = now() - interval '1 second'");
      const { JOBS } = await import('@/server/jobs');
      expect((await JOBS['purge-sessions']!()).processed).toBe(1);
    });
  });
});
