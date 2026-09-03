import type { Catalogue } from '@/lib/i18n/t'

/**
 * The SOURCE catalogue. Every other language is a translation of this one.
 *
 * ── THE KEYS ARE IDENTIFIERS THAT ALREADY EXISTED ───────────────────────────────────
 * `nav.item./admin/members`, not `nav.item.membersAndAccess`. The rail's captions are keyed on
 * the HREF, which is the same stable identifier the permission system uses — AGENTS.md's rule
 * is that a resource key IS the route without its leading slash, so a caption, a route, a
 * permission key and a catalogue key are all one string.
 *
 * That is the whole reason this retrofit is cheap. The hardest part of adding i18n to a mature
 * product is giving thousands of strings names that do not move; this codebase already did it
 * for its own reasons — plan bullets carry `claim: '<tier>/<slug>'`, help chapters carry a
 * `slug` that *"is not a route and moves with nothing"*, sections carry ids. Where a stable id
 * exists, it is the key.
 *
 * ── WHAT IS AND IS NOT IN HERE ──────────────────────────────────────────────────────
 * IN: the shell. The rail, its section headings, the top bar, the account menu, the family
 * switcher, the theme toggle, the notification bell. These are the strings on every screen, so
 * they are the ones worth having first and the ones that prove the mechanism.
 *
 * NOT IN, deliberately:
 *
 *   the MANUAL          `lib/help/content.ts` is ~79KB and gets per-locale MODULES loaded by
 *                       the server components that render it. AGENTS.md already records that
 *                       importing it from a client component is too much for the bundle, and
 *                       `lib/i18n/t.ts` explains why this registry is a static import.
 *   MARKETING copy      Home is path-prefixed (`/es/pricing`), so its copy is resolved per
 *                       route, and `PLANS[]`' bullets are gated by `marketing:check` on their
 *                       own `claim` ids rather than by this catalogue.
 *   database VALUES     a chapter's name, a fund's name, a gathering's title. Those are a
 *                       family's own words and are not ours to translate.
 *
 * ── HOW TO ADD A STRING ─────────────────────────────────────────────────────────────
 * Put it here, use `t('the.key')` at the call site, and run `npm run i18n:check`. That script
 * fails on a key used but not defined, a key defined but not used, a placeholder that appears
 * in a translation and not in the English, and a translation whose English source has changed
 * since it was made. It cannot check whether the words are any good.
 */
export const en: Catalogue = {
  // ── THE RAIL: SECTION HEADINGS ────────────────────────────────────────────────────
  // Keyed on the section id, which `Sidebar.tsx` already had. The first group has no heading
  // (it holds Dashboard) and so has no key.
  'nav.section.community': 'Community',
  'nav.section.gatherings': 'Gatherings',
  'nav.section.library': 'Library',
  'nav.section.accounting': 'Accounting',
  'nav.section.reporting': 'Reporting',
  'nav.section.admin': 'Admin',
  'nav.section.help': 'Help',

  // ── THE RAIL: ITEMS, KEYED ON HREF ────────────────────────────────────────────────
  // THREE CAPTIONS APPEAR TWICE AND MUST STAY SEPARATE KEYS. "Gatherings" is a rail item under
  // Gatherings, another under Admin and a third under Reporting; "Elections" likewise. They are
  // the same word in English and there is no reason to assume they are the same word in every
  // language — one may need an article, or a different noun for the report than for the screen.
  // Collapsing them would be a decision made in English on behalf of every translator.
  'nav.item./dashboard': 'Dashboard',

  'nav.item./community/announcements': 'Announcements',
  'nav.item./community/chat': 'Chat',
  'nav.item./community/directory': 'Directory',
  'nav.item./community/distributions': 'Distributions',
  'nav.item./community/elections': 'Elections',
  'nav.item./community/family-tree': 'Family Tree',
  'nav.item./community/gallery': 'Gallery',

  'nav.item./gatherings': 'Gatherings',
  'nav.item./gatherings/calendar': 'Calendar',

  'nav.item./library/bylaws': 'Bylaws',
  'nav.item./library/documents': 'Documents',
  'nav.item./library/meeting-minutes': 'Meeting Minutes',
  'nav.item./library/officer-notes': 'Officer Notes',

  'nav.item./accounting/summary': 'Summary',
  'nav.item./accounting/dues-and-donations': 'Dues & Donations',
  'nav.item./reporting/transactions': 'Transactions',

  'nav.item./reporting/membership': 'Membership',
  'nav.item./accounting/payment-history': 'Payment History',
  'nav.item./reporting/dues-projections': 'Dues Projections',
  'nav.item./reporting/pl-summary': 'P&L Summary',
  'nav.item./reporting/gatherings': 'Gatherings',
  'nav.item./reporting/elections': 'Elections',
  'nav.item./reporting/meetings': 'Meetings',
  'nav.item./reporting/board': 'Board & Offices',

  'nav.item./admin/members': 'Members',
  'nav.item./admin/gatherings': 'Gatherings',
  'nav.item./admin/accounting': 'Accounting',
  'nav.item./admin/elections': 'Elections',
  'nav.item./admin/settings': 'Settings',

  'nav.item./help': 'How-To Manual',

  // ── THE RAIL: ITS OWN CONTROLS ────────────────────────────────────────────────────
  // Two states of one button, so two keys — a single "Toggle navigation" would be worse copy in
  // every language, because a screen reader reads it at the moment the state matters.
  'nav.open': 'Open navigation menu',
  'nav.close': 'Close navigation menu',

  // ── THE FAMILY SWITCHER ───────────────────────────────────────────────────────────
  'switcher.heading': 'Your families',
  'switcher.switching': 'Switching…',
  'switcher.badge.pending': 'Waiting for approval',
  'switcher.badge.removed': 'This family has been removed',
  'switcher.badge.default': 'Opens when you log in',

  'switcher.badge.removedShort': 'Removed',
  'switcher.badge.pendingShort': 'Pending',
  'switcher.badge.defaultShort': 'Default',
  // ── THE ACCOUNT MENU ──────────────────────────────────────────────────────────────
  'account.profile': 'My Profile',
  'account.families': 'My Families',
  'account.appearance': 'Appearance',
  'account.staff': 'GENORRA staff console',
  'account.staffHint': 'Every family · opens in a new window',
  'account.signOut': 'Sign out',

  // ── THE THEME TOGGLE ──────────────────────────────────────────────────────────────
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  // WHOLE SENTENCES, not fragments assembled in JSX. The toggle's accessible name has to name
  // the current state AND the destination, and a language that orders those differently — or
  // needs an article, or inflects the noun after a preposition — cannot be served by
  // concatenation. `{current}` and `{next}` are the mode captions above.
  'theme.switchLabel': 'Appearance: {current}. Switch to {next}.',
  'theme.currentLabel': 'Appearance: {current}',

  // ── THE NOTIFICATION BELL ─────────────────────────────────────────────────────────
  'bell.label': 'Notifications',
  'bell.heading': 'Notifications',
  'bell.markAll': 'Mark all read',
  'bell.empty': 'No notifications yet.',

  // ── HOW LONG AGO ─────────────────────────────────────────────────────────────────
  // `timeAgo` in `lib/date-utils.ts` answers WHICH of these applies and these are the words.
  // The pure module returns data and the component says the sentence — the same division
  // `whenProblems` and `WHEN_PROBLEM_TEXT` already keep.
  //
  // ABBREVIATED ON PURPOSE. These sit in a bell, on a dashboard card and in an archive row,
  // beside a title that is the thing being read — "5 minutes ago" would take more width than
  // the fact is worth. A language that cannot abbreviate this way should spell it out; that is
  // the translator's call, which is exactly why it is a string rather than a template.
  'time.now': 'Just now',
  'time.minutes': '{n}m ago',
  'time.hours': '{n}h ago',

  // ── THE LANGUAGE SWITCHER ─────────────────────────────────────────────────────────
  // The endonyms themselves are NOT here: they live in `lib/i18n/locales.ts` and are never
  // translated, because a member looking for their own language scans for the word they would
  // use for it and that word does not change with the interface they are reading.
  'language.choose': 'Choose a language',
  'language.changeFailed': 'Could not change the language.',
  // ── BATCH 1 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // Found by rendering every route as a Spanish-reading member and again as an English
  // one and diffing the visible text — see the note above `i18n:literals`' ceiling on why
  // a static scan could not see these. `field.required` is the sharpest of them: it is
  // read aloud beside the asterisk on EVERY required field in the product.
  'field.required': '(required)',
  'dash.viewDirectory': 'View directory',
  'dash.reviewQueue': 'Review queue',
  'dash.viewCalendar': 'View calendar',
  'dash.election.nominations': 'Nominate',
  'dash.election.voting': 'Vote',
  'dash.selectYourChapter': '— Select your chapter —',
  'gath.comingUp': 'Coming up',
  'gath.alreadyHeld': 'Already held',
  'gath.nothingPlannedYet': 'Nothing is planned yet.',
  'gath.nothingHeldYet': 'Nothing has been held yet.',
  'cards.nextInstallmentOne': 'Next Installment',
  'cards.nextInstallmentsMany': 'Next Installments',
  // ── BATCH 2 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // `tree.bloodlineFrom*` is the one worth reading: it was six JSX fragments spliced
  // around two names, which hard-codes ENGLISH WORD ORDER and cannot be translated at
  // all. One key with `{anchor}` and `{parents}` lets each language put the names where
  // that language puts them.
  'dash.tree.leafOne': 'Leaf',
  'dash.tree.leavesMany': 'Leaves',
  'plan.perMonthNoAnnual': ' /month · no annual plan',
  'set.removalKeepsEverything': 'Every payment, fund, photograph, event, message and person stays exactly where it is. Removing is not a way to erase anything — and it is not something you can undo from here:',
  'set.onlySupportRestores': 'only GENORRA support can bring a family back.',
  'tree.dashedCardsAreGaps': '· Dashed cards are gaps you can fill',
  'tree.removingNeverRemoves': '· Removing a connection never removes anyone from the family',
  // ── THE TRANSACTIONS LEDGER, 2026-08-29 ────────────────────────────────────
  // This screen carried a note saying it was "not translated yet — on Phase 5's admin
  // pass", and it was the densest concentration of English left in the product: every
  // field label in the detail dialog, every validator refusal, and both module-level
  // registries. `tx.reverseConfirm` is one key rather than the five concatenated clauses
  // it replaced — a sentence spliced around two figures and a name hard-codes English
  // word order and cannot be translated at all.
  'tx.newDuesPayment': 'New Dues Payment',
  'tx.newDonationPayment': 'New Donation Payment',
  'tx.source.dues_routing': 'Routed',
  'tx.source.admin_manual': 'Recorded',
  'tx.source.member_contribution': 'From a member',
  'tx.noLongerInFamily': 'No longer in the family',
  'tx.donationPayment': 'Donation payment',
  'tx.duesPayment': 'Dues payment',
  'tx.unknownMember': 'Unknown member',
  'tx.correctingEntry': '{kind} — correcting entry',
  'tx.correctingEntryPill': 'Correcting entry',
  'tx.amount': 'Amount',
  'tx.amountDollars': 'Amount ($)',
  'tx.schedule': 'Schedule',
  'tx.noSchedule': 'No schedule',
  'tx.entered': 'Entered',
  'tx.reversed': 'Reversed',
  'tx.reverse': 'Reverse',
  'tx.reversedByCorrecting': 'Yes — a correcting entry cancels this payment',
  'tx.corrects': 'Corrects',
  'tx.correctsEarlierPayment': 'An earlier payment on this ledger',
  'tx.routedFromPayment': 'Routed from a payment',
  'tx.fundContribution': 'Fund contribution — {source}',
  'tx.unknownFund': 'Unknown fund',
  'tx.fundDisbursement': 'Fund disbursement',
  'tx.milestone': 'Milestone',
  'tx.fundTransfer': 'Fund transfer — money moved within the family',
  'tx.fromLabel': 'From',
  'tx.toLabel': 'To',
  'tx.reason': 'Reason',
  'tx.recipient': 'Recipient',
  'tx.reverseThisPayment': 'Reverse this payment',
  'tx.thisMember': 'this member',
  'tx.reverseConfirm': 'Post a correcting entry of {credit} against {member}’s {amount} payment? The original stays on the ledger — reversing is how a mistake is corrected, because posted payments cannot be edited or deleted. Any money this payment routed into funds is taken back out of the same funds.',
  'tx.postReversal': 'Post reversal',
  'tx.failedToReverse': 'Failed to reverse',
  'tx.memberScheduleAmountRequired': 'Member, schedule and amount required',
  'tx.chooseHowPaymentMade': 'Choose how the payment was made',
  'tx.enterCheckPayment': 'Enter the check number or reference for the payment',
  'tx.fundAndAmountRequired': 'Fund and amount required',
  'tx.chooseWhoContributionFrom': 'Choose who the contribution came from',
  'tx.nameWhoContributionFrom': 'Name who the contribution came from',
  'tx.chooseHowContributionGiven': 'Choose how the contribution was given',
  'tx.enterCheckContribution': 'Enter the check number or reference for the contribution',
  'tx.fundMemberAmountRequired': 'Fund, member, and amount required',
  'tx.enterCheckDisbursement': 'Enter the check number or reference for the disbursement',
  'tx.bothFundsAmountRequired': 'Both funds and an amount are required',
  'tx.chooseTwoDifferentFunds': 'Choose two different funds',
  'tx.sayWhyMoneyMoved': 'Say why the money is being moved',
  'tx.enterAmountAboveZero': 'Enter an amount greater than zero',
  'tx.selectMember': '— Select member —',
  'tx.selectFund': '— Select fund —',
  'tx.selectMethod': '— Select method —',
  'tx.selectOne': '— Select —',
  'tx.selectNone': '— None —',
  'tx.recording': 'Recording…',
  'tx.recordPayment': 'Record Payment',
  'tx.addContribution': 'Add Contribution',
  'tx.recordDisbursement': 'Record Disbursement',
  'tx.transferring': 'Transferring…',
  'tx.transferFunds': 'Transfer Funds',
  'tx.transactionLedgers': 'Transaction ledgers',
  'tx.recordGiftLede': 'Record a gift a member has already given.',
  'tx.recordDuesLede': 'Record dues a member has already paid.',
  'tx.contributionLede': 'Money added to a fund directly, outside of dues routing.',
  'tx.disbursementLede': 'Money paid out of a fund to a member.',
  'tx.transferLede': 'Move money from one fund to another. Nothing leaves the family.',
  'tx.noDonationsYet': 'No donations received yet.',
  'tx.noDuesPaymentsYet': 'No dues payments recorded yet.',
  // ── BATCH 3 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // The rail's motto is the one worth a note: it was read straight out of `lib/brand.ts`,
  // so the single piece of writing a member sees on EVERY screen was English for every
  // reader. Same call `FeatureShowcase` records about `APP_PROMISE` — the brand file keeps
  // the product's name, and finished prose a reader reads belongs here.
  'ledger.dues': 'Dues',
  'ledger.donations': 'Donations',
  'ledger.contributions': 'Contributions',
  'ledger.disbursements': 'Disbursements',
  'ledger.transfers': 'Transfers',
  'nav.menu': 'Menu',
  'brand.motto.lead': 'Our Roots',
  'brand.motto.rest': 'run deep, our bond runs deeper.',
  // ── CONNECT: WHERE A FAMILY BANKS ──────────────────────────────────────────
  // `country.<iso>` is keyed on the alpha-2 code because that is what
  // `identity.country` takes and what `family_stripe_accounts.country` stores — the id is
  // the contract and the name is copy. Only the ENABLED countries are here; enabling one
  // in `lib/stripe/connect-countries.ts` owes three lines in this file, and `i18n:check`
  // names the missing one rather than letting the picker print a key.
  'proc.countryLabel': 'Where the family banks',
  'proc.countryPermanent': 'Stripe cannot change this after the account is created, so it decides the payout currency and which documents you will be asked for.',
  'proc.countryDecidesCurrency': 'Your family’s dues, funds and budgets will be recorded in {currency}.',
  'proc.currencyFixedByAccount': 'Your family collects in {currency} ({country}). Stripe cannot move a connected account to another country, so this is settled.',
  'proc.currencyFixedByPayments': 'Your family collects in {currency} ({country}). Payments have already been recorded, and the ledger cannot be re-denominated, so this is settled.',
  'act.countryNotAvailableForDues': 'Online dues collection is not available in that country yet.',
  // ── BELL ENTRIES (20260901000004) ────────────────────────────────────────────────
  // Rendered at READ time from `notifications.title_key` / `body_key` / `params`, so a
  // relative reads the bell in their own language rather than in the language of whoever
  // happened to trigger the event. The English on the row is the fallback and matches these.
  'notify.announcement.title': 'A new announcement was posted',
  'notify.announcement.body': '{title}.',
  'notify.membershipRequest.title': 'A new member is waiting for approval',
  'notify.membershipRequest.body': '{who} has asked to join {family}.',
  'notify.membershipAppeal.title': 'A declined request has been appealed',
  'notify.membershipAppeal.body': '{who} has asked the family to look again.',
  'notify.membershipAppeal.bodyNote': '{who} has asked the family to look again: “{note}”',
  'notify.membershipApproved.title': 'You have been approved',
  'notify.membershipRejected.title': 'Your membership request was declined',
  'notify.taskAssigned.title': 'You have a new gathering task',
  'notify.taskAssigned.body': '{what}.',
  'notify.taskAssigned.bodyDue': '{what}, due {due}.',
  'notify.taskSubmitted.title': 'A gathering task is waiting for review',
  'notify.taskSubmitted.body': '{who} has submitted “{task}” for {gathering}.',
  'notify.taskApproved.title': 'A gathering task was approved',
  'notify.taskApproved.body': '{what} has been approved.',
  'notify.taskApproved.bodyNotes': '{what} has been approved: “{notes}”',
  // "SENT BACK", NEVER "DENIED" OR "REJECTED", in every language. The task is open to the
  // member again and they are being asked to change something — a resubmission is a NEW
  // submission row, never an edit of the refused one — so the sentence describes what happened
  // to the WORK rather than passing judgement on the person who did it.
  'notify.taskDenied.title': 'A gathering task needs another look',
  'notify.taskDenied.body': '{what} was sent back for another look.',
  'notify.taskDenied.bodyNotes': '{what} was sent back with notes: “{notes}”',
  'notify.taskReopened.title': 'A gathering task was reopened',
  'notify.taskReopened.body':
    '{what} was approved and has been reopened. Your previous answer is still there.',
  'notify.taskReopened.bodyReason':
    '{what} was approved and has been reopened: “{reason}”. Your previous answer is still there.',
  'notify.meeting.title': 'You are expected at a meeting',
  'notify.meeting.body': '{title}. It is on your calendar.',
  'notify.meeting.bodyWhen': '{title} on {when}. It is on your calendar.',
  'notify.safety.title': 'Are you safe?',
  'notify.safety.body': '{title} — your family is asking you to check in.',
  'plan.featuresInPlan': 'What is included in {plan}',
  'gath.status.planning': 'Planning',
  'gath.status.scheduled': 'Scheduled',
  'gath.status.complete': 'Complete',
  'gath.status.cancelled': 'Cancelled',
  'gath.taskStatus.open': 'Not started',
  'gath.taskStatus.submitted': 'Waiting for review',
  'gath.taskStatus.approved': 'Approved',
  'gath.taskStatus.denied': 'Needs another look',
  'acct.rail.funds': 'Funds',
  'dash.tree.memberOne': 'Member',
  'dash.tree.memberMany': 'Members',
  'act.nothingWithheldToLetGo': 'There are no withheld records to let go.',
  'act.couldNotDeleteRecordsPlease': 'Could not delete those records. Please try again.',
  'act.thatCodeNotRight': 'That code is not right.',
  'act.enterSixDigitCode': 'Enter the six-digit code from your email.',
  'ret.heading': 'Records from your old plan',
  'ret.p1': 'Your family moved down from {tier}. Everything that plan included has been kept rather than removed, and it is deleted in {days} days.',
  'ret.p1One': 'Your family moved down from {tier}. Everything that plan included has been kept rather than removed, and it is deleted tomorrow.',
  'ret.p1Today': 'Your family moved down from {tier}. Everything that plan included is due to be deleted today.',
  'ret.overdue': 'The deletion is overdue by {days} days and is waiting on a reminder that has not been sent. Nothing has been removed.',
  'ret.keep': 'Move back to {tier} to keep it. That covers the {months} month(s) you have been away and the coming month — {amount}.',
  'ret.freshHeading': 'Or let it go now',
  'ret.fresh': 'If you have decided, you can delete it today rather than waiting and being reminded four more times.',
  'ret.freshButton': 'Let these records go…',
  'ret.irreversible': 'Deleted records cannot be recovered. This cannot be reversed by us or by anybody else.',
  'ret.willDelete': 'This will delete:',
  'ret.rows': '{n} row(s) in {table}',
  'ret.codeSent': 'A six-digit code has been sent to {email}. It lasts {minutes} minutes.',
  'ret.codeLabel': 'Code from your email',
  'ret.confirmButton': 'Delete these records permanently',
  'ret.done': 'Those records have been deleted.',
  'lock.admin.heading': 'Your family’s payment is overdue',
  'lock.admin.p1Members': 'The last payment for {family} did not go through, so relatives can no longer use the site. You still have full access, and paying restores everybody at once.',
  'lock.admin.p1All': 'The last payment for {family} did not go through, so every screen except billing is closed. Paying opens all of them again.',
  'lock.admin.nothingLost': 'Nothing has been removed. Everything the family has entered is exactly where it was.',
  'lock.admin.warnOne': 'Tomorrow the family moves to the Free plan and everything the Free plan does not include is deleted. That cannot be reversed.',
  'lock.admin.warnMany': 'In {days} days the family moves to the Free plan and everything the Free plan does not include — the family tree, the dues ledger, the funds and the photographs — is deleted. That cannot be reversed.',
  'lock.admin.button': 'Go to billing',
  'lock.member.heading': '{family} is temporarily unavailable',
  'lock.member.p1': 'There is an accounting issue on this family’s account. Please contact your family administrator.',
  'lock.member.p2': 'Nothing has been removed, and everything comes back as soon as it is resolved.',
  'lock.otherFamilies': 'Your other families are unaffected —',
  'lock.myFamilies': 'My Families',
  'act.chooseKeepOrStartFresh': 'Choose whether to keep the records from your old plan or start fresh before continuing.',
  'act.nothingWithheldToKeep': 'There are no withheld records for this plan to bring back.',
  'bill.catchUpLine': '{plan} — {months} month(s) you were away, plus the coming month',
  'act.countryAndCurrencySaved': 'Saved. Your family collects in this country’s currency.',
  'act.couldNotReadFamilyCurrency': 'We could not tell which currency your family collects in, so this payment was not started. Please try again.',
  'act.currencyFixedByPayments': 'Your family has already recorded payments, so its country and currency cannot be changed.',
  'act.currencyFixedByAccount': 'Your family’s payment account has already been created, so its country and currency cannot be changed.',
  'country.us': 'United States',
  'country.ca': 'Canada',
  'country.mx': 'Mexico',
  // ── THE STAFF CONSOLE'S DESTRUCTIVE HALF, 2026-08-31 ───────────────────────
  // Two irreversible acts and one read-only screen. `stf.sub*` is the platform's OWN
  // revenue and never a family's dues — the two ledgers must not meet, and a caption
  // here that blurred them would be quoted.
  'staff.subscriptions': 'Subscriptions',
  'stf.subscriptionsReadFailed': 'We could not read the billing records just now. Nothing is wrong with any family’s plan — refresh the page, and if it keeps happening the figures are not safe to quote.',
  'stf.subPaying': 'Paying today',
  'stf.subMrr': 'Monthly',
  'stf.subMrrHint': 'Recurring plans only',
  'stf.subLifetime': 'Collected to date',
  'stf.subLifetimeShort': 'To date',
  'stf.subAttention': 'Need attention',
  'stf.subAttentionHint': '{delinquent} failed, {leaving} leaving',
  'stf.subNoneYet': 'No family has reached checkout yet.',
  'stf.tierMixHeading': 'Families by plan',
  'stf.tierMixHint': 'Every family on the platform, counted by the plan in force — not only those that have paid.',
  'stf.sortOrdersThisPage': 'Sorting orders the rows on this page, not the whole list.',
  'stf.subFamily': 'Family',
  'stf.subPlan': 'Plan',
  'stf.subPaidThrough': 'Paid through',
  'stf.subStanding': 'Standing',
  'stf.subPaidFor': 'Paid for {tier}',
  'stf.subMode.recurring': 'Monthly',
  'stf.subMode.prepaid': 'Prepaid term',
  'stf.subScheduled': '{tier} from {on}',
  'stf.subDelinquentSince': 'Payment failed {on}',
  'stf.subLeaving': 'Not renewing',
  'stf.subNeverPaid': 'Never paid',
  'stf.subPaid': 'Paid',
  'staff.deleteForever': 'Delete…',
  'staff.deleteForeverConfirm': 'Delete permanently',
  'staff.deleting': 'Deleting…',
  'staff.deleteFamilyTitle': 'Delete {name}?',
  'staff.deleteFamilyLede': '{code} · {members} members. This is permanent and there is no restore.',
  'staff.deleteFamilyWhatGoes': 'Every person, payment, fund, photograph, document, message, gathering, election and meeting in this family is destroyed, along with its files. Accounts are not deleted — a member of another family keeps it.',
  'staff.deleteWhyLabel': 'Why',
  'staff.deleteWhyPlaceholder': 'The ticket, and who asked',
  'staff.deleteWhyHint': 'Kept permanently. It is the only record that survives this.',
  'staff.deleteTypeCodeLabel': 'Type {code} to confirm',
  'staff.deleteEmailedLabel': 'Six-digit code',
  'staff.deleteSendCode': 'Email me a code',
  'staff.deleteAccount': 'Delete…',
  'staff.deleteAccountConfirm': 'Delete this account',
  'staff.deleteAccountTitle': 'Delete this account?',
  'staff.deleteAccountLede': '{email} will no longer be able to sign in, and the address becomes free to register again.',
  'staff.deleteAccountKeeps': 'Their {families} families keep them on the tree, in the directory and in every ledger — as a relative with no account. Nothing about any family is deleted.',
  'staff.deleteAccountKeepsNone': 'This account belongs to no family, so there is nothing else to keep.',
  'staff.deleteAccountWhyPlaceholder': 'The ticket, and who asked',
  'staff.deleteTypeAddressLabel': 'Type the address to confirm',
  'staff.noAddress': 'No address',
  'staff.actions': 'Actions',
  'act.couldNotReadThatFamily': 'We could not read that family. Try again.',
  'act.noFamilyWithThatCode': 'No family with that code.',
  'act.couldNotEmailYouCode': 'We could not email you a code. Try again.',
  'act.codeEmailedToYou': 'A six-digit code is on its way to your inbox.',
  'act.typeFamilyCodeToConfirm': 'Type the family code exactly to confirm.',
  'act.sayWhyFamilyDeleted': 'Say why this family is being deleted.',
  'act.couldNotCheckThatCode': 'We could not check that code. Try again.',
  'act.couldNotDeleteThatFamily': 'We could not delete that family. Nothing was changed.',
  'act.deleteReturnedNoResult': 'That returned no result. Check before trying again.',
  'act.familyDeletedPermanently': '{code} is gone. {rows} records were destroyed.',
  'act.someObjectsRemain': 'Some files could not be removed and are now orphaned: {detail}',
  'act.typeAddressToConfirm': 'Type the address exactly to confirm.',
  'act.sayWhyAccountDeleted': 'Say why this account is being deleted.',
  'act.couldNotDeleteThatAccount': 'We could not delete that account. Nothing was changed.',
  'act.accountDeleted': '{email} can no longer sign in.',
  // ── STRIPE, WHEN A FAMILY IS DESTROYED (2026-09-01) ──────────────────────
  // A Stripe subscription is not a row in this database, so `staff_delete_family`
  // cannot reach one. `lib/stripe/cancel-family.ts` stops both directions of money
  // before the rows go, and these are what it reports. The refusal names no amount,
  // no card and no Stripe id — that detail is in the log, and an owner needs to know
  // only that nothing was deleted and why.
  'act.couldNotStopSubscriptions': 'Nothing was deleted. This family still has live Stripe subscriptions that could not be stopped, and deleting it would leave them charging cards with no record of who they belong to. Fix that at Stripe, then ask for a new code.',
  'act.stoppedDuesOne': 'One recurring dues payment was stopped at Stripe.',
  'act.stoppedDuesMany': '{n} recurring dues payments were stopped at Stripe.',
  'act.stoppedGenorraPlan': 'The family’s GENORRA plan was cancelled.',
  'act.couldNotStopSubscriptionsRemoval': 'The family was not removed. We could not stop its subscriptions at Stripe, and removing it would leave those payments running with nobody able to reach the screen that stops them. Try again in a few minutes with a new code.',
  'act.couldNotStopDuesFirst': 'Nothing was deleted. We could not stop your members\' recurring dues payments at Stripe first, and deleting the records would leave those payments running with nothing to say what they were for. Try again in a few minutes with a new code.',
  'set.removalStopsBilling': 'The billing stops, and this part does not come back.',
  'set.removalBillingBody': 'Your GENORRA plan will not renew — it runs to the end of the period you have already paid for, and nothing is refunded. Every member paying dues automatically has that payment cancelled straight away. Restoring the family brings back every record, but it cannot bring those automatic payments back: each member would have to set theirs up again.',
  'stf.deleteStopsBilling': 'Every recurring payment for this family is cancelled at Stripe first — the members\' automatic dues on the family\'s own account, and the family\'s GENORRA plan on ours. If any of them cannot be stopped, nothing is deleted.',
  // ── BIRTHDAYS, 2026-08-31 ──────────────────────────────────────────────────
  // `birthday.familyPosted` and `birthday.fromUs` are NOT interchangeable and must not
  // be merged: the first says the family spoke and the second says only that we did.
  // The whole design turns on never claiming the first when nobody wrote anything —
  // see 20260831000002's header.
  'birthday.today': 'Today',
  'birthday.heroGreeting': 'Happy birthday, {name}!',
  'birthday.familyPosted': 'Your family has posted something for you.',
  'birthday.fromUs': 'From everyone at GENORRA — we hope your family spoils you today.',
  'birthday.readIt': 'Read it',
  'birthday.promptHeading': 'Somebody has a birthday coming up',
  'birthday.promptLede': 'Within the next {days} days, and nobody has said anything yet. Whatever you write is what the family posts — we never write it for you.',
  'birthday.promptReadFailed': 'We could not check who has a birthday coming up. Refresh the page.',
  'birthday.isToday': 'Today',
  'birthday.inDays': 'In {days} days · {on}',
  'birthday.saySomething': 'Say something',
  'birthday.notThisYear': 'Not this year',
  'birthday.notThisYearFor': 'Put away the birthday prompt for {name}',
  'birthday.suggestedTitle': 'Happy birthday, {name}!',
  'birthday.suggestedBody': 'Wishing {name} a wonderful birthday from all of us.',
  'birthday.editFirst': 'Change any of this before you post it — it goes out in your name, not ours.',
  'birthday.postGreeting': 'Post it',
  'birthday.posting': 'Posting…',
  'act.chooseRelative': 'Choose a relative.',
  'act.greetingPosted': 'Posted. It is pinned to the family board for the next two days.',
  'act.greetingPostedNotRecorded': 'Posted — but we could not record it, so you may be asked again.',
  'act.promptPutAway': 'Put away for this year.',
  'act.couldNotPostThat': 'We could not post that. Try again.',
  'bill.chooseMonths': 'Choose between 1 and {max} months.',
  'bill.notOnSale': '{plan} is not on sale yet.',
  'bill.notBuyableThisWay': '{plan} cannot be bought this way yet.',
  'bill.notBuyableMonthly': '{plan} cannot be bought monthly yet.',
  'bill.notBuyableYet': '{plan} cannot be bought yet.',
  'bill.useChangePlanInstead':
    'Moving down to {plan} costs nothing — use Change plan. It takes effect when the term you have paid for ends.',
  'bill.tooFewDaysOne':
    'Only 1 day is left this month, which is too small a charge to take on its own. Choose the option that covers this month and next.',
  'bill.tooFewDaysMany':
    'Only {days} days are left this month, which is too small a charge to take on its own. Choose the option that covers this month and next.',
  'bill.checkoutSubmitCovers':
    '{amount} today covers you to the end of {month}. {plan} then renews at {monthly} a month, on the 1st.',
  'bill.alreadyOnPlan': 'This family is already on {plan}.',
  'bill.startsOnNextBilling':
    '{plan} starts on {on} — the next billing date. Nothing changes before then, and there is no refund for the days already paid for.',
  'bill.effectOnceDifferencePaid':
    '{plan} takes effect as soon as the extra amount is paid. Stripe is charging the difference for the rest of this period now.',
  'bill.planStopsOn':
    'The plan stops on {on}. Every page stays open until then. What the cheaper plan does not '
    + 'include is kept for sixty days after that, and deleted if you have not moved back.',
  'bill.startsOnNoRefund':
    '{plan} starts on {on}. Nothing changes before then, and there is no refund for the term already paid for.',
  'bill.activeNowCredit':
    '{plan} is active now, paid through {through}. What was left of the old term — {credit} — is held as credit against your next invoice.',
  'bill.activeNowExact':
    '{plan} is active now, paid through {through}. The term you had already paid for covered it exactly.',
  'bill.openingStripeToCollect': 'Opening Stripe to collect {amount}.',
  'bill.priceMisconfigured':
    '{plan} is not set up correctly for {way} on this deployment. Nothing has been charged. Please report this rather than retrying.',
  'bill.wayMonthly': 'monthly payment',
  'bill.wayInAdvance': 'payment in advance',
  'tmpl.addStepTo': 'Add a step to {template}',
  'tmpl.editStepQuoted': 'Edit “{step}”',
  'tmpl.deleteStepConfirm':
    'Delete the “{step}” step from {template}? Any task already created from it keeps its own wording, its assignee and its answer — only the template loses the step. This cannot be undone.',
  'tmpl.editTemplateAria': 'Edit the {template} template',
  'tmpl.unarchiveTitle': 'Put {template} back in the schedule-from list',
  'tmpl.archiveTitle':
    'Take {template} out of the schedule-from list, leaving every gathering as it is',
  'tmpl.cannotDeleteUsedOne':
    '{template} has been used to build 1 gathering, so it cannot be deleted. Archive it instead.',
  'tmpl.cannotDeleteUsedMany':
    '{template} has been used to build {n} gatherings, so it cannot be deleted. Archive it instead.',
  'tmpl.deleteTemplateAria': 'Delete the {template} template',
  'tmpl.editStepAria': 'Edit the “{step}” step',
  'tmpl.moveStepEarlierIn': 'Move “{step}” earlier in {template}',
  'tmpl.moveStepEarlier': 'Move “{step}” earlier',
  'tmpl.moveStepLaterIn': 'Move “{step}” later in {template}',
  'tmpl.moveStepLater': 'Move “{step}” later',
  'tmpl.deleteStepAria': 'Delete the “{step}” step',
  'plan.downgradeConfirmTitle': 'Downgrade this family to {plan}?',
  'plan.whatYouGainOn': 'What you gain on {plan}',
  'plan.whatYouHaveNowOn': 'What you have now on {plan}',
  'plan.whatYouKeepOn': 'What you keep on {plan}',
  'plan.whatYouGetTitle': '{plan} — what you get',
  'plan.includedInYours':
    'Included in {plan}, which your family is on. Everything here is switched on.',
  'plan.yourFamilyIsOnWhatAdds':
    'Your family is on {current}. Here is what {plan} would add, beside what you already have.',
  'plan.rateSetUpInBilling': '{rate} It is set up in the Billing section of Settings.',
  'plan.rateNoPaymentStep': '{rate} There is no payment step yet — nothing here is billed.',
  'plan.whatPlanAdds': 'What {plan} adds',
  'plan.whatPlanIncludes': 'What {plan} includes',
  'plan.whatYouWouldGainOn': 'What you would gain on {plan}',
  'plan.alsoIncludedFrom': 'Also included, from {plan}',
  'perm.scope.none': '—',
  'perm.scope.own': 'Own',
  'perm.scope.any': 'All',
  'perm.action.view': 'View',
  'perm.action.create': 'Create',
  'perm.action.edit': 'Edit',
  'perm.action.delete': 'Delete',
  'perm.verb.view': 'view',
  'perm.verb.create': 'create',
  'perm.verb.edit': 'edit',
  'perm.verb.delete': 'delete',
  'perm.grantedPair': '{action} {scope}',
  'perm.whoMayAction': '{resource} — who may {verb}',
  'perm.switchTitle': '{resource} · {verb} · {scope}',
  'access.actionsFor': 'Actions for {name}',
  'access.applyTemplateConfirm':
    'Put {name} on “{template}”? Their access becomes exactly what that template grants.',
  'access.applyTemplateConfirmReplacing':
    'Put {name} on “{template}”? Their access becomes exactly what that template grants, replacing “{previous}”.',
  'access.enableConfirm':
    'Switch {name}’s access back on? They regain everything their template grants.',
  'access.disableConfirm':
    'Switch off {name}’s access? They keep their account and their profile, but can see nothing in this family until you switch it back on.',
  'access.copyStartsFrom':
    'The new template starts with exactly what {template} grants today. It is a copy, not a link — changing one afterwards leaves the other alone.',
  'access.renameTemplateConfirm': 'Rename “{from}” to “{to}” and save its description?',
  'access.saveTemplateConfirm': 'Save your changes to “{template}”?',
  'access.templateStillHasOne':
    '“{template}” still has 1 member. Move them to another template first.',
  'access.templateStillHasMany':
    '“{template}” still has {n} members. Move them to another template first.',
  'access.deleteTemplateConfirm': 'Delete “{template}”? This cannot be undone.',
  'access.setGrantConfirm': 'Set “{template}” to {action} {scope} on {resource}? {applies}',
  'access.setGrantNotAllowed':
    'Set “{template}” so {resource} is not allowed for {verb}? {applies}',
  'access.appliesToOne': 'This applies to the 1 member on the template.',
  'access.appliesToMany': 'This applies to all {n} members on the template.',
  'elec.boardReadFailed': 'Could not read this family’s board positions. Try again.',
  'elec.level.national': 'national',
  'elec.level.regional': 'regional',
  'elec.level.chapter': 'chapter',
  'elec.wrongLevelOne':
    '{titles} is not a {level} board position. A {level} election can only fill {level} offices — add or re-scope the position under Members › Organization first.',
  'elec.wrongLevelMany':
    '{titles} are not {level} board positions. A {level} election can only fill {level} offices — add or re-scope the positions under Members › Organization first.',
  'elec.createdWithoutPositions': 'The election was created but its positions were not: {error}',
  'elec.savedWithoutPositions': 'The election was saved but its positions were not: {error}',
  'elec.announceWholeFamily': 'A new election, “{title}”, is open to the whole family.',
  'elec.announceForArea': 'A new election, “{title}”, is for {where}.',
  'elec.nominationsOpenOn': 'Nominations open {on}.',
  'elec.cannotUnpublish':
    'This election already has {nominations} nomination(s) and {votes} vote(s), so it cannot be taken back to draft. Let it run, or delete it — which removes every nomination and vote with it.',
  'elec.nominationsNotOpenedYet': 'Nominations have not opened yet.',
  'elec.notPublishedYet': 'This election has not been published yet.',
  'elec.nominationsClosedOn': 'Nominations closed on {on}.',
  'elec.nominationsClosed': 'Nominations are closed.',
  'elec.votingClosedOn': 'Voting closed on {on}.',
  'elec.votingOpensOn': 'Voting opens {on}.',
  'elec.votingNotOpen': 'Voting is not open.',
  'elec.thisPosition': 'this position',
  'elec.standDownFrom': 'Stand down from {position}?',
  'elec.retractOthersStayOne':
    '{name} was also nominated by 1 other member, so they stay on the ballot for {position} — only your name comes off.',
  'elec.retractOthersStayMany':
    '{name} was also nominated by {n} other members, so they stay on the ballot for {position} — only your name comes off.',
  'elec.retractOnlySupporter':
    'You are the only person who nominated {name} for {position}, so they will come off the ballot.',
  'elec.standingOne': '1 person nominated',
  'elec.standingMany': '{n} people nominated',
  'elec.toBeElected': '{n} to be elected',
  'elec.nominateFor': 'Nominate for {position}',
  'elec.onlyAreaMayBeNominated': 'Only {where} may be nominated in this election.',
  'elec.nobodyInAreaYet': 'Nobody in {where} can be nominated yet.',
  'elec.nominatedByYou': 'nominated by you',
  'elec.nominatedByYouAndOne': 'nominated by you and 1 other',
  'elec.nominatedByYouAndMany': 'nominated by you and {n} others',
  'elec.onTheBallot': 'on the ballot',
  'elec.nominatedByOne': 'nominated by 1 member',
  'elec.nominatedByMany': 'nominated by {n} members',
  'chk.payForPlan': 'Pay for {plan}',
  'chk.shortMonthCombinedOne':
    'Only 1 day is left this month, which is too small a charge to take on its own — so the first payment covers {through}. The next payment is then {next}.',
  'chk.shortMonthCombinedMany':
    'Only {days} days are left this month, which is too small a charge to take on its own — so the first payment covers {through}. The next payment is then {next}.',
  'chk.throughDate': 'through {date}',
  'chk.nextMonthToo': 'next month too',
  'chk.onTheFirst': 'on the 1st',
  'chk.everyPaymentOnFirst':
    'Either way, every payment after the first is on the 1st — the next one {next}.',
  'chk.isDate': 'is {date}',
  'chk.isFirstOfNextMonth': 'is the 1st of next month',
  'chk.upgradeToPlan': 'Upgrade to {plan}',
  'chk.payNowAmount': 'Pay {amount} now',
  'chk.throughEndOfThisMonth': '{plan} through the end of this month.',
  'chk.coverNextTooAmount': 'Cover next month too — {amount}',
  'chk.throughEndOfNextMonth': '{plan} through the end of next month.',
  'chk.upgradeNothingToPay': 'Upgrade to {plan} — nothing to pay',
  'chk.upgradePayAmount': 'Upgrade to {plan} — pay {amount}',
  'dues.freq.annual': 'annual',
  'dues.freq.semi-annual': 'semi-annual',
  'dues.freq.quarterly': 'quarterly',
  'dues.freq.monthly': 'monthly',
  'dues.freq.one-time': 'one-time',
  'dues.cad.weekly': 'Weekly',
  'dues.cad.monthly': 'Monthly',
  'dues.cad.quarterly': 'Quarterly',
  'dues.cad.annual': 'Annual',
  'dues.cad.one-time': 'One-time',
  'dues.cadWord.weekly': 'weekly',
  'dues.cadWord.monthly': 'monthly',
  'dues.cadWord.quarterly': 'quarterly',
  'dues.cadWord.annual': 'annual',
  'dues.cadWord.one-time': 'one-time',
  'agat.removeTemplateConfirm':
    'Take “{template}” off this gathering? Its steps that nobody has been given yet are deleted. If any of them has been assigned or answered, nothing is removed and you will be told how many — reassign or approve those first.',
  'agat.deleteConfirm':
    'Delete “{title}”? Every task on it goes with it, and so does every answer and note anybody has written. If it is simply not happening, set its status to Cancelled instead — nothing is lost and it can be reopened. This cannot be undone.',
  'agat.startedBy': 'started by {name}',
  'agat.approvedOfTotal': '{approved} of {total} approved',
  'agat.waitingForReview': '{n} waiting for review',
  'agat.sentBackCount': '{n} sent back',
  'agat.dayHappensOn': 'The day “{segment}” happens on',
  'agat.whereHeld': 'Where “{segment}” is held',
  'agat.removeSegment': 'Remove {segment} from this gathering',
  'agat.approveConfirm':
    'Approve “{task}” on {gathering}? Approving is final — it becomes the family’s record of it and the person who submitted it cannot change it afterwards. Send it back instead if anything still needs work.',
  'agat.theHolder': 'the person holding it',
  'agat.nobodyUnassigned': 'nobody, because it is unassigned',
  'agat.notesBack': 'Notes back: {notes}',
  'agat.whoeverHoldsIt': 'whoever holds it',
  'agat.sentWithTaskRequired':
    'Sent with the task to {name}. A task handed back with no notes leaves them nothing to act on, which is why this is required.',
  'agat.approvedRecordNote':
    'It is the family’s record of {task} and the person who submitted it cannot change it. Reopen it if it has to change — the answer and every submission stay exactly as they are, and it goes back to them to edit.',
  'agat.sentWithTaskTo': 'Sent with the task to {name}.',
  'agat.nobodyUnassignedTold': 'nobody — this task is unassigned, so nobody is told',
  'plan.optOutOf': 'Opt out of {schedule}?',
  'plan.optBackInTo': 'Opt back in to {schedule}?',
  'plan.optBackInHint':
    '{schedule} will count toward what you owe again, at {amount} per {cadence} installment.',
  'plan.stopAutoHint':
    'No further card payments will be taken for {schedule}. Everything you have already paid stays on your record.',
  'plan.includesOverdueOne': 'Includes 1 installment due since {since}',
  'plan.includesOverdueMany': 'Includes {n} installments due since {since}',
  'plan.startsWhenYouTurn': 'Starts {date}, when you turn {age}',
  'plan.termsProrated': '{now} this year · {full}/yr after · {frequency}',
  'plan.termsPlain': '{amount}/yr · {frequency}',
  'plan.optionsFor': 'Options for {schedule}',
  'plan.changeCadenceHint':
    'How often you pay {schedule}. The annual total does not change — the cadence divides it.',
  'plan.thenEachTime': ', then {amount} each time',
  'plan.enterAmountFor': 'Enter an amount for {schedule}, or zero to leave it out.',
  'plan.mostThatCanBePaid': 'The most that can be paid on {schedule} is {amount}.',
  'plan.coversEarlierOne': 'covers 1 earlier installment',
  'plan.coversEarlierMany': 'covers {n} earlier installments',
  'plan.payAmountByCard': 'Pay {amount} by card',
  'plan.payCadenceFor': 'Pay cadence for {schedule}',
  'plan.perInstallment': 'per installment',
  'plan.nextPaymentCovering': 'Next payment {amount}, covering what has come due so far',
  'plan.payAmountNext': 'Pay {amount} next',
  'tree.unattachedLede':
    '{who} in the family but not connected to anybody, so they do not appear anywhere above. Click a name to centre the tree on them, then fill in the relatives around them.',
  'tree.rosterLede':
    'The tree above shows the four generations around one person. Click anybody here to centre it on them.',
  'tree.rosterFollowsFilter': 'This list follows the Bloodline filter too.',
  'tree.moreInGeneration': '+ {n} more in this generation. Find them under',
  'tree.removeLinkConfirm':
    'Remove the link between {a} and {b}? This only removes the connection — nobody is removed from the family, and nothing they have recorded is deleted.',
  'tree.addSomeonesFather': 'Add {who}’s father',
  'tree.addSomeonesMother': 'Add {who}’s mother',
  'tree.addAnother': 'Add another {relation}',
  'tree.withPerson': 'With {name}',
  'tree.noChildrenWith': 'No children recorded with {name}.',
  'tree.someonesSiblings': '{name}’s brothers and sisters',
  'tree.editRecordAria': 'Edit {name}’s record, or invite them',
  'tree.removeConnectionAria': 'Remove the connection to {name}',
  'gal.imagesReadyOne': '1 image ready',
  'gal.imagesReadyMany': '{n} images ready',
  'gal.notAnImageFormat': '{name} is not {formats} — it will be skipped.',
  'gal.moreKeepTyping': '{n} more — keep typing to narrow it.',
  'gal.deletePhotoNamedConfirm':
    'Delete “{caption}”? It is removed for everyone, along with its tags, and the image file goes too. This cannot be undone.',
  'gal.photographsAddedOne': '1 photograph added.',
  'gal.photographsAddedMany': '{n} photographs added.',
  'gal.addedSomeFailed': '{added} added. {failed} did not: {reasons}',
  'gal.formatsAndSize': '{formats}, up to 10 MB each.',
  'gal.uploadOne': 'Upload photograph',
  'gal.uploadMany': 'Upload {n} photographs',
  'gal.removeTagForConfirm': 'Remove the tag for {name} from this photograph?',
  'gal.addedByName': 'Added by {name}',
  'gal.removeTagForAria': 'Remove the tag for {name}',
  'staff.makeOwnerTitle': 'Make {name} an owner?',
  'staff.takeOwnerTitle': 'Take owner access away from {name}?',
  'staff.makeOwnerBody':
    '{name} will be able to grant staff access, change what kind anybody has, and take it away — including yours. Nothing else about what they can see changes.',
  'staff.takeOwnerBodyOne':
    '{name} keeps the console and everything it reads, and loses this screen: they will not be able to grant staff access to anybody. That leaves 1 owner.',
  'staff.takeOwnerBodyMany':
    '{name} keeps the console and everything it reads, and loses this screen: they will not be able to grant staff access to anybody. That leaves {n} owners.',
  'staff.changeToRole': 'Change to {role}',
  'staff.removeAccessTitle': 'Remove staff access for {name}?',
  'staff.removeAccessBody':
    '{name} loses the whole console on their next request: every page in it answers 404 for them, exactly as it does for a customer. Nothing about their own account or their family memberships changes. The reason recorded for this grant goes with the row and is not kept anywhere, so if they need access again it is a new grant with a new reason.',
  'dist.stopSendingTitle': 'Stop sending “{subject}”?',
  'dist.stopSendingBody':
    '{sent} of {total} relatives have already been emailed. Those messages have gone and cannot be recalled. The rest will not be sent.',
  'dist.stopSending': 'Stop sending',
  'dist.deleteRecordTitle': 'Delete the record of “{subject}”?',
  'dist.relativesCount': '{n} relatives',
  'dist.notInAudience': '{n} not in this audience',
  'dist.noEmailOnFile': '{n} with no email address on file',
  'dist.deleteRecordAria': 'Delete the record of {subject}',
  'dist.willBeEmailedOne': '1 relative will be emailed',
  'dist.willBeEmailedMany': '{n} relatives will be emailed',
  'dist.unreachableMoreOne':
    '. 1 more is on the family tree without an email address and cannot be emailed.',
  'dist.unreachableMoreMany':
    '. {n} more are on the family tree without an email address and cannot be emailed.',
  'dist.preparing': 'Preparing…',
  'dist.sendToCount': 'Send to {n}',
  'dist.notInAudienceOne': '1 relative was not in this audience.',
  'dist.notInAudienceMany': '{n} relatives were not in this audience.',
  'ael.droppedOne': '{titles} is not a {level} office, so it has been cleared.',
  'ael.droppedMany': '{titles} are not {level} offices, so they have been cleared.',
  'ael.publishBody':
    '“{title}” goes on the calendar for {where}. Nominations open {opens} and voting closes {closes}; both windows open and close on their own from then on.',
  'ael.announcementWillBePosted': ' An announcement will be posted.',
  'ael.returnToDraftBody':
    'Take “{title}” off the family’s calendar and back to a draft? Nobody has been nominated and nothing has been voted on, so nothing is lost.',
  'ael.deleteWithVotesBody':
    'Delete “{title}”, its {nominations} nomination(s) and its {votes} vote(s)? This cannot be undone.',
  'ael.deleteBody': 'Delete “{title}” and all of its positions? This cannot be undone.',
  'ael.removePositionAria': 'Remove position {n}',
  'ael.noOfficesAtLevel':
    'No {level} offices recorded yet. Add them under Members › Organization first.',
  'chk.monthlyBlurb':
    '{amount} a month, taken on the 1st, until you stop it. Change or stop it whenever — what you have already paid for stays open.',
  'chk.payRemainderOne': 'Pay {amount} for the 1 day left this month',
  'chk.payRemainderMany': 'Pay {amount} for the {days} days left this month',
  'chk.payRestAndNext': 'Pay {amount} for the rest of this month and next',
  'chk.inAdvanceBlurb':
    'One payment covering the rest of this month plus whole months after it, up to {max}. Nothing renews it, so nothing is charged again until you choose to.',
  'chk.payNowSimple': 'Pay {amount} now',
  'chk.prorationBreakdownOne':
    '{proration} for the 1 day left this month, plus {months} for {n} whole month.',
  'chk.prorationBreakdownMany':
    '{proration} for the {days} days left this month, plus {months} for {n} whole months.',
  'chk.yourTermUnused': 'Your {plan} term, unused',
  'chk.paidThroughDate': 'Paid through {date}',
  'chk.nextPaymentDate': 'Next payment {date}',
  'agat.noBudgetFund': 'No budget · {fund}',
  'agat.overBy': 'Over by {amount}',
  'agat.overWithOthersBy': 'Over with the other gatherings on this fund by {amount}',
  'agat.approveRowConfirm':
    'Approve “{task}” on {gathering}? Approving is final — the answer is the family’s record of it and the person who submitted it cannot change it afterwards. Send it back instead if anything still needs work.',
  'agat.whoeverHoldsThisTask': 'whoever holds this task',
  'agat.sentToWithTask':
    'Sent to {name} with the task. A task sent back with no notes leaves them nothing to act on, which is why this is required.',
  'agat.chosenTemplatesOne':
    '1 chosen · its steps become this gathering’s tasks, in the order shown',
  'agat.chosenTemplatesMany':
    '{n} chosen · their steps become this gathering’s tasks, in the order shown',
  'agat.createdStepsFailed':
    'Created, but the steps from {templates} could not be added. Add the template again from the gathering.',
  'agat.templateArchived': '“{template}” has been archived and cannot start a new gathering',
  'agat.cannotDeleteAnsweredOne':
    '1 task on “{title}” has been answered, so it cannot be deleted. Set its status to Cancelled instead — nothing is lost and it can be reopened.',
  'agat.cannotDeleteAnsweredMany':
    '{n} tasks on “{title}” have been answered, so it cannot be deleted. Set its status to Cancelled instead — nothing is lost and it can be reopened.',
  'agat.savedOutsideOneDay': 'Saved. That day is outside the gathering, which is on {on}.',
  'agat.savedOutsideRange': 'Saved. That day is outside the gathering, which runs {from} to {to}.',
  'agat.templateAlreadyPart': '“{template}” is already part of this gathering',
  'agat.couldNotAddSteps':
    'Could not add the steps from {templates}. Nothing was changed — try again.',
  'agat.templateNotPart': '“{template}” is not part of this gathering',
  'agat.cannotRemoveInFlightOne':
    '1 task from this template has been assigned or answered, so it cannot be removed. Reassign or approve them first.',
  'agat.cannotRemoveInFlightMany':
    '{n} tasks from this template have been assigned or answered, so it cannot be removed. Reassign or approve them first.',
  'budget.claimedByOthers': '{amount} of it is claimed by other gatherings',
  'budget.theFund': 'the fund',
  'budget.overFundSentence': '{budget} is {over} more than {fund} holds.',
  'budget.overWithOthersSentence':
    'Other live gatherings already claim {others} of the same fund, so {total} is committed against {fund} — {over} more than it holds.',
  'budget.overAllocatedSentence':
    'The task budgets add up to {lines}, which is {over} more than this gathering budgeted. Nothing has been spent — raise the budget or trim a task line.',
  'fnd.routingGapUnder':
    '{percent}% more to go — add it to any fund below, or spread it across several.',
  'fnd.routingGapOver': 'That is {percent}% over. Take it off one of the funds below.',
  'fnd.deleteNamedBody':
    'Delete the fund “{name}”? Its balance of {balance} and its milestones go with it. This cannot be undone.',
  'fnd.openNamedBody': 'Let members contribute to “{name}” directly?',
  'fnd.closeNamedBody': 'Stop members from contributing to “{name}” directly?',
  'fnd.deleteMilestoneNamedBody':
    'Delete the milestone “{name}” ({amount})? This cannot be undone.',
  'fnd.minimumBalanceFor': 'Minimum balance for {fund}',
  'fnd.allocationPercentFor': 'Allocation percent for {fund}',
  'proj.expectedThisYear': 'Expected this year',
  'proj.collected': 'Collected',
  'proj.waived': 'Waived',
  // ── THE TWO PROJECTION TABLES' COLUMN HEADINGS ────────────────────────────────────
  // Added 2026-08-31 with sorting. Ten headings on `/reporting/dues-projections` were bare
  // English literals in all three languages — the lone-capitalised-word class AGENTS.md says
  // `i18n:literals` structurally cannot see and only the render diff can. `proj.collected` and
  // `proj.waived` above already existed for the figure tiles at the top of the same screen and
  // are reused rather than duplicated: same word, same screen, same meaning.
  'proj.colPaying': 'Paying',
  'proj.colExpected': 'Expected',
  'proj.colOutstanding': 'Outstanding',
  'proj.colStanding': 'Standing',
  'proj.colDues': 'Dues',
  'proj.colPaid': 'Paid',
  'proj.stillToCollect': 'Still to collect',
  'proj.oweSomethingOne': '1 of {total} members owes something',
  'proj.oweSomethingMany': '{paying} of {total} members owe something',
  'proj.percentOfBilled': '{percent}% of what was billed, waivers included',
  'proj.nothingBilledYet': 'Nothing billed yet',
  'proj.waivedCaption': 'Forgiven — settles the due, and is not income',
  'proj.everybodyUpToDate': 'Everybody is up to date',
  'proj.outstandingOne': '1 member has something outstanding',
  'proj.outstandingMany': '{n} members have something outstanding',
  'proj.pendingSettlement':
    '{amount} is awaiting settlement — started and not yet confirmed. It is not counted as collected, and it has not been taken off what is still owed.',
  'proj.thatPartOfTheFamily': 'that part of the family',
  'proj.scopeEmptyNote':
    'Nobody owes this: no member of the family is in {where}. Members choose their chapter on their own profile, and anybody with no chapter is under National.',
  'proj.fullYear': 'Full year',
  'proj.leastSettledFirst': 'Least settled first. {shown} of {total} shown.',
  'ann.deleteNamedBody':
    'Delete “{title}”? Members will no longer see it, on the board or in their updates. This cannot be undone.',
  'ann.unpinNamedBody':
    'Unpin “{title}”? It stays on this board and stops riding at the top of everyone’s Recent Updates.',
  'ann.pinNamedBody':
    'Pin “{title}” to the top of every member’s Recent Updates? Each of them can dismiss it for themselves afterwards.',
  'ann.unpin': 'Unpin',
  'ann.pin': 'Pin',
  'ann.hideFromMyUpdates': 'Hide “{title}” from the top of your own updates',
  'ann.showInMyUpdates': 'Show “{title}” at the top of your own updates again',
  'ann.unpinForEveryone': 'Unpin “{title}” for everyone',
  'ann.pinForEveryone': 'Pin “{title}” for everyone',
  'org.deleteRegionMovingOne':
    'Delete the {name} region? Its chapter moves to National, and every member in them stays exactly where they are. This cannot be undone.',
  'org.deleteRegionMovingMany':
    'Delete the {name} region? Its {n} chapters move to National, and every member in them stays exactly where they are. This cannot be undone.',
  'org.deleteRegionBody': 'Delete the {name} region? This cannot be undone.',
  'org.deleteChapterBody': 'Delete the {name} chapter? This cannot be undone.',
  'org.deleteRegionTitleAttr': 'Delete the {name} region',
  'org.deleteChapterTitleAttr': 'Delete the {name} chapter',
  'org.underNationalOne': '1 chapter is under National.',
  'org.underNationalMany': '{n} chapters are under National.',
  'org.memberPicksChapter': 'A member picks their chapter on their own profile.',
  'inc.ageProrationHint':
    'A member owes nothing until they turn {age}, then the months of that year after their birthday — and the full amount every year after. Anyone with no date of birth recorded owes it in full.',
  'inc.beneficiaryHint':
    'Anyone named here cannot see this drive anywhere in {app} — not the goal, not the progress, not a single gift to it. That holds for administrators too, so a collection can be kept from the person it is meant to surprise. Everyone else sees who it is for.',
  'inc.descriptionPlaceholder': 'What this {noun} is for…',
  'inc.applyEditsDonation': 'Apply your edits to “{label}” (goal {goal})?',
  'inc.applyEditsDues': 'Apply your edits to “{label}” ({amount} {frequency})?',
  'inc.deleteNamedBody':
    'Delete the {noun} “{label}” ({amount} {frequency})? This cannot be undone.',
  'inc.deleteThisBody': 'Delete this {noun}? This cannot be undone.',
  'inc.deleteNoun': 'Delete {noun}',
  'pos.holdersBlockOne': '1 person holds “{name}”. Take it away from them first.',
  'pos.holdersBlockMany': '{n} people hold “{name}”. Take it away from them first.',
  'pos.removeNamedLede': 'Remove “{name}” from the positions your family keeps? ',
  'pos.renameAria': 'Rename the {name} position',
  'pos.heldBlockTitleOne': '1 person holds this — take it away from them first',
  'pos.heldBlockTitleMany': '{n} people hold this — take it away from them first',
  'pos.cannotRemoveAriaOne': 'Cannot remove the {name} position: 1 person holds it',
  'pos.cannotRemoveAriaMany': 'Cannot remove the {name} position: {n} people hold it',
  'pos.removeAria': 'Remove the {name} position',
  'inv.invitedNamed': '{name}, you have been invited to {family}',
  'inv.invitedAnon': 'You have been invited to {family}',
  'inv.sentToHasAccount':
    'This invitation was sent to {email}, which already has a {app} account. Sign in and you will come straight back here and join — you will not need a family code, this invitation is your way in.',
  'inv.sentToNoAccount':
    'This invitation was sent to {email}. Create an account with that address to accept it — you will not need a family code, this invitation is your way in. Already have an account? Sign in and you will come straight back here.',
  'inv.thisAccount': 'this account',
  'inv.sentToOnlyThatAddress':
    'It was sent to {email}, and only that address can accept it — that is what stops a forwarded link working for anyone else. You are signed in as {account}.',
  'tasks.waitingOne': '1 task is waiting on you',
  'tasks.waitingMany': '{n} tasks are waiting on you',
  'tasks.needAnotherLookOne': '1 needs another look',
  'tasks.needAnotherLookMany': '{n} need another look',
  'tasks.wasDue': 'Was due {date}',
  'tasks.due': 'Due {date}',
  'tasks.sentBackHelpLabel': 'What happens when a task comes back',
  'tasks.answerFinal': '{status} — this answer is final.',
  'tasks.yourNote': 'Your note: {note}',
  'tasks.yourAnswerFor': 'Your answer for {task}',
  'gath.shapeContinuous': 'One continuous block',
  'gath.shapeContinuousHint':
    'A reunion running Friday evening to Sunday lunchtime. It draws as one bar across those days on the calendar.',
  'gath.shapeSeparate': 'Separate days, same gathering',
  'gath.shapeSeparateHint':
    'A committee meeting on three Saturdays. Each day draws as its own entry, all carrying this gathering’s title.',
  'gath.removeDayAria': 'Remove day {n}',
  'gath.everyDayOwnEntry':
    'Every day here is its own entry on the calendar, all named this gathering.',
  'rel.siblingNeedsSharedParent':
    'Nobody is recorded as {name}’s parent yet, so this brother or sister will not show '
    + 'under {view} — the tree has been told they are siblings, not whose children they '
    + 'are. Record the parent they share on both of them and both appear there.',
  'rel.shareParentsQuestion': 'Do they share {name}’s parents?',
  'rel.whoElseIsParent': 'Who else is a parent of this {relation}?',
  'rel.tickingRecordsParent':
    'Ticking somebody records the parent link too, so this person appears on their card as well — not only beside {name}.',
  'rel.whoIsWhose': 'Who is {name}’s {relation}?',
  'rel.dateOfBirth': 'Date of birth',
  'rel.dateOfBirthOptional': 'Date of birth (optional)',
  'elec.vote': 'Vote',
  'elec.thisNominee': 'this nominee',
  'elec.voteConfirm': '{action} for {nominee} as {position}?',
  'elec.nominationRespondConfirm':
    '{action} the nomination for {position}? This cannot be changed.',
  'elec.theyOpenOn': 'They open {date}.',
  'elec.nominationsClosedOnPlain': 'Nominations closed on {date}.',
  'elec.votingOpensOnPlain': 'Voting opens {date}.',
  'elec.votingClosedOnPlain': 'Voting closed on {date}.',
  'pay.maxItems': 'Up to {max} dues can be paid in one go. Pay some of them separately.',
  'pay.nothingLeftOn': 'There is nothing left to pay on {schedule}.',
  'pay.moreThanOwed':
    'That is more than is owed. The most that can be paid on {schedule} is {amount}.',
  'pay.feeLineName': 'Card processing fee',
  'pay.feeLineDesc': 'So the full amount reaches your family',
  'pay.driveClosed': '{drive} has closed. Nothing more can be given to it.',
  'pay.maxCharge': 'A single card payment cannot be more than {amount}. Give it in two.',
  'rep.elecOpenNow': '{n} open now · published only',
  'rep.elecNominations': 'Nominations',
  'rep.elecAcrossEvery': 'across every election',
  'rep.elecEmptyMessage': 'No election has been published yet.',
  'rep.elecEmptyHint':
    'Once one is published, this reports its turnout, its nominations and any office nobody stood for.',
  'rep.elecAcceptedOf': '{accepted} of {total} accepted',
  'rep.elecNobodyStanding': '{n} with nobody standing',
  'rep.elecUnopposedOne': '1 office unopposed',
  'rep.elecUnopposedMany': '{n} offices unopposed',
  'rep.elecNotApplicableNote': ' rather than 0% — nobody could have voted in it.',
  'pms.noMembersYet': 'No members to choose from yet.',
  'pms.searchMembers': 'Search {n} members…',
  'pms.noMatch': 'No member matches “{query}”.',
  'pms.totalOne': '1 member',
  'pms.totalMany': '{n} members',
  'pms.shownOfTotal': '{shown} of {total} shown',
  'pms.moreKeepTyping': '{n} more — keep typing to narrow',
  'meet.comingUp': 'Coming up',
  'meet.held': 'Held',
  'meet.topicsOne': '1 topic',
  'meet.topicsMany': '{n} topics',
  'meet.stepOf': 'Step {step} of {total} · {name}',
  'meet.allAdultsInFamily': 'That is all {n} adults in the family.',
  'meet.nobodyUnderEighteen': 'Nobody under eighteen is invited to a meeting.',
  'meet.inTheRoomOne': '1 person in the room — see who',
  'meet.inTheRoomMany': '{n} people in the room — see who',
  'notes.deleteEntryNamedBody':
    'Delete “{title}”? Every note under it goes too, for everybody who holds this office, now and later. This cannot be undone.',
  'notes.chapterWord': 'chapter',
  'notes.regionWord': 'region',
  'notes.everyoneHoldingReads':
    '{who} {office} reads this journal, whichever {area} they hold it for.',
  'notes.thisOffice': 'this office',
  'notes.nothingRecordedFor': 'Nothing recorded for {office} yet.',
  'notes.newEntry': 'New entry',
  'notes.newEntryForOffice': 'New entry — {office}',
  'bday.noneMatchName': 'No birthday in the next {days} days matches that name.',
  'bday.inDays': 'in {n} days',
  'bday.shownOfTotal': '{shown} of {total} shown',
  'bday.countOne': '1 birthday in the next {days} days',
  'bday.countMany': '{n} birthdays in the next {days} days',
  'bday.discreetNote': '{emoji} stands in for an age between {min} and {max}',
  'pos.chooseWhichChapter': 'Choose which chapter',
  'pos.chooseWhichRegion': 'Choose which region',
  'pos.takeAwayNamedLede': 'Take “{position}” away from {name}? ',
  'pos.somebodysPositions': '{name}’s positions',
  'pos.takeAwayAria': 'Take {position} away from {name}',
  'fnd.builtInCannotSwitchOff': '{name} is built in and cannot be switched off.',
  'fnd.builtInCannotDelete':
    '{name} is built in and cannot be deleted. Every donation the family receives is held here.',
  'fnd.allocationsMustTotal': 'Allocations must total 100% (currently {percent}%)',
  'fnd.couldNotReadBalance': 'Could not read the balance of {name}',
  'fnd.holdsTransferLess': '{name} holds {amount}. Transfer that or less.',
  'rep.meetings': 'Meetings',
  'rep.meetRelativesAskedOne': '1 relative asked to one',
  'rep.meetRelativesAskedMany': '{n} relatives asked to one',
  'rep.minuted': 'Minuted',
  'rep.meetReachedAVote': '{n} reached a vote',
  'rep.meetOnePerTopic': 'one per topic answered',
  'rep.meetEmptyMessage': 'The family has not held a meeting yet.',
  'rep.meetEmptyHint':
    'Once one is scheduled, this reports who was in the room, what was taken up, and how the votes went.',
  'rep.meetVotedOn': '{n} voted on',
  'safety.deleteNamedBody':
    '“{title}” and the record of who answered will be removed. Nobody will be able to see who was asked, who said they were safe, or who was never reached.',
  'safety.raisedBy': 'raised by {name}',
  'safety.askRemaining': 'Ask the remaining {n}',
  'safety.unreachableOne':
    '1 relative has no email address on file. Somebody will need to telephone them.',
  'safety.unreachableMany':
    '{n} relatives have no email address on file. Somebody will need to telephone them.',
  'slice.descriptionOne': '{chart} · 1 member · {percent}% of the family',
  'slice.descriptionMany': '{chart} · {n} members · {percent}% of the family',
  'slice.invitedNotEmailed': '{name} was invited, but the email could not be sent. ',
  'slice.invited': '{name} has been invited.',
  'slice.birthdayRecorded': '{name}’s date of birth recorded.',
  'pend.waitingOnFamilies':
    'You are waiting on {n} families. Each one is reviewed by its own administrators, so they may not answer at the same time.',
  'pend.sentTo': 'Sent to {family}',
  'pend.askToLookAgain': 'Ask {family} to look again',
  'pend.meantimeFillIn': 'In the meantime you can fill in',
  'gal.deleteAlbumWithPhotosOne':
    'This deletes the album AND the 1 photograph in it, for everybody. The image file is removed as well. This cannot be undone.',
  'gal.deleteAlbumWithPhotosMany':
    'This deletes the album AND all {n} photographs in it, for everybody. The image files are removed as well. This cannot be undone.',
  'gal.deleteAlbumAndOne': 'Delete album and 1 photo',
  'gal.deleteAlbumAndMany': 'Delete album and {n} photos',
  'gal.albumIsASet':
    'An album is a set of photographs the family keeps together — a reunion, a wedding, a year.',
  'gal.deleteNamedAlbumAria': 'Delete the album “{name}”',
  'rec.howRelated': 'How {name} is related',
  'rec.formerMarriageNote':
    'A former marriage stays on the tree beside {name} — it is usually where half the children came from. A marriage never carries blood.',
  'rem.nobodyCanOpen':
    'Nobody can open it, join it or accept an invitation to it. {nothingDeleted} — every payment, photograph, event and person is exactly where it was. Only {app} support can bring it back; write to them and ask.',
  'set.codeSentTo':
    'We sent a six-digit code to {email}. It lasts {minutes} minutes and can be used once.',
  'set.codeFailedTo':
    '{note} No code has reached {email}, so there is nothing to type yet. Try again in a moment.',
  'gath.notUsableAnswer': 'That is not a usable answer for “{task}”. {hint}',
  'gath.onlyOrganizerCanSchedule': 'Only an organizer can schedule from “{template}”',
  'gath.scheduledStepsFailed':
    'Scheduled, but the steps from {templates} could not be added. An organizer can add them from the gathering.',
  'org.theNamedRegion': 'The {name} region',
  'org.theNamedChapter': 'The {name} chapter',
  'pos.nameTooLong': 'A position name is at most {max} characters',
  'err.regionNeedsName': 'A region needs a name',
  'err.regionNotFound': 'Region not found',
  'err.chapterNeedsName': 'A chapter needs a name',
  'err.chapterNotFound': 'Chapter not found',
  'err.positionNeedsName': 'A position needs a name',
  'err.chooseCategory': 'Choose a category',
  'err.chooseScope': 'Choose a scope',
  'err.positionNotFound': 'Position not found',
  'err.memberNotFound': 'Member not found',
  'err.memberNotApproved': 'That member has not been approved yet',
  'err.chooseChapterForPosition': 'Choose the chapter this position is for',
  'err.chooseRegionForPosition': 'Choose the region this position is for',
  'err.alreadyHoldsPosition': 'They already hold that position',
  'err.assignmentGone': 'That assignment no longer exists',
  'err.notAuthenticated': 'Not authenticated',
  'err.noFamilyOnAccount': 'No family associated with account',
  'err.noSignInAddress': 'That member has no sign-in address on record.',
  'err.placeholderEmailNoReset':
    'This record has a placeholder email address, so a reset link has nowhere to go.',
  'err.cannotRemoveSelfFromGroup': 'Cannot remove yourself from the group',
  'err.conversationNotFound': 'Conversation not found',
  'err.familyRoomFailed': 'Could not find or create the family room',
  'err.groupNameRequired': 'Group name is required',
  'err.groupNotFound': 'Group not found',
  'err.invalidMessage': 'Invalid message',
  'err.noFamily': 'No family',
  'err.noFamilyCodeOnAccount': 'No family code found on your account',
  'err.onlyCreatorCanAdd': 'Only the group creator can add members',
  'err.onlyCreatorCanRemove': 'Only the group creator can remove members',
  'err.notInYourFamily': 'That member is not in your family',
  'err.userNotInFamily': 'User not found in your family',
  'err.nationalReservedName': '"National" is a reserved name',
  'err.noAccountAttachPosition':
    'That relative has no account yet, so there is nothing to attach a position to. Invite them from the family tree first.',
  'err.noAccountResetPassword':
    'This relative has no account yet, so there is no password to reset. Invite them from the family tree instead.',
  'reg.alreadyRegistered':
    '{email} is already registered with {app}, so there is nothing to create. Sign in and you will come straight back to your invitation to',
  'acct.closedDrivesOne': '1 closed drive is not shown here —',
  'acct.closedDrivesMany': '{n} closed drives are not shown here —',
  'acct.seeDonationsForFull': 'for the full record.',
  'err.errorReference': 'Error reference: {digest}',
  'cal.withheldOne':
    'This calendar does not include {list}, so what you see below is not the whole month: that screen has either not been shared with you, or could not be read just now.',
  'cal.withheldMany':
    'This calendar does not include {list}, so what you see below is not the whole month: those screens have either not been shared with you, or could not be read just now.',
  'hlp.membershipUndecided':
    'Your membership of {family} has not been decided yet, so most of the product is not open to you.',
  'hlp.chapterExplainsNext':
    'is the chapter that explains what happens next. Everything else is here to read in the meantime.',
  'lib.whyNotesStayHelp': 'Why notes stay with the office',
  'lib.officesRecordedUnder': 'Offices are recorded under',
  'prof.requestDeclined':
    '{lede}{family} was declined. You can still keep your profile up to date.',
  'prof.waitingForApproval':
    '{lede}{family} is waiting for approval. Filling this in helps them recognise you —',
  'prof.checkTheStatus': 'check the status',
  'rep.offices': 'Offices',
  'rep.heldInTotalOne': '1 held in total',
  'rep.heldInTotalMany': '{n} held in total',
  'rep.filled': 'Filled',
  'rep.boardEmptyHint':
    'Add them on Members → Organization, and this reports who holds each and which are empty.',
  'rep.gathStillToCome': '{n} still to come · cancelled excluded',
  'rep.gathWaitingDecision': '{n} waiting on a decision',
  'rep.gathEmptyHint':
    'Once the family schedules a gathering, this reports on how its tasks are going.',
  'stf.familiesTitle': 'Families',
  'stf.familiesBlurb':
    'Every family, its plan, how many members it has, and whether it has been removed. Restoring one is here.',
  'stf.familyOne': 'family',
  'stf.familyMany': 'families',
  'stf.active': 'active',
  'stf.accountsBlurb':
    'Every sign-in account, whether its address is confirmed, whether it has ever been used, and which families it belongs to.',
  'set.familyNameTooLong': 'That family name is too long ({max} characters maximum).',
  'set.paidPlanUseBilling':
    '{plan} is a paid plan. Set it up in the Billing section of Settings — nothing here can move a family onto it.',
  'tmpl.nameExists': 'A template called “{name}” already exists',
  'tmpl.usedCannotDeleteOne':
    '“{name}” has been used to build 1 gathering, so it cannot be deleted — the record of where those tasks came from would go with it. Archive it instead, which takes it out of the schedule-from list and leaves every gathering exactly as it is.',
  'tmpl.usedCannotDeleteMany':
    '“{name}” has been used to build {n} gatherings, so it cannot be deleted — the record of where those tasks came from would go with it. Archive it instead, which takes it out of the schedule-from list and leaves every gathering exactly as it is.',
  'access.membersOnTemplateOne': '1 member is on this template. Move them to another one first.',
  'access.membersOnTemplateMany':
    '{n} members are on this template. Move them to another one first.',
  'access.lockoutSubject.manageAccess': 'manage access',
  'access.lockoutSubject.changeTemplates': 'change permission templates',
  'access.onlyTemplateThatCan':
    'This is the only template that can {subject}. Grant it to another template first.',
  'access.noOtherTemplateHasMembers':
    'No other template that can {subject} has any members. Put someone on one first.',
  'proc.disconnectedStoppedOne':
    'Disconnected, and 1 recurring payment stopped. Every payment already recorded is kept.',
  'proc.disconnectedStoppedMany':
    'Disconnected, and {n} recurring payments stopped. Every payment already recorded is kept.',
  'usr.chaptersReadFailed': 'Could not read this family’s chapters: {error}',
  'usr.chapterSavedMovedOne': 'Chapter saved. 1 relative without an account moved with them.',
  'usr.chapterSavedMovedMany': 'Chapter saved. {n} relatives without an account moved with them.',
  'cht.loadRoomFailed': 'Failed to load room: {error}',
  'cht.createRoomFailed': 'Failed to create room: {error}',
  'cht.enrollFailed': 'Failed to enroll members: {error}',
  'dues.driveVisibleToEveryone':
    'The drive was created, but it is VISIBLE TO EVERYONE — {reason} Open it and set who it is for.',
  'dues.requiredCannotOptOut': '{schedule} is a required due, so it cannot be opted out of.',
  'gal.tooManyAtOnce': 'Too many photographs in one go — {n} at a time.',
  'gal.couldNotStartUpload': 'Could not start the upload.',
  'gal.uploadDidNotArrive': '{name} did not reach the album. Try it again.',
  'gal.uploadingProgress': 'Uploading {done} of {n}…',
  'gal.photoCountOne': '1 photograph',
  'gal.photoCountMany': '{n} photographs',
  'gal.renameAlbum': 'Rename album',
  'gal.renameAlbumBody':
    'Change what this album is called, and how it is described. The photographs in it are untouched.',
  'gal.renameNamedAlbumAria': 'Rename the album “{name}”',
  'gal.renameFailed': 'Could not rename that album.',
  'rel.inBloodlineQuestion': 'This person is in the family’s bloodline',
  'rel.inBloodlineHint': 'Tick this for a blood relative. Leave it clear for somebody who married in, and for a step, adopted or foster relative. It decides who appears under {control} on the tree, and who owes a due restricted to the bloodline.',
  'rec.inBloodline': '{name} is in the family’s bloodline',
  'rec.inBloodlineHint': 'Decides who appears under {view} on the tree, and who owes a due restricted to the bloodline. Saved as soon as you tick it.',
  'rec.bloodlineFailed': 'Could not change that.',
  'rec.connectionsHint': 'Who this person is attached to. A marriage can be renamed; the rest are the relationships somebody recorded.',
  'proj.bloodlineEmptyNote': 'Nobody owes this: your family has not marked anybody as being in its bloodline, so there is nobody to charge. Tick {control} on the family tree.',
  'gal.fileTooLarge': '{name} is larger than 10 MB.',
  'gal.albumGoneFilesLeftOne':
    'The album is gone, but 1 of its image files could not be removed from storage. It is no longer listed anywhere; tell an administrator so it can be swept.',
  'gal.albumGoneFilesLeftMany':
    'The album is gone, but {n} of its image files could not be removed from storage. They are no longer listed anywhere; tell an administrator so they can be swept.',
  'jrn.firstNoteNotSaved': 'the first note was not saved',
  'jrn.entryCreatedPartial': 'The entry was created, but {what}. Open it and add what is missing.',
  'meet.secretaryUnderEighteen': '{name} is under eighteen. Minutes have to be taken by an adult.',
  'meet.guestUnderEighteenOne':
    '{name} is under eighteen. Only adults can be added to a meeting by name.',
  'meet.guestUnderEighteenMany':
    '{names} are under eighteen. Only adults can be added to a meeting by name.',
  'fam.alreadyBelongTo': 'You already belong to {family}.',
  'fam.requestStillAwaiting': 'Your request to join {family} is still awaiting approval.',
  'reg.invitationSentToAddress':
    'This invitation was sent to {email}. Register with that address.',
  'safety.requeuedOne': '1 relative will be asked again',
  'safety.requeuedMany': '{n} relatives will be asked again',
  'sms.confirmationBody':
    'Your {app} confirmation code is {code}. It expires in {minutes} minutes.',
  'sms.codeSentToEnding': 'Code sent to the number ending {last4}.',
  'stf.noAccountUses':
    'No account uses {email}. They have to register before they can be granted access.',
  'stf.reasonTooLong': 'Keep the reason under {max} characters',
  'stf.alreadyHasAccess':
    '{email} already has staff access. Change their access on their row instead.',
  'drives.pastTheGoal': '{amount} past the goal',
  'drives.fromYou': '{amount} from you',
  'drives.raisedAmount': '{amount} raised',
  'plan.nextDuePrefix': 'Next due',
  'fnd.shareOfDues': '{percent} of dues',
  'fnd.ofMinimum': 'of {amount} minimum',
  'fnd.minimumBalanceIs': ' Minimum balance {amount}.',
  'fnd.shareOfDuesPrefix': 'Share of dues',
  'fnd.paidFromPrefix': 'Paid from',
  'drives.giveTo': 'Give to {label}',
  'drives.wouldMeetGoal': '{amount} would meet the goal — give what you like.',
  'plan.paymentsRecordedOne': '1 payment recorded',
  'plan.paymentsRecordedMany': '{n} payments recorded',
  'access.runMigrations':
    '{lede} Run the migrations in supabase/migrations. Until then access falls back to the old is_admin flag and nothing changed here takes effect.',
  'access.regionsChaptersNational': 'Regions, chapters and National',
  'appr.invitedBy': 'Invited by {name}',
  'appr.expiresOn': 'expires {date}',
  'agat.reopenConfirm':
    'Reopen “{task}” on {gathering}? It goes back to {who}, who can then change the answer and submit it again. Nothing is erased — their answer stays on the task as a starting point and every submission stays in the record.',
  'tmpl.noneYet': 'No gathering templates yet.',
  'agat.noneYet': 'No gatherings yet.',
  'bill.cardFailingSince':
    'A card payment has been failing since {date}. Nothing has changed about what this family can reach. Update the card under {where} and Stripe will try again.',
  'elec.waitingToBeAnswered': '{n} waiting to be answered',
  'elec.votingClosedRange': 'Voting closed {range}.',
  'elec.snapshotWhileOpen':
    'A snapshot while the poll is open — nothing here is final until voting closes.',
  'pos.noPositionYet': 'No position yet.',
  'mpe.saveConfirm': 'Save your changes to {name}’s profile? They are not notified.',
  'mpe.chapterNotSaved': 'The profile was saved, but the chapter was not: {reason}',
  'mpe.chapterCouldNotBeSet': 'that chapter could not be set.',
  'mpe.emailResetLede': 'Email {name} a link to choose a new password? ',
  'login.stillNothing': 'Still nothing?',
  'reg.startsOnFreeNote':
    '{lede} Free. Nothing has been charged — sign in and {app} will ask you to set up {plan}.',
  'reg.nothingChargedNow':
    'Nothing is charged now. Once your family exists you will be asked to set up payment for {plan}, and you can stay on Free instead.',
  'law.addedBy': '· added by {name}',
  'law.notADocumentFormat': 'That is not {formats}. Choose another file.',
  'cal.nothingInMonth': 'Nothing is on the calendar in {month}.',
  'cal.whatIsOnCaption': 'What is on in {month}, one column per weekday.',
  'chat.deleteConversationConfirm':
    'Delete your conversation with {name}? The messages are removed and cannot be recovered.',
  'chat.selectedOne': '1 member selected',
  'chat.selectedMany': '{n} members selected',
  'chat.addToGroupConfirm': 'Add {name} to “{group}”? They will be able to read the conversation.',
  'chat.removeFromGroupConfirm':
    'Remove {name} from “{group}”? They lose access to the conversation.',
  'chat.deleteConversationAria': 'Delete conversation with {name}',
  'cns.onlyOwnAccount':
    '{lede} Only your own account details are used, and only to match this visit to an advertisement.',
  'dash.chapter.theSelected': 'the selected chapter',
  'dash.chapter.confirm':
    'Set your chapter to {chapter}? Any sons or daughters under 18 who have no account of their own move with you.',
  'drives.moreOpenOne': '1 more drive is open.',
  'drives.moreOpenMany': '{n} more drives are open.',
  'dash.link.confirm':
    'Link {name}’s record to your account? Their history becomes yours, and this cannot be undone.',
  'dash.finishPayingFor': 'Finish paying for {plan}',
  'dash.tasksApprovedOne': '{approved} of 1 task approved',
  'dash.tasksApprovedMany': '{approved} of {total} tasks approved',
  'dash.raisedBy': 'Raised by {name}',
  'dist.noDraftToComeBack':
    'This goes out by email straight away. There is no draft to come back to.',
  'docs.deleteNamedBody':
    'Delete “{name}”? The file is removed for everyone. This cannot be undone.',
  'proj.yearFromPrefix': 'Year from',
  'proj.payingCount': '{n} paying',
  'proj.helpWhoCounted': 'Help: who is counted in these figures',
  'tree.otherChildren': 'Other children',
  'tree.otherChildrenEmpty': 'Children whose other parent is not recorded appear here.',
  'upg.partOfPlan': 'Part of {plan}',
  'upg.everythingOnComesWith': 'Everything on {plan} comes with it.',
  'upg.noAnnualNoContract': '. No annual plan, no contract.',
  'upg.notOnSaleYet': ' Not on sale yet; nothing is billed today.',
  'gath.answerInDollars': '{label}, in dollars',
  'gath.answerOnePerLine': '{label}, one item per line',
  'gath.needAnotherLook': '{n} need another look',
  'gath.noTaskMatchesOne':
    'No task matches what you are looking for. 1 task is on this gathering.',
  'gath.noTaskMatchesMany':
    'No task matches what you are looking for. {n} tasks are on this gathering.',
  'gath.dateWithNoTasks': 'This will be a date on the family calendar with no tasks.',
  'gath.allApprovedOne': 'The 1 task is approved',
  'gath.allApprovedMany': 'All {n} tasks approved',
  'hlp.tierBadgeBody':
    'This is included in the {plan} plan, and your family is on a lower one. Everything below is accurate — the screen simply offers an upgrade instead of opening.',
  'hlp.permissionBadgeBody':
    'Your permission template does not include this screen, so opening it will say the page cannot be found. An administrator of your family can change that from Members.',
  'inv.joinOnceApproved': 'They will join {family} once an administrator approves them.',
  'account.menuFor': 'Account menu for {name}',
  'switcher.viewingClickToSwitch': 'Viewing {family} — click to switch family',
  'hlp.comingSoonBadgeBody':
    'This part of the product has not shipped yet. The chapter describes what it will do; opening the screen today shows a Coming Soon notice.',
  'dash.profile.body':
    'Your relatives find you in the Member Directory, and there is not much there yet. Add {missing}.',
  'idle.warningBody': 'You have been inactive for a while, so we are about to sign you out.',
  'idle.signingOutIn': 'Signing out in',
  'notify.waitingApprovalOne': '1 person is waiting for approval',
  'notify.waitingApprovalMany': '{n} people are waiting for approval',
  'notes.aFormerOfficer': 'a former officer',
  'notes.startedByOn': 'Started by {name} · {date}',
  'meet.ofInTheRoom': 'of {n} in the room',
  'meet.voteFinalBody':
    'Your vote on “{topic}” is recorded against your name and cannot be changed or withdrawn by anybody.',
  'meet.voteChoice': 'Vote {choice}',
  'dir.shownOfTotalOne': '{shown} of 1 member',
  'dir.shownOfTotalMany': '{shown} of {total} members',
  'rem.familyRemovedHeading': '{family} has been removed',
  'rem.switchWithMenu': 'Switch with the family menu at the top of the page, or from',
  'rem.stillOpenToYou': 'is still open to you, and so is the',
  'rem.manual': 'manual',
  'pend.welcomeBack': 'Welcome back, {name}!',
  'fam.adminMustApprove':
    'An administrator of {family} has to approve you before you can see anything in it. Your profile details are shared across every family you belong to.',
  'fam.yesJoin': 'Yes, join {family}',
  'fam.openByDefault': 'Open {family} by default when you log in?',
  'profile.photo.replaceConfirm':
    'Replace your profile photo with “{name}”? Your current photo is removed.',
  'profile.photo.setConfirm': 'Use “{name}” as your profile photo?',
  'profile.selectedChapter': 'selected',
  'profile.confirm.chapterBody':
    'Save your changes and move to the {chapter} chapter? Any sons or daughters under 18 who have no account of their own move with you.',
  'sec.codeSentExpires': 'We sent an 8-digit code to {email}. It expires in an hour.',
  'rep.nothingToShowAria': '{label}: nothing to show yet',
  'rep.everyUnitCount':
    'Every {unit} count in this breakdown, including any the chart folds together. ',
  'safety.relativeOne': '1 relative',
  'safety.relativesMany': '{n} relatives',
  'safety.withNoEmail': ', {n} with no email',
  'safety.willBeAskedOne': '1 relative will be asked.',
  'safety.willBeAskedMany': '{n} relatives will be asked.',
  'safety.noEmailPhoneOne':
    '1 of them has no email address on file, so somebody will need to telephone them.',
  'safety.noEmailPhoneMany':
    '{n} of them have no email address on file, so somebody will need to telephone them.',
  'staff.accessForAria': 'Access for {name}',
  'staff.revokeAccessAria': 'Revoke staff access for {name}',
  'staff.neverRegistered':
    '{lede} Nobody has ever registered it. If they were invited, the invitation is below.',
  'staff.noAddressMatches': 'No address on this page contains “{query}”.',
  'staff.never': 'never',
  'staff.restoreBody':
    '{code} becomes reachable again immediately: its members can sign in to it, its family code works, and its invitations resolve. Nothing was deleted when it was removed, so every record it holds comes back with it.',
  'staff.noFamilyMatches': 'No family matches “{query}”.',
  'cf.confirmWithPassword': 'Confirm with your password',
  'cf.sixDigitsEmailed':
    'The six digits we emailed to {email}. It can be used once, and five wrong tries cancel it.',
  'pp.nobodyElseYet': 'Nobody else in the family yet.',
  'pp.moreMatchKeepTyping': '{n} more match — keep typing',
  'time.yourTime': '{time} your time',
  'upd.announcementsNotIncluded':
    'This list is what has been sent to you. Family announcements are not included, because your family has not given you the board — see',
  'upd.showOlder': 'Show {n} older',
  'act.relativeHasDied':
    'That relative has died, so there is no birthday to greet.',
  'gath.daysFromOne': '1 day from {date}',
  'gath.daysFromMany': '{n} days from {date}',
  'access.membersOnCardOne': '1 member',
  'access.membersOnCardMany': '{n} members',
  'chat.participantsOne': '1 member',
  'chat.participantsMany': '{n} members',
  'dues.schedulesOne': '1 schedule',
  'dues.schedulesMany': '{n} schedules',
  'gath.seriesTwo': '{first}, {second}',
  'gath.seriesOneAndMore': '{first} and {n} more',
  'gath.seriesTwoAndMore': '{first}, {second} and {n} more',
  'dues.requiredWord': 'required',
  'dues.optionalWord': 'optional',
  'fnd.balanceWord': 'balance',
  'col.schedule': 'Schedule',
  'col.member': 'Member',
  'col.status': 'Status',
  'col.date': 'Date',
  'col.actions': 'Actions',
  'field.chapterLabel': 'Chapter',
  'cal.todaySrOnly': ' — today',
  'cal.goToMonth': 'Go to {month}',
  'bill.monthsSuffix': ' · {n} months',
  'hlp.planBadge': '{plan} plan',
  'hlp.badgeComingSoon': 'Coming soon',
  'hlp.badgeNotInAccess': 'Not in your access',
  // ── TIME ZONES ─────────────────────────────────────────────────────────────
  // Keyed on the IANA name, which is what `people.time_zone` stores — see
  // `timezoneLabel` in lib/date-utils.ts. The bracketed abbreviations are the ones
  // a speaker of each language actually uses, so ET is HE in French and stays ET in
  // Spanish; they are not a translation of the letters.
  'tz.America/New_York': 'Eastern Time (ET)',
  'tz.America/Chicago': 'Central Time (CT)',
  'tz.America/Denver': 'Mountain Time (MT)',
  'tz.America/Phoenix': 'Mountain Time – Arizona (no DST)',
  'tz.America/Los_Angeles': 'Pacific Time (PT)',
  'tz.America/Anchorage': 'Alaska Time (AKT)',
  'tz.Pacific/Honolulu': 'Hawaii Time (HT)',
  'tz.America/Toronto': 'Eastern – Canada',
  'tz.America/Vancouver': 'Pacific – Canada',
  'tz.America/Halifax': 'Atlantic – Canada',
  'tz.America/St_Johns': 'Newfoundland – Canada',
  'tz.Europe/London': 'London (GMT/BST)',
  'tz.Europe/Paris': 'Paris (CET/CEST)',
  'tz.Europe/Berlin': 'Berlin (CET/CEST)',
  'tz.Africa/Lagos': 'West Africa (WAT)',
  'tz.Africa/Johannesburg': 'South Africa (SAST)',
  'tz.Asia/Dubai': 'Gulf Time (GST)',
  'tz.Asia/Kolkata': 'India (IST)',
  'tz.Asia/Tokyo': 'Japan (JST)',
  'tz.Asia/Shanghai': 'China (CST)',
  'tz.Australia/Sydney': 'Sydney (AEST/AEDT)',
  'tz.Pacific/Auckland': 'New Zealand (NZST/NZDT)',

  // ── DOCUMENT TITLES, 2026-08-31 ────────────────────────────────────────────
  // The browser TAB, which is not always the <h1>: a tab has no rail above it to say
  // where it is, so thirteen of these disambiguate against a sibling route. Every other
  // screen's tab reuses its own `page.<route>.title` and so cannot drift from its
  // heading — see `lib/i18n/page-metadata.ts` for why that is one key and not two, and
  // for the measurement that retired the note below.
  'doc./admin/accounting.title': 'Accounting — Admin',
  'doc./admin/elections.title': 'Elections — Admin',
  'doc./admin/elections/[id].title': 'Election',
  'doc./admin/gatherings.title': 'Gatherings — Admin',
  'doc./admin/gatherings/[id].title': 'Gathering — Admin',
  'doc./community/elections/[id].title': 'Election',
  'doc./community/gallery/[id].title': 'Album',
  'doc./gatherings/[id].title': 'Gathering',
  'doc./library/meeting-minutes/[id].title': 'Meeting',
  'doc./reporting/board.title': 'Board & Offices Report',
  'doc./reporting/elections.title': 'Elections Report',
  'doc./reporting/gatherings.title': 'Gatherings Report',
  'doc./reporting/meetings.title': 'Meetings Report',
  'doc./community/distributions.title': 'Distributions',
  'doc./community/gallery.title': 'Gallery',
  'doc./community/safety-check-ins.title': 'Safety Check-Ins',
  'doc./library/bylaws.title': 'Bylaws',
  'doc./library/meeting-minutes.title': 'Meeting Minutes',
  'doc./dashboard.title': 'Dashboard',
  'doc./update-password.title': 'Choose a New Password',
  'doc./invite.title': 'Invitation',
  // ── THE STAFF CONSOLE'S HEADINGS, 2026-08-31 ───────────────────────────────
  // Four of these were bare JSX literals, which the prose gate cannot see.
  'page./staff.title': '{app} staff console',
  'page./staff/access.title': 'Access',
  'page./staff/accounts.title': 'Accounts',
  'page./staff/families.title': 'Families',
  // ── PAGE HEADINGS ────────────────────────────────────────────────────────────────
  // The `<h1>` at the top of each screen, keyed on its ROUTE — which §1 makes the same string
  // as its permission key, so `page.<key>.title` needs no lookup table.
  //
  // SEPARATE FROM `nav.item.*`, AND THAT DUPLICATION IS THE POINT. On most screens the two are
  // the same word today, because AGENTS.md makes a route the kebab-cased rail caption. They are
  // still two keys, for the reason this catalogue already keeps two keys for every caption that
  // repeats: a heading and a rail item are different jobs, and where they diverge they diverge
  // permanently. Three already do — `/help` is "User Guide" in the rail and "Help" here,
  // `/admin/members` is "Members" in both but "Members & Access" in the manual, and
  // `/library/officer-notes` had drifted outright (see below).
  //
  // THE DOCUMENT TITLE IS HERE NOW, AND THE COST IT WAS DEFERRED OVER DID NOT EXIST. This note
  // used to say translating a tab title meant `generateMetadata`, "which has no `user` and would
  // have to make its own GoTrue `getUser()` call — doubling the auth round trips on every page
  // load to translate a browser tab". Measured 2026-08-31: `currentUser()` and `callerI18n()`
  // are both `cache()`d, Next scopes that cache to one REQUEST, and `generateMetadata` runs
  // inside the page's own request — so it is a map lookup, and it resolves the same
  // `people.locale` the page's `t` came from rather than falling back to `Accept-Language`.
  // `lib/i18n/page-metadata.ts` carries the measurement and the negative control.
  //
  // Most tabs reuse the heading key below, so the two cannot drift. `/library/officer-notes` is
  // why that matters: its heading key had been corrected to "Officer Notes" when the section was
  // renamed and its static tab title still read "Officer". Thirteen tabs genuinely differ, and
  // those carry `doc.<route>.title` — see the block above.
  'page./accounting/dues-and-donations.title': 'Dues & Donations',
  'page./accounting/summary.title': 'Summary',
  'page./reporting/transactions.title': 'Transactions',
  'page./admin/accounting.title': 'Accounting',
  'page./admin/elections.title': 'Elections',
  'page./admin/gatherings.title': 'Gatherings',
  'page./admin/members.title': 'Members',
  'page./admin/settings.title': 'Settings',
  'page./community/announcements.title': 'Announcements',
  'page./community/chat.title': 'Chat',
  'page./community/directory.title': 'Directory',
  'page./community/elections.title': 'Elections',
  'page./community/family-tree.title': 'Family Tree',
  'page./gatherings.title': 'Gatherings',
  'page./gatherings/calendar.title': 'Calendar',
  'page./help.title': 'Help',
  'page./library/documents.title': 'Documents',
  'page./library/officer-notes.title': 'Officer Notes',
  'page./my-families.title': 'My Families',
  'page./personal-info.title': 'My Profile',
  'page./reporting/board.title': 'Board & Offices',
  'page./reporting/dues-projections.title': 'Dues Projections',
  'page./reporting/elections.title': 'Elections',
  'page./reporting/gatherings.title': 'Gatherings',
  'page./reporting/meetings.title': 'Meetings',
  'page./reporting/membership.title': 'Membership',
  'page./accounting/payment-history.title': 'Payment History',
  'page./reporting/pl-summary.title': 'P&L Summary',

  // ── THE DASHBOARD ────────────────────────────────────────────────────────────────
  // The landing screen: `/dashboard`, and the cards and banners on it. `dash.*` rather than
  // `page./dashboard.*` because these are the CONTENTS of one screen rather than its heading —
  // the same split `nav.item.*` and `page.*.title` already make.
  'dash.welcome': 'Welcome back,',
  'dash.atAGlance': 'At a Glance',
  'dash.quickActions': 'Quick Actions',
  'dash.premier.label': 'Premier gathering',
  'dash.premier.view': 'View details',
  'dash.donations.title': 'Donation Drives',
  'dash.donations.view': 'View donation drives',
  'dash.donations.met': 'Met',
  'dash.collected.title': 'Collected this year',
  'dash.collected.view': 'View payments',
  'dash.tree.title': 'Family Tree',
  'dash.tree.generationOne': 'Generation',
  'dash.tree.generationMany': 'Generations',
  'dash.tree.empty': 'There is nobody in this family to build a tree from yet.',
  'dash.tree.allConnected': 'No loose leaves — everybody in the family is connected to somebody.',
  'dash.tree.oneLeaf': 'One leaf: a member who is not connected to anybody on the tree yet.',
  'dash.tree.open': 'Open the tree',
  'dash.tree.view': 'View family tree',
  'dash.updates.title': 'Recent Updates',
  'dash.updates.empty': 'Nothing new right now.',
  'dash.updates.viewAll': 'View all updates',
  'dash.updates.unpin': 'Hide this from the top of my updates',
  'dash.updates.pin': 'Show this at the top of my updates',
  'dash.profile.title': 'Finish your profile',
  'dash.profile.action': 'Update my profile',
  'dash.safety.title': 'Your family is asking whether you are safe',
  'dash.safety.action': 'Open Safety Check-Ins',
  'dash.chapter.title': 'Set your chapter',
  'dash.chapter.lede':
    'Assigning your chapter ensures you receive the right announcements and are grouped correctly within the family.',
  'dash.chapter.select': 'Select your chapter',
  'dash.chapter.action': 'Set chapter',
  'dash.chapter.saving': 'Save Chapter',
  'dash.chapter.required': 'Please select a chapter.',
  'dash.chapter.saved': 'Chapter saved successfully.',
  'dash.chapter.failed': 'Failed to save. Please try again.',
  'dash.link.title': 'Were you already added to the family?',
  'dash.link.maybe': 'These might be you',
  'dash.link.isThisYou': 'Is this you?',
  'dash.link.thisIsMe': 'This is me',
  'dash.link.everyoneElse': 'Everyone else',
  'dash.link.search': 'Search by name…',
  'dash.link.none': 'No matching family members found.',
  'dash.link.match.name': 'Name match',
  'dash.link.match.email': 'Email match',
  'dash.link.match.phone': 'Phone match',
  'dash.link.match.dob': 'Birthday match',
  'dash.link.action': 'Link record',
  'dash.link.linking': 'Linking…',
  'dash.link.aria': 'Link to your account',
  'dash.plan.pay': 'Pay Now',
  'dash.plan.opening': 'Opening…',
  'dash.plan.advance': 'Buy months in advance instead',
  'dash.dismiss': 'Dismiss',
  'dash.plan.explain':
    '**{pay}** takes you to Stripe to pay monthly, starting with the rest of this month. '
    + '**{cancel}** drops the plan and leaves your family on Free — nothing is charged either '
    + 'way, and you can buy it later. ',
  'dash.safety.titleMany': 'Your family is asking whether you are safe ({n} check-ins)',
  'dash.tree.manyLeaves':
    '{n} leaves — members who are not connected to anybody on the tree yet.',

  // ── FORM FIELD LABELS, SHARED ACROSS EVERY FORM ──────────────────────────────────
  // `field.*` and `action.*` are the one place this catalogue deliberately SHARES a caption
  // rather than keeping a key per surface.
  //
  // That is not a reversal of the `nav.item.*` / `page.*.title` rule, it is the other side of
  // it. A rail caption and a page heading name a SCREEN, and two screens that happen to share a
  // word in English can need different words elsewhere — so those keep two keys. "First Name"
  // on a form names a FIELD, and it is the same field on My Profile, on the member edit dialog
  // and on registration. Three keys there would be three translations of one label, free to
  // drift, on forms a member compares side by side.
  //
  // The test before adding to `field.*`: would a translator ever want these two to differ? If
  // yes it belongs to its surface.
  'field.prefix': 'Prefix',
  'field.firstName': 'First Name',
  'field.middleName': 'Middle Name',
  'field.lastName': 'Last Name',
  'field.nickname': 'Nickname',
  'field.suffix': 'Suffix',
  'field.email': 'Email',
  'field.phone': 'Phone',
  'field.gender': 'Gender',
  'field.country': 'Country',
  'field.street': 'Street Address',
  'field.apartment': 'Apartment / Suite',
  'field.city': 'City',
  'field.state': 'State',
  'field.province': 'Province',
  'field.stateProvince': 'State / Province',
  'field.zip': 'ZIP / Postal',
  'field.dob': 'Date of Birth',
  'field.sunset': 'Sunset Date',
  'field.chapter': 'Chapter',
  'field.timeZone': 'Time Zone',
  'field.language': 'Language',
  'field.tshirt': 'T-Shirt',
  'field.tshirtCategory': 'T-Shirt Category',
  'field.tshirtSize': 'T-Shirt Size',
  'field.ph.nickname': 'e.g. Big Mike',
  'field.ph.email': 'you@example.com',
  'field.ph.phone': '(555) 000-0000',
  'field.ph.street': '123 Main Street',
  'field.ph.apartment': 'Apt 4B',
  'field.ph.city': 'Springfield',
  'field.ph.zip': '62701',
  'action.cancel': 'Cancel',
  'action.edit': 'Edit',
  'action.saving': 'Saving…',
  'action.saveChanges': 'Save changes',
  'action.notSet': 'Not set',
  'profile.section.general': 'General',
  'profile.section.address': 'Address',
  'profile.section.additional': 'Additional Information',
  'profile.section.notifications': 'Notifications',
  'profile.section.security': 'Sign-in & Security',
  'profile.rail': 'My Profile sections',
  'profile.editSection': 'Edit {section}',
  'profile.photo.upload': 'Upload profile photo',
  'profile.photo.replaceLong': 'Replace profile photo',
  'profile.photo.setLong': 'Set profile photo',
  'profile.photo.replace': 'Replace photo',
  'profile.photo.set': 'Set photo',
  'profile.photo.failed': 'Could not set that photo',
  'profile.living': 'Living',
  'profile.sunsetHint': 'Leave blank if living.',
  'profile.sizeFirst': 'Select a category first.',
  'profile.noChapters': 'This family has no chapters, so there is nothing to choose.',
  'profile.inThisFamily': 'In this family',
  'profile.firstNameRequired': 'First name is required',
  'profile.lastNameRequired': 'Last name is required',
  'profile.wentWrong': 'Something went wrong',
  'profile.chapterNotChanged': 'Your details were saved, but the chapter could not be changed.',
  'profile.confirm.general': 'Save general information',
  'profile.confirm.generalBody': 'Save your changes to your general information?',
  'profile.confirm.address': 'Save address',
  'profile.confirm.addressBody': 'Save your changes to your address?',
  'profile.confirm.additional': 'Save additional information',
  'profile.confirm.additionalBody': 'Save your changes to your additional information?',
  'action.save': 'Save',
  'profile.inFamily': 'In {family}',

  // ── NOTIFICATIONS AND SIGN-IN & SECURITY ─────────────────────────────────────────
  // `notify.channel.*` and `notify.type.*` are keyed on the IDS in `lib/notification-prefs.ts`.
  // That registry keeps the ids, the defaults and the `unavailable` marker — the facts — and the
  // captions live here, exactly as `profile-sections.ts` gives up its labels.
  //
  // **SMS stays SMS**, untranslated, in all three languages: it is what the acronym is called
  // everywhere this product ships, and *Mensajes de texto* / *Messages texte* is what the ROW
  // says at length rather than what a narrow column heading should.
  'notify.channel.email': 'Email',
  'notify.channel.sms': 'SMS',
  'notify.channel.push': 'Push Notification',
  'notify.type.safety_check.label': 'Safety Check',
  'notify.type.safety_check.description':
    'Your family raises a check-in during a storm, an evacuation or an emergency, and asks '
    + 'whether you are safe.',
  'notify.colNotification': 'Notification',
  'notify.notBuilt': 'Coming Soon',
  'notify.stopped': 'Stopped',
  'notify.on': 'On',
  'notify.off': 'Off',
  'notify.toggleLabel': '{channel} for {notification}',
  'notify.noneOnFile': 'None on file',
  'notify.placeholderAddress': 'A placeholder address — nothing can reach it',
  'notify.fromGeneral':
    'These come from your **General** details — change them there and every notification '
    + 'follows.',
  'notify.failed': 'That did not work',
  'notify.noEmail':
    'We have no email address that can reach you, so nothing marked on for Email will arrive. '
    + 'Add one under **General**.',
  'notify.stoppedNote':
    'You replied **STOP** to one of our text messages, so we cannot text that number again — '
    + 'and we cannot switch it back on from here, because that is a rule your mobile network '
    + 'enforces rather than a setting we hold. Text **START** to the number that messaged you if '
    + 'you want them back.',
  'notify.smsNotOn':
    'Text messages are not switched on yet. You can record your choice now, and we will start '
    + 'using it as soon as they are.',
  'notify.noMobile':
    'We have no mobile number for you, so nothing marked on for SMS will arrive. Add one under '
    + '**General**.',
  'notify.willConfirm':
    'We will confirm your mobile number with a code before we text you anything.',
  'security.email.title': 'Sign-in email',
  'security.email.lede':
    'The address you sign in with. Separate from the contact email in your profile — changing '
    + 'one does not change the other.',
  'security.currently': 'Currently ',
  'security.newEmail': 'New email address',
  'security.sending': 'Sending…',
  'security.sendConfirmation': 'Send confirmation',
  'security.badEmail': 'Enter a valid email address',
  'security.sameEmail': 'That is already your sign-in address',
  'security.password.title': 'Password',
  'security.password.lede':
    'Changing it takes your current password and a short code we email you. Your other devices '
    + 'are signed out afterwards.',
  'security.sendingCode': 'Sending code…',
  'security.changePassword': 'Change password',
  'security.code': 'Code from your email',
  'security.currentPassword': 'Current password',
  'security.newPassword': 'New password',
  'security.confirmPassword': 'Confirm new password',
  'security.savePassword': 'Save new password',
  'security.needCode': 'Enter the code from your email',
  'security.needCurrent': 'Enter your current password',
  'security.tooShort': 'New password must be at least 8 characters',
  'security.noMatch': 'New passwords do not match',
  'security.samePassword': 'That is already your password. Choose a different one.',
  'security.wrongCurrent': 'That is not your current password.',
  'security.ph.minChars': 'Min. 8 characters',

  // ── THE MEMBER'S MONEY SCREENS ───────────────────────────────────────────────────
  // Summary, Dues & Donations, Payment History and the dues projection — what a member is
  // asked for and what they have paid. `money.*` for the shared vocabulary, then a prefix per
  // screen.
  //
  // ONE WORD DECIDED ONCE AND USED EVERYWHERE: an INSTALLMENT is one rung of a schedule's
  // ladder, and it is not the same as what a member PAYS NEXT — `lib/dues-utils.ts` §7c is the
  // whole argument. The two have separate keys here for that reason, and a translation must
  // keep them separate or the screen starts claiming the catch-up figure is the ordinary one.
  'money.amount': 'Amount',
  'money.total': 'Total',
  'money.remaining': 'Remaining',
  'money.paid': 'Paid',
  'money.status': 'Status',
  'money.method': 'Method',
  'money.date': 'Date',
  'money.schedule': 'Schedule',
  'money.actions': 'Actions',
  'money.member': 'Member',
  'money.fund': 'Fund',
  'money.fromTo': 'From',
  'money.pastDue': 'Past due',
  'money.dueNow': 'Due now',
  'money.notYetDue': 'Not yet due',
  'money.declined': 'Declined',
  'money.income': 'Income',
  'money.expenses': 'Expenses',
  'money.donation': 'Donation',
  'money.close': 'Close',
  'money.opening': 'Opening…',
  'pnl.lede': 'Life to date · every entry the family has recorded',
  'pnl.duesAndDonations': 'Dues & donations',
  'pnl.direct': 'Direct contributions',
  'pnl.netLine': 'Income less expenses',
  'pnl.routedHeading': 'Income Routed to Funds',
  'pnl.nothingRouted': 'Nothing has been routed to funds yet.',
  'pnl.balancesToday': 'Fund balances today',
  'pnl.nothingPaidOut': 'Nothing paid out yet',
  'pnl.disbursed': 'Disbursed from the family’s funds',
  'pnl.disbursements': 'Disbursements',
  'pnl.processingFees': 'Card processing fees',
  'pnl.surplus': 'Net surplus',
  'pnl.deficit': 'Net deficit',
  'pnl.routedBeyond': 'Routed beyond dues income',
  'pnl.notYetRouted': 'Collected, not yet routed to a fund',
  'pnl.allRouted': 'Every dues payment has been routed into a fund.',
  'pnl.overRouted':
    'More has gone into funds than dues brought in — direct contributions make up the '
    + 'difference.',
  'pnl.unrouted':
    'Dues collected against a schedule with no routing rule stay here until one is set up on '
    + 'Accounting.',
  'drives.goalMet': 'Goal met',
  'drives.closed': 'Closed',
  'drives.noGoal': 'No goal set — give what you like.',
  'drives.none': 'Your family is not running any donation drives right now.',
  'drives.rail': 'Dues and donations',
  'drives.give': 'Give',
  'drives.giveByCard': 'Give by card',
  'drives.giveHint':
    'Paid by card straight to your family. It posts to their books the moment it clears.',
  'drives.giveAnything': 'Give what you like. There is no set amount.',
  'drives.needAmount': 'Enter an amount to give.',
  'plan.noSchedules': 'You are not on any dues schedules — your family has not set any up for you.',
  'plan.required': 'Required dues',
  'plan.optional': 'Optional dues',
  'plan.nextPayment': 'Next Payment',
  'plan.nextDue': 'Next Due',
  'plan.thisDue': 'This due',
  'plan.whatYouPayNow': 'What you pay now',
  'plan.payCadence': 'Payment plan',
  'plan.changeCadence': 'Change pay cadence',
  'plan.pickCadence': 'Pick a pay cadence to set up automatic payments.',
  'plan.setUpAuto': 'Set up automatic payments',
  'plan.stopAuto': 'Stop automatic payments',
  'plan.stopAutoConfirm': 'Stop automatic payments?',
  'plan.stopPayments': 'Stop payments',
  'plan.cadenceFailed': 'Could not update cadence',
  'plan.changeFailed': 'Could not change that',
  'plan.optOut': 'Opt out',
  'plan.optBackIn': 'Opt back in',
  'plan.optionalHint':
    'This is an optional due, so you can decline it. It will stop counting toward what you '
    + 'owe, and you can opt back in at any time.',
  'plan.allSettled': 'Nothing is waiting on you — every due is settled or declined.',
  'plan.calendarAsked': 'What the calendar has asked for, including anything still to catch up on.',
  'plan.needAmount': 'Enter an amount to pay.',
  'plan.pay': 'Pay',
  'plan.payByCard': 'Pay by card',
  'plan.oneAcross': 'One payment across every due below. Set a due to zero to leave it out.',
  'plan.straightToFamily':
    'Paid straight to your family. It posts to their books the moment it clears.',
  'plan.whyDiffers': 'Why the next payment can differ from the installment',
  'funds.title': 'Family Funds',
  'funds.manage': 'Manage Funds',
  'funds.none': 'No funds set up yet.',
  'cards.noUpcoming': 'No upcoming dues',
  'cards.paidThisYear': 'Paid This Year',
  'cards.generalPayment': 'General Payment',
  'cards.noPayments': 'No payments on record',
  'cards.remainingBalance': 'Remaining Balance',
  'cards.noSchedules': 'No dues schedules configured.',
  'cards.viewDues': 'View Dues',
  'cards.requiredPaid': 'Required dues all paid',
  'cards.allPaid': 'All dues paid — thank you!',
  'history.none': 'No payment history available yet.',
  'history.noMatches': 'No matching payments.',
  'history.filter': 'Filter payment history',
  'history.filterPh': 'Filter...',
  'history.duesPayment': 'Dues payment',
  'history.donationPayment': 'Donation payment',
  'history.paymentMethod': 'Payment method',
  'history.processingFee': 'Card processing fee',
  'history.reference': 'Check # / Reference',
  'history.recorded': 'Recorded',
  'history.reversed': 'Reversed',
  'history.reversedYes': 'Yes — a correcting entry cancels this payment',
  'history.corrects': 'Corrects',
  'history.correctsWhat': 'An earlier payment in this history',
  'history.notes': 'Notes',
  'history.correctingEntry': '{kind} — correcting entry',
  'payStatus.paid': 'Paid',
  'payStatus.waived': 'Waived',
  'payStatus.pending': 'Pending',

  // ── SHARED CONTROLS AND THE LIBRARY SECTION ──────────────────────────────────────
  // More `action.*` and a `common.*` for the words that are neither a control nor a form field
  // — a table's "Size", a filter's "All". Same test as `field.*`: shared only where a
  // translator would never want two surfaces to differ.
  'action.delete': 'Delete',
  'action.post': 'Post',
  'action.close': 'Close',
  'action.rename': 'Rename',
  'action.download': 'Download',
  'action.upload': 'Upload',
  'action.uploading': 'Uploading…',
  'action.search': 'Search',
  'action.clear': 'Clear',
  'action.chooseFile': 'Choose a file',
  'action.posting': 'Posting…',
  'action.loading': 'Loading…',
  'field.title': 'Title',
  'field.name': 'Name',
  'field.message': 'Message',
  'field.descriptionOptional': 'Description (optional)',
  'field.audience': 'Audience',
  'common.category': 'Category',
  'common.all': 'All',
  'common.size': 'Size',
  'common.day': 'Day',
  'common.today': 'Today',
  'common.tomorrow': 'Tomorrow',
  'common.yesterday': 'Yesterday',
  'common.nothingMatches': 'Nothing matches',
  'ann.pane.general': 'General',
  'ann.pane.updates': 'Updates',
  'ann.pane.birthdays': 'Birthdays',
  'ann.rail': 'Announcement areas',
  'ann.lede.general':
    'News from across your family. Pinned posts ride at the top of everyone’s Recent Updates '
    + 'until each person dismisses them.',
  'ann.lede.birthdays':
    'Only the next {days} days are shown, soonest first — a birthday further out than that '
    + 'appears here once it is within {days} days.',
  'ann.none': 'No announcements yet.',
  'ann.deleteTitle': 'Delete announcement',
  'ann.deleteFailed': 'Could not delete that announcement.',
  'ann.unpinAll': 'Unpin for everyone',
  'ann.pinAll': 'Pin for everyone',
  'ann.pinFailed': 'Could not change that pin.',
  'ann.pinnedRides': 'Pinned for the family — it rides at the top of your updates.',
  'ann.pinnedHidden': 'Pinned for the family — you have hidden it from the top of your updates.',
  'ann.openElection': 'Open this election',
  'ann.new.prompt': 'Share an announcement with your family…',
  'ann.new.heading': 'New Announcement',
  'ann.new.titlePh': 'Reunion update',
  'ann.new.bodyPh': 'What would you like to share?',
  'ann.new.pin': 'Pin to the top of everyone’s Recent Updates',
  'ann.new.unpinOn': 'Stop pinning on',
  'ann.new.wholeFamily': 'Entire Family',
  'ann.new.wholeFamilyHint': 'Everyone in the family will see this',
  'ann.new.region': 'Region',
  'ann.new.regionHint': 'Shown to your region',
  'ann.new.chapterHint': 'Shown to a specific chapter',
  'ann.new.needBoth': 'Add a title and a message.',
  'ann.new.needChapter': 'Choose which chapter to notify.',
  'ann.new.failed': 'Could not post',
  'ann.new.submit': 'Post Announcement',
  'bday.countdown': 'Countdown',
  'bday.turning': 'Turning',
  'bday.searchLabel': 'Search birthdays by name',
  'bday.searchPh': 'Search by name…',
  'upd.searchPh': 'Search titles and messages…',
  'upd.searchLabel': 'Search updates',
  'upd.unread': 'Unread',
  'upd.wholeWords': 'Whole words, in any order — searching',
  'upd.readFailed':
    'Something went wrong reading your updates, so this list may be incomplete. Try again in '
    + 'a moment.',
  'upd.empty':
    'Nothing yet. Announcements your family posts and anything sent to you will appear here.',
  'upd.kindAnnouncement': 'Announcement',
  'upd.kindSentToYou': 'Sent to you',
  'notes.new': 'New entry',
  'notes.journalFor': 'The journal for',
  'notes.everyoneHolding': 'Everyone holding',
  'notes.staysWithOffice':
    'Whatever you write here stays with the office. Whoever holds it next will read it.',
  'notes.titleHint': 'What the list shows. Everything else goes in notes underneath it.',
  'notes.titlePh': 'How the bank reconciliation works',
  'notes.firstNote': 'First note',
  'notes.firstNotePh': 'Optional — you can add notes to this entry later.',
  'notes.moreLater': 'You can add more notes to this entry whenever there is something to add.',
  'notes.note': 'Note',
  'notes.nothingUnder': 'Nothing written under this yet.',
  'notes.addNote': 'Add a note',
  'notes.addNoteAction': 'Add note',
  'notes.officesRail': 'Offices you hold',
  'notes.needTitle': 'Give the entry a title.',
  'notes.saveFailed': 'That entry could not be saved.',
  'notes.deleteEntryTitle': 'Delete this entry',
  'notes.deleteEntry': 'Delete entry',
  'notes.deleteEntryFailed': 'That entry could not be removed.',
  'notes.writeFirst': 'Write something first.',
  'notes.noteSaveFailed': 'That note could not be saved.',
  'notes.deleteNoteBody': 'Delete this note? The rest of the entry stays. This cannot be undone.',
  'notes.deleteNote': 'Delete note',
  'notes.deleteNoteFailed': 'That note could not be removed.',
  'notes.renameEntry': 'Rename entry',
  'notes.onlyYouRecorded':
    'Only you can change what you recorded, and only while you hold this office.',
  'notes.onlyYouWrote': 'Only you can change what you wrote, and only while you hold this office.',
  'notes.staysWithOfficeShort': 'This stays with the office. Whoever holds it next will read it.',
  'notes.addEntry': 'Add entry',
  'notes.editNote': 'Edit note',
  'notes.editThisNote': 'Edit this note',
  'notes.deleteThisNote': 'Delete this note',
  'notes.atTheEnd': 'It goes at the end of this entry, under your name.',
  'bylaws.heading': 'Bylaws',
  'bylaws.addArticle': 'Add an article',
  'bylaws.addArticleAction': 'Add article',
  'bylaws.searchLabel': 'Search the bylaws',
  'bylaws.searchPh': 'quorum, “annual meeting”, dues -proxy',
  'bylaws.indexedFull': 'Searchable in full',
  'bylaws.typedIn': 'Typed in — searchable in full',
  'bylaws.titleOnly': 'Title and summary only — the file’s text has not been read',
  'bylaws.articleOptional': 'Article (optional)',
  'bylaws.summaryOptional': 'Summary (optional)',
  'bylaws.textOptional': 'The text (optional)',
  'bylaws.documentOptional': 'Document (optional)',
  'bylaws.eitherHint': 'Type the text in to make it searchable, upload the document, or both.',
  'bylaws.articlePh': 'Article IV',
  'bylaws.titlePh': 'Meetings and quorum',
  'bylaws.summaryPh': 'What this article covers',
  'bylaws.textPh': 'Paste the article here and every word of it becomes searchable.',
  'bylaws.deleteWithFile':
    'The article and its file are removed for everyone. This cannot be undone.',
  'bylaws.deleteNoFile': 'The article is removed for everyone. This cannot be undone.',
  'bylaws.deleteFailed': 'Could not delete that.',
  'bylaws.openFailed': 'Could not open that file.',
  'bylaws.noMatches': 'Nothing matches that.',
  'bylaws.none': 'No bylaws recorded yet.',
  'bylaws.tryAnother':
    'Try a different word. A PDF that has not been read is only matched on its title and '
    + 'summary.',
  'bylaws.addEachHint':
    'Add each article with its text, or upload the document. Pasting the text in is what '
    + 'makes it searchable today.',
  'bylaws.needTitle': 'Give the article a title',
  'bylaws.addFailed': 'Could not add that.',
  'docs.upload': 'Upload a document',
  'docs.document': 'Document',
  'docs.filed': 'Filed',
  'docs.searchPh': 'Name or description…',
  'docs.namePh': '2026 Membership Form',
  'docs.descriptionPh': 'What it is, and who needs it',
  'docs.deleteTitle': 'Delete document',
  'docs.deleteFailed': 'Could not delete that.',
  'docs.openFailed': 'Could not open that file.',
  'docs.none': 'No documents filed yet.',
  'docs.noMatches': 'No documents match that.',
  'docs.needName': 'Give the document a name',
  'docs.uploadFailed': 'Upload failed',
  'common.daysAgo': '{n} days ago',

  // ── GATHERINGS ───────────────────────────────────────────────────────────────────
  // A GATHERING is the social occasion — the reunion, the picnic, the three-day family event —
  // and a MEETING is the formal proceeding with a secretary and minutes. English calls them by
  // names that only just differ; Spanish and French both have a real distinction and use it.
  // `gath.*` and `meet.*` must never borrow each other's words.
  'gath.rail': 'Gathering areas',
  'gath.pane.gatherings': 'Gatherings',
  'gath.pane.myTasks': 'My Tasks',
  'gath.pane.myTasksN': 'My Tasks ({n})',
  'gath.schedule': 'Schedule a gathering',
  'gath.scheduleAction': 'Schedule gathering',
  'gath.scheduling': 'Scheduling…',
  'gath.authorTemplate': 'Author a template',
  'gath.builtFrom': 'Built from',
  'gath.where': 'Where',
  'gath.whatItIs': 'What it is',
  'gath.open': 'Open the gathering',
  'gath.premier': 'Premier',
  'gath.happeningNow': 'Happening now',
  'gath.titlePh': 'e.g. Allen Family Reunion 2027',
  'gath.wherePh': 'e.g. Memorial Park, Houston',
  'gath.descPh': 'Optional — a sentence for the family',
  'gath.needTitle': 'Give the gathering a title',
  'gath.scheduleFailed': 'Could not schedule the gathering',
  'gath.sayWhenWhereAndTemplate': 'Say when and where, and choose what it is built from.',
  'gath.sayWhenWhere': 'Say when and where.',
  'gath.noTasks': 'No tasks yet',
  'gath.tasks': 'Tasks',
  'gath.findTask': 'Find a task',
  'gath.findTaskPh': 'Job or name',
  'gath.showing': 'Showing',
  'gath.everyTask': 'Every task',
  'gath.task': 'Task',
  'gath.assignedTo': 'Assigned to',
  'gath.due': 'Due',
  'gath.answer': 'Answer',
  'gath.nobodyYet': 'Nobody yet',
  'gath.nothingAdded': 'Nothing has been added to this gathering yet.',
  'gath.notFromTemplate': 'Not from a template',
  'tasks.whatAsked': 'What the organizer asked for',
  'tasks.backNoNotes': 'This came back without any notes. Ask an organizer what needs to change.',
  'tasks.askReopen': 'Ask an organizer to reopen it if it needs to change.',
  'tasks.yourAnswer': 'Your answer',
  'tasks.anythingToTell': 'Anything to tell the organizer?',
  'tasks.reviewNote': 'An organizer reviews it and can hand it back with notes.',
  'tasks.allIn': 'Nothing is waiting on you — everything you have been asked for is in.',
  'tasks.fillFirst': 'There is nothing to send yet — fill this in first.',
  'tasks.sendFailed': 'Could not send that in. Try again.',
  'tasks.optional': 'Optional',
  'tasks.onePerLine': 'One item per line',
  'tasks.wherePh': 'Where it is — a venue, an address, a room',
  'budget.heading': 'Budget',
  'budget.drawnOn': 'Drawn on',
  'budget.budgeted': 'Budgeted',
  'budget.claimed': 'Claimed by tasks',
  'budget.inTheFund': 'In the fund',
  'budget.noFund': 'No fund attached yet',
  'budget.plansToSpend': 'What this gathering plans to spend',
  'budget.notSet': 'Nobody has set a budget',
  'budget.noLines': 'No task carries a budget line',
  'budget.over': 'Over the budget',
  'budget.unallocated': 'Unallocated',
  'budget.setToSee': 'Set a budget to see what is left',
  'budget.linesExceed': 'The task lines claim more than the budget',
  'budget.stillToHandOut': 'Still to hand out to a task',
  'budget.nothingElse': 'Nothing else is claiming it',
  'budget.balanceUnavailable': 'The balance was not available',
  'budget.help': 'How a gathering’s budget works',

  // ── MEETING MINUTES ──────────────────────────────────────────────────────────────
  // A MEETING is the formal proceeding — an agenda, a secretary, minutes and votes. Never
  // borrow `gath.*`'s words: that is the social occasion, and both target languages
  // distinguish them.
  //
  // A VOTE IS FINAL, and the copy says so in three places. `meeting_votes_are_final` is the
  // trigger behind it — a translation must not soften "cannot be changed" into "should not be".
  'meet.heading': 'Meeting Minutes',
  'meet.schedule': 'Schedule a meeting',
  'meet.scheduleAction': 'Schedule meeting',
  'meet.scheduling': 'Scheduling…',
  'meet.none': 'No meetings yet.',
  'meet.minuted': 'Minuted',
  'meet.everybodyTold': 'Everybody in the room is told and gets it on their calendar.',
  'meet.step.basics': 'The basics',
  'meet.step.whoIsComing': 'Who is coming',
  'meet.step.anybodyElse': 'Anybody else',
  'meet.titlePh': 'Quarterly officers’ meeting',
  'meet.startTime': 'Start time',
  'meet.endTime': 'End time',
  'meet.timezone': 'Timezone',
  'meet.chooseTimezone': 'Choose a timezone…',
  'meet.optional': 'Optional.',
  'meet.startFirst': 'Give a start time first.',
  'meet.secretaryLabel': 'Who is taking the minutes?',
  'meet.secretaryHint':
    'An adult, and you by default. Only they can write in this meeting, and only until it is '
    + 'closed.',
  'meet.noAdults': 'This family has no adult members recorded yet.',
  'meet.kindQuestion': 'What kind of meeting is this?',
  'meet.kind.family': 'Every adult in the family.',
  'meet.kind.chapter': 'Everybody in a chapter, officer or not.',
  'meet.kind.board': 'Everybody holding an office on one board — national, a region, or a chapter.',
  'meet.kind.position':
    'One office across every area that fills it — every chapter president, say.',
  'meet.kind.named': 'Just the people I name',
  'meet.kind.namedHint': 'Nobody to start with. You add them on the next step.',
  'meet.boardHint': 'Everybody holding an office there, as it stands today.',
  'meet.positionHint': 'Taken across every region or chapter that fills it.',
  'meet.chapterHint': 'Every adult recorded in it. This is the whole chapter, not its board.',
  'meet.anybodyElse': 'Anybody else (optional)',
  'meet.anybodyElseHint':
    'Adults only. Everybody in the room is told, gets it on their calendar, and may vote on '
    + 'its topics.',
  'meet.nobodyYetNextStep': 'Nobody is in the room yet. Add them by name on the next step.',
  'meet.nobodyYet': 'Nobody in the room yet.',
  'meet.oneAdult': 'That is 1 adult.',
  'meet.needTitle': 'Give the meeting a title',
  'meet.needDate': 'Choose a date',
  'meet.needStart': 'Give a start time as well, or leave the end time empty',
  'meet.endAfterStart': 'The end time has to be after the start time',
  'meet.needZone': 'Choose the timezone the time is in',
  'meet.needSecretary': 'Choose who is taking the minutes',
  'meet.needKind': 'Choose what kind of meeting this is',
  'meet.needBoard': 'Choose at least one board',
  'meet.needPosition': 'Choose at least one position',
  'meet.needChapter': 'Choose at least one chapter',
  'meet.scheduleFailed': 'Could not schedule that meeting.',
  'meet.noBoards':
    'Nobody holds a board position yet — set the offices up on Members → Organization.',
  'meet.noPositions': 'No office is filled yet — set them up on Members → Organization.',
  'meet.noChapters': 'No chapter has anybody recorded in it yet.',
  'meet.minutesBy': 'Minutes by',
  'meet.closeMinutes': 'Close minutes',
  'meet.reopen': 'Reopen',
  'meet.nobodyOnList': 'Nobody is on the list.',
  'meet.topics': 'Topics',
  'meet.addTopic': 'Add a topic',
  'meet.addTopicAction': 'Add topic',
  'meet.whatTopic': 'What is the topic?',
  'meet.topicPh': 'Approving the reunion budget',
  'meet.topicTitleLabel': 'Topic title',
  'meet.notePh': 'What was said, and what was agreed',
  'meet.renameTopic': 'Rename this topic',
  'meet.deleteTopicTitle': 'Delete this topic',
  'meet.deleteTopic': 'Delete topic',
  'meet.voteFinal': 'Your vote is final once cast — it cannot be changed or withdrawn.',
  'meet.onlyAttendees': 'Only people on the attendee list can vote in this meeting.',
  'meet.vote.for': 'For',
  'meet.vote.against': 'Against',
  'meet.vote.abstain': 'Abstain',
  'meet.theVote': 'The vote',
  'meet.noVote': 'No vote called',
  'meet.closeVote': 'Close the vote',
  'meet.callVote': 'Call a vote',
  'meet.callVoteHint':
    'Call a vote and everybody in the room can answer. A vote cannot be changed once cast.',
  'meet.noVoteCalled': 'The secretary has not called a vote on this topic.',
  'meet.voteOpen': 'Vote open',
  'meet.voteClosed': 'Vote closed',
  'meet.closeConfirmTitle': 'Close these minutes',
  'meet.reopenConfirmTitle': 'Reopen these minutes',
  'meet.closeConfirmBody':
    'Nothing about this meeting changes after it is closed — no more topics, no more notes, '
    + 'and no more votes. It can be reopened.',
  'meet.reopenConfirmBody':
    'Reopening lets the secretary write again. The votes already cast stay exactly as they '
    + 'are; they cannot be changed by anybody.',
  'meet.deleteMeetingBody':
    'The whole meeting goes — its topics, its minutes and every vote cast in it. This cannot '
    + 'be undone.',
  'meet.deleteMeeting': 'Delete meeting',
  'meet.deleteTopicBody': 'This removes the topic and its notes. This cannot be undone.',
  'meet.nothingMinuted': 'Nothing minuted yet. Add a topic, then write notes under it.',
  'meet.nothingMinutedShort': 'Nothing has been minuted yet.',
  'meet.noLongerInFamily': 'Somebody no longer in this family',
  'meet.deleteFailed': 'Could not delete that.',
  'meet.addFailed': 'Could not add that.',
  'meet.renameFailed': 'Could not rename that.',
  'meet.saveFailed': 'Could not save that.',
  'meet.needTopicTitle': 'Give the topic a title',
  'meet.wentWrong': 'Something went wrong.',
  'meet.back': 'Back',
  'meet.next': 'Next',
  'meet.deleteTopicVotesOne':
    'This removes the topic, its notes, and the 1 vote cast on it. Deleting the question is '
    + 'the only way a vote is ever removed. This cannot be undone.',
  'meet.deleteTopicVotesMany':
    'This removes the topic, its notes, and all {n} votes cast on it. Deleting the question '
    + 'is the only way a vote is ever removed. This cannot be undone.',
  'meet.kind.familyLabel': 'A general family meeting',
  'meet.kind.chapterLabel': 'A chapter meeting',
  'meet.kind.boardLabel': 'A board meeting',
  'meet.kind.positionLabel': 'A positions meeting',

  // ── THE COMMUNITY SECTION ────────────────────────────────────────────────────────
  // Gallery, Family Tree, Chat, Directory, Elections, and the calendar's own vocabulary.
  //
  // A RECORD is a person on the tree with no account — a grandmother with no address, a child
  // too young for one. It is not a lesser kind of member (§4b: there is one kind of `people`
  // row), and neither target language should reach for a word that implies otherwise.
  'action.remove': 'Remove',
  'action.done': 'Done',
  'action.continue': 'Continue',
  'action.back': 'Back',
  'action.copied': 'Copied',
  'action.wentWrong': 'Something went wrong',
  'action.creating': 'Creating…',
  'common.notStated': 'Not stated',
  'common.national': 'National',
  'common.noChapter': 'No chapter',
  'field.firstNameLower': 'First name',
  'field.lastNameLower': 'Last name',
  'field.emailAddress': 'Email address',
  'field.dobLower': 'Date of birth',
  'field.ph.firstName': 'Ada',
  'field.ph.lastName': 'Okonkwo',
  'field.ph.cousinEmail': 'cousin@example.com',
  'field.ph.theirEmail': 'them@example.com',
  'common.optional': 'Optional',
  'gal.heading': 'Gallery',
  'gal.rail': 'Gallery sections',
  'gal.pane.albums': 'Albums',
  'gal.pane.search': 'Search',
  'gal.newAlbum': 'New album',
  'gal.createAlbum': 'Create album',
  'gal.looking': 'Looking up the albums…',
  'gal.noAlbums': 'No albums yet.',
  'gal.pressNew': 'Press New album to start one.',
  'gal.somebodyCan': 'Somebody with permission to add to the gallery can start one.',
  'gal.albumIs': 'A set of photographs the family keeps together.',
  'gal.albumNamePh': 'Summer Reunion 2026',
  'gal.albumDescPh': 'Three days at the lake',
  'gal.needName': 'Give the album a name',
  'gal.createFailed': 'Could not create that album.',
  'gal.deleteAlbum': 'Delete album',
  'gal.deleteAlbumBody': 'This deletes the album. It has no photographs in it.',
  'gal.deleteAlbumFailed': 'Could not delete that album.',
  'gal.grid': 'Grid',
  'gal.list': 'List',
  'gal.howToShow': 'How to show the photographs',
  'gal.searchCaptions': 'Search captions',
  'gal.searchCaptionsPh': 'lake, reunion, 90th…',
  'gal.whoIsInIt': 'Who is in it',
  'gal.whoHint':
    'Pick anybody tagged in this album. A photograph shows when it has ANY of them in it — '
    + 'choosing three widens the result rather than narrowing it.',
  'gal.nobodyTagged': 'Nobody is tagged in a photograph here yet.',
  'gal.addPhotos': 'Add photographs',
  'gal.clearFilters': 'Clear filters',
  'gal.noneInAlbum': 'No photographs in this album yet.',
  'gal.noneMatch': 'No photograph here matches what you are filtering on.',
  'gal.chooseFiles': 'Choose files',
  'gal.batchCaption': 'Caption for all of them (optional)',
  'gal.batchCaptionHint':
    'One caption for the batch. Change an individual one afterwards in the list view.',
  'gal.captionPh': 'Saturday, at the lake',
  'gal.noCaption': 'No caption',
  'gal.caption': 'Caption',
  'gal.changeCaption': 'Change this caption',
  'gal.tagSomebody': 'Tag somebody',
  'gal.searchFamily': 'Search the family…',
  'gal.searchToTag': 'Search for somebody to tag',
  'gal.nobodyMatches': 'Nobody matches.',
  'gal.closePhoto': 'Close photograph',
  'gal.openPhotographIn': 'Open the photograph: {what}',
  'gal.nOfTotal': '{n} of {total}',
  'gal.searchAllLabel': 'Search every album',
  'gal.searchAllPh': 'lake, reunion, grandma’s 90th',
  'gal.searchAllHint': 'Words from a caption, and anybody tagged. Both narrow together.',
  'gal.searchWhoIsIn': 'Who is in it (optional)',
  'gal.searchWhoIsInHint': 'Only photographs tagged with everybody chosen here.',
  'gal.searchFoundOne': '1 photograph matches.',
  'gal.searchFoundMany': '{n} photographs match.',
  'gal.searchMoreNotShown': '{n} more are not shown — narrow the search.',
  'gal.searchNoMatches': 'No photograph matches that.',
  'gal.searchRefused': 'Could not search the photographs.',
  'gal.prevPhoto': 'Previous photograph',
  'gal.nextPhoto': 'Next photograph',
  'gal.openPhoto': 'Open this photograph',
  'gal.deletePhoto': 'Delete photograph',
  'gal.deletePhotoBody':
    'Delete this photograph? It is removed for everyone, along with its tags, and the image '
    + 'file goes too. This cannot be undone.',
  'gal.deletePhotoFailed': 'Could not delete that.',
  'gal.chooseImage': 'Choose at least one image.',
  'gal.nothingUploaded': 'Nothing was uploaded.',
  'gal.captionFailed': 'Could not save that caption.',
  'gal.tagFailed': 'Could not add that tag.',
  'gal.removeTag': 'Remove tag',
  'gal.removeTagFailed': 'Could not remove that tag.',
  'gal.addedByGone': 'Added by somebody no longer in this family',
  'tree.nobodyToBuild': 'There is nobody in this family to build a tree from yet.',
  'tree.centreOnMe': 'Centre on me',
  'tree.children': 'Children',
  'tree.notOnTree': 'Not on the tree yet',
  'tree.everyone': 'Everyone in this family',
  'tree.recordOnly': 'Record only',
  'tree.invited': 'Invited',
  'tree.noEmail': 'No email',
  'tree.inBloodline': 'In the bloodline',
  'tree.marksBlood': 'Marks a blood relative',
  'tree.mode': 'Tree mode',
  'tree.whichRelatives': 'Which relatives to show',
  'tree.bloodlineHelp': 'Help: the Bloodline toggle',
  'tree.editOrInvite': 'Edit this record, or invite them',
  'tree.removeConnection': 'Remove this connection',
  'tree.removeConnectionAction': 'Remove connection',
  'tree.removeConnectionFailed': 'Could not remove that connection.',
  'tree.fullFamily': 'Full family',
  'tree.bloodline': 'Bloodline',
  'tree.father': 'Father',
  'tree.mother': 'Mother',
  'tree.thisAndMarriages': 'This person, and their marriages',
  'tree.thisAndSpouse': 'This person, and their spouse',
  'tree.thisPerson': 'This person',
  'tree.siblings': 'Brothers and sisters',
  'tree.thisPersonIs': 'This person is',
  'tree.thesePeopleAre': 'These people are',
  'rel.how': 'How',
  'rel.chooseHow': 'Choose how this person joins the tree.',
  'rel.alreadyHere': 'Someone already here',
  'rel.alreadyHereHint': 'Link a relative who is already in your family.',
  'rel.inviteThem': 'Invite them',
  'rel.inviteHint': 'We email an invitation. They join once an administrator approves them.',
  'rel.noEmail': 'No email address',
  'rel.noEmailHint':
    'Record them without one — for relatives who have passed, elders, and children.',
  'rel.noEmailChildHint':
    'Record them without one — for a child too young for an account. We ask for their '
    + 'birthday because dues can start at an age.',
  'rel.whyNoEmail': 'Why is there no email address?',
  'rel.generated': 'We generated an address so the record could exist. Nothing is ever sent to it.',
  'rel.addedToTree': 'Added to the tree',
  'rel.adding': 'Adding…',
  'rel.everyoneAttached':
    'Everyone in the family is already attached here. Invite somebody, or record them without '
    + 'an email.',
  'rel.whatRecordIs': 'What a record is, and how they get an account later',
  'rel.tooYoung': 'Too young for an account · No email yet',
  'rel.reasonExamples': 'Passed away in 1998 · No email, phone only · Too young for an account',
  'rel.emailedInvite':
    'We emailed them an invitation. When they accept it, their account joins this card.',
  'rel.inviteNotEmailed':
    'The invitation was created but we could not email it. Resend it from Admin › Members › '
    + 'Pending Approval.',
  'rel.onTreeNoInvite':
    'They are on the tree, but we could not create an invitation — most often because that '
    + 'address is already in your family. Link the existing person instead.',
  'rec.saved': 'Saved.',
  'rec.savedShort': 'Saved',
  'rec.connectionFailed': 'Could not change that connection.',
  'rec.needNames': 'Enter a first and last name',
  'rec.saveFailed': 'Could not save that.',
  'rec.inviteFailed': 'Could not invite them.',
  'rec.theirOwnProfile':
    'They manage their own profile, so only the connection is yours to change.',
  'rec.noAccountAnyone':
    'They have no account, so anyone in the family can keep this record right.',
  'rec.saveDetails': 'Save details',
  'rec.inviting': 'Inviting…',
  'rec.sendInvitation': 'Send invitation',
  'chat.messages': 'Messages',
  'chat.newDm': 'New DM',
  'chat.new': 'New',
  'chat.noGroups': 'No groups yet.',
  'chat.directMessages': 'Direct Messages',
  'chat.groupMessages': 'Group Messages',
  'chat.unread': 'Unread messages',
  'chat.familyChat': 'Family Chat',
  'chat.directMessage': 'Direct Message',
  'chat.familyMember': 'Family Member',
  'chat.selectConversation': 'Select a conversation to start chatting.',
  'chat.deleteConversation': 'Delete conversation',
  'chat.groupName': 'Group Name',
  'chat.members': 'Members',
  'chat.newGroup': 'New Group',
  'chat.newGroupHint': 'Give the group a name and choose who to include.',
  'chat.groupNamePh': 'e.g. Summer Reunion Planning',
  'chat.needGroupName': 'Group name is required',
  'chat.createGroup': 'Create Group',
  'chat.newDmTitle': 'New Direct Message',
  'chat.newDmHint': 'Choose a family member to start a private conversation.',
  'chat.noOthers': 'No other family members with accounts yet.',
  'chat.starting': 'Starting…',
  'chat.startConversation': 'Start Conversation',
  'chat.manageMembers': 'Manage members',
  'chat.addMembers': 'Add members:',
  'chat.typeMessage': 'Type a message… (Enter to send, Shift+Enter for new line)',
  'chat.send': 'Send',
  'chat.noMessages': 'No messages yet. Say hello!',
  'chat.sendFailed': 'Failed to send',
  'chat.addToGroup': 'Add to group',
  'chat.addFailed': 'Could not add member',
  'chat.removeFromGroup': 'Remove from group',
  'chat.removeFailed': 'Could not remove member',
  'chat.ended': 'This conversation has ended.',
  'chat.youWereRemoved': 'You have been removed from this group.',
  'dir.allChapters': 'All Chapters',
  'dir.noMatches': 'No members match your search.',
  'dir.minor': 'Minor',
  'dir.notRegistered': 'Not yet registered',
  'dir.filterByChapter': 'Filter by chapter',
  'dir.position': 'Position',
  'dir.group': 'Group',
  'dir.preferredName': 'Preferred name',
  'dir.account': 'Account',
  'dir.registered': 'Registered',
  'dir.editProfile': 'Edit profile',
  'dir.cityState': 'City, State',
  'dir.region': 'Region',
  'elec.nominated': 'You have been nominated!',
  'elec.accept': 'Accept',
  'elec.decline': 'Decline',
  'elec.acceptNomination': 'Accept nomination',
  'elec.declineNomination': 'Decline nomination',
  'elec.answerFailed': 'Could not record your answer.',
  'elec.castYourVote': 'Cast Your Vote',
  'elec.castVote': 'Cast vote',
  'elec.changeVote': 'Change vote',
  'elec.changeYourVote': 'Change your vote',
  'elec.castYourVoteAction': 'Cast your vote',
  'elec.voteFailed': 'Vote failed',
  'elec.noCandidates': 'No candidates for this position.',
  'elec.nominationsNotOpen': 'Nominations have not opened yet.',
  'elec.notPublished': 'This election has not been published yet.',
  'elec.position': 'Position',
  'elec.nominations': 'Nominations',
  'elec.noOffices': 'This election has no offices on it yet.',
  'elec.nominate': 'Nominate',
  'elec.noNominations': 'No nominations for this office yet.',
  'elec.putMyselfForward': 'Put myself forward',
  'elec.whoNominating': 'Who are you nominating?',
  'elec.nominateFailed': 'Could not submit that nomination.',
  'elec.withdrawYours': 'Withdraw your nomination',
  'elec.takeNameOff': 'Take your name off this nomination',
  'elec.withdraw': 'Withdraw',
  'elec.takeMyNameOff': 'Take my name off',
  'elec.withdrawFailed': 'Could not withdraw that nomination.',
  'elec.nobodyNominated': 'Nobody nominated yet',
  'elec.accepted': 'Accepted',
  'elec.waitingAnswer': 'Waiting for their answer',
  'elec.anybodyMayBe': 'Anybody in the family may be nominated.',
  'cal.thisMonth': 'This month',
  'cal.nothingToday': 'Nothing on today.',
  'cal.prevMonth': 'Previous month',
  'cal.nextMonth': 'Next month',
  'cal.kind.premier': 'Premier gathering',
  'cal.kind.gathering': 'Gathering',
  'cal.kind.meeting': 'Meeting',
  'cal.kind.nominations': 'Nominations open',
  'cal.kind.voting': 'Voting open',

  // ── SAFETY, MEMBERSHIP, INVITATIONS AND THE MEMBERSHIP REPORT ────────────────────
  // A CHECK-IN IS AN ASK, never an alert. The product cannot tell anybody whether they are in
  // danger — it knows only that a relative asked — so no string here may assert that anything
  // is happening near the reader. `email.checkIn.*` and `dash.safety.*` keep the same rule.
  'safety.heading': 'Safety Check-Ins',
  'safety.lede':
    'Ask the relatives in one area whether they are safe, and watch the answers come in.',
  'safety.raise': 'Raise a check-in',
  'safety.askingAboutYou': 'Your family is asking about you',
  'safety.listFailed':
    'The list of check-ins could not be loaded just now. Reload the page to try again.',
  'safety.open': 'Open',
  'safety.closed': 'Closed',
  'safety.nothingOpen': 'Nothing open. When somebody raises a check-in, it appears here.',
  'safety.notShownToYou':
    'You can see that this check-in was raised. Who answered is not shown to you.',
  'safety.retryFailed': 'Try the failed ones again',
  'safety.close': 'Close check-in',
  'safety.loadingRoster': 'Loading who was asked…',
  'safety.safe': 'Safe',
  'safety.needHelp': 'Need help',
  'safety.waiting': 'Waiting',
  'safety.notReached': 'Not reached',
  'safety.notAddressed': 'Not addressed',
  'safety.askFailed': 'Could not ask everybody',
  'safety.didNotWork': 'That did not work',
  'safety.deleteConfirm': 'Delete this check-in?',
  'safety.deleteFailed': 'Could not delete the check-in',
  'safety.deleted': 'Check-in deleted',
  'safety.everyone': 'Everyone in the family',
  'safety.handPicked': 'Hand-picked relatives',
  'safety.oneArea': 'One area',
  'safety.asking': 'Asking…',
  'safety.hideRoster': 'Hide who was asked',
  'safety.seeRoster': 'See who was asked',
  'safety.iAmSafe': 'I am safe',
  'safety.iNeedHelp': 'I need help',
  'safety.anythingToKnow': 'Anything your family should know? (optional)',
  'safety.notePh': 'Where you are, what you need, or nothing at all.',
  'safety.saveNote': 'Save note',
  'safety.saved': 'Saved',
  'safety.answerFailed': 'Could not record your answer',
  'safety.toldSafe': 'You have told your family you are safe.',
  'safety.toldHelp': 'You have told your family you need help.',
  'safety.actuallyHelp': 'Actually, I need help',
  'safety.nobodyOn': 'Nobody is on this check-in.',
  'safety.relative': 'Relative',
  'safety.answer': 'Answer',
  'safety.howAsked': 'How they were asked',
  'safety.answered': 'Answered',
  'safety.needsHelp': 'Needs help',
  'safety.noEmailPhone': 'No email on file — needs a phone call',
  'safety.emailFailed': 'The email did not go through',
  'safety.notAsked': 'Not asked yet',
  'safety.askedByEmail': 'Asked by email',
  'safety.sending': 'Sending',
  'safety.whatHappening': 'What is happening',
  'safety.subjectHint':
    'This is the subject of the email your relatives get. Keep it recognisable.',
  'safety.anythingElse': 'Anything else to tell them (optional)',
  'safety.whoToAsk': 'Who to ask',
  'safety.justNamed': 'Just the relatives I name',
  'safety.nobodySelected': 'Nobody is selected yet, so nothing will be sent.',
  'safety.askIfSafe': 'Ask if they are safe',
  'safety.oneQuestion': 'Everybody you choose is asked one question, and answers with one tap.',
  'safety.titlePh': 'Hurricane Delia',
  'safety.detailPh': 'Where to go, who to call, what you know.',
  'safety.relativesToAsk': 'Relatives to ask',
  'safety.emailedOne': 'Everybody you pick is emailed one question and can answer with one tap.',
  'safety.noRelatives': 'No relatives to choose from yet.',
  'safety.sayWhat': 'Say what is happening, so relatives know what they are being asked about',
  'safety.chooseOne': 'Choose at least one relative to ask',
  'safety.raiseFailed': 'Could not raise the check-in',
  'safety.askThem': 'Ask them',
  'fam.heading': 'My Families',
  'fam.pending': 'Pending',
  'fam.removed': 'Removed',
  'fam.declined': 'Declined',
  'fam.viewing': 'Viewing',
  'fam.default': 'Default',
  'fam.familyCode': 'Family Code:',
  'fam.changeDefault': 'Change default family',
  'fam.makeDefault': 'Make default',
  'fam.inviteMember': 'Invite Member',
  'fam.copyCode': 'Copy code',
  'fam.join': 'Join another family',
  'fam.codeLabel': 'Family code',
  'fam.codePh': 'ABC234',
  'fam.askSomeone': 'Ask someone in the family for their family code.',
  'fam.isThisRight': 'Is this the right family?',
  'fam.checking': 'Checking…',
  'fam.joining': 'Joining…',
  'fam.requestSent': 'Request sent',
  'fam.yourRequestTo': 'Your request to join',
  'rem.nothingDeleted': 'Nothing has been deleted',
  'rem.otherFamily': 'Your other family',
  'rem.otherFamilies': 'Your other families',
  'pend.waiting': 'Waiting for approval',
  'pend.declined': 'Request declined',
  'pend.switchedOff': 'Access switched off',
  'pend.yourRequests': 'Your family requests',
  'pend.adminOf': 'An administrator of',
  'pend.pending': 'Pending',
  'pend.mistake': 'Think that was a mistake?',
  'pend.lookAgain': 'Ask them to look again',
  'pend.confirmEmail': 'Confirm your email address',
  'pend.appealPh':
    'I\'m Martha\'s youngest — my mother was born in Bastrop and my cousin Ada is already a '
    + 'member.',
  'pend.withAdmins': 'With its administrators for review.',
  'pend.wasDeclined': 'An administrator declined your request to join.',
  'pend.wasSwitchedOff': 'An administrator has switched off your access.',
  'pend.sentCheckInbox': 'Sent. Check your inbox.',
  'pend.declinedShort': 'Declined',
  'pend.switchedOffShort': 'Switched off',
  'pend.sendToAdmins': 'Send to the administrators',
  'pend.sendAgain': 'Send it again',
  'pend.member': 'Member',
  'inv.title': 'Invite Member',
  'inv.sent': 'Invitation sent',
  'inv.created': 'Invitation created',
  'inv.emailedTo': 'We’ve emailed an invitation to',
  'inv.anInvitationFor': 'An invitation for',
  'inv.sendThisLink': 'Send them this link',
  'inv.noSecondApproval': 'They will be admitted as soon as they accept — no second approval.',
  'inv.needsApproval': 'They will still need an administrator to approve them.',
  'inv.create': 'Create invitation',
  'inv.admittedAtOnce':
    'They will be admitted the moment they accept — they will not appear in the approvals '
    + 'queue.',
  'inv.willAppearInQueue':
    'When they accept they will appear in Member Approvals, waiting for an administrator.',
  'inv.signOutFailed':
    'We could not sign you out just now. Your invitation link is still in the address bar — '
    + 'try again, or open it in a private window.',
  'inv.copyFailed': 'We could not copy it. The link is in your address bar.',
  'inv.signingOut': 'Signing out…',
  'inv.signOutContinue': 'Sign out and continue',
  'inv.linkCopied': 'Link copied',
  'inv.copyLink': 'Copy invitation link',
  'consent.decline': 'Decline',
  'consent.allow': 'Allow',
  'consent.label': 'Advertising measurement choice',
  'soon.heading': 'Coming Soon',
  'soon.availableNow': 'Available now',
  'soon.back': 'Back to dashboard',
  'upg.familyIsOn': 'Your family is on',
  'upg.changePlan': 'Change your plan',
  'upg.askAdmin': 'Ask one of your family’s administrators to change the plan.',
  'rep.group': 'Group',
  'rep.members': 'Members',
  'rep.share': 'Share',
  'rep.pressRow': 'Press a row to see who is in it.',
  'rep.nationally': 'Nationally',
  'rep.regions': 'Regions',
  'rep.chapters': 'Chapters',
  'rep.canSignIn': 'Can sign in',
  'rep.neverInvited': 'Never invited',
  'rep.byRegion': 'By region',
  'rep.byRegionHint':
    'Where the family is, one rung above its chapters. A member in no chapter — or in a '
    + 'chapter that sits under no region — is under National, which is the absence of a region '
    + 'rather than a place of its own.',
  'rep.byChapter': 'By chapter',
  'rep.byChapterHint':
    'Every chapter the family has set up, including any nobody has joined yet. A chapter '
    + 'standing at zero is the one to look at first.',
  'rep.invitations': 'Invitations',
  'rep.invitationsHint':
    'Active means the person has an account and can sign in. Invited means an invitation is '
    + 'open and unanswered. Pending invite means nobody has asked them yet — they are on the '
    + 'roster and owe dues like everybody else.',
  'rep.adultsMinors': 'Adults and minors',
  'rep.adultsMinorsHint':
    'Worked out from each member’s date of birth every time this page loads, never stored. A '
    + 'birthday nobody has recorded is counted as neither rather than guessed — dues schedules '
    + 'with a starting age bill from the recorded date, so an empty birthday is money nobody is '
    + 'asking for.',
  'slice.filterPh': 'Filter these members by name…',
  'slice.noMatch': 'Nobody in this group matches that filter.',
  'slice.nobodyIn': 'Nobody is in this group.',
  'slice.needChapterPerm':
    'Filing somebody in a chapter needs permission to edit members, which you have not been '
    + 'given.',
  'slice.needInvitePerm':
    'Sending an invitation needs permission to edit the family tree, which you have not been '
    + 'given.',
  'slice.needBirthdayPerm':
    'Recording a birthday needs permission to edit members, which you have not been given.',
  'slice.placeholderAddress':
    'Their record holds a placeholder address, so the invitation needs a real one.',
  'slice.needEmail': 'Enter an email address to send the invitation to',
  'slice.needDob': 'Enter a date of birth',
  'slice.chapterFailed': 'Could not save that chapter.',
  'slice.inviteFailed': 'Could not send that invitation.',
  'slice.canResend': 'Members & Access can resend it.',
  'slice.dateFailed': 'Could not save that date.',
  'slice.noAccount': 'No account',
  'slice.inviteOpen': 'Invitation open',
  'slice.setChapter': 'Set chapter',
  'slice.saveChapter': 'Save chapter',
  'slice.invite': 'Invite',
  'slice.sendInvitation': 'Send invitation',
  'slice.addBirthday': 'Add birthday',
  'slice.saveDate': 'Save date',
  'fam.create': 'Create a new family',
  'fam.createAction': 'Create family',
  'fam.nameLabel': 'Family name',
  'fam.namePh': 'The Okonkwo Family',
  'fam.created': 'Family created',
  'fam.codeHeading': 'Family Code',
  'fam.firstAdmin': 'You will be its first administrator. Your profile carries over.',

  // ── THE ADMIN CONSOLE ────────────────────────────────────────────────────────────
  // The screens a family's administrators work, and the ones with the most words in the
  // product. Two vocabulary rules carry through all of them:
  //
  //   A TEMPLATE is a permission grid, and a GATHERING TEMPLATE is a list of steps. They share
  //   an English word and nothing else — `access.template.*` and `tmpl.*` never borrow from
  //   each other.
  //
  //   AN OFFICE (a board position) is not a PERMISSION. A family can give somebody the title
  //   of Treasurer without giving them the treasury, and the copy on both screens depends on
  //   that staying distinct.
  'action.adding': 'Adding…',
  'action.working': 'Working…',
  'action.change': 'Change',
  'action.failed': 'Failed',
  'common.required': 'Required',
  'common.description': 'Description',
  'common.scope': 'Scope',
  'common.amount': 'Amount',
  'acct.rail': 'Accounting areas',
  'acct.section.income': 'Income',
  'acct.section.donations': 'Donations',
  'acct.section.routing': 'Routing',
  'acct.section.milestones': 'Milestones',
  'acct.section.processing': 'Processing',
  'acct.section.bank': 'Bank Information',
  'acct.section.settings': 'Settings',
  'acct.heading': 'Accounting',
  'acct.newDues': 'New Dues',
  'acct.newDonation': 'New Donation',
  'acct.newFund': 'New Fund',
  'acct.newMilestone': 'New Milestone',
  'acct.noBank': 'No bank account on file',
  'rg.general': 'General',
  'rg.personal': 'Personal',
  'rg.community': 'Community',
  'rg.library': 'Library',
  'rg.gatherings': 'Gatherings',
  'rg.accounting': 'Accounting',
  'rg.resources': 'Resources',
  'rg.administration': 'Administration',
  'set.rail': 'Settings sections',
  'set.pane.family': 'Family',
  'set.pane.billing': 'Billing',
  'set.pane.plan': 'Plan',
  'set.familyName': 'Family name',
  'set.timezone': 'Timezone',
  'set.saveName': 'Save name',
  'set.familyCode': 'Family code',
  'set.removed': 'This family has been removed',
  'set.remove': 'Remove this family',
  'set.nothingDeleted': 'Nothing is deleted.',
  'set.sendAnotherCode': 'Send another code',
  'set.emailMeCode': 'Email me a removal code',
  'set.enterCode': 'Enter the six digits from the email.',
  'set.codeFailed': 'We could not send the email just now.',
  'set.enterAndRemove': 'Enter the code and remove',
  'set.howPlanWorks': 'What changing the plan does',
  'set.howPayingWorks': 'How paying for a plan works',
  'set.howRemovalWorks': 'What removing a family does',
  'appr.thisPerson': 'This person',
  'appr.lookAgain': 'They asked you to look again:',
  'appr.immediate':
    'They will get immediate access to everything your family has made visible to members.',
  'appr.approve': 'Approve',
  'appr.wasDeclinedBefore':
    'They were declined before. Admitting them now gives them immediate access to everything '
    + 'your family has made visible to members, and they will be told.',
  'appr.nobodyWaiting':
    'Nobody is waiting. Requests appear here when someone joins with your family code.',
  'appr.checkRecognise': 'Check that you recognise the person before admitting them.',
  'appr.declineRequest': 'Decline request',
  'appr.declineBody':
    'They will be told, and may be given a reason. Their record is kept rather than deleted.',
  'appr.reason': 'Reason (optional — shown to them)',
  'appr.invitationsSent': 'Invitations sent',
  'appr.preApproved': 'Pre-approved',
  'appr.resendNote': 'The previous link has stopped working — a resend always issues a new one.',
  'appr.keptNote': 'Kept rather than deleted, so the record of the decision survives.',
  'appr.invited': 'Invited',
  'appr.resend': 'Resend',
  'appr.cancelling': 'Cancelling…',
  'appr.admitAfterAll': 'Admit after all',
  'pos.add': 'Add Position',
  'pos.addTitle': 'Add a board position',
  'pos.addHint': 'An office your family keeps. You choose who holds it afterwards.',
  'pos.namePh': 'e.g. Reunion Treasurer',
  'pos.position': 'Position',
  'pos.regional': 'Regional',
  'pos.president': 'President',
  'pos.addFailed': 'Could not add that position',
  'pos.renameFailed': 'Could not rename that position',
  'pos.remove': 'Remove position',
  'pos.removeBody': 'Nothing else about the family changes.',
  'pos.removeFailed': 'Could not remove that position',
  'pos.none':
    'No positions yet. Add the offices your family keeps — President, Treasurer, a Reunion '
    + 'Chair, whatever you actually have.',
  'pos.noneShort': 'Your family has not set up any board positions yet.',
  'pos.escape': 'Escape',
  'pos.holdsNow': 'Holds now',
  'pos.give': 'Give a position',
  'pos.chooseOne': 'Choose one…',
  'pos.oneOrMore':
    'An office is held nationally, or for one region, or for one chapter. Somebody can hold '
    + 'more than one.',
  'pos.choose': 'Choose a position',
  'pos.giveFailed': 'Could not give them that position',
  'pos.takeAway': 'Take away position',
  'pos.takeAwayBody': 'They stay a member of the family, and nothing else about them changes.',
  'pos.takeItAway': 'Take it away',
  'pos.takeAwayFailed': 'Could not take that position away',
  'pos.giveOneBelow': 'Give them one below.',
  'pos.somebodyElse': 'Somebody who can edit positions has to give them one.',
  'pos.givePosition': 'Give position',
  'org.regions': 'Regions',
  'org.addRegion': 'Add region',
  'org.addRegionTitle': 'Add a region',
  'org.addRegionHint': 'A group of chapters. A family can run on chapters alone, or on neither.',
  'org.regionPh': 'e.g. Texas',
  'org.noRegions': 'No regions yet. Every chapter sits under National until you add one.',
  'org.attached': 'Attached',
  'org.addChapter': 'Add chapter',
  'org.addChapterTitle': 'Add a chapter',
  'org.addChapterHint': 'Where a member actually belongs. They pick it on their own profile.',
  'org.chapterPh': 'e.g. Houston',
  'org.underNational': 'Every chapter you do not put in a region sits under',
  'org.inRegion': 'In region',
  'org.addRegionFailed': 'Could not add that region',
  'org.deleteRegion': 'Delete region',
  'org.deleteRegionFailed': 'Could not delete that region',
  'org.addChapterFailed': 'Could not add that chapter',
  'org.deleteChapter': 'Delete chapter',
  'org.deleteChapterFailed': 'Could not delete that chapter',
  'org.moveChapterFailed': 'Could not move that chapter',
  'org.nothingNational': 'Nothing is under National.',
  'bill.paidPlan': 'Paid plan',
  'bill.paidThrough': 'Paid through',
  'bill.howRenews': 'How it renews',
  'bill.movingTo': 'Moving to',
  'bill.cardsReceipts': 'Cards and receipts',
  'bill.whatCharged': 'What GENORRA has charged',
  'bill.neverCharged': 'Nothing yet — this family has never been charged.',
  'bill.covers': 'Covers',
  'bill.onFree': 'None — on the free plan',
  'bill.nextPayment': 'Next payment',
  'bill.nextPaymentDue': 'Next payment due',
  'bill.stopping': 'Monthly — stopping at the end of this period',
  'bill.monthlyAuto': 'Monthly, automatically',
  'bill.inAdvance': 'Paid in advance — nothing renews it',

  // ── THE WORDS AROUND A PRICE ────────────────────────────────────────────────────
  // The FIGURE comes from `formatPlanPrice`, which takes the reader's locale. These are
  // the words beside it, and they were English templates at six call sites: ` a month`,
  // `/month`, ` (… a month)`. Every one is English word order with an English
  // preposition — Spanish wants *al mes* and French *par mois*, and neither goes where
  // the English does in every construction. So the whole phrase is the key.
  'bill.perMonth': '{amount} a month',
  'bill.perMonthParen': '({amount} a month)',
  'bill.rateSentence': '{tier} is {amount} a month, month to month.',
  // THE COMPACT FORM, for inside a plan card where the long one does not fit. Two keys
  // rather than one, because "/month" is not an abbreviation of "a month" in every language
  // — and a card that says `{amount} al mes` in a 90px column wraps where the English does
  // not. Which form a surface wants is a layout decision the surface makes.
  'bill.perMonthSlash': '{amount}/month',

  // ── THE ORIENTATION PANELS BESIDE THE TWO FORMS ─────────────────────────────────
  // `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx`. The FORMS were keyed in
  // Phase 5; the panels beside them were not, so a reader who had been on Spanish Home for
  // four pages reached a Spanish form under an English explanation of what they were signing
  // in to. Which is the audience these panels exist for — somebody who followed a relative's
  // link and has never heard of the product.
  //
  // ── THE BRAND LEAD LINE IS INSIDE THE SENTENCE, NOT INTERPOLATED ────────────────
  // `APP_LEAD` is 'Where every generation belongs.' — English prose in `lib/brand.ts`, which
  // both pages rendered as `{APP_LEAD.toLowerCase()}` mid-sentence. Same decision `/about`
  // took: a translator needs the finished sentence, not a constant to lower-case and splice.
  // The product NAME is still never typed — it arrives as `{app}`.
  // ── THE THREE AUTH PAGES' TITLES AND DESCRIPTIONS ───────────────────────────────
  // These were static `metadata` exports, which cannot ask what language the reader is in —
  // so `/es/login` served a Spanish page under an English tab, an English bookmark and an
  // English link preview. Each page is a `generateMetadata` now.
  //
  // THE LENGTHS WERE ARGUED AT THE CALL SITES AND THOSE NOTES STILL HOLD: every title here
  // renders around 40 characters once `title.template` appends the product name, against the
  // ~60 a search result displays. A translation is longer than its English more often than
  // not — check a new one rather than assuming, because a cut title is worse than a plain one.
  'auth.meta.loginTitle': 'Sign In to Your Family Portal',
  'auth.meta.loginDescription':
    'Sign in to your {app} family portal to plan reunions, manage dues, share photos and '
    + 'keep your family connected.',
  // Matches the visible h1 in `LoginForm`, not the <title> — schema.org `name` is a claim
  // about what the page IS, and the two must not disagree. See the call site.
  'auth.meta.loginGraphName': 'Welcome back',
  'auth.meta.registerTitle': 'Create Your Free Family Account',
  'auth.meta.registerDescription':
    'Create a free {app} account to join or start your family’s private site — reunions, '
    + 'dues, photographs and the family tree, in one place.',
  'auth.meta.registerGraphName': 'Create your account',
  'auth.meta.inviteTitle': 'Accept Your Invitation',
  'auth.meta.forgotTitle': 'Reset Your Family Portal Password',
  'auth.meta.forgotDescription':
    'Forgotten your {app} password? Enter the email address on your family account and we '
    + 'will send you a link to set a new one.',

  // ── THE FIVE REFUSALS EVERY GUARDED ACTION CAN RETURN ───────────────────────────
  // `lib/auth/guard.ts`. About a hundred server actions open with `requireEdit` or
  // `requireMember` and return `g.message` verbatim, so these five sentences are by far the
  // most-read copy in the product that a reader only ever sees when something has gone
  // wrong — and they were English for everybody.
  //
  // `guard.notAuthorized` is deliberately vague and must stay so in every language: it says
  // nothing about which grant is missing, or that the resource exists. See the note above
  // `notAuthorized` in that file.
  'guard.sessionUnverified':
    'Your session could not be verified. Reload the page and try again.',
  'guard.signedOut': 'You are signed out. Sign in and try again.',
  'guard.notAuthorized': 'Not authorized',
  'guard.awaitingApproval': 'Your membership is awaiting approval',

  'auth.signInToYour': 'Sign in to your {app} account',
  'reg.invitedToJoin': 'You have been invited to join',
  'reg.joinOn': 'Join your family on {app}',
  'reg.startOn': 'Start a new family on {app}',

  'auth.aside.loginHeading': 'New here, or cannot get in?',
  'auth.aside.whatItIs':
    '{app} is a private site for one extended family — where every generation belongs. '
    + 'Members plan reunions and gatherings together, keep track of dues and contributions, '
    + 'share photographs, and build out the family tree in a place only the family can see. '
    + 'There is no public profile, and one family cannot see another’s pages at all.',

  // A TERM AND A BODY PER BULLET, and never one key with `<AsideTerm>` inside it: the
  // catalogue holds strings and a translator who moved a tag would move markup.
  'auth.aside.forgotTerm': 'Forgotten your password?',
  'auth.aside.forgotLink': 'Ask for a reset link',
  'auth.aside.forgotTail': 'and set a new one.',
  'auth.aside.unconfirmedTerm': 'Never confirmed your email?',
  'auth.aside.unconfirmedBody':
    'Registering sends a confirmation link, and an account stays inactive until it is '
    + 'opened. Look in your spam folder first — then sign in above, and the form will offer '
    + 'to send the link again.',
  'auth.aside.codeTerm': 'Joined with a family code?',
  'auth.aside.codeBody':
    'An administrator of that family admits new members. You can sign in while you wait — '
    + 'you will see a holding page until they do.',
  'auth.aside.invitedTerm': 'Invited by email?',
  'auth.aside.invitedBody':
    'Open the link in the invitation rather than signing in here. It knows which family you '
    + 'are joining, and it will bring you back to the invitation once you have signed in.',
  'auth.aside.wrongFamilyTerm': 'In the wrong family?',
  'auth.aside.wrongFamilyBody':
    'One account can belong to more than one — marriage puts most people in two. Sign in '
    + 'with it as usual and switch families from the header.',

  // ── A SENTENCE WITH TWO LINKS IN IT IS FIVE KEYS, AND THE PUNCTUATION IS IN THEM ─
  // `, or` is its own entry because that comma belongs to English: Spanish writes `, o` and
  // French `, ou`, and a language that wanted a semicolon or no comma at all could say so.
  // Splitting the sentence in two would have been the other answer and changes the copy.
  'auth.aside.noAccountLead': 'No account yet?',
  'auth.aside.createFree': 'Create a free one',
  'auth.aside.orSep': ', or',
  'auth.aside.readWhatApp': 'read what {app} does',
  'auth.aside.ifUnsure': 'if you were sent here and are not sure what this is.',

  'auth.aside.joiningHeading': 'Joining {app}',
  'auth.aside.joiningLede':
    '{app} gives one extended family a private place of its own — where every generation '
    + 'belongs. There is no public profile and nothing is shared outside the family you '
    + 'join. Members can:',
  'auth.aside.can1': 'Plan reunions and gatherings — who is doing what, and whether it is done.',
  'auth.aside.can2': 'Track dues and contributions, so nobody is chasing receipts.',
  'auth.aside.can3': 'Share photographs in collections the whole family can add to.',
  'auth.aside.can4': 'Build the family tree, and keep the record of who belongs to whom.',
  'auth.aside.nextHeading': 'What happens next',
  'auth.aside.confirmTerm': 'Confirm your email.',
  'auth.aside.confirmBody':
    'We send a link as soon as you register, and the account stays inactive until you open it.',
  'auth.aside.joiningTerm': 'Joining an existing family?',
  'auth.aside.joiningBody':
    'You need its family code — ask whoever invited you. Your request then waits for one of '
    + 'that family’s administrators to admit you; you can sign in in the meantime.',
  'auth.aside.startingTerm': 'Starting a new one?',
  'auth.aside.startingBody':
    'You are its first member, and you are given a six-character family code to pass around. '
    + 'Anyone holding it can ask to join, and you decide who comes in.',
  'auth.aside.freeForever':
    'The free account is free forever — no card, no trial clock, and no charge per relative, '
    + 'however many of you there are.',
  'auth.aside.seeTiers': 'See what each tier includes',
  'auth.aside.readHow': 'read how it works',
  'auth.aside.first': 'first.',

  // The one un-keyed run left in ForgotPasswordForm: the two states that page cannot
  // detect and therefore has to name.
  'auth.forgotNoAccount':
    'Use the address you registered with. If you never finished creating an account, there '
    + 'is nothing to reset —',
  'auth.forgotSignUp': 'sign up',
  'auth.forgotAskCode':
    'instead, and ask your family for their code if you are joining an existing family.',

  // ── WHAT A FREE FAMILY'S GATHERING IS MISSING ───────────────────────────────────
  // `components/gatherings/PlanningUpsell.tsx`. The plan NAME is interpolated from
  // `TIER_LABEL` rather than typed, per that file's own header — a plan name is a
  // proper noun and is not translated, which is why it is a placeholder here too.
  'gath.upsell.inlineHave': 'On {plan} a gathering is a date, a place and a description.',
  'gath.upsell.inlineAdds':
    'adds checklists, tasks handed out to relatives by name, and a budget drawn on a fund.',
  'gath.upsell.title': 'Plan this gathering with {plan}',
  'gath.upsell.lede':
    'Your gathering is on the calendar and every relative can see when and where it is. '
    + '{plan} is where it becomes a plan.',
  'gath.upsell.checklistsLead': 'Checklists you write once.',
  'gath.upsell.checklistsBody':
    'A reunion is the Welcome, the Picnic and the Send Off — build each as a template and '
    + 'schedule from it every year.',
  'gath.upsell.jobsLead': 'Jobs with names on them.',
  'gath.upsell.jobsBody':
    'Every step becomes a task held by one relative, who answers it and gets it approved or '
    + 'handed back with notes. Nobody has to remember who said they would bring the tables.',
  'gath.upsell.budgetLead': 'A budget drawn on a fund.',
  'gath.upsell.budgetBody':
    'What the gathering may spend, what each part of it claims, and whether that fits what '
    + 'the family actually has.',
  'gath.upsell.cta': 'See {plan}',
  'plan.whatIncludes': 'What each plan includes',
  'plan.current': 'Current',
  'plan.currentPlan': 'Current plan',
  'plan.comingSoon': 'Coming Soon',
  'plan.features': 'Features',
  'plan.passwordHint': 'Your sign-in password, so a plan cannot be downgraded by accident.',
  'plan.notOnDeployment': 'Not available on this deployment',
  'plan.billingFailed': 'Billing could not be loaded',
  'plan.whatYouLose': 'What you lose',
  'plan.yoursToday': 'This is your family’s plan today. Everything here is switched on.',
  'chk.monthly': 'Monthly',
  'chk.inAdvance': 'In advance',
  'chk.months': 'Months',
  'chk.howFar': 'How far ahead to pay',
  'chk.dueNow': 'Due now',
  'chk.leftOver': 'Left over, held as credit at Stripe',
  'chk.sameOverall':
    'Both options cost the same overall; the second just settles next month today.',
  'chk.payNothing': 'Pay nothing now',
  'chk.coverNext': 'Cover next month too — nothing to pay',
  'chk.thisAndNext': 'This month and next',
  'chk.restOfMonth': 'Rest of this month',
  'proc.loadFailed': 'Payment settings could not be loaded',
  'proc.notOn': 'Online payments are not switched on yet',
  'proc.stripeAccount': 'Stripe account',
  'proc.payingAuto': 'Members paying automatically',
  'proc.feeHeading': 'Card processing fees',
  'proc.feeBlurb': 'Stripe takes a fee on every card payment. It comes out of your family’s side, and this decides whether your family absorbs it or the member covers it.',
  'proc.feeWhoPays': 'Who pays the fee',
  'proc.feePayerFamily': 'The family absorbs it',
  'proc.feePayerMember': 'The member covers it',
  'proc.feePercent': 'Percentage rate (%)',
  'proc.feeFixed': 'Flat fee per payment ($)',
  'proc.feeExplainFamily': 'A member owing $40.00 is charged $40.00, and their dues fall by $40.00. Your family receives what is left after Stripe’s fee.',
  'proc.feeExplainMember': 'A member owing {owed} is charged {charged}, so your family receives the full {owed} and their dues fall by {owed}. The extra is shown as its own line before they pay.',
  'proc.feeRateUnusable': 'That rate cannot be added on top of a payment. Lower the percentage.',
  'proc.feesRecordedSoFar': 'GENORRA has recorded {amount} in card fees on the payments it posted.',
  'proc.billShowTotal': 'Show Stripe’s own total for this account',
  'proc.billAsking': 'Asking Stripe…',
  'proc.billTotal': 'Stripe’s own total for this account is {amount}, across {n} transactions.',
  'proc.billTotalAtLeast':
    'Stripe’s own total is at least {amount} — the first {n} transactions. The history '
    + 'is longer than this could read in one go, so treat it as a floor.',
  'proc.billDifference':
    'The {amount} difference is fees on charges GENORRA did not post, plus anything Stripe '
    + 'bills the account itself. Those are not in the P&L, on purpose.',
  'proc.billBelowRecorded':
    'Stripe’s total is {amount} LOWER than what has been recorded here, which should not '
    + 'happen — the P&L may be overstating this family’s fees.',
  'proc.billNoAccount': 'There is no connected Stripe account to total.',
  'proc.billUnavailable': 'Stripe could not be reached. The recorded figure above is unaffected.',
  'proc.feePolicySaved': 'Saved',
  'proc.continueStripe': 'Continue in Stripe',
  'proc.checkStripe': 'Check with Stripe',
  'proc.disconnect': 'Disconnect',
  'proc.passwordHint': 'Your sign-in password. We will then email you a code to finish.',
  'proc.linkExpired':
    'That Stripe link had expired before it was finished. Nothing was lost — press Continue '
    + 'in Stripe to pick up where the family left off.',
  'proc.disconnectConfirm': 'Disconnect Stripe?',
  'proc.codeFailed': 'We could not send the code. Nothing has changed — please try again.',
  'proc.enterCode': 'Enter the code we emailed you',
  'proc.disconnectStripe': 'Disconnect Stripe',
  'proc.disconnected': 'Stripe is disconnected',
  'proc.noProcessor': 'No payment processor connected',
  'proc.cannotPay':
    'Members cannot pay their dues by card while this is disconnected. Reconnecting brings '
    + 'back the same Stripe account, with its history and its bank details exactly as they '
    + 'were.',
  'proc.connectHint':
    'Connect this family’s own Stripe account and members can pay their dues by card. '
    + 'Payments post to the ledger and route into funds on their own, exactly as a payment '
    + 'keyed in by hand does.',
  'proc.opening': 'Opening Stripe…',
  'proc.reconnect': 'Reconnect Stripe',
  'proc.connect': 'Connect a Stripe account',
  'proc.cardsOn': 'Card payments are switched on',
  'proc.stripeNeeds': 'Stripe still needs something from this family',
  'proc.stripeReviewing': 'Stripe is reviewing this account',
  'proc.membersSeeButton': 'Members see a Pay Online button beside each due they owe.',
  'proc.finishFirst':
    'Members cannot pay online until this is finished. Continue in Stripe to complete it.',
  'proc.nothingMore':
    'Nothing more is needed from the family. Members cannot pay online until Stripe finishes.',
  'esum.noOffices': 'This election has no offices on it.',
  'esum.nobodyStanding': 'Nobody is standing for this office.',
  'esum.electionIs': 'This election is',
  'esum.canVote': 'Can vote',
  'esum.canVoteHint': 'Approved members of this election’s part of the family, with an account',
  'esum.haveVoted': 'Have voted',
  'esum.haveNot': 'Have not',
  'esum.chaseFromDirectory': 'Nobody is named — chase from the Directory',
  'esum.onBallot': 'On the ballot',
  'esum.onBallotHint': 'Nominations that have been accepted',
  'esum.results': 'Results',
  'esum.whereVotingStands': 'Where the voting stands',
  'ms.clear': 'Clear search',
  'ms.prevPage': 'Previous page',
  'ms.nextPage': 'Next page',
  'org.attached.memberOne': '1 member',
  'org.attached.memberMany': '{n} members',
  'org.attached.dueOne': '1 due',
  'org.attached.dueMany': '{n} dues',
  'org.attached.announcementOne': '1 announcement',
  'org.attached.announcementMany': '{n} announcements',
  'org.attached.positionOne': '1 position',
  'org.attached.positionMany': '{n} positions',
  'org.deleteRegionAria': 'Delete the {name} region',
  'org.deleteChapterAria': 'Delete the {name} chapter',
  'org.regionForAria': 'Region for the {name} chapter',
  'plan.upgradeTo': 'Upgrade to {plan}',
  'plan.downgradeTo': 'Downgrade to {plan}',
  'plan.downgradeBilledWithDate':
    'Nothing changes today. {current} stays open until the end of the period you have already '
    + 'paid for, and {next} starts on {date}. There is no refund for the rest of this period — '
    + 'that is what keeps the pages open until it ends. Nothing is deleted then, and what the '
    + 'cheaper plan does not include is kept for sixty days afterwards.',
  'plan.downgradeBilled':
    'Nothing changes today. {current} stays open until the end of the period you have already '
    + 'paid for. There is no refund for the rest of this period — that is what keeps the pages '
    + 'open until it ends. Nothing is deleted then, and what the cheaper plan does not include '
    + 'is kept for sixty days afterwards.',
  'plan.downgradeUnbilled':
    'Pages that are part of {current} stop opening. Nothing is deleted: every record stays '
    + 'exactly where it is for sixty days, and moving back up inside those sixty days brings the '
    + 'pages back with their data intact. After sixty days it is deleted — you are reminded four '
    + 'times first.',
  'proc.consequenceBase':
    'Members will no longer be able to pay online. Every payment already recorded is kept, '
    + 'and the family’s own Stripe account is untouched.',
  'proc.consequenceNone': 'You can reconnect the same account at any time.',
  'proc.consequenceOne':
    '1 relative currently pays their dues automatically, and that arrangement is cancelled at '
    + 'Stripe. Reconnecting brings the account back but NOT the payments — that relative would '
    + 'have to set theirs up again.',
  'proc.consequenceMany':
    '{n} relatives currently pay their dues automatically, and those arrangements are '
    + 'cancelled at Stripe. Reconnecting brings the account back but NOT the payments — each of '
    + 'them would have to set theirs up again.',
  'set.removeBody':
    'Nobody will be able to open this family, join it or accept an invitation to it. Nothing '
    + 'is deleted: every record stays exactly where it is, and only GENORRA support can bring '
    + 'the family back.',
  'org.attached.electionOne': '1 election',
  'org.attached.electionMany': '{n} elections',
  'org.stillAttached': '{name} still has {what} attached, so it cannot be deleted.',
  'acct.section.dues': 'Dues',
  'acct.section.funds': 'Funds',
  'pos.cat.executive_officer': 'Executive Officer',
  'pos.cat.appointed_position': 'Appointed Position',
  'pos.scope.national': 'National',
  'pos.scope.regional': 'Regional',
  'pos.scope.chapter': 'Chapter',
  'pos.scopedName': '{scope} {name}',
  'pos.duplicateAtScope':
    'Your family already has a {scope} position called “{name}”. The same title can exist '
    + 'once at each scope.',

  // ── THE ADMIN SCREENS ────────────────────────────────────────────────────────────
  // Members & Access, Elections, Funds, Gatherings, templates, income, and the member profile
  // editor. See the section above for the two vocabulary rules that carry through them.
  'access.rail': 'Members and access',
  'access.tab.members': 'Members',
  'access.tab.organization': 'Organization',
  'access.tab.approvals': 'Pending Approval',
  'access.tab.templates': 'Permission Templates',
  'access.noTables': 'Permission tables not found.',
  'access.readOnlyMembers': 'You can view the member list but not change who is on which template.',
  'access.readOnlyTemplates': 'You can view what each template grants but not change it.',
  'access.readOnlyOrg': 'You can see how the family is organized but not change it.',
  'access.officesKept': 'The offices your family keeps. A',
  'access.whoHoldsWhat': 'Who holds what is set on the Members tab',
  'access.permissions': 'Permissions',
  'access.noTemplates': 'No templates yet.',
  'access.profile': 'Profile',
  'access.reviewInApprovals': 'Review in Pending Approval',
  'access.cannotDisableSelf': 'You cannot disable your own access.',
  'access.enableMember': 'Enable member',
  'access.disableMember': 'Disable member',
  'access.enable': 'Enable',
  'access.disable': 'Disable',
  'access.templates': 'Templates',
  'access.startFrom': 'Start from',
  'access.blank': 'Blank',
  'access.copyOf': 'A copy of…',
  'access.create': 'Create',
  'access.all': 'All',
  'access.own': 'Own',
  'access.nothing': 'Nothing',
  'access.selectTemplate': 'Select a template to edit what it grants.',
  'access.filterPh': 'Filter members by name or email…',
  'access.templatesHelp': 'Help: Permission templates',
  'access.newTemplate': 'New template',
  'access.templateNamePh': 'Reunion Committee',
  'access.templateToCopy': 'Template to copy',
  'access.templateName': 'Template name',
  'access.awaiting': 'Awaiting approval',
  'access.disabled': 'Disabled',
  'access.approved': 'Approved',
  'access.disabledNoAccess': 'Disabled — no access to this family',
  'access.noMatch': 'No members match that filter.',
  'access.cannotDeleteAccount':
    'This person has an account, so their record cannot be deleted here. Switch them off instead, from their row menu.',
  'access.thisRecord': 'this record',
  'access.viewAccounts': 'With accounts',
  'access.viewRecords': 'Records',
  'access.whichPeople': 'Which people to list',
  'access.recordsLede':
    'Relatives somebody entered on the family tree who have never had an account. They hold no permissions, and most have an address the product generated for them.',
  'access.noRecords': 'Nobody in this family has been entered without an account.',
  'access.noRecordMatch': 'No records match that.',
  'access.generatedEmail': 'Generated address',
  'access.editProfileFor': 'Edit {name}’s profile',
  'access.deleteRecord': 'Delete record',
  'access.deleteRecordNamedAria': 'Delete the record for {name}',
  'access.deleteRecordTitle': 'Delete this record?',
  'access.deleteRecordBody':
    'This permanently deletes {name} and everything recorded about them — their place on the family tree, any photo tags naming them, and any meeting or check-in they were listed on. It cannot be undone. Nobody else is affected.',
  'access.noAccounts': 'No members with accounts in this family yet.',
  'access.noTemplate': 'No template',
  'access.applyTemplate': 'Apply permissions template',
  'access.applyTemplateAction': 'Apply template',
  'access.givePosition': 'Give a board position',
  'access.changePosition': 'Change board position',
  'access.boardPositions': 'Board positions',
  'access.saveTemplate': 'Save template',
  'access.deleteTemplate': 'Delete template',
  'access.whatMayDo': 'What members on this template may do.',
  'access.expandAll': 'Expand all',
  'access.collapseAll': 'Collapse all',
  'access.changeGrants': 'Change what this template grants',
  'ael.new': 'New Election',
  'ael.newLower': 'New election',
  'ael.whoVotes': 'Who votes',
  'ael.noAreas': 'This family has no regions or chapters yet, so every election is National.',
  'ael.opens': 'Opens',
  'ael.closesAfter': 'Closes after',
  'ael.voting': 'Voting',
  'ael.positions': 'Positions',
  'ael.winners': 'Winners',
  'ael.none': 'No elections yet.',
  'ael.announce': 'Announce',
  'ael.publish': 'Publish',
  'ael.returnToDraft': 'Return to draft',
  'ael.titlePh': '2027 Officer Elections',
  'ael.whichPart': 'Which part of the family this election is for',
  'ael.wholeFamily': 'The whole family (National)',
  'ael.oneRegion': 'One region',
  'ael.oneChapter': 'One chapter',
  'ael.needTitle': 'Give the election a title.',
  'ael.needRegion': 'Choose which region.',
  'ael.needChapter': 'Choose which chapter.',
  'ael.saveFailed': 'Could not save the election.',
  'ael.needPosition':
    'Add at least one position before publishing — a ballot with no offices on it has nothing '
    + 'to vote for.',
  'ael.publishConfirm': 'Publish this election',
  'ael.publishFailed': 'Could not publish.',
  'ael.draftFailed': 'Could not return it to draft.',
  'ael.delete': 'Delete election',
  'ael.deleteFailed': 'Could not delete.',
  'ael.editDraft': 'Edit draft',
  'ael.onlyDraft':
    'Only a draft can be edited. Once it is published, its dates are what the family was '
    + 'told.',
  'ael.savedDraft': 'Saved as a draft — nobody sees it until you publish it.',
  'ael.saveDraft': 'Save draft',
  'ael.createDraft': 'Create draft',
  'fnd.none': 'No funds yet.',
  'fnd.minBalance': 'Minimum Balance ($, optional)',
  'fnd.openToMembers': 'Open to member contributions',
  'fnd.fund': 'Fund',
  'fnd.balance': 'Balance',
  'fnd.collected': 'Collected',
  'fnd.disbursed': 'Disbursed',
  'fnd.transferred': 'Transferred',
  'fnd.minimum': 'Minimum',
  'fnd.builtIn': 'Built in',
  'fnd.open': 'Open',
  'fnd.createFirst': 'Create a fund first — a milestone is awarded out of one.',
  'fnd.noMilestones': 'No milestones yet.',
  'fnd.milestoneName': 'Milestone Name',
  'fnd.awardAmount': 'Award Amount ($)',
  'fnd.milestone': 'Milestone',
  'fnd.award': 'Award',
  'fnd.duesRouting': 'Dues Routing',
  'fnd.createFirstRouting': 'Create a fund first to configure routing.',
  'fnd.allocation': 'Allocation',
  'fnd.priority': 'Priority',
  'fnd.allocationPct': 'Allocation %',
  'fnd.minimumDollars': 'Minimum $',
  'fnd.minimumDollarsPlain': 'Minimum $',
  'fnd.newFundHint': 'A pot that dues route into and disbursements come out of.',
  'fnd.namePh': 'College Fund',
  'fnd.minPh': '5000.00',
  'fnd.descPh': 'For graduates…',
  'fnd.donationsFundHint':
    'Created automatically. Holds every donation the family receives, can be given a share of '
    + 'dues like any other fund, and cannot be deleted or switched off.',
  'fnd.newMilestoneHint': 'An award a member can be paid out of a fund when they reach it.',
  'fnd.milestonePh': 'Graduate high school',
  'fnd.awardPh': '250.00',
  'fnd.milestoneDescPh': 'High school diploma or GED',
  'fnd.moveUp': 'Move up',
  'fnd.moveDown': 'Move down',
  'fnd.routingOff':
    'Routing is off. Contributions stay in the fund they were given to until these add up to '
    + '100%.',
  'fnd.saveRouting': 'Save routing',
  'fnd.saveRoutingConfirm':
    'Save this routing configuration? Future dues payments will be split across funds using '
    + 'these percentages and priorities.',
  'fnd.routingSaved': 'Routing saved.',
  'fnd.saveFailed': 'Failed to save',
  'fnd.nameRequired': 'Name required',
  'fnd.delete': 'Delete fund',
  'fnd.deleteBody': 'Delete this fund and its milestones? This cannot be undone.',
  'fnd.openToContrib': 'Open fund to contributions',
  'fnd.closeToContrib': 'Close fund to contributions',
  'fnd.openFund': 'Open fund',
  'fnd.closeFund': 'Close fund',
  'fnd.needAll': 'Fund, name and amount required',
  'fnd.deleteMilestone': 'Delete milestone',
  'fnd.deleteMilestoneBody': 'Delete this milestone? This cannot be undone.',
  'fnd.addFund': 'Add Fund',
  'fnd.openToMembersShort': 'Open to members',
  'fnd.makeOpen': 'Make open',
  'fnd.addMilestone': 'Add Milestone',
  'fnd.saveRoutingAction': 'Save Routing',
  'agat.rail': 'Gathering management areas',
  'agat.pane.gatherings': 'Gatherings',
  'agat.pane.queue': 'Review queue',
  'agat.pane.templates': 'Templates',
  'agat.management': 'Gathering Management',
  'agat.memberView': 'Member view',
  'agat.details': 'Details',
  'agat.location': 'Location',
  'agat.summary': 'Summary',
  'agat.delete': 'Delete gathering',
  'agat.readOnly': 'You can see this gathering’s plan but not change it.',
  'agat.dashboardBand': 'Dashboard band',
  'agat.showAcrossTop': 'Show this across the top of the Dashboard',
  'agat.bandPhoto': 'Band photo',
  'agat.removePhoto': 'Remove photo',
  'agat.fundAndBudget': 'Fund and budget',
  'agat.segments': 'Segments',
  'agat.noSegments': 'No templates are linked to this gathering, so it has no segments yet.',
  'agat.segment': 'Segment',
  'agat.day': 'Day',
  'agat.place': 'Place',
  'agat.addSegment': 'Add another segment',
  'agat.createOneUnder': 'Create one under',
  'agat.somebodyAccounting':
    'Somebody who runs the family’s Accounting has to create one, and it becomes '
    + 'available here.',
  'agat.severalMayDraw':
    'Several gatherings may draw on one fund. Clearing the fund clears the budget with it.',
  'agat.budgetDollars': 'Budget ($)',
  'agat.taskReadOnly': 'You can read this task but not assign it or rule on it.',
  'agat.leaveUnassigned': 'Leave it unassigned',
  'agat.budgetLine': 'Budget line ($)',
  'agat.review': 'Review',
  'agat.whatNeedsChange': 'What needs to change',
  'agat.sendBack': 'Send back…',
  'agat.approvedAnswer': 'This answer is approved',
  'agat.whyOptional': 'Why, if you want to say (optional)',
  'agat.reopenEllipsis': 'Reopen…',
  'agat.fundHelp': 'How a gathering’s fund and budget work',
  'agat.usualPlace': 'The template’s usual place',
  'agat.notStated': 'Not stated',
  'agat.assigneeHint':
    'Anybody the family has approved, whether or not they have an account — a relative with '
    + 'no login can still be asked to bring the photographs.',
  'agat.nobodyApproved': 'Nobody in this family has been approved yet.',
  'agat.nothingSet': 'Nothing set',
  'agat.notePh1': 'The caterer needs a phone number as well as a name.',
  'agat.notePh2': 'The hall changed the booking, so the time needs redoing.',
  'agat.saveFailed': 'Could not save that gathering',
  'agat.changeFailed': 'Could not change that',
  'agat.uploadFailed': 'Could not upload that photo',
  'agat.removePhotoFailed': 'Could not remove that photo',
  'agat.addTemplateFailed': 'Could not add that template',
  'agat.removeTemplate': 'Remove template',
  'agat.removeTemplateFailed': 'Could not remove that template',
  'agat.deleteFailed': 'Could not delete that gathering',
  'agat.noDates': 'No dates yet',
  'agat.addSteps': 'Add its steps',
  'agat.noTasksAddTemplate': 'No tasks yet. Add a template above and its steps become tasks here.',
  'agat.manage': 'Manage',
  'agat.segmentFailed': 'Could not save that segment',
  'agat.template': 'Template',
  'agat.noTasksFromThis': 'No tasks from this one',
  'agat.budgetFailed': 'Could not save that budget',
  'agat.noBudgetSet': 'No budget set',
  'agat.chooseFundFirst': 'Choose a fund first',
  'agat.saveBudget': 'Save budget',
  'agat.saveThatFailed': 'Could not save that',
  'agat.budgetLineFailed': 'Could not save that budget line',
  'agat.approveThis': 'Approve this answer',
  'agat.approve': 'Approve',
  'agat.approveFailed': 'Could not approve that answer',
  'agat.sayWhatChanges': 'Say what needs to change — this is what they read before trying again.',
  'agat.sayWhatChangesMember':
    'Say what needs to change — this is what the member reads before trying again.',
  'agat.sendBackFailed': 'Could not send that task back',
  'agat.reopenThis': 'Reopen this task',
  'agat.reopen': 'Reopen',
  'agat.reopenFailed': 'Could not reopen that task',
  'agat.approvedAnswerLabel': 'The approved answer',
  'agat.theirAnswer': 'Their answer',
  'agat.approved': 'Approved',
  'agat.sentBack': 'Sent back',
  'agat.saveWhoWhen': 'Save who and when',
  'agat.saveBudgetLine': 'Save budget line',
  'agat.sendBackWithNotes': 'Send back with notes',
  'agat.reopening': 'Reopening…',
  'agat.new': 'New gathering',
  'agat.when': 'When',
  'agat.budgetUnavailable': 'Budget unavailable',
  'agat.unavailable': 'Unavailable',
  'agat.open': 'Open',
  'agat.noBudget': 'No budget',
  'agat.queueReadOnly': 'You can see what is waiting but not rule on it.',
  'agat.nothingRecorded': 'Nothing was recorded with this submission.',
  'agat.theirNote': 'Their note',
  'agat.addOneIn': 'Add one in the',
  'agat.starts': 'Starts',
  'agat.ends': 'Ends',
  'agat.singleDay': 'Leave empty for a single day.',
  'agat.openGathering': 'Open the gathering',
  'agat.premierHint':
    'Flagged for the Dashboard. Several gatherings may be flagged; the soonest upcoming one '
    + 'is the one shown.',
  'agat.pickTemplates': 'Pick the templates it is built from, then say when and where.',
  'agat.summaryPh': 'What this gathering is, for the people being asked to help.',
  'agat.pressNew': 'Press New gathering and pick the templates it should be built from.',
  'agat.somebodySchedule': 'Somebody who can schedule gatherings has to create the first one.',
  'agat.noFund': 'No fund',
  'agat.createFailed': 'Could not create that gathering',
  'agat.everyStep':
    'Every step of the templates you pick becomes a task you can hand out. Pick none and this '
    + 'is a date with no tasks.',
  'agat.create': 'Create gathering',
  'tmpl.name': 'Template name',
  'tmpl.whoCanSchedule': 'Who can schedule from this',
  'tmpl.whoCanScheduleShort': 'Who can schedule',
  'tmpl.step': 'Step',
  'tmpl.whatItAsks': 'What it asks for',
  'tmpl.templateToInclude': 'Template to include',
  'tmpl.pickTemplate': 'Pick a template…',
  'tmpl.helpText': 'Help text',
  'tmpl.suggestedBudget': 'Suggested budget ($)',
  'tmpl.suggestedBudgetShort': 'Suggested budget',
  'tmpl.add': 'Add template',
  'tmpl.readOnly': 'You can view this template but not change it.',
  'tmpl.archiveInstead': 'Archive it instead',
  'tmpl.steps': 'Steps',
  'tmpl.addStep': 'Add step',
  'tmpl.noSteps': 'No steps yet. A template with no steps builds a gathering with no work in it.',
  'tmpl.asksFor': 'Asks for',
  'tmpl.namePh': 'e.g. Family Reunion',
  'tmpl.descPh':
    'What this template is for, and anything an organizer should know before scheduling from '
    + 'it.',
  'tmpl.stepsHint':
    'One step per thing somebody has to do or decide. Steps are copied onto the tasks of '
    + 'every gathering scheduled from this template, so editing one never changes a gathering '
    + 'already running.',
  'tmpl.stepPh': 'e.g. Book the hall',
  'tmpl.helpPh': 'What the assignee should know — who to call, what counts as done.',
  'tmpl.adminsOnly': 'Administrators only',
  'tmpl.anyMember': 'Any member',
  'tmpl.adminsOnlyHint':
    'Only somebody who can manage gatherings may start one from this template.',
  'tmpl.anyMemberHint':
    'Any member who may schedule a gathering can start one from this template. They still '
    + 'cannot edit the template itself.',
  'tmpl.notUsed': 'Not used by any gathering yet',
  'tmpl.addFailed': 'Could not add that template',
  'tmpl.saveFailed': 'Could not save that template',
  'tmpl.addATemplate': 'Add a template',
  'tmpl.nameItHint':
    'Name it for the occasion — “Family Reunion”, “Memorial Service”, “Scholarship Banquet”. '
    + 'Its steps are added on the card once it is on the list.',
  'tmpl.neverChanges':
    'Changing a template never changes a gathering already built from it — every task keeps '
    + 'its own copy of what it asked.',
  'tmpl.pickStepTemplate': 'Pick the template this step includes',
  'tmpl.addStepFailed': 'Could not add that step',
  'tmpl.saveStepFailed': 'Could not save that step',
  'tmpl.requiredHint': 'The gathering is not finished until this one is answered and approved.',
  'tmpl.optionalHint': 'Useful but optional — the gathering can be completed without it.',
  'tmpl.addOneThen': 'Add one, then give it a step for each thing somebody has to do.',
  'tmpl.somebodyCan': 'Somebody who can add templates has to create the first one.',
  'tmpl.archiveFailed': 'Could not archive that template',
  'tmpl.restoreFailed': 'Could not restore that template',
  'tmpl.delete': 'Delete template',
  'tmpl.deleteFailed': 'Could not delete that template',
  'tmpl.moveStepFailed': 'Could not move that step',
  'tmpl.deleteStep': 'Delete step',
  'tmpl.deleteStepFailed': 'Could not delete that step',
  'tmpl.restore': 'Restore',
  'tmpl.archive': 'Archive',
  'inc.goalAmount': 'Goal Amount',
  'inc.dueAmount': 'Due Amount',
  'inc.frequency': 'Frequency',
  'inc.startAge': 'Members start paying at age (optional)',
  'inc.noBloodline': 'Nobody has been marked as being in your family’s bloodline yet, so a due restricted to it would be owed by nobody. Tick {control} on the family tree first.',
  'inc.owedBy': 'Owed by',
  'inc.nationalWhole': 'National — the whole family',
  'inc.goal': 'Goal',
  'inc.payment': 'Payment',
  'inc.startDate': 'Start Date',
  'inc.endDate': 'End Date',
  'inc.driveFor': 'This drive is for (optional)',
  'inc.newDues': 'New Dues',
  'inc.editDues': 'Edit Dues',
  'inc.duesHint': 'Dues every member of the family owes on this cadence.',
  'inc.noDues': 'No dues yet.',
  'inc.annualDues': 'Annual Dues',
  'inc.newDonation': 'New Donation',
  'inc.editDonation': 'Edit Donation',
  'inc.noDonations': 'No donations yet.',
  'inc.scholarshipDrive': 'Scholarship Drive',
  'inc.cannotDecline': 'Every member owes this and cannot decline it.',
  'inc.canOptOut':
    'Members can opt out of this from their Summary, and it will not count toward what they '
    + 'owe.',
  'inc.blankAge': 'Leave blank and every member owes this, whatever their age.',
  'inc.bloodlineHint': 'Only members marked as being in the family’s bloodline owe this. Anybody who married in, and anybody the family has not marked, owes nothing and will not see it on their Dues screen.',
  'inc.whoOwesIt': 'Who owes it',
  'inc.scopeAllMembers': 'All members',
  'inc.scopeBloodline': 'Bloodline only',
  'inc.scopeNonBloodline': 'Relatives who married in only',
  'inc.nonBloodlineHint':
    'Only relatives who are NOT marked as being in the bloodline owe this. Somebody '
    + 'in the bloodline never will.',
  'inc.whereItLands': 'Where a payment lands',
  'inc.fundWaterfall': 'Split across the funds (Routing)',
  'inc.fundWaterfallHint': 'Payments are divided across the family’s funds by the Routing table.',
  'inc.fundDirectHint': 'The whole payment goes into this one fund. Routing is skipped.',
  'inc.straightToFund': 'Straight to {fund}',
  'inc.aDeletedFund': 'one fund',
  'dues.onlyMembersWhoMarriedIn': 'Only relatives who are not in the bloodline owe this',
  'act.donationsGoToDonationsFund': 'A donation drive always goes into the family’s Donations fund and cannot name another.',
  'inc.howeverCame': 'Every member owes this, however they came into the family.',
  'inc.everyMember': 'Every member of the family owes this.',
  'inc.regionHint':
    'Only members whose chapter is in that region owe this. A member with no chapter is under '
    + 'National and owes nothing regional.',
  'inc.chapterHint':
    'Only members in that chapter owe this. A member with no chapter is under National and '
    + 'owes nothing scoped.',
  'inc.fixedTerms':
    'Payments have been recorded against this due, so its start date, amount, frequency, '
    + 'starting age, bloodline setting and who owes it are fixed — every one of those payments '
    + 'was made against these terms. The end date can still change.',
  'inc.donationFixed': 'This donation has received funds, so its start date is fixed.',
  'inc.amountRequired': 'Amount required',
  'inc.endInPast': 'The end date cannot be in the past.',
  'mpe.loading': 'Loading this member’s profile…',
  'mpe.nationalNoChapter': 'National — no chapter',
  'mpe.signIn': 'Sign-in',
  'mpe.general': 'General',
  'mpe.address': 'Address',
  'mpe.additional': 'Additional information',
  'mpe.relativesMove': 'Relatives without accounts of their own move with them.',
  'mpe.loadFailed': 'That member could not be loaded.',
  'mpe.bothRequired': 'First name and last name are both required.',
  'mpe.saveThis': 'Save this member’s profile',
  'mpe.saveFailed': 'Those changes could not be saved.',
  'mpe.sendReset': 'Send a password reset',
  'mpe.currentKeeps': 'Their current password keeps working until they use it.',
  'mpe.sendLink': 'Send the link',
  'mpe.linkFailed': 'That link could not be sent.',
  'mpe.signInNotEditable': 'Their sign-in email and password are not editable here.',
  'mpe.onlyMember': 'Only the member can change their own sign-in address.',
  'mpe.chooseCountry': 'Choose a country first.',
  'agat.progress': '{done} of {total} approved',
  'agat.waiting': '{n} waiting',
  'tmpl.usedByOne': 'Used by 1 gathering',
  'tmpl.usedByMany': 'Used by {n} gatherings',
  'inc.namedRegion': '{name} region',
  'inc.namedChapter': '{name} chapter',
  'tmpl.deleteOneStep':
    'Delete “{name}” and its step? No gathering already built from it changes — every task '
    + 'keeps its own copy of what it asked and what was answered. This cannot be undone.',
  'tmpl.deleteManySteps':
    'Delete “{name}” and its {n} steps? No gathering already built from it changes — every '
    + 'task keeps its own copy of what it asked and what was answered. This cannot be undone.',

  // ── SIGNING IN, REGISTERING, AND THE STAFF CONSOLE ───────────────────────────────
  // The auth screens have NO CALLER YET, so their language comes from `Accept-Language` — the
  // one place that header is the right source, because the request is the reader's own browser
  // and there is no stored choice to prefer. `lib/auth/locale.ts` argues it.
  //
  // The staff console is translated too. It is GENORRA's own screen rather than a family's, and
  // its readers are employees — but "the whole site" was the ask, and an employee who reads
  // Spanish reads Spanish here as well.
  'auth.login': 'Login',
  'auth.getStarted': 'Get Started',
  'auth.welcomeBack': 'Welcome back',
  'auth.password': 'Password',
  'auth.forgot': 'Forgot password?',
  'auth.forgotTitle': 'Forgot your password?',
  'auth.forgotLede': 'Enter your email and we’ll send you a reset link.',
  'auth.confirmEmail': 'Confirm your email address',
  'auth.createAccount': 'Create an account',
  'auth.noAccount': 'Don’t have an account? ',
  'auth.createOne': 'Create one',
  'auth.badEmail': 'Enter a valid email address',
  'auth.needPassword': 'Password is required',
  'auth.signingIn': 'Signing in…',
  'auth.signIn': 'Sign In',
  'auth.sendLinkAgain': 'Send the link again',
  'auth.emailSent': 'Email sent',
  'auth.resetSent':
    'If that address is in our system, you’ll receive a password reset link shortly.',
  'auth.nothingArrived': 'Nothing arrived?',
  'auth.backToSignIn': 'Back to sign in',
  'auth.sendReset': 'Send Reset Link',
  'auth.signOut': 'Sign Out',
  'auth.chooseNew': 'Choose a new password',
  'auth.expiredLink': 'That reset link has expired. Request a new one and try again.',
  'auth.tooShort': 'Password must be at least 8 characters',
  'auth.noMatch': 'Passwords do not match',
  'reg.familyCreated': 'Family created!',
  'reg.shareCode': 'Share this code with family members so they can join.',
  'reg.yourCode': 'Your Family Code',
  'reg.writeDown': 'Write this down — you’ll need it to invite family members.',
  'reg.alsoSent':
    'We also sent a confirmation link to your inbox. Click it to activate your account.',
  'reg.startsOn': 'Your family starts on',
  'reg.goToDashboard': 'Go to Dashboard →',
  'reg.checkEmail': 'Check your email',
  'reg.confirmSent':
    'We sent a confirmation link to your inbox. Click it to activate your account, then sign '
    + 'in.',
  'reg.createYours': 'Create your account',
  'reg.joinFamily': 'Join a Family',
  'reg.startFamily': 'Start a New Family',
  'reg.invitedAddress': 'The address your invitation was sent to.',
  'reg.confirmPassword': 'Confirm password',
  'reg.codeShared': 'Enter the code shared with you by your family.',
  'reg.codeGenerated': 'A unique family code will be generated for you to share.',
  'reg.haveAccount': 'Already have an account? ',
  'reg.needFirstName': 'First name is required',
  'reg.needLastName': 'Last name is required',
  'reg.needCode': 'Family code is required',
  'reg.needFamilyName': 'Family name is required',
  'reg.freeForever': 'Free forever',
  'reg.canMove': 'You can move to a paid plan at any time from Family Settings.',
  'reg.joining': 'Joining…',
  'reg.creatingFamily': 'Creating family…',
  'reg.joinAction': 'Join Family',
  'reg.createAction': 'Create Family',
  'reg.firstNamePh': 'Jane',
  'reg.lastNamePh': 'Doe',
  'reg.codePh': 'e.g. ABC123',
  'reg.familyNamePh': 'e.g. The Smiths',
  'staff.nav': 'Staff console',
  'staff.overview': 'Overview',
  'staff.families': 'Families',
  'staff.accounts': 'Accounts',
  'staff.access': 'Access',
  'staff.whoHasAccess': 'Who has access',
  'staff.account': 'Account',
  'staff.why': 'Why',
  'staff.granted': 'Granted',
  'staff.grantAccess': 'Grant access',
  'staff.kindOfAccess': 'Kind of access',
  'staff.choose': 'Choose…',
  'staff.whyNeeded': 'Why they need it',
  'staff.you': 'You',
  'staff.addressUnknown': 'Address not known from here.',
  'staff.revoke': 'Revoke',
  'staff.emailPh': 'name@example.com',
  'staff.whyPh': 'e.g. On the support rotation from August. Escalations for billing tickets.',
  'staff.support': 'Support',
  'staff.engineer': 'Engineer',
  'staff.grantFailed': 'That did not go through. Try again.',
  'staff.granting': 'Granting…',
  'staff.ownAccess':
    'Your own access. Another owner has to change it — that is what stops one click locking '
    + 'the console.',
  'staff.lastOwner':
    'The last owner. Make somebody else an owner first, or nobody will be able to grant staff '
    + 'access.',
  'staff.makeOwner': 'Make owner',
  'staff.removeAccess': 'Remove access',
  'staff.lookUpOne': 'Look up one address',
  'staff.noAccount': 'No account exists with this address.',
  'staff.accountExists': 'An account exists.',
  'staff.inTheseFamilies': 'In these families',
  'staff.allAccounts': 'All accounts',
  'staff.lastSignIn': 'Last sign-in',
  'staff.created': 'Created',
  'staff.inNoFamily': 'In no family',
  'staff.lookupPh': 'someone@example.com',
  'staff.filterAddress': 'Filter by any part of an address…',
  'staff.enterFromTicket': 'Enter the address from the ticket.',
  'staff.confirmed': 'The address is confirmed.',
  'staff.hasSignedIn':
    'It has been signed in with before, so the password was working at some point.',
  'staff.neverSignedIn':
    'It has never been signed in with. A forgotten password is as likely as anything else.',
  'staff.noAccounts': 'There are no accounts on this platform yet.',
  'staff.confirmedShort': 'Confirmed',
  'staff.notConfirmed': 'Not confirmed',
  'staff.family': 'Family',
  'staff.restore': 'Restore',
  'staff.restoreFamily': 'Restore family',
  'staff.filterFamily': 'Filter by family name or code…',
  'staff.noFamilies': 'There are no families on this platform yet.',
  'staff.removed': 'Removed',
  'staff.active': 'Active',
  'staff.owner': 'Owner',
  'staff.hint.support':
    'Can open the console and read every family and every account on the platform, and can '
    + 'restore a removed family. Cannot see or change who has access.',
  'staff.hint.engineer':
    'Exactly the same access as Support today — nothing in the console tells the two apart. '
    + 'It is a label for your own records, not a level.',
  'staff.hint.owner':
    'Everything above, plus this screen: they can grant staff access, change what kind '
    + 'anybody has, and take it away — including yours.',
  'inc.rangeBoth': '{from} – {to}',
  'inc.rangeFrom': 'from {from}',
  'inc.rangeUntil': 'until {to}',

  // ──── THE FOUR PLAN TAGLINES — read by /admin/settings, /upgrade and /register ────
  'tier.tagline.free': 'Get your whole family in one place. All of them.',
  'tier.tagline.standard': 'Run the family: the tree, the money and who is doing what.',
  'tier.tagline.plus': 'For families collecting real payments and answering to a board.',
  'tier.tagline.premium': 'In every relative’s pocket, and out in the world.',

  // ──── THE UPGRADE SCREEN’S SENTENCES ────────────────────────────────────────────
  'upg.forFamilies': '{tier} is for families who need more: {tagline}',
  'upg.alsoOn': 'Also on {tier}',
  'upg.whatIncludes': 'What {tier} includes',

  // ──── THE IN-PRODUCT PLAN LIST — 30 claims, keyed on their own id ───────────────
  'plan.adds.free/every-relative-free.label': 'Every relative, at no charge',
  'plan.adds.free/every-relative-free.detail': 'Unlimited members, with no per-person fee.',
  'plan.adds.free/directory.label': 'A directory of the whole family',
  'plan.adds.free/directory.detail': 'Who is who, and how to reach them.',
  'plan.adds.free/shared-calendar.label': 'The gathering on a shared calendar',
  'plan.adds.free/shared-calendar.detail':
    'The date, the place and the details, on one page everybody can see.',
  'plan.adds.free/announcements.label': 'Announcements the whole family sees',
  'plan.adds.free/announcements.detail':
    'Family news on everyone’s dashboard instead of buried in a group text.',
  'plan.adds.free/chat.label': 'Chat, family-wide and private',
  'plan.adds.free/chat.detail': 'Keep talking between gatherings.',
  'plan.adds.free/one-account-many-families.label': 'One account, however many families',
  'plan.adds.free/one-account-many-families.detail':
    'Belong to both sides, and switch between them without a second login.',
  'plan.adds.free/nothing-scrolls-away.label': 'Nothing is lost when it scrolls away',
  'plan.adds.free/nothing-scrolls-away.detail':
    'Every announcement, and everything sent to you, searchable long afterwards.',
  'plan.adds.free/manual.label': 'A manual your relatives will actually use',
  'plan.adds.free/manual.detail':
    'Every screen explained by name, reachable from the corner of the screen they are on.',
  'plan.adds.standard/family-tree.label': 'The family tree, traced back',
  'plan.adds.standard/family-tree.detail':
    'How everyone is related, generation by generation, with blood and marriage told apart.',
  'plan.adds.standard/ledger.label': 'A real ledger for the money you collect',
  'plan.adds.standard/ledger.detail':
    'Dues plans and a contribution ledger for cash, recorded instead of remembered.',
  'plan.adds.standard/gathering-budget.label': 'Plan the gathering, not just the date',
  'plan.adds.standard/gathering-budget.detail':
    'Checklists a gathering is built from, and a budget drawn on one of your funds.',
  'plan.adds.standard/duties.label': 'Everybody knows their duties',
  'plan.adds.standard/duties.detail':
    'Every step handed to a named relative, with what came back and whether it was '
    + 'accepted.',
  'plan.adds.standard/separation-of-duties.label': 'Separation of duties',
  'plan.adds.standard/separation-of-duties.detail':
    'Per-feature permissions, so recording dues is not the same as paying money out.',
  'plan.adds.standard/profile-pictures.label': 'A face against every name',
  'plan.adds.standard/profile-pictures.detail':
    'Profile pictures, on the directory, the tree and everywhere a member is listed.',
  'plan.adds.plus/card-payments.label': 'Take payment the way your family pays',
  'plan.adds.plus/card-payments.detail':
    'Card, debit, PayPal, Apple Pay, Google Pay and Cash App, with funds behind them.',
  'plan.adds.plus/dues-projections.label': 'Know what is still owed, before you have to ask',
  'plan.adds.plus/dues-projections.detail':
    'Every relative who owes this year, what has come in, and who has still to pay.',
  'plan.adds.plus/pnl.label': 'A profit and loss for your treasurer',
  'plan.adds.plus/pnl.detail':
    'The statement the board asks for, plus transfers between your funds.',
  'plan.adds.plus/membership-report.label': 'The numbers leadership asks for',
  'plan.adds.plus/membership-report.detail':
    'Dues collected against outstanding, and your membership by region and chapter.',
  'plan.adds.plus/activity-reports.label': 'Reports on more than the money',
  'plan.adds.plus/activity-reports.detail':
    'Reunion work returned, election turnout, meetings held, and the offices nobody holds.',
  'plan.adds.plus/elections.label': 'Elect your officers properly',
  'plan.adds.plus/elections.detail':
    'Nominate, accept or decline, then vote — family-wide, or one region or chapter.',
  'plan.adds.plus/library.label': 'The paperwork, and the structure to match',
  'plan.adds.plus/library.detail':
    'Searchable bylaws, minutes that record how the room voted, and regions and chapters '
    + 'with their own leadership.',
  'plan.adds.plus/officer-notes.label': 'Every office keeps its own notebook',
  'plan.adds.plus/officer-notes.detail':
    'Notes that stay with the role rather than the person, read only by whoever holds it.',
  'plan.adds.plus/gallery.label': 'Photographs, findable',
  'plan.adds.plus/gallery.detail': 'Collections per gathering, with tagging.',
  'plan.adds.premium/dues-reminders.label': 'Stop chasing relatives for their dues',
  'plan.adds.premium/dues-reminders.detail':
    'Reminders go out as each installment falls due, and stop when it is paid.',
  'plan.adds.premium/notifications.label': 'News that arrives rather than waiting to be found',
  'plan.adds.premium/notifications.detail':
    'Notifications on the phone and in the browser, for announcements, messages and the '
    + 'tasks you have been given.',
  'plan.adds.premium/mobile-apps.label': 'The family in everybody’s pocket',
  'plan.adds.premium/mobile-apps.detail':
    'Apps for iPhone and Android, on the same family account.',
  'plan.adds.premium/email-distributions.label': 'Email the whole family without building a list',
  'plan.adds.premium/email-distributions.detail':
    'Distributions drawn straight from your membership.',
  'plan.adds.premium/safety-check-ins.label': 'Check that everyone is safe, in one tap each',
  'plan.adds.premium/safety-check-ins.detail':
    'Ask the relatives in one area whether they are safe, and see who has not answered.',
  'plan.adds.premium/family-website.label': 'Your family’s own website, keeping itself current',
  'plan.adds.premium/family-website.detail':
    'It builds itself from your next gathering, newest photographs and latest announcement.',
  'plan.adds.premium/custom-domain.label': 'A proper address for it, ready to go',
  'plan.adds.premium/custom-domain.detail':
    'No hosting bill, no plugins, and nobody in the family maintaining it.',

  // ── EVERY REFUSAL A SERVER ACTION CAN RETURN ────────────────────────────────────
  // 395 sentences across 42 modules in `app/actions/`, keyed on 2026-08-27. They were the
  // largest body of English left in the product after the public site was finished, and the
  // one a member is most likely to meet: a form's `<FormError>` renders whatever the action
  // returned, so every one of these was English to every reader at the moment something had
  // just gone wrong.
  //
  // ── THE TRANSLATOR ARRIVES ON THE GUARD, WHICH IS WHY THERE IS NO PLUMBING ──────
  // `GuardOk.t`, resolved inside the `Promise.all` `resolve()` already awaits — so an action
  // reads `g.t('act.…')` with no extra round trip and no extra line. See that field's own
  // note: the alternative was `const { t } = await callerI18n(g.userId)` written out at a
  // hundred call sites, each adding a third read of `people` for the same user.
  //
  // ── THE KEY IS DERIVED FROM THE ENGLISH AND IS NOT A DESCRIPTION ────────────────
  // `act.chooseChapter`, `act.gatheringNotFound`. Mechanical, so 702 call sites could be
  // swept rather than hand-edited, and stable, so a re-run produces the same names. Where
  // two different sentences slug to one name the later ones carry a numeric suffix — which
  // is ugly and is better than a hand-picked name nobody can regenerate.
  //
  // ── A REFUSAL SAYS WHAT TO DO, IN EVERY LANGUAGE ────────────────────────────────
  // Most of these are instructions rather than errors — "Choose a chapter", "Give the album
  // a name" — and the translations keep that voice. `usted` and `vous` throughout, as
  // everywhere else in these catalogues. The three "not found" families stay terse and
  // uninformative on purpose: `guard.notAuthorized`'s argument applies to them too.
  'act.budgetCannotNegative': 'A budget cannot be negative',
  'act.budgetLineCannotNegative': 'A budget line cannot be negative',
  'act.budgetLineMustWholeNumber': 'A budget line must be a whole number of cents, and not negative',
  'act.budgetMustWholeNumberCents': 'A budget must be a whole number of cents, and not negative',
  'act.donationNeedsGoalWorkToward': 'A donation needs a goal to work toward',
  'act.duesScheduleRequired': 'A dues schedule is required',
  'act.gatheringNeedsTitle': 'A gathering needs a title',
  'act.publishedElectionCannotEditedReturn': 
    'A published election cannot be edited. Return it to draft first — which '
    + 'is only possible while nobody has been nominated and no vote has been '
    + 'cast.',
  'act.resetLinkBeenRequestedMember': 
    'A reset link has been requested for that member. They will receive it if '
    + 'their address is reachable.',
  'act.stepNeedsLabel': 'A step needs a label',
  'act.suggestedBudgetMustWholeNumber': 'A suggested budget must be a whole number of cents, and not negative',
  'act.templateCannotIncludeItself': 'A template cannot include itself',
  'act.templateNeedsName': 'A template needs a name',
  'act.templateNameAlreadyExists': 'A template with that name already exists.',
  'act.addMobileNumberFirst': 'Add a mobile number first',
  'act.addLeastOnePositionBefore': 
    'Add at least one position before publishing — a ballot with no offices '
    + 'on it has nothing to vote for.',
  'act.addTheirDateBirthWhat': 'Add their date of birth. It is what decides when they start owing dues.',
  'act.administratorsGeneralBuiltCannotDeleted': 
    'Administrators and General are built in and cannot be deleted. Edit what '
    + 'they grant instead.',
  'act.albumNotFound': 'Album not found',
  'act.announcementNotFound': 'Announcement not found',
  'act.archivedMustYesNo': 'Archived must be yes or no',
  'act.automaticPaymentsAlreadySetUp': 'Automatic payments are already set up for this due.',
  'act.automaticPaymentsBeenStoppedEvery': 'Automatic payments have been stopped. Every payment already made is kept.',
  'act.chapterNotFound': 'Chapter not found',
  'act.chapterSavedButTheirChildren': 
    'Chapter saved, but their children under 18 with no account of their own '
    + 'could not be moved with them. Try again, or set each chapter '
    + 'individually.',
  'act.checkClosed': 'Check-in closed',
  'act.checkDeleted': 'Check-in deleted',
  'act.checkNotFound': 'Check-in not found',
  'act.chooseApproveSendBack': 'Choose Approve or Send back',
  'act.chooseJpegPngWebpImage': 'Choose a JPEG, PNG or WebP image',
  'act.chooseJpegPngWebpGif': 'Choose a JPEG, PNG, WebP or GIF image',
  'act.chooseChapter': 'Choose a chapter',
  'act.chooseDateMeeting': 'Choose a date for the meeting',
  'act.chooseFile': 'Choose a file',
  'act.choosePhotoUpload': 'Choose a photo to upload',
  'act.chooseRegion': 'Choose a region',
  'act.chooseTimezone': 'Choose a timezone',
  'act.chooseLeastOneDuePay': 'Choose at least one due to pay.',
  'act.chooseLeastOneRelativeAsk': 'Choose at least one relative to ask',
  'act.chooseSomebodyFromYourFamily': 'Choose somebody from your family',
  'act.chooseDateGatheringStarts': 'Choose the date the gathering starts',
  'act.chooseFundBudgetDrawn': 'Choose the fund this budget is drawn on',
  'act.chooseTwoDifferentFunds': 'Choose two different funds',
  'act.chooseWhatKindAccessGive': 'Choose what kind of access to give them',
  'act.chooseWhatKindAccessGrant': 'Choose what kind of access to grant',
  'act.chooseWhatStepAsks': 'Choose what the step asks for',
  'act.chooseWhetherPayMonthlyAdvance': 'Choose whether to pay monthly or in advance.',
  'act.chooseWhetherYouSafe': 'Choose whether you are safe',
  'act.chooseWhichChapterGoing': 'Choose which chapter this is going to',
  'act.chooseWhichFirstPaymentMake': 'Choose which first payment to make.',
  'act.chooseWhichRegionGoing': 'Choose which region this is going to',
  'act.chooseWhoTakingMinutes': 'Choose who is taking the minutes',
  'act.chooseWhoMayScheduleFrom': 'Choose who may schedule from this template',
  'act.chooseWhoGoing': 'Choose who this is going to',
  'act.chooseWhoAsk': 'Choose who to ask',
  'act.contributorNotFoundFamily': 'Contributor not found in this family',
  'act.couldNotAcceptInvitationPlease': 'Could not accept that invitation. Please try again.',
  'act.couldNotAddStepTry': 'Could not add that step. Try again.',
  'act.couldNotApplyTemplatePlease': 'Could not apply that template. Please try again.',
  'act.couldNotBuildRosterSo': 'Could not build the roster, so nothing has been sent',
  'act.couldNotCancelInvitation': 'Could not cancel that invitation.',
  'act.couldNotChangeMemberPlease': 'Could not change that member. Please try again.',
  'act.couldNotChangeLanguagePlease': 'Could not change the language. Please try again.',
  'act.couldNotChangePlanPlease': 'Could not change the plan. Please try again.',
  'act.couldNotChangeTimezonePlease': 'Could not change the timezone. Please try again.',
  'act.couldNotChangeTheirAccess': 'Could not change their access just now. Try again.',
  'act.couldNotCheckRecurringPayments': 'Could not check for recurring payments. Please try again.',
  'act.couldNotCheckCodePlease': 'Could not check that code. Please try again.',
  'act.couldNotCheckPersonS': 'Could not check that person’s membership',
  'act.couldNotCheckOwnerList': 'Could not check the owner list just now. Try again.',
  'act.couldNotCheckWhatWork': 'Could not check what work has been answered on this gathering',
  'act.couldNotCheckWhetherAny': 
    'Could not check whether any gathering was built from this template, so '
    + 'nothing was deleted. Try again.',
  'act.couldNotCheckWhoAdult': 'Could not check who is an adult just now. Nothing was saved.',
  'act.couldNotCheckYourText': 'Could not check your text-message consent. Please try again.',
  'act.couldNotClaimNextBatch': 'Could not claim the next batch',
  'act.couldNotCloseCheck': 'Could not close the check-in',
  'act.couldNotConfirmCodePlease': 'Could not confirm that code. Please try again.',
  'act.couldNotConfirmNumber': 'Could not confirm that number',
  'act.couldNotCreateFamilyPlease': 'Could not create that family. Please try again.',
  'act.couldNotCreateInvitationPlease': 'Could not create that invitation. Please try again.',
  'act.couldNotCreateTemplate': 'Could not create the template.',
  'act.couldNotDeleteCheck': 'Could not delete the check-in',
  'act.couldNotDeleteTemplate': 'Could not delete the template.',
  'act.couldNotDisconnectPleaseTry': 'Could not disconnect. Please try again.',
  'act.couldNotDismissAnnouncement': 'Could not dismiss that announcement.',
  'act.couldNotFindYourCurrent': 'Could not find your current profile record.',
  'act.couldNotGenerateUniqueFamily': 'Could not generate a unique family code. Please try again.',
  'act.couldNotGrantAccessJust': 'Could not grant access just now. Try again.',
  'act.couldNotJoinFamilyPlease': 'Could not join that family. Please try again.',
  'act.couldNotLookUpCode': 'Could not look up that code. Please try again.',
  'act.couldNotMoveStepTry': 'Could not move that step. Try again.',
  'act.couldNotOpenStripeOnboarding': 'Could not open Stripe onboarding. Please try again.',
  'act.couldNotOpenBillingPortal': 'Could not open the billing portal. Please try again.',
  'act.couldNotPinAnnouncement': 'Could not pin that announcement.',
  'act.couldNotQueueThoseAsks': 'Could not queue those asks again',
  'act.couldNotRaiseCheck': 'Could not raise the check-in',
  'act.couldNotReachStripePlease': 'Could not reach Stripe. Please try again.',
  'act.couldNotReachAccountService': 'Could not reach the account service just now. Try again.',
  'act.couldNotReadConnection': 'Could not read that connection',
  'act.couldNotReadGathering': 'Could not read that gathering',
  'act.couldNotReadRecord': 'Could not read that record',
  'act.couldNotReadStaffMember': 'Could not read that staff member just now. Try again.',
  'act.couldNotReadStepTry': 'Could not read that step. Try again.',
  'act.couldNotReadTask': 'Could not read that task',
  'act.couldNotReadTemplateTry': 'Could not read that template. Try again.',
  'act.couldNotReadAlbumNothing': 'Could not read the album. Nothing was deleted.',
  'act.couldNotReadCurrentPlan': 'Could not read the current plan from Stripe. Please try again.',
  'act.couldNotReadFamilyRoster': 
    'Could not read the family roster just now, so nothing has been sent. Try '
    + 'again.',
  'act.couldNotReadRelationshipTypes': 'Could not read the relationship types',
  'act.couldNotReadSubmission': 'Could not read the submission',
  'act.couldNotReadTasksFrom': 'Could not read the tasks from this template',
  'act.couldNotReadTemplateCopy': 'Could not read the template to copy.',
  'act.couldNotReadTemplates': 'Could not read the templates',
  'act.couldNotReadGatheringS': 'Could not read this gathering’s templates',
  'act.couldNotRecordDecisionPlease': 'Could not record that decision. Please try again.',
  'act.couldNotRecordChangePlease': 'Could not record the change. Please try again.',
  'act.couldNotRecordDecision': 'Could not record the decision',
  'act.couldNotRecordYourAnswer': 'Could not record your answer',
  'act.couldNotRecordYourAnswer2': 'Could not record your answer — try again',
  'act.couldNotRecordYourChoice': 'Could not record your choice. Please try again.',
  'act.couldNotRemoveNumber': 'Could not remove that number',
  'act.couldNotRemoveFamilyPlease': 'Could not remove the family. Please try again.',
  'act.couldNotRemoveTheirAccess': 'Could not remove their access just now. Try again.',
  'act.couldNotRenameFamilyPlease': 'Could not rename the family. Please try again.',
  'act.couldNotRenameTemplate': 'Could not rename the template.',
  'act.couldNotResendInvitation': 'Could not resend that invitation.',
  'act.couldNotResolveAddressUnambiguously': 
    'Could not resolve that address unambiguously — type it exactly and try '
    + 'again.',
  'act.couldNotRestoreFamilyPlease': 'Could not restore that family. Please try again.',
  'act.couldNotSave': 'Could not save that',
  'act.couldNotSaveNumber': 'Could not save that number',
  'act.couldNotSaveSegmentJust': 'Could not save that segment just now. Try again.',
  'act.couldNotSavePleaseTry': 'Could not save that. Please try again.',
  'act.couldNotSavePermission': 'Could not save the permission.',
  'act.couldNotSaveWhatStripe': 'Could not save what Stripe told us. Please try again.',
  'act.couldNotSendCodeJust': 'Could not send a code just now',
  'act.couldNotSendCodeJust2': 'Could not send a code just now. Please try again.',
  'act.couldNotSendJustNow': 'Could not send that just now. Please try again.',
  'act.couldNotSetUpAutomatic': 'Could not set up automatic payments. Please try again.',
  'act.couldNotStartSettingUp': 'Could not start setting up payments. Please try again.',
  'act.couldNotStartPaymentPlease': 'Could not start the payment. Please try again.',
  'act.couldNotStartSetupPlease': 'Could not start the setup. Please try again.',
  'act.couldNotStopAutomaticPayments': 'Could not stop the automatic payments. Please try again.',
  'act.couldNotStopPlanPlease': 'Could not stop the plan. Please try again.',
  'act.couldNotUpdatePleaseTry': 'Could not update that. Please try again.',
  'act.couldNotUpdateYourFamily': 'Could not update your family selection. Please try again.',
  'act.destinationFundNotFound': 'Destination fund not found',
  'act.documentNotFound': 'Document not found',
  'act.donationsAlreadyOptionalThereNothing': 'Donations are already optional — there is nothing to opt out of.',
  'act.donationsGivenFromDonationsPane': 'Donations are given from the Donations pane, not paid as dues.',
  'act.duesNeedAmount': 'Dues need an amount',
  'act.duesScheduleNotFound': 'Dues schedule not found',
  'act.electionNotFound': 'Election not found',
  'act.enterBudgetAmount': 'Enter a budget amount',
  'act.enterFamilyCode': 'Enter a family code',
  'act.enterFamilyCode2': 'Enter a family code.',
  'act.enterFamilyName': 'Enter a family name',
  'act.enterFirstLastName': 'Enter a first and last name',
  'act.enterAmount': 'Enter an amount',
  'act.enterAmountGreaterThanZero': 'Enter an amount greater than zero',
  'act.enterAmountGive': 'Enter an amount to give.',
  'act.enterAmountPay': 'Enter an amount to pay.',
  'act.enterEmailAddress': 'Enter an email address',
  'act.enterEmailAddressAccountGrant': 'Enter the email address of the account to grant',
  'act.enterFirstLastNamePerson': 'Enter the first and last name of the person you are inviting',
  'act.enterSixDigitsFromText': 'Enter the six digits from the text message.',
  'act.everyoneAudienceFamilyTreeWithout': 
    'Everyone in that audience is on the family tree without an email '
    + 'address, so there is nobody to send to.',
  'act.failedCreateFamilyRecordPlease': 'Failed to create family record. Please try again.',
  'act.failedLinkYourAccountPlease': 'Failed to link your account. Please try again.',
  'act.failedPrepareAccountLinkPlease': 'Failed to prepare account link. Please try again.',
  'act.familyCodeRequired': 'Family code is required',
  'act.familyCodeNotFoundCheck': 'Family code not found. Check with your family and try again.',
  'act.fileMustUnder2Mb': 'File must be under 2 MB',
  'act.fundNotFound': 'Fund not found',
  'act.gatheringNotFound': 'Gathering not found',
  'act.gatheringTemplateNotFound': 'Gathering or template not found',
  'act.giveStartTimeWellLeave': 'Give a start time as well, or leave the end time empty',
  'act.giveAlbumName': 'Give the album a name',
  'act.giveArticleTitle': 'Give the article a title',
  'act.giveDocumentName': 'Give the document a name',
  'act.giveElectionTitle': 'Give the election a title.',
  'act.giveEntryTitle': 'Give the entry a title.',
  'act.giveMeetingTitle': 'Give the meeting a title',
  'act.giveMessageSubject': 'Give the message a subject',
  'act.giveTopicTitle': 'Give the topic a title',
  'act.giveThemFirstLastName': 'Give them a first and last name before inviting them',
  'act.invitationNotFound': 'Invitation not found',
  'act.meetingNotFound': 'Meeting not found',
  'act.memberNotFound': 'Member not found',
  'act.milestoneNotFound': 'Milestone not found',
  'act.mobileNumberRemoved': 'Mobile number removed.',
  'act.moveStepUpDown': 'Move a step up or down',
  'act.multiFamilySupportNotEnabled': 
    'Multi-family support is not enabled on the database yet. Apply migration '
    + '20260617000000_multi_family_membership.sql.',
  'act.noFamilyAssociatedAccount': 'No family associated with account',
  'act.noFamilyAssociatedYourAccount': 'No family associated with your account.',
  'act.noFamilyCodeAssociatedAccount': 'No family code associated with account',
  'act.noFamilySelected': 'No family selected',
  'act.noFamilySelected2': 'No family selected.',
  'act.noFileProvided': 'No file provided',
  'act.noFilesChosen': 'No files were chosen',
  'act.noVoteBeenCalledTopic': 'No vote has been called on that topic.',
  'act.noVoteBeenCalledTopic2': 'No vote has been called on this topic yet.',
  'act.nobodyFamilyMatchesAudienceSo': 
    'Nobody in the family matches that audience, so nothing has been sent. '
    + 'Check the region or chapter you chose.',
  'act.nobodyFamilyMatchesAudienceSo2': 'Nobody in the family matches that audience, so there is nothing to send.',
  'act.notMemberFamily': 'Not a member of this family',
  'act.notAuthenticated': 'Not authenticated',
  'act.notAuthenticated2': 'Not authenticated.',
  'act.notAuthorized': 'Not authorized',
  'act.notFound': 'Not found',
  'act.noteNotFound': 'Note not found',
  'act.nothingChange': 'Nothing to change',
  'act.numberConfirmed': 'Number confirmed.',
  'act.oneThoseAttendeesNotFamily': 'One of those attendees is not in this family',
  'act.oneThosePeopleNotFamily': 'One of those people is not in this family',
  'act.oneThosePeopleNotFamily2': 'One of those people is not in this family.',
  'act.onlinePaymentsNotSetUp': 'Online payments are not set up on this deployment yet.',
  'act.onlinePaymentsNotSetUp2': 'Online payments are not set up yet.',
  'act.onlinePaymentsOffDeployment': 'Online payments are switched off on this deployment.',
  'act.connectNotSetUpDeployment': 'Online payments are not set up on this deployment yet.',
  'act.onlyTemplateStepCanInclude': 'Only a template step can include another template',
  'act.onlyPeopleAttendeeListCan': 'Only people on the attendee list can vote in this meeting.',
  'act.onlySecretaryMeetingCanWrite': 'Only the secretary of this meeting can write its minutes.',
  'act.paymentNotFound': 'Payment not found',
  'act.paymentsBeenRecordedAgainstDue': 
    'Payments have been recorded against this due, so its start date, amount, '
    + 'frequency, starting age, bloodline setting and who owes it can no longer '
    + 'change. You can still change the end date.',
  'act.personNotYourFamily': 'Person is not in your family.',
  'act.personNotFound': 'Person not found',
  'act.personNotFound2': 'Person not found.',
  'act.photoNotFound': 'Photo not found',
  'act.pickHowOftenYouWant': 
    'Pick how often you want to pay this due first — automatic payments '
    + 'follow the cadence you choose.',
  'act.pickTemplateStepIncludes': 'Pick the template this step includes',
  'act.profileNotFound': 'Profile not found',
  'act.profileNotFound2': 'Profile not found.',
  'act.profilePicturesPartStandardPlan': 'Profile pictures are part of the Standard plan. This family is on Free.',
  'act.recipientNotFoundFamily': 'Recipient not found in this family',
  'act.recordCheckNumberReferenceContribution': 'Record a check number or reference for the contribution',
  'act.recordCheckNumberReferenceDisbursement': 'Record a check number or reference for the disbursement',
  'act.recordCheckNumberReferencePayment': 'Record a check number or reference for the payment',
  'act.recordGenderOtherPersonFirst': 
    'Record a gender for the other person first, so we can name this from '
    + 'their side too.',
  'act.recordHowContributionGiven': 'Record how the contribution was given',
  'act.recordHowPaymentMade': 'Record how the payment was made',
  'act.recordWhoContributionCameFrom': 'Record who the contribution came from',
  'act.recordWhyMoneyBeingMoved': 'Record why the money is being moved',
  'act.recurringPaymentsDuesOnly': 'Recurring payments are for dues only.',
  'act.regionNotFound': 'Region not found',
  'act.relationshipNotFound': 'Relationship not found',
  'act.requiredMustYesNo': 'Required must be yes or no',
  'act.savedYourFamilyMaySend': 'Saved. Your family may send you check-ins by text.',
  'act.sayWhatHappeningSoRelatives': 'Say what is happening, so relatives know what they are being asked about',
  'act.sayWhatNeedsChangeSending': 
    'Say what needs to change — sending a task back without notes leaves '
    + 'nothing to act on',
  'act.sayWhichTimezoneTimeSo': 'Say which timezone the time is in, so relatives elsewhere can read it',
  'act.sayWhyPersonNoEmail': 'Say why this person has no email address',
  'act.sayWhyPersonNeedsStaff': 'Say why this person needs staff access. The list is an audit record.',
  'act.scheduleNotFound': 'Schedule not found',
  'act.segmentNotFound': 'Segment not found',
  'act.signAcceptInvitation': 'Sign in to accept this invitation.',
  'act.someMembersStillBeingCharged': 
    'Some members are still being charged automatically and we could not stop '
    + 'it. Nothing has been disconnected — please try again.',
  'act.somebodyCannotTheirOwnRelative': 'Somebody cannot be their own relative',
  'act.somebodyYouRemovingAlreadyVoted': 
    'Somebody you are removing has already voted. A vote cannot be withdrawn, '
    + 'so they have to stay on the list.',
  'act.staffMemberNotFound': 'Staff member not found',
  'act.stepNotFound': 'Step not found',
  'act.stripeUpdatedButWeCould': 
    'Stripe was updated but we could not record it. Please contact support '
    + 'before trying again.',
  'act.stripeUpdatedButWeCould2': 
    'Stripe was updated but we could not record the change. Please contact '
    + 'support before trying again.',
  'act.taskNotFound': 'Task not found',
  'act.templateNameRequired': 'Template name is required.',
  'act.templateNotFound': 'Template not found',
  'act.templateNotFoundYourFamily': 'Template not found in your family.',
  'act.templateNotFound2': 'Template not found.',
  'act.bylawNoFileAttached': 'That bylaw has no file attached.',
  'act.channelNotAvailableNotificationYet': 'That channel is not available for this notification yet.',
  'act.checkAlreadyClosed': 'That check-in was already closed',
  'act.codeNotRight': 'That code is not right.',
  'act.couldNotPreparedNothingBeen': 'That could not be prepared. Nothing has been sent.',
  'act.couldNotReadJustNow': 'That could not be read just now.',
  'act.couldNotRemovedJustNow': 'That could not be removed just now.',
  'act.couldNotWithdrawnNominationsMay': 
    'That could not be withdrawn. Nominations may have closed, or the person '
    + 'may have accepted since this page loaded — an accepted nomination stays '
    + 'on the ballot, and the way off it is for them to decline.',
  'act.doesNotLookLikeMobile': 
    'That does not look like a mobile number. Include the area code — for '
    + 'example 512-555-0134.',
  'act.driveNotOneYourFamily': 'That drive is not one of your family’s.',
  'act.dueDateNotRealDate': 'That due date is not a real date',
  'act.dueNotOneYours': 'That due is not one of yours.',
  'act.endDateNotRealDate': 'That end date is not a real date',
  'act.entryCouldNotChangedOnly': 
    'That entry could not be changed. Only the person who recorded it can, '
    + 'and only while they still hold the office.',
  'act.entryCouldNotRemovedOnly': 
    'That entry could not be removed. Only the person who recorded it can, '
    + 'and only while they still hold the office.',
  'act.entryRefusedJournalOnlyWritable': 
    'That entry was refused. A journal is only writable by whoever holds the '
    + 'office — reload the page to see which ones are yours.',
  'act.familyNameTooLong100': 'That family name is too long (100 characters maximum).',
  'act.fileCouldNotOpenedMay': 'That file could not be opened. It may have been removed.',
  'act.invitationAlreadyBeenAccepted': 'That invitation has already been accepted.',
  'act.invitationNoLongerValidAsk': 'That invitation is no longer valid. Ask for a new one.',
  'act.invitationCancelledSendNewOne': 'That invitation was cancelled. Send a new one instead.',
  'act.notChannelWeSend': 'That is not a channel we send on.',
  'act.notDate': 'That is not a date',
  'act.notDateSegmentCanHappen': 'That is not a date this segment can happen on',
  'act.notGatheringStatus': 'That is not a gathering status',
  'act.notLanguageWeSpeakYet': 'That is not a language we speak yet',
  'act.notNotificationWeSend': 'That is not a notification we send.',
  'act.notPlanCanBought': 'That is not a plan that can be bought.',
  'act.notPlan': 'That is not a plan.',
  'act.notRelationshipTreeRecords': 'That is not a relationship this tree records',
  'act.notTimeWeCanRead': 'That is not a time we can read',
  'act.notTimezoneWeRecognise': 'That is not a timezone we recognise',
  'act.notVote': 'That is not a vote.',
  'act.nominationNotBallot': 'That nomination is not on this ballot.',
  'act.nominationRefusedNominationsMayClosed': 
    'That nomination was refused — nominations may have closed, or this '
    + 'election may not be for your part of the family. Reload the page to see '
    + 'where it stands.',
  'act.nominationWithdrawnWhileYouLooking': 'That nomination was withdrawn while you were looking at it. Try again.',
  'act.noteCouldNotChangedOnly': 
    'That note could not be changed. Only the person who wrote it can, and '
    + 'only while they still hold the office.',
  'act.noteCouldNotRemovedOnly': 
    'That note could not be removed. Only the person who wrote it can, and '
    + 'only while they still hold the office.',
  'act.noteRefusedJournalOnlyWritable': 
    'That note was refused. A journal is only writable by whoever holds the '
    + 'office — reload the page to see which ones are yours.',
  'act.numberChangedWhileCodeFlight': 
    'That number changed while the code was in flight. Send a new code and '
    + 'try again.',
  'act.numberAlreadyConfirmed': 'That number is already confirmed',
  'act.paymentAlreadyBeenReversed': 'That payment has already been reversed.',
  'act.personAlreadyAccountLinked': 'That person already has an account linked.',
  'act.personNotFinishedJoiningFamily': 'That person has not finished joining the family yet.',
  'act.personNotCandidatePosition': 'That person is not a candidate for that position.',
  'act.personNotPartFamilyElection': 'That person is not in the part of the family this election is for.',
  'act.personNotFamily': 'That person is not in this family',
  'act.personNotFamily2': 'That person is not in this family.',
  'act.personNotPartConnection': 'That person is not part of this connection',
  'act.personSMembershipNotBeen': 'That person’s membership has not been approved yet',
  'act.photoMustUnder10Mb': 'That photo must be under 10 MB',
  'act.positionNotBallot': 'That position is not on this ballot.',
  'act.relationshipTypeNotSetUp': 'That relationship type is not set up',
  'act.rowItselfReversal': 'That row is itself a reversal.',
  'act.secretaryNotFamily': 'That secretary is not in this family',
  'act.sendCouldNotContinuedJust': 'That send could not be continued just now.',
  'act.templateNotPartGathering': 'That template is not part of this gathering',
  'act.templateNotFound3': 'That template was not found',
  'act.voteAlreadyClosedDeleteTopic': 
    'That vote has already closed. Delete the topic and ask again if it needs '
    + 'a second round.',
  'act.voteClosed': 'That vote has closed.',
  'act.wouldChangeHowTheyRelated': 'That would change how they are related, not just what it is called',
  'act.endDateCannotPast': 'The end date cannot be in the past.',
  'act.endTimeAfterStartTime': 'The end time has to be after the start time',
  'act.fileMustUnder25Mb': 'The file must be under 25 MB.',
  'act.gatheringCannotEndBeforeStarts': 'The gathering cannot end before it starts',
  'act.messageTooLongKeepUnder': 'The message is too long — keep it under 20,000 characters.',
  'act.paymentsBeenStoppedStripeBut': 
    'The payments have been stopped at Stripe but we could not update your '
    + 'record. Please refresh.',
  'act.restoreReturnedNoResultPlease': 'The restore returned no result. Please try again.',
  'act.sameDueListedTwice': 'The same due is listed twice.',
  'act.sendProgressedButCouldNot': 'The send progressed but could not be read.',
  'act.subjectTooLongKeepUnder': 'The subject is too long — keep it under 200 characters.',
  'act.templateCopyNotFoundYour': 'The template to copy was not found in your family.',
  'act.thereNoAutomaticPaymentsSet': 'There are no automatic payments set up for this due.',
  'act.thereNothingSetUpDue': 'There is nothing to set up on this due.',
  'act.thereNoPlanWaitingSet': 'There was no plan waiting to be set up.',
  'act.theyAlreadyAccount': 'They already have an account.',
  'act.theyAccountManageTheirOwn': 'They have an account and manage their own profile.',
  'act.accountNoEmailAddressSend': 'This account has no email address to send a code to.',
  'act.checkBeenClosedSoNo': 'This check-in has been closed, so no more asks will go out',
  'act.checkBeenClosedIfYou': 
    'This check-in has been closed. If you still need help, contact your '
    + 'family directly.',
  'act.donationReceivedFundsSoIts': 'This donation has received funds, so its start date can no longer change.',
  'act.electionNotYourPartFamily': 'This election is not for your part of the family.',
  'act.familyAlreadyPaysMonthlyUse': 
    'This family already pays monthly. Use Change plan instead of starting a '
    + 'second subscription.',
  'act.familyNoMonthlyPlanStop': 'This family has no monthly plan to stop.',
  'act.familyNoPaymentHistoryYet': 'This family has no payment history yet.',
  'act.familyNoSettingsRecordChange': 'This family has no settings record to change.',
  'act.familyNotConnectedAccountYet': 'This family has not connected an account yet.',
  'act.feePercentOutOfRange': 'The percentage rate must be between 0% and 50%.',
  'act.feeFixedOutOfRange': 'The flat fee must be between $0.00 and $10.00.',
  'act.couldNotSaveFeePolicy': 'That could not be saved. Please try again.',
  'act.feePolicySaved': 'Saved.',
  'act.familyNotConnectedAccount': 'This family has not connected an account.',
  'act.familyAlreadyRemovedNoSettings': 'This family is already removed, or has no settings record to remove.',
  'act.familyNotSetUpTake': 'This family is not set up to take card payments yet.',
  'act.familyPaidPlanChangeFrom': 
    'This family is on a paid plan. Change it from the Billing section of '
    + 'Settings, so the payment follows the plan.',
  'act.familyPaysMonthlyCancelMonthly': 
    'This family pays monthly. Cancel the monthly plan first, then pay in '
    + 'advance from the next period.',
  'act.featureNotCurrentlyAvailable': 'This feature is not currently available.',
  'act.gatheringBeenCancelledSoIts': 
    'This gathering has been cancelled, so its tasks are no longer being '
    + 'collected. Ask an organizer if that is not right.',
  'act.invitationCreatedBeforeWeStarted': 
    'This invitation was created before we started recording names. Cancel it '
    + 'and send a new one instead.',
  'act.lastOwnerMakeSomebodyElse': 
    'This is the last owner. Make somebody else an owner first, or nobody '
    + 'will be able to grant staff access.',
  'act.meetingClosed': 'This meeting is closed.',
  'act.meetingClosedReopenChangeMinutes': 'This meeting is closed. Reopen it to change the minutes.',
  'act.sendNotFinishedStopFirst': 'This send has not finished. Stop it first, then remove it.',
  'act.taskCannotAnsweredVersion': 'This task cannot be answered in this version',
  'act.taskAlreadyBeenApprovedApproved': 
    'This task has already been approved, and an approved answer is final. '
    + 'Ask an organizer to reopen it if it needs to change.',
  'act.taskAssignedSomebodyElse': 'This task is assigned to somebody else',
  'act.titleMessageRequired': 'Title and message are required',
  'act.tooFewDaysLeftMonth': 
    'Too few days are left this month to start a monthly plan today. Choose '
    + 'the option that covers this month and next.',
  'act.tooManyAttemptsWaitMinute': 'Too many attempts. Wait a minute and try again.',
  'act.tooManyFamiliesCreatedJust': 'Too many families created just now. Wait a minute and try again.',
  'act.topicNotFound': 'Topic not found',
  'act.turnedOffYourFamilyWill': 'Turned off. Your family will not text you.',
  'act.weCouldNotReadFamily': 'We could not read the family roster just now. Nothing has been sent.',
  'act.weWillStopAskingYou': 'We will stop asking. You can move to a paid plan whenever you like.',
  'act.writeSomethingFirst': 'Write something first',
  'act.writeSomethingFirst2': 'Write something first.',
  'act.writeSomethingSend': 'Write something to send',
  'act.youAlreadyAccountAddressSign': 
    'You already have an account with this address. Sign in and this '
    + 'invitation will be waiting for you.',
  'act.youNotMemberFamily': 'You are not a member of that family.',
  'act.youNotCheck': 'You are not on this check-in',
  'act.youCannotChangeYourOwn': 'You cannot change your own staff access. Ask another owner to do it.',
  'act.youDoNotBelongFamily': 'You do not belong to a family yet.',
  'act.youDoNotPermissionCopy': 
    'You do not have permission to copy what a template grants. Create a '
    + 'blank template instead.',
  'act.youDoNotPermissionManage': 'You do not have permission to manage access.',
  // ADDED BY HAND. These two live inside a ternary in `requireAccessAdmin`, and the
  // extractor that swept the other 395 declines an expression that is not a plain literal
  // or a `+` chain — a conditional message is a judgement about which branch says what,
  // and guessing at one is how a sweep breaks a sentence.
  'act.notPermissionDeleteTemplates': 'You do not have permission to delete templates.',
  'act.notPermissionChangePermissionTemplates':
    'You do not have permission to change permission templates.',
  'act.youDoNotPermissionReverse': 'You do not have permission to reverse payments.',
  'act.youAlreadyNominatedThemPosition': 'You have already nominated them for that position.',
  'act.youDeclinedDueOptBack': 
    'You have declined this due. Opt back in before setting up automatic '
    + 'payments.',
  'act.youNoMemberRecordFamily': 'You have no member record in this family.',
  'act.youRepliedStopTextFrom': 
    'You replied STOP to a text from us, so we cannot switch texts back on '
    + 'from here. Text START to the number that messaged you.',
  'act.yourAnswerSavedButTask': 
    'Your answer was saved but the task could not be moved to review. Try '
    + 'again.',
  'act.yourChapterSavedButYour': 
    'Your chapter was saved, but your children under 18 with no account of '
    + 'their own could not be moved with you. Ask an administrator to set their '
    + 'chapter on Members & Access.',
  'act.yourCurrentRecordAlreadyFamily': 
    'Your current record already has family connections. Please contact an '
    + 'admin to merge.',
  'act.yourEmailAddressAlreadyConfirmed': 'Your email address is already confirmed.',
  'act.yourMembershipAwaitingApproval': 'Your membership is awaiting approval.',

  // ── THE DASHBOARD'S OWN COPY ────────────────────────────────────────────────────
  // 305 strings across 96 files, keyed on 2026-08-27: panel ledes, dialog hints, empty
  // states, column headings, placeholders and the four `aria-label`s a screen reader needs.
  // Every one was found by `npm run i18n:literals`, which counts what a reader would see in
  // English and is the only thing in the tree that can — `i18n:check` proves every KEY is
  // consistent and is structurally blind to a string nobody keyed.
  //
  // ── THE PREFIX IS THE SURFACE, NOT THE FILE ─────────────────────────────────────
  // `tx.` is Transactions wherever it is rendered from, `dues.` is the projections screen,
  // `stf.` is the Staff console. A page and the component it renders share a prefix, because
  // the reader does not know which of them a sentence came from and a key that follows the
  // file tree would move whenever a component did.
  //
  // A HANDFUL ARE DELIBERATELY IDENTICAL ACROSS PREFIXES — `Back to Elections` is both
  // `adm.backElections` and `comm.backElections`, `Family Tree` is three keys. They are not
  // deduplicated: the administrator's Elections and the member's are different screens, and a
  // language that wanted a different register for one of them can have it.
  'auth.alreadyAccount': 'You already have an account',
  'auth.signAccept': 'Sign in to accept',
  'auth.linkNoLongerValid': 'That link is no longer valid',
  'auth.resetLinksWorkOnce': 
    'Reset links work once and expire after an hour. Request a new one and it '
    + 'will arrive in a moment.',
  'auth.sendMeNewLink': 'Send me a new link',
  'acct.noneSectionsSummaryBeen': 
    'None of the sections of Summary have been shared with you. Ask an '
    + 'administrator for access to the ones you need — your dues, the donation '
    + 'drives, your payment history and the family\'s funds are each granted '
    + 'separately.',
  'acct.seeAllDues': 'See all your dues',
  'acct.seeFullPaymentHistory': 'See your full payment history',
  'acct.openDonationDrives': 'Open donation drives',
  'acct.allDrives': 'All drives',
  'acct.seeDonations': 'see Donations',
  'adm.backElections': 'Back to Elections',
  'adm.weCouldNotLoad': 'We could not load this family’s details. Try again in a moment.',
  'comm.unableLoadChat': 'Unable to load chat',
  'comm.makeSureChatMigration': 'Make sure the chat migration has been applied in your Supabase project.',
  'comm.familyTree': 'Family Tree',
  'comm.noElectionsPartFamily': 'No elections for your part of the family yet.',
  'comm.backElections': 'Back to Elections',
  'comm.noVotesCast': 'No votes cast.',
  'comm.allAlbums': 'All albums',
  'shell.somethingWentWrong': 'Something went wrong',
  'shell.weCouldnTLoad': 'We couldn\'t load this page. This is usually temporary — please try again.',
  'shell.tryAgain': 'Try again',
  'shell.backDashboard': 'Back to dashboard',
  'gath.backGatherings': 'Back to Gatherings',
  'hlp.creatingJoiningFamily': 'Creating or joining a family',
  'hlp.allHelp': 'All help',
  'hlp.page': 'On this page',
  'hlp.moreManual': 'More of the manual',
  'lib.allMeetings': 'All meetings',
  'lib.officerSJournalMembers': 
    'An officer’s journal is for members who hold an office, and you do not '
    + 'hold one yet.',
  'lib.everyOfficeFamilyNotebook': 
    'Every office in the family has a notebook of its own — what a treasurer '
    + 'worked out about the bank, what an events chair learned about the hall. '
    + 'It belongs to the office rather than to the person, so it is still there '
    + 'for whoever comes next.',
  'lib.membersAccessBoardPositions': 'Members & Access › Board Positions',
  'shell.loading': 'Loading…',
  'shell.pageNotFound': 'Page not found',
  'shell.pageReLookingDoesn': 'The page you\'re looking for doesn\'t exist or may have moved.',
  'prof.requestJoin': 'Your request to join',
  'prof.membership': 'Your membership of',
  'rep.everyOffice': 'Every office',
  'rep.everyBoardPositionFamily': 'Every board position in the family’s own order, with who holds it.',
  'rep.held': 'Held by',
  'rep.holdingMoreThanOne': 'Holding more than one office',
  'rep.notProblemItselfSmall': 
    'Not a problem in itself — a small chapter often has one person doing two '
    + 'jobs. It is here because it is usually the sign of a gap somebody has '
    + 'quietly covered.',
  'rep.wearingTwoHats': 'Wearing two hats',
  'rep.everyPublishedElectionIts': 'Every published election with its phase, nominations and turnout.',
  'rep.turnoutCountsPeopleNot': 
    'Turnout counts PEOPLE, not ballots: somebody voting for three offices in '
    + 'one election is one voter. An election whose area holds no approved '
    + 'members reads',
  'rep.officesNobodyStood': 'Offices nobody stood for',
  'rep.membersWhoVoted': 'Members who have voted',
  'rep.everyGatheringItsTask': 'Every gathering with its task progress and, where shown, its budget.',
  'rep.taskCountsOverdueWhen': 
    'A task counts as overdue when its date has passed and nobody has '
    + 'approved it — one that has been submitted and not yet ruled on is still '
    + 'outstanding.',
  'rep.tasksApproved': 'Tasks approved',
  'rep.nobodyHolding': 'Nobody holding it',
  'rep.everyMeeting': 'Every meeting',
  'rep.everyMeetingMostRecent': 'Every meeting, most recent first, with its room size, topics and votes.',
  'rep.minutes': 'Minutes by',
  'rep.room': 'In the room',
  'rep.whoTakesPart': 'Who takes part',
  'rep.everyRelativeWhoBeen': 
    'Every relative who has been asked to a meeting, with how many they were '
    + 'asked to, how many they voted in, and how many they took the minutes of.',
  'rep.asked': 'Asked to',
  'rep.voted': 'Voted in',
  'rep.votesCast': 'Votes cast',
  'stf.staffConsole': 'Staff Console',
  'stf.readsAcrossEveryFamily': 'Reads across every family on the platform',
  'stf.pageNotFound': 'Page not found',
  'stf.thereNothingAddress': 'There is nothing at this address.',
  'stf.everybodyWhoCanOpen': 
    'Everybody who can open this console, and what kind of access they have. '
    + 'Only an owner can see this page or change anything on it — everyone else '
    + 'gets a 404, the same answer the console gives a customer. The very first '
    + 'owner on a new database still comes from',
  'shell.everyoneFamily': 'Everyone in the family',
  'inv.invitationNotValid': 'This invitation is not valid',
  'inv.mayExpiredBeenCancelled': 
    'It may have expired, been cancelled, or already been used. Ask whoever '
    + 'invited you to send a new one.',
  'inv.goSign': 'Go to sign in',
  'inv.signAccept': 'Sign in to accept',
  'inv.createAccount': 'Create an account',
  'inv.sign': 'Sign in',
  'inv.invitationDifferentAddress': 'This invitation is for a different address',
  'inv.goDashboard': 'Go to your dashboard',
  'inv.couldNotAcceptInvitation': 'Could not accept this invitation',
  'ui.familyNotConnectedCard': 
    'Your family has not connected a card processor yet, so drives cannot be '
    + 'given to online. Hand your gift to whoever keeps the books and it '
    + 'appears here once they record it.',
  'ui.onePaymentItemizedDue': 
    'One payment, itemized by due. It posts to the family’s books the moment '
    + 'it clears — there is nothing for anyone to key in afterwards.',
  'ui.familyNotConnectedCard2': 
    'Your family has not connected a card processor yet. Pay by whatever '
    + 'means your family already uses, and it appears here once an '
    + 'administrator records it.',
  'adm.howFamilyDividesItself': 
    'How the family divides itself up geographically. A chapter belongs to '
    + 'one region, or it sits under National — which is where everything starts '
    + 'and where a member with no chapter stays. Dues can be scoped to a region '
    + 'or a chapter under',
  'adm.nothingSetHereFeature': 
    'Nothing to set here — this feature is either always available or '
    + 'governed by the rows above it.',
  'adm.canOpenAccountingBut': 
    'You can open Accounting, but none of its sections have been shared with '
    + 'you. Ask an administrator for access to the areas you need — dues, '
    + 'donations, funds, routing, milestones or payment settings are each '
    + 'granted separately.',
  'adm.accountDuesDepositedInto': 
    'The account dues are deposited into, and that disbursements and event '
    + 'expenses are paid from, will be recorded here — so the numbers on a '
    + 'check or a transfer do not have to be looked up somewhere else.',
  'adm.notYetAvailableAccount': 
    'Not yet available. Account details need encrypted storage and a narrower '
    + 'permission than Accounting before they can be kept here.',
  'adm.notYetAcceptedCancelling': 
    'Not yet accepted. Cancelling one stops the link working — worth doing if '
    + 'it went to the wrong address, since only that address can use it.',
  'adm.theyAlreadyAccountBut': 
    'They already have an account but never confirmed their email address, so '
    + 'they could not have signed in to accept. We have asked for the '
    + 'confirmation email to be sent again as well — they need to click that '
    + 'one first.',
  'adm.theirAccountConfirmedSo': 
    'Their account is confirmed, so the link will take them straight to '
    + 'sign-in and join.',
  'adm.thereNoAccountAddress': 
    'There is no account for that address yet, so the link will take them to '
    + 'create one. They will not need the family code.',
  'adm.weCouldNotCheck': 
    'We could not check whether that address has an account, so if they still '
    + 'cannot get in, it is worth asking whether they ever confirmed their '
    + 'email.',
  'adm.keptRatherThanDeleted': 
    'Kept rather than deleted, so the record of the decision survives. You '
    + 'can admit somebody after all, and any member can send them a fresh '
    + 'invitation.',
  'adm.onlyPartFamilyCan': 
    'Only this part of the family can see the election, be nominated, or vote '
    + '— and it can only fill offices recorded at the same level.',
  'adm.bothDaysCountNominations': 
    'Both days count — nominations are open from the first through the last, '
    + 'unless voting opens on the closing day, in which case they shut as it '
    + 'opens. The closing date cannot be earlier than the day after they open.',
  'adm.votingMayOpenSame': 
    'Voting may open on the same day nominations close, and that day then '
    + 'belongs to voting. It may not open before.',
  'adm.whatFundToppedUp': 
    'What this fund is topped up to before any fund below it receives '
    + 'anything. You can change it, and the order funds fill in, under '
    + 'Funds → Routing.',
  'adm.milestoneAwardedOutFund': 
    'A milestone is awarded out of a fund, and there are none yet. Add a fund '
    + 'under Funds → Balances first.',
  'adm.setShareEachDues': 
    'Set the share of each dues payment that flows to each fund. Funds higher '
    + 'in the list fill first; a fund below its minimum is topped up before '
    + 'lower ones receive anything.',
  'adm.statusStatementRatherThan': 
    'Status is a statement rather than something the calendar works out: a '
    + 'gathering can be cancelled without moving its dates, and Complete is '
    + 'your word for it.',
  'adm.severalGatheringsMayFlagged': 
    'Several gatherings may be flagged at once — the Dashboard shows the '
    + 'soonest one that has not finished yet, so last year’s reunion never '
    + 'blocks this year’s. Nothing appears there when no flagged gathering is '
    + 'still upcoming.',
  'adm.onePhotographCroppedBand': 
    'One photograph, cropped to the band’s shape. Without one the band draws '
    + 'the GENORRA tree instead. Anyone with the link can view an uploaded '
    + 'photo, the same as a family photo — so it is published to whoever it is '
    + 'shared with.',
  'adm.budgetAlwaysDrawnFund': 
    'A budget is always drawn on a fund, and it may exceed what that fund '
    + 'holds — the figures say so rather than refusing it, because a family '
    + 'plans a reunion before it has raised the money for one.',
  'adm.gatheringMadePartsEach': 
    'A gathering is made of parts, and each is an occasion of its own: a '
    + 'reunion is the Welcome, the Picnic and the Send Off, on their own days '
    + 'in their own places. Every template you add is one of those, and its '
    + 'steps become tasks here. Nothing about the template reaches the tasks '
    + 'already on this gathering — each one keeps its own copy of what it '
    + 'asked.',
  'adm.bothOptionalLeaveDay': 
    'Both are optional. Leave the day empty for a gathering that happens all '
    + 'at once, and the place empty to use whatever the template usually uses.',
  'adm.whatOneTaskExpected': 
    'What this one task is expected to cost. Empty means it costs the family '
    + 'nothing. The lines together are what the band above compares to the '
    + 'budget.',
  'adm.photoCurrentlyDashboardBand': 'The photo currently on the Dashboard band',
  'adm.nothingWaitingReviewTask': 
    'Nothing is waiting for review. A task appears here the moment the '
    + 'relative it was handed to submits an answer.',
  'adm.templateChecklistHandedOut': 
    'A template is a checklist handed out as tasks — somebody who can author '
    + 'templates has to add the first.',
  'adm.budgetAlwaysDrawnFund2': 
    'A budget is always drawn on a fund. It may exceed what the fund holds — '
    + 'the gathering says so in red rather than refusing it.',
  'adm.severalGatheringsMayFlagged2': 
    'Several gatherings may be flagged at once — the Dashboard shows the '
    + 'soonest one that has not finished, so last year’s reunion never blocks '
    + 'this year’s.',
  'adm.everyStepTemplateBecomes': 
    'Every step of that template becomes a task of its own here, in its own '
    + 'order, at this point in the list. Nobody answers this step — it is the '
    + 'checklist, not a question. A template cannot include itself, or anything '
    + 'that leads back to it.',
  'adm.startingFigureCopiedOnto': 
    'A starting figure copied onto the task. An organizer can change it on '
    + 'the gathering, and the money that counts is the gathering’s own budget.',
  'adm.onePerThingSomebody': 
    'One per thing somebody has to do or decide, in the order they will be '
    + 'handed out. They are copied onto the tasks of every gathering scheduled '
    + 'from this template, so editing one here never changes a gathering '
    + 'already running.',
  'adm.whatEachMemberEncouraged': 
    'What each member is encouraged to reach. Advisory — members give what '
    + 'they like, and may go past it.',
  'adm.driveMembersCanGive': 
    'A drive members can give to between two dates. Nobody owes it, and it '
    + 'never counts against a member’s balance.',
  'adm.groupChaptersTexasEastern': 
    'A group of chapters — “Texas”, “Eastern”, “Southeast”. Optional: a '
    + 'family can run on chapters alone, or on neither.',
  'adm.noChaptersYetUntil': 
    'No chapters yet. Until there are, every member is under National and '
    + 'owes only the family-wide dues.',
  'adm.chapterSRegionDecides': 
    'A chapter’s region decides which regional dues its members owe. You can '
    + 'move a chapter to another region at any time from the',
  'adm.billingCouldNotLoaded': 
    'Billing could not be loaded. Refresh the page — do not start a new '
    + 'payment on the Plan tab until it appears, in case this family already '
    + 'has one.',
  'adm.termEndedPayAgain': 
    'This term has ended. Pay again on the Plan tab to reopen the pages it '
    + 'covered — every record is still here.',
  'adm.stripeSOwnPortal': 
    'Stripe’s own portal, where the card on file is changed and every invoice '
    + 'can be downloaded.',
  'adm.canSeeWhatFamily': 
    'You can see what this family pays but not change it. Ask an '
    + 'administrator with Settings access.',
  'adm.nominationNobodyAnsweredNot': 
    'A nomination nobody has answered is not on the ballot. Only accepted '
    + 'candidates can be voted for.',
  'adm.whatFamilyCalledEverywhere': 
    'What this family is called everywhere in the app — the switcher, the '
    + 'dashboard, and the emails inviting people to join. Changing it moves '
    + 'nothing else: the family code below is what every record is filed under.',
  'adm.whereFamilyDecidesWhether': 
    'Where the family is. This decides whether a gathering has finished, '
    + 'whether a task is overdue and when an election closes — the answers '
    + 'every member has to agree on. It does not change the times on a '
    + 'gathering, which are always shown as they were typed, or your own dates, '
    + 'which follow My Profile.',
  'adm.canSeePageBut': 
    'You can see this page but not change the name. Ask an administrator for '
    + 'the Settings permission.',
  'adm.shareRelativesSoThey': 
    'Share this with relatives so they can join. Everyone who joins waits in '
    + 'Pending Approval until somebody admits them.',
  'adm.codeCannotChangedFamily': 
    'The code cannot be changed, and a family cannot be deleted. Every record '
    + 'in the family — dues, funds, events, chat, members — is filed under this '
    + 'code, and nothing in the database points back the other way, so changing '
    + 'it would leave the family holding none of its own history.',
  'adm.switchesFamilyOffEverybody': 
    'Switches the family off for everybody in it. Nobody can open it, the '
    + 'family code stops working, and outstanding invitations stop being '
    + 'accepted.',
  'adm.familyNotSetUp': 
    'Your family has not set up any board positions yet. Add them under '
    + 'Members & Access → Organization, then come back.',
  'adm.cannotSeeSetMember': 
    'You cannot see or set this member’s password. Send them a link and they '
    + 'choose a new one themselves; the current one keeps working until they '
    + 'do.',
  'adm.billingStartsWhenTerm': 
    'Billing starts when the term you have already paid for ends. Nothing is '
    + 'charged today.',
  'adm.canSeePlanBut': 
    'You can see the plan but not change it. Ask an administrator for the '
    + 'Settings permission.',
  'adm.refreshPageIfKeeps': 
    'Refresh the page. If this keeps happening, do not try to connect an '
    + 'account — ask an administrator to check, because the family may already '
    + 'have one.',
  'adm.duesRecordedHandFrom': 
    'Dues are recorded by hand from the Transactions ledgers in the meantime, '
    + 'and every payment already recorded stays exactly where it is.',
  'adm.anyRecurringPaymentsRunning': 
    'Any recurring payments that were running were cancelled at Stripe when '
    + 'this was disconnected. Those cannot be restarted — each of those '
    + 'relatives will need to set their payment up again after you reconnect.',
  'adm.accountBelongsFamilyNot': 
    'The account belongs to the family, not to GENORRA. Money goes straight '
    + 'to the family’s own bank, Stripe’s fees come out of the family’s side, '
    + 'and the family keeps its own Stripe dashboard. GENORRA never sees or '
    + 'stores a Stripe key and takes no cut of what the family collects.',
  'adm.canSeeSectionBut': 
    'You can see this section but not change it. Ask an administrator with '
    + 'payment settings access to connect an account.',
  'ui.optionalLeaveEmptyPin': 
    'Optional. Leave it empty to pin until somebody unpins it. Each member '
    + 'can dismiss it from their own updates whenever they like.',
  'ui.willSeeMessageWhichever': 
    'You will see this message whichever address you enter. We do not say '
    + 'whether an account exists, because the family code needed to reach this '
    + 'site is meant to be shared — and a form that answered would let anyone '
    + 'holding one work out which of your relatives has registered.',
  'ui.checkSpamFolderFirst': 
    'Check the spam folder first, then try the address you registered with '
    + 'rather than the one your family usually reaches you on. The link works '
    + 'once and expires, so ask for a fresh one rather than reusing an old '
    + 'email.',
  'ui.accountConfirmedBeforeCan': 
    'An account has to be confirmed before it can sign in. We sent a link '
    + 'when it was registered — check the spam folder first, and use the newest '
    + 'message: each link works once and expires after an hour.',
  'ui.pickSomethingNotUsed': 
    'Pick something you have not used here before. You will be signed in as '
    + 'soon as it is saved.',
  'ui.wholeWordsPhrasesLeading': 
    'Whole words and phrases, and a leading minus excludes one. It reaches '
    + 'inside a document only where the text could be read — see the badge on '
    + 'each article.',
  'ui.pastingTextWhatMakes': 
    'Pasting the text is what makes an article searchable word by word. A PDF '
    + 'or Word file is stored and downloadable, but its contents are not read '
    + 'yet.',
  'ui.familySRecordsNever': 
    'Your family\'s records are never shared — no names, relationships, '
    + 'birthdays, photographs or messages.',
  'dash.familyMemberMayAlready': 
    'A family member may have already added you. Find yourself below and link '
    + 'your account to the existing record.',
  'dash.familyMembers': 'Family Members',
  'dash.pendingApproval': 'Pending Approval',
  'dash.upcomingGatherings': 'Upcoming Gatherings',
  'dash.addMember': 'Add Member',
  'dash.recordPayment': 'Record Payment',
  'dash.sendMessage': 'Send Message',
  'dash.myTasks': 'My Tasks',
  'dist.emailEveryoneFamilyOnce': 
    'Email everyone in the family at once. The list of who gets it is your '
    + 'membership — there is nothing to keep up to date, and nobody is on it '
    + 'twice.',
  'dist.newDistribution': 'New distribution',
  'dist.canLeavePageSend': 'You can leave this page — the send carries on from where it got to.',
  'dist.weCouldNotRead': 
    'We could not read your distributions just now. Nothing has been lost — '
    + 'try again in a moment.',
  'dist.sent': 'Sent to',
  'dist.sent2': 'Sent by',
  'dist.tryAgain': 'Try again',
  'dist.whoGoes': 'Who it goes to',
  'dist.plainTextLeaveBlank': 
    'Plain text. Leave a blank line between paragraphs. Replies come back to '
    + 'your own email address, not to GENORRA.',
  'dist.loading': 'Loading…',
  'dist.whatSent': 'What was sent',
  'dist.whoWent': 'Who it went to',
  'dist.reunionDetails4th': 'Reunion details for the 4th',
  'dist.waitingSend': 'Waiting to send',
  'dist.couldNotDelivered': 'Could not be delivered',
  'dist.noEmailAddressFile': 'No email address on file',
  'dist.sharesAddress': 'Shares an address',
  'dist.notSentStopped': 'Not sent — stopped',
  'dist.emailsSentBeenSent':
    'The emails that were sent have been sent. This removes the record of who was '
    + 'emailed and what happened to each message, and it cannot be undone.',
  'dues.schedule': 'By schedule',
  'dues.noDuesSchedulesActive': 
    'No dues schedules are active, so there is nothing to project. Add one '
    + 'under Accounting → Dues.',
  'dues.member': 'By member',
  'dues.onlyThoseWhoOwe': 'Only those who owe',
  'dues.nobodyFamilyBeenApproved': 
    'Nobody in the family has been approved yet, so there is nothing to '
    + 'project.',
  'dues.noMembersMatchFilter': 'No members match that filter.',
  'dues.eachScheduleMeasuredOver': 
    'Each schedule is measured over its own year, so the totals are the sum '
    + 'of them',
  'dues.filterName': 'Filter by name…',
  'dues.filterMembers': 'Filter members',
  'dues.onlyMembersDescendedFrom': 'Only members descended from the family\'s line owe this.',
  'dues.onlyMembersPartFamily': 
    'Only members in this part of the family owe this due. A member with no '
    + 'chapter is under National and owes nothing scoped.',
  'dues.nothingPaid': 'Nothing paid',
  'dues.partPaid': 'Part paid',
  'dues.notYetDue': 'Not yet due',
  'dues.notTheirs': 'Not theirs',
  'dues.pendingInvite': 'Pending Invite',
  'ui.putRelativeForwardAny': 
    'Put a relative forward for any office below, or stand for one yourself. '
    + 'You can take your own name off a nomination while nominations are open.',
  'ui.standingOfficeYourselfNeeds': 
    'Standing for an office yourself needs nobody else’s agreement, and it '
    + 'counts as accepted straight away.',
  'ui.theyGoTreeStraight': 
    'They go on the tree straight away. We\'ll email them an invitation, and '
    + 'when they accept it their account joins',
  'ui.duesCanStartAge': 
    'Dues can start at an age. Without a birthday we cannot tell when this '
    + 'child starts owing them, and they would be billed as an adult.',
  'ui.shouldRareWeGenerate': 
    'This should be rare. We generate an address so the record can exist, and '
    + 'we never send anything to it — so this person cannot sign in, and '
    + 'nothing will reach them. If they might ever want an account, invite them '
    + 'instead.',
  'ui.siblingsSharePersonS': 
    'Siblings share this person\'s generation, so they are listed here rather '
    + 'than drawn in the row above.',
  'ui.decidesWhetherTheyFill': 
    'This decides whether they fill the father or the mother slot, and lets '
    + 'us name the connection back to them.',
  'ui.gotEmailAddressNow': 
    'Got an email address now? Send them an invitation. When they accept it, '
    + 'their account joins',
  'gath.budgetGatheringCouldNot': 
    'The budget for this gathering could not be read just now. Nothing has '
    + 'changed — reload the page to try again.',
  'gath.noTasksYetGathering': 
    'No tasks yet. A gathering’s tasks come from the templates it was built '
    + 'from, so an organizer adding a template here adds its jobs to this list.',
  'gath.everyStepEveryTemplate': 
    'Every step of every template you choose becomes a task on this '
    + 'gathering, ready to hand out. Choose none and this is a date on the '
    + 'family calendar with no tasks — an organizer can build it out later.',
  'gath.nothingAssignedMomentWhen': 
    'Nothing is assigned to you at the moment. When an organizer hands you '
    + 'part of a gathering, it appears here with what to send back and by when.',
  'gath.runsOverMoreThan': 'Runs over more than one day',
  'gath.startTime': 'Start time',
  'gath.optional': 'Optional.',
  'gath.leaveEmptyIfAll': 'Leave empty if it is all on one day.',
  'gath.endTime': 'End time',
  'gath.addAnotherDay': 'Add another day',
  'gath.chooseTimezone': 'Choose a timezone…',
  'gath.everyoneSeesTimeExactly': 
    'Everyone sees the time exactly as you typed it, with this timezone named '
    + 'beside it. Nothing is converted.',
  'ui.weLlEmailThem': 
    'We\'ll email them an invitation. Only this address can use it, and it '
    + 'expires in 14 days. The name is what your family sees while they are '
    + 'waiting to be admitted.',
  'ui.invitationCreatedButWe': 
    'The invitation was created, but we could not email it. Send them this '
    + 'link instead — it works exactly the same.',
  'ui.treatLikePasswordAnyone': 
    'Treat it like a password — anyone who gets hold of it and has that email '
    + 'address can use it. It is shown once.',
  'shell.anythingTypedNotSaved': 
    'Anything you have typed and not saved will be lost, so finish up or '
    + 'carry on now.',
  'shell.iMStillHere': 'I’m still here',
  'shell.stillThere': 'Still there?',
  'shell.familyTree': 'Family Tree',
  'shell.meetingMinutes': 'Meeting Minutes',
  'shell.officerNotes': 'Officer Notes',
  'shell.duesDonations': 'Dues & Donations',
  'shell.paymentHistory': 'Payment History',
  'shell.duesProjections': 'Dues Projections',
  'shell.pLSummary': 'P&L Summary',
  'shell.boardOffices': 'Board & Offices',
  'shell.howManual': 'How-To Manual',
  'ui.theseMinutesClosedNothing': 
    'These minutes are closed. Nothing about the meeting changes now — which '
    + 'is what makes them the record.',
  'ui.scheduleOneSayingWhat': 
    'Schedule one by saying what kind of meeting it is — the whole family, a '
    + 'chapter, a board, one office across every area, or just the people you '
    + 'name — and everybody in the room is told and gets it on their calendar. '
    + 'During the meeting the secretary adds a topic and writes notes under it, '
    + 'and can call a vote the room answers.',
  'ui.everyoneSeesTimeExactly': 
    'Everyone sees the time exactly as you typed it, with this timezone named '
    + 'beside it. Nothing is converted.',
  'ui.administratorFamilySwitchedOff': 
    'An administrator of this family switched it off. Nobody can open it, '
    + 'join it or accept an invitation to it.',
  'ui.everyPaymentFundPhotograph': 
    'Every payment, fund, photograph, event, message, document and person is '
    + 'exactly where it was. Removing a family closes its doors; it destroys no '
    + 'records at all, and it did not touch your account or any other family '
    + 'you belong to.',
  'ui.onlyGenorraSupportCan': 
    'Only GENORRA support can bring a family back — there is no button for it '
    + 'anywhere in the product, on purpose. If this was not meant, ask whoever '
    + 'administers the family to get in touch with support.',
  'ui.requestBackTheirAdministrators': 
    'Your request is back with their administrators, with your note attached. '
    + 'They will see who declined it before and what you have said about it.',
  'ui.sayWhoHowRelated': 
    'Say who you are and how you are related, so whoever reviews it can place '
    + 'you. This goes to the family\'s administrators.',
  'ui.weSentConfirmationLink': 
    'We sent a confirmation link when you signed up. Your request cannot be '
    + 'approved until you have used it.',
  'ui.weWillGenerateFamily': 
    'We will generate a family code you can share. Your name and contact '
    + 'details are copied from the profile you already have, and stay in step '
    + 'across every family you belong to.',
  'ui.shareRelativesSoThey': 
    'Share this with your relatives so they can join. Everyone who joins '
    + 'waits in Member Approvals until you admit them.',
  'ui.profileDetailsSharedAcross': 
    'Your profile details are shared across every family you belong to. '
    + 'Choose which one opens when you log in, or switch the family you\'re '
    + 'viewing now.',
  'ui.familyAccountBelongsProfile': 
    'The family this account belongs to. Your profile details are shared '
    + 'across every family you join.',
  'ui.switchedOffAdministratorNothing': 
    'Switched off by an administrator. Nothing was deleted, and only GENORRA '
    + 'support can bring it back.',
  'prof.whatFamilyMayContact': 
    'What your family may contact you about, and how. Everything here is '
    + 'yours to set and nobody else can set it for you.',
  'prof.chapterAppliesFamilyOnly': 
    'Your chapter applies to this family only — the rest of your profile is '
    + 'shared across every family you belong to. Changing it also moves any '
    + 'sons or daughters under 18 who have no account of their own; everybody '
    + 'else sets their own.',
  'prof.canAlsoDecideWhat': 
    'It can also decide what you owe: a family can attach dues to one region '
    + 'or one chapter. Choosing nothing leaves you under National, owing the '
    + 'family-wide dues and none of the local ones.',
  'prof.sunsetDate': 'Sunset Date',
  'prof.datesTimesProductRecords': 
    'Dates and times the product records — when a payment was entered, when a '
    + 'message was sent — are shown to you in this timezone.',
  'prof.leaveEmptyWeFollow': 
    'Leave this empty and we follow your browser. Translation is still in '
    + 'progress, so some screens are English whichever language you choose.',
  'prof.changeSignEmail': 'Change sign-in email',
  'prof.passwordBeenChangedEvery': 
    'Your password has been changed, and every other device signed in to this '
    + 'account has been signed out. They will need the new password.',
  'rep.everyApprovedMemberFamily': 
    'Every approved member of the family, wherever they sit. Applicants still '
    + 'waiting in the approvals queue are not counted, and neither are '
    + 'relatives recorded as having died.',
  'rep.lookingUpWhoGroup': 'Looking up who is in this group…',
  'rep.whoGroupNotYours': 
    'Who is in this group is not yours to see. The figures on the chart are; '
    + 'the names need the Member Directory as well.',
  'rep.theirRegionFollowsTheir': 
    'Their region follows their chapter. Sons and daughters under eighteen '
    + 'with no account of their own move with them.',
  'rep.adultMinorWorkedOut': 
    'Adult or minor is worked out from this every time the report loads; '
    + 'nothing is stored about their age.',
  'ui.relativeWhoNotTold': 
    'A relative who has not told the family which chapter they are in is not '
    + 'in any region, so they are not asked. Use',
  'stf.staffListCouldNot': 
    'The staff list could not be read. That is a refused query rather than an '
    + 'empty team — you are on it, or this page would have answered 404 rather '
    + 'than rendering. Try again in a moment, and check the server log for the '
    + 'reason.',
  'stf.addressBelongAccountAlready': 
    'The address has to belong to an account that already exists. Somebody '
    + 'who has never registered cannot be granted anything, and this screen '
    + 'will say so rather than write a row for an id — which is why it asks for '
    + 'an address and not for a user id.',
  'stf.recordedRowShownList': 
    'Recorded on the row and shown in the list above. It is the only thing '
    + 'that will explain this grant to whoever reads the list in a year, which '
    + 'is why it is required.',
  'stf.pasteAddressFromTicket': 
    'Paste the address from the ticket. This says whether an account exists '
    + 'at all, whether it has ever been confirmed or used, and every family '
    + 'record carrying that address — including one that was invited and never '
    + 'joined.',
  'stf.authenticationServiceDidNot': 
    'The authentication service did not answer, so we do not know whether '
    + 'this address has an account. That is a failed lookup, not a missing '
    + 'account — try again.',
  'stf.addressNeverBeenConfirmed': 
    'The address has never been confirmed — that is what stops the sign-in. '
    + 'Resending the confirmation is the fix.',
  'stf.familyRecordsAddressCould': 
    'The family records for this address could not be read — that is a '
    + 'refused query rather than an address belonging to nothing.',
  'stf.addressNoFamilyRecord': 
    'This address is in no family record. An account with no family sees a '
    + '404 on every page, which is what “it just does not work” looks like.',
  'stf.accountListCouldNot': 
    'The account list could not be read. That is the authentication service '
    + 'refusing or timing out, not a platform with no accounts on it.',
  'stf.familiesListCouldNot': 
    'The families list could not be read. That is a refused query rather than '
    + 'an empty platform — try again in a moment, and check the server log for '
    + 'the reason.',
  'tx.canOpenTransactionsBut': 
    'You can open Transactions, but none of its ledgers have been shared with '
    + 'you. Ask an administrator for access to the ones you need — dues, '
    + 'donations, contributions, disbursements and transfers are each granted '
    + 'separately.',
  'tx.noContributionsYet': 'No contributions yet.',
  'tx.noDisbursementsRecorded': 'No disbursements recorded.',
  'tx.noTransfersBetweenFunds': 'No transfers between funds yet.',
  'tx.noneSetUpYet': 'None set up yet — an admin adds these under Accounting.',
  'tx.waivingForgivesDueNo': 
    'Waiving forgives the due. No money changed hands, so there is no method '
    + 'or reference to record.',
  'tx.paymentMethod': 'Payment Method',
  'tx.checkReference': 'Check # / Reference',
  'tx.whoGave': 'Who gave it',
  'tx.someoneSomethingElse': 'Someone or something else…',
  'tx.nameSource': 'Name or source',
  'tx.milestoneOptional': 'Milestone (optional)',
  'tx.transferCannotEditedDeleted': 
    'A transfer cannot be edited or deleted. If it is wrong, move the money '
    + 'back — both entries stay on the ledger.',
  'tx.check1043': 'Check #1043',
  'tx.optionalNotes': 'Optional notes',
  'tx.auntRubySEstate': 'Aunt Ruby\'s estate, 2026 reunion surplus…',
  'tx.boardVote202608': 'Board vote 2026-08-12 — surplus moved to the scholarship fund',
  'tx.newContribution': 'New Contribution',
  'tx.newDisbursement': 'New Disbursement',
  'tx.newTransfer': 'New Transfer',
  'tx.recorded': 'Recorded by',
  'tx.paymentMethod2': 'Payment method',
  'tx.paid': 'Paid to',
  'tx.fundMilestone': 'Fund / Milestone',
  'tx.from': 'From → To',
  'ui.stateProvince': 'State / Province',
  'ui.profilePhoto': 'Profile photo',
  'ui.confirmationCode': 'Confirmation code',
  'ui.chosen': 'Chosen:',
  'ui.nobodyMatches': 'Nobody matches that.',
  'ui.searchName': 'Search by name…',
  'ui.whoCanDoWhat': 'Who can do what',
  'ui.farScrollingGoesThere': 
    'That is as far as scrolling goes. There are older updates — search for a '
    + 'word in one to find it.',
}
