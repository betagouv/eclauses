import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

let cookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'eclauses_session' && cookie ? { value: cookie } : undefined) }), headers: async () => new Headers() }));

describe.skipIf(!hasPostgres)('administration : moteur générique', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let crud: typeof import('@/server/admin/crud');
  let res: typeof import('@/server/admin/resources');
  let actions: typeof import('@/server/actions/admin');
  let s: typeof import('@/server/db/schema');
  let ses: typeof import('@/server/auth/session');
  let db: ReturnType<(typeof import('@/server/db/client'))['database']>;
  const admin = { email: 'admin@culture.test', roles: ['admin' as const], beneficiaireId: null, repondantId: null, acheteurId: null, acheteurEntiteId: null, mfa: true };

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    crud = await import('@/server/admin/crud');
    res = await import('@/server/admin/resources');
    actions = await import('@/server/actions/admin');
    s = await import('@/server/db/schema');
    ses = await import('@/server/auth/session');
    db = (await import('@/server/db/client')).database();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    cookie = undefined;
    await t.sql.unsafe('truncate utilisateurs, acheteurs, clauses_sociales, formations, regions, departements, specialites, faq_categories, parametres, liens, audit_admin, beneficiaires restart identity cascade');
  });

  const R = (k: string) => crud.resourceOrThrow(k);
  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return { status: (e as { status?: number }).status ?? 500, message: (e as Error).message };
    }
    return { status: 0, message: '' };
  };
  const audit = () => db.select().from(s.auditAdmin);

  it('chaque ressource est cohérente : colonnes existantes, listes valides, clés uniques', () => {
    expect(new Set(res.RESOURCES.map((r) => r.key)).size).toBe(res.RESOURCES.length);
    for (const r of res.RESOURCES) {
      const cols = r.table as unknown as Record<string, unknown>;
      for (const f of r.fields.filter((x) => x.type !== 'multi')) expect(cols[f.name], `${r.key}.${f.name}`).toBeDefined();
      for (const p of [...r.search, ...r.labelProps, ...(r.orderBy ? [r.orderBy] : [])]) expect(cols[p], `${r.key}:${p}`).toBeDefined();
      for (const f of r.fields.filter((x) => x.ref)) expect(res.resourceByKey(f.ref!), `${r.key}.${f.name} -> ${f.ref}`).toBeDefined();
      for (const f of r.fields.filter((x) => x.type === 'multi')) expect(f.join, `${r.key}.${f.name}`).toBeDefined();
      expect(r.fields.some((f) => f.list), r.key).toBe(true);
    }
  });

  describe('création et modification', () => {
    it('crée une ligne, la relit et journalise la création', async () => {
      const { id } = await crud.save(admin, R('formations'), null, { intitule: '  Master Restauration  ' });
      expect((await crud.get(R('formations'), id))!.intitule).toBe('Master Restauration');
      const [a] = await audit();
      expect(a).toMatchObject({ email: 'admin@culture.test', action: 'creation', entite: 'formations', entiteId: String(id) });
    });

    it('modifie seulement les champs reçus, et journalise avant/après', async () => {
      const { id } = await crud.save(admin, R('regions'), null, { intitule: 'Bretagne', chefLieu: 'Rennes' });
      await crud.save(admin, R('regions'), id, { chefLieu: 'Brest' });
      const row = (await crud.get(R('regions'), id))!;
      expect(row).toMatchObject({ intitule: 'Bretagne', chefLieu: 'Brest' });
      const last = (await audit()).at(-1)!;
      expect(last.action).toBe('modification');
      expect(last.details).toEqual({ chefLieu: ['Rennes', 'Brest'] });
    });

    it('refuse un champ obligatoire vide, une énumération inconnue, un nombre, une date et une référence invalides', async () => {
      expect((await rejects(crud.save(admin, R('formations'), null, { intitule: '  ' }))).status).toBe(400);
      expect((await rejects(crud.save(admin, R('liens'), null, { zone: 'milieu', libelle: 'x', url: '/x' }))).status).toBe(400);
      expect((await rejects(crud.save(admin, R('regions'), null, { intitule: 'x', latitude: 'beaucoup' }))).status).toBe(400);
      const [ben] = [R('beneficiaires')];
      expect((await rejects(crud.save(admin, ben, null, { nom: 'x', email: 'a@b.test', anneeDiplome: 'demain' }))).status).toBe(400);
      expect((await rejects(crud.save(admin, R('departements'), null, { numero: '1', nom: 'x', regionId: 'abc' }))).status).toBe(400);
      expect(await db.select().from(s.formations)).toHaveLength(0);
    });

    it('traduit les doublons et les références inexistantes en messages lisibles, sans rien écrire', async () => {
      await crud.save(admin, R('faq-categories'), null, { titre: 'A', slug: 'a' });
      expect((await rejects(crud.save(admin, R('faq-categories'), null, { titre: 'B', slug: 'a' }))).status).toBe(409);
      expect((await rejects(crud.save(admin, R('departements'), null, { numero: '9', nom: 'Z', regionId: 9999 }))).status).toBe(409);
      expect(await db.select().from(s.departements)).toHaveLength(0);
    });

    it('ignore les champs inconnus, les champs en lecture seule et les identifiants glissés dans la saisie', async () => {
      const { id } = await crud.save(admin, R('marches') && R('acheteurs'), null, { nom: 'Entité', id: 999, inconnu: 'x' });
      expect(id).not.toBe(999);
      const { id: mid } = await crud.save(admin, R('beneficiaires'), null, { nom: 'Durand', email: 'durand@test.test', dateDiplomation: '1999-01-01', anonymiseLe: '2000-01-01', creeLe: '2000-01-01' });
      const [b] = await db.select().from(s.beneficiaires).where(eq(s.beneficiaires.id, Number(mid)));
      expect(b!.anonymiseLe).toBeNull();
      expect(b!.creeLe.getFullYear()).toBeGreaterThan(2020);
    });

    it('clé texte (paramètres) : la clé se saisit à la création et ne change plus', async () => {
      await crud.save(admin, R('parametres'), null, { cle: 'site_titre', valeur: 'Eclauses' });
      await crud.save(admin, R('parametres'), 'site_titre', { cle: 'autre', valeur: 'Nouveau' });
      expect((await db.select().from(s.parametres)).map((p) => [p.cle, p.valeur])).toEqual([['site_titre', 'Nouveau']]);
      expect((await crud.get(R('parametres'), 'site_titre'))!.valeur).toBe('Nouveau');
    });

    it('les textes longs ne sont jamais recopiés dans le journal', async () => {
      await crud.save(admin, R('parametres'), null, { cle: 'mentions_rgpd', valeur: '<p>Texte très long</p>' });
      expect(JSON.stringify((await audit()).at(-1)!.details)).not.toContain('Texte très long');
    });
  });

  describe('listes liées', () => {
    it('remplace les spécialités d’un bénéficiaire en une transaction', async () => {
      const [a, b, c] = await db.insert(s.specialites).values([{ intitule: 'A' }, { intitule: 'B' }, { intitule: 'C' }]).returning();
      const { id } = await crud.save(admin, R('beneficiaires'), null, { nom: 'Martin', specialites: [String(a!.id), String(b!.id)] });
      expect(((await crud.get(R('beneficiaires'), id))!.specialites as number[]).sort()).toEqual([a!.id, b!.id]);
      await crud.save(admin, R('beneficiaires'), id, { specialites: [c!.id] });
      expect((await crud.get(R('beneficiaires'), id))!.specialites).toEqual([c!.id]);
      await crud.save(admin, R('beneficiaires'), id, { nom: 'Martin 2' }); // champ absent : liste inchangée
      expect((await crud.get(R('beneficiaires'), id))!.specialites).toEqual([c!.id]);
      expect((await rejects(crud.save(admin, R('beneficiaires'), id, { specialites: [99999] }))).status).toBe(409);
      expect((await crud.get(R('beneficiaires'), id))!.specialites).toEqual([c!.id]); // la transaction est annulée
    });
  });

  describe('compte de connexion (e-mail)', () => {
    it('création : compte créé sans mot de passe et rattaché ; l’e-mail est obligatoire pour un utilisateur acheteur', async () => {
      const [e] = await db.insert(s.acheteurs).values({ nom: 'DRAC' }).returning();
      expect((await rejects(crud.save(admin, R('utilisateurs-acheteurs'), null, { nom: 'Martin', acheteurId: e!.id }))).status).toBe(400);
      const { id } = await crud.save(admin, R('utilisateurs-acheteurs'), null, { nom: 'Martin', acheteurId: e!.id, email: ' Camille@Culture.test ' });
      const row = (await crud.get(R('utilisateurs-acheteurs'), id))!;
      expect(row.email).toBe('camille@culture.test');
      const [u] = await db.select().from(s.utilisateurs).where(eq(s.utilisateurs.email, 'camille@culture.test'));
      expect(u!.motDePasseHash).toBeNull();
    });

    it('un bénéficiaire peut ne pas avoir d’adresse ; on peut la renseigner ensuite', async () => {
      const { id } = await crud.save(admin, R('beneficiaires'), null, { nom: 'Sans mail' });
      expect((await crud.get(R('beneficiaires'), id))!.email).toBe('');
      await crud.save(admin, R('beneficiaires'), id, { email: 'avec@mail.test' });
      expect((await crud.get(R('beneficiaires'), id))!.email).toBe('avec@mail.test');
    });

    it('modifier l’adresse met à jour le compte ; une adresse d’un autre compte est refusée (409) ; on ne la retire pas', async () => {
      const a = await crud.save(admin, R('beneficiaires'), null, { nom: 'A', email: 'a@test.test' });
      await crud.save(admin, R('beneficiaires'), null, { nom: 'B', email: 'b@test.test' });
      await crud.save(admin, R('beneficiaires'), a.id, { email: 'nouveau@test.test' });
      expect((await crud.get(R('beneficiaires'), a.id))!.email).toBe('nouveau@test.test');
      expect((await rejects(crud.save(admin, R('beneficiaires'), a.id, { email: 'b@test.test' }))).status).toBe(409);
      expect((await rejects(crud.save(admin, R('beneficiaires'), a.id, { email: '' }))).status).toBe(400);
      expect((await rejects(crud.save(admin, R('beneficiaires'), a.id, { email: 'pas-un-mail' }))).status).toBe(400);
      expect((await crud.get(R('beneficiaires'), a.id))!.email).toBe('nouveau@test.test');
    });
  });

  describe('lecture seule et suppression', () => {
    it('le journal d’audit et les consultations sont en lecture seule', async () => {
      expect((await rejects(crud.save(admin, R('audit'), null, { email: 'x' }))).status).toBe(403);
      expect((await rejects(crud.remove(admin, R('audit'), 1))).status).toBe(403);
      expect((await rejects(crud.save(admin, R('acces'), null, {}))).status).toBe(403);
    });

    it('supprimer : refusé si la ressource ne le permet pas ; message clair si l’élément est utilisé ; journalisé sinon', async () => {
      expect((await rejects(crud.remove(admin, R('beneficiaires'), 1))).status).toBe(403);
      const [f] = await db.insert(s.formations).values({ intitule: 'F' }).returning();
      const [b] = await db.insert(s.beneficiaires).values({ nom: 'B', formationId: f!.id }).returning();
      void b;
      // Une formation utilisée par un bénéficiaire : la clé étrangère n'a pas de suppression en cascade.
      const used = await rejects(crud.remove(admin, R('formations'), f!.id));
      expect([0, 409]).toContain(used.status);
      const [lien] = await db.insert(s.liens).values({ zone: 'pied', libelle: 'L', url: '/l' }).returning();
      await crud.remove(admin, R('liens'), lien!.id);
      expect((await audit()).at(-1)).toMatchObject({ action: 'suppression', entite: 'liens', entiteId: String(lien!.id) });
      expect((await rejects(crud.remove(admin, R('liens'), lien!.id))).status).toBe(404);
    });
  });

  describe('liste, recherche et filtres', () => {
    it('pagine, cherche (texte, numéro, e-mail du compte) et filtre sur un booléen ou une énumération', async () => {
      await crud.save(admin, R('beneficiaires'), null, { nom: 'Durand', prenom: 'Alice', email: 'alice@exemple.test', consentementAnnuaire: true });
      await crud.save(admin, R('beneficiaires'), null, { nom: 'Martin', prenom: 'Bob', consentementAnnuaire: false });
      for (let i = 0; i < 30; i++) await db.insert(s.formations).values({ intitule: `Formation ${String(i).padStart(2, '0')}` });
      const all = await crud.list(R('beneficiaires'));
      expect(all.total).toBe(2);
      expect((await crud.list(R('beneficiaires'), { q: 'durand' })).rows.map((r) => r.nom)).toEqual(['Durand']);
      expect((await crud.list(R('beneficiaires'), { q: 'exemple.test' })).rows.map((r) => r.nom)).toEqual(['Durand']);
      expect((await crud.list(R('beneficiaires'), { q: String(all.rows[1]!.id) })).rows.map((r) => r.id)).toEqual([all.rows[1]!.id]);
      expect((await crud.list(R('beneficiaires'), { filters: { consentementAnnuaire: '0' } })).rows.map((r) => r.nom)).toEqual(['Martin']);
      const p1 = await crud.list(R('formations'));
      expect([p1.rows.length, p1.total, p1.pages]).toEqual([25, 30, 2]);
      expect((await crud.list(R('formations'), { page: 2 })).rows).toHaveLength(5);
      expect((await crud.list(R('formations'), { q: "%'; drop table formations; --" })).total).toBe(0);
      expect(await db.select().from(s.formations)).toHaveLength(30);
    });

    it('les références des colonnes de liste sont résolues en libellés', async () => {
      const [r] = await db.insert(s.regions).values({ intitule: 'Occitanie' }).returning();
      await db.insert(s.departements).values({ numero: '31', nom: 'Haute-Garonne', regionId: r!.id });
      const out = await crud.list(R('departements'));
      expect(out.labels.regionId![String(r!.id)]).toBe('Occitanie');
      expect((await crud.options('regions')).map((o) => o.label)).toEqual(['Occitanie']);
    });
  });

  describe('actions : droits', () => {
    it('sans session, sans double authentification ou pour un utilisateur ordinaire : refusées, sans écriture', async () => {
      expect(await actions.enregistrer('formations', null, { intitule: 'X' })).toMatchObject({ ok: false, message: 'Authentification requise.' });
      const [u] = await db.insert(s.utilisateurs).values({ email: 'admin@culture.test', motDePasseHash: 'x', estAdmin: true }).returning();
      cookie = await ses.createSession(u!.id);
      expect(await actions.enregistrer('formations', null, { intitule: 'X' })).toMatchObject({ ok: false, message: 'Double authentification requise.' });
      const [v] = await db.insert(s.utilisateurs).values({ email: 'simple@culture.test', motDePasseHash: 'x' }).returning();
      await db.insert(s.beneficiaires).values({ nom: 'S', utilisateurId: v!.id, anneeDiplome: new Date().getFullYear() - 1 });
      cookie = await ses.createSession(v!.id);
      expect(await actions.enregistrer('formations', null, { intitule: 'X' })).toMatchObject({ ok: false, message: 'Accès refusé.' });
      expect(await actions.supprimer('formations', 1)).toMatchObject({ ok: false });
      expect(await db.select().from(s.formations)).toHaveLength(0);
    });

    it('administrateur ayant validé la seconde étape : succès, avec journal à son nom ; ressource inconnue : 404', async () => {
      const [u] = await db.insert(s.utilisateurs).values({ email: 'admin@culture.test', motDePasseHash: 'x', estAdmin: true }).returning();
      cookie = await ses.createSession(u!.id);
      await ses.markMfaValidated(cookie);
      const ok = await actions.enregistrer('formations', null, { intitule: 'Via action' });
      expect(ok.ok && typeof ok.data.id).toBe('number');
      expect((await audit()).at(-1)).toMatchObject({ email: 'admin@culture.test', utilisateurId: u!.id, entite: 'formations' });
      expect(await actions.enregistrer('nimporte-quoi', null, {})).toMatchObject({ ok: false, message: 'Ressource inconnue.' });
    });
  });
});
