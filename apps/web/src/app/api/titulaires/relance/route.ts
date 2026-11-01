import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '@/server/db/client';
import { invitationsTitulaires } from '@/server/db/schema';
import { loadMarcheInfo } from '@/server/mail/describe';
import { titulaireRelance } from '@/server/mail/templates';
import { sendMail } from '@/server/mail/transport';
import { assertSameOrigin, handle, HttpError, requireSession } from '@/server/http';
import { assertOwnMarche } from '@/server/policies/common';
import { creerJeton, utilisateurParEmail } from '@/server/services/comptes';

const body = z.object({ lot_id: z.number().int().positive().optional(), marche_id: z.number().int().positive().optional() });

/**
 * Relance d'un titulaire qui n'a pas déclaré ses bénéficiaires. Réservée à l'acheteur du marché.
 * Si le titulaire n'a pas encore activé son compte, la relance contient un nouveau lien d'activation
 * (valable 30 jours, l'ancien est révoqué).
 */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requireSession();
    if (!session.roles.includes('acheteur')) throw new HttpError(403, 'Accès refusé.');
    const parsed = body.safeParse(await req.json().catch(() => null));
    const marcheId = parsed.success ? (parsed.data.lot_id ?? parsed.data.marche_id) : undefined;
    if (!marcheId) throw new HttpError(400, 'Marché manquant.');
    await assertOwnMarche(session, marcheId);

    const [invitation] = await database().select().from(invitationsTitulaires).where(eq(invitationsTitulaires.marcheId, marcheId)).orderBy(asc(invitationsTitulaires.id)).limit(1);
    if (!invitation) throw new HttpError(404, 'Aucun titulaire déclaré pour ce marché.');
    const info = await loadMarcheInfo(marcheId);
    if (!info) throw new HttpError(404, 'Marché introuvable.');

    const user = await utilisateurParEmail(invitation.email);
    let url: string | null = null;
    if (!user?.motDePasseHash) {
      if (!user) throw new HttpError(404, 'Compte du titulaire introuvable.');
      url = (await creerJeton(user.id, 'activation')).url;
    }
    await sendMail({ to: invitation.email, ...titulaireRelance(info, url) });
    return NextResponse.json({ ok: true });
  });
}
