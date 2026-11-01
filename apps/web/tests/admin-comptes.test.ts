import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

describe.skipIf(!hasPostgres)('administration : comptes', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let comptes: typeof import('@/server/admin/comptes');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let db: ReturnType<(typeof import('@/server/db/client'))['database']>;
  const admin = { email: 'admin@culture.test', roles: ['admin' as const], beneficiaireId: null, repondantId: null, acheteurId: null, acheteurEntiteId: null, mfa: true };

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    comptes = await import('@/server/admin/comptes');
    s = await import('@/server/db/schema');
    outbox = (await import('@/server/mail/transport')).outbox;
    db = (await import('@/server/db/client')).database();
  });
  afterAll(async () => {
    await t?.drop();
  });

  let ids: { admin: number; actif: number; inactif: number; autre: number };
  beforeEach(async () => {
    await t.sql.unsafe('truncate utilisateurs, beneficiaires, audit_admin, jetons_auth restart identity cascade');
    outbox.length = 0;
    const [a, b, c, d] = await db
      .insert(s.utilisateurs)
      .values([
        { email: 'admin@culture.test', motDePasseHash: 'x', estAdmin: true },
        { email: 'actif@exemple.fr', motDePasseHash: 'x' },
        { email: 'inactif@exemple.fr' },
        { email: 'autre-admin@culture.test', motDePasseHash: 'x', estAdmin: true },
      ])
      .returning({ id: s.utilisateurs.id });
    ids = { admin: a.id, actif: b.id, inactif: c.id, autre: d.id };
    await db.insert(s.beneficiaires).values({ utilisateurId: c.id, nom: 'Durand', prenom: 'Léa', email: 'inactif@exemple.fr' } as never);
  });

  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };
  const audit = () => db.select().from(s.auditAdmin);

  it('liste et filtre par état, profil et adresse', async () => {
    expect((await comptes.lister()).total).toBe(4);
    expect((await comptes.lister({ etat: 'non_active' })).rows.map((r) => r.email)).toEqual(['inactif@exemple.fr']);
    expect((await comptes.lister({ etat: 'admin' })).total).toBe(2);
    const b = await comptes.lister({ profil: 'beneficiaire' });
    expect(b.rows.map((r) => r.email)).toEqual(['inactif@exemple.fr']);
    expect(b.rows[0].profils).toEqual(['beneficiaire']);
    expect((await comptes.lister({ q: 'ACTIF@' })).total).toBe(2);
    expect((await comptes.lister({ q: '%' })).total).toBe(0);
  });

  it('envoie un lien d’activation aux comptes non activés seulement, et journalise', async () => {
    await comptes.envoyerActivation(admin, ids.inactif);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('inactif@exemple.fr');
    expect(outbox[0].html).toMatch(/activer|mot de passe/i);
    expect(await rejects(comptes.envoyerActivation(admin, ids.actif))).toBe(409);
    expect(await rejects(comptes.envoyerActivation(admin, 9999))).toBe(404);
    expect((await audit()).map((a) => a.action)).toEqual(['compte.activation_envoyee']);
  });

  it('envoie un lien de réinitialisation', async () => {
    await comptes.envoyerReinitialisation(admin, ids.actif);
    expect(outbox.map((m) => m.to)).toEqual(['actif@exemple.fr']);
    expect((await audit())[0].action).toBe('compte.reinitialisation_envoyee');
  });

  it('désactive un compte, ferme ses sessions, mais pas le sien', async () => {
    await db.insert(s.sessions).values({ empreinte: 'h1', utilisateurId: ids.actif, expireLe: new Date(Date.now() + 1e6) } as never);
    await comptes.desactiver(admin, ids.actif);
    const [u] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, ids.actif));
    expect(u.motDePasseHash).toBeNull();
    const [ses] = await db.select().from(s.sessions).where(eq(s.sessions.utilisateurId, ids.actif));
    expect(ses.revoqueLe).not.toBeNull();
    expect(await rejects(comptes.desactiver(admin, ids.admin))).toBe(409);
  });

  it('gère les droits d’administration avec garde-fous', async () => {
    await comptes.definirAdmin(admin, ids.actif, true);
    expect((await comptes.lister({ etat: 'admin' })).total).toBe(3);
    expect(await rejects(comptes.definirAdmin(admin, ids.admin, false))).toBe(409);
    await comptes.definirAdmin(admin, ids.actif, false);
    await comptes.definirAdmin(admin, ids.autre, false);
    // le dernier administrateur (l’appelant) ne peut être retiré par un autre
    expect(await rejects(comptes.definirAdmin({ ...admin, email: 'actif@exemple.fr' }, ids.admin, false))).toBe(409);
    expect((await audit()).map((a) => a.action)).toEqual(['compte.admin_accorde', 'compte.admin_retire', 'compte.admin_retire']);
  });

  it('réinitialise la double authentification d’un administrateur seulement', async () => {
    await db.update(s.utilisateurs).set({ totpSecretChiffre: 'v1.x', totpActiveLe: new Date() }).where(eq(s.utilisateurs.id, ids.autre));
    await comptes.reinitialiserMfa(admin, ids.autre);
    const [u] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, ids.autre));
    expect(u.totpActiveLe).toBeNull();
    expect(await rejects(comptes.reinitialiserMfa(admin, ids.actif))).toBe(409);
  });
});
