import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: number } & Record<string, unknown>;
const db: Record<string, Row[]> = {};
const log: string[] = [];

const fake = {
  records: async (table: string, opts: { filter?: Record<string, unknown[]> } = {}) =>
    structuredClone(
      (db[table] ?? []).filter((r) => Object.entries(opts.filter ?? {}).every(([k, v]) => (v as unknown[]).includes(r[k]))),
    ),
  updateRecords: async (table: string, rows: { id: number; fields: Record<string, unknown> }[]) => {
    for (const { id, fields } of rows) {
      Object.assign(db[table]!.find((r) => r.id === id)!, fields);
      log.push(`update ${table}#${id}`);
    }
  },
  deleteRecords: async (table: string, ids: number[]) => {
    db[table] = (db[table] ?? []).filter((r) => !ids.includes(r.id));
    log.push(`delete ${table}#${ids.join(',')}`);
  },
  // Colonnes du schéma : tout est modifiable dans ce faux document.
  columns: async (table: string) =>
    Object.keys(Object.assign({}, ...(db[table] ?? []))).map((id) => ({ id, type: 'Text', isFormula: false })),
};
vi.mock('@/server/config', () => ({ grist: () => fake, config: () => ({}) }));
const { JOBS } = await import('@/server/jobs');

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  log.length = 0;
});

describe('tâches de conservation des données', () => {
  it('anonymise un bénéficiaire à supprimer et efface ses données personnelles', async () => {
    db.Beneficiaires = [
      { id: 1, NOM: 'Durand', Prenom: 'Léa', Courriel: 'lea@x.test', Telephone: '06', curriculum_vitae: ['L', 9], Autres_informations: 'x', Doit_supprimer: true },
      { id: 2, NOM: 'Martin', Prenom: 'Paul', Courriel: 'paul@x.test', Doit_supprimer: false },
    ];
    for (const c of ['Formation', 'Annee_de_diplome', 'Specialite_ecole', 'Specialite', 'Sous_specialite', 'Intitule_du_memoire', 'Departement_de_residence', 'Regions_ou_vous_etes_mobile', 'Date_de_suppression']) db.Beneficiaires[0]![c] = 'x';
    const res = await JOBS['anonymise-beneficiaires']!();
    expect(res.processed).toBe(1);
    const row = db.Beneficiaires![0]!;
    expect(row.NOM).toBe('Beneficiaire #1');
    expect(row.Courriel).toBeNull();
    expect(row.Prenom).toBeNull();
    expect(row.curriculum_vitae).toBeNull();
    expect(typeof row.Date_de_suppression).toBe('string');
    expect(db.Beneficiaires![1]!.NOM).toBe('Martin');
  });

  it('anonymise un répondant à supprimer et supprime son compte de connexion', async () => {
    db.Repondants = [{ id: 7, Nom: 'Société', Email: 's@x.test', Telephone: '0', Raison_sociale: 'S', Siret: '1', Prenom: 'A', Date_de_suppression: null, Doit_supprimer: true, Account: 40 }];
    db.Application_AuthUser = [{ id: 40, Email: 's@x.test' }, { id: 41, Email: 'autre@x.test' }];
    await JOBS['anonymise-repondants']!();
    expect(db.Repondants![0]!.Email).toBeNull();
    expect(db.Application_AuthUser!.map((u) => u.id)).toEqual([41]);
  });

  it('supprime les comptes des bénéficiaires devenus non éligibles', async () => {
    db.Beneficiaires = [{ id: 1, Eligible: false, Account: 50 }, { id: 2, Eligible: false, Account: 0 }];
    db.Application_AuthUser = [{ id: 50 }, { id: 51 }];
    const res = await JOBS['delete-ineligible-accounts']!();
    expect(res.processed).toBe(1);
    expect(db.Application_AuthUser!.map((u) => u.id)).toEqual([51]);
  });

  it('archive uniquement les marchés validés à archiver', async () => {
    db.Marches = [
      { id: 1, Doit_archiver: true, Statut: 'Clause validée' },
      { id: 2, Doit_archiver: true, Statut: 'En attente de publication' },
    ];
    const res = await JOBS['archive-marches']!();
    expect(res.processed).toBe(1);
    expect(db.Marches![0]!.Statut).toBe('Archivé');
    expect(db.Marches![1]!.Statut).toBe('En attente de publication');
  });

  it('purge les demandes de lien expirées', async () => {
    db.Application_Password_Reset = [{ id: 1, Expire: true }, { id: 2, Expire: false }];
    const res = await JOBS['purge-resets']!();
    expect(res.processed).toBe(1);
    expect(db.Application_Password_Reset!.map((r) => r.id)).toEqual([2]);
  });
});
