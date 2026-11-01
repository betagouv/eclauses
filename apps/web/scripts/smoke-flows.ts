/**
 * Parcours « lien reçu par courrier » contre une instance démarrée et le document DEV : demande de
 * mot de passe oublié, vérification du lien, définition du mot de passe, lien à usage unique.
 * Les courriers sont journalisés (MAIL_TRANSPORT=log) ; les lignes créées sont supprimées à la fin.
 */
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile('.env.local');
process.env.MAIL_TRANSPORT = 'log';
const base = process.env.BASE_URL ?? 'http://localhost:3100';
const origin = new URL(base).origin;
const g = new GristClient({ baseUrl: process.env.GRIST_BASE_URL!, docId: process.env.GRIST_DOC_ID!, apiKey: process.env.GRIST_API_KEY! });

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const ip = () => `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const call = async (method: string, path: string, json?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ip() },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
};

const created: { table: string; id: number }[] = [];
try {
  // Mot de passe oublié pour un compte existant : la demande est créée, Grist calcule jeton et type.
  const email = process.env.PROTO_ACHETEUR_EMAIL!;
  const asked = await call('POST', '/api/data/Application_Password_Reset', { Email: email });
  check('demande de mot de passe oublié acceptée', asked.status === 200 && asked.body?.id > 0);
  created.push({ table: 'Application_Password_Reset', id: asked.body.id });
  const [row] = await g.records('Application_Password_Reset', { filter: { id: [asked.body.id] } });
  check('Grist calcule le jeton, le type « reset » et l’existence du compte', !!row?.Token && row.Type === 'reset' && row.Existe === true, `Type ${row?.Type}, Existe ${row?.Existe}`);

  // Le gestionnaire d'événement envoie le lien vers cette application.
  const { motDePasseOublie } = await import('../src/server/events/handlers');
  const { outbox } = await import('../src/server/mail/transport');
  await motDePasseOublie([row!]);
  check('courrier de réinitialisation préparé avec un lien vers l’application', outbox.length === 1 && outbox[0]!.html.includes(`/reset-password?token=${row!.Token}`));

  // Vérification du lien, puis choix du mot de passe.
  const token = String(row!.Token);
  const check1 = await call('GET', `/api/auth/reset?token=${token}`);
  check('lien valide, adresse masquée', check1.body?.valid === true && check1.body?.type === 'reset' && /\*/.test(check1.body?.email ?? ''), check1.body?.email);
  check('jeton inconnu : invalide', (await call('GET', `/api/auth/reset?token=${'0'.repeat(36)}`)).body?.valid === false);
  check('mot de passe trop court refusé (400)', (await call('POST', '/api/auth/reset', { token, password: 'court' })).status === 400);
  check('jeton inconnu refusé (400)', (await call('POST', '/api/auth/reset', { token: '0'.repeat(36), password: 'Un mot de passe valide 1' })).status === 400);

  const [before] = await g.sql<{ Hash_Password: string }>('SELECT Hash_Password FROM Application_AuthUser WHERE lower(Email) = ?1', [email]);
  const newPassword = 'Nouveau mot de passe 42!';
  const done = await call('POST', '/api/auth/reset', { token, password: newPassword });
  check('mot de passe défini', done.status === 200 && done.body?.status === 'ok');
  const [after] = await g.sql<{ Hash_Password: string }>('SELECT Hash_Password FROM Application_AuthUser WHERE lower(Email) = ?1', [email]);
  check('nouveau hachage scrypt enregistré', after!.Hash_Password.startsWith('scrypt$') && after!.Hash_Password !== before!.Hash_Password);
  check('connexion avec le nouveau mot de passe', (await call('POST', '/api/auth/login', { email, password: newPassword })).status === 200);
  check('ancien mot de passe refusé', (await call('POST', '/api/auth/login', { email, password: process.env.PROTO_ACHETEUR_PASSWORD })).status === 401);

  const reuse = await call('POST', '/api/auth/reset', { token, password: 'Autre mot de passe 43!' });
  check('lien à usage unique : second usage refusé (400)', reuse.status === 400, reuse.body?.message);
  const again = await call('GET', `/api/auth/reset?token=${token}`);
  check('lien utilisé : signalé comme tel', again.body?.used === true && again.body?.valid === false);

  // Remet le mot de passe d'origine du compte de test pour ne pas casser les autres scénarios.
  const { hashPassword } = await import('../src/server/auth/password');
  await g.updateRecords('Application_AuthUser', [
    { id: (await g.sql<{ id: number }>('SELECT id FROM Application_AuthUser WHERE lower(Email) = ?1', [email]))[0]!.id, fields: { Hash_Password: await hashPassword(process.env.PROTO_ACHETEUR_PASSWORD!) } },
  ]);
  check('mot de passe de test restauré', (await call('POST', '/api/auth/login', { email, password: process.env.PROTO_ACHETEUR_PASSWORD })).status === 200);

  // Support : validation et limitation de débit.
  const bad = await fetch(`${base}/api/support/contact`, { method: 'POST', headers: { origin, 'x-forwarded-for': ip() }, body: new FormData() });
  check('support : formulaire vide refusé (400)', bad.status === 400);
  const form = new FormData();
  form.append('nom', 'Test'); form.append('email', 'test@example.test'); form.append('message', 'Bonjour <b>équipe</b>');
  form.append('piece_jointe', new File([new Uint8Array([37, 80, 68, 70])], 'note.pdf'));
  const ok = await fetch(`${base}/api/support/contact`, { method: 'POST', headers: { origin, 'x-forwarded-for': ip() }, body: form });
  check('support : demande avec pièce jointe acceptée', ok.status === 200);
  const exe = new FormData();
  exe.append('nom', 'Test'); exe.append('email', 'test@example.test'); exe.append('message', 'x');
  exe.append('piece_jointe', new File([new Uint8Array([77, 90])], 'virus.exe'));
  check('support : pièce jointe .exe refusée (422)', (await fetch(`${base}/api/support/contact`, { method: 'POST', headers: { origin, 'x-forwarded-for': ip() }, body: exe })).status === 422);

  // Vérification d'un candidat : adresse inconnue.
  const unknown = await call('POST', '/api/candidats/check', { email: 'jamais.vu@example.test', lotIds: [85] });
  check('candidat inconnu : « new »', unknown.body?.status === 'new');
  check('candidat : e-mail invalide refusé (400)', (await call('POST', '/api/candidats/check', { email: 'pas-un-mail' })).status === 400);
} finally {
  for (const { table, id } of created.reverse()) await g.deleteRecords(table, [id]).catch(() => undefined);
}

console.log(failures ? `\n${failures} échec(s)` : '\nTous les contrôles passent');
process.exit(failures ? 1 : 0);
