'use server';

import { headers } from 'next/headers';
import { clientIp, HttpError, rateLimit } from '../http';
import { consommerJeton } from '../services/comptes';
import { inscrireCandidat, verifierCandidat } from '../services/candidats';
import { motDePasseOublie } from '../services/notifications';
import { attempt, type ActionResult } from './result';

/**
 * Actions des pages publiques (sans session) : chacune est limitée en débit par adresse IP, comme les routes
 * HTTP équivalentes, et ne révèle jamais si une adresse e-mail a un compte (sauf la vérification d'inscription,
 * qui doit le dire pour éviter un doublon).
 */

async function limiter(action: string, max: number, windowMs = 15 * 60_000) {
  await rateLimit(`${action}:${clientIp(new Request('http://x', { headers: await headers() }))}`, max, windowMs);
}

export async function demanderReinitialisation(email: string): Promise<ActionResult<null>> {
  return attempt(async () => {
    await limiter('forgot', 5);
    const value = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 320) throw new HttpError(400, 'Adresse e-mail invalide.');
    await motDePasseOublie(value);
    return null;
  });
}

export async function definirMotDePasse(token: string, motDePasse: string): Promise<ActionResult<null>> {
  return attempt(async () => {
    await limiter('reset', 10);
    if (typeof motDePasse !== 'string' || motDePasse.length < 8 || motDePasse.length > 200) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (!(await consommerJeton(String(token ?? '').trim(), motDePasse))) throw new HttpError(400, 'Lien invalide ou expiré.');
    return null;
  });
}

export async function verifierEmailCandidat(email: string, marcheIds: number[]): Promise<ActionResult<'new' | 'exist'>> {
  return attempt(async () => {
    await limiter('candidat-check', 20);
    return verifierCandidat({ email, marcheIds });
  });
}

export async function inscrire(input: unknown): Promise<ActionResult<null>> {
  return attempt(async () => {
    await limiter('inscription', 10, 10 * 60_000);
    await inscrireCandidat(input);
    return null;
  });
}
