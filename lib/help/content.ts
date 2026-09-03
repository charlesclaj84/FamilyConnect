/**
 * The how-to manual: every screen in the signed-in app, what it is for, and how to work it.
 *
 * ── WHY THE MANUAL IS DATA ──────────────────────────────────────────────────────────
 * Because three surfaces have to agree about the same chapter — the contents page, the
 * chapter page, and `generateMetadata`, which needs the summary as a plain sentence before
 * any of it renders. Written as JSX, the summary would be a copy and the contents page a
 * hand-maintained list; written as data, both are derived and a new chapter appears in the
 * index by existing.
 *
 * It also keeps this module PURE — no React, no `server-only`, no database — which is what
 * lets `app/(protected)/help/[slug]/page.tsx` resolve a slug and 404 on a bad one before it
 * decides to render anything. Same rule, and the same reason, as `lib/features.ts`.
 *
 * ── WHAT `route` IS FOR, AND WHAT IT IS NOT ─────────────────────────────────────────
 * A chapter that documents one screen names that screen's route. The help pages use it to
 * answer, honestly and per reader, whether the thing being described is something they can
 * actually open: the registry says whether it has shipped and which plan it belongs to, and
 * `viewableResources()` says whether this family has granted it to them.
 *
 * It is NOT a gate. The manual documents the whole product to everybody, because a manual
 * that hides the chapter on Accounting from someone who has just been asked to keep the
 * books is a manual that fails on its first day. Nothing on these pages reads family data,
 * so there is nothing here to withhold — what the route buys is a label saying "you cannot
 * open this yet", which is strictly more useful than a link that 404s.
 *
 * ── KEEPING IT TRUE ─────────────────────────────────────────────────────────────────
 * This file describes screens, so it goes stale the way screenshots do. When a screen
 * gains, loses or renames a control, the chapter naming it is part of that change. The
 * chapters are keyed by ROUTE rather than by feature name for exactly that reason —
 * `grep "route: '/events'"` finds everything the manual claims about Events.
 *
 * Two things are deliberately NOT restated here, because they are derived and would drift:
 * which plan a feature belongs to (`lib/features.ts`) and what each plan includes
 * (`lib/plans.ts`). The chapter on plans links to the panel that reads them.
 *
 * ── THE ONE NUMBER THIS FILE HAS TO COPY ────────────────────────────────────────────
 * The birthday horizon. `BIRTHDAY_HORIZON_DAYS` in `lib/birthdays.ts` is the single
 * definition and the pane interpolates it, but this module has NO IMPORTS by design — that
 * is what lets `help-check.mjs` and three surfaces load it without a build step — so
 * `announcements#birthdays` says "60 days" as a literal. It is the only figure in the manual
 * that could silently disagree with the product. If that constant moves, grep this file for
 * it; nothing mechanical will catch it.
 */

// ── The shape of a chapter ────────────────────────────────────────────────────────────

/**
 * One run of content. Every `text` may carry the two inline forms `lib/help/inline.ts`
 * understands — `**a control on screen**` and `[a link](/route)`.
 */
export type HelpBlock =
  /** A paragraph. */
  | { kind: 'text'; text: string }
  /** Do this, then this. Rendered as a numbered list — use it only when order matters. */
  | { kind: 'steps'; items: readonly string[] }
  /** An unordered list, for things that are true at the same time. */
  | { kind: 'bullets'; items: readonly string[] }
  /** Term and meaning. A description list rather than a table — see the note below. */
  | { kind: 'defs'; items: readonly { term: string; text: string }[] }
  /** One thing worth stopping for. Sparingly: a page of notes is a page of nothing. */
  | { kind: 'note'; text: string }

/**
 * `defs` rather than a two-column table, on purpose. AGENTS.md is strict about tables — a
 * real `<table>` with `<th scope="col">`, and every non-essential column folded on a phone
 * through `COLLAPSING_CELL` — and all of that machinery exists to make a GRID of values
 * legible. A term and its meaning is not a grid, it is a description list, and `<dl>` says
 * so to a screen reader without any of the folding.
 */

export interface HelpSection {
  /** Anchor and "On this page" key. Stable — it ends up in shared links. */
  id: string
  heading: string
  blocks: readonly HelpBlock[]
}

export interface HelpChapter {
  slug: string
  title: string
  /** One sentence. The contents card, the chapter's lead line, and its meta description. */
  summary: string
  /** The screen this chapter documents, if it documents exactly one. See the header. */
  route?: string
  sections: readonly HelpSection[]
}

export interface HelpPart {
  id: string
  title: string
  blurb: string
  chapters: readonly HelpChapter[]
}

// Terse constructors, so the content below reads as prose rather than as object literals.
const p = (text: string): HelpBlock => ({ kind: 'text', text })
const steps = (...items: string[]): HelpBlock => ({ kind: 'steps', items })
const bullets = (...items: string[]): HelpBlock => ({ kind: 'bullets', items })
const defs = (...items: { term: string; text: string }[]): HelpBlock => ({ kind: 'defs', items })
const note = (text: string): HelpBlock => ({ kind: 'note', text })

// ── The manual ────────────────────────────────────────────────────────────────────────

export const HELP_PARTS: readonly HelpPart[] = [
  {
    id: 'start',
    title: 'Getting started',
    blurb: 'What the screen is made of, and how you and your relatives get in.',
    chapters: [
      {
        slug: 'finding-your-way-around',
        title: 'Finding your way around',
        summary: 'The rail, the top bar, and the handful of controls that are on every screen.',
        sections: [
          {
            id: 'the-rail',
            heading: 'The rail down the left',
            blocks: [
              p('Everything in the product is reached from the burgundy rail. Its headings group screens by what they are for — **Community**, **Gatherings**, **Library**, **Accounting**, **Reporting**, **Admin**, **Help** — and a heading opens when you click it, closing the one that was open.'),
              p('The rail only lists screens you can actually open. If a heading you expected is missing, it is because every screen under it is either not part of your family plan or not something your family has given you. That is not a fault — see [Who can do what](/help/who-can-do-what).'),
              p('On a phone the rail is behind the **Menu** button at the top left. It closes itself as soon as you pick something.'),
            ],
          },
          {
            id: 'the-top-bar',
            heading: 'The bar across the top',
            blocks: [
              p('Five controls sit at the top right of every page.'),
              defs(
                { term: 'Family switcher', text: 'Shown when your account belongs to more than one family. Picking a different family reloads the page you are on as that family.' },
                { term: 'Help', text: 'A question mark, linking to the chapter of this manual that describes the screen you are on. It is not there on the few screens no chapter covers yet, and not on these help pages.' },
                { term: 'Bell', text: 'Your notifications, plus a standing row for any family with people waiting to be approved — including families you are not currently looking at.' },
                { term: 'Language', text: 'The two-letter code beside the bell — **EN**, **ES** or **FR**. Picking one changes the product into that language everywhere, and on every device you sign in on, because it is kept with your profile rather than with this browser. It is not shown while the product speaks only one language.' },
                { term: 'Your name', text: 'Opens the account menu: [My Profile](/personal-info), [My Families](/my-families), **Appearance** — Light, Dark or System, remembered in this browser — and sign out.' },
              ),
              p('Each of these closes itself a few seconds after you move away from it, so a panel is never left sitting over the page you went on to read. It stays open for as long as your pointer is over it, and for as long as you are moving through it with the keyboard.'),
            ],
          },
          {
            id: 'notifications',
            heading: 'The bell',
            blocks: [
              p('Notifications arrive in real time — you do not need to refresh. They cover things that happened to you: a membership decision, somebody asking to join a family you administer, and similar.'),
              p('Notifications belong to you *in one family*, because that is what a notification is. The one thing that reaches across families is the approvals queue: if you administer two families and somebody is waiting in the second, the bell tells you while you are still looking at the first.'),
            ],
          },
          {
            id: 'signed-out',
            heading: 'Being signed out after an hour',
            blocks: [
              p('If nothing is typed or clicked for 60 minutes you are signed out of this device and sent to the sign-in page, with a note saying why. A warning appears for the last minute so you can stay.'),
              p('Activity in any tab counts, so reading a long announcement in one tab does not sign you out of another. Signing out here does not sign you out of your phone — for that, use **Sign out other devices** on [Sign-in & Security](/personal-info?section=security).'),
              p('**On a phone it happens when you come back.** A phone closes the page down while it is in the background, so nothing is running to count the hour and no warning can be shown; the check runs the moment you reopen it. If you were away longer than an hour you land on the sign-in page instead of where you left off, which is the same rule arriving a little later.'),
            ],
          },
          {
            id: 'saving',
            heading: 'How saving works',
            blocks: [
              p('Nothing on a form is saved until you press its button. Anything destructive — deleting an announcement, removing a connection on the tree, opting out of a dues schedule — asks you to confirm first and says what will happen.'),
              p('When something is refused, the reason appears next to the button you pressed. If a whole page says it could not load, it is usually worth trying once more before assuming the worst.'),
            ],
          },
        ],
      },
      {
        slug: 'joining-a-family',
        title: 'Creating or joining a family',
        summary: 'Family codes, invitations, the approvals queue, and what to do while you wait.',
        sections: [
          {
            id: 'create',
            heading: 'Starting a family',
            blocks: [
              steps(
                'On the registration page, choose **Create Family** and give it a name.',
                'Finish signing up. You are the first member and are approved immediately.',
                'A six-character family code is generated and shown to you. That code is how relatives join.',
              ),
              p('The code is always available afterwards on [Settings](/admin/settings) and on [My Families](/my-families).'),
            ],
          },
          {
            id: 'join-by-code',
            heading: 'Joining with a family code',
            blocks: [
              p('If somebody has given you a family code, choose **Join Family** when you register and type it in. If you already have an account, use **Join a family** on [My Families](/my-families) instead — one account can belong to several families.'),
              note('Joining by code does not admit you. It puts you in the family\'s approvals queue, and somebody there has to let you in. Anyone holding the code can ask to join, which is exactly why the decision is a person\'s and not the code\'s.'),
            ],
          },
          {
            id: 'invitations',
            heading: 'Joining from an invitation',
            blocks: [
              p('An invitation is a link emailed to one address. It is better than a code for the person sending it, because it can pre-approve you: follow the link, set a password, and you are in without waiting.'),
              p('An invitation that does not pre-approve puts you in the queue like a code does. Either way the link is for the address it was sent to — if you are signed in as somebody else when you open it, the product says so rather than quietly attaching the invitation to the wrong account.'),
            ],
          },
          {
            id: 'confirm-your-email',
            heading: 'Confirming your email address',
            blocks: [
              p('However you register — a new family, a family code, or an invitation — a confirmation link is emailed to the address you signed up with, and the account cannot sign in until that link has been opened. It works once and expires after an hour, so use the newest message rather than an older one further up the same thread.'),
              p('If you try to sign in before opening it, the sign-in page says the address is not confirmed and offers **Send the link again** underneath the form. Look in the spam folder before pressing it: a link that arrived and was overlooked is much the commonest reason for this, and another copy of it does not help.'),
              note('Nobody is told whether that email arrived — not you, and not us — so the page says what it asked for rather than promising delivery. If nothing ever comes, the likeliest answer is that the address is not the one the account was registered with.'),
            ],
          },
          {
            id: 'waiting',
            heading: 'While you are waiting',
            blocks: [
              p('Until somebody admits you, three screens are open to you: the dashboard, which tells you where the request stands, [My Profile](/personal-info), and [My Families](/my-families). The rest of the rail appears the moment you are approved — you do not have to sign in again, the page notices on its own.'),
              p('Filling in your profile while you wait is the useful thing to do. It is what gives whoever reviews the queue a person to recognise rather than an email address.'),
            ],
          },
          {
            id: 'declined',
            heading: 'If a request is declined',
            blocks: [
              p('You are told, and you can appeal it: your note goes back to the same queue and the request is pending again. The note is the point — it is what gives whoever reviews it a reason to look twice — so write the sentence rather than resubmitting in silence.'),
              p('Your profile stays yours either way, and any other family you belong to is unaffected.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'you',
    title: 'Your own account',
    blurb: 'The things that are yours rather than the family\'s.',
    chapters: [
      {
        slug: 'my-profile',
        title: 'My Profile',
        summary: 'Your name, how relatives reach you, and the settings for your sign-in.',
        route: '/personal-info',
        sections: [
          {
            id: 'sections',
            heading: 'The five sections',
            blocks: [
              p('The rail across the top of the page switches between them. Each saves on its own, so you can fill in one and come back later.'),
              defs(
                { term: 'General', text: 'Name, preferred name, phone, email, birthday, and your photo.' },
                { term: 'Address', text: 'Where you live. Used by the Directory and by anything the family posts to you.' },
                { term: 'Additional Information', text: 'T-shirt size, chapter, and the other details events and reports ask for.' },
                { term: 'Notifications', text: 'What your family may contact you about and how — a switch per notification, per channel.' },
                { term: 'Sign-in & Security', text: 'The address you sign in with, and your password.' },
              ),
            ],
          },
          {
            id: 'notifications',
            heading: 'Notifications',
            blocks: [
              p('**Notifications** is a grid: a row for each thing your family can contact you about, and a column for each way it could reach you — **Email**, **SMS** and **Push Notification**. It opens as a list of what you have chosen; press **Edit** above it to change anything, then **Done** when you have finished. There is no **Save**, and no **Cancel**: each cell is one press, **On** or **Off**, and it takes effect the moment you press it, so **Done** only puts the switches away again.'),
              p('It uses the email address and mobile number already in your **General** details. Both are shown at the top of the screen so you can see where a notification would go, and changing either one there changes it for every notification at once. This screen never asks you for a second number.'),
              defs(
                { term: 'Safety Check', text: 'Your family raises a check-in during a storm, an evacuation or an emergency and asks whether you are safe. Email is on unless you turn it off; SMS is off unless you turn it on.' },
              ),
              note('**Email is on by default and SMS is not**, and that is deliberate rather than inconsistent. A check-in that reaches nobody is the thing worth avoiding, and your family already has your address — but a text has to be agreed to before anybody sends one, so nothing about SMS is ever on because you did not notice it.'),
              note('**Push Notification** says **Coming Soon** on every row, and today **SMS** does too. Both columns are there so you can see what is coming rather than being surprised by it later; nothing in the product sends either one yet, and Email is the channel that works. If you agreed to be texted before they were switched off, your **SMS** switch stays where it is and you can still turn it off — turning something off is never harder than turning it on was.'),
            ],
          },
          {
            id: 'notifications-delivery',
            heading: 'When On does not mean it will arrive',
            blocks: [
              p('A switch says what you have asked for. Whether we can actually deliver it is a separate question, and the screen says so underneath the grid rather than letting **On** imply more than it should.'),
              bullets(
                'No email address on file, or only a placeholder one — nothing marked on for Email can arrive. Add a real address under **General**.',
                'No mobile number on file — nothing marked on for SMS can arrive.',
                'A mobile number we have not confirmed yet — we send a six-digit code to it before we text you anything.',
                'Text messages not switched on yet at our end. You can record your choice now and we will start using it as soon as they are.',
              ),
            ],
          },
          {
            id: 'notifications-stopping',
            heading: 'Stopping texts',
            blocks: [
              p('While **SMS** reads **Coming Soon** there is nothing to stop, because nothing in the product sends a text yet. What follows applies once they are switched on, and to anybody who agreed to them before that. Turning the **SMS** cell off stops them immediately, with nothing to confirm and no reason asked for. You can turn it back on whenever you like.'),
              p('Replying **STOP** to any text we send stops them too — and that one is different in a way worth knowing about. It is your mobile network that acts on it, not us, so we cannot switch it back on from this page and neither can anybody in your family. The cell says **Stopped** rather than offering a switch. If you want them back, text **START** to the number that messaged you.'),
            ],
          },
          {
            id: 'per-family',
            heading: 'One profile per family',
            blocks: [
              note('If you belong to more than one family, you have a separate profile in each. Editing this page changes the family you are currently viewing and nothing else — which is deliberate, because the address you give your in-laws is not always the one you give your cousins.'),
            ],
          },
          {
            id: 'chapter',
            heading: 'Your chapter',
            blocks: [
              p('The block headed with your family\'s name holds one field that belongs to that family alone: which **Chapter** you are in. It appears only once the family has created some; if it has not, the block says so.'),
              p('It decides two things. Any sons or daughters under 18 who have no account of their own move with you — everybody else in the family is their own person and keeps the chapter they are in — and it can decide what you owe, because a family can attach dues to one region or one chapter. Choosing nothing leaves you under **National**: you owe the family-wide dues and none of the local ones. See [regions and chapters](/help/regions-and-chapters#dues).'),
              note('A child whose date of birth has not been recorded does not move, because nothing on file says they are under 18. Add it on their record, or set their chapter for them from Members & Access.'),
            ],
          },
          {
            id: 'password',
            heading: 'Changing your password',
            blocks: [
              steps(
                'Open **Sign-in & Security**.',
                'Type your current password, then the new one twice.',
                'If a code is emailed to you, type it in.',
                'Save. Every other device signed in as you is signed out.',
              ),
              p('There is also a **Sign out other devices** control on its own, for when you have simply left yourself signed in somewhere and do not want to change anything else.'),
            ],
          },
          {
            id: 'photo',
            heading: 'Your photo',
            blocks: [
              p('The photo you upload on **General** is what appears beside your name in the top bar, on the dashboard greeting, and anywhere the family sees you. Without one you get your initials.'),
              steps(
                'Open **General**.',
                'Press the camera on the circle at the top of the page.',
                'Choose a picture and confirm.',
              ),
              p('A JPEG, PNG or WebP, up to 2 MB. Anything else is refused with a line saying why rather than failing silently, and a new photo replaces the one it follows.'),
              note('Your photo is ONE photo, shared by every family you belong to — unlike the rest of this page, which is per family. Anybody who can see you in the [Directory](/community/directory) can see it, so it is the one field here to treat as public within the family.'),
              note('Whether it is SHOWN depends on the family’s plan, and that is decided per family rather than per account: a family whose plan does not include profile pictures shows your initials everywhere instead, and offers no camera on this page. If you belong to two families you may well see your photo in one and your initials in the other. Nothing is lost either way — the picture is still there, and it appears the moment a family’s plan includes it.'),
            ],
          },
        ],
      },
      {
        slug: 'my-families',
        title: 'My Families',
        summary: 'Every family your account belongs to, which one opens by default, and how to add another.',
        route: '/my-families',
        sections: [
          {
            id: 'reading',
            heading: 'Reading the list',
            blocks: [
              p('Each family shows its name, its code, and where you stand in it. Two markers matter:'),
              defs(
                { term: 'Viewing', text: 'The family the rest of the product is currently showing you.' },
                { term: 'Default', text: 'The family that opens when you sign in. Press **Default** on any other row to move it.' },
              ),
            ],
          },
          {
            id: 'switching',
            heading: 'Switching family',
            blocks: [
              p('Use the family switcher in the top bar — it does the same job from every page. Switching rebuilds the whole page for the new family: anything half-typed is discarded rather than carried across, which is what stops a form filled in for one family being saved into another.'),
            ],
          },
          {
            id: 'adding',
            heading: 'Adding another family',
            blocks: [
              p('**Join a family** takes a family code and puts you in that family\'s queue. **Create a family** starts a new one with you as its first member. Neither disturbs the families you are already in.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'dashboard',
    title: 'The dashboard',
    blurb: 'The screen you land on, and what each panel is telling you.',
    chapters: [
      {
        slug: 'the-dashboard',
        title: 'The dashboard',
        summary: 'Your family at a glance: the figures, what needs doing, and what has happened lately.',
        route: '/dashboard',
        sections: [
          {
            id: 'greeting',
            heading: 'The greeting',
            blocks: [
              p('Your name, your photo, any officer roles you hold, and your chapter if your family uses them.'),
            ],
          },
          {
            id: 'reminders',
            heading: 'The reminders',
            blocks: [
              p('Up to two prompts sit under the greeting. Both are asks rather than warnings, and neither withholds anything.'),
              defs(
                { term: 'Finish your profile', text: 'Your relatives find you in the Directory, and yours is mostly empty. It names what is missing — a phone number, where you live, your birthday, a photo — and links straight to My Profile. It has no dismiss button because it goes away on its own: fill in half of what it asks for and it stops appearing.' },
                { term: 'Select your chapter', text: 'Only in a family that has chapters, and only while you are in none. Setting it here is the same as setting it on your profile, and the relatives without accounts of their own move with you.' },
              ),
              note('Neither prompt is visible to anybody else, and nothing on any screen is locked behind either one. A member who wants to enter nothing is entitled to.'),
            ],
          },
          {
            id: 'premier-gathering',
            heading: 'The premier gathering',
            blocks: [
              p('Directly under the greeting, a band for the gathering the family has said matters most — its title, its dates, where it is, how much of its work has been approved, and **View details** straight through to it. It is there for nobody most of the time: it appears only while a gathering is flagged and still ahead. See [Gatherings](/help/gatherings#browsing).'),
              p('While it is showing, the greeting above it changes with it: your name sits on the page rather than in a coloured band, with the gathering\'s photograph beside it. Whoever organises the gathering chooses that photograph, and the GENORRA tree stands in until they do — see [The Dashboard band](/help/gathering-management#premier).'),
            ],
          },
          {
            id: 'at-a-glance',
            heading: 'At a Glance',
            blocks: [
              p('The panel is about YOU and your standing with the family. Up to three figures across the top, and each appears only if it is genuinely yours to see:'),
              defs(
                { term: 'Family Members', text: 'How many approved people are in the family. People recorded on the tree without an account are counted — they are family. People still waiting to be approved are not.' },
                { term: 'Pending Approval', text: 'How many people are waiting. It appears only when somebody actually is, and only for whoever can act on it.' },
                { term: 'Upcoming Gatherings', text: 'How many gatherings have not finished yet. It appears only while at least one has not, and **View calendar** under it leads to [Calendar](/gatherings/calendar).' },
              ),
              p('Under the figures, in the same panel: **Remaining Balance** — what you still owe — and **Donation Drives**, the ones the family currently has open. Both have their own sections below.'),
              note('**Dues Collected** was a fourth figure here until 2026-08-19 and is now a card of its own further down the page. It is what the FAMILY has taken in rather than anything about you, which is a treasurer\'s figure read deliberately rather than glanced at. Who may see it did not change: it is still whoever may see the ledgers.'),
            ],
          },
          {
            id: 'quick-actions',
            heading: 'Quick Actions',
            blocks: [
              p('Shortcuts to the things people do most — add a member, record a payment, send a message. A button appears only if you may do the thing it names, so an empty Quick Actions panel is not a fault.'),
              p('**Two of the buttons are not about a permission at all.** They appear when there is something waiting on you and go away when there is not — everything else on the row is a job you MAY do, and these are ones you have been asked to.'),
              defs(
                { term: 'My Tasks', text: 'A gathering task is waiting on your answer. Leads straight to it. See My Gathering Tasks.' },
                { term: 'Nominate / Vote', text: 'An election you can take part in is open right now, and the caption says which of the two it wants. It leads to that ballot rather than to the list, and if two are open at once it offers the one closing soonest.' },
              ),
              p('An election appears here only while its nominations or its voting window is open. One that has not opened yet, or one waiting between the two windows, is on [Elections](/community/elections) and is not a job — so it is not offered as one. See [Elections](/help/elections#the-dates).'),
            ],
          },
          {
            id: 'recent-updates',
            heading: 'Recent Updates',
            blocks: [
              p('Your notifications and the family\'s announcements in one list. Pinned announcements ride at the top until you dismiss them; a dismissed one falls back into the list in date order rather than disappearing, so you can always find it again.'),
              p('Dismissing is per person, not per browser — do it on your laptop and your phone agrees.'),
              p('**View all updates** at the foot of the card opens [Updates](/community/updates): the same feed without the five-row limit, and with a search box. The card is the reminder; that page is the record.'),
            ],
          },
          {
            id: 'balance',
            heading: 'Remaining Balance',
            blocks: [
              p('Inside **At a Glance**, under the figures: what you personally still owe this year, across every dues schedule you are on. It is the same figure [Summary](/accounting/summary) leads with, and **View Dues** takes you to the schedule-by-schedule detail on [Dues](/accounting/dues-and-donations).'),
            ],
          },
          {
            id: 'donation-drives',
            heading: 'Donation Drives',
            blocks: [
              p('Also inside **At a Glance**, under the balance: every drive the family currently has open, with how far it has got toward its goal and how much of that came from you. Drives that have closed are not here — the bar cannot move any more — but they are still on [Donations](/accounting/dues-and-donations?pane=donations).'),
              p('The soonest to close comes first, and the panel names the count if there are more than three. It does not appear at all when no drive is open, which is most families most of the time.'),
            ],
          },
          {
            id: 'collected',
            heading: 'Collected this year',
            blocks: [
              p('What the family has taken in this year in dues and donations, with **View payments** through to the ledger. It was a figure inside **At a Glance** until 2026-08-19 and is a card of its own now: that panel is about the reader, and this is the organisation\'s income.'),
              p('It is shown only to somebody who may see the ledgers, and it is absent rather than blank for anybody else — an empty figure invites a member to wonder what they are missing. A family that has genuinely taken in nothing shows a zero, which is a different thing and a real answer.'),
            ],
          },
          {
            id: 'tree-card',
            heading: 'Family Tree',
            blocks: [
              p('How many people are on the tree, how many generations it reaches, and how many are not yet connected to anybody. It renders even when the tree is empty, because "nobody has started it" is the most useful thing it can say at that point.'),
            ],
          },
          {
            id: 'banners',
            heading: 'Banners',
            blocks: [
              p('Between the greeting and the panels, the dashboard sometimes puts something you need to do — most often a prompt to choose your chapter. Each disappears once it no longer applies, so the usual state is none at all.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'community',
    title: 'Community',
    blurb: 'Talking to the family, and keeping track of who everybody is.',
    chapters: [
      {
        // THE SLUG STAYS `journal` THROUGH ALL THREE RENAMES, deliberately. A slug is the
        // chapter's identity in `/help/<slug>` and AGENTS.md is explicit that it is not a route
        // and moves with nothing — sweeping bare keys across this file once renamed nine
        // chapters. The `route` below is the thing that had to move, three times in three days:
        // `/journal` became `/journals`, then `/journals/officer` when the rail item stopped
        // wearing its section's own word, then `/library/officer-notes` when the section itself
        // was renamed. `npm run help:check` asserts a chapter route is a real `FEATURES` href,
        // which is how the second of those was caught.
        slug: 'journal',
        title: 'Officer Notes',
        summary: 'A notebook for each office your family keeps, how a topic collects notes over time, and why it all stays with the office rather than with you.',
        route: '/library/officer-notes',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What this screen is',
            blocks: [
              p('Every office the family records — treasurer, secretary, events chair — has a notebook. It holds whatever the person doing the job needs written down: how the bank reconciliation actually works, which hall answers the phone, what went wrong last year.'),
              p('It is **Library > Officer Notes** in the rail, beside [Meeting Minutes](/library/meeting-minutes), [Documents](/library/documents) and [Bylaws](/library/bylaws) — the four things the family writes down and goes back to. A family that records offices for its chapters and regions as well as nationally will find all of them here.'),
              p('**The notes belong to the office, not to you.** That is the whole of it. When you hand the job on, everything you wrote is still there for whoever takes it, and everything the person before you wrote was there for you.'),
              p('**An entry is a topic, not a page.** It has a title and then a run of notes underneath it, oldest first, each one signed and dated. So "How the bank reconciliation works" is one entry that gets a paragraph added whenever there is something to add, rather than four entries with similar names — and the argument for why it is done that way is the whole thread, not the last version of it.'),
              note('If you hold no office, the screen says so and there is nothing to see. Nothing has gone wrong — officer notes are for officeholders, and offices are recorded under [Board positions](/help/board-positions).'),
            ],
          },
          {
            id: 'who-can-read-it',
            heading: 'Who can read it',
            blocks: [
              p('**Whoever holds the office today, and nobody else.** Not other officers, not the family\'s administrators, not the person who held it last year.'),
              p('That is unusual in this product and it is deliberate. These are working notes rather than a record the family keeps, and a notebook everybody could read is one people would keep somewhere else instead.'),
              p('If you hold more than one office, each has its own notebook and a strip along the top switches between them. Nothing from one appears in another.'),
              p('**Each one is named in full — the position and the place.** "National Treasurer", "Austin Chapter Chair", "Eastern Region Secretary": the same phrase the [Directory](/community/directory) and [Members](/admin/members) print for the same office, so you are never guessing which of two chapter offices a strip item means.'),
              p('**A notebook belongs to the POSITION rather than to the place**, and a scoped office says so on the screen: everyone holding "Chapter Chair" reads the same notes, whichever chapter they chair. If your family wants a chapter to have notes of its own, that is a separate office per chapter rather than one office held in several.'),
              p('If two of you hold the same office, you are both writing in the same notebook. Either of you can add a note to any entry in it, which is what makes an entry a conversation — but a note stays the property of whoever wrote it. See [changing something](#editing).'),
              note('A family can switch this screen off altogether under [Who can do what](/help/who-can-do-what), the same way as any other screen. What it cannot do is open one office\'s notebook to somebody who does not hold it.'),
            ],
          },
          {
            id: 'writing',
            heading: 'Starting an entry, and adding to it',
            blocks: [
              steps(
                'Press **New entry**.',
                'Give it a title — that is what the list shows.',
                'Write the first note if you have something to say now. You can leave it empty and come back to it.',
                'Press **Add entry**.',
              ),
              p('After that, **Add a note** on the entry is how it grows. Write as much or as little as you like; line breaks are kept, so a list stays a list. Notes appear in the order they were written, each with a name and a date, and one that has been changed since says so.'),
              p('Entries themselves are listed newest first, with who started each one and when.'),
              note('Anybody who holds the office can add a note to any entry, including one somebody else started. That is deliberate — it is how a successor answers a predecessor underneath what they wrote instead of starting a rival entry.'),
            ],
          },
          {
            id: 'meetings',
            heading: 'Meeting notes',
            blocks: [
              p('**Meeting notes** is the second button, and it makes an entry of a particular kind: one that records a day, who was in the room, and what was said.'),
              steps(
                'Press **Meeting notes**.',
                'Check the title and the **Day of the meeting** — both are filled in with today to start with.',
                'Under **Who attended**, search for each relative who was there and tick them. The names you have chosen stay listed above the search box, so a search that hides one does not lose it.',
                'Write what was discussed and decided in the notes box.',
                'Press **Add entry**.',
              ),
              p('A meeting shows up in the list marked **Meeting notes**, with the day it happened and everybody who attended. Anyone who holds the office can add a note to it afterwards, the same as any other entry — which is how a correction, or something remembered later, gets recorded.'),
              p('**Who attended can only be changed by whoever recorded the meeting.** An attendee list is one statement about one room and carries nobody\'s name against it, so it is not something two officers can quietly overwrite between them. If you were there and you were left off, add a note saying so — the record then shows both.'),
              note('**Voting on tasks is not built yet.** Every meeting entry carries a panel saying so. When it exists, it will turn what a meeting decided into tasks and let the people who attended vote on them; until then, write what was agreed in a note.'),
            ],
          },
          {
            id: 'editing',
            heading: 'Changing or removing something',
            blocks: [
              p('There are two rules, and which one applies depends on what you are changing.'),
              defs(
                {
                  term: 'A note',
                  text: 'Only the person who wrote it can edit or delete it — any note of theirs, wherever it sits in the thread, not just the most recent one. The pencil and the bin appear beside the notes that are yours and on no others.',
                },
                {
                  term: 'The entry itself',
                  text: 'Its title, a meeting\'s day, and who attended belong to whoever started it. Everybody else adds notes.',
                },
              ),
              p('Either way it only lasts while you still hold the office. A former officer keeps neither — and everything they wrote stays, which is the point.'),
              p('So a note left by the person before you is yours to read and not to rewrite. If it is wrong or out of date, add a note saying so — that keeps both the original and the correction, which is what makes the notebook worth reading years later.'),
              p('Deleting a note leaves the rest of the entry alone. Deleting an **entry** takes every note under it, for everybody who holds the office, now and later. Both are permanent and the screen asks you to confirm.'),
              note('If an office is retired from the family\'s board positions, its notebook goes with it. There is no office left for the notes to follow.'),
            ],
          },
        ],
      },
      {
        slug: 'chat',
        title: 'Chat',
        summary: 'The family room, private messages, and group threads you create yourself.',
        route: '/community/chat',
        sections: [
          {
            id: 'rooms',
            heading: 'The three kinds of room',
            blocks: [
              defs(
                { term: 'Family', text: 'One room, everybody in it, created for you. It cannot be left or deleted.' },
                { term: 'Direct Messages', text: 'A private thread between you and one other member.' },
                { term: 'Group Messages', text: 'A named thread with the people you choose — a planning committee, the cousins organising a gift.' },
              ),
              p('Messages arrive live. A dot beside a room means there is something in it you have not read; opening the room clears it.'),
            ],
          },
          {
            id: 'dm',
            heading: 'Starting a private message',
            blocks: [
              steps(
                'Press **New DM** at the top of the room list.',
                'Pick the person.',
                'Type and send. Enter sends, Shift+Enter starts a new line.',
              ),
              p('Only members with an account appear in the list. Somebody recorded on the family tree with no email address has nothing to receive a message at — see [Records and accounts](/help/family-tree#records).'),
            ],
          },
          {
            id: 'group',
            heading: 'Starting a group',
            blocks: [
              steps(
                'Press **New** beside the **Group Messages** heading.',
                'Name it — the name is what everybody else will see in their list.',
                'Tick the people to include, and press **Create Group**.',
              ),
              p('Whoever creates a group can add and remove members afterwards, from the control at the top right of the thread.'),
            ],
          },
          {
            id: 'deleting',
            heading: 'Removing a conversation',
            blocks: [
              p('A direct message thread can be deleted from your list. The family room cannot — it is the one place the whole family can always be reached.'),
            ],
          },
        ],
      },
      {
        slug: 'announcements',
        title: 'Announcements',
        summary: 'Family news, the archive of everything sent, what pinning actually does, and whose birthday is coming up.',
        route: '/community/announcements',
        sections: [
          {
            id: 'reading',
            heading: 'The board',
            blocks: [
              p('[Announcements](/community/announcements) is three panes. **General** is the board and is what the screen opens on; **Updates** is the archive of everything the family has announced and everything sent to you, covered in [Updates](/help/updates#what-it-is); **Birthdays** is who to write to next, and it is the last section of this chapter.'),
              p('The board is a stack of posts, newest first, each showing who wrote it and when. Pinned posts are marked and also ride at the top of everybody\'s Recent Updates on the dashboard.'),
              p('The three panes are granted separately, so a family can hand out the birthday list without handing out the board, or the other way round. A pane that is not there is one you have not been given — see [Who can do what](/help/who-can-do-what#missing).'),
            ],
          },
          {
            id: 'posting',
            heading: 'Posting',
            blocks: [
              steps(
                'Open the composer at the top of the board.',
                'Give it a title and a message.',
                'Choose the audience — **Entire Family**, **Region**, or a single **Chapter**.',
                'Post.',
              ),
              p('The chapter and region options only mean anything once your family has set chapters up. If it has not, everything is family-wide.'),
              p('**Everybody it is addressed to gets a bell notification**, and the board updates for anybody with it already open — no reload. A chapter post rings the bell of that chapter only, so the bell and the board never disagree about who a notice is for. You are not notified about your own post.'),
            ],
          },
          {
            id: 'pinning',
            heading: 'Pinning',
            blocks: [
              p('**There is one pin, and it belongs to the family.** Beside it, on a post the family has pinned, every member gets an eye — which hides that post from the top of their own updates and changes nothing anybody else sees. Two glyphs, because they are two different acts.'),
              defs(
                { term: 'Pin for everyone (a pin)', text: 'Puts the post at the top of every member\'s updates. A family-wide act, and a separate permission from posting — a family can let everybody post and let one person pin. It can be given an expiry, which is the right way to pin "the reunion is in three weeks": it takes itself down. The pin is filled in and accent-coloured while it is on.' },
                { term: 'Hide this from the top of my updates (an eye)', text: 'Your own copy, and every member has it. It appears only on a post the family has pinned — there is nothing to hide from the top of your updates until the family has put something there.' },
              ),
              note('If you can do both, be careful which you press: unpinning for everyone takes the post off the top of the whole family\'s updates, while the eye changes nothing anybody else sees.'),
            ],
          },
          {
            id: 'dismissing',
            heading: 'Hiding a pinned post from your own updates',
            blocks: [
              p('Pressing the eye removes it from the top of *your* updates only. It stays pinned for everybody else, and it stays on this board — the board is the record, the dashboard is the reminder.'),
              p('It does not hide the post. It drops out of the pinned block and back into the list in date order, so you can always find it again — and the post says so underneath either way: **Pinned for the family — it rides at the top of your updates**, or **Pinned for the family — you have hidden it from the top of your updates.**'),
              p('**Both screens agree.** Dismiss it here or on the dashboard and the other one follows, because both read the same answer — the family\'s pin narrowed by your own dismissal. That was not true before 2026-08-21: this board showed the family\'s pin and the dashboard showed yours, so a post you had dismissed stayed at the top of one and not the other.'),
            ],
          },
          {
            id: 'deleting',
            heading: 'Deleting',
            blocks: [
              p('Deleting removes the post for everybody. Depending on what your family has granted, you may be able to delete only your own posts, anybody\'s, or none.'),
            ],
          },
          {
            id: 'birthdays',
            heading: 'Birthdays',
            blocks: [
              p('The **Birthdays** pane is every relative with a birthday in the next 60 days, soonest first. It is a list to act on rather than a record: **nothing is sent automatically**, and writing the greeting is still somebody\'s job — which is why it sits one click from the composer.'),
              defs(
                { term: 'Name', text: 'Who it is. **Search by name** narrows the list, ignoring accents and punctuation the way the Directory does — typing "jose" finds José.' },
                { term: 'Date', text: 'The day it falls on this time round.' },
                { term: 'Day', text: 'The day of the week. It is there because a card gets posted and a call gets made against a weekend rather than against the 14th.' },
                { term: 'Countdown', text: '**Today**, **Tomorrow**, or how many days away. Today is marked, because it is the one row the list exists to catch and as plain text it reads like any other.' },
                { term: 'Turning', text: 'The age they reach on it.' },
              ),
              p('Everybody the family has approved is on it whether or not they have an account, so a great-uncle recorded on the [family tree](/community/family-tree) has a birthday like anybody else. Somebody recorded as having died is not on it, and neither is anybody whose profile has no date of birth — a birthday nobody has told the product about is not one it will guess at. The line under the table says how many rows there are, and how many of them a search is hiding.'),
              note('An age is left out — an em-dash, and a line under the table saying so — where the year on file is one the product will not trust, which today means a year that has not happened yet: 1962 typed as 2062. The day and the month still show, because a four-digit slip is a slip in the year. Correct **Date of Birth** on that person\'s [profile](/personal-info) and the age appears.'),
              p('Somebody born on 29 February is listed on 28 February in a year with no leap day, so they never drop off the list for three years at a stretch. The age still counts in whole years, so it does not skip one.'),
              p('Nothing on this pane can be edited and nothing about it is stored. Every date is read from **Date of Birth** on the person\'s own profile each time the pane is opened, so that is the one place to correct one.'),
            ],
          },
        ],
      },
      {
        slug: 'updates',
        title: 'Updates',
        summary: 'The archive of everything the family has announced and everything sent to you, and how the search works.',
        route: '/community/updates',
        sections: [
          {
            id: 'what-it-is',
            heading: 'One list, two kinds of thing',
            blocks: [
              p('Updates is the **Updates** pane of [Announcements](/community/announcements), and the long version of the **Recent Updates** card on your [Dashboard](/dashboard). That card shows the newest few; this shows all of them, newest first, and lets you search.'),
              p('It had a menu row of its own until 2026-08-19 and no longer does — the family\'s news lives on one screen. The old address still works and lands on the pane, so a link anybody has sent still opens the right list.'),
              p('Two kinds of row appear:'),
              defs(
                { term: 'Announcement', text: 'Family news somebody posted on the board. Opening it goes to [Announcements](/community/announcements), which carries the full text — except for a notice about an election, which goes to the election itself, because you have already read the whole of it in the row.' },
                { term: 'Sent to you', text: 'Something addressed to you personally — a task, an approval, a message waiting. These are the same rows as the bell in the top bar.' },
              ),
              p('Nothing here is anybody else\'s mail. The "sent to you" rows are yours alone, and they are the same list the bell shows.'),
              note('Opening a row does not mark it read. The bell owns that, so the number on it and this page can never disagree.'),
            ],
          },
          {
            id: 'searching',
            heading: 'Searching',
            blocks: [
              p('The one box searches the title and the body of both kinds of row, and it searches in the database rather than on the page — so it reaches everything, however far back.'),
              bullets(
                'Words can be in any order. Searching **hotel block** finds "the block at the hotel".',
                'Endings are handled: **rooms** finds "room", **booking** finds "booked", and **payment** finds "payments".',
                'Irregular words are not — **paying** does not find "paid". Search for the word as it would have been written.',
                'Put a **-** in front of a word to leave rows containing it out — **reunion -cancelled**.',
                'Part of a word does not match: **reunio** finds nothing. Type the whole word.',
              ),
              p('Accents are matched exactly here, unlike the name searches elsewhere in the product — searching "jose" will not find "José" on this page.'),
              note('A search is a link. The address bar carries what you searched for, so you can send it to somebody or use the back button to step through several.'),
            ],
          },
          {
            id: 'older',
            heading: 'Going further back',
            blocks: [
              p('**Show 25 older** adds another page to the bottom of the list, and keeps going until there is nothing older. Scrolling back does eventually stop, and the page says so when it does — at that point the search is what reaches the rest, because it looks at every row rather than only the ones on screen.'),
              p('The count under the list always says how many rows you are looking at, so a short list is never a list that quietly stopped.'),
            ],
          },
          {
            id: 'missing',
            heading: 'If announcements are not in your list',
            blocks: [
              p('The page will say so, above the list. Announcements are the family\'s board and are granted separately from your own messages, so a member who has not been given the board sees only what has been sent to them — see [Who can do what](/help/who-can-do-what#missing).'),
              p('This pane can be switched off entirely too, in which case Announcements opens without it. Your own messages are still in the bell, and the board is still the **General** pane; this one is the two together.'),
            ],
          },
        ],
      },
      {
        slug: 'distributions',
        title: 'Distributions',
        summary: 'Emailing everyone in the family at once, with no list to keep up to date.',
        route: '/community/distributions',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it is',
            blocks: [
              p('A distribution is one email sent to everybody in the family, or to everybody in one region or chapter. You write a subject and a message, choose who it goes to, and press send.'),
              p('The difference between this and [Announcements](/community/announcements) is where the message lands. An announcement waits on everybody\'s dashboard until they look; a distribution arrives in their inbox. Use an announcement for family news, and a distribution for something that has to be read this week.'),
              p('There is no list to build and nothing to keep up to date. The people who get it are read from your membership each time you send, so a relative who joined yesterday is on it and one who was never in the family never is.'),
              note('There is no draft. A distribution goes out as soon as you send it, and it cannot be unsent — so read it through before you press the button.'),
            ],
          },
          {
            id: 'who-gets-it',
            heading: 'Choosing who gets it',
            blocks: [
              p('The **Who it goes to** list offers everyone in the family, then each of your regions, then each of your chapters. Every option carries the number of relatives it reaches, so you can check the audience against what you meant before anything is sent.'),
              p('A region reaches the relatives in that region\'s chapters, and nobody else. This is not the same as a regional announcement, which everybody sees — mail cannot be taken back, so an audience here means exactly what it says.'),
              bullets(
                'A relative who is not in any chapter is not in any region, so a regional distribution does not reach them. They are still reached by "Everyone in the family".',
                'Only approved members are ever emailed. Somebody still waiting to be admitted is not on any distribution.',
                'Nobody gets two copies. Where a couple share an email address, the message goes once, and the second relative is listed as sharing an address.',
              ),
              p('The line under the picker says how many will actually be emailed, which can be fewer than the number in brackets — see below.'),
            ],
          },
          {
            id: 'no-email-address',
            heading: 'Relatives with no email address',
            blocks: [
              p('Somebody recorded on the [Family Tree](/community/family-tree) who has never had an account has no email address of their own. GENORRA gives them a stand-in address so the record works, and that address goes nowhere.'),
              p('Those relatives are counted in the audience and are never emailed. Both the picker and the delivery report say how many there are, using the words **No email address on file** — which is not a delivery failure and is nothing to chase. If you want them included, invite them from the family tree, or pass the message on yourself.'),
            ],
          },
          {
            id: 'sending',
            heading: 'While it is going out',
            blocks: [
              p('A distribution to a large family is sent in batches, so the screen shows how far it has got — **Sending — 24 of 118 delivered**. It carries on while the page is open.'),
              p('You can leave the page. The send picks up from where it got to, and the list shows what is still outstanding when you come back. Nothing is sent twice, however many times the page is reopened.'),
              p('**Stop** ends a send that is under way. Everything already emailed has gone and cannot be recalled; the rest is not sent, and the report says **Stopped** with both numbers. Anybody who may send may stop a send, including somebody else\'s.'),
            ],
          },
          {
            id: 'what-happened',
            heading: 'What happened to each message',
            blocks: [
              p('Pressing the subject opens the message that was sent and the list of everyone it went to, with one line each:'),
              defs(
                { term: 'Sent', text: 'The message was handed to the mail provider for that address.' },
                { term: 'Could not be delivered', text: 'Something went wrong. **Try again** puts these back in the queue and has another go — a temporary problem usually clears.' },
                { term: 'No email address on file', text: 'A relative on the family tree with no address. Nothing went wrong and there is nothing to retry.' },
                { term: 'Shares an address', text: 'Another relative has the same email address and got the message.' },
                { term: 'Not sent — stopped', text: 'The send was stopped before reaching them.' },
              ),
              p('The screen never says a message was sent when it was not. If the report says "8 sent, 2 could not be delivered", that is what happened — so it is worth looking after sending something that matters.'),
              note('"Sent" means the message left GENORRA. It cannot tell you whether somebody opened it, or whether their mail provider filed it as junk.'),
            ],
          },
          {
            id: 'replies',
            heading: 'Replies, and what the message looks like',
            blocks: [
              p('The message arrives from GENORRA, with your name on it, and a reply goes to **your own email address** rather than to us. So a relative answering a distribution is writing to you, which is almost always what they mean to do.'),
              p('The message is plain text. Leave a blank line between paragraphs and they arrive as paragraphs; there is no formatting, no attachments and no links added for you. To share a document, put it in [Documents](/library/documents) and say where it is.'),
              p('Every message says at the bottom which family it came from and who sent it, so nobody has to guess. There is no unsubscribe link — this is your family writing to its own members, not a mailing list.'),
            ],
          },
          {
            id: 'who-can',
            heading: 'Who can use it',
            blocks: [
              p('Distributions is switched off for everybody until an administrator grants it, and it is granted separately from Announcements — being able to post on the board does not let somebody email the whole family. See [Who can do what](/help/who-can-do-what).'),
              p('There are three separate permissions. **View** shows the record of what has been sent. **Create** is what lets somebody write and send one, and stop a send. **Delete** removes the record of a distribution, which is a stronger thing to be able to do — it is the only copy of who was emailed and what happened to each message.'),
              p('Deleting the record does not unsend anything. A send that has not finished has to be stopped first.'),
            ],
          },
        ],
      },
      {
        slug: 'safety-check-ins',
        title: 'Safety Check-Ins',
        summary: 'Asking the relatives in one area whether they are safe, and seeing who has answered.',
        route: '/community/safety-check-ins',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it is',
            blocks: [
              p('A storm, a fire, a flood. Somebody raises a check-in addressed to the relatives who may be affected, and every one of them is asked a single question — are you safe? They answer with one tap, and whoever raised it watches the answers come in.'),
              p('The point of the screen is the people who have **not** answered. Everything else on it exists to make that list shorter.'),
              note('Nothing on this screen watches the weather. GENORRA does not know what is happening near your relatives and never claims to — a check-in is one person asking, in their own words, and it says who asked.'),
            ],
          },
          {
            id: 'raising',
            heading: 'Raising one',
            blocks: [
              p('Press **Raise a check-in**. You need three things, and only the first two are required.'),
              steps(
                'Say what is happening — "Hurricane Delia". This becomes the subject of the email your relatives get, so make it something they will recognise in a crowded inbox.',
                'Add anything else worth telling them: where to go, who to call, what you know. Optional.',
                'Choose who to ask.',
              ),
              p('Then press **Ask them**. There is no confirmation step — the box above the button already says exactly how many relatives this reaches, which is the thing worth checking.'),
            ],
          },
          {
            id: 'who-to-ask',
            heading: 'Choosing who to ask',
            blocks: [
              p('Four kinds of audience, and every one of them shows how many relatives it reaches before you send.'),
              defs(
                { term: 'Everyone in the family', text: 'Every approved member.' },
                { term: 'A region', text: 'Everybody in the chapters that make up that region.' },
                { term: 'A chapter', text: 'Everybody recorded as being in that chapter.' },
                { term: 'Just the relatives I name', text: 'A list you pick by hand, with a search box. This is the one to use when the family\'s own chapters do not match where the trouble actually is.' },
              ),
              note('A relative who has not told the family which chapter they are in is not in any region either, so a regional check-in does not reach them. That is deliberate — the product does not guess where somebody lives. Use **Just the relatives I name** to include them.'),
              p('A chapter is how your family organised itself. A storm does not follow it, and the relative who moved last year is the one an organised audience quietly leaves out — so the hand-picked list is there for exactly that person.'),
            ],
          },
          {
            id: 'answering',
            heading: 'Answering one',
            blocks: [
              p('If your family is asking about you, it is the first thing on your [Dashboard](/dashboard) and the first thing on this screen. Two buttons: **I am safe** and **I need help**. Either one is recorded straight away — there is nothing to confirm and nothing to type.'),
              p('Afterwards you can add a note — where you are, what you need — and you can change your answer as many times as you like while the check-in is open. Saying you need help and then saying you are safe is exactly what this is for.'),
              note('Answering needs no permission at all, and no plan. Even if your family has switched this screen off for you — or has moved to a plan that no longer includes it — the ask still appears on your Dashboard and you can still answer it.'),
            ],
          },
          {
            id: 'the-roster',
            heading: 'Reading the answers',
            blocks: [
              p('**See who was asked** opens the roster. Everybody is in one of four states, and the list is ordered by which of them needs attention first.'),
              defs(
                { term: 'Needs help', text: 'They have said so. Always at the top.' },
                { term: 'Not reached', text: 'Either they have no email address on file, or the email did not go through. These need a person, not another attempt.' },
                { term: 'Waiting', text: 'They were asked and have not answered yet. This is the number to drive to zero.' },
                { term: 'Safe', text: 'They have said so.' },
              ),
              p('**Not reached** and **Waiting** are deliberately different. Somebody who was asked and has said nothing may simply be busy; somebody with no email address on file was never asked at all, and no amount of waiting will change that. The screen says which is which, and how many.'),
              p('Where an email genuinely failed — a real address that bounced — **Try the failed ones again** re-sends to just those. It does not touch the relatives who have no address, because there is nothing to send to.'),
            ],
          },
          {
            id: 'reaching-people',
            heading: 'What this can and cannot promise',
            blocks: [
              p('Be clear about this one, because it matters more here than anywhere else in the product: **a check-in is an email and a notification, and neither is a guarantee.**'),
              bullets(
                'The email goes to the address on each relative\'s profile. If that address is wrong, out of date, or a placeholder the family generated, they are not asked — and the screen says so rather than counting them as silent.',
                'The notification only reaches somebody who has the product open.',
                'Nothing here sends a text message or rings a phone.',
              ),
              p('So the screen never says everybody has been asked. It says how many were asked, how many could not be, and why — and the relatives nobody could reach are named as a job for a person to do.'),
            ],
          },
          {
            id: 'closing',
            heading: 'Closing one',
            blocks: [
              p('**Close check-in** stands the family down. It stops any further asks going out and takes the banner off everybody\'s Dashboard.'),
              p('Closing destroys nothing. Every answer, and every relative nobody could reach, stays on the record exactly as it was — a closed check-in is still the account of what the family asked and what came back.'),
              p('**Delete** does destroy it, and it is a separate permission for that reason. There is no other copy of who answered.'),
            ],
          },
          {
            id: 'who-can',
            heading: 'Who can do what',
            blocks: [
              p('Raising a check-in wakes a lot of people at once, so it is granted rather than assumed. There are three separate permissions.'),
              defs(
                { term: 'View', text: 'Read the check-ins and, at the widest setting, the full roster of who answered.' },
                { term: 'Create', text: 'Raise a check-in, ask the rest of a queue, and close one. Whoever can raise the alarm can also sound the all-clear.' },
                { term: 'Delete', text: 'Remove the record entirely. Stronger than the other two, because it destroys the only account of who was never reached.' },
              ),
              p('By default an ordinary member can open this screen, see the check-ins they raised, and answer anything they were asked about — but not the roster of who else has answered. That list is a set of relatives with their whereabouts and their reachability beside it, and it stays with the people the family has given it to. See [Who can do what](/help/who-can-do-what).'),
            ],
          },
        ],
      },
      {
        slug: 'directory',
        title: 'Directory',
        summary: 'Everyone in the family, searchable, with how to reach them.',
        route: '/community/directory',
        sections: [
          {
            id: 'searching',
            heading: 'Finding somebody',
            blocks: [
              p('The filter box matches first name, last name and preferred name, and it ignores accents and punctuation — typing **jose** finds José, and **oconnor** finds O\'Connor.'),
            ],
          },
          {
            id: 'columns',
            heading: 'What the list shows',
            blocks: [
              p('Four columns: **Name**, **Position**, **Chapter**, and the **Group** the person is on — which is the permission template deciding what they can do. **Position** is the board office they hold, written out in full — "National Treasurer", "Austin Chapter Chair" — and an em-dash for the most of the family who hold none. Which chapter somebody is in is on the row; which REGION that chapter belongs to is on their detail dialog, because the region follows from the chapter rather than being a separate answer.'),
              p('Everything else about a person is behind their name. **Pressing a name opens their record** — phone, email, city and state, their chapter and region, their preferred name, their group, and whether they have an account yet. The name is a real button, so tabbing to it and pressing Enter opens the same panel a click does.'),
              p('Phone, email and city each had a column of their own until 2026-08-19 and are in that panel now. Nothing was dropped and nothing new is shown: the same facts, one press away instead of five columns wide, which is what makes the list readable on a phone.'),
              p('On a narrow screen Position, Chapter and Group fold underneath the name rather than sliding off the side, so nothing is ever parked out of view.'),
              p('People recorded on the family tree without an email address appear here too. A recorded great-uncle is a member of the family; he simply has no account, and his record says so.'),
            ],
          },
          {
            id: 'tree',
            heading: 'From a name to the tree',
            blocks: [
              p('The **Family Tree** button takes you to the tree, where you can centre on anybody and see how they connect. It is the same question from the other side: the Directory answers *who*, the tree answers *how are they related*.'),
            ],
          },
        ],
      },
      {
        slug: 'family-tree',
        title: 'Family Tree',
        summary: 'One tree for the whole family — how to read it, add to it, and correct it.',
        route: '/community/family-tree',
        sections: [
          {
            id: 'how-it-reads',
            heading: 'How the canvas reads',
            blocks: [
              p('The tree draws the generations around one person, oldest at the top: their ancestors, then that person and their spouse, then their descendants. Each band is labelled — **Grandparents**, **Children**, **Great-grandchildren** — and past great- it counts, so five generations down reads **3rd great-grandchildren** rather than a row of "great"s nobody can total. Brothers and sisters are listed underneath rather than drawn in the row, because they share the focus person\'s generation and would crowd it out.'),
              p('**How deep it goes depends on the mode.** Reading, you get three generations above and five below. Editing narrows it to two above and one below — the generations either side of the person you are working on — because every extra band is another row of **+** cards for relatives you are not currently adding.'),
              p('A generation with a great many people in it stops at twenty-four cards and says how many are left. Nobody is lost: **Everyone in this family**, under the canvas, lists the whole roster and every name re-centres the tree.'),
              p('It opens on you. If you married in and have no parents or children recorded, it opens on the relative you are attached to instead and says so, with a **Centre on me** link.'),
              p('Where somebody has more than one marriage, each spouse card carries the word for it — **Wife**, **Ex-wife**, **Partner** — and the children below are split into a panel per marriage, plus **Other children** for anybody whose other parent is not one of them. The split comes from the parent connections the children already carry; nothing is guessed at.'),
            ],
          },
          {
            id: 'moving',
            heading: 'Moving around',
            blocks: [
              p('Click anybody to re-centre the tree on them. Their grandparents, parents, spouse and children are then drawn around them, and you carry on from there.'),
              p('Underneath the canvas, **Everyone in this family** lists the whole roster. Every name centres the tree, so nobody is ever more than one click away. **Not on the tree yet** is a different list — it is the people connected to nobody, which is work still to do.'),
            ],
          },
          {
            id: 'view-vs-edit',
            heading: 'View and Edit',
            blocks: [
              p('The tree opens in **View**. Switching to **Edit** turns on the **+** buttons, the record editor and the remove controls. Every member starts able to edit, because building the family\'s tree is something the family does together — but it is a permission like any other now, so your administrators can narrow it from [Members](/admin/members). If the **Edit** switch is not there, that is why.'),
              p('Clicking a card opens the panel where that person\'s record and their connections are managed. **That panel follows your Directory permission, not the tree\'s** — a family that has restricted the [Member Directory](/community/directory) has said the roster is not for everybody, and the panel is where a record is read one person at a time. The canvas itself still draws every name and shows how everybody connects.'),
              p('**Edit** also changes how much of the tree is drawn, and that is deliberate. **View** reads three generations up and five down, so you can see a long line from one card. **Edit** shows two up and one down — every gap that belongs to the person in the middle, and no more, because each extra band is another row of **+** buttons for relatives you are not placing. The canvas getting shorter when you press **Edit** is that, not something going wrong.'),
              note('Nothing on the tree removes anybody from the family. Removing a connection removes the *link* between two people, not either person.'),
            ],
          },
          {
            id: 'adding',
            heading: 'Adding a relative',
            blocks: [
              steps(
                'Switch to **Edit** and centre on the person you are adding *to*.',
                'Press the **+** for the relationship — **Father**, **Mother**, **Husband**, **Wife**, **Partner**, **Son**, **Daughter**, **Brother** or **Sister**.',
                'Give their name.',
                'Say whether they have an email address.',
              ),
              p('If they do, they get a real invitation and join the approvals queue when they accept. If they do not, you are asked for a short reason in your own words — "passed away in 1998", "too young for an account", "phone only" — and the record is created without one.'),
              p('**Adding a child with no email asks for their date of birth, and will not go through without it.** A family can set an age at which its dues start, and a record with no birthday is treated as an adult everywhere in the product — so a child entered without one would be billed from the day you added them. Every other relative may be recorded with a birthday or without.'),
              p('Grandparents have their own **+** cards in the top row, one pair per parent, named for whose they are — **Add Martha\'s father**. They hang off a parent rather than off the person in the middle, because a grandparent is somebody\'s mother or father and the tree has no other way to say which side they are on. Record a parent first and the slots appear.'),
              p('**A marriage cannot currently be marked as former.** The control for renaming a connection — **Husband** to **Ex-husband** — was in a section of the manage dialog that has been removed, and there is not yet another place to do it. A spouse is recorded as **Husband**, **Wife** or **Partner** and stays that way. An ex, once this returns, is drawn beside the person exactly where a current spouse is, deliberately — it is often where half the children came from.'),
              p('Every connection is recorded from both ends, so adding your mother also gives her you as a child. Each person can carry more than one marriage; the **+** for a spouse stays available after the first.'),
            ],
          },
          {
            id: 'records',
            heading: 'Records and accounts',
            blocks: [
              p('There is only one kind of person on the tree. Some have an account and some do not, and that is the whole difference.'),
              defs(
                { term: 'Record only', text: 'Somebody entered by a relative, with no email address. A grandmother, a child, a great-uncle who died in 1998. Any approved member may correct their details.' },
                { term: 'Invited', text: 'Invited but not yet admitted — they are in the approvals queue.' },
                { term: 'A member', text: 'Has an account. Only they can change their own name and contact details, from [My Profile](/personal-info).' },
              ),
              p('A record stops being a record the day somebody invites them, which is the **Invite** control on the record editor. There is no separate "convert to adult" step — a child who gets an email address is simply invited like anybody else.'),
            ],
          },
          {
            id: 'blood',
            heading: 'Who is in the bloodline',
            blocks: [
              p('One tick per person: **is in the family’s bloodline**, or is not. It is on the PERSON rather than on any of their connections, and it is something your family states rather than something the product works out.'),
              p('Tick it for a blood relative. Leave it clear for somebody who married in, and for a step, adopted or foster relative. The dialog asks as you add a new relative; afterwards, open anybody’s card and tick it there. **Nothing in that dialog takes effect until you press Save** — the tick, and a record’s name and birthday if it has no account of its own, are saved together by the one button at its foot, and **Cancel** closes it and throws away anything you have changed.'),
              note('It decides two things, and the second is money: who appears under **Bloodline** on the tree, and who owes a due set to **Bloodline only**. If a relative you expect to owe a bloodline due does not, this is the first thing to check.'),
              p('**Nobody is ticked to start with.** That is deliberate rather than an oversight: a due restricted to the bloodline is owed by the people ticked, so an untouched family bills nobody rather than billing a relative who married in.'),
              p('**It used to be four words on the connection** — blood, step, adopted or foster — and the bloodline was worked out by walking those connections up from one named ancestor. That is gone. The walk was right about the graph and kept being wrong about the family: a family started by a son reached up through his mother, so his father’s former wife came back as blood, and the only lever anybody had was to mark a real mother as a step-mother — which made the tree wrong about her and about every relative of hers added afterwards.'),
              note('One thing genuinely went with it: the tree no longer prints **Step-son** or **Adopted daughter** on a card. A connection is a relationship and a name; how somebody came into the family is not printed on their face.'),
            ],
          },
          {
            id: 'bloodline',
            heading: 'The Bloodline toggle',
            blocks: [
              p('**Full family** shows everybody. **Bloodline** shows only the people ticked as being in the family’s bloodline, hiding everybody else.'),
              p('It is one answer for the whole family, not one per viewer — two members cannot disagree about who is in the family’s bloodline. Anybody who can edit the tree can change a tick, and it changes what every member sees.'),
              note('The toggle only appears once your family has ticked SOME of its relatives and not all of them. With nobody ticked it would hide the whole family, and with everybody ticked it would do nothing — so it is not offered in either case.'),
              p('An unticked relative is HIDDEN by the toggle rather than missing from the tree. Switch back to **Full family** and they are there; the tick decides what this one view shows, and nothing else about their record.'),
              p('**A relative who should be in it and is not has simply not been ticked yet.** Open their card and tick it. There is nothing to work out and nothing else that can be wrong — which was not true of the setting this replaced, where somebody appearing wrongly as blood was a problem with the ancestor the walk started from rather than with any connection you could see.'),
              note('A due set to **Bloodline only** is owed by exactly the people ticked here, so this screen and that figure cannot disagree.'),
            ],
          },
          {
            id: 'fixing',
            heading: 'Correcting a mistake',
            blocks: [
              bullets(
                'Wrong relationship — remove the connection and draw it again. A marriage cannot be renamed at the moment; see above. Whether somebody is in the bloodline is a tick in the manage dialog on their own card.',
                'Wrong details on a record — the edit control on the card. It is offered only for people with no account of their own; a member owns their own name and changes it on [My Profile](/personal-info).',
                'Connected to the wrong person — remove the connection. Both people stay in the family.',
              ),
            ],
          },
        ],
      },
      {
        slug: 'elections',
        title: 'Elections',
        summary: 'How an election runs on its own dates, who is entitled to take part, and how to nominate, accept and vote.',
        route: '/community/elections',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What this screen is',
            blocks: [
              p('Every election your part of the family is holding. **Active** is anything not yet finished — one that has not opened, one taking nominations, one waiting for its ballot to open, and one being voted in. **Past** is the ones that have closed.'),
              p('Elections that have not been published yet are not listed. An organizer writes an election as a draft first, and a draft is not a ballot.'),
              p('Open one to see its positions, its two date windows, and whatever you can do in it today.'),
            ],
          },
          {
            id: 'the-dates',
            heading: 'The dates run it',
            blocks: [
              p('An election has two windows, and nobody presses anything to move it between them.'),
              defs(
                { term: 'Nominations', text: 'From the day they open to the day they close. Put yourself forward, or put somebody else forward.' },
                { term: 'Voting', text: 'From the day it opens to the day it closes. Cast a vote, or change one.' },
              ),
              p('**Both ends count.** An election whose nominations read "January 1st – January 5th" is open on the 5th, right up to the end of the day. The same is true of voting — with one exception, below.'),
              p('Voting never opens before nominations close, so the list of candidates you are voting on cannot change under you. There is often a gap in between, and the screen says what it is waiting for.'),
              p('**Voting may open on the same day nominations close, and then that day belongs to voting.** Nominations run through their closing date, or until voting opens, whichever comes first — so on a shared day the nomination form is already shut and the ballot is live. If your family wants the whole of that day for nominations, the closing date goes one day earlier.'),
              note('Nothing here happens at a time of day. A window opens on its date and closes at the end of its closing date, and the screen shows the same dates to everybody.'),
              p('**"The end of the day" means the end of the day where your family is.** An election records the timezone it was scheduled in, and both the dates on screen and the moment the ballot actually shuts are read in that one timezone — so a relative in another part of the world sees the same closing date as everybody else, and the ballot stays open until your family\'s midnight rather than somebody else\'s.'),
            ],
          },
          {
            id: 'who-votes',
            heading: 'Who an election is for',
            blocks: [
              p('An election belongs to one level of the family, and the screen names it under the title.'),
              defs(
                { term: 'National', text: 'The whole family. Everybody can see it, be nominated, and vote.' },
                { term: 'A region', text: 'Only members whose chapter is in that region.' },
                { term: 'A chapter', text: 'Only members of that chapter.' },
              ),
              p('The levels do not mix. A chapter election is invisible to the rest of the family — it is not listed, and its link does not open — and it can only fill offices the family records at chapter level. See [Regions & chapters](/help/regions-and-chapters) for how the family is divided up, and [Board positions](/help/board-positions) for the offices themselves.'),
              p('**If you are not in a chapter, you are under National.** You see national elections and take part in them, and regional and chapter elections are not yours. Your chapter is on [My Profile](/personal-info) — an administrator can also set it for you.'),
            ],
          },
          {
            id: 'nominating',
            heading: 'Nominating somebody',
            blocks: [
              p('While nominations are open, the election lists every office on the ballot, and under each one the people who have been nominated for it. Any member may nominate.'),
              steps(
                'Find the office you want to nominate for and press **Nominate** beside it.',
                'To stand yourself, press **Put myself forward**. You are on the ballot straight away — nobody has to accept their own nomination.',
                'To put somebody else forward, find them in **Who are you nominating?** and press **Nominate**.',
              ),
              p('The name box searches any part of any name, so typing "allen" finds Martha Allen. It lists only the people this election is for, which is why a chapter election offers fewer names than the family has.'),
              p('**Several members can nominate the same person for the same office.** They appear once on the list, and it says how many people put them forward — "nominated by you and 2 others". A second nomination is not a duplicate; it is another member saying they want them.'),
              p('One person can be nominated once per office by you, and can be nominated for as many offices as you like.'),
            ],
          },
          {
            id: 'withdrawing',
            heading: 'Taking a nomination back',
            blocks: [
              p('A nomination you made shows **Take my name off** beside it, and one you made for yourself shows **Withdraw**. Either way you are only ever removing your own name.'),
              p('**If other members nominated the same person, they stay on the ballot.** Only your name comes off, and the count beside them goes down by one. If you were the only person who nominated them, they come off the ballot altogether — the screen says which of the two is about to happen before you confirm.'),
              p('Two things stop it, and both are about not changing a ballot under the people reading it:'),
              defs(
                { term: 'They have already accepted', text: 'An accepted nomination stays on the ballot. The way off it is for them to decline — see Accepting or declining below. The exception is your own: you can always withdraw yourself.' },
                { term: 'Nominations have closed', text: 'Once the window is over, nothing comes off the ballot. Declining is the only way out from then on.' },
              ),
              note('You cannot take somebody else\u2019s nomination off, even if you are an administrator of the family. A nomination is a thing one member said, and only they can unsay it.'),
            ],
          },
          {
            id: 'accepting',
            heading: 'Accepting or declining',
            blocks: [
              p('If somebody nominates you, the election opens with **You have been nominated!** at the top, one row per office. **Accept** puts you on the ballot; **Decline** takes you off it.'),
              p('It cannot be changed afterwards, so the screen asks you to confirm. Only nominations you have accepted appear as candidates when voting opens — a nomination nobody answered is not on the ballot.'),
              note('You can still answer after nominations close. The window governs who may be nominated, not how long you have to reply.'),
            ],
          },
          {
            id: 'voting',
            heading: 'Voting',
            blocks: [
              p('While voting is open, each office lists the candidates who accepted. Press one, confirm, and your vote is recorded.'),
              p('You may change your vote as often as you like until the window closes — pressing another candidate replaces your earlier vote rather than adding to it. One vote per office.'),
              p('**Your ballot is yours.** You can see your own votes and nobody else can, and nothing anywhere shows another member who they voted for.'),
            ],
          },
          {
            id: 'results',
            heading: 'Results',
            blocks: [
              p('Once the voting window has closed, **Results** appears at the foot of the election with the vote count for each candidate, ordered by count, as many rows deep as the office has winners.'),
              p('Nothing is published while voting is still open, and nothing has to be pressed to publish it — the day after voting closes, the results are there.'),
            ],
          },
        ],
      },
    ],
  },

  {
    // THE PART WAS CALLED "EVENTS" AND HELD SIX CHAPTERS until 2026-08-19. Three of them
    // documented the Events product — Events and RSVPs, Event Planning, Running an event —
    // and all three are deleted with it, along with every cross-reference the Gatherings
    // chapters made to them. A manual chapter for a screen that no longer exists is worse
    // than no chapter: it is the product telling a confused member to go somewhere that 404s.
    id: 'gatherings',
    title: 'Gatherings',
    blurb: 'Getting the reunion on the calendar, and getting the work of it handed out.',
    chapters: [
      {
        slug: 'gatherings',
        title: 'Gatherings',
        summary: 'What a gathering is, how one is scheduled, how to read its tasks and its budget, and where your own tasks are.',
        route: '/gatherings',
        sections: [
          {
            id: 'what-it-is',
            heading: 'A gathering, and how it differs from an event',
            blocks: [
              p('[Gatherings](/gatherings) is the family organising the work of getting together. A gathering is a named occasion — a reunion, a memorial, a banquet — broken into the jobs it takes, with a relative\'s name against each one and an answer somebody accepts. Its question is who is doing what, and whether it has been done and accepted.'),
              p('The screen is two panes. **Gatherings** is everything the family is planning, covered by this chapter; **My Tasks** is your own share of it, covered by [My Gathering Tasks](/help/gathering-tasks#what-it-is). The two are granted separately, so a family can hand somebody their own tasks without handing them the family-wide list.'),
              note('There was a separate Events product until 2026-08-19 — RSVPs by household, hotel room blocks and day-of check-in — and it is gone. Gatherings replaced it, and those three things are not in the product today: a step of a gathering can ASK a relative for any of them, but there is no attendee count, no room block and no check-in list. Everything the family had recorded is kept; nothing new can be added to it.'),
              p('A gathering can be built from one or more templates — a named, ordered list of steps somebody authored once. Every step of every template it is built from becomes a task on the gathering, so nothing is forgotten between one year and the next. The library is [Gathering Templates](/admin/gatherings/templates).'),
              p('A gathering with no template is a date on [the calendar](/gatherings/calendar) with a place and a description and no tasks — which is all some occasions need, and is where one often starts. An organiser can add a template to it later, and the steps become tasks then.'),
              p('Each of those templates is a **segment**: a part of the occasion with its own day and its own place. That is what lets one gathering be a three-day reunion — the Welcome on Friday evening at one address, the Picnic on Saturday at another, the Send Off on Sunday morning — rather than one block of dates with everything filed under it. A gathering that happens all at once in one place simply states neither, and reads as it always has.'),
            ],
          },
          {
            id: 'browsing',
            heading: 'Coming up, and already held',
            blocks: [
              p('The page is two lists. **Coming up** holds everything that has not finished, soonest first; **Already held** holds the rest, most recent first. A gathering running over several days stays under Coming up on every one of them and is marked **Happening now** while it does.'),
              p('Each card carries the dates, the place, how far the work has got — "4 of 9 tasks approved", or **No tasks yet** for a gathering nothing has been added to — and a status. The status is set by whoever is organising rather than worked out from the calendar, because a gathering can be called off without its dates moving:'),
              defs(
                { term: 'Planning', text: 'Being put together. Dates may still move. Only a gathering built from templates starts here — one that is just a date starts at Scheduled, because there is nothing to plan.' },
                { term: 'Scheduled', text: 'Settled, and going ahead.' },
                { term: 'Complete', text: 'Finished, and said to be finished by whoever ran it.' },
                { term: 'Cancelled', text: 'Called off. Nothing is deleted and it can be set back.' },
              ),
              p('**Premier** marks a gathering the family should see first: it gets a band across the top of [the dashboard](/dashboard). Several may carry the marker at once, and the dashboard shows the soonest one still ahead — so last year\'s reunion never blocks this year\'s.'),
            ],
          },
          {
            id: 'scheduling',
            heading: 'Scheduling one',
            blocks: [
              p('**Schedule a gathering** appears when you may start one. The form asks for the templates before the title, because ticking one changes what the rest of the form is for:'),
              steps(
                'Press **Schedule a gathering**.',
                'Tick any templates under **Built from**. Every step of every one you tick becomes a task, ready to hand out, and each template you tick becomes a segment of the gathering. Tick none and the gathering is a date with no tasks.',
                'Fill in **Title**.',
                'Fill in **When** — see below. A date is all that is required.',
                '**Where** and **What it is** are optional.',
                'Press **Schedule gathering**. You land on the gathering itself, where any tasks it just made are waiting.',
              ),
              p('Each template decides for itself who may schedule from it, so the list offered here is not the whole library — one set to Administrators only is not on it unless you can manage gatherings, and an archived template cannot start anything new. Where nothing is offered at all, the form says the gathering will be a date with no tasks and points at the library for whoever can author one: nothing is wrong with your access.'),
            ],
          },
          {
            id: 'when',
            heading: 'When it happens',
            blocks: [
              p('**When** is the same set of controls wherever a gathering is created or edited. A date is the only thing it insists on; everything else is there when you need it.'),
              defs(
                { term: 'Starts', text: 'The day it begins, and — if you want to say so — the time. Leave the time empty and the gathering is just "on that day", which is how most are entered.' },
                { term: 'End time', text: 'When it finishes. On a single day this is a time and nothing else: a picnic that runs from 11 to 4 has an end time and no end date.' },
                { term: 'Runs over more than one day', text: 'Tick this and one more question appears, because two very different things both take more than a day.' },
              ),
              p('That question is the important one:'),
              defs(
                { term: 'One continuous block', text: 'A reunion from Friday evening to Sunday lunchtime. Give the day it ends and, if you like, the time. It draws as one bar spanning those days on [the calendar](/gatherings/calendar).' },
                { term: 'Separate days, same gathering', text: 'A committee meeting on three Saturdays. Add a row for each day, each with its own times. Every one draws as its own entry on the calendar, all carrying this gathering\'s title.' },
              ),
              note('The difference matters more than it looks. Before this existed, three Saturdays had to be entered as a first day and a last day — which put a bar across the whole fortnight and told the family they were gathering for two weeks. Separate days say what is actually happening.'),
              p('**The end can never be before the start.** The date pickers grey out the impossible days, and if you get there another way the form says so rather than saving it. The same applies to times within one day — 2pm to 9am is not a gathering — while across days it is perfectly ordinary, so Friday 6pm to Sunday 11am is accepted.'),
              p('**Give a time and you are asked which timezone it is in**, starting with your own. The time is then shown exactly as you typed it, with that timezone named beside it — 11:00 AM CDT.'),
              note('Nothing is ever converted. A time here means what it says where the gathering is, exactly as it would on a printed invitation, and every relative sees the same figure — the timezone is named so somebody elsewhere knows what to make of it, not so the product can quietly move it.'),
            ],
          },
          {
            id: 'the-page',
            heading: 'A gathering\'s own page',
            blocks: [
              p('The title, the dates, the place, and then **Tasks** — every job on the gathering, grouped by the segment it belongs to, in the order they will be handed out. Each group is headed by that segment\'s name, and under it the segment\'s own day and place where the organiser has stated them; a segment that states neither is headed by its name alone. A task whose template has since been unlinked is grouped under **Not from a template** rather than dropped, because it is still something a relative was asked to do.'),
              p('Each row gives the task its person, its status, its due date, its budget line and the accepted answer. Once there are more than a handful, **Find a task** narrows by job or by name and **Showing** narrows to one status.'),
              defs(
                { term: 'Not started', text: 'Nobody has sent anything in yet.' },
                { term: 'Waiting for review', text: 'An answer is in and nobody has ruled on it.' },
                { term: 'Approved', text: 'Accepted. That answer is the family\'s record of it and the person who sent it cannot change it.' },
                { term: 'Needs another look', text: 'Handed back with notes. The notes are on the row, and whoever holds the task reads them on [My Gathering Tasks](/gatherings/my-tasks).' },
              ),
              p('**Organize this gathering** appears for somebody who can run it and leads to the same gathering on [Gathering Management](/admin/gatherings), where the work is handed out and ruled on. On the Free plan it says **Edit this gathering** instead and goes to the same place — there is no work to hand out, so the console is where the title, the dates, the place and the status are changed.'),
            ],
          },
          {
            id: 'free-plan',
            heading: 'Gatherings on the Free plan',
            blocks: [
              p('A gathering is a date, a place and a description on the Free plan, and that is a complete feature: it goes on [the calendar](/gatherings/calendar), every relative can see it, and it can be edited or cancelled at any time.'),
              p('What Free does not include is the planning half — the checklists a gathering is built from, the tasks handed out to relatives by name, and the budget drawn on a fund. So there is no **Planning** status, no **Segments**, no **Tasks**, and nothing to organise; the gathering\'s page says what those would add rather than showing empty panels for them.'),
              note('Nothing is lost by staying on Free and nothing is lost by leaving it. A family that upgrades can start handing out work on gatherings it already has, and one that lapses keeps every task and answer already recorded — they simply cannot add more.'),
            ],
          },
          {
            id: 'budget',
            heading: 'The Budget band',
            blocks: [
              p('A gathering may carry a budget drawn on one of the family\'s funds. Where it does, the **Budget** band sits above the tasks with four figures:'),
              defs(
                { term: 'Budgeted', text: 'What this gathering plans to spend altogether.' },
                { term: 'Claimed by tasks', text: 'The individual task budget lines added up — what has been earmarked for a particular job.' },
                { term: 'Unallocated', text: 'Budgeted less claimed: what is still to be handed out. It reads Over the budget once the lines have outrun it.' },
                { term: 'In the fund', text: 'What the fund actually holds, and how much of that other gatherings are already claiming.' },
              ),
              p('A budget is allowed to be larger than the fund it draws on, because a family plans a reunion before it has raised the money for one. When it is, a red line says by how much — and a second red line appears where this gathering fits inside the fund on its own but not once the other gatherings drawing on the same fund are counted. Neither is a refusal. They are the figures saying what the plan costs.'),
              p('The quieter line underneath is a different thing and deliberately not red: it says the task lines together claim more than the gathering budgeted. Nothing has been spent, and it is settled by raising the budget or trimming a line.'),
              note('The band is absent on some gatherings, and absent is not empty. Where the money on a gathering has not been shared with you there is no band at all rather than a band saying it is hidden — which is a different thing from a gathering nobody has budgeted, and that one shows the band with nothing in it. See [Who can do what](/help/who-can-do-what#one-template).'),
            ],
          },
        ],
      },
      {
        slug: 'gathering-tasks',
        title: 'My Gathering Tasks',
        summary: 'The gathering tasks handed to you, the kind of answer each one asks for, and what to do when one comes back with notes.',
        route: '/gatherings/my-tasks',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Your share of a gathering',
            blocks: [
              p('**My Tasks** is the second pane of [Gatherings](/gatherings), and it is everything anybody has asked you to do for a gathering, across every gathering, soonest deadline first — a task with no deadline sits at the bottom. The tab carries the count of what is waiting on you, and the line at the top says separately how many have come back for another look.'),
              p('It had a menu row of its own until 2026-08-19 and is a pane now. The old address still works and lands on the pane, which is what keeps a link in an old notification pointing at the right place. A [Dashboard](/dashboard) Quick Action appears when something is waiting on you and disappears when nothing is.'),
              p('Each card names the gathering, the template the task came from, when it is due and what it may spend. A task past its deadline is marked rather than quietly forgotten. Whatever help text the step carried is printed under the title: that is the person who wrote it telling you what counts as done.'),
              p('WHAT MAKES A TASK DIFFERENT FROM A FORM YOU FILL IN is what happens after you answer. It goes to whoever is organising, who accepts it or hands it back with notes — so a task is finished when somebody has said so, not when you have typed something in.'),
              note('The pane is always there and an empty one says nothing is assigned to you. That is the intended state for most members most of the time rather than a fault — and it is always there so that a task handed to you this morning can be found this morning.'),
            ],
          },
          {
            id: 'answering',
            heading: 'What a task asks for',
            blocks: [
              p('A step says what kind of answer it wants and you get the field that matches. There is no free-for-all: an answer that does not fit the kind is refused, with the reason and a line saying what the field expects.'),
              defs(
                { term: 'Short answer', text: 'One line — a name, a phone number, a venue.' },
                { term: 'Long answer', text: 'A paragraph — notes, a description, an explanation.' },
                { term: 'A date', text: 'One calendar date, from a date field.' },
                { term: 'A list', text: 'Any number of lines. The box says **One item per line**, and an empty line is dropped rather than recorded as a blank item.' },
                { term: 'Yes or no', text: 'A decision, as a pair of choices. You have to pick one — leaving it alone is not an answer, and nothing is read as No on your behalf.' },
                { term: 'A number', text: 'A count or a quantity. A fraction is allowed, because "how many pounds of brisket" is a real question.' },
                { term: 'An amount of money', text: 'An amount in dollars with the cents after the point: type 450.00 for four hundred and fifty dollars. The box is prefixed with a dollar sign, and an empty one is unanswered rather than nothing spent.' },
              ),
              p('An empty field is never sent. Pressing the button with nothing in the answer says there is nothing to send yet, which is what stops an untouched money box being filed as zero and reading as answered on every screen afterwards.'),
            ],
          },
          {
            id: 'sending',
            heading: 'Sending an answer in',
            blocks: [
              steps(
                'Fill in **Your answer**.',
                'Add anything worth saying under **Anything to tell the organizer?**. It is optional, and it travels with the answer rather than replacing it.',
                'Press **Send for review**.',
              ),
              p('What you sent is then shown back to you above the form, headed **Sent for review** with the date. Until somebody rules on it you can send something different — the button reads **Replace my answer** — and every version is kept, so the exchange can be read back rather than only its last line.'),
              p('Whoever can rule on it is told in their notifications the moment it goes in, so you do not have to tell anybody separately.'),
            ],
          },
          {
            id: 'sent-back',
            heading: 'When it comes back',
            blocks: [
              p('A task can be handed back, and its status then reads **Needs another look**. That wording is deliberate: it is not a rejection and not a mark against you, it is the task returned with instructions, and the instructions are the whole point of returning it.'),
              p('They appear at the top of the card under **What the organizer asked for**, above the form, so you read them before you type. Fix what they asked for and press **Send it again**.'),
              p('There is no limit on how many times a task can go back and forth, and a task that took two goes is the same finished task as one that took one. Resubmitting is the ordinary way this works rather than a failure to be avoided.'),
              note('Nobody can hand a task back without saying what needs to change — the screen they use will not send it otherwise. If one ever arrives with no notes on it, the card says so, and the thing to do is ask them: there is genuinely nothing there to act on.'),
            ],
          },
          {
            id: 'approved',
            heading: 'Once it is approved',
            blocks: [
              p('An approved answer is final on both sides. The card goes read-only and shows what was accepted; there is no way to send a different one, and trying is refused with that sentence rather than appearing to save. It also stops being overdue, because the deadline no longer applies to anything.'),
              p('If an approved answer genuinely has to change, ask whoever is organising the gathering. They have a **Reopen…** button on their side of it, and using it puts the task back in your hands: it returns to the ordinary form with your last answer already in it, so a one-word correction is a one-word correction. You cannot do it yourself, which is the whole of what "final on both sides" means.'),
              p('A reopened task arrives the same way one that was handed back does — in your notifications, and at the top of [My Gathering Tasks](/gatherings/my-tasks) — with whatever reason they gave, if they gave one. Nothing you sent is deleted by it, and every version stays readable.'),
            ],
          },
        ],
      },
      {
        slug: 'calendar',
        title: 'Calendar',
        summary: 'The month grid that puts every gathering, meeting and election window on the day it falls, how to move between months, and what it does on a phone.',
        route: '/gatherings/calendar',
        sections: [
          {
            id: 'what-it-is',
            heading: 'One month at a time',
            blocks: [
              p('[Calendar](/gatherings/calendar) is a real month grid \u2014 weeks down, weekdays across, Sunday first \u2014 with three things on the days they fall: the family\u2019s **gatherings**, the **meetings** you are down for, and the open **nomination and voting windows** of its elections. It creates nothing. Every entry is a link into the screen that owns it \u2014 [Gatherings](/gatherings), [Meeting Minutes](/library/meeting-minutes) or [Elections](/community/elections) \u2014 which is where the thing itself lives and is edited.'),
              p('The legend names only what is actually on the grid this month, and every entry says which kind it is in words as well as in colour \u2014 so the distinction survives both a screen reader and a reader who cannot separate the hues. **Premier gathering** is gold, **Gathering** is soft burgundy, **Meeting** is filled burgundy, and an election is warm terracotta: outlined while **Nominations** are open, filled once **Voting** is. There was a sixth for an Event until 2026-08-19; that product is retired.'),
            ],
          },
          {
            id: 'reading',
            heading: 'Reading a day',
            blocks: [
              p('Today is marked. **Anything running over several days is drawn as one bar across them**, with its name at the left-hand end \u2014 a three-day reunion is one bar three days wide, and a fortnight of voting is one bar in each of the two weeks it crosses. That is the whole reason a closing date exists. An election contributes two bars rather than one: the nomination window and, after a gap, the voting window. The days between them are deliberately empty, because on those days the slate has closed and there is nothing to do yet.'),
              p('**A bar with a square end is cut off, not finished.** A run that crosses a Saturday has to be drawn as one bar per week, so the flat edges are where it carries on into the row above or below; rounded ends are where the thing itself starts and stops.'),
              p('The grid always shows whole weeks, so the first and last rows carry a few days from the months either side. Those days keep their entries: a reunion starting on the 1st is visible in the last row of the month before, which is where you would be looking for it a week earlier.'),
              note('It was one chip per day until 2026-08-22 \u2014 a two-day election window read as two separate things with the same name.'),
            ],
          },
          {
            id: 'moving',
            heading: 'Moving between months',
            blocks: [
              p('The links either side of the heading are the month before and the month after, each one named, with **This month** between them. All three are real links, so cmd-click, middle-click and copy-link-address work on them.'),
              p('The month is in the address, which means a link to a month is a link to that month — [June 2027](/gatherings/calendar?month=2027-06) opens June 2027 for anybody you send it to, and it can be bookmarked. An address the page cannot read falls back to the current month rather than drawing a month that does not exist.'),
            ],
          },
          {
            id: 'phone',
            heading: 'On a phone',
            blocks: [
              p('Below the width a seven-column grid needs, the calendar becomes a list of the days that have something on them, in order, with the weekday and the date beside each. A day borrowed from a neighbouring month is labelled **Previous month** or **Next month**, since it no longer has a column to say so.'),
              p('That is a second view of the same month rather than a second calendar — the same entries, the same links. It is a deliberate choice over squeezing the grid: at phone width a day is too narrow to hold a date and a title, and a month of mostly empty cells is a screen of nothing when the question is what is coming up.'),
              p('**A run of days is one row per day here, not a bar.** The list has no left-to-right axis for a bar to stretch along, so a three-day reunion appears under each of its three dates with its name on each — which is what you want from a list of days.'),
            ],
          },
          {
            id: 'missing',
            heading: 'When something is not on it',
            blocks: [
              p('A line above the grid appears when one of the three sources is missing from it, and it names which \u2014 gatherings, meetings or elections. It cannot say WHY, and does not guess: it means either that the screen has not been shared with you, or that it could not be read just now.'),
              p('Either way the month you are looking at is not the whole month, which is why the line is there at all — an empty August with nothing said about it reads as a fact about the family. A month that genuinely has nothing on it says that instead.'),
            ],
          },
        ],
      },
      {
        slug: 'gathering-management',
        title: 'Gathering Management',
        summary: 'Scheduling a gathering, setting its fund and budget, handing out the tasks, ruling on the answers that come back, and authoring the templates it is all built from.',
        route: '/admin/gatherings',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Three panes, and what they are for',
            blocks: [
              p('[Gatherings](/admin/gatherings) under Admin is the organising side of [Gatherings](/gatherings), on one rail with three panes:'),
              bullets(
                '**Gatherings** — every gathering the family has, with its dates, its status, its budget against the fund it draws on, and how much of its work has been approved.',
                '**Review queue** — every answer waiting on a decision, across every gathering at once. The pane carries the count while anything is waiting.',
                '**Templates** — the library every gathering is built from, covered by [Gathering Templates](/help/gathering-templates#what-it-is).',
              ),
              p('Templates had a menu row of its own until 2026-08-19 and is a pane here now; its old address still works and lands on the pane. It is granted separately from the other two, so a family can let somebody author the checklists without letting them commit the family to a gathering — or the other way round, which is the commoner arrangement.'),
            ],
          },
          {
            id: 'creating',
            heading: 'Scheduling a gathering',
            blocks: [
              steps(
                'Press **New gathering**.',
                'Tick any templates under **Built from**. Their steps become its tasks, in the order the templates are named. Tick none and the gathering is a date with no tasks, which a template can be added to later.',
                'Fill in **Title** and **Starts**, and **Ends** only if it runs more than a day.',
                '**Location** and **Summary** are optional — the summary is what the people being asked to help will read.',
                'Choose a **Fund** and a **Budget ($)** if it is spending money, and tick **Show this across the top of the Dashboard** if it is the one the family should see first.',
                'Press **Create gathering**, then **Open the gathering** to start handing out its tasks.',
              ),
              p('Each template you tick becomes a segment of the gathering, which is the next section. A gathering with none is the occasion itself — its dates, its place and its description — and is what the family calendar shows either way.'),
            ],
          },
          {
            id: 'segments',
            heading: 'Segments, and their days and places',
            blocks: [
              p('A gathering is rarely one occasion. A reunion is the Welcome, the Picnic and the Send Off, on their own days in their own places, and each template the gathering was built from is one of those parts. The **Segments** panel on a gathering\'s own page is where they are listed, and where each one\'s day and place are set.'),
              defs(
                { term: 'Segment', text: 'The template this part came from, with how many tasks came with it.' },
                { term: 'Day', text: 'The date this part happens on. Optional — leave it empty for a gathering that happens all at once.' },
                { term: 'Place', text: 'Where this part is held. Optional, and it starts empty — a template no longer states a usual one.' },
                { term: 'Tasks', text: 'How many of the gathering\'s tasks came from that template.' },
              ),
              p('Type into either box and a **Save** button appears on that row, so nothing is written per keystroke and one row saving does not lock the others. Both are what the relatives being asked to help actually read: a segment\'s day and place are printed under its heading on the gathering\'s own page.'),
              steps(
                'Choose a template under **Add another segment**.',
                'Set **Day** and **Place**, or leave either empty.',
                'Press **Add its steps**. Every step of that template becomes a task on this gathering, and nothing about the tasks already there changes.',
              ),
              p('A day outside the gathering\'s own dates is **saved and remarked on rather than refused**, and the remark is a quiet line on the row rather than a red one: nothing failed, there is simply a date to reconcile. That is deliberate — dates move, and an organiser shifting the weekend should not be stopped by a segment they were not looking at. The line appears when the segment is saved, so a gathering whose dates moved afterwards is worth a look down this panel.'),
              note('A segment\'s place belongs to the segment and to nothing else. Templates used to state a **Usual location** that was copied onto every segment built from them, and that is gone (2026-08-19): a venue belongs to one occasion, and a template that needs one asks for it with a step of kind **A place** — handed to a named relative, with a due date, and reviewed like every other answer.'),
            ],
          },
          {
            id: 'premier',
            heading: 'The Dashboard band',
            blocks: [
              p('**Show this across the top of the Dashboard** is on the **Dashboard band** panel of a gathering\'s own page. A flagged gathering gets the band under the greeting on [the dashboard](/dashboard) — its title, its dates, where it is, how many of its tasks are approved, and a way straight in.'),
              p('Several gatherings may be flagged at once, deliberately. The dashboard shows the soonest one that has not finished, so last year\'s reunion never blocks this year\'s, and nothing appears there at all when no flagged gathering is still ahead.'),
              p('**Band photo**, on the same panel, sets the picture the band is built around — one photograph per gathering, cropped to the band\'s shape. Choosing a file uploads it straight away; **Remove photo** takes it off again. Without one the band draws the GENORRA tree instead, so it looks finished either way.'),
              p('An uploaded band photo can be viewed by anyone who has its address, exactly like a photograph in the [Gallery](/community/gallery). Putting one here publishes it to whoever the link reaches, so choose a picture the family would be happy to share.'),
            ],
          },
          {
            id: 'money',
            heading: 'The fund, the budget, and the red line',
            blocks: [
              p('A budget is always drawn on a fund, and the two are saved together — clearing the fund clears the budget with it, and the amount box will not take a figure until a fund is chosen. Funds are set up under [Accounting](/admin/accounting?section=funds); see [Accounting](/help/accounting#funds).'),
              p('Several gatherings may draw on one fund, so a balance is not one gathering\'s to spend. The band on each gathering says what else is claiming it.'),
              p('A budget larger than the fund is allowed and is not an error. The figures say so with a red line instead of refusing the number, because a family plans a reunion before it has raised the money for one — refusing it would mean the plan could not be written down at all.'),
              p('Each task can carry its own **Budget line ($)**, set in that task\'s dialog: what the one job is expected to cost, with empty meaning it costs the family nothing. The lines together are what the band compares to the budget, and a template step\'s suggested budget is only the figure a line starts at. When the lines outrun the budget the band says so in a quieter, deliberately different treatment — nothing has been spent, and it is settled by raising the budget or trimming a line.'),
            ],
          },
          {
            id: 'assigning',
            heading: 'Handing out the work',
            blocks: [
              p('Press **Manage** on a task — **Review** when something is waiting on it — and one dialog holds everything about that task.'),
              steps(
                'Pick somebody under **Assigned to**. The picker searches any part of any name, which is what makes it usable in a family of a hundred and forty.',
                'Set **Due** if it has a deadline.',
                'Press **Save who and when**.',
              ),
              p('Anybody the family has approved can hold a task whether or not they have an account of their own, so a relative recorded on the tree with no login can still be asked to bring the photographs. Somebody whose membership is still waiting cannot, and the screen says so rather than failing quietly. **Leave it unassigned** takes a task back off somebody.'),
              p('The person you assign is told in their notifications, and the task appears on their [My Gathering Tasks](/gatherings/my-tasks) with your due date on it.'),
            ],
          },
          {
            id: 'reviewing',
            heading: 'Ruling on an answer',
            blocks: [
              p('An answer arrives in the **Review queue** with what was sent, any note the sender added, who sent it and when. There are two rulings:'),
              bullets(
                '**Approve** — accepted, and final. The answer becomes the family\'s record of it and the person who sent it cannot change it afterwards, which is why it is confirmed first.',
                '**Send back…** — returned with instructions. It opens **What needs to change**, and that box is required: a task handed back with nothing in it tells a relative their answer was not accepted while no screen anywhere says what to do about it. Whatever you write is sent with the task and is the first thing they see.',
              ),
              p('A task sent back reads **Needs another look** on every screen and can be answered again as many times as it takes. Every submission is kept, so the whole exchange is readable from the task rather than only its last line.'),
              p('An approved answer can be taken back, and only from here. Open the task and press **Reopen…**, add a line under **Why, if you want to say (optional)** if there is anything to explain, then press **Reopen** to confirm. The task returns to the person holding it with their answer still on it, they are told in their notifications, and the reason travels with it. Nothing is erased: the answer stays as their starting point and every submission stays in the record, including the approval you just took back.'),
              p('The reason is optional here and required on **Send back…**, which looks inconsistent and is not. Handing work back with no instructions leaves a relative nothing to act on; taking back your own approval is usually a correction to your own reading of it, and there is often nothing to say beyond that it has to change.'),
              note('Reopening is the only way back from an approval, so approve deliberately even though it can be undone. The person who sent the answer cannot reopen it and cannot replace it while it stands — from their side approved really is final, and every screen tells them to come to you.'),
            ],
          },
          {
            id: 'changing',
            heading: 'Changing or ending one',
            blocks: [
              p('**Status** is set by hand — **Planning**, **Scheduled**, **Complete** or **Cancelled** — because none of the four is something the calendar knows: a gathering can be called off without its dates moving, and finished is somebody\'s statement rather than a date passing. **Save changes** commits it along with the title, the dates and the place.'),
              p('**Delete gathering** is refused once any of its answers has been approved. The refusal names how many and offers Cancelled instead, which deletes nothing and can be set back.'),
              p('Removing a segment — the bin on its row, confirmed as **Remove template** — is refused the same way once any task from it has been assigned or answered. The tasks that came from a template are what relatives were actually asked to do and they outlive the link, so unlinking one only ever clears the tasks nobody has touched.'),
            ],
          },
        ],
      },
      {
        slug: 'gathering-templates',
        title: 'Gathering Templates',
        summary: 'Authoring the step-by-step lists a gathering is built from, including a step that is another template, deciding who may schedule from one, and archiving one that has been used.',
        route: '/admin/gatherings/templates',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What a template is',
            blocks: [
              p('The **Templates** pane of [Gatherings](/admin/gatherings) under Admin is the library a gathering is built from. A template is a name and an ordered list of steps — one per thing somebody has to do or decide — and scheduling a gathering from it turns every step into a task waiting to be handed to a relative.'),
              p('It had a menu row of its own until 2026-08-19 and is a pane now. The old address still works and lands on it.'),
              p('Editing a template never changes a gathering already built from it. Every task keeps its own copy of what it asked, so a step renamed here reaches next year\'s reunion and not the one currently running, and nobody\'s answer is ever rewritten out from under them. That is what makes the library safe to keep tidying, and the card says so.'),
            ],
          },
          {
            id: 'adding',
            heading: 'Adding a template',
            blocks: [
              steps(
                'Press **Add template** at the top of the pane.',
                'Give it a **Template name** — name it for the occasion, "Family Reunion", "Memorial Service", "Scholarship Banquet".',
                'Write a **Description** if you want one, and choose **Who can schedule from this**.',
                'Press **Add template**.',
                'The card that appears is shut. Press its name to open it, then give it a step for each thing somebody has to do.',
              ),
              p('**Every template card is shut until you open it.** Open, a card shows the description, who may schedule from it, and a row per step — which is a page of its own once a family has half a dozen. Shut, each one shows its name and how many steps it has, so the library reads as a list of what you have rather than as everything about everything. Press a name to open it; press again to shut it.'),
              p('**Nothing on a card is typed into directly.** The card states what the template is; **Edit** beside its name opens a box holding the name, the description and who may schedule, and every step has its own **Edit** button. That is what keeps the library readable — a screen of a hundred live boxes cannot be scanned, and scanning is what this page is for.'),
              note('An open box either saves or is dismissed, so there is no such thing as a half-saved template. Press **Cancel** or **Escape** and nothing changed.'),
              p('A name has to be unique within the family, so a second "Family Reunion" is refused rather than added quietly beside the first. The description is what an organiser reads before scheduling from it, and it is shown beside the template when they pick one.'),
              note('There was a **Usual location** field here until 2026-08-19 and there is not now. A template stating where its gatherings are usually held was an author guessing at a fact that belongs to one occasion, and the guess then had to be corrected on every segment it was copied onto. Ask for the venue instead: a step of kind **A place**, handed to a named relative with a due date.'),
            ],
          },
          {
            id: 'steps',
            heading: 'The steps',
            blocks: [
              steps(
                'Press **Add step** beside the Steps heading.',
                'Type the label under **Step** — "Book the hall", "Head count", "Catering".',
                'Choose **What it asks for**. The line under the picker says what the person holding the task will be given to fill in.',
                'Put anything they need to know in **Help text** — who to call, what counts as done. They read it under the task itself.',
                'Tick **Required** if the gathering is not finished until this one is answered and approved.',
                'Set a **Suggested budget ($)** if the job costs money.',
                'Press **Add step**.',
              ),
              p('There are nine kinds of step. Eight of them decide what the person answering is given:'),
              defs(
                { term: 'Short answer', text: 'One line — a name, a phone number, an answer in a few words.' },
                { term: 'Long answer', text: 'A paragraph — notes, a description, an explanation.' },
                { term: 'A date', text: 'A single calendar date, picked from a date field.' },
                { term: 'A place', text: 'A venue, an address, a room. One line, and a phone will offer the addresses it already knows.' },
                { term: 'A list', text: 'Any number of lines, one item each, added and removed as they go.' },
                { term: 'Yes or no', text: 'A decision. They must choose; leaving it blank is not an answer.' },
                { term: 'A number', text: 'A count or a quantity. Money has its own kind — use that one for money.' },
                { term: 'An amount of money', text: 'An amount in dollars, recorded to the cent.' },
              ),
              p('The ninth is the odd one out and is the next section.'),
              p('Each row states what the step is: its label, its help text under it, what it asks for, whether it is required and what it suggests spending. To change any of that, press the pencil on the row and the same box opens with the step in it.'),
              p('The arrows on a row move a step earlier or later, and that order is the order the tasks are handed out in. Deleting a step leaves every task already made from it exactly where it is.'),
              p('A suggested budget is only a starting figure copied onto the task. It can be changed on the gathering, and what counts against the fund is the gathering\'s own budget — see [Gathering Management](/help/gathering-management#money).'),
            ],
          },
          {
            id: 'nested',
            heading: 'A step that is another template',
            blocks: [
              p('The ninth kind is **Another template**, and nobody answers it. Pick a template and every step of THAT template becomes a task of its own, at that point in the list, whenever a gathering is built from this one.'),
              p('It is for the checklist your family runs inside several different occasions. Write the five steps of "Catering" once, then give "Family Reunion", "Memorial Service" and "Scholarship Banquet" a step of Catering each — and correcting the catering list next year corrects all three.'),
              steps(
                'Press **Add step**, and type a label — it heads nothing on its own, so name it for what the reader of this template should see, "The catering checklist".',
                'Choose **Another template** under **What it asks for**.',
                'Pick the one to include under **Template to include**.',
                'Press **Add step**.',
              ),
              p('**Help text**, **Required** and **Suggested budget** are not offered for this kind and that is deliberate: nobody is going to answer it, so there is nobody to advise, nothing to require and no single job to price. The steps it brings in carry their own.'),
              p('A template cannot include itself, and it cannot include anything that leads back to it — A inside B inside A is refused with a sentence saying so. Only the family\'s other templates are offered, and an archived one may still be included: archiving means "do not start anything NEW from this", which is about scheduling a gathering rather than about composing a checklist.'),
              note('Editing the included template changes what the NEXT gathering gets and never a gathering already running — the same rule every other step follows, for the same reason. So this is safe to keep tidying, and correcting a shared checklist genuinely reaches every template that includes it.'),
            ],
          },
          {
            id: 'who-may-schedule',
            heading: 'Who can schedule from this',
            blocks: [
              p('**Who can schedule from this** is set per template, and it is the one thing on this screen that a member outside the admin pages ever feels:'),
              defs(
                { term: 'Administrators only', text: 'Only somebody who can manage gatherings may start one from this template.' },
                { term: 'Any member', text: 'Any member who may schedule a gathering can start one from this template. They still cannot edit the template itself.' },
              ),
              p('Changing a template is an admin job whichever of the two is set. So a family can hand out "anybody may run a birthday" without also handing out "anybody may change what a birthday involves", which is the reason the setting sits on the template rather than on the person.'),
            ],
          },
          {
            id: 'archiving',
            heading: 'Archiving, and deleting',
            blocks: [
              p('**Archive** takes a template out of the schedule-from list and leaves every gathering built from it exactly as it is. Nothing running changes and nothing is deleted; the card says it is archived and that nothing new can be started from it, and **Restore** puts it back.'),
              p('A template a gathering was built from cannot be deleted. The refusal names how many gatherings used it and offers archiving instead, with an **Archive it instead** button beside the message. The reason is the record: the tasks on those gatherings say which template they came from, and deleting it would take that away. A template nothing has used yet deletes cleanly, along with its steps.'),
              p('The use count is printed on the card beside the delete control, so the refusal is rarely a surprise. It arrived with the page, though, and a gathering scheduled since will not be in it — the refusal itself is what decides.'),
            ],
          },
        ],
      },
      {
        slug: 'meeting-minutes',
        title: 'Meeting Minutes',
        summary: 'Scheduling a meeting by board or by office, who may take the minutes, and how the room votes on a topic.',
        route: '/library/meeting-minutes',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What this screen is',
            blocks: [
              p('[Meeting Minutes](/library/meeting-minutes) is the family\u2019s record of what it met about and decided. A meeting has a date, a list of who is expected, one **secretary** who writes it down, and any number of **topics** \u2014 each of which can carry notes and a vote.'),
              p('**Everybody in the family can read the minutes.** That is deliberate and it is the opposite of the [officer\u2019s journal](/help/journal), which only the officeholder reads: minutes are the record of decisions the family made, so somebody who was not in the room still gets to know what was decided.'),
              note('It was part of [Officer Notes](/library/officer-notes) until 2026-08-22, as a \u201cmeeting\u201d kind of entry. A meeting outgrew that: it belongs to the family rather than to one office, it has a secretary, and it has votes \u2014 none of which a notebook can express.'),
            ],
          },
          {
            id: 'scheduling',
            heading: 'Scheduling one',
            blocks: [
              p('It is **three steps**, with **Next** and **Back**, and nothing is saved until the last one.'),
              steps(
                'Press **Schedule a meeting**.',
                '**Step 1 \u2014 the basics.** A title, a date, and **who is taking the minutes**. That last one starts on you, because whoever schedules a meeting usually writes it up; change it to anybody else if not. Only the secretary can write in the meeting, and they have to be an adult.',
                '**Step 2 \u2014 who is coming.** Say what kind of meeting it is first, then pick within that kind. See below.',
                '**Step 3 \u2014 anybody else.** Add individual people on top of the body you chose, and check the room\u2019s count.',
                'Press **Schedule meeting**.',
              ),
              p('**Everybody in the room is told and gets it on their calendar.** A notification goes to each attendee, and the meeting appears on [the calendar](/gatherings/calendar) for them \u2014 not for the whole family, because a committee meeting on everybody\u2019s calendar is a calendar nobody reads. The attendee list is also what decides who may vote.'),
              note('The secretary is added to the room automatically whether or not you ticked them. Somebody writing the minutes was there.'),
              note('**Back never loses anything.** Going back to fix a date and returning leaves your picks where they were \u2014 with one deliberate exception: change the KIND of meeting on step 2 and the room follows the new kind, so a board you ticked before switching to a chapter meeting does not come along quietly.'),
            ],
          },
          {
            id: 'who-is-coming',
            heading: 'Who is coming: five kinds of meeting',
            blocks: [
              p('A family meeting is almost always a **body** meeting rather than a list of eleven names \u2014 the whole family, one chapter, the national board, every chapter president. So step 2 asks which kind it is, shows only that kind\u2019s options, and works out who is in the body when you schedule.'),
              defs(
                { term: 'A general family meeting', text: 'Every adult in the family. Nothing to pick \u2014 the step tells you how many people that is before you commit to it.' },
                { term: 'A chapter meeting', text: 'Everybody recorded in a chapter, officer or not. **This is not the chapter\u2019s board**; it is the whole chapter. Only chapters with somebody in them are offered.' },
                { term: 'A board meeting', text: 'Everybody holding an office at one level in one place \u2014 **National Board**, **Texas Region Board**, **Austin Chapter Board**. Only boards somebody is actually on are listed, and the number beside each says how many people that is.' },
                { term: 'A positions meeting', text: 'One office taken across every region or chapter that fills it. Choosing **Chapter President** invites the president of every chapter at once.' },
                { term: 'Just the people I name', text: 'Nobody to start with \u2014 for an ad-hoc committee of three, where there is no body to point at. You add them on step 3.' },
              ),
              p('**A kind with nothing to pick cannot be chosen, and says why.** A family that has not set its offices up yet has no boards to invite; that row is greyed with a sentence pointing at **Members \u2192 Organization** rather than being hidden, so it is clear the product can do it once the family has.'),
              p('**A body is resolved when you schedule, not when it was set up.** If the Austin chapter elects a new treasurer next month, the board you chose today invited the treasurer who held it today \u2014 which is right, because the meeting is the one they were told about. The same goes for a chapter: it is whoever is recorded in it on the day.'),
              p('**Step 3 adds people on top.** Whatever the body works out to, you can name more; the two add together, and somebody who appears in both is one attendee. The line under the picker counts the room and lists it behind **see who**, so you can check what a choice just added before you commit.'),
            ],
          },
          {
            id: 'adults',
            heading: 'Adults only, and the one exception',
            blocks: [
              p('**The secretary must be an adult**, and so must anybody added to the room **by name**. Both pickers only offer adults, and the action refuses one anyway if it is asked directly.'),
              p('**A chapter meeting and a general family meeting are adults too.** Nobody under eighteen is in either, so neither is a way round the rule above.'),
              p('**People invited as part of a board or an office are not age-checked**, and that is the exception. Somebody holding an office is somebody the family put there, and quietly dropping them from the room over a recorded birthday would be the product overruling that decision in a list nobody reads back.'),
              note('Age is worked out from the date of birth on the person\u2019s profile, and a member with **no** recorded birthday counts as an adult. \u201cUnder eighteen\u201d is something the family has written down about somebody, not something to assume about a blank field.'),
            ],
          },
          {
            id: 'writing',
            heading: 'During the meeting',
            blocks: [
              p('**Only the secretary writes.** Everybody else reads. Add a **topic** for each thing the room takes up, then write notes under it as it goes \u2014 the same shape as an officer\u2019s journal: a heading, and a thread underneath.'),
              p('Notes are shown oldest first, each with the time it was written, and one that has been changed since says so.'),
              note('If you are the secretary and the controls are missing, check whether the meeting has been closed. A closed meeting is read-only.'),
            ],
          },
          {
            id: 'voting',
            heading: 'Voting on a topic',
            blocks: [
              p('The secretary presses **Call a vote** on a topic. Everybody on the attendee list can then answer **For**, **Against** or **Abstain**, and the running count is on the topic.'),
              p('**A vote cannot be changed or withdrawn by anybody.** Not by the person who cast it, not by the secretary, not by an administrator. That is enforced by the database rather than by the screen, which is why there is no control that looks like it might.'),
              p('**How each person voted is on the record**, by name. A meeting vote is not a secret ballot \u2014 minutes exist to state who decided what. That is unlike [Elections](/help/elections), where a member\u2019s vote is theirs alone.'),
              defs(
                { term: 'Only attendees vote', text: 'The list you chose when scheduling. Somebody not on it can read the topic and the count and cannot answer.' },
                { term: 'A closed vote stays closed', text: 'It is not reopened. If the question needs asking again, the secretary deletes the topic and adds it fresh \u2014 which is visible, where quietly reopening a ballot is not.' },
                { term: 'Deleting a topic', text: 'The only way a vote is ever removed, and it removes the whole question along with its notes. The confirmation says how many votes go with it.' },
              ),
              note('Somebody who has already voted cannot be taken off the attendee list \u2014 their ballot is in the record, so removing them would leave a vote cast by somebody the minutes say was not there.'),
            ],
          },
          {
            id: 'closing',
            heading: 'Closing the minutes',
            blocks: [
              p('**Close minutes** is what turns a meeting into a record: no more topics, no more notes, no more votes. It is what makes the thing the family cites next year trustworthy.'),
              p('It can be reopened, by the secretary or by somebody with permission to edit meetings \u2014 closing too early is an ordinary mistake and the alternative is a permanently wrong record. Reopening undoes nothing that was decided: the votes stay exactly as they are.'),
            ],
          },
        ],
      },
      {
        slug: 'documents',
        title: 'Documents',
        summary: 'The family\u2019s filed records \u2014 what can be uploaded, how to find one, and who can remove it.',
        route: '/library/documents',
        sections: [
          {
            id: 'what-it-is',
            heading: 'The filing cabinet',
            blocks: [
              p('[Documents](/library/documents) is where the family\u2019s records live \u2014 forms, filings, signed copies. It moved under **Library** on 2026-08-22, beside the notebooks its officers keep and the family’s minutes and bylaws, because the reader who wants one is the reader who wants the others.'),
              note('**Excel, Word, PDF or CSV only**, up to 25 MB. Both generations of the Office formats, because a document written in 2004 really is a `.doc`. A photograph goes in the [Gallery](/community/gallery), which does albums and tagging that this list never will.'),
            ],
          },
          {
            id: 'uploading',
            heading: 'Filing something',
            blocks: [
              steps(
                'Press **Upload a document**.',
                'Choose the file. The name fills itself in from the file name; change it if you like.',
                'Add a description if it needs one, and pick a category.',
                'Press **Upload**.',
              ),
              p('**Three categories: Bylaws, Forms and Other.** There were five. *Photos* went because the [Gallery](/community/gallery) is the screen for a picture, and *Meeting Minutes* went because [Meeting Minutes](/library/meeting-minutes) is a real screen now. A PDF of minutes from a meeting held outside the product is **Other**.'),
              note('A document already filed under one of the retired categories keeps it and still shows it. Nothing rewrites somebody else\u2019s filing decision.'),
            ],
          },
          {
            id: 'finding-and-removing',
            heading: 'Finding one, and removing one',
            blocks: [
              p('The search box matches the name and the description; the category dropdown narrows to one kind. Pressing a document\u2019s name opens it.'),
              p('**Whoever uploaded a document can delete it.** Deleting anybody\u2019s needs the unrestricted grant \u2014 see [Who can do what](/help/who-can-do-what). The file is removed along with the row.'),
            ],
          },
        ],
      },
      {
        slug: 'bylaws',
        title: 'Bylaws',
        summary: 'The rules the family agreed to live by, and searching inside them \u2014 including what the search cannot reach yet.',
        route: '/library/bylaws',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What this screen is',
            blocks: [
              p('[Bylaws](/library/bylaws) holds the family\u2019s governing documents, article by article, and lets anybody search them. Every approved member can read them \u2014 a rule nobody may read is not one.'),
              p('An article has a number (\u201cArticle IV\u201d), a title, an optional summary, and either the text typed in, an uploaded document, or both.'),
            ],
          },
          {
            id: 'not-finished',
            heading: 'What the search can and cannot reach',
            blocks: [
              p('**This screen is scaffolding, and one part of it is genuinely unbuilt.** Reading the text out of a PDF or a Word file is not implemented, so:'),
              bullets(
                'An article whose text you **typed or pasted in** is searchable word by word.',
                'An article that is **only an uploaded PDF or Word file** is searchable by its title, its article number and its summary \u2014 not by what is inside it. It still uploads and still downloads.',
              ),
              p('Every article carries a badge saying which of the two it is, and a search that found nothing says so as well. That is deliberate: \u201cno result\u201d and \u201cnot indexed\u201d are different facts, and a reader who cannot tell them apart concludes the bylaws do not say a thing they do say.'),
              note('Until that is built, **pasting the text in is what makes an article findable**. The form says so where you would otherwise not think of it.'),
            ],
          },
          {
            id: 'searching',
            heading: 'Searching',
            blocks: [
              p('Whole words, and it understands endings \u2014 searching \u201cmeeting\u201d finds \u201cmeetings\u201d. Put a phrase in quotes to match it as one, and put a minus in front of a word to exclude it.'),
              p('Leave the box empty and press **Clear** to read them in order again, which is what the family\u2019s own numbering is for.'),
            ],
          },
        ],
      },
      {
        slug: 'gallery',
        title: 'Gallery',
        summary: 'Albums of the family\u2019s photographs \u2014 uploading a batch of them, tagging who is in each one, and finding them again.',
        route: '/community/gallery',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Albums, not a pile',
            blocks: [
              p('The [Gallery](/community/gallery) keeps photographs in **albums** \u2014 a reunion, a wedding, a year. An album has a name, an optional description, and any number of pictures.'),
              p('**Both can be changed afterwards.** Press the pencil beside the album\u2019s title, or the one in the corner of its tile on the Gallery page, and edit either. The photographs in it are untouched \u2014 see [who can change what](#who-can-change-what).'),
              p('It was called Photos and sat under Resources until 2026-08-22. Same screen, more of it.'),
              note('Only image files: JPEG, PNG, WebP or GIF, up to 10 MB each. A HEIC straight off an iPhone is refused, because no browser but Safari can display one \u2014 iOS converts to JPEG when you pick a file, so in practice this only bites a file you have copied off the phone yourself.'),
            ],
          },
          {
            id: 'uploading',
            heading: 'Adding photographs',
            blocks: [
              steps(
                'Open the album.',
                'Press **Add photographs**.',
                'Press **Choose files** and select as many as you like at once.',
                'Give them a caption if they share one \u2014 it applies to the whole batch.',
                'Press **Upload**.',
              ),
              p('**A batch is not all-or-nothing.** If one file is the wrong kind or too big, the rest still upload and the panel names the ones that did not, and why. You do not have to find the offending file and start again.'),
              p('**A large batch goes up a dozen at a time**, and the button counts them as they land \u2014 \u201cUploading 27 of 200\u201d. Leave the panel open until it finishes: closing the tab part-way keeps whatever has already arrived and stops the rest.'),
              p('The caption applies to every photograph in the batch, which is right for \u201cSaturday, at the lake\u201d and wrong for a picture that needs its own. Fix an individual one afterwards in the list view \u2014 see [changing a caption](#tidying).'),
            ],
          },
          {
            id: 'tidying',
            heading: 'Captions, tags, and the list view',
            blocks: [
              p('There are two ways to look at an album, and the toggle is above it. **Grid** is for looking: square thumbnails, and pressing one opens it full size. **List** is for tidying up: smaller pictures, one per row, with the caption and the tags editable in place.'),
              p('**Tagging** says who is in a photograph. Press **Tag somebody** on a row and search the family; the search finds \u201cJos\u00e9\u201d if you type \u201cjose\u201d and \u201cO\u2019Connor\u201d if you type \u201coconnor\u201d. Press the \u00d7 on a tag to take it off.'),
              p('Neither view hides anything: the filters above the album are what narrow it, and they narrow both \u2014 see [Finding one photograph](#finding).'),
            ],
          },
          {
            id: 'finding',
            heading: 'Finding one photograph',
            blocks: [
              p('Two filters sit above an album, and they narrow together.'),
              defs(
                { term: 'Search captions', text: 'Type any part of a caption. Several words match in any order, so \u201creunion lake\u201d finds \u201cThree days at the lake \u2014 2026 reunion\u201d. Accents and punctuation are ignored on both sides: \u201cjose\u201d finds \u201cJos\u00e9\u201d and \u201cgrandmas\u201d finds \u201cGrandma\u2019s\u201d. A photograph with no caption never matches a search.' },
                { term: 'Who is in it', text: 'Pick as many tagged people as you like. A photograph shows when it has ANY of them in it, so choosing three widens the result rather than narrowing it. The button carries a count while the filter is on, and only appears once somebody is tagged in this album.' },
              ),
              p('A line under the bar says how many of the album\u2019s photographs are showing and why, with **Clear filters** to put them all back. Neither filter changes anything for anybody else \u2014 it is what you are looking at, not what the album holds.'),
              p('**Searching across every album** is the second item on the [Gallery](/community/gallery) rail, beside **Albums**. It takes the same two things — words from a caption, and anybody tagged — and looks through the whole family’s photographs at once rather than one album. **Pressing a result opens the photograph**, and the arrows then move through everything the search found rather than through one album. The album name UNDER each result is a link, for when what you wanted to know was where the picture lives.'),
              p('The two searches behave differently on purpose. Inside an album, choosing three tagged people WIDENS the result: you get photographs with any of them in. On the Search rail, choosing three NARROWS it: you get only photographs with all three. The first is a filter over a set you are already looking at; the second is a question, and saying more about what you are looking for should return less.'),
            ],
          },
          {
            id: 'who-can-change-what',
            heading: 'Who can change what',
            blocks: [
              p('**A photograph belongs to whoever uploaded it.** They can change its caption and delete it. Anybody else needs the unrestricted grant on the Gallery \u2014 see [Who can do what](/help/who-can-do-what).'),
              defs(
                { term: 'Caption', text: 'Its uploader, or somebody with permission to edit anybody\u2019s.' },
                { term: 'Tags', text: 'Anybody who may edit the gallery. Tagging is not about whose photograph it is \u2014 it is about who is in it, and the person who recognises a cousin is often not the person who took the picture.' },
                { term: 'Delete a photograph', text: 'Its uploader, or somebody with the unrestricted grant. The image file is removed as well as the row.' },
                { term: 'Rename an album', text: 'Its creator, or somebody with permission to edit anybody\u2019s \u2014 the same rung as a caption, and deliberately one below deleting. The control is the pencil beside the album\u2019s title, and the one in the corner of its tile on the Gallery page. It changes the name and the description and nothing else.' },
                { term: 'Delete an album', text: 'Its creator, or somebody with the unrestricted grant \u2014 which is what an administrator holds. The control is the bin in the corner of the album\u2019s tile on the Gallery page. It takes every photograph in the album with it, and the image files too; the confirmation says how many before you commit.' },
              ),
              note('Deleting an album is not reversible and not partly reversible. The warning counts the photographs for exactly that reason.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'money',
    title: 'Money',
    blurb: 'What you owe, what the family has taken in, and how it is set up.',
    chapters: [
      {
        slug: 'summary',
        title: 'Summary',
        summary: 'Where you stand at a glance — what you owe, what you have paid, which drives are open, and what the family holds.',
        route: '/accounting/summary',
        sections: [
          {
            id: 'what-it-is',
            heading: 'A digest, not a screen of its own',
            blocks: [
              p('[Summary](/accounting/summary) shows the headline of each of the four things below it and names where the rest is. Nothing lives only here — every figure has a screen behind it, reached from the link beside its heading or from the **Accounting** section of the rail.'),
              defs(
                { term: 'Account Standing / Next Installments', text: 'What you owe and what the next payment comes to. In full on [Dues](/accounting/dues-and-donations).' },
                { term: 'Paid This Year', text: 'Your total for the year, broken down by schedule. In full on [Payment History](/accounting/payment-history).' },
                { term: 'Open donation drives', text: 'The drives still running. Closed ones are counted here and listed on [Donations](/accounting/dues-and-donations?pane=donations).' },
                { term: 'Family Funds', text: 'Every fund the family keeps and what each holds. There is no separate screen for this one.' },
              ),
            ],
          },
          {
            id: 'what-you-see',
            heading: 'Why a section might be missing',
            blocks: [
              p('Each of the four is granted separately, and Summary shows only the ones you hold. A section you cannot see is one your family has not given you — see [Who can do what](/help/who-can-do-what). If you hold none of them, the page says so rather than showing you empty headings.'),
              note('Whatever you have been granted, the money figures here are yours. Nothing on this page shows another member\'s dues, payments or giving. Family Funds is the exception in kind rather than in privacy: a fund balance belongs to the whole family, and it names nobody.'),
            ],
          },
        ],
      },
      {
        slug: 'my-dues',
        title: 'Dues & Donations',
        summary: 'Every schedule you are on and what the next payment has to be, and every drive your family is running.',
        route: '/accounting/dues-and-donations',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Two panes, one screen',
            blocks: [
              p('[Dues & Donations](/accounting/dues-and-donations) answers one question in two directions: what your family asks of you, and what it invites you to give to. **Dues** is every schedule you are on; **Donations** is every drive the family is running. Press either on the rail across the top.'),
              p('They were two separate screens until 2026-08-20. A link or a bookmark to either still finds the family\'s money — start from [Summary](/accounting/summary), which leads with both.'),
              p('Neither pane ever shows anybody else\'s dues or anybody else\'s giving, whatever you have been granted. Every figure on the screen is either a family total or your own. What the family as a whole has paid is a different question, asked on [Transactions](/reporting/transactions).'),
            ],
          },
          {
            id: 'schedules',
            heading: 'Your schedules',
            blocks: [
              p('The **Dues** pane lists every schedule you are on, in two tables: **Required dues**, which everybody on them owes, and **Optional dues**, which are yours to take on or decline. Each row says what the schedule costs a year, what the next payment has to be, when it falls, and what is left. The two cards at the top are the same ones [Summary](/accounting/summary) leads with.'),
              p('You only ever see a table you have a schedule in. A family that runs no optional dues shows one table and no empty heading — so a missing **Optional dues** table means there are none for you, not that something failed to load.'),
              p('**Every schedule you are on stays listed, including ones you have settled.** A due you have paid in full says **Paid** and shows a zero balance rather than disappearing — the tables are what you are on, and what you still owe is the **Due now** card underneath them.'),
              p('A row shaded and marked **Past due** is one the calendar has already asked for and the money has not covered. It is a marker rather than a warning: being behind is not an error, and the next payment simply carries the catch-up.'),
              p('Two other markers appear beside a schedule name. **Declined** is an optional due you have opted out of. **Not yet due** is a due that starts at an age you have not reached — see [Dues that start at an age](#age).'),
            ],
          },
          {
            id: 'next-payment',
            heading: 'Your next payment',
            blocks: [
              p('Two figures sit beside each other and they are not the same thing.'),
              defs(
                { term: 'Installment', text: 'What one payment costs once you are up to date.' },
                { term: 'Next due', text: 'What the next payment has to be, which includes anything the calendar has already asked for and the money has not covered.' },
              ),
              p('So switching to monthly halfway through the year on a $600 schedule makes the next payment large and every one after it ordinary — the catch-up is taken once and you are back on schedule. The catch-up is marked, and it is a marker rather than a warning: being behind is not an error.'),
            ],
          },
          {
            id: 'cadence',
            heading: 'Changing how often you pay',
            blocks: [
              p('Each schedule has a pay cadence you set for yourself — weekly, monthly, quarterly, annual, or one-time. The annual total does not change; the cadence divides it. The one you are on is printed under the amount on the row.'),
              p('To change it, open the row\u2019s menu — the button at the right-hand end — and press **Change pay cadence**. The dialog prices all five before you pick one: what each installment costs, and, where a switch would leave you catching up, what the very next payment would be.'),
              p('This is yours to set and needs no permission from anybody. Nobody else can set it for you.'),
            ],
          },
          {
            id: 'pay-online',
            heading: 'Paying by card',
            blocks: [
              p('Once your family has connected a card processor, every due you still owe carries a **Pay** button on its own row. It opens with the amount that is due now already filled in — change it if you want to pay more or clear the due entirely — and takes you to Stripe\u2019s own page to enter your card.'),
              p('The payment posts to the family\u2019s books as soon as it clears. There is nothing for a treasurer to key in afterwards, and it appears in your own payment history alongside anything recorded by hand.'),
              p('**Set up automatic payments**, in the row\u2019s menu, starts a standing card payment for that due at the cadence you have already chosen. It follows that cadence rather than asking again, so [changing your cadence](#cadence) is how you change what is taken. Each due is separate: setting one up says nothing about the others. A due you have set up says **Automatic** on its row, with what is taken and how often.'),
              note('Automatic payments are for dues only. A donation drive is a gift, and agreeing to give once is not agreeing to give every month — so drives are given to one at a time from the **Donations** pane.'),
              p('**Stop automatic payments**, in the same menu, ends them straight away, and everything already paid stays on your record. There is nothing to cancel elsewhere.'),
              note('No **Pay** button anywhere means your family has not connected a processor yet, or Stripe is still checking the account. Ask whoever keeps your family\u2019s accounting — it is the **Processing** section of [Accounting](/admin/accounting) — and pay by whatever means your family already uses in the meantime.'),
            ],
          },
          {
            id: 'due-now',
            heading: 'Paying everything at once',
            blocks: [
              p('**Due now**, under both tables, lists every due with something to pay and what each one comes to, then the total. It is what you would pay to be completely up to date today, catch-ups included — and a line carrying one says so underneath itself.'),
              p('**Pay … by card** takes the lot in one card payment. Stripe\u2019s page itemizes it, one line per due, so you can see what each part of the total is for before you commit — and it arrives in the family\u2019s books split the same way, one entry per schedule.'),
              p('The dialog lists every due with its own amount, so you can change any of them before paying. Set one to zero to leave it out of this payment; it stays exactly where it was.'),
              note('If your family has not connected a card processor, **Due now** still adds everything up — it just says so instead of offering a button. The figure is the same one to hand over by cheque.'),
            ],
          },
          {
            id: 'age',
            heading: 'Dues that start at an age',
            blocks: [
              p('A family can say that a due starts when a member reaches a particular age. Until then it sits at the bottom of your list marked **Not yet due**, with the date it starts and nothing to pay.'),
              p('The year you reach the age is charged by the month, and the month of your birthday is free: a $120 annual due and an eighteenth birthday in July is $50 that year, then $120 every year after. The row says so — **$50 this year · $120/yr after**.'),
              note('Somebody with no date of birth recorded owes the due in full, because the product will not guess at an age. If a due of yours should be reduced and is not, check your birthday on [My Profile](/personal-info).'),
            ],
          },
          {
            id: 'bloodline-dues',
            heading: 'Dues only the bloodline owes',
            blocks: [
              p('A family can restrict a due to the members descended from its line — a burial fund for the line, a cemetery plot. If one of your family\'s dues works that way and you married into the family, it is not yours and it does not appear on this screen at all.'),
              p('That is deliberate rather than an omission: a due you will never owe listed as something you are not paying would be a permanent note about how you joined the family, on your own screen. What you owe is what is here.'),
            ],
          },
          {
            id: 'chapter-dues',
            heading: 'Dues for one region or chapter',
            blocks: [
              p('A family can attach a due to one region or one chapter — a hall the Texas chapter rents, a scholarship the Eastern region funds. If a due of your family\'s belongs to a part of the family you are not in, it is not yours and does not appear on this screen, for the same reason a bloodline-only due does not.'),
              p('Your chapter is on [My Profile](/personal-info), and you set it yourself. **If you have not chosen one you are under National**: you owe every family-wide due and no regional or chapter one. So if you expected a chapter\'s due to show up here and it has not, the first thing to check is that your profile says which chapter you are in.'),
            ],
          },
          {
            id: 'opt-out',
            heading: 'Opting out',
            blocks: [
              p('**Opt out**, in the menu on a row of the **Optional dues** table, says the schedule does not apply to you — a fund you are not part of, a chapter you do not belong to. It asks you to confirm, and **Opt back in** in the same menu reverses it. Only an optional due offers it; nothing in the **Required dues** table can be declined.'),
              note('Opting out is not the same as having paid. It removes the schedule from your balance going forward; it does not erase what was already owed.'),
            ],
          },
          // ── THE DONATIONS PANE ────────────────────────────────────────────────────
          // These three were a chapter of their own, `donations`, while `/accounting/donations`
          // was a screen of its own. `20260820000009` merged that route into this one, and
          // `help:check` refuses two chapters claiming one route — correctly, because a reader
          // arriving from a screen has to land somewhere definite. So they are sections here.

          {
            id: 'drives',
            heading: 'What a drive shows',
            blocks: [
              p('The **Donations** pane of [Dues & Donations](/accounting/dues-and-donations?pane=donations) lists every drive the family has run, each with a bar showing how far it has got. Under the bar: what has been raised, what the goal was, and — only if you have given to it — how much of that was yours.'),
              p('A drive that has passed its goal keeps going rather than stopping at 100%: the bar rescales and the excess is shown as its own segment, because a drive that doubled its target should not look like one that scraped in.'),
              p('A drive with no goal set has no bar to draw, so it shows the running total instead.'),
            ],
          },
          {
            id: 'closed',
            heading: 'Closed drives',
            blocks: [
              p('A drive past its end date is marked **Closed** and dimmed, and it stays on this page. [Summary](/accounting/summary) lists only the open ones and counts the rest — a digest is about what to do next, and this page is the full record.'),
            ],
          },
          {
            id: 'giving',
            heading: 'Giving to one',
            blocks: [
              p('**Give**, on an open drive, takes you to Stripe\u2019s own page to enter your card. Type what you want to give — there is no set amount and no maximum, and the drive tells you what would meet its goal if it has one. It posts to the family\u2019s books as soon as it clears, and appears in your [payment history](/accounting/payment-history) alongside anything recorded by hand.'),
              p('Giving is one drive at a time and never recurring, which is the difference from paying dues. Agreeing to give once is not agreeing to give every month, and giving to one drive says nothing about the others.'),
              p('A gift goes whole into your family\u2019s **Donations** fund. It is not split across funds the way a dues payment is — see [Funds](/help/accounting#funds).'),
              note('A drive that has met its goal keeps taking gifts, and one that has **Closed** takes none. A closed drive shows no **Give** button because its total cannot move any more.'),
              note('No **Give** button on any drive means your family has not connected a card processor yet. Hand your gift to whoever keeps the books and it appears here once they record it.'),
              note('Nothing on this page says who gave what. Every figure is either a family total or your own.'),
            ],
          },
        ],
      },
      {
        slug: 'payment-history',
        title: 'Payment history',
        summary: 'Everything recorded against you, with its date, amount, method and status.',
        route: '/accounting/payment-history',
        sections: [
          {
            id: 'the-list',
            heading: 'The list',
            blocks: [
              p('[Payment History](/accounting/payment-history) is every payment the family has recorded against you — dues and donations in one list, each row tagged with which it was. Any column heading sorts, and the **Filter** box narrows by schedule, method or status.'),
              p('It is under **Accounting** in the rail, below **Dues & Donations** — those two are the same question at two scales, what you owe and what you have paid. [Transactions](/reporting/transactions) is its family-wide counterpart and is under **Reporting**. The two are the money read back — this one is yours, that one is the family\'s — while [Accounting](/admin/accounting) is where it is set up in the first place.'),
              p('Clicking a row opens the full entry: the cheque number or reference, any notes, and the date it was keyed in — which is not the same as the date it was paid, and is usually what explains why something only just appeared.'),
            ],
          },
          {
            id: 'reversals',
            heading: 'Corrections',
            blocks: [
              p('A payment entered wrongly is not edited or deleted. A correcting entry is posted against it with a negative amount, and both stay in the list, so the record explains itself rather than quietly changing.'),
              note('**Waived** means the family cancelled what was owed rather than that money moved. The amount still shows, because it comes off your balance and a balance that drops with no figure anywhere to match it is one you cannot check.'),
            ],
          },
        ],
      },
      {
        slug: 'transactions',
        title: 'Transactions',
        summary: 'The family\'s five ledgers — money in, money out, and money moving between funds.',
        route: '/reporting/transactions',
        sections: [
          {
            id: 'ledgers',
            heading: 'The five ledgers',
            blocks: [
              p('[Transactions](/reporting/transactions) is under **Reporting** in the rail, because reading the ledger back is what the screen mostly is. [Payment History](/accounting/payment-history) is the one under **Accounting** — your own payments rather than the family\'s whole record. It is one rail of five tabs, one per kind of entry.'),
              defs(
                { term: 'Dues', text: 'Dues paid by members.' },
                { term: 'Donations', text: 'Gifts to a drive.' },
                { term: 'Contributions', text: 'Money arriving in a fund — routed there automatically, or recorded by hand.' },
                { term: 'Disbursements', text: 'Money paid out of a fund.' },
                { term: 'Transfers', text: 'Money moved from one fund to another. It nets to zero family-wide; what changes is which pot holds it.' },
              ),
              p('Each tab is separately granted, so a family can let somebody record dues without letting them pay money out. A tab you cannot see is one you have not been given.'),
            ],
          },
          {
            id: 'recording',
            heading: 'Recording something',
            blocks: [
              p('Each ledger has its own button at the top right — **New Dues Payment**, **New Donation Payment**, **New Contribution**, **New Disbursement**, **New Transfer** — which opens a form for that kind of entry: who, how much, what for, and how it was paid. The person and the fund come from pickers rather than free text, so nothing lands against a name that does not exist.'),
              p('Recording is a permission of its own on every ledger — being able to see a ledger does not let you add to it.'),
            ],
          },
          {
            id: 'reversals',
            heading: 'Correcting a payment',
            blocks: [
              p('A recorded payment is not edited or deleted — **Reverse** on its row posts a correcting entry against it, and the original is marked as reversed. Both entries stay, so the history explains itself.'),
              p('Reversing is its own permission, deliberately separate from recording.'),
            ],
          },
        ],
      },
      {
        slug: 'dues-projections',
        title: 'Dues Projections',
        summary: 'What the family should collect this year, what has come in, and who still owes.',
        route: '/reporting/dues-projections',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Transactions](/reporting/transactions) is what came in. This is what should: every active dues schedule, multiplied out across the members who owe it, set against what has actually been collected.'),
              p('Nothing on this screen changes anything. Recording a payment or waiving one is on [Transactions](/reporting/transactions); changing what a due costs is under [Accounting](/admin/accounting).'),
              p('**A relative who has died is not counted.** Setting a **Sunset Date** on somebody’s profile takes them off this screen entirely — they owe nothing, so neither the total the family is owed nor the list of who has still to pay includes them. Payments they made in the past still count toward what was collected.'),
            ],
          },
          {
            id: 'figures',
            heading: 'The four figures',
            blocks: [
              defs(
                { term: 'Expected this year', text: 'What the members counted here owe for their schedules\' current periods. Everything else on the screen is a fraction of it.' },
                { term: 'Collected', text: 'Money that actually arrived. A reversal nets itself out, so a corrected payment leaves the figure where it belongs.' },
                { term: 'Waived', text: 'Forgiven. It settles the due and comes off what is still owed — and it is never counted as money, because none arrived.' },
                { term: 'Still to collect', text: 'Expected, less what has been settled either way. The number the screen exists for.' },
              ),
              p('A fifth appears only when there is any: money **awaiting settlement**, which is a payment started and not yet confirmed. It is not counted as collected and has not been taken off what is owed.'),
            ],
          },
          {
            id: 'year',
            heading: 'Which year',
            blocks: [
              p('Each schedule\'s own. A due anchored on 1 April and a levy anchored on 1 January genuinely have two years in progress, so every row states the period it was measured over and the family total is the sum of them.'),
              note('This is why the totals here agree with what each member sees on their own [Dues](/accounting/dues-and-donations) screen. A single calendar year would have been tidier and would have disagreed with every member\'s balance.'),
            ],
          },
          {
            id: 'who-is-counted',
            heading: 'Who is counted',
            blocks: [
              p('Everybody the family has approved — the same list the [Member Directory](/community/directory) shows. Somebody recorded on the [family tree](/community/family-tree) who has never signed in owes their dues exactly as much as anybody else does, so they are counted. Leaving them out never made the debt smaller; it made this screen report a smaller one.'),
              p('The **Status** column answers a different question from the money: whether there is anybody to send an invoice to.'),
              defs(
                { term: 'Active', text: 'They have an account, and the due shows on their own [Dues](/accounting/dues-and-donations) screen.' },
                { term: 'Invited', text: 'No account yet, and an invitation is still open. The family has asked, and the ball is with them.' },
                { term: 'Pending Invite', text: 'Recorded in the family and never asked to join. This is the one of the three you can act on — invite them from the [family tree](/community/family-tree).' },
              ),
              note('An invitation that has **expired** reads as Pending Invite rather than Invited. An expired link cannot be accepted, so the family has to ask again, and saying otherwise would report work as done.'),
              p('**Still to collect** says underneath it how much of itself is owed by people with no account. That is part of the total and never a deduction from it: the family is owed the money whether or not there is an inbox to send the bill to.'),
              p('Five things reduce what somebody owes, and all five are honoured: a due that starts at an age, a due only the bloodline owes, a due for one region or chapter, an optional due they have declined, and anything the family has waived.'),
              note('Anyone with no date of birth recorded owes an age-limited due in full, because an age is never guessed at. If a figure looks too high, that is the first thing to check.'),
              note('Somebody still waiting to be approved is **not** counted. They have not joined the family yet, so nothing is owed by them.'),
            ],
          },
          {
            id: 'standings',
            heading: 'Where each member stands',
            blocks: [
              p('The member table leads with the people to chase. A row reports the **least** settled standing that member holds on any schedule, so somebody paid up on three dues and owing a fourth is listed as owing.'),
              defs(
                { term: 'Nothing paid', text: 'Owes the whole amount for this period.' },
                { term: 'Part paid', text: 'Something in, not all of it.' },
                { term: 'Settled', text: 'Paid in full, or forgiven.' },
                { term: 'Declined', text: 'Opted out of an optional due.' },
                { term: 'Not yet due', text: 'Below the age that due starts at. Not the same as settled — they have paid nothing and owe nothing.' },
                { term: 'Not theirs', text: 'The due is restricted to the bloodline and this member is outside it. Unlike "Not yet due", it will never become theirs.' },
                { term: 'Elsewhere', text: 'The due is for one region or chapter and they are in another — or in none, which puts them under National. Unlike "Not theirs", this one changes if they change chapter.' },
              ),
              note('**Standing** and **Status** are two different columns, and the row worth looking at is one that is both Nothing paid and Pending Invite. Standing is about the money; Status is about whether anybody can be asked for it.'),
              note('A bloodline-only due on a family that has not named its line is owed by nobody, and its row says so rather than showing an unexplained $0.00 expected.'),
              p('**Only those who owe** narrows the table, and the filter box searches any part of any name.'),
            ],
          },
          {
            id: 'reminders',
            heading: 'Automatic reminders',
            blocks: [
              p('On a Premium plan the product emails each member a reminder as an installment falls due, and the band at the top of this page is where you see whether those are landing. It is the only place that says so — nothing else in the product mentions a reminder after it has gone.'),
              defs(
                { term: 'Sent', text: 'It went out. Nobody is reminded twice about the same installment.' },
                { term: 'Waiting to send', text: 'Queued, and the next daily run will take it.' },
                { term: 'Already paid', text: 'The installment was settled after the reminder was queued, so it was never sent. This is the product declining to chase somebody for money the family already had, and it is not a failure.' },
                { term: 'No address', text: 'The relative has a placeholder address rather than a real one, so there is nowhere to send it. Not a failure either — and the one state worth acting on.' },
                { term: 'Failed', text: 'The send was attempted and refused. It is retried on later runs.' },
              ),
              p('**Cannot be reached by email** names the relatives behind the No address figure, because a count tells you the problem exists and a name is what lets you fix it. Inviting them from the [family tree](/community/family-tree), or adding an address to their record, is the fix — and it is worth doing well beyond dues, since a relative with no address hears nothing the family sends.'),
              note('A reminder has no consequence attached. There is no late fee, no lockout and no ladder of escalating notices anywhere in this product — it is one email saying an installment is due. What a family owes GENORRA for its own plan is a separate thing entirely, and that one does have consequences: see [Settings](/admin/settings).'),
              note('The band is Premium. On any other plan there are no reminders to report on, so it is absent rather than empty — and it is only shown to somebody who can see the family’s Accounting, because how the family chases its money is a treasurer’s business.'),
            ],
          },
        ],
      },
      {
        slug: 'p-and-l-summary',
        title: 'P&L Summary',
        summary: 'What the family has collected, what it has paid out, and what each fund holds.',
        route: '/reporting/pl-summary',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('The family\'s statement, on one page: everything that has come in, everything that has gone out, and the difference between them. [Transactions](/reporting/transactions) is the entry-by-entry ledger this is a summary of, and [Dues Projections](/reporting/dues-projections) is what is still owed — this screen is only about money that has actually moved.'),
              p('**Every figure is life to date.** There is no date range to set: the page counts every entry the family has ever recorded, from the first one. The line at the top of the page says so, and it is worth reading before a figure goes into a report.'),
              note('This screen was called **Family Finances** until August 2026. Nothing about it moved except the name and where it sits in the rail — it is under **Reporting** now, with the other screens that read the money back.'),
            ],
          },
          {
            id: 'three-lines',
            heading: 'The three figures at the top',
            blocks: [
              defs(
                { term: 'Income', text: 'Everything collected. Dues and donations together — both are payments recorded against a member — plus contributions made straight into a fund. The two are split out underneath the figure.' },
                { term: 'Expenses', text: 'Money disbursed from a fund. That is the only kind of outgoing this product records, so it is the whole of what has been spent.' },
                { term: 'Net surplus', text: 'Income less expenses. It reads **Net deficit** and turns red when more has gone out than has come in.' },
              ),
              p('A reversal corrects itself here. Reversing a payment on [Transactions](/reporting/transactions) posts an opposite entry, and both the payment and its reversal are counted — so income lands back where it belongs rather than counting the correction twice.'),
            ],
          },
          {
            id: 'unrouted',
            heading: 'Collected, not yet routed to a fund',
            blocks: [
              p('Dues arrive as a payment and are then **routed** into one or more funds by the rules set up under [Accounting](/admin/accounting). Where no rule covers a schedule, the money is collected and sits in no fund — and this line is how much.'),
              p('It is not an error and is not shown as one. Money is unallocated until somebody allocates it, and a family running a single pot with no routing at all is running perfectly well. It is here so that a family which *meant* to route something can see that it did not.'),
              note('The figure can read **Routed beyond dues income**, which is the same line the other way round: an administrator may contribute straight into a fund, so more can have gone into funds than dues ever brought in.'),
            ],
          },
          {
            id: 'funds',
            heading: 'Fund balances, and why they do not add up to the net figure',
            blocks: [
              p('**Fund balances today** is what each fund holds right now. **Net surplus** is income less expenses over the family\'s whole history. They are two different kinds of number and they are not expected to match.'),
              p('Three ordinary things separate them: dues that were never routed into a fund, contributions made straight into one, and transfers between funds. None of them is a fault, and the page states this rather than leaving somebody to reconcile the two and conclude that one is broken.'),
              p('**Income Routed to Funds** in between shows where the routed money went, fund by fund; opening a row breaks it down by what it came from.'),
            ],
          },
        ],
      },
      {
        slug: 'membership',
        title: 'Membership',
        summary: 'Members by region and chapter, who has finished joining, and adults against minors.',
        route: '/reporting/membership',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('How the family is made up today. The [Member Directory](/community/directory) lists your relatives one by one; this counts them — where they are, how many have finished joining, and how many are children.'),
              p('Nothing here is stored. Every figure is worked out when the page loads, so it is always today\'s answer and there is no history to compare against.'),
              p('**Who is counted:** every member the family has approved, and nobody else. Somebody still waiting in [Pending Approval](/admin/members) has not joined yet, and a relative recorded as having died is not counted either. A relative who has never signed in *is* counted — they are part of the family whether or not they have an account, which is the same rule [Dues Projections](/reporting/dues-projections) uses, so the two screens always agree on the size of the family.'),
            ],
          },
          {
            id: 'drilling-in',
            heading: 'Pressing a row to see who is in it',
            blocks: [
              p('**Every row beside every chart opens.** Press one and it lists the people it counted, with a filter box once there are more than a handful of them. That includes the rows the chart folded into **Other** and the ones standing at zero, because the table beside a chart always lists every slice.'),
              p('It is the ROW rather than the slice of the ring: a ring draws five slices and folds the rest, so the row is the only thing that can open every one of them. It is also a real button, so it can be tabbed to and pressed with the keyboard.'),
              p('**Names are fetched when you press, and not before.** The charts themselves carry counts and place names and no names at all, which is why this report is not an administrator-only screen. Opening one row asks for that one group.'),
              note('You need the [Member Directory](/community/directory) as well as this report to see who is in a group. A family that has restricted the Directory has decided who may read its members\' names, and a chart does not go around that — if you hold one and not the other, the figures open and the names do not.'),
            ],
          },
          {
            id: 'putting-it-right',
            heading: 'Putting right what a chart is pointing at',
            blocks: [
              p('**Three of the four charts offer one repair each, on the row that needs it.** Each is the same action the screen that owns it uses, so every rule that screen enforces holds here too.'),
              defs(
                { term: 'No chapter, and National', text: 'Set that person\'s chapter. Their region follows it — there is no separate region to set, because a region is a property of the chapter. Their sons and daughters under eighteen with no account of their own move with them, exactly as on [My Profile](/personal-info).' },
                { term: 'Pending invite, and Invited', text: 'Send them an invitation. It asks for a real email address, because a relative with no account holds a placeholder one that cannot receive mail. Pressing it on an Invited row sends a fresh invitation, which is what chasing an unanswered one means.' },
                { term: 'Birthday not recorded', text: 'Record their date of birth. Adult or minor is worked out from it every time the report loads; nothing about their age is stored.' },
              ),
              p('**Only those rows offer anything**, and that is deliberate: somebody already in the Austin chapter is not a problem the chart is reporting, and **Active** cannot be invited because they can already sign in. A row with nothing to repair still opens and still lists.'),
              p('**One person at a time.** There is no "file all of these in Austin" button, because each of these is a statement about one person — which chapter they are really in, when they were really born, whether to ask them to join — and setting a chapter moves their young children with them.'),
              note('The two repairs are two permissions. Setting a chapter and recording a birthday need permission to edit members; sending an invitation needs permission to edit the family tree. If a row lists people and offers no control, the panel says which of the two you have not been given.'),
            ],
          },
          {
            id: 'places',
            heading: 'By region and by chapter',
            blocks: [
              p('Two breakdowns, one above the other in the family\'s structure. **Nationally** at the top is the whole family — that figure is what every percentage on the page is a share of.'),
              p('**National** also appears as a slice of the region breakdown, and it means the same thing there: the absence of a region. Somebody in no chapter, and somebody whose chapter has not been put in a region, are both under National. **No chapter** is the matching slice on the chapter breakdown.'),
              p('**Every chapter the family has set up is listed, including any nobody has joined.** A chapter standing at zero is usually the row worth looking at — either nobody has been put in it yet, or it is no longer needed. Regions and chapters are set up under [Members](/admin/members), on its **Organization** tab.'),
              note('Where there are more places than the chart can show clearly, it draws the largest five and folds the rest into **Other**, saying how many that stands for. The table beside the chart always lists every one of them.'),
            ],
          },
          {
            id: 'invitations',
            heading: 'Who has finished joining',
            blocks: [
              p('The same three states [Dues Projections](/reporting/dues-projections) reports, counted rather than listed.'),
              defs(
                { term: 'Active', text: 'They have an account and can sign in.' },
                { term: 'Invited', text: 'No account yet, and an invitation is open and unanswered. The family has asked; the ball is with them.' },
                { term: 'Pending invite', text: 'Recorded in the family and never asked to join. This is the one you can act on — press the row and invite them from there, or from the [family tree](/community/family-tree).' },
              ),
              p('**Can sign in** at the top of the page is the Active figure by another name, and **Never invited** beside it appears only when there is anybody in the third group. Between them they say how much of the family can actually be reached — which is the figure to look at before sending anything to everybody.'),
              note('An invitation that has **expired** counts as Pending invite, not Invited. An expired link cannot be accepted, so the family has to ask again.'),
            ],
          },
          {
            id: 'ages',
            heading: 'Adults and minors',
            blocks: [
              p('Worked out from each member\'s date of birth, every time the page loads — so it is right on the morning of a birthday and needs nothing kept up to date.'),
              p('**Birthday not recorded** is its own slice, and it is not folded into either of the others. Most family trees have plenty of relatives with no birthday recorded, and counting them as adults would report a precision the records do not have.'),
              note('That slice is worth watching if the family has a due that starts at an age: a member with no date of birth owes it in full, because an age is never guessed at.'),
            ],
          },
        ],
      },
      {
        slug: 'accounting',
        title: 'Accounting',
        summary: 'Setting up dues schedules, donation drives, funds, routing and milestones.',
        route: '/admin/accounting',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Setup, not the day\'s work',
            blocks: [
              p('[Accounting](/admin/accounting) is where the money is *configured*. Recording an actual payment happens on [Transactions](/reporting/transactions), under **Accounting** in the rail. Each section here is its own permission, so maintaining the dues schedule and paying money out are different jobs.'),
              p('The rail across the top of the page holds **Dues**, **Donations**, **Funds**, **Routing**, **Milestones**, **Processing** and **Bank Information**. Each is granted separately, so you see the ones you have been given and no others — a rail with three items on it is not a fault. The **New Dues** and **New Donation** buttons sit beside the rail on their own pages, and appear only where you may add to that list.'),
              p('**They are still two separate permissions, and sharing a pane changed nothing about that.** A family that lets somebody keep the dues schedule but not run the donation drives grants one and not the other, and that person sees one list, one button, and a rail item named for the half they hold. It is one screen because the two are read together, not because they are one job — see [Who can do what](/help/who-can-do-what#one-template).'),
            ],
          },
          {
            id: 'dues',
            heading: 'Dues',
            blocks: [
              p('A dues schedule is what a member owes over a year: a name, an amount, how often it is natively billed, and which fund it lands in. Members then choose their own cadence within it.'),
              p('The start date matters. It anchors the ladder of due dates, and the form prefills today — which is fine, and worth a moment\'s thought if you are entering last year\'s schedule.'),
              p('**Members start paying at age** is how a family says the children do not pay. Leave it blank and everybody owes the due whatever their age. Put 18 in it and a member owes nothing until they turn 18, then the months of that year after their birthday, then the full amount every year afterwards — a $120 due and a July birthday is $50 that year. The row shows it as **From age 18+**.'),
              note('A member with no date of birth recorded owes the due in full, because the product will not guess at an age. Adding a child to the [family tree](/community/family-tree) without an email address asks for a birthday for exactly this reason.'),
              p('**Who owes it** narrows a due by the bloodline, and it has three answers. **All members** is the default. **Bloodline only** restricts it to the relatives ticked as being in the family’s line — anybody who married in owes nothing and does not see it on their own Dues screen at all, because a due that is never theirs is not listed as something they are not paying. **Relatives who married in only** is the mirror of that, for a family that levies one due on its descendants and a different one on everybody else.'),
              note('The control is unavailable until somebody in your family has been ticked as being in its bloodline. Tick **is in the family’s bloodline** on a relative’s card on the [family tree](/community/family-tree) first. Who owes the due is exactly who is ticked, so ticking somebody later adds them to it — and with nobody ticked at all, **Bloodline only** would be owed by nobody while **Relatives who married in only** would be owed by everybody, which is why the choice is held back until the question has an answer.'),
              p('**Owed by** says which part of the family owes it: National — the whole family — or one region, or one chapter. It only appears once your family has a region or a chapter to choose; until then every due is National, which is what National means. A member with no chapter is under National and owes nothing scoped, so a chapter due bills only the people who have said they are in that chapter. See [regions and chapters](/help/regions-and-chapters#dues).'),
              note('A schedule that has been paid against cannot simply be deleted, and its amount, frequency, start date, starting age, bloodline setting and **Owed by** are then fixed — every payment already recorded was made against those terms. Changing who owes a due would restate whether people owed it for periods already billed, which is why it is on that list. The page tells you when one is in use. The end date can still change.'),
              p('**Where a payment lands** decides which fund the money goes into. Leave it on **Split across the funds** and a paid due is divided by your [Routing](/admin/accounting) table, which is what every schedule did before this existed. Pick a fund instead and the WHOLE payment goes there and routing is skipped — which is what a levy raised for one thing wants, so the fund’s balance answers how much has been raised for it.'),
              note('This one is NOT frozen once payments exist, unlike the amount and **Who owes it**. It only decides where the NEXT payment goes; nothing already in a fund moves. And if you later delete the fund, the schedule quietly goes back to splitting across the funds — so if a due has to land somewhere in particular, check it after removing any fund.'),
            ],
          },
          {
            id: 'donations',
            heading: 'Donations',
            blocks: [
              p('A donation drive is a target the family gives towards. It can name who it is for, which is what puts a face on it — "this is for Martha\'s medical costs" rather than "General Fund".'),
            ],
          },
          {
            id: 'funds',
            heading: 'Funds',
            blocks: [
              p('Funds are the pots money sits in. Each has a balance, what has come in, and what has gone out.'),
              p('The new-fund form asks for a **Minimum Balance**, and it is the one number that actually does something: an incoming payment tops each fund up to its minimum, in the order set under **Routing**, before anything below it receives a share. It is how a family says "this one is not for spending". Leave it blank for a fund with no floor, and change it later on the Routing pane, where it sits beside the order the funds fill in.'),
            ],
          },
          {
            id: 'routing',
            heading: 'Routing',
            blocks: [
              p('Routing decides how an incoming payment is split between funds — 70% to General, 30% to Scholarship, and so on. Set it once and every payment recorded afterwards follows it, instead of somebody dividing it up by hand each time.'),
              p('**The built-in Donations fund can take a share too.** It is on the list like any other fund, so a family that wants part of its dues going to the general pot can say so. It sits last in priority, which matters when nothing has been set: the share goes to the fund at the top of the list, and Donations is never at the top unless it is the only fund your family has.'),
              note('A donation is different and does not follow this table. A donation goes wholly into the Donations fund, which is what that fund is for; routing is about DUES.'),
            ],
          },
          {
            id: 'milestones',
            heading: 'Milestones',
            blocks: [
              p('What the family pays out for an occasion — a graduation, a wedding, a bereavement — and which fund it comes from. Pricing it in advance is what turns "we usually give something" into a figure the treasurer can act on.'),
            ],
          },
          {
            id: 'processing',
            heading: 'Processing',
            blocks: [
              p('**Processing** is where your family connects its own Stripe account, so relatives can pay their dues by card instead of writing a cheque. Press **Connect a Stripe account** and Stripe collects everything it needs on its own pages; when you come back, this pane says whether card payments are switched on.'),
              p('**Which country you pick decides which currency your family collects in.** The **Country** control on this pane sets both: pick Canada and your dues, funds and gathering budgets are all recorded in Canadian dollars, and relatives are charged in Canadian dollars. It is one choice rather than two, so the money your family asks for and the money that reaches its bank are always the same number.'),
              note('**Both are settled once either a payment has been recorded or the Stripe account has been created, and neither can be undone.** Stripe cannot move a connected account to another country, and your family’s ledger cannot be re-denominated after the fact — a hundred rows saying $40 would have to mean two different things. The pane says which of the two settled it. Pick the country before you record your first payment.'),
              p('**The account belongs to your family, not to GENORRA.** Money goes straight to your family\'s bank, Stripe\'s processing fees come out of your family\'s side, and your family keeps its own Stripe dashboard, its own payout schedule and its own refunds. GENORRA takes no share of what your family collects.'),
              note('**You will never be asked for a Stripe key, and you should never give one to anybody.** GENORRA stores only your account\'s id — enough to send a payment to you, and useless to anyone on its own. If a screen ever asks you to paste a key that begins `sk_`, it is not this product.'),
              p('A card payment posts to the family\'s books the moment it clears and splits across your funds by the same **Routing** table a payment keyed in by hand follows. Nobody has to enter it afterwards, and it appears in [Transactions](/reporting/transactions) beside everything else.'),
              p('**Check with Stripe** asks Stripe for the account\'s current state, which is worth pressing if you have just finished something on their side. Until it says card payments are on, members see no **Pay online** section at all — better than a button that fails once somebody has decided to pay.'),
              note('**Disconnecting stops every member\'s automatic payment as well, and those cannot be restarted.** Reconnecting brings the same Stripe account back with its history and bank details exactly as they were — but each relative who was paying automatically has to set their payment up again, because the arrangement was cancelled at Stripe rather than paused. The panel says how many people that is before you confirm. Nothing already recorded is removed, and your family\'s own Stripe account is untouched — this only stops GENORRA using it.'),
              p('**Because of that, disconnecting asks for two things.** First your sign-in password, so it cannot happen by accident or by somebody sitting at an unlocked screen. Then a six-digit code emailed to the address you sign in with — not to an address you type, and not to anybody else. The code lasts fifteen minutes, works once, and cancels itself after five wrong tries. It is the same gate as [removing a family](/help/family-settings#removal), and it is there for the same reason: the part you can undo hides a part you cannot.'),
              p('If your family has disconnected, the pane says so and the button reads **Reconnect Stripe** rather than **Connect a Stripe account** — because it really is the same account coming back, not a new one being made.'),
              p('**Who pays Stripe’s fee is your family’s choice, and it is on this pane.** Card payments cost a percentage plus a few cents, every time. **The family absorbs it** is the default: a relative who owes $40 is charged $40, and the fee comes back out of the funds that payment was routed into — so the funds receive slightly less than the amount recorded. **The member covers it** charges them a little more instead, so the funds receive the whole $40. The pane works the example with your own rate as you type it, because the answer is not the one most people expect: grossing up $40 at 2.9% + 30c is $41.50, not $41.46, since the fee applies to the larger charge too.'),
              note('**The rate you type is only used to quote a charge; it is never used as the fee.** What Stripe actually took is read back from Stripe on every payment, and that is the figure your books use. So a rate that is slightly wrong costs your family a few cents per payment rather than putting a wrong number in the ledger — and the pane prints what has really been charged next to your stated rate, which is the only way anybody would notice.'),
              p('**Two fee totals appear here and they answer different questions.** The first is what GENORRA recorded — the fees on the payments this product posted, which is what [P&L Summary](/reporting/pl-summary) counts as an expense. **Show Stripe’s own total for this account** asks Stripe, and it will be larger if your family has used its Stripe account for anything else, or if Stripe bills the account directly for monthly billing or fraud tools. Those charges are deliberately NOT in your family’s books: GENORRA never counted the income they relate to, so counting the cost would make the report wrong in the other direction. For the itemised bill, sign in to your own Stripe dashboard.'),
            ],
          },
          {
            id: 'not-yet',
            heading: 'Bank Information',
            blocks: [
              p('The section exists on the rail and is not wired up yet. It is where the family\'s own bank details will live — the account dues are deposited into, and that disbursements are paid from. Nothing is stored in it today.'),
              note('Connecting a card processor under **Processing** does not need this, and does not fill it in: Stripe holds the bank details you give it, and this section is for writing down the numbers a treasurer would otherwise have to look up for a cheque or a transfer.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'reports',
    title: 'Reports',
    blurb: 'What the family DOES, read back \u2014 the work, the elections, the meetings and the offices.',
    chapters: [
      {
        slug: 'gatherings-report',
        title: 'Gatherings Report',
        summary: 'Every gathering with how much of its work is done, what is overdue, and what its tasks claim against the budget.',
        route: '/reporting/gatherings',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Gatherings](/reporting/gatherings) under **Reporting** is one row per gathering: how many of its tasks are approved, how many are late, how many nobody is holding, and \u2014 where you can see the money \u2014 what its task lines add up to against what it budgeted.'),
              p('It changes nothing and creates nothing. Every row links into [Gatherings](/gatherings), where the thing itself lives.'),
              note('**Cancelled gatherings are left out entirely**, rows and totals alike. Their open tasks are not work anybody owes, and counting them would leave a family that cancelled one thing permanently in the red on every figure here.'),
            ],
          },
          {
            id: 'overdue',
            heading: 'What counts as overdue',
            blocks: [
              p('A task is overdue when **its date has passed and nobody has approved it**. That includes one that has been submitted and not yet ruled on \u2014 the work may well be done, but it is still outstanding from the organizer\u2019s side, and this is the organizer\u2019s report. A task sent back counts too.'),
              p('**A task with no due date is never overdue.** Nothing was promised for a particular day, so there is no day it can be late relative to.'),
            ],
          },
          {
            id: 'money',
            heading: 'The money columns',
            blocks: [
              p('**Allocated** is what the gathering\u2019s task lines claim, shown against what the gathering set aside. It is marked when the lines claim more than the budget \u2014 which is a plan to fix rather than an error, so it is not shown in red.'),
              note('The two money figures appear only if your family is on a plan that includes the gathering budget band and you have been granted it. Without either, the columns are simply not there \u2014 a column of dashes would be a claim that the family budgeted nothing.'),
            ],
          },
        ],
      },
      {
        slug: 'elections-report',
        title: 'Elections Report',
        summary: 'Turnout per election, how many stood, and which offices nobody put a name forward for.',
        route: '/reporting/elections',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Elections](/reporting/elections) under **Reporting** is one row per published election: which area it covers, what phase it is in, how many nominations it drew and how many were accepted, and what the turnout was.'),
              note('**Drafts are not counted.** A draft has no dates, no ballot and no electorate, so a 0% turnout row for one would be a report about an election nobody has been told about.'),
            ],
          },
          {
            id: 'turnout',
            heading: 'How turnout is worked out',
            blocks: [
              p('**Turnout counts people, not ballots.** Somebody voting for three offices in one election is one voter. The bottom half of the figure is who could have voted: every approved member for a national election, the members of one chapter for a chapter election, and the members of every chapter in a region for a regional one \u2014 the same rule that decides who sees the election in the first place.'),
              p('An election whose area holds no approved members reads **n/a** rather than 0%. Nobody could have voted in it, and 0% would read as an election everybody ignored.'),
            ],
          },
          {
            id: 'unopposed',
            heading: 'Offices nobody stood for',
            blocks: [
              p('An office with no **accepted** nomination has nothing on the ballot. A nomination the nominee has not accepted does not count \u2014 it puts no name in front of anybody.'),
              p('This is the figure worth acting on before the nomination window closes, which is why it is one of the four at the top of the page.'),
            ],
          },
        ],
      },
      {
        slug: 'meetings-report',
        title: 'Meetings Report',
        summary: 'How often the family meets, how big each room was, and who answers when a vote is called.',
        route: '/reporting/meetings',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Meetings](/reporting/meetings) under **Reporting** has two tables. The first is one row per meeting \u2014 its date, who took the minutes, how many were in the room, how many topics it took up and how many votes were cast. The second is one row per relative: how many meetings they were asked to, how many they voted in, and how many they minuted.'),
              p('Every meeting row links into [Meeting Minutes](/library/meeting-minutes), which is where the record itself lives.'),
            ],
          },
          {
            id: 'not-attendance',
            heading: 'Why nothing here says \u201cattendance\u201d',
            blocks: [
              p('**Nothing in GENORRA records who actually turned up.** There is no check-in. So this reports the two things it can count and neither of them is attendance:'),
              defs(
                { term: 'Asked to', text: 'The attendee list \u2014 who was invited when the meeting was scheduled.' },
                { term: 'Voted in', text: 'How many of those meetings the person answered a vote in. It is the only positive evidence anybody was in the room, and it is a floor rather than a count: a quiet meeting with no vote called produces none of it.' },
              ),
              p('Averaging the two into an attendance rate would be a figure no row in the database supports \u2014 and it is exactly the sort of number that gets quoted in a meeting a year later.'),
            ],
          },
          {
            id: 'minuted',
            heading: 'Minuted against held',
            blocks: [
              p('**Minuted** counts the meetings somebody has closed. Closing is what turns a meeting into a record \u2014 no more topics, no more notes, no more votes \u2014 so the gap between the two figures is the family\u2019s backlog of meetings nobody has signed off.'),
            ],
          },
        ],
      },
      {
        slug: 'board-report',
        title: 'Board & Offices Report',
        summary: 'Every office the family has defined, who holds it, and which ones are standing empty.',
        route: '/reporting/board',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Board & Offices](/reporting/board) under **Reporting** lists every board position the family has defined, in the family\u2019s own order, with whoever holds it \u2014 and, where nobody does, the word **Vacant**.'),
              p('It changes nothing. Defining a position and handing it out is **Members \u2192 Organization**, which is a separate permission.'),
              note('That separation is the point of this screen existing at all: a nominations committee can be shown where the gaps are without being given the power to change the roster.'),
            ],
          },
          {
            id: 'vacancies',
            heading: 'Vacancies are the finding',
            blocks: [
              p('**Every position is a row, including the empty ones**, and **Vacant** is one of the four figures at the top. A report that listed only filled offices could not state its most useful fact.'),
              p('The rows stay in the family\u2019s own order rather than putting the vacancies first, so this can be read side by side with the list on **Members \u2192 Organization**. The colour is what makes a gap findable.'),
            ],
          },
          {
            id: 'two-hats',
            heading: 'Holding more than one office',
            blocks: [
              p('A section appears when somebody holds two or more. That is not a problem in itself \u2014 a small chapter often has one person doing two jobs \u2014 but it is usually the sign of a gap somebody has quietly covered, which is worth knowing before the next election.'),
              note('An office held for a particular region or chapter says which beside the name. The same title at two levels is two different offices: a National President and a Chapter President are separate rows.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'admin',
    title: 'Running the family',
    blurb: 'Who is in the family, what each of them may do, how it is divided up, and what it is called.',
    chapters: [
      {
        slug: 'members-and-access',
        title: 'Members',
        summary: 'The roster, the approvals queue, invitations, and the permission templates behind them.',
        route: '/admin/members',
        sections: [
          {
            id: 'tabs',
            heading: 'Four tabs, four jobs',
            blocks: [
              defs(
                { term: 'Members', text: 'Everybody with an account: which permission template each is on, and which board position each holds. Four columns — Name, Position, Chapter and Group — with everything else about a person behind their name, exactly as on the [Directory](/help/directory#columns). A switch above the table also lists the **Records** — see [records](#records).' },
                { term: 'Organization', text: 'What shape the family is: its regions and chapters, and the board positions it keeps. It sits second because the regions and chapters are what the Members table\'s Region and Chapter columns are read against. Two chapters cover it: [Organization](/help/regions-and-chapters) and [Board Positions](/help/board-positions).' },
                { term: 'Pending Approval', text: 'The people asking to join, and the invitations you have sent.' },
                { term: 'Permission Templates', text: 'The templates themselves, and what each one grants.' },
              ),
              p('The four are granted separately and the page opens for any of them — somebody can work the approvals queue without being able to edit templates, and somebody can keep the family\'s chapters in order without being able to see the roster at all.'),
            ],
          },
          {
            id: 'records',
            heading: 'People with no account',
            blocks: [
              p('The switch above the table has two settings. **With accounts** is what the tab opens on and is everything above. **Records** is the other list: relatives somebody entered on the [family tree](/community/family-tree) who have never signed in — a grandmother, a child, anybody recorded so the tree makes sense.'),
              p('The table shows different things about them, because most of what the Members table shows would be blank: a record holds no board position and no permission template, and has nothing to switch off. What it shows instead is their **address**, and whether it is one the product **generated** for them — which is what **Generated address** in that column means. A generated address cannot receive mail; it exists so the record has something unique on it.'),
              p('**Not every record has one.** Inviting somebody from the family tree gives them a real address straight away, and they stay a record until they accept — so that row shows the real address and no badge.'),
              p('**Deleting a record is permanent and is offered here.** It removes the person and everything recorded about them: their place on the family tree, photo tags naming them, and any meeting or check-in they were listed on. The confirmation names them before you commit. It needs the delete permission on Members, which is separate from editing.'),
              note('Two things are refused rather than offered. A person with an ACCOUNT cannot be deleted here — switch them off from their row menu instead, which keeps everything they carry. And a record with MONEY against it — a payment, a contribution, or a disbursement — is refused with what is attached named, because a family’s ledger is never edited or removed.'),
            ],
          },
          {
            id: 'approving',
            heading: 'Admitting somebody',
            blocks: [
              steps(
                'Open **Pending Approval**.',
                'Read the request — the person\'s profile is what you are recognising them by.',
                'Approve, or decline with a reason.',
              ),
              p('An approved member gets the full product immediately; their rail fills in on its own without them signing in again. A declined applicant is told, and may appeal once.'),
            ],
          },
          {
            id: 'inviting',
            heading: 'Inviting somebody',
            blocks: [
              p('**Invite** sends a link to one email address. An invitation can pre-approve, which lets the person straight in when they accept — the difference between an invitation and handing out the family code.'),
              p('Invitations can be resent and revoked from the same tab. If the email itself fails to send, you are told and given the link to pass on yourself rather than being shown a success over a message that never went.'),
            ],
          },
          {
            id: 'templates',
            heading: 'Permission templates',
            blocks: [
              p('Every member is on exactly one template, and that template is the whole of what they can do. There is no second layer — no groups to union, no per-person exceptions to reconcile.'),
              steps(
                'Open **Permission Templates** and create one, optionally starting from a copy of an existing template.',
                'Find the feature you want to change. Each one is a row saying what it grants today — "View All", "Edit Own", or **Nothing**.',
                'Click the row to open it. Its **view**, **create**, **edit** and **delete** appear underneath, and only the ones that mean something for that feature.',
                'Set each one to **All**, **Own** or **—**. The change is confirmed and then applies immediately.',
                'Put people on it from the row menu on the **Members** tab.',
              ),
              p('One feature is open at a time, so opening another closes the one before it. That is deliberate: forty features times four settings is a wall of switches, and an administrator comes here to change one of them.'),
              p('A closed row is still the answer. It says what the template grants for that feature, so reading a whole template is reading down the list rather than opening every row — and **Nothing** is written out rather than left blank, because a blank row reads as one that failed to load.'),
              p('Changing a template changes it for everybody on it, straight away.'),
            ],
          },
          {
            id: 'editing-a-profile',
            heading: 'Correcting somebody\'s profile',
            blocks: [
              p('Press a member\'s name on the **Members** tab to see their record in full, then **Edit profile** to change it — or go straight there with **Edit profile** under **Profile** in the menu at the end of their row. The form is the same three sections a member sees on their own [My Profile](/personal-info) — General, Address and Additional information — so a misspelt surname or a moved address can be fixed while you have them on the phone.'),
              p('Two things are deliberately not editable here, and both are theirs rather than yours:'),
              defs(
                { term: 'Their email address', text: 'Shown, and read-only. It is what they sign in with, so only they can change it — from Sign-in & Security on their own profile. For a relative who has not registered yet it is a generated placeholder, and it becomes a real address when they accept an invitation.' },
                { term: 'Their password', text: 'Nobody can see or set it, including you. **Send a password reset** emails them a link and they choose the new one; their current password keeps working until they use it.' },
              ),
              p('A member is not notified that you changed their profile, so tell them. The **Chapter** they belong to is not here either — members set that themselves, and the [Organization](/help/regions-and-chapters) tab is what decides which chapters exist.'),
              note('This needs **edit** on Members. Somebody who can only view the roster sees the record and no Edit button.'),
            ],
          },
          {
            id: 'disabling',
            heading: 'Switching a member off',
            blocks: [
              p('**Disable member**, from the row menu on the **Members** tab, is the alternative to removing somebody. They keep their record and their history and they lose access — the right move for a person who should no longer be signing in but whose payments and place on the tree are part of the family\'s record. **Enable member** puts them back.'),
            ],
          },
        ],
      },
      {
        slug: 'regions-and-chapters',
        title: 'Organization',
        summary: 'Dividing a large family into regions and chapters, on the Organization tab of Members, and what a member\'s chapter decides.',
        route: '/admin/members/organization',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Two levels, and National',
            blocks: [
              p('**Organization** is the fourth tab of [Members](/admin/members?tab=organization), and it is how a family that is spread out organises itself. A **chapter** is where a member actually belongs — Houston, Atlanta — and a **region** is a group of chapters, like Texas or Eastern. A family can run on chapters alone, on both, or on neither.'),
              p('The tab has two halves. This chapter is the upper one, the geography; the lower one is the family\'s offices and has its own chapter, [Board Positions](/help/board-positions). They are granted separately, so somebody may be given one half and not the other — a tab showing only one of them is not a fault.'),
              p('It used to be a screen of its own on the rail and is a tab now, because who is in the family and how the family is divided up are one job. A link or a bookmark pointing at the old address still lands here.'),
              p('**National** is the third thing on the screen and it is not a region you create. It is what everything belongs to until you file it somewhere else: a chapter with no region is under National, and so is any member who has not picked a chapter. It cannot be renamed, deleted or turned off, and every family has it.'),
              note('Members choose their own chapter, on [My Profile](/personal-info). Nobody is assigned one from here — this tab decides which chapters EXIST.'),
            ],
          },
          {
            id: 'adding',
            heading: 'Adding and moving',
            blocks: [
              steps(
                'Type a name under **Add a region** and press **Add region**. "National" is refused, because it already exists.',
                'Type a name under **Add a chapter**, choose **In region** — or leave it at National — and press **Add chapter**.',
                'To move a chapter later, change the **Region** cell on its row. It saves immediately.',
              ),
              p('Moving a chapter between regions changes who owes a regional due, straight away. That is intended: the members really are in the new region now, so the new region\'s dues really are theirs.'),
            ],
          },
          {
            id: 'deleting',
            heading: 'Deleting one, and when you cannot',
            blocks: [
              p('Deleting a region moves its chapters to National. Nobody\'s membership changes and no record is touched; the confirmation says how many chapters will move.'),
              p('A chapter or region cannot be deleted while something still points at it. The row\'s Delete button is unavailable and says what is in the way — members in the chapter, a dues schedule scoped to it, an announcement addressed to it, or a board position held there.'),
              p('That is a refusal rather than a tidy-up on your behalf, and deliberately so: somebody\'s chapter decides what they owe and who leads them, so moving fourteen people as a side effect of a delete is not a decision to make by accident. Move the members, re-scope the dues, then delete.'),
              note('Nothing here is a dead end. Re-scope a due to the whole family under [Accounting](/admin/accounting?section=dues) and the region deletes.'),
            ],
          },
          {
            id: 'dues',
            heading: 'What a chapter decides about money',
            blocks: [
              p('A dues schedule is owed by the whole family, by one region, or by one chapter — set with **Owed by** on the dues form under [Accounting](/admin/accounting?section=dues). See [Accounting](/help/accounting#dues).'),
              defs(
                { term: 'National', text: 'Every member owes it. The default, and the only option until you have created a region or a chapter.' },
                { term: 'A region', text: 'Only members whose CHAPTER is in that region owe it.' },
                { term: 'A chapter', text: 'Only members in that chapter owe it.' },
              ),
              p('**A member with no chapter is under National**, so a regional or chapter due does not apply to them at all — it does not appear on their [Dues](/accounting/dues-and-donations) screen and they are never billed for it. That is the state every family starts in, and it is the commonest reason a new chapter due collects nothing: [Dues Projections](/reporting/dues-projections) says so on the schedule\'s row when nobody in the family is in the part it is for.'),
              note('A member\'s region is worked out through their chapter every time it is asked. There is no separate region to set on a person, and moving a chapter into another region moves everybody in it with no further step.'),
            ],
          },
        ],
      },
      {
        slug: 'board-positions',
        title: 'Board Positions',
        summary: 'The offices your family keeps, who holds each one, and why the list starts empty.',
        route: '/admin/members/board-positions',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Your family\'s offices',
            blocks: [
              p('**Board Positions** is the list of offices your family actually keeps — President, Treasurer, a Reunion Chair — and a record of who holds each one. It is the lower half of the **Organization** tab of [Members](/admin/members?tab=organization), under the regions and chapters: one tab answers both halves of "what shape is this family in?".'),
              p('**The list starts empty, and that is deliberate.** No two families run the same way: one has five officers and a chair for the reunion, another has twenty committees. So nothing is set up for you and nothing is suggested — you add the offices you have, and the ones you do not have simply are not there.'),
              p('Every position belongs to your family alone. Another family naming its treasurer the same thing has no effect on yours, and neither family can see the other\'s list.'),
            ],
          },
          {
            id: 'adding',
            heading: 'Adding a position',
            blocks: [
              steps(
                'Press **Add Position**. A box opens over the page.',
                'Type the name as you say it out loud — that is what appears beside somebody\'s name everywhere else.',
                'Choose a **Category**: **Executive Officer** for an elected office, **Appointed Position** for one somebody is given.',
                'Choose a **Scope** — see below — and press **Add Position**.',
              ),
              defs(
                { term: 'National', text: 'One holder for the whole family. Almost everything is this.' },
                { term: 'Regional', text: 'One holder per region. You choose which region when you give it to somebody.' },
                { term: 'Chapter', text: 'One holder per chapter, chosen the same way.' },
              ),
              p('Regional and Chapter only mean something once your family has set up regions or chapters, which is the upper half of this same tab. Until then, use National.'),
              p('**The same title can exist once at each scope.** A national **President** and a regional **President** are two separate positions, and a family with four regions has one regional President that four people hold — one per region. So there is no need to name the second one "Regional President" to tell them apart; the Scope column does that.'),
              note('What cannot be repeated is a title at the SAME scope. Add a second national President and the screen says so rather than quietly making a duplicate nobody could tell from the first.'),
            ],
          },
          {
            id: 'renaming',
            heading: 'Fixing a name',
            blocks: [
              p('The pencil on a position\'s row turns its name into a box. **Enter** saves, **Escape** cancels, and the name changes everywhere it is printed — under people\'s names in the [Directory](/community/directory), on their [Dashboard](/dashboard) and on their [My Profile](/personal-info).'),
              p('Only the name can be changed. **Category** and **Scope** cannot, because a position\'s scope is copied onto each holder\'s record when they are given it, along with the region or chapter it was for — so changing the scope afterwards would leave those records describing something the position no longer is. A family that has the scope wrong removes the position and adds it again, which also re-makes the assignments that were wrong.'),
              note('Two positions at the SAME scope cannot share a name. Renaming a regional position to a name your national list already uses is fine; renaming it to the name of another regional position is refused, and nothing is saved.'),
            ],
          },
          {
            id: 'assigning',
            heading: 'Giving somebody a position',
            blocks: [
              p('**Not from this pane.** Setting up which offices your family keeps happens here; deciding who holds one happens on the **Members** tab, from that person\'s own row.'),
              steps(
                'Open the **Members** tab and find the person.',
                'Open the menu at the end of their row and choose **Give a board position** under **Profile**.',
                'Pick the position. For a regional or chapter one, choose which region or chapter it is for.',
                'Press **Give position**.',
              ),
              p('It moved there on 2026-08-20, and the reason is what you have in mind when you do it. Which offices exist is a decision about the FAMILY, made once and revisited yearly, and it belongs beside the regions and chapters. Making Ada the Treasurer is a decision about ADA — and everything else you decide about Ada is on her row already: her permission template, whether her access is switched on, her profile. Assigning from the position\'s row meant finding the office in order to find the person.'),
              p('More than one person can hold the same position, which is what a regional or chapter office needs, and one person can hold more than one. Their **Position** column lists what they hold, and so does the box that opens from their row.'),
              note('Only relatives who have finished registering can hold a position. Somebody recorded on the family tree without an account cannot, because the record of who holds an office is attached to their account — invite them first, from [Family Tree](/community/family-tree).'),
            ],
          },
          {
            id: 'removing',
            heading: 'Taking one away, and removing a position',
            blocks: [
              p('The bin beside a title, in the box that opens from a member\'s row on the **Members** tab, takes that position away from that person. They stay a member of the family and nothing else about them changes.'),
              p('**A position that somebody holds cannot be removed.** Its remove button is unavailable and says how many people hold it; take it away from each of them and it becomes available.'),
              p('That is a refusal rather than a tidy-up on your behalf, and for the same reason deleting a chapter is: somebody\'s office is on their profile and in the Directory, and removing four officers as a side effect of deleting one row is not a decision to make by accident.'),
            ],
          },
          {
            id: 'where-it-shows',
            heading: 'Where a position shows up',
            blocks: [
              p('A position is public within the family. Once somebody holds one it appears:'),
              bullets(
                'under their name in the [Directory](/community/directory),',
                'on their own [My Profile](/personal-info),',
                'and on their [Dashboard](/dashboard) when they sign in.',
              ),
              p('A regional or chapter position is written out in full — "Houston Chapter President", "Texas Regional Secretary" — so two people holding the same office in different places read as two different titles.'),
              p('These positions are what an election is held for. An election at one level can only fill offices recorded at that level, so a chapter election offers the chapter positions and nothing else — see [Running an election](/help/running-an-election).'),
            ],
          },
        ],
      },
      {
        slug: 'running-an-election',
        title: 'Running an election',
        summary: 'Setting the two date windows, choosing which part of the family votes, putting offices on the ballot, and publishing it.',
        route: '/admin/elections',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What this screen is',
            blocks: [
              p('Every election the family has, at every level, drafts included. Each row shows where the election is today, which part of the family it is for, its two date windows, and how many positions, nominations and votes it has.'),
              p('**New Election** opens the form in a panel over the list, and so does the edit control on a draft. The list stays behind it, which is the point — you can see what the family already holds while you write the next one.'),
              p('An election is either a **draft** — yours, invisible to the family — or **published**, which puts it on the family\' calendar. There is nothing else to set: once it is published the dates run it.'),
            ],
          },
          {
            id: 'the-windows',
            heading: 'The two date windows',
            blocks: [
              p('**Nominations** and **Voting**, each with an opening date and a closing date. They are what makes the election happen; nobody has to come back and press anything.'),
              bullets(
                'Nominations run from the day they open to the end of the day they close. Both days count.',
                'Voting runs the same way, and may not open BEFORE nominations close — a ballot is never voted on while the list of candidates can still change.',
                'It may open on the same day they close, and then that day belongs to voting: nominations shut as the ballot opens. That is the shortest election the product can describe — one day of nominations, one day of voting. Give nominations the whole of their closing day by setting it a day earlier.',
                'Each window has to be at least a day long. A closing date on or before its opening date is refused as you type it.',
                'The date pickers grey out the days that would break the chain — once nominations open on the 1st, the closing picker will not offer the 1st or anything before it, and the voting pickers move with it. The voting opening picker DOES offer the day nominations close, because that one is allowed.',
              ),
              p('The day after voting closes, the election is over and its results appear for everybody who could vote in it. Nothing publishes them and nothing closes the poll.'),
              note('All four dates are needed to publish. A draft may have none of them, or some — that is what a draft is for.'),
            ],
          },
          {
            id: 'the-level',
            heading: 'Choosing who votes',
            blocks: [
              p('**Who votes** picks the level: the whole family, one region, or one chapter. It decides three things at once, and they are not separable.'),
              bullets(
                'Who can SEE the election. A chapter election is not listed for the rest of the family and its link does not open for them.',
                'Who can be NOMINATED. The nominee list on the ballot holds only the people the election is for.',
                'Which OFFICES it can fill — only those recorded at the same level under [Board positions](/help/board-positions).',
              ),
              p('Changing the level after you have chosen positions clears any that no longer belong to it, and says which. That is not the form losing your work; it is the rule that an election cannot fill an office from another level.'),
              p('A family with no regions and no chapters gets National and nothing else, because there is nothing to point at. Regions and chapters are set up under [Regions & chapters](/help/regions-and-chapters).'),
              note('Members who are not in a chapter are under National. They take part in national elections and in no scoped one, so an election narrowed to a chapter is narrower than it may look — check who is actually filed there before publishing one.'),
            ],
          },
          {
            id: 'positions',
            heading: 'What is on the ballot',
            blocks: [
              p('**Positions** is the list of offices this election fills. Each one is chosen from the family\' board roster at the matching level, and **Winners** is how many people the office seats — usually one.'),
              p('An office you expected and cannot find is either recorded at a different level or not recorded at all. Add or re-scope it under [Board positions](/help/board-positions) first.'),
              p('An election needs at least one position before it can be published.'),
            ],
          },
          {
            id: 'publishing',
            heading: 'Publishing it',
            blocks: [
              steps(
                'Fill the form in and press **Create draft**. Nothing is visible to the family yet.',
                'Read the row back — the level, both windows, and the number of positions.',
                'Leave **Announce** ticked if you want the family told, then press **Publish** and confirm.',
              ),
              p('The announcement is addressed the way the election is: a chapter election is announced to that chapter. A regional one goes to the whole family and names the region, because an announcement can be addressed to a chapter and not to a region.'),
              p('**The notice is a way in.** Its title is a link straight to the election, on the board and in the **Recent Updates** card on the [Dashboard](/dashboard) alike, so nobody has to go looking for the ballot they have just been told about. A member whose family has switched Elections off, or is not on a plan that includes them, sees the notice without the link rather than a link that refuses them.'),
              p('After that there is nothing to do. Nominations open on their date, close on theirs, voting opens and closes on its own, and the results appear.'),
            ],
          },
          {
            id: 'watching-it',
            heading: 'Watching one run',
            blocks: [
              p('The arrow at the end of any row opens that election\'s own screen — the organizer\'s view of it, not the ballot. Four figures across the top:'),
              defs(
                { term: 'Can vote', text: 'Approved members of this election\'s part of the family who have an account. Somebody recorded on the family tree with no account of their own can be nominated and cannot vote, so they are not counted here.' },
                { term: 'Have voted', text: 'How many of them have, and the turnout that works out to.' },
                { term: 'Have not', text: 'The difference. It is a number and never a list — nobody is named, here or anywhere.' },
                { term: 'On the ballot', text: 'Accepted nominations against total nominations. A nomination nobody has answered is not on the ballot, and only accepted candidates can be voted for.' },
              ),
              p('Below them, every office with the people standing for it, their vote counts and their share. The leaders carry a trophy, as many as the office seats.'),
              p('**While voting is open these are a snapshot, and the screen says so.** Nothing here declares a winner until the window closes; it is there so you can see whether an election is going to work — whether anybody accepted, whether anybody is voting — while there is still time to do something about it.'),
              note('This screen never shows which way a named person voted, and nothing anywhere does. See [Elections](/help/elections#voting) for the member\'s side of that.'),
            ],
          },
          {
            id: 'changing-it',
            heading: 'Changing or withdrawing one',
            blocks: [
              p('**A draft can be edited freely** — its title, its dates, its level, its positions.'),
              p('**A published election cannot be edited.** Its dates are what the family was told, and moving them would change what a ballot was rather than correct a typo.'),
              p('**Return to draft** takes a published election back, and is offered only while nobody has been nominated and nothing has been voted on. Once somebody has acted, the election is a record of something the family did: let it run, or delete it.'),
              p('**Delete** removes the election with every nomination and vote on it, and cannot be undone. The confirmation says how many of each there are.'),
              note('Deleting a region or a chapter an election is scoped to is refused while the election exists — re-scope the election to the whole family first, or delete it. Nothing about the family\' shape can quietly change who was entitled to vote.'),
            ],
          },
        ],
      },
      {
        slug: 'family-settings',
        title: 'Settings',
        summary: 'The family\'s name, the code relatives join with, the plan it is on, and how to switch it off.',
        route: '/admin/settings',
        sections: [
          {
            id: 'bands',
            heading: 'Three sections',
            blocks: [
              p('The page is three sections, chosen from the rail across the top. **Billing** is what your family has paid GENORRA, until when, and every receipt. **Plan** is which subscription this family is on, what each one includes, and where you move between them. **Family** is the family itself — its name, the code relatives join with, and switching it off.'),
              p('Settings opens on **Plan**, because that is the section most people came to look at or change.'),
              p('Paying for a plan is covered in [Paying for a plan](/help/plans#paying); this page is where the controls are.'),
            ],
          },
          {
            id: 'name',
            heading: 'The family name',
            blocks: [
              p('What the family is called everywhere in the product. Renaming it changes nothing else — the code, the members and every record stay exactly as they were.'),
            ],
          },
          {
            id: 'code',
            heading: 'The family code',
            blocks: [
              p('Six characters, generated when the family was created, and permanent. It cannot be changed or regenerated.'),
              note('Anyone holding the code can ask to join, so treat it as an invitation rather than a password — and remember that asking is not joining. Every request lands in the approvals queue for somebody to decide.'),
            ],
          },
          {
            id: 'plan',
            heading: 'The plan',
            blocks: [
              p('The **Plan** section, which Settings opens on, shows which plan the family is on, what each one costs a month, and what it includes. **Features** on any row opens the full list for that plan. See [Plans](/help/plans).'),
              p('**Every plan row carries its own button.** A row above the one you are on says **Upgrade to …** and starts the payment; a row below says **Downgrade to …**. The row you are already on says **Current plan** and does nothing. A plan that has a price but is not on sale yet shows **Coming Soon** instead of a button.'),
              p('Moving down asks for your password as well as a confirmation, because it closes pages for every member of the family at once. Nothing is deleted either way.'),
              note('**Moving down is also how you stop paying.** Downgrading to Free ends a monthly plan at the end of the period you have already paid for — there is no separate "stop renewing" control, because stopping the payment and choosing what you stop at are one decision. The confirmation names the date it takes effect.'),
            ],
          },
          {
            id: 'billing',
            heading: 'Paying for the plan',
            blocks: [
              p('**Billing** is what your family has actually paid: which plan, the day it is paid through, the day the next payment is due, and whether anything renews it. Nothing on it starts a payment — the buttons that do are on the plan rows in **Plan**, and they open Stripe\'s own page. Nothing on this screen takes a card number.'),
              note('**"Next payment due" means two different things and the row beside it says which.** On a monthly plan it is the day the card is charged automatically. On a plan paid in advance nothing renews it, so it is the day the pages close unless somebody buys again.'),
              p('**Every family is billed on the 1st.** The first payment is only the rest of the current month, worked out by the day and rounded up — so joining on the 20th costs a few days, not a month, and every payment after it lands on the 1st.'),
              note('**If the rest of the month comes to less than $5, the first payment covers this month and next.** A charge of a pound or two is not worth putting on a card statement, and below about 50 cents a card network will not take it at all. The screen says which option you are being offered and why.'),
              p('There are two ways to pay and one rate. **Monthly** renews until you stop it. **In advance** is one payment covering the rest of this month plus however many whole months you like, up to 60 — which you can also change on Stripe\'s page. There is no discount for paying ahead and no annual price; a year in advance is twelve months at the monthly rate.'),
              defs(
                { term: 'Moving up', text: 'Takes effect at once. If you had paid ahead at a cheaper plan, what was left of it is valued at the rate you paid and spent on the new plan first — so there is often nothing to pay, and anything left over is held as credit against your next invoice. You are never billed the difference across the whole term you prepaid.' },
                { term: 'Moving down', text: 'Costs nothing and changes nothing today. It takes effect on the 1st — the next one if you pay monthly, or the 1st after your prepaid term runs out. Six months of Plus, moved down in month two, is Plus for months two to six and the cheaper plan from month seven. There is no refund, which is exactly what keeps those pages open until it finishes.' },
              ),
              note('**Nothing is granted by pressing a button here.** The plan changes when the payment clears, which can be a moment later — so if the band still shows the old plan straight after paying, give it a minute and reload. If a payment fails, this section says so and nothing your family can reach changes while Stripe keeps trying the card.'),
              p('**Cards and receipts** opens Stripe\'s own billing portal, where the card on file is changed and every invoice can be downloaded. **What GENORRA has charged** lists the same payments here — what was bought, when it was paid, what it covers and how much.'),
              note('These are GENORRA\'s charges to your family and they are deliberately nowhere near your family\'s own money. Nothing on this section appears in your funds, your [P&L](/reporting/pl-summary), your dues projections or any member\'s payment history — what your family pays us and what your relatives pay your family are two separate sets of books.'),
              p('**To stop paying, move down to Free on the [Plan](/admin/settings) section.** That ends a monthly plan at the end of the period already paid for, never immediately. Every page stays open until then.'),
              note('**What the cheaper plan does not include is then kept for sixty days, and deleted after that.** Nothing goes on the day you move down. You are reminded thirty, fifteen, five and one day before, and moving back up inside those sixty days finds everything exactly where it was — see [what happens to your records](/help/family-settings#retention).'),
            ],
          },
          {
            id: 'retention',
            heading: 'What happens to your records',
            blocks: [
              p('**Moving down to a cheaper plan does not delete anything on the day you do it.** The pages that plan included stop opening, and everything behind them is kept for **sixty days**. Move back up inside those sixty days and every record is exactly where you left it.'),
              p('**Billing** shows the date throughout, and four reminders go to whoever looks after billing — thirty days before, fifteen, five and one.'),
              defs(
                { term: 'Keep it', text: 'Move back to the plan you left. That covers the months you were away as well as the coming one, so the plan has no gap in it, and the figure is on the Billing section before you commit to anything.' },
                { term: 'Let it go', text: 'Do nothing and it is deleted on the date shown, at no extra cost. If you have already decided, **Let these records go…** on the Billing section does it today rather than reminding you three more times — it asks for a six-digit code emailed to you first, and it lists exactly what will be removed.' },
              ),
              note('**Deleted records cannot be recovered.** Not by you, not by GENORRA support, not from a backup. That is why the sixty days and the four reminders exist, and it is the one sentence on this page worth reading twice.'),
              p('**What is never deleted:** your relatives, the Member Directory, announcements, chat, the calendar and everything else the Free plan includes. A family that stops paying entirely still has all of that.'),
            ],
          },
          {
            id: 'overdue',
            heading: 'If a payment fails',
            blocks: [
              p('A card is declined for ordinary reasons — it expired, the bank flagged it, the billing address moved. Nothing changes the day it happens, and updating the card on **Billing** settles it.'),
              p('If it stays unpaid, access is limited in stages so that whoever can fix it always can:'),
              defs(
                { term: 'After 5 days', text: 'Everyone who looks after billing is emailed. Nothing is limited and everybody carries on as usual.' },
                { term: 'After 10 days', text: 'Relatives can no longer use the site. Administrators keep full access, and paying restores everybody at once.' },
                { term: 'After 30 days', text: 'Only the Billing section stays open, for administrators too. Nothing has been removed and everything opens again on payment.' },
                { term: 'After 60 days', text: 'The family moves to the Free plan, and what the Free plan does not include is deleted. Two warnings go out first — at 45 days and the day before.' },
              ),
              note('**Nothing is deleted before day 60, and nothing about the plan changes before then either.** Pay on day 59 and every screen and every record is exactly where it was. What is deleted on day 60 cannot be recovered.'),
              p('A member who sees "temporarily unavailable" is being told the whole message deliberately: what a family owes GENORRA is not every relative’s business. They are asked to contact whoever looks after the family’s accounting, which is the person who can actually resolve it.'),
            ],
          },
          {
            id: 'removal',
            heading: 'Removing the family',
            blocks: [
              p('**Remove this family**, at the bottom of the **Family** section, switches the whole family off. Nobody can open it, the family code stops working, and any invitation still outstanding stops being accepted. It is offered only to somebody whose permission template grants **Remove Family**, which is separate from the one that lets you rename the family.'),
              note('Nothing is deleted. Every payment, fund, photograph, event, message, document and person stays exactly where it is. Removing closes the family\'s doors; it destroys no records at all.'),
              p('**The billing stops, and that part cannot be undone.** Your GENORRA plan will not renew — it runs to the end of the period you have already paid for, and nothing is refunded. Every member paying dues automatically has that payment cancelled at Stripe straight away, and those cannot be restarted: bringing the family back restores every record, but each relative who was paying automatically has to set theirs up again. It is the same trade [disconnecting Stripe](/help/accounting#processing) makes, and it is there for the same reason — the part you can undo hides a part you cannot.'),
              p('It takes two steps. **Email me a removal code** sends six digits to the address you sign in with — not to an address you type, and not to anybody else. **Enter the code and remove** then asks for those digits and for a confirmation. The code lasts fifteen minutes, works once, and cancels itself after five wrong tries; ask for another with **Send another code**.'),
              p('Members of a removed family are not left guessing. Signing in shows a screen saying the family was removed and that nothing was deleted, [My Families](/my-families) lists it with a **Removed** badge, and the family menu at the top of the page badges it too — so an account that belongs to more than one family carries on in the others exactly as before.'),
              p('**Only GENORRA support can bring a family back.** There is no button for it anywhere in the product, deliberately: a family that could un-remove itself would not have been removed. If it was a mistake, write to support and ask.'),
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'reference',
    title: 'Reference',
    blurb: 'The two things that explain most of the questions people ask.',
    chapters: [
      {
        slug: 'who-can-do-what',
        title: 'Who can do what',
        summary: 'How permissions are decided, and why a page you have heard about is not in your rail.',
        sections: [
          {
            id: 'one-template',
            heading: 'One template per member',
            blocks: [
              p('Everything you can do comes from the single permission template you are on. There is nothing else to check and nothing to add up — if it is not on your template, you do not have it.'),
              p('Your family\'s administrators decide the templates and who is on which, from [Members](/admin/members).'),
            ],
          },
          {
            id: 'actions',
            heading: 'Four actions, three scopes',
            blocks: [
              p('Every feature is granted four ways — **view**, **create**, **edit** and **delete** — and each is set to one of three scopes.'),
              defs(
                { term: 'None', text: 'Not at all.' },
                { term: 'Own', text: 'Only your own records. Your announcements, your payments.' },
                { term: 'Any', text: 'Anybody\'s, across the family.' },
              ),
              p('The distinction is what lets a family say "you may delete your own posts but not other people\'s", which is a common and sensible arrangement.'),
            ],
          },
          {
            id: 'self-service',
            heading: 'The things nobody has to grant',
            blocks: [
              p('Some things are yours by being a member and need no grant at all: sending a chat message, RSVPing, editing your own profile, choosing your own dues cadence. Requiring permission for those would mean a family could accidentally lock itself out of its own chat.'),
            ],
          },
          {
            id: 'missing',
            heading: 'Why a page is missing',
            blocks: [
              p('The rail lists only what you can open, and there are three separate reasons something may not be there:'),
              bullets(
                'Your template does not grant you **view** on it. Ask an administrator.',
                'It is not part of your family\'s plan — opening it directly shows the upgrade screen rather than hiding it. See [Plans](/help/plans).',
                'It has not shipped yet. Opening it directly says Coming Soon.',
              ),
              p('The same three reasons decide a TAB. Several screens are a rail of panes — Members, Accounting, Announcements, Transactions — and each pane is granted in its own right, so a tab that is not on the rail is one you have not been given rather than one that has gone. A screen where you hold none of its panes is not in the rail at all.'),
              p('Typing the address of a page you have not been granted gives you a plain "not found". That is deliberate: a restricted page should not confirm that it exists.'),
            ],
          },
        ],
      },
      {
        slug: 'plans',
        title: 'Plans',
        summary: 'What each plan includes, and what happens at the boundary.',
        sections: [
          {
            id: 'plans',
            heading: 'The plans',
            blocks: [
              p('Free, Standard, Plus and Premium, and they are inclusive — each one is everything below it and more. What each includes is listed in the **Plan** section of [Settings](/admin/settings), which is the copy that is kept current.'),
              p('Each paid plan shows one price there, per month, month to month. No figure is written down here — the panel reads the real one, and a price copied into a manual is a price that goes out of date without anybody noticing.'),
              note('Free is free, and not a trial. Standard and Plus can be bought; Premium has a price and is not on sale yet, and its row is marked **Coming Soon**. Nothing is ever billed for a plan a family has not paid for.'),
            ],
          },
          {
            id: 'paying',
            heading: 'Paying for a plan',
            blocks: [
              p('Paid plans are set up in the **Billing** section of [Settings](/admin/settings), underneath the plans themselves, and only somebody with the Settings permission can open it. There are two ways to pay: **monthly**, which renews on the 1st, or **in advance**, which buys a set number of months outright and renews nothing.'),
              p('Payment is taken by Stripe on their own pages. No card details are typed into GENORRA and none are stored here. The **Plan** section above cannot move a family up on its own — an upgrade is a payment, so the rows there point at Billing instead.'),
              p('Moving to a cheaper plan is free and does not go through Billing. A monthly plan can also be stopped, which lets it run to the end of the month already paid for rather than ending it that day.'),
              note('A plan only changes once the payment has actually gone through, which is Stripe telling us rather than the browser coming back. If you close the tab mid-payment, nothing is lost — the plan changes when the money does, and the Billing section shows what has been paid.'),
            ],
          },
          {
            id: 'chosen-at-signup',
            heading: 'A plan chosen when the family was created',
            blocks: [
              p('Choosing Standard or Plus on the pricing page, or on the registration form, does not pay for it — there is no family to bill yet and no account to charge. The choice is remembered against the family instead.'),
              p('Once the email address is confirmed and whoever created the family signs in, the dashboard leads with **Finish paying for** that plan, above everything else it has to say. It carries two buttons.'),
              defs(
                { term: 'Pay Now', text: 'Takes you straight to Stripe to pay monthly, starting with the rest of this month. There is no separate screen to find first.' },
                { term: 'Cancel', text: 'Drops the plan the family asked for and leaves it on Free. It cancels nothing at Stripe and buys nothing — every plan is still on sale in Settings afterwards.' },
              ),
              p('A link under the buttons goes to the Billing section instead, which is where months can be bought in advance. Until a payment goes through the family is on Free and nothing has been charged.'),
            ],
          },
          {
            id: 'boundary',
            heading: 'Two different walls',
            blocks: [
              defs(
                { term: 'Coming soon', text: 'The feature has not been built yet. Nobody has it, on any plan.' },
                { term: 'Upgrade', text: 'The feature is built and working, and your family\'s plan does not include it.' },
              ),
              p('They are shown separately on purpose. Telling a paying family that a finished feature is "coming soon" would be untrue, and telling a free family to wait for something they could have this afternoon would be worse.'),
            ],
          },
          {
            id: 'data',
            heading: 'Changing plan never removes data',
            blocks: [
              p('A plan decides which screens a family can open. A family that moves to a cheaper plan keeps every record it has entered for **sixty days** — the pages that read them stop opening, and moving back inside those sixty days brings everything straight back. After sixty days, what the cheaper plan does not include is deleted. Four reminders arrive first, and [Billing](/admin/settings) shows the date throughout.'),
            ],
          },
        ],
      },
      {
        slug: 'troubleshooting',
        title: 'If something looks wrong',
        summary: 'The handful of things that surprise people, and what is actually happening.',
        sections: [
          {
            id: 'cannot-sign-in',
            heading: 'I cannot sign in at all',
            blocks: [
              p('If the sign-in page answers that your email address is not confirmed, the account exists and your password was right — it is waiting on the link that was emailed when it was registered. Press **Send the link again** in the panel underneath the form, then open the newest message. Each link works once and expires after an hour, so an older email in the same thread will not let you in.'),
              p('Nothing tells us whether that email arrived, so the panel says what it asked for rather than claiming it was delivered. Check the spam folder, and if nothing comes at all, the address may not be the one the account was registered with — see [Confirming your email address](/help/joining-a-family#confirm-your-email).'),
              p('A wrong password answers differently, and so does an address with no account: both say the credentials are invalid rather than naming the confirmation. If that is what you are seeing, ask for a reset link from the sign-in page instead.'),
            ],
          },
          {
            id: 'missing-page',
            heading: 'A page I was told about is not in my rail',
            blocks: [
              p('Three possible reasons, and [Why a page is missing](/help/who-can-do-what#missing) separates them. The most common by far is that your template does not grant it.'),
            ],
          },
          {
            id: 'wrong-family',
            heading: 'I am looking at the wrong family',
            blocks: [
              p('Check the family switcher in the top bar. If you routinely land in the wrong one, set the other as **Default** on [My Families](/my-families) — that is the family that opens when you sign in.'),
            ],
          },
          {
            id: 'signed-out',
            heading: 'I keep getting signed out',
            blocks: [
              p('Sixty minutes with nothing typed or clicked signs you out of that device. It is a real sign-out, not a lock screen, so signing back in is the whole fix. If it is happening while you are actively working, the tab may have been left on a screen that takes no input — the timer counts keys and clicks, not the page being open.'),
              p('**On a phone, reopening the app after a while lands you on the sign-in page with no warning first.** That is the same hour, measured the only way it can be: a phone shuts the page down in the background, so nothing was running to warn you and the check happens when you come back. Signing in again picks up where you were.'),
            ],
          },
          {
            id: 'empty-list',
            heading: 'A list says there is nothing here',
            blocks: [
              p('Usually there genuinely is nothing. Two things worth checking first: whether you are in the right family, and whether the pane you are on is scoped to your own records rather than the family\'s — a **view** granted at scope *own* shows you your rows and nobody else\'s, which is correct and can look empty.'),
            ],
          },
          {
            id: 'tree-empty',
            heading: 'The tree opens on somebody else',
            blocks: [
              p('That happens when you have no parents or children recorded — the tree opens on the relative you are attached to instead of on an empty page, and says so. **Centre on me** takes you back, and adding a parent or a child makes it open on you from then on.'),
            ],
          },
          {
            id: 'approved-nothing',
            heading: 'I was approved but nothing changed',
            blocks: [
              p('It should change on its own within a minute, or as soon as you come back to the tab — the page checks rather than making you sign in again. If it has not, reloading the page will do it.'),
            ],
          },
          {
            id: 'what-is-this-screen',
            heading: 'I do not understand what a screen is for',
            blocks: [
              p('Every screen with a chapter has a question mark at the top right, next to the bell, and it goes straight to that chapter. A few screens also carry a question mark beside one particular control — the Bloodline toggle on the [Family Tree](/community/family-tree), the plan on [Settings](/admin/settings) — and that one goes to the paragraph about that control rather than to the top of the chapter.'),
              p('If the question mark is not there, no chapter documents that screen yet. [The contents page](/help) lists everything the manual covers.'),
            ],
          },
        ],
      },
    ],
  },
]

// ── Lookups ───────────────────────────────────────────────────────────────────────────

/** Every chapter, in reading order. */
export const HELP_CHAPTERS: readonly HelpChapter[] = HELP_PARTS.flatMap(part => part.chapters)

const BY_SLUG = new Map(HELP_CHAPTERS.map(c => [c.slug, c]))

/** The chapter for a slug, or undefined — which the page turns into a 404. */
export function getHelpChapter(slug: string): HelpChapter | undefined {
  return BY_SLUG.get(slug)
}

/** The part a chapter belongs to, for the breadcrumb above its title. */
export function getHelpPart(slug: string): HelpPart | undefined {
  return HELP_PARTS.find(part => part.chapters.some(c => c.slug === slug))
}

/**
 * What comes before and after, in reading order and ACROSS parts — the manual reads
 * front to back, and stopping at a part boundary would strand the reader at the end of
 * every one of them.
 */
export function helpNeighbours(slug: string): {
  previous?: HelpChapter
  next?: HelpChapter
} {
  const at = HELP_CHAPTERS.findIndex(c => c.slug === slug)
  if (at < 0) return {}
  return {
    previous: HELP_CHAPTERS[at - 1],
    next: HELP_CHAPTERS[at + 1],
  }
}
