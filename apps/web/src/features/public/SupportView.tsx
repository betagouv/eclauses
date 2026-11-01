// @ts-nocheck : code repris du widget Grist (grist/page/support), typé progressivement.
'use client';
// Îlot interactif du Centre d'aide : le serveur lit les questions, catégories et vidéos publiées (`initial`), le premier
// rendu contient donc déjà la FAQ. Recherche, filtres, accordéons et liens internes restent côté navigateur.
import React from 'react';
import { useRouter } from 'next/navigation';
import { pagePath } from '@/lib/navigation';

const Component = ({ initial, session }) => {
  const router = useRouter();
  const T = {
    CATS: 'Application_FAQ_Categories',
    QAS: 'Application_FAQ_Questions',
    VIDEOS: 'Support_Videos',
  };

  const CAT = { TITLE: 'Title', SLUG: 'Slug', ORDER: 'Order', PUBLISHED: 'Published' };
  const QA = {
    QUESTION: 'Question',
    ANSWER: 'Answer',
    CATEGORY: 'Category',
    KEYWORDS: 'Keywords',
    ORDER: 'Order',
    PUBLISHED: 'Published',
    AUDIENCE: 'Audience',
  };
  const VIDEO = {
    ORDER: 'Order',
    PUBLISHED: 'Published',
    AUDIENCE: 'Audience',
    AUTHOR: 'Auteur',
    LABEL: 'Label',
    DESCRIPTION: 'Description',
    CLAUSE: 'Clause',
    URL: 'URL',
  };

  const SECTION_IDS = {
    FAQ: 'section-foire-aux-questions',
    VIDEOS: 'section-tutoriels-videos',
  };

  const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const toBool = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
  const norm = (s) => String(s || '').toLowerCase();
  const incI = (h, n) => norm(h).includes(norm(n));
  const toChoiceList = (v) => asArray(v)
    .filter((x) => x !== 'L' && x != null && x !== '')
    .map((x) => String(x).trim().toLowerCase())
    .filter(Boolean);

  const escapeHTML = (s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const escapeAttr = (s) => escapeHTML(String(s || ''));
  const safeHref = (url) => {
    const v = String(url || '').trim();
    return /^(https?:|mailto:)/i.test(v) ? escapeHTML(v) : '#';
  };

  const mdInline = (raw) => {
    let s = escapeHTML(raw);
    const codeChunks = [];
    s = s.replace(/`([^`]+)`/g, (_, code) => {
      codeChunks.push(`<code>${code}</code>`);
      return `@@CODE_${codeChunks.length - 1}@@`;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const target = String(href || '').trim();
      if (/^interne:/i.test(target)) {
        const id = target.replace(/^interne:/i, '').trim();
        if (!id) return label;
        return `<a href="#" data-nav="${escapeAttr(id)}">${label}</a>`;
      }
      if (/^faq:/i.test(target)) {
        const qid = target.replace(/^faq:/i, '').trim();
        if (!qid) return label;
        return `<a href="#faq-q-${escapeAttr(qid)}" data-faq-target="${escapeAttr(qid)}">${label}</a>`;
      }
      return `<a href="${safeHref(target)}" target="_blank" rel="noreferrer">${label}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/@@CODE_(\d+)@@/g, (_, i) => codeChunks[Number(i)] || '');
    return s;
  };

  const markdownToHtml = (md) => {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inList = false;
    let inCode = false;
    let codeLines = [];

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        if (inCode) {
          html += `<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`;
          inCode = false;
          codeLines = [];
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h${h[1].length}>${mdInline(h[2])}</h${h[1].length}>`;
        continue;
      }
      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (li) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${mdInline(li[1])}</li>`;
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (!line.trim()) continue;
      html += `<p>${mdInline(line)}</p>`;
    }

    if (inList) html += '</ul>';
    if (inCode) html += `<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`;
    return html || '<p></p>';
  };

  const extractYoutubeId = (url) => {
    const v = String(url || '').trim();
    const m1 = v.match(/(?:youtube\.com\/watch\?v=)([^&#]+)/i);
    if (m1) return m1[1];
    const m2 = v.match(/youtu\.be\/([^?&#/]+)/i);
    if (m2) return m2[1];
    const m3 = v.match(/youtube\.com\/embed\/([^?&#/]+)/i);
    if (m3) return m3[1];
    return '';
  };

  const extractVimeoId = (url) => {
    const v = String(url || '').trim();
    const m = v.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? m[1] : '';
  };

  const buildVideoEmbed = (url) => {
    const raw = String(url || '').trim();
    if (!raw) return { type: 'none', src: '' };

    const yt = extractYoutubeId(raw);
    if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt}` };

    const vm = extractVimeoId(raw);
    if (vm) return { type: 'iframe', src: `https://player.vimeo.com/video/${vm}` };

    if (/^https?:\/\/[^/]+\/videos\/embed\//i.test(raw)) return { type: 'iframe', src: raw };

    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(raw)) return { type: 'video', src: raw };

    if (/^https?:\/\//i.test(raw)) return { type: 'external', src: raw };

    return { type: 'none', src: '' };
  };

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const [cats, setCats] = React.useState(initial.categories);
  const [qas, setQAs] = React.useState(initial.questions);
  const [videos, setVideos] = React.useState(initial.videos);

  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState('all');
  const [openIds, setOpenIds] = React.useState(new Set());
  const [pendingFaqTarget, setPendingFaqTarget] = React.useState(null);
  const [activeVideo, setActiveVideo] = React.useState(null);

  const rootRef = React.useRef(null);

  const auth = session;

  // Catégorie et recherche mémorisées dans l'adresse (#cat=…&q=…) : lues dans le navigateur, après l'affichage.
  React.useEffect(() => {
    document.title = 'Centre d’aide - Eclauses';
    try {
      const url = new URL(window.location.href);
      const hCat = url.hash.match(/cat=([^&]+)/)?.[1];
      const hQ = url.hash.match(/q=([^&]+)/)?.[1];
      if (hCat) setActiveCat(decodeURIComponent(hCat));
      if (hQ) setSearch(decodeURIComponent(hQ));
    } catch (_) {}
  }, []);

  const catOptions = React.useMemo(() => {
    const published = (cats || []).filter((c) => toBool(c[CAT.PUBLISHED]));
    return published
      .map((c) => ({
        id: c.id,
        slug: c[CAT.SLUG] || String(c.id),
        title: c[CAT.TITLE] || `Catégorie #${c.id}`,
        order: Number(c[CAT.ORDER]) || 9999,
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });
      });
  }, [cats]);

  const filteredQAs = React.useMemo(() => {
    const isCatAll = activeCat === 'all';
    const catById = new Map(catOptions.map((c) => [c.id, c]));
    const roles = Array.isArray(auth?.roles) ? auth.roles.map((r) => String(r).toLowerCase()) : null;

    const qasPub = (qas || []).filter((q) => toBool(q[QA.PUBLISHED]));

    const roleOk = (row) => {
      const audience = toChoiceList(row[QA.AUDIENCE]);
      if (!audience.length) return true;
      if (!roles) return audience.includes('public');
      return audience.includes('public') || audience.some((role) => roles.includes(role));
    };

    const byCat = (row) => {
      if (isCatAll) return true;
      const cat = catById.get(row[QA.CATEGORY]);
      return cat ? cat.slug === activeCat : false;
    };

    const bySearch = (row) => {
      if (!search) return true;
      const cat = catById.get(row[QA.CATEGORY]);
      const hay = [
        row[QA.QUESTION] || '',
        row[QA.ANSWER] || '',
        row[QA.KEYWORDS] || '',
        cat?.title || '',
      ].join(' • ');
      return incI(hay, search);
    };

    const prepared = qasPub
      .filter(roleOk)
      .filter(byCat)
      .filter(bySearch)
      .map((row) => ({
        id: String(row.id),
        question: row[QA.QUESTION] || 'Sans titre',
        answer: row[QA.ANSWER] || '',
        catId: row[QA.CATEGORY] || null,
        order: Number(row[QA.ORDER]) || 9999,
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.question || '').localeCompare(String(b.question || ''), 'fr', { sensitivity: 'base' });
      });

    const validCatIds = new Set(prepared.map((q) => q.catId).filter(Boolean));
    return prepared.filter((q) => !q.catId || validCatIds.has(q.catId));
  }, [qas, catOptions, activeCat, search, auth]);

  const groupedByCat = React.useMemo(() => {
    const by = new Map();
    const catOrder = new Map(catOptions.map((c, idx) => [c.id, idx]));

    filteredQAs.forEach((q) => {
      const cat = catOptions.find((c) => c.id === q.catId);
      const key = cat ? cat.slug : 'sans-cat';
      const title = cat ? cat.title : 'Autres';
      const order = cat ? (catOrder.get(cat.id) ?? 9999) : 9999;
      if (!by.has(key)) by.set(key, { title, order, items: [] });
      by.get(key).items.push(q);
    });

    return Array.from(by.values()).sort((a, b) => {
      if ((a.order ?? 9999) !== (b.order ?? 9999)) return (a.order ?? 9999) - (b.order ?? 9999);
      return String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });
    });
  }, [filteredQAs, catOptions]);

  const filteredVideos = React.useMemo(() => {
    const roles = Array.isArray(auth?.roles) ? auth.roles.map((r) => String(r).toLowerCase()) : null;

    const roleOk = (row) => {
      const audience = toChoiceList(row[VIDEO.AUDIENCE]);
      if (!audience.length) return true;
      if (!roles) return audience.includes('public');
      return audience.includes('public') || audience.some((role) => roles.includes(role));
    };

    return (videos || [])
      .filter((v) => toBool(v[VIDEO.PUBLISHED]))
      .filter(roleOk)
      .map((v) => ({
        id: String(v.id),
        order: Number(v[VIDEO.ORDER]) || 9999,
        label: String(v[VIDEO.LABEL] || `Vidéo #${v.id}`),
        description: String(v[VIDEO.DESCRIPTION] || ''),
        author: String(v[VIDEO.AUTHOR] || ''),
        url: String(v[VIDEO.URL] || '').trim(),
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.id.localeCompare(b.id);
      });
  }, [videos, auth]);

  const videosWithPlayer = React.useMemo(
    () => filteredVideos.map((video) => ({ ...video, player: buildVideoEmbed(video.url) })),
    [filteredVideos]
  );

  const videoHostLabel = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
      return '';
    }
  };

  const closeVideo = () => setActiveVideo(null);

  const setCatAndHash = (slug) => {
    setActiveCat(slug);
    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams((url.hash || '').replace(/^#/, ''));
      params.set('cat', slug);
      if (search) params.set('q', search); else params.delete('q');
      url.hash = params.toString();
      history.replaceState(null, '', url.toString());
    } catch (_) {}
  };

  const setSearchAndHash = (v) => {
    setSearch(v);
    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams((url.hash || '').replace(/^#/, ''));
      if (v) params.set('q', v); else params.delete('q');
      if (activeCat) params.set('cat', activeCat);
      url.hash = params.toString();
      history.replaceState(null, '', url.toString());
    } catch (_) {}
  };

  const toggleOpen = (id) => {
    setOpenIds((prev) => {
      const key = String(id);
      if (prev.has(key)) return new Set();
      return new Set([key]);
    });
  };

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = (e) => {
      // Lien interne d'une réponse (« [texte](interne:page) ») : navigation dans l'application.
      const nav = e.target && e.target.closest ? e.target.closest('a[data-nav]') : null;
      if (nav && root.contains(nav)) {
        e.preventDefault();
        router.push(pagePath(String(nav.getAttribute('data-nav') || '').trim()));
        return;
      }
      const a = e.target && e.target.closest ? e.target.closest('a[data-faq-target]') : null;
      if (!a || !root.contains(a)) return;
      e.preventDefault();
      const qid = String(a.getAttribute('data-faq-target') || '').trim();
      if (!qid) return;

      setActiveCat('all');
      setSearch('');
      setPendingFaqTarget(qid);
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  React.useEffect(() => {
    if (!pendingFaqTarget) return;
    const exists = filteredQAs.some((q) => String(q.id) === String(pendingFaqTarget));
    if (!exists) return;

    const sectionId = `faq-q-${pendingFaqTarget}`;

    setOpenIds((prev) => {
      return new Set([String(pendingFaqTarget)]);
    });

    requestAnimationFrame(() => {
      const faqSection = document.getElementById(SECTION_IDS.FAQ);
      if (faqSection) faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setTimeout(() => {
        const target = document.getElementById(sectionId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 220);

      setPendingFaqTarget(null);
    });
  }, [pendingFaqTarget, filteredQAs]);

  if (loading) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-loader" aria-label="Chargement" />
        <p className="fr-text--sm fr-mt-1w">Chargement de la page support…</p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="fr-container fr-my-6w">
        <div className="fr-alert fr-alert--error"><p><strong>Erreur :</strong> {err}</p></div>
      </section>
    );
  }

  const faqCount = filteredQAs.length;

  return (
    <main ref={rootRef} className="fr-container fr-my-6w">
      <header className="fr-mb-4w">
        <div className="fr-grid-row fr-grid-row--middle fr-grid-row--gutters">
          <div className="fr-col">
            <h1 className="fr-h3 fr-mb-1w">Centre d'aide</h1>
            <p className="fr-text--sm fr-text-mention--grey">
              Consultez la FAQ ou regardez les tutoriels vidéo.
            </p>
          </div>
          <div className="fr-col-auto">
            <button
              className="fr-btn fr-icon-mail-line fr-btn--icon-left"
              type="button"
              onClick={() => router.push('/support-contact')}
            >
              Contacter le support
            </button>
          </div>
        </div>
      </header>

      <div className="fr-grid-row fr-grid-row--gutters">
        <aside className="fr-col-12 fr-col-md-4 fr-col-lg-3">
          <nav className="fr-sidemenu fr-sidemenu--sticky-full-height" aria-label="Menu support">
            <div className="fr-sidemenu__inner">
              <button className="fr-sidemenu__btn" aria-controls="support-menu">Sections</button>
              <div className="fr-collapse" id="support-menu">
                <ul className="fr-sidemenu__list">
                  <li className="fr-sidemenu__item">
                    <a className="fr-sidemenu__link" href={`#${SECTION_IDS.FAQ}`}>Foire aux questions</a>
                  </li>
                  <li className="fr-sidemenu__item">
                    <a className="fr-sidemenu__link" href={`#${SECTION_IDS.VIDEOS}`}>Tutoriels vidéos</a>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </aside>

        <div className="fr-col-12 fr-col-md-8 fr-col-lg-9">
          <section id={SECTION_IDS.FAQ} className="fr-mb-6w">
            <h2 className="fr-h4 fr-mb-2w">Foire aux questions</h2>

            <div className="fr-grid-row fr-grid-row--gutters fr-mb-3w">
              <div className="fr-col-12 fr-col-md-6">
                <div className="fr-input-group">
                  <label className="fr-label" htmlFor="faq-search">Rechercher</label>
                  <input
                    id="faq-search"
                    className="fr-input"
                    type="search"
                    placeholder="Mots-clés, question…"
                    value={search}
                    onChange={(e) => setSearchAndHash(e.target.value)}
                  />
                </div>
              </div>

              <div className="fr-col-12 fr-col-md-6">
                <div className="fr-select-group">
                  <label className="fr-label" htmlFor="faq-cat">Catégorie</label>
                  <select
                    id="faq-cat"
                    className="fr-select"
                    value={activeCat}
                    onChange={(e) => setCatAndHash(e.target.value)}
                  >
                    <option value="all">Toutes les catégories</option>
                    {catOptions.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="fr-alert fr-alert--info fr-mb-3w">
              <p><strong>{faqCount}</strong> résultat(s).</p>
            </div>

            {faqCount === 0 ? (
              <div className="fr-callout">
                <p className="fr-callout__text">
                  Aucun résultat. Essayez d’autres mots-clés ou changez de catégorie.
                </p>
              </div>
            ) : (
              groupedByCat.map((group) => (
                <div key={group.title} className="fr-mb-4w">
                  <h3 className="fr-h6 fr-mb-2w">{group.title}</h3>
                  <div className="fr-accordions-group">
                    {group.items.map((item) => (
                      <section className="fr-accordion" key={item.id} id={`faq-q-${item.id}`}>
                        <h4 className="fr-accordion__title">
                          <button
                            className="fr-accordion__btn"
                            aria-expanded={openIds.has(item.id) ? 'true' : 'false'}
                            aria-controls={`content-${item.id}`}
                            onClick={(e) => { e.preventDefault(); toggleOpen(item.id); }}
                          >
                            {item.question}
                          </button>
                        </h4>
                        {openIds.has(item.id) && (
                          <div id={`content-${item.id}`} className="fr-p-2w">
                            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(item.answer) }} />
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section id={SECTION_IDS.VIDEOS} className="fr-mb-2w">
            <h2 className="fr-h4 fr-mb-2w">Tutoriels vidéos</h2>

            {videosWithPlayer.length === 0 ? (
              <div className="fr-callout">
                <p className="fr-callout__text">Aucun tutoriel vidéo disponible.</p>
              </div>
            ) : (
              <div className="fr-grid-row fr-grid-row--gutters">
                {videosWithPlayer.map((video) => (
                  <div key={video.id} className="fr-col-12">
                    <article className="fr-card fr-card--horizontal fr-card--no-arrow">
                      <div className="fr-card__body">
                        <div className="fr-card__content">
                          <h3 className="fr-card__title fr-h6">{video.label}</h3>
                          {video.description && <p className="fr-card__desc fr-text--sm">{video.description}</p>}
                        </div>
                        <div className="fr-card__footer">
                                <button
                                  className="fr-btn fr-icon-play-circle-line fr-btn--icon-left"
                                  type="button"
                                  onClick={() => setActiveVideo(video)}
                                  disabled={video.player.type === 'none'}
                                >
                                  Lire la vidéo
                                </button>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {activeVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
          className="fr-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={closeVideo}
        >
          <div
            className="fr-container fr-container--fluid"
            style={{ maxWidth: 960, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fr-card fr-p-3w" style={{ background: 'var(--background-default-grey,#fff)' }}>
              <div className="fr-grid-row fr-grid-row--middle fr-mb-2w">
                <div className="fr-col">
                  <h2 id="video-modal-title" className="fr-h5 fr-mb-0">{activeVideo.label}</h2>
                </div>
                <div className="fr-col-auto">
                  <button className="fr-btn fr-btn--tertiary-no-outline" type="button" onClick={closeVideo}>
                    Fermer
                  </button>
                </div>
              </div>

              <div className="fr-responsive-vid" style={{ background: '#000', overflow: 'hidden' }}>
                {activeVideo.player.type === 'iframe' && (
                  <iframe
                    title={activeVideo.label || 'Tutoriel vidéo'}
                    src={activeVideo.player.src}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', height: '100%', border: 0 }}
                  />
                )}
                {activeVideo.player.type === 'video' && (
                  <video src={activeVideo.player.src} controls style={{ width: '100%', height: '100%' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Component;
