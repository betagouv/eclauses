import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '@/server/auth/session';
import { hasPostgres, useTemporaryDatabase } from './helpers/pg';

type Base = Awaited<ReturnType<(typeof import('./helpers/fixtures'))['seedBase']>>;
const anon = null;

describe.skipIf(!hasPostgres)('accès aux données (forme des pages et droits)', () => {
  let t: Awaited<ReturnType<typeof useTemporaryDatabase>>;
  let tables: typeof import('@/server/tables');
  let s: typeof import('@/server/db/schema');
  let outbox: (typeof import('@/server/mail/transport'))['outbox'];
  let base: Base;
  let seedBase: (typeof import('./helpers/fixtures'))['seedBase'];

  beforeAll(async () => {
    t = await useTemporaryDatabase();
    tables = await import('@/server/tables');
    s = await import('@/server/db/schema');
    outbox = (await import('@/server/mail/transport')).outbox;
    ({ seedBase } = await import('./helpers/fixtures'));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    outbox.length = 0;
    await t.sql.unsafe('truncate acheteurs, utilisateurs, clauses_sociales, notifications_envoyees, fichiers restart identity cascade');
    base = await seedBase();
  });

  const session = (over: Partial<Session>): Session => ({ email: 'x@y.fr', roles: [], beneficiaireId: null, repondantId: null, acheteurId: null, acheteurEntiteId: null, ...over });
  const acheteur = () => session({ email: 'acheteur@culture.test', roles: ['acheteur'], acheteurId: base.ua.id, acheteurEntiteId: base.acheteur.id });
  const benef = (b = base.a) => session({ email: b.user.email, roles: ['beneficiaire'], beneficiaireId: b.benef.id });
  const repondant = () => session({ email: 'titulaire@societe.test', roles: ['repondant'], repondantId: base.titulaire.id });
  const rejects = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as { status?: number }).status ?? 500;
    }
    return 0;
  };

  describe('marchés', () => {
    it('présentent les agrégats de lots et le statut global comme les formules de Grist', async () => {
      const l1 = (await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId: base.parent.id, intitule: 'x', numeroLot: '1', intituleLot: 'Maçonnerie', clauseId: base.clause.id, statut: 'clause_validee' }).returning())[0]!;
      const l2 = (await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId: base.parent.id, intitule: 'x', numeroLot: '2', intituleLot: 'Peinture', clauseId: base.clause.id, statut: 'declaration_a_valider' }).returning())[0]!;
      await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId: base.parent.id, intitule: 'x', numeroLot: '3' }); // lot sans clause
      const rows = await tables.readTable(acheteur(), 'Marches');
      const parent = rows.find((r) => r.id === base.parent.id)!;
      expect(parent).toMatchObject({ Est_marche_parent: true, Est_lot: false, Nb_lots: 3, Nb_lots_eclauses: 2, Nb_lots_valides: 1, Nb_lots_a_valider: 1, Statut_global: 'Déclaration à valider', Acheteur_Nom: 'DRAC Test' });
      expect(parent.Lots).toEqual([l1.id, l2.id, expect.any(Number)]);
      const lot = rows.find((r) => r.id === l2.id)!;
      expect(lot).toMatchObject({ Est_lot: true, Marche_racine: base.parent.id, Lot_Label: 'Lot 2 - Peinture', Intitule_propre: 'Rénovation du musée - Lot 2 : Peinture', Marche_parent_Intitule_propre: 'Rénovation du musée', Statut: 'Déclaration à valider' });
      expect(parent.Lots_Detail).toHaveLength(2);
      expect(typeof parent.Date_Limite_de_Remise_des_Offres).toBe('number');
    });

    it('un visiteur ne voit que les marchés publiés, sans statut ni acheteur', async () => {
      await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, intitule: 'Brouillon validé', statut: 'clause_validee' });
      const rows = await tables.readTable(anon, 'Marches');
      expect(rows.map((r) => r.Intitule_du_marche)).toEqual(['Rénovation du musée']);
      expect(rows[0]).not.toHaveProperty('Statut');
      expect(rows[0]).not.toHaveProperty('Acheteur_Nom');
      expect(rows[0]).not.toHaveProperty('Titulaire');
    });

    it("la création par un acheteur pose l'entité et l'indicateur d'autonomie, et ignore les champs réservés", async () => {
      const id = await tables.createRow(acheteur(), 'Marches', { Intitule_du_marche: 'Nouveau', Acheteur: 999, Creation_en_autonomie: false, Statut: 'En attente de notification', Date_de_fin_d_execution: '2027-05-01' });
      const [m] = await base.db.select().from(s.marches).where(eq(s.marches.id, id));
      expect(m).toMatchObject({ acheteurId: base.acheteur.id, creationEnAutonomie: true, statut: 'en_attente_notification', dateFinExecution: '2027-05-01' });
      expect(m!.creeParUtilisateurId).toBe(base.userAcheteur.id);
      // La création déclenche la publication (bénéficiaires actifs de la clause) s'il y a une clause.
      expect(outbox).toHaveLength(0);
    });

    it('refuse les colonnes calculées et inconnues, la modification du marché d’un autre et la création par un non-acheteur', async () => {
      expect(await rejects(tables.updateRow(acheteur(), 'Marches', base.parent.id, { Nb_lots: 5 }))).toBe(400);
      expect(await rejects(tables.updateRow(acheteur(), 'Marches', base.parent.id, { Inconnue: 1 }))).toBe(400);
      expect(await rejects(tables.updateRow(benef(), 'Marches', base.parent.id, { Intitule_du_marche: 'x' }))).toBe(403);
      const [autre] = await base.db.insert(s.acheteurs).values({ nom: 'Autre' }).returning();
      const [m] = await base.db.insert(s.marches).values({ acheteurId: autre!.id, intitule: 'Autre' }).returning();
      expect(await rejects(tables.updateRow(acheteur(), 'Marches', m!.id, { Intitule_du_marche: 'piraté' }))).toBe(403);
      expect(await rejects(tables.removeRow(acheteur(), 'Marches', m!.id))).toBe(403);
      expect(await rejects(tables.createRow(benef(), 'Marches', { Intitule_du_marche: 'x' }))).toBe(403);
    });

    it('un titulaire ne peut que soumettre sa déclaration, et cela prévient l’acheteur', async () => {
      await base.db.update(s.marches).set({ titulaireId: base.titulaire.id, statut: 'en_attente_declaration' }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(tables.updateRow(repondant(), 'Marches', base.parent.id, { Statut: 'Clause validée' }))).toBe(403);
      expect(await rejects(tables.updateRow(repondant(), 'Marches', base.parent.id, { Statut: 'Déclaration à valider', Intitule_du_marche: 'x' }))).toBe(403);
      await tables.updateRow(repondant(), 'Marches', base.parent.id, { Statut: 'Déclaration à valider' });
      expect(outbox.map((m) => m.to)).toEqual(['acheteur@culture.test']);
    });

    it('un marché parent ne se supprime pas tant qu’il a des lots', async () => {
      await base.db.insert(s.marches).values({ acheteurId: base.acheteur.id, parentId: base.parent.id, intitule: 'x' });
      expect(await rejects(tables.removeRow(acheteur(), 'Marches', base.parent.id))).toBe(409);
    });
  });

  describe('bénéficiaires et annuaire', () => {
    it('chacun voit sa fiche complète (sans champs internes) et les autres masquées', async () => {
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, consentementContactGroupements: true, commentaire: 'interne' }).where(eq(s.beneficiaires.id, base.a.benef.id));
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, consentementContactGroupements: false }).where(eq(s.beneficiaires.id, base.b.benef.id));
      const rows = await tables.readTable(benef(base.a), 'Beneficiaires');
      const mine = rows.find((r) => r.id === base.a.benef.id)!;
      expect(mine).toMatchObject({ Courriel: 'a@benef.test', Eligible: true, Doit_supprimer: false });
      expect(mine).not.toHaveProperty('Commentaire');
      const other = rows.find((r) => r.id === base.b.benef.id)!;
      expect(other).not.toHaveProperty('Courriel');
      expect(other).not.toHaveProperty('Telephone');
      // c n'a pas consenti à l'annuaire : invisible.
      expect(rows.map((r) => r.id).sort()).toEqual([base.a.benef.id, base.b.benef.id].sort());
    });

    it('un bénéficiaire non éligible ou à supprimer n’apparaît pas dans l’annuaire', async () => {
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true, anneeDiplome: new Date().getFullYear() - 8 }).where(eq(s.beneficiaires.id, base.b.benef.id));
      const rows = await tables.readTable(benef(base.a), 'Beneficiaires');
      expect(rows.some((r) => r.id === base.b.benef.id)).toBe(false);
    });

    it('met à jour son profil avec listes et dates, mais pas l’e-mail ni la fiche d’un autre', async () => {
      const [spec] = await base.db.insert(s.specialites).values({ intitule: 'Peinture' }).returning();
      const [dep] = await base.db.insert(s.departements).values({ numero: '75', nom: 'Paris' }).returning();
      await tables.updateRow(benef(), 'Beneficiaires', base.a.benef.id, { Telephone: '0102030405', Specialite: [spec!.id], Departement_de_residence: [dep!.id], Annee_de_diplome: '2023', Fiche_MAJ: true, Courriel: 'A@benef.test' });
      const [row] = await tables.readTable(benef(), 'Beneficiaires', [base.a.benef.id]);
      expect(row).toMatchObject({ Telephone: '0102030405', Specialite: [spec!.id], Departement_de_residence: [dep!.id], Annee_de_diplome: '2023' });
      expect(await rejects(tables.updateRow(benef(), 'Beneficiaires', base.a.benef.id, { Courriel: 'autre@benef.test' }))).toBe(400);
      expect(await rejects(tables.updateRow(benef(), 'Beneficiaires', base.b.benef.id, { Telephone: '1' }))).toBe(403);
      expect(await rejects(tables.updateRow(benef(), 'Beneficiaires', base.a.benef.id, { Commentaire: 'x' }))).toBe(400);
      expect(await rejects(tables.updateRow(benef(), 'Beneficiaires', base.a.benef.id, { alumni: true }))).toBe(400);
    });

    it('le CV est enregistré hors base, lisible par son propriétaire et les fiches visibles seulement', async () => {
      const { enregistrerFichier, lireFichier } = await import('@/server/services/fichiers');
      const { setOwnCv, canReadCv } = await import('@/server/beneficiaires');
      const f = await enregistrerFichier({ contenu: new Uint8Array([0x25, 0x50, 0x44, 0x46]), nom: 'cv.pdf', typeMime: 'application/pdf', usage: 'cv', utilisateurId: base.a.user.id });
      await setOwnCv(benef(base.a), base.a.benef.id, f.id);
      expect(await canReadCv(benef(base.a), f.id)).toBe(true);
      expect(await canReadCv(benef(base.b), f.id)).toBe(false);
      await base.db.update(s.beneficiaires).set({ consentementAnnuaire: true }).where(eq(s.beneficiaires.id, base.a.benef.id));
      expect(await canReadCv(benef(base.b), f.id)).toBe(true);
      const [row] = await tables.readTable(benef(base.a), 'Beneficiaires', [base.a.benef.id]);
      expect(row!.curriculum_vitae).toEqual([f.id]);
      const lu = await lireFichier(f.id);
      expect(lu?.typeMime).toBe('application/pdf');
      expect(Buffer.from(await new Response(lu!.flux).arrayBuffer())).toEqual(Buffer.from([0x25, 0x50, 0x44, 0x46]));
      // Remplacer le CV supprime l'ancien fichier.
      const g = await enregistrerFichier({ contenu: new Uint8Array([1, 2, 3]), nom: 'cv2.pdf', typeMime: 'application/pdf', usage: 'cv', utilisateurId: null });
      await setOwnCv(benef(base.a), base.a.benef.id, g.id);
      expect(await lireFichier(f.id)).toBeNull();
      expect(await rejects(setOwnCv(benef(base.b), base.a.benef.id, null))).toBe(403);
    });
  });

  describe('répondants, invitations, déclarations', () => {
    it('inscription d’un candidat par un visiteur : compte sans mot de passe, candidatures aux marchés publiés, courrier', async () => {
      const id = await tables.createRow(anon, 'Repondants', { Nom: 'Candidat', Email: 'Nouveau@Societe.test', Candidat_aux_marches: [base.parent.id] });
      const [u] = await base.db.select().from(s.utilisateurs).where(eq(s.utilisateurs.email, 'nouveau@societe.test'));
      expect(u!.motDePasseHash).toBeNull();
      const rows = await base.db.select().from(s.candidatures).where(eq(s.candidatures.repondantId, id));
      expect(rows.map((r) => r.marcheId)).toEqual([base.parent.id]);
      expect(outbox.map((m) => m.subject)).toEqual(['Eclauses - Finalisez votre inscription']);
      // Même adresse : refusée, la page passe par la vérification préalable.
      expect(await rejects(tables.createRow(anon, 'Repondants', { Nom: 'Doublon', Email: 'nouveau@societe.test' }))).toBe(409);
      // Marché non publié : refusé.
      await base.db.update(s.marches).set({ statut: 'en_attente_declaration' }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(tables.createRow(anon, 'Repondants', { Nom: 'X', Email: 'x@societe.test', Candidat_aux_marches: [base.parent.id] }))).toBe(400);
      // Colonnes non prévues à l'inscription.
      expect(await rejects(tables.createRow(anon, 'Repondants', { Nom: 'X', Email: 'y@societe.test', Siret: '1', Titulaire_aux_marches: [1] }))).toBe(400);
    });

    it('un répondant ne lit que sa fiche et ne change pas son e-mail', async () => {
      const [other] = await base.db.insert(s.repondants).values({ nom: 'Autre' }).returning();
      const rows = await tables.readTable(repondant(), 'Repondants');
      expect(rows.map((r) => r.id)).toEqual([base.titulaire.id]);
      expect(rows[0]).toMatchObject({ Email: 'titulaire@societe.test', Label: 'Entreprise Z (Z <titulaire@societe.test>)' });
      await tables.updateRow(repondant(), 'Repondants', base.titulaire.id, { Telephone: '0102', Email: 'Titulaire@societe.test' });
      expect(await rejects(tables.updateRow(repondant(), 'Repondants', base.titulaire.id, { Email: 'autre@x.test' }))).toBe(400);
      expect(await rejects(tables.updateRow(repondant(), 'Repondants', other!.id, { Telephone: '1' }))).toBe(403);
    });

    it('l’acheteur invite un titulaire sur son marché seulement, et le titulaire déclare puis l’acheteur valide', async () => {
      const invId = await tables.createRow(acheteur(), 'Invitation_Titulaire', { Marche: base.parent.id, Email: 'titulaire@societe.test' });
      expect(outbox).toHaveLength(1);
      const [autre] = await base.db.insert(s.acheteurs).values({ nom: 'Autre' }).returning();
      const [m2] = await base.db.insert(s.marches).values({ acheteurId: autre!.id, intitule: 'Autre' }).returning();
      expect(await rejects(tables.createRow(acheteur(), 'Invitation_Titulaire', { Marche: m2!.id, Email: 'x@y.test' }))).toBe(403);
      const invs = await tables.readTable(acheteur(), 'Invitation_Titulaire');
      expect(invs.map((i) => i.id)).toEqual([invId]);
      expect(invs[0]).toMatchObject({ Status: 'pending', AuthUser: base.titulaireUser.id });

      outbox.length = 0;
      const declId = await tables.createRow(repondant(), 'Declarations_Beneficiaires', { Marche: base.parent.id, Beneficiaire: base.a.benef.id, Est_beneficiaire_eclauses: true, Statut: 'déclaré' });
      expect(outbox).toHaveLength(0);
      // Le titulaire ne valide pas lui-même (Statut libre à la création : seul « déclaré » est accepté ici).
      const decls = await tables.readTable(acheteur(), 'Declarations_Beneficiaires');
      expect(decls[0]).toMatchObject({ Statut: 'déclaré', Beneficiaire__Courriel: 'a@benef.test', Email_envoi: 'a@benef.test' });
      await tables.updateRow(acheteur(), 'Declarations_Beneficiaires', declId, { Statut: 'validé' });
      expect(outbox.map((m) => m.to)).toEqual(['a@benef.test']);
      const [m] = await tables.readTable(acheteur(), 'Marches', [base.parent.id]);
      expect(m!.Beneficiaires).toEqual([declId]);
    });

    it('un non-titulaire ne déclare pas ; le refus exige un motif et prévient le titulaire', async () => {
      expect(await rejects(tables.createRow(repondant(), 'Declarations_Beneficiaires', { Marche: base.parent.id, Nom: 'X' }))).toBe(403);
      await base.db.update(s.marches).set({ titulaireId: base.titulaire.id }).where(eq(s.marches.id, base.parent.id));
      expect(await rejects(tables.createRow(acheteur(), 'Declarations_Beneficiaires_Refus', { Marche: base.parent.id, Raison: ' ' }))).toBe(400);
      const id = await tables.createRow(acheteur(), 'Declarations_Beneficiaires_Refus', { Marche: base.parent.id, Raison: 'Pièces manquantes', Refuse_par: 1 });
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
      const rows = await tables.readTable(repondant(), 'Declarations_Beneficiaires_Refus');
      expect(rows.map((r) => r.id)).toEqual([id]);
    });

    it('intérêts et consultations de coordonnées : propres à chaque rôle, sans doublon', async () => {
      const idI = await tables.createRow(benef(), 'Marches_Interets', { Marche: base.parent.id, Beneficiaire: base.b.benef.id });
      const [i] = await base.db.select().from(s.interetsMarches).where(eq(s.interetsMarches.id, idI));
      expect(i!.beneficiaireId).toBe(base.a.benef.id); // jamais celui envoyé par la page
      expect(await rejects(tables.createRow(benef(), 'Marches_Interets', { Marche: base.parent.id }))).toBeGreaterThan(0);
      expect(await rejects(tables.removeRow(benef(base.b), 'Marches_Interets', idI))).toBe(403);
      await tables.removeRow(benef(), 'Marches_Interets', idI);

      await tables.createRow(repondant(), 'Acces_Coordonnees', { Marche: base.parent.id, Beneficiaire: base.a.benef.id, Affiche_email: true });
      expect(outbox.map((m) => m.to)).toEqual(['a@benef.test']);
      expect(await rejects(tables.createRow(repondant(), 'Acces_Coordonnees', { Marche: base.parent.id, Beneficiaire: base.a.benef.id }))).toBe(409);
      const vu = await tables.readTable(benef(), 'Acces_Coordonnees');
      expect(vu).toHaveLength(1);
      expect(vu[0]).not.toHaveProperty('Repondant');
    });

    it('mot de passe oublié : réponse identique que le compte existe ou non', async () => {
      expect(await tables.createRow(anon, 'Application_Password_Reset', { Email: 'inconnu@x.test' })).toBe(0);
      expect(await tables.createRow(anon, 'Application_Password_Reset', { Email: 'titulaire@societe.test' })).toBe(0);
      expect(outbox.map((m) => m.to)).toEqual(['titulaire@societe.test']);
      expect(await rejects(tables.readTable(anon, 'Application_Password_Reset'))).toBe(403);
    });
  });

  describe('contenu et références', () => {
    it('tables non exposées refusées', async () => {
      for (const table of ['Application_AuthUser', 'AuthLink', 'utilisateurs', 'jetons_auth', 'Application_Env', 'Z_Libs']) {
        expect(await rejects(tables.readTable(benef(), table))).toBe(403);
      }
      expect(await rejects(tables.readTable(anon, 'Beneficiaires'))).toBe(401);
    });

    it('FAQ publiée seulement ; indicateurs calculés ; référentiels réservés aux connectés', async () => {
      await base.db.insert(s.faqCategories).values([{ titre: 'Publiée', slug: 'publiee', publie: true }, { titre: 'Brouillon', slug: 'brouillon' }]);
      expect((await tables.readTable(anon, 'Application_FAQ_Categories')).map((c) => c.Title)).toEqual(['Publiée']);
      await base.db.insert(s.impacts).values([
        { libelle: 'Clauses', typeIndicateur: 'utile', indicateur: 'clauses_activees' },
        { libelle: 'Manuel', typeIndicateur: 'impactant', valeurManuelle: 'x %' },
      ]);
      const impacts = await tables.readTable(anon, 'Impacts');
      expect(Object.fromEntries(impacts.map((i) => [i.Label, i.Valeur]))).toEqual({ Clauses: '0', Manuel: 'x %' });
      await base.db.insert(s.formations).values({ intitule: 'Master' });
      expect(await rejects(tables.readTable(anon, 'T0_Referentiel_Formations'))).toBe(401);
      expect((await tables.readTable(benef(), 'T0_Referentiel_Formations'))[0]).toMatchObject({ Intitule: 'Master' });
    });

    it('en-tête et pied de page depuis les paramètres et les liens', async () => {
      const { siteConfig, resetSiteCache } = await import('@/server/site');
      await base.db.insert(s.parametres).values([{ cle: 'site_titre', valeur: 'Eclauses' }, { cle: 'site_badge_libelle', valeur: 'Bêta' }]);
      await base.db.insert(s.liens).values([
        { zone: 'entete', libelle: 'Accueil', url: '/', ordre: 2 },
        { zone: 'entete', libelle: 'FAQ', url: '/faq', ordre: 1 },
        { zone: 'pied', libelle: 'Légifrance', url: 'https://legifrance.gouv.fr', externe: true },
      ]);
      resetSiteCache();
      const site = await siteConfig();
      expect(site.badge?.label).toBe('Bêta');
      expect(site.headerLinks.map((l) => l.label)).toEqual(['FAQ', 'Accueil']);
      expect(site.footerLinks[0]).toMatchObject({ external: true });
    });
  });
});
