import { describe, expect, it } from 'vitest';


const { stripInternal, redact, isVisibleToOthers, CONSENT_ANNUAIRE, CONSENT_CONTACT } = await import('@/server/beneficiaires');

const base = {
  id: 1,
  NOM: 'Durand',
  Courriel: 'a@b.fr',
  Telephone: '0102030405',
  Commentaire: 'note interne',
  Missions_proposees: 'm',
  Eligible: true,
  Doit_supprimer: false,
};

describe('politique Beneficiaires', () => {
  it('retire les colonnes internes', () => {
    const row = stripInternal({ ...base });
    expect(row).not.toHaveProperty('Commentaire');
    expect(row).not.toHaveProperty('Missions_proposees');
    expect(row.NOM).toBe('Durand');
  });

  it('masque les coordonnées sans consentement au contact', () => {
    const row = redact({ ...base, [CONSENT_CONTACT]: false });
    expect(row).not.toHaveProperty('Courriel');
    expect(row).not.toHaveProperty('Telephone');
    expect(redact({ ...base, [CONSENT_CONTACT]: true })).toHaveProperty('Courriel');
  });

  it("n'expose aux autres que les fiches consentantes, éligibles et non supprimées", () => {
    expect(isVisibleToOthers({ ...base, [CONSENT_ANNUAIRE]: true })).toBe(true);
    expect(isVisibleToOthers({ ...base, [CONSENT_ANNUAIRE]: false })).toBe(false);
    expect(isVisibleToOthers({ ...base, [CONSENT_ANNUAIRE]: true, Eligible: false })).toBe(false);
    expect(isVisibleToOthers({ ...base, [CONSENT_ANNUAIRE]: true, Doit_supprimer: true })).toBe(false);
  });
});
