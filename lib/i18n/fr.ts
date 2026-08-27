import type { Catalogue } from '@/lib/i18n/t'

/**
 * Français. Formal address.
 *
 * ── `vous`, NEVER `tu` ──────────────────────────────────────────────────────────────
 * The same decision `lib/i18n/es.ts` keeps for Spanish, made once in `lib/i18n/locales.ts` and
 * for the same reasons: this product speaks as the family's institution — it records minutes,
 * collects dues and runs elections — and its readers include grandparents on the family tree.
 * `vous` cannot offend anybody; `tu` can read as presumptuous to an older relative being asked
 * about money.
 *
 * It reaches every string that addresses the reader, so it is not something a later edit can
 * change one line at a time. **Do not "warm up" a single string to `tu`:** a product that
 * addresses you two ways is worse than one that addresses you formally throughout.
 *
 * Visible here in `language.choose` (*Choisissez*, not *Choisis*), `switcher.heading` (*Vos
 * familles*, not *Tes familles*) and `account.signOut` (*Se déconnecter*, an infinitive, which
 * sidesteps the question entirely — the right move for a bare control label).
 *
 * ── THE DISTINCTION FRENCH MAKES THAT ENGLISH DOES NOT ──────────────────────────────
 * Exactly the *reunión* versus *junta* payoff Spanish gets — the two emphasis markers must not
 * meet across a slash here, because `*` followed by `/` closes this very comment — and it lands
 * on the same three keys, which
 * is the argument for `en.ts`' rule that a caption appearing twice keeps two keys, confirmed by
 * a second language rather than assumed from one.
 *
 *   **Rassemblement vs Réunion.** A *réunion* in French is the formal proceeding: an agenda, a
 *   secretary, minutes. It is emphatically NOT the family picnic. So `/gatherings` is
 *   *Rassemblements* — the social occasion, the three-day family event — and
 *   `/reporting/meetings` is *Réunions*. Translating both as *Réunions* would put the reunion
 *   and the board meeting under one word in the rail, which is the one thing this vocabulary
 *   exists to keep apart.
 *
 *   **Procès-verbaux**, for `/library/meeting-minutes`. The formal record OF a *réunion*, and
 *   the term a French-speaking secretary would use. *Comptes rendus* is the looser word — a
 *   write-up rather than the adopted record — and these are voted on.
 *
 *   **Envois, not distributions.** `/community/distributions` mails the family. *Distribution*
 *   in French leans logistical, as it does in Spanish; *envoi* is a mailing, which is what the
 *   feature does.
 *
 *   **Compte de résultat**, for `/reporting/pl-summary`. The French accounting term. "Résumé
 *   P&L" would be an English abbreviation sitting in a French rail.
 *
 * ── AND ONE THAT IS DELIBERATELY NOT TRANSLATED ─────────────────────────────────────
 * `Chat` stays `Chat`, the same call Spanish makes. It is the word French speakers use for this;
 * *Messagerie* names a different thing (a mailbox, or a message list, rather than a live
 * conversation).
 *
 * ── TYPOGRAPHY: THE SPACE BEFORE A COLON IS A NO-BREAK SPACE ────────────────────────
 * French sets a space before `:` and this file uses U+00A0 rather than a plain one, so a label
 * cannot wrap with the colon orphaned onto the next line. It is a real character in the string —
 * do not "tidy" it into a normal space, and do not add one where English has no colon.
 *
 * U+202F (narrow no-break) is the more correct character and is not used: it renders as a
 * missing-glyph box in some of the fonts a member's browser may fall back to, and a visible box
 * in the theme label is worse than a slightly wide space.
 *
 * ── WHAT KEEPS THIS HONEST ──────────────────────────────────────────────────────────
 * `npm run i18n:check`. A key here that is not in `en.ts` is an ORPHAN and can never render; a
 * `{placeholder}` the English does not have renders literally; and when an English string is
 * edited, every key here whose source hash no longer matches is reported STALE by name. After
 * re-checking wording, `npm run i18n:accept fr` records the new sources.
 *
 * It cannot tell whether the words are any good. That part is a person's.
 */
export const fr: Catalogue = {
  // ── THE RAIL: SECTION HEADINGS ────────────────────────────────────────────────────
  'nav.section.community': 'Communauté',
  'nav.section.gatherings': 'Rassemblements',
  'nav.section.library': 'Bibliothèque',
  'nav.section.accounting': 'Comptabilité',
  'nav.section.reporting': 'Rapports',
  'nav.section.admin': 'Administration',
  'nav.section.help': 'Aide',

  // ── THE RAIL: ITEMS ──────────────────────────────────────────────────────────────
  'nav.item./dashboard': 'Tableau de bord',

  'nav.item./community/announcements': 'Annonces',
  'nav.item./community/chat': 'Chat',
  'nav.item./community/directory': 'Répertoire',
  'nav.item./community/distributions': 'Envois',
  'nav.item./community/elections': 'Élections',
  // *Arbre généalogique* is the standard term. *Arbre familial* is understood and reads as a
  // translation of the English rather than as the thing itself.
  'nav.item./community/family-tree': 'Arbre généalogique',
  'nav.item./community/gallery': 'Galerie',

  'nav.item./gatherings': 'Rassemblements',
  'nav.item./gatherings/calendar': 'Calendrier',

  'nav.item./library/bylaws': 'Statuts',
  'nav.item./library/documents': 'Documents',
  'nav.item./library/meeting-minutes': 'Procès-verbaux',
  'nav.item./library/officer-notes': 'Notes de fonction',

  'nav.item./accounting/summary': 'Résumé',
  'nav.item./accounting/dues-and-donations': 'Cotisations et dons',
  'nav.item./accounting/transactions': 'Transactions',

  'nav.item./reporting/membership': 'Adhésions',
  'nav.item./reporting/payment-history': 'Historique des paiements',
  'nav.item./reporting/dues-projections': 'Prévisions de cotisations',
  'nav.item./reporting/pl-summary': 'Compte de résultat',
  'nav.item./reporting/gatherings': 'Rassemblements',
  'nav.item./reporting/elections': 'Élections',
  'nav.item./reporting/meetings': 'Réunions',
  'nav.item./reporting/board': 'Conseil et fonctions',

  'nav.item./admin/members': 'Membres',
  'nav.item./admin/gatherings': 'Rassemblements',
  'nav.item./admin/accounting': 'Comptabilité',
  'nav.item./admin/elections': 'Élections',
  'nav.item./admin/settings': 'Paramètres',

  'nav.item./help': 'Guide d’utilisation',

  // ── THE RAIL: ITS OWN CONTROLS ───────────────────────────────────────────────────
  'nav.open': 'Ouvrir le menu de navigation',
  'nav.close': 'Fermer le menu de navigation',

  // ── THE FAMILY SWITCHER ──────────────────────────────────────────────────────────
  // *Vos*, not *Tes* — the formal address, and the most visible instance of it.
  'switcher.heading': 'Vos familles',
  'switcher.switching': 'Changement…',
  'switcher.badge.pending': 'En attente d’approbation',
  'switcher.badge.removed': 'Cette famille a été supprimée',
  'switcher.badge.default': 'S’ouvre à la connexion',

  // ── THE ACCOUNT MENU ─────────────────────────────────────────────────────────────
  // *Mon* and *Mes* are FIRST person and correct under formal address: the member is naming
  // their own things, not being addressed.
  'account.profile': 'Mon profil',
  'account.families': 'Mes familles',
  'account.appearance': 'Apparence',
  'account.staff': 'Console du personnel GENORRA',
  'account.staffHint': 'Toutes les familles · s’ouvre dans une nouvelle fenêtre',
  'account.signOut': 'Se déconnecter',

  // ── THE THEME TOGGLE ─────────────────────────────────────────────────────────────
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'theme.system': 'Système',
  // NO-BREAK SPACE BEFORE EACH COLON. See the header — it is U+00A0, not a plain space.
  'theme.switchLabel': 'Apparence : {current}. Passer à {next}.',
  'theme.currentLabel': 'Apparence : {current}',

  // ── THE NOTIFICATION BELL ────────────────────────────────────────────────────────
  'bell.label': 'Notifications',
  'bell.heading': 'Notifications',
  'bell.markAll': 'Tout marquer comme lu',
  'bell.empty': 'Aucune notification pour le moment.',

  // ── HOW LONG AGO ─────────────────────────────────────────────────────────────────
  // *il y a* leads in French where "ago" trails in English — the same reordering Spanish needs
  // for *hace*, and exactly what a whole string can express and a concatenation in JSX cannot.
  'time.now': 'À l’instant',
  'time.minutes': 'il y a {n} min',
  'time.hours': 'il y a {n} h',

  // ── THE LANGUAGE SWITCHER ────────────────────────────────────────────────────────
  // *Choisissez*, not *Choisis* — formal.
  'language.label': 'Langue',
  'language.choose': 'Choisissez une langue',

  // ── PAGE HEADINGS ────────────────────────────────────────────────────────────────
  // The same words as the rail for most screens, and kept as separate keys for the reason
  // `en.ts` gives. *Rassemblements* / *Réunions* divides here exactly as it does above.
  'page./accounting/dues-and-donations.title': 'Cotisations et dons',
  'page./accounting/summary.title': 'Résumé',
  'page./accounting/transactions.title': 'Transactions',
  'page./admin/accounting.title': 'Comptabilité',
  'page./admin/elections.title': 'Élections',
  'page./admin/gatherings.title': 'Rassemblements',
  'page./admin/members.title': 'Membres',
  'page./admin/settings.title': 'Paramètres',
  'page./community/announcements.title': 'Annonces',
  'page./community/chat.title': 'Chat',
  'page./community/directory.title': 'Répertoire',
  'page./community/elections.title': 'Élections',
  'page./community/family-tree.title': 'Arbre généalogique',
  'page./gatherings.title': 'Rassemblements',
  'page./gatherings/calendar.title': 'Calendrier',
  'page./help.title': 'Aide',
  'page./library/documents.title': 'Documents',
  'page./library/officer-notes.title': 'Notes de fonction',
  'page./my-families.title': 'Mes familles',
  'page./personal-info.title': 'Mon profil',
  'page./reporting/board.title': 'Conseil et fonctions',
  'page./reporting/dues-projections.title': 'Prévisions de cotisations',
  'page./reporting/elections.title': 'Élections',
  'page./reporting/gatherings.title': 'Rassemblements',
  'page./reporting/meetings.title': 'Réunions',
  'page./reporting/membership.title': 'Adhésions',
  'page./reporting/payment-history.title': 'Historique des paiements',
  'page./reporting/pl-summary.title': 'Compte de résultat',

  // ── THE DASHBOARD ────────────────────────────────────────────────────────────────
  // *Rassemblement à la une* for the premier gathering — *à la une* is the front-page idiom and
  // reads as "the one we are all looking at", which is what the flag means.
  'dash.welcome': 'Bon retour,',
  'dash.atAGlance': 'En un coup d’œil',
  'dash.quickActions': 'Actions rapides',
  'dash.premier.label': 'Rassemblement à la une',
  'dash.premier.view': 'Voir les détails',
  'dash.donations.title': 'Campagnes de dons',
  'dash.donations.view': 'Voir les campagnes de dons',
  'dash.donations.met': 'Atteint',
  'dash.collected.title': 'Encaissé cette année',
  'dash.collected.view': 'Voir les paiements',
  'dash.tree.title': 'Arbre généalogique',
  'dash.tree.generationOne': 'Génération',
  'dash.tree.generationMany': 'Générations',
  'dash.tree.empty': 'Il n’y a encore personne dans cette famille pour bâtir un arbre.',
  'dash.tree.allConnected': 'Aucune feuille isolée : chacun dans la famille est relié à quelqu’un.',
  'dash.tree.oneLeaf':
    'Une feuille isolée : un membre qui n’est encore relié à personne sur l’arbre.',
  'dash.tree.open': 'Ouvrir l’arbre',
  'dash.tree.view': 'Voir l’arbre généalogique',
  'dash.updates.title': 'Actualités',
  'dash.updates.empty': 'Rien de neuf pour le moment.',
  'dash.updates.viewAll': 'Voir toutes les actualités',
  'dash.updates.unpin': 'Masquer ceci en haut de mes actualités',
  'dash.updates.pin': 'Afficher ceci en haut de mes actualités',
  'dash.profile.title': 'Complétez votre profil',
  'dash.profile.action': 'Mettre à jour mon profil',
  'dash.safety.title': 'Votre famille demande si vous êtes en sécurité',
  'dash.safety.action': 'Ouvrir les demandes de sécurité',
  'dash.chapter.title': 'Choisissez votre section',
  'dash.chapter.lede':
    'Choisir votre section vous assure de recevoir les bonnes annonces et d’être rattaché au bon groupe dans la famille.',
  'dash.chapter.select': 'Sélectionnez votre section',
  'dash.chapter.action': 'Enregistrer la section',
  'dash.chapter.saving': 'Enregistrement de la section',
  'dash.chapter.required': 'Veuillez sélectionner une section.',
  'dash.chapter.saved': 'Votre section a été enregistrée.',
  'dash.chapter.failed': 'L’enregistrement a échoué. Veuillez réessayer.',
  'dash.link.title': 'Vous aviez déjà été ajouté à la famille ?',
  'dash.link.maybe': 'Il pourrait s’agir de vous',
  'dash.link.isThisYou': 'Est-ce vous ?',
  'dash.link.thisIsMe': 'C’est moi',
  'dash.link.everyoneElse': 'Tous les autres',
  'dash.link.search': 'Rechercher par nom…',
  'dash.link.none': 'Aucun membre correspondant n’a été trouvé.',
  'dash.link.match.name': 'Le nom correspond',
  'dash.link.match.email': 'L’adresse correspond',
  'dash.link.match.phone': 'Le téléphone correspond',
  'dash.link.match.dob': 'La date de naissance correspond',
  'dash.link.action': 'Associer la fiche',
  'dash.link.linking': 'Association…',
  'dash.link.aria': 'Associer à votre compte',
  'dash.plan.pay': 'Payer maintenant',
  'dash.plan.opening': 'Ouverture…',
  'dash.plan.advance': 'Acheter des mois à l’avance',
  'dash.dismiss': 'Fermer',
  'dash.plan.explain':
    '**{pay}** vous emmène sur Stripe pour payer chaque mois, à commencer par la fin de ce '
    + 'mois-ci. **{cancel}** abandonne le forfait et laisse votre famille en Gratuit : rien '
    + 'n’est facturé dans un cas comme dans l’autre, et vous pourrez le prendre plus tard. ',
  'dash.safety.titleMany':
    'Votre famille demande si vous êtes en sécurité ({n} demandes)',
  'dash.tree.manyLeaves':
    '{n} feuilles isolées : des membres qui ne sont encore reliés à personne sur l’arbre.',

  // ── FORM FIELD LABELS, SHARED ACROSS EVERY FORM ──────────────────────────────────
  // See `en.ts`. *Courriel* rather than *E-mail* for `field.email`, which is the term a
  // French-speaking family in Canada expects and is understood everywhere else.
  'field.prefix': 'Titre',
  'field.firstName': 'Prénom',
  'field.middleName': 'Deuxième prénom',
  'field.lastName': 'Nom',
  'field.nickname': 'Surnom',
  'field.suffix': 'Suffixe',
  'field.email': 'Courriel',
  'field.phone': 'Téléphone',
  'field.gender': 'Genre',
  'field.country': 'Pays',
  'field.street': 'Adresse',
  'field.apartment': 'Appartement / Bureau',
  'field.city': 'Ville',
  'field.state': 'État',
  'field.province': 'Province',
  'field.stateProvince': 'État / Province',
  'field.zip': 'Code postal',
  'field.dob': 'Date de naissance',
  'field.sunset': 'Date du décès',
  'field.chapter': 'Section',
  'field.timeZone': 'Fuseau horaire',
  'field.language': 'Langue',
  'field.tshirt': 'T-shirt',
  'field.tshirtCategory': 'Catégorie de t-shirt',
  'field.tshirtSize': 'Taille de t-shirt',
  'field.ph.nickname': 'p. ex. Le Grand Michel',
  'field.ph.email': 'vous@exemple.com',
  'field.ph.phone': '(555) 000-0000',
  'field.ph.street': '123 rue Principale',
  'field.ph.apartment': 'App. 4B',
  'field.ph.city': 'Trois-Rivières',
  'field.ph.zip': 'G8T 1A1',
  'action.cancel': 'Annuler',
  'action.edit': 'Modifier',
  'action.saving': 'Enregistrement…',
  'action.saveChanges': 'Enregistrer les modifications',
  'action.notSet': 'Non renseigné',
  'profile.section.general': 'Général',
  'profile.section.address': 'Adresse',
  'profile.section.additional': 'Renseignements complémentaires',
  'profile.section.notifications': 'Notifications',
  'profile.section.security': 'Connexion et sécurité',
  'profile.rail': 'Sections de mon profil',
  'profile.editSection': 'Modifier : {section}',
  'profile.photo.upload': 'Téléverser une photo de profil',
  'profile.photo.replaceLong': 'Remplacer la photo de profil',
  'profile.photo.setLong': 'Ajouter une photo de profil',
  'profile.photo.replace': 'Remplacer la photo',
  'profile.photo.set': 'Ajouter une photo',
  'profile.photo.failed': 'Cette photo n’a pas pu être enregistrée',
  'profile.living': 'En vie',
  'profile.sunsetHint': 'Laissez vide si la personne est en vie.',
  'profile.sizeFirst': 'Choisissez d’abord une catégorie.',
  'profile.noChapters': 'Cette famille n’a aucune section, il n’y a donc rien à choisir.',
  'profile.inThisFamily': 'Dans cette famille',
  'profile.firstNameRequired': 'Le prénom est obligatoire',
  'profile.lastNameRequired': 'Le nom est obligatoire',
  'profile.wentWrong': 'Une erreur est survenue',
  'profile.chapterNotChanged':
    'Vos informations ont été enregistrées, mais la section n’a pas pu être changée.',
  'profile.confirm.general': 'Enregistrer les informations générales',
  'profile.confirm.generalBody': 'Enregistrer vos modifications à vos informations générales ?',
  'profile.confirm.address': 'Enregistrer l’adresse',
  'profile.confirm.addressBody': 'Enregistrer vos modifications à votre adresse ?',
  'profile.confirm.additional': 'Enregistrer les renseignements complémentaires',
  'profile.confirm.additionalBody':
    'Enregistrer vos modifications à vos renseignements complémentaires ?',
  'action.save': 'Enregistrer',
  'profile.inFamily': 'Dans {family}',

  // ── NOTIFICATIONS AND SIGN-IN & SECURITY ─────────────────────────────────────────
  // *Demande de sécurité* for the safety check row, matching `dash.safety.*` and the mail: never
  // *alerte*, because the product does not claim anything is happening — a relative asked.
  'notify.channel.email': 'Courriel',
  'notify.channel.sms': 'SMS',
  'notify.channel.push': 'Notification push',
  'notify.type.safety_check.label': 'Demande de sécurité',
  'notify.type.safety_check.description':
    'Votre famille lance une demande lors d’une tempête, d’une évacuation ou d’une urgence, et '
    + 'vous demande si vous êtes en sécurité.',
  'notify.colNotification': 'Notification',
  'notify.notBuilt': 'Pas encore disponible',
  'notify.stopped': 'Arrêté',
  'notify.toggleLabel': '{channel} pour {notification}',
  'notify.noneOnFile': 'Aucun enregistré',
  'notify.placeholderAddress': 'Une adresse générée : rien ne peut y parvenir',
  'notify.endingIn': 'Se terminant par {digits}',
  'notify.fromGeneral':
    'Ceux-ci viennent de vos informations **générales** : modifiez-les là et toutes les '
    + 'notifications suivent.',
  'notify.failed': 'Cela n’a pas fonctionné',
  'notify.noEmail':
    'Nous n’avons aucune adresse courriel qui puisse vous joindre, donc rien de ce qui est '
    + 'activé pour Courriel n’arrivera. Ajoutez-en une dans **Général**.',
  'notify.stoppedNote':
    'Vous avez répondu **STOP** à l’un de nos messages texte, nous ne pouvons donc plus écrire '
    + 'à ce numéro — et nous ne pouvons pas le réactiver d’ici : c’est une règle imposée par '
    + 'votre opérateur, pas un réglage que nous détenons. Envoyez **START** au numéro qui vous a '
    + 'écrit si vous voulez les recevoir de nouveau.',
  'notify.smsNotOn':
    'Les messages texte ne sont pas encore activés. Vous pouvez enregistrer votre choix '
    + 'maintenant, et nous l’appliquerons dès qu’ils le seront.',
  'notify.noMobile':
    'Nous n’avons pas votre numéro de mobile, donc rien de ce qui est activé pour SMS '
    + 'n’arrivera. Ajoutez-en un dans **Général**.',
  'notify.willConfirm':
    'Nous confirmerons votre numéro de mobile par un code avant de vous envoyer quoi que ce '
    + 'soit.',
  'security.email.title': 'Courriel de connexion',
  'security.email.lede':
    'L’adresse avec laquelle vous vous connectez. Distincte du courriel de contact de votre '
    + 'profil : changer l’une ne change pas l’autre.',
  'security.currently': 'Actuellement ',
  'security.newEmail': 'Nouvelle adresse courriel',
  'security.sending': 'Envoi…',
  'security.sendConfirmation': 'Envoyer la confirmation',
  'security.badEmail': 'Saisissez une adresse courriel valide',
  'security.sameEmail': 'C’est déjà votre adresse de connexion',
  'security.password.title': 'Mot de passe',
  'security.password.lede':
    'Pour le changer, il faut votre mot de passe actuel et un code court que nous vous envoyons '
    + 'par courriel. Vos autres appareils sont déconnectés ensuite.',
  'security.sendingCode': 'Envoi du code…',
  'security.changePassword': 'Changer le mot de passe',
  'security.code': 'Code reçu par courriel',
  'security.currentPassword': 'Mot de passe actuel',
  'security.newPassword': 'Nouveau mot de passe',
  'security.confirmPassword': 'Confirmez le nouveau mot de passe',
  'security.savePassword': 'Enregistrer le nouveau mot de passe',
  'security.needCode': 'Saisissez le code reçu par courriel',
  'security.needCurrent': 'Saisissez votre mot de passe actuel',
  'security.tooShort': 'Le nouveau mot de passe doit compter au moins 8 caractères',
  'security.noMatch': 'Les nouveaux mots de passe ne correspondent pas',
  'security.samePassword': 'C’est déjà votre mot de passe. Choisissez-en un autre.',
  'security.wrongCurrent': 'Ce n’est pas votre mot de passe actuel.',
  'security.ph.minChars': 'Min. 8 caractères',

  // ── THE MEMBER'S MONEY SCREENS ───────────────────────────────────────────────────
  // *Cotisation* for a due and *versement* for an installment — the §7c distinction again: the
  // cotisation is what is owed, a versement is one payment against it.
  'money.amount': 'Montant',
  'money.total': 'Total',
  'money.remaining': 'Restant',
  'money.paid': 'Payé',
  'money.status': 'Statut',
  'money.method': 'Mode',
  'money.date': 'Date',
  'money.schedule': 'Barème',
  'money.actions': 'Actions',
  'money.pastDue': 'En retard',
  'money.dueNow': 'À payer maintenant',
  'money.notYetDue': 'Pas encore due',
  'money.declined': 'Refusée',
  'money.income': 'Produits',
  'money.expenses': 'Charges',
  'money.donation': 'Don',
  'money.close': 'Fermer',
  'money.opening': 'Ouverture…',
  'pnl.lede': 'Depuis le début · chaque écriture que la famille a enregistrée',
  'pnl.duesAndDonations': 'Cotisations et dons',
  'pnl.direct': 'Apports directs',
  'pnl.netLine': 'Produits moins charges',
  'pnl.routedHeading': 'Produits affectés aux fonds',
  'pnl.nothingRouted': 'Rien n’a encore été affecté aux fonds.',
  'pnl.balancesToday': 'Soldes des fonds aujourd’hui',
  'pnl.nothingPaidOut': 'Rien n’a encore été versé',
  'pnl.disbursed': 'Versé depuis les fonds de la famille',
  'pnl.surplus': 'Excédent net',
  'pnl.deficit': 'Déficit net',
  'pnl.routedBeyond': 'Affecté au-delà des produits de cotisations',
  'pnl.notYetRouted': 'Encaissé, pas encore affecté à un fonds',
  'pnl.allRouted': 'Chaque paiement de cotisation a été affecté à un fonds.',
  'pnl.overRouted':
    'Il est entré plus dans les fonds que ce que les cotisations ont rapporté — les apports '
    + 'directs comblent l’écart.',
  'pnl.unrouted':
    'Les cotisations encaissées sur un barème sans règle d’affectation restent ici jusqu’à ce '
    + 'qu’une règle soit définie dans Comptabilité.',
  'drives.goalMet': 'Objectif atteint',
  'drives.closed': 'Terminée',
  'drives.noGoal': 'Aucun objectif — donnez ce que vous voulez.',
  'drives.none': 'Votre famille n’organise aucune campagne de dons en ce moment.',
  'drives.rail': 'Cotisations et dons',
  'drives.give': 'Donner',
  'drives.giveByCard': 'Donner par carte',
  'drives.giveHint':
    'Payé par carte directement à votre famille. Cela entre dans ses livres dès que le '
    + 'paiement est confirmé.',
  'drives.giveAnything': 'Donnez ce que vous voulez. Il n’y a pas de montant fixe.',
  'drives.needAmount': 'Saisissez un montant à donner.',
  'plan.noSchedules':
    'Vous n’êtes sur aucun barème de cotisations — votre famille n’en a défini aucun pour '
    + 'vous.',
  'plan.required': 'Cotisations obligatoires',
  'plan.optional': 'Cotisations facultatives',
  'plan.nextPayment': 'Prochain paiement',
  'plan.nextDue': 'Prochaine échéance',
  'plan.thisDue': 'Cette cotisation',
  'plan.whatYouPayNow': 'Ce que vous payez maintenant',
  'plan.payCadence': 'Plan de paiement',
  'plan.changeCadence': 'Changer la fréquence de paiement',
  'plan.pickCadence': 'Choisissez une fréquence pour mettre en place les paiements automatiques.',
  'plan.setUpAuto': 'Mettre en place les paiements automatiques',
  'plan.stopAuto': 'Arrêter les paiements automatiques',
  'plan.stopAutoConfirm': 'Arrêter les paiements automatiques ?',
  'plan.stopPayments': 'Arrêter les paiements',
  'plan.cadenceFailed': 'La fréquence n’a pas pu être modifiée',
  'plan.changeFailed': 'Cela n’a pas pu être modifié',
  'plan.optOut': 'Refuser',
  'plan.optBackIn': 'Accepter de nouveau',
  'plan.optionalHint':
    'Cette cotisation est facultative, vous pouvez donc la refuser. Elle cessera de compter '
    + 'dans ce que vous devez, et vous pourrez l’accepter de nouveau à tout moment.',
  'plan.allSettled': 'Rien ne vous attend — chaque cotisation est réglée ou refusée.',
  'plan.calendarAsked': 'Ce que le calendrier a demandé, y compris ce qu’il reste à rattraper.',
  'plan.needAmount': 'Saisissez un montant à payer.',
  'plan.pay': 'Payer',
  'plan.payByCard': 'Payer par carte',
  'plan.oneAcross':
    'Un seul paiement pour toutes les cotisations ci-dessous. Mettez-en une à zéro pour '
    + 'l’exclure.',
  'plan.straightToFamily':
    'Payé directement à votre famille. Cela entre dans ses livres dès que le paiement est '
    + 'confirmé.',
  'plan.whyDiffers': 'Pourquoi le prochain paiement peut différer du versement',
  'funds.title': 'Fonds de la famille',
  'funds.manage': 'Gérer les fonds',
  'funds.none': 'Aucun fonds n’est encore configuré.',
  'cards.noUpcoming': 'Aucune cotisation à venir',
  'cards.paidThisYear': 'Payé cette année',
  'cards.generalPayment': 'Paiement général',
  'cards.noPayments': 'Aucun paiement enregistré',
  'cards.remainingBalance': 'Solde restant',
  'cards.noSchedules': 'Aucun barème de cotisations configuré.',
  'cards.viewDues': 'Voir les cotisations',
  'cards.requiredPaid': 'Toutes les cotisations obligatoires sont payées',
  'cards.allPaid': 'Toutes les cotisations sont payées — merci !',
  'history.none': 'Aucun historique de paiement pour le moment.',
  'history.noMatches': 'Aucun paiement correspondant.',
  'history.filter': 'Filtrer l’historique des paiements',
  'history.filterPh': 'Filtrer…',
  'history.duesPayment': 'Paiement de cotisation',
  'history.donationPayment': 'Paiement de don',
  'history.paymentMethod': 'Mode de paiement',
  'history.reference': 'N° de chèque / Référence',
  'history.recorded': 'Enregistré',
  'history.reversed': 'Annulé',
  'history.reversedYes': 'Oui — une écriture de correction annule ce paiement',
  'history.corrects': 'Corrige',
  'history.correctsWhat': 'Un paiement antérieur de cet historique',
  'history.notes': 'Notes',
  'history.correctingEntry': '{kind} — écriture de correction',
  'payStatus.paid': 'Payé',
  'payStatus.waived': 'Exonéré',
  'payStatus.pending': 'En proceso',

  // ── SHARED CONTROLS AND THE LIBRARY SECTION ──────────────────────────────────────
  // *Procès-verbal* for minutes and *note* for an officer's notebook entry — the two must not
  // swap, because the section holds both.
  'action.delete': 'Supprimer',
  'action.post': 'Publier',
  'action.close': 'Fermer',
  'action.rename': 'Renommer',
  'action.download': 'Télécharger',
  'action.upload': 'Téléverser',
  'action.uploading': 'Téléversement…',
  'action.search': 'Rechercher',
  'action.clear': 'Effacer',
  'action.chooseFile': 'Choisissez un fichier',
  'action.posting': 'Publication…',
  'action.loading': 'Chargement…',
  'field.title': 'Titre',
  'field.name': 'Nom',
  'field.message': 'Message',
  'field.descriptionOptional': 'Description (facultative)',
  'field.audience': 'Destinataires',
  'common.category': 'Catégorie',
  'common.all': 'Toutes',
  'common.size': 'Taille',
  'common.day': 'Jour',
  'common.today': 'Aujourd’hui',
  'common.tomorrow': 'Demain',
  'common.yesterday': 'Hier',
  'common.nothingMatches': 'Aucun résultat',
  'ann.pane.general': 'Général',
  'ann.pane.updates': 'Actualités',
  'ann.pane.birthdays': 'Anniversaires',
  'ann.rail': 'Zones d’annonces',
  'ann.lede.general':
    'Des nouvelles de toute votre famille. Les publications épinglées restent en haut des '
    + 'Actualités de chacun jusqu’à ce qu’il les ferme.',
  'ann.lede.birthdays':
    'Seuls les {days} prochains jours sont affichés, du plus proche au plus lointain — un '
    + 'anniversaire plus éloigné apparaît ici dès qu’il entre dans les {days} jours.',
  'ann.none': 'Aucune annonce pour le moment.',
  'ann.deleteTitle': 'Supprimer l’annonce',
  'ann.deleteFailed': 'Cette annonce n’a pas pu être supprimée.',
  'ann.unpinAll': 'Désépingler pour tout le monde',
  'ann.pinAll': 'Épingler pour tout le monde',
  'ann.pinFailed': 'L’épinglage n’a pas pu être modifié.',
  'ann.pinnedRides': 'Épinglé pour la famille — il reste en haut de vos actualités.',
  'ann.pinnedHidden': 'Épinglé pour la famille — vous l’avez masqué en haut de vos actualités.',
  'ann.openElection': 'Ouvrir cette élection',
  'ann.new.prompt': 'Partagez une annonce avec votre famille…',
  'ann.new.heading': 'Nouvelle annonce',
  'ann.new.titlePh': 'Nouvelles du rassemblement',
  'ann.new.bodyPh': 'Que souhaitez-vous partager ?',
  'ann.new.pin': 'Épingler en haut des Actualités de tout le monde',
  'ann.new.unpinOn': 'Cesser d’épingler le',
  'ann.new.wholeFamily': 'Toute la famille',
  'ann.new.wholeFamilyHint': 'Tout le monde dans la famille le verra',
  'ann.new.region': 'Région',
  'ann.new.regionHint': 'Affiché à votre région',
  'ann.new.chapterHint': 'Affiché à une section précise',
  'ann.new.needBoth': 'Ajoutez un titre et un message.',
  'ann.new.needChapter': 'Choisissez la section à prévenir.',
  'ann.new.failed': 'La publication a échoué',
  'ann.new.submit': 'Publier l’annonce',
  'bday.countdown': 'Compte à rebours',
  'bday.turning': 'Aura',
  'bday.searchLabel': 'Rechercher un anniversaire par nom',
  'bday.searchPh': 'Rechercher par nom…',
  'upd.searchPh': 'Rechercher dans les titres et les messages…',
  'upd.searchLabel': 'Rechercher dans les actualités',
  'upd.unread': 'Non lu',
  'upd.wholeWords': 'Mots entiers, dans n’importe quel ordre — recherche dans',
  'upd.readFailed':
    'Une erreur est survenue à la lecture de vos actualités, cette liste peut donc être '
    + 'incomplète. Réessayez dans un instant.',
  'upd.empty':
    'Rien pour l’instant. Les annonces publiées par votre famille et tout ce qui vous est '
    + 'envoyé apparaîtront ici.',
  'upd.kindAnnouncement': 'Annonce',
  'upd.kindSentToYou': 'Envoyé à vous',
  'notes.new': 'Nouveau sujet',
  'notes.journalFor': 'Le carnet de',
  'notes.everyoneHolding': 'Toutes les personnes occupant',
  'notes.staysWithOffice':
    'Ce que vous écrivez ici reste avec la fonction. La personne qui l’occupera ensuite le '
    + 'lira.',
  'notes.titleHint': 'Ce que la liste affiche. Tout le reste va dans les notes en dessous.',
  'notes.titlePh': 'Comment se fait la conciliation bancaire',
  'notes.firstNote': 'Première note',
  'notes.firstNotePh': 'Facultatif — vous pourrez ajouter des notes à ce sujet plus tard.',
  'notes.moreLater':
    'Vous pourrez ajouter d’autres notes à ce sujet dès qu’il y aura quelque chose à ajouter.',
  'notes.note': 'Note',
  'notes.nothingUnder': 'Rien n’est encore écrit ici.',
  'notes.addNote': 'Ajouter une note',
  'notes.addNoteAction': 'Ajouter la note',
  'notes.officesRail': 'Fonctions que vous occupez',
  'notes.needTitle': 'Donnez un titre au sujet.',
  'notes.saveFailed': 'Ce sujet n’a pas pu être enregistré.',
  'notes.deleteEntryTitle': 'Supprimer ce sujet',
  'notes.deleteEntry': 'Supprimer le sujet',
  'notes.deleteEntryFailed': 'Ce sujet n’a pas pu être supprimé.',
  'notes.writeFirst': 'Écrivez quelque chose d’abord.',
  'notes.noteSaveFailed': 'Cette note n’a pas pu être enregistrée.',
  'notes.deleteNoteBody':
    'Supprimer cette note ? Le reste du sujet demeure. Cette action est irréversible.',
  'notes.deleteNote': 'Supprimer la note',
  'notes.deleteNoteFailed': 'Cette note n’a pas pu être supprimée.',
  'notes.renameEntry': 'Renommer le sujet',
  'notes.onlyYouRecorded':
    'Seule la personne qui a consigné cela peut le modifier, et seulement tant qu’elle occupe '
    + 'cette fonction.',
  'notes.onlyYouWrote':
    'Seule la personne qui a écrit cela peut le modifier, et seulement tant qu’elle occupe '
    + 'cette fonction.',
  'notes.staysWithOfficeShort':
    'Ceci reste avec la fonction. La personne qui l’occupera ensuite le lira.',
  'notes.addEntry': 'Ajouter le sujet',
  'notes.editNote': 'Modifier la note',
  'notes.editThisNote': 'Modifier cette note',
  'notes.deleteThisNote': 'Supprimer cette note',
  'notes.atTheEnd': 'Elle est ajoutée à la fin de ce sujet, sous votre nom.',
  'bylaws.heading': 'Statuts',
  'bylaws.lede':
    'Les règles que la famille s’est données. Cherchez-les, ou lisez-les dans l’ordre.',
  'bylaws.addArticle': 'Ajouter un article',
  'bylaws.addArticleAction': 'Ajouter l’article',
  'bylaws.searchLabel': 'Rechercher dans les statuts',
  'bylaws.searchPh': 'quorum, &ldquo;assemblée annuelle&rdquo;, cotisations -procuration',
  'bylaws.indexedFull': 'Recherchable en entier',
  'bylaws.typedIn': 'Saisi — recherchable en entier',
  'bylaws.titleOnly': 'Titre et résumé seulement — le texte du fichier n’a pas été lu',
  'bylaws.articleOptional': 'Article (facultatif)',
  'bylaws.summaryOptional': 'Résumé (facultatif)',
  'bylaws.textOptional': 'Le texte (facultatif)',
  'bylaws.documentOptional': 'Document (facultatif)',
  'bylaws.eitherHint':
    'Saisissez le texte pour le rendre recherchable, téléversez le document, ou les deux.',
  'bylaws.articlePh': 'Article IV',
  'bylaws.titlePh': 'Assemblées et quorum',
  'bylaws.summaryPh': 'Ce que couvre cet article',
  'bylaws.textPh': 'Collez l’article ici et chacun de ses mots devient recherchable.',
  'bylaws.deleteWithFile':
    'L’article et son fichier sont supprimés pour tout le monde. Cette action est '
    + 'irréversible.',
  'bylaws.deleteNoFile':
    'L’article est supprimé pour tout le monde. Cette action est irréversible.',
  'bylaws.deleteFailed': 'Cela n’a pas pu être supprimé.',
  'bylaws.openFailed': 'Ce fichier n’a pas pu être ouvert.',
  'bylaws.noMatches': 'Rien ne correspond.',
  'bylaws.none': 'Aucun statut n’est encore enregistré.',
  'bylaws.tryAnother':
    'Essayez un autre mot. Un PDF qui n’a pas été lu ne correspond que par son titre et son '
    + 'résumé.',
  'bylaws.addEachHint':
    'Ajoutez chaque article avec son texte, ou téléversez le document. Coller le texte est ce '
    + 'qui le rend recherchable aujourd’hui.',
  'bylaws.needTitle': 'Donnez un titre à l’article',
  'bylaws.addFailed': 'Cela n’a pas pu être ajouté.',
  'docs.upload': 'Téléverser un document',
  'docs.document': 'Document',
  'docs.filed': 'Déposé',
  'docs.searchPh': 'Nom ou description…',
  'docs.namePh': 'Formulaire d’adhésion 2026',
  'docs.descriptionPh': 'Ce que c’est, et qui en a besoin',
  'docs.deleteTitle': 'Supprimer le document',
  'docs.deleteFailed': 'Cela n’a pas pu être supprimé.',
  'docs.openFailed': 'Ce fichier n’a pas pu être ouvert.',
  'docs.none': 'Aucun document n’est encore déposé.',
  'docs.noMatches': 'Aucun document ne correspond.',
  'docs.needName': 'Donnez un nom au document',
  'docs.uploadFailed': 'Le téléversement a échoué',
  'common.daysAgo': 'il y a {n} jours',

  // ── GATHERINGS ───────────────────────────────────────────────────────────────────
  // *Rassemblement* throughout, never *réunion* — a *réunion* in French is the formal
  // proceeding, which is what `meet.*` is about.
  'gath.rail': 'Zones de rassemblement',
  'gath.pane.gatherings': 'Rassemblements',
  'gath.pane.myTasks': 'Mes tâches',
  'gath.schedule': 'Planifier un rassemblement',
  'gath.scheduleAction': 'Planifier le rassemblement',
  'gath.scheduling': 'Planification…',
  'gath.authorTemplate': 'Créer un modèle',
  'gath.builtFrom': 'Construit à partir de',
  'gath.where': 'Où',
  'gath.whatItIs': 'De quoi il s’agit',
  'gath.open': 'Ouvrir le rassemblement',
  'gath.premier': 'À la une',
  'gath.happeningNow': 'En cours',
  'gath.titlePh': 'p. ex. Retrouvailles de la famille Allen 2027',
  'gath.wherePh': 'p. ex. Parc Memorial, Houston',
  'gath.descPh': 'Facultatif — une phrase pour la famille',
  'gath.needTitle': 'Donnez un titre au rassemblement',
  'gath.scheduleFailed': 'Le rassemblement n’a pas pu être planifié',
  'gath.sayWhenWhereAndTemplate': 'Dites quand et où, et choisissez sur quoi il se fonde.',
  'gath.sayWhenWhere': 'Dites quand et où.',
  'gath.noTasks': 'Aucune tâche pour l’instant',
  'gath.tasks': 'Tâches',
  'gath.findTask': 'Trouver une tâche',
  'gath.findTaskPh': 'Tâche ou nom',
  'gath.showing': 'Affichage',
  'gath.everyTask': 'Toutes les tâches',
  'gath.task': 'Tâche',
  'gath.assignedTo': 'Attribuée à',
  'gath.due': 'Échéance',
  'gath.answer': 'Réponse',
  'gath.nobodyYet': 'Personne pour l’instant',
  'gath.nothingAdded': 'Rien n’a encore été ajouté à ce rassemblement.',
  'gath.notFromTemplate': 'Sans modèle',
  'tasks.whatAsked': 'Ce que l’organisateur a demandé',
  'tasks.backNoNotes':
    'Ceci est revenu sans notes. Demandez à un organisateur ce qu’il faut changer.',
  'tasks.askReopen': 'Demandez à un organisateur de la réouvrir s’il faut la changer.',
  'tasks.yourAnswer': 'Votre réponse',
  'tasks.anythingToTell': 'Quelque chose à dire à l’organisateur ?',
  'tasks.reviewNote': 'Un organisateur l’examine et peut la renvoyer avec des notes.',
  'tasks.allIn': 'Rien ne vous attend — tout ce qui vous a été demandé est arrivé.',
  'tasks.fillFirst': 'Il n’y a rien à envoyer — remplissez d’abord ceci.',
  'tasks.sendFailed': 'Cela n’a pas pu être envoyé. Réessayez.',
  'tasks.optional': 'Facultatif',
  'tasks.onePerLine': 'Un élément par ligne',
  'tasks.wherePh': 'Où cela se passe — un lieu, une adresse, une salle',
  'budget.heading': 'Budget',
  'budget.drawnOn': 'Prélevé sur',
  'budget.budgeted': 'Budgété',
  'budget.claimed': 'Réservé par les tâches',
  'budget.inTheFund': 'Dans le fonds',
  'budget.noFund': 'Aucun fonds n’y est encore rattaché',
  'budget.plansToSpend': 'Ce que ce rassemblement prévoit de dépenser',
  'budget.notSet': 'Personne n’a fixé de budget',
  'budget.noLines': 'Aucune tâche ne porte de ligne budgétaire',
  'budget.over': 'Au-delà du budget',
  'budget.unallocated': 'Non affecté',
  'budget.setToSee': 'Fixez un budget pour voir ce qu’il reste',
  'budget.linesExceed': 'Les lignes des tâches réclament plus que le budget',
  'budget.stillToHandOut': 'Reste à attribuer à une tâche',
  'budget.nothingElse': 'Rien d’autre ne le réclame',
  'budget.balanceUnavailable': 'Le solde n’était pas disponible',
  'budget.help': 'Comment fonctionne le budget d’un rassemblement',

  // ── MEETING MINUTES ──────────────────────────────────────────────────────────────
  // *Réunion* for the proceeding and *procès-verbal* for its minutes — and *réunion* is
  // therefore forbidden in `gath.*`, which is *rassemblement*.
  'meet.heading': 'Procès-verbaux',
  'meet.schedule': 'Planifier une réunion',
  'meet.scheduleAction': 'Planifier la réunion',
  'meet.scheduling': 'Planification…',
  'meet.none': 'Aucune réunion pour l’instant.',
  'meet.minuted': 'Consigné',
  'meet.everybodyTold':
    'Toutes les personnes présentes sont prévenues et l’ont dans leur calendrier.',
  'meet.step.basics': 'L’essentiel',
  'meet.step.whoIsComing': 'Qui participe',
  'meet.step.anybodyElse': 'Quelqu’un d’autre',
  'meet.titlePh': 'Réunion trimestrielle du bureau',
  'meet.startTime': 'Heure de début',
  'meet.endTime': 'Heure de fin',
  'meet.timezone': 'Fuseau horaire',
  'meet.chooseTimezone': 'Choisissez un fuseau horaire…',
  'meet.optional': 'Facultatif.',
  'meet.startFirst': 'Indiquez d’abord une heure de début.',
  'meet.secretaryLabel': 'Qui rédige le procès-verbal ?',
  'meet.secretaryHint':
    'Une personne adulte, et vous par défaut. Seule cette personne peut écrire dans cette '
    + 'réunion, et seulement jusqu’à sa clôture.',
  'meet.noAdults': 'Cette famille n’a encore aucun membre adulte enregistré.',
  'meet.kindQuestion': 'De quel type de réunion s’agit-il ?',
  'meet.kind.family': 'Tous les adultes de la famille.',
  'meet.kind.chapter': 'Tout le monde dans une section, avec ou sans fonction.',
  'meet.kind.board':
    'Toutes les personnes occupant une fonction dans un conseil — national, d’une région ou '
    + 'd’une section.',
  'meet.kind.position':
    'Une même fonction dans chaque secteur qui la pourvoit — chaque présidence de section, '
    + 'par exemple.',
  'meet.kind.named': 'Seulement les personnes que je nomme',
  'meet.kind.namedHint': 'Personne au départ. Vous les ajoutez à l’étape suivante.',
  'meet.boardHint': 'Toutes les personnes y occupant une fonction, telle qu’elle est aujourd’hui.',
  'meet.positionHint': 'Pris dans chaque région ou section qui la pourvoit.',
  'meet.chapterHint': 'Chaque adulte y étant enregistré. C’est toute la section, pas son conseil.',
  'meet.anybodyElse': 'Quelqu’un d’autre (facultatif)',
  'meet.anybodyElseHint':
    'Adultes seulement. Toutes les personnes présentes sont prévenues, l’ont dans leur '
    + 'calendrier et peuvent voter sur ses sujets.',
  'meet.nobodyYetNextStep':
    'Personne n’est encore présent. Ajoutez-les par leur nom à l’étape suivante.',
  'meet.nobodyYet': 'Personne n’est encore présent.',
  'meet.oneAdult': 'Cela fait 1 adulte.',
  'meet.needTitle': 'Donnez un titre à la réunion',
  'meet.needDate': 'Choisissez une date',
  'meet.needStart': 'Indiquez aussi une heure de début, ou laissez l’heure de fin vide',
  'meet.endAfterStart': 'L’heure de fin doit être après l’heure de début',
  'meet.needZone': 'Choisissez le fuseau horaire de cette heure',
  'meet.needSecretary': 'Choisissez qui rédige le procès-verbal',
  'meet.needKind': 'Choisissez le type de réunion',
  'meet.needBoard': 'Choisissez au moins un conseil',
  'meet.needPosition': 'Choisissez au moins une fonction',
  'meet.needChapter': 'Choisissez au moins une section',
  'meet.scheduleFailed': 'Cette réunion n’a pas pu être planifiée.',
  'meet.noBoards':
    'Personne n’occupe encore de fonction au conseil — configurez les fonctions dans Membres '
    + '→ Organisation.',
  'meet.noPositions':
    'Aucune fonction n’est encore pourvue — configurez-les dans Membres → Organisation.',
  'meet.noChapters': 'Aucune section n’a encore quelqu’un d’enregistré.',
  'meet.minutesBy': 'Procès-verbal par',
  'meet.closeMinutes': 'Clore le procès-verbal',
  'meet.reopen': 'Réouvrir',
  'meet.nobodyOnList': 'Personne n’est sur la liste.',
  'meet.topics': 'Sujets',
  'meet.addTopic': 'Ajouter un sujet',
  'meet.addTopicAction': 'Ajouter le sujet',
  'meet.whatTopic': 'Quel est le sujet ?',
  'meet.topicPh': 'Approuver le budget du rassemblement',
  'meet.topicTitleLabel': 'Titre du sujet',
  'meet.notePh': 'Ce qui a été dit, et ce qui a été convenu',
  'meet.renameTopic': 'Renommer ce sujet',
  'meet.deleteTopicTitle': 'Supprimer ce sujet',
  'meet.deleteTopic': 'Supprimer le sujet',
  'meet.voteFinal':
    'Votre vote est définitif dès qu’il est exprimé — il ne peut être ni modifié ni retiré.',
  'meet.onlyAttendees':
    'Seules les personnes sur la liste des participants peuvent voter dans cette réunion.',
  'meet.vote.for': 'Pour',
  'meet.vote.against': 'Contre',
  'meet.vote.abstain': 'Abstention',
  'meet.theVote': 'Le vote',
  'meet.noVote': 'Aucun vote convoqué',
  'meet.closeVote': 'Clore le vote',
  'meet.callVote': 'Convoquer un vote',
  'meet.callVoteHint':
    'Convoquez un vote et toutes les personnes présentes peuvent répondre. Un vote ne peut '
    + 'pas être modifié une fois exprimé.',
  'meet.noVoteCalled': 'Le secrétaire n’a pas convoqué de vote sur ce sujet.',
  'meet.voteOpen': 'Vote ouvert',
  'meet.voteClosed': 'Vote clos',
  'meet.closeConfirmTitle': 'Clore ce procès-verbal',
  'meet.reopenConfirmTitle': 'Réouvrir ce procès-verbal',
  'meet.closeConfirmBody':
    'Rien ne change dans cette réunion après sa clôture — plus de sujets, plus de notes et '
    + 'plus de votes. Elle peut être réouverte.',
  'meet.reopenConfirmBody':
    'La réouverture permet au secrétaire d’écrire de nouveau. Les votes déjà exprimés restent '
    + 'exactement tels quels ; personne ne peut les modifier.',
  'meet.deleteMeetingBody':
    'Toute la réunion disparaît — ses sujets, son procès-verbal et chaque vote qui y a été '
    + 'exprimé. Cette action est irréversible.',
  'meet.deleteMeeting': 'Supprimer la réunion',
  'meet.deleteTopicBody': 'Ceci supprime le sujet et ses notes. Cette action est irréversible.',
  'meet.nothingMinuted':
    'Rien n’est encore consigné. Ajoutez un sujet, puis écrivez des notes en dessous.',
  'meet.nothingMinutedShort': 'Rien n’a encore été consigné.',
  'meet.noLongerInFamily': 'Une personne qui n’est plus dans cette famille',
  'meet.deleteFailed': 'Cela n’a pas pu être supprimé.',
  'meet.addFailed': 'Cela n’a pas pu être agregado.',
  'meet.renameFailed': 'Cela n’a pas pu être renommé.',
  'meet.saveFailed': 'Cela n’a pas pu être enregistré.',
  'meet.needTopicTitle': 'Donnez un titre au sujet',
  'meet.wentWrong': 'Une erreur est survenue.',
  'meet.back': 'Retour',
  'meet.next': 'Suivant',
  'meet.deleteTopicVotesOne':
    'Ceci supprime le sujet, ses notes et le seul vote exprimé sur lui. Supprimer la question '
    + 'est la seule façon de retirer un vote. Cette action est irréversible.',
  'meet.deleteTopicVotesMany':
    'Ceci supprime le sujet, ses notes et les {n} votes exprimés sur lui. Supprimer la '
    + 'question est la seule façon de retirer un vote. Cette action est irréversible.',
  'meet.kind.familyLabel': 'Une réunion générale de la famille',
  'meet.kind.chapterLabel': 'Une réunion de section',
  'meet.kind.boardLabel': 'Une réunion du conseil',
  'meet.kind.positionLabel': 'Une réunion par fonction',
}
