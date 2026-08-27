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
  'nav.item./accounting/transactions': 'Transactions',

  'nav.item./reporting/membership': 'Membership',
  'nav.item./reporting/payment-history': 'Payment History',
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
  'language.label': 'Language',
  'language.choose': 'Choose a language',

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
  // THE DOCUMENT TITLE IS NOT HERE YET, deliberately. `export const metadata` is static, so
  // translating a tab title means `generateMetadata`, which has no `user` and would have to make
  // its own GoTrue `getUser()` call — doubling the auth round trips on every page load to
  // translate a browser tab. Deferred as a decision rather than an omission; the alternative
  // (falling back to `Accept-Language` there) would print a Spanish tab over an English page for
  // anybody whose browser and stored choice disagree, which is worse than English.
  'page./accounting/dues-and-donations.title': 'Dues & Donations',
  'page./accounting/summary.title': 'Summary',
  'page./accounting/transactions.title': 'Transactions',
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
  'page./reporting/payment-history.title': 'Payment History',
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
  'notify.notBuilt': 'Not built yet',
  'notify.stopped': 'Stopped',
  'notify.toggleLabel': '{channel} for {notification}',
  'notify.noneOnFile': 'None on file',
  'notify.placeholderAddress': 'A placeholder address — nothing can reach it',
  'notify.endingIn': 'Ending {digits}',
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
  'pnl.duesAndDonations': 'Dues &amp; donations',
  'pnl.direct': 'Direct contributions',
  'pnl.netLine': 'Income less expenses',
  'pnl.routedHeading': 'Income Routed to Funds',
  'pnl.nothingRouted': 'Nothing has been routed to funds yet.',
  'pnl.balancesToday': 'Fund balances today',
  'pnl.nothingPaidOut': 'Nothing paid out yet',
  'pnl.disbursed': 'Disbursed from the family’s funds',
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
  'bylaws.lede': 'The rules the family agreed to live by. Search them, or read them in order.',
  'bylaws.addArticle': 'Add an article',
  'bylaws.addArticleAction': 'Add article',
  'bylaws.searchLabel': 'Search the bylaws',
  'bylaws.searchPh': 'quorum, &ldquo;annual meeting&rdquo;, dues -proxy',
  'bylaws.indexedFull': 'Searchable in full',
  'bylaws.typedIn': 'Typed in — searchable in full',
  'bylaws.titleOnly': 'Title and summary only — the file&rsquo;s text has not been read',
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
  'budget.help': 'How a gathering&apos;s budget works',

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
  'meet.titlePh': 'Quarterly officers&rsquo; meeting',
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
}
