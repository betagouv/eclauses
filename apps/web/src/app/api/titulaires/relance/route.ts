import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createActivation, markActivationSent, resetUrl } from '@/server/accounts';
import { grist } from '@/server/config';
import { loadMarcheInfo } from '@/server/mail/describe';
import { titulaireRelance } from '@/server/mail/templates';
import { sendMail } from '@/server/mail/transport';
import { assertSameOrigin, handle, HttpError, requireSession } from '@/server/http';
import { assertOwnMarche, num } from '@/server/policies/common';

const body = z.object({ lot_id: z.number().int().positive().optional(), marche_id: z.number().int().positive().optional() });

/**
 * Relance d'un titulaire qui n'a pas déclaré ses bénéficiaires. Réservée à l'acheteur du marché.
 * Si le titulaire n'a pas encore de compte, la relance contient un lien d'activation valable 30 jours.
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

    const [invitation] = await grist().records('Invitation_Titulaire', { filter: { Marche: [marcheId] }, limit: 1 });
    if (!invitation) throw new HttpError(404, 'Aucun titulaire déclaré pour ce marché.');
    const info = await loadMarcheInfo(marcheId);
    if (!info) throw new HttpError(404, 'Marché introuvable.');
    const to = String(invitation.Email ?? '').trim();

    // Compte déjà activé (AuthUser) : simple relance avec lien de connexion.
    const hasAccount = num(invitation.AuthUser) > 0;
    if (hasAccount) {
      await sendMail({ to, ...titulaireRelance(info, null) });
      return NextResponse.json({ ok: true });
    }

    // Pas de compte : réutiliser la demande d'activation existante (prolongée de 30 jours) ou en créer une.
    const existingId = num(invitation.Application_Password_Reset);
    let url: string;
    let activationId: number;
    if (existingId) {
      const [reset] = await grist().records('Application_Password_Reset', { filter: { id: [existingId] } });
      await grist().updateRecords('Application_Password_Reset', [
        { id: existingId, fields: { Expire_le: Math.floor(Date.now() / 1000) + 30 * 86400 } },
      ]);
      url = resetUrl(String(reset?.Token ?? ''));
      activationId = existingId;
    } else {
      ({ id: activationId, url } = await createActivation(to));
    }
    await sendMail({ to, ...titulaireRelance(info, url) });
    await markActivationSent(activationId);
    return NextResponse.json({ ok: true });
  });
}
