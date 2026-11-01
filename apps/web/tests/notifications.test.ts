import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

type Base = Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe.skipIf(!hasPostgres)('notifications', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let n: typeof import('@/server/services/notifications');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let s: typeof import('@/server/db/schema');
  let base: Base;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    n = await import('@/server/services/notifications');
    outbox = (await import('@/server/mail/transport')).outbox;
    s = await import('@/server/db/schema');
    ({ seedBase } = await import('./helpers/fixtures'));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    outbox.length = 0;
    // Tables vidées entre deux tests (la base est jetable, TRUNCATE ... CASCADE suffit).
    await t.sql.unsafe('truncate acheteurs, utilisateurs, clauses_sociales, notifications_envoyees restart identity cascade');
    base = await seedBase();
  });

  const lot = async (numero: string, titre: string, over: Partial<typeof s.marches.$inferInsert> = {}) =>
    (await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId: base.parent.id, intitule: base.parent.intitule, numeroLot: numero, intituleLot: titre, clauseId: base.clause.id, ...over }).returning())[0]!;

  describe('publication d’un marché', () => {
    it('marché sans lot : bénéficiaires actifs prévenus, sans vocabulaire de lot, clause citée', async () => {
      await n.marcheModifie(base.parent.id);
      // Tous les bénéficiaires rattachés à la clause (même fiche non à jour), comme en production.
      expect(outbox.map((m) => m.to).sort()).toEqual(['a@benef.test', 'b@benef.test', 'c@benef.test']);
      const mail = outbox[0]!;
      expect(mail.subject).toBe('Eclauses - un nouveau marché avec clause sociale a été publié');
      const body = text(mail.html);
      expect(body).toContain('Clause sociale : Insertion des restaurateurs');
      expect(body).not.toContain('Lots concernés');
    });

    it('marché alloti : les lots sont listés', async () => {
      await lot('1', 'Maçonnerie');
      await lot('2', 'Peinture');
      await n.marcheModifie(base.parent.id);
      expect(outbox[0]!.subject).toContain('comprenant des lots');
      expect(text(outbox[0]!.html)).toContain('Lot 2 - Peinture - Clause sociale : Insertion des restaurateurs');
    });

    it('une modification ultérieure ne renvoie rien, même après redémarrage (mémoire en base)', async () => {
      await n.marcheModifie(base.parent.id);
      await n.marcheModifie(base.parent.id);
      expect(outbox).toHaveLength(3);
      const rows = await base.db.select().from(s.notificationsEnvoyees);
      expect(rows.map((r) => `${r.evenement}:${r.cle}`)).toContain(`marche-publie:${base.parent.id}`);
    });

    it('deux traitements simultanés n’envoient qu’une fois', async () => {
      await Promise.all([n.marcheModifie(base.parent.id), n.marcheModifie(base.parent.id)]);
      expect(outbox).toHaveLength(3);
    });

    it('un lot ou un marché déjà publié ne déclenche rien', async () => {
      const l = await lot('1', 'Gros œuvre');
      await n.marcheModifie(l.id);
      expect(outbox).toHaveLength(0);
    });

    it('sans bénéficiaire rattaché : aucun courrier, aucune erreur', async () => {
      await base.db.delete(s.beneficiaireClauses);
      await n.marcheModifie(base.parent.id);
      expect(outbox).toHaveLength(0);
    });

    it('les bénéficiaires hors durée de conservation ne sont pas prévenus', async () => {
      await base.db.update(s.beneficiaires).set({ anneeDiplome: new Date().getFullYear() - 8 }).where(eq(s.beneficiaires.id, base.a.benef.id));
      await n.marcheModifie(base.parent.id);
      expect(outbox.map((m) => m.to).sort()).toEqual(['b@benef.test', 'c@benef.test']);
    });

    it('un marché alloti prévient les bénéficiaires des clauses de tous ses lots', async () => {
      const [autre] = await base.db.insert(s.clausesSociales).values({ nom: 'Autre clause' }).returning();
      const [u] = await base.db.insert(s.utilisateurs).values({ email: 'd@benef.test' }).returning();
      const [d] = await base.db.insert(s.beneficiaires).values({ nom: 'D', utilisateurId: u!.id, anneeDiplome: new Date().getFullYear() - 1 }).returning();
      await base.db.insert(s.beneficiaireClauses).values({ beneficiaireId: d!.id, clauseId: autre!.id });
      await base.db.update(s.marches).set({ clauseId: null }).where(eq(s.marches.id, base.parent.id));
      await lot('1', 'Maçonnerie');
      await lot('2', 'Peinture', { clauseId: autre!.id });
      await n.marcheModifie(base.parent.id);
      expect(outbox.map((m) => m.to).sort()).toEqual(['a@benef.test', 'b@benef.test', 'c@benef.test', 'd@benef.test']);
    });
  });

  describe('déclaration à valider et clause validée', () => {
    const statut = (id: number, v: 'declaration_a_valider' | 'clause_validee' | 'en_attente_declaration') =>
      base.db.update(s.marches).set({ statut: v }).where(eq(s.marches.id, id));

    it('prévient l’acheteur une seule fois, puis de nouveau après un refus', async () => {
      await statut(base.parent.id, 'declaration_a_valider');
      await n.marcheModifie(base.parent.id);
      await n.marcheModifie(base.parent.id);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]!.to).toBe('acheteur@culture.test');
      expect(outbox[0]!.subject).toBe('Eclauses - action requise : bénéficiaire(s) à valider pour un marché que vous portez');
      expect(text(outbox[0]!.html)).toContain('Bonjour Camille Martin,');
      await statut(base.parent.id, 'en_attente_declaration'); // refusée : retour à la déclaration
      await n.marcheModifie(base.parent.id);
      await statut(base.parent.id, 'declaration_a_valider');
      await n.marcheModifie(base.parent.id);
      expect(outbox).toHaveLength(2);
    });

    it('pour un lot, mentionne le marché et le lot', async () => {
      const l = await lot('2', 'Peinture', { statut: 'declaration_a_valider', titulaireId: base.titulaire.id });
      await n.marcheModifie(l.id);
      const body = text(outbox[0]!.html);
      expect(outbox[0]!.subject).toContain('pour un lot');
      expect(body).toContain('Marché : Rénovation du musée');
      expect(body).toContain('Lot : Lot 2 - Peinture');
    });

    it('clause validée : titulaire et acheteur sont prévenus', async () => {
      await base.db.update(s.marches).set({ titulaireId: base.titulaire.id, statut: 'clause_validee' }).where(eq(s.marches.id, base.parent.id));
      await n.marcheModifie(base.parent.id);
      expect(outbox.map((m) => m.to).sort()).toEqual(['acheteur@culture.test', 'titulaire@societe.test']);
    });
  });

  describe('déclarations de bénéficiaires', () => {
    const declare = async (marcheId: number, over: Partial<typeof s.declarationsBeneficiaires.$inferInsert> = {}) =>
      (await base.db.insert(s.declarationsBeneficiaires).values({ repondantId: base.titulaire.id, marcheId, ...over }).returning())[0]!;

    it('validée : « marché » sans lot, « lot » avec lot', async () => {
      const d1 = await declare(base.parent.id, { email: 'benef@test.test', statut: 'valide' });
      const l = await lot('2', 'Peinture');
      const d2 = await declare(l.id, { email: 'benef2@test.test', statut: 'valide' });
      await n.declarationModifiee(d1.id);
      await n.declarationModifiee(d2.id);
      expect(outbox[0]!.subject).toBe("Eclauses - vous avez été déclaré bénéficiaire d'une clause sociale sur un marché");
      expect(text(outbox[0]!.html)).not.toContain('Lot :');
      expect(outbox[1]!.subject).toContain('sur un lot');
      expect(text(outbox[1]!.html)).toContain('Lot : Lot 2 - Peinture');
    });

    it('utilise l’adresse du bénéficiaire inscrit quand aucun e-mail n’est saisi', async () => {
      const d = await declare(base.parent.id, { beneficiaireId: base.a.benef.id, statut: 'valide' });
      await n.declarationModifiee(d.id);
      expect(outbox.map((m) => m.to)).toEqual(['a@benef.test']);
    });

    it('pas de courrier tant que la déclaration n’est pas validée, ni deux fois', async () => {
      const d = await declare(base.parent.id, { email: 'benef@test.test' });
      await n.declarationModifiee(d.id);
      expect(outbox).toHaveLength(0);
      await base.db.update(s.declarationsBeneficiaires).set({ statut: 'valide' }).where(eq(s.declarationsBeneficiaires.id, d.id));
      await n.declarationModifiee(d.id);
      await n.declarationModifiee(d.id);
      expect(outbox).toHaveLength(1);
    });

    it('refus : le titulaire du marché reçoit le motif', async () => {
      await base.db.update(s.marches).set({ titulaireId: base.titulaire.id }).where(eq(s.marches.id, base.parent.id));
      const [r] = await base.db.insert(s.declarationsRefus).values({ marcheId: base.parent.id, raison: 'Pièces manquantes' }).returning();
      await n.refusCree(r!.id);
      expect(outbox[0]!.to).toBe('titulaire@societe.test');
      expect(text(outbox[0]!.html)).toContain('Motif du refus : Pièces manquantes');
    });

    it('consultation de coordonnées : le bénéficiaire est prévenu avec le marché', async () => {
      const [acces] = await base.db.insert(s.accesCoordonnees).values({ repondantId: base.titulaire.id, marcheId: base.parent.id, beneficiaireId: base.a.benef.id }).returning();
      await n.accesCoordonneesCree(acces!.id);
      expect(outbox.map((m) => m.to)).toEqual(['a@benef.test']);
      expect(text(outbox[0]!.html)).toContain('marché Rénovation du musée');
    });
  });

  describe('comptes', () => {
    const invite = async (marcheId: number, email: string) =>
      (await base.db.insert(s.invitationsTitulaires).values({ marcheId, email }).returning())[0]!;
    const comptes = () => import('@/server/services/comptes');

    it('titulaire existant : rattaché au marché, lien de connexion sans activation', async () => {
      const inv = await invite(base.parent.id, 'Titulaire@societe.test');
      await n.invitationCreee(inv.id);
      const [m] = await base.db.select().from(s.marches).where(eq(s.marches.id, base.parent.id));
      expect(m!.titulaireId).toBe(base.titulaire.id);
      expect(outbox).toHaveLength(1);
      expect(text(outbox[0]!.html)).toContain('Accéder à mon espace');
      expect(await base.db.select().from(s.jetonsAuth)).toHaveLength(0);
    });

    it('nouveau titulaire : compte et profil créés, lien d’activation valable, un seul courrier', async () => {
      const l = await lot('1', 'Gros œuvre');
      const inv = await invite(l.id, 'nouveau@societe.test');
      await n.invitationCreee(inv.id);
      const user = await (await comptes()).utilisateurParEmail('nouveau@societe.test');
      expect(user?.motDePasseHash).toBeNull();
      const [rep] = await base.db.select().from(s.repondants).where(eq(s.repondants.utilisateurId, user!.id));
      const [m] = await base.db.select().from(s.marches).where(eq(s.marches.id, l.id));
      expect(m!.titulaireId).toBe(rep!.id);
      const jeton = /token=([^"&]+)/.exec(outbox[0]!.html)![1]!;
      const etat = await (await comptes()).etatJeton(decodeURIComponent(jeton));
      expect(etat).toMatchObject({ valide: true, objectif: 'activation', email: 'nouveau@societe.test' });
      // Le titulaire créé ainsi ne reçoit pas en plus le courrier d'inscription d'un candidat.
      await n.candidatInscrit(rep!.id);
      expect(outbox).toHaveLength(1);
      // Rejouer l'invitation n'envoie rien de plus.
      await n.invitationCreee(inv.id);
      expect(outbox).toHaveLength(1);
    });

    it('inscription d’un candidat : lien pour créer le mot de passe', async () => {
      const { assurerUtilisateur } = await comptes();
      const { id: userId } = await assurerUtilisateur('candidat@societe.test');
      const [rep] = await base.db.insert(s.repondants).values({ utilisateurId: userId, nom: 'Candidat' }).returning();
      await n.candidatInscrit(rep!.id);
      expect(outbox[0]!.subject).toBe('Eclauses - Finalisez votre inscription');
      expect(outbox[0]!.html).toContain('/reset-password?token=');
    });

    it('mot de passe oublié : seulement pour un compte existant, jamais d’erreur visible', async () => {
      await n.motDePasseOublie('inconnu@x.test');
      expect(outbox).toHaveLength(0);
      await n.motDePasseOublie('Titulaire@Societe.test');
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
      expect(outbox[0]!.html).toContain('/reset-password?token=');
    });

    it('jeton : usage unique, nouveau jeton = ancien révoqué, expiration', async () => {
      const c = await comptes();
      const { jeton: premier } = await c.creerJeton(base.titulaireUser.id, 'reinitialisation');
      const { jeton: second } = await c.creerJeton(base.titulaireUser.id, 'reinitialisation');
      expect((await c.etatJeton(premier)).valide).toBe(false);
      expect(await c.consommerJeton(second, 'nouveau-mot-de-passe')).toBe(true);
      expect(await c.consommerJeton(second, 'autre-mot-de-passe')).toBe(false);
      expect(await c.etatJeton(second)).toMatchObject({ valide: false, utilise: true });
      const { jeton: perime } = await c.creerJeton(base.titulaireUser.id, 'reinitialisation');
      await t.sql.unsafe("update jetons_auth set expire_le = now() - interval '1 second' where utilise_le is null");
      expect((await c.etatJeton(perime)).valide).toBe(false);
    });

    it('invitations de comptes : seulement les comptes non activés, une fois', async () => {
      const sent = await n.inviterBeneficiaires();
      expect(sent).toBe(3);
      expect(outbox.every((m) => m.html.includes('/reset-password?token='))).toBe(true);
      expect(await n.inviterBeneficiaires()).toBe(0);
    });
  });
});
