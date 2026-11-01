/** Adresse d'un fichier (CV) servi par l'application après contrôle des droits. */
export const attachmentUrl = (id: number | string): string => `/api/attachments/${id}`;
