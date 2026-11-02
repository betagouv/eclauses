import { CONTEXTE_CLAUSE, esc, layout, link, publicUrl } from './layout';
import { marcheList, type MarcheInfo } from './describe';

export interface Rendered {
  subject: string;
  html: string;
}

const login = () => `${publicUrl()}/login`;

export function resetPassword(url: string): Rendered {
  return {
    subject: 'Eclauses - Réinitialiser votre mot de passe',
    html: layout(
      `<p>Voici votre lien pour réinitialiser votre mot de passe : ${link(url, 'Réinitialiser mon mot de passe')}</p>
<p>Ce lien est valide pendant 24 h.</p>`,
    ),
  };
}

export function finalizeInscription(url: string): Rendered {
  return {
    subject: 'Eclauses - Finalisez votre inscription',
    html: layout(`<p>Voici le lien pour finaliser la création de votre espace Eclauses : ${link(url, 'Activer mon espace')}</p>
<p>Depuis votre espace vous pourrez :</p>
<ul>
  <li>Effectuer une recherche de bénéficiaires en filtrant l'annuaire selon vos critères</li>
  <li>Accéder au profil détaillé des bénéficiaires</li>
  <li>Entrer en contact avec des bénéficiaires pour répondre aux obligations sociales du marché</li>
  <li>Déclarer le bénéficiaire retenu.</li>
</ul>
<p>Merci pour votre participation, essentielle à la réussite de ce dispositif.</p>`),
  };
}

export function accountInvitation(name: string, url: string): Rendered {
  return {
    subject: 'Découvrez la nouvelle plateforme Eclauses : Activez votre espace',
    html: layout(
      `<p>Le ministère de la Culture a lancé un dispositif social pour <strong>favoriser l'insertion professionnelle des néo-diplômés en conservation-restauration de biens culturels.</strong></p>
<p>L'objectif : encourager les candidats aux marchés publics et les titulaires à intégrer de jeunes professionnels dans leurs équipes, pour renforcer la transmission des savoir-faire et l'insertion au sein des réseaux professionnels.</p>
<p>La plateforme Eclauses met en relation des candidats à des marchés publics et des bénéficiaires de clauses sociales portées par le ministère de la Culture.</p>
<p>En tant que bénéficiaire, vous pouvez dès à présent accéder à votre espace pour :</p>
<ul>
  <li>Modifier vos informations (coordonnées, renseignements sur votre profil bénéficiaire)</li>
  <li>Consulter les marchés couverts par cette clause sociale sur l'ensemble du territoire</li>
  <li>Vous faire connaître auprès de candidats et titulaires en manifestant votre intérêt à rejoindre une équipe</li>
  <li>Parcourir l'annuaire des autres bénéficiaires</li>
</ul>
<p>Voici le lien pour créer votre espace : ${link(url, 'Activer mon espace')}</p>
<p>Merci pour votre participation, essentielle à la réussite de ce dispositif.</p>`,
      name ? `Bonjour ${name},` : 'Bonjour,',
    ),
  };
}

/** Invitation d'un titulaire : lien d'activation si le compte n'existe pas, lien de connexion sinon. */
export function titulaireInvitation(info: MarcheInfo, activationUrl: string | null): Rendered {
  const access = activationUrl
    ? `<p>Voici le lien pour créer votre espace : ${link(activationUrl, 'Activer mon espace')}</p>
<p>Une fois votre espace activé, vous pourrez déclarer le ou les bénéficiaire(s) retenus depuis la page « Mes marchés ».</p>`
    : `<p>Rendez-vous sur votre espace, page « Mes marchés », pour déclarer le ou les bénéficiaires retenus : ${link(login(), 'Accéder à mon espace')}</p>`;
  return {
    subject: `Eclauses - action requise suite à votre titularisation sur ${info.isLot ? 'un lot' : 'un marché'}`,
    html: layout(`${CONTEXTE_CLAUSE}
<p>Vous avez été déclaré comme titulaire ${info.ofNoun} suivant sur la plateforme Eclauses :</p>
${marcheList(info, [{ label: 'Acheteur', value: info.acheteur }])}
<p>Ce ${info.noun} vous a été notifié via PLACE. Vous devez maintenant déclarer le ou les bénéficiaire(s) avec lequel vous allez travailler <strong>afin de vous conformer aux obligations sociales ${info.ofNoun} sur la plateforme Eclauses.</strong></p>
${access}`),
  };
}

/** Relance d'un titulaire n'ayant pas encore déclaré de bénéficiaire. */
export function titulaireRelance(info: MarcheInfo, activationUrl: string | null): Rendered {
  const access = activationUrl
    ? `<p>Voici le lien pour créer votre espace : ${link(activationUrl, 'Activer mon espace')}</p>
<p>Une fois votre espace activé, vous pourrez déclarer le ou les bénéficiaire(s) retenus depuis la page « Mes marchés ».</p>`
    : `<p>Rendez-vous sur votre espace, page « Mes marchés », pour déclarer le ou les bénéficiaires retenus : ${link(login(), 'Accéder à mon espace')}</p>`;
  return {
    // Comme dans n8n : un titulaire qui n'a pas encore activé son espace reçoit l'objet « actions requises ».
    subject: activationUrl ? 'Eclauses - Relance : actions requises suite à votre titularisation sur un marché' : `Eclauses - Relance : déclaration attendue pour ${info.isLot ? 'un lot' : 'un marché'} dont vous êtes titulaire`,
    html: layout(`${CONTEXTE_CLAUSE}
<p>Vous avez été déclaré comme titulaire ${info.ofNoun} suivant sur la plateforme Eclauses :</p>
${marcheList(info, [{ label: 'Acheteur', value: info.acheteur }])}
<p>À notre connaissance, vous n'avez pas encore déclaré le ou les bénéficiaire(s) avec lequel vous allez travailler pour ce ${info.noun}. <strong>Il est encore temps d'effectuer votre déclaration afin de vous conformer aux obligations sociales ${info.ofNoun}.</strong></p>
${access}`),
  };
}

export function declarationAValider(info: MarcheInfo, buyerName: string): Rendered {
  return {
    subject: `Eclauses - action requise : bénéficiaire(s) à valider pour ${info.isLot ? 'un lot' : 'un marché'} que vous portez`,
    html: layout(
      `<p>Pour information, une déclaration de bénéficiaire(s) est <strong>en attente de validation</strong> de votre part pour ${info.ofNoun === 'du lot' ? 'le lot' : 'le marché'} suivant :</p>
${marcheList(info, [{ label: 'Titulaire', value: info.titulaire }])}
<p><strong>L'activation définitive de la clause sociale sur ce ${info.noun} nécessite une validation manuelle de votre part, pour confirmer l'éligibilité du ou des bénéficiaire(s).</strong></p>
<p>Rendez-vous sur la plateforme Eclauses pour valider la déclaration, dans la page « Mes marchés », onglet « Exécution » : ${link(publicUrl(), 'Connexion à Eclauses')}</p>`,
      buyerName ? `Bonjour ${buyerName},` : 'Bonjour,',
    ),
  };
}

export function clauseActiveeAcheteur(info: MarcheInfo): Rendered {
  return {
    subject: `Eclauses - clause sociale activée pour ${info.isLot ? 'un lot' : 'un marché'} que vous portez`,
    html: layout(`<p>Pour information, suite à votre validation, <strong>la clause sociale ${info.ofNoun} ci-dessous est considérée comme activée</strong> sur la plateforme Eclauses :</p>
${marcheList(info, [{ label: 'Titulaire', value: info.titulaire }])}`),
  };
}

export function clauseActiveeTitulaire(info: MarcheInfo): Rendered {
  return {
    subject: `Eclauses - clause sociale activée pour ${info.isLot ? 'un lot' : 'un marché'} dont vous êtes titulaire`,
    html: layout(`<p>Merci d'avoir renseigné les informations liées à la clause sociale pour ${info.isLot ? 'le lot' : 'le marché'} suivant :</p>
${marcheList(info, [{ label: 'Acheteur', value: info.acheteur }])}
<p><strong>Cette déclaration a été validée par l'acheteur et la clause sociale est considérée comme activée pour ce ${info.noun}.</strong></p>`),
  };
}

export function declarationRefusee(info: MarcheInfo, reason: string): Rendered {
  return {
    subject: "Eclauses - une déclaration de bénéficiaire a été refusée sur Eclauses",
    html: layout(`<p>Un acheteur a refusé votre déclaration de bénéficiaire sur Eclauses :</p>
${marcheList(info, [
  { label: 'Acheteur', value: info.acheteur },
  { label: 'Motif du refus', value: reason || 'Raison non renseignée' },
])}
<p>Rendez-vous sur la plateforme Eclauses pour corriger la déclaration, dans la page « Mes marchés » : ${link(login(), 'Connexion à Eclauses')}</p>`),
  };
}

export function consultationCoordonnees(marcheTitle: string): Rendered {
  return {
    subject: 'Eclauses - un candidat potentiel a consulté vos coordonnées',
    html: layout(`<p>Vous êtes inscrit sur la plateforme Eclauses, dont l'objectif est d'<strong>encourager les candidats aux marchés publics et les titulaires à intégrer de jeunes professionnels dans leurs équipes, pour renforcer la transmission des savoir-faire et l'insertion au sein des réseaux professionnels.</strong></p>
<p>Un candidat potentiel à un marché public a demandé à consulter vos coordonnées en lien avec le marché ${esc(marcheTitle)}. Celui-ci est donc susceptible de vous contacter via votre email ou votre numéro de téléphone.</p>
<p>Pour rappel, vous pouvez à tout moment modifier vos informations ou modifier votre souhait de figurer dans l'annuaire d'Eclauses en vous connectant à votre espace, dans la page « Mes informations », sous l'onglet « Mes préférences » : ${link(login(), 'Accéder à mon espace')}</p>`),
  };
}

export interface PublishedLot {
  label: string;
  clause: string;
}

/** Publication d'un marché : un marché alloti liste ses lots, un marché sans lot cite sa clause. */
export function marchePublie(args: {
  info: MarcheInfo;
  alloti: boolean;
  deadline: string | null;
  lots: PublishedLot[];
  clause: string | null;
}): Rendered {
  const { info, alloti, deadline, lots, clause } = args;
  const detail = alloti
    ? `<p>Lots concernés :</p>${
        lots.length
          ? `<ul>${lots.map((l) => `<li>${esc(l.label)}${l.clause ? ` - Clause sociale : ${esc(l.clause)}` : ''}</li>`).join('')}</ul>`
          : '<ul><li>Lots à consulter dans votre espace Eclauses</li></ul>'
      }`
    : `<p>Clause sociale : ${esc(clause ?? 'à consulter dans votre espace Eclauses')}</p>`;
  return {
    subject: `Eclauses - un nouveau marché ${alloti ? 'comprenant des lots avec ' : 'avec '}clause sociale a été publié`,
    html: layout(`<p>Vous êtes inscrit sur la plateforme Eclauses, qui met en relation des candidats potentiels à des marchés publics et des bénéficiaires de <strong>clauses sociales portées par le ministère de la Culture</strong>.</p>
<p><strong>${alloti ? "Un nouveau marché comprenant un ou plusieurs lots avec clause sociale vient d'être publié :" : "Un nouveau marché avec clause sociale vient d'être publié :"}</strong></p>
<ul>
  <li>Marché : ${esc(info.marcheTitle)}</li>
  <li>Acheteur : ${esc(info.acheteur)}</li>
  <li>Date limite de remise des offres : ${esc(deadline ?? 'Non renseignée')}</li>
</ul>
${detail}
<p>Ce marché est susceptible de vous intéresser. ${alloti ? 'Vous pouvez consulter le détail des lots dans votre espace Eclauses, page « Marchés actifs ».' : 'Vous pouvez consulter le détail du marché dans votre espace Eclauses, page « Marchés actifs ».'}</p>
<p>${link(login(), 'Accéder à mon espace')}</p>`),
  };
}

export function supportRequest(nom: string, email: string, message: string): Rendered {
  return {
    subject: 'Eclauses - Demande de support depuis le site',
    html: `<p>Une demande de support a été envoyée depuis le site Eclauses :</p>
<p>Nom : ${esc(nom)}<br/>
Email : ${esc(email)}<br/>
Message : ${esc(message).replace(/\n/g, '<br/>')}</p>`,
  };
}
