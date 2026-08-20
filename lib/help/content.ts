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
              p('Everything in the product is reached from the burgundy rail. Its headings group screens by what they are for — **Community**, **Gatherings**, **Accounting**, **Reporting**, **Resources**, **Admin**, **Help** — and a heading opens when you click it, closing the one that was open.'),
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
                { term: 'Appearance', text: 'Light, Dark, or System. It is remembered in this browser.' },
                { term: 'Your name', text: 'Opens the account menu: [My Profile](/personal-info), [My Families](/my-families), appearance, and sign out.' },
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
            heading: 'The four sections',
            blocks: [
              p('The rail across the top of the page switches between them. Each saves on its own, so you can fill in one and come back later.'),
              defs(
                { term: 'General', text: 'Name, preferred name, phone, email, birthday, and your photo.' },
                { term: 'Address', text: 'Where you live. Used by the Directory and by anything the family posts to you.' },
                { term: 'Additional Information', text: 'T-shirt size, chapter, and the other details events and reports ask for.' },
                { term: 'Sign-in & Security', text: 'The address you sign in with, and your password.' },
              ),
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
              p('It decides two things. Your household moves with you — anybody recorded under you with no account of their own follows — and it can decide what you owe, because a family can attach dues to one region or one chapter. Choosing nothing leaves you under **National**: you owe the family-wide dues and none of the local ones. See [regions and chapters](/help/regions-and-chapters#dues).'),
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
            id: 'premier-gathering',
            heading: 'The premier gathering',
            blocks: [
              p('Directly under the greeting, a band for the gathering the family has said matters most — its title, its dates, where it is, how much of its work has been approved, and **View details** straight through to it. It is there for nobody most of the time: it appears only while a gathering is flagged and still ahead. See [Gatherings](/help/gatherings#browsing).'),
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
              p('**My Tasks** is the exception and is the only button here that is not about a permission. It appears when a gathering task is actually waiting on you, leads straight to it, and goes away when there is nothing left — see [My Gathering Tasks](/help/gathering-tasks#what-it-is). Everything else on the row is a job you MAY do; this is one you have been asked to.'),
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
              p('Inside **At a Glance**, under the figures: what you personally still owe this year, across every dues schedule you are on. It is the same figure [Summary](/accounting/summary) leads with, and **View Dues** takes you to the schedule-by-schedule detail on [Dues](/accounting/dues).'),
            ],
          },
          {
            id: 'donation-drives',
            heading: 'Donation Drives',
            blocks: [
              p('Also inside **At a Glance**, under the balance: every drive the family currently has open, with how far it has got toward its goal and how much of that came from you. Drives that have closed are not here — the bar cannot move any more — but they are still on [Donations](/accounting/donations).'),
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
            ],
          },
          {
            id: 'pinning',
            heading: 'Pinning',
            blocks: [
              p('Pinning puts a post at the top of every member\'s dashboard. That is a family-wide act rather than a personal one, so it is a separate permission from posting — a family can let everybody post and let one person pin.'),
              p('A pin can be given an expiry, which is the right way to pin "the reunion is in three weeks": it takes itself down.'),
            ],
          },
          {
            id: 'dismissing',
            heading: 'Dismissing a pinned post',
            blocks: [
              p('Dismissing removes it from *your* dashboard only. It stays pinned for everybody else, and it stays on this board — the board is the record, the dashboard is the reminder.'),
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
                { term: 'Announcement', text: 'Family news somebody posted on the board. Opening it goes to [Announcements](/community/announcements), which carries the full text.' },
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
              p('Four columns: **Name**, **Region**, **Chapter**, and the **Group** the person is on — which is the permission template deciding what they can do. A member in no chapter reads **National**, which is not a region anybody created but what everyone is under until they pick one; see [regions and chapters](/help/regions-and-chapters#what-it-is).'),
              p('Everything else about a person is behind their name. **Pressing a name opens their record** — phone, email, city and state, their chapter and region, their preferred name, their group, and whether they have an account yet. The name is a real button, so tabbing to it and pressing Enter opens the same panel a click does.'),
              p('Phone, email and city each had a column of their own until 2026-08-19 and are in that panel now. Nothing was dropped and nothing new is shown: the same facts, one press away instead of five columns wide, which is what makes the list readable on a phone.'),
              p('On a narrow screen Region, Chapter and Group fold underneath the name rather than sliding off the side, so nothing is ever parked out of view.'),
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
              p('A former marriage is recorded by adding the spouse and then renaming the connection to **Ex-husband**, **Ex-wife** or **Ex-partner** in the manage dialog. An ex is drawn beside the person exactly where a current spouse is, deliberately — it is often where half the children came from.'),
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
            heading: 'Blood, step, adopted and foster',
            blocks: [
              p('Every connection carries one of those four. It is set on the *connection*, not the person, because the same child can be a step-child of one parent and a blood child of the other.'),
              p('The product cannot work this out for itself and does not try. A man with three children has three identical connections; only a person knows which of them is his by blood. Set it when you add the relative, or afterwards in the manage dialog.'),
              p('The manage dialog lists **every** connection that person has, whoever\'s card you opened it from — so a step-grandmother is corrected from her own card rather than by clicking through to the parent she is attached to. Each one saves as you change it, and both directions move together: a step-son\'s step-father is still a step connection read the other way.'),
              note('A marriage is never blood, and choosing it is not offered — the product records a spouse connection as step and moves on rather than refusing an ordinary "add my wife" over a field nobody typed.'),
            ],
          },
          {
            id: 'bloodline',
            heading: 'The Bloodline toggle',
            blocks: [
              p('**Full family** shows everybody. **Bloodline** shows only the people descended from the family\'s line, hiding spouses and step, adopted and foster connections.'),
              p('It is one answer for the whole family, not one per viewer — two members cannot disagree about who is in the family\'s bloodline. It is worked out by walking from a single person, and **Bloodline descends from** is where somebody with the Settings permission names them.'),
              note('The default — whoever created the family — is usually the wrong choice. A family started by a son walks upward through his mother, which brings his father\'s former wife back in as blood. Naming the oldest recorded ancestor instead is what makes the toggle mean what people expect.'),
              p('The tree says so when it applies: if the person the bloodline descends from has parents recorded, a notice under the setting names them, explains that both their lines count as blood, and offers the oldest recorded ancestor on each as a one-click choice.'),
              p('**Somebody appearing as blood who married into the family is an anchor problem, not a connection problem.** The temptation is to open their card and mark the parent connection as step — do not. If she really is somebody\'s mother, that connection is blood, and recording otherwise makes the tree wrong about her and about every relative of hers you add later. Move the setting up a generation instead: the walk then never reaches her, and her children keep their droplet because their line still runs through their father.'),
            ],
          },
          {
            id: 'fixing',
            heading: 'Correcting a mistake',
            blocks: [
              bullets(
                'Wrong relationship — open the manage dialog on the connection and change it. **Husband** to **Ex-husband** is done here, and so is blood to step.',
                'Wrong details on a record — the edit control on the card. It is offered only for people with no account of their own; a member owns their own name and changes it on [My Profile](/personal-info).',
                'Connected to the wrong person — remove the connection. Both people stay in the family.',
              ),
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
                { term: 'Planning', text: 'Being put together. Dates may still move.' },
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
                'Fill in **Title** and **First day**, and **Last day** only if it runs more than one day.',
                '**Where** and **What it is** are optional.',
                'Press **Schedule gathering**. You land on the gathering itself, where any tasks it just made are waiting.',
              ),
              p('Each template decides for itself who may schedule from it, so the list offered here is not the whole library — one set to Administrators only is not on it unless you can manage gatherings, and an archived template cannot start anything new. Where nothing is offered at all, the form says the gathering will be a date with no tasks and points at the library for whoever can author one: nothing is wrong with your access.'),
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
              p('**Organize this gathering** appears for somebody who can run it and leads to the same gathering on [Gathering Management](/admin/gatherings), where the work is handed out and ruled on.'),
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
        summary: 'The month grid that puts every gathering on the day it falls, how to move between months, and what it does on a phone.',
        route: '/gatherings/calendar',
        sections: [
          {
            id: 'what-it-is',
            heading: 'One month at a time',
            blocks: [
              p('[Calendar](/gatherings/calendar) is a real month grid — weeks down, weekdays across, Sunday first — with the family\'s gatherings on the days they fall. It creates nothing: everything on it is a link into [Gatherings](/gatherings), where the thing itself lives and is edited.'),
              p('The legend under the grid names the two treatments — **Premier gathering** and **Gathering** — and every entry says which it is in words as well as in colour, so the distinction survives both a screen reader and a reader who cannot separate the two hues. There was a third for an Event until 2026-08-19; that product is retired.'),
            ],
          },
          {
            id: 'reading',
            heading: 'Reading a day',
            blocks: [
              p('Today is marked. Something running over several days appears on every day it covers, which is the whole reason a closing date exists — a three-day reunion is on the grid three times, and each one is the same link.'),
              p('The grid always shows whole weeks, so the first and last rows carry a few days from the months either side. Those days keep their entries: a reunion starting on the 1st is visible in the last row of the month before, which is where you would be looking for it a week earlier.'),
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
            ],
          },
          {
            id: 'missing',
            heading: 'When something is not on it',
            blocks: [
              p('A line above the grid appears when the gatherings are missing from it. It means one of two things and cannot tell which: that screen has not been shared with you, or it could not be read just now.'),
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
            ],
          },
          {
            id: 'money',
            heading: 'The fund, the budget, and the red line',
            blocks: [
              p('A budget is always drawn on a fund, and the two are saved together — clearing the fund clears the budget with it, and the amount box will not take a figure until a fund is chosen. Funds are set up under [Accounting](/admin/account?section=funds); see [Accounting](/help/accounting#funds).'),
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
                'Type a name under **Template name** — name it for the occasion, "Family Reunion", "Memorial Service", "Scholarship Banquet".',
                'Choose **Who can schedule from this**.',
                'Press **Add template**.',
                'The card that appears is shut. Press its name to open it, add a **Description**, press **Save changes**, and give it a step for each thing somebody has to do.',
              ),
              p('**Every template card is shut until you open it.** A card holds the whole template — its name, who may schedule from it, its description and a row per step — which is a page of its own once a family has half a dozen. Shut, each one shows its name and how many steps it has, so the library reads as a list of what you have rather than as everything about everything. Press a name to open it; press again to shut it.'),
              note('A card you have edited but not saved says **Unsaved changes** beside its name while it is shut, and shutting one never throws an edit away — reopening it finds what you typed.'),
              p('A name has to be unique within the family, so a second "Family Reunion" is refused rather than added quietly beside the first. The description is what an organiser reads before scheduling from it, and it is shown beside the template when they pick one.'),
              note('There was a **Usual location** field here until 2026-08-19 and there is not now. A template stating where its gatherings are usually held was an author guessing at a fact that belongs to one occasion, and the guess then had to be corrected on every segment it was copied onto. Ask for the venue instead: a step of kind **A place**, handed to a named relative with a due date.'),
            ],
          },
          {
            id: 'steps',
            heading: 'The steps',
            blocks: [
              steps(
                'Type the label under **Add a step** — "Book the hall", "Head count", "Catering".',
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
              p('The arrows on a row move a step earlier or later, and that order is the order the tasks are handed out in. **Save** appears on a row once something on it has changed, so nothing is written per keystroke. Deleting a step leaves every task already made from it exactly where it is.'),
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
                'Under **Add a step**, type a label — it heads nothing on its own, so name it for what the reader of this template should see, "The catering checklist".',
                'Choose **Another template** under **What it asks for**.',
                'Pick the one to include under **Template to include**.',
                'Press **Add step**.',
              ),
              p('**Required** and **Suggested budget** are not offered for this kind and that is deliberate: nobody is going to answer it, so there is nothing to require and no single job to price. The steps it brings in carry their own.'),
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
                { term: 'Account Standing / Next Installments', text: 'What you owe and what the next payment comes to. In full on [Dues](/accounting/dues).' },
                { term: 'Paid This Year', text: 'Your total for the year, broken down by schedule. In full on [Payment History](/reporting/payment-history).' },
                { term: 'Open donation drives', text: 'The drives still running. Closed ones are counted here and listed on [Donations](/accounting/donations).' },
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
        title: 'Your dues',
        summary: 'Every schedule you are on, what the next payment has to be, and how to change how often you pay.',
        route: '/accounting/dues',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Your schedules',
            blocks: [
              p('[Dues](/accounting/dues) lists every schedule you are on: what it costs a year, what one installment comes to, when the next one falls, and what is left. The two cards at the top are the same ones [Summary](/accounting/summary) leads with.'),
              p('It never shows anybody else\'s dues, whatever you have been granted. What the family as a whole has paid is a different question, asked on [Transactions](/reporting/transactions).'),
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
              p('Each schedule has a **Pay cadence** you set for yourself — weekly, monthly, quarterly, annual, or one-time. The annual total does not change; the cadence divides it.'),
              p('This is yours to set and needs no permission from anybody. Nobody else can set it for you.'),
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
              p('**Opt out** on a schedule says it does not apply to you — a fund you are not part of, a chapter you do not belong to. It asks you to confirm, and **Opt back in** reverses it. Only an optional due offers it; a required one has no button.'),
              note('Opting out is not the same as having paid. It removes the schedule from your balance going forward; it does not erase what was already owed.'),
            ],
          },
        ],
      },
      {
        slug: 'donations',
        title: 'Donations',
        summary: 'The drives your family is running, how far each has got, and what you have given.',
        route: '/accounting/donations',
        sections: [
          {
            id: 'drives',
            heading: 'What a drive shows',
            blocks: [
              p('[Donations](/accounting/donations) lists every drive the family has run, each with a bar showing how far it has got. Under the bar: what has been raised, what the goal was, and — only if you have given to it — how much of that was yours.'),
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
              p('Giving online is not built yet, which is why **Give** is there and does nothing. Hand your gift to whoever keeps the books and it appears here — and in your [payment history](/reporting/payment-history) — once they record it.'),
              note('Nothing on this page says who gave what. Every figure is either a family total or your own.'),
            ],
          },
        ],
      },
      {
        slug: 'payment-history',
        title: 'Payment history',
        summary: 'Everything recorded against you, with its date, amount, method and status.',
        route: '/reporting/payment-history',
        sections: [
          {
            id: 'the-list',
            heading: 'The list',
            blocks: [
              p('[Payment History](/reporting/payment-history) is every payment the family has recorded against you — dues and donations in one list, each row tagged with which it was. Any column heading sorts, and the **Filter** box narrows by schedule, method or status.'),
              p('It is under **Reporting** in the rail, beside [Transactions](/reporting/transactions). The two are the money read back — this one is yours, that one is the family\'s — while [Accounting](/admin/accounting) is where it is set up in the first place.'),
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
              p('[Transactions](/reporting/transactions) is under **Reporting** in the rail, beside [Payment History](/reporting/payment-history) — the family\'s whole record rather than your own. It is one rail of five tabs, one per kind of entry.'),
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
              note('This is why the totals here agree with what each member sees on their own [Dues](/accounting/dues) screen. A single calendar year would have been tidier and would have disagreed with every member\'s balance.'),
            ],
          },
          {
            id: 'who-is-counted',
            heading: 'Who is counted',
            blocks: [
              p('Everybody the family has approved — the same list the [Member Directory](/community/directory) shows. Somebody recorded on the [family tree](/community/family-tree) who has never signed in owes their dues exactly as much as anybody else does, so they are counted. Leaving them out never made the debt smaller; it made this screen report a smaller one.'),
              p('The **Status** column answers a different question from the money: whether there is anybody to send an invoice to.'),
              defs(
                { term: 'Active', text: 'They have an account, and the due shows on their own [Dues](/accounting/dues) screen.' },
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
                { term: 'Pending invite', text: 'Recorded in the family and never asked to join. This is the one you can act on — invite them from the [family tree](/community/family-tree).' },
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
              p('[Accounting](/admin/accounting) is where the money is *configured*. Recording an actual payment happens on [Transactions](/reporting/transactions), under **Reporting** in the rail. Each section here is its own permission, so maintaining the dues schedule and paying money out are different jobs.'),
              p('The rail across the top of the page holds **Dues & Donations**, **Funds**, **Routing**, **Milestones**, **Processing** and **Bank Information**. Dues and donations share one pane: where you can see both, the two lists sit one under the other, headed **Dues** and **Donations**, with a **New Dues** and a **New Donation** button beside the rail.'),
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
              p('**Bloodline only** restricts a due to the members descended from the family\'s line. Anybody who married in, and any step, adopted or foster relative, owes nothing and does not see it on their own Dues screen at all — a due that is never theirs is not listed as something they are not paying.'),
              note('The control is unavailable until your family has said which ancestor its line descends from, because without that there is no bloodline and the due would be owed by nobody. Set **Bloodline descends from** on the [family tree](/community/family-tree) first. Who is in the bloodline is worked out from the tree every time, so correcting a relationship — or moving that setting — changes who owes the due.'),
              p('**Owed by** says which part of the family owes it: National — the whole family — or one region, or one chapter. It only appears once your family has a region or a chapter to choose; until then every due is National, which is what National means. A member with no chapter is under National and owes nothing scoped, so a chapter due bills only the people who have said they are in that chapter. See [regions and chapters](/help/regions-and-chapters#dues).'),
              note('A schedule that has been paid against cannot simply be deleted, and its amount, frequency, start date, starting age, bloodline setting and **Owed by** are then fixed — every payment already recorded was made against those terms. Changing who owes a due would restate whether people owed it for periods already billed, which is why it is on that list. The page tells you when one is in use. The end date can still change.'),
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
            id: 'not-yet',
            heading: 'Processing and Bank Information',
            blocks: [
              p('Both sections exist on the rail and neither is wired up yet. They are where card processing and the family\'s bank details will live; nothing is stored in them today.'),
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
                { term: 'Members', text: 'Everybody in the family, and which permission template each is on. Four columns — Name, Region, Chapter and Group — with everything else about a person behind their name, exactly as on the [Directory](/help/directory#columns).' },
                { term: 'Organization', text: 'What shape the family is: its regions and chapters, and the board positions it keeps. It sits second because the regions and chapters are what the Members table\'s Region and Chapter columns are read against. Two chapters cover it: [Organization](/help/regions-and-chapters) and [Board Positions](/help/board-positions).' },
                { term: 'Pending Approval', text: 'The people asking to join, and the invitations you have sent.' },
                { term: 'Permission Templates', text: 'The templates themselves, and what each one grants.' },
              ),
              p('The four are granted separately and the page opens for any of them — somebody can work the approvals queue without being able to edit templates, and somebody can keep the family\'s chapters in order without being able to see the roster at all.'),
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
              p('**Organization** is the fourth tab of [Members](/admin/users?tab=organization), and it is how a family that is spread out organises itself. A **chapter** is where a member actually belongs — Houston, Atlanta — and a **region** is a group of chapters, like Texas or Eastern. A family can run on chapters alone, on both, or on neither.'),
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
              note('Nothing here is a dead end. Re-scope a due to the whole family under [Accounting](/admin/account?section=dues) and the region deletes.'),
            ],
          },
          {
            id: 'dues',
            heading: 'What a chapter decides about money',
            blocks: [
              p('A dues schedule is owed by the whole family, by one region, or by one chapter — set with **Owed by** on the dues form under [Accounting](/admin/account?section=dues). See [Accounting](/help/accounting#dues).'),
              defs(
                { term: 'National', text: 'Every member owes it. The default, and the only option until you have created a region or a chapter.' },
                { term: 'A region', text: 'Only members whose CHAPTER is in that region owe it.' },
                { term: 'A chapter', text: 'Only members in that chapter owe it.' },
              ),
              p('**A member with no chapter is under National**, so a regional or chapter due does not apply to them at all — it does not appear on their [Dues](/accounting/dues) screen and they are never billed for it. That is the state every family starts in, and it is the commonest reason a new chapter due collects nothing: [Dues Projections](/reporting/dues-projections) says so on the schedule\'s row when nobody in the family is in the part it is for.'),
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
              p('**Board Positions** is the list of offices your family actually keeps — President, Treasurer, a Reunion Chair — and a record of who holds each one. It is the lower half of the **Organization** tab of [Members](/admin/users?tab=organization), under the regions and chapters: one tab answers both halves of "what shape is this family in?".'),
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
              steps(
                'Press **Assign** on the position\'s row.',
                'Find the person — the search box matches any part of any name, ignoring accents and punctuation.',
                'For a regional or chapter position, choose which region or chapter it is for.',
                'Press **Assign**.',
              ),
              p('More than one person can hold the same position, which is what a regional or chapter office needs. The **Held by** column lists everybody, with the region or chapter beside each name.'),
              note('Only relatives who have finished registering can hold a position. Somebody recorded on the family tree without an account cannot, because the record of who holds an office is attached to their account — invite them first, from [Family Tree](/community/family-tree).'),
            ],
          },
          {
            id: 'removing',
            heading: 'Taking one away, and removing a position',
            blocks: [
              p('The **×** beside a name takes that position away from that person. They stay a member of the family and nothing else about them changes.'),
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
              p('The positions on this list are also what an election can be held for, once Elections ships.'),
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
              p('The panel at the top of the page shows which plan the family is on, what it costs monthly and for the year, and what it includes. It is also where an administrator moves the family between plans. **Features** on any row opens the full list for that plan. See [Plans](/help/plans).'),
              p('Moving down asks for your password as well as a confirmation, because it closes pages for every member of the family at once. Nothing is deleted either way, and nothing is billed — there is no payment step yet.'),
            ],
          },
          {
            id: 'removal',
            heading: 'Removing the family',
            blocks: [
              p('**Remove this family**, at the bottom of the page, switches the whole family off. Nobody can open it, the family code stops working, and any invitation still outstanding stops being accepted. It is offered only to somebody whose permission template grants **Remove Family**, which is separate from the one that lets you rename the family.'),
              note('Nothing is deleted. Every payment, fund, photograph, event, message, document and person stays exactly where it is. Removing closes the family\'s doors; it destroys no records at all.'),
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
              p('Free, Standard, Plus and Premium, and they are inclusive — each one is everything below it and more. What each includes is listed on the plan panel at the top of [Settings](/admin/settings), which is the copy that is kept current.'),
              p('Each paid plan shows one price on that panel, per month, month to month. No figure is written down here — the panel reads the real one, and a price copied into a manual is a price that goes out of date without anybody noticing.'),
              note('Free is free, and not a trial. The three paid plans have prices and none is on sale yet: there is no payment step anywhere in the product, so nothing is billed whichever plan a family is put on. Every paid card says so.'),
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
              p('A plan decides which screens a family can open, and nothing else. A family that moves to a cheaper plan keeps every record it has ever entered — the pages that read them simply stop opening. Moving back brings them straight back.'),
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
