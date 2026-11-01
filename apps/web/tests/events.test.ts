import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: number } & Record<string, unknown>;
const db: Record<string, Row[]> = {};
let nextId = 1000;

/** Faux Grist en mémoire : assez pour exercer les gestionnaires d'événements sans réseau. */
const fake = {
  records: async (table: string, opts: { filter?: Record<string, unknown[]>; limit?: number } = {}) => {
    const rows = (db[table] ?? []).filter((r) =>
      Object.entries(opts.filter ?? {}).every(([k, vals]) => (vals as unknown[]).includes(r[k])),
    );
    return structuredClone(opts.limit ? rows.slice(0, opts.limit) : rows);
  },
  addRecords: async (table: string, rows: Record<string, unknown>[]) => {
    const ids: number[] = [];
    for (const r of rows) {
      const id = nextId++;
      // Grist calcule le jeton de la demande d'activation à la création.
      const extra = table === 'Application_Password_Reset' ? { Token: `jeton-${id}-abcdefghijklmnopqrstuvwxyz` } : {};
      (db[table] ??= []).push({ id, ...r, ...extra });
      ids.push(id);
    }
    return ids;
  },
  updateRecords: async (table: string, rows: { id: number; fields: Record<string, unknown> }[]) => {
    for (const { id, fields } of rows) Object.assign((db[table] ?? []).find((r) => r.id === id)!, fields);
  },
  columns: async () => [],
};
vi.mock('@/server/config', () => ({ grist: () => fake, config: () => ({}) }));

const { outbox } = await import('@/server/mail/transport');
const { clearAll } = await import('@/server/events/dedupe');
const ev = await import('@/server/events/handlers');

const ACHETEUR = { Acheteur: 4, Acheteur_Nom: 'DRAC Test', Acheteur_Utilisateurs_Acheteurs: ['L', 2] };
const MARCHE_SANS_LOT = { id: 10, ...ACHETEUR, Est_lot: false, Marche_parent: 0, Intitule_propre: 'Rénovation du musée', Marche_parent_Intitule_propre: 'Rénovation du musée', Titulaire_Label: 'Entreprise Z', Titulaire: 7 };
const LOT = { id: 11, ...ACHETEUR, Est_lot: true, Marche_parent: 10, Intitule_propre: 'Rénovation du musée - Lot 2 : Peinture', Marche_parent_Intitule_propre: 'Rénovation du musée', Lot_Label: 'Lot 2 - Peinture', Numero_de_lot: '2', Titulaire_Label: 'Entreprise Z', Titulaire: 7 };

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  outbox.length = 0;
  clearAll();
  db.Marches = [structuredClone(MARCHE_SANS_LOT) as Row, structuredClone(LOT) as Row];
  db.Utilisateurs_Acheteurs = [{ id: 2, Email: 'acheteur@culture.test', Prenom: 'Camille', Nom: 'Martin' }];
  db.Repondants = [{ id: 7, Email: 'titulaire@societe.test', Titulaire_aux_marches: ['L'] }];
  db.Clauses_sociales = [{ id: 5, Nom_de_la_clause: 'Insertion des restaurateurs', Beneficiaires_Actif: ['L', 'a@benef.test', 'b@benef.test'] }];
});

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('publication d’un marché', () => {
  const publie = (over: Record<string, unknown>) => ({
    Doit_Notifier_Publication: true, Clauses_sociales_parent_ou_enfants: 5, ...MARCHE_SANS_LOT, ...over,
  });

  it('marché sans lot : objet et corps sans vocabulaire de lot, clause citée', async () => {
    await ev.marchePublie([publie({ Nb_lots: 0, Lots_Detail: [] })]);
    expect(outbox.map((m) => m.to).sort()).toEqual(['a@benef.test', 'b@benef.test']);
    const mail = outbox[0]!;
    expect(mail.subject).toBe('Eclauses - un nouveau marché avec clause sociale a été publié');
    const body = text(mail.html);
    expect(body).toContain('Clause sociale : Insertion des restaurateurs');
    expect(body).not.toContain('Lots concernés');
    expect(body).not.toContain('Lots actifs');
  });

  it('marché alloti : les lots sont listés', async () => {
    await ev.marchePublie([publie({ Nb_lots: 2, Lots_Detail: [{ Lot_Label: 'Lot 1 - Maçonnerie', Clauses_sociales_Label: 'Clause A' }, { Lot_Label: 'Lot 2 - Peinture', Clauses_sociales_Label: 'Clause A' }] })]);
    const mail = outbox[0]!;
    expect(mail.subject).toContain('comprenant des lots');
    expect(text(mail.html)).toContain('Lot 2 - Peinture - Clause sociale : Clause A');
  });

  it('ne renvoie pas la notification et la note dans Grist', async () => {
    await ev.marchePublie([publie({ Nb_lots: 0 })]);
    expect(db.Marches![0]!.Ne_Doit_Pas_Notifier).toBe(true);
    await ev.marchePublie([publie({ Nb_lots: 0 })]);
    expect(outbox).toHaveLength(2);
  });

  it('sans bénéficiaire actif : aucun courrier, aucune erreur', async () => {
    db.Clauses_sociales![0]!.Beneficiaires_Actif = ['L'];
    db.Marches!.push({ id: 12, ...ACHETEUR, Intitule_propre: 'Marché sans destinataire' } as Row);
    const res = await ev.marchePublie([publie({ id: 12, Nb_lots: 0 })]);
    expect(outbox).toHaveLength(0);
    expect(res.failed).toBe(0);
  });

  it('plusieurs lignes dans le même lot de webhook : toutes sont traitées', async () => {
    db.Marches!.push({ id: 13, ...ACHETEUR, Intitule_propre: 'Autre marché' } as Row);
    await ev.marchePublie([publie({ id: 10, Nb_lots: 0 }), publie({ id: 13, Intitule_propre: 'Autre marché', Nb_lots: 0 })]);
    expect(outbox).toHaveLength(4);
  });

  it('un marché non concerné ne déclenche rien', async () => {
    await ev.marchePublie([publie({ id: 10, Doit_Notifier_Publication: false })]);
    expect(outbox).toHaveLength(0);
  });
});

describe('déclaration à valider et clause validée', () => {
  it('prévient l’acheteur une seule fois, puis de nouveau après un refus', async () => {
    const row = { ...MARCHE_SANS_LOT, id: 10, A_valider: true };
    await ev.marcheAValider([row]);
    await ev.marcheAValider([row]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe('acheteur@culture.test');
    expect(outbox[0]!.subject).toBe('Eclauses - action requise : bénéficiaire(s) à valider pour un marché que vous portez');
    expect(text(outbox[0]!.html)).toContain('Bonjour Camille Martin,');
    await ev.marcheAValider([{ ...row, A_valider: false }]); // refusée : retour à la déclaration
    await ev.marcheAValider([row]);
    expect(outbox).toHaveLength(2);
  });

  it('pour un lot, mentionne le marché et le lot', async () => {
    await ev.marcheAValider([{ ...LOT, id: 11, A_valider: true }]);
    const body = text(outbox[0]!.html);
    expect(outbox[0]!.subject).toContain('pour un lot');
    expect(body).toContain('Marché : Rénovation du musée');
    expect(body).toContain('Lot : Lot 2 - Peinture');
  });

  it('clause validée : titulaire et acheteur sont prévenus', async () => {
    await ev.marcheValidee([{ ...MARCHE_SANS_LOT, id: 10, Clause_validee: true }]);
    expect(outbox.map((m) => m.to).sort()).toEqual(['acheteur@culture.test', 'titulaire@societe.test']);
    expect(outbox.every((m) => m.subject.includes('pour un marché') || m.subject.includes('pour un marché dont'))).toBe(true);
  });
});

describe('déclarations de bénéficiaires', () => {
  it('bénéficiaire déclaré : « marché » sans lot, « lot » avec lot', async () => {
    await ev.beneficiaireDeclare([{ id: 1, Statut: 'validé', Email_envoi: 'benef@test.test', Marche: 10 }]);
    await ev.beneficiaireDeclare([{ id: 2, Statut: 'validé', Email_envoi: 'benef2@test.test', Marche: 11 }]);
    expect(outbox[0]!.subject).toBe("Eclauses - vous avez été déclaré bénéficiaire d'une clause sociale sur un marché");
    expect(text(outbox[0]!.html)).not.toContain('Lot :');
    expect(outbox[1]!.subject).toContain('sur un lot');
    expect(text(outbox[1]!.html)).toContain('Lot : Lot 2 - Peinture');
  });

  it('pas de courrier tant que la déclaration n’est pas validée', async () => {
    await ev.beneficiaireDeclare([{ id: 3, Statut: 'déclaré', Email_envoi: 'benef@test.test', Marche: 10 }]);
    expect(outbox).toHaveLength(0);
  });

  it('refus : le titulaire reçoit le motif', async () => {
    await ev.declarationRefusee([{ id: 1, Marche: 10, Raison: 'Pièces manquantes', Marche_Titulaire_Email: 'titulaire@societe.test' }]);
    expect(outbox[0]!.to).toBe('titulaire@societe.test');
    expect(text(outbox[0]!.html)).toContain('Motif du refus : Pièces manquantes');
  });

  it('consultation de coordonnées : un courrier par bénéficiaire, avec son marché', async () => {
    await ev.consultationCoordonnees([
      { id: 1, Beneficiaire__Courriel: 'a@benef.test', Marche_Intitule_propre: 'Marché A' },
      { id: 2, Beneficiaire__Courriel: 'b@benef.test', Marche_Intitule_propre: 'Marché B' },
      { id: 3, Beneficiaire__Courriel: '', Marche_Intitule_propre: 'Marché C' },
    ]);
    expect(outbox).toHaveLength(2);
    expect(text(outbox[0]!.html)).toContain('marché Marché A');
    expect(text(outbox[1]!.html)).toContain('marché Marché B');
  });
});

describe('comptes', () => {
  it('invitation d’un titulaire existant : rattachement au marché et lien de connexion', async () => {
    await ev.invitationTitulaire([{ id: 1, Marche: 10, Email: 'Titulaire@societe.test' }]);
    expect(db.Repondants![0]!.Titulaire_aux_marches).toEqual(['L', 10]);
    expect(outbox).toHaveLength(1);
    expect(text(outbox[0]!.html)).toContain('Accéder à mon espace');
    expect(db.Application_Password_Reset ?? []).toHaveLength(0);
  });

  it('invitation d’un nouveau titulaire : compte créé rattaché, lien d’activation envoyé', async () => {
    await ev.invitationTitulaire([{ id: 2, Marche: 11, Email: 'nouveau@societe.test' }]);
    const created = db.Repondants!.find((r) => r.Email === 'nouveau@societe.test')!;
    expect(created.Titulaire_aux_marches).toEqual(['L', 11]);
    expect(outbox[0]!.html).toMatch(/href="http[^"]*\/reset-password\?token=jeton-/);
    expect(db.Application_Password_Reset![0]!.create_send).toBe(true);
    // Le titulaire créé ainsi ne reçoit pas en plus le courrier d'inscription d'un candidat.
    await ev.inscriptionCandidat([created]);
    expect(outbox).toHaveLength(1);
  });

  it('inscription d’un candidat : lien pour créer le mot de passe', async () => {
    await ev.inscriptionCandidat([{ id: 50, Email: 'candidat@societe.test', Titulaire_aux_marches: ['L'] }]);
    expect(outbox[0]!.subject).toBe('Eclauses - Finalisez votre inscription');
    expect(outbox[0]!.html).toContain('/reset-password?token=jeton-');
  });

  it('mot de passe oublié : seulement pour un compte existant et une vraie demande', async () => {
    await ev.motDePasseOublie([
      { id: 1, Email: 'a@x.test', Token: 'tok-1', Is_Reset: true, Existe: false },
      { id: 2, Email: 'b@x.test', Token: 'tok-2', Is_Reset: false, Existe: true },
      { id: 3, Email: 'c@x.test', Token: 'tok-3', Is_Reset: true, Existe: true },
    ]);
    expect(outbox.map((m) => m.to)).toEqual(['c@x.test']);
    expect(outbox[0]!.html).toContain('/reset-password?token=tok-3');
  });
});
