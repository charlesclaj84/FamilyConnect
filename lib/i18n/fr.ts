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
}
