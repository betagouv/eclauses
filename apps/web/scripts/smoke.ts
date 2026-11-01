/**
 * Parcours de bout en bout contre une instance démarrée (par défaut http://localhost:3100) et la base locale remplie
 * par `seed-dev.ts` : pages rendues par le serveur (contenu dans le HTML), droits par rôle, redirections, CV, lien de
 * réinitialisation, révocation des sessions, limiteur de débit, tâches planifiées. Les écritures se limitent aux
 * comptes de démonstration.
 */
import { createDatabase } from '../src/server/db/client';
import { creerJeton, utilisateurParEmail } from '../src/server/services/comptes';

process.loadEnvFile('.env.local');
const base = process.env.BASE_URL ?? 'http://localhost:3100';
const origin = new URL(base).origin;
const { sql: pg } = createDatabase(process.env.DATABASE_URL!, { max: 2 });
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

class Client {
  cookie = '';
  async call(path: string, init: RequestInit & { json?: unknown; noOrigin?: boolean } = {}) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.cookie) headers.cookie = this.cookie;
    if (!init.noOrigin && init.method && init.method !== 'GET') headers.origin = origin;
    let body = init.body;
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.json);
    }
    const res = await fetch(base + path, { ...init, headers, body, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set?.includes('eclauses_session=')) this.cookie = set.split(';')[0]!;
    return res;
  }
  login(email: string, password: string) {
    return this.call('/api/auth/login', { method: 'POST', json: { email, password } });
  }
  /** Page rendue : statut, redirection éventuelle et texte du HTML brut (sans JavaScript). */
  async page(path: string) {
    const res = await this.call(path);
    return { status: res.status, location: res.headers.get('location') ?? '', html: res.status === 200 ? await res.text() : '' };
  }
}

const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n'), Buffer.from('trailer<</Root 1 0 R>>\n%%EOF\n')]);
const upload = (name: string, bytes: Buffer) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }));
  return form;
};
const pw = (k: string) => process.env[k]!;
const redirectsTo = (p: { status: number; location: string }, target: string) => p.status === 307 && new URL(p.location, base).pathname + new URL(p.location, base).search === target;

// --- Visiteur --------------------------------------------------------------------------------
const anon = new Client();
check('santé', (await anon.call('/api/health')).status === 200);
const accueil = await anon.page('/');
check('accueil : contenu dans le HTML', accueil.status === 200 && accueil.html.includes('Bienvenue sur'));
for (const path of ['/cgu', '/mentions-legales', '/donnees-personnelles', '/accessibilite', '/apropos', '/statistiques', '/support', '/login', '/mot-de-passe-oublie', '/support-contact']) {
  const p = await anon.page(path);
  check(`page publique ${path} : 200 avec contenu`, p.status === 200 && p.html.includes('<h1'));
}
const faq = await anon.page('/support');
check('FAQ publiée dans le HTML', faq.html.includes('Foire aux questions') && (faq.html.match(/fr-accordion/g)?.length ?? 0) > 1);
for (const path of ['/beneficiaire-profil', '/acheteur-marches', '/repondant-marches']) check(`${path} sans session : redirigé vers la connexion`, redirectsTo(await anon.page(path), `/login?next=${path.slice(1)}`));
check('anciens liens « ?page= » redirigés', redirectsTo(await anon.page('/?page=inscription-candidat&marche=7'), '/inscription-candidat?marche=7'));
check('l’API générique de données n’existe plus (404)', (await anon.call('/api/data/Beneficiaires')).status === 404);
check('mauvais mot de passe : 401', (await anon.login('demo.beneficiaire@example.test', 'faux')).status === 401);
check('compte inconnu : même réponse', (await anon.login('inconnu@example.org', 'x')).status === 401);
check('POST sans Origin refusé (CSRF)', (await anon.call('/api/auth/login', { method: 'POST', json: { email: 'a@b.fr', password: 'x' }, noOrigin: true })).status === 403);
const noToken = await anon.page('/reset-password?token=inventé-inventé-inventé');
check('lien de réinitialisation invalide : message, pas de formulaire', noToken.html.includes('Lien invalide ou expiré') && !noToken.html.includes('type="password"'));

// --- Bénéficiaire ----------------------------------------------------------------------------
const b = new Client();
const loginB = await b.login('demo.beneficiaire@example.test', pw('SEED_BENEFICIAIRE_PASSWORD'));
const me = (await loginB.json()) as { roles: string[]; beneficiaireId: number };
check('connexion bénéficiaire', loginB.status === 200 && me.roles.includes('beneficiaire'));
check('connecté : la page de connexion renvoie à l’accueil', redirectsTo(await b.page('/login'), '/'));
const profil = await b.page('/beneficiaire-profil');
check('profil : fiche dans le HTML, sans champ interne', profil.html.includes('demo.beneficiaire@example.test') && !profil.html.includes('Missions_proposees'));
const annuaire = await b.page('/beneficiaire-annuaire');
check('annuaire : la fiche discrète (sans consentement) est absente du HTML', annuaire.status === 200 && !annuaire.html.includes('DISCRET'));
check('une page d’un autre espace est refusée', (await b.page('/acheteur-marches')).status === 307);
const marchesB = await b.page('/beneficiaire-marches');
check('marchés : contenu dans le HTML', marchesB.status === 200 && marchesB.html.includes('Marchés actifs'));

const up = await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'POST', body: upload('mon cv.pdf', pdf) });
const cvId = ((await up.json()) as { attachmentId?: string }).attachmentId;
check('dépôt du CV', up.status === 200 && !!cvId);
const dl = await b.call(`/api/attachments/${cvId}`);
check('lecture du CV, contenu identique', dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(pdf) && dl.headers.get('x-content-type-options') === 'nosniff');
check('exécutable renommé refusé (422)', (await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'POST', body: upload('virus.pdf', Buffer.from('MZ\x90\x00 pas un pdf')) })).status === 422);
check('CV sans session : 401', (await anon.call(`/api/attachments/${cvId}`)).status === 401);
check('le profil affiche le lien du CV', (await b.page('/beneficiaire-profil')).html.includes(`/api/attachments/${cvId}`));
check('suppression du CV', (await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'DELETE' })).status === 200 && (await b.call(`/api/attachments/${cvId}`)).status === 404);

// --- Acheteur --------------------------------------------------------------------------------
const a = new Client();
const loginA = await a.login('demo.acheteur@example.test', pw('SEED_ACHETEUR_PASSWORD'));
check('connexion acheteur', loginA.status === 200 && ((await loginA.json()) as { roles: string[] }).roles.includes('acheteur'));
const marchesA = await a.page('/acheteur-marches');
check('acheteur : ses marchés dans le HTML', marchesA.html.includes('Restauration du château') && marchesA.html.includes('Entretien des vitraux'));
const [mine] = await pg`select id from marches where intitule = 'Restauration du château' and parent_id is null`;
check('détail d’un de ses marchés', (await a.page(`/acheteur-marches-detail?id=${mine!.id}`)).html.includes('Restauration du château'));
const [autre] = await pg`insert into acheteurs (nom) values ('Entité étrangère (smoke)') returning id`;
const [etranger] = await pg`insert into marches (acheteur_id, intitule, statut) values (${autre!.id}, 'Marché étranger (smoke)', 'en_attente_publication') returning id`;
const refus = await a.page(`/acheteur-marches-detail?id=${etranger!.id}`);
check('détail d’un marché d’une autre entité : refusé', refus.html.includes('non rattaché à votre entité') && !refus.html.includes('Marché étranger'));
await pg`delete from marches where id = ${etranger!.id}`;
await pg`delete from acheteurs where id = ${autre!.id}`;
check('un acheteur n’accède pas à l’espace répondant', (await a.page('/repondant-marches')).status === 307);

// --- Répondant -------------------------------------------------------------------------------
const r = new Client();
const loginR = await r.login('demo.repondant@example.test', pw('SEED_REPONDANT_PASSWORD'));
check('connexion répondant', loginR.status === 200 && ((await loginR.json()) as { roles: string[] }).roles.includes('repondant'));
const marchesR = await r.page('/repondant-marches');
check('répondant : ses marchés dans le HTML', marchesR.status === 200 && marchesR.html.includes('Mes marchés'));
const recherches = await r.page('/repondant-recherches');
check('recherche : aucune coordonnée de bénéficiaire dans le HTML (livrées seulement par l’action de consultation)', recherches.status === 200 && !recherches.html.includes('demo.beneficiaire@example.test') && !recherches.html.includes('demo.discret@example.test'));

// --- Lien de réinitialisation ---------------------------------------------------------------
const user = await utilisateurParEmail('demo.discret@example.test');
const stale = new Client();
await stale.login('demo.discret@example.test', pw('SEED_DISCRET_PASSWORD'));
const { jeton } = await creerJeton(user!.id, 'reinitialisation');
const state = await (await anon.call(`/api/auth/reset?token=${jeton}`)).json();
check('lien valide reconnu', state.valid === true && state.type === 'reset');
check('la page affiche le formulaire de mot de passe', (await anon.page(`/reset-password?token=${jeton}`)).html.includes('type="password"'));
check('mot de passe trop court refusé', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: 'court' } })).status === 400);
const newPassword = `Nouveau-${Date.now()}`;
check('nouveau mot de passe accepté', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: newPassword } })).status === 200);
check('lien à usage unique', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: newPassword } })).status === 400);
const meOf = async (c: Client) => ((await (await c.call('/api/auth/me')).json()) as { session: unknown }).session;
check('session ouverte avant la réinitialisation fermée par le nouveau mot de passe', (await meOf(stale)) === null);
check('connexion avec le nouveau mot de passe', (await new Client().login('demo.discret@example.test', newPassword)).status === 200);
const { hashPassword } = await import('../src/server/auth/password');
await pg`update utilisateurs set mot_de_passe_hash = ${await hashPassword(pw('SEED_DISCRET_PASSWORD'))} where id = ${user!.id}`;

// --- Déconnexion et limiteur ------------------------------------------------------------------
const out = new Client();
await out.login('demo.beneficiaire@example.test', pw('SEED_BENEFICIAIRE_PASSWORD'));
const keep = out.cookie;
check('session valide avant déconnexion', (await meOf(out)) !== null);
await out.call('/api/auth/logout', { method: 'POST' });
const replay = new Client();
replay.cookie = keep;
check('cookie rejoué après déconnexion : refusé (révocation serveur)', (await meOf(replay)) === null);
const brute = new Client();
let blocked = 0;
for (let i = 0; i < 10; i++) if ((await brute.login('victime@example.org', `essai-${i}`)).status === 429) blocked++;
check('trop d’essais de connexion : limité (429)', blocked > 0, `${blocked} refus`);
await pg`delete from limites_debit`;

// --- Tâches planifiées -----------------------------------------------------------------------
check('tâches sans secret : 401', (await anon.call('/api/jobs/all', { method: 'POST' })).status === 401);
const jobs = await anon.call('/api/jobs/all', { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
check('tâches avec secret', jobs.status === 200);

await pg.end();
console.log(failures ? `\n${failures} échec(s)` : '\nTout est conforme.');
process.exit(failures ? 1 : 0);
