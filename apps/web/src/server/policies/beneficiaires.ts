import { readBeneficiaires, updateOwnProfile } from '../beneficiaires';
import { requireActor, requireRole } from './common';
import type { TablePolicy } from './types';

export const beneficiaires: TablePolicy = {
  async read(actor, { ids }) {
    return readBeneficiaires(requireActor(actor), ids);
  },
  async update(actor, id, fields) {
    await updateOwnProfile(requireRole(actor, 'beneficiaire'), id, fields);
  },
};
