import nodemailer, { type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

/** Courriers « envoyés » en mode journal (développement et tests). */
export const outbox: Mail[] = [];

let transporter: Transporter | undefined;

function smtp(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

const FROM = () => process.env.MAIL_FROM || 'Eclauses - Ministère de la Culture <contact@eclauses.beta.gouv.fr>';

/**
 * Envoie un courrier. `MAIL_TRANSPORT=smtp` pour un vrai envoi (Scaleway Transactional Email, par
 * exemple) ; par défaut, le courrier est seulement journalisé et conservé en mémoire.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(mail.to)) throw new Error(`Destinataire invalide : ${mail.to}`);
  if (process.env.MAIL_TRANSPORT === 'smtp') {
    await smtp().sendMail({ from: FROM(), ...mail });
    return;
  }
  outbox.push(mail);
  if (outbox.length > 200) outbox.shift();
  console.info(`[mail:journal] à ${mail.to} — ${mail.subject}`);
}
