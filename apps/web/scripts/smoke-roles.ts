/**
 * Droits par rôle contre une instance démarrée et le document Grist DEV : visiteur, acheteur et
 * répondant. Écritures limitées à un marché de test créé puis supprimé par l'acheteur de test.
 * Aucune opération ne déclenche d'envoi de courrier (pas de changement de statut, pas d'invitation).
 */
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile('.env.local');
const base = process.env.BASE_URL ?? 'http://localhost:3100';
const origin = new URL(base).origin;
const g = new GristClient({ baseUrl: process.env.GRIST_BASE_URL!, docId: process.env.GRIST_DOC_ID!, apiKey: process.env.GRIST_API_KEY! });

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

class Client {
  cookie = '';
  constructor(readonly label: string) {}
  async call(method: string, path: string, json?: unknown): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (method !== 'GET') headers.origin = origin;
    if (json !== undefined) headers['content-type'] = 'application/json';
    // Chaque client a sa propre adresse pour que la limitation de débit ne mélange pas les rôles.
    headers['x-forwarded-for'] = `10.1.${this.label.length}.${Math.floor(Math.random() * 250)}`;
    const res = await fetch(base + path, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    const set = res.headers.get('set-cookie');
    if (set?.includes('eclauses_session=')) this.cookie = set.split(';')[0]!;
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  get = (path: string) => this.call('GET', path);
  rows = async (table: string): Promise<any[]> => {
    const r = await this.get(`/api/data/${table}`);
    return r.status === 200 ? r.body : [];
  };
}

async function login(label: string, prefix: string): Promise<Client> {
  const c = new Client(label);
  const r = await c.call('POST', '/api/auth/login', { email: process.env[`${prefix}_EMAIL`], password: process.env[`${prefix}_PASSWORD`] });
  if (r.status !== 200) throw new Error(`connexion ${label} impossible (${r.status})`);
  return c;
}

/* ------------------------------------------------------------------------- Visiteur ----- */
const anon = new Client('visiteur');
console.log('\n# Visiteur');
check('FAQ lisible, uniquement les entrées publiées', (await anon.rows('Application_FAQ_Questions')).length > 0);
const impacts = await anon.rows('Impacts');
check('Impacts : colonnes limitées (pas de valeur manuelle)', impacts.length > 0 && impacts.every((r) => !('Valeur_manuelle' in r)));
const publicMarches = await anon.rows('Marches');
check('Marchés publiés visibles', publicMarches.length > 0, `${publicMarches.length} lignes`);
check(
  'Marchés : aucune colonne sensible pour un visiteur',
  publicMarches.every((m) => !('Statut' in m) && !('Titulaire' in m) && !('Candidats' in m) && !('Beneficiaires' in m)),
);
check('Annuaire refusé (401)', (await anon.get('/api/data/Beneficiaires')).status === 401);
check('Répondants refusé (401)', (await anon.get('/api/data/Repondants')).status === 401);
check('Mot de passe oublié : adresse inconnue acceptée sans fuite', (await anon.call('POST', '/api/data/Application_Password_Reset', { Email: 'inconnu.proto@example.test' })).status === 200);
const hijack = await anon.call('POST', '/api/data/Repondants', { Email: 'x@example.test', Titulaire_aux_marches: [85] });
check("Inscription : impossible de s'attribuer un marché comme titulaire", hijack.status === 400, hijack.body?.message);
check('Journal des courriers non exposé', (await anon.get('/api/data/Application_AuthUser')).status === 403);

/* ------------------------------------------------------------------------- Acheteur ----- */
console.log('\n# Acheteur (entité 4)');
const buyer = await login('acheteur', 'PROTO_ACHETEUR');
const me = (await buyer.get('/api/auth/me')).body.session;
const entite = me.acheteurEntiteId as number;
const marches = await buyer.rows('Marches');
const own = marches.filter((m) => m.Acheteur === entite);
const foreign = marches.filter((m) => m.Acheteur !== entite);
check('Marchés de son entité : toutes les colonnes', own.every((m) => 'Statut' in m && 'Titulaire' in m));
check('Marchés des autres entités : publiés seulement, colonnes publiques', foreign.length > 0 && foreign.every((m) => !('Statut' in m) && !('Titulaire' in m)), `${foreign.length} marchés d'autres entités`);
const acheteurs = await buyer.rows('Acheteurs');
check('Entités : seul le nom est lisible', acheteurs.length > 1 && acheteurs.every((a) => Object.keys(a).every((k) => k === 'id' || k === 'Nom')));
check('Utilisateurs : sa seule fiche', (await buyer.rows('Utilisateurs_Acheteurs')).length === 1);
const foreignId = foreign[0]!.id as number;
check("Modifier le marché d'une autre entité refusé (403)", (await buyer.call('PATCH', `/api/data/Marches/${foreignId}`, { Intitule_du_lot: 'x' })).status === 403);
check("Supprimer le marché d'une autre entité refusé (403)", (await buyer.call('DELETE', `/api/data/Marches/${foreignId}`)).status === 403);
check("Modifier le nom d'une autre entité refusé (403)", (await buyer.call('PATCH', `/api/data/Acheteurs/${entite === 1 ? 2 : 1}`, { Nom: 'x' })).status === 403);
check("Inviter un titulaire sur le marché d'une autre entité refusé (403)", (await buyer.call('POST', '/api/data/Invitation_Titulaire', { Marche: foreignId, Email: 'x@example.test' })).status === 403);
check("Refuser une déclaration sur le marché d'une autre entité refusé (403)", (await buyer.call('POST', '/api/data/Declarations_Beneficiaires_Refus', { Marche: foreignId, Raison: 'x' })).status === 403);

const created = await buyer.call('POST', '/api/data/Marches', {
  Intitule_du_marche: `PROTO - marché de test ${new Date().toISOString()}`,
  Acheteur: 999999, // doit être ignoré : l'entité vient de la session
  Creation_en_autonomie: false, // idem : posé par le serveur
});
check('Création d’un marché', created.status === 200 && created.body?.id > 0, JSON.stringify(created.body));
const [row] = await g.records('Marches', { filter: { id: [created.body.id] } });
check("Entité forcée par le serveur", row?.Acheteur === entite);
check('Marqué « créé en autonomie » (statistiques)', row?.Creation_en_autonomie === true);
check('Modification de son marché', (await buyer.call('PATCH', `/api/data/Marches/${created.body.id}`, { Lieu_d_execution: 'Paris' })).status === 200);
check('Colonne calculée refusée (400)', (await buyer.call('PATCH', `/api/data/Marches/${created.body.id}`, { Nb_lots: 3 })).status === 400);
check('Colonne inconnue refusée (400)', (await buyer.call('PATCH', `/api/data/Marches/${created.body.id}`, { Inexistante: 1 })).status === 400);
const visible = (await buyer.rows('Marches')).some((m) => m.id === created.body.id);
check('Le marché créé apparaît dans sa liste', visible);
check('Suppression de son marché', (await buyer.call('DELETE', `/api/data/Marches/${created.body.id}`)).status === 200);
const benefs = await buyer.rows('Beneficiaires');
check('Annuaire : fiches consentantes seulement, sans colonne interne', benefs.length > 0 && benefs.every((b) => b.Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur === true && !('Clef_secrete' in b)));

/* ------------------------------------------------------------------------- Répondant ---- */
console.log('\n# Répondant');
const resp = await login('repondant', 'PROTO_REPONDANT');
const rme = (await resp.get('/api/auth/me')).body.session;
const reps = await resp.rows('Repondants');
check('Répondants : sa seule fiche', reps.length === 1 && reps[0].id === rme.repondantId);
check('Modification de sa fiche', (await resp.call('PATCH', `/api/data/Repondants/${rme.repondantId}`, { Telephone: '0600000001' })).status === 200);
const otherRep = (await g.records('Repondants')).find((r) => r.id !== rme.repondantId)!;
check("Modifier la fiche d'un autre répondant refusé (403)", (await resp.call('PATCH', `/api/data/Repondants/${otherRep.id}`, { Telephone: '0' })).status === 403);
check("Changer son e-mail refusé (400) : il identifie le compte", (await resp.call('PATCH', `/api/data/Repondants/${rme.repondantId}`, { Email: 'victime@example.test' })).status === 400);
const rmarches = await resp.rows('Marches');
check('Marchés : colonnes publiques seulement tant que non impliqué', rmarches.every((m) => !('Titulaire' in m) && !('Beneficiaires' in m)));
check('Créer un marché refusé (403)', (await resp.call('POST', '/api/data/Marches', { Intitule_du_marche: 'x' })).status === 403);
const target = publicMarches[0]!.id as number;
check("Changer le statut d'un marché sans en être titulaire refusé (403)", (await resp.call('PATCH', `/api/data/Marches/${target}`, { Statut: 'Clause validée' })).status === 403);
check('Invitations non lisibles (403)', (await resp.get('/api/data/Invitation_Titulaire')).status === 403);
check('Déclarer un bénéficiaire sans être titulaire refusé (403)', (await resp.call('POST', '/api/data/Declarations_Beneficiaires', { Marche: target, Statut: 'brouillon' })).status === 403);
check('Consulter des coordonnées : lecture limitée à soi', (await resp.rows('Acces_Coordonnees')).length === 0);
check('Intérêts bénéficiaires : aucune fuite', (await resp.rows('Marches_Interets')).length === 0);
check('Annuaire lisible pour un répondant, sans colonne interne', (await resp.rows('Beneficiaires')).every((b) => !('Clef_secrete' in b)));

console.log(failures ? `\n${failures} échec(s)` : '\nTous les contrôles passent');
process.exit(failures ? 1 : 0);
