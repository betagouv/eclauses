/**
 * Parcours de bout en bout contre une instance démarrée (par défaut http://localhost:3100) et la base
 * locale remplie par `seed-dev.ts` : connexion, rôles, droits de lecture et d'écriture, CV, lien de
 * réinitialisation. Les écritures se limitent aux comptes de démonstration.
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
  async data<T = Record<string, unknown>>(table: string, query = ''): Promise<{ status: number; rows: T[] }> {
    const res = await this.call(`/api/data/${table}${query}`);
    return { status: res.status, rows: res.ok ? ((await res.json()) as T[]) : [] };
  }
}

const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n'), Buffer.from('trailer<</Root 1 0 R>>\n%%EOF\n')]);
const upload = (name: string, bytes: Buffer) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }));
  return form;
};
const pw = (k: string) => process.env[k]!;

// --- Visiteur --------------------------------------------------------------------------------
const anon = new Client();
check('santé', (await anon.call('/api/health')).status === 200);
check('Beneficiaires sans session : 401', (await anon.data('Beneficiaires')).status === 401);
check('table non exposée : 403', (await anon.data('Application_AuthUser')).status === 403);
const publics = await anon.data<{ Statut?: string; Titulaire?: unknown }>('Marches');
check('visiteur : marchés publiés, sans statut ni titulaire', publics.rows.length > 0 && publics.rows.every((m) => !('Statut' in m) && !('Titulaire' in m)), `${publics.rows.length} marché(s)`);
check('FAQ publiée lisible sans session', (await anon.data('Application_FAQ_Categories')).rows.length > 0);
const impacts = await anon.data<{ Valeur: string }>('Impacts');
check('indicateurs calculés', impacts.rows.length > 0 && impacts.rows.every((i) => i.Valeur !== undefined));
check('mauvais mot de passe : 401', (await anon.login('demo.beneficiaire@example.test', 'faux')).status === 401);
check('compte inconnu : même réponse', (await anon.login('inconnu@example.org', 'x')).status === 401);
check('POST sans Origin refusé (CSRF)', (await anon.call('/api/auth/login', { method: 'POST', json: { email: 'a@b.fr', password: 'x' }, noOrigin: true })).status === 403);

// --- Bénéficiaire ----------------------------------------------------------------------------
const b = new Client();
const loginB = await b.login('demo.beneficiaire@example.test', pw('SEED_BENEFICIAIRE_PASSWORD'));
const me = (await loginB.json()) as { roles: string[]; beneficiaireId: number };
check('connexion bénéficiaire', loginB.status === 200 && me.roles.includes('beneficiaire'));
const dir = (await b.data<Record<string, unknown>>('Beneficiaires')).rows;
const own = dir.find((r) => r.id === me.beneficiaireId)!;
check('sa fiche est lisible, sans champs internes', !!own && !('Commentaire' in own) && !('Missions_proposees' in own));
check('annuaire : aucune fiche non consentante', dir.every((r) => r.id === me.beneficiaireId || r.Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur === true));
check('l’autre fiche (discrète) est absente', !dir.some((r) => r.NOM === 'DISCRET'));
const patch = (id: number, json: unknown) => b.call(`/api/data/Beneficiaires/${id}`, { method: 'PATCH', json });
check('modification de son profil', (await patch(me.beneficiaireId, { Telephone: '0600000000', Fiche_MAJ: true })).status === 200);
check('modifier l’e-mail refusé', (await patch(me.beneficiaireId, { Courriel: 'x@y.fr' })).status === 400);
check('champ calculé refusé', (await patch(me.beneficiaireId, { Eligible: true })).status === 400);
check('fiche d’un autre refusée', (await patch(me.beneficiaireId + 1, { Telephone: '0' })).status === 403);
check('référentiel lisible une fois connecté', (await b.data('T0_Referentiel_Regions')).rows.length > 0);

const up = await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'POST', body: upload('mon cv.pdf', pdf) });
const cvId = ((await up.json()) as { attachmentId?: string }).attachmentId;
check('dépôt du CV', up.status === 200 && !!cvId);
const dl = await b.call(`/api/attachments/${cvId}`);
check('lecture du CV, contenu identique', dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(pdf) && dl.headers.get('x-content-type-options') === 'nosniff');
check('exécutable renommé refusé (422)', (await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'POST', body: upload('virus.pdf', Buffer.from('MZ\x90\x00 pas un pdf')) })).status === 422);
check('CV sans session : 401', (await anon.call(`/api/attachments/${cvId}`)).status === 401);
const row = (await b.data<{ curriculum_vitae: string[] }>('Beneficiaires', `?id=${me.beneficiaireId}`)).rows[0];
check('CV lié à la fiche', row?.curriculum_vitae?.[0] === cvId);
check('suppression du CV', (await b.call(`/api/beneficiaires/${me.beneficiaireId}/cv`, { method: 'DELETE' })).status === 200 && (await b.call(`/api/attachments/${cvId}`)).status === 404);

// --- Acheteur --------------------------------------------------------------------------------
const a = new Client();
const loginA = await a.login('demo.acheteur@example.test', pw('SEED_ACHETEUR_PASSWORD'));
check('connexion acheteur', loginA.status === 200 && ((await loginA.json()) as { roles: string[] }).roles.includes('acheteur'));
const ms = (await a.data<{ id: number; Est_marche_parent: boolean; Statut_global: string; Nb_lots: number }>('Marches')).rows;
check('acheteur : tous les marchés de son entité, avec agrégats', ms.length === 4 && ms.some((m) => m.Est_marche_parent && m.Nb_lots === 2 && !!m.Statut_global));
const created = await a.call('/api/data/Marches', { method: 'POST', json: { Intitule_du_marche: 'Marché de test (smoke)', Acheteur: 999 } });
const newId = ((await created.json()) as { id: number }).id;
check('création d’un marché', created.status === 200 && newId > 0);
const [m] = await pg`select acheteur_id, creation_en_autonomie from marches where id = ${newId}`;
check('entité et indicateur d’autonomie posés par le serveur', m?.creation_en_autonomie === true && m?.acheteur_id !== 999);
check('suppression de ce marché', (await a.call(`/api/data/Marches/${newId}`, { method: 'DELETE' })).status === 200);
check('acheteur : fiche bénéficiaire interdite en écriture', (await a.call(`/api/data/Beneficiaires/${me.beneficiaireId}`, { method: 'PATCH', json: { Telephone: '1' } })).status === 403);

// --- Répondant -------------------------------------------------------------------------------
const r = new Client();
const loginR = await r.login('demo.repondant@example.test', pw('SEED_REPONDANT_PASSWORD'));
check('connexion répondant', loginR.status === 200 && ((await loginR.json()) as { roles: string[] }).roles.includes('repondant'));
const mr = (await r.data<{ Statut?: string }>('Marches')).rows;
check('répondant : statut visible seulement sur ses marchés', mr.some((x) => 'Statut' in x) && mr.some((x) => !('Statut' in x)));
check('répondant : pas d’accès aux invitations', (await r.data('Invitation_Titulaire')).status === 403);

// --- Lien de réinitialisation ---------------------------------------------------------------
const user = await utilisateurParEmail('demo.discret@example.test');
const stale = new Client();
await stale.login('demo.discret@example.test', pw('SEED_DISCRET_PASSWORD'));
const { jeton } = await creerJeton(user!.id, 'reinitialisation');
const state = await (await anon.call(`/api/auth/reset?token=${jeton}`)).json();
check('lien valide reconnu', state.valid === true && state.type === 'reset');
check('mot de passe trop court refusé', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: 'court' } })).status === 400);
const newPassword = `Nouveau-${Date.now()}`;
check('nouveau mot de passe accepté', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: newPassword } })).status === 200);
check('lien à usage unique', (await anon.call('/api/auth/reset', { method: 'POST', json: { token: jeton, password: newPassword } })).status === 400);
const meOf = async (c: Client) => ((await (await c.call('/api/auth/me')).json()) as { session: unknown }).session;
check('session ouverte avant la réinitialisation fermée par le nouveau mot de passe', (await meOf(stale)) === null);
check('connexion avec le nouveau mot de passe', (await new Client().login('demo.discret@example.test', newPassword)).status === 200);
// On remet le mot de passe de démonstration pour que le script soit rejouable.
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
