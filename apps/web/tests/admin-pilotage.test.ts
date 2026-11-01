import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedBase } from './helpers/fixtures';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

describe.skipIf(!hasPostgres)('administration : tableau de bord et tâches', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let p: typeof import('@/server/admin/pilotage');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let base: Awaited<ReturnType<typeof seedBase>>;
  const admin = { email: 'admin@culture.test', roles: ['admin' as const], beneficiaireId: null, repondantId: null, acheteurId: null, acheteurEntiteId: null, mfa: true };

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    p = await import('@/server/admin/pilotage');
    s = await import('@/server/db/schema');
    outbox = (await import('@/server/mail/transport')).outbox;
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.sql.unsafe('truncate utilisateurs, acheteurs, clauses_sociales, marches, audit_admin, notifications_envoyees, repondants, beneficiaires restart identity cascade');
    outbox.length = 0;
    base = await seedBase();
  });

  const rejects = async (q: Promise<unknown>) => {
    try {
      await q;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };

  it('compte les marchés par statut (parents seulement), les comptes non activés et les bénéficiaires', async () => {
    const i = await p.indicateurs();
    expect(i.marchesParStatut).toEqual([{ statut: 'en_attente_notification', n: 1 }]);
    expect(i.beneficiaires).toEqual({ total: 3, eligibles: 2 });
    expect(i.comptesNonActives).toBe(4); // 3 bénéficiaires + 1 acheteur ; le titulaire a un mot de passe
    expect(i.repondants).toBe(1);
    expect(i.derniersJournaux).toEqual([]);
  });

  it('annonce le nombre de destinataires, lance l’invitation, journalise, puis ne renvoie rien', async () => {
    expect(await p.destinatairesInvitations()).toBe(3);
    const res = await p.lancerTache(admin, 'invitations-comptes');
    expect(res.processed).toBe(3);
    expect(outbox).toHaveLength(3);
    expect(await p.destinatairesInvitations()).toBe(0);
    expect((await p.lancerTache(admin, 'invitations-comptes')).processed).toBe(0);
    const log = await base.db.select().from(s.auditAdmin);
    expect(log.map((l) => l.action)).toEqual(['tache', 'tache']);
  });

  it('refuse une tâche inconnue et les non-administrateurs', async () => {
    expect(await rejects(p.lancerTache(admin, 'rm-rf'))).toBe(404);
    expect(await rejects(p.lancerTache({ ...admin, roles: ['acheteur'] }, 'purge-sessions'))).toBe(403);
    expect(await base.db.select().from(s.auditAdmin)).toHaveLength(0);
  });
});
