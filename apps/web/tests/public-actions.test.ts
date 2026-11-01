import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

// Les actions publiques lisent l'adresse IP dans les en-têtes de la requête.
let ip = '203.0.113.7';
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ip }),
  cookies: async () => ({ get: () => undefined }),
}));

describe.skipIf(!hasPostgres)('actions des pages publiques', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let actions: typeof import('@/server/actions/public');
  let comptes: typeof import('@/server/services/comptes');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let base: Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    actions = await import('@/server/actions/public');
    comptes = await import('@/server/services/comptes');
    s = await import('@/server/db/schema');
    outbox = (await import('@/server/mail/transport')).outbox;
    ({ seedBase } = await import('./helpers/fixtures'));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    outbox.length = 0;
    await t.sql.unsafe('truncate acheteurs, utilisateurs, clauses_sociales, notifications_envoyees, fichiers, limites_debit restart identity cascade');
    base = await seedBase();
  });

  describe('mot de passe oublié', () => {
    it('même réponse pour un compte connu et inconnu, un courrier seulement pour le compte connu', async () => {
      expect(await actions.demanderReinitialisation('inconnu@x.test')).toEqual({ ok: true, data: null });
      expect(outbox).toHaveLength(0);
      expect(await actions.demanderReinitialisation(' Titulaire@Societe.test ')).toEqual({ ok: true, data: null });
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
    });

    it('adresse invalide refusée ; au-delà de 5 demandes par adresse IP : refusé (429)', async () => {
      expect(await actions.demanderReinitialisation('pas-un-mail')).toMatchObject({ ok: false, message: 'Adresse e-mail invalide.' });
      for (let i = 0; i < 4; i++) await actions.demanderReinitialisation('inconnu@x.test');
      expect(await actions.demanderReinitialisation('inconnu@x.test')).toMatchObject({ ok: false, message: 'Trop de tentatives, réessayez plus tard.' });
    });
  });

  describe('définir le mot de passe', () => {
    it('le lien reçu ne sert qu’une fois, le mot de passe doit faire 8 caractères', async () => {
      const { jeton } = await comptes.creerJeton(base.titulaireUser.id, 'reinitialisation');
      expect(await actions.definirMotDePasse(jeton, 'court')).toMatchObject({ ok: false });
      expect(await actions.definirMotDePasse(jeton, 'un-vrai-mot-de-passe')).toEqual({ ok: true, data: null });
      expect(await actions.definirMotDePasse(jeton, 'un-vrai-mot-de-passe')).toMatchObject({ ok: false, message: 'Lien invalide ou expiré.' });
      expect(await actions.definirMotDePasse('jeton-inventé-qui-nexiste-pas', 'un-vrai-mot-de-passe')).toMatchObject({ ok: false });
    });
  });

  describe('inscription d’un candidat', () => {
    const publier = () => base.db.update(s.marches).set({ statut: 'en_attente_notification' }).where(eq(s.marches.id, base.parent.id));
    const fiche = (over: Record<string, unknown> = {}) => ({ email: 'nouveau@societe.test', nom: 'Durand', prenom: 'Alex', raisonSociale: 'Peinture & Cie', siret: '12345678901234', marcheIds: [base.parent.id], ...over });

    it('adresse inconnue : « new », puis compte créé sans mot de passe, candidature et lien d’activation par courrier', async () => {
      await publier();
      expect(await actions.verifierEmailCandidat('Nouveau@Societe.test', [base.parent.id])).toEqual({ ok: true, data: 'new' });
      expect(await actions.inscrire(fiche())).toEqual({ ok: true, data: null });
      const user = await comptes.utilisateurParEmail('nouveau@societe.test');
      expect(user?.motDePasseHash).toBeNull();
      const [rep] = await base.db.select().from(s.repondants).where(eq(s.repondants.utilisateurId, user!.id));
      expect((await base.db.select().from(s.candidatures).where(eq(s.candidatures.repondantId, rep!.id))).map((c) => c.marcheId)).toEqual([base.parent.id]);
      expect(outbox.map((m) => m.subject)).toEqual(['Eclauses - Finalisez votre inscription']);
    });

    it('adresse déjà connue : « exist », les marchés ouverts sont ajoutés aux candidatures, sans doublon ni marché fermé', async () => {
      await publier();
      const [ferme] = await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, intitule: 'Fermé', statut: 'clause_validee' }).returning();
      expect(await actions.verifierEmailCandidat('titulaire@societe.test', [base.parent.id, ferme!.id])).toEqual({ ok: true, data: 'exist' });
      expect(await actions.verifierEmailCandidat('titulaire@societe.test', [base.parent.id])).toEqual({ ok: true, data: 'exist' });
      const rows = await base.db.select().from(s.candidatures).where(eq(s.candidatures.repondantId, base.titulaire.id));
      expect(rows.map((c) => c.marcheId)).toEqual([base.parent.id]);
    });

    it('refuse les champs manquants, un marché non publié et une adresse déjà inscrite, sans rien créer', async () => {
      expect(await actions.inscrire(fiche({ raisonSociale: '' }))).toMatchObject({ ok: false, message: 'Champ requis.' });
      expect(await actions.inscrire(fiche({ marcheIds: [] }))).toMatchObject({ ok: false });
      await base.db.update(s.marches).set({ statut: 'en_attente_publication' }).where(eq(s.marches.id, base.parent.id));
      expect(await actions.inscrire(fiche())).toMatchObject({ ok: false, message: "Un des marchés choisis n'est pas ouvert aux candidatures." }); // pas encore publié
      expect(await comptes.utilisateurParEmail('nouveau@societe.test')).toBeUndefined();
      await publier();
      expect(await actions.inscrire(fiche({ email: 'titulaire@societe.test' }))).toMatchObject({ ok: false, message: 'Un compte existe déjà pour cette adresse e-mail.' });
    });

    it('la vérification est limitée en débit par adresse IP', async () => {
      await publier();
      const res = [];
      for (let i = 0; i < 22; i++) res.push(await actions.verifierEmailCandidat('x@y.test', [base.parent.id]));
      expect(res.filter((r) => !r.ok)).toHaveLength(2);
    });
  });
});
