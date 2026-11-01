'use server';

import { cookies } from 'next/headers';
import { confirmerActivation, demarrerActivation, verifier } from '../admin/mfa';
import { auditer } from '../admin/audit';
import { markMfaValidated, SESSION_COOKIE } from '../auth/session';
import { HttpError, requireSession } from '../http';
import { attempt, type ActionResult } from './result';

/** Seconde étape de connexion des administrateurs (code de l'application d'authentification ou code de secours). */

async function admin() {
  const s = await requireSession();
  if (!s.roles.includes('admin')) throw new HttpError(403, 'Accès refusé.');
  return s;
}
const token = async () => (await cookies()).get(SESSION_COOKIE)?.value;

export async function demarrerMfa(): Promise<ActionResult<{ secret: string; qrSvg: string }>> {
  return attempt(async () => demarrerActivation((await admin()).email));
}

export async function confirmerMfa(code: string): Promise<ActionResult<{ codesSecours: string[] }>> {
  return attempt(async () => {
    const s = await admin();
    const res = await confirmerActivation(s.email, code);
    await markMfaValidated(await token());
    await auditer({ ...s, mfa: true }, 'mfa.activation', 'utilisateur', null);
    return res;
  });
}

export async function verifierMfa(code: string): Promise<ActionResult<null>> {
  return attempt(async () => {
    const s = await admin();
    await verifier(s.email, code);
    await markMfaValidated(await token());
    await auditer({ ...s, mfa: true }, 'mfa.verification', 'utilisateur', null);
    return null;
  });
}
