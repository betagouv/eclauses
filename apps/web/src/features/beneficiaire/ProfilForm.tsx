// @ts-nocheck : code repris du widget Grist (grist/page/beneficiaire-profil), typé progressivement.
'use client';
// Îlot interactif de la page « Mes informations » : le serveur lit la fiche et les référentiels et les
// passe en `initial` ; le premier rendu (côté serveur) contient donc déjà le formulaire rempli.
import React from 'react';
import { useRouter } from 'next/navigation';
import ComboBox from '@/components/ComboBox';
import { clearCV, uploadCV } from '@/lib/cv';
import { attachmentUrl } from '@/lib/urls';
import { enregistrerProfil, lireProfil } from '@/server/actions/beneficiaire';

const Component = ({ initial, session }) => {
  const { useState, useEffect } = React;
  const router = useRouter();
  // === Constantes ===
  const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 Mo
  const ACCEPTED_CV_TYPES = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const TABLE = 'Beneficiaires'; // table principale
  const COL_CV = 'curriculum_vitae';           // ⚠️ colonne pièce jointe cible

  // Tables référentielles
  const REF = {
    formation: 'T0_Referentiel_Formations',
    specialites: 'T0_Referentiel_Specialites',
    departements: 'T0_Referentiel_Departements',
    regions: 'T0_Referentiel_Regions'
  };

  // === Utils ===
  function toBool(v) {
    if (v === true || v === 1 || v === '1') return true;
    if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
    return false;
  }
  function isEmpty(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }
  function asArray(v) {
    return Array.isArray(v) ? v : (v == null ? [] : [v]);
  }
  function cleanListIds(list) {
    const vals = asArray(list)
      .filter(x => x !== 'L')
      .map(v => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const n = Number(v);
        return Number.isFinite(n) ? n : v; // conserve les ids non numériques éventuels
      })
      .filter(v => v !== null && v !== undefined && v !== '');
    return Array.from(new Set(vals)); // déduplication
  }
  const displayList = (values) => cleanListIds(values);
  function emailLooksOk(v) {
    if (isEmpty(v)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function uniqSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort();
  }
  function pickLabelField(rows) {
    if (!rows || !rows.length) return 'id';
    const sample = rows[0];
    const keys = Object.keys(sample || {});
    const preferred = ['label', 'name', 'Nom', 'nom', 'title', 'Title', 'libelle', 'Libelle'];
    for (const k of preferred) if (k in sample && typeof sample[k] === 'string') return k;
    for (const k of keys) if (typeof sample[k] === 'string') return k;
    return 'id';
  }

  function toOptions(rows, key = undefined) {
    const k = key === undefined ? pickLabelField(rows) : key;
    return (rows || []).map(r => ({ value: r.id, label: String(r[k] ?? r.id), tooltip: r.Tooltip || '' }));
  }

  function goSupportContact(e) {
    if (e) e.preventDefault();
    router.push('/support-contact');
  }

  /** Formulaire à partir d'une fiche (lecture pure : sert au premier rendu et après chaque rechargement). */
  function formFromRec(rec) {
    return {
      'NOM': rec['NOM'] || '',
      'Prenom': rec['Prenom'] || '',
      'Courriel': rec['Courriel'] || '',
      'Telephone': rec['Telephone'] || '',
      'Specialite_ecole': rec['Specialite_ecole'] || '',
      'Sous_specialite': rec['Sous_specialite'] || '',
      'Intitule_du_memoire': rec['Intitule_du_memoire'] || '',
      'Autres_informations': rec['Autres_informations'] || '',
      'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur': toBool(rec['Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur']),
      'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements': toBool(rec['Je_consens_a_etre_contacte_pour_rejoindre_des_groupements']),
      'Annee_de_diplome': rec['Annee_de_diplome'] || '',
      'Formation': rec['Formation'] ?? null,
      'Specialite': asArray(rec['Specialite']),
      'Departement_de_residence': asArray(rec['Departement_de_residence']),
      'Regions_ou_vous_etes_mobile': asArray(rec['Regions_ou_vous_etes_mobile']),
      [COL_CV]: asArray(rec[COL_CV])
    };
  }
  const cvUrlFrom = (list) => {
    const cvId = asArray(list).filter((x) => x !== 'L' && x != null && x !== '').map(String)[0];
    return cvId ? attachmentUrl(cvId) : null;
  };

  // === États ===
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(initial.rec ? null : (session.beneficiaireId ? "Votre fiche n'est pas accessible." : null));
  const [rows, setRows] = useState([]);
  const [currentId, setCurrentId] = useState(session.beneficiaireId || null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [consentMsg, setConsentMsg] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Auth (depuis MagicLink)
  const [auth, setAuth] = useState(session);

  // Référentiels
  const [optFormation, setOptFormation] = useState(() => sortByLabelFr(toOptions(initial.formations, 'Intitule')));
  const [optSpecialites, setOptSpecialites] = useState(() => sortByLabelFr(toOptions(initial.specialites, 'Intitule')));
  const [optDepartements, setOptDepartements] = useState(() => (initial.departements || []).map(r => ({ value: r.id, label: String(r['Departement_Numero'])+" - "+String(r['Departement_Nom']) })));
  const [optRegions, setOptRegions] = useState(() => toOptions(initial.regions, 'Intitule'));

  // Choice suggestions
  const [yearsOptions, setYearsOptions] = useState(initial.years || []);
  const [otherFormation, setOtherFormation] = useState('');

  // Fichier CV en attente d’upload
  const [fileCV, setFileCV] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [cvUrl, setCvUrl] = useState(() => (initial.rec ? cvUrlFrom(initial.rec[COL_CV]) : null));
  const cvInputRef = React.useRef(null);
  const [cvMsg, setCvMsg] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('infos');
  const toc = React.useMemo(() => ([
    { id: 'infos', label: 'Mon profil' },
    { id: 'cv', label: 'Mon curriculum vitae' },
    { id: 'prefs', label: 'Mes préférences' },
  ]), []);

  // Formulaire (état éditable)
  const [form, setForm] = useState(() => (initial.rec ? formFromRec(initial.rec) : {
    'NOM': '', 'Prenom': '', 'Courriel': '', 'Telephone': '', 'Sous_specialite': '', 'Intitule_du_memoire': '', 'Autres_informations': '',
    'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur': false,
    'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements': false,
    'Annee_de_diplome': '', 'Formation': null, 'Specialite': [], 'Departement_de_residence': [], 'Regions_ou_vous_etes_mobile': [], [COL_CV]: []
  }));

  useEffect(() => {
    document.title = 'Mes informations - Eclauses';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const sections = toc.map(t => document.getElementById(t.id)).filter(Boolean);
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { rootMargin: '0px 0px -60% 0px', threshold: 0.1 });
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  // === Seed form depuis un record ===
  function seedForm(rec) {
    setForm(formFromRec(rec));
    setCvUrl(cvUrlFrom(rec[COL_CV]));
    setFileCV(null);
  }

  // === Handlers ===
  function setField(name, value) {
    setFormErrors(prev => ({ ...prev, [name]: null }));
    setForm(prev => ({ ...prev, [name]: value }));
  }
  function setSelectSingle(name, e) {
    const v = e.target.value;
    setField(name, v ? Number(v) : null);
  }

  async function refreshRow() {
    if (!currentId) return;
    try {
      const res = await lireProfil();
      if (!res.ok) throw new Error(res.message);
      if (res.data) seedForm(res.data);
    } catch (e) {
      setErr(e.message || 'Impossible de rafraîchir la fiche.');
    }
  }


  async function save(source) {
    if (!currentId) return;
    setErr(null); setMsg(null);
    setFormErrors({});
    if (source === 'consents') setConsentMsg(false);

    if (source === 'profile') {
      const nextErrors = {};
      if (isEmpty(form['NOM'])) nextErrors.NOM = 'Champ requis.';
      if (isEmpty(form['Prenom'])) nextErrors.Prenom = 'Champ requis.';
      if (!displayList(form['Specialite']).length) nextErrors.Specialite = 'Champ requis.';
      if (Object.keys(nextErrors).length) {
        setFormErrors(nextErrors);
        setErr('Merci de compléter les champs obligatoires.');
        return;
      }
    }

    if (!emailLooksOk(form['Courriel'])) {
      setErr('Adresse e-mail invalide.');
      return;
    }

    const formationAutre = optFormation.find(o => o.label === 'Autre (à préciser)');
    const isAutre = formationAutre && form['Formation'] === formationAutre.value;
    const autreTexte = otherFormation && otherFormation.trim() ? otherFormation.trim() : null;

    console.log(form);
    const updates = {
      'NOM': form['NOM'],
      'Prenom': form['Prenom'],
      'Courriel': form['Courriel'],
      'Telephone': form['Telephone'],
      'Specialite_ecole': form['Specialite_ecole'],
      'Autre_Formation': isAutre ? (autreTexte || '') : '',
      'Sous_specialite': form['Sous_specialite'],
      'Intitule_du_memoire': form['Intitule_du_memoire'],
      'Autres_informations': form['Autres_informations'],
      'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur': !!form['Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur'],
      'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements': !!form['Je_consens_a_etre_contacte_pour_rejoindre_des_groupements'],
      'Annee_de_diplome': form['Annee_de_diplome'] || null,
      'Formation': form['Formation'] ?? null,
      'Specialite': form['Specialite'].length > 0 ? form['Specialite'] : null,
      'Departement_de_residence': form['Departement_de_residence'].length > 0 ? form['Departement_de_residence'] : null,
      'Regions_ou_vous_etes_mobile': form['Regions_ou_vous_etes_mobile'].length > 0 ? form['Regions_ou_vous_etes_mobile'] : null,
      'Fiche_MAJ':1
    };

    try {
      setSaving(true);
      const res = await enregistrerProfil(updates);
      if (!res.ok) throw new Error(res.message);
      if (source === 'consents') {
        setConsentMsg(true);
        setTimeout(() => setConsentMsg(false), 2500);
      } else {
        setMsg('Profil enregistré avec succès.');
        setEditOpen(false);
      }
    } catch (e) {
      setErr(e.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  // === Upload CV via API Grist depuis le widget ===
  async function uploadCV() {
    if (!currentId || !fileCV) return;
    setErr(null); setMsg(null);
    setUploadErr(null);
    try {
      if (fileCV.size > MAX_CV_BYTES) {
        throw new Error('Fichier trop volumineux (max 5 Mo).');
      }
      if (ACCEPTED_CV_TYPES.length && !ACCEPTED_CV_TYPES.includes(fileCV.type)) {
        throw new Error('Type de fichier non autorisé (PDF ou DOC/DOCX attendus).');
      }

      setUploading(true);

      // Le serveur contrôle le fichier, l'envoie à Grist et l'associe à la fiche en une seule opération.
      const { attachmentId } = await uploadCV(currentId, fileCV);
      await refreshRow();
      setCvUrl(attachmentUrl(String(attachmentId)));

      setFileCV(null);
      if (cvInputRef.current) cvInputRef.current.value = '';
      setCvMsg('uploaded');
      setTimeout(() => setCvMsg(null), 2500);
    } catch (e) {
      const msg = e.message || 'Échec du téléversement du CV.';
      setUploadErr(msg);
    } finally {
      setUploading(false);
    }
  }

function sortByLabelFr(options) {
  return [...(options || [])].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), 'fr', {
      sensitivity: 'base',
      ignorePunctuation: true,
    })
  );
}

  async function clearCV() {
    if (!currentId) return;
    setErr(null); setMsg(null);
    try {
      await clearCV(currentId);
      await refreshRow();
      setFileCV(null);
      if (cvInputRef.current) cvInputRef.current.value = '';
      setCvMsg('deleted');
      setTimeout(() => setCvMsg(null), 2500);
    } catch (e) {
      setErr(e.message || 'Impossible de supprimer le CV.');
    }
  }

  // === Rendu ===
  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement du profil…</p>
      </section>
    );
  }

  // On n'interrompt plus l'affichage en cas d'erreur : on affiche juste une alerte
  const renderError = err ? (
    <div className="fr-alert fr-alert--error fr-mb-3w"><p><strong>Erreur :</strong> {err}</p></div>
  ) : null;

  if (!currentId) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--warning">
          <p>
            Impossible d’identifier votre fiche à partir de ce lien.
            {auth ? ' ' : ' '}Vérifiez que votre lien magique est valide et non expiré.
          </p>
        </div>
      </section>
    );
  }

  const cvList = form[COL_CV] || [];

  const buildCvLink = (att) => {
    if (!att) return null;
    if (typeof att === 'string') return att;
    if (typeof att === 'number') return null;
    return att.url || att.link || att.downloadUrl || null;
  };

  return (
    <section className="fr-container fr-my-6w">

      {msg && <div className="fr-alert fr-alert--success fr-mb-3w"><p>{msg}</p></div>}
      {renderError}

      <div className="fr-grid-row fr-grid-row--gutters">
        <aside className="fr-col-12 fr-col-md-3">
          <nav className="fr-sidemenu fr-sidemenu--sticky" aria-label="Sommaire du profil">
            <div className="fr-sidemenu__inner">
              <button className="fr-sidemenu__btn" aria-controls="profil-menu">Sommaire</button>
              <div className="fr-collapse" id="profil-menu">
                <ul className="fr-sidemenu__list">
                  {toc.map((it) => (
                    <li key={it.id} className="fr-sidemenu__item">
                      <a
                        className={`fr-sidemenu__link ${activeSection === it.id ? 'fr-sidemenu__link--active' : ''}`}
                        href={`#${it.id}`}
                        aria-current={activeSection === it.id ? 'true' : undefined}
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </aside>

        <div className="fr-col-12 fr-col-md-9">
          <section id="infos" className="fr-mb-4w">
            <div className="fr-card fr-p-3w">
              <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
                <div className="fr-col">
                  <h2 className="fr-h5 fr-mb-0">Mon profil</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--secondary" onClick={() => setEditOpen(true)}>
                    Modifier mon profil
                  </button>
                </div>
              </div>
              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Nom</strong><br />{form['NOM'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Prénom</strong><br />{form['Prenom'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Courriel</strong><br />{form['Courriel'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Téléphone</strong><br />{form['Telephone'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Année de diplôme</strong><br />{form['Annee_de_diplome'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Formation</strong><br />{form['Formation'] ? (optFormation.find(o => o.value === form['Formation'])?.label || '—') : '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Spécialité(s)</strong><br />
                    {(displayList(form['Specialite']) || []).map(v => optSpecialites.find(o => o.value === v)?.label || String(v)).join(', ') || '—'}
                  </p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Sous-spécialité</strong><br />{form['Sous_specialite'] || '—'}</p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Départements de résidence</strong><br />
                    {(displayList(form['Departement_de_residence']) || []).map(v => optDepartements.find(o => o.value === v)?.label || String(v)).join(', ') || '—'}
                  </p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Régions de mobilité</strong><br />
                    {(displayList(form['Regions_ou_vous_etes_mobile']) || []).map(v => optRegions.find(o => o.value === v)?.label || String(v)).join(', ') || '—'}
                  </p>
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <p className="fr-text--sm fr-mb-1w"><strong>Intitulé du mémoire</strong><br />{form['Intitule_du_memoire'] || '—'}</p>
                </div>
                <div className="fr-col-12">
                  <p className="fr-text--sm fr-mb-0"><strong>Autres informations</strong><br />{form['Autres_informations'] || '—'}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="cv" className="fr-mb-4w">
            <div className="fr-card fr-p-3w">
              <h2 className="fr-h6 fr-mb-2w">Mon <i>curriculum vitae</i></h2>
              {uploadErr && <div className="fr-alert fr-alert--error fr-mb-2w"><p>{uploadErr}</p></div>}
              <p className="fr-mb-1w">
                Fichier actuel :{' '}
                {cvUrl ? (
                  <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="fr-link">
                    Télécharger le CV
                  </a>
                ) : (
                  <strong>Aucun</strong>
                )}
              </p>
              {!cvUrl && (
                <>
                  <div className="fr-upload-group fr-my-2w">
                    <label className="fr-label" htmlFor="cvfile">Sélectionner un fichier</label>
                    <input id="cvfile" className="fr-upload" type="file"
                      ref={cvInputRef}
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setFileCV(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                    <p className="fr-hint-text">Formats acceptés : PDF, DOC, DOCX. Taille max : 5 Mo.</p>
                  </div>
                  <div className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                    <button className="fr-btn" onClick={uploadCV} disabled={!fileCV || uploading}>
                      {uploading ? 'Ajout en cours…' : (cvMsg === 'uploaded' ? 'CV ajouté' : 'Ajouter votre CV')}
                    </button>
                  </div>
                </>
              )}
              {cvUrl && (
                <div className="fr-btns-group fr-btns-group--inline fr-btns-group--sm">
                  <button className="fr-btn fr-btn--secondary" onClick={clearCV} disabled={uploading || (!form[COL_CV] || !form[COL_CV].length)}>
                    {cvMsg === 'deleted' ? 'CV supprimé' : 'Supprimer le CV'}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section id="prefs" className="fr-mb-4w">
            <div className="fr-card fr-p-3w">
              <h2 className="fr-h6 fr-mb-2w">Mes préférences</h2>

              <div className="fr-mb-1w">

                <h3 className="fr-h6 fr-mb-2w">Consentements</h3>
                <div className="fr-checkbox-group fr-checkbox-group--sm fr-col-12">
                    <input type="checkbox" id="consent-annuaire"
                      checked={!!form['Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur']}
                      onChange={(e) => setField('Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur', e.target.checked)} />
                    <label className="fr-label" htmlFor="consent-annuaire">Figurer dans l’annuaire partagé</label>
                  <p className="fr-hint-text">(en cochant cette case, vous acceptez que vos informations soient visibles par les acheteurs, les candidats et titulaires à des marchés publics et les autres bénéficiaires de cette clause sociale)</p>
            
                  </div>
                  <div className="fr-checkbox-group fr-checkbox-group--sm fr-col-12">
                    <input type="checkbox" id="consent-groupements"
                      checked={!!form['Je_consens_a_etre_contacte_pour_rejoindre_des_groupements']}
                      onChange={(e) => setField('Je_consens_a_etre_contacte_pour_rejoindre_des_groupements', e.target.checked)} />
                    <label className="fr-label" htmlFor="consent-groupements">Être contacté pour rejoindre des groupements</label>
                    <p className="fr-hint-text">(en cochant cette case vous acceptez que votre numéro de téléphone et votre email soient partagés à des candidats ou titulaires à des marchés publics)</p>
                  
                  </div>
                <button className={`fr-btn ${consentMsg ? 'fr-btn--secondary' : ''}`} onClick={() => save('consents')} disabled={saving}>
                  {saving ? 'Enregistrement…' : (consentMsg ? 'Consentements enregistrés' : 'Enregistrer les consentements')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {editOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-profile-title"
             className="fr-overlay"
             style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'1rem', overflow:'auto' }}
             onClick={() => setEditOpen(false)}>
          <div className="fr-container fr-container--fluid fr-container-lg"
               style={{maxWidth:'960px', width:'100%'}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="fr-card fr-p-3w"
                 style={{background:'var(--background-default-grey,#fff)', maxHeight:'90vh', overflowY:'auto'}}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="edit-profile-title" className="fr-h4 fr-mb-0">Modifier mon profil</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" onClick={() => setEditOpen(false)}>Fermer</button>
                </div>
              </div>

              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className={`fr-input-group ${formErrors.NOM ? 'fr-input-group--error' : ''}`}>
                    <label className="fr-label" htmlFor="nom">Nom <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                    <input id="nom" className="fr-input" type="text"
                      value={form['NOM']} onChange={(e) => setField('NOM', e.target.value)} />
                    {formErrors.NOM && <p className="fr-error-text">{formErrors.NOM}</p>}
                  </div>
                </div>
                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className={`fr-input-group ${formErrors.Prenom ? 'fr-input-group--error' : ''}`}>
                    <label className="fr-label" htmlFor="prenom">Prénom <span className="fr-text-default--error" aria-hidden="true">*</span></label>
                    <input id="prenom" className="fr-input" type="text"
                      value={form['Prenom']} onChange={(e) => setField('Prenom', e.target.value)} />
                    {formErrors.Prenom && <p className="fr-error-text">{formErrors.Prenom}</p>}
                  </div>
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="courriel">Courriel</label>
                    <input id="courriel" className="fr-input" type="email"
                      value={form['Courriel']} disabled />
                    <p className="fr-hint-text">Pour modifier cette information, contacter le <a href="#" onClick={goSupportContact}>support Eclauses.</a></p>
                  </div>
                </div>
                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="tel">Téléphone</label>
                    <input id="tel" className="fr-input" type="text"
                      value={form['Telephone']} onChange={(e) => setField('Telephone', e.target.value)} />
                  </div>
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="annee">Année de diplôme</label>
                    <input id="annee" className="fr-input" type="text"
                      value={form['Annee_de_diplome']} disabled />
                    <p className="fr-hint-text">Pour modifier cette information, contacter le <a href="#" onClick={goSupportContact}>support Eclauses.</a></p>
                  </div>
                </div>
                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className="fr-select-group">
                    <label className="fr-label" htmlFor="formation">Formation</label>
                    <input id="formation" className="fr-input" type="text"
                      value={form['Formation'] ? (optFormation.find(o => o.value === form['Formation'])?.label || '—') : '—'} disabled />
                    <p className="fr-hint-text">Pour modifier cette information, contacter le <a href="#" onClick={goSupportContact}>support Eclauses.</a></p>
                  </div>
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  {ComboBox ? (
                    <ComboBox
                      id="specs-combo"
                      label="Spécialité(s)"
                      required
                      options={optSpecialites}
                      multiple
                      value={displayList(form['Specialite'])}
                      onChange={(vals) => setField('Specialite', vals.length ? ['L', ...vals] : [])}
                      placeholder="Choisir des spécialités"
                      searchPlaceholder="Rechercher une spécialité"
                      summaryMode="list"
                    />
                  ) : (
                    <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                  )}
                  {formErrors.Specialite && <p className="fr-error-text">{formErrors.Specialite}</p>}
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="sous-spec">Sous-spécialité</label>
                    <input id="sous-spec" className="fr-input" type="text"
                      value={form['Sous_specialite']} onChange={(e) => setField('Sous_specialite', e.target.value)} />
                  </div>
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  {ComboBox ? (
                    <ComboBox
                      id="depts-combo"
                      label="Département(s) de résidence"
                      options={optDepartements}
                      multiple
                      value={displayList(form['Departement_de_residence'])}
                      onChange={(vals) => setField('Departement_de_residence', vals.length ? ['L', ...vals] : [])}
                      placeholder="Choisir des départements"
                      searchPlaceholder="Rechercher un département"
                      summaryMode="list"
                    />
                  ) : (
                    <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                  )}
                </div>

                <div className="fr-col-12 fr-col-md-6 fr-mb-3w">
                  {ComboBox ? (
                    <ComboBox
                      id="regions"
                      label="Régions de mobilité"
                      options={optRegions}
                      multiple
                      value={displayList(form['Regions_ou_vous_etes_mobile'])}
                      onChange={(vals) => setField('Regions_ou_vous_etes_mobile', vals.length ? ['L', ...vals] : [])}
                      placeholder="Choisir des régions"
                      searchPlaceholder="Rechercher une région"
                      summaryMode="list"
                    />
                  ) : (
                    <div className="fr-alert fr-alert--error"><p>ComboBox indisponible.</p></div>
                  )}
                </div>

                <div className="fr-col-12 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="memoire">Intitulé du mémoire</label>
                    <input id="memoire" className="fr-input" type="text"
                      value={form['Intitule_du_memoire']} onChange={(e) => setField('Intitule_du_memoire', e.target.value)} />
                  </div>
                </div>

                <div className="fr-col-12 fr-mb-3w">
                  <div className="fr-input-group">
                    <label className="fr-label" htmlFor="infos">Autres informations</label>
                    <textarea id="infos" placeholder="Diplômes et formations complétementaires, lien vers CV en ligne, etc." className="fr-input" rows="4"
                      value={form['Autres_informations']} onChange={(e) => setField('Autres_informations', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="fr-btns-group fr-btns-group--right fr-mt-3w">
                <button className="fr-btn" onClick={() => save('profile')} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
                </button>
                <button className="fr-btn fr-btn--secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Component;
