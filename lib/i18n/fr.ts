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
  'nav.item./reporting/transactions': 'Transactions',

  'nav.item./reporting/membership': 'Adhésions',
  'nav.item./accounting/payment-history': 'Historique des paiements',
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

  'switcher.badge.removedShort': 'Retirée',
  'switcher.badge.pendingShort': 'En attente',
  'switcher.badge.defaultShort': 'Défaut',
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
  'language.choose': 'Choisissez une langue',
  'language.changeFailed': 'Impossible de changer la langue.',
  // ── BATCH 1 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // Found by rendering every route as a Spanish-reading member and again as an English
  // one and diffing the visible text — see the note above `i18n:literals`' ceiling on why
  // a static scan could not see these. `field.required` is the sharpest of them: it is
  // read aloud beside the asterisk on EVERY required field in the product.
  'field.required': '(obligatoire)',
  'dash.viewDirectory': 'Voir l’annuaire',
  'dash.reviewQueue': 'File d’attente',
  'dash.viewCalendar': 'Voir le calendrier',
  'dash.election.nominations': 'Proposer',
  'dash.election.voting': 'Voter',
  'dash.selectYourChapter': '— Choisissez votre section —',
  'gath.comingUp': 'À venir',
  'gath.alreadyHeld': 'Déjà tenues',
  'gath.nothingPlannedYet': 'Rien n’est encore prévu.',
  'gath.nothingHeldYet': 'Rien ne s’est encore tenu.',
  'cards.nextInstallmentOne': 'Prochaine échéance',
  'cards.nextInstallmentsMany': 'Prochaines échéances',
  // ── BATCH 2 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // `tree.bloodlineFrom*` is the one worth reading: it was six JSX fragments spliced
  // around two names, which hard-codes ENGLISH WORD ORDER and cannot be translated at
  // all. One key with `{anchor}` and `{parents}` lets each language put the names where
  // that language puts them.
  'dash.tree.leafOne': 'Feuille',
  'dash.tree.leavesMany': 'Feuilles',
  'plan.perMonthNoAnnual': ' /mois · pas de forfait annuel',
  'set.removalKeepsEverything': 'Chaque paiement, fonds, photographie, événement, message et personne reste exactement où il est. Retirer n’est pas une façon d’effacer quoi que ce soit, et ce n’est pas quelque chose que vous pouvez annuler d’ici :',
  'set.onlySupportRestores': 'seul le support GENORRA peut rétablir une famille.',
  'tree.dashedCardsAreGaps': '· Les cartes en pointillés sont des vides que vous pouvez combler',
  'tree.removingNeverRemoves': '· Retirer un lien ne retire jamais personne de la famille',
  // ── THE TRANSACTIONS LEDGER, 2026-08-29 ────────────────────────────────────
  // This screen carried a note saying it was "not translated yet — on Phase 5's admin
  // pass", and it was the densest concentration of English left in the product: every
  // field label in the detail dialog, every validator refusal, and both module-level
  // registries. `tx.reverseConfirm` is one key rather than the five concatenated clauses
  // it replaced — a sentence spliced around two figures and a name hard-codes English
  // word order and cannot be translated at all.
  'tx.newDuesPayment': 'Nouveau paiement de cotisation',
  'tx.newDonationPayment': 'Nouveau paiement de don',
  'tx.source.dues_routing': 'Réparti',
  'tx.source.admin_manual': 'Enregistré',
  'tx.source.member_contribution': 'D’un membre',
  'tx.noLongerInFamily': 'Ne fait plus partie de la famille',
  'tx.donationPayment': 'Paiement de don',
  'tx.duesPayment': 'Paiement de cotisation',
  'tx.unknownMember': 'Membre inconnu',
  'tx.correctingEntry': '{kind} — écriture de correction',
  'tx.correctingEntryPill': 'Écriture de correction',
  'tx.amount': 'Montant',
  'tx.amountDollars': 'Montant ($)',
  'tx.schedule': 'Barème',
  'tx.noSchedule': 'Aucun barème',
  'tx.entered': 'Saisi le',
  'tx.reversed': 'Annulé',
  'tx.reverse': 'Annuler',
  'tx.reversedByCorrecting': 'Oui — une écriture de correction annule ce paiement',
  'tx.corrects': 'Corrige',
  'tx.correctsEarlierPayment': 'Un paiement antérieur dans ce registre',
  'tx.routedFromPayment': 'Réparti depuis un paiement',
  'tx.fundContribution': 'Contribution au fonds — {source}',
  'tx.unknownFund': 'Fonds inconnu',
  'tx.fundDisbursement': 'Décaissement du fonds',
  'tx.milestone': 'Étape',
  'tx.fundTransfer': 'Virement entre fonds — argent déplacé au sein de la famille',
  'tx.fromLabel': 'De',
  'tx.toLabel': 'À',
  'tx.reason': 'Motif',
  'tx.recipient': 'Bénéficiaire',
  'tx.reverseThisPayment': 'Annuler ce paiement',
  'tx.thisMember': 'ce membre',
  'tx.reverseConfirm': 'Enregistrer une écriture de correction de {credit} sur le paiement de {amount} de {member} ? L’original reste au registre — annuler est la façon de corriger une erreur, car un paiement enregistré ne peut être ni modifié ni supprimé. Tout l’argent que ce paiement a réparti dans les fonds est repris sur ces mêmes fonds.',
  'tx.postReversal': 'Enregistrer l’annulation',
  'tx.failedToReverse': 'Échec de l’annulation',
  'tx.memberScheduleAmountRequired': 'Membre, barème et montant obligatoires',
  'tx.chooseHowPaymentMade': 'Choisissez comment le paiement a été fait',
  'tx.enterCheckPayment': 'Saisissez le numéro de chèque ou la référence du paiement',
  'tx.fundAndAmountRequired': 'Fonds et montant obligatoires',
  'tx.chooseWhoContributionFrom': 'Choisissez de qui vient la contribution',
  'tx.nameWhoContributionFrom': 'Indiquez de qui vient la contribution',
  'tx.chooseHowContributionGiven': 'Choisissez comment la contribution a été remise',
  'tx.enterCheckContribution': 'Saisissez le numéro de chèque ou la référence de la contribution',
  'tx.fundMemberAmountRequired': 'Fonds, membre et montant obligatoires',
  'tx.enterCheckDisbursement': 'Saisissez le numéro de chèque ou la référence du décaissement',
  'tx.bothFundsAmountRequired': 'Les deux fonds et un montant sont obligatoires',
  'tx.chooseTwoDifferentFunds': 'Choisissez deux fonds différents',
  'tx.sayWhyMoneyMoved': 'Indiquez pourquoi l’argent est déplacé',
  'tx.enterAmountAboveZero': 'Saisissez un montant supérieur à zéro',
  'tx.selectMember': '— Choisissez un membre —',
  'tx.selectFund': '— Choisissez un fonds —',
  'tx.selectMethod': '— Choisissez un moyen —',
  'tx.selectOne': '— Choisissez —',
  'tx.selectNone': '— Aucun —',
  'tx.recording': 'Enregistrement…',
  'tx.recordPayment': 'Enregistrer le paiement',
  'tx.addContribution': 'Ajouter la contribution',
  'tx.recordDisbursement': 'Enregistrer le décaissement',
  'tx.transferring': 'Virement en cours…',
  'tx.transferFunds': 'Virer les fonds',
  'tx.transactionLedgers': 'Registres des transactions',
  'tx.recordGiftLede': 'Enregistrez un don qu’un membre a déjà remis.',
  'tx.recordDuesLede': 'Enregistrez des cotisations qu’un membre a déjà payées.',
  'tx.contributionLede': 'Argent ajouté directement à un fonds, en dehors de la répartition des cotisations.',
  'tx.disbursementLede': 'Argent versé d’un fonds à un membre.',
  'tx.transferLede': 'Déplacez de l’argent d’un fonds à un autre. Rien ne quitte la famille.',
  'tx.noDonationsYet': 'Aucun don reçu pour le moment.',
  'tx.noDuesPaymentsYet': 'Aucun paiement de cotisation enregistré pour le moment.',
  // ── BATCH 3 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // The rail's motto is the one worth a note: it was read straight out of `lib/brand.ts`,
  // so the single piece of writing a member sees on EVERY screen was English for every
  // reader. Same call `FeatureShowcase` records about `APP_PROMISE` — the brand file keeps
  // the product's name, and finished prose a reader reads belongs here.
  'ledger.dues': 'Cotisations',
  'ledger.donations': 'Dons',
  'ledger.contributions': 'Contributions',
  'ledger.disbursements': 'Décaissements',
  'ledger.transfers': 'Virements',
  'nav.menu': 'Menu',
  'brand.motto.lead': 'Nos racines',
  'brand.motto.rest': 'sont profondes, notre lien l’est plus encore.',
  // ── CONNECT: WHERE A FAMILY BANKS ──────────────────────────────────────────
  // `country.<iso>` is keyed on the alpha-2 code because that is what
  // `identity.country` takes and what `family_stripe_accounts.country` stores — the id is
  // the contract and the name is copy. Only the ENABLED countries are here; enabling one
  // in `lib/stripe/connect-countries.ts` owes three lines in this file, and `i18n:check`
  // names the missing one rather than letting the picker print a key.
  'proc.countryLabel': 'Où la famille a sa banque',
  'proc.countryPermanent': 'Stripe ne peut pas modifier ceci après la création du compte : cela décide de la devise des versements et des documents qui vous seront demandés.',
  'proc.countryDecidesCurrency': 'Les cotisations, les fonds et les budgets de votre famille seront enregistrés en {currency}.',
  'proc.currencyFixedByAccount': 'Votre famille encaisse en {currency} ({country}). Stripe ne peut pas déplacer un compte connecté vers un autre pays : ce choix est définitif.',
  'proc.currencyFixedByPayments': 'Votre famille encaisse en {currency} ({country}). Des paiements ont déjà été enregistrés et le registre ne peut pas être redénominé : ce choix est définitif.',
  'act.countryNotAvailableForDues': 'La collecte des cotisations en ligne n’est pas encore disponible dans ce pays.',
  'notify.announcement.title': 'Un nouvel avis a été publié',
  'notify.announcement.body': '{title}.',
  'notify.membershipRequest.title': 'Une nouvelle demande attend une approbation',
  'notify.membershipRequest.body': '{who} a demandé à rejoindre {family}.',
  'notify.membershipAppeal.title': 'Une demande refusée a fait l’objet d’un recours',
  'notify.membershipAppeal.body': '{who} a demandé à la famille de réexaminer sa demande.',
  'notify.membershipAppeal.bodyNote':
    '{who} a demandé à la famille de réexaminer sa demande : « {note} »',
  'notify.membershipApproved.title': 'Votre demande a été approuvée',
  'notify.membershipRejected.title': 'Votre demande d’adhésion a été refusée',
  'notify.taskAssigned.title': 'Vous avez une nouvelle tâche de rassemblement',
  'notify.taskAssigned.body': '{what}.',
  'notify.taskAssigned.bodyDue': '{what}, pour le {due}.',
  'notify.taskSubmitted.title': 'Une tâche de rassemblement attend une relecture',
  'notify.taskSubmitted.body': '{who} a envoyé « {task} » pour {gathering}.',
  'notify.taskApproved.title': 'Une tâche de rassemblement a été approuvée',
  'notify.taskApproved.body': '{what} a été approuvée.',
  'notify.taskApproved.bodyNotes': '{what} a été approuvée : « {notes} »',
  // « Renvoyée », jamais « refusée » : voir la note dans la version anglaise — la tâche est
  // de nouveau ouverte et on demande une modification, on ne juge pas la personne.
  'notify.taskDenied.title': 'Une tâche de rassemblement est à revoir',
  'notify.taskDenied.body': '{what} a été renvoyée pour une nouvelle relecture.',
  'notify.taskDenied.bodyNotes': '{what} a été renvoyée avec des notes : « {notes} »',
  'notify.taskReopened.title': 'Une tâche de rassemblement a été rouverte',
  'notify.taskReopened.body':
    '{what} avait été approuvée et a été rouverte. Votre réponse précédente est toujours là.',
  'notify.taskReopened.bodyReason':
    '{what} avait été approuvée et a été rouverte : « {reason} ». Votre réponse précédente est '
    + 'toujours là.',
  'notify.meeting.title': 'Vous êtes attendu à une réunion',
  'notify.meeting.body': '{title}. C’est dans votre calendrier.',
  'notify.meeting.bodyWhen': '{title} le {when}. C’est dans votre calendrier.',
  'notify.safety.title': 'Êtes-vous en sécurité ?',
  'notify.safety.body': '{title} : votre famille vous demande de confirmer que tout va bien.',
  'notify.chatDm.title': 'Nouveau message de {sender}',
  'notify.chatGroup.title': '{room} — nouveau message de {sender}',
  'notify.chatFamily.title': 'Chat de la famille — nouveau message de {sender}',
  'plan.featuresInPlan': 'Ce que comprend {plan}',
  'gath.status.planning': 'En préparation',
  'gath.status.scheduled': 'Programmé',
  'gath.status.complete': 'Terminé',
  'gath.status.cancelled': 'Annulé',
  'gath.taskStatus.open': 'Pas commencé',
  'gath.taskStatus.submitted': 'En attente de relecture',
  'gath.taskStatus.approved': 'Approuvé',
  'gath.taskStatus.denied': 'À revoir',
  'acct.rail.funds': 'Fonds',
  'dash.tree.memberOne': 'Membre',
  'dash.tree.memberMany': 'Membres',
  'act.nothingWithheldToLetGo': 'Aucune donnée conservée à supprimer.',
  'act.couldNotDeleteRecordsPlease': 'Ces données n’ont pas pu être supprimées. Veuillez réessayer.',
  'act.thatCodeNotRight': 'Ce code n’est pas correct.',
  'act.enterSixDigitCode': 'Saisissez le code à six chiffres reçu par courriel.',
  'ret.heading': 'Données de votre ancienne offre',
  'ret.p1': 'Votre famille est passée sous {tier}. Tout ce que cette offre incluait a été conservé plutôt que supprimé, et sera supprimé dans {days} jours.',
  'ret.p1One': 'Votre famille est passée sous {tier}. Tout ce que cette offre incluait a été conservé plutôt que supprimé, et sera supprimé demain.',
  'ret.p1Today': 'Votre famille est passée sous {tier}. Tout ce que cette offre incluait doit être supprimé aujourd’hui.',
  'ret.overdue': 'La suppression a {days} jours de retard et attend un rappel qui n’a pas été envoyé. Rien n’a été supprimé.',
  'ret.keep': 'Revenez à {tier} pour le conserver. Cela couvre les {months} mois d’absence et le mois à venir — {amount}.',
  'ret.freshHeading': 'Ou supprimez-le maintenant',
  'ret.fresh': 'Si votre décision est prise, vous pouvez supprimer ces données aujourd’hui plutôt que d’attendre et de recevoir quatre rappels de plus.',
  'ret.freshButton': 'Supprimer ces données…',
  'ret.irreversible': 'Les données supprimées ne peuvent pas être récupérées. Cela ne peut être annulé ni par nous ni par personne d’autre.',
  'ret.willDelete': 'Cela supprimera :',
  'ret.rows': '{n} ligne(s) dans {table}',
  'ret.codeSent': 'Un code à six chiffres a été envoyé à {email}. Il est valable {minutes} minutes.',
  'ret.codeLabel': 'Code reçu par courriel',
  'ret.confirmButton': 'Supprimer ces données définitivement',
  'ret.done': 'Ces données ont été supprimées.',
  'lock.admin.heading': 'Le paiement de votre famille est en retard',
  'lock.admin.p1Members': 'Le dernier paiement pour {family} n’a pas abouti : les proches ne peuvent donc plus utiliser le site. Vous conservez l’accès complet, et le paiement le rétablit pour tout le monde d’un coup.',
  'lock.admin.p1All': 'Le dernier paiement pour {family} n’a pas abouti : tous les écrans sauf la facturation sont fermés. Le paiement les rouvre tous.',
  'lock.admin.nothingLost': 'Rien n’a été supprimé. Tout ce que la famille a saisi est exactement là où c’était.',
  'lock.admin.warnOne': 'Demain, la famille passe à l’offre Gratuite et tout ce que l’offre Gratuite n’inclut pas est supprimé. Cela est irréversible.',
  'lock.admin.warnMany': 'Dans {days} jours, la famille passe à l’offre Gratuite et tout ce que l’offre Gratuite n’inclut pas — l’arbre généalogique, le registre des cotisations, les fonds et les photographies — est supprimé. Cela est irréversible.',
  'lock.admin.button': 'Aller à la facturation',
  'lock.member.heading': '{family} est temporairement indisponible',
  'lock.member.p1': 'Un problème comptable affecte le compte de cette famille. Veuillez contacter l’administrateur de votre famille.',
  'lock.member.p2': 'Rien n’a été supprimé, et tout revient dès que la situation est réglée.',
  'lock.otherFamilies': 'Vos autres familles ne sont pas concernées —',
  'lock.myFamilies': 'Mes familles',
  'act.chooseKeepOrStartFresh': 'Choisissez de conserver les données de votre ancienne offre ou de repartir de zéro avant de continuer.',
  'act.nothingWithheldToKeep': 'Aucune donnée conservée que cette offre pourrait rétablir.',
  'bill.catchUpLine': '{plan} — {months} mois d’absence, plus le mois à venir',
  'act.countryAndCurrencySaved': 'Enregistré. Votre famille encaisse dans la devise de ce pays.',
  'act.couldNotReadFamilyCurrency': 'Nous n’avons pas pu déterminer la devise dans laquelle votre famille encaisse ; ce paiement n’a pas été lancé. Veuillez réessayer.',
  'act.currencyFixedByPayments': 'Votre famille a déjà enregistré des paiements : son pays et sa devise ne peuvent plus être modifiés.',
  'act.currencyFixedByAccount': 'Le compte de paiement de votre famille a déjà été créé : son pays et sa devise ne peuvent plus être modifiés.',
  'country.us': 'États-Unis',
  'country.ca': 'Canada',
  'country.mx': 'Mexique',
  // ── THE STAFF CONSOLE'S DESTRUCTIVE HALF, 2026-08-31 ───────────────────────
  // Two irreversible acts and one read-only screen. `stf.sub*` is the platform's OWN
  // revenue and never a family's dues — the two ledgers must not meet, and a caption
  // here that blurred them would be quoted.
  'staff.subscriptions': 'Abonnements',
  'stf.subscriptionsReadFailed': 'Nous n’avons pas pu lire les enregistrements de facturation à l’instant. Aucun plan de famille n’est en cause — rafraîchissez la page, et si cela persiste ces chiffres ne sont pas à citer.',
  'stf.subPaying': 'Payantes aujourd’hui',
  'stf.subMrr': 'Mensuel',
  'stf.subMrrHint': 'Forfaits récurrents seulement',
  'stf.subLifetime': 'Encaissé à ce jour',
  'stf.subLifetimeShort': 'À ce jour',
  'stf.subAttention': 'À surveiller',
  'stf.subAttentionHint': '{delinquent} en échec, {leaving} partent',
  'stf.subNoneYet': 'Aucune famille n’est encore arrivée au paiement.',
  'stf.tierMixHeading': 'Familles par formule',
  'stf.tierMixHint': 'Toutes les familles de la plateforme, comptées selon la formule en vigueur, et pas seulement celles qui ont payé.',
  'stf.sortOrdersThisPage': 'Le tri s’applique aux lignes de cette page, pas à la liste entière.',
  'stf.subFamily': 'Famille',
  'stf.subPlan': 'Forfait',
  'stf.subPaidThrough': 'Payé jusqu’au',
  'stf.subStanding': 'Situation',
  'stf.subPaidFor': 'A payé pour {tier}',
  'stf.subMode.recurring': 'Mensuel',
  'stf.subMode.prepaid': 'Période prépayée',
  'stf.subScheduled': '{tier} à partir du {on}',
  'stf.subDelinquentSince': 'Paiement échoué le {on}',
  'stf.subLeaving': 'Non renouvelé',
  'stf.subNeverPaid': 'Jamais payé',
  'stf.subPaid': 'Payé',
  'staff.deleteForever': 'Supprimer…',
  'staff.deleteForeverConfirm': 'Supprimer définitivement',
  'staff.deleting': 'Suppression…',
  'staff.deleteFamilyTitle': 'Supprimer {name} ?',
  'staff.deleteFamilyLede': '{code} · {members} membres. C’est définitif et il n’y a pas de restauration.',
  'staff.deleteFamilyWhatGoes': 'Chaque personne, paiement, fonds, photographie, document, message, rassemblement, élection et réunion de cette famille est détruit, avec ses fichiers. Les comptes ne sont pas supprimés — un membre d’une autre famille garde le sien.',
  'staff.deleteWhyLabel': 'Pourquoi',
  'staff.deleteWhyPlaceholder': 'Le ticket, et qui l’a demandé',
  'staff.deleteWhyHint': 'Conservé définitivement. C’est le seul enregistrement qui survit à ceci.',
  'staff.deleteTypeCodeLabel': 'Tapez {code} pour confirmer',
  'staff.deleteEmailedLabel': 'Code à six chiffres',
  'staff.deleteSendCode': 'M’envoyer un code',
  'staff.deleteAccount': 'Supprimer…',
  'staff.deleteAccountConfirm': 'Supprimer ce compte',
  'staff.deleteAccountTitle': 'Supprimer ce compte ?',
  'staff.deleteAccountLede': '{email} ne pourra plus se connecter, et l’adresse redevient disponible pour une inscription.',
  'staff.deleteAccountKeeps': 'Leurs {families} familles les gardent sur l’arbre, dans l’annuaire et dans chaque registre — comme un parent sans compte. Rien n’est supprimé d’aucune famille.',
  'staff.deleteAccountKeepsNone': 'Ce compte n’appartient à aucune famille, il n’y a donc rien d’autre à conserver.',
  'staff.deleteAccountWhyPlaceholder': 'Le ticket, et qui l’a demandé',
  'staff.deleteTypeAddressLabel': 'Tapez l’adresse pour confirmer',
  'staff.noAddress': 'Aucune adresse',
  'staff.actions': 'Actions',
  'act.couldNotReadThatFamily': 'Nous n’avons pas pu lire cette famille. Réessayez.',
  'act.couldNotReadProcessor':
    'Nous n’avons pas pu lire vos informations de traitement des paiements. Réessayez.',
  'act.noFamilyWithThatCode': 'Aucune famille avec ce code.',
  'act.couldNotEmailYouCode': 'Nous n’avons pas pu vous envoyer un code par courriel. Réessayez.',
  'act.codeEmailedToYou': 'Un code à six chiffres est en route vers votre boîte de réception.',
  'act.typeFamilyCodeToConfirm': 'Tapez le code de la famille exactement pour confirmer.',
  'act.sayWhyFamilyDeleted': 'Indiquez pourquoi cette famille est supprimée.',
  'act.couldNotCheckThatCode': 'Nous n’avons pas pu vérifier ce code. Réessayez.',
  'act.couldNotDeleteThatFamily': 'Nous n’avons pas pu supprimer cette famille. Rien n’a été modifié.',
  'act.deleteReturnedNoResult': 'Cela n’a renvoyé aucun résultat. Vérifiez avant de réessayer.',
  'act.familyDeletedPermanently': '{code} n’existe plus. {rows} enregistrements ont été détruits.',
  'act.someObjectsRemain': 'Certains fichiers n’ont pas pu être supprimés et sont désormais orphelins : {detail}',
  'act.typeAddressToConfirm': 'Tapez l’adresse exactement pour confirmer.',
  'act.sayWhyAccountDeleted': 'Indiquez pourquoi ce compte est supprimé.',
  'act.couldNotDeleteThatAccount': 'Nous n’avons pas pu supprimer ce compte. Rien n’a été modifié.',
  'act.accountDeleted': '{email} ne peut plus se connecter.',
  'act.couldNotStopSubscriptions': 'Rien n’a été supprimé. Cette famille a encore des abonnements actifs sur Stripe qui n’ont pas pu être résiliés, et la supprimer laisserait ces prélèvements se poursuivre sans aucune trace de leur propriétaire. Corrigez cela sur Stripe, puis demandez un nouveau code.',
  'act.stoppedDuesOne': 'Un paiement récurrent de cotisations a été résilié sur Stripe.',
  'act.stoppedDuesMany': '{n} paiements récurrents de cotisations ont été résiliés sur Stripe.',
  'act.stoppedGenorraPlan': 'Le forfait GENORRA de la famille a été résilié.',
  'act.couldNotStopSubscriptionsRemoval': 'La famille n’a pas été retirée. Nous n’avons pas pu résilier ses abonnements sur Stripe, et la retirer laisserait ces paiements en cours sans que personne puisse accéder à l’écran qui les arrête. Réessayez dans quelques minutes avec un nouveau code.',
  'act.couldNotStopDuesFirst': 'Rien n’a été supprimé. Nous n’avons pas pu résilier au préalable les paiements récurrents de cotisations de vos membres sur Stripe, et supprimer les enregistrements laisserait ces paiements en cours sans rien pour indiquer à quoi ils correspondaient. Réessayez dans quelques minutes avec un nouveau code.',
  'set.removalStopsBilling': 'La facturation s’arrête, et cette partie est irréversible.',
  'set.removalBillingBody': 'Votre forfait GENORRA ne sera pas renouvelé : il court jusqu’à la fin de la période déjà payée, et rien n’est remboursé. Chaque membre qui paie ses cotisations automatiquement voit ce paiement résilié immédiatement. Restaurer la famille rétablit tous les enregistrements, mais ne peut pas rétablir ces paiements automatiques : chaque membre devrait le reconfigurer.',
  'stf.deleteStopsBilling': 'Tous les paiements récurrents de cette famille sont d’abord résiliés sur Stripe : les cotisations automatiques des membres sur le compte de la famille, et le forfait GENORRA de la famille sur le nôtre. Si l’un d’eux ne peut pas être arrêté, rien n’est supprimé.',
  // ── BIRTHDAYS, 2026-08-31 ──────────────────────────────────────────────────
  // `birthday.familyPosted` and `birthday.fromUs` are NOT interchangeable and must not
  // be merged: the first says the family spoke and the second says only that we did.
  // The whole design turns on never claiming the first when nobody wrote anything —
  // see 20260831000002's header.
  'birthday.today': 'Aujourd’hui',
  'birthday.heroGreeting': 'Joyeux anniversaire, {name} !',
  'birthday.familyPosted': 'Votre famille vous a publié un message.',
  'birthday.fromUs': 'De toute l’équipe GENORRA — nous espérons que votre famille vous gâtera aujourd’hui.',
  'birthday.readIt': 'Le lire',
  'birthday.promptHeading': 'Quelqu’un a bientôt son anniversaire',
  'birthday.promptLede': 'Dans les {days} prochains jours, et personne n’a encore rien dit. Ce que vous écrivez est ce que la famille publie — nous ne l’écrivons jamais à votre place.',
  'birthday.promptReadFailed': 'Nous n’avons pas pu vérifier qui a bientôt son anniversaire. Rafraîchissez la page.',
  'birthday.isToday': 'Aujourd’hui',
  'birthday.inDays': 'Dans {days} jours · {on}',
  'birthday.saySomething': 'Écrire un mot',
  'birthday.notThisYear': 'Pas cette année',
  'birthday.notThisYearFor': 'Ranger le rappel d’anniversaire de {name}',
  'birthday.suggestedTitle': 'Joyeux anniversaire, {name} !',
  'birthday.suggestedBody': 'Nous souhaitons à {name} un merveilleux anniversaire, de la part de nous tous.',
  'birthday.editFirst': 'Modifiez ce que vous voulez avant de publier — cela paraît en votre nom, pas au nôtre.',
  'birthday.postGreeting': 'Publier',
  'birthday.posting': 'Publication…',
  'act.chooseRelative': 'Choisissez un parent.',
  'act.greetingPosted': 'Publié. Épinglé sur le tableau de la famille pour les deux prochains jours.',
  'act.greetingPostedNotRecorded': 'Publié — mais nous n’avons pas pu l’enregistrer, il est possible qu’on vous le redemande.',
  'act.promptPutAway': 'Rangé pour cette année.',
  'act.couldNotPostThat': 'Nous n’avons pas pu publier cela. Réessayez.',
  'bill.chooseMonths': 'Choisissez entre 1 et {max} mois.',
  'bill.notOnSale': '{plan} n’est pas encore en vente.',
  'bill.notBuyableThisWay': '{plan} ne peut pas encore être acheté de cette façon.',
  'bill.notBuyableMonthly': '{plan} ne peut pas encore être acheté au mois.',
  'bill.notBuyableYet': '{plan} ne peut pas encore être acheté.',
  'bill.useChangePlanInstead':
    'Passer à {plan} ne coûte rien — utilisez Changer de forfait. Cela prend effet à la fin de la période déjà payée.',
  'bill.tooFewDaysOne':
    'Il ne reste qu’1 jour ce mois-ci, ce qui est un montant trop petit pour être facturé seul. Choisissez l’option qui couvre ce mois et le suivant.',
  'bill.tooFewDaysMany':
    'Il ne reste que {days} jours ce mois-ci, ce qui est un montant trop petit pour être facturé seul. Choisissez l’option qui couvre ce mois et le suivant.',
  'bill.checkoutSubmitCovers':
    '{amount} aujourd’hui vous couvre jusqu’à la fin de {month}. {plan} se renouvelle ensuite à {monthly} par mois, le 1er.',
  'bill.alreadyOnPlan': 'Cette famille est déjà sur {plan}.',
  'bill.startsOnNextBilling':
    '{plan} commence le {on}, la prochaine date de facturation. Rien ne change avant, et il n’y a aucun remboursement pour les jours déjà payés.',
  'bill.effectOnceDifferencePaid':
    '{plan} prend effet dès que le montant supplémentaire est payé. Stripe facture maintenant la différence pour le reste de cette période.',
  'bill.planStopsOn':
    'Le forfait s’arrête le {on}. Toutes les pages restent ouvertes jusque-là. Ce que l’offre '
    + 'moins chère n’inclut pas est conservé soixante jours ensuite, puis supprimé si vous n’êtes '
    + 'pas remonté.',
  'bill.startsOnNoRefund':
    '{plan} commence le {on}. Rien ne change avant, et il n’y a aucun remboursement pour la période déjà payée.',
  'bill.activeNowCredit':
    '{plan} est actif maintenant, payé jusqu’au {through}. Ce qui restait de l’ancienne période — {credit} — est conservé en crédit sur votre prochaine facture.',
  'bill.activeNowExact':
    '{plan} est actif maintenant, payé jusqu’au {through}. La période que vous aviez déjà payée le couvrait exactement.',
  'bill.openingStripeToCollect': 'Ouverture de Stripe pour encaisser {amount}.',
  'bill.priceMisconfigured':
    '{plan} n’est pas configuré correctement pour {way} sur ce déploiement. Rien n’a été facturé. Veuillez le signaler plutôt que de réessayer.',
  'bill.wayMonthly': 'le paiement mensuel',
  'bill.wayInAdvance': 'le paiement à l’avance',
  'tmpl.addStepTo': 'Ajouter une étape à {template}',
  'tmpl.editStepQuoted': 'Modifier « {step} »',
  'tmpl.deleteStepConfirm':
    'Supprimer l’étape « {step} » de {template} ? Toute tâche déjà créée à partir d’elle conserve son libellé, son responsable et sa réponse — seul le modèle perd l’étape. Ceci est irréversible.',
  'tmpl.editTemplateAria': 'Modifier le modèle {template}',
  'tmpl.unarchiveTitle': 'Remettre {template} dans la liste des modèles programmables',
  'tmpl.archiveTitle':
    'Retirer {template} de la liste des modèles programmables, en laissant tous les rassemblements tels quels',
  'tmpl.cannotDeleteUsedOne':
    '{template} a servi à créer 1 rassemblement, il ne peut donc pas être supprimé. Archivez-le à la place.',
  'tmpl.cannotDeleteUsedMany':
    '{template} a servi à créer {n} rassemblements, il ne peut donc pas être supprimé. Archivez-le à la place.',
  'tmpl.deleteTemplateAria': 'Supprimer le modèle {template}',
  'tmpl.editStepAria': 'Modifier l’étape « {step} »',
  'tmpl.moveStepEarlierIn': 'Déplacer « {step} » plus tôt dans {template}',
  'tmpl.moveStepEarlier': 'Déplacer « {step} » plus tôt',
  'tmpl.moveStepLaterIn': 'Déplacer « {step} » plus tard dans {template}',
  'tmpl.moveStepLater': 'Déplacer « {step} » plus tard',
  'tmpl.deleteStepAria': 'Supprimer l’étape « {step} »',
  'plan.downgradeConfirmTitle': 'Rétrograder cette famille vers {plan} ?',
  'plan.whatYouGainOn': 'Ce que vous gagnez avec {plan}',
  'plan.whatYouHaveNowOn': 'Ce que vous avez actuellement avec {plan}',
  'plan.whatYouKeepOn': 'Ce que vous conservez avec {plan}',
  'plan.whatYouGetTitle': '{plan} — ce que vous obtenez',
  'plan.includedInYours': 'Inclus dans {plan}, le forfait de votre famille. Tout ici est activé.',
  'plan.yourFamilyIsOnWhatAdds':
    'Votre famille est sur {current}. Voici ce que {plan} ajouterait, à côté de ce que vous avez déjà.',
  'plan.rateSetUpInBilling':
    '{rate} Cela se configure dans la section Facturation des Paramètres.',
  'plan.rateNoPaymentStep':
    '{rate} Il n’y a pas encore d’étape de paiement — rien ici n’est facturé.',
  'plan.whatPlanAdds': 'Ce que {plan} ajoute',
  'plan.whatPlanIncludes': 'Ce que {plan} comprend',
  'plan.whatYouWouldGainOn': 'Ce que vous gagneriez avec {plan}',
  'plan.alsoIncludedFrom': 'Également inclus, depuis {plan}',
  'perm.scope.none': '—',
  'perm.scope.own': 'Les siens',
  'perm.scope.any': 'Tous',
  'perm.action.view': 'Voir',
  'perm.action.create': 'Créer',
  'perm.action.edit': 'Modifier',
  'perm.action.delete': 'Supprimer',
  'perm.verb.view': 'voir',
  'perm.verb.create': 'créer',
  'perm.verb.edit': 'modifier',
  'perm.verb.delete': 'supprimer',
  'perm.grantedPair': '{action} {scope}',
  'perm.whoMayAction': '{resource} — qui peut {verb}',
  'perm.switchTitle': '{resource} · {verb} · {scope}',
  'access.actionsFor': 'Actions pour {name}',
  'access.applyTemplateConfirm':
    'Placer {name} sur « {template} » ? Son accès devient exactement ce que ce modèle accorde.',
  'access.applyTemplateConfirmReplacing':
    'Placer {name} sur « {template} » ? Son accès devient exactement ce que ce modèle accorde, en remplacement de « {previous} ».',
  'access.enableConfirm':
    'Réactiver l’accès de {name} ? Cette personne retrouve tout ce que son modèle accorde.',
  'access.disableConfirm':
    'Désactiver l’accès de {name} ? Cette personne conserve son compte et son profil, mais ne verra rien de cette famille jusqu’à ce que vous le réactiviez.',
  'access.copyStartsFrom':
    'Le nouveau modèle commence avec exactement ce que {template} accorde aujourd’hui. C’est une copie, pas un lien — modifier l’un ensuite laisse l’autre intact.',
  'access.renameTemplateConfirm':
    'Renommer « {from} » en « {to} » et enregistrer sa description ?',
  'access.saveTemplateConfirm': 'Enregistrer vos modifications sur « {template} » ?',
  'access.templateStillHasOne':
    '« {template} » a encore 1 membre. Déplacez-le d’abord vers un autre modèle.',
  'access.templateStillHasMany':
    '« {template} » a encore {n} membres. Déplacez-les d’abord vers un autre modèle.',
  'access.deleteTemplateConfirm': 'Supprimer « {template} » ? Ceci est irréversible.',
  'access.setGrantConfirm':
    'Régler « {template} » sur {action} {scope} pour {resource} ? {applies}',
  'access.setGrantNotAllowed':
    'Régler « {template} » pour que {resource} n’autorise pas de {verb} ? {applies}',
  'access.appliesToOne': 'Ceci s’applique à l’unique membre du modèle.',
  'access.appliesToMany': 'Ceci s’applique aux {n} membres du modèle.',
  'elec.boardReadFailed':
    'Impossible de lire les fonctions du conseil de cette famille. Réessayez.',
  'elec.level.national': 'national',
  'elec.level.regional': 'régional',
  'elec.level.chapter': 'de section',
  'elec.wrongLevelOne':
    '{titles} n’est pas une fonction {level} du conseil. Une élection {level} ne peut pourvoir que des fonctions {level} — ajoutez la fonction ou modifiez sa portée dans Membres › Organisation d’abord.',
  'elec.wrongLevelMany':
    '{titles} ne sont pas des fonctions {level} du conseil. Une élection {level} ne peut pourvoir que des fonctions {level} — ajoutez les fonctions ou modifiez leur portée dans Membres › Organisation d’abord.',
  'elec.createdWithoutPositions': 'L’élection a été créée mais pas ses fonctions : {error}',
  'elec.savedWithoutPositions': 'L’élection a été enregistrée mais pas ses fonctions : {error}',
  'elec.announceWholeFamily':
    'Une nouvelle élection, « {title} », est ouverte à toute la famille.',
  'elec.announceForArea': 'Une nouvelle élection, « {title} », concerne {where}.',
  'elec.nominationsOpenOn': 'Les candidatures ouvrent le {on}.',
  'elec.cannotUnpublish':
    'Cette élection compte déjà {nominations} candidature(s) et {votes} vote(s), elle ne peut donc pas revenir au brouillon. Laissez-la se dérouler ou supprimez-la — ce qui supprime avec elle toutes les candidatures et tous les votes.',
  'elec.nominationsNotOpenedYet': 'Les candidatures ne sont pas encore ouvertes.',
  'elec.notPublishedYet': 'Cette élection n’a pas encore été publiée.',
  'elec.nominationsClosedOn': 'Les candidatures ont fermé le {on}.',
  'elec.nominationsClosed': 'Les candidatures sont fermées.',
  'elec.votingClosedOn': 'Le vote a fermé le {on}.',
  'elec.votingOpensOn': 'Le vote ouvre le {on}.',
  'elec.votingNotOpen': 'Le vote n’est pas ouvert.',
  'elec.thisPosition': 'cette fonction',
  'elec.standDownFrom': 'Se retirer de {position} ?',
  'elec.retractOthersStayOne':
    '{name} a aussi été proposé par un autre membre, cette personne reste donc sur le bulletin pour {position} — seul votre nom est retiré.',
  'elec.retractOthersStayMany':
    '{name} a aussi été proposé par {n} autres membres, cette personne reste donc sur le bulletin pour {position} — seul votre nom est retiré.',
  'elec.retractOnlySupporter':
    'Vous êtes la seule personne à avoir proposé {name} pour {position}, cette personne sortira donc du bulletin.',
  'elec.standingOne': '1 personne proposée',
  'elec.standingMany': '{n} personnes proposées',
  'elec.toBeElected': '{n} à élire',
  'elec.nominateFor': 'Proposer pour {position}',
  'elec.onlyAreaMayBeNominated': 'Seuls {where} peuvent être proposés dans cette élection.',
  'elec.nobodyInAreaYet': 'Personne dans {where} ne peut encore être proposé.',
  'elec.nominatedByYou': 'proposé par vous',
  'elec.nominatedByYouAndOne': 'proposé par vous et une autre personne',
  'elec.nominatedByYouAndMany': 'proposé par vous et {n} autres',
  'elec.onTheBallot': 'sur le bulletin',
  'elec.nominatedByOne': 'proposé par 1 membre',
  'elec.nominatedByMany': 'proposé par {n} membres',
  'chk.payForPlan': 'Payer {plan}',
  'chk.shortMonthCombinedOne':
    'Il ne reste qu’1 jour ce mois-ci, ce qui est un montant trop petit pour être facturé seul — le premier paiement couvre donc {through}. Le paiement suivant est ensuite {next}.',
  'chk.shortMonthCombinedMany':
    'Il ne reste que {days} jours ce mois-ci, ce qui est un montant trop petit pour être facturé seul — le premier paiement couvre donc {through}. Le paiement suivant est ensuite {next}.',
  'chk.throughDate': 'jusqu’au {date}',
  'chk.nextMonthToo': 'le mois prochain aussi',
  'chk.onTheFirst': 'le 1er',
  'chk.everyPaymentOnFirst':
    'Dans les deux cas, chaque paiement après le premier a lieu le 1er — le prochain {next}.',
  'chk.isDate': 'est le {date}',
  'chk.isFirstOfNextMonth': 'est le 1er du mois prochain',
  'chk.upgradeToPlan': 'Passer à {plan}',
  'chk.payNowAmount': 'Payer {amount} maintenant',
  'chk.throughEndOfThisMonth': '{plan} jusqu’à la fin de ce mois.',
  'chk.coverNextTooAmount': 'Couvrir aussi le mois prochain — {amount}',
  'chk.throughEndOfNextMonth': '{plan} jusqu’à la fin du mois prochain.',
  'chk.upgradeNothingToPay': 'Passer à {plan} — rien à payer',
  'chk.upgradePayAmount': 'Passer à {plan} — payer {amount}',
  'dues.freq.annual': 'annuel',
  'dues.freq.semi-annual': 'semestriel',
  'dues.freq.quarterly': 'trimestriel',
  'dues.freq.monthly': 'mensuel',
  'dues.freq.one-time': 'paiement unique',
  'dues.cad.weekly': 'Hebdomadaire',
  'dues.cad.monthly': 'Mensuel',
  'dues.cad.quarterly': 'Trimestriel',
  'dues.cad.annual': 'Annuel',
  'dues.cad.one-time': 'Paiement unique',
  'dues.cadWord.weekly': 'hebdomadaire',
  'dues.cadWord.monthly': 'mensuel',
  'dues.cadWord.quarterly': 'trimestriel',
  'dues.cadWord.annual': 'annuel',
  'dues.cadWord.one-time': 'unique',
  'agat.removeTemplateConfirm':
    'Retirer « {template} » de ce rassemblement ? Ses étapes que personne n’a encore reçues sont supprimées. Si l’une d’elles a été attribuée ou répondue, rien n’est retiré et on vous dira combien — réattribuez ou approuvez celles-là d’abord.',
  'agat.deleteConfirm':
    'Supprimer « {title} » ? Toutes ses tâches disparaissent avec lui, ainsi que chaque réponse et note écrite par quiconque. S’il n’a simplement pas lieu, passez son statut à Annulé — rien n’est perdu et il peut être réouvert. Ceci est irréversible.',
  'agat.startedBy': 'lancé par {name}',
  'agat.approvedOfTotal': '{approved} sur {total} approuvées',
  'agat.waitingForReview': '{n} en attente de relecture',
  'agat.sentBackCount': '{n} renvoyées',
  'agat.dayHappensOn': 'Le jour où « {segment} » a lieu',
  'agat.whereHeld': 'Où « {segment} » se déroule',
  'agat.removeSegment': 'Retirer {segment} de ce rassemblement',
  'agat.approveConfirm':
    'Approuver « {task} » sur {gathering} ? L’approbation est définitive — cela devient l’enregistrement de la famille et la personne qui l’a soumise ne pourra plus le modifier. Renvoyez-la plutôt si quelque chose doit encore être travaillé.',
  'agat.theHolder': 'la personne qui l’a en charge',
  'agat.nobodyUnassigned': 'personne, car elle n’est pas attribuée',
  'agat.notesBack': 'Notes en retour : {notes}',
  'agat.whoeverHoldsIt': 'quiconque l’a en charge',
  'agat.sentWithTaskRequired':
    'Envoyé avec la tâche à {name}. Une tâche renvoyée sans notes ne laisse rien sur quoi agir, c’est pourquoi ceci est obligatoire.',
  'agat.approvedRecordNote':
    'C’est l’enregistrement de la famille pour {task} et la personne qui l’a soumise ne peut pas le modifier. Réouvrez-la si elle doit changer — la réponse et chaque soumission restent exactement telles quelles, et elle retourne à cette personne pour modification.',
  'agat.sentWithTaskTo': 'Envoyé avec la tâche à {name}.',
  'agat.nobodyUnassignedTold':
    'personne — cette tâche n’est pas attribuée, personne n’est donc informé',
  'plan.optOutOf': 'Se retirer de {schedule} ?',
  'plan.optBackInTo': 'Réintégrer {schedule} ?',
  'plan.optBackInHint':
    '{schedule} comptera de nouveau dans ce que vous devez, à {amount} par échéance {cadence}.',
  'plan.stopAutoHint':
    'Aucun autre paiement par carte ne sera prélevé pour {schedule}. Tout ce que vous avez déjà payé reste sur votre relevé.',
  'plan.includesOverdueOne': 'Comprend 1 échéance due depuis le {since}',
  'plan.includesOverdueMany': 'Comprend {n} échéances dues depuis le {since}',
  'plan.startsWhenYouTurn': 'Commence le {date}, à vos {age} ans',
  'plan.termsProrated': '{now} cette année · {full}/an ensuite · {frequency}',
  'plan.termsPlain': '{amount}/an · {frequency}',
  'plan.optionsFor': 'Options pour {schedule}',
  'plan.changeCadenceHint':
    'À quelle fréquence vous payez {schedule}. Le total annuel ne change pas — la fréquence le divise.',
  'plan.thenEachTime': ', puis {amount} à chaque fois',
  'plan.enterAmountFor': 'Saisissez un montant pour {schedule}, ou zéro pour l’exclure.',
  'plan.mostThatCanBePaid': 'Le maximum qui peut être payé sur {schedule} est {amount}.',
  'plan.coversEarlierOne': 'couvre 1 échéance antérieure',
  'plan.coversEarlierMany': 'couvre {n} échéances antérieures',
  'plan.payAmountByCard': 'Payer {amount} par carte',
  'plan.payCadenceFor': 'Fréquence de paiement de {schedule}',
  'plan.perInstallment': 'par échéance',
  'plan.nextPaymentCovering': 'Prochain paiement {amount}, couvrant ce qui est dû jusqu’à présent',
  'plan.payAmountNext': 'Payer ensuite {amount}',
  'tree.unattachedLede':
    '{who} dans la famille mais sans lien avec personne, elles n’apparaissent donc nulle part ci-dessus. Cliquez sur un nom pour y centrer l’arbre, puis renseignez les parents autour.',
  'tree.rosterLede':
    'L’arbre ci-dessus montre les quatre générations autour d’une personne. Cliquez sur n’importe qui ici pour y centrer l’arbre.',
  'tree.rosterFollowsFilter': 'Cette liste suit également le filtre Lignée.',
  'tree.moreInGeneration': '+ {n} de plus dans cette génération. Retrouvez-les sous',
  'tree.removeLinkConfirm':
    'Supprimer le lien entre {a} et {b} ? Ceci ne supprime que la connexion — personne n’est retiré de la famille et rien de ce qu’ils ont enregistré n’est supprimé.',
  'tree.addSomeonesFather': 'Ajouter le père de {who}',
  'tree.addSomeonesMother': 'Ajouter la mère de {who}',
  'tree.addAnother': 'Ajouter un autre {relation}',
  'tree.withPerson': 'Avec {name}',
  'tree.noChildrenWith': 'Aucun enfant enregistré avec {name}.',
  'tree.someonesSiblings': 'Frères et sœurs de {name}',
  'tree.editRecordAria': 'Modifier la fiche de {name} ou l’inviter',
  'tree.removeConnectionAria': 'Supprimer la connexion avec {name}',
  'gal.imagesReadyOne': '1 image prête',
  'gal.imagesReadyMany': '{n} images prêtes',
  'gal.notAnImageFormat': '{name} n’est pas {formats} — il sera ignoré.',
  'gal.moreKeepTyping': '{n} de plus — continuez à taper pour affiner.',
  'gal.deletePhotoNamedConfirm':
    'Supprimer « {caption} » ? Elle est retirée pour tout le monde, avec ses étiquettes, et le fichier image part aussi. Ceci est irréversible.',
  'gal.photographsAddedOne': '1 photographie ajoutée.',
  'gal.photographsAddedMany': '{n} photographies ajoutées.',
  'gal.addedSomeFailed': '{added} ajoutées. {failed} non : {reasons}',
  'gal.formatsAndSize': '{formats}, jusqu’à 10 Mo chacune.',
  'gal.uploadOne': 'Téléverser la photographie',
  'gal.uploadMany': 'Téléverser {n} photographies',
  'gal.removeTagForConfirm': 'Retirer l’étiquette de {name} de cette photographie ?',
  'gal.addedByName': 'Ajoutée par {name}',
  'gal.removeTagForAria': 'Retirer l’étiquette de {name}',
  'staff.makeOwnerTitle': 'Faire de {name} un propriétaire ?',
  'staff.takeOwnerTitle': 'Retirer l’accès propriétaire à {name} ?',
  'staff.makeOwnerBody':
    '{name} pourra accorder l’accès du personnel, changer le type que possède quiconque et le retirer — y compris le vôtre. Rien d’autre ne change dans ce qu’il peut voir.',
  'staff.takeOwnerBodyOne':
    '{name} conserve la console et tout ce qu’elle lit, et perd cet écran : il ne pourra accorder l’accès du personnel à personne. Il reste 1 propriétaire.',
  'staff.takeOwnerBodyMany':
    '{name} conserve la console et tout ce qu’elle lit, et perd cet écran : il ne pourra accorder l’accès du personnel à personne. Il reste {n} propriétaires.',
  'staff.changeToRole': 'Changer en {role}',
  'staff.removeAccessTitle': 'Retirer l’accès du personnel pour {name} ?',
  'staff.removeAccessBody':
    '{name} perd toute la console dès sa prochaine requête : chacune de ses pages répond 404, exactement comme pour un client. Rien ne change concernant son propre compte ni ses adhésions familiales. Le motif enregistré pour cette autorisation part avec la ligne et n’est conservé nulle part, donc s’ils ont de nouveau besoin d’un accès ce sera une nouvelle autorisation avec un nouveau motif.',
  'dist.stopSendingTitle': 'Arrêter l’envoi de « {subject} » ?',
  'dist.stopSendingBody':
    'Le courriel a déjà été envoyé à {sent} des {total} parents. Ces messages sont partis et ne peuvent pas être rappelés. Le reste ne sera pas envoyé.',
  'dist.stopSending': 'Arrêter l’envoi',
  'dist.deleteRecordTitle': 'Supprimer l’enregistrement de « {subject} » ?',
  'dist.relativesCount': '{n} parents',
  'dist.notInAudience': '{n} hors de ce public',
  'dist.noEmailOnFile': '{n} sans adresse de courriel enregistrée',
  'dist.deleteRecordAria': 'Supprimer l’enregistrement de {subject}',
  'dist.willBeEmailedOne': 'Le courriel sera envoyé à 1 parent',
  'dist.willBeEmailedMany': 'Le courriel sera envoyé à {n} parents',
  'dist.unreachableMoreOne':
    '. 1 autre est sur l’arbre familial sans adresse de courriel et ne peut pas être contacté.',
  'dist.unreachableMoreMany':
    '. {n} autres sont sur l’arbre familial sans adresse de courriel et ne peuvent pas être contactés.',
  'dist.preparing': 'Préparation…',
  'dist.sendToCount': 'Envoyer à {n}',
  'dist.notInAudienceOne': '1 parent n’était pas dans ce public.',
  'dist.notInAudienceMany': '{n} parents n’étaient pas dans ce public.',
  'ael.droppedOne': '{titles} n’est pas une fonction {level}, elle a donc été effacée.',
  'ael.droppedMany': '{titles} ne sont pas des fonctions {level}, elles ont donc été effacées.',
  'ael.publishBody':
    '« {title} » est ajouté au calendrier de {where}. Les candidatures ouvrent le {opens} et le vote ferme le {closes} ; à partir de là, les deux fenêtres s’ouvrent et se ferment d’elles-mêmes.',
  'ael.announcementWillBePosted': ' Une annonce sera publiée.',
  'ael.returnToDraftBody':
    'Retirer « {title} » du calendrier de la famille et la repasser en brouillon ? Personne n’a été proposé et rien n’a été voté, donc rien n’est perdu.',
  'ael.deleteWithVotesBody':
    'Supprimer « {title} », ses {nominations} candidature(s) et ses {votes} vote(s) ? Ceci est irréversible.',
  'ael.deleteBody': 'Supprimer « {title} » et toutes ses fonctions ? Ceci est irréversible.',
  'ael.removePositionAria': 'Retirer la fonction {n}',
  'ael.noOfficesAtLevel':
    'Aucune fonction {level} enregistrée. Ajoutez-les d’abord dans Membres › Organisation.',
  'chk.monthlyBlurb':
    '{amount} par mois, prélevé le 1er, jusqu’à ce que vous l’arrêtiez. Modifiez-le ou arrêtez-le quand vous voulez — ce que vous avez déjà payé reste ouvert.',
  'chk.payRemainderOne': 'Payer {amount} pour le jour restant ce mois-ci',
  'chk.payRemainderMany': 'Payer {amount} pour les {days} jours restants ce mois-ci',
  'chk.payRestAndNext': 'Payer {amount} pour le reste de ce mois et le suivant',
  'chk.inAdvanceBlurb':
    'Un seul paiement couvrant le reste de ce mois plus des mois entiers ensuite, jusqu’à {max}. Rien ne le renouvelle, donc rien n’est facturé de nouveau avant que vous le décidiez.',
  'chk.payNowSimple': 'Payer {amount} maintenant',
  'chk.prorationBreakdownOne':
    '{proration} pour le jour restant ce mois-ci, plus {months} pour {n} mois entier.',
  'chk.prorationBreakdownMany':
    '{proration} pour les {days} jours restants ce mois-ci, plus {months} pour {n} mois entiers.',
  'chk.yourTermUnused': 'Votre période {plan}, non utilisée',
  'chk.paidThroughDate': 'Payé jusqu’au {date}',
  'chk.nextPaymentDate': 'Prochain paiement {date}',
  'agat.noBudgetFund': 'Aucun budget · {fund}',
  'agat.overBy': 'Dépassement de {amount}',
  'agat.overWithOthersBy': 'Dépassement de {amount} avec les autres rassemblements sur ce fonds',
  'agat.approveRowConfirm':
    'Approuver « {task} » sur {gathering} ? L’approbation est définitive — la réponse devient l’enregistrement de la famille et la personne qui l’a soumise ne pourra plus la modifier. Renvoyez-la plutôt si quelque chose doit encore être travaillé.',
  'agat.whoeverHoldsThisTask': 'quiconque a cette tâche',
  'agat.sentToWithTask':
    'Envoyé à {name} avec la tâche. Une tâche renvoyée sans notes ne laisse rien sur quoi agir, c’est pourquoi ceci est obligatoire.',
  'agat.chosenTemplatesOne':
    '1 choisi · ses étapes deviennent les tâches de ce rassemblement, dans l’ordre affiché',
  'agat.chosenTemplatesMany':
    '{n} choisis · leurs étapes deviennent les tâches de ce rassemblement, dans l’ordre affiché',
  'agat.createdStepsFailed':
    'Créé, mais les étapes de {templates} n’ont pas pu être ajoutées. Ajoutez de nouveau le modèle depuis le rassemblement.',
  'agat.templateArchived':
    '« {template} » est archivé et ne peut pas lancer un nouveau rassemblement',
  'agat.cannotDeleteAnsweredOne':
    '1 tâche de « {title} » a reçu une réponse, elle ne peut donc pas être supprimée. Passez son statut à Annulé — rien n’est perdu et il peut être réouvert.',
  'agat.cannotDeleteAnsweredMany':
    '{n} tâches de « {title} » ont reçu une réponse, il ne peut donc pas être supprimé. Passez son statut à Annulé — rien n’est perdu et il peut être réouvert.',
  'agat.savedOutsideOneDay':
    'Enregistré. Ce jour est en dehors du rassemblement, qui a lieu le {on}.',
  'agat.savedOutsideRange':
    'Enregistré. Ce jour est en dehors du rassemblement, qui va du {from} au {to}.',
  'agat.templateAlreadyPart': '« {template} » fait déjà partie de ce rassemblement',
  'agat.couldNotAddSteps':
    'Impossible d’ajouter les étapes de {templates}. Rien n’a été modifié — réessayez.',
  'agat.templateNotPart': '« {template} » ne fait pas partie de ce rassemblement',
  'agat.cannotRemoveInFlightOne':
    '1 tâche de ce modèle a été attribuée ou répondue, elle ne peut donc pas être retirée. Réattribuez-la ou approuvez-la d’abord.',
  'agat.cannotRemoveInFlightMany':
    '{n} tâches de ce modèle ont été attribuées ou répondues, il ne peut donc pas être retiré. Réattribuez-les ou approuvez-les d’abord.',
  'budget.claimedByOthers': '{amount} en sont réclamés par d’autres rassemblements',
  'budget.theFund': 'le fonds',
  'budget.overFundSentence': '{budget} dépasse de {over} ce que détient {fund}.',
  'budget.overWithOthersSentence':
    'D’autres rassemblements en cours réclament déjà {others} du même fonds, donc {total} sont engagés sur {fund} — {over} de plus qu’il ne détient.',
  'budget.overAllocatedSentence':
    'Les budgets des tâches totalisent {lines}, soit {over} de plus que ce rassemblement n’a budgété. Rien n’a été dépensé — augmentez le budget ou réduisez une ligne de tâche.',
  'fnd.routingGapUnder':
    'Il reste {percent}% — ajoutez-les à n’importe quel fonds ci-dessous, ou répartissez-les.',
  'fnd.routingGapOver': 'Cela dépasse de {percent}%. Retirez-les de l’un des fonds ci-dessous.',
  'fnd.deleteNamedBody':
    'Supprimer le fonds « {name} » ? Son solde de {balance} et ses jalons partent avec lui. Ceci est irréversible.',
  'fnd.openNamedBody': 'Permettre aux membres de contribuer directement à « {name} » ?',
  'fnd.closeNamedBody': 'Empêcher les membres de contribuer directement à « {name} » ?',
  'fnd.deleteMilestoneNamedBody':
    'Supprimer le jalon « {name} » ({amount}) ? Ceci est irréversible.',
  'fnd.minimumBalanceFor': 'Solde minimum pour {fund}',
  'fnd.allocationPercentFor': 'Pourcentage d’affectation pour {fund}',
  'proj.expectedThisYear': 'Prévu cette année',
  'proj.collected': 'Encaissé',
  'proj.waived': 'Exonéré',
  'proj.colPaying': 'Cotisants',
  'proj.colExpected': 'Prévu',
  'proj.colOutstanding': 'Restant dû',
  'proj.colStanding': 'Situation',
  'proj.colDues': 'Cotisations',
  'proj.colPaid': 'Payé',
  'proj.stillToCollect': 'Reste à encaisser',
  'proj.oweSomethingOne': '1 des {total} membres doit quelque chose',
  'proj.oweSomethingMany': '{paying} des {total} membres doivent quelque chose',
  'proj.percentOfBilled': '{percent}% de ce qui a été facturé, exonérations comprises',
  'proj.nothingBilledYet': 'Rien n’a encore été facturé',
  'proj.waivedCaption': 'Remis — solde la cotisation et n’est pas un revenu',
  'proj.everybodyUpToDate': 'Tout le monde est à jour',
  'proj.outstandingOne': '1 membre a un solde impayé',
  'proj.outstandingMany': '{n} membres ont un solde impayé',
  'proj.pendingSettlement':
    '{amount} est en attente de règlement — engagé et pas encore confirmé. Ce montant n’est pas compté comme encaissé et n’a pas été retiré de ce qui reste dû.',
  'proj.thatPartOfTheFamily': 'cette partie de la famille',
  'proj.scopeEmptyNote':
    'Personne ne doit ceci : aucun membre de la famille n’est dans {where}. Les membres choisissent leur section sur leur propre profil, et quiconque n’a pas de section relève du National.',
  'proj.fullYear': 'Année complète',
  'proj.leastSettledFirst': 'Les moins réglés d’abord. {shown} sur {total} affichés.',
  'ann.deleteNamedBody':
    'Supprimer « {title} » ? Les membres ne le verront plus, ni sur le tableau ni dans leurs mises à jour. Ceci est irréversible.',
  'ann.unpinNamedBody':
    'Désépingler « {title} » ? Cela reste sur ce tableau et cesse d’apparaître en haut des Mises à jour récentes de tous.',
  'ann.pinNamedBody':
    'Épingler « {title} » en haut des Mises à jour récentes de chaque membre ? Chacun pourra ensuite le masquer pour lui-même.',
  'ann.unpin': 'Désépingler',
  'ann.pin': 'Épingler',
  'ann.hideFromMyUpdates': 'Masquer « {title} » en haut de vos propres mises à jour',
  'ann.showInMyUpdates': 'Réafficher « {title} » en haut de vos propres mises à jour',
  'ann.unpinForEveryone': 'Désépingler « {title} » pour tous',
  'ann.pinForEveryone': 'Épingler « {title} » pour tous',
  'org.deleteRegionMovingOne':
    'Supprimer la région {name} ? Sa section passe au National, et tous ses membres restent exactement où ils sont. Ceci est irréversible.',
  'org.deleteRegionMovingMany':
    'Supprimer la région {name} ? Ses {n} sections passent au National, et tous leurs membres restent exactement où ils sont. Ceci est irréversible.',
  'org.deleteRegionBody': 'Supprimer la région {name} ? Ceci est irréversible.',
  'org.deleteChapterBody': 'Supprimer la section {name} ? Ceci est irréversible.',
  'org.deleteRegionTitleAttr': 'Supprimer la région {name}',
  'org.deleteChapterTitleAttr': 'Supprimer la section {name}',
  'org.underNationalOne': '1 section relève du National.',
  'org.underNationalMany': '{n} sections relèvent du National.',
  'org.memberPicksChapter': 'Chaque membre choisit sa section sur son propre profil.',
  'inc.ageProrationHint':
    'Un membre ne doit rien avant ses {age} ans, puis les mois de cette année suivant son anniversaire — et le montant intégral chaque année ensuite. Toute personne sans date de naissance enregistrée le doit intégralement.',
  'inc.beneficiaryHint':
    'Toute personne nommée ici ne peut voir cette collecte nulle part dans {app} — ni l’objectif, ni la progression, ni un seul don. Cela vaut aussi pour les administrateurs, une collecte peut donc rester cachée de la personne qu’elle doit surprendre. Tous les autres voient à qui elle est destinée.',
  'inc.descriptionPlaceholder': 'À quoi sert {noun}…',
  'inc.applyEditsDonation': 'Appliquer vos modifications à « {label} » (objectif {goal}) ?',
  'inc.applyEditsDues': 'Appliquer vos modifications à « {label} » ({amount} {frequency}) ?',
  'inc.deleteNamedBody':
    'Supprimer {noun} « {label} » ({amount} {frequency}) ? Ceci est irréversible.',
  'inc.deleteThisBody': 'Supprimer {noun} ? Ceci est irréversible.',
  'inc.deleteNoun': 'Supprimer {noun}',
  'pos.holdersBlockOne': '1 personne occupe « {name} ». Retirez-la-lui d’abord.',
  'pos.holdersBlockMany': '{n} personnes occupent « {name} ». Retirez-la-leur d’abord.',
  'pos.removeNamedLede': 'Retirer « {name} » des fonctions que votre famille conserve ? ',
  'pos.renameAria': 'Renommer la fonction {name}',
  'pos.heldBlockTitleOne': '1 personne occupe ceci — retirez-la-lui d’abord',
  'pos.heldBlockTitleMany': '{n} personnes occupent ceci — retirez-la-leur d’abord',
  'pos.cannotRemoveAriaOne': 'Impossible de retirer la fonction {name} : 1 personne l’occupe',
  'pos.cannotRemoveAriaMany':
    'Impossible de retirer la fonction {name} : {n} personnes l’occupent',
  'pos.removeAria': 'Retirer la fonction {name}',
  'inv.invitedNamed': '{name}, vous avez été invité à rejoindre {family}',
  'inv.invitedAnon': 'Vous avez été invité à rejoindre {family}',
  'inv.sentToHasAccount':
    'Cette invitation a été envoyée à {email}, qui possède déjà un compte {app}. Connectez-vous et vous reviendrez directement ici pour rejoindre — vous n’aurez pas besoin de code familial, cette invitation est votre accès.',
  'inv.sentToNoAccount':
    'Cette invitation a été envoyée à {email}. Créez un compte avec cette adresse pour l’accepter — vous n’aurez pas besoin de code familial, cette invitation est votre accès. Vous avez déjà un compte ? Connectez-vous et vous reviendrez directement ici.',
  'inv.thisAccount': 'ce compte',
  'inv.sentToOnlyThatAddress':
    'Elle a été envoyée à {email}, et seule cette adresse peut l’accepter — c’est ce qui empêche un lien transféré de fonctionner pour quelqu’un d’autre. Vous êtes connecté en tant que {account}.',
  'tasks.waitingOne': '1 tâche vous attend',
  'tasks.waitingMany': '{n} tâches vous attendent',
  'tasks.needAnotherLookOne': '1 nécessite un nouvel examen',
  'tasks.needAnotherLookMany': '{n} nécessitent un nouvel examen',
  'tasks.wasDue': 'Était dû le {date}',
  'tasks.due': 'Dû le {date}',
  'tasks.sentBackHelpLabel': 'Ce qui se passe quand une tâche revient',
  'tasks.answerFinal': '{status} — cette réponse est définitive.',
  'tasks.yourNote': 'Votre note : {note}',
  'tasks.yourAnswerFor': 'Votre réponse pour {task}',
  'gath.shapeContinuous': 'Un bloc continu',
  'gath.shapeContinuousHint':
    'Un rassemblement du vendredi soir au dimanche midi. Il s’affiche comme une seule barre sur ces jours dans le calendrier.',
  'gath.shapeSeparate': 'Jours séparés, même rassemblement',
  'gath.shapeSeparateHint':
    'Une réunion de comité sur trois samedis. Chaque jour s’affiche comme sa propre entrée, toutes portant le titre de ce rassemblement.',
  'gath.removeDayAria': 'Retirer le jour {n}',
  'gath.everyDayOwnEntry':
    'Chaque jour ici est sa propre entrée dans le calendrier, toutes nommées d’après ce rassemblement.',
  'rel.siblingNeedsSharedParent':
    'Aucun parent n’est encore enregistré pour {name} ; ce frère ou cette sœur '
    + 'n’apparaîtra donc pas dans {view} — l’arbre sait qu’ils sont frères et sœurs, mais '
    + 'pas de qui ils sont les enfants. Enregistrez sur chacun d’eux le parent qu’ils ont '
    + 'en commun et tous deux y figureront.',
  'rel.shareParentsQuestion': 'Partagent-ils les parents de {name} ?',
  'rel.whoElseIsParent': 'Qui d’autre est parent de ce {relation} ?',
  'rel.tickingRecordsParent':
    'Cocher quelqu’un enregistre aussi le lien de parenté, donc cette personne apparaît également sur sa fiche — pas seulement à côté de {name}.',
  'rel.whoIsWhose': 'Qui est le {relation} de {name} ?',
  'rel.dateOfBirth': 'Date de naissance',
  'rel.dateOfBirthOptional': 'Date de naissance (facultative)',
  'elec.vote': 'Voter',
  'elec.thisNominee': 'ce candidat',
  'elec.voteConfirm': '{action} pour {nominee} comme {position} ?',
  'elec.nominationRespondConfirm':
    '{action} la candidature pour {position} ? Ceci ne peut pas être modifié.',
  'elec.theyOpenOn': 'Elles ouvrent le {date}.',
  'elec.nominationsClosedOnPlain': 'Les candidatures ont fermé le {date}.',
  'elec.votingOpensOnPlain': 'Le vote ouvre le {date}.',
  'elec.votingClosedOnPlain': 'Le vote a fermé le {date}.',
  'pay.maxItems':
    'Jusqu’à {max} cotisations peuvent être payées en une fois. Payez-en certaines séparément.',
  'pay.nothingLeftOn': 'Il ne reste rien à payer sur {schedule}.',
  'pay.moreThanOwed':
    'C’est plus que ce qui est dû. Le maximum qui peut être payé sur {schedule} est {amount}.',
  'pay.feeLineName': 'Frais de traitement de carte',
  'pay.feeLineDesc': 'Pour que votre famille reçoive le montant intégral',
  'pay.driveClosed': '{drive} est clôturé. Plus rien ne peut y être versé.',
  'pay.maxCharge':
    'Un seul paiement par carte ne peut pas dépasser {amount}. Faites-le en deux fois.',
  'rep.elecOpenNow': '{n} ouvertes maintenant · publiées seulement',
  'rep.elecNominations': 'Candidatures',
  'rep.elecAcrossEvery': 'sur toutes les élections',
  'rep.elecEmptyMessage': 'Aucune élection n’a encore été publiée.',
  'rep.elecEmptyHint':
    'Une fois qu’une élection est publiée, ceci indique sa participation, ses candidatures et toute fonction pour laquelle personne ne s’est présenté.',
  'rep.elecAcceptedOf': '{accepted} sur {total} acceptées',
  'rep.elecNobodyStanding': '{n} sans aucun candidat',
  'rep.elecUnopposedOne': '1 fonction sans opposition',
  'rep.elecUnopposedMany': '{n} fonctions sans opposition',
  'rep.elecNotApplicableNote': ' plutôt que 0% — personne n’aurait pu y voter.',
  'pms.noMembersYet': 'Aucun membre à choisir pour le moment.',
  'pms.searchMembers': 'Rechercher parmi {n} membres…',
  'pms.noMatch': 'Aucun membre ne correspond à « {query} ».',
  'pms.totalOne': '1 membre',
  'pms.totalMany': '{n} membres',
  'pms.shownOfTotal': '{shown} sur {total} affichés',
  'pms.moreKeepTyping': '{n} de plus — continuez à taper pour affiner',
  'meet.comingUp': 'À venir',
  'meet.held': 'Tenues',
  'meet.topicsOne': '1 sujet',
  'meet.topicsMany': '{n} sujets',
  'meet.stepOf': 'Étape {step} sur {total} · {name}',
  'meet.allAdultsInFamily': 'Ce sont les {n} adultes de la famille.',
  'meet.nobodyUnderEighteen':
    'Aucune personne de moins de dix-huit ans n’est invitée à une réunion.',
  'meet.inTheRoomOne': '1 personne dans la salle — voir qui',
  'meet.inTheRoomMany': '{n} personnes dans la salle — voir qui',
  'notes.deleteEntryNamedBody':
    'Supprimer « {title} » ? Chaque note qu’il contient part aussi, pour tous ceux qui occupent cette fonction, maintenant et plus tard. Ceci est irréversible.',
  'notes.chapterWord': 'section',
  'notes.regionWord': 'région',
  'notes.everyoneHoldingReads':
    '{who} {office} lit ce journal, quelle que soit la {area} pour laquelle il l’occupe.',
  'notes.thisOffice': 'cette fonction',
  'notes.nothingRecordedFor': 'Rien n’est encore enregistré pour {office}.',
  'notes.newEntry': 'Nouvelle entrée',
  'notes.newEntryForOffice': 'Nouvelle entrée — {office}',
  'bday.noneMatchName':
    'Aucun anniversaire dans les {days} prochains jours ne correspond à ce nom.',
  'bday.inDays': 'dans {n} jours',
  'bday.shownOfTotal': '{shown} sur {total} affichés',
  'bday.countOne': '1 anniversaire dans les {days} prochains jours',
  'bday.countMany': '{n} anniversaires dans les {days} prochains jours',
  'bday.discreetNote': '{emoji} remplace un âge entre {min} et {max}',
  'pos.chooseWhichChapter': 'Choisissez quelle section',
  'pos.chooseWhichRegion': 'Choisissez quelle région',
  'pos.takeAwayNamedLede': 'Retirer « {position} » à {name} ? ',
  'pos.somebodysPositions': 'Fonctions de {name}',
  'pos.takeAwayAria': 'Retirer {position} à {name}',
  'fnd.builtInCannotSwitchOff': '{name} est intégré et ne peut pas être désactivé.',
  'fnd.builtInCannotDelete':
    '{name} est intégré et ne peut pas être supprimé. Chaque don que reçoit la famille est conservé ici.',
  'fnd.allocationsMustTotal': 'Les affectations doivent totaliser 100% (actuellement {percent}%)',
  'fnd.couldNotReadBalance': 'Impossible de lire le solde de {name}',
  'fnd.holdsTransferLess': '{name} détient {amount}. Transférez ce montant ou moins.',
  'rep.meetings': 'Réunions',
  'rep.meetRelativesAskedOne': '1 parent invité à une réunion',
  'rep.meetRelativesAskedMany': '{n} parents invités à une réunion',
  'rep.minuted': 'Avec procès-verbal',
  'rep.meetReachedAVote': '{n} ont fait l’objet d’un vote',
  'rep.meetOnePerTopic': 'un par sujet traité',
  'rep.meetEmptyMessage': 'La famille n’a pas encore tenu de réunion.',
  'rep.meetEmptyHint':
    'Une fois qu’une réunion est programmée, ceci indique qui était dans la salle, ce qui a été abordé et comment les votes se sont déroulés.',
  'rep.meetVotedOn': '{n} soumis au vote',
  'safety.deleteNamedBody':
    '« {title} » et l’enregistrement de qui a répondu seront supprimés. Personne ne pourra voir qui a été interrogé, qui s’est déclaré en sécurité, ni qui n’a jamais été joint.',
  'safety.raisedBy': 'lancé par {name}',
  'safety.askRemaining': 'Interroger les {n} restants',
  'safety.unreachableOne':
    '1 parent n’a pas d’adresse de courriel enregistrée. Quelqu’un devra lui téléphoner.',
  'safety.unreachableMany':
    '{n} parents n’ont pas d’adresse de courriel enregistrée. Quelqu’un devra leur téléphoner.',
  'slice.descriptionOne': '{chart} · 1 membre · {percent}% de la famille',
  'slice.descriptionMany': '{chart} · {n} membres · {percent}% de la famille',
  'slice.invitedNotEmailed': '{name} a été invité, mais le courriel n’a pas pu être envoyé. ',
  'slice.invited': '{name} a été invité.',
  'slice.birthdayRecorded': 'Date de naissance de {name} enregistrée.',
  'pend.waitingOnFamilies':
    'Vous attendez {n} familles. Chacune est examinée par ses propres administrateurs, elles peuvent donc ne pas répondre en même temps.',
  'pend.sentTo': 'Envoyé à {family}',
  'pend.askToLookAgain': 'Demander à {family} de réexaminer',
  'pend.meantimeFillIn': 'En attendant, vous pouvez compléter',
  'gal.deleteAlbumWithPhotosOne':
    'Ceci supprime l’album ET la photographie qu’il contient, pour tout le monde. Le fichier image est également supprimé. Ceci est irréversible.',
  'gal.deleteAlbumWithPhotosMany':
    'Ceci supprime l’album ET les {n} photographies qu’il contient, pour tout le monde. Les fichiers image sont également supprimés. Ceci est irréversible.',
  'gal.deleteAlbumAndOne': 'Supprimer l’album et 1 photo',
  'gal.deleteAlbumAndMany': 'Supprimer l’album et {n} photos',
  'gal.albumIsASet':
    'Un album est un ensemble de photographies que la famille conserve ensemble — un rassemblement, un mariage, une année.',
  'gal.deleteNamedAlbumAria': 'Supprimer l’album « {name} »',
  'rec.howRelated': 'Comment {name} est apparenté',
  'rec.formerMarriageNote':
    'Un ancien mariage reste sur l’arbre à côté de {name} — c’est généralement d’où vient la moitié des enfants. Un mariage ne transmet jamais le sang.',
  'rem.nobodyCanOpen':
    'Personne ne peut l’ouvrir, la rejoindre ni accepter une invitation. {nothingDeleted} — chaque paiement, photographie, évènement et personne est exactement là où il était. Seul le support {app} peut la rétablir ; écrivez-leur pour le demander.',
  'set.codeSentTo':
    'Nous avons envoyé un code à six chiffres à {email}. Il dure {minutes} minutes et ne peut servir qu’une fois.',
  'set.codeFailedTo':
    '{note} Aucun code n’est parvenu à {email}, il n’y a donc rien à saisir pour l’instant. Réessayez dans un instant.',
  'gath.notUsableAnswer': 'Ce n’est pas une réponse utilisable pour « {task} ». {hint}',
  'gath.onlyOrganizerCanSchedule': 'Seul un organisateur peut programmer depuis « {template} »',
  'gath.scheduledStepsFailed':
    'Programmé, mais les étapes de {templates} n’ont pas pu être ajoutées. Un organisateur peut les ajouter depuis le rassemblement.',
  'org.theNamedRegion': 'La région {name}',
  'org.theNamedChapter': 'La section {name}',
  'pos.nameTooLong': 'Un nom de fonction fait au maximum {max} caractères',
  'err.regionNeedsName': 'Une région a besoin d’un nom',
  'err.regionNotFound': 'Région introuvable',
  'err.chapterNeedsName': 'Une section a besoin d’un nom',
  'err.chapterNotFound': 'Section introuvable',
  'err.positionNeedsName': 'Une fonction a besoin d’un nom',
  'err.chooseCategory': 'Choisissez une catégorie',
  'err.chooseScope': 'Choisissez une portée',
  'err.positionNotFound': 'Fonction introuvable',
  'err.memberNotFound': 'Membre introuvable',
  'err.memberNotApproved': 'Ce membre n’a pas encore été approuvé',
  'err.chooseChapterForPosition': 'Choisissez la section à laquelle correspond cette fonction',
  'err.chooseRegionForPosition': 'Choisissez la région à laquelle correspond cette fonction',
  'err.alreadyHoldsPosition': 'Cette personne occupe déjà cette fonction',
  'err.assignmentGone': 'Cette attribution n’existe plus',
  'err.notAuthenticated': 'Non authentifié',
  'err.noFamilyOnAccount': 'Aucune famille associée au compte',
  'err.noSignInAddress': 'Ce membre n’a aucune adresse de connexion enregistrée.',
  'err.placeholderEmailNoReset':
    'Cette fiche a une adresse de courriel provisoire, un lien de réinitialisation n’a donc nulle part où aller.',
  'err.cannotRemoveSelfFromGroup': 'Vous ne pouvez pas vous retirer du groupe',
  'err.conversationNotFound': 'Conversation introuvable',
  'err.familyRoomFailed': 'Impossible de trouver ou de créer le salon de la famille',
  'err.groupNameRequired': 'Le nom du groupe est obligatoire',
  'err.groupNotFound': 'Groupe introuvable',
  'err.invalidMessage': 'Message non valide',
  'err.noFamily': 'Aucune famille',
  'err.noFamilyCodeOnAccount': 'Aucun code familial trouvé sur votre compte',
  'err.onlyCreatorCanAdd': 'Seul le créateur du groupe peut ajouter des membres',
  'err.onlyCreatorCanRemove': 'Seul le créateur du groupe peut retirer des membres',
  'err.notInYourFamily': 'Ce membre n’est pas dans votre famille',
  'err.userNotInFamily': 'Utilisateur introuvable dans votre famille',
  'err.nationalReservedName': '« National » est un nom réservé',
  'err.noAccountAttachPosition':
    'Ce parent n’a pas encore de compte, il n’y a donc rien à quoi rattacher une fonction. Invitez-le d’abord depuis l’arbre familial.',
  'err.noAccountResetPassword':
    'Ce parent n’a pas encore de compte, il n’y a donc aucun mot de passe à réinitialiser. Invitez-le plutôt depuis l’arbre familial.',
  'reg.alreadyRegistered':
    '{email} est déjà enregistré auprès de {app}, il n’y a donc rien à créer. Connectez-vous et vous reviendrez directement à votre invitation à',
  'acct.closedDrivesOne': '1 collecte clôturée n’est pas affichée ici —',
  'acct.closedDrivesMany': '{n} collectes clôturées ne sont pas affichées ici —',
  'acct.seeDonationsForFull': 'pour l’enregistrement complet.',
  'err.errorReference': 'Référence de l’erreur : {digest}',
  'cal.withheldOne':
    'Ce calendrier n’inclut pas {list}, donc ce que vous voyez ci-dessous n’est pas le mois entier : cet écran ne vous a pas été partagé, ou n’a pas pu être lu à l’instant.',
  'cal.withheldMany':
    'Ce calendrier n’inclut pas {list}, donc ce que vous voyez ci-dessous n’est pas le mois entier : ces écrans ne vous ont pas été partagés, ou n’ont pas pu être lus à l’instant.',
  'hlp.membershipUndecided':
    'Votre adhésion à {family} n’a pas encore été décidée, la majeure partie du produit ne vous est donc pas ouverte.',
  'hlp.chapterExplainsNext':
    'est le chapitre qui explique ce qui se passe ensuite. Tout le reste est là pour être lu en attendant.',
  'lib.whyNotesStayHelp': 'Pourquoi les notes restent avec la fonction',
  'lib.officesRecordedUnder': 'Les fonctions sont enregistrées dans',
  'prof.requestDeclined':
    '{lede}{family} a été refusée. Vous pouvez tout de même tenir votre profil à jour.',
  'prof.waitingForApproval':
    '{lede}{family} attend une approbation. Remplir ceci les aide à vous reconnaître —',
  'prof.checkTheStatus': 'consulter le statut',
  'rep.offices': 'Fonctions',
  'rep.heldInTotalOne': '1 occupée au total',
  'rep.heldInTotalMany': '{n} occupées au total',
  'rep.filled': 'Pourvues',
  'rep.boardEmptyHint':
    'Ajoutez-les dans Membres → Organisation, et ceci indique qui occupe chacune et lesquelles sont vacantes.',
  'rep.gathStillToCome': '{n} à venir · annulés exclus',
  'rep.gathWaitingDecision': '{n} en attente d’une décision',
  'rep.gathEmptyHint':
    'Une fois qu’un rassemblement est programmé, ceci indique comment ses tâches avancent.',
  'stf.familiesTitle': 'Familles',
  'stf.familiesBlurb':
    'Chaque famille, son forfait, combien de membres elle compte et si elle a été supprimée. La restauration se fait ici.',
  'stf.familyOne': 'famille',
  'stf.familyMany': 'familles',
  'stf.active': 'actives',
  'stf.accountsBlurb':
    'Chaque compte de connexion, si son adresse est confirmée, s’il a déjà été utilisé, et à quelles familles il appartient.',
  'set.familyNameTooLong': 'Ce nom de famille est trop long ({max} caractères maximum).',
  'set.paidPlanUseBilling':
    '{plan} est un forfait payant. Configurez-le dans la section Facturation des Paramètres — rien ici ne peut y faire passer une famille.',
  'tmpl.nameExists': 'Un modèle appelé « {name} » existe déjà',
  'tmpl.usedCannotDeleteOne':
    '« {name} » a servi à créer 1 rassemblement, il ne peut donc pas être supprimé — l’enregistrement de la provenance de ces tâches partirait avec lui. Archivez-le à la place, ce qui le retire de la liste des modèles programmables et laisse chaque rassemblement exactement tel quel.',
  'tmpl.usedCannotDeleteMany':
    '« {name} » a servi à créer {n} rassemblements, il ne peut donc pas être supprimé — l’enregistrement de la provenance de ces tâches partirait avec lui. Archivez-le à la place, ce qui le retire de la liste des modèles programmables et laisse chaque rassemblement exactement tel quel.',
  'access.membersOnTemplateOne': '1 membre est sur ce modèle. Déplacez-le d’abord vers un autre.',
  'access.membersOnTemplateMany':
    '{n} membres sont sur ce modèle. Déplacez-les d’abord vers un autre.',
  'access.lockoutSubject.manageAccess': 'gérer l’accès',
  'access.lockoutSubject.changeTemplates': 'modifier les modèles de permissions',
  'access.onlyTemplateThatCan':
    'C’est le seul modèle qui peut {subject}. Accordez-le d’abord à un autre modèle.',
  'access.noOtherTemplateHasMembers':
    'Aucun autre modèle pouvant {subject} n’a de membres. Placez d’abord quelqu’un sur l’un d’eux.',
  'proc.disconnectedStoppedOne':
    'Déconnecté, et 1 paiement récurrent arrêté. Chaque paiement déjà enregistré est conservé.',
  'proc.disconnectedStoppedMany':
    'Déconnecté, et {n} paiements récurrents arrêtés. Chaque paiement déjà enregistré est conservé.',
  'usr.chaptersReadFailed': 'Impossible de lire les sections de cette famille : {error}',
  'usr.chapterSavedMovedOne': 'Section enregistrée. 1 parent sans compte a suivi.',
  'usr.chapterSavedMovedMany': 'Section enregistrée. {n} parents sans compte ont suivi.',
  'cht.loadRoomFailed': 'Échec du chargement du salon : {error}',
  'cht.createRoomFailed': 'Échec de la création du salon : {error}',
  'cht.enrollFailed': 'Échec de l’inscription des membres : {error}',
  'dues.driveVisibleToEveryone':
    'La collecte a été créée, mais elle est VISIBLE PAR TOUS — {reason} Ouvrez-la et indiquez à qui elle est destinée.',
  'dues.requiredCannotOptOut':
    '{schedule} est une cotisation obligatoire, on ne peut donc pas s’en retirer.',
  'gal.tooManyAtOnce': 'Trop de photographies à la fois — {n} à la fois.',
  'gal.couldNotStartUpload': 'Impossible de démarrer l’envoi.',
  'gal.uploadDidNotArrive': '{name} n’est pas arrivée dans l’album. Réessayez.',
  'gal.uploadingProgress': 'Envoi de {done} sur {n}…',
  'gal.photoCountOne': '1 photographie',
  'gal.photoCountMany': '{n} photographies',
  'gal.renameAlbum': 'Renommer l’album',
  'gal.renameAlbumBody':
    'Changez le nom de cet album et sa description. Les photographies qu’il contient ne sont pas touchées.',
  'gal.renameNamedAlbumAria': 'Renommer l’album « {name} »',
  'gal.renameFailed': 'Impossible de renommer cet album.',
  'rel.inBloodlineQuestion': 'Cette personne fait partie de la lignée de la famille',
  'rel.inBloodlineHint': 'Cochez ceci pour un parent par le sang. Laissez décoché pour quelqu’un qui a épousé un membre de la famille, et pour un parent par alliance, adoptif ou d’accueil. Cela décide qui apparaît sous {control} dans l’arbre, et qui doit une cotisation réservée à la lignée.',
  'rec.inBloodline': '{name} fait partie de la lignée de la famille',
  'rec.inBloodlineHint': 'Décide qui apparaît sous {view} dans l’arbre, et qui doit une cotisation réservée à la lignée. Enregistré dès que vous cochez.',
  'rec.bloodlineFailed': 'Impossible de changer cela.',
  'rec.connectionsHint': 'À qui cette personne est rattachée. Un mariage peut être renommé ; les autres sont les relations que quelqu’un a enregistrées.',
  'proj.bloodlineEmptyNote': 'Personne ne doit ceci : votre famille n’a marqué personne comme faisant partie de sa lignée, il n’y a donc personne à facturer. Cochez {control} dans l’arbre familial.',
  'gal.fileTooLarge': '{name} dépasse 10 Mo.',
  'gal.albumGoneFilesLeftOne':
    'L’album a disparu, mais 1 de ses fichiers image n’a pas pu être retiré du stockage. Il n’est plus listé nulle part ; prévenez un administrateur pour qu’il soit nettoyé.',
  'gal.albumGoneFilesLeftMany':
    'L’album a disparu, mais {n} de ses fichiers image n’ont pas pu être retirés du stockage. Ils ne sont plus listés nulle part ; prévenez un administrateur pour qu’ils soient nettoyés.',
  'jrn.firstNoteNotSaved': 'la première note n’a pas été enregistrée',
  'jrn.entryCreatedPartial':
    'L’entrée a été créée, mais {what}. Ouvrez-la et ajoutez ce qui manque.',
  'meet.secretaryUnderEighteen':
    '{name} a moins de dix-huit ans. Le procès-verbal doit être rédigé par un adulte.',
  'meet.guestUnderEighteenOne':
    '{name} a moins de dix-huit ans. Seuls des adultes peuvent être ajoutés nominativement à une réunion.',
  'meet.guestUnderEighteenMany':
    '{names} ont moins de dix-huit ans. Seuls des adultes peuvent être ajoutés nominativement à une réunion.',
  'fam.alreadyBelongTo': 'Vous appartenez déjà à {family}.',
  'fam.requestStillAwaiting':
    'Votre demande d’adhésion à {family} est encore en attente d’approbation.',
  'reg.invitationSentToAddress':
    'Cette invitation a été envoyée à {email}. Inscrivez-vous avec cette adresse.',
  'safety.requeuedOne': '1 parent sera interrogé de nouveau',
  'safety.requeuedMany': '{n} parents seront interrogés de nouveau',
  'sms.confirmationBody':
    'Votre code de confirmation {app} est {code}. Il expire dans {minutes} minutes.',
  'sms.codeSentToEnding': 'Code envoyé au numéro se terminant par {last4}.',
  'stf.noAccountUses':
    'Aucun compte n’utilise {email}. Cette personne doit s’inscrire avant de pouvoir recevoir un accès.',
  'stf.reasonTooLong': 'Gardez le motif sous {max} caractères',
  'stf.alreadyHasAccess': '{email} a déjà un accès du personnel. Modifiez son accès sur sa ligne.',
  'drives.pastTheGoal': '{amount} au-delà de l’objectif',
  'drives.fromYou': '{amount} de votre part',
  'drives.raisedAmount': '{amount} récoltés',
  'plan.nextDuePrefix': 'Prochaine échéance',
  'fnd.shareOfDues': '{percent} des cotisations',
  'fnd.ofMinimum': 'sur {amount} minimum',
  'fnd.minimumBalanceIs': ' Solde minimum {amount}.',
  'fnd.shareOfDuesPrefix': 'Part des cotisations',
  'fnd.paidFromPrefix': 'Payé depuis',
  'drives.giveTo': 'Donner à {label}',
  'drives.wouldMeetGoal': '{amount} atteindrait l’objectif — donnez ce que vous voulez.',
  'plan.paymentsRecordedOne': '1 paiement enregistré',
  'plan.paymentsRecordedMany': '{n} paiements enregistrés',
  'access.runMigrations':
    '{lede} Exécutez les migrations dans supabase/migrations. Jusque-là l’accès retombe sur l’ancien indicateur is_admin et rien de ce qui est modifié ici ne prend effet.',
  'access.regionsChaptersNational': 'Régions, sections et National',
  'appr.invitedBy': 'Invité par {name}',
  'appr.expiresOn': 'expire le {date}',
  'agat.reopenConfirm':
    'Réouvrir « {task} » sur {gathering} ? Elle retourne à {who}, qui pourra alors modifier la réponse et la soumettre de nouveau. Rien n’est effacé — sa réponse reste sur la tâche comme point de départ et chaque soumission reste dans le dossier.',
  'tmpl.noneYet': 'Aucun modèle de rassemblement pour le moment.',
  'agat.noneYet': 'Aucun rassemblement pour le moment.',
  'bill.cardFailingSince':
    'Un paiement par carte échoue depuis le {date}. Rien n’a changé concernant ce à quoi cette famille a accès. Mettez à jour la carte dans {where} et Stripe réessaiera.',
  'elec.waitingToBeAnswered': '{n} en attente de réponse',
  'elec.votingClosedRange': 'Le vote a fermé {range}.',
  'elec.snapshotWhileOpen':
    'Un instantané pendant que le scrutin est ouvert — rien ici n’est définitif avant la fermeture du vote.',
  'pos.noPositionYet': 'Aucune fonction pour le moment.',
  'mpe.saveConfirm':
    'Enregistrer vos modifications sur le profil de {name} ? Cette personne n’est pas notifiée.',
  'mpe.chapterNotSaved': 'Le profil a été enregistré, mais pas la section : {reason}',
  'mpe.chapterCouldNotBeSet': 'cette section n’a pas pu être définie.',
  'mpe.emailResetLede': 'Envoyer à {name} un lien pour choisir un nouveau mot de passe ? ',
  'login.stillNothing': 'Toujours rien ?',
  'reg.startsOnFreeNote':
    '{lede} Free. Rien n’a été facturé — connectez-vous et {app} vous demandera de configurer {plan}.',
  'reg.nothingChargedNow':
    'Rien n’est facturé maintenant. Une fois votre famille créée, on vous demandera de configurer le paiement de {plan}, et vous pourrez rester sur Free.',
  'law.addedBy': '· ajouté par {name}',
  'law.notADocumentFormat': 'Ce n’est pas {formats}. Choisissez un autre fichier.',
  'cal.nothingInMonth': 'Rien n’est au calendrier en {month}.',
  'cal.whatIsOnCaption': 'Ce qui a lieu en {month}, une colonne par jour de la semaine.',
  'chat.deleteConversationConfirm':
    'Supprimer votre conversation avec {name} ? Les messages sont retirés et ne peuvent pas être récupérés.',
  'chat.selectedOne': '1 membre sélectionné',
  'chat.selectedMany': '{n} membres sélectionnés',
  'chat.addToGroupConfirm':
    'Ajouter {name} à « {group} » ? Cette personne pourra lire la conversation.',
  'chat.removeFromGroupConfirm':
    'Retirer {name} de « {group} » ? Cette personne perd l’accès à la conversation.',
  'chat.deleteConversationAria': 'Supprimer la conversation avec {name}',
  'cns.onlyOwnAccount':
    '{lede} Seules les données de votre propre compte sont utilisées, et uniquement pour rattacher cette visite à une publicité.',
  'dash.chapter.theSelected': 'la section sélectionnée',
  'dash.chapter.confirm':
    'Définir votre section sur {chapter} ? Les fils ou filles de moins de 18 ans sans compte propre vous suivent.',
  'drives.moreOpenOne': '1 autre collecte est ouverte.',
  'drives.moreOpenMany': '{n} autres collectes sont ouvertes.',
  'dash.link.confirm':
    'Rattacher la fiche de {name} à votre compte ? Son historique devient le vôtre, et ceci est irréversible.',
  'dash.finishPayingFor': 'Terminez le paiement de {plan}',
  'dash.tasksApprovedOne': '{approved} sur 1 tâche approuvée',
  'dash.tasksApprovedMany': '{approved} sur {total} tâches approuvées',
  'dash.raisedBy': 'Lancé par {name}',
  'dist.noDraftToComeBack':
    'Ceci part par courriel immédiatement. Il n’y a aucun brouillon sur lequel revenir.',
  'docs.deleteNamedBody':
    'Supprimer « {name} » ? Le fichier est retiré pour tout le monde. Ceci est irréversible.',
  'proj.yearFromPrefix': 'Année à partir du',
  'proj.payingCount': '{n} cotisants',
  'proj.helpWhoCounted': 'Aide : qui est compté dans ces chiffres',
  'tree.otherChildren': 'Autres enfants',
  'tree.otherChildrenEmpty':
    'Les enfants dont l’autre parent n’est pas enregistré apparaissent ici.',
  'upg.partOfPlan': 'Inclus dans {plan}',
  'upg.everythingOnComesWith': 'Tout ce qui est dans {plan} est inclus.',
  'upg.noAnnualNoContract': '. Aucun forfait annuel, aucun contrat.',
  'upg.notOnSaleYet': ' Pas encore en vente ; rien n’est facturé aujourd’hui.',
  'gath.answerInDollars': '{label}, en dollars',
  'gath.answerOnePerLine': '{label}, un élément par ligne',
  'gath.needAnotherLook': '{n} nécessitent un nouvel examen',
  'gath.noTaskMatchesOne':
    'Aucune tâche ne correspond à votre recherche. Il y a 1 tâche sur ce rassemblement.',
  'gath.noTaskMatchesMany':
    'Aucune tâche ne correspond à votre recherche. Il y a {n} tâches sur ce rassemblement.',
  'gath.dateWithNoTasks': 'Ce sera une date au calendrier de la famille, sans tâches.',
  'gath.allApprovedOne': 'L’unique tâche est approuvée',
  'gath.allApprovedMany': 'Les {n} tâches approuvées',
  'hlp.tierBadgeBody':
    'Ceci est inclus dans le forfait {plan}, et votre famille est sur un forfait inférieur. Tout ce qui suit est exact — l’écran propose simplement une mise à niveau au lieu de s’ouvrir.',
  'hlp.permissionBadgeBody':
    'Votre modèle de permissions n’inclut pas cet écran, donc l’ouvrir indiquera que la page est introuvable. Un administrateur de votre famille peut le modifier depuis Membres.',
  'inv.joinOnceApproved':
    'Cette personne rejoindra {family} dès qu’un administrateur l’aura approuvée.',
  'account.menuFor': 'Menu du compte de {name}',
  'switcher.viewingClickToSwitch': 'Affichage de {family} — cliquez pour changer de famille',
  'hlp.comingSoonBadgeBody':
    'Cette partie du produit n’est pas encore livrée. Le chapitre décrit ce qu’elle fera ; ouvrir l’écran aujourd’hui affiche un avis Prochainement.',
  'dash.profile.body':
    'Vos parents vous trouvent dans l’Annuaire des membres, et il n’y a pas encore grand-chose. Ajoutez {missing}.',
  'idle.warningBody': 'Vous êtes inactif depuis un moment, nous allons donc vous déconnecter.',
  'idle.signingOutIn': 'Déconnexion dans',
  'notify.waitingApprovalOne': '1 personne attend une approbation',
  'notify.waitingApprovalMany': '{n} personnes attendent une approbation',
  'notes.aFormerOfficer': 'un ancien titulaire',
  'notes.startedByOn': 'Lancé par {name} · {date}',
  'meet.ofInTheRoom': 'sur {n} dans la salle',
  'meet.voteFinalBody':
    'Votre vote sur « {topic} » est enregistré à votre nom et personne ne peut le modifier ni le retirer.',
  'meet.voteChoice': 'Voter {choice}',
  'dir.shownOfTotalOne': '{shown} sur 1 membre',
  'dir.shownOfTotalMany': '{shown} sur {total} membres',
  'rem.familyRemovedHeading': '{family} a été supprimée',
  'rem.switchWithMenu': 'Changez avec le menu famille en haut de la page, ou depuis',
  'rem.stillOpenToYou': 'vous reste ouvert, ainsi que le',
  'rem.manual': 'manuel',
  'pend.welcomeBack': 'Bon retour, {name} !',
  'fam.adminMustApprove':
    'Un administrateur de {family} doit vous approuver avant que vous puissiez voir quoi que ce soit. Les détails de votre profil sont partagés entre toutes les familles auxquelles vous appartenez.',
  'fam.yesJoin': 'Oui, rejoindre {family}',
  'fam.openByDefault': 'Ouvrir {family} par défaut à la connexion ?',
  'profile.photo.replaceConfirm':
    'Remplacer votre photo de profil par « {name} » ? Votre photo actuelle est retirée.',
  'profile.photo.setConfirm': 'Utiliser « {name} » comme photo de profil ?',
  'profile.selectedChapter': 'sélectionnée',
  'profile.confirm.chapterBody':
    'Enregistrer vos modifications et passer à la section {chapter} ? Les fils ou filles de moins de 18 ans sans compte propre vous suivent.',
  'sec.codeSentExpires':
    'Nous avons envoyé un code à 8 chiffres à {email}. Il expire dans une heure.',
  'rep.nothingToShowAria': '{label} : rien à afficher pour le moment',
  'rep.everyUnitCount':
    'Chaque décompte de {unit} dans cette répartition, y compris ceux que le graphique regroupe. ',
  'safety.relativeOne': '1 parent',
  'safety.relativesMany': '{n} parents',
  'safety.withNoEmail': ', {n} sans courriel',
  'safety.willBeAskedOne': '1 parent sera interrogé.',
  'safety.willBeAskedMany': '{n} parents seront interrogés.',
  'safety.noEmailPhoneOne':
    '1 d’entre eux n’a pas d’adresse de courriel enregistrée, quelqu’un devra donc lui téléphoner.',
  'safety.noEmailPhoneMany':
    '{n} d’entre eux n’ont pas d’adresse de courriel enregistrée, quelqu’un devra donc leur téléphoner.',
  'staff.accessForAria': 'Accès de {name}',
  'staff.revokeAccessAria': 'Révoquer l’accès du personnel de {name}',
  'staff.neverRegistered':
    '{lede} Personne ne l’a jamais enregistré. Si une invitation a été envoyée, elle est ci-dessous.',
  'staff.noAddressMatches': 'Aucune adresse de cette page ne contient « {query} ».',
  'staff.never': 'jamais',
  'staff.restoreBody':
    '{code} redevient accessible immédiatement : ses membres peuvent s’y connecter, son code familial fonctionne et ses invitations se résolvent. Rien n’a été supprimé lors du retrait, donc chaque enregistrement revient avec elle.',
  'staff.noFamilyMatches': 'Aucune famille ne correspond à « {query} ».',
  'cf.confirmWithPassword': 'Confirmez avec votre mot de passe',
  'cf.sixDigitsEmailed':
    'Les six chiffres que nous avons envoyés à {email}. Il ne peut servir qu’une fois, et cinq essais erronés l’annulent.',
  'pp.nobodyElseYet': 'Personne d’autre dans la famille pour le moment.',
  'pp.moreMatchKeepTyping': '{n} autres correspondances — continuez à taper',
  'time.yourTime': '{time} votre heure',
  'upd.announcementsNotIncluded':
    'Cette liste est ce qui vous a été envoyé. Les annonces de la famille ne sont pas incluses, car votre famille ne vous a pas donné le tableau — voir',
  'upd.showOlder': 'Afficher {n} plus anciens',
  'act.relativeHasDied':
    'Ce parent est décédé, il n’y a donc aucun anniversaire à souhaiter.',
  'gath.daysFromOne': '1 jour à partir du {date}',
  'gath.daysFromMany': '{n} jours à partir du {date}',
  'access.membersOnCardOne': '1 membre',
  'access.membersOnCardMany': '{n} membres',
  'chat.participantsOne': '1 membre',
  'chat.participantsMany': '{n} membres',
  'dues.schedulesOne': '1 échéancier',
  'dues.schedulesMany': '{n} échéanciers',
  'gath.seriesTwo': '{first} et {second}',
  'gath.seriesOneAndMore': '{first} et {n} de plus',
  'gath.seriesTwoAndMore': '{first}, {second} et {n} de plus',
  'dues.requiredWord': 'obligatoire',
  'dues.optionalWord': 'facultatif',
  'fnd.balanceWord': 'solde',
  'col.schedule': 'Échéancier',
  'col.member': 'Membre',
  'col.status': 'Statut',
  'col.date': 'Date',
  'col.actions': 'Actions',
  'field.chapterLabel': 'Section',
  'cal.todaySrOnly': ' — aujourd’hui',
  'cal.goToMonth': 'Aller à {month}',
  'bill.monthsSuffix': ' · {n} mois',
  'hlp.planBadge': 'forfait {plan}',
  'hlp.badgeComingSoon': 'Prochainement',
  'hlp.badgeNotInAccess': 'Hors de votre accès',
  // ── TIME ZONES ─────────────────────────────────────────────────────────────
  // Keyed on the IANA name, which is what `people.time_zone` stores — see
  // `timezoneLabel` in lib/date-utils.ts. The bracketed abbreviations are the ones
  // a speaker of each language actually uses, so ET is HE in French and stays ET in
  // Spanish; they are not a translation of the letters.
  'tz.America/New_York': 'Heure de l’Est (HE)',
  'tz.America/Chicago': 'Heure du Centre (HC)',
  'tz.America/Denver': 'Heure des Rocheuses (HR)',
  'tz.America/Phoenix': 'Heure des Rocheuses – Arizona (sans heure d’été)',
  'tz.America/Los_Angeles': 'Heure du Pacifique (HP)',
  'tz.America/Anchorage': 'Heure de l’Alaska (AKT)',
  'tz.Pacific/Honolulu': 'Heure d’Hawaï (HT)',
  'tz.America/Toronto': 'Est – Canada',
  'tz.America/Vancouver': 'Pacifique – Canada',
  'tz.America/Halifax': 'Atlantique – Canada',
  'tz.America/St_Johns': 'Terre-Neuve – Canada',
  'tz.Europe/London': 'Londres (GMT/BST)',
  'tz.Europe/Paris': 'Paris (CET/CEST)',
  'tz.Europe/Berlin': 'Berlin (CET/CEST)',
  'tz.Africa/Lagos': 'Afrique de l’Ouest (WAT)',
  'tz.Africa/Johannesburg': 'Afrique du Sud (SAST)',
  'tz.Asia/Dubai': 'Heure du Golfe (GST)',
  'tz.Asia/Kolkata': 'Inde (IST)',
  'tz.Asia/Tokyo': 'Japon (JST)',
  'tz.Asia/Shanghai': 'Chine (CST)',
  'tz.Australia/Sydney': 'Sydney (AEST/AEDT)',
  'tz.Pacific/Auckland': 'Nouvelle-Zélande (NZST/NZDT)',

  // ── DOCUMENT TITLES, 2026-08-31 ────────────────────────────────────────────
  // The browser TAB, which is not always the <h1>: a tab has no rail above it to say
  // where it is, so thirteen of these disambiguate against a sibling route. Every other
  // screen's tab reuses its own `page.<route>.title` and so cannot drift from its
  // heading — see `lib/i18n/page-metadata.ts` for why that is one key and not two, and
  // for the measurement that retired the note below.
  'doc./admin/accounting.title': 'Comptabilité — Administration',
  'doc./admin/elections.title': 'Élections — Administration',
  'doc./admin/elections/[id].title': 'Élection',
  'doc./admin/gatherings.title': 'Rassemblements — Administration',
  'doc./admin/gatherings/[id].title': 'Rassemblement — Administration',
  'doc./community/elections/[id].title': 'Élection',
  'doc./community/gallery/[id].title': 'Album',
  'doc./gatherings/[id].title': 'Rassemblement',
  'doc./library/meeting-minutes/[id].title': 'Réunion',
  'doc./reporting/board.title': 'Rapport du conseil et des fonctions',
  'doc./reporting/elections.title': 'Rapport des élections',
  'doc./reporting/gatherings.title': 'Rapport des rassemblements',
  'doc./reporting/meetings.title': 'Rapport des réunions',
  'doc./community/distributions.title': 'Distributions',
  'doc./community/gallery.title': 'Galerie',
  'doc./community/safety-check-ins.title': 'Vérifications de sécurité',
  'doc./library/bylaws.title': 'Statuts',
  'doc./library/meeting-minutes.title': 'Procès-verbaux',
  'doc./dashboard.title': 'Tableau de bord',
  'doc./update-password.title': 'Choisir un nouveau mot de passe',
  'doc./invite.title': 'Invitation',
  // ── THE STAFF CONSOLE'S HEADINGS, 2026-08-31 ───────────────────────────────
  // Four of these were bare JSX literals, which the prose gate cannot see.
  'page./staff.title': 'Console du personnel {app}',
  'page./staff/access.title': 'Accès',
  'page./staff/accounts.title': 'Comptes',
  'page./staff/families.title': 'Familles',
  // ── PAGE HEADINGS ────────────────────────────────────────────────────────────────
  // The same words as the rail for most screens, and kept as separate keys for the reason
  // `en.ts` gives. *Rassemblements* / *Réunions* divides here exactly as it does above.
  'page./accounting/dues-and-donations.title': 'Cotisations et dons',
  'page./accounting/summary.title': 'Résumé',
  'page./reporting/transactions.title': 'Transactions',
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
  'page./accounting/payment-history.title': 'Historique des paiements',
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
  'notify.notBuilt': 'Bientôt disponible',
  'notify.stopped': 'Arrêté',
  'notify.on': 'Activé',
  'notify.off': 'Désactivé',
  'notify.toggleLabel': '{channel} pour {notification}',
  'notify.noneOnFile': 'Aucun enregistré',
  'notify.placeholderAddress': 'Une adresse générée : rien ne peut y parvenir',
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
  'money.member': 'Membre',
  'money.fund': 'Fonds',
  'money.fromTo': 'De',
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
  'pnl.disbursements': 'Versements',
  'pnl.processingFees': 'Frais de carte',
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
  'history.processingFee': 'Frais de traitement de carte',
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
  'bylaws.addArticle': 'Ajouter un article',
  'bylaws.addArticleAction': 'Ajouter l’article',
  'bylaws.searchLabel': 'Rechercher dans les statuts',
  'bylaws.searchPh': 'quorum, “assemblée annuelle”, cotisations -procuration',
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
  'gath.pane.myTasksN': 'Mes tâches ({n})',
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

  // ── THE COMMUNITY SECTION ────────────────────────────────────────────────────────
  // *Fiche* for a record — a card kept about somebody — rather than *enregistrement*, which
  // reads as a database row. *Section* stays the chapter, as everywhere else.
  'action.remove': 'Retirer',
  'action.done': 'Terminé',
  'action.continue': 'Continuer',
  'action.back': 'Retour',
  'action.copied': 'Copié',
  'action.wentWrong': 'Une erreur est survenue',
  'action.creating': 'Création…',
  'common.notStated': 'Non précisé',
  'common.national': 'National',
  'common.noChapter': 'Aucune section',
  'field.firstNameLower': 'Prénom',
  'field.lastNameLower': 'Nom',
  'field.emailAddress': 'Adresse courriel',
  'field.dobLower': 'Date de naissance',
  'field.ph.firstName': 'Aline',
  'field.ph.lastName': 'Okonkwo',
  'field.ph.cousinEmail': 'cousin@exemple.com',
  'field.ph.theirEmail': 'destinataire@exemple.com',
  'common.optional': 'Facultatif',
  'gal.heading': 'Galerie',
  'gal.rail': 'Sections de la galerie',
  'gal.pane.albums': 'Albums',
  'gal.pane.search': 'Rechercher',
  'gal.newAlbum': 'Nouvel album',
  'gal.createAlbum': 'Créer l’album',
  'gal.looking': 'Recherche des albums…',
  'gal.noAlbums': 'Aucun album pour l’instant.',
  'gal.pressNew': 'Appuyez sur Nouvel album pour en créer un.',
  'gal.somebodyCan': 'Une personne autorisée à ajouter à la galerie peut en créer un.',
  'gal.albumIs': 'Un ensemble de photographies que la famille garde ensemble.',
  'gal.albumNamePh': 'Retrouvailles de l’été 2026',
  'gal.albumDescPh': 'Trois jours au lac',
  'gal.needName': 'Donnez un nom à l’album',
  'gal.createFailed': 'Cet album n’a pas pu être créé.',
  'gal.deleteAlbum': 'Supprimer l’album',
  'gal.deleteAlbumBody': 'Ceci supprime l’album. Il ne contient aucune photographie.',
  'gal.deleteAlbumFailed': 'Cet album n’a pas pu être supprimé.',
  'gal.grid': 'Grille',
  'gal.list': 'Liste',
  'gal.howToShow': 'Comment afficher les photographies',
  'gal.searchCaptions': 'Rechercher dans les légendes',
  'gal.searchCaptionsPh': 'lac, retrouvailles, 90 ans…',
  'gal.whoIsInIt': 'Qui y figure',
  'gal.whoHint':
    'Choisissez n’importe qui d’identifié dans cet album. Une photographie s’affiche si '
    + 'N’IMPORTE LEQUEL y figure — en choisir trois élargit le résultat au lieu de le '
    + 'restreindre.',
  'gal.nobodyTagged': 'Personne n’est encore identifié sur une photographie ici.',
  'gal.addPhotos': 'Ajouter des photographies',
  'gal.clearFilters': 'Effacer les filtres',
  'gal.noneInAlbum': 'Aucune photographie dans cet album pour l’instant.',
  'gal.noneMatch': 'Aucune photographie ici ne correspond à votre filtre.',
  'gal.chooseFiles': 'Choisissez des fichiers',
  'gal.batchCaption': 'Légende pour toutes (facultative)',
  'gal.batchCaptionHint':
    'Une seule légende pour le lot. Vous pourrez en changer une à une ensuite dans la vue en '
    + 'liste.',
  'gal.captionPh': 'Samedi, au lac',
  'gal.noCaption': 'Sans légende',
  'gal.caption': 'Légende',
  'gal.changeCaption': 'Modifier cette légende',
  'gal.tagSomebody': 'Identifier quelqu’un',
  'gal.searchFamily': 'Rechercher dans la famille…',
  'gal.searchToTag': 'Rechercher quelqu’un à identifier',
  'gal.nobodyMatches': 'Personne ne correspond.',
  'gal.closePhoto': 'Fermer la photographie',
  'gal.openPhotographIn': 'Ouvrir la photographie : {what}',
  'gal.nOfTotal': '{n} sur {total}',
  'gal.searchAllLabel': 'Chercher dans tous les albums',
  'gal.searchAllPh': 'lac, retrouvailles, les 90 ans de grand-mère',
  'gal.searchAllHint': 'Des mots d’une légende, et toute personne identifiée. Les deux filtres se combinent.',
  'gal.searchWhoIsIn': 'Qui apparaît (facultatif)',
  'gal.searchWhoIsInHint': 'Uniquement les photographies identifiant toutes les personnes choisies ici.',
  'gal.searchFoundOne': '1 photographie correspond.',
  'gal.searchFoundMany': '{n} photographies correspondent.',
  'gal.searchMoreNotShown': '{n} de plus ne sont pas affichées — affinez la recherche.',
  'gal.searchNoMatches': 'Aucune photographie ne correspond.',
  'gal.searchRefused': 'Impossible de chercher dans les photographies.',
  'gal.prevPhoto': 'Photographie précédente',
  'gal.nextPhoto': 'Photographie suivante',
  'gal.openPhoto': 'Ouvrir cette photographie',
  'gal.deletePhoto': 'Supprimer la photographie',
  'gal.deletePhotoBody':
    'Supprimer cette photographie ? Elle est retirée pour tout le monde, avec ses '
    + 'identifications, et le fichier image aussi. Cette action est irréversible.',
  'gal.deletePhotoFailed': 'Cela n’a pas pu être supprimé.',
  'gal.chooseImage': 'Choisissez au moins une image.',
  'gal.nothingUploaded': 'Rien n’a été téléversé.',
  'gal.captionFailed': 'Cette légende n’a pas pu être enregistrée.',
  'gal.tagFailed': 'Cette identification n’a pas pu être ajoutée.',
  'gal.removeTag': 'Retirer l’identification',
  'gal.removeTagFailed': 'Cette identification n’a pas pu être retirée.',
  'gal.addedByGone': 'Ajoutée par une personne qui n’est plus dans cette famille',
  'tree.nobodyToBuild': 'Il n’y a encore personne dans cette famille pour bâtir un arbre.',
  'tree.centreOnMe': 'Centrer sur moi',
  'tree.children': 'Enfants',
  'tree.notOnTree': 'Pas encore sur l’arbre',
  'tree.everyone': 'Tout le monde dans cette famille',
  'tree.recordOnly': 'Fiche seulement',
  'tree.invited': 'Invité',
  'tree.noEmail': 'Sans courriel',
  'tree.inBloodline': 'Dans la lignée',
  'tree.marksBlood': 'Indique un parent par le sang',
  'tree.mode': 'Mode de l’arbre',
  'tree.whichRelatives': 'Quels parents afficher',
  'tree.bloodlineHelp': 'Aide : le filtre Lignée',
  'tree.editOrInvite': 'Modifier cette fiche, ou l’inviter',
  'tree.removeConnection': 'Retirer ce lien',
  'tree.removeConnectionAction': 'Retirer le lien',
  'tree.removeConnectionFailed': 'Ce lien n’a pas pu être retiré.',
  'tree.fullFamily': 'Toute la famille',
  'tree.bloodline': 'Lignée',
  'tree.father': 'Père',
  'tree.mother': 'Mère',
  'tree.thisAndMarriages': 'Cette personne et ses mariages',
  'tree.thisAndSpouse': 'Cette personne et son conjoint',
  'tree.thisPerson': 'Cette personne',
  'tree.siblings': 'Frères et sœurs',
  'tree.thisPersonIs': 'Cette personne est',
  'tree.thesePeopleAre': 'Ces personnes sont',
  'rel.how': 'Comment',
  'rel.chooseHow': 'Choisissez comment cette personne rejoint l’arbre.',
  'rel.alreadyHere': 'Une personne déjà présente',
  'rel.alreadyHereHint': 'Reliez un parent déjà présent dans votre famille.',
  'rel.inviteThem': 'L’inviter',
  'rel.inviteHint':
    'Nous envoyons une invitation par courriel. La personne rejoint la famille dès qu’un '
    + 'administrateur l’approuve.',
  'rel.noEmail': 'Sans adresse courriel',
  'rel.noEmailHint':
    'Enregistrez-la sans adresse — pour les parents décédés, les aînés et les enfants.',
  'rel.noEmailChildHint':
    'Enregistrez-la sans adresse — pour un enfant trop jeune pour avoir un compte. Nous '
    + 'demandons sa date de naissance parce que les cotisations peuvent commencer à un certain '
    + 'âge.',
  'rel.whyNoEmail': 'Pourquoi n’y a-t-il pas d’adresse courriel ?',
  'rel.generated':
    'Nous avons généré une adresse pour que la fiche puisse exister. Rien n’y est jamais '
    + 'envoyé.',
  'rel.addedToTree': 'Ajouté à l’arbre',
  'rel.adding': 'Ajout…',
  'rel.everyoneAttached':
    'Tout le monde dans la famille est déjà relié ici. Invitez quelqu’un, ou enregistrez-le '
    + 'sans courriel.',
  'rel.whatRecordIs': 'Ce qu’est une fiche, et comment la personne obtient un compte plus tard',
  'rel.tooYoung': 'Trop jeune pour un compte · Pas encore de courriel',
  'rel.reasonExamples':
    'Décédé en 1998 · Sans courriel, téléphone seulement · Trop jeune pour un compte',
  'rel.emailedInvite':
    'Nous lui avons envoyé une invitation par courriel. Lorsqu’elle l’acceptera, son compte '
    + 'rejoindra cette fiche.',
  'rel.inviteNotEmailed':
    'L’invitation a été créée mais nous n’avons pas pu l’envoyer par courriel. Renvoyez-la '
    + 'depuis Administration › Membres › Approbations en attente.',
  'rel.onTreeNoInvite':
    'La personne est sur l’arbre, mais nous n’avons pas pu créer d’invitation — le plus '
    + 'souvent parce que cette adresse est déjà dans votre famille. Reliez plutôt la personne '
    + 'existante.',
  'rec.saved': 'Enregistré.',
  'rec.savedShort': 'Enregistré',
  'rec.connectionFailed': 'Ce lien n’a pas pu être modifié.',
  'rec.needNames': 'Saisissez un prénom et un nom',
  'rec.saveFailed': 'Cela n’a pas pu être enregistré.',
  'rec.inviteFailed': 'Cette personne n’a pas pu être invitée.',
  'rec.theirOwnProfile': 'Cette personne gère son propre profil, donc seul le lien vous revient.',
  'rec.noAccountAnyone':
    'Elle n’a pas de compte, donc n’importe qui dans la famille peut tenir cette fiche à '
    + 'jour.',
  'rec.saveDetails': 'Enregistrer les informations',
  'rec.inviting': 'Invitation…',
  'rec.sendInvitation': 'Envoyer l’invitation',
  'chat.messages': 'Messages',
  'chat.newDm': 'Nouveau message',
  'chat.new': 'Nouveau',
  'chat.noGroups': 'Aucun groupe pour l’instant.',
  'chat.directMessages': 'Messages directs',
  'chat.groupMessages': 'Messages de groupe',
  'chat.unread': 'Messages non lus',
  'chat.familyChat': 'Chat de la famille',
  'chat.directMessage': 'Message direct',
  'chat.familyMember': 'Membre de la famille',
  'chat.selectConversation': 'Choisissez une conversation pour commencer à écrire.',
  'chat.deleteConversation': 'Supprimer la conversation',
  'chat.groupName': 'Nom du groupe',
  'chat.members': 'Participants',
  'chat.newGroup': 'Nouveau groupe',
  'chat.newGroupHint': 'Donnez un nom au groupe et choisissez qui inclure.',
  'chat.groupNamePh': 'p. ex. Organisation des retrouvailles d’été',
  'chat.needGroupName': 'Le nom du groupe est obligatoire',
  'chat.createGroup': 'Créer le groupe',
  'chat.newDmTitle': 'Nouveau message direct',
  'chat.newDmHint': 'Choisissez un membre de la famille pour commencer une conversation privée.',
  'chat.noOthers': 'Aucun autre membre de la famille n’a encore de compte.',
  'chat.starting': 'Démarrage…',
  'chat.startConversation': 'Démarrer la conversation',
  'chat.manageMembers': 'Gérer les participants',
  'chat.addMembers': 'Ajouter des participants :',
  'chat.typeMessage':
    'Écrivez un message… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)',
  'chat.send': 'Envoyer',
  'chat.noMessages': 'Aucun message pour l’instant. Dites bonjour !',
  'chat.sendFailed': 'L’envoi a échoué',
  'chat.addToGroup': 'Ajouter au groupe',
  'chat.addFailed': 'Ce participant n’a pas pu être ajouté',
  'chat.removeFromGroup': 'Retirer du groupe',
  'chat.removeFailed': 'Ce participant n’a pas pu être retiré',
  'chat.ended': 'Cette conversation est terminée.',
  'chat.youWereRemoved': 'Vous avez été retiré de ce groupe.',
  'dir.allChapters': 'Toutes les sections',
  'dir.noMatches': 'Aucun membre ne correspond à votre recherche.',
  'dir.minor': 'Mineur',
  'dir.notRegistered': 'Pas encore inscrit',
  'dir.filterByChapter': 'Filtrer par section',
  'dir.position': 'Fonction',
  'dir.group': 'Groupe',
  'dir.preferredName': 'Nom d’usage',
  'dir.account': 'Compte',
  'dir.registered': 'Inscrit',
  'dir.editProfile': 'Modifier le profil',
  'dir.cityState': 'Ville, État',
  'dir.region': 'Région',
  'elec.nominated': 'Vous avez été proposé !',
  'elec.accept': 'Accepter',
  'elec.decline': 'Refuser',
  'elec.acceptNomination': 'Accepter la proposition',
  'elec.declineNomination': 'Refuser la proposition',
  'elec.answerFailed': 'Votre réponse n’a pas pu être enregistrée.',
  'elec.castYourVote': 'Votez',
  'elec.castVote': 'Voter',
  'elec.changeVote': 'Changer de vote',
  'elec.changeYourVote': 'Changer votre vote',
  'elec.castYourVoteAction': 'Exprimer votre vote',
  'elec.voteFailed': 'Le vote a échoué',
  'elec.noCandidates': 'Aucun candidat pour cette fonction.',
  'elec.nominationsNotOpen': 'Les propositions ne sont pas encore ouvertes.',
  'elec.notPublished': 'Cette élection n’a pas encore été publiée.',
  'elec.position': 'Fonction',
  'elec.nominations': 'Propositions',
  'elec.noOffices': 'Cette élection ne comporte encore aucune fonction.',
  'elec.nominate': 'Proposer',
  'elec.noNominations': 'Aucune proposition pour cette fonction.',
  'elec.putMyselfForward': 'Me proposer',
  'elec.whoNominating': 'Qui proposez-vous ?',
  'elec.nominateFailed': 'Cette proposition n’a pas pu être envoyée.',
  'elec.withdrawYours': 'Retirer votre proposition',
  'elec.takeNameOff': 'Retirer votre nom de cette proposition',
  'elec.withdraw': 'Retirer',
  'elec.takeMyNameOff': 'Retirer mon nom',
  'elec.withdrawFailed': 'Cette proposition n’a pas pu être retirée.',
  'elec.nobodyNominated': 'Personne n’a encore été proposé',
  'elec.accepted': 'Acceptée',
  'elec.waitingAnswer': 'En attente de sa réponse',
  'elec.anybodyMayBe': 'N’importe qui dans la famille peut être proposé.',
  'cal.thisMonth': 'Ce mois-ci',
  'cal.nothingToday': 'Rien aujourd’hui.',
  'cal.prevMonth': 'Mois précédent',
  'cal.nextMonth': 'Mois suivant',
  'cal.kind.premier': 'Rassemblement à la une',
  'cal.kind.gathering': 'Rassemblement',
  'cal.kind.meeting': 'Réunion',
  'cal.kind.nominations': 'Propositions ouvertes',
  'cal.kind.voting': 'Vote ouvert',

  // ── SAFETY, MEMBERSHIP, INVITATIONS AND THE MEMBERSHIP REPORT ────────────────────
  // *Demande* throughout, never *alerte*. See `en.ts`.
  'safety.heading': 'Demandes de sécurité',
  'safety.lede':
    'Demandez aux parents d’un secteur s’ils sont en sécurité, et voyez les réponses arriver.',
  'safety.raise': 'Lancer une demande',
  'safety.askingAboutYou': 'Votre famille s’informe de vous',
  'safety.listFailed':
    'La liste des demandes n’a pas pu être chargée pour le moment. Rechargez la page pour '
    + 'réessayer.',
  'safety.open': 'Ouvertes',
  'safety.closed': 'Closes',
  'safety.nothingOpen': 'Rien d’ouvert. Lorsque quelqu’un lance une demande, elle apparaît ici.',
  'safety.notShownToYou':
    'Vous pouvez voir que cette demande a été lancée. Qui a répondu ne vous est pas montré.',
  'safety.retryFailed': 'Réessayer ceux qui ont échoué',
  'safety.close': 'Clore la demande',
  'safety.loadingRoster': 'Chargement des personnes interrogées…',
  'safety.safe': 'En sécurité',
  'safety.needHelp': 'Besoin d’aide',
  'safety.waiting': 'En attente',
  'safety.notReached': 'Non joint',
  'safety.notAddressed': 'Non adressé',
  'safety.askFailed': 'Tout le monde n’a pas pu être interrogé',
  'safety.didNotWork': 'Cela n’a pas fonctionné',
  'safety.deleteConfirm': 'Supprimer cette demande ?',
  'safety.deleteFailed': 'Cette demande n’a pas pu être supprimée',
  'safety.deleted': 'Demande supprimée',
  'safety.everyone': 'Tout le monde dans la famille',
  'safety.handPicked': 'Parents choisis un à un',
  'safety.oneArea': 'Un secteur',
  'safety.asking': 'Envoi de la demande…',
  'safety.hideRoster': 'Masquer les personnes interrogées',
  'safety.seeRoster': 'Voir les personnes interrogées',
  'safety.iAmSafe': 'Je suis en sécurité',
  'safety.iNeedHelp': 'J’ai besoin d’aide',
  'safety.anythingToKnow': 'Quelque chose que votre famille devrait savoir ? (facultatif)',
  'safety.notePh': 'Où vous êtes, ce dont vous avez besoin, ou rien du tout.',
  'safety.saveNote': 'Enregistrer la note',
  'safety.saved': 'Enregistré',
  'safety.answerFailed': 'Votre réponse n’a pas pu être enregistrée',
  'safety.toldSafe': 'Vous avez dit à votre famille que vous êtes en sécurité.',
  'safety.toldHelp': 'Vous avez dit à votre famille que vous avez besoin d’aide.',
  'safety.actuallyHelp': 'En fait, j’ai besoin d’aide',
  'safety.nobodyOn': 'Personne n’est sur cette demande.',
  'safety.relative': 'Parent',
  'safety.answer': 'Réponse',
  'safety.howAsked': 'Comment la demande leur est parvenue',
  'safety.answered': 'A répondu',
  'safety.needsHelp': 'A besoin d’aide',
  'safety.noEmailPhone': 'Aucun courriel enregistré — un appel est nécessaire',
  'safety.emailFailed': 'Le courriel n’est pas passé',
  'safety.notAsked': 'Pas encore interrogé',
  'safety.askedByEmail': 'Demande envoyée par courriel',
  'safety.sending': 'Envoi',
  'safety.whatHappening': 'Ce qui se passe',
  'safety.subjectHint':
    'C’est l’objet du courriel que vos parents reçoivent. Gardez-le reconnaissable.',
  'safety.anythingElse': 'Autre chose à leur dire (facultatif)',
  'safety.whoToAsk': 'Qui interroger',
  'safety.justNamed': 'Seulement les parents que je nomme',
  'safety.nobodySelected': 'Personne n’est encore sélectionné, donc rien ne sera envoyé.',
  'safety.askIfSafe': 'Demander s’ils sont en sécurité',
  'safety.oneQuestion':
    'Chaque personne choisie reçoit une seule question, et répond d’une seule touche.',
  'safety.titlePh': 'Ouragan Delia',
  'safety.detailPh': 'Où aller, qui appeler, ce que vous savez.',
  'safety.relativesToAsk': 'Parents à interroger',
  'safety.emailedOne':
    'Chaque personne choisie reçoit une question par courriel et peut répondre d’une seule '
    + 'touche.',
  'safety.noRelatives': 'Aucun parent à choisir pour l’instant.',
  'safety.sayWhat': 'Dites ce qui se passe, pour que vos parents sachent sur quoi on les interroge',
  'safety.chooseOne': 'Choisissez au moins un parent à interroger',
  'safety.raiseFailed': 'La demande n’a pas pu être lancée',
  'safety.askThem': 'Les interroger',
  'fam.heading': 'Mes familles',
  'fam.pending': 'En attente',
  'fam.removed': 'Supprimée',
  'fam.declined': 'Refusée',
  'fam.viewing': 'Consultée',
  'fam.default': 'Par défaut',
  'fam.familyCode': 'Code familial :',
  'fam.changeDefault': 'Changer la famille par défaut',
  'fam.makeDefault': 'Définir par défaut',
  'fam.inviteMember': 'Inviter un membre',
  'fam.copyCode': 'Copier le code',
  'fam.join': 'Rejoindre une autre famille',
  'fam.codeLabel': 'Code familial',
  'fam.codePh': 'ABC234',
  'fam.askSomeone': 'Demandez à quelqu’un de la famille son code familial.',
  'fam.isThisRight': 'Est-ce la bonne famille ?',
  'fam.checking': 'Vérification…',
  'fam.joining': 'Adhésion…',
  'fam.requestSent': 'Demande envoyée',
  'fam.yourRequestTo': 'Votre demande d’adhésion à',
  'rem.nothingDeleted': 'Rien n’a été supprimé',
  'rem.otherFamily': 'Votre autre famille',
  'rem.otherFamilies': 'Vos autres familles',
  'pend.waiting': 'En attente d’approbation',
  'pend.declined': 'Demande refusée',
  'pend.switchedOff': 'Accès désactivé',
  'pend.yourRequests': 'Vos demandes d’adhésion',
  'pend.adminOf': 'Un administrateur de',
  'pend.pending': 'En attente',
  'pend.mistake': 'Vous pensez qu’il s’agit d’une erreur ?',
  'pend.lookAgain': 'Demandez-leur de réexaminer',
  'pend.confirmEmail': 'Confirmez votre adresse courriel',
  'pend.appealPh':
    'Je suis le cadet de Marthe — ma mère est née à Bastrop et ma cousine Aline est déjà '
    + 'membre.',
  'pend.withAdmins': 'Auprès de ses administrateurs, pour examen.',
  'pend.wasDeclined': 'Un administrateur a refusé votre demande d’adhésion.',
  'pend.wasSwitchedOff': 'Un administrateur a désactivé votre accès.',
  'pend.sentCheckInbox': 'Envoyé. Vérifiez votre boîte de réception.',
  'pend.declinedShort': 'Refusée',
  'pend.switchedOffShort': 'Désactivé',
  'pend.sendToAdmins': 'Envoyer aux administrateurs',
  'pend.sendAgain': 'L’envoyer de nouveau',
  'pend.member': 'Membre',
  'inv.title': 'Inviter un membre',
  'inv.sent': 'Invitation envoyée',
  'inv.created': 'Invitation créée',
  'inv.emailedTo': 'Nous avons envoyé une invitation par courriel à',
  'inv.anInvitationFor': 'Une invitation pour',
  'inv.sendThisLink': 'Envoyez-lui ce lien',
  'inv.noSecondApproval':
    'La personne sera admise dès qu’elle acceptera — sans seconde approbation.',
  'inv.needsApproval': 'Il faudra encore qu’un administrateur l’approuve.',
  'inv.create': 'Créer l’invitation',
  'inv.admittedAtOnce':
    'La personne sera admise dès qu’elle acceptera — elle n’apparaîtra pas dans la file '
    + 'd’approbation.',
  'inv.willAppearInQueue':
    'Lorsqu’elle acceptera, elle apparaîtra dans les approbations de membres, en attente d’un '
    + 'administrateur.',
  'inv.signOutFailed':
    'Nous n’avons pas pu vous déconnecter pour le moment. Votre lien d’invitation est '
    + 'toujours dans la barre d’adresse — réessayez, ou ouvrez-le dans une fenêtre privée.',
  'inv.copyFailed': 'Nous n’avons pas pu le copier. Le lien est dans votre barre d’adresse.',
  'inv.signingOut': 'Déconnexion…',
  'inv.signOutContinue': 'Se déconnecter et continuer',
  'inv.linkCopied': 'Lien copié',
  'inv.copyLink': 'Copier le lien d’invitation',
  'consent.decline': 'Refuser',
  'consent.allow': 'Autoriser',
  'consent.label': 'Choix concernant la mesure publicitaire',
  'soon.heading': 'Bientôt disponible',
  'soon.availableNow': 'Disponible maintenant',
  'soon.back': 'Retour au tableau de bord',
  'upg.familyIsOn': 'Votre famille est sur le forfait',
  'upg.changePlan': 'Changer de forfait',
  'upg.askAdmin': 'Demandez à un administrateur de votre famille de changer le forfait.',
  'rep.group': 'Groupe',
  'rep.members': 'Membres',
  'rep.share': 'Part',
  'rem.heading': 'Rappels automatiques',
  'rem.noneQueuedYet':
    'Aucun rappel de cotisation n’a encore été mis en file. Un rappel est mis en file pour '
    + 'chaque échéance à son terme.',
  'rem.lastWentOut': 'Le dernier rappel est parti le {on}.',
  'rem.noneSentYet': 'Rien n’est encore parti.',
  'rem.state.pending': 'En attente d’envoi',
  'rem.state.sending': 'En cours d’envoi',
  'rem.state.sent': 'Envoyés',
  'rem.state.failed': 'Échoués',
  'rem.state.unreachable': 'Sans adresse',
  'rem.state.cancelled': 'Déjà payé',
  'rem.statesHint':
    'Déjà payé signifie que l’échéance a été réglée après la mise en file du rappel, qui '
    + 'n’a donc jamais été envoyé — personne n’est relancé pour de l’argent que la famille '
    + 'avait déjà. Sans adresse signifie que le proche n’a pas de véritable adresse e-mail '
    + 'sur sa fiche.',
  'rem.cannotReach': 'Injoignables par e-mail',
  'rem.timesN': '({n})',
  'rem.cannotReachHint':
    'Leur fiche porte une adresse de remplacement plutôt qu’une vraie. Les inviter depuis '
    + 'l’arbre familial, ou ajouter une adresse, est ce qui règle cela — et cela vaut la '
    + 'peine bien au-delà des cotisations.',
  'rem.neverTwice': 'Personne n’est relancé deux fois pour la même échéance.',
  'rep.pressRow': 'Appuyez sur une ligne pour voir qui s’y trouve.',
  'rep.nationally': 'À l’échelle nationale',
  'rep.regions': 'Régions',
  'rep.chapters': 'Sections',
  'rep.canSignIn': 'Peut se connecter',
  'rep.neverInvited': 'Jamais invité',
  'rep.byRegion': 'Par région',
  'rep.byRegionHint':
    'Où se trouve la famille, un échelon au-dessus de ses sections. Un membre sans section — '
    + 'ou dans une section qui ne relève d’aucune région — relève de National, qui est '
    + 'l’absence de région et non un lieu en soi.',
  'rep.byChapter': 'Par section',
  'rep.byChapterHint':
    'Chaque section que la famille a créée, y compris celles que personne n’a encore '
    + 'rejointes. Une section à zéro est la première à regarder.',
  'rep.invitations': 'Invitations',
  'rep.invitationsHint':
    'Actif signifie que la personne a un compte et peut se connecter. Invité signifie qu’une '
    + 'invitation est ouverte et sans réponse. Invitation à envoyer signifie que personne ne '
    + 'lui a encore demandé — elle est sur la liste et doit des cotisations comme tout le '
    + 'monde.',
  'rep.adultsMinors': 'Adultes et mineurs',
  'rep.adultsMinorsHint':
    'Calculé à partir de la date de naissance de chaque membre à chaque chargement de cette '
    + 'page, jamais stocké. Une date que personne n’a enregistrée n’est comptée dans aucun des '
    + 'deux groupes plutôt que devinée — les barèmes de cotisations avec un âge de départ '
    + 'facturent à partir de la date enregistrée, donc une date vide est de l’argent que '
    + 'personne ne réclame.',
  'slice.filterPh': 'Filtrer ces membres par nom…',
  'slice.noMatch': 'Personne dans ce groupe ne correspond à ce filtre.',
  'slice.nobodyIn': 'Personne n’est dans ce groupe.',
  'slice.needChapterPerm':
    'Rattacher quelqu’un à une section demande la permission de modifier les membres, qui ne '
    + 'vous a pas été accordée.',
  'slice.needInvitePerm':
    'Envoyer une invitation demande la permission de modifier l’arbre généalogique, qui ne '
    + 'vous a pas été accordée.',
  'slice.needBirthdayPerm':
    'Enregistrer une date de naissance demande la permission de modifier les membres, qui ne '
    + 'vous a pas été accordée.',
  'slice.placeholderAddress':
    'Sa fiche contient une adresse générée, l’invitation en demande donc une vraie.',
  'slice.needEmail': 'Saisissez une adresse courriel à laquelle envoyer l’invitation',
  'slice.needDob': 'Saisissez une date de naissance',
  'slice.chapterFailed': 'Cette section n’a pas pu être enregistrée.',
  'slice.inviteFailed': 'Cette invitation n’a pas pu être envoyée.',
  'slice.canResend': 'Membres et accès peut la renvoyer.',
  'slice.dateFailed': 'Cette date n’a pas pu être enregistrée.',
  'slice.noAccount': 'Aucun compte',
  'slice.inviteOpen': 'Invitation ouverte',
  'slice.setChapter': 'Définir la section',
  'slice.saveChapter': 'Enregistrer la section',
  'slice.invite': 'Inviter',
  'slice.sendInvitation': 'Envoyer l’invitation',
  'slice.addBirthday': 'Ajouter la date de naissance',
  'slice.saveDate': 'Enregistrer la date',
  'fam.create': 'Créer une nouvelle famille',
  'fam.createAction': 'Créer la famille',
  'fam.nameLabel': 'Nom de la famille',
  'fam.namePh': 'La famille Okonkwo',
  'fam.created': 'Famille créée',
  'fam.codeHeading': 'Code familial',
  'fam.firstAdmin': 'Vous en serez le premier administrateur. Votre profil est conservé.',

  // ── THE ADMIN CONSOLE ────────────────────────────────────────────────────────────
  // *Modèle d'autorisations* for the grid and *modèle de rassemblement* for the list of steps —
  // never bare *modèle* where both could be meant. *Fonction* is the office throughout.
  'action.adding': 'Ajout…',
  'action.working': 'Traitement…',
  'action.change': 'Modifier',
  'action.failed': 'Échec',
  'common.required': 'Obligatoire',
  'common.description': 'Description',
  'common.scope': 'Portée',
  'common.amount': 'Montant',
  'acct.rail': 'Zones de comptabilité',
  'acct.section.income': 'Produits',
  'acct.section.donations': 'Dons',
  'acct.section.routing': 'Affectation',
  'acct.section.milestones': 'Jalons',
  'acct.section.processing': 'Encaissement',
  'acct.section.bank': 'Coordonnées bancaires',
  'acct.section.settings': 'Paramètres',
  'acct.heading': 'Comptabilité',
  'acct.newDues': 'Nouvelle cotisation',
  'acct.newDonation': 'Nouveau don',
  'acct.newFund': 'Nouveau fonds',
  'acct.newMilestone': 'Nouveau jalon',
  'acct.noBank': 'Aucun compte bancaire enregistré',
  'rg.general': 'Général',
  'rg.personal': 'Personnel',
  'rg.community': 'Communauté',
  'rg.library': 'Bibliothèque',
  'rg.gatherings': 'Rassemblements',
  'rg.accounting': 'Comptabilité',
  'rg.resources': 'Ressources',
  'rg.administration': 'Administration',
  'set.rail': 'Sections des paramètres',
  'set.pane.family': 'Famille',
  'set.pane.billing': 'Facturation',
  'set.pane.plan': 'Forfait',
  'set.familyName': 'Nom de la famille',
  'set.timezone': 'Fuseau horaire',
  'set.saveName': 'Enregistrer le nom',
  'set.familyCode': 'Code familial',
  'set.removed': 'Cette famille a été supprimée',
  'set.remove': 'Supprimer cette famille',
  'set.nothingDeleted': 'Rien n’est supprimé.',
  'set.sendAnotherCode': 'Envoyer un autre code',
  'set.emailMeCode': 'M’envoyer par courriel un code de suppression',
  'set.enterCode': 'Saisissez les six chiffres reçus par courriel.',
  'set.codeFailed': 'Nous n’avons pas pu envoyer le courriel pour le moment.',
  'set.enterAndRemove': 'Saisissez le code et supprimez',
  'set.howPlanWorks': 'Ce que fait un changement de forfait',
  'set.howPayingWorks': 'Comment fonctionne le paiement d’un forfait',
  'set.howRemovalWorks': 'Ce que fait la suppression d’une famille',
  'appr.thisPerson': 'Cette personne',
  'appr.lookAgain': 'Cette personne vous a demandé de réexaminer :',
  'appr.immediate':
    'La personne aura un accès immédiat à tout ce que votre famille a rendu visible aux '
    + 'membres.',
  'appr.approve': 'Approuver',
  'appr.wasDeclinedBefore':
    'Cette personne a déjà été refusée. L’admettre maintenant lui donne un accès immédiat à '
    + 'tout ce que votre famille a rendu visible aux membres, et elle en sera informée.',
  'appr.nobodyWaiting':
    'Personne n’attend. Les demandes apparaissent ici lorsque quelqu’un s’inscrit avec votre '
    + 'code familial.',
  'appr.checkRecognise': 'Vérifiez que vous reconnaissez la personne avant de l’admettre.',
  'appr.declineRequest': 'Refuser la demande',
  'appr.declineBody':
    'La personne sera informée, et peut recevoir un motif. Sa fiche est conservée plutôt que '
    + 'supprimée.',
  'appr.reason': 'Motif (facultatif — montré à la personne)',
  'appr.invitationsSent': 'Invitations envoyées',
  'appr.preApproved': 'Pré-approuvé',
  'appr.resendNote':
    'Le lien précédent ne fonctionne plus — un renvoi en émet toujours un nouveau.',
  'appr.keptNote': 'Conservée plutôt que supprimée, pour que la trace de la décision subsiste.',
  'appr.invited': 'Invité',
  'appr.resend': 'Renvoyer',
  'appr.cancelling': 'Annulation…',
  'appr.admitAfterAll': 'Admettre finalement',
  'pos.add': 'Ajouter une fonction',
  'pos.addTitle': 'Ajouter une fonction du conseil',
  'pos.addHint': 'Une fonction que votre famille maintient. Vous choisissez ensuite qui l’occupe.',
  'pos.namePh': 'p. ex. Trésorier des retrouvailles',
  'pos.position': 'Fonction',
  'pos.regional': 'Régional',
  'pos.president': 'Président',
  'pos.addFailed': 'Cette fonction n’a pas pu être ajoutée',
  'pos.renameFailed': 'Cette fonction n’a pas pu être renommée',
  'pos.remove': 'Retirer la fonction',
  'pos.removeBody': 'Rien d’autre ne change dans la famille.',
  'pos.removeFailed': 'Cette fonction n’a pas pu être retirée',
  'pos.none':
    'Aucune fonction pour l’instant. Ajoutez celles que votre famille maintient — président, '
    + 'trésorier, responsable des retrouvailles, ce que vous avez réellement.',
  'pos.noneShort': 'Votre famille n’a encore créé aucune fonction du conseil.',
  'pos.escape': 'Échap',
  'pos.holdsNow': 'Occupe actuellement',
  'pos.give': 'Attribuer une fonction',
  'pos.chooseOne': 'Choisissez-en une…',
  'pos.oneOrMore':
    'Une fonction s’exerce au niveau national, ou pour une région, ou pour une section. Une '
    + 'personne peut en occuper plusieurs.',
  'pos.choose': 'Choisissez une fonction',
  'pos.giveFailed': 'Cette fonction n’a pas pu lui être attribuée',
  'pos.takeAway': 'Retirer la fonction',
  'pos.takeAwayBody': 'La personne reste membre de la famille, et rien d’autre ne change.',
  'pos.takeItAway': 'La retirer',
  'pos.takeAwayFailed': 'Cette fonction n’a pas pu être retirée',
  'pos.giveOneBelow': 'Attribuez-lui-en une ci-dessous.',
  'pos.somebodyElse': 'Une personne pouvant modifier les fonctions doit lui en attribuer une.',
  'pos.givePosition': 'Attribuer la fonction',
  'org.regions': 'Régions',
  'org.addRegion': 'Ajouter une région',
  'org.addRegionTitle': 'Ajouter une région',
  'org.addRegionHint':
    'Un groupe de sections. Une famille peut fonctionner avec des sections seules, ou sans ni '
    + 'l’un ni l’autre.',
  'org.regionPh': 'p. ex. Québec',
  'org.noRegions':
    'Aucune région pour l’instant. Chaque section relève de National jusqu’à ce que vous en '
    + 'ajoutiez une.',
  'org.attached': 'Rattachées',
  'org.addChapter': 'Ajouter une section',
  'org.addChapterTitle': 'Ajouter une section',
  'org.addChapterHint': 'Où un membre appartient réellement. Il la choisit sur son propre profil.',
  'org.chapterPh': 'p. ex. Trois-Rivières',
  'org.underNational': 'Chaque section que vous ne placez pas dans une région relève de',
  'org.inRegion': 'Dans la région',
  'org.addRegionFailed': 'Cette région n’a pas pu être ajoutée',
  'org.deleteRegion': 'Supprimer la région',
  'org.deleteRegionFailed': 'Cette région n’a pas pu être supprimée',
  'org.addChapterFailed': 'Cette section n’a pas pu être ajoutée',
  'org.deleteChapter': 'Supprimer la section',
  'org.deleteChapterFailed': 'Cette section n’a pas pu être supprimée',
  'org.moveChapterFailed': 'Cette section n’a pas pu être déplacée',
  'org.nothingNational': 'Rien ne relève de National.',
  'bill.paidPlan': 'Forfait payé',
  'bill.paidThrough': 'Payé jusqu’au',
  'bill.howRenews': 'Comment il se renouvelle',
  'bill.movingTo': 'Passage à',
  'bill.cardsReceipts': 'Cartes et reçus',
  'bill.whatCharged': 'Ce que GENORRA a facturé',
  'bill.neverCharged': 'Rien pour l’instant — cette famille n’a jamais été facturée.',
  'bill.covers': 'Couvre',
  'bill.onFree': 'Aucun — sur le forfait gratuit',
  'bill.nextPayment': 'Prochain paiement',
  'bill.nextPaymentDue': 'Prochain paiement dû le',
  'bill.stopping': 'Mensuel — s’arrête à la fin de cette période',
  'bill.monthlyAuto': 'Mensuel, automatiquement',
  'bill.inAdvance': 'Payé à l’avance — rien ne le renouvelle',

  'bill.perMonth': '{amount} par mois',
  'bill.perMonthParen': '({amount} par mois)',
  'bill.rateSentence': 'Le forfait {tier} coûte {amount} par mois, sans engagement.',
  'bill.perMonthSlash': '{amount}/mois',

  'auth.meta.loginTitle': 'Connectez-vous au portail de votre famille',
  'auth.meta.loginDescription':
    'Connectez-vous au portail familial {app} pour organiser des réunions, gérer les '
    + 'cotisations, partager des photos et garder votre famille en lien.',
  'auth.meta.loginGraphName': 'Bon retour',
  'auth.meta.registerTitle': 'Créez votre compte familial gratuit',
  'auth.meta.registerDescription':
    'Créez un compte {app} gratuit pour rejoindre le site privé de votre famille ou le '
    + 'créer — réunions, cotisations, photographies et arbre généalogique, en un seul lieu.',
  'auth.meta.registerGraphName': 'Créez votre compte',
  'auth.meta.inviteTitle': 'Acceptez votre invitation',
  'auth.meta.forgotTitle': 'Réinitialisez le mot de passe du portail de votre famille',
  'auth.meta.forgotDescription':
    'Mot de passe {app} oublié ? Saisissez l’adresse électronique du compte de votre famille '
    + 'et nous vous enverrons un lien pour en choisir un nouveau.',

  'guard.sessionUnverified':
    'Votre session n’a pas pu être vérifiée. Rechargez la page et réessayez.',
  'guard.signedOut': 'Vous êtes déconnecté. Connectez-vous et réessayez.',
  'guard.notAuthorized': 'Non autorisé',
  'guard.awaitingApproval': 'Votre adhésion est en attente d’approbation',

  'auth.signInToYour': 'Connectez-vous à votre compte {app}',
  'reg.invitedToJoin': 'Vous avez été invité à rejoindre',
  'reg.joinOn': 'Rejoignez votre famille sur {app}',
  'reg.startOn': 'Créez une nouvelle famille sur {app}',

  'auth.aside.loginHeading': 'Nouveau ici, ou impossible d’entrer ?',
  'auth.aside.whatItIs':
    '{app} est un site privé réservé à une seule famille élargie — où chaque génération a sa '
    + 'place. Ses membres organisent ensemble réunions et rassemblements, suivent les '
    + 'cotisations et les contributions, partagent des photographies et construisent l’arbre '
    + 'généalogique dans un espace que seule la famille peut voir. Il n’y a pas de profil '
    + 'public, et aucune famille ne peut voir les pages d’une autre.',

  'auth.aside.forgotTerm': 'Mot de passe oublié ?',
  'auth.aside.forgotLink': 'Demandez un lien de réinitialisation',
  'auth.aside.forgotTail': 'et choisissez-en un nouveau.',
  'auth.aside.unconfirmedTerm': 'Vous n’avez jamais confirmé votre adresse ?',
  'auth.aside.unconfirmedBody':
    'L’inscription envoie un lien de confirmation, et le compte reste inactif jusqu’à son '
    + 'ouverture. Regardez d’abord dans vos courriers indésirables, puis connectez-vous '
    + 'ci-dessus : le formulaire vous proposera de renvoyer le lien.',
  'auth.aside.codeTerm': 'Vous avez rejoint avec un code de famille ?',
  'auth.aside.codeBody':
    'Un administrateur de cette famille admet les nouveaux membres. Vous pouvez vous '
    + 'connecter en attendant — une page d’attente s’affichera jusqu’à ce qu’ils le fassent.',
  'auth.aside.invitedTerm': 'Invité par courriel ?',
  'auth.aside.invitedBody':
    'Ouvrez le lien de l’invitation plutôt que de vous connecter ici. Ce lien sait quelle '
    + 'famille vous rejoignez et vous y ramènera une fois connecté.',
  'auth.aside.wrongFamilyTerm': 'Vous n’êtes pas dans la bonne famille ?',
  'auth.aside.wrongFamilyBody':
    'Un compte peut appartenir à plusieurs familles — le mariage en met la plupart des gens '
    + 'dans deux. Connectez-vous comme d’habitude et changez de famille depuis l’en-tête.',

  'auth.aside.noAccountLead': 'Pas encore de compte ?',
  'auth.aside.createFree': 'Créez-en un gratuitement',
  'auth.aside.orSep': ', ou',
  'auth.aside.readWhatApp': 'lisez ce que fait {app}',
  'auth.aside.ifUnsure': 'si l’on vous a envoyé ici et que vous ne savez pas bien de quoi il s’agit.',

  'auth.aside.joiningHeading': 'Rejoindre {app}',
  'auth.aside.joiningLede':
    '{app} donne à une famille élargie un espace privé qui n’appartient qu’à elle — où '
    + 'chaque génération a sa place. Il n’y a pas de profil public et rien n’est partagé en '
    + 'dehors de la famille que vous rejoignez. Ses membres peuvent :',
  'auth.aside.can1':
    'Organiser réunions et rassemblements — qui fait quoi, et si c’est fait.',
  'auth.aside.can2':
    'Suivre les cotisations et les contributions, pour que personne ne court après les reçus.',
  'auth.aside.can3':
    'Partager des photographies dans des collections que toute la famille peut enrichir.',
  'auth.aside.can4':
    'Construire l’arbre généalogique et garder trace de qui appartient à qui.',
  'auth.aside.nextHeading': 'Ce qui se passe ensuite',
  'auth.aside.confirmTerm': 'Confirmez votre adresse.',
  'auth.aside.confirmBody':
    'Nous envoyons un lien dès votre inscription, et le compte reste inactif jusqu’à ce que '
    + 'vous l’ouvriez.',
  'auth.aside.joiningTerm': 'Vous rejoignez une famille existante ?',
  'auth.aside.joiningBody':
    'Il vous faut son code de famille — demandez-le à qui vous a invité. Votre demande '
    + 'attend ensuite qu’un des administrateurs de cette famille vous admette ; vous pouvez '
    + 'vous connecter entre-temps.',
  'auth.aside.startingTerm': 'Vous en créez une nouvelle ?',
  'auth.aside.startingBody':
    'Vous en êtes le premier membre, et vous recevez un code de famille de six caractères à '
    + 'faire circuler. Quiconque le détient peut demander à vous rejoindre, et c’est vous qui '
    + 'décidez qui entre.',
  'auth.aside.freeForever':
    'Le compte gratuit est gratuit pour toujours — pas de carte, pas de compte à rebours '
    + 'd’essai, et aucun frais par proche, quel que soit votre nombre.',
  'auth.aside.seeTiers': 'Voyez ce que contient chaque forfait',
  'auth.aside.readHow': 'lisez comment cela fonctionne',
  'auth.aside.first': 'au préalable.',

  'auth.forgotNoAccount':
    'Utilisez l’adresse avec laquelle vous vous êtes inscrit. Si vous n’avez jamais terminé '
    + 'la création d’un compte, il n’y a rien à réinitialiser —',
  'auth.forgotSignUp': 'inscrivez-vous',
  'auth.forgotAskCode':
    'plutôt, et demandez à votre famille son code si vous rejoignez une famille existante.',

  'gath.upsell.inlineHave':
    'Avec le forfait {plan}, un rassemblement est une date, un lieu et une description.',
  'gath.upsell.inlineAdds':
    'y ajoute des listes d’étapes, des tâches confiées nommément à vos proches et un budget '
    + 'prélevé sur une caisse.',
  'gath.upsell.title': 'Organisez ce rassemblement avec le forfait {plan}',
  'gath.upsell.lede':
    'Votre rassemblement est déjà au calendrier et chacun de vos proches voit quand et où il '
    + 'a lieu. Le forfait {plan}, c’est là qu’il devient un plan.',
  'gath.upsell.checklistsLead': 'Des listes que vous n’écrivez qu’une fois.',
  'gath.upsell.checklistsBody':
    'Une réunion de famille, c’est l’Accueil, le Pique-nique et les Adieux : créez chacun '
    + 'comme un modèle et programmez-le à partir de là chaque année.',
  'gath.upsell.jobsLead': 'Des tâches avec un nom dessus.',
  'gath.upsell.jobsBody':
    'Chaque étape devient une tâche confiée à un proche, qui y répond et la fait approuver '
    + 'ou se la voit renvoyer avec des remarques. Personne n’a plus à se rappeler qui avait '
    + 'dit qu’il apporterait les tables.',
  'gath.upsell.budgetLead': 'Un budget prélevé sur une caisse.',
  'gath.upsell.budgetBody':
    'Ce que le rassemblement peut dépenser, ce que chacune de ses parties réclame, et si '
    + 'cela tient dans ce que la famille possède réellement.',
  'gath.upsell.cta': 'Voir le forfait {plan}',
  'plan.whatIncludes': 'Ce que comprend chaque forfait',
  'plan.current': 'Actuel',
  'plan.currentPlan': 'Forfait actuel',
  'plan.comingSoon': 'Bientôt disponible',
  'plan.features': 'Fonctionnalités',
  'plan.passwordHint':
    'Votre mot de passe de connexion, pour qu’un forfait ne soit pas rétrogradé par accident.',
  'plan.notOnDeployment': 'Non disponible sur ce déploiement',
  'plan.billingFailed': 'La facturation n’a pas pu être chargée',
  'plan.whatYouLose': 'Ce que vous perdez',
  'plan.yoursToday':
    'C’est le forfait de votre famille aujourd’hui. Tout ce qui est ici est activé.',
  'chk.monthly': 'Mensuel',
  'chk.inAdvance': 'À l’avance',
  'chk.months': 'Mois',
  'chk.howFar': 'Jusqu’où payer à l’avance',
  'chk.dueNow': 'À payer maintenant',
  'chk.leftOver': 'Reste, conservé comme crédit chez Stripe',
  'chk.sameOverall':
    'Les deux options coûtent le même total ; la seconde règle simplement le mois prochain '
    + 'dès aujourd’hui.',
  'chk.payNothing': 'Ne rien payer maintenant',
  'chk.coverNext': 'Couvrir aussi le mois prochain — rien à payer',
  'chk.thisAndNext': 'Ce mois-ci et le suivant',
  'chk.restOfMonth': 'Le reste de ce mois-ci',
  'proc.loadFailed': 'Les paramètres de paiement n’ont pas pu être chargés',
  'proc.notOn': 'Les paiements en ligne ne sont pas encore activés',
  'proc.stripeAccount': 'Compte Stripe',
  'proc.payingAuto': 'Membres payant automatiquement',
  'proc.feeHeading': 'Frais de traitement des cartes',
  'proc.feeBlurb': 'Stripe prélève des frais sur chaque paiement par carte. Ils sortent du côté de votre famille, et ceci décide si la famille les absorbe ou si le membre les couvre.',
  'proc.feeWhoPays': 'Qui paie les frais',
  'proc.feePayerFamily': 'La famille les absorbe',
  'proc.feePayerMember': 'Le membre les couvre',
  'proc.feePercent': 'Taux en pourcentage (%)',
  'proc.feeFixed': 'Montant fixe par paiement ($)',
  'proc.feeExplainFamily': 'Un membre devant 40,00 $ est débité de 40,00 $, et sa cotisation diminue de 40,00 $. Votre famille reçoit ce qui reste après les frais de Stripe.',
  'proc.feeExplainMember': 'Un membre devant {owed} est débité de {charged}, votre famille reçoit donc l’intégralité des {owed} et sa cotisation diminue de {owed}. Le supplément apparaît sur sa propre ligne avant le paiement.',
  'proc.feeRateUnusable': 'Ce taux ne peut pas être ajouté à un paiement. Baissez le pourcentage.',
  'proc.feesRecordedSoFar': 'GENORRA a enregistré {amount} de frais de carte sur les paiements qu’il a inscrits.',
  'proc.billShowTotal': 'Afficher le total propre de Stripe pour ce compte',
  'proc.billAsking': 'Interrogation de Stripe…',
  'proc.billTotal': 'Le total propre de Stripe pour ce compte est de {amount}, sur {n} transactions.',
  'proc.billTotalAtLeast':
    'Le total propre de Stripe est d’au moins {amount} — les {n} premières transactions. '
    + 'L’historique est plus long que ce qui peut être lu d’un coup ; considérez-le comme un plancher.',
  'proc.billDifference':
    'L’écart de {amount} correspond aux frais de paiements que GENORRA n’a pas inscrits, '
    + 'plus ce que Stripe facture au compte lui-même. Cela n’est pas au compte de résultat, à dessein.',
  'proc.billBelowRecorded':
    'Le total de Stripe est {amount} INFÉRIEUR à ce qui est enregistré ici, ce qui ne '
    + 'devrait pas arriver — le compte de résultat surestime peut-être les frais de cette famille.',
  'proc.billNoAccount': 'Il n’y a aucun compte Stripe connecté à totaliser.',
  'proc.billUnavailable': 'Stripe est injoignable. Le chiffre enregistré ci-dessus n’est pas affecté.',
  'proc.feePolicySaved': 'Enregistré',
  'proc.continueStripe': 'Continuer dans Stripe',
  'proc.checkStripe': 'Vérifier auprès de Stripe',
  'proc.disconnect': 'Déconnecter',
  'proc.passwordHint':
    'Votre mot de passe de connexion. Nous vous enverrons ensuite un code par courriel pour '
    + 'terminer.',
  'proc.linkExpired':
    'Ce lien Stripe avait expiré avant d’être terminé. Rien n’a été perdu — appuyez sur '
    + 'Continuer dans Stripe pour reprendre où la famille s’était arrêtée.',
  'proc.disconnectConfirm': 'Déconnecter Stripe ?',
  'proc.codeFailed': 'Nous n’avons pas pu envoyer le code. Rien n’a changé — veuillez réessayer.',
  'proc.enterCode': 'Saisissez le code que nous vous avons envoyé par courriel',
  'proc.disconnectStripe': 'Déconnecter Stripe',
  'proc.disconnected': 'Stripe est déconnecté',
  'proc.noProcessor': 'Aucun processeur de paiement connecté',
  'proc.cannotPay':
    'Les membres ne peuvent pas payer leurs cotisations par carte tant que ceci est '
    + 'déconnecté. La reconnexion rétablit le même compte Stripe, avec son historique et ses '
    + 'coordonnées bancaires exactement tels qu’ils étaient.',
  'proc.connectHint':
    'Connectez le compte Stripe propre à cette famille et les membres pourront payer leurs '
    + 'cotisations par carte. Les paiements entrent dans les livres et sont affectés aux fonds '
    + 'd’eux-mêmes, exactement comme un paiement saisi à la main.',
  'proc.opening': 'Ouverture de Stripe…',
  'proc.reconnect': 'Reconnecter Stripe',
  'proc.connect': 'Connecter un compte Stripe',
  'proc.cardsOn': 'Les paiements par carte sont activés',
  'proc.stripeNeeds': 'Stripe attend encore quelque chose de cette famille',
  'proc.stripeReviewing': 'Stripe examine ce compte',
  'proc.membersSeeButton':
    'Les membres voient un bouton Payer en ligne à côté de chaque cotisation qu’ils doivent.',
  'proc.finishFirst':
    'Les membres ne peuvent pas payer en ligne avant que ceci soit terminé. Continuez dans '
    + 'Stripe pour le compléter.',
  'proc.nothingMore':
    'Rien de plus n’est attendu de la famille. Les membres ne peuvent pas payer en ligne '
    + 'avant que Stripe ait terminé.',
  'esum.noOffices': 'Cette élection ne comporte aucune fonction.',
  'esum.nobodyStanding': 'Personne ne se présente pour cette fonction.',
  'esum.electionIs': 'Cette élection est',
  'esum.canVote': 'Peuvent voter',
  'esum.canVoteHint': 'Membres approuvés de la partie de la famille concernée, avec un compte',
  'esum.haveVoted': 'Ont voté',
  'esum.haveNot': 'N’ont pas voté',
  'esum.chaseFromDirectory': 'Personne n’est nommé — relancez depuis le Répertoire',
  'esum.onBallot': 'Sur le bulletin',
  'esum.onBallotHint': 'Propositions qui ont été acceptées',
  'esum.results': 'Résultats',
  'esum.whereVotingStands': 'Où en est le vote',
  'ms.clear': 'Effacer la recherche',
  'ms.prevPage': 'Page précédente',
  'ms.nextPage': 'Page suivante',
  'org.attached.memberOne': '1 membre',
  'org.attached.memberMany': '{n} membres',
  'org.attached.dueOne': '1 cotisation',
  'org.attached.dueMany': '{n} cotisations',
  'org.attached.announcementOne': '1 annonce',
  'org.attached.announcementMany': '{n} annonces',
  'org.attached.positionOne': '1 fonction',
  'org.attached.positionMany': '{n} fonctions',
  'org.deleteRegionAria': 'Supprimer la région {name}',
  'org.deleteChapterAria': 'Supprimer la sección {name}',
  'org.regionForAria': 'Région de la section {name}',
  'plan.upgradeTo': 'Passer à {plan}',
  'plan.downgradeTo': 'Rétrograder à {plan}',
  'plan.downgradeBilledWithDate':
    'Rien ne change aujourd’hui. {current} reste ouvert jusqu’à la fin de la période déjà '
    + 'payée, et {next} commence le {date}. Il n’y a pas de remboursement pour le reste de '
    + 'cette période — c’est ce qui garde les pages ouvertes jusqu’à sa fin. Rien n’est '
    + 'supprimé alors, et ce que l’offre moins chère n’inclut pas est conservé soixante jours '
    + 'ensuite.',
  'plan.downgradeBilled':
    'Rien ne change aujourd’hui. {current} reste ouvert jusqu’à la fin de la période déjà '
    + 'payée. Il n’y a pas de remboursement pour le reste de cette période — c’est ce qui garde '
    + 'les pages ouvertes jusqu’à sa fin. Rien n’est supprimé alors, et ce que l’offre moins '
    + 'chère n’inclut pas est conservé soixante jours ensuite.',
  'plan.downgradeUnbilled':
    'Les pages qui font partie de {current} cessent de s’ouvrir. Rien n’est supprimé '
    + 'aujourd’hui : chaque enregistrement reste exactement où il est pendant soixante jours, et '
    + 'remonter dans ces soixante jours ramène les pages avec leurs données intactes. Après '
    + 'soixante jours, c’est supprimé — vous êtes prévenu quatre fois avant.',
  'proc.consequenceBase':
    'Les membres ne pourront plus payer en ligne. Chaque paiement déjà enregistré est '
    + 'conservé, et le compte Stripe propre à la famille reste intact.',
  'proc.consequenceNone': 'Vous pouvez reconnecter le même compte à tout moment.',
  'proc.consequenceOne':
    '1 proche paie ses cotisations automatiquement, et ce prélèvement est annulé chez Stripe. '
    + 'La reconnexion rétablit le compte mais PAS les paiements — ce proche devrait le '
    + 'reconfigurer.',
  'proc.consequenceMany':
    '{n} proches paient leurs cotisations automatiquement, et ces prélèvements sont annulés '
    + 'chez Stripe. La reconnexion rétablit le compte mais PAS les paiements — chacun devrait '
    + 'le reconfigurer.',
  'set.removeBody':
    'Personne ne pourra ouvrir cette famille, la rejoindre ni accepter une invitation. Rien '
    + 'n’est supprimé : chaque enregistrement reste exactement où il est, et seul le soutien '
    + 'GENORRA peut rétablir la famille.',
  'org.attached.electionOne': '1 élection',
  'org.attached.electionMany': '{n} élections',
  'org.stillAttached': '{name} a encore {what} rattachés, elle ne peut donc pas être supprimée.',
  'acct.section.dues': 'Cotisations',
  'acct.section.funds': 'Fonds',
  'pos.cat.executive_officer': 'Membre du bureau',
  'pos.cat.appointed_position': 'Fonction nommée',
  'pos.scope.national': 'National',
  'pos.scope.regional': 'Régional',
  'pos.scope.chapter': 'Section',
  'pos.scopedName': '{name} — {scope}',
  'pos.duplicateAtScope':
    'Votre famille a déjà une fonction {scope} nommée « {name} ». Le même titre peut exister '
    + 'une fois à chaque portée.',

  // ── THE ADMIN SCREENS ────────────────────────────────────────────────────────────
  'access.rail': 'Membres et accès',
  'access.tab.members': 'Membres',
  'access.tab.organization': 'Organisation',
  'access.tab.approvals': 'Approbations en attente',
  'access.tab.templates': 'Modèles d’autorisations',
  'access.noTables': 'Les tables d’autorisations sont introuvables.',
  'access.readOnlyMembers':
    'Vous pouvez voir la liste des membres mais pas changer qui est sur quel modèle.',
  'access.readOnlyTemplates': 'Vous pouvez voir ce que chaque modèle accorde mais pas le modifier.',
  'access.readOnlyOrg': 'Vous pouvez voir comment la famille est organisée mais pas la modifier.',
  'access.officesKept': 'Les fonctions que votre famille maintient. Une',
  'access.whoHoldsWhat': 'Qui occupe quoi se définit dans l’onglet Membres',
  'access.permissions': 'Autorisations',
  'access.noTemplates': 'Aucun modèle pour l’instant.',
  'access.profile': 'Profil',
  'access.reviewInApprovals': 'Examiner dans Approbations en attente',
  'access.cannotDisableSelf': 'Vous ne pouvez pas désactiver votre propre accès.',
  'access.enableMember': 'Activer le membre',
  'access.disableMember': 'Désactiver le membre',
  'access.enable': 'Activer',
  'access.disable': 'Désactiver',
  'access.templates': 'Modèles',
  'access.startFrom': 'Partir de',
  'access.blank': 'Vierge',
  'access.copyOf': 'Une copie de…',
  'access.create': 'Créer',
  'access.all': 'Tout',
  'access.own': 'Les siens',
  'access.nothing': 'Rien',
  'access.selectTemplate': 'Choisissez un modèle pour modifier ce qu’il accorde.',
  'access.filterPh': 'Filtrer les membres par nom ou courriel…',
  'access.templatesHelp': 'Aide : modèles d’autorisations',
  'access.newTemplate': 'Nouveau modèle',
  'access.templateNamePh': 'Comité des retrouvailles',
  'access.templateToCopy': 'Modèle à copier',
  'access.templateName': 'Nom du modèle',
  'access.awaiting': 'En attente d’approbation',
  'access.disabled': 'Désactivé',
  'access.approved': 'Approuvé',
  'access.disabledNoAccess': 'Désactivé — aucun accès à cette famille',
  'access.noMatch': 'Aucun membre ne correspond à ce filtre.',
  'access.cannotDeleteAccount':
    'Cette personne a un compte, sa fiche ne peut donc pas être supprimée ici. Désactivez-la plutôt, depuis le menu de sa ligne.',
  'access.thisRecord': 'cette fiche',
  'access.viewAccounts': 'Avec un compte',
  'access.viewRecords': 'Fiches',
  'access.whichPeople': 'Quelles personnes lister',
  'access.recordsLede':
    'Des parents que quelqu’un a inscrits dans l’arbre familial et qui n’ont jamais eu de compte. Ils n’ont aucune permission, et la plupart ont une adresse que le produit a générée pour eux.',
  'access.noRecords': 'Personne dans cette famille n’a été inscrit sans compte.',
  'access.noRecordMatch': 'Aucune fiche ne correspond.',
  'access.generatedEmail': 'Adresse générée',
  'access.editProfileFor': 'Modifier le profil de {name}',
  'access.deleteRecord': 'Supprimer la fiche',
  'access.deleteRecordNamedAria': 'Supprimer la fiche de {name}',
  'access.deleteRecordTitle': 'Supprimer cette fiche ?',
  'access.deleteRecordBody':
    'Cela supprime définitivement {name} et tout ce qui a été enregistré à son sujet : sa place dans l’arbre familial, les étiquettes de photographie qui la nomment, et toute réunion ou vérification où elle figurait. C’est irréversible. Personne d’autre n’est affecté.',
  'access.noAccounts': 'Aucun membre avec un compte dans cette famille pour l’instant.',
  'access.noTemplate': 'Aucun modèle',
  'access.applyTemplate': 'Appliquer le modèle d’autorisations',
  'access.applyTemplateAction': 'Appliquer le modèle',
  'access.givePosition': 'Attribuer une fonction du conseil',
  'access.changePosition': 'Changer la fonction du conseil',
  'access.boardPositions': 'Fonctions du conseil',
  'access.saveTemplate': 'Enregistrer le modèle',
  'access.deleteTemplate': 'Supprimer le modèle',
  'access.whatMayDo': 'Ce que peuvent faire les membres sur ce modèle.',
  'access.expandAll': 'Tout développer',
  'access.collapseAll': 'Tout réduire',
  'access.changeGrants': 'Modifier ce que ce modèle accorde',
  'ael.new': 'Nouvelle élection',
  'ael.newLower': 'Nouvelle élection',
  'ael.whoVotes': 'Qui vote',
  'ael.noAreas':
    'Cette famille n’a encore ni régions ni sections, donc chaque élection est nationale.',
  'ael.opens': 'Ouvre',
  'ael.closesAfter': 'Ferme après',
  'ael.voting': 'Vote',
  'ael.positions': 'Fonctions',
  'ael.winners': 'Élus',
  'ael.none': 'Aucune élection pour l’instant.',
  'ael.announce': 'Annoncer',
  'ael.publish': 'Publier',
  'ael.returnToDraft': 'Remettre au brouillon',
  'ael.titlePh': 'Élections du bureau 2027',
  'ael.whichPart': 'Pour quelle partie de la famille cette élection a lieu',
  'ael.wholeFamily': 'Toute la famille (National)',
  'ael.oneRegion': 'Une région',
  'ael.oneChapter': 'Une section',
  'ael.needTitle': 'Donnez un titre à l’élection.',
  'ael.needRegion': 'Choisissez quelle région.',
  'ael.needChapter': 'Choisissez quelle section.',
  'ael.saveFailed': 'L’élection n’a pas pu être enregistrée.',
  'ael.needPosition':
    'Ajoutez au moins une fonction avant de publier — un bulletin sans fonctions n’a rien à '
    + 'voter.',
  'ael.publishConfirm': 'Publier cette élection',
  'ael.publishFailed': 'La publication a échoué.',
  'ael.draftFailed': 'Le retour au brouillon a échoué.',
  'ael.delete': 'Supprimer l’élection',
  'ael.deleteFailed': 'La suppression a échoué.',
  'ael.editDraft': 'Modifier le brouillon',
  'ael.onlyDraft':
    'Seul un brouillon peut être modifié. Une fois publiée, ses dates sont ce qui a été '
    + 'annoncé à la famille.',
  'ael.savedDraft': 'Enregistrée comme brouillon — personne ne la voit avant publication.',
  'ael.saveDraft': 'Enregistrer le brouillon',
  'ael.createDraft': 'Créer le brouillon',
  'fnd.none': 'Aucun fonds pour l’instant.',
  'fnd.minBalance': 'Solde minimum ($, facultatif)',
  'fnd.openToMembers': 'Ouvert aux apports des membres',
  'fnd.fund': 'Fonds',
  'fnd.balance': 'Solde',
  'fnd.collected': 'Encaissé',
  'fnd.disbursed': 'Versé',
  'fnd.transferred': 'Transféré',
  'fnd.minimum': 'Minimum',
  'fnd.builtIn': 'Intégré',
  'fnd.open': 'Ouvert',
  'fnd.createFirst': 'Créez d’abord un fonds — un jalon est versé depuis un fonds.',
  'fnd.noMilestones': 'Aucun jalon pour l’instant.',
  'fnd.milestoneName': 'Nom du jalon',
  'fnd.awardAmount': 'Montant de la récompense ($)',
  'fnd.milestone': 'Jalon',
  'fnd.award': 'Récompense',
  'fnd.duesRouting': 'Affectation des cotisations',
  'fnd.createFirstRouting': 'Créez d’abord un fonds pour configurer l’affectation.',
  'fnd.allocation': 'Affectation',
  'fnd.priority': 'Priorité',
  'fnd.allocationPct': 'Affectation %',
  'fnd.minimumDollars': 'Minimum $',
  'fnd.minimumDollarsPlain': 'Minimum $',
  'fnd.newFundHint':
    'Une cagnotte où sont affectées les cotisations et d’où sortent les versements.',
  'fnd.namePh': 'Fonds d’études',
  'fnd.minPh': '5000.00',
  'fnd.descPh': 'Pour les diplômés…',
  'fnd.donationsFundHint':
    'Créé automatiquement. Il contient chaque don que la famille reçoit, peut recevoir une '
    + 'part des cotisations comme tout autre fonds, et ne peut être ni supprimé ni désactivé.',
  'fnd.newMilestoneHint':
    'Une récompense qu’un membre peut recevoir d’un fonds lorsqu’il l’atteint.',
  'fnd.milestonePh': 'Terminer le secondaire',
  'fnd.awardPh': '250.00',
  'fnd.milestoneDescPh': 'Diplôme d’études secondaires ou équivalent',
  'fnd.moveUp': 'Monter',
  'fnd.moveDown': 'Descendre',
  'fnd.routingOff':
    'L’affectation est désactivée. Les apports restent dans le fonds auquel ils ont été '
    + 'donnés jusqu’à ce que ceci totalise 100 %.',
  'fnd.saveRouting': 'Enregistrer l’affectation',
  'fnd.saveRoutingConfirm':
    'Enregistrer cette configuration d’affectation ? Les futurs paiements de cotisations '
    + 'seront répartis entre les fonds selon ces pourcentages et priorités.',
  'fnd.routingSaved': 'Affectation enregistrée.',
  'fnd.saveFailed': 'L’enregistrement a échoué',
  'fnd.nameRequired': 'Le nom est obligatoire',
  'fnd.delete': 'Supprimer le fonds',
  'fnd.deleteBody': 'Supprimer ce fonds et ses jalons ? Cette action est irréversible.',
  'fnd.openToContrib': 'Ouvrir le fonds aux apports',
  'fnd.closeToContrib': 'Fermer le fonds aux apports',
  'fnd.openFund': 'Ouvrir le fonds',
  'fnd.closeFund': 'Fermer le fonds',
  'fnd.needAll': 'Fonds, nom et montant sont obligatoires',
  'fnd.deleteMilestone': 'Supprimer le jalon',
  'fnd.deleteMilestoneBody': 'Supprimer ce jalon ? Cette action est irréversible.',
  'fnd.addFund': 'Ajouter le fonds',
  'fnd.openToMembersShort': 'Ouvert aux membres',
  'fnd.makeOpen': 'L’ouvrir',
  'fnd.addMilestone': 'Ajouter le jalon',
  'fnd.saveRoutingAction': 'Enregistrer l’affectation',
  'agat.rail': 'Zones de gestion des rassemblements',
  'agat.pane.gatherings': 'Rassemblements',
  'agat.pane.queue': 'File d’examen',
  'agat.pane.templates': 'Modèles',
  'agat.management': 'Gestion des rassemblements',
  'agat.memberView': 'Vue membre',
  'agat.details': 'Détails',
  'agat.location': 'Lieu',
  'agat.summary': 'Résumé',
  'agat.delete': 'Supprimer le rassemblement',
  'agat.readOnly': 'Vous pouvez voir le plan de ce rassemblement mais pas le modifier.',
  'agat.dashboardBand': 'Bandeau du tableau de bord',
  'agat.showAcrossTop': 'Afficher ceci en haut du tableau de bord',
  'agat.bandPhoto': 'Photo du bandeau',
  'agat.removePhoto': 'Retirer la photo',
  'agat.fundAndBudget': 'Fonds et budget',
  'agat.segments': 'Segments',
  'agat.noSegments':
    'Aucun modèle n’est lié à ce rassemblement, il n’a donc pas encore de segments.',
  'agat.segment': 'Segment',
  'agat.day': 'Jour',
  'agat.place': 'Lieu',
  'agat.addSegment': 'Ajouter un autre segment',
  'agat.createOneUnder': 'Créez-en un dans',
  'agat.somebodyAccounting':
    'Une personne qui gère la Comptabilité de la famille doit en créer un, et il devient '
    + 'disponible ici.',
  'agat.severalMayDraw':
    'Plusieurs rassemblements peuvent puiser dans un même fonds. Retirer le fonds retire le '
    + 'budget avec lui.',
  'agat.budgetDollars': 'Budget ($)',
  'agat.taskReadOnly': 'Vous pouvez lire cette tâche mais pas l’attribuer ni statuer dessus.',
  'agat.leaveUnassigned': 'La laisser non attribuée',
  'agat.budgetLine': 'Ligne budgétaire ($)',
  'agat.review': 'Examiner',
  'agat.whatNeedsChange': 'Ce qu’il faut changer',
  'agat.sendBack': 'Renvoyer…',
  'agat.approvedAnswer': 'Cette réponse est approuvée',
  'agat.whyOptional': 'Pourquoi, si vous voulez le dire (facultatif)',
  'agat.reopenEllipsis': 'Réouvrir…',
  'agat.fundHelp': 'Comment fonctionnent le fonds et le budget d’un rassemblement',
  'agat.usualPlace': 'Le lieu habituel du modèle',
  'agat.notStated': 'Non précisé',
  'agat.assigneeHint':
    'N’importe qui que la famille a approuvé, avec ou sans compte — on peut demander à un '
    + 'parent sans identifiants d’apporter les photographies.',
  'agat.nobodyApproved': 'Personne dans cette famille n’a encore été approuvé.',
  'agat.nothingSet': 'Rien de défini',
  'agat.notePh1': 'Le traiteur a besoin d’un numéro de téléphone en plus du nom.',
  'agat.notePh2': 'La salle a modifié la réservation, il faut donc refaire l’horaire.',
  'agat.saveFailed': 'Ce rassemblement n’a pas pu être enregistré',
  'agat.changeFailed': 'Cela n’a pas pu être modifié',
  'agat.uploadFailed': 'Cette photo n’a pas pu être téléversée',
  'agat.removePhotoFailed': 'Cette photo n’a pas pu être retirée',
  'agat.addTemplateFailed': 'Ce modèle n’a pas pu être ajouté',
  'agat.removeTemplate': 'Retirer le modèle',
  'agat.removeTemplateFailed': 'Ce modèle n’a pas pu être retiré',
  'agat.deleteFailed': 'Ce rassemblement n’a pas pu être supprimé',
  'agat.noDates': 'Pas encore de dates',
  'agat.addSteps': 'Ajouter ses étapes',
  'agat.noTasksAddTemplate':
    'Aucune tâche pour l’instant. Ajoutez un modèle ci-dessus et ses étapes deviennent des '
    + 'tâches ici.',
  'agat.manage': 'Gérer',
  'agat.segmentFailed': 'Ce segment n’a pas pu être enregistré',
  'agat.template': 'Modèle',
  'agat.noTasksFromThis': 'Aucune tâche issue de celui-ci',
  'agat.budgetFailed': 'Ce budget n’a pas pu être enregistré',
  'agat.noBudgetSet': 'Aucun budget défini',
  'agat.chooseFundFirst': 'Choisissez d’abord un fonds',
  'agat.saveBudget': 'Enregistrer le budget',
  'agat.saveThatFailed': 'Cela n’a pas pu être enregistré',
  'agat.budgetLineFailed': 'Cette ligne budgétaire n’a pas pu être enregistrée',
  'agat.approveThis': 'Approuver cette réponse',
  'agat.approve': 'Approuver',
  'agat.approveFailed': 'Cette réponse n’a pas pu être approuvée',
  'agat.sayWhatChanges':
    'Dites ce qu’il faut changer — c’est ce que la personne lit avant de réessayer.',
  'agat.sayWhatChangesMember':
    'Dites ce qu’il faut changer — c’est ce que le membre lit avant de réessayer.',
  'agat.sendBackFailed': 'Cette tâche n’a pas pu être renvoyée',
  'agat.reopenThis': 'Réouvrir cette tâche',
  'agat.reopen': 'Réouvrir',
  'agat.reopenFailed': 'Cette tâche n’a pas pu être réouverte',
  'agat.approvedAnswerLabel': 'La réponse approuvée',
  'agat.theirAnswer': 'Sa réponse',
  'agat.approved': 'Approuvée',
  'agat.sentBack': 'Renvoyée',
  'agat.saveWhoWhen': 'Enregistrer qui et quand',
  'agat.saveBudgetLine': 'Enregistrer la ligne budgétaire',
  'agat.sendBackWithNotes': 'Renvoyer avec des notes',
  'agat.reopening': 'Réouverture…',
  'agat.new': 'Nouveau rassemblement',
  'agat.when': 'Quand',
  'agat.budgetUnavailable': 'Budget indisponible',
  'agat.unavailable': 'Indisponible',
  'agat.open': 'Ouverts',
  'agat.noBudget': 'Aucun budget',
  'agat.queueReadOnly': 'Vous pouvez voir ce qui attend mais pas statuer dessus.',
  'agat.nothingRecorded': 'Rien n’a été enregistré avec cet envoi.',
  'agat.theirNote': 'Sa note',
  'agat.addOneIn': 'Ajoutez-en un dans',
  'agat.starts': 'Débute',
  'agat.ends': 'Se termine',
  'agat.singleDay': 'Laissez vide pour une seule journée.',
  'agat.openGathering': 'Ouvrir le rassemblement',
  'agat.premierHint':
    'Marqué pour le tableau de bord. Plusieurs rassemblements peuvent l’être ; le plus proche '
    + 'à venir est celui qui s’affiche.',
  'agat.pickTemplates': 'Choisissez les modèles sur lesquels il se fonde, puis dites quand et où.',
  'agat.summaryPh': 'Ce qu’est ce rassemblement, pour les personnes à qui l’on demande de l’aide.',
  'agat.pressNew':
    'Appuyez sur Nouveau rassemblement et choisissez les modèles sur lesquels il doit se '
    + 'fonder.',
  'agat.somebodySchedule':
    'Une personne pouvant planifier des rassemblements doit créer le premier.',
  'agat.noFund': 'Aucun fonds',
  'agat.createFailed': 'Ce rassemblement n’a pas pu être créé',
  'agat.everyStep':
    'Chaque étape des modèles que vous choisissez devient une tâche à distribuer. N’en '
    + 'choisissez aucun et ce n’est qu’une date sans tâches.',
  'agat.create': 'Créer le rassemblement',
  'tmpl.name': 'Nom du modèle',
  'tmpl.whoCanSchedule': 'Qui peut planifier à partir de ce modèle',
  'tmpl.whoCanScheduleShort': 'Qui peut planifier',
  'tmpl.step': 'Étape',
  'tmpl.whatItAsks': 'Ce qu’il demande',
  'tmpl.templateToInclude': 'Modèle à inclure',
  'tmpl.pickTemplate': 'Choisissez un modèle…',
  'tmpl.helpText': 'Texte d’aide',
  'tmpl.suggestedBudget': 'Budget suggéré ($)',
  'tmpl.suggestedBudgetShort': 'Budget suggéré',
  'tmpl.add': 'Ajouter le modèle',
  'tmpl.readOnly': 'Vous pouvez voir ce modèle mais pas le modifier.',
  'tmpl.archiveInstead': 'Archivez-le plutôt',
  'tmpl.steps': 'Étapes',
  'tmpl.addStep': 'Ajouter une étape',
  'tmpl.noSteps':
    'Aucune étape pour l’instant. Un modèle sans étapes construit un rassemblement sans '
    + 'travail.',
  'tmpl.asksFor': 'Demande',
  'tmpl.namePh': 'p. ex. Retrouvailles familiales',
  'tmpl.descPh':
    'À quoi sert ce modèle, et ce qu’un organisateur devrait savoir avant de planifier avec.',
  'tmpl.stepsHint':
    'Une étape par chose que quelqu’un doit faire ou décider. Les étapes sont copiées sur les '
    + 'tâches de chaque rassemblement planifié à partir de ce modèle, donc en modifier une ne '
    + 'change jamais un rassemblement déjà en cours.',
  'tmpl.stepPh': 'p. ex. Réserver la salle',
  'tmpl.helpPh':
    'Ce que la personne assignée devrait savoir — qui appeler, ce qui compte comme fait.',
  'tmpl.adminsOnly': 'Administrateurs seulement',
  'tmpl.anyMember': 'N’importe quel membre',
  'tmpl.adminsOnlyHint':
    'Seule une personne pouvant gérer les rassemblements peut en démarrer un à partir de ce '
    + 'modèle.',
  'tmpl.anyMemberHint':
    'Tout membre pouvant planifier un rassemblement peut en démarrer un à partir de ce '
    + 'modèle. Il ne peut toujours pas modifier le modèle lui-même.',
  'tmpl.notUsed': 'Utilisé par aucun rassemblement pour l’instant',
  'tmpl.addFailed': 'Ce modèle n’a pas pu être ajouté',
  'tmpl.saveFailed': 'Ce modèle n’a pas pu être enregistré',
  'tmpl.addATemplate': 'Ajouter un modèle',
  'tmpl.nameItHint':
    'Nommez-le selon l’occasion — « Retrouvailles familiales », « Service commémoratif », « '
    + 'Banquet des bourses ». Ses étapes s’ajoutent sur la carte une fois qu’il est dans la '
    + 'liste.',
  'tmpl.neverChanges':
    'Modifier un modèle ne change jamais un rassemblement déjà construit à partir de lui — '
    + 'chaque tâche garde sa propre copie de ce qu’elle demandait.',
  'tmpl.pickStepTemplate': 'Choisissez le modèle que cette étape inclut',
  'tmpl.addStepFailed': 'Cette étape n’a pas pu être ajoutée',
  'tmpl.saveStepFailed': 'Cette étape n’a pas pu être enregistrée',
  'tmpl.requiredHint':
    'Le rassemblement n’est pas terminé tant que celle-ci n’est pas répondue et approuvée.',
  'tmpl.optionalHint': 'Utile mais facultatif — le rassemblement peut être terminé sans elle.',
  'tmpl.addOneThen': 'Ajoutez-en un, puis donnez-lui une étape par chose que quelqu’un doit faire.',
  'tmpl.somebodyCan': 'Une personne pouvant ajouter des modèles doit créer le premier.',
  'tmpl.archiveFailed': 'Ce modèle n’a pas pu être archivé',
  'tmpl.restoreFailed': 'Ce modèle n’a pas pu être restauré',
  'tmpl.delete': 'Supprimer le modèle',
  'tmpl.deleteFailed': 'Ce modèle n’a pas pu être supprimé',
  'tmpl.moveStepFailed': 'Cette étape n’a pas pu être déplacée',
  'tmpl.deleteStep': 'Supprimer l’étape',
  'tmpl.deleteStepFailed': 'Cette étape n’a pas pu être supprimée',
  'tmpl.restore': 'Restaurer',
  'tmpl.archive': 'Archiver',
  'inc.goalAmount': 'Montant de l’objectif',
  'inc.dueAmount': 'Montant de la cotisation',
  'inc.frequency': 'Fréquence',
  'inc.startAge': 'Les membres commencent à payer à l’âge de (facultatif)',
  'inc.noBloodline': 'Personne n’a encore été marqué comme faisant partie de la lignée de votre famille, donc une cotisation qui y est réservée ne serait due par personne. Cochez d’abord {control} dans l’arbre familial.',
  'inc.owedBy': 'Dû par',
  'inc.nationalWhole': 'National — toute la famille',
  'inc.goal': 'Objectif',
  'inc.payment': 'Paiement',
  'inc.startDate': 'Date de début',
  'inc.endDate': 'Date de fin',
  'inc.driveFor': 'Cette campagne est pour (facultatif)',
  'inc.newDues': 'Nouvelle cotisation',
  'inc.editDues': 'Modifier la cotisation',
  'inc.duesHint': 'Cotisations que chaque membre de la famille doit à cette fréquence.',
  'inc.noDues': 'Aucune cotisation pour l’instant.',
  'inc.annualDues': 'Cotisation annuelle',
  'inc.newDonation': 'Nouveau don',
  'inc.editDonation': 'Modifier le don',
  'inc.noDonations': 'Aucun don pour l’instant.',
  'inc.scholarshipDrive': 'Campagne de bourses',
  'inc.cannotDecline': 'Chaque membre doit ceci et ne peut pas la refuser.',
  'inc.canOptOut':
    'Les membres peuvent la refuser depuis leur Résumé, et elle ne comptera pas dans ce '
    + 'qu’ils doivent.',
  'inc.blankAge': 'Laissez vide et chaque membre doit ceci, quel que soit son âge.',
  'inc.bloodlineHint': 'Seuls les membres marqués comme faisant partie de la lignée de la famille doivent ceci. Quelqu’un qui a épousé un membre de la famille, et quelqu’un que la famille n’a pas marqué, ne doit rien et ne le verra pas sur son écran Cotisations.',
  'inc.whoOwesIt': 'Qui la doit',
  'inc.scopeAllMembers': 'Tous les membres',
  'inc.scopeBloodline': 'Lignée seulement',
  'inc.scopeNonBloodline': 'Uniquement les proches entrés par alliance',
  'inc.nonBloodlineHint':
    'Seuls les proches qui ne sont PAS marqués comme faisant partie de la lignée '
    + 'la doivent. Quelqu’un de la lignée ne la devra jamais.',
  'inc.whereItLands': 'Où arrive un paiement',
  'inc.fundWaterfall': 'Répartir entre les fonds (Acheminement)',
  'inc.fundWaterfallHint': 'Les paiements sont répartis entre les fonds de la famille selon la table d’Acheminement.',
  'inc.fundDirectHint': 'La totalité du paiement va dans ce seul fonds. L’acheminement est ignoré.',
  'inc.straightToFund': 'Directement vers {fund}',
  'inc.aDeletedFund': 'un fonds',
  'dues.onlyMembersWhoMarriedIn': 'Seuls les proches qui ne sont pas dans la lignée la doivent',
  'act.donationsGoToDonationsFund':
    'Une collecte va toujours dans le fonds Dons de la famille et ne peut pas '
    + 'en désigner un autre.',
  'inc.howeverCame':
    'Chaque membre doit ceci, quelle que soit la façon dont il est entré dans la famille.',
  'inc.everyMember': 'Chaque membre de la famille doit ceci.',
  'inc.regionHint':
    'Seuls les membres dont la section est dans cette région doivent ceci. Un membre sans '
    + 'section relève de National et ne doit rien de régional.',
  'inc.chapterHint':
    'Seuls les membres de cette section doivent ceci. Un membre sans section relève de '
    + 'National et ne doit rien de délimité.',
  'inc.fixedTerms':
    'Des paiements ont été enregistrés contre cette cotisation, donc sa date de début, son '
    + 'montant, sa fréquence, son âge de départ, son réglage de lignée et qui la doit sont '
    + 'figés — chacun de ces paiements a été fait selon ces conditions. La date de fin peut '
    + 'encore changer.',
  'inc.donationFixed': 'Ce don a reçu des fonds, sa date de début est donc figée.',
  'inc.amountRequired': 'Le montant est obligatoire',
  'inc.endInPast': 'La date de fin ne peut pas être dans le passé.',
  'mpe.loading': 'Chargement du profil de ce membre…',
  'mpe.nationalNoChapter': 'National — aucune section',
  'mpe.signIn': 'Connexion',
  'mpe.general': 'Général',
  'mpe.address': 'Adresse',
  'mpe.additional': 'Renseignements complémentaires',
  'mpe.relativesMove': 'Les parents sans compte propre le suivent.',
  'mpe.loadFailed': 'Ce membre n’a pas pu être chargé.',
  'mpe.bothRequired': 'Le prénom et le nom sont tous deux obligatoires.',
  'mpe.saveThis': 'Enregistrer le profil de ce membre',
  'mpe.saveFailed': 'Ces modifications n’ont pas pu être enregistrées.',
  'mpe.sendReset': 'Envoyer une réinitialisation du mot de passe',
  'mpe.currentKeeps': 'Son mot de passe actuel continue de fonctionner jusqu’à ce qu’il l’utilise.',
  'mpe.sendLink': 'Envoyer le lien',
  'mpe.linkFailed': 'Ce lien n’a pas pu être envoyé.',
  'mpe.signInNotEditable': 'Son courriel de connexion et son mot de passe ne se modifient pas ici.',
  'mpe.onlyMember': 'Seul le membre peut changer sa propre adresse de connexion.',
  'mpe.chooseCountry': 'Choisissez d’abord un pays.',
  'agat.progress': '{done} sur {total} approuvées',
  'agat.waiting': '{n} en attente',
  'tmpl.usedByOne': 'Utilisé par 1 rassemblement',
  'tmpl.usedByMany': 'Utilisé par {n} rassemblements',
  'inc.namedRegion': 'région {name}',
  'inc.namedChapter': 'section {name}',
  'tmpl.deleteOneStep':
    'Supprimer « {name} » et son étape ? Aucun rassemblement déjà construit à partir de lui '
    + 'ne change — chaque tâche garde sa propre copie de ce qu’elle demandait et de ce qui a '
    + 'été répondu. Cette action est irréversible.',
  'tmpl.deleteManySteps':
    'Supprimer « {name} » et ses {n} étapes ? Aucun rassemblement déjà construit à partir de '
    + 'lui ne change — chaque tâche garde sa propre copie de ce qu’elle demandait et de ce qui '
    + 'a été répondu. Cette action est irréversible.',

  // ── SIGNING IN, REGISTERING, AND THE STAFF CONSOLE ───────────────────────────────
  'auth.login': 'Connexion',
  'auth.getStarted': 'Commencer',
  'auth.welcomeBack': 'Bon retour',
  'auth.password': 'Mot de passe',
  'auth.forgot': 'Mot de passe oublié ?',
  'auth.forgotTitle': 'Vous avez oublié votre mot de passe ?',
  'auth.forgotLede': 'Saisissez votre courriel et nous vous enverrons un lien de réinitialisation.',
  'auth.confirmEmail': 'Confirmez votre adresse courriel',
  'auth.createAccount': 'Créer un compte',
  'auth.noAccount': 'Vous n’avez pas de compte ? ',
  'auth.createOne': 'Créez-en un',
  'auth.badEmail': 'Saisissez une adresse courriel valide',
  'auth.needPassword': 'Le mot de passe est obligatoire',
  'auth.signingIn': 'Connexion…',
  'auth.signIn': 'Se connecter',
  'auth.sendLinkAgain': 'Renvoyer le lien',
  'auth.emailSent': 'Courriel envoyé',
  'auth.resetSent':
    'Si cette adresse est dans notre système, vous recevrez sous peu un lien de '
    + 'réinitialisation.',
  'auth.nothingArrived': 'Rien n’est arrivé ?',
  'auth.backToSignIn': 'Retour à la connexion',
  'auth.sendReset': 'Envoyer le lien de réinitialisation',
  'auth.signOut': 'Se déconnecter',
  'auth.chooseNew': 'Choisissez un nouveau mot de passe',
  'auth.expiredLink': 'Ce lien de réinitialisation a expiré. Demandez-en un nouveau et réessayez.',
  'auth.tooShort': 'Le mot de passe doit compter au moins 8 caractères',
  'auth.noMatch': 'Les mots de passe ne correspondent pas',
  'reg.familyCreated': 'Famille créée !',
  'reg.shareCode': 'Partagez ce code avec vos proches pour qu’ils puissent nous rejoindre.',
  'reg.yourCode': 'Votre code familial',
  'reg.writeDown': 'Notez-le — vous en aurez besoin pour inviter vos proches.',
  'reg.alsoSent':
    'Nous avons aussi envoyé un lien de confirmation. Cliquez dessus pour activer votre '
    + 'compte.',
  'reg.startsOn': 'Votre famille commence sur',
  'reg.goToDashboard': 'Aller au tableau de bord →',
  'reg.checkEmail': 'Vérifiez votre courriel',
  'reg.confirmSent':
    'Nous avons envoyé un lien de confirmation. Cliquez dessus pour activer votre compte, '
    + 'puis connectez-vous.',
  'reg.createYours': 'Créez votre compte',
  'reg.joinFamily': 'Rejoindre une famille',
  'reg.startFamily': 'Créer une nouvelle famille',
  'reg.invitedAddress': 'L’adresse à laquelle votre invitation a été envoyée.',
  'reg.confirmPassword': 'Confirmez le mot de passe',
  'reg.codeShared': 'Saisissez le code que votre famille vous a communiqué.',
  'reg.codeGenerated': 'Un code familial unique sera généré pour que vous le partagiez.',
  'reg.haveAccount': 'Vous avez déjà un compte ? ',
  'reg.needFirstName': 'Le prénom est obligatoire',
  'reg.needLastName': 'Le nom est obligatoire',
  'reg.needCode': 'Le code familial est obligatoire',
  'reg.needFamilyName': 'Le nom de la famille est obligatoire',
  'reg.freeForever': 'Gratuit pour toujours',
  'reg.canMove':
    'Vous pouvez passer à un forfait payant à tout moment depuis les paramètres de la '
    + 'famille.',
  'reg.joining': 'Adhésion…',
  'reg.creatingFamily': 'Création de la famille…',
  'reg.joinAction': 'Rejoindre la famille',
  'reg.createAction': 'Créer la famille',
  'reg.firstNamePh': 'Aline',
  'reg.lastNamePh': 'Tremblay',
  'reg.codePh': 'p. ex. ABC123',
  'reg.familyNamePh': 'p. ex. Les Tremblay',
  'staff.nav': 'Console du personnel',
  'staff.overview': 'Vue d’ensemble',
  'staff.families': 'Familles',
  'staff.accounts': 'Comptes',
  'staff.access': 'Accès',
  'staff.whoHasAccess': 'Qui a accès',
  'staff.account': 'Compte',
  'staff.why': 'Pourquoi',
  'staff.granted': 'Accordé',
  'staff.grantAccess': 'Accorder l’accès',
  'staff.kindOfAccess': 'Type d’accès',
  'staff.choose': 'Choisissez…',
  'staff.whyNeeded': 'Pourquoi cette personne en a besoin',
  'staff.you': 'Vous',
  'staff.addressUnknown': 'L’adresse n’est pas connue d’ici.',
  'staff.revoke': 'Révoquer',
  'staff.emailPh': 'nom@exemple.com',
  'staff.whyPh':
    'p. ex. Dans la rotation du soutien à partir d’août. Escalades pour les tickets de '
    + 'facturation.',
  'staff.support': 'Soutien',
  'staff.engineer': 'Ingénierie',
  'staff.grantFailed': 'Cela n’a pas abouti. Réessayez.',
  'staff.granting': 'Attribution…',
  'staff.ownAccess':
    'Votre propre accès. Un autre propriétaire doit le modifier — c’est ce qui empêche un '
    + 'seul clic de verrouiller la console.',
  'staff.lastOwner':
    'Le dernier propriétaire. Nommez d’abord quelqu’un d’autre propriétaire, sinon personne '
    + 'ne pourra accorder l’accès au personnel.',
  'staff.makeOwner': 'Nommer propriétaire',
  'staff.removeAccess': 'Retirer l’accès',
  'staff.lookUpOne': 'Rechercher une adresse',
  'staff.noAccount': 'Aucun compte n’existe avec cette adresse.',
  'staff.accountExists': 'Un compte existe.',
  'staff.inTheseFamilies': 'Dans ces familles',
  'staff.allAccounts': 'Tous les comptes',
  'staff.lastSignIn': 'Dernière connexion',
  'staff.created': 'Créé',
  'staff.inNoFamily': 'Dans aucune famille',
  'staff.lookupPh': 'quelquun@exemple.com',
  'staff.filterAddress': 'Filtrer par n’importe quelle partie d’une adresse…',
  'staff.enterFromTicket': 'Saisissez l’adresse figurant sur le ticket.',
  'staff.confirmed': 'L’adresse est confirmée.',
  'staff.hasSignedIn':
    'Une connexion a déjà eu lieu avec, le mot de passe fonctionnait donc à un moment.',
  'staff.neverSignedIn':
    'Aucune connexion n’a jamais eu lieu avec. Un mot de passe oublié est aussi probable '
    + 'qu’autre chose.',
  'staff.noAccounts': 'Il n’y a encore aucun compte sur cette plateforme.',
  'staff.confirmedShort': 'Confirmée',
  'staff.notConfirmed': 'Non confirmée',
  'staff.family': 'Famille',
  'staff.restore': 'Rétablir',
  'staff.restoreFamily': 'Rétablir la famille',
  'staff.filterFamily': 'Filtrer par nom de famille ou code…',
  'staff.noFamilies': 'Il n’y a encore aucune famille sur cette plateforme.',
  'staff.removed': 'Supprimée',
  'staff.active': 'Active',
  'staff.owner': 'Propriétaire',
  'staff.hint.support':
    'Peut ouvrir la console et lire chaque famille et chaque compte de la plateforme, et '
    + 'rétablir une famille supprimée. Ne peut ni voir ni modifier qui a accès.',
  'staff.hint.engineer':
    'Exactement le même accès que Soutien aujourd’hui — rien dans la console ne les '
    + 'distingue. C’est une étiquette pour vos propres dossiers, pas un niveau.',
  'staff.hint.owner':
    'Tout ce qui précède, plus cet écran : cette personne peut accorder l’accès au personnel, '
    + 'changer le type que chacun a, et le retirer — y compris le vôtre.',
  'inc.rangeBoth': '{from} – {to}',
  'inc.rangeFrom': 'à partir du {from}',
  'inc.rangeUntil': 'jusqu’au {to}',

  // ──── THE FOUR PLAN TAGLINES — read by /admin/settings, /upgrade and /register ────
  'tier.tagline.free': 'Réunissez toute votre famille en un seul endroit. Toute.',
  'tier.tagline.standard': 'Menez la famille : l’arbre, l’argent et qui fait quoi.',
  'tier.tagline.plus':
    'Pour les familles qui encaissent de vrais paiements et répondent à un conseil.',
  'tier.tagline.premium': 'Dans la poche de chaque proche, et dehors dans le monde.',

  // ──── THE UPGRADE SCREEN’S SENTENCES ────────────────────────────────────────────
  // See the Spanish note: the tagline is interpolated whole, never lowercased.
  'upg.forFamilies': 'Le forfait {tier} est pour les familles qui ont besoin de plus : {tagline}',
  'upg.alsoOn': 'Également sur {tier}',
  'upg.whatIncludes': 'Ce que {tier} comprend',

  // ──── THE IN-PRODUCT PLAN LIST — 30 claims, keyed on their own id ───────────────
  'plan.adds.free/every-relative-free.label': 'Chaque proche, sans frais',
  'plan.adds.free/every-relative-free.detail': 'Membres illimités, sans frais par personne.',
  'plan.adds.free/directory.label': 'Un répertoire de toute la famille',
  'plan.adds.free/directory.detail': 'Qui est qui, et comment le joindre.',
  'plan.adds.free/shared-calendar.label': 'Le rassemblement sur un calendrier partagé',
  'plan.adds.free/shared-calendar.detail':
    'La date, le lieu et les détails, sur une page que tout le monde peut voir.',
  'plan.adds.free/announcements.label': 'Des annonces que toute la famille voit',
  'plan.adds.free/announcements.detail':
    'Les nouvelles de la famille sur le tableau de bord de chacun plutôt qu’enfouies dans '
    + 'un fil de discussion.',
  'plan.adds.free/chat.label': 'Chat, pour toute la famille et privé',
  'plan.adds.free/chat.detail': 'Continuez à vous parler entre les rassemblements.',
  'plan.adds.free/one-account-many-families.label':
    'Un compte, quel que soit le nombre de familles',
  'plan.adds.free/one-account-many-families.detail':
    'Appartenez aux deux côtés, et passez de l’un à l’autre sans seconde connexion.',
  'plan.adds.free/nothing-scrolls-away.label': 'Rien n’est perdu quand cela disparaît de l’écran',
  'plan.adds.free/nothing-scrolls-away.detail':
    'Chaque annonce, et tout ce qui vous a été envoyé, cherchable longtemps après.',
  'plan.adds.free/manual.label': 'Un manuel que vos proches utiliseront vraiment',
  'plan.adds.free/manual.detail':
    'Chaque écran expliqué par son nom, accessible depuis le coin de l’écran où ils se '
    + 'trouvent.',
  'plan.adds.standard/family-tree.label': 'L’arbre généalogique, remonté',
  'plan.adds.standard/family-tree.detail':
    'Comment chacun est lié, génération par génération, le sang et le mariage distingués.',
  'plan.adds.standard/ledger.label': 'Un vrai registre pour l’argent que vous encaissez',
  'plan.adds.standard/ledger.detail':
    'Des barèmes de cotisations et un registre d’apports pour les espèces, enregistrés '
    + 'plutôt que mémorisés.',
  'plan.adds.standard/gathering-budget.label': 'Organisez le rassemblement, pas seulement la date',
  'plan.adds.standard/gathering-budget.detail':
    'Des listes de contrôle dont un rassemblement est bâti, et un budget tiré de l’un de '
    + 'vos fonds.',
  'plan.adds.standard/duties.label': 'Chacun connaît ses tâches',
  'plan.adds.standard/duties.detail':
    'Chaque étape confiée à un proche nommé, avec ce qui est revenu et si cela a été '
    + 'accepté.',
  'plan.adds.standard/separation-of-duties.label': 'Séparation des tâches',
  'plan.adds.standard/separation-of-duties.detail':
    'Des autorisations par fonctionnalité, pour qu’enregistrer des cotisations ne soit pas '
    + 'la même chose que verser de l’argent.',
  'plan.adds.standard/profile-pictures.label': 'Un visage pour chaque nom',
  'plan.adds.standard/profile-pictures.detail':
    'Des photos de profil, dans le répertoire, sur l’arbre et partout où un membre est '
    + 'listé.',
  'plan.adds.plus/card-payments.label': 'Encaissez comme votre famille paie',
  'plan.adds.plus/card-payments.detail':
    'Carte, débit, PayPal, Apple Pay, Google Pay et Cash App, avec des fonds derrière.',
  'plan.adds.plus/dues-projections.label': 'Sachez ce qui reste dû, avant d’avoir à le demander',
  'plan.adds.plus/dues-projections.detail':
    'Chaque proche qui doit cette année, ce qui est entré, et qui doit encore payer.',
  'plan.adds.plus/pnl.label': 'Un compte de résultat pour votre trésorier',
  'plan.adds.plus/pnl.detail': 'L’état que le conseil demande, plus les virements entre vos fonds.',
  'plan.adds.plus/membership-report.label': 'Les chiffres que le conseil demande',
  'plan.adds.plus/membership-report.detail':
    'Les cotisations encaissées face aux impayées, et vos adhésions par région et par '
    + 'section.',
  'plan.adds.plus/activity-reports.label': 'Des rapports sur autre chose que l’argent',
  'plan.adds.plus/activity-reports.detail':
    'Le travail du rassemblement revenu, la participation aux élections, les réunions '
    + 'tenues, et les fonctions que personne n’occupe.',
  'plan.adds.plus/elections.label': 'Élisez vos responsables comme il faut',
  'plan.adds.plus/elections.detail':
    'Nommer, accepter ou refuser, puis voter — dans toute la famille, ou dans une région ou '
    + 'une section.',
  'plan.adds.plus/library.label': 'La paperasse, et la structure qui va avec',
  'plan.adds.plus/library.detail':
    'Des statuts cherchables, des procès-verbaux qui consignent comment la salle a voté, et '
    + 'des régions et sections avec leurs propres responsables.',
  'plan.adds.plus/officer-notes.label': 'Chaque fonction tient son propre carnet',
  'plan.adds.plus/officer-notes.detail':
    'Des notes qui restent avec la fonction plutôt qu’avec la personne, lues seulement par '
    + 'son titulaire.',
  'plan.adds.plus/gallery.label': 'Des photographies, trouvables',
  'plan.adds.plus/gallery.detail': 'Des collections par rassemblement, avec étiquetage.',
  'plan.adds.premium/dues-reminders.label':
    'Cessez de courir après vos proches pour leurs cotisations',
  'plan.adds.premium/dues-reminders.detail':
    'Les rappels partent à chaque échéance, et s’arrêtent quand elle est payée.',
  'plan.adds.premium/notifications.label':
    'Des nouvelles qui arrivent au lieu d’attendre qu’on les trouve',
  'plan.adds.premium/notifications.detail':
    'Des notifications sur le téléphone et dans le navigateur, pour les annonces, les '
    + 'messages et les tâches qui vous sont confiées.',
  'plan.adds.premium/mobile-apps.label': 'La famille dans la poche de chacun',
  'plan.adds.premium/mobile-apps.detail':
    'Des applications pour iPhone et Android, sur le même compte familial.',
  'plan.adds.premium/email-distributions.label':
    'Écrivez à toute la famille sans construire de liste',
  'plan.adds.premium/email-distributions.detail': 'Des envois tirés directement de vos adhésions.',
  'plan.adds.premium/safety-check-ins.label':
    'Vérifiez que tout le monde est en sécurité, d’une pression chacun',
  'plan.adds.premium/safety-check-ins.detail':
    'Demandez aux proches d’un secteur s’ils sont en sécurité, et voyez qui n’a pas '
    + 'répondu.',
  'plan.adds.premium/family-website.label':
    'Le site web de votre famille, qui se tient à jour tout seul',
  'plan.adds.premium/family-website.detail':
    'Il se construit à partir de votre prochain rassemblement, de vos photographies les '
    + 'plus récentes et de votre dernière annonce.',
  'plan.adds.premium/custom-domain.label': 'Une vraie adresse pour lui, prête à l’emploi',
  'plan.adds.premium/custom-domain.detail':
    'Aucune facture d’hébergement, aucune extension, et personne dans la famille à '
    + 'l’entretenir.',

  // Les 395 refus qu’une action serveur peut renvoyer. Voir la version anglaise pour le
  // raisonnement ; il n’y a ici que les traductions.
  'act.budgetCannotNegative': 'Un budget ne peut pas être négatif',
  'act.budgetLineCannotNegative': 'Une ligne de budget ne peut pas être négative',
  'act.budgetLineMustWholeNumber': 
    'Une ligne de budget doit être un nombre entier de centimes et ne peut '
    + 'pas être négative',
  'act.budgetMustWholeNumberCents': 
    'Un budget doit être un nombre entier de centimes et ne peut pas être '
    + 'négatif',
  'act.donationNeedsGoalWorkToward': 'Une collecte a besoin d’un objectif à atteindre',
  'act.duesScheduleRequired': 'Un barème de cotisations est requis',
  'act.gatheringNeedsTitle': 'Le rassemblement a besoin d’un titre',
  'act.publishedElectionCannotEditedReturn': 
    'Une élection publiée ne peut pas être modifiée. Remettez-la d’abord au '
    + 'brouillon, ce qui n’est possible que tant que personne n’a été nommé et '
    + 'qu’aucun vote n’a été exprimé.',
  'act.resetLinkBeenRequestedMember': 
    'Un lien de réinitialisation a été demandé pour ce membre. Il le recevra '
    + 'si son adresse est joignable.',
  'act.stepNeedsLabel': 'L’étape a besoin d’un intitulé',
  'act.suggestedBudgetMustWholeNumber': 
    'Un budget suggéré doit être un nombre entier de centimes et ne peut pas '
    + 'être négatif',
  'act.templateCannotIncludeItself': 'Un modèle ne peut pas s’inclure lui-même',
  'act.templateNeedsName': 'Le modèle a besoin d’un nom',
  'act.templateNameAlreadyExists': 'Un modèle porte déjà ce nom.',
  'act.addMobileNumberFirst': 'Ajoutez d’abord un numéro de mobile',
  'act.addLeastOnePositionBefore': 
    'Ajoutez au moins un poste avant de publier : un scrutin sans poste n’a '
    + 'rien à faire élire.',
  'act.addTheirDateBirthWhat': 
    'Ajoutez sa date de naissance. C’est elle qui détermine quand les '
    + 'cotisations commencent.',
  'act.administratorsGeneralBuiltCannotDeleted': 
    'Administrateurs et Général sont intégrés et ne peuvent pas être '
    + 'supprimés. Modifiez plutôt ce qu’ils accordent.',
  'act.albumNotFound': 'Album introuvable',
  'act.announcementNotFound': 'Annonce introuvable',
  'act.archivedMustYesNo': 'Archivé doit être oui ou non',
  'act.automaticPaymentsAlreadySetUp': 'Les paiements automatiques sont déjà en place pour cette cotisation.',
  'act.automaticPaymentsBeenStoppedEvery': 
    'Les paiements automatiques ont été arrêtés. Chaque paiement déjà '
    + 'effectué est conservé.',
  'act.chapterNotFound': 'Chapitre introuvable',
  'act.chapterSavedButTheirChildren': 
    'Le chapitre est enregistré, mais ses enfants de moins de 18 ans sans '
    + 'compte propre n’ont pas pu être déplacés avec lui. Réessayez, ou '
    + 'définissez chaque chapitre séparément.',
  'act.checkClosed': 'Point de contact clos',
  'act.checkDeleted': 'Point de contact supprimé',
  'act.checkNotFound': 'Point de contact introuvable',
  'act.chooseApproveSendBack': 'Choisissez Approuver ou Renvoyer',
  'act.chooseJpegPngWebpImage': 'Choisissez une image JPEG, PNG ou WebP',
  'act.chooseJpegPngWebpGif': 'Choisissez une image JPEG, PNG, WebP ou GIF',
  'act.chooseChapter': 'Choisissez un chapitre',
  'act.chooseDateMeeting': 'Choisissez une date pour la réunion',
  'act.chooseFile': 'Choisissez un fichier',
  'act.choosePhotoUpload': 'Choisissez une photographie à téléverser',
  'act.chooseRegion': 'Choisissez une région',
  'act.chooseTimezone': 'Choisissez un fuseau horaire',
  'act.chooseLeastOneDuePay': 'Choisissez au moins une cotisation à payer.',
  'act.chooseLeastOneRelativeAsk': 'Choisissez au moins un proche à interroger',
  'act.chooseSomebodyFromYourFamily': 'Choisissez quelqu’un de votre famille',
  'act.chooseDateGatheringStarts': 'Choisissez la date à laquelle commence le rassemblement',
  'act.chooseFundBudgetDrawn': 'Choisissez la caisse sur laquelle ce budget est prélevé',
  'act.chooseTwoDifferentFunds': 'Choisissez deux caisses différentes',
  'act.chooseWhatKindAccessGive': 'Choisissez quel type d’accès lui donner',
  'act.chooseWhatKindAccessGrant': 'Choisissez quel type d’accès accorder',
  'act.chooseWhatStepAsks': 'Choisissez ce que demande l’étape',
  'act.chooseWhetherPayMonthlyAdvance': 'Choisissez de payer mensuellement ou à l’avance.',
  'act.chooseWhetherYouSafe': 'Indiquez si vous êtes en sécurité',
  'act.chooseWhichChapterGoing': 'Choisissez à quel chapitre ceci est destiné',
  'act.chooseWhichFirstPaymentMake': 'Choisissez quel premier paiement effectuer.',
  'act.chooseWhichRegionGoing': 'Choisissez à quelle région ceci est destiné',
  'act.chooseWhoTakingMinutes': 'Choisissez qui rédige le procès-verbal',
  'act.chooseWhoMayScheduleFrom': 'Choisissez qui peut programmer à partir de ce modèle',
  'act.chooseWhoGoing': 'Choisissez à qui ceci est destiné',
  'act.chooseWhoAsk': 'Choisissez qui interroger',
  'act.contributorNotFoundFamily': 'Ce contributeur est introuvable dans cette famille',
  'act.couldNotAcceptInvitationPlease': 'Cette invitation n’a pas pu être acceptée. Réessayez.',
  'act.couldNotAddStepTry': 'Cette étape n’a pas pu être ajoutée. Réessayez.',
  'act.couldNotApplyTemplatePlease': 'Ce modèle n’a pas pu être appliqué. Réessayez.',
  'act.couldNotBuildRosterSo': 'La liste n’a pas pu être établie, rien n’a donc été envoyé',
  'act.couldNotCancelInvitation': 'Cette invitation n’a pas pu être annulée.',
  'act.couldNotChangeMemberPlease': 'Ce membre n’a pas pu être modifié. Réessayez.',
  'act.couldNotChangeLanguagePlease': 'La langue n’a pas pu être changée. Réessayez.',
  'act.couldNotChangePlanPlease': 'Le forfait n’a pas pu être changé. Réessayez.',
  'act.couldNotChangeTimezonePlease': 'Le fuseau horaire n’a pas pu être changé. Réessayez.',
  'act.couldNotChangeTheirAccess': 'Son accès n’a pas pu être modifié pour le moment. Réessayez.',
  'act.couldNotCheckRecurringPayments': 'Impossible de vérifier s’il existe des paiements récurrents. Réessayez.',
  'act.couldNotCheckCodePlease': 'Ce code n’a pas pu être vérifié. Réessayez.',
  'act.couldNotCheckPersonS': 'L’adhésion de cette personne n’a pas pu être vérifiée',
  'act.couldNotCheckOwnerList': 
    'La liste des propriétaires n’a pas pu être consultée pour le moment. '
    + 'Réessayez.',
  'act.couldNotCheckWhatWork': 'Impossible de vérifier quel travail a été traité pour ce rassemblement',
  'act.couldNotCheckWhetherAny': 
    'Impossible de vérifier si un rassemblement a été créé à partir de ce '
    + 'modèle ; rien n’a donc été supprimé. Réessayez.',
  'act.couldNotCheckWhoAdult': 
    'Impossible de vérifier qui est majeur pour le moment. Rien n’a été '
    + 'enregistré.',
  'act.couldNotCheckYourText': 'Votre consentement aux SMS n’a pas pu être vérifié. Réessayez.',
  'act.couldNotClaimNextBatch': 'Le lot suivant n’a pas pu être réservé',
  'act.couldNotCloseCheck': 'Le point de contact n’a pas pu être clos',
  'act.couldNotConfirmCodePlease': 'Ce code n’a pas pu être confirmé. Réessayez.',
  'act.couldNotConfirmNumber': 'Ce numéro n’a pas pu être confirmé',
  'act.couldNotCreateFamilyPlease': 'Cette famille n’a pas pu être créée. Réessayez.',
  'act.couldNotCreateInvitationPlease': 'Cette invitation n’a pas pu être créée. Réessayez.',
  'act.couldNotCreateTemplate': 'Le modèle n’a pas pu être créé.',
  'act.couldNotDeleteCheck': 'Le point de contact n’a pas pu être supprimé',
  'act.couldNotDeleteTemplate': 'Le modèle n’a pas pu être supprimé.',
  'act.couldNotDisconnectPleaseTry': 'La déconnexion a échoué. Réessayez.',
  'act.couldNotDismissAnnouncement': 'Cette annonce n’a pas pu être écartée.',
  'act.couldNotFindYourCurrent': 'Votre fiche de profil actuelle est introuvable.',
  'act.couldNotGenerateUniqueFamily': 'Aucun code de famille unique n’a pu être généré. Réessayez.',
  'act.couldNotGrantAccessJust': 'L’accès n’a pas pu être accordé pour le moment. Réessayez.',
  'act.couldNotJoinFamilyPlease': 'Vous n’avez pas pu rejoindre cette famille. Réessayez.',
  'act.couldNotLookUpCode': 'Ce code n’a pas pu être recherché. Réessayez.',
  'act.couldNotMoveStepTry': 'Cette étape n’a pas pu être déplacée. Réessayez.',
  'act.couldNotOpenStripeOnboarding': 'L’inscription Stripe n’a pas pu être ouverte. Réessayez.',
  'act.couldNotOpenBillingPortal': 'Le portail de facturation n’a pas pu être ouvert. Réessayez.',
  'act.couldNotPinAnnouncement': 'Cette annonce n’a pas pu être épinglée.',
  'act.couldNotQueueThoseAsks': 'Ces demandes n’ont pas pu être remises en file.',
  'act.couldNotRaiseCheck': 'Le point de contact n’a pas pu être ouvert',
  'act.couldNotReachStripePlease': 'Stripe est injoignable. Réessayez.',
  'act.couldNotReachAccountService': 'Le service des comptes est injoignable pour le moment. Réessayez.',
  'act.couldNotReadConnection': 'Cette connexion n’a pas pu être lue',
  'act.couldNotReadGathering': 'Ce rassemblement n’a pas pu être lu',
  'act.couldNotReadRecord': 'Cette fiche n’a pas pu être lue',
  'act.couldNotReadStaffMember': 
    'Les informations de ce membre du personnel n’ont pas pu être lues pour '
    + 'le moment. Réessayez.',
  'act.couldNotReadStepTry': 'Cette étape n’a pas pu être lue. Réessayez.',
  'act.couldNotReadTask': 'Cette tâche n’a pas pu être lue',
  'act.couldNotReadTemplateTry': 'Ce modèle n’a pas pu être lu. Réessayez.',
  'act.couldNotReadAlbumNothing': 'L’album n’a pas pu être lu. Rien n’a été supprimé.',
  'act.couldNotReadCurrentPlan': 'Le forfait actuel n’a pas pu être lu depuis Stripe. Réessayez.',
  'act.couldNotReadFamilyRoster': 
    'La liste de la famille n’a pas pu être lue pour le moment ; rien n’a '
    + 'donc été envoyé. Réessayez.',
  'act.couldNotReadRelationshipTypes': 'Les types de lien de parenté n’ont pas pu être lus',
  'act.couldNotReadSubmission': 'La réponse envoyée n’a pas pu être lue',
  'act.couldNotReadTasksFrom': 'Les tâches de ce modèle n’ont pas pu être lues',
  'act.couldNotReadTemplateCopy': 'Le modèle à copier n’a pas pu être lu.',
  'act.couldNotReadTemplates': 'Les modèles n’ont pas pu être lus',
  'act.couldNotReadGatheringS': 'Les modèles de ce rassemblement n’ont pas pu être lus',
  'act.couldNotRecordDecisionPlease': 'Cette décision n’a pas pu être enregistrée. Réessayez.',
  'act.couldNotRecordChangePlease': 'Le changement n’a pas pu être enregistré. Réessayez.',
  'act.couldNotRecordDecision': 'La décision n’a pas pu être enregistrée',
  'act.couldNotRecordYourAnswer': 'Votre réponse n’a pas pu être enregistrée',
  'act.couldNotRecordYourAnswer2': 'Votre réponse n’a pas pu être enregistrée — réessayez',
  'act.couldNotRecordYourChoice': 'Votre choix n’a pas pu être enregistré. Réessayez.',
  'act.couldNotRemoveNumber': 'Ce numéro n’a pas pu être supprimé',
  'act.couldNotRemoveFamilyPlease': 'La famille n’a pas pu être supprimée. Réessayez.',
  'act.couldNotRemoveTheirAccess': 'Son accès n’a pas pu être retiré pour le moment. Réessayez.',
  'act.couldNotRenameFamilyPlease': 'La famille n’a pas pu être renommée. Réessayez.',
  'act.couldNotRenameTemplate': 'Le modèle n’a pas pu être renommé.',
  'act.couldNotResendInvitation': 'Cette invitation n’a pas pu être renvoyée.',
  'act.couldNotResolveAddressUnambiguously': 
    'Cette adresse n’a pas pu être identifiée sans ambiguïté — saisissez-la '
    + 'exactement et réessayez.',
  'act.couldNotRestoreFamilyPlease': 'Cette famille n’a pas pu être restaurée. Réessayez.',
  'act.couldNotSave': 'Cela n’a pas pu être enregistré',
  'act.couldNotSaveNumber': 'Ce numéro n’a pas pu être enregistré',
  'act.couldNotSaveSegmentJust': 'Ce segment n’a pas pu être enregistré pour le moment. Réessayez.',
  'act.couldNotSavePleaseTry': 'Cela n’a pas pu être enregistré. Réessayez.',
  'act.couldNotSavePermission': 'L’autorisation n’a pas pu être enregistrée.',
  'act.couldNotSaveWhatStripe': 'Ce que Stripe nous a indiqué n’a pas pu être enregistré. Réessayez.',
  'act.couldNotSendCodeJust': 'Aucun code n’a pu être envoyé pour le moment',
  'act.couldNotSendCodeJust2': 'Aucun code n’a pu être envoyé pour le moment. Réessayez.',
  'act.couldNotSendJustNow': 'Cela n’a pas pu être envoyé pour le moment. Réessayez.',
  'act.couldNotSetUpAutomatic': 'Les paiements automatiques n’ont pas pu être mis en place. Réessayez.',
  'act.couldNotStartSettingUp': 'La mise en place des paiements n’a pas pu commencer. Réessayez.',
  'act.couldNotStartPaymentPlease': 'Le paiement n’a pas pu être lancé. Réessayez.',
  'act.couldNotStartSetupPlease': 'La configuration n’a pas pu être lancée. Réessayez.',
  'act.couldNotStopAutomaticPayments': 'Les paiements automatiques n’ont pas pu être arrêtés. Réessayez.',
  'act.couldNotStopPlanPlease': 'Le forfait n’a pas pu être arrêté. Réessayez.',
  'act.couldNotUpdatePleaseTry': 'Cela n’a pas pu être mis à jour. Réessayez.',
  'act.couldNotUpdateYourFamily': 'Votre choix de famille n’a pas pu être mis à jour. Réessayez.',
  'act.destinationFundNotFound': 'Caisse de destination introuvable',
  'act.documentNotFound': 'Document introuvable',
  'act.donationsAlreadyOptionalThereNothing': 'Les dons sont déjà facultatifs — il n’y a rien à refuser.',
  'act.donationsGivenFromDonationsPane': 
    'Les dons se font depuis le volet Dons ; ils ne se paient pas comme des '
    + 'cotisations.',
  'act.duesNeedAmount': 'Les cotisations ont besoin d’un montant',
  'act.duesScheduleNotFound': 'Barème de cotisations introuvable',
  'act.electionNotFound': 'Élection introuvable',
  'act.enterBudgetAmount': 'Saisissez un montant de budget',
  'act.enterFamilyCode': 'Saisissez un code de famille',
  'act.enterFamilyCode2': 'Saisissez un code de famille.',
  'act.enterFamilyName': 'Saisissez un nom de famille',
  'act.enterFirstLastName': 'Saisissez un prénom et un nom',
  'act.enterAmount': 'Saisissez un montant',
  'act.enterAmountGreaterThanZero': 'Saisissez un montant supérieur à zéro',
  'act.enterAmountGive': 'Saisissez le montant à donner.',
  'act.enterAmountPay': 'Saisissez le montant à payer.',
  'act.enterEmailAddress': 'Saisissez une adresse électronique',
  'act.enterEmailAddressAccountGrant': 'Saisissez l’adresse électronique du compte à autoriser',
  'act.enterFirstLastNamePerson': 'Saisissez le prénom et le nom de la personne que vous invitez',
  'act.enterSixDigitsFromText': 'Saisissez les six chiffres reçus par SMS.',
  'act.everyoneAudienceFamilyTreeWithout': 
    'Tout le monde dans ce public figure sur l’arbre généalogique sans '
    + 'adresse électronique ; il n’y a donc personne à qui envoyer.',
  'act.failedCreateFamilyRecordPlease': 'La fiche de famille n’a pas pu être créée. Réessayez.',
  'act.failedLinkYourAccountPlease': 'Votre compte n’a pas pu être lié. Réessayez.',
  'act.failedPrepareAccountLinkPlease': 'Le lien de compte n’a pas pu être préparé. Réessayez.',
  'act.familyCodeRequired': 'Le code de famille est requis',
  'act.familyCodeNotFoundCheck': 
    'Code de famille introuvable. Vérifiez auprès de votre famille et '
    + 'réessayez.',
  'act.fileMustUnder2Mb': 'Le fichier doit peser moins de 2 Mo',
  'act.fundNotFound': 'Caisse introuvable',
  'act.gatheringNotFound': 'Rassemblement introuvable',
  'act.gatheringTemplateNotFound': 'Rassemblement ou modèle introuvable',
  'act.giveStartTimeWellLeave': 'Indiquez aussi une heure de début, ou laissez l’heure de fin vide',
  'act.giveAlbumName': 'Donnez un nom à l’album',
  'act.giveArticleTitle': 'Donnez un titre à l’article',
  'act.giveDocumentName': 'Donnez un nom au document',
  'act.giveElectionTitle': 'Donnez un titre à l’élection.',
  'act.giveEntryTitle': 'Donnez un titre au sujet.',
  'act.giveMeetingTitle': 'Donnez un titre à la réunion',
  'act.giveMessageSubject': 'Donnez un objet au message',
  'act.giveTopicTitle': 'Donnez un titre au point à l’ordre du jour',
  'act.giveThemFirstLastName': 'Indiquez son prénom et son nom avant de l’inviter',
  'act.invitationNotFound': 'Invitation introuvable',
  'act.meetingNotFound': 'Réunion introuvable',
  'act.memberNotFound': 'Membre introuvable',
  'act.milestoneNotFound': 'Étape introuvable',
  'act.mobileNumberRemoved': 'Numéro de mobile supprimé.',
  'act.moveStepUpDown': 'Déplacez une étape vers le haut ou vers le bas',
  'act.multiFamilySupportNotEnabled': 
    'La prise en charge de plusieurs familles n’est pas encore activée sur la '
    + 'base de données. Appliquez la migration '
    + '20260617000000_multi_family_membership.sql.',
  'act.noFamilyAssociatedAccount': 'Aucune famille associée au compte',
  'act.noFamilyAssociatedYourAccount': 'Aucune famille associée à votre compte.',
  'act.noFamilyCodeAssociatedAccount': 'Aucun code de famille associé au compte',
  'act.noFamilySelected': 'Aucune famille sélectionnée',
  'act.noFamilySelected2': 'Aucune famille sélectionnée.',
  'act.noFileProvided': 'Aucun fichier fourni',
  'act.noFilesChosen': 'Aucun fichier n’a été choisi',
  'act.noVoteBeenCalledTopic': 'Aucun vote n’a été convoqué sur ce point.',
  'act.noVoteBeenCalledTopic2': 'Aucun vote n’a encore été convoqué sur ce point.',
  'act.nobodyFamilyMatchesAudienceSo': 
    'Personne dans la famille ne correspond à ce public ; rien n’a donc été '
    + 'envoyé. Vérifiez la région ou le chapitre que vous avez choisi.',
  'act.nobodyFamilyMatchesAudienceSo2': 
    'Personne dans la famille ne correspond à ce public ; il n’y a donc rien '
    + 'à envoyer.',
  'act.notMemberFamily': 'Vous n’êtes pas membre de cette famille',
  'act.notAuthenticated': 'Non authentifié',
  'act.notAuthenticated2': 'Non authentifié.',
  'act.notAuthorized': 'Non autorisé',
  'act.notFound': 'Introuvable',
  'act.noteNotFound': 'Note introuvable',
  'act.nothingChange': 'Rien à modifier',
  'act.numberConfirmed': 'Numéro confirmé.',
  'act.oneThoseAttendeesNotFamily': 'L’un de ces participants n’est pas dans cette famille',
  'act.oneThosePeopleNotFamily': 'L’une de ces personnes n’est pas dans cette famille',
  'act.oneThosePeopleNotFamily2': 'L’une de ces personnes n’est pas dans cette famille.',
  'act.onlinePaymentsNotSetUp': 
    'Les paiements en ligne ne sont pas encore configurés sur cette '
    + 'installation.',
  'act.onlinePaymentsNotSetUp2': 'Les paiements en ligne ne sont pas encore configurés.',
  'act.onlinePaymentsOffDeployment': 'Les paiements en ligne sont désactivés sur ce déploiement.',
  'act.connectNotSetUpDeployment': 'Les paiements en ligne ne sont pas encore configurés sur ce déploiement.',
  'act.onlyTemplateStepCanInclude': 'Seule une étape de modèle peut inclure un autre modèle',
  'act.onlyPeopleAttendeeListCan': 
    'Seules les personnes inscrites sur la liste des participants peuvent '
    + 'voter à cette réunion.',
  'act.onlySecretaryMeetingCanWrite': 
    'Seule la personne chargée du procès-verbal de cette réunion peut le '
    + 'rédiger.',
  'act.paymentNotFound': 'Paiement introuvable',
  'act.paymentsBeenRecordedAgainstDue': 
    'Des paiements ont été enregistrés pour cette cotisation ; sa date de '
    + 'début, son montant, sa fréquence, l’âge de départ, le réglage de '
    + 'filiation et les personnes qui la doivent ne peuvent donc plus changer. '
    + 'Vous pouvez encore modifier la date de fin.',
  'act.personNotYourFamily': 'Cette personne n’est pas dans votre famille.',
  'act.personNotFound': 'Personne introuvable',
  'act.personNotFound2': 'Personne introuvable.',
  'act.photoNotFound': 'Photographie introuvable',
  'act.pickHowOftenYouWant': 
    'Choisissez d’abord à quelle fréquence vous voulez payer cette cotisation '
    + '— les paiements automatiques suivent la cadence que vous choisissez.',
  'act.pickTemplateStepIncludes': 'Choisissez le modèle que cette étape inclut',
  'act.profileNotFound': 'Profil introuvable',
  'act.profileNotFound2': 'Profil introuvable.',
  'act.profilePicturesPartStandardPlan': 
    'Les photos de profil font partie du forfait Standard. Cette famille est '
    + 'sur Free.',
  'act.recipientNotFoundFamily': 'Ce destinataire est introuvable dans cette famille',
  'act.recordCheckNumberReferenceContribution': 'Enregistrez un numéro de chèque ou une référence pour la contribution',
  'act.recordCheckNumberReferenceDisbursement': 'Enregistrez un numéro de chèque ou une référence pour le versement',
  'act.recordCheckNumberReferencePayment': 'Enregistrez un numéro de chèque ou une référence pour le paiement',
  'act.recordGenderOtherPersonFirst': 
    'Enregistrez d’abord le genre de l’autre personne, afin que nous '
    + 'puissions aussi nommer ce lien de son côté.',
  'act.recordHowContributionGiven': 'Enregistrez comment la contribution a été remise',
  'act.recordHowPaymentMade': 'Enregistrez comment le paiement a été effectué',
  'act.recordWhoContributionCameFrom': 'Enregistrez de qui vient la contribution',
  'act.recordWhyMoneyBeingMoved': 'Enregistrez pourquoi l’argent est déplacé',
  'act.recurringPaymentsDuesOnly': 'Les paiements récurrents ne concernent que les cotisations.',
  'act.regionNotFound': 'Région introuvable',
  'act.relationshipNotFound': 'Lien de parenté introuvable',
  'act.requiredMustYesNo': 'Obligatoire doit être oui ou non',
  'act.savedYourFamilyMaySend': 'Enregistré. Votre famille peut vous envoyer des points de contact par SMS.',
  'act.sayWhatHappeningSoRelatives': 'Dites ce qui se passe, pour que vos proches sachent ce qu’on leur demande',
  'act.sayWhatNeedsChangeSending': 
    'Dites ce qui doit changer — renvoyer une tâche sans remarques ne laisse '
    + 'rien sur quoi agir',
  'act.sayWhichTimezoneTimeSo': 
    'Précisez le fuseau horaire de cette heure, pour que vos proches ailleurs '
    + 'puissent la lire',
  'act.sayWhyPersonNoEmail': 'Dites pourquoi cette personne n’a pas d’adresse électronique',
  'act.sayWhyPersonNeedsStaff': 
    'Dites pourquoi cette personne a besoin d’un accès au personnel. La liste '
    + 'est un registre d’audit.',
  'act.scheduleNotFound': 'Barème introuvable',
  'act.segmentNotFound': 'Segment introuvable',
  'act.signAcceptInvitation': 'Connectez-vous pour accepter cette invitation.',
  'act.someMembersStillBeingCharged': 
    'Certains membres sont encore prélevés automatiquement et nous n’avons '
    + 'pas pu l’arrêter. Rien n’a été déconnecté — réessayez.',
  'act.somebodyCannotTheirOwnRelative': 'Personne ne peut être son propre parent',
  'act.somebodyYouRemovingAlreadyVoted': 
    'Quelqu’un que vous retirez a déjà voté. Un vote ne peut pas être retiré '
    + ': cette personne doit rester sur la liste.',
  'act.staffMemberNotFound': 'Membre du personnel introuvable',
  'act.stepNotFound': 'Étape introuvable',
  'act.stripeUpdatedButWeCould': 
    'Stripe a été mis à jour mais nous n’avons pas pu l’enregistrer. '
    + 'Contactez l’assistance avant de réessayer.',
  'act.stripeUpdatedButWeCould2': 
    'Stripe a été mis à jour mais nous n’avons pas pu enregistrer le '
    + 'changement. Contactez l’assistance avant de réessayer.',
  'act.taskNotFound': 'Tâche introuvable',
  'act.templateNameRequired': 'Le nom du modèle est requis.',
  'act.templateNotFound': 'Modèle introuvable',
  'act.templateNotFoundYourFamily': 'Modèle introuvable dans votre famille.',
  'act.templateNotFound2': 'Modèle introuvable.',
  'act.bylawNoFileAttached': 'Ce statut n’a aucun fichier joint.',
  'act.channelNotAvailableNotificationYet': 'Ce canal n’est pas encore disponible pour cette notification.',
  'act.checkAlreadyClosed': 'Ce point de contact était déjà clos',
  'act.codeNotRight': 'Ce code n’est pas le bon.',
  'act.couldNotPreparedNothingBeen': 'Cela n’a pas pu être préparé. Rien n’a été envoyé.',
  'act.couldNotReadJustNow': 'Cela n’a pas pu être lu pour le moment.',
  'act.couldNotRemovedJustNow': 'Cela n’a pas pu être supprimé pour le moment.',
  'act.couldNotWithdrawnNominationsMay': 
    'Cela n’a pas pu être retiré. Les candidatures sont peut-être closes, ou '
    + 'la personne a peut-être accepté depuis le chargement de cette page — une '
    + 'candidature acceptée reste sur le scrutin, et la seule sortie est '
    + 'qu’elle la décline.',
  'act.doesNotLookLikeMobile': 
    'Cela ne ressemble pas à un numéro de mobile. Indiquez l’indicatif '
    + 'régional — par exemple 512-555-0134.',
  'act.driveNotOneYourFamily': 'Cette collecte n’appartient pas à votre famille.',
  'act.dueDateNotRealDate': 'Cette date d’échéance n’est pas une date réelle',
  'act.dueNotOneYours': 'Cette cotisation n’est pas la vôtre.',
  'act.endDateNotRealDate': 'Cette date de fin n’est pas une date réelle',
  'act.entryCouldNotChangedOnly': 
    'Ce sujet n’a pas pu être modifié. Seule la personne qui l’a consigné '
    + 'peut le faire, et seulement tant qu’elle occupe encore la fonction.',
  'act.entryCouldNotRemovedOnly': 
    'Ce sujet n’a pas pu être supprimé. Seule la personne qui l’a consigné '
    + 'peut le faire, et seulement tant qu’elle occupe encore la fonction.',
  'act.entryRefusedJournalOnlyWritable': 
    'Ce sujet a été refusé. Un carnet n’est modifiable que par la personne '
    + 'qui occupe la fonction — rechargez la page pour voir lesquelles sont les '
    + 'vôtres.',
  'act.familyNameTooLong100': 'Ce nom de famille est trop long (100 caractères au maximum).',
  'act.fileCouldNotOpenedMay': 'Ce fichier n’a pas pu être ouvert. Il a peut-être été supprimé.',
  'act.invitationAlreadyBeenAccepted': 'Cette invitation a déjà été acceptée.',
  'act.invitationNoLongerValidAsk': 'Cette invitation n’est plus valable. Demandez-en une nouvelle.',
  'act.invitationCancelledSendNewOne': 'Cette invitation a été annulée. Envoyez-en une nouvelle à la place.',
  'act.notChannelWeSend': 'Ce n’est pas un canal par lequel nous envoyons.',
  'act.notDate': 'Ce n’est pas une date',
  'act.notDateSegmentCanHappen': 'Ce n’est pas une date à laquelle ce segment peut avoir lieu',
  'act.notGatheringStatus': 'Ce n’est pas un état de rassemblement',
  'act.notLanguageWeSpeakYet': 'Ce n’est pas une langue que nous parlons encore',
  'act.notNotificationWeSend': 'Ce n’est pas une notification que nous envoyons.',
  'act.notPlanCanBought': 'Ce n’est pas un forfait que l’on peut acheter.',
  'act.notPlan': 'Ce n’est pas un forfait.',
  'act.notRelationshipTreeRecords': 'Ce n’est pas un lien de parenté que cet arbre enregistre',
  'act.notTimeWeCanRead': 'Ce n’est pas une heure que nous pouvons lire',
  'act.notTimezoneWeRecognise': 'Ce n’est pas un fuseau horaire que nous reconnaissons',
  'act.notVote': 'Ce n’est pas un vote.',
  'act.nominationNotBallot': 'Cette candidature n’est pas sur ce scrutin.',
  'act.nominationRefusedNominationsMayClosed': 
    'Cette candidature a été refusée — les candidatures sont peut-être '
    + 'closes, ou cette élection ne concerne peut-être pas votre partie de la '
    + 'famille. Rechargez la page pour voir où elle en est.',
  'act.nominationWithdrawnWhileYouLooking': 'Cette candidature a été retirée pendant que vous la regardiez. Réessayez.',
  'act.noteCouldNotChangedOnly': 
    'Cette note n’a pas pu être modifiée. Seule la personne qui l’a écrite '
    + 'peut le faire, et seulement tant qu’elle occupe encore la fonction.',
  'act.noteCouldNotRemovedOnly': 
    'Cette note n’a pas pu être supprimée. Seule la personne qui l’a écrite '
    + 'peut le faire, et seulement tant qu’elle occupe encore la fonction.',
  'act.noteRefusedJournalOnlyWritable': 
    'Cette note a été refusée. Un carnet n’est modifiable que par la personne '
    + 'qui occupe la fonction — rechargez la page pour voir lesquelles sont les '
    + 'vôtres.',
  'act.numberChangedWhileCodeFlight': 
    'Ce numéro a changé pendant que le code était en route. Envoyez un '
    + 'nouveau code et réessayez.',
  'act.numberAlreadyConfirmed': 'Ce numéro est déjà confirmé',
  'act.paymentAlreadyBeenReversed': 'Ce paiement a déjà été annulé.',
  'act.personAlreadyAccountLinked': 'Cette personne a déjà un compte lié.',
  'act.personNotFinishedJoiningFamily': 'Cette personne n’a pas encore terminé de rejoindre la famille.',
  'act.personNotCandidatePosition': 'Cette personne n’est pas candidate à ce poste.',
  'act.personNotPartFamilyElection': 
    'Cette personne n’est pas dans la partie de la famille que concerne cette '
    + 'élection.',
  'act.personNotFamily': 'Cette personne n’est pas dans cette famille',
  'act.personNotFamily2': 'Cette personne n’est pas dans cette famille.',
  'act.personNotPartConnection': 'Cette personne ne fait pas partie de cette connexion',
  'act.personSMembershipNotBeen': 'L’adhésion de cette personne n’a pas encore été approuvée',
  'act.photoMustUnder10Mb': 'Cette photographie doit peser moins de 10 Mo',
  'act.positionNotBallot': 'Ce poste n’est pas sur ce scrutin.',
  'act.relationshipTypeNotSetUp': 'Ce type de lien de parenté n’est pas configuré',
  'act.rowItselfReversal': 'Cette ligne est elle-même une annulation.',
  'act.secretaryNotFamily': 'Cette personne chargée du procès-verbal n’est pas dans cette famille',
  'act.sendCouldNotContinuedJust': 'Cet envoi n’a pas pu être poursuivi pour le moment.',
  'act.templateNotPartGathering': 'Ce modèle ne fait pas partie de ce rassemblement',
  'act.templateNotFound3': 'Ce modèle est introuvable',
  'act.voteAlreadyClosedDeleteTopic': 
    'Ce vote est déjà clos. Supprimez le point et reposez la question s’il '
    + 'faut un second tour.',
  'act.voteClosed': 'Ce vote est clos.',
  'act.wouldChangeHowTheyRelated': 'Cela changerait la nature de leur lien, et pas seulement son nom',
  'act.endDateCannotPast': 'La date de fin ne peut pas être dans le passé.',
  'act.endTimeAfterStartTime': 'L’heure de fin doit être postérieure à l’heure de début',
  'act.fileMustUnder25Mb': 'Le fichier doit peser moins de 25 Mo.',
  'act.gatheringCannotEndBeforeStarts': 'Le rassemblement ne peut pas se terminer avant de commencer',
  'act.messageTooLongKeepUnder': 'Le message est trop long — restez sous 20 000 caractères.',
  'act.paymentsBeenStoppedStripeBut': 
    'Les paiements ont été arrêtés chez Stripe mais nous n’avons pas pu '
    + 'mettre votre fiche à jour. Rechargez la page.',
  'act.restoreReturnedNoResultPlease': 'La restauration n’a renvoyé aucun résultat. Réessayez.',
  'act.sameDueListedTwice': 'La même cotisation est listée deux fois.',
  'act.sendProgressedButCouldNot': 'L’envoi a progressé mais n’a pas pu être lu.',
  'act.subjectTooLongKeepUnder': 'L’objet est trop long — restez sous 200 caractères.',
  'act.templateCopyNotFoundYour': 'Le modèle à copier est introuvable dans votre famille.',
  'act.thereNoAutomaticPaymentsSet': 'Aucun paiement automatique n’est en place pour cette cotisation.',
  'act.thereNothingSetUpDue': 'Il n’y a rien à configurer sur cette cotisation.',
  'act.thereNoPlanWaitingSet': 'Aucun forfait n’attendait d’être configuré.',
  'act.theyAlreadyAccount': 'Cette personne a déjà un compte.',
  'act.theyAccountManageTheirOwn': 'Cette personne a un compte et gère son propre profil.',
  'act.accountNoEmailAddressSend': 'Ce compte n’a pas d’adresse électronique à laquelle envoyer un code.',
  'act.checkBeenClosedSoNo': 'Ce point de contact est clos ; aucune autre demande ne sera envoyée',
  'act.checkBeenClosedIfYou': 
    'Ce point de contact est clos. Si vous avez encore besoin d’aide, '
    + 'contactez directement votre famille.',
  'act.donationReceivedFundsSoIts': 
    'Cette collecte a reçu des fonds ; sa date de début ne peut donc plus '
    + 'changer.',
  'act.electionNotYourPartFamily': 'Cette élection ne concerne pas votre partie de la famille.',
  'act.familyAlreadyPaysMonthlyUse': 
    'Cette famille paie déjà mensuellement. Utilisez Changer de forfait '
    + 'plutôt que de lancer un second abonnement.',
  'act.familyNoMonthlyPlanStop': 'Cette famille n’a aucun forfait mensuel à arrêter.',
  'act.familyNoPaymentHistoryYet': 'Cette famille n’a pas encore d’historique de paiements.',
  'act.familyNoSettingsRecordChange': 'Cette famille n’a pas de fiche de réglages à modifier.',
  'act.familyNotConnectedAccountYet': 'Cette famille n’a pas encore connecté de compte.',
  'act.feePercentOutOfRange': 'Le pourcentage doit être compris entre 0 % et 50 %.',
  'act.feeFixedOutOfRange': 'Le montant fixe doit être compris entre $0.00 et $10.00.',
  'act.couldNotSaveFeePolicy': 'Enregistrement impossible. Veuillez réessayer.',
  'act.feePolicySaved': 'Enregistré.',
  'act.familyNotConnectedAccount': 'Cette famille n’a pas connecté de compte.',
  'act.familyAlreadyRemovedNoSettings': 
    'Cette famille est déjà supprimée, ou n’a pas de fiche de réglages à '
    + 'supprimer.',
  'act.familyNotSetUpTake': 
    'Cette famille n’est pas encore configurée pour accepter les paiements '
    + 'par carte.',
  'act.familyPaidPlanChangeFrom': 
    'Cette famille est sur un forfait payant. Modifiez-le depuis la section '
    + 'Facturation des Réglages, pour que le paiement suive le forfait.',
  'act.familyPaysMonthlyCancelMonthly': 
    'Cette famille paie mensuellement. Annulez d’abord le forfait mensuel, '
    + 'puis payez à l’avance à partir de la prochaine période.',
  'act.featureNotCurrentlyAvailable': 'Cette fonctionnalité n’est pas disponible actuellement.',
  'act.gatheringBeenCancelledSoIts': 
    'Ce rassemblement a été annulé ; ses tâches ne sont donc plus collectées. '
    + 'Demandez à un organisateur si ce n’est pas exact.',
  'act.invitationCreatedBeforeWeStarted': 
    'Cette invitation a été créée avant que nous n’enregistrions les noms. '
    + 'Annulez-la et envoyez-en une nouvelle à la place.',
  'act.lastOwnerMakeSomebodyElse': 
    'C’est le dernier propriétaire. Nommez d’abord quelqu’un d’autre '
    + 'propriétaire, sinon personne ne pourra accorder l’accès au personnel.',
  'act.meetingClosed': 'Cette réunion est close.',
  'act.meetingClosedReopenChangeMinutes': 'Cette réunion est close. Rouvrez-la pour modifier le procès-verbal.',
  'act.sendNotFinishedStopFirst': 'Cet envoi n’est pas terminé. Arrêtez-le d’abord, puis supprimez-le.',
  'act.taskCannotAnsweredVersion': 'Cette tâche ne peut pas être traitée dans cette version',
  'act.taskAlreadyBeenApprovedApproved': 
    'Cette tâche a déjà été approuvée, et une réponse approuvée est '
    + 'définitive. Demandez à un organisateur de la rouvrir si elle doit '
    + 'changer.',
  'act.taskAssignedSomebodyElse': 'Cette tâche est confiée à quelqu’un d’autre',
  'act.titleMessageRequired': 'Le titre et le message sont requis',
  'act.tooFewDaysLeftMonth': 
    'Il reste trop peu de jours ce mois-ci pour lancer un forfait mensuel '
    + 'aujourd’hui. Choisissez l’option qui couvre ce mois et le suivant.',
  'act.tooManyAttemptsWaitMinute': 'Trop de tentatives. Attendez une minute et réessayez.',
  'act.tooManyFamiliesCreatedJust': 'Trop de familles créées à l’instant. Attendez une minute et réessayez.',
  'act.topicNotFound': 'Point à l’ordre du jour introuvable',
  'act.turnedOffYourFamilyWill': 'Désactivé. Votre famille ne vous enverra pas de SMS.',
  'act.weCouldNotReadFamily': 
    'Nous n’avons pas pu lire la liste de la famille pour le moment. Rien n’a '
    + 'été envoyé.',
  'act.weWillStopAskingYou': 
    'Nous cesserons de vous le demander. Vous pouvez passer à un forfait '
    + 'payant quand vous le souhaitez.',
  'act.writeSomethingFirst': 'Écrivez d’abord quelque chose',
  'act.writeSomethingFirst2': 'Écrivez d’abord quelque chose.',
  'act.writeSomethingSend': 'Écrivez quelque chose à envoyer',
  'act.youAlreadyAccountAddressSign': 
    'Vous avez déjà un compte avec cette adresse. Connectez-vous et cette '
    + 'invitation vous attendra.',
  'act.youNotMemberFamily': 'Vous n’êtes pas membre de cette famille.',
  'act.youNotCheck': 'Vous ne figurez pas sur ce point de contact',
  'act.youCannotChangeYourOwn': 
    'Vous ne pouvez pas modifier votre propre accès au personnel. Demandez-le '
    + 'à un autre propriétaire.',
  'act.youDoNotBelongFamily': 'Vous n’appartenez encore à aucune famille.',
  'act.youDoNotPermissionCopy': 
    'Vous n’avez pas l’autorisation de copier ce qu’accorde un modèle. Créez '
    + 'plutôt un modèle vierge.',
  'act.youDoNotPermissionManage': 'Vous n’avez pas l’autorisation de gérer les accès.',
  'act.notPermissionDeleteTemplates':
    'Vous n’avez pas l’autorisation de supprimer des modèles.',
  'act.notPermissionChangePermissionTemplates':
    'Vous n’avez pas l’autorisation de modifier les modèles d’autorisations.',
  'act.youDoNotPermissionReverse': 'Vous n’avez pas l’autorisation d’annuler des paiements.',
  'act.youAlreadyNominatedThemPosition': 'Vous l’avez déjà proposé pour ce poste.',
  'act.youDeclinedDueOptBack': 
    'Vous avez refusé cette cotisation. Acceptez-la de nouveau avant de '
    + 'mettre en place des paiements automatiques.',
  'act.youNoMemberRecordFamily': 'Vous n’avez pas de fiche de membre dans cette famille.',
  'act.youRepliedStopTextFrom': 
    'Vous avez répondu STOP à un de nos SMS ; nous ne pouvons donc pas les '
    + 'réactiver d’ici. Envoyez START au numéro qui vous a écrit.',
  'act.yourAnswerSavedButTask': 
    'Votre réponse a été enregistrée mais la tâche n’a pas pu passer en '
    + 'révision. Réessayez.',
  'act.yourChapterSavedButYour': 
    'Votre chapitre a été enregistré, mais vos enfants de moins de 18 ans '
    + 'sans compte propre n’ont pas pu être déplacés avec vous. Demandez à un '
    + 'administrateur de définir leur chapitre depuis Membres et accès.',
  'act.yourCurrentRecordAlreadyFamily': 
    'Votre fiche actuelle comporte déjà des liens familiaux. Contactez un '
    + 'administrateur pour les fusionner.',
  'act.yourEmailAddressAlreadyConfirmed': 'Votre adresse électronique est déjà confirmée.',
  'act.yourMembershipAwaitingApproval': 'Votre adhésion est en attente d’approbation.',

  // Les textes propres au tableau de bord. Voir la version anglaise pour le raisonnement.
  'auth.alreadyAccount': 'Vous avez déjà un compte',
  'auth.signAccept': 'Connectez-vous pour accepter',
  'auth.linkNoLongerValid': 'Ce lien n’est plus valable',
  'auth.resetLinksWorkOnce': 
    'Les liens de réinitialisation ne fonctionnent qu’une fois et expirent au '
    + 'bout d’une heure. Demandez-en un nouveau et il arrivera dans un instant.',
  'auth.sendMeNewLink': 'Envoyez-moi un nouveau lien',
  'acct.noneSectionsSummaryBeen': 
    'Aucune des sections du Récapitulatif ne vous a été ouverte. Demandez à '
    + 'un administrateur l’accès à celles dont vous avez besoin : vos '
    + 'cotisations, les collectes, votre historique de paiements et les caisses '
    + 'de la famille s’accordent séparément.',
  'acct.seeAllDues': 'Voir toutes vos cotisations',
  'acct.seeFullPaymentHistory': 'Voir tout votre historique de paiements',
  'acct.openDonationDrives': 'Collectes en cours',
  'acct.allDrives': 'Toutes les collectes',
  'acct.seeDonations': 'voir Dons',
  'adm.backElections': 'Retour aux Élections',
  'adm.weCouldNotLoad': 
    'Nous n’avons pas pu charger les informations de cette famille. Réessayez '
    + 'dans un instant.',
  'comm.unableLoadChat': 'Impossible de charger la messagerie',
  'comm.makeSureChatMigration': 
    'Vérifiez que la migration de la messagerie a bien été appliquée dans '
    + 'votre projet Supabase.',
  'comm.familyTree': 'Arbre généalogique',
  'comm.noElectionsPartFamily': 'Aucune élection pour votre partie de la famille pour l’instant.',
  'comm.backElections': 'Retour aux Élections',
  'comm.noVotesCast': 'Aucun vote exprimé.',
  'comm.allAlbums': 'Tous les albums',
  'shell.somethingWentWrong': 'Quelque chose s’est mal passé',
  'shell.weCouldnTLoad': 
    'Nous n’avons pas pu charger cette page. C’est généralement temporaire — '
    + 'réessayez.',
  'shell.tryAgain': 'Réessayer',
  'shell.backDashboard': 'Retour au tableau de bord',
  'gath.backGatherings': 'Retour aux Rassemblements',
  'hlp.creatingJoiningFamily': 'Créer une famille ou en rejoindre une',
  'hlp.allHelp': 'Toute l’aide',
  'hlp.page': 'Sur cette page',
  'hlp.moreManual': 'Plus du manuel',
  'lib.allMeetings': 'Toutes les réunions',
  'lib.officerSJournalMembers': 
    'Le carnet d’une fonction est réservé aux membres qui occupent une '
    + 'fonction, et vous n’en occupez pas encore.',
  'lib.everyOfficeFamilyNotebook': 
    'Chaque fonction de la famille a son propre carnet : ce qu’un trésorier a '
    + 'compris de la banque, ce qu’un responsable des événements a appris de la '
    + 'salle. Il appartient à la fonction et non à la personne, il reste donc '
    + 'là pour la personne suivante.',
  'lib.membersAccessBoardPositions': 'Membres et accès › Postes du conseil',
  'shell.loading': 'Chargement…',
  'shell.pageNotFound': 'Page introuvable',
  'shell.pageReLookingDoesn': 'La page que vous cherchez n’existe pas ou a peut-être été déplacée.',
  'prof.requestJoin': 'Votre demande pour rejoindre',
  'prof.membership': 'Votre adhésion à',
  'rep.everyOffice': 'Toutes les fonctions',
  'rep.everyBoardPositionFamily': 
    'Tous les postes du conseil dans l’ordre propre à la famille, avec qui '
    + 'les occupe.',
  'rep.held': 'Occupé par',
  'rep.holdingMoreThanOne': 'Occupe plus d’une fonction',
  'rep.notProblemItselfSmall': 
    'Ce n’est pas un problème en soi : dans un petit chapitre, une même '
    + 'personne fait souvent deux métiers. C’est ici parce que c’est '
    + 'généralement le signe d’un manque que quelqu’un a discrètement comblé.',
  'rep.wearingTwoHats': 'Deux casquettes',
  'rep.everyPublishedElectionIts': 
    'Toutes les élections publiées avec leur phase, leurs candidatures et '
    + 'leur participation.',
  'rep.turnoutCountsPeopleNot': 
    'La participation compte des PERSONNES et non des bulletins : quelqu’un '
    + 'qui vote pour trois postes dans une élection est un votant. Une élection '
    + 'dont la zone ne compte aucun membre approuvé se lit',
  'rep.officesNobodyStood': 'Postes pour lesquels personne ne s’est présenté',
  'rep.membersWhoVoted': 'Membres ayant voté',
  'rep.everyGatheringItsTask': 
    'Tous les rassemblements avec l’avancement de leurs tâches et, là où '
    + 'c’est indiqué, leur budget.',
  'rep.taskCountsOverdueWhen': 
    'Une tâche est en retard lorsque sa date est passée et que personne ne '
    + 'l’a approuvée ; une tâche envoyée et pas encore tranchée reste en '
    + 'attente.',
  'rep.tasksApproved': 'Tâches approuvées',
  'rep.nobodyHolding': 'Personne ne l’occupe',
  'rep.everyMeeting': 'Toutes les réunions',
  'rep.everyMeetingMostRecent': 
    'Toutes les réunions, la plus récente d’abord, avec la taille de la '
    + 'salle, les points et les votes.',
  'rep.minutes': 'Procès-verbal de',
  'rep.room': 'Dans la salle',
  'rep.whoTakesPart': 'Qui participe',
  'rep.everyRelativeWhoBeen': 
    'Chaque proche convié à une réunion, avec le nombre de réunions '
    + 'auxquelles il a été convié, celles où il a voté et celles dont il a '
    + 'rédigé le procès-verbal.',
  'rep.asked': 'Convié à',
  'rep.voted': 'A voté à',
  'rep.votesCast': 'Votes exprimés',
  'stf.staffConsole': 'Console du personnel',
  'stf.readsAcrossEveryFamily': 'Lit toutes les familles de la plateforme',
  'stf.pageNotFound': 'Page introuvable',
  'stf.thereNothingAddress': 'Il n’y a rien à cette adresse.',
  'stf.everybodyWhoCanOpen': 
    'Toutes les personnes qui peuvent ouvrir cette console, et le type '
    + 'd’accès qu’elles ont. Seul un propriétaire peut voir cette page ou y '
    + 'changer quoi que ce soit ; tous les autres reçoivent un 404, la même '
    + 'réponse que la console donne à un client. Le tout premier propriétaire '
    + 'sur une base de données neuve vient toujours de',
  'shell.everyoneFamily': 'Tout le monde dans cette famille',
  'inv.invitationNotValid': 'Cette invitation n’est pas valable',
  'inv.mayExpiredBeenCancelled': 
    'Elle a peut-être expiré, été annulée, ou déjà été utilisée. Demandez à '
    + 'qui vous a invité de vous en envoyer une nouvelle.',
  'inv.goSign': 'Aller à la connexion',
  'inv.signAccept': 'Connectez-vous pour accepter',
  'inv.createAccount': 'Créer un compte',
  'inv.sign': 'Se connecter',
  'inv.invitationDifferentAddress': 'Cette invitation concerne une autre adresse',
  'inv.goDashboard': 'Aller à votre tableau de bord',
  'inv.couldNotAcceptInvitation': 'Cette invitation n’a pas pu être acceptée',
  'ui.familyNotConnectedCard': 
    'Votre famille n’a pas encore connecté de processeur de cartes, les '
    + 'collectes ne peuvent donc pas recevoir de dons en ligne. Remettez votre '
    + 'don à qui tient les comptes et il apparaîtra ici dès qu’il sera '
    + 'enregistré.',
  'ui.onePaymentItemizedDue': 
    'Un seul paiement, détaillé par cotisation. Il s’inscrit dans les comptes '
    + 'de la famille dès qu’il est encaissé — il n’y a rien à saisir après.',
  'ui.familyNotConnectedCard2': 
    'Votre famille n’a pas encore connecté de processeur de cartes. Payez par '
    + 'le moyen que votre famille utilise déjà et cela apparaîtra ici dès qu’un '
    + 'administrateur l’enregistrera.',
  'adm.howFamilyDividesItself': 
    'Comment la famille se répartit géographiquement. Un chapitre appartient '
    + 'à une région, ou relève de National — là où tout commence et où reste un '
    + 'membre sans chapitre. Les cotisations peuvent être limitées à une région '
    + 'ou à un chapitre dans',
  'adm.nothingSetHereFeature': 
    'Rien à régler ici — cette fonctionnalité est soit toujours disponible, '
    + 'soit régie par les lignes ci-dessus.',
  'adm.canOpenAccountingBut': 
    'Vous pouvez ouvrir la Comptabilité, mais aucune de ses sections ne vous '
    + 'a été ouverte. Demandez à un administrateur l’accès aux domaines dont '
    + 'vous avez besoin : cotisations, dons, caisses, répartition, jalons et '
    + 'réglages de paiement s’accordent séparément.',
  'adm.accountDuesDepositedInto': 
    'Le compte sur lequel les cotisations sont versées, et depuis lequel les '
    + 'versements et les frais d’événements sont payés, sera enregistré ici — '
    + 'pour ne pas avoir à chercher ailleurs les numéros d’un chèque ou d’un '
    + 'virement.',
  'adm.notYetAvailableAccount': 
    'Pas encore disponible. Les coordonnées bancaires exigent un stockage '
    + 'chiffré et une autorisation plus étroite que la Comptabilité avant de '
    + 'pouvoir être conservées ici.',
  'adm.notYetAcceptedCancelling': 
    'Pas encore acceptée. En annuler une rend le lien inopérant — utile si '
    + 'elle est partie à la mauvaise adresse, puisque seule cette adresse peut '
    + 'l’utiliser.',
  'adm.theyAlreadyAccountBut': 
    'Cette personne a déjà un compte mais n’a jamais confirmé son adresse '
    + 'électronique ; elle n’aurait donc pas pu se connecter pour accepter. '
    + 'Nous avons aussi demandé le renvoi du courriel de confirmation — c’est '
    + 'celui-là qu’elle doit ouvrir d’abord.',
  'adm.theirAccountConfirmedSo': 
    'Son compte est confirmé, le lien la mènera donc directement à la '
    + 'connexion puis à l’adhésion.',
  'adm.thereNoAccountAddress': 
    'Il n’y a pas encore de compte pour cette adresse ; le lien la mènera '
    + 'donc à en créer un. Le code de famille ne lui sera pas nécessaire.',
  'adm.weCouldNotCheck': 
    'Nous n’avons pas pu vérifier si cette adresse a un compte ; si cette '
    + 'personne ne parvient toujours pas à entrer, il vaut la peine de lui '
    + 'demander si elle a jamais confirmé son adresse.',
  'adm.keptRatherThanDeleted': 
    'Conservé plutôt que supprimé, pour que la trace de la décision subsiste. '
    + 'Vous pouvez finalement admettre quelqu’un, et n’importe quel membre peut '
    + 'lui envoyer une nouvelle invitation.',
  'adm.onlyPartFamilyCan': 
    'Seule cette partie de la famille peut voir l’élection, être proposée ou '
    + 'voter — et elle ne peut pourvoir que des fonctions enregistrées au même '
    + 'niveau.',
  'adm.bothDaysCountNominations': 
    'Les deux jours comptent — les candidatures sont ouvertes du premier au '
    + 'dernier, sauf si le vote s’ouvre le jour de clôture, auquel cas elles se '
    + 'ferment à son ouverture. La date de clôture ne peut pas être antérieure '
    + 'au lendemain de l’ouverture.',
  'adm.votingMayOpenSame': 
    'Le vote peut s’ouvrir le jour même où les candidatures se ferment, et ce '
    + 'jour appartient alors au vote. Il ne peut pas s’ouvrir avant.',
  'adm.whatFundToppedUp': 
    'Le montant jusqu’auquel cette caisse est complétée avant qu’une caisse '
    + 'en dessous ne reçoive quoi que ce soit. Vous pouvez le modifier, ainsi '
    + 'que l’ordre de remplissage, dans Caisses → Répartition.',
  'adm.milestoneAwardedOutFund': 
    'Un jalon est attribué sur une caisse, et il n’y en a aucune. Ajoutez '
    + 'd’abord une caisse dans Caisses → Soldes.',
  'adm.setShareEachDues': 
    'Fixez la part de chaque paiement de cotisation qui va à chaque caisse. '
    + 'Les caisses les plus hautes dans la liste se remplissent d’abord ; une '
    + 'caisse sous son minimum est complétée avant que les suivantes ne '
    + 'reçoivent quoi que ce soit.',
  'adm.statusStatementRatherThan': 
    'L’état est une affirmation et non un calcul du calendrier : un '
    + 'rassemblement peut être annulé sans que ses dates bougent, et Terminé '
    + 'est votre mot pour le dire.',
  'adm.severalGatheringsMayFlagged': 
    'Plusieurs rassemblements peuvent être signalés en même temps — le '
    + 'tableau de bord montre le plus proche qui n’est pas encore terminé, de '
    + 'sorte que la réunion de l’an dernier ne bloque jamais celle de cette '
    + 'année. Rien n’y apparaît lorsqu’aucun rassemblement signalé n’est encore '
    + 'à venir.',
  'adm.onePhotographCroppedBand': 
    'Une photographie, recadrée à la forme du bandeau. Sans elle, le bandeau '
    + 'dessine l’arbre GENORRA. Quiconque a le lien peut voir une photo '
    + 'téléversée, comme une photo de famille — elle est donc publiée pour '
    + 'toute personne à qui elle est partagée.',
  'adm.budgetAlwaysDrawnFund': 
    'Un budget est toujours prélevé sur une caisse, et il peut dépasser ce '
    + 'que cette caisse contient — les chiffres le disent plutôt que de le '
    + 'refuser, parce qu’une famille planifie une réunion avant d’avoir réuni '
    + 'l’argent.',
  'adm.gatheringMadePartsEach': 
    'Un rassemblement est fait de parties, et chacune est une occasion en soi '
    + ': une réunion de famille, c’est l’Accueil, le Pique-nique et les Adieux, '
    + 'à leurs propres dates et dans leurs propres lieux. Chaque modèle que '
    + 'vous ajoutez est l’une d’elles, et ses étapes deviennent ici des tâches. '
    + 'Rien du modèle n’atteint les tâches déjà présentes sur ce rassemblement '
    + '— chacune garde sa propre copie de ce qu’elle demandait.',
  'adm.bothOptionalLeaveDay': 
    'Les deux sont facultatifs. Laissez la date vide pour un rassemblement '
    + 'qui a lieu d’un seul coup, et le lieu vide pour utiliser celui que le '
    + 'modèle utilise d’habitude.',
  'adm.whatOneTaskExpected': 
    'Ce que cette tâche est censée coûter. Vide signifie qu’elle ne coûte '
    + 'rien à la famille. Les lignes réunies sont ce que le bandeau ci-dessus '
    + 'compare au budget.',
  'adm.photoCurrentlyDashboardBand': 'La photo actuellement sur le bandeau du tableau de bord',
  'adm.nothingWaitingReviewTask': 
    'Rien n’attend d’être examiné. Une tâche apparaît ici dès que le proche à '
    + 'qui elle a été confiée envoie une réponse.',
  'adm.templateChecklistHandedOut': 
    'Un modèle est une liste d’étapes distribuée sous forme de tâches — '
    + 'quelqu’un pouvant créer des modèles doit ajouter le premier.',
  'adm.budgetAlwaysDrawnFund2': 
    'Un budget est toujours prélevé sur une caisse. Il peut dépasser ce que '
    + 'la caisse contient — le rassemblement le dit en rouge plutôt que de le '
    + 'refuser.',
  'adm.severalGatheringsMayFlagged2': 
    'Plusieurs rassemblements peuvent être signalés en même temps — le '
    + 'tableau de bord montre le plus proche qui n’est pas terminé, de sorte '
    + 'que la réunion de l’an dernier ne bloque jamais celle de cette année.',
  'adm.everyStepTemplateBecomes': 
    'Chaque étape de ce modèle devient ici une tâche à part entière, dans son '
    + 'propre ordre, à cet endroit de la liste. Personne ne répond à cette '
    + 'étape — c’est la liste, pas une question. Un modèle ne peut pas '
    + 's’inclure lui-même, ni rien qui y ramène.',
  'adm.startingFigureCopiedOnto': 
    'Un montant de départ recopié sur la tâche. Un organisateur peut le '
    + 'modifier sur le rassemblement, et l’argent qui compte est le budget '
    + 'propre du rassemblement.',
  'adm.onePerThingSomebody': 
    'Une par chose que quelqu’un doit faire ou décider, dans l’ordre où elles '
    + 'seront distribuées. Elles sont recopiées sur les tâches de chaque '
    + 'rassemblement programmé à partir de ce modèle ; en modifier une ici ne '
    + 'change donc jamais un rassemblement déjà en cours.',
  'adm.whatEachMemberEncouraged': 
    'Le montant que chaque membre est encouragé à atteindre. Indicatif — les '
    + 'membres donnent ce qu’ils veulent et peuvent aller au-delà.',
  'adm.driveMembersCanGive': 
    'Une collecte à laquelle les membres peuvent donner entre deux dates. '
    + 'Personne ne la doit, et elle ne compte jamais contre le solde d’un '
    + 'membre.',
  'adm.groupChaptersTexasEastern': 
    'Un groupe de chapitres — « Texas », « Est », « Sud-Est ». Facultatif : '
    + 'une famille peut fonctionner avec les chapitres seuls, ou sans ni l’un '
    + 'ni l’autre.',
  'adm.noChaptersYetUntil': 
    'Aucun chapitre pour l’instant. Jusqu’à ce qu’il y en ait, chaque membre '
    + 'relève de National et ne doit que les cotisations de toute la famille.',
  'adm.chapterSRegionDecides': 
    'La région d’un chapitre détermine quelles cotisations régionales ses '
    + 'membres doivent. Vous pouvez déplacer un chapitre vers une autre région '
    + 'à tout moment depuis',
  'adm.billingCouldNotLoaded': 
    'La facturation n’a pas pu être chargée. Rechargez la page — ne lancez '
    + 'pas de nouveau paiement dans l’onglet Forfait avant qu’elle '
    + 'n’apparaisse, au cas où cette famille en aurait déjà un.',
  'adm.termEndedPayAgain': 
    'Cette période est terminée. Payez de nouveau dans l’onglet Forfait pour '
    + 'réouvrir les pages qu’elle couvrait — tous les enregistrements sont '
    + 'toujours là.',
  'adm.stripeSOwnPortal': 
    'Le portail de Stripe lui-même, où la carte enregistrée se change et où '
    + 'chaque facture peut être téléchargée.',
  'adm.canSeeWhatFamily': 
    'Vous pouvez voir ce que paie cette famille mais pas le modifier. '
    + 'Demandez-le à un administrateur ayant accès aux Réglages.',
  'adm.nominationNobodyAnsweredNot': 
    'Une candidature à laquelle personne n’a répondu n’est pas sur le '
    + 'scrutin. Seuls les candidats ayant accepté peuvent recevoir des voix.',
  'adm.whatFamilyCalledEverywhere': 
    'Le nom de cette famille partout dans l’application — le sélecteur, le '
    + 'tableau de bord et les courriels d’invitation. Le changer ne déplace '
    + 'rien d’autre : le code de famille ci-dessous est ce sous quoi chaque '
    + 'enregistrement est classé.',
  'adm.whereFamilyDecidesWhether': 
    'Où se trouve la famille. Cela détermine si un rassemblement est terminé, '
    + 'si une tâche est en retard et quand une élection se clôt — les réponses '
    + 'sur lesquelles tous les membres doivent s’accorder. Cela ne change pas '
    + 'les heures d’un rassemblement, toujours affichées telles qu’elles ont '
    + 'été saisies, ni vos propres dates, qui suivent Mon profil.',
  'adm.canSeePageBut': 
    'Vous pouvez voir cette page mais pas changer le nom. Demandez à un '
    + 'administrateur l’autorisation Réglages.',
  'adm.shareRelativesSoThey': 
    'Partagez ceci avec vos proches pour qu’ils puissent vous rejoindre. '
    + 'Toute personne qui rejoint attend dans Approbation en attente jusqu’à ce '
    + 'que quelqu’un l’admette.',
  'adm.codeCannotChangedFamily': 
    'Le code ne peut pas être changé, et une famille ne peut pas être '
    + 'supprimée. Chaque enregistrement de la famille — cotisations, caisses, '
    + 'événements, messagerie, membres — est classé sous ce code, et rien dans '
    + 'la base de données ne pointe en sens inverse : le changer laisserait '
    + 'donc la famille sans rien de sa propre histoire.',
  'adm.switchesFamilyOffEverybody': 
    'Désactive la famille pour tous ses membres. Personne ne peut l’ouvrir, '
    + 'le code de famille cesse de fonctionner, et les invitations en cours '
    + 'cessent d’être acceptées.',
  'adm.familyNotSetUp': 
    'Votre famille n’a encore défini aucun poste de conseil. Ajoutez-les dans '
    + 'Membres et accès → Organisation, puis revenez.',
  'adm.cannotSeeSetMember': 
    'Vous ne pouvez ni voir ni définir le mot de passe de ce membre. '
    + 'Envoyez-lui un lien et il en choisira un nouveau lui-même ; l’actuel '
    + 'continue de fonctionner jusque-là.',
  'adm.billingStartsWhenTerm': 
    'La facturation commence à la fin de la période que vous avez déjà payée. '
    + 'Rien n’est prélevé aujourd’hui.',
  'adm.canSeePlanBut': 
    'Vous pouvez voir le forfait mais pas le modifier. Demandez à un '
    + 'administrateur l’autorisation Réglages.',
  'adm.refreshPageIfKeeps': 
    'Rechargez la page. Si cela persiste, n’essayez pas de connecter un '
    + 'compte — demandez à un administrateur de vérifier, car la famille en a '
    + 'peut-être déjà un.',
  'adm.duesRecordedHandFrom': 
    'Les cotisations sont saisies à la main depuis les registres des '
    + 'Transactions en attendant, et chaque paiement déjà enregistré reste '
    + 'exactement où il est.',
  'adm.anyRecurringPaymentsRunning': 
    'Les paiements récurrents en cours ont été annulés chez Stripe lors de la '
    + 'déconnexion. Ceux-là ne peuvent pas être relancés — chacun de ces '
    + 'proches devra reconfigurer son paiement après votre reconnexion.',
  'adm.accountBelongsFamilyNot': 
    'Le compte appartient à la famille, pas à GENORRA. L’argent va '
    + 'directement à la banque de la famille, les frais de Stripe sortent du '
    + 'côté de la famille, et la famille garde son propre tableau de bord '
    + 'Stripe. GENORRA ne voit ni ne conserve jamais de clé Stripe et ne prend '
    + 'aucune part de ce que la famille encaisse.',
  'adm.canSeeSectionBut': 
    'Vous pouvez voir cette section mais pas la modifier. Demandez à un '
    + 'administrateur ayant accès aux réglages de paiement de connecter un '
    + 'compte.',
  'ui.optionalLeaveEmptyPin': 
    'Facultatif. Laissez vide pour épingler jusqu’à ce que quelqu’un le '
    + 'retire. Chaque membre peut l’écarter de ses propres actualités quand il '
    + 'le souhaite.',
  'ui.willSeeMessageWhichever': 
    'Vous verrez ce message quelle que soit l’adresse saisie. Nous ne disons '
    + 'pas si un compte existe, car le code de famille nécessaire pour '
    + 'atteindre ce site est fait pour être partagé — et un formulaire qui '
    + 'répondrait permettrait à quiconque en détient un de savoir lesquels de '
    + 'vos proches se sont inscrits.',
  'ui.checkSpamFolderFirst': 
    'Regardez d’abord dans les courriers indésirables, puis essayez l’adresse '
    + 'avec laquelle vous vous êtes inscrit plutôt que celle par laquelle votre '
    + 'famille vous joint d’habitude. Le lien fonctionne une fois et expire : '
    + 'demandez-en un nouveau plutôt que de réutiliser un ancien courriel.',
  'ui.accountConfirmedBeforeCan': 
    'Un compte doit être confirmé avant de pouvoir se connecter. Nous avons '
    + 'envoyé un lien à l’inscription — regardez d’abord dans les courriers '
    + 'indésirables, et utilisez le message le plus récent : chaque lien '
    + 'fonctionne une fois et expire au bout d’une heure.',
  'ui.pickSomethingNotUsed': 
    'Choisissez quelque chose que vous n’avez jamais utilisé ici. Vous serez '
    + 'connecté dès l’enregistrement.',
  'ui.wholeWordsPhrasesLeading': 
    'Des mots et des expressions entiers ; un moins devant en exclut un. Cela '
    + 'n’atteint l’intérieur d’un document que là où le texte a pu être lu — '
    + 'voyez le badge sur chaque article.',
  'ui.pastingTextWhatMakes': 
    'Coller le texte est ce qui rend un article cherchable mot à mot. Un PDF '
    + 'ou un fichier Word est conservé et téléchargeable, mais son contenu '
    + 'n’est pas encore lu.',
  'ui.familySRecordsNever': 
    'Les registres de votre famille ne sont jamais partagés — ni noms, ni '
    + 'liens de parenté, ni dates de naissance, ni photographies, ni messages.',
  'dash.familyMemberMayAlready': 
    'Un membre de la famille vous a peut-être déjà ajouté. Trouvez-vous '
    + 'ci-dessous et liez votre compte à la fiche existante.',
  'dash.familyMembers': 'Membres de la famille',
  'dash.pendingApproval': 'Approbation en attente',
  'dash.upcomingGatherings': 'Prochains rassemblements',
  'dash.addMember': 'Ajouter un membre',
  'dash.recordPayment': 'Enregistrer un paiement',
  'dash.sendMessage': 'Envoyer un message',
  'dash.myTasks': 'Mes tâches',
  'dist.emailEveryoneFamilyOnce': 
    'Écrivez à toute la famille d’un coup. La liste des destinataires est '
    + 'votre propre composition familiale — il n’y a rien à tenir à jour, et '
    + 'personne n’y figure deux fois.',
  'dist.newDistribution': 'Nouvel envoi',
  'dist.canLeavePageSend': 'Vous pouvez quitter cette page — l’envoi se poursuit là où il en était.',
  'dist.weCouldNotRead': 
    'Nous n’avons pas pu lire vos envois pour le moment. Rien n’a été perdu — '
    + 'réessayez dans un instant.',
  'dist.sent': 'Envoyé à',
  'dist.sent2': 'Envoyé par',
  'dist.tryAgain': 'Réessayer',
  'dist.whoGoes': 'À qui cela va',
  'dist.plainTextLeaveBlank': 
    'Texte brut. Laissez une ligne vide entre les paragraphes. Les réponses '
    + 'reviennent à votre propre adresse électronique, pas à GENORRA.',
  'dist.loading': 'Chargement…',
  'dist.whatSent': 'Ce qui a été envoyé',
  'dist.whoWent': 'À qui cela est parti',
  'dist.reunionDetails4th': 'Détails de la réunion du 4',
  'dist.waitingSend': 'En attente d’envoi',
  'dist.couldNotDelivered': 'N’a pas pu être livré',
  'dist.noEmailAddressFile': 'Aucune adresse électronique au dossier',
  'dist.sharesAddress': 'Partage une adresse',
  'dist.notSentStopped': 'Non envoyé — arrêté',
  'dist.emailsSentBeenSent':
    'Les courriels envoyés sont envoyés. Ceci supprime la trace de qui a été contacté et de '
    + 'ce qu’il est advenu de chaque message, et c’est irréversible.',
  'dues.schedule': 'Par barème',
  'dues.noDuesSchedulesActive': 
    'Aucun barème de cotisations n’est actif, il n’y a donc rien à projeter. '
    + 'Ajoutez-en un dans Comptabilité → Cotisations.',
  'dues.member': 'Par membre',
  'dues.onlyThoseWhoOwe': 'Seulement ceux qui la doivent',
  'dues.nobodyFamilyBeenApproved': 
    'Personne dans la famille n’a encore été approuvé, il n’y a donc rien à '
    + 'projeter.',
  'dues.noMembersMatchFilter': 'Aucun membre ne correspond à ce filtre.',
  'dues.eachScheduleMeasuredOver': 
    'Chaque barème est mesuré sur sa propre année ; les totaux en sont donc '
    + 'la somme',
  'dues.filterName': 'Filtrer par nom…',
  'dues.filterMembers': 'Filtrer les membres',
  'dues.onlyMembersDescendedFrom': 'Seuls les membres descendant de la lignée de la famille la doivent.',
  'dues.onlyMembersPartFamily': 
    'Seuls les membres de cette partie de la famille doivent cette '
    + 'cotisation. Un membre sans chapitre relève de National et ne doit rien '
    + 'de local.',
  'dues.nothingPaid': 'Rien de payé',
  'dues.partPaid': 'Partiellement payé',
  'dues.notYetDue': 'Pas encore dû',
  'dues.notTheirs': 'Ne le concerne pas',
  'dues.pendingInvite': 'Invitation en attente',
  'ui.putRelativeForwardAny': 
    'Proposez un proche pour n’importe quel poste ci-dessous, ou '
    + 'présentez-vous vous-même. Vous pouvez retirer votre propre nom d’une '
    + 'candidature tant que les candidatures sont ouvertes.',
  'ui.standingOfficeYourselfNeeds': 
    'Se présenter soi-même à un poste ne demande l’accord de personne '
    + 'd’autre, et compte comme accepté immédiatement.',
  'ui.theyGoTreeStraight': 
    'Cette personne entre aussitôt dans l’arbre. Nous lui enverrons une '
    + 'invitation par courriel et, quand elle l’acceptera, son compte rejoindra',
  'ui.duesCanStartAge': 
    'Les cotisations peuvent commencer à un âge donné. Sans date de '
    + 'naissance, nous ne pouvons pas savoir quand cet enfant commence à les '
    + 'devoir, et il serait facturé comme un adulte.',
  'ui.shouldRareWeGenerate': 
    'Cela devrait être rare. Nous générons une adresse pour que la fiche '
    + 'puisse exister et nous n’y envoyons jamais rien — cette personne ne peut '
    + 'donc pas se connecter et rien ne lui parviendra. Si elle pourrait un '
    + 'jour vouloir un compte, invitez-la plutôt.',
  'ui.siblingsSharePersonS': 
    'Les frères et sœurs partagent la génération de cette personne ; ils sont '
    + 'donc listés ici plutôt que dessinés dans la rangée du dessus.',
  'ui.decidesWhetherTheyFill': 
    'Cela détermine si cette personne occupe la place du père ou celle de la '
    + 'mère, et nous permet de nommer le lien en retour vers elle.',
  'ui.gotEmailAddressNow': 
    'Une adresse électronique désormais ? Envoyez-lui une invitation. Quand '
    + 'elle l’acceptera, son compte rejoindra',
  'gath.budgetGatheringCouldNot': 
    'Le budget de ce rassemblement n’a pas pu être lu pour le moment. Rien '
    + 'n’a changé — rechargez la page pour réessayer.',
  'gath.noTasksYetGathering': 
    'Aucune tâche pour l’instant. Les tâches d’un rassemblement viennent des '
    + 'modèles dont il a été construit ; un organisateur qui ajoute ici un '
    + 'modèle ajoute donc ses travaux à cette liste.',
  'gath.everyStepEveryTemplate': 
    'Chaque étape de chaque modèle que vous choisissez devient une tâche de '
    + 'ce rassemblement, prête à être distribuée. N’en choisissez aucun et ceci '
    + 'est une date au calendrier de la famille sans aucune tâche — un '
    + 'organisateur pourra l’étoffer plus tard.',
  'gath.nothingAssignedMomentWhen': 
    'Rien ne vous est confié pour le moment. Quand un organisateur vous '
    + 'confiera une partie d’un rassemblement, cela apparaîtra ici avec ce '
    + 'qu’il faut renvoyer et pour quand.',
  'gath.runsOverMoreThan': 'S’étend sur plus d’une journée',
  'gath.startTime': 'Heure de début',
  'gath.optional': 'Facultatif.',
  'gath.leaveEmptyIfAll': 'Laissez vide si tout se passe le même jour.',
  'gath.endTime': 'Heure de fin',
  'gath.addAnotherDay': 'Ajouter une autre journée',
  'gath.chooseTimezone': 'Choisissez un fuseau horaire…',
  'gath.everyoneSeesTimeExactly': 
    'Chacun voit l’heure exactement telle que vous l’avez saisie, avec ce '
    + 'fuseau horaire nommé à côté. Rien n’est converti.',
  'ui.weLlEmailThem': 
    'Nous lui enverrons une invitation par courriel. Seule cette adresse peut '
    + 'l’utiliser, et elle expire dans 14 jours. Le nom est ce que votre '
    + 'famille voit pendant qu’elle attend d’être admise.',
  'ui.invitationCreatedButWe': 
    'L’invitation a été créée, mais nous n’avons pas pu l’envoyer par '
    + 'courriel. Transmettez-lui plutôt ce lien — il fonctionne exactement de '
    + 'la même façon.',
  'ui.treatLikePasswordAnyone': 
    'Traitez-le comme un mot de passe — quiconque le récupère et dispose de '
    + 'cette adresse électronique peut l’utiliser. Il n’est affiché qu’une '
    + 'fois.',
  'shell.anythingTypedNotSaved': 
    'Tout ce que vous avez saisi sans l’enregistrer sera perdu : terminez ou '
    + 'continuez maintenant.',
  'shell.iMStillHere': 'Je suis toujours là',
  'shell.stillThere': 'Toujours là ?',
  'shell.familyTree': 'Arbre généalogique',
  'shell.meetingMinutes': 'Procès-verbaux',
  'shell.officerNotes': 'Carnets de fonction',
  'shell.duesDonations': 'Cotisations et dons',
  'shell.paymentHistory': 'Historique des paiements',
  'shell.duesProjections': 'Projections de cotisations',
  'shell.pLSummary': 'Résultat de l’exercice',
  'shell.boardOffices': 'Conseil et fonctions',
  'shell.howManual': 'Mode d’emploi',
  'ui.theseMinutesClosedNothing': 
    'Ce procès-verbal est clos. Plus rien ne change au sujet de la réunion — '
    + 'et c’est ce qui en fait le compte rendu.',
  'ui.scheduleOneSayingWhat': 
    'Programez-en une en indiquant de quel genre de réunion il s’agit — toute '
    + 'la famille, un chapitre, un conseil, une même fonction dans toutes les '
    + 'zones, ou seulement les personnes que vous nommez — et chacun dans la '
    + 'salle est averti et la voit à son calendrier. Pendant la réunion, la '
    + 'personne chargée du procès-verbal ajoute un point et écrit des notes en '
    + 'dessous, et peut appeler un vote auquel la salle répond.',
  'ui.everyoneSeesTimeExactly': 
    'Chacun voit l’heure exactement telle que vous l’avez saisie, avec ce '
    + 'fuseau horaire nommé à côté. Rien n’est converti.',
  'ui.administratorFamilySwitchedOff': 
    'Un administrateur de cette famille l’a désactivée. Personne ne peut '
    + 'l’ouvrir, la rejoindre ni accepter une invitation.',
  'ui.everyPaymentFundPhotograph': 
    'Chaque paiement, caisse, photographie, événement, message, document et '
    + 'personne est exactement où il était. Supprimer une famille ferme ses '
    + 'portes ; cela ne détruit aucun enregistrement et n’a touché ni votre '
    + 'compte ni aucune autre famille à laquelle vous appartenez.',
  'ui.onlyGenorraSupportCan': 
    'Seule l’assistance GENORRA peut rétablir une famille — il n’y a de '
    + 'bouton pour cela nulle part dans le produit, volontairement. Si ce '
    + 'n’était pas voulu, demandez à qui administre la famille de contacter '
    + 'l’assistance.',
  'ui.requestBackTheirAdministrators': 
    'Votre demande est de nouveau entre les mains de leurs administrateurs, '
    + 'avec votre note jointe. Ils verront qui l’a refusée auparavant et ce que '
    + 'vous en avez dit.',
  'ui.sayWhoHowRelated': 
    'Dites qui vous êtes et quel est votre lien de parenté, pour que la '
    + 'personne qui examine la demande puisse vous situer. Ceci va aux '
    + 'administrateurs de la famille.',
  'ui.weSentConfirmationLink': 
    'Nous vous avons envoyé un lien de confirmation à votre inscription. '
    + 'Votre demande ne peut pas être approuvée avant que vous l’ayez utilisé.',
  'ui.weWillGenerateFamily': 
    'Nous produirons un code de famille que vous pourrez partager. Votre nom '
    + 'et vos coordonnées sont reprises du profil que vous avez déjà et restent '
    + 'identiques dans toutes les familles auxquelles vous appartenez.',
  'ui.shareRelativesSoThey': 
    'Partagez ceci avec vos proches pour qu’ils puissent vous rejoindre. '
    + 'Toute personne qui rejoint attend dans Approbations des membres jusqu’à '
    + 'ce que vous l’admettiez.',
  'ui.profileDetailsSharedAcross': 
    'Les informations de votre profil sont partagées entre toutes les '
    + 'familles auxquelles vous appartenez. Choisissez laquelle s’ouvre à la '
    + 'connexion, ou changez la famille que vous consultez actuellement.',
  'ui.familyAccountBelongsProfile': 
    'La famille à laquelle ce compte appartient. Les informations de votre '
    + 'profil sont partagées entre toutes les familles que vous rejoignez.',
  'ui.switchedOffAdministratorNothing': 
    'Désactivée par un administrateur. Rien n’a été supprimé, et seule '
    + 'l’assistance GENORRA peut la rétablir.',
  'prof.whatFamilyMayContact': 
    'À quel sujet votre famille peut vous contacter, et comment. Tout ici '
    + 'vous appartient et personne d’autre ne peut le régler pour vous.',
  'prof.chapterAppliesFamilyOnly': 
    'Votre chapitre ne concerne que cette famille — le reste de votre profil '
    + 'est partagé entre toutes les familles auxquelles vous appartenez. Le '
    + 'changer déplace aussi vos fils et filles de moins de 18 ans sans compte '
    + 'propre ; tous les autres règlent le leur.',
  'prof.canAlsoDecideWhat': 
    'Il peut aussi déterminer ce que vous devez : une famille peut rattacher '
    + 'des cotisations à une région ou à un chapitre. Ne rien choisir vous '
    + 'laisse sous National, devant les cotisations de toute la famille et '
    + 'aucune des locales.',
  'prof.sunsetDate': 'Date de décès',
  'prof.datesTimesProductRecords': 
    'Les dates et heures que le produit enregistre — quand un paiement a été '
    + 'saisi, quand un message a été envoyé — vous sont affichées dans ce '
    + 'fuseau horaire.',
  'prof.leaveEmptyWeFollow': 
    'Laissez vide et nous suivons votre navigateur. La traduction est encore '
    + 'en cours : certains écrans sont en anglais quelle que soit la langue '
    + 'choisie.',
  'prof.changeSignEmail': 'Changer l’adresse de connexion',
  'prof.passwordBeenChangedEvery': 
    'Votre mot de passe a été changé, et tous les autres appareils connectés '
    + 'à ce compte ont été déconnectés. Il leur faudra le nouveau mot de passe.',
  'rep.everyApprovedMemberFamily': 
    'Tous les membres approuvés de la famille, où qu’ils soient. Les '
    + 'candidats encore en attente dans la file d’approbation ne sont pas '
    + 'comptés, ni les proches enregistrés comme décédés.',
  'rep.lookingUpWhoGroup': 'Recherche des personnes de ce groupe…',
  'rep.whoGroupNotYours': 
    'Savoir qui est dans ce groupe ne vous est pas ouvert. Les chiffres du '
    + 'graphique le sont ; les noms exigent en plus l’Annuaire des membres.',
  'rep.theirRegionFollowsTheir': 
    'Leur région suit leur chapitre. Les fils et filles de moins de dix-huit '
    + 'ans sans compte propre se déplacent avec eux.',
  'rep.adultMinorWorkedOut': 
    'Majeur ou mineur est calculé à partir de ceci chaque fois que le rapport '
    + 'se charge ; rien n’est conservé au sujet de leur âge.',
  'ui.relativeWhoNotTold': 
    'Un proche qui n’a pas dit à la famille dans quel chapitre il se trouve '
    + 'n’est dans aucune région ; il n’est donc pas interrogé. Utilisez',
  'stf.staffListCouldNot': 
    'La liste du personnel n’a pas pu être lue. C’est une requête refusée et '
    + 'non une équipe vide : vous y figurez, sinon cette page aurait répondu '
    + '404 au lieu de s’afficher. Réessayez dans un instant et consultez le '
    + 'journal du serveur pour la raison.',
  'stf.addressBelongAccountAlready': 
    'L’adresse doit appartenir à un compte qui existe déjà. On ne peut rien '
    + 'accorder à quelqu’un qui ne s’est jamais inscrit, et cet écran le dira '
    + 'plutôt que d’écrire une ligne pour un identifiant — c’est pourquoi il '
    + 'demande une adresse et non un identifiant d’utilisateur.',
  'stf.recordedRowShownList': 
    'Enregistré sur la ligne et affiché dans la liste ci-dessus. C’est la '
    + 'seule chose qui expliquera cette autorisation à qui lira la liste dans '
    + 'un an, et c’est pourquoi elle est obligatoire.',
  'stf.pasteAddressFromTicket': 
    'Collez l’adresse du ticket. Ceci indique si un compte existe, s’il a '
    + 'jamais été confirmé ou utilisé, et chaque fiche de famille portant cette '
    + 'adresse — y compris une personne invitée qui n’a jamais rejoint.',
  'stf.authenticationServiceDidNot': 
    'Le service d’authentification n’a pas répondu : nous ne savons donc pas '
    + 'si cette adresse a un compte. C’est une recherche échouée, pas un compte '
    + 'absent — réessayez.',
  'stf.addressNeverBeenConfirmed': 
    'L’adresse n’a jamais été confirmée — c’est ce qui bloque la connexion. '
    + 'Renvoyer la confirmation est la solution.',
  'stf.familyRecordsAddressCould': 
    'Les fiches de famille de cette adresse n’ont pas pu être lues — c’est '
    + 'une requête refusée, et non une adresse n’appartenant à rien.',
  'stf.addressNoFamilyRecord': 
    'Cette adresse ne figure dans aucune fiche de famille. Un compte sans '
    + 'famille voit un 404 sur chaque page, et c’est à cela que ressemble « ça '
    + 'ne marche tout simplement pas ».',
  'stf.accountListCouldNot': 
    'La liste des comptes n’a pas pu être lue. C’est le service '
    + 'd’authentification qui refuse ou expire, pas une plateforme sans aucun '
    + 'compte.',
  'stf.familiesListCouldNot': 
    'La liste des familles n’a pas pu être lue. C’est une requête refusée et '
    + 'non une plateforme vide — réessayez dans un instant et consultez le '
    + 'journal du serveur pour la raison.',
  'tx.canOpenTransactionsBut': 
    'Vous pouvez ouvrir les Transactions, mais aucun de ses registres ne vous '
    + 'a été ouvert. Demandez à un administrateur l’accès à ceux dont vous avez '
    + 'besoin : cotisations, dons, contributions, versements et virements '
    + 's’accordent séparément.',
  'tx.noContributionsYet': 'Aucune contribution pour l’instant.',
  'tx.noDisbursementsRecorded': 'Aucun versement enregistré.',
  'tx.noTransfersBetweenFunds': 'Aucun virement entre caisses pour l’instant.',
  'tx.noneSetUpYet': 'Aucun pour l’instant — un administrateur les ajoute dans Comptabilité.',
  'tx.waivingForgivesDueNo': 
    'Une remise annule la cotisation. Aucun argent n’a changé de mains : il '
    + 'n’y a donc ni moyen de paiement ni référence à enregistrer.',
  'tx.paymentMethod': 'Moyen de paiement',
  'tx.checkReference': 'N° de chèque / référence',
  'tx.whoGave': 'Qui l’a donné',
  'tx.someoneSomethingElse': 'Quelqu’un ou quelque chose d’autre…',
  'tx.nameSource': 'Nom ou origine',
  'tx.milestoneOptional': 'Jalon (facultatif)',
  'tx.transferCannotEditedDeleted': 
    'Un virement ne peut être ni modifié ni supprimé. S’il est erroné, '
    + 'remettez l’argent en place — les deux écritures restent au registre.',
  'tx.check1043': 'Chèque n° 1043',
  'tx.optionalNotes': 'Notes facultatives',
  'tx.auntRubySEstate': 'Succession de tante Ruby, excédent de la réunion 2026…',
  'tx.boardVote202608': 'Vote du conseil du 12/08/2026 — excédent transféré à la caisse des bourses',
  'tx.newContribution': 'Nouvelle contribution',
  'tx.newDisbursement': 'Nouveau versement',
  'tx.newTransfer': 'Nouveau virement',
  'tx.recorded': 'Enregistré par',
  'tx.paymentMethod2': 'Moyen de paiement',
  'tx.paid': 'Payé à',
  'tx.fundMilestone': 'Caisse / jalon',
  'tx.from': 'De → à',
  'ui.stateProvince': 'État / province',
  'ui.profilePhoto': 'Photo de profil',
  'ui.confirmationCode': 'Code de confirmation',
  'ui.chosen': 'Choisi :',
  'ui.nobodyMatches': 'Personne ne correspond.',
  'ui.searchName': 'Rechercher par nom…',
  'ui.whoCanDoWhat': 'Qui peut faire quoi',
  'ui.farScrollingGoesThere': 
    'Le défilement s’arrête là. Il y a des actualités plus anciennes — '
    + 'cherchez un mot de l’une d’elles pour la retrouver.',
}
