import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supportRequest } from '@/server/mail/templates';
import { sendMail } from '@/server/mail/transport';
import { safeFileName } from '@/server/cv';
import { assertSameOrigin, clientIp, formDataLimite, handle, HttpError, rateLimit } from '@/server/http';

const body = z.object({
  nom: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(5000),
});

const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods']);

/** Formulaire du centre d'aide : un courrier à l'équipe (avec pièce jointe facultative), limité en débit. */
export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await rateLimit(`support:${clientIp(req)}`, 5, 15 * 60_000);

    const form = await formDataLimite(req, ATTACHMENT_MAX_BYTES + 64 * 1024);
    const parsed = body.safeParse({ nom: form?.get('nom'), email: form?.get('email'), message: form?.get('message') });
    if (!form || !parsed.success) throw new HttpError(400, 'Merci de renseigner votre nom, votre e-mail et votre message.');
    const { nom, email, message } = parsed.data;

    const attachments: { filename: string; content: Buffer }[] = [];
    const file = form.get('piece_jointe');
    if (file instanceof File && file.size > 0) {
      const filename = safeFileName(file.name);
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      if (file.size > ATTACHMENT_MAX_BYTES) throw new HttpError(413, 'La pièce jointe dépasse 5 Mo.');
      if (!ATTACHMENT_EXTENSIONS.has(ext)) throw new HttpError(422, 'Type de pièce jointe non autorisé.');
      attachments.push({ filename, content: Buffer.from(await file.arrayBuffer()) });
    }

    await sendMail({
      to: process.env.SUPPORT_TO ?? 'contact@eclauses.beta.gouv.fr',
      replyTo: email,
      attachments,
      ...supportRequest(nom, email, message),
    });
    return NextResponse.json({ ok: true });
  });
}
