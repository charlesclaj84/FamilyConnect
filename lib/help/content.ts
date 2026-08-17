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
              p('Everything in the product is reached from the burgundy rail. Its headings group screens by what they are for — **Community**, **Events**, **Accounting**, **Resources**, **Admin**, **Help** — and a heading opens when you click it, closing the one that was open.'),
              p('The rail only lists screens you can actually open. If a heading you expected is missing, it is because every screen under it is either not part of your family plan or not something your family has given you. That is not a fault — see [Who can do what](/help/who-can-do-what).'),
              p('On a phone the rail is behind the **Menu** button at the top left. It closes itself as soon as you pick something.'),
            ],
          },
          {
            id: 'the-top-bar',
            heading: 'The bar across the top',
            blocks: [
              p('Four controls sit at the top right of every page.'),
              defs(
                { term: 'Family switcher', text: 'Shown when your account belongs to more than one family. Picking a different family reloads the page you are on as that family.' },
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
              p('The code is always available afterwards on [Settings](/admin/family) and on [My Families](/my-families).'),
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
            id: 'at-a-glance',
            heading: 'At a Glance',
            blocks: [
              p('Up to three figures, and each appears only if it is genuinely yours to see:'),
              defs(
                { term: 'Family Members', text: 'How many approved people are in the family. People recorded on the tree without an account are counted — they are family. People still waiting to be approved are not.' },
                { term: 'Dues Collected', text: 'What the family has taken in this year. Shown only to somebody who may see the ledgers.' },
                { term: 'Pending Approval', text: 'How many people are waiting. It appears only when somebody actually is, and only for whoever can act on it.' },
              ),
            ],
          },
          {
            id: 'quick-actions',
            heading: 'Quick Actions',
            blocks: [
              p('Shortcuts to the three things people do most — add a member, record a payment, send a message. A button appears only if you may do the thing it names, so an empty Quick Actions panel is not a fault.'),
            ],
          },
          {
            id: 'recent-updates',
            heading: 'Recent Updates',
            blocks: [
              p('Your notifications and the family\'s announcements in one list. Pinned announcements ride at the top until you dismiss them; a dismissed one falls back into the list in date order rather than disappearing, so you can always find it again.'),
              p('Dismissing is per person, not per browser — do it on your laptop and your phone agrees.'),
            ],
          },
          {
            id: 'balance',
            heading: 'Remaining Balance',
            blocks: [
              p('What you personally still owe this year, across every dues schedule you are on. It is the same figure [Summary](/account-summary) leads with, and **View Dues** takes you to the schedule-by-schedule detail on [Dues](/dues).'),
            ],
          },
          {
            id: 'donation-drives',
            heading: 'Donation Drives',
            blocks: [
              p('Every drive the family currently has open, with how far it has got toward its goal and how much of that came from you. Drives that have closed are not here — the bar cannot move any more — but they are still on [Donations](/donations).'),
              p('The soonest to close comes first, and the panel names the count if there are more than three. It does not appear at all when no drive is open, which is most families most of the time.'),
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
        route: '/chat',
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
        summary: 'Family news, who sees it, and what pinning actually does.',
        route: '/announcements',
        sections: [
          {
            id: 'reading',
            heading: 'The board',
            blocks: [
              p('A stack of posts, newest first, each showing who wrote it and when. Pinned posts are marked and also ride at the top of everybody\'s Recent Updates on the dashboard.'),
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
        ],
      },
      {
        slug: 'directory',
        title: 'Directory',
        summary: 'Everyone in the family, searchable, with how to reach them.',
        route: '/members',
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
              p('Name, phone, email, city and state, and the **Group** the person is on — which is the permission template deciding what they can do. On a narrow screen the extra columns fold underneath the name rather than sliding off the side, so nothing is ever parked out of view.'),
              p('People recorded on the family tree without an email address appear here too. A recorded great-uncle is a member of the family; he simply has no account.'),
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
        route: '/family-tree',
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
              p('The tree opens in **View**. Switching to **Edit** turns on the **+** buttons, the record editor and the remove controls. Any approved member may edit — building the family\'s tree is something the family does together.'),
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
    id: 'events',
    title: 'Events',
    blurb: 'Getting the reunion on the calendar, and getting everybody to it.',
    chapters: [
      {
        slug: 'events',
        title: 'Events and RSVPs',
        summary: 'Finding what is coming up, saying who is attending, and reading the details.',
        route: '/events',
        sections: [
          {
            id: 'browsing',
            heading: 'What is coming up',
            blocks: [
              p('[Upcoming Events](/events) lists everything ahead, with the dates, the place and the RSVP deadline. **Confirmed** means the event has been approved rather than merely drafted. Click through for the whole thing.'),
            ],
          },
          {
            id: 'the-page',
            heading: 'An event page',
            blocks: [
              p('The description, the dates and the address, and then whichever of these the organisers have filled in:'),
              defs(
                { term: 'Official Information', text: 'The formal wording — venue rules, dress, what to bring.' },
                { term: 'Itinerary', text: 'The individual sessions inside the event, with their own times and places.' },
                { term: 'Hotels', text: 'Room blocks, with rates and booking details.' },
                { term: 'Who is coming', text: 'A summary of the RSVPs so far.' },
              ),
            ],
          },
          {
            id: 'rsvp',
            heading: 'Responding for your household',
            blocks: [
              p('You RSVP for everybody in your household at once, not just yourself — that is what makes a head count usable.'),
              steps(
                'Press **Edit RSVP**.',
                'Set **Yes** or **No** for each person listed.',
                'Press **Save RSVP** and confirm the count.',
              ),
              p('Each person\'s t-shirt size is shown beside their name while you are editing, so a missing one is obvious before the order goes in. Fill it in on [My Profile](/personal-info?section=additional).'),
              note('You can change your answer as often as you like until the RSVP deadline. After it, the response is locked and you will need to speak to whoever is organising.'),
            ],
          },
        ],
      },
      {
        slug: 'event-planning',
        title: 'Event Planning',
        summary: 'The planning tasks assigned to you, and how to respond to them.',
        route: '/event-planning',
        sections: [
          {
            id: 'assignments',
            heading: 'Your assignments',
            blocks: [
              p('When an event is created from a template, its checklist is handed out to named people. This page is your share of it — one row per item, with the event it belongs to and its deadline.'),
              p('The rail item only appears while you have something outstanding. It disappears when everything is done, which is the intended end state rather than a fault.'),
            ],
          },
          {
            id: 'responding',
            heading: 'Responding',
            blocks: [
              p('Each item asks for the answer its template said it needed — a tick, a date, a list, or the names of people — and records it against the event. An item left past its deadline is marked rather than silently forgotten, so whoever is running the event can see where the gaps are.'),
            ],
          },
        ],
      },
      {
        slug: 'running-events',
        title: 'Running an event',
        summary: 'Creating events, reusable templates, approving, and day-of check-in.',
        route: '/admin/events',
        sections: [
          {
            id: 'creating',
            heading: 'Creating an event',
            blocks: [
              steps(
                'Open [Event Management](/admin/events) and start a new event.',
                'Name it, and pick a template if you have one.',
                'Set the dates — or tick **All Day** — and the venue and address.',
                'Save. It is a draft until it is approved.',
              ),
              p('From the event\'s own page you then add the itinerary, the hotel blocks, and the planning assignments.'),
            ],
          },
          {
            id: 'templates',
            heading: 'Event Templates',
            blocks: [
              p('[Event Templates](/admin/event-types) are reusable blueprints — a named kind of event with a planning checklist attached. Creating an event from one hands its checklist out automatically instead of somebody rebuilding the same list every year.'),
              p('Templates are worth the effort the second time you run the same kind of event, and not before.'),
            ],
          },
          {
            id: 'approving',
            heading: 'Approving',
            blocks: [
              p('A drafted event is visible but not confirmed. Approving it marks it **Confirmed** for the family. It is a separate permission from creating one, so a committee can propose and one person can commit.'),
            ],
          },
          {
            id: 'checkin',
            heading: 'Day-of check-in',
            blocks: [
              p('Each event has a **Check-In** screen for the day itself: the expected list from the RSVPs, and a mark against each person as they arrive. It is designed to be worked on a phone at a door.'),
            ],
          },
          {
            id: 'rsvps',
            heading: 'Reading the responses',
            blocks: [
              p('The event page carries the RSVP summary — who has answered, who is coming, and the t-shirt counts drawn from each attendee\'s profile. Somebody with no size on file shows as missing rather than as a guess.'),
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
        route: '/account-summary',
        sections: [
          {
            id: 'what-it-is',
            heading: 'A digest, not a screen of its own',
            blocks: [
              p('[Summary](/account-summary) shows the headline of each of the four things below it and names where the rest is. Nothing lives only here — every figure has a screen behind it, reached from the link beside its heading or from the **Accounting** section of the rail.'),
              defs(
                { term: 'Account Standing / Next Installments', text: 'What you owe and what the next payment comes to. In full on [Dues](/dues).' },
                { term: 'Paid This Year', text: 'Your total for the year, broken down by schedule. In full on [Payment History](/payment-history).' },
                { term: 'Open donation drives', text: 'The drives still running. Closed ones are counted here and listed on [Donations](/donations).' },
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
        route: '/dues',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Your schedules',
            blocks: [
              p('[Dues](/dues) lists every schedule you are on: what it costs a year, what one installment comes to, when the next one falls, and what is left. The two cards at the top are the same ones [Summary](/account-summary) leads with.'),
              p('It never shows anybody else\'s dues, whatever you have been granted. What the family as a whole has paid is a different question, asked on [Transactions](/transactions).'),
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
        route: '/donations',
        sections: [
          {
            id: 'drives',
            heading: 'What a drive shows',
            blocks: [
              p('[Donations](/donations) lists every drive the family has run, each with a bar showing how far it has got. Under the bar: what has been raised, what the goal was, and — only if you have given to it — how much of that was yours.'),
              p('A drive that has passed its goal keeps going rather than stopping at 100%: the bar rescales and the excess is shown as its own segment, because a drive that doubled its target should not look like one that scraped in.'),
              p('A drive with no goal set has no bar to draw, so it shows the running total instead.'),
            ],
          },
          {
            id: 'closed',
            heading: 'Closed drives',
            blocks: [
              p('A drive past its end date is marked **Closed** and dimmed, and it stays on this page. [Summary](/account-summary) lists only the open ones and counts the rest — a digest is about what to do next, and this page is the full record.'),
            ],
          },
          {
            id: 'giving',
            heading: 'Giving to one',
            blocks: [
              p('Giving online is not built yet, which is why **Give** is there and does nothing. Hand your gift to whoever keeps the books and it appears here — and in your [payment history](/payment-history) — once they record it.'),
              note('Nothing on this page says who gave what. Every figure is either a family total or your own.'),
            ],
          },
        ],
      },
      {
        slug: 'payment-history',
        title: 'Payment history',
        summary: 'Everything recorded against you, with its date, amount, method and status.',
        route: '/payment-history',
        sections: [
          {
            id: 'the-list',
            heading: 'The list',
            blocks: [
              p('[Payment History](/payment-history) is every payment the family has recorded against you — dues and donations in one list, each row tagged with which it was. Any column heading sorts, and the **Filter** box narrows by schedule, method or status.'),
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
        route: '/transactions',
        sections: [
          {
            id: 'ledgers',
            heading: 'The five ledgers',
            blocks: [
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
        route: '/dues-projections',
        sections: [
          {
            id: 'what-it-is',
            heading: 'What it answers',
            blocks: [
              p('[Transactions](/transactions) is what came in. This is what should: every active dues schedule, multiplied out across the members who owe it, set against what has actually been collected.'),
              p('Nothing on this screen changes anything. Recording a payment or waiving one is on [Transactions](/transactions); changing what a due costs is under [Accounting](/admin/account).'),
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
              note('This is why the totals here agree with what each member sees on their own [Dues](/dues) screen. A single calendar year would have been tidier and would have disagreed with every member\'s balance.'),
            ],
          },
          {
            id: 'who-is-counted',
            heading: 'Who is counted',
            blocks: [
              p('Approved members **with an account**. Somebody recorded on the family tree without one is family, and is not somebody a cheque is expected from — the screen says how many those are so the member count can be reconciled against the [Directory](/members).'),
              p('Three things reduce what a member owes, and all three are honoured: a due that starts at an age, an optional due they have declined, and anything the family has waived.'),
              note('Anyone with no date of birth recorded owes an age-limited due in full, because an age is never guessed at. If a figure looks too high, that is the first thing to check.'),
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
              ),
              p('**Only those who owe** narrows the table, and the filter box searches any part of any name.'),
            ],
          },
        ],
      },
      {
        slug: 'accounting',
        title: 'Accounting',
        summary: 'Setting up dues schedules, donation drives, funds, routing and milestones.',
        route: '/admin/account',
        sections: [
          {
            id: 'what-it-is',
            heading: 'Setup, not the day\'s work',
            blocks: [
              p('[Accounting](/admin/account) is where the money is *configured*. Recording an actual payment happens on [Transactions](/transactions). Each section here is its own permission, so maintaining the dues schedule and paying money out are different jobs.'),
            ],
          },
          {
            id: 'dues',
            heading: 'Dues',
            blocks: [
              p('A dues schedule is what a member owes over a year: a name, an amount, how often it is natively billed, and which fund it lands in. Members then choose their own cadence within it.'),
              p('The start date matters. It anchors the ladder of due dates, and the form prefills today — which is fine, and worth a moment\'s thought if you are entering last year\'s schedule.'),
              p('**Members start paying at age** is how a family says the children do not pay. Leave it blank and everybody owes the due whatever their age. Put 18 in it and a member owes nothing until they turn 18, then the months of that year after their birthday, then the full amount every year afterwards — a $120 due and a July birthday is $50 that year. The row shows it as **From age 18+**.'),
              note('A member with no date of birth recorded owes the due in full, because the product will not guess at an age. Adding a child to the [family tree](/family-tree) without an email address asks for a birthday for exactly this reason.'),
              note('A schedule that has been paid against cannot simply be deleted, and its amount, frequency, start date and starting age are then fixed — every payment already recorded was made against those terms. The page tells you when one is in use. The end date can still change.'),
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
    blurb: 'Who is in the family, what each of them may do, and what the family is called.',
    chapters: [
      {
        slug: 'members-and-access',
        title: 'Members',
        summary: 'The roster, the approvals queue, invitations, and the permission templates behind them.',
        route: '/admin/users',
        sections: [
          {
            id: 'tabs',
            heading: 'Three tabs, three jobs',
            blocks: [
              defs(
                { term: 'Members', text: 'Everybody in the family, and which permission template each is on.' },
                { term: 'Pending Approval', text: 'The people asking to join, and the invitations you have sent.' },
                { term: 'Permission Templates', text: 'The templates themselves, and what each one grants.' },
              ),
              p('The three are granted separately and the page opens for any of them — somebody can work the approvals queue without being able to edit templates.'),
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
                'Work down the grid, setting each feature\'s **view**, **create**, **edit** and **delete**.',
                'Put people on it from the row menu on the **Members** tab.',
              ),
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
        slug: 'family-settings',
        title: 'Settings',
        summary: 'The family\'s name, the code relatives join with, and the plan it is on.',
        route: '/admin/family',
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
              p('The panel at the top of the page shows which plan the family is on and what it includes, and is where an administrator moves it. See [Plans](/help/plans).'),
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
              p('Your family\'s administrators decide the templates and who is on which, from [Members](/admin/users).'),
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
            id: 'three',
            heading: 'Three plans',
            blocks: [
              p('Free, Plus and Premium, and they are inclusive — Plus is everything in Free and more, Premium is everything in Plus and more. What each one includes is listed on the plan panel at the top of [Settings](/admin/family), which is the copy that is kept current.'),
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
