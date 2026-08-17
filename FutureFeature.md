# Future features — what the site promises, and what is still gated

> ## 2026-08-13: tier enforcement exists, and this file's central premise has changed
>
> Read this before anything below it. The sentence this document repeats most often —
> *"nothing in the codebase enforces a tier at all"*, and its consequence, *"until there
> is, **every flip is a Free flip**, whatever the pricing page says"* — **is no longer
> true.** Decisions 9's underlying question ("where does tier enforcement live at all?")
> is answered.
>
> `lib/features.ts` now carries a **required** `tier` on every entry, `families.tier`
> (`20260813000003`) says what each family pays for, and `requireView()` sends a member
> reaching past their plan to `/upgrade` rather than to the page. The sidebar and the
> permission grid drop above-tier rows. AGENTS.md, "A family is on a plan", is the
> reference.
>
> **What that closes, and what it does not.** It closes the *mechanism* gap, so §4's two
> open rows stop being unfixable — but it does not by itself decide them, and neither has
> moved yet:
>
> * **RSVPs and head counts** are still free to everybody, because the tier is per ROUTE
>   and they live inside `/events`, which is Free. Splitting them needs a sub-key, exactly
>   as `transactions/dues-payments` has one. The registry now says so in its own header.
> * **Profile pictures** are still free to everybody, for a sharper version of the same
>   reason: `AvatarUpload` is one control on `/personal-info`, a page that stays Free.
>
> **Two decisions this pass made rather than deferred**, both previously in the list below:
>
> * **`/event-planning` is Free** — decision 3, which warned it would otherwise "decide
>   itself as Free by default". It has now decided itself as Free deliberately.
> * **`/admin/account`, `/admin/events` and `/admin/event-types` are Free**, because the
>   Free card sells the dues ledger and the reunion on the calendar, and neither works
>   without the screen that sets it up. Decisions 1 and 2 are narrowed rather than closed:
>   what remains is whether individual CAPABILITIES inside those pages (hotel blocks,
>   nested itineraries, per-event budgets, event templates) should be sub-keyed onto Plus.
>
> **Three other things below are now stale.** The `/admin/announcements` row is gone —
> that route was deleted on 2026-08-13 and its permission resource with it, because
> everything it did the member-facing Announcements page does under the same key. The
> family-tree rows describe a beta scaffold; `/family-tree` is a working tree now, and
> what it still owes is in TODO.md rather than here. And `event-photos` is no longer
> reachable through a live feature: the Photos card on an event now reads
> `isFeatureLive('/photos')`, so the storage rework is preventative again rather than
> remedial — the `avatars` bucket is the one that is still live and world-readable.
>
> Re-derive the per-card table and the counts before quoting them; they were written
> against a product with no tier mechanism at all.

> ## 2026-08-13, later: EVERY `/direct-lineage` ROW BELOW IS VOID
>
> This file names `/direct-lineage` about eight times, and every one of them is now wrong
> in the same way: they treat it as the last gated route on the Free card, one word away
> from shipping, blocked only on "where child management and convert-to-adult sit". That
> question was answered by **deleting the route**, not by flipping it.
>
> A child is not a second kind of person. They join the family the way any relative
> without an email address does — the family tree's "No email address" mode — and stop
> being a special case the day somebody invites them, which is the ordinary invitation
> flow rather than a conversion. `/direct-lineage`, `app/actions/children.ts`,
> `components/direct-lineage/` and `lib/family-constants.ts` are gone; `20260813000006`
> dropped `people.is_minor`; `editPersonRecord` and `invitePersonRecord` on the tree took
> over the two jobs that page really did. AGENTS.md §4b is the reference.
>
> **So the Free card has no gated routes left at all** — the count this file reports as
> "7 promised, 6 live, 1 gated" is now 6 and 6, because the seventh was withdrawn rather
> than delivered. Nothing on `/pricing` advertised it by name (`PLANS[]` sells the tree
> and the directory, and both are live), so no bullet has to move — but check that for
> yourself before quoting the table, exactly as the note above says.


The marketing site describes the product GENORRA is becoming. `lib/features.ts` describes
what a member can reach today. This file is the distance between the two, so the gap is
tracked rather than discovered.

**It is not a defect list.** The revamp is deliberate and every gated feature is already
built. What follows is a delivery order and, for each feature, the specific work that has to
land with the flip.

Generated 2026-08-12 from a six-agent audit of `lib/features.ts`, the eight marketing
surfaces, `PLANS[]`, and the storage migrations. Two independent verifiers corrected the
first pass; their corrections are folded in.

Revised the same day for the pricing edit that re-ranked all three cards, moved per-feature
permissions from Plus to **Free**, added profile pictures to Plus, and gave Premium the four
reach features. **A bullet moving between tiers changes what this file says about it without
changing a line of code** — the severity rubric below is keyed to the tier a claim is sold
in, so `PLANS[]` is as much an input to this document as `lib/features.ts` is.

---

## Where things stand

| | Count |
|---|---|
| `FEATURES[]` entries | 28 |
| `status: 'live'` | 18 |
| `status: 'future'` | 10 |
| **Gated features already built** | **10 of 10** |
| Marketing claims with no code at all | 9 |
| Marketing claims resolving to a gated feature | 22 — **stale, re-derive** |

**Live overtook gated on 2026-08-12.** It was 10 live and 17 future when this file was
written, and 11 after `/admin/family` (Family Settings) landed. Then seven routes flipped in
one afternoon — `/announcements`, `/admin/announcements`, `/events`, `/event-planning`,
`/admin/events`, `/admin/event-types` and `/family-tree` — which is what took live from 11
to 18 and gated from 17 to 10. This document was written against a product that was mostly
gated and is now describing one that mostly is not; the delivery order below has been reduced
accordingly rather than reordered.

The claims-with-no-code figure was 5 until the Premium card took on the four reach features —
apps, notifications, email distributions and automatic dues reminders. None has a route, so
none can be gated, and none of them moved on 2026-08-12; see the register.

**The last row is knowingly stale and is left visible rather than guessed at.** The flips
closed the claim sets behind Announcements (8 + 3), Events (19 + 7 + 1 + 3) and — partly, in
a way a count cannot express — the family tree's 15. Re-derive it against the marketing
surfaces before quoting it; the *partly* is why nobody should subtract in their head.

**Nothing in the registry is unbuilt.** Every gated route has its page, its client and its
server actions in the repo — `AdminEventDetailClient` is 1,361 lines, `admin/events.ts`
1,078. `/admin/boardpositions` says so in its own comment: *"shipping it again is this one
word."* So the remaining work is a status flip plus targeted fixes, not construction. That is
the single most important fact in this document, because it sets the size of everything
below.

**The one exception has closed.** The family-wide tree at `/family-tree` was the only entry
in the registry that was `'live'` with nothing behind it — a beta scaffold, badged as such,
because it was being built differently rather than un-gated. It was built on 2026-08-13, and
the per-member lineage view retired with it; `FamilyTreeClient` (853 lines), `ancestors.ts`
(1,014) and `spouse.ts` are deleted rather than waiting on a flip, which is why they no
longer appear in the line-count list above.

**Two mitigations already in place, worth knowing before reading the gap list:**

- **No public click path into Coming Soon.** The marketing site links no gated route —
  `ACCOUNT_ROUTES` is exactly `{ login, register }`. A visitor cannot walk from a promise into
  a wall; only a signed-in member can, from the sidebar.
- **The sidebar removes gated items rather than badging them,** and drops a whole section when
  it empties. A member does not see a teased door — they see no door. **Events came back on
  2026-08-12** and the section reappeared with all four of its items, exactly as this
  mechanism promises; **Resources** — photos, documents, elections — is the one still absent
  entirely. The rail carried one hand-set badge, the opposite case: `BetaBadge` on Family
  Tree, marking a route that is live and unfinished rather than one nobody can reach. It came
  off on 2026-08-13 when the tree stopped being unfinished, so **the rail badges nothing
  today** — the component survives for the next surface that needs it.

### What each pricing card promises today

Read per card rather than per feature, because a card is what a buyer actually reads. Counted
against `PLANS[]` as it stands after the 2026-08-12 re-rank:

| Card | Bullets | Fully live | What the card still needs |
|---|---|---|---|
| **Free** | 7 | **6** | 1 route inside one bullet (`/direct-lineage`), and the family-wide tree in that same bullet is a beta scaffold rather than a tree |
| **Plus** | 8 | 2 — and **both are free to everyone** | 5 flips, 1 build (payment processing), 2 tier decisions (RSVPs and head counts; profile pictures) |
| **Premium** | 6 | 0 | 6 builds, not one of which has a route |

Four things follow, and the second is the reason this table is here.

* **Free is nearly true now, and it took one afternoon.** It was 3 fully-live bullets of 6
  when this file was written; the pricing re-rank made it 4 of 7 by moving a live capability
  onto the card, and the flips made it 6 of 7. The single remaining bullet — "Never lose
  track of who is who again" — names the tree, the direct lineage and the directory, and it
  is `/direct-lineage` alone that is still gated.
* **Both live bullets on the Plus card are shipping free to everyone.** This is the shape
  that changed: it used to read *nothing on this card is live*, which was at least
  internally consistent. Now "Stop guessing the head count" (RSVPs, t-shirt and meal
  totals, day-of check-in) works — it came back with `/events` and `/admin/events` — and
  "A face against every name" has always worked. Neither is restricted to a paid tier by
  anything, because nothing in the codebase enforces a tier at all. **Shipping a gated
  feature that a paid card claims converts a promise into a giveaway**, and that is now
  true twice; see §4.
* **Plus's opening bullet is still the most exposed claim in the file.** Payment processing
  has no route, therefore no gate, therefore no Coming Soon screen — on the first line of
  the `featured: true` card the layout is built to make you look at. Nothing about
  2026-08-12 touched it.
* **Premium is honest by construction** — every bullet is unbuilt and the whole card carries
  a Coming soon badge and a disabled button, so the tier cannot mislead about availability.
  What it can mislead about is *scope*, which is what the decisions list is for.

### How the gate works

`proxy.ts` *rewrites* — not redirects — any gated path to `/coming-soon`, which names the
feature from its `blurb` and lists the live ones as "Available now". Nested paths inherit
their parent entry's status. **An unregistered path is not gated**, which is why the nine
claims with no route at all are the most exposed items in this file: nothing catches them.

### Severity, and what it means here

Rated by the **promise**, not by the code:

| | Meaning |
|---|---|
| **blocking** | Sold in the **Free** tier, or in a page title or hero. Somebody signs up for nothing and finds it missing. |
| **high** | A paid-tier headline. |
| **medium** | Body copy. |
| **low** | An incidental mention. |

---

## Delivery order

Sequenced by the tier the feature is sold in, **Free first**. Two reasons: a gap in the free
tier is the promise made to everyone, so it costs the most trust; and the paid tiers sit on
top of that base, so they cannot be sold until it works.

### Free — 1 blocking gap left

Three of the four items here shipped on 2026-08-12. What is left is one bullet, and it is
the one blocked on a product decision rather than on work.

| # | Ship | State |
|---|---|---|
| 1 | `/direct-lineage` | **Still gated.** One word, and the only thing left on the Free card. Blocked on the same decision it always was — where child management and convert-to-adult sit, and note the answer *cannot be enforced by a grant*, because the route has no permission row by design. |
| ~~2~~ | ~~`/family-tree`~~ | **Shipped, split in two.** See below — this one did not flip, it was rearranged. |
| ~~3~~ | ~~`/announcements` + `/admin/announcements`~~ | **Shipped together,** as this table said they had to. The admin flip carried the `Sidebar.tsx` `adminItems` entry with it; without that the page would have come back working, permissioned and linked from nowhere. |
| ~~4~~ | ~~`/events` + `/admin/events` + `/admin/event-types`~~ | **Shipped, and `/event-planning` with them** — all four event routes at once, because `/events` cannot show a reunion `/admin/events` is not there to create. Heaviest item in the repo, done as one flip. |

**The storage rework moved to Plus,** from position 0 here. It was at the top of the Free
list because `/photos`, `/documents` and `/events` all queued behind it; Events has now
shipped *ahead* of it by explicit decision, so the two features still waiting are both
Plus and the item belongs with them. **What that decision costs is stated once, in the Plus
table, and it is a real cost rather than a formality** — read it there before concluding
the sequencing was free.

**Free's gap list went from 6 to 1 without the card changing.** Worth stating plainly
because the two edits of 2026-08-12 pull in opposite directions and it would be easy to
read only one of them: the pricing re-rank moved a live capability *onto* the Free card
(separation of duties, which needs nothing at all), and the flips took three gated
capabilities *off* the gap list. The card now describes something a family can largely
have.

### The family tree, split in two

The one item here that is not a status flip, and the reason the row above is struck
through rather than ticked. `/family-tree` used to be a single gated route in the
**Personal** section — a per-person lineage viewer, opened for whoever `?view=` named. It
briefly became two routes, and on 2026-08-13 it became one again:

| Route | What it is | Where it lives | State |
|---|---|---|---|
| `/family-tree` | The family-wide tree. An ancestry-style focus canvas: click anybody to re-centre on them, fill the gaps with "+" cards, and a list of the people connected to nobody. | Community > Family Tree, directly after Directory | Live, real, and no longer badged. |
| ~~`/members/family-tree`~~ | ~~The original lineage view.~~ **Deleted**, with `FamilyTreeClient`, `app/actions/ancestors.ts` and `app/actions/spouse.ts`. | — | Gone. |

Four things follow that this file has to carry, because no mechanism does:

* **The lineage view retired, which is decision 5 answered.** It cost nothing in data:
  both surfaces were readers of `person_relationships`, so every row the lineage view wrote
  is on the canvas already. What it uniquely offered was a *directional* walk from one
  person, and re-focusing on whoever you click is the same drill-down without a second
  page, a second vocabulary or a second set of writes that could disagree. The actions were
  DELETED rather than merely unlinked, because every export of a `'use server'` file is a
  public HTTP endpoint — a page nobody links to is not the same as an action nobody can
  call.
* **`BetaBadge` is hand-set, cannot be derived, and is now unused.** `status` has two values
  and "live but unfinished" is a property of one of them. It was written twice — on the page
  heading and on the rail item — and both came off by hand with this pass. The component
  stays in `components/ui/beta-badge.tsx` for the next surface that needs it; nothing
  renders it today. It is the mirror of `ComingSoonBadge`: that one marks a route nobody can
  reach, this one marks a route anybody can.
* **The resource key is `family-tree`, and is now simply the route.** It was not, while the
  lineage view sat at a different path on the same key — the one place either page departed
  from §1's "the key is the route without its leading slash". That departure is gone. The
  key is still *unregistered*, which is the open item: TODO.md carries it, and the choice
  narrowed to two options when the second page went.
* **The Directory keeps its button, now pointing at the tree.** It existed because the
  lineage view had no rail item and would otherwise have been unreachable. Family Tree does
  have one, directly under Directory — but the button is kept anyway, because somebody
  looking at a name in the roster and wondering how they are related should be one click
  from the answer rather than having to notice the rail.

### Plus — the storage rework, 7 high gaps, then one build

| # | Ship | Why here |
|---|---|---|
| 0 | **Storage rework** | **Moved here from Free position 0** on 2026-08-12, when Events shipped ahead of it. Not a feature; it is what stands between `/photos` and `/documents` and their flips. It is also the only item here that touches pages which are **already live** — and it now touches two of them, not one: `avatars` behind `/personal-info` (which the pricing edit also made a Plus claim), and `event-photos` behind the events feature that just shipped. Still the long pole, and no longer preventative. **Read the warning below before scheduling anything under it.** |
| 1 | `/family-finances` | One-word flip. Resolves the sharpest inconsistency in the registry: its admin counterpart `/admin/account` is **already live**, so funds are configurable but their balances and the P&L are unreachable. Needs a restricted `resource_visibility` backfill in the same migration. |
| 2 | `/admin/boardpositions` | Cheapest item in the repo by its own comment, and a structural dependency of the elections claim. |
| 3 | `/elections` + `/admin/elections` | Immediately after board positions — the roster feeds the ballot. `BallotForm` needs `disambiguatedName` + search **first** (AGENTS.md names it). Its "launch announcement goes out automatically" sub-claim needs `/announcements`, already shipped in Free. |
| 4 | `/documents` | Gated on the storage rework, and it is the worst bucket. Also `documents.ts` returns `getPublicUrl` for a **private** bucket, so downloads cannot work at all. |
| 5 | `/photos` | Same storage rework, plus three defects of its own — see the register. |
| 6 | `/admin/chapters` | Flip plus deleting the dead duplicate client. Also unblocks the dashboard's `ChapterReminderBanner`. |
| 7 | `/admin/reports` | Flip **last**: RSVP turnout and t-shirt counts are event data, so two of its four advertised columns stay empty until `/events` has shipped and collected some. **Its dues column shipped separately on 2026-08-17** as `/dues-projections` — a route of its own rather than a flip of this one, because flipping Reports to deliver one of four bullets would put a live screen behind a card advertising three things it does not do. |
| 8 | **Payment processing** | The only Plus item that is a build, not a flip. Needs a provider and a fee decision before a route exists. **It is also the one claim with no gate at all** — so it must not be the thing left outstanding when `PRICING_IS_ANNOUNCED` flips. |

> ### ⚠ Events shipped ahead of the storage rework, and `event-photos` is live now
>
> This is the one place in this file where deferring something has a cost that is already
> being paid rather than merely scheduled, so it is stated where the item now sits.
>
> `event-photos` is a **`public: true`** bucket whose policies carry **no family predicate**
> — the bare `bucket_id = X AND auth.uid() IS NOT NULL` — and twelve of the policies in
> `20260609000000_avatar_url.sql` omit a `TO` clause, so they attach to `PUBLIC`, which
> includes `anon`. `deleteEventPhoto` also takes its object path from the client.
>
> While `/events` and `/admin/events` were gated, all of that was a checklist for a rework.
> Now that they are live, it is the storage layer of a feature families are using: one
> family's event photographs are readable by URL by anyone who has the URL, and by any
> signed-in member of **any** family through the API. The claim *"One family cannot see
> another. Ever."* is published on four surfaces and is now false of a **shipped** feature
> rather than of a dormant one.
>
> Nothing here says the sequencing was wrong — shipping Events was a deliberate call and
> the reunion is the product's whole premise. It says the rework stopped being preventative
> work on 2026-08-12 and became remedial, which is a different priority. `avatars` was
> already in this position (live, world-readable, and now sold as Plus); `event-photos` is
> the second bucket to join it, and `photos` and `documents` are still gated behind their
> own flips.

**This order is close to the inverse of the card's,** and that is expected rather than wrong:
the card ranks by which absence hurts a family most, this table ranks by what unblocks what.
Three consequences to hold on to, and the first two are what a buyer meets first.

- **Payments is bullet 1 on the card and item 8 here.** Nothing about the sequencing is
  negotiable — it needs a provider and a fee decision — so the gap is open for the entire
  life of the Plus rollout, on the opening line of the featured card, with no gate behind it.
- **Profile pictures is bullet 8 on the card and appears in this table not at all,** because
  it is not work of the same kind: it ships today, free, and the decision is whether to take
  it away. It is in the decisions list instead, and it must be settled before
  `PRICING_IS_ANNOUNCED` — a Plus bullet a Free family already has is the one error on this
  page that a reader can catch by themselves.
- `/admin/reports` moved **up** the card (bullet 4, from 8) and stays **last** here. Two of
  its four advertised columns are event data, so promoting it in the copy did not shorten
  its queue by a day.

### Premium — the reach half can start, the website half cannot

This heading read *"nothing can start yet"* while Premium was the website alone, and the four
reach features are what changed it.

**The four reach features are separable from the website and from each other**, which makes
them the only Premium work that could start today: apps for iPhone and Android, push
notifications on web and mobile, email distributions drawn from membership, and automatic
dues reminders. Each is a build with no route, so none of them can ever show `/coming-soon`.
Automatic dues reminders is the cheapest and the least speculative — dues schedules and
installments are live under `/admin/account`, so only the sending half is missing, and it
needs a scheduler rather than a screen. The apps are the largest single item in this
document by an order of magnitude and are not a status flip in any sense.

**The card's ranking and this order agree here, unlike Plus.** The re-rank put dues reminders
first and notifications second — the two cheapest reach items — and dropped the website, the
tier's signature, to fifth. So the two lines a reader meets first are the two that could
start today. The tagline moved with them: *"In every relative's pocket, and out in the
world"* names the reach half before the website half, where it used to name only the website.
Worth knowing when re-counting claims, because that first clause is now an **apps** claim
rather than a website one.

**The public website half is what cannot start:**

1. ~~**Ship `/events`, `/photos` and `/announcements` first.**~~ **Two of the three are
   done** — Events and Announcements shipped 2026-08-12. They *are* the content the public
   site renders, so this prerequisite is now one item: `/photos`, which is behind the
   storage rework. Premium's website half is closer to startable than it has ever been, and
   the remaining blockers below are all decisions rather than work.
2. **Decide the publish / opt-in model.** Nothing in the permission system can express
   "visible to the world", and a public surface over family data inverts the *"One family
   cannot see another. Ever."* claim published in four places. This is a design decision, not
   a build task.
3. Wildcard subdomain and certificate provisioning for `yourfamily.genorra.com`. Revisit
   `app/(auth)/register/page.tsx` in the same change — it currently says *"There is no public
   profile and nothing is shared outside the family you join."*
4. Build the public renderer **last**; it is the only part that cannot start before those
   three decisions.

### Decisions needed before anything is scheduled

These are product calls, not engineering work. Each one currently has a built feature or a
published claim on the wrong side of it.

1. **Tier for hotel room blocks, multi-day itineraries with nested sub-events, and per-event
   budgets** — all advertised on the landing page, all built behind `/admin/events`, all
   priced nowhere. Per-event budgets crosses into `/family-finances`, so this affects two.
2. **Tier for `/admin/event-types`** (Event Templates) — built, permissioned, sold on the
   landing page, absent from `/features` entirely.
3. **Does `/event-planning` earn a tier, or is it internal-only?** Fully registered with a
   resource key and a sidebar entry, and the marketing site does not sell it at all.
   **Now urgent rather than theoretical:** it shipped live with the other three event
   routes on 2026-08-12, so it is a capability every family has and no tier names. Decide
   it before `PRICING_IS_ANNOUNCED`, or it decides itself as Free by default.
4. **Where do child management and convert-to-adult sit?** Note the answer *cannot be
   enforced by a grant* — `/direct-lineage` has no permission row by design. **This is now
   the last gated item on the Free card,** so the decision is the only thing standing
   between that card and being wholly true.
5. ~~**What is the new family-wide tree, precisely?**~~ **Answered, 2026-08-13.** The tree
   is an ancestry-style focus canvas that re-centres on whoever you click, with three ways
   to add a relative and a list of the people connected to nobody; and the lineage view
   **retires** — `/members/family-tree`, `FamilyTreeClient`, `app/actions/ancestors.ts` and
   `app/actions/spouse.ts` are deleted. Re-focusing IS the per-person drill-down, so keeping
   a second page would have meant two vocabularies over one table. The beta badge came off
   with it. What is still open is the permission key, which TODO.md carries.
6. **Does the `/admin` hub survive?** Nothing links to it, `Sidebar` has no `/admin` item, it
   gates on the wrong key, it has no permission row, and two of its three tiles point at
   gated routes.
7. **Trusted Vendors** — directory, marketplace, or discount list? No code exists.
8. **Profile pictures are sold as Plus and ship free to everyone today.** `AvatarUpload` is on
   `/personal-info`, which is live and free, so the work is *withdrawing* a capability rather
   than shipping one. Three calls come with it — whether families already using it are
   grandfathered, what happens to the pictures already uploaded when a family is not on Plus,
   and where the check even goes. `lib/features.ts` cannot express it: the registry gates by
   route, and this is one control on a page that stays free. It is also entangled with the
   storage rework, since the `avatars` bucket is world-readable by URL today.
9. **RSVPs, head counts and day-of check-in are sold as Plus and, since 2026-08-12, ship free
   to everyone too.** This used to be the item above's distinction — it is now a pair, and the
   pair is a pattern rather than a coincidence. Both are Plus claims served by live routes
   that nothing restricts to a tier. **The general decision underneath them is the one worth
   making first: where does tier enforcement live at all?** There is no mechanism today — not
   in `lib/features.ts`, which knows only routes, and not in the permission model, which knows
   only what a family granted its own members. Every answer to the two items above is a
   special case until that exists.

---

## Gap register

Grouped by feature, because the question this answers is "what does shipping X close?"

### Blocking — sold in Free

| Feature | Route | Claims | Shipping it requires |
|---|---|---|---|
| My Children — add, manage, convert to adult members | `/direct-lineage` | 4 | Flip + the no-permission-row decision; also a silent-success no-op write |

**One row left, from six.** The five that closed on 2026-08-12 are below, with what actually
came with each flip — kept here rather than merged into **Already true**, because two of them
shipped with a documented obligation still open and a tick would hide that.

| Shipped | Route | Claims closed | What it left behind |
|---|---|---|---|
| Family tree | `/family-tree` | 15, mostly | **Closed on 2026-08-13.** It was a split — a beta scaffold beside a per-member lineage view — and it is now one real tree, with the lineage view retired. Several of those 15 claims describe a whole-family tree and are met by this one; what is still outstanding is the second pass in TODO.md (step relationships, multiple marriages, dates on the connectors), not the feature. |
| Announcements | `/announcements` | 8 | Nothing. No migration was needed — the key has been registered since `20260618000000` and `resource_visibility` already answered `everyone` for it. The dashboard's pinned-news panel switched itself on, because it reads `isFeatureLive('/announcements')`. |
| Announcement management | `/admin/announcements` | 3 | The `Sidebar.tsx` `adminItems` entry this file demanded, added with the flip. Restricted per family already, like every `category = 'admin'` resource. |
| Events | `/events` | 19 | **The storage rework, now overdue rather than pending** — see the warning in the Plus table. Sub-keys and RLS cases are still owed. |
| Event management + templates + planning | `/admin/events`, `/admin/event-types`, `/event-planning` | 7 + 1 + 3 | **33 uncased actions behind one key,** and no sub-keys per rail item — so `admin/events` still cannot express "record an RSVP but do not delete the event". `/event-planning` also shipped into no tier at all. |

### High — paid-tier headlines

| Feature | Route | Tier | Claims | Notes |
|---|---|---|---|---|
| Family finances — fund balances, P&L | `/family-finances` | Plus | 12 | Admin counterpart already live. **The dues half ships today** (`/transactions`, `/account-summary`, dues schedules under `/admin/account`) — only balances and the P&L are gated, so do not attribute the whole "dues and fund accounting" claim here. |
| Photos — galleries, captions, tagging | `/photos` | Plus | 11 | Storage rework + a **live `PGRST201`** that makes every gallery render empty + `deletePhoto` trusting a client-supplied path + the hand-rolled tag search that `/features` explicitly sells + **no resizing anywhere in the upload or render path**, so a grid of thumbnails downloads the originals (see the consideration under §1) |
| Documents — bylaws, forms, minutes | `/documents` | Plus | 7 | Worst bucket; `getPublicUrl` against a private bucket |
| Elections — nominate, accept/decline, vote | `/elections` | Plus | 6 | `BallotForm` member-picker defect must land with it |
| Election management | `/admin/elections` | Plus | 3 | After board positions |
| Regions & chapters | `/admin/chapters` | Plus | 5 | Delete the dead duplicate client |
| Leadership reports | `/admin/reports` | Plus | 4 | **Halved on 2026-08-17.** The dues half of this bullet — "Dues collected against outstanding" — now ships as [`/dues-projections`](app/(protected)/dues-projections/page.tsx), live and priced Plus, with its own resource restricted by default. What is left of the claim is membership, RSVP turnout and t-shirt counts. Two of those need `/events` data, and **`/events` has shipped**, so this is blocked only on families having run an event and collected some. |
| **Payment processing** — card, debit, PayPal, Apple Pay, Google Pay, Cash App | **none** | Plus | 6 | **No route, so `proxy.ts` cannot gate it and Coming Soon never appears.** The most exposed claim in this file. |
| Profile pictures | `/personal-info` — **live** | Plus | 2 | The mirror image of everything else here: sold as Plus and shipping to **everyone, free, today**. Avatar upload sits on a live page, so this is a capability to withdraw rather than one to ship — see the decisions list. Its detail line also promises the picture "on the directory, the tree and everywhere a member is listed": the directory shows it, and the family-wide tree draws an avatar on every card — so the bullet reads correctly and is simply sold one tier too high. |
| RSVPs, head counts, day-of check-in | `/events` + `/admin/events` — **live** | Plus | (inside 2 claims) | **Joined the row above on 2026-08-12.** Same shape, opposite cause: profile pictures were never gated, these were gated until the Events flip and are now free to everybody. Plus bullet 2 and the Free/Plus FAQ answer both name them. |
| **The public family website that builds itself** | **none** | Premium | 6 | No route, no entry, no code |
| **Per-family public address** | **none** | Premium | 3 | No route, no config, no code |
| **Apps for iPhone and Android** | **none** | Premium | 2 | No route and none possible — this claim leaves the web app entirely. Largest item in this file. Two claims since the re-rank: the bullet, and the tagline's *"In every relative's pocket"*. |
| **Push notifications, web and mobile** | **none** | Premium | 1 | No route, no code. `lib/notifications.ts` and `NotificationBell` are the in-product bell; nothing leaves the browser today. **Read the bullet before building it** — it promises notifications "in the browser … for events, announcements and messages", and the bell that exists is free, in-browser, and fires on **membership traffic only**: the five doors into the approvals queue (`register.ts`, `my-families.ts`, `invitations.ts`, `membership.ts`) plus the decision itself (`admin/approvals.ts`). So a member already has the mechanism the copy names, for none of the three subjects it names. **The bell is also now cross-family** — `getPendingApprovalQueues` answers for every family the caller can work, which is the one thing in the product that deliberately reaches past the active family, and any push design has to decide the same question rather than inheriting the old per-family answer. |
| **Email distributions** | **none** | Premium | 1 | No route. `lib/email/` sends transactional mail one recipient at a time; a list drawn from membership does not exist. Read that module's open-relay rule before building it. |
| **Automatic dues reminders** | **none** | Premium | 1 | No route, no scheduler. Dues schedules and installments are live, so this is the send half only. |

### Medium / low

| Feature | Route | Claims | State |
|---|---|---|---|
| Board positions | `/admin/boardpositions` | 4 | Gated. Cheapest flip in the repo by its own comment. |
| Trusted vendors | none | 2 | No code. |
| Family stories and traditions as a first-class thing | none | 2 | No code. |
| ~~Event templates~~ | `/admin/event-types` | 1 | **Live.** Shipped with the event flip — and still absent from `/features` entirely and priced in no tier. |
| ~~Event planning~~ — assigned tasks with deadlines | `/event-planning` | 3 | **Live.** Also in no tier; the decision above got more urgent rather than less. |
| ~~Untiered event sub-capabilities~~ (hotel blocks, nested itineraries, per-event budgets) | `/admin/events` | 4 | **Live, and still untiered.** These were "built but unreachable"; they are now built, reachable and free. Per-event budgets crosses into `/family-finances`, which is still gated, so that one is half-shipped. |

---

## Proposed — no claim, and no code

Everything above is one of two shapes: a claim with no code, or code with no claim. **There is
a third**, and the register cannot hold it — a feature nobody has promised and nobody has
built has no row in `PLANS[]` and no entry in `lib/features.ts` to be counted against.

So it goes here, and this section changes none of the counts above. It exists for two
reasons: to have the design argued once rather than invented twice, and to make the decisions
underneath a proposal explicit *before* somebody writes the screen and discovers them.
**Nothing here is scheduled.**

### Emergency check-in — asking the relatives in one area whether they are safe

A hurricane crosses the Gulf coast. One member with the right grant raises a check-in
addressed to the relatives who live there; everybody addressed is asked one question — *are
you safe?* — and answers with one tap. Whoever raised it watches a roster fill in: safe,
needs help, not answered.

**The unanswered column is the product.** The other two are only how it gets shorter, and
that is the fact governing every decision below — this would be the first capability in
GENORRA whose value is entirely in the response *rate* rather than in the record.

#### What already exists, which is more than it looks

| Piece | Where | State |
|---|---|---|
| An area to address | `regions` and `chapters` (`20260604000005`, `20260604000002`), `people.chapter_id` | Real per-family tables. But `/admin/chapters` is `status: 'future'`, `tier: 'plus'` — the only grouping a family can define is behind a flip **and** a paid plan. |
| An audience on a message | `announcements.scope` — `national \| regional \| chapter` | Half-built, and worth knowing before reusing it: [`addressedTo()`](app/actions/announcements.ts#L139) filters `chapter` only. **A `regional` announcement reaches the whole family** — a person's region is derivable through `chapters.region_id` and nothing derives it. |
| Where somebody lives | `people.city`, `state`, `zip_code`, `country` ([lib/profile-columns.ts:29](lib/profile-columns.ts#L29)) | Real, and shown as the Directory's City/State column. Self-reported, optional, and nothing keeps it current — a relative who moved last year is in the wrong area and nothing says so. |
| A way to reach a member | [lib/notifications.ts](lib/notifications.ts) → the bell | In-browser only, approved members with an account only, and only where a tab is open. |
| A way to reach them off the site | [lib/email/](lib/email/) | One recipient at a time, and `sendEmail()` **never throws**. |
| Push, SMS | none | Push is a **Premium bullet with no code**. SMS is in no claim, no tier and no dependency anywhere. |
| Picking people by hand | `PersonMultiSelect` | Ships today, built for 150. |

#### Six things that are decisions rather than work

1. **Reaching people is the whole feature, and the product cannot do it yet.** The bell needs
   an open tab, and `IdleTimeout` signs a member out after 60 idle minutes — so the one
   channel that exists is the one a disaster guarantees is closed. Email is the fallback and
   it **fails soft by design**, which is correct for an approval and wrong here: a caller
   must never render *"everyone has been asked"* over mail that did not go, and `inviteMember`
   is the pattern for saying so honestly. **This feature is therefore downstream of a Premium
   bullet with no code** (push notifications) or of SMS, which is in no plan at all. Decide the
   channel before anybody designs the screen; a check-in nobody receives is worse than none,
   because it is believed.

2. **An area is not a chapter, and neither answer works alone.** A chapter is how a family
   *organised* itself; a disaster addresses where people *are*. Self-reported city and state
   are closer to the truth and are stale by an unknown amount. The workable shape is that all
   three — chapter, geography, hand-picked names — resolve to **one explicit roster at raise
   time**, and the roster is then the list rather than the rule that built it. Anything else
   silently drops the relative who moved, which is the person most likely to be in the wrong
   place. Same rule as the picker's overflow count: **never truncate quietly.**

3. **A record cannot answer, and must not read as unanswered.** §4b's line — `user_id IS
   NULL` — has a human cost on exactly this screen: a recorded grandmother is in the family,
   on the tree and in the Directory, has a generated placeholder address and no account, and
   can neither be asked nor reply. The roster owes a third state, *no way to reach them*,
   sitting apart from "not answered". Leaving her in the unanswered column turns the one
   number this feature exists to drive to zero into a number that cannot reach zero.

4. **Two different gates, and the second is the abuse case.** Raising a check-in is
   family-wide with no coherent "own" version, so it is `canAny(...)` — the same reasoning §2
   gives funds and disbursements, because the row a member would "own" is precisely the
   problem: a false alarm addressed to the whole family at 3 a.m. is what the grant exists to
   prevent. **Answering is self-service** — `requireMember()`, the caller's own row, the
   `submitRsvp` shape, with every id from the client checked by `belongsToFamily` first (§4).
   Note what that rules out: an *"I spoke to her, she's fine"* button. It is the most
   requested feature in every system of this kind and it is a write to somebody else's row.

5. **A completed check-in is the sharpest PII this product would hold** — a list of relatives,
   where they live, and which of them is unreachable, assembled at the moment it is most
   useful to somebody else. Gate the fetch, not the tab (§5); give it its own resource key
   with a **restricted** `resource_visibility` backfill (§6) rather than the `everyone`-for-view
   default; and settle retention deliberately, because an answered check-in from three years
   ago is a location history nobody agreed to keep.

6. **The colour does not exist yet, and it is not `--destructive`.** That token owns errors and
   deletions, `FormError` owns reporting a failure, and `--brand-withheld` is Warmth for a
   capability going away. An emergency banner is none of the three and must not read as a
   form error. It needs a role added to `app/globals.css` first, with an `on-` partner checked
   against AA in both themes — not a hex in a component.

#### Which tier

`tier` is required and has no default, so this cannot be deferred to the pull request. Three
readings, and the file should not pretend one is obvious:

* **Free** — the Free card's premise is *"get your whole family in one place. All of them"*,
  and safety is a poor thing to sell back to a family.
* **Plus** — it sits beside RSVPs and head counts as coordination, which is what that card is.
* **Premium** — it cannot work without push or SMS, and *reach* is exactly what Premium sells.

**The dependency argues Premium and the ethics argue Free**, which is the kind of tension the
`tier` field was made required to force somebody to resolve out loud.

#### One defect it must not inherit

[`createAnnouncement`](app/actions/announcements.ts#L282) writes a **client-supplied
`chapter_id`** onto a service-role insert with no `belongsToFamily` check — §4's shape
exactly. The blast radius today is small: BRAVO's row carries ALPHA's chapter id, so nobody's
`myChapterId` matches and the announcement addresses nobody. On a check-in, "addressed
nobody" is the failure that matters. Fix it where it is, with its own RLS case, before
anything else is built on that audience mechanism.

#### What it would owe at build time

- An entry in `lib/features.ts` — `href`, `label`, `status`, and a stated `tier`.
- Its `permission_resources` rows in a new migration **and** in the `20260618000000` seed,
  with the per-family `resource_visibility` backfill in the same migration (§6). Two actions
  at most, and only ones something reads: raising and answering are different jobs.
- A case per action in `tests/rls/cases.mjs` — the BRAVO administrator passing ALPHA's ids, a
  positive control, and a pending-member attacker (§7). Then break it on purpose and re-run.
- If the audience lands as a junction table, **grep for bare embeds of both tables it joins**
  afterwards. That is the `announcement_unpins` lesson (§8), and this table would join
  `people` — the most embedded table in the schema.
- The roster is a member table: a real `<table>`, `COLLAPSING_CELL` on the folding columns, no
  `min-w` floor. **A phone is the device this feature is used on**, which makes that rule
  non-negotiable here rather than a convention.
- Built for 150, like every other member list.

### Records, sources and images on the tree — the ancestry.com half GENORRA does not have

Today a person on the family tree is a name, a gender, two dates and a set of edges. What a
family doing genealogy actually accumulates is *evidence*: a scan of a birth certificate, an
obituary clipping, a photograph of a headstone, a paragraph somebody's aunt wrote down before
she died. Ancestry's whole model is that a **fact** about a person is backed by a **source**,
and this product has neither noun.

**The tree is where this belongs, and that is the decision worth stating first.** Photos and
Documents are already features in their own right (both `status: 'future'`, `tier: 'plus'`),
and the lazy reading of this request is "let a document be tagged with a person". That is not
the same thing: a document in a shared folder is filed by the family, and a source on a person
is filed by the CLAIM it supports. The difference shows up the moment two members disagree
about a birth date and only one of them has the certificate.

#### What already exists, which is less than it looks

| Piece | Where | State |
|---|---|---|
| A person | `people`, [lib/profile-columns.ts](lib/profile-columns.ts) | Real, and the allow-list is the write path for every profile edit. One `date_of_birth`, one `sunset_date` — **one value each**, last write wins. |
| A relationship | `person_relationships` + `link_kind` (`20260813000007`) | Real, and already carries a fact only a person can know (§4c). Carries no date, no place and no source. |
| Editing somebody else's record | `editPersonRecord` | Real. Any approved member may edit any row with no `user_id`; a member owns their own (§4b). |
| Photographs | `photos`, `photo_collections`, `photo_tags` | Tables exist; `/photos` is gated. `photo_tags` has **two** foreign keys to `people` — the §8 trap, already documented. |
| Documents | `documents`, [app/actions/documents.ts](app/actions/documents.ts) | Gated. Filed against the family, not against a person. |
| Somewhere to put a file | four storage buckets, 15 policies | **The long pole.** See "Storage rework" below; this feature is downstream of all of it. |

#### Six things that are decisions rather than work

1. **A fact is not a column, and this is the fork the whole design turns on.** `people` holds
   ONE birth date. A genealogy holds "born 4 July 1908 (per the county register)" beside
   "born 1907 (per the 1910 census)", unresolved, both cited, because that is the state of the
   evidence. Modelling facts as rows makes the tree honest and makes `people.date_of_birth`
   a *derived preferred value* rather than the truth — which is a change to
   `disambiguatedName`, `computeIsMinor`, `ageShareOfPeriod` and every screen that reads a
   birthday. Modelling them as columns keeps all that and cannot record a disagreement.
   **Decide this before anybody writes a table**, because the two shapes are not migrations
   apart.

2. **Uploading evidence about a LIVING member is not the same act as uploading it about a
   dead one**, and §4b's line does not cut here. `editPersonRecord` is bounded by "no
   `user_id`", which is a clean rule for correcting a spelling and a poor one for attaching a
   document: a marriage certificate is about two people, at least one of whom probably holds
   an account and did not upload it. The workable shape is that a record is attached by
   whoever holds it and is **visible to its subjects**, with a way for a subject to object
   that is not "ask an administrator to delete the family's history".

3. **This is the sharpest PII the product would hold, by a distance.** A birth certificate
   scan carries a full name, a date, a place and usually a mother's maiden name — the standard
   set of banking security answers, assembled and stored for a hundred and forty relatives.
   It needs its own resource key with a **restricted** `resource_visibility` backfill (§6),
   not the `everyone`-for-view default, and it needs a retention answer: a family that leaves
   GENORRA leaves this behind.

4. **`family-tree` is unregistered, and this is what finally forces that decision.**
   `20260806000006` deliberately left the key out of `permission_resources` on the grounds
   that a member's own things are not something a family administers, so it resolves to
   viewable for every approved member and **cannot be switched off** — TODO.md carries it as
   an open decision. That was defensible for a diagram of names. It is not defensible for a
   folder of certificates, and the first record attached to a person makes the gap concrete
   rather than theoretical.

5. **Two tables joining `people` is two chances at PGRST201, and one of them is not on this
   feature.** A `person_records` table with `person_id` and `uploaded_by` has two foreign keys
   to `people` — every embed of it needs qualifying. Worse, per §8's `announcement_unpins`
   lesson, adding it makes PostgREST report a NEW many-to-many path between `people` and
   whatever else it joins, which breaks **bare embeds on tables nobody touched**. Grep for
   both after adding it, not before.

6. **Storage is the gate and it is not this feature's to open.** Four buckets, 15 policies,
   and a shape the section below says is wrong in three ways. Scans are larger than avatars
   and are read rarely, which is a different access pattern from anything the current buckets
   serve. Nothing here should ship on top of the existing arrangement.

#### Which tier

**Premium**, and unusually this one is not a close call: it is storage-heavy, it is the
capability that distinguishes a family directory from a genealogy, and Premium is where reach
and depth are already sold. Free's premise — *"get your whole family in one place"* — is about
the living.

#### What it would owe at build time

- An entry in `lib/features.ts` with a stated `tier`, and a decision on `family-tree`'s own
  registration (see 4 above) in the same change.
- `permission_resources` rows in a new migration **and** in the `20260618000000` seed, with a
  restricted `resource_visibility` backfill (§6). Declare only actions something reads.
- A case per action in `tests/rls/cases.mjs`, including a pending-member attacker (§7), then
  broken on purpose and re-run.
- Every new `people` embed constraint-qualified, and a grep of the existing ones afterwards.
- A rule for what happens to a record when its subject is detached from the tree —
  `removeRelationship` deletes the EDGE and never the person, and this needs the same care.

### Importing a tree from ancestry.com

A family that has already spent years on ancestry.com has the tree; what they do not have is
their relatives inside GENORRA. The ask is to take an Ancestry export and land it as
`people` and `person_relationships` rows. **This is the largest single thing in this file**,
and most of its weight is not the parsing.

#### What already exists, which is more than it looks

| Piece | Where | State |
|---|---|---|
| A person with no email | `placeholderEmail`, `email_is_placeholder`, `no_email_reason` | **Exactly the shape an import needs**, and already built: a generated `@genorra.com` address, a flag saying it is generated, and a stated reason. Nothing ever mails it. |
| Attaching an account to an existing record | `create_family_invitation` → `redeem_family_invitation`'s ADOPT branch (`20260813000004`) | Real. An invitation carries `p_person_id`, so accepting joins the row already on the tree instead of creating a second one. This is the whole "members identify themselves" problem, already solved for one person at a time. |
| Writing an edge and its inverse | `linkRelationship` | Real, and it carries `link_kind` both ways. |
| The vocabulary | `relationship_types`, `TREE_RELATIONSHIPS` | Real, and NARROWER than GEDCOM's: no gender-neutral parent, child or sibling row (`lib/family-tree.ts` says why). |
| Checking an id belongs to this family | `belongsToFamily` | Real, and **one round trip per id** — see decision 4. |

#### Seven things that are decisions rather than work

1. **The format is GEDCOM, and Ancestry's GEDCOM is lossy in exactly the places the previous
   proposal cares about.** Names, dates, places and relationships come across; media and
   source citations largely do not. So an import populates the *tree* and not the *evidence* —
   which means these two proposals are independent, and it is worth saying so out loud before
   somebody sequences them as one project.

2. **An import must not email anybody, and that is a hard constraint rather than a default.**
   A GEDCOM of a real family is hundreds of individuals; `inviteMember` sends on the spot and
   `sendEmail` **fails soft**, so a loop over it would produce hundreds of messages, some of
   them silently undelivered, none of them reviewed. The import creates **records** — the
   `record` mode `addRelative` already has — and invitations are a second, per-person, human
   act afterwards. The five doors into the approvals queue are enumerated in AGENTS.md and
   an import must not become a sixth by accident.

3. **Ancestry redacts living people in its exports by default**, which is not an obstacle to
   route around but the reason the previous point is easy to get wrong. A family that exports
   with living people included is handing over a file of names, birth dates and places for
   relatives who have never heard of GENORRA. A family that exports without them gets a tree
   of `Living Smith` placeholders. **Both need answering in the upload screen**, in words,
   before a file is accepted.

4. **Matching an imported individual to an existing member is a review step, never an
   inference.** The family already has `people` rows — that is the point of importing into an
   existing family rather than a new one — and a name-and-birthdate match is a *suggestion*.
   Auto-merging is unrecoverable: it would attach one person's dues, RSVPs, photo tags and
   permission template to another's record. A dry run that reports "142 new, 6 possible
   matches, 3 conflicts" and lands nothing until confirmed is the shape.

5. **`belongsToFamily` per id does not survive 2,000 individuals, and the answer is not to
   skip it.** §4 exists because a row stamped with the caller's own `family_code` satisfies
   every policy while pointing anywhere; an import is precisely a bulk write of
   client-supplied references, which is that hazard at scale. The check has to be re-expressed
   as a set operation against one query rather than dropped — and the import wants a batch id
   on every row it creates, so a bad import is one `DELETE` rather than an afternoon.

6. **GEDCOM's `PEDI` tag maps onto `link_kind`, and where it is absent the default is a
   claim.** `birth | adopted | foster | sealing` is very nearly `blood | adopted | foster`,
   which is a gift. But §4c is explicit that only a person knows whether a child edge is
   blood, and `link_kind` defaults to `'blood'` — so an import that fills the default for
   every unlabelled `FAMC` is asserting parentage for a whole family at once, and the
   Bloodline view will then answer confidently and wrongly. Either import unlabelled edges as
   blood **and say so on the review screen**, or introduce an "unstated" kind. Do not let this
   be decided by the column default.

7. **A server action is the wrong container for this.** Parsing, matching and writing a large
   GEDCOM does not fit a request, and `'use server'` exports are HTTP endpoints with the
   platform's own time limit. This needs an upload (storage rework again), a job, and a page
   that can be left and come back to — none of which this product has yet, which is why the
   ask calls itself a huge undertaking and is right to.

#### Which tier

**Premium**, following the previous proposal: it is the same customer, it needs the same
storage work, and it is the strongest single reason a family already invested in ancestry.com
would move.

#### One defect it must not inherit

`addRelative` writes its shared-parent edges **best-effort** — deliberately, because a parent
link that cannot be written must not lose the relationship the member asked for. That is right
for one addition and catastrophic for ten thousand: an import that swallows failures produces a
tree that is silently half-connected, and nobody can tell which half. An import reports every
row it could not write, or it is not finished.

#### What it would owe at build time

- An entry in `lib/features.ts` with a stated `tier`, and its own `permission_resources` rows
  in a new migration **and** in the `20260618000000` seed (§6). Importing is family-wide
  configuration with no coherent "own" version — `canAny`, for the reason funds and
  disbursements use it.
- RLS cases for every action it exposes, the BRAVO administrator passing ALPHA's ids and a
  pending-member attacker (§7), then broken on purpose and re-run. The bulk write is the case
  that matters most and is the one a per-row fixture will not exercise.
- Pure parsing and matching in `lib/`, taking their inputs as arguments, tested with
  `npm test` (§7b). The GEDCOM date grammar alone (`ABT 1908`, `BET 1900 AND 1910`, `4 JUL
  1908`) is exactly the kind of edge-case arithmetic that runner exists for.
- A review screen built for 150 rows and honest about what it is not showing — never truncate
  quietly.

---

## Supporting work

### 1. Storage rework — the long pole, and no longer preventative

Four buckets, **15 policies**, and the shape is wrong in three ways.

**This section opened by calling itself "a checklist for the rework, not an incident
report", on the grounds that the features these buckets serve were all gated. That is no
longer true.** Events shipped on 2026-08-12 and took `event-photos` into production with it,
so two of the four buckets are now reachable through a live feature and the reading of this
section changes with them: the `avatars` and `event-photos` rows describe what is happening
now, and only `photos` and `documents` are still statements about what would happen on a
flip.

| Bucket | `public` | Reachable today? | Effect |
|---|---|---|---|
| `avatars` | `true` | **Yes** — `/personal-info`, live and free | World-readable by URL |
| `event-photos` | `true` | **Yes, since 2026-08-12** — `/events`, `/admin/events` | World-readable by URL |
| `photos` | `true` | No — `/photos` gated | World-readable by URL |
| `documents` | `false` | No — `/documents` gated | Any signed-in user of **any** family can read, overwrite, delete and enumerate |

Three defects to fix together:

1. **No family predicate anywhere.** Ten of the fifteen policies are the bare
   `bucket_id = X AND auth.uid() IS NOT NULL`. Family separation — the thing enforced on every
   table — is absent from storage entirely.
2. **Twelve policies in `20260609000000_avatar_url.sql` omit a `TO` clause,** so they attach to
   `PUBLIC`, which includes `anon`. That is the blast radius, and it is wider than the `public`
   flag alone suggests.
3. **`documents` has no mime allow-list,** unlike the three image buckets.

Two application defects must land in the **same** change, because fixing the policy without
them leaves the hole open from the other side: `deletePhoto` and `deleteEventPhoto` both take
the object path from the client. **`deleteEventPhoto` is the reachable one now** — its page
shipped — so of the two it is the one that has stopped being a latent defect.

**And `tests/rls` does not cover storage at all.** A storage test harness is part of this item,
not a follow-up — without it the rework's correctness is unverified, and this is the one area
of the schema with no attacker case anywhere.

> The claim *"One family cannot see another. Ever."* is published on four surfaces and is
> currently true of every table and false of storage. It used to be false only of storage
> nobody could reach; since 2026-08-12 it is false of the storage behind a **shipped**
> feature. That is the whole change in this item's character — the work did not get bigger,
> it got later.

#### A consideration to settle with it: photos are served at full resolution

Raised 2026-08-13, from the three `@next/next/no-img-element` warnings that are the only
lint findings left in the repo. They are a symptom rather than the item; the item is that
**nothing in the upload or the render path ever resizes a photograph.**

`uploadPhoto` stores the file exactly as the browser hands it over
([app/actions/photos.ts](app/actions/photos.ts)) — no downscale, no re-encode, `accept`
allowing JPEG, PNG and WebP at any dimension. `getPublicUrl` then hands that same object
back, and `PhotoCollectionGallery` renders it into a 200px square, four across. So a
gallery of twenty photographs off a modern phone is **60–100 MB over the wire to draw a
grid of thumbnails**, and the lightbox that genuinely wants the original is the one place
the full file is justified. `PhotoCollectionCard`'s cover image is the same shape.

It belongs with this item rather than beside it, because the fix and the rework touch the
same objects and the same buckets, and two of the three candidates change what is *stored*:

| | What it does | Cost | Depends on |
|---|---|---|---|
| **Resize on upload** | Downscale in the browser before `FormData` — cap the long edge, re-encode WebP — and store a ~400px thumbnail beside the original. Grid reads the thumb, lightbox reads the original. `<img>` then needs no optimizer and the lint rule is disabled at three lines with that as the stated reason. | none | nothing |
| **Supabase render endpoint** | `next/image` with a per-image custom `loader` rewriting `/storage/v1/object/public/` to `/storage/v1/render/image/public/` with `width`/`quality`/`resize`. Resizing happens on Supabase's own CDN. | none beyond the plan | **Supabase Pro** — Storage image transformations are not on Free |
| **Vercel image optimization** | The stock answer: `images.remotePatterns` for the Supabase host, plain `next/image`. Works on any Supabase plan. | billed transformations, per photo per size, and a family reunion is a lot of both | nothing |

Two things to decide rather than assume. **Whether the originals are wanted at all** — a
family archive probably does want the full-resolution file kept, which argues for storing
both rather than downscaling destructively. And **whether `avatars` is in scope**: it has
the same defect on a live, free page, at a size where it matters less per image and far
more per pageview, since a portrait is drawn on every card in the directory and the tree.

The three warnings are deliberately **left visible** in the meantime. Suppressing them
would be the one move that makes this invisible again, and it is the resize decision that
earns the disable comment, not the other way round.

### 2. Per-feature launch obligations

Each gated feature owes these at flip time. AGENTS.md requires them; they are listed here so
"flip the status" is never mistaken for the whole job.

**Two of these are now owed retroactively, and that is the important line in this section.**
The seven routes that shipped on 2026-08-12 needed no migration — every key was registered
and every admin one already `restricted`, so the `resource_visibility` item below was
satisfied in advance — but the RLS cases and the sub-keys were not, and a shipped feature
cannot owe them "at flip time" any more. They are outstanding work on live code.

- **~85 uncased server actions** across the gated set, of which **the ~40 behind Events and
  Announcements are now behind LIVE routes.** §7 requires a case per action, with a real
  attacker *and* a positive control, and it says so precisely because these actions reach the
  database through `createClient()` and have delegated family isolation to policies nobody
  has run an attacker against. Re-derive the figure; it moved.
- **`resource_visibility` backfill** for the non-admin gated keys (§6): `/family-finances`,
  `/documents`, `/photos`, `/elections`. Without it a resource falls back to `everyone` for
  view and nothing else. `/announcements`, `/events` and `/event-planning` are off this list
  because they shipped — and needed nothing, since `everyone` for view is what all three
  wanted and `20260618000000` had registered them from the start.
- **An `actions` audit** on the remaining gated `permission_resources` rows — §6 says never
  declare an action nothing reads.
- **Sub-keys per rail item** for pages that divide into jobs. `admin/events` has 33 actions
  behind one key, which cannot express "record an RSVP but do not delete the event" — **and
  that page is live now**, so the grant an administrator would need in order to delegate
  day-of check-in without also handing over deletion does not exist yet.
- **Replace the two hand-rolled member pickers** with `PersonMultiSelect` — `BallotForm` and
  `PhotoCollectionGallery`, both named in AGENTS.md's known-gaps list. Each lands with its
  feature; both features are still gated.

### 3. Registry inconsistencies to resolve

- `/family-finances` gated while `/admin/account` is live — funds configurable, balances
  unreachable.
- `/admin` gated while three of its children are live; it gates on the wrong key and has no
  permission row. **Now five of its children,** since the two event admin routes shipped.
- ~~`/admin/announcements` is built and permissioned but absent from the sidebar.~~
  **Resolved** — the flip added the `adminItems` entry, between Accounting and Election
  Management.
- `/direct-lineage` and `/family-tree` have no permission row by design, so shipping them
  ships them to everyone with no switch. **`/family-tree` has now done exactly that, and it
  matters** — the beta scaffold was why it did not, and the tree is real since 2026-08-13:
  it publishes the whole roster and every relationship in it under a key a family cannot
  switch off. TODO.md carries the decision, narrowed to two options now the lineage view
  that shared the key is gone.
- The Coming Soon screen offers every member three administrator links they cannot use.
- ~~The protected layout queries gated event-planning data on every request.~~ **Resolved by
  the flip, not by a fix** — `/event-planning` is live, so the query is no longer for a gated
  feature. `hasAssignments` is what decides whether the rail item renders, which is what that
  query was always for.
- `cancel_overdue_event_assignments` holds an `authenticated` EXECUTE grant nothing needs.
  **Reachable now** — the events feature it belongs to is live, so §2b's reasoning about a
  loose grant applies to a running feature rather than a dormant one.

### 4. Claims that are LIVE but sold as unreleased

Decide before `PRICING_IS_ANNOUNCED` flips — these are the mirror image of everything else
here, and they cost revenue rather than trust. **This section said "two" and then named
neither, from the day the file was written until 2026-08-12.** Both are named below now,
because a count with no list is not something the next reader can act on.

The mechanism is worth stating once, since it will recur every time a bullet moves: Plus and
Premium are `available: false`, so each card carries a Coming soon badge and a disabled
button. **Every bullet under one of them therefore reads as not yet available** — including a
bullet describing something a Free family is using today.

| Claim | Where it lives | State |
|---|---|---|
| **Per-feature permissions** — "Separation of duties" | Was Plus bullet 5; now **Free bullet 6** | **Resolved by the pricing edit.** `/admin/users` has shipped since permission templates landed, and the FAQ and the `/features` privacy bullet moved with it — the latter simply dropped its `(Plus)` tag, and `features/page.tsx` records why in its header comment. |
| **Profile pictures** — "A face against every name" | **Plus bullet 8**, added by the pricing edit | **Open.** `AvatarUpload` is on `/personal-info`, live and free. This one runs both ways at once: it costs revenue for as long as it stays free, and it costs trust the moment it is withdrawn from families already using it. Three sub-decisions in the decisions list; nothing in `lib/features.ts` can express any of them. |
| **RSVPs, head counts and check-in** — "Stop guessing the head count" | **Plus bullet 2** | **Open, and created by the Events flip on 2026-08-12.** RSVPs with t-shirt and meal totals and day-of check-in all live behind `/events` and `/admin/events`, which are now live for every family on every tier. It is the second-strongest argument on the featured card and it is currently a giveaway. |

**The pattern is worth naming, because it will recur with every flip.** Free and Plus are
served by the *same* routes in several places — Free sells "put the reunion on the calendar"
and Plus sells the RSVPs and the head count, and both are `/events` — so un-gating a route
ships whichever tier's claims sit on it, all of them, to everybody. `lib/features.ts` gates
by route and knows nothing about tiers; there is no tier enforcement anywhere in the
codebase. Until there is, **every flip is a Free flip**, whatever the pricing page says. That
is the thing to check before the next one, and the reason the per-card table above exists.

**One live capability is sold in no tier at all: fund transfers.** `LEDGERS` has five entries
since `20260812000002`, `/transactions` is live, and `transactions/fund-transfers` is its own
permission resource on purpose — emptying a fund is not the same judgement as paying a member
what they are owed. No marketing surface mentions it. That is the safe direction to be wrong
in, so it is a note rather than a gap; the pricing question is whether moving money between
funds belongs on the Free card beside the ledger, or on Plus beside the P&L.

---

## Already true

So this file is not only a list of failures — and as of 2026-08-12 it is mostly not one. The
site accurately claims, and a member can reach today: the member directory, family chat, dues
plans and the contribution ledger, the five transaction ledgers, `My Summary`, Members
(`/admin/users`) with permission templates, member approvals, Family Settings, and
Accounting — dues schedules, funds and payment routing.

**And, since 2026-08-12:** announcements with pinning, and the whole of events — the shared
event page, itineraries, hotel blocks, RSVPs with t-shirt and meal totals, day-of check-in,
event templates and the planning checklist. Plus the per-member lineage view, moved under
the Directory — and then, on 2026-08-13, retired outright in favour of the family-wide tree.
That is seven routes, and it is the largest single movement in this file's short history.

Two qualifications belong with that paragraph rather than in a footnote, because it is the
paragraph somebody will quote:

* **Events shipped ahead of its storage rework, deliberately.** `event-photos` is
  world-readable by URL and its policies carry no family predicate. The feature works; that
  part of it is not yet safe, and §1 now says so in the present tense.
* **The events half of what shipped is sold as Plus and is free to everybody,** because
  nothing enforces a tier. See §4 — this is not a bug in the flip, it is the absence of a
  mechanism the pricing page assumes exists.

**Permissions are now sold in the tier that has them.** The Free card's "Separation of
duties" and the `/features` privacy bullet both describe `/admin/users` as it ships today, and
the Free/Plus FAQ answer names it on the Free side. That is the single largest true claim the
Free card makes, in the sense that it needs nothing from anybody.

**Both product surfaces now badge honestly, as of 2026-08-12.** They did not when this file
was written: `FeatureShowcase` derived a Coming Soon pill from `isFeatureFuture()`, and
`/features` had no mechanism at all and asserted in its own header that it needed none — so
it was the surface that would silently misrepresent every flip above.

The landing page / `/features` split that closed the redundancy between them moved the
detail — eighteen bullets and the eight-card grid — onto `/features`, which would have made
that worse, so the badge moved with it. Both now read `lib/features.ts`:

| Surface | Badged from the registry |
|---|---|
| Landing (`FeatureShowcase`) | 3 of 3 pillar cards |
| `/features` pillars | 3 of 3 |
| `/features` "and the rest" grid | 7 of 8 — the eighth, Trusted Vendors, has no route, so its `soon` flag is hand-set and commented |

The three pillars are defined once, in `components/marketing/pillars.ts`, and both surfaces
render from it — so a flip cannot correct one page and leave the other stale.

Two limits worth keeping in view. `isComingSoon` is evaluated **per card, not per bullet**,
so a badged pillar can still list a bullet describing something live and vice versa. And a
capability with **no route at all** cannot be derived — the nine claims with no code are
still the most exposed items in this file, for exactly the reason `proxy.ts` cannot gate
them either.

**The per-card limit has now fired in the expensive direction, and it needs a decision.**
The family-record pillar in `components/marketing/pillars.ts` derives its badge from
`/family-tree`, which is live as of 2026-08-12 — so **its Coming Soon pill has come off on
both the landing page and `/features`**, automatically and correctly by the mechanism's own
rule. Five of its six bullets are genuinely reachable now. The sixth is *"Add your children,
and convert them to members when they grow up"*, which is `/direct-lineage` and still gated.

So one pillar on the landing page currently promises a gated capability with no badge over
it, which is the direction that costs a customer's trust rather than a sale. Three ways out,
and it is a copy decision rather than a mechanism one:

* Ship `/direct-lineage` — it is one word and the last gated item on the Free card anyway.
* Drop that bullet from the pillar until it ships, and put it back with the flip.
* Accept it, on the grounds that the pillar's own headline claim is live.

Nothing in the code will surface this again if it is left, which is why it is written down
here. **This is also the general case, not a one-off:** any flip can un-badge a card that
still lists a gated bullet, so check the pillar's bullets — not just its route — whenever a
`status` moves.

**`/pricing` is a third marketing surface and it derives nothing.** Its badge is per *tier*,
from `available`, and every bullet in `PLANS[]` is prose typed by hand. That was worth
worrying about while the Free card wore an **"Available now"** pill over three gated bullets;
after 2026-08-12 it wears it over **one** — and only partly, since what is gated inside "Never
lose track of who is who again" is `/direct-lineage` while the directory and the family-wide
tree are both live.

It is still not an oversight to fix with a mechanism: a pricing bullet describes a tier's
offer rather than a route, several of them span more than one route, and "Available now" is a
statement about the *plan* being open to sign up for, which is true. What the hand-written
list cannot do is notice a **tier** discrepancy, which is the one that now matters more — the
Plus card says nothing about two of its bullets already being free. Nothing derives that
either, so the per-card table above is where it lives, and it needs re-deriving whenever
`PLANS[]` or a `status` moves.

---

## Keeping this current

**Citations here are quoted strings, not line numbers.** The first pass of this audit had
seven citations systematically off by two lines and four more off by one, because the
marketing files are edited continuously. Grep the quote.

Two figures are worth re-deriving rather than trusting when you next read this: the
uncased-action count (~85) and the claim counts per feature. Both move every time copy or an
action lands, and the second is now stale by three whole feature sets. The registry counts
have moved twice — 27/10 became 28/11 when Family Settings shipped, then 28/18 on 2026-08-12 —
so re-derive those too rather than quoting them. `grep -c "status: 'live',"` is the whole job.

When a feature ships: flip its `status` in `lib/features.ts`, tick its supporting-work items,
and move its row from the gap register to **Already true**. The marketing badges need no
edit — the landing page and `/features` derive them from the registry — with **two** exceptions
to check each time, and 2026-08-12 hit both:

* A claim with **no route** has nothing to derive from, so if the thing that shipped is one of
  the nine in that category, it needs a route in the registry or a hand-set flag removing.
* A pillar's badge comes off **as a whole** when its route goes live, including over any bullet
  that is still gated. Read the bullets, not just the route. The family-record pillar is the
  worked example and is currently unresolved.

**A flip is not the whole job, and the two things it leaves behind are both invisible.** What
shipped on 2026-08-12 needed no migration, which is genuinely how this registry is meant to
work — but the RLS cases §7 demands and the sub-keys §6 demands do not stop being owed
because the route stopped being gated. Nothing fails, nothing warns, and the obligation
quietly changes from "before launch" to "on live code". If you flip a status and do not write
the cases, say so in §2 in the same commit; that section is the only thing that will remember.

**Ask what a flip un-gates that is sold elsewhere.** Free and Plus share routes — `/events`
carries the reunion page (Free) and the RSVPs and head count (Plus) — and nothing in the
codebase enforces a tier, so a flip ships every tier's claims on that route to everybody at
once. Check the pricing card for the route you are about to flip before you flip it.

**When a bullet MOVES BETWEEN TIERS, this file changes and no code does.** Severity is keyed
to the tier a claim is sold in, so `PLANS[]` is an input here on the same footing as the
registry. Three things to redo after any edit to it:

1. **The per-card table** under "Where things stand" — bullet counts, fully-live counts, and
   what each card still needs. It is the only place the pricing page's per-tier badge is
   reconciled against per-route status.
2. **The severity of every claim that moved.** A bullet arriving on Free is blocking if it is
   gated; a bullet leaving Plus stops being a paid-tier headline. Permissions moving to Free
   closed a §4 entry outright; profile pictures arriving on Plus opened one.
3. **§4 in both directions.** Ask not only "does this claim have code?" but "does this code
   have a claim, and is it in the right tier?" Fund transfers, profile pictures and the event
   RSVPs are the worked examples, and they do not all fail in the same direction — one is live
   and sold nowhere, two are live and sold as paid.

---

**Revision log,** because two edits landed on one day and this file reads differently after
each. 2026-08-12, in order: the pricing re-rank (three cards reordered, permissions to Free,
profile pictures to Plus, four reach features to Premium), then seven status flips
(announcements ×2, events ×4, family tree — the last of which was a split rather than a flip).
The first changed what is *claimed*; the second changed what is *true*. Where a section
distinguishes them it says which, and the storage warning in the Plus table is the one place
they interact.

**2026-08-14: the Proposed section, with one entry** — the emergency check-in. It changes
neither what is claimed nor what is true, which is why it needed a section of its own rather
than a row in the register: it is the first thing written down here that is in `PLANS[]` and
`lib/features.ts` alike absent. If a second proposal lands, it goes beside it under the same
heading and under the same rule — nothing in there is scheduled, and nothing in there moves a
count.

**2026-08-14, later: two more proposals** — records and images on the tree, and importing a
tree from ancestry.com. Same rule, same section, and still no counts moved. Two things about
them are worth knowing before either is picked up. They are **independent**: Ancestry's GEDCOM
carries the tree and largely not the evidence, so the import does not deliver the records and
the records do not need the import. And both are **downstream of the storage rework** below,
which was already the long pole and is now the long pole for three things rather than one.
