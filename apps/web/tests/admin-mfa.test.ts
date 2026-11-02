import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { base32Decode, base32Encode, codeFor, generateSecret, otpauthUrl, stepOf, verifyCode } from '@/server/auth/totp';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

let cookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'eclauses_session' && cookie ? { value: cookie } : undefined) }), headers: async () => new Headers() }));

describe('TOTP (RFC 6238)', () => {
  // Vecteurs de l'annexe B de la RFC 6238 (secret « 12345678901234567890 », SHA-1, 8 chiffres : on garde les 6 derniers).
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('à t = %i s, le code est %s', (t, expected) => {
    expect(codeFor(secret, stepOf(t * 1000))).toBe(expected);
  });

  it('base32 : aller-retour et rejet des caractères invalides', () => {
    const bytes = Buffer.from([1, 2, 3, 250, 251, 252, 0, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(() => base32Decode('1!')).toThrow();
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepte le pas courant et ses voisins, refuse le reste et les formats invalides', () => {
    const now = 1_700_000_000_000;
    const step = stepOf(now);
    expect(verifyCode(secret, codeFor(secret, step), now)).toBe(step);
    expect(verifyCode(secret, codeFor(secret, step - 1), now)).toBe(step - 1);
    expect(verifyCode(secret, codeFor(secret, step + 1), now)).toBe(step + 1);
    expect(verifyCode(secret, codeFor(secret, step + 3), now)).toBeNull();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5x']) expect(verifyCode(secret, bad, now)).toBeNull();
    expect(verifyCode(secret, ` ${codeFor(secret, step).slice(0, 3)} ${codeFor(secret, step).slice(3)} `, now)).toBe(step);
  });

  it('un pas déjà utilisé (ou plus ancien) est refusé : le code ne se rejoue pas', () => {
    const now = 1_700_000_000_000;
    const step = stepOf(now);
    expect(verifyCode(secret, codeFor(secret, step), now, step)).toBeNull();
    expect(verifyCode(secret, codeFor(secret, step - 1), now, step)).toBeNull();
    expect(verifyCode(secret, codeFor(secret, step + 1), now, step)).toBe(step + 1);
  });

  it('l’adresse otpauth contient l’émetteur, le compte et le secret', () => {
    const url = otpauthUrl('a@b.fr', secret);
    expect(url).toContain('otpauth://totp/Eclauses:a%40b.fr');
    expect(url).toContain(`secret=${secret}`);
  });
});

describe.skipIf(!hasPostgres)('double authentification des administrateurs', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let mfa: typeof import('@/server/admin/mfa');
  let ses: typeof import('@/server/auth/session');
  let actions: typeof import('@/server/actions/admin-auth');
  let guard: typeof import('@/server/admin/guard');
  let s: typeof import('@/server/db/schema');
  let box: typeof import('@/server/auth/secret-box');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let db: ReturnType<(typeof import('@/server/db/client'))['database']>;
  let admin: { id: number; email: string };

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
    t = await useTemporaryDatabase();
    mfa = await import('@/server/admin/mfa');
    ses = await import('@/server/auth/session');
    actions = await import('@/server/actions/admin-auth');
    guard = await import('@/server/admin/guard');
    s = await import('@/server/db/schema');
    box = await import('@/server/auth/secret-box');
    outbox = (await import('@/server/mail/transport')).outbox;
    db = (await import('@/server/db/client')).database();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    cookie = undefined;
    await t.sql.unsafe('truncate utilisateurs, limites_debit restart identity cascade');
    const [u] = await db.insert(s.utilisateurs).values({ email: 'admin@culture.test', motDePasseHash: 'x', estAdmin: true }).returning();
    admin = { id: u!.id, email: u!.email };
  });

  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };
  const codeMail = () => /(\d{8})/.exec(outbox.at(-1)?.html ?? '')![1]!;
  const enroll = async () => {
    const { secret } = await mfa.demarrerActivation(admin.email);
    const { codesSecours } = await mfa.confirmerActivation(admin.email, codeFor(secret, stepOf(Date.now())), codeMail());
    return { secret, codesSecours };
  };

  it('le secret est chiffré en base (jamais en clair) et se relit', async () => {
    const { secret } = await mfa.demarrerActivation(admin.email);
    const [u] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.id, admin.id));
    expect(u!.totpSecretChiffre).toMatch(/^v1\./);
    expect(u!.totpSecretChiffre).not.toContain(secret);
    expect(box.open(u!.totpSecretChiffre!)).toBe(secret);
    expect(() => box.open(u!.totpSecretChiffre!.replace(/.$/, 'A'))).toThrow();
  });

  it('activation : le code reçu par courrier est exigé (le mot de passe seul ne suffit pas)', async () => {
    const { secret } = await mfa.demarrerActivation(admin.email);
    expect(outbox.at(-1)!.to).toBe(admin.email);
    const bon = codeFor(secret, stepOf(Date.now()));
    expect(await rejects(mfa.confirmerActivation(admin.email, bon, ''))).toBe(400);
    expect(await rejects(mfa.confirmerActivation(admin.email, bon, '12345678'))).toBe(400);
    expect((await mfa.statutMfa(admin.email)).active).toBe(false);
    // le code d'un enrôlement précédent ne vaut pas pour le suivant
    const ancien = codeMail();
    await mfa.demarrerActivation(admin.email);
    expect(await rejects(mfa.confirmerActivation(admin.email, bon, ancien))).toBe(400);
  });

  it('un compte qui n’est pas administrateur ne peut rien faire', async () => {
    const [u] = await db.insert(s.utilisateurs).values({ email: 'simple@culture.test' }).returning();
    expect(await rejects(mfa.demarrerActivation(u!.email))).toBe(403);
    expect(await rejects(mfa.verifier(u!.email, '123456'))).toBe(403);
  });

  it('activation : mauvais code refusé, bon code accepté, 8 codes de secours, pas de seconde activation', async () => {
    const { secret } = await mfa.demarrerActivation(admin.email);
    expect(await rejects(mfa.confirmerActivation(admin.email, '000000', codeMail()))).toBe(400);
    const { codesSecours } = await mfa.confirmerActivation(admin.email, codeFor(secret, stepOf(Date.now())), codeMail());
    expect(codesSecours).toHaveLength(8);
    expect(new Set(codesSecours).size).toBe(8);
    const rows = await db.select().from(s.codesSecours);
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => codesSecours.includes(r.empreinte))).toBe(false);
    expect(await rejects(mfa.demarrerActivation(admin.email))).toBe(409);
    expect((await mfa.statutMfa(admin.email)).active).toBe(true);
  });

  it('vérification : un code accepté ne se rejoue pas ; un code de secours ne sert qu’une fois', async () => {
    const { secret, codesSecours } = await enroll();
    // Le pas de l'activation est déjà consommé : on prend le pas suivant (toléré), puis il est consommé à son tour.
    const next = codeFor(secret, stepOf(Date.now()) + 1);
    await mfa.verifier(admin.email, next);
    expect(await rejects(mfa.verifier(admin.email, next))).toBe(400);
    await t.sql.unsafe('truncate limites_debit'); // la limite (5 essais par 15 min) compte aussi les succès
    await mfa.verifier(admin.email, codesSecours[0]!.toLowerCase());
    expect(await rejects(mfa.verifier(admin.email, codesSecours[0]!))).toBe(400);
    await mfa.verifier(admin.email, codesSecours[1]!);
  });

  it('les tentatives sont limitées : au-delà de 5 essais, refus (429) même avec un bon code', async () => {
    const { secret } = await enroll();
    for (let i = 0; i < 3; i++) expect(await rejects(mfa.verifier(admin.email, '000000'))).toBe(400);
    expect(await rejects(mfa.verifier(admin.email, '111111'))).toBe(400);
    expect(await rejects(mfa.verifier(admin.email, codeFor(secret, stepOf(Date.now()) + 1)))).toBe(429);
  });

  it('réinitialiser efface le secret et les codes de secours', async () => {
    await enroll();
    await mfa.reinitialiser(admin.id);
    expect((await mfa.statutMfa(admin.email)).active).toBe(false);
    expect(await db.select().from(s.codesSecours)).toHaveLength(0);
  });

  describe('session et accès', () => {
    it('un administrateur a le rôle admin ; la seconde étape manque tant qu’elle n’est pas validée', async () => {
      cookie = await ses.createSession(admin.id);
      expect(await ses.readSession(cookie)).toMatchObject({ roles: ['admin'], mfa: false });
      expect(await rejects(guard.requireAdmin())).toBe(403);
    });

    it('après la vérification, l’accès est ouvert ; il se referme après 12 h', async () => {
      const { secret } = await enroll();
      cookie = await ses.createSession(admin.id);
      expect((await actions.verifierMfa('000000')).ok).toBe(false);
      expect(await actions.verifierMfa(codeFor(secret, stepOf(Date.now()) + 1))).toEqual({ ok: true, data: null });
      expect((await guard.requireAdmin()).email).toBe('admin@culture.test');
      await t.sql.unsafe("update sessions set mfa_valide_le = now() - interval '13 hours'");
      expect(await rejects(guard.requireAdmin())).toBe(403);
    });

    it('un utilisateur ordinaire n’a pas le rôle admin et ne peut pas appeler les actions', async () => {
      const [u] = await db.insert(s.utilisateurs).values({ email: 'simple@culture.test', motDePasseHash: 'x' }).returning();
      const [b] = await db.insert(s.beneficiaires).values({ nom: 'B', utilisateurId: u!.id, anneeDiplome: new Date().getFullYear() - 1 }).returning();
      void b;
      cookie = await ses.createSession(u!.id);
      expect((await ses.readSession(cookie))!.roles).not.toContain('admin');
      expect(await rejects(guard.requireAdmin())).toBe(403);
      expect(await actions.demarrerMfa()).toMatchObject({ ok: false });
      expect(await actions.verifierMfa('123456')).toMatchObject({ ok: false });
    });

    it('se retirer le statut d’administrateur retire aussitôt l’accès (rôles recalculés à chaque requête)', async () => {
      const { secret } = await enroll();
      cookie = await ses.createSession(admin.id);
      await actions.verifierMfa(codeFor(secret, stepOf(Date.now()) + 1));
      expect((await guard.requireAdmin()).roles).toContain('admin');
      await db.update(s.utilisateurs).set({ estAdmin: false }).where(eq(s.utilisateurs.id, admin.id));
      expect(await ses.readSession(cookie)).toBeNull();
    });
  });
});
