/**
 * Parcours de bout en bout contre une instance démarrée (par défaut http://localhost:3100) et le
 * document Grist DEV : connexion, droits de lecture, modification du profil, dépôt, lecture et
 * suppression du CV. Les écritures se limitent au bénéficiaire de test créé par seed-proto-user.
 */
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile('.env.local');
const base = process.env.BASE_URL ?? 'http://localhost:3100';
const origin = new URL(base).origin;
const email = process.env.PROTO_TEST_EMAIL!;
const password = process.env.PROTO_TEST_PASSWORD!;

const g = new GristClient({
  baseUrl: process.env.GRIST_BASE_URL!,
  docId: process.env.GRIST_DOC_ID!,
  apiKey: process.env.GRIST_API_KEY!,
});

let cookie = '';
let failures = 0;
const timings: Record<string, number> = {};

async function call(label: string, path: string, init: RequestInit & { json?: unknown; noOrigin?: boolean } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (cookie) headers.cookie = cookie;
  if (!init.noOrigin && init.method && init.method !== 'GET') headers.origin = origin;
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const t0 = performance.now();
  const res = await fetch(base + path, { ...init, headers, body, redirect: 'manual' });
  timings[label] = Math.round(performance.now() - t0);
  const set = res.headers.get('set-cookie');
  if (set?.includes('eclauses_session=')) cookie = set.split(';')[0]!;
  return res;
}

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const pdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n'),
  Buffer.from('trailer<</Root 1 0 R>>\n%%EOF\n'),
]);
const upload = (name: string, bytes: Buffer, type: string) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type }));
  return form;
};

// --- Sans session -----------------------------------------------------------------------------
check('lecture sans session refusée (401)', (await call('anon', '/api/data/Beneficiaires')).status === 401);

// --- Connexion --------------------------------------------------------------------------------
const bad = await call('login-ko', '/api/auth/login', { method: 'POST', json: { email, password: 'faux' } });
check('mauvais mot de passe : 401 et message générique', bad.status === 401, (await bad.json()).message);
const nobody = await call('login-inconnu', '/api/auth/login', {
  method: 'POST',
  json: { email: 'inconnu@example.org', password: 'x' },
});
check('compte inconnu : même réponse que mauvais mot de passe', nobody.status === 401);
check(
  'POST sans en-tête Origin refusé (CSRF)',
  (await call('csrf', '/api/auth/login', { method: 'POST', json: { email, password }, noOrigin: true })).status === 403,
);

const login = await call('login', '/api/auth/login', { method: 'POST', json: { email, password } });
const me = (await login.json()) as { roles: string[]; beneficiaireId: number };
check('connexion réussie avec cookie de session', login.status === 200 && !!cookie, `rôles ${me.roles}`);
const ownId = me.beneficiaireId;
check('rôle bénéficiaire résolu', me.roles.includes('beneficiaire') && ownId > 0, `fiche ${ownId}`);

// --- Lecture ----------------------------------------------------------------------------------
const own = (await (await call('lecture-fiche', `/api/data/Beneficiaires?id=${ownId}`)).json()) as Record<string, unknown>[];
check('lecture ciblée : sa seule fiche', own.length === 1 && own[0]!.id === ownId);
check(
  'colonnes internes absentes de sa fiche',
  !('Clef_secrete' in own[0]!) && !('Commentaire' in own[0]!) && !('Missions_proposees' in own[0]!),
);

const dir = (await (await call('lecture-annuaire', '/api/data/Beneficiaires')).json()) as Record<string, unknown>[];
const others = dir.filter((r) => r.id !== ownId);
check('annuaire : sa fiche + des fiches consentantes', dir.some((r) => r.id === ownId) && others.length > 0, `${dir.length} fiches`);
check('annuaire : aucune colonne interne', dir.every((r) => !('Clef_secrete' in r)));
check(
  'annuaire : coordonnées masquées sans consentement au contact',
  others.every((r) => r.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements === true || !('Courriel' in r)),
);
check(
  'annuaire : fiches non consentantes / non éligibles absentes',
  others.every((r) => r.Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur === true && r.Eligible === true),
);
const refs = await call('lecture-referentiel', '/api/data/T0_Referentiel_Regions');
check('référentiel lisible', refs.status === 200 && ((await refs.json()) as unknown[]).length > 0);
check('table non exposée refusée (403)', (await call('table-interdite', '/api/data/AuthLink')).status === 403);
const marchesVisibles = (await (await call('table-marches', '/api/data/Marches')).json()) as Record<string, unknown>[];
check('Marches : colonnes publiques seulement pour un bénéficiaire', marchesVisibles.every((m) => !('Titulaire' in m) && !('Beneficiaires' in m)));

// --- Modification du profil -------------------------------------------------------------------
const patch = (id: number, json: unknown) => call('maj-profil', `/api/data/Beneficiaires/${id}`, { method: 'PATCH', json });
const stamp = `Test ${new Date().toISOString()}`;
const okPatch = await patch(ownId, { Autres_informations: stamp, Telephone: '0600000000', Fiche_MAJ: 1 });
check('modification de son profil', okPatch.status === 200, okPatch.status === 200 ? '' : JSON.stringify(await okPatch.json()));
const [after] = await g.records('Beneficiaires', { filter: { id: [ownId] } });
check('modification visible dans Grist', after?.Autres_informations === stamp);
const other = others[0]!.id as number;
check("modifier la fiche d'un autre refusé (403)", (await patch(other, { Telephone: '0' })).status === 403);
check("changer l'e-mail refusé (400)", (await patch(ownId, { Courriel: 'autre@example.org' })).status === 400);
check('champ inconnu ou sensible refusé (400)', (await patch(ownId, { Clef_secrete: 'x' })).status === 400);
check('champ Eligible refusé (400)', (await patch(ownId, { Eligible: true })).status === 400);

// --- CV ---------------------------------------------------------------------------------------
const up = await call('cv-depot', `/api/beneficiaires/${ownId}/cv`, { method: 'POST', body: upload('mon cv.pdf', pdf, 'application/pdf') });
const upBody = (await up.json()) as { attachmentId?: number; message?: string };
check('dépôt du CV', up.status === 200 && !!upBody.attachmentId, upBody.message ?? `pièce jointe ${upBody.attachmentId}`);
const [withCv] = await g.records('Beneficiaires', { filter: { id: [ownId] } });
check('CV associé à la fiche dans Grist', JSON.stringify(withCv?.curriculum_vitae) === JSON.stringify(['L', upBody.attachmentId]));

const dl = await call('cv-lecture', `/api/attachments/${upBody.attachmentId}`);
const dlBytes = Buffer.from(await dl.arrayBuffer());
check('lecture du CV (contenu identique)', dl.status === 200 && dlBytes.equals(pdf), dl.headers.get('content-type') ?? '');
check('en-têtes de sécurité du téléchargement', dl.headers.get('x-content-type-options') === 'nosniff' && dl.headers.get('content-disposition')?.startsWith('inline') === true);

const exe = await call('cv-exe', `/api/beneficiaires/${ownId}/cv`, {
  method: 'POST',
  body: upload('virus.pdf', Buffer.from('MZ\x90\x00 pas un pdf'), 'application/pdf'),
});
check('exécutable renommé en .pdf refusé (422)', exe.status === 422);
const big = await call('cv-gros', `/api/beneficiaires/${ownId}/cv`, {
  method: 'POST',
  body: upload('gros.pdf', Buffer.concat([pdf, Buffer.alloc(6 * 1024 * 1024)]), 'application/pdf'),
});
check('fichier trop volumineux refusé', big.status === 422 || big.status === 413, String(big.status));
check(
  "dépôt sur la fiche d'un autre refusé (403)",
  (await call('cv-autre', `/api/beneficiaires/${other}/cv`, { method: 'POST', body: upload('a.pdf', pdf, 'application/pdf') })).status === 403,
);
check('lecture du CV sans session refusée', (await fetch(`${base}/api/attachments/${upBody.attachmentId}`)).status === 401);

const del = await call('cv-suppression', `/api/beneficiaires/${ownId}/cv`, { method: 'DELETE' });
const [noCv] = await g.records('Beneficiaires', { filter: { id: [ownId] } });
check('suppression du CV', del.status === 200 && JSON.stringify(noCv?.curriculum_vitae ?? ['L']) === JSON.stringify(['L']));

// --- Déconnexion ------------------------------------------------------------------------------
const out = await call('logout', '/api/auth/logout', { method: 'POST' });
cookie = '';
check('déconnexion', out.status === 200 && (await call('apres-logout', '/api/data/Beneficiaires')).status === 401);

console.log('\nDurées (ms) :', JSON.stringify(timings));
console.log(failures ? `\n${failures} échec(s)` : '\nTous les contrôles passent');
process.exit(failures ? 1 : 0);
