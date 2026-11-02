import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth/session';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

let cookie: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'eclauses_session' && cookie ? { value: cookie } : undefined) }) }));

type Base = Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;
const FUTURE = '2099-01-01';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe.skipIf(!hasPostgres)('opérations de l’acheteur sur ses marchés', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let svc: typeof import('@/server/services/marches-acheteur');
  let actions: typeof import('@/server/actions/acheteur');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let createSession: typeof import('@/server/auth/session').createSession;
  let base: Base;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    svc = await import('@/server/services/marches-acheteur');
    actions = await import('@/server/actions/acheteur');
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
    // Le marché de départ est déjà publié et notifié : ces tests ne veulent pas de courrier de publication parasite.
    await base.db.update(s.marches).set({ statut: 'en_attente_publication' });
  });

  const acheteur = (): Session => ({ email: 'acheteur@culture.test', roles: ['acheteur'], beneficiaireId: null, repondantId: null, acheteurId: base.ua.id, acheteurEntiteId: base.acheteur.id });
  const autreAcheteur = async (): Promise<Session> => {
    const [e] = await base.db.insert(s.acheteurs).values({ nom: 'Autre entité' }).returning();
    return { ...acheteur(), acheteurEntiteId: e!.id };
  };
  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };
  const row = async (id: number) => (await base.db.select().from(s.marches).where(eq(s.marches.id, id)))[0]!;
  const lot = async (parentId: number, numero: string, over: Partial<typeof s.marches.$inferInsert> = {}) =>
    (await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId, intitule: 'Rénovation du musée', numeroLot: numero, intituleLot: `Lot ${numero}`, clauseId: base.clause.id, ...over }).returning())[0]!;
  const specialite = async () => (await base.db.insert(s.specialites).values({ intitule: 'Peinture' }).returning())[0]!;

  describe('déclarer un marché', () => {
    it('marché simple : créé en attente de publication, indicateur d’autonomie et auteur posés par le serveur', async () => {
      const sp = await specialite();
      const { id } = await svc.declarerMarche(acheteur(), { intitule: 'Nouveau', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Paris' });
      const m = await row(id);
      expect(m).toMatchObject({ statut: 'en_attente_publication', acheteurId: base.acheteur.id, creationEnAutonomie: true, creeParUtilisateurId: base.userAcheteur.id, lieuExecution: 'Paris', parentId: null });
      expect((await base.db.select().from(s.marcheSpecialites).where(eq(s.marcheSpecialites.marcheId, id))).map((x) => x.specialiteId)).toEqual([sp.id]);
      expect(outbox).toHaveLength(0);
    });

    it('marché alloti : parent sans clause, un lot par entrée, dates reprises du parent', async () => {
      const sp = await specialite();
      const { id } = await svc.declarerMarche(acheteur(), {
        intitule: 'Alloti', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE,
        lots: [{ numero: '1', intitule: 'Maçonnerie', clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Lyon' }, { numero: '2', intitule: 'Peinture', clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Nice' }],
      });
      const lots = await base.db.select().from(s.marches).where(eq(s.marches.parentId, id));
      expect(lots.map((l) => [l.numeroLot, l.intituleLot, l.lieuExecution, l.dateLimiteOffres, l.statut])).toEqual([
        ['1', 'Maçonnerie', 'Lyon', FUTURE, 'en_attente_publication'],
        ['2', 'Peinture', 'Nice', FUTURE, 'en_attente_publication'],
      ]);
      expect((await row(id)).clauseId).toBeNull();
    });

    it('un administrateur déclare pour une entité : création non autonome, refusée aux autres rôles', async () => {
      const sp = await specialite();
      const input = { intitule: 'Saisi par l’équipe', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Paris' };
      const admin = { ...acheteur(), roles: ['admin' as const], acheteurId: null, acheteurEntiteId: null };
      const { id } = await svc.declarerMarchePourEntite(admin, base.acheteur.id, input);
      expect(await row(id)).toMatchObject({ acheteurId: base.acheteur.id, creationEnAutonomie: false, statut: 'en_attente_publication' });
      expect(await rejects(svc.declarerMarchePourEntite(acheteur(), base.acheteur.id, input))).toBe(403);
    });

    it('refuse une date limite passée, un marché simple incomplet, des numéros de lot en double, et les non-acheteurs', async () => {
      const valid = { intitule: 'X', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, clauseId: base.clause.id, specialiteIds: [1], lieu: 'Paris' };
      expect(await rejects(svc.declarerMarche(acheteur(), { ...valid, dateLimiteOffres: '2000-01-01' }))).toBe(400);
      expect(await rejects(svc.declarerMarche(acheteur(), { ...valid, lieu: '' }))).toBe(400);
      expect(await rejects(svc.declarerMarche(acheteur(), { ...valid, dateLimiteOffres: 'demain' }))).toBe(400);
      const l = { numero: '1', intitule: 'a', clauseId: base.clause.id, specialiteIds: [1], lieu: 'x' };
      expect(await rejects(svc.declarerMarche(acheteur(), { ...valid, clauseId: null, lots: [l, { ...l, intitule: 'b' }] }))).toBe(400);
      expect(await rejects(svc.declarerMarche({ ...acheteur(), roles: ['beneficiaire'] }, valid))).toBe(403);
      expect((await base.db.select().from(s.marches)).length).toBe(1); // seulement le marché de départ : rien n'a été écrit
    });
  });

  describe('modifier et supprimer', () => {
    it('met à jour le marché, ajoute, modifie et supprime des lots en une fois', async () => {
      const sp = await specialite();
      const l1 = await lot(base.parent.id, '1');
      const l2 = await lot(base.parent.id, '2', { statut: 'en_attente_declaration' });
      await svc.modifierMarche(acheteur(), base.parent.id, {
        intitule: 'Rénové', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE,
        lots: [{ id: l2.id, numero: '2', intitule: 'Peinture bis', clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Lyon' }, { numero: '3', intitule: 'Nouveau', clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Nice' }],
        lotsSupprimes: [l1.id],
      });
      expect((await row(base.parent.id)).intitule).toBe('Rénové');
      const lots = await base.db.select().from(s.marches).where(eq(s.marches.parentId, base.parent.id));
      expect(lots.map((l) => [l.numeroLot, l.intituleLot, l.statut]).sort()).toEqual([['2', 'Peinture bis', 'en_attente_declaration'], ['3', 'Nouveau', 'en_attente_publication']]);
    });

    it('refuse de toucher au lot d’un autre marché, au marché d’une autre entité, ou à un lot directement', async () => {
      const autre = (await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, intitule: 'Autre' }).returning())[0]!;
      const foreign = await lot(autre.id, '1');
      const sp = await specialite();
      const body = { intitule: 'X', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, lots: [], lotsSupprimes: [foreign.id], clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'x' };
      expect(await rejects(svc.modifierMarche(acheteur(), base.parent.id, body))).toBe(403);
      expect(await rejects(svc.modifierMarche(await autreAcheteur(), base.parent.id, { ...body, lotsSupprimes: [] }))).toBe(403);
      expect(await rejects(svc.modifierMarche(acheteur(), foreign.id, { ...body, lotsSupprimes: [] }))).toBe(400);
      expect((await row(foreign.id)).id).toBe(foreign.id);
    });

    it('supprimer retire le marché et ses lots ; refusé pour une autre entité', async () => {
      const l = await lot(base.parent.id, '1');
      expect(await rejects(svc.supprimerMarche(await autreAcheteur(), base.parent.id))).toBe(403);
      await svc.supprimerMarche(acheteur(), base.parent.id);
      expect(await base.db.select().from(s.marches).where(eq(s.marches.id, l.id))).toHaveLength(0);
      expect(await base.db.select().from(s.marches).where(eq(s.marches.id, base.parent.id))).toHaveLength(0);
    });
  });

  describe('publication', () => {
    it('le marché et ses lots passent en attente de notification, le lien reçoit https, et les bénéficiaires sont prévenus', async () => {
      const l = await lot(base.parent.id, '1');
      await svc.publierMarche(acheteur(), base.parent.id, { datePublication: '2026-01-15', lien: 'exemple.fr/dce' });
      for (const id of [base.parent.id, l.id]) expect(await row(id)).toMatchObject({ statut: 'en_attente_notification', lienDocuments: 'https://exemple.fr/dce', datePublication: '2026-01-15' });
      expect(outbox.map((m) => m.to).sort()).toEqual(['a@benef.test', 'b@benef.test', 'c@benef.test']);
    });

    it('exige la date et le lien, et un marché de son entité', async () => {
      expect(await rejects(svc.publierMarche(acheteur(), base.parent.id, { datePublication: '2026-01-15', lien: ' ' }))).toBe(400);
      expect(await rejects(svc.publierMarche(acheteur(), base.parent.id, { datePublication: 'x', lien: 'a.fr' }))).toBe(400);
      expect(await rejects(svc.publierMarche(await autreAcheteur(), base.parent.id, { datePublication: '2026-01-15', lien: 'a.fr' }))).toBe(403);
      expect((await row(base.parent.id)).statut).toBe('en_attente_publication');
    });
  });

  describe('titulaire', () => {
    it('inviter : invitation, statut du marché, compte du titulaire créé et prévenu', async () => {
      await svc.inviterTitulaire(acheteur(), base.parent.id, { email: ' Nouveau@Societe.test ', dateFinExecution: '2027-12-31' });
      expect(await row(base.parent.id)).toMatchObject({ statut: 'en_attente_declaration', dateFinExecution: '2027-12-31' });
      const [inv] = await base.db.select().from(s.invitationsTitulaires);
      expect(inv).toMatchObject({ marcheId: base.parent.id, email: 'nouveau@societe.test' });
      expect(outbox.map((m) => m.to)).toEqual(['nouveau@societe.test']);
    });

    it('lots : le parent passe en attente de déclaration seulement quand tous les lots sont invités', async () => {
      await base.db.update(s.marches).set({ statut: 'en_attente_notification' }).where(eq(s.marches.id, base.parent.id));
      const l1 = await lot(base.parent.id, '1');
      const l2 = await lot(base.parent.id, '2');
      await svc.inviterTitulaire(acheteur(), l1.id, { email: 'a@societe.test' });
      expect((await row(base.parent.id)).statut).toBe('en_attente_notification');
      await svc.inviterTitulaire(acheteur(), l2.id, { email: 'b@societe.test' });
      expect((await row(base.parent.id)).statut).toBe('en_attente_declaration');
    });

    it('refuse un e-mail invalide et le marché d’une autre entité, sans rien écrire', async () => {
      expect(await rejects(svc.inviterTitulaire(acheteur(), base.parent.id, { email: 'pas-un-mail' }))).toBe(400);
      expect(await rejects(svc.inviterTitulaire(await autreAcheteur(), base.parent.id, { email: 'a@b.fr' }))).toBe(403);
      expect(await base.db.select().from(s.invitationsTitulaires)).toHaveLength(0);
      expect((await row(base.parent.id)).statut).toBe('en_attente_publication');
    });

    it('relancer : un courrier, puis refus tant que le délai n’est pas écoulé', async () => {
      await base.db.insert(s.invitationsTitulaires).values({ marcheId: base.parent.id, email: 'titulaire@societe.test' });
      await svc.relancerTitulaire(acheteur(), base.parent.id);
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
      expect(text(outbox[0]!.html)).toContain('Accéder à mon espace');
      expect(await rejects(svc.relancerTitulaire(acheteur(), base.parent.id))).toBe(429);
      await base.db.update(s.invitationsTitulaires).set({ derniereRelanceLe: new Date(Date.now() - 8 * 86_400_000) });
      await svc.relancerTitulaire(acheteur(), base.parent.id);
      expect(outbox).toHaveLength(2);
    });

    it('relancer : lien d’activation pour un compte non activé, 404 sans invitation, 403 pour une autre entité', async () => {
      expect(await rejects(svc.relancerTitulaire(acheteur(), base.parent.id))).toBe(404);
      const { assurerUtilisateur } = await import('@/server/services/comptes');
      await assurerUtilisateur('nouveau@societe.test');
      await base.db.insert(s.invitationsTitulaires).values({ marcheId: base.parent.id, email: 'nouveau@societe.test' });
      await svc.relancerTitulaire(acheteur(), base.parent.id);
      expect(outbox[0]!.html).toContain('/reset-password?token=');
      expect(outbox[0]!.subject).toBe('Eclauses - Relance : actions requises suite à votre titularisation sur un marché');
      expect(await rejects(svc.relancerTitulaire(await autreAcheteur(), base.parent.id))).toBe(403);
    });
  });

  describe('déclarations', () => {
    const declare = async (marcheId: number, over: Partial<typeof s.declarationsBeneficiaires.$inferInsert> = {}) =>
      (await base.db.insert(s.declarationsBeneficiaires).values({ repondantId: base.titulaire.id, marcheId, email: 'benef@test.test', ...over }).returning())[0]!;
    const aValider = (id: number) => base.db.update(s.marches).set({ statut: 'declaration_a_valider', titulaireId: base.titulaire.id }).where(eq(s.marches.id, id));

    it('valider : déclarations validées, marché validé, titulaire et acheteur prévenus (jamais le bénéficiaire)', async () => {
      await aValider(base.parent.id);
      const d = await declare(base.parent.id);
      await svc.validerDeclaration(acheteur(), base.parent.id);
      expect((await row(base.parent.id)).statut).toBe('clause_validee');
      expect((await base.db.select().from(s.declarationsBeneficiaires).where(eq(s.declarationsBeneficiaires.id, d.id)))[0]!.statut).toBe('valide');
      expect(outbox.map((m) => m.to).sort()).toEqual(['acheteur@culture.test', 'titulaire@societe.test']);
    });

    it('lots : le parent n’est validé que lorsque tous ses lots le sont', async () => {
      const l1 = await lot(base.parent.id, '1');
      const l2 = await lot(base.parent.id, '2');
      await aValider(l1.id);
      await aValider(l2.id);
      await declare(l1.id);
      await declare(l2.id);
      await svc.validerDeclaration(acheteur(), l1.id);
      expect((await row(base.parent.id)).statut).not.toBe('clause_validee');
      await svc.validerDeclaration(acheteur(), l2.id);
      expect((await row(base.parent.id)).statut).toBe('clause_validee');
    });

    it('valider est refusé hors statut « à valider », sans déclaration, ou pour une autre entité', async () => {
      expect(await rejects(svc.validerDeclaration(acheteur(), base.parent.id))).toBe(409);
      await aValider(base.parent.id);
      expect(await rejects(svc.validerDeclaration(acheteur(), base.parent.id))).toBe(409);
      await declare(base.parent.id);
      expect(await rejects(svc.validerDeclaration(await autreAcheteur(), base.parent.id))).toBe(403);
      expect((await row(base.parent.id)).statut).toBe('declaration_a_valider');
    });

    it('refuser : motif obligatoire, déclarations en brouillon, retour en attente de déclaration, titulaire prévenu', async () => {
      await aValider(base.parent.id);
      const d = await declare(base.parent.id);
      expect(await rejects(svc.refuserDeclaration(acheteur(), base.parent.id, { raison: '  ' }))).toBe(400);
      await svc.refuserDeclaration(acheteur(), base.parent.id, { raison: 'Pièces manquantes' });
      expect((await row(base.parent.id)).statut).toBe('en_attente_declaration');
      expect((await base.db.select().from(s.declarationsBeneficiaires).where(eq(s.declarationsBeneficiaires.id, d.id)))[0]!.statut).toBe('brouillon');
      const [refus] = await base.db.select().from(s.declarationsRefus);
      expect(refus).toMatchObject({ marcheId: base.parent.id, raison: 'Pièces manquantes', refuseParUtilisateurId: base.userAcheteur.id });
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
      expect(text(outbox[0]!.html)).toContain('Motif du refus : Pièces manquantes');
    });

    it('une déclaration refusée puis re-soumise peut être validée (le brouillon n’est pas une impasse)', async () => {
      await aValider(base.parent.id);
      await declare(base.parent.id);
      await svc.refuserDeclaration(acheteur(), base.parent.id, { raison: 'À corriger' });
      await base.db.update(s.marches).set({ statut: 'declaration_a_valider' }).where(eq(s.marches.id, base.parent.id));
      outbox.length = 0;
      await svc.validerDeclaration(acheteur(), base.parent.id);
      expect((await row(base.parent.id)).statut).toBe('clause_validee');
    });
  });

  describe('actions (Server Actions)', () => {
    it('sans session ou avec un autre rôle : refusées avec un message, sans écriture', async () => {
      expect(await actions.supprimer(base.parent.id)).toEqual({ ok: false, message: 'Authentification requise.' });
      cookie = await createSession(base.a.user.id); // un bénéficiaire
      expect(await actions.supprimer(base.parent.id)).toMatchObject({ ok: false });
      expect(await actions.declarer({})).toMatchObject({ ok: false });
      expect(await base.db.select().from(s.marches).where(eq(s.marches.id, base.parent.id))).toHaveLength(1);
    });

    it('un acheteur : les erreurs de validation reviennent comme valeur, les succès aussi', async () => {
      cookie = await createSession(base.userAcheteur.id);
      const bad = await actions.declarer({ intitule: '' });
      expect(bad).toMatchObject({ ok: false });
      const sp = await specialite();
      const ok = await actions.declarer({ intitule: 'Via action', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, clauseId: base.clause.id, specialiteIds: [sp.id], lieu: 'Paris' });
      expect(ok.ok && ok.data.id).toBeGreaterThan(0);
      const lus = await (await import('@/server/actions/lecture')).lireTables(['Marches', 'Invitation_Titulaire']);
      expect(lus.ok && lus.data.Marches.some((m) => m.Intitule_du_marche === 'Via action')).toBe(true);
    });

    it('une référence inexistante est une erreur de saisie lisible, et n’écrit rien', async () => {
      cookie = await createSession(base.userAcheteur.id);
      const res = await actions.declarer({ intitule: 'Réf. inconnue', dateLimiteOffres: FUTURE, dateNotificationPrevisionnelle: FUTURE, clauseId: base.clause.id, specialiteIds: [9999], lieu: 'Paris' });
      expect(res).toEqual({ ok: false, message: 'Une des valeurs choisies n’existe pas ou plus.' });
      expect((await base.db.select().from(s.marches).where(eq(s.marches.intitule, 'Réf. inconnue'))).length).toBe(0);
    });

    it('l’entité renommée vient de la session, jamais de la page', async () => {
      cookie = await createSession(base.userAcheteur.id);
      expect(await actions.enregistrerEntite({ Nom: 'DRAC Renommée' })).toEqual({ ok: true, data: null });
      expect((await base.db.select().from(s.acheteurs).where(eq(s.acheteurs.id, base.acheteur.id)))[0]!.nom).toBe('DRAC Renommée');
      expect(await actions.enregistrerEntite({ Ministere: 'x' })).toMatchObject({ ok: false });
    });
  });
});
