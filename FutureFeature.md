# Future features — what the site promises, and what is still gated

> ## 2026-08-19: `/direct-lineage` is gone from the product AND from the copy. It is not a future feature
>
> **Resolved in this pass — the sweep was done rather than logged.** The route was deleted on
> 2026-08-13 (a child is a person; AGENTS.md §4b), and for six days afterwards the marketing
> surfaces went on selling it by name in six places on two files. All six are now the Family
> Tree's words:
>
> | Where | Was | Is |
> |---|---|---|
> | `pricing/page.tsx` — Free bullet 2 | "The family tree, **direct lineage** back through the generations…" | "The **Family Tree**, traced back through the generations…" |
> | `pricing/page.tsx` — the Free/Plus FAQ | "the family tree **and lineage**" | "the **Family Tree**" |
> | `pillars.ts` — `short` | "The tree, **the lineage** and the directory" | "The **Family Tree** and the directory" |
> | `pillars.ts` — `blurb` | "**the lineage** that ties every branch together" | "every branch **traced back through the generations**" |
> | `pillars.ts` — bullet 3 | "**Direct lineage view**, for tracing one line all the way back" | "**Trace any branch back through the generations**, one click at a time" |
> | `pillars.ts` — bullet 4 | "Add your children, and **convert them to members**" | "**Record a relative who has no email yet, and invite them** when they do" |
>
> `git grep -i lineage` over `app/(marketing)`, `components/marketing`, `lib/plans.ts` and
> `app/page.tsx` now returns only the two comments explaining the sweep. **"Bloodline" is
> deliberately NOT the replacement word either**, though it is what the canvas calls the
> control: it is an in-canvas toggle, not a thing to sell a family, so the copy names the
> outcome and leaves the control unnamed.
>
> **THE ROUTE IS NOT A FUTURE FEATURE AND HAS NO ROW ANYWHERE BELOW.** It was withdrawn, not
> deferred: everything it did the Family Tree does better, through `editPersonRecord` and
> `invitePersonRecord`. Do not reintroduce it as a roadmap item, a gap, or a decision.
>
> **What is kept is the MECHANISM, because it will recur.** A deletion is the one registry
> movement the derived badges are structurally blind to: `FeatureShowcase` and `/features` read
> `isFeatureFuture()` per route, and a route that has been deleted is not `'future'`, it is
> absent — `getFeature()` finds nothing, so there is nothing to badge and the bullet reads as
> shipped. A flip corrects both surfaces automatically; a withdrawal corrects neither, and
> `PLANS[]` and the pillars are hand-typed prose in both cases. **So a retired route owes a copy
> sweep in the same commit**, which is now a rule in "Keeping this current" with the grep beside
> it. `/admin/announcements` was retired the same day and cost nothing only because no surface
> had ever named it — luck, not process.
>
> **The beta pill was also checked and there is nothing to remove.** `BetaBadge` came off the
> tree on 2026-08-13, both on the page and on the rail item, and nothing in the tree renders it
> today: `Sidebar` still supports a `beta` flag and no item sets one. The component stays for the
> next surface that needs it.

> ## 2026-08-19: the counts in this file were four feature-sets out of date
>
> Every figure below has been re-derived against the tree rather than trusted, which is what the
> two 2026-08-13 notes this replaces asked the next reader to do. The registry has moved twice
> as far since as it had in its whole history before:
>
> | | 2026-08-12 | 2026-08-13 | **2026-08-19** |
> |---|---|---|---|
> | `FEATURES[]` entries | 28 | 28 | **34** |
> | `status: 'live'` | 18 | 18 | **27** |
> | `status: 'future'` | 10 | 10 | **7** |
>
> Re-measured after the Events removal landed and unchanged by it, because the figures above
> were already derived from a tree with those four entries gone.
>
> **Entries were ADDED as well as flipped**, which is why "gated features already built" no
> longer describes most of the movement. What arrived: `/gatherings`, `/gatherings/my-tasks`,
> `/calendar`, `/admin/gatherings` and `/admin/gathering-templates`, plus `/dues-projections`,
> `/updates`, `/transactions/fund-transfers`, and the promotion of My Summary's three panes to
> `/dues`, `/donations` and `/payment-history`. What flipped: `/admin/chapters` and
> `/admin/boardpositions`, both relit and both `tier: 'plus'`. What went: the four Events
> entries.
>
> **THE EVENTS PRODUCT IS DELETED, ENTIRELY.** `/events`, `/event-planning`,
> `/admin/events` and `/admin/event-types` are gone — routes, six action modules, eight
> components, four `permission_resources` rows, twelve `permission_table_map` rows, and
> `20260819000006` drops all thirteen `event_*` TABLES with them, plus `funds.event_id`,
> `photo_collections.event_id`, `cancel_overdue_event_assignments()` and the `event_expenses`
> term in `fund_balance_cents()`. Gatherings replaced it. **No family was using the product, so
> there were no records to protect** — which is the only reason a drop was available rather
> than a freeze.
>
> This file was largely a record of what the Events pages promised and did not deliver, so a
> good deal of it went with them. Where a row's finding OUTLIVED its subject it is kept and
> re-pointed; where the finding was only ever about Events it is deleted rather than left as an
> epitaph.
>
> **And the tier mechanism now actually withholds something, for the first time.** This file's
> old refrain — *"every flip is a Free flip"* — was true while every live route was `tier:
> 'free'`. Three live routes are Plus today (`/dues-projections`, `/admin/chapters`,
> `/admin/boardpositions`), so a Free family reaching them gets `/upgrade`. The mechanism has
> stopped being theoretical and §4's two open rows are the ones it still cannot reach, for the
> reason stated there rather than for want of a gate.
>
> **`TIER_PRICE` exists too** (`lib/plans.ts`, 2026-08-17): Plus is $10 a month or $100 a year,
> Premium $25 or $250. `TIER_IS_SOLD` is still `false` for both, and the split is deliberate —
> a figure with no way to pay is honest, a button that charges nothing is not. Severity below is
> still keyed to the tier a claim is sold in, and now there is a number attached to two of them.


The marketing site describes the product GENORRA is becoming. `lib/features.ts` describes
what a member can reach today. This file is the distance between the two, so the gap is
tracked rather than discovered.

**It is not a defect list.** The revamp is deliberate and every gated feature is already
built. What follows is a delivery order and, for each feature, the specific work that has to
land with the flip.

Generated 2026-08-12 from a six-agent audit of `lib/features.ts`, the eight marketing
surfaces, `PLANS[]`, and the storage migrations. Revised twice on 2026-08-13, and re-derived
end to end on 2026-08-19 against a tree that had grown nine registry entries, a second
product, a staff console and a family-removal flow since the last pass.

---

## Where things stand

Every figure here was derived on 2026-08-19, and re-measured after the Events product was
removed in full — routes, actions, components, permission rows and all thirteen tables
(`20260819000006`). The commands are in "Keeping this current", so the next reader re-derives
rather than quotes.

| | Count |
|---|---|
| `FEATURES[]` entries | **34** |
| `status: 'live'` | **27** |
| `status: 'future'` | **7** |
| **Gated features already built** | **7 of 7** — every one has its page in `app/(protected)` |
| Live routes a Free family cannot reach | **3** — `/dues-projections`, `/admin/chapters`, `/admin/boardpositions` |
| Live capabilities sold in no tier at all | **5** — see §4 |
| Marketing claims with no code at all | **9** — unmoved, and still the most exposed items here |

**The seven still gated**, with the tier each will ship into:

| Route | Tier | Why it is still gated |
|---|---|---|
| `/family-finances` | Plus | One-word flip plus a `resource_visibility` backfill. Sharpest inconsistency in the registry: `/admin/account` is live, so funds are configurable and their balances are not. |
| ~~`/elections`~~ | Plus | **Live, 2026-08-20** as `/review/elections`; **reviewed 2026-08-21** and moved to `/community/elections` (`20260821000003`). Both obligations in this row were discharged in that commit: `BallotForm`'s member picker is `PersonPicker` now, and the empty board-position state is stated on the organizer's form. |
| ~~`/admin/elections`~~ | Plus | **Live and reviewed with the above.** It spent one day at `/review/election-management` and came back here — `20260821000000` moved the key, `20260821000001` made the date windows govern the ballot and gave an election a national/regional/chapter level. |
| `/photos` | Plus | Storage rework, plus a live `PGRST201`, plus `deletePhoto` trusting a client path, plus no resizing anywhere. |
| `/documents` | Plus | Storage rework, and `getPublicUrl` against a private bucket. |
| `/admin/reports` | Plus | Halved by `/dues-projections`, then halved again: of the four figures it promised, RSVP turnout has **no source at all** now that `event_rsvp_attendees` is dropped, and t-shirt counts moved to `people` (where the sizes always lived). Membership and dues collected are what is left, and both are buildable today. |
| `/admin` | Free | Not a feature, and **the page is deleted**: two of its three tiles pointed at Events routes, and it was unreachable behind its own `status: 'future'` the whole time. The registry entry stays as the fail-closed catch-all for an unregistered `admin/…` key. |

**"Nothing in the registry is unbuilt" still holds, and is worth restating because the ratio
changed.** All seven gated routes have their page, their client and their server actions in
the repo. What is different from 2026-08-12 is that gated routes are no longer where most of
the product is: 27 of 34 entries are live, so the interesting work has moved from *flipping
what is built* to *the obligations a flip leaves behind* — which is §2 of Supporting work,
and is now the longest section in this file.

### What each pricing card promises today

Read per card rather than per feature, because a card is what a buyer actually reads. Counted
against `PLANS[]` in `app/(marketing)/pricing/page.tsx`:

| Card | Bullets | Fully live | What the card still needs |
|---|---|---|---|
| **Free** | 7 | **6** | Bullet 2 names a screen that was withdrawn — a COPY edit, not a flip. See the note at the top. |
| **Plus** | 8 | **2** — and both are free to everyone. A third is half-delivered. | 6 route flips across 5 bullets, 1 build (payments), 2 tier decisions (RSVPs and head counts; profile pictures) |
| **Premium** | 6 | 0 | 6 builds, not one of which has a route |

Four things follow, and the second is why this table is here.

* **Free is true except for its words.** There is no gated route on the Free card and has not
  been since 2026-08-13. What is left is the sentence in bullet 2, and it is the reverse of
  every other row in this file: the code is ahead of the copy rather than behind it.
* **Plus gained half a bullet, and the half behaves unlike anything else on the card.**
  Bullet 6 — "The paperwork, and the structure to match" — sells "regions and chapters with
  their own leadership", and both `/admin/chapters` and `/admin/boardpositions` are live.
  Unlike bullets 2 and 8, this one **is** tier-enforced: both routes are `tier: 'plus'`, so a
  Free family reaching either gets `/upgrade`. **It is the first Plus bullet in the product's
  history that is correctly withheld from a Free family** — and it is still counted as half,
  because the bylaws-and-minutes half of the same sentence is `/documents` and still gated.
  The two genuine giveaways remain bullets 2 (RSVPs, head counts, check-in) and 8 (profile
  pictures), both unchanged and both in §4.
* **Plus's opening bullet is still the most exposed claim in the file, and it is no longer
  undecided.** Payment processing has no route, therefore no gate, therefore no Coming Soon
  screen — on the first line of the `featured: true` card. What has changed is that
  [payment_info.md](payment_info.md) exists: Stripe, **Model C** — each family owns its own
  connected account and takes direct charges — with money transmission (Model A) and
  Express/destination charges (Model B) both argued and rejected. **The provider decision is
  made.** What is open is the platform fee and the "what legal entity is a family" question,
  and this file went on saying "needs a provider and a fee decision" for a week after half of
  that was answered.
* **Premium is honest by construction** — every bullet is unbuilt and the whole card carries a
  Coming soon badge and a disabled button, so the tier cannot mislead about availability. What
  it can mislead about is *scope*, which is what the decisions list is for.

### `lib/plans.ts` and `PLANS[]` have drifted, by two bullets

Found 2026-08-19, and it is the first realisation of a cost `lib/plans.ts` accepted in its own
header: *"The two are kept in step BY HAND, deliberately, and the cost of that is real."*

`PLAN_ADDS` — what a MEMBER reads, on `/admin/family` and `/upgrade` — and `PLANS[].adds` —
what a BUYER reads, on `/pricing` — now differ:

| Tier | `/pricing` | in-product | Difference |
|---|---|---|---|
| Free | 7 | 7 | none |
| Plus | 8 | 7 | "A face against every name" is its own bullet on `/pricing` and is **merged** into "Photographs, findable" in-product. The content survives. |
| Premium | 6 | 5 | "A proper address for it, ready to go" — *"No hosting bill, no plugins, and no relative who 'knows computers' maintaining it"* — is on `/pricing` and is **absent** in-product. The content does not survive. |

The Plus row is a merge and is defensible. The Premium row is a dropped claim: a family put on
Premium is not told, anywhere inside the product, that the address comes with the website.
Neither list may be derived from the other — that argument is sound and is stated in both
files — but the diff is two lines and belongs in the same commit as the next edit to either.

### How the gate works

`proxy.ts` *rewrites* — not redirects — any gated path to `/coming-soon`, which names the
feature from its `blurb` and lists the live ones as "Available now". Nested paths inherit their
parent entry's status. **An unregistered path is not gated**, which is why the nine claims with
no route at all are the most exposed items in this file: nothing catches them.

**And a DELETED path is not gated either**, which is the top note's mechanism restated. A
withdrawal is invisible to every surface that derives from this registry: `proxy.ts` cannot
gate what is not there, `isFeatureFuture()` answers `false` because `getFeature()` finds
nothing, and the pill comes off. A flip corrects both marketing surfaces automatically; a
retirement corrects neither.

**Coming Soon withholds a PAGE and never an ACTION**, and AGENTS.md has a section on that now,
written after two afternoons of finding out. `/admin/chapters` and `/admin/boardpositions` were
both relit in the last two days and both had live, holed HTTP endpoints behind them for the
whole time they were "not shipped" — missing `family_code` conjuncts, reads with no permission
check, four client-supplied ids written onto one row. The seven routes still `'future'` are
seven action modules nobody has exercised recently, and their §1–§5 review is owed **now**
rather than at the flip.

### Severity, and what it means here

Rated by the **promise**, not by the code:

| | Meaning |
|---|---|
| **blocking** | Sold in the **Free** tier, or in a page title or hero. Somebody signs up for nothing and finds it missing. |
| **high** | A paid-tier headline. |
| **medium** | Body copy. |
| **low** | An incidental mention. |

**A withdrawn capability is rated by the tier that still sells it**, which is how the
direct-lineage copy comes out **blocking** while nothing at all is broken: it is on the Free
card, and a family signing up for a lineage view finds no such screen.

---

## Delivery order

Sequenced by the tier the feature is sold in, **Free first**. Two reasons: a gap in the free
tier is the promise made to everyone, so it costs the most trust; and the paid tiers sit on top
of that base, so they cannot be sold until it works.

### Free — nothing left

**The route list is empty and has been since 2026-08-13**, and since 2026-08-19 the copy is too.
Every Free bullet resolves to a live route and describes it in the product's own words.

| # | Ship | State |
|---|---|---|
| — | — | **Nothing outstanding.** The last item was the `/direct-lineage` copy sweep, done in this pass — see the top of this file. |

**What the Free card still does not do is SELL what the tier now includes.** Gatherings, the
calendar and the updates archive are all Free by decision (2026-08-19) and named on no marketing
surface at all, so the card undersells by a whole product. That is a copy opportunity rather than
a gap, and it is decision 10.

**How the Free list emptied**, kept because the shape of it recurs: three routes flipped on
2026-08-12 (announcements, events and their admin screens), the family tree was rearranged
rather than flipped on 2026-08-13, and the seventh item — `/direct-lineage` — was **withdrawn**
rather than delivered. Six of the seven ways this card came true were code; the seventh was a
deletion, and the deletion is the only one that left a mess behind.

### The family tree, which is now the whole answer

`/family-tree` is an ancestry-style focus canvas: click anybody to re-centre on them, fill the
gaps with "+" cards, a Bloodline toggle, a View/Edit mode, and an index of everyone in the
family so nobody is more than one click away. It replaced two things — the per-member lineage
view (`/members/family-tree`, deleted with `FamilyTreeClient`, `ancestors.ts` and `spouse.ts`)
and `/direct-lineage` — and it is not badged.

Four things this file still has to carry, because no mechanism does:

* **`BetaBadge` renders nowhere today.** It is hand-set, cannot be derived — `status` has two
  values and "live but unfinished" is a property of one of them — and both of its instances
  came off with the 2026-08-13 pass. The component stays in `components/ui/beta-badge.tsx` for
  the next surface that needs it. It is the mirror of `ComingSoonBadge`: that one marks a route
  nobody can reach, this one marks a route anybody can.
* **The permission key `family-tree` is still unregistered, and the mechanics of registering it
  are worse than TODO.md describes.** See the decisions list — this pass found a reason the
  obvious migration diverges local from hosted.
* **The second pass is ordinary backlog, not a caveat.** Multiple marriages are drawn
  (2026-08-14), `link_kind` carries step/adopted/foster both ways, and the bloodline anchor is
  settable. What is absent is dates on the connectors and a person card that says more than a
  name and a status. TODO.md carries it.
* **The Directory keeps its button into the tree**, though the rail has an item, because
  somebody looking at a name and wondering how they are related should be one click from the
  answer rather than having to notice the rail.

### Plus — the storage rework, 4 flips, then one build

| # | Ship | Why here |
|---|---|---|
| 0 | **Storage rework** | Unchanged since 2026-08-12 and now a week older: 4 buckets, 15 policies, no family predicate anywhere. **It got smaller on 2026-08-19 without anybody working on it** — `event-photos` was one of the two buckets behind a LIVE feature, and that feature is deleted, so the only live one left is `avatars`. Still the long pole, and still the long pole for three things rather than one. **Read the warning under this table.** |
| 1 | `/family-finances` | Cheapest real flip in the repo. Needs the restricted `resource_visibility` backfill in the same migration. |
| ~~2~~ | ~~`/elections` + `/admin/elections`~~ | **DONE, 2026-08-21.** Both obligations this row acquired were met: the position picker states the empty board-position case per level ("No chapter offices recorded yet. Add them under Members › Organization first.") and `BallotForm` uses `PersonPicker`, which searches any part of any name and disambiguates. What was NOT on this row and turned out to matter more: the four date columns governed nothing, an election had no level, and `election_votes`' cross-member SELECT policy was satisfied by the member view grant (then `review/elections:view`, now `community/elections:view`), which every member holds — so the secret ballot was not secret. All three are `20260821000001`. |
| 3 | `/documents` | Gated on the storage rework, and it is the worst bucket. Also `documents.ts` returns `getPublicUrl` for a **private** bucket, so downloads cannot work at all. |
| 4 | `/photos` | Same storage rework, plus three defects of its own — see the register. |
| 5 | `/admin/reports` | Flip **last**, and it is now a smaller screen than the one that was promised. Its dues column shipped separately on 2026-08-17 as `/dues-projections`; membership it can answer today; **t-shirt counts it can also answer**, off `people.tshirt_size` where the sizes always lived, which is where `getOrgStats` reads them since 2026-08-19. **RSVP turnout has no source at all** — `event_rsvp_attendees` is dropped and nothing in this product records who is coming to anything — so the blurb and `PLANS[]` both had to stop promising it. Not blocked on work: blocked on deciding whether a two-figure Reports screen is worth a route. |
| 6 | **Payment processing** | The only Plus item that is a build. **Half-decided now** — [payment_info.md](payment_info.md) chooses Stripe Model C. What remains before a route can exist is the platform fee and the entity question, and it is still the one claim with no gate at all, so it must not be the thing left outstanding when `PRICING_IS_ANNOUNCED` flips. |

**Two items left this table since the last pass, and neither by a flip of its own.**
`/admin/boardpositions` shipped on 2026-08-19 and took `family_roles` per-family with it;
`/admin/chapters` shipped on 2026-08-18 and became the Organization pane inside Members &
Access, with the route surviving as a redirect for the three reasons its own file argues. Both
are `tier: 'plus'` and both are genuinely withheld from Free families, which is what makes them
the first evidence that the tier mechanism works end to end.

> ### ⚠ The storage warning, one week older and unchanged
>
> **THE URGENT HALF OF THIS WARNING WAS `event-photos`, AND IT IS NO LONGER LIVE.** That bucket
> is `public: true` with no family predicate in any policy — the bare `bucket_id = X AND
> auth.uid() IS NOT NULL` — and twelve of the fifteen policies omit a `TO` clause, so they
> attach to `PUBLIC`, which includes `anon`. `/events` and `/admin/events` were live behind it
> from 2026-08-12, which made one family's event photographs readable by URL by anyone, and by
> any signed-in member of **any** family through the API. Both routes and the `event_photos`
> table are deleted (2026-08-19), and `deleteEventPhoto` — which took its object path from the
> client — with them.
>
> **THE BUCKET AND ITS FIFTEEN POLICIES ARE STILL THERE**, and so is every object already in
> it: `20260819000006` drops tables, and `storage.*` is out of its scope exactly as it is out of
> `truncate_entire_database.sql`'s. So this is now an ORPHANED public bucket rather than a live
> hole — nothing in the product writes to it or reads it, and anything already uploaded is
> still world-readable by URL. **Dropping the bucket is owed and is not this change**; it is a
> storage operation rather than a migration, and it belongs with the rework below.
>
> `avatars` is the one bucket still behind a live feature, and the same defect applies to it.
> The claim *"One family cannot see another. Ever."* is published on four surfaces and is
> still false of a shipped feature — a smaller one than it was, which is not the same as fixed.

**This order is close to the inverse of the card's,** and that is expected rather than wrong:
the card ranks by which absence hurts a family most, this table ranks by what unblocks what.

- **Payments is bullet 1 on the card and item 6 here.** The gap is open for the entire life of
  the Plus rollout, on the opening line of the featured card, with no gate behind it.
- **Profile pictures is bullet 8 on the card and appears in this table not at all,** because it
  is not work of the same kind: it ships today, free, and the decision is whether to take it
  away. It is in the decisions list instead, and it must be settled before
  `PRICING_IS_ANNOUNCED` — a Plus bullet a Free family already has is the one error on that page
  a reader can catch by themselves.
- **Elections moved UP,** from item 3 to item 2, because its structural blocker
  (`/admin/boardpositions`) shipped. It also acquired an empty-state obligation in the same
  movement, which is the sort of thing a dependency being *satisfied* is not supposed to do.
  **Both are done as of 2026-08-21**, and the review found three things this list never
  named — dead date columns, no level on an election, and a readable ballot. Which is the
  argument for the Review section in the rail rather than for a longer list here: a walk
  through a screen finds what a register of known defects cannot.

### Premium — the reach half can start, the website half cannot

**The four reach features are separable from the website and from each other**, which makes them
the only Premium work that could start today: apps for iPhone and Android, push notifications on
web and mobile, email distributions drawn from membership, and automatic dues reminders. Each is
a build with no route, so none can ever show `/coming-soon`.

**Automatic dues reminders is the cheapest and the least speculative, and it got cheaper.** Dues
schedules and installments are live under `/admin/account`; `/dues-projections` shipped on
2026-08-17 and already computes, per approved person, what is owed and whether they are Active,
Invited or Pending Invite; and `duesPlanMath` in `lib/dues-utils.ts` decides what the *next*
installment has to be, arrears included, as a pure function taking `today` as a parameter. So
the "what to remind whom about" half is built and unit-tested. What is missing is a scheduler
and a sender — and the sender has to read `lib/email/`'s open-relay rule first.

**The public website half is what cannot start:**

1. **`/photos` first.** Gatherings and Announcements shipped and *are* the content a public
   site renders; photographs are the third, and they are behind the storage rework.
2. **Decide the publish / opt-in model.** Nothing in the permission system can express "visible
   to the world", and a public surface over family data inverts the *"One family cannot see
   another. Ever."* claim published in four places. A design decision, not a build task.
3. Wildcard subdomain and certificate provisioning for `yourfamily.genorra.com`. Revisit
   `app/(auth)/register/page.tsx` in the same change — it currently says *"There is no public
   profile and nothing is shared outside the family you join."*
4. Build the public renderer **last**; it is the only part that cannot start before those three
   decisions.

**One new input to the website design.** `families.status` is `'active'` or `'removed'`
(`20260817000006`) and removal is a soft disable — no row is deleted and a restore brings
everything back. A public site has to decide what a removed family's address serves, and the
answer cannot be "the last thing it rendered". That is a decision the removal feature created
and the website half inherits.

### Decisions needed before anything is scheduled

These are product calls, not engineering work. Each one currently has a built feature or a
published claim on the wrong side of it. **Five of the nine on the last pass are now closed**,
and they are struck rather than deleted so the reasoning survives.

1. ~~**Tier for hotel room blocks, multi-day itineraries, per-event budgets.**~~ ~~**Tier for
   `/admin/event-types`.**~~ ~~**Does `/event-planning` earn a tier?**~~ **Closed twice over.**
   First by the `tier` field on 2026-08-13, which made all three Free by decision; then by
   deletion on 2026-08-19, which removed every screen they were about. Kept struck rather than
   dropped because the SHAPE recurred immediately as item 2.
2. **Does a capability INSIDE a Free page get sold separately?** The registry gates by route and
   cannot express a boundary running through a page. **The live case used to be RSVPs and head
   counts inside a Free `/events`, and it went with the product without being solved** — which
   is worth keeping, because it is how a decision gets closed by accident rather than answered.
   The mechanism exists and is the one permissions use — a sub-key with its own entry, the way
   `transactions/dues-payments` has one and `gatherings/budget` already does. **Nobody has used
   it for a tier yet**, and until somebody does, a page's tier governs everything on it. The
   next candidate is inside Gatherings, and `lib/features.ts` says so beside that entry.
3. ~~**Where do child management and convert-to-adult sit?**~~ **Answered by deletion**,
   2026-08-13. A child is a person; `editPersonRecord` and `invitePersonRecord` took the two
   jobs. AGENTS.md §4b. What it left is the copy sweep at the top of this file.
4. ~~**What is the new family-wide tree, precisely?**~~ **Answered**, 2026-08-13.
5. ~~**Does `/family-tree` get a permission resource?**~~ **DONE, 2026-08-19** —
   `20260819000008_family_tree_resource.sql`, TODO.md's option 1. The tree is gated on its OWN
   key rather than on `members`: `view` and `edit`, `category = 'community'` beside Directory,
   every existing template backfilled `'any'` on both so nothing changes about who can do what,
   and `seed_family_permission_templates()` redefined so a family created afterwards gets the
   edit grant too — without that half a brand-new family would have a read-only tree and nobody
   able to build it. The six write actions in `app/actions/family-tree.ts` now share one
   `requireTreeEditor()` gate (`requireMember()` first, for the honest pending message, then
   `canAny`), because a page guard is a convenience and a `'use server'` export is a URL.
   `family-tree` joins `NO_OWNER_KEYS`: an Own grant is indistinguishable from All on the read
   and a denial on the write, so the grid stops offering it.

   **And the person panel follows the DIRECTORY, not the tree.** A family may show the shape of
   itself to somebody it has not handed the roster to — that is what a tree is for — while the
   panel behind a card is where one person's record is read and corrected, which is the Member
   Directory's question. So `canViewDirectory` is `can(user.id, 'members', 'view')`, resolved on
   the page and threaded to the canvas. The coupling is deliberate and narrow: `belongsToFamily`
   still uses the service role, so a restricted Directory cannot break a tree WRITE, which is
   the hazard AGENTS.md §4 is actually about.

   **The finding below is what shaped that migration and is kept**, because it is the reason the
   file does the opposite of what §6 says and argues it at length:

   `permission_table_map` has rows keyed `family-tree` for **three** tables —
   `person_relationships`, `family_ancestors` and `relationship_types` — seeded by
   `20260618000001`. They are all currently **skipped**, because `resource_key` is a foreign key
   into `permission_resources` and `20260806000006` deleted the `family-tree` row *and* removed
   it from `20260618000000`'s seed. So those tables are unmapped and keep their base policies.

   AGENTS.md §6 says to add a new resource **in a new migration *and* in the seed**. Do that for
   `family-tree` and the two halves stop agreeing: on **hosted**, `20260618000001` has already
   run and will never run again, so the three map rows stay absent and no policy changes. On a
   **fresh `db reset`**, the seed now has the row, the foreign key resolves, the three rows
   insert, and the sweep composes RLS policies on `person_relationships` and
   `relationship_types` that hosted does not have. `tests/rls` runs on a fresh reset, so the
   suite would be testing policies production does not carry — which is the failure mode §7 is
   most explicit about.

   `relationship_types` is the sharp one: its `own_expr` is `'false'`, so a composed policy
   would demand `family-tree:view = 'any'`, and a family that restricted the tree would get
   *"That relationship type is not set up"* on every addition — the exact symptom AGENTS.md
   records from the weeks that table sat empty.

   **So the migration deliberately does NOT edit the `20260618000000` seed**, which is §6's
   instruction inverted for a stated reason: running only at the end of the chain is what makes
   a fresh database and hosted come out identical, and that is what the seed rule exists to
   achieve rather than something it overrides. Its §5 asserts the absence of the map rows AND
   the absence of any policy naming the key, in both directions, so a later migration cannot
   reintroduce the coupling by accident. This key gates a screen and its writes; no policy in
   the database evaluates it and none may start to.
6. ~~**Does the `/admin` hub survive?**~~ **Answered by deletion, 2026-08-19.** It was a gated
   page (`status: 'future'`, so `proxy.ts` served Coming Soon and it never rendered), with no
   permission row, gating on the wrong key (`admin/users`), and two of its three tiles pointed
   at `/admin/events` and `/admin/event-types`. Removing Events left it unable to compile, and
   nothing linked to it, so the delete was the cheap answer. **The `FEATURES` entry stays** and
   is not the page: `/admin` is the fail-closed catch-all an unregistered `admin/…` key resolves
   through (`20260817000004`), so deleting the row would open every future admin key rather
   than tidy anything.
7. **Trusted Vendors** — directory, marketplace, or discount list? No code exists. Its `soon`
   flag on `/features` is hand-set because it has no route to derive from.
8. **Profile pictures are sold as Standard and ship free to everyone.** *(And the bucket's
   WRITE hole is closed as of 2026-08-20 — `20260820000002`. Any signed-in user could overwrite
   or delete any other member's photo, which on a `public` bucket means choosing the picture the
   whole family sees under somebody else's name. Writes are folder-scoped to the owner now. The
   READ question below is unchanged and is still open.)* Sold as PLUS until
   2026-08-19, when the bullet moved down a rung with the Standard restructure — the mismatch is
   one tier narrower and is not closed. `AvatarUpload` is on `/personal-info`, which is live and
   Free, so the work is still *withdrawing* a capability. Three calls come with it — whether
   families already using it are grandfathered, what happens to the pictures already uploaded,
   and where the check goes. `lib/features.ts` cannot express it as things stand (item 2 above is
   the mechanism), because the upload sits on a Free page: it needs a sub-key of its own, which
   is now a well-worn device rather than a proposal — `gatherings/budget`, `admin/users/templates`
   and `transactions/fund-transfers` all do it. **It also got entangled further:** the `avatars` bucket is
   still world-readable by URL, and `components/ui/Avatar.tsx` now carries an
   `eslint-disable-next-line @next/next/no-img-element` with **no stated reason** — see the
   resize note under Supporting work §1.
9. **RSVPs, head counts and day-of check-in are sold as Plus and ship free to everyone.**
   Unchanged. The general question underneath it — *where does tier enforcement live?* — is
   **answered** and no longer part of this item: it lives in `lib/features.ts` plus
   `requireView`, three live routes prove it, and what these two need is item 2's sub-key rather
   than a mechanism.
10. **Gatherings, the calendar, the updates archive and family removal are FREE — decided
    2026-08-19.** The registry already said so; what is new is that the decision is recorded
    rather than inferred, and that distinction is not pedantry — "shipped Free by default" and
    "Free on purpose" look identical in `lib/features.ts` and are not the same claim. The
    argument that forces it is structural: a gathering can only be created FROM a template, so
    putting the template library behind Plus would make the existing Free bullet "The reunion on
    the calendar" false.

    **WHAT IS STILL OPEN IS THE COPY, NOT THE TIER.** No marketing surface mentions gatherings,
    templates, assigned tasks, task review, the calendar or the archive — six routes and six
    resource keys sold in no bullet at all. That is the one direction of §4's drift that costs
    nothing to be wrong in and a great deal to leave alone, because a card that does not name
    its best feature is a card nobody buys. Whoever writes those bullets edits `PLANS[]` and
    `lib/plans.ts` in the same commit (see the drift table) and checks whether a pillar has to
    move with them.

    **If a capability inside Gatherings is ever sold separately** it takes a sub-key with its own
    registry entry — the mechanism `transactions/fund-transfers` now demonstrates end to end
    (decision 12). The budget band is the obvious candidate and `gatherings/budget` already
    exists as a key; read AGENTS.md first, because that key withholds a SCREEN BAND and not the
    figures, and selling it would mean moving the money to its own table.
11. **Fund transfers are PLUS and board positions are PLUS — decided 2026-08-19, and the first
    is the first tier boundary in the product that runs THROUGH a page.** Board positions needed
    nothing: `/admin/boardpositions` was already `tier: 'plus'`. Fund transfers needed the
    mechanism this file has been describing as available-but-unused since the tier field landed,
    so it is now demonstrated end to end and worth reading before the next one:

    * A registry entry for the SUB-KEY, `/transactions/fund-transfers`, `status: 'live'`,
      `tier: 'plus'`. It exists only to carry the tier: `tierAllows()` resolves a key through
      `getFeature()`'s longest-prefix match, so without a row of its own the ledger inherits
      `/transactions` and is Free — which is what `lib/auth/tier.ts` documents as the correct
      default ("a tab is part of the page it is on"). This is the deliberate exception, and a
      registry row is the only way to state one.
    * `status: 'live'` matters twice over: `'future'` would make `proxy.ts` rewrite
      `/transactions/...` paths to Coming Soon, and would make `getResources()` drop the Fund
      Transfers switch out of Members & Access with no error at all.
    * The PAGE has to honour it. `app/(protected)/transactions/page.tsx` ands `tierAllows()`
      into every ledger's view answer — all five rather than transfers alone, so the next
      capability sold separately is one `tier:` line rather than an edit somebody has to
      remember. That gates the FETCH and not the tab (§5): a Free family's request never reads
      `fund_transfers` at all.
    * It adds NO rail item, because `buildNavGroups` renders a hand-written list keyed on
      `viewKeys`. A registry row does not conjure a destination.
    * The server action is deliberately NOT tier-checked, per AGENTS.md: a family that lapses to
      Free keeps every transfer it recorded and loses the pane that lists them.

    **`npm run help:check` will fail on the next one of these**, and that is the gate working
    rather than a nuisance: every live route needs a chapter. A sub-key row that is not a route
    goes in the script's `UNDOCUMENTED_OK` with its reason, which is what this one did.

12. **What does the Coming Soon screen offer, and to whom?** `ComingSoonScreen` renders
    `LIVE_FEATURES` unfiltered — all 27 of them — so every member reaching a gated URL is handed
    **ten administrator screens**, two of which are also **Plus-only**, plus
    `/dues-projections` — eleven distinct destinations an ordinary member of a Free family
    cannot open. This file
    logged it as "three administrator links" when there were three; the defect grew with the
    product and will keep growing. The fix is to resolve the caller's viewable set the way the
    sidebar already does and gate the fetch (§5), which makes it an engineering item — it is
    here because the product call is whether that screen should list anything at all.

---

## Gap register

Grouped by feature, because the question this answers is "what does shipping X close?"

### Blocking — sold in Free

**EMPTY, for the first time since this file was written.** Every Free bullet resolves to a live
route and describes it in the product's own words.

| Feature | Route | Claims | Shipping it requires |
|---|---|---|---|
| ~~Direct lineage view; "add your children and convert them to members"~~ | **none — withdrawn** | 6 strings on 2 files | **Closed 2026-08-19.** The words were swept to the Family Tree's; see the top of this file. |

**That row is kept struck rather than deleted, because its SHAPE was new and will recur.** Every
other blocking row this file has ever carried read "flip this route". That one read "there is no
route, and there should not be" — a withdrawal, which looks exactly like a gated feature from the
marketing side and nothing like one from the code side. No mechanism can see it. Only this file
can, which is why "Keeping this current" now carries the sweep rule and the grep.

**The five that closed on 2026-08-12 and 2026-08-13**, kept with what each flip left behind,
rather than merged into **Already true**, because a tick would hide the obligations:

| Shipped | Route | Claims closed | What it left behind |
|---|---|---|---|
| Family tree | `/family-tree` | 15, mostly | An unregistered permission key, and — found this pass — a registration path that diverges local from hosted. See decision 5. |
| Announcements | `/announcements` | 8 | Nothing at the time. Since 2026-08-19 it also carries the Birthdays pane on its own sub-key `announcements/birthdays`, which is in `TAB_RESOURCES` because it has no route of any kind. |
| Announcement management | `/admin/announcements` | 3 | The route was **deleted** on 2026-08-13 with its permission resource (`20260813000000`) — the member-facing page does the same job under the same key. A second withdrawal, and this one left no marketing copy behind, which is the only reason it caused nothing. |
| ~~Events~~ | ~~`/events`~~ | ~~19~~ | **Shipped 2026-08-12, DELETED 2026-08-19.** The only entry in this table that closed claims and then reopened them: 19 claims went from *live* to *nothing at all*, which is why the marketing sweep at the top of this file was part of the same commit rather than a follow-up. What its two rows recorded — 31 uncased actions behind one key, no sub-key per rail item, a world-readable bucket — is not a lesson about Events; it is what a feature looks like when it is flipped on without the review AGENTS.md's "Coming Soon withholds a page" section now demands. |
| ~~Event management + templates + planning~~ | ~~`/admin/events`, `/admin/event-types`, `/event-planning`~~ | ~~7 + 1 + 3~~ | With the above. Gatherings is the replacement and shipped WITH per-pane keys (`admin/gatherings`, `admin/gathering-templates`, `gatherings/budget`) and RLS cases for every action — which is the one thing these two rows successfully changed. |

### High — paid-tier headlines

| Feature | Route | Tier | Claims | Notes |
|---|---|---|---|---|
| Family finances — fund balances, P&L | `/family-finances` | Plus | 12 | Admin counterpart live. **The dues half ships today** (`/transactions`, `/account-summary`, `/dues`, `/donations`, `/payment-history`, schedules under `/admin/account`) — only balances and the P&L are gated, so do not attribute the whole "dues and fund accounting" claim here. |
| Photos — galleries, captions, tagging | `/photos` | Plus | 11 | Storage rework + a **live `PGRST201`** that makes every gallery render empty + `deletePhoto` trusting a client-supplied path + the hand-rolled tag search that `/features` explicitly sells + **no resizing anywhere in the upload or render path** |
| Documents — bylaws, forms, minutes | `/documents` | Plus | 7 | Worst bucket; `getPublicUrl` against a private bucket. Also half of Plus bullet 6, whose other half is live. |
| ~~Elections — nominate, accept/decline, vote~~ | `/community/elections` | Plus | 6 | **Live 2026-08-20, reviewed 2026-08-21.** Both named defects fixed, plus a level on every election so a chapter's ballot is invisible to the rest of the family. |
| ~~Election management~~ | `/admin/elections` | Plus | 3 | **Live and reviewed with the above.** Captioned **Elections** under Admin now; the three "advance the state" buttons are gone and the dates run the ballot. |
| ~~Regions & chapters~~ | `/admin/chapters` | Plus | 5 | **Live, 2026-08-18.** Became the Organization pane in Members & Access; the route survives as a redirect and must not be deleted (its own file gives three reasons). Its relight is one of the two afternoons that produced AGENTS.md's "Coming Soon withholds a page, not an action" section. |
| ~~Board positions~~ | `/admin/boardpositions` | Plus | 4 | **Live, 2026-08-19**, and per-family: `20260819000004` retired the 25 built-ins, made `(family_code, name)` unique, dropped `is_global` and `family_role_exclusions`, and gave `family_roles` the family conjunct its SELECT policy never had. A family now starts from none. |
| Leadership reports | `/admin/reports` | Plus | **2** | **Halved on 2026-08-17** by `/dues-projections`, and halved again on 2026-08-19: **RSVP turnout lost its source entirely** with `event_rsvp_attendees`, and t-shirt counts moved onto `people` where the sizes always lived. Membership and dues-collected are what remains, and the blurb and `PLANS[]` were both trimmed to say so. |
| **Payment processing** — card, debit, PayPal, Apple Pay, Google Pay, Cash App | **none** | Plus | 6 | **No route, so `proxy.ts` cannot gate it and Coming Soon never appears.** Still the most exposed claim in this file. **Provider now decided** — [payment_info.md](payment_info.md), Stripe Model C. |
| Profile pictures | `/personal-info` — **live** | Plus | 2 | Sold as Plus and shipping to everyone, free. A capability to withdraw rather than one to ship. Its detail line — "on the directory, the tree and everywhere a member is listed" — reads correctly: the Member Directory shows it and the family tree draws it on every card. Sold one tier too high, not overstated. |
| ~~RSVPs, head counts, day-of check-in~~ | ~~`/events` + `/admin/events`~~ | ~~Plus~~ | **0** | **CLOSED BY DELETION, 2026-08-19, and the copy went with it in the same commit** — the Plus bullet, the Free/Plus FAQ paragraph, the `/features` tier summary, the how-it-works step and the pillar. It was the second-strongest argument on the featured card and it was a giveaway, so the replacement bullet is Dues Projections, which is genuinely Plus. **Nothing in the product records who is coming to anything now**; a gathering step can ask, and that is not the same claim. |
| **The public family website that builds itself** | **none** | Premium | 6 | No route, no entry, no code. Now also owes an answer about what a **removed** family's address serves. |
| **Per-family public address** | **none** | Premium | 3 | No route, no config, no code — **and dropped from the in-product plan list**, so a Premium family is never told it is included. See the drift table. |
| **Apps for iPhone and Android** | **none** | Premium | 2 | No route and none possible — this claim leaves the web app entirely. Largest item in this file. |
| **Push notifications, web and mobile** | **none** | Premium | 1 | No route, no code. **Read the bullet before building it:** it promises notifications "for events, announcements and messages" — and there are no events any more, so one of the three subjects does not exist. The bell that exists fires on membership traffic and gathering tasks only — `task_denied`, `task_reopened` and the five approval doors. So a member has the mechanism the copy names, for none of the three subjects it names. The bell is also **cross-family** (`getPendingApprovalQueues`), which is the one thing in the product that deliberately reaches past the active family, and any push design has to decide that question rather than inherit the old per-family answer. |
| **Email distributions** | **none** | Premium | 1 | No route. `lib/email/` sends transactional mail one recipient at a time; a list drawn from membership does not exist. Read that module's open-relay rule before building it. |
| **Automatic dues reminders** | **none** | Premium | 1 | No route, no scheduler — and the hardest half is now built. `/dues-projections` computes who owes what and whether they can even be reached; `duesPlanMath` computes the next installment including arrears, as a pure function. This is the send half only. |

### Medium / low

| Feature | Route | Claims | State |
|---|---|---|---|
| Trusted vendors | none | 2 | No code. Hand-set `soon` flag on `/features`. |
| Family stories and traditions as a first-class thing | none | 2 | No code. |
| ~~Untiered event sub-capabilities (hotel blocks, nested itineraries, per-event budgets)~~ | ~~`/admin/events`~~ | ~~4~~ | **Gone with the product, 2026-08-19.** Never tiered, never sold, and now nothing to tier. |
| **Gatherings, task review, the calendar** | `/gatherings`, `/gatherings/my-tasks`, `/calendar`, `/admin/gatherings`, `/admin/gathering-templates` | **0** | **Live, Free, and sold nowhere at all.** Six resource keys, six tables — and since 2026-08-19 the ONLY thing on the calendar, which makes "The reunion on the calendar" a Free bullet resting entirely on it. Decision 10. |
| **Updates archive** | `/updates` | **0** | Live, Free, sold nowhere. The archive behind the dashboard's Recent Updates card. |
| **Dues projections** | `/dues-projections` | (inside 1 claim) | Live and **actually withheld from Free families**. It delivers the dues half of `/admin/reports`' bullet a route early. |
| **Fund transfers** | `/transactions?ledger=transfers` | **0** | Live since `20260812000002`, its own permission resource on purpose. **Plus since 2026-08-19**, through the first sub-key tier entry in the registry — correctly withheld now, and still named on no marketing surface. Decision 11. |
| **A family can be removed and restored** | `/admin/family` + the staff console | **0** | Live since `20260817000006`. Soft disable, six-digit emailed challenge, restore only from the GENORRA staff console. Sold nowhere, and correctly so — but the public-website work inherits a question from it. |
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

> **2026-08-19: four of the six decisions below moved, and one of them closed.** The proposal
> is unchanged in shape; what changed is the ground under it.
>
> * **Decision 2's "an area is not a chapter" got a mechanism.** `lib/chapter-places.ts` (new,
>   2026-08-19) derives `people.chapter_id → chapters.region_id → regions.name` on the admin
>   client, for exactly the reason this proposal predicted — a member's region was underivable
>   through the user client, because the composed policies on `chapters` and `regions` demand
>   `admin/chapters:view = 'any'`. Both member tables now print a Region column from it, and
>   `regions.ts` carries the states and provinces. **So "resolve an area to an explicit roster
>   at raise time" is now one function call rather than a design problem**, and the argument
>   for freezing the roster at raise time is unchanged.
> * **Its half-built neighbour did NOT get fixed, and now says so out loud.**
>   `announcements.scope` still filters `chapter` only; `addressedTo` in
>   `lib/announcement-audience.ts` documents "National and regional reach everybody" as
>   deliberate. That is a defensible reading for an announcement and a bad one for a check-in,
>   and with region derivation available the cost of narrowing it is now small. Decide it there
>   before reusing that audience mechanism here.
> * **The `createAnnouncement` defect at the bottom of this section is FIXED.** It now calls
>   `belongsToFamily('chapters', …)` before writing a client-supplied `chapter_id`
>   (`app/actions/announcements.ts`), with the reasoning in the file. The section is kept
>   because the shape is what matters and the next audience feature can reintroduce it.
> * **Decision 1's channel problem is unchanged and is the whole blocker.** Push is still a
>   Premium bullet with no code and SMS is in no plan at all. Nothing about Gatherings, the
>   calendar or the removal flow moved this.
> * **Decision 4's "answering is self-service" now has a worked precedent beside `submitRsvp`:**
>   `submitGatheringTask`, which is `requireMember()` over the caller's own task row, refuses an
>   approved one, and writes a NEW submission rather than editing the refused one. That is the
>   shape a check-in answer wants, including the part where the history survives.

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

> **2026-08-19: decision 4 below is sharper than it reads, and decision 6 is a week older.**
>
> * **Decision 4 said the first record attached to a person "makes the gap concrete rather than
>   theoretical".** It does, and the gap is bigger than "the key is unregistered": three
>   `permission_table_map` rows are keyed `family-tree` and are currently skipped because the
>   resource does not exist, so registering it the way AGENTS.md §6 prescribes composes RLS
>   policies on `person_relationships` and `relationship_types` on fresh databases only. The
>   full argument is decision 5 in the decisions list. **This proposal must not be the thing
>   that forces that migration**, because it would land it under time pressure with a new table
>   in the same commit.
> * **Decision 6 — storage is the gate — is unchanged and the gate has not moved.** Four
>   buckets, 15 policies, no family predicate. Two of the four are now behind live features.
>   Nothing here should ship on top of that arrangement, and seven days have passed with nobody
>   reworking it.
> * **One thing got easier.** `MemberDetailsDialog` (2026-08-19) established that both member
>   tables can open one panel about one person from either screen, with nothing newly fetched.
>   A person's records belong in exactly that shape, and the precedent for "one person, read one
>   at a time, behind one press" now exists rather than needing inventing.

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

> **2026-08-19: decision 7 — "a server action is the wrong container for this" — now has a
> partial answer in the tree, and it is worth reading before designing the job.**
>
> Gatherings shipped a pattern for exactly the shape this import needs: a TEMPLATE is
> instantiated into TASKS, and **a task is a COPY of its step, not a reference** — its own
> `label`, `help_text`, `kind` and `required`, with `step_id` and `template_id` kept for
> provenance and allowed to go NULL. `lib/gathering-instantiate.ts` is the pure half.
>
> That is the same problem an import has and solves it the same way: what was written must not
> be rewritten by a later edit to the thing it came from, and a batch has to be identifiable
> after the fact. Decision 5's "the import wants a batch id on every row it creates, so a bad
> import is one `DELETE` rather than an afternoon" is `gathering_template_uses` in a second
> costume.
>
> **What Gatherings does NOT solve is the container.** Instantiation happens inside a request
> because a template is a handful of steps; a GEDCOM of two thousand individuals is not, and
> `'use server'` exports still carry the platform's time limit. So decision 7 stands and the
> upload half is still downstream of the storage rework.
>
> Two smaller things moved. **Decision 6's `link_kind` default is now exercised in anger** — the
> manage dialog offers the kind for every connection a person has, and
> `person_relationships_marriage_is_not_blood` corrects a spouse edge rather than refusing it —
> so the "unstated" kind this decision floats would be a fourth value on a column three surfaces
> already read. And **the review screen's roster now has a precedent to copy**:
> `/dues-projections` reports every approved person as Active, Invited or Pending Invite, joins
> `family_invitations` in TypeScript because it has three foreign keys to `people`, and never
> truncates quietly.

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

### 1. Storage rework — the long pole, seven days into being remedial

**Nothing in this item has moved since 2026-08-12.** Four buckets, **15 policies**, and the
shape is wrong in three ways. Verified against the migrations on 2026-08-19: the only two files
that touch `storage.*` are still `20260609000000_avatar_url.sql` (12 policies, three buckets)
and `20260610000001_photo_collections.sql` (3 policies, one bucket).

| Bucket | `public` | Reachable today? | Effect |
|---|---|---|---|
| `avatars` | `true` | **Yes** — `/personal-info`, live and Free | World-readable by URL. **WRITES ARE FIXED as of 2026-08-20** (`20260820000002`): they were `auth.uid() IS NOT NULL` with no path test, so any signed-in user could overwrite or delete any member's photo — on a public bucket, choosing the picture the whole family sees under somebody else's name. Folder-scoped to the owner now. READ is unchanged and still the open question. |
| `event-photos` | `true` | **No, since 2026-08-19** — orphaned. Its feature and its `event_photos` table are deleted; the bucket, its three policies and every object already in it survive, because `20260819000006` drops tables and `storage.*` is out of its scope. **Dropping the bucket is owed.** | Anything already uploaded is still world-readable by URL |
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

One application defect must land in the **same** change, because fixing the policy without it
leaves the hole open from the other side: `deletePhoto` takes the object path from the client.
**`deleteEventPhoto` was the reachable one** — its page had shipped — and it is deleted with the
rest of Events, so what is left is the gated one.

**And `tests/rls` still does not cover storage at all.** A storage test harness is part of this
item, not a follow-up: without it the rework's correctness is unverified, and this remains the
one area of the schema with no attacker case anywhere. TODO.md carries it too.

> The claim *"One family cannot see another. Ever."* is published on four surfaces and is
> currently true of every table and false of storage. **This is now the second week it has been
> false of storage behind a shipped feature.** The work did not get bigger; it got later, and
> then it got later again.

#### The resize consideration, and the one move it warned against has already happened

Raised 2026-08-13: **nothing in the upload or the render path ever resizes a photograph.**
`uploadPhoto` stores the file exactly as the browser hands it over, `getPublicUrl` hands the
same object back, and `PhotoCollectionGallery` renders it into a 200px square, four across — so
a gallery of twenty phone photographs is 60–100 MB over the wire to draw a grid of thumbnails.

That section closed by saying the three `@next/next/no-img-element` warnings were **deliberately
left visible**, because *"suppressing them would be the one move that makes this invisible
again, and it is the resize decision that earns the disable comment, not the other way round."*

**A fourth site was suppressed instead of being counted.** `components/ui/Avatar.tsx` carries
`// eslint-disable-next-line @next/next/no-img-element` above its `<img>`, with **no stated
reason** — and it is the worst instance in the tree, not a marginal one:

* It is on a **live, Free** page's bucket (`avatars`), so it is the only one of the four that is
  costing real bandwidth today.
* It renders at **28px to 80px** (`sizeClasses` runs `w-7` to `w-20`) and downloads whatever a
  phone camera produced.
* It is drawn **per row**, not per page. `components/ui/Avatar.tsx` is imported by
  `MemberDirectoryClient` and by `FamilyTreeBuilder`, so one pageview of a 140-person family
  fetches 140 originals — the cost is per-pageview multiplied by the size of the family, which
  is the axis this codebase sizes everything else for.

`npm run lint` therefore reports **3 warnings, not 4**, and the missing one is the expensive
one. Either state the reason in that comment or take it off; a bare disable on the highest-
traffic instance of an open decision is how the decision stops being made.

The three candidates are unchanged, and two of them change what is *stored*:

| | What it does | Cost | Depends on |
|---|---|---|---|
| **Resize on upload** | Downscale in the browser before `FormData` — cap the long edge, re-encode WebP — and store a ~400px thumbnail beside the original. Grid reads the thumb, lightbox reads the original. `<img>` then needs no optimizer and the disable comments get their stated reason. | none | nothing |
| **Supabase render endpoint** | `next/image` with a per-image custom `loader` rewriting `/storage/v1/object/public/` to `/storage/v1/render/image/public/`. Resizing on Supabase's CDN. | none beyond the plan | **Supabase Pro** |
| **Vercel image optimization** | `images.remotePatterns` for the Supabase host, plain `next/image`. | billed transformations, per photo per size | nothing |

Two things to decide rather than assume. **Whether the originals are wanted at all** — a family
archive probably does want the full-resolution file kept, which argues for storing both. And
**whether `avatars` is in scope**: the paragraph above is the argument that it has to be, and it
is stronger than it was when this said "at a size where it matters less per image".

### 2. Per-feature launch obligations

Each gated feature owes these at flip time. AGENTS.md requires them; they are listed here so
"flip the status" is never mistaken for the whole job.

**This section's premise has inverted, and that is the most important line in this file.** It
was written as a checklist for features about to ship. Thirty of thirty-seven routes are live
now, and the obligations did not travel with them — so this is mostly a list of things owed on
**running code**, where "at flip time" no longer means anything and nothing warns.

- **202 uncased server actions**, re-derived 2026-08-19: `app/actions` exports **269** functions
  and `tests/rls/cases.mjs` names **67** of them (101 case entries, of which 6 are raw PostgREST
  probes rather than actions). The old figure was "~85 across the gated set"; the shape of the
  number has changed as much as its size, because the gated set is now small and almost all of
  the deficit is behind live routes. The heaviest, in order:

  **THE TWO HEAVIEST ROWS LEFT THIS TABLE BY DELETION, NOT BY BEING CASED** — `admin/events`
  (31) and `admin/event-types` (14), i.e. 45 of the deficit, which is why the total moved so
  far without anybody writing a case. Read the remaining figures as the real backlog.

  | Module | Uncased | Route |
  |---|---|---|
  | `funds` | 14 | live (`/admin/account`) + gated (`/family-finances`) |
  | `admin/chapters` | 13 | **live** (and this module was relit with five holes in it) |
  | `dues` | 12 | **live** |
  | `chat` | 12 | **live** |
  | `announcements` | 8 | **live** |
  | `admin/permissions` | 8 | **live** |
  | `gatherings` + `admin/gatherings` + `admin/gathering-templates` | 21 | **live**, shipped 2026-08-19 |
  | `elections` + `admin/reports` | 8 | gated |
  | `photos` + `documents` | 9 | gated |

  **Gatherings is the honest test of whether this section works.** Its six tables have exactly
  one policy each — `perm:<table>:select` — and no INSERT, UPDATE or DELETE policy at all, so
  every write goes through the admin client behind five guard triggers. AGENTS.md argues that
  arrangement well. It also means those 21 actions have **no policy underneath them**, which is
  the case §7's suite cannot infer and can only test. Thirteen of the 67 cased actions are
  Gatherings ones, so the feature shipped with the best case coverage of anything in the tree
  and still owes most of its surface.

- **`resource_visibility` backfill** for the gated non-admin keys (§6): `family-finances`,
  `documents`, `photos`, `elections`. **Verified absent 2026-08-19** — no migration mentions any
  of the four in a visibility context. Without it a resource falls back to `everyone` for view
  and nothing else.

- **An `actions` audit** on the remaining gated `permission_resources` rows — §6 says never
  declare an action nothing reads.

- **Sub-keys per rail item** for pages that divide into jobs. **The worked failure was
  `admin/events`, which had no sub-key of any kind and so could not express "record an RSVP but
  do not delete the event" — and it was deleted rather than fixed.** What replaced it did it
  right: `/admin/gatherings` is three panes over two keys, `/gatherings` two panes over two, and
  `gatherings/budget` gates the money band without being a route. The mechanism is well exercised
  now — `transactions/*`, `admin/account/*`, `announcements/birthdays`, `admin/users/templates` —
  so where a page still needs one it is a migration and a page edit, not a design question.

- **Replace the two hand-rolled member pickers** with `PersonMultiSelect` — `BallotForm` and
  `PhotoCollectionGallery`, both still named in AGENTS.md's known-gaps list, both still behind
  gated routes. `PhotoCollectionGallery`'s is a one-line fix now that `lib/person-search.ts`
  exists.

- **A chapter in `/help`, in the same commit.** New since this section was written, and the one
  obligation the tree actually enforces: `npm run help:check` is a step in `verify.yml` and
  asserts every live screen has a chapter or a stated allowance. It reports clean today — 8
  parts, 32 chapters, 154 sections, 3 allowances, 121 links resolved — so **the in-product
  manual is current while the marketing copy is not.** That inversion is worth noticing: the
  surface with a checker is right and the surfaces with hand-typed prose are wrong, in the same
  week, about the same features.

### 3. Registry inconsistencies to resolve

- `/family-finances` gated while `/admin/account` is live — funds configurable, balances
  unreachable.
- `/admin` gated while **all twelve** of its children are live or independently registered, and
  all three of its own tiles now point at live routes. It gates on the wrong key
  (`admin/users`), has no permission row, and nothing links to it. Decision 6.
- ~~`/family-tree` has no permission row.~~ **Resolved 2026-08-19**, `20260819000008`. It is a
  `community` resource with `view` and `edit`, every template backfilled so nothing changed about
  who can do what, and the seeder redefined so new families get the edit grant too. The §6 recipe
  is deliberately half-followed — new migration, NOT the seed — and that file argues why at
  length. Decision 5.
- **The Coming Soon screen offers every member all 27 live routes**, including ten administrator
  screens and three Plus-only ones (two of which overlap), unfiltered by permission or tier. Logged here
  as "three administrator links" when there were three; it grows with the product. Decision 11.
- ~~`cancel_overdue_event_assignments` holds an `authenticated` EXECUTE grant nothing needs.~~
  **Closed by deletion, 2026-08-19** (`20260819000006` §C). It was a publicly-executable sweep
  with no caller anywhere in the tree, over two tables that are now dropped.
- **`permission_table_map` still names two tables that are about to stop existing.** `kids` is
  keyed `direct-lineage` and `family_ancestors` is keyed `family-tree`; both rows are skipped by
  the foreign key, and `20260819000003` drops both tables when empty. A
  catalogue naming a dropped table is the thing that migration exists to fix for `adults` — the
  other two are the same shape and are not in its `DELETE`.
- ~~`/admin/announcements` absent from the sidebar.~~ Resolved by deletion, `20260813000000`.
- ~~The protected layout queries gated event-planning data on every request.~~ Resolved by the
  flip.

### 4. Claims that are LIVE but sold as unreleased — or sold nowhere at all

Decide before `PRICING_IS_ANNOUNCED` flips. These are the mirror image of everything else here,
and they cost revenue rather than trust.

The mechanism is worth stating once, since it recurs every time a bullet moves: Plus and Premium
are `available: false`, so each card carries a Coming soon badge and a disabled button. **Every
bullet under one of them therefore reads as not yet available** — including a bullet describing
something a Free family is using today.

**Sold as Plus, shipping free:**

| Claim | Where | State |
|---|---|---|
| ~~**RSVPs, head counts and check-in**~~ — ~~"Stop guessing the head count"~~ | ~~Plus bullet 2~~ | **CLOSED 2026-08-19, by deleting the feature AND the bullet in one commit.** It was live behind two Free routes and sold as Plus — a giveaway on the second-strongest line of the featured card. The bullet is now "Know what is still owed, before you have to ask" (Dues Projections), which is genuinely a Plus route. |
| **Profile pictures** — "A face against every name" | ~~Plus bullet 8~~ → **Standard bullet 6** | **STILL OPEN, AND CHEAPER TO CLOSE, 2026-08-19.** The bullet moved DOWN a tier when Standard was inserted, which does not fix the mismatch — `AvatarUpload` is on `/personal-info`, which is live and Free, so the capability is still shipping a tier below where it is sold. What changed is the size of the withdrawal: it is now one rung rather than two, and the tier it is sold on is the one that most families needing it will be on anyway. The three calls in §2 item 8 are unchanged and still have to be made. |
| ~~**Per-feature permissions** — "Separation of duties"~~ | **Free bullet 6** | **Resolved** by the 2026-08-12 pricing edit. |

**Live and sold in no tier at all — this was one item, became six, and is now four.** The safe
direction to be wrong in, which is why it is a list rather than a gap. **Every row now carries a
DECIDED tier**, which is the change on 2026-08-19: the column used to mean "nobody has said",
and it now means "said, and not yet sold".

| Capability | Route(s) | Tier | Note |
|---|---|---|---|
| **Gatherings** — templates, scheduled gatherings, assigned tasks, submission review, budgets against a fund, the premier gathering on the Dashboard | `/gatherings`, `/gatherings/my-tasks`, `/admin/gatherings`, `/admin/gathering-templates` | ~~Free~~ → **Free AND Standard**, sold on both | **OFF THIS LIST AS OF 2026-08-19, and it is the one that came furthest.** It was the largest unsold thing in the product — six keys, six tables, named on no marketing surface. The Standard restructure split it across two plans and put both halves on `/pricing`: Free sells "the gathering on a shared calendar" and Standard sells "plan the gathering, not just the date" and "everybody knows their duties". `admin/gathering-templates`, `gatherings/my-tasks` and `gatherings/budget` are Standard; `calendar`, `gatherings` and `admin/gatherings` are Free. |
| ~~**The calendar**~~ | `/calendar` | **Free**, sold | Off this list too, same commit. The Free card's third bullet is now "Put the reunion on a shared calendar", which is this screen said out loud rather than a sentence that happened to be true of it. |
| **The updates archive** | `/updates` | **Free**, decided | Every announcement and everything sent to you, searchable. |
| **Family removal and restore** | `/admin/family`, plus the staff console | **Free**, decided | Correctly unsold — a family should not have to buy the way out. Listed because the public-website work inherits a question from it. |
| ~~**Board positions**~~ | `/admin/boardpositions` | **Plus**, enforced | Off this list: it was already `tier: 'plus'`, and the decision is now recorded rather than inferred. Still appears only inside the `/features` chapters card's blurb. |
| ~~**Fund transfers**~~ | `/transactions?ledger=transfers` | **Plus**, enforced | Off this list, and it is the one that needed building: the sub-key mechanism, exercised end to end. Decision 11. |

**The pattern this section named is still true and its first half is now fully mechanised.**
Free and Plus are served by the same routes in several places, so un-gating a route ships
whichever tier's claims sit on it. The tier field answers the per-route case, three live routes
prove it enforces, and since 2026-08-19 `transactions/fund-transfers` proves the sub-key answers
the boundary that runs THROUGH a page. There is no longer any tier shape this codebase cannot
express — only ones nobody has expressed yet, which is a different and much smaller problem.

**The second half is not mechanised and cannot be:** a capability shipped with no claim at all is
invisible to every derived badge, because there is no bullet to badge. Six accumulated in a week
and four remain. Nothing will ever surface them but this table, which is the same argument the
top of this file makes about a deleted route.

**One more surface to check when a bullet moves.** The `/features` "and the rest" grid derives
its Coming Soon pills from the registry, and since 2026-08-19 its TIER TAGS too — that was the
last hand-typed copy of the tier table in the tree, and inserting Standard would have left it
printing "Plus" beside five routes with nothing able to notice. It gained a Family Tree card in
the same commit and now has nine. It still has **no card for Gatherings, the calendar, the
updates archive, dues projections or board positions**, and no mechanism can add one — a card is
a hand-written entry, so five live capabilities are absent from the catalogue rather than badged
wrongly in it.

**AND ONE MISMATCH THE STANDARD RESTRUCTURE CREATED, recorded here rather than discovered later.**
The whole dues-and-donations ledger moved to Standard — `/transactions`, `/admin/account`,
`/dues`, `/donations`, `/payment-history`, `/account-summary` — and the **Dashboard is still
Free** and still renders `FamilyDuesCollectedCard` and `DonationDrivesCard`, which are money.

It is the smallest kind of leak and it is not nothing. A family that has only ever been Free can
record no payment and open no drive, so both widgets read zero or render nothing at all: there is
no figure to leak because there is no ledger to leak it from. What is real is the family that
DOWNGRADES — it keeps every row (a tier withholds screens, never rows, and must) and its
dashboard goes on printing a collected total for a ledger nobody can open. Two ways to settle it
and neither is free: a sub-key for the dashboard's money band, the device
`transactions/fund-transfers` and `gatherings/budget` already are; or the decision that a
family's own headline total is Free on purpose, in which case say so on the card. **Do not settle
it by tier-checking the dashboard action** — `/dashboard` has no `permission_resources` row at all
(`20260806000006` deleted it) and giving it one to hide a figure would make the landing screen
restrictable, which is a much larger change than the one being made.

---

## Already true

So this file is not only a list of failures — and as of 2026-08-19 it is mostly not one. The
site accurately claims, and a member can reach today: the member directory with Region and
Chapter columns and a details panel, the family tree, family chat, dues plans and the
contribution ledger, the five transaction ledgers, `/dues`, `/donations`, `/payment-history` and
`/account-summary`, Members & Access with permission templates and the Organization pane, member
approvals, Family Settings with the plan panel, Accounting, announcements with pinning and the
Birthdays pane, **and — new since the last pass —** the updates archive, dues projections, board
positions, the calendar, and Gatherings entire.

One qualification belongs with that paragraph rather than in a footnote, because it is the
paragraph somebody will quote:

* **The storage rework still has not happened**, and `avatars` is a live, world-readable bucket
  whose policies carry no family predicate. It used to be two live buckets; `event-photos` is
  orphaned rather than fixed — see the warning in §1, which is smaller than it was and not
  closed. **What DID close on 2026-08-20 is the write half of `avatars`** (`20260820000002`):
  any signed-in user could overwrite or delete any other member's photo, and writes are
  folder-scoped to the owner now. READ is still open, and `documents` and `event-photos` still
  carry the original any-path policies — both named in that migration rather than fixed, with
  the reason each was left.

**"THE WHOLE OF EVENTS" WAS IN THAT LIST AND IS NOT ANY MORE.** The Events product is deleted
(2026-08-19): four routes, six action modules, thirteen tables. Gatherings answers *who is doing
what, and has it been done and accepted*, and `/calendar` answers *when is it* — so the half of
Events that was worth keeping is kept and the half nobody had reviewed is gone. **Two of this
file's own findings closed by that deletion rather than by work** (the untiered RSVP capability
and the `admin/events` sub-key), and one closed by moving (t-shirt counts, which read off
`people` now). A finding that closes because its subject was deleted is not the same as a
finding that was fixed, which is why each is marked as such where it appears.

**Both marketing product surfaces badge honestly from the registry**, and the limits are worth
keeping in view because two of the three have now fired:

| Surface | Badged from the registry |
|---|---|
| Landing (`FeatureShowcase`) | 3 of 3 pillar cards |
| `/features` pillars | 3 of 3 |
| `/features` "and the rest" grid | 7 of 8 — Trusted Vendors has no route, so its `soon` flag is hand-set and commented |

The three pillars are defined once, in `components/marketing/pillars.ts`, and both surfaces
render from it — so a flip cannot correct one page and leave the other stale.

**Three limits, and only the first has not fired yet.**

1. `isComingSoon` is evaluated **per card, not per bullet**, so a badged pillar can list a
   live bullet and vice versa.
2. **A capability with no route cannot be derived** — the nine claims with no code, plus the
   six live-and-unclaimed capabilities in §4, which is the same limit in the other direction.
3. **A DELETED route un-badges everything and warns nobody.** This is the one that fired
   expensively. The family-record pillar's badge came off correctly when `/family-tree` went
   live — and two of its six bullets describe `/direct-lineage`, which is not gated, is not
   badged, and does not exist. The three ways out this file offered a week ago were "ship it",
   "drop the bullet" or "accept it"; **the first is no longer available**, because there is
   nothing to ship. It is a copy edit, and the pillar's `short` and `blurb` need the same look.

**`/pricing` is a third marketing surface and derives nothing.** Its badge is per *tier*, from
`available`, and every bullet in `PLANS[]` is prose typed by hand. That is not an oversight to
fix with a mechanism — a pricing bullet describes a tier's offer rather than a route, several
span more than one route, and "Available now" is a statement about the plan being open to sign
up for, which is true. What the hand-written list cannot notice is a **tier** discrepancy or a
**withdrawn** capability, which are the two that now matter most: the Plus card says nothing
about two of its bullets already being free, the Free card still sells a deleted screen, and the
in-product plan list has drifted from it by two bullets. None of the three derives, so the
tables above are where they live.

**Permissions are sold in the tier that has them.** The Free card's "Separation of duties" and
the `/features` privacy bullet both describe `/admin/users` as it ships, and the Free/Plus FAQ
names it on the Free side. **That claim got stronger on 2026-08-19 and the reason is worth
knowing before anybody simplifies it:** Accounting's Dues & Donations rail item spans two keys
(`admin/account/dues` and `admin/account/donations`) precisely *because* that separation is a
Free bullet the product sells. Merging them is forbidden by the copy, which is an unusual and
healthy direction for a constraint to run.

---

## Keeping this current

**Citations here are quoted strings, not line numbers.** The first pass of this audit had seven
citations systematically off by two lines and four more off by one, because the marketing files
are edited continuously. Grep the quote.

**Re-derive, do not quote.** Every count in this file was re-derived on 2026-08-19 and most had
moved. The commands are the whole job:

```bash
grep -c "status: 'live',"   lib/features.ts     # 27
grep -c "status: 'future'," lib/features.ts     # 7
grep -c "^    href: '"      lib/features.ts     # 34

# exported server actions, and how many tests/rls names
LC_ALL=C grep -rhoE "^export (async )?function [A-Za-z0-9_]+" app/actions/ | wc -l   # 269
LC_ALL=C grep -oE "id: '[^']+'" tests/rls/cases.mjs \
  | sed "s/id: '//;s/'\$//" | sed 's/ (.*//' | grep -v '^raw:' | sort -u | wc -l     # 67

grep -c -i "policy" supabase/migrations/20260609000000_avatar_url.sql               # 12 of 15
npm run lint | tail -3                                                             # the img warnings
```

When a feature ships: flip its `status` in `lib/features.ts`, tick its supporting-work items, and
move its row from the gap register to **Already true**. The marketing badges need no edit — the
landing page and `/features` derive them — with **three** exceptions to check each time:

* A claim with **no route** has nothing to derive from, so if the thing that shipped is one of
  the nine in that category, it needs a route in the registry or a hand-set flag removing.
* A pillar's badge comes off **as a whole** when its route goes live, including over any bullet
  still gated. Read the bullets, not just the route.
* A capability that ships with **no bullet anywhere** is invisible to every derived badge, so it
  needs a claim written or a note in §4 saying deliberately not. Six accumulated in one week.

**WHEN A ROUTE IS RETIRED, SWEEP THE COPY IN THE SAME COMMIT.** New rule, 2026-08-19, and the
reason it is in capitals is that the tree has now done this twice and got away with it once by
luck. Deleting a route is invisible to `proxy.ts`, to `isFeatureFuture()` and to both derived
badge surfaces — a flip corrects them automatically, a deletion corrects nothing. So:

```bash
grep -rni "<the retired route, and the WORDS it was sold in>" \
  "app/(marketing)" components/marketing lib/plans.ts app/page.tsx
```

`/admin/announcements` was retired the same day as `/direct-lineage` and cost nothing, because
no marketing surface had ever named it. `/direct-lineage` was named six times. The difference
was luck, not process.

**A flip is not the whole job, and what it leaves behind is invisible.** The RLS cases §7 demands
and the sub-keys §6 demands do not stop being owed because the route stopped being gated. Nothing
fails and nothing warns, and the obligation quietly changes from "before launch" to "on live
code" — which is why Supporting work §2 is now mostly a list of debts against running features
rather than a launch checklist. If you flip a status and do not write the cases, say so in §2 in
the same commit; that section is the only thing that will remember.

**Ask what a flip un-gates that is sold elsewhere.** Free and Plus share routes, so a flip ships
every tier's claims on that route to everybody at once. Check the pricing card for the route you
are about to flip before you flip it — and now also check whether a sub-key would express the
boundary, because the mechanism exists and nothing has used it for a tier yet.

**When a bullet MOVES BETWEEN TIERS, this file changes and no code does.** Severity is keyed to
the tier a claim is sold in, so `PLANS[]` is an input here on the same footing as the registry.
Four things to redo after any edit to it:

1. **The per-card table** under "Where things stand".
2. **The severity of every claim that moved.**
3. **§4 in both directions.** Not only "does this claim have code?" but "does this code have a
   claim, and is it in the right tier?"
4. **The `PLANS[]` ↔ `PLAN_ADDS` diff.** They are hand-maintained by design and have already
   drifted by two bullets. An edit to one belongs in the same commit as the edit to the other.

---

**Revision log,** because this file reads differently after each pass.

**2026-08-12**, in order: the pricing re-rank (three cards reordered, permissions to Free,
profile pictures to Plus, four reach features to Premium), then seven status flips. The first
changed what is *claimed*; the second changed what is *true*.

**2026-08-13**: tier enforcement landed (`lib/features.ts` gained a required `tier`,
`families.tier`, `requireView` → `/upgrade`), the family tree became real and lost its beta
badge, and `/direct-lineage` was **deleted** rather than shipped.

**2026-08-14**: the Proposed section, with three entries — the emergency check-in, records and
images on the tree, and importing a tree from ancestry.com. None is scheduled and none moves a
count.

**2026-08-19: re-derived end to end.** Nine registry entries added rather than flipped
(Gatherings ×2, `/calendar`, `/updates`, `/dues-projections`, and My Summary's three panes
promoted to routes), two relit (`/admin/chapters`, `/admin/boardpositions`), and the counts moved
further in six days than in the whole history before. Five decisions closed, two new ones opened
(Gatherings' tier and marketing; the Coming Soon link list), and one reopened with a mechanism
nobody had accounted for (registering `family-tree` diverges local from hosted). The uncased-
action figure was re-derived from ~85-across-the-gated-set to **202 across the tree, almost all
behind live routes**. The three proposals gained dated notes rather than rewrites: one of their
prerequisites got a mechanism (region derivation), one of their named defects was fixed
(`createAnnouncement`'s `chapter_id`), and their common blocker — the storage rework — did not
move at all.

**And the finding this pass exists for**: the product replaced `/direct-lineage` with something
better and left six strings on the marketing site selling the old thing. That is a class of gap
this file had no row for, because every previous row was a promise waiting on code. It is now
the first row in the register.

**2026-08-19, later — the pass that ACTED rather than recording.** Six directives, and what each
cost:

* **The `/direct-lineage` copy sweep is done.** Six strings on two marketing files now say
  Family Tree. Not "Bloodline" — that is an in-canvas control, not a thing to sell. The beta
  pill was checked and there was nothing to remove; it came off on 2026-08-13.
* **`/direct-lineage` has no row anywhere in this file as a future feature**, by instruction. The
  blocking register is empty for the first time.
* **The family-wide tree is Free** — it already was, and the decision is now recorded.
* **`family-tree` is a registered permission resource** (`20260819000008`), gated on its own key,
  with the person panel following the DIRECTORY's grant instead. Decision 5, closed.
* **Gatherings, the calendar, the updates archive and family removal are Free**; **fund transfers
  and board positions are Plus.** Fund transfers needed the sub-key mechanism built, which is
  decision 11 and the first tier boundary in the product that runs through a page rather than
  around one.

**Two things about this pass a reader should know.** It ran alongside another session that was
mid-way through RETIRING the Events product — `20260819000006`, four routes and their actions and
components deleted, `lib/features.ts`, `lib/plans.ts`, `lib/help/content.ts`, `Sidebar` and
`components/marketing/pillars.ts` all modified in the working tree. Every count above was
re-derived against that state.
>
> **THAT RETIREMENT HAS SINCE LANDED IN FULL, and it went further than the state this pass
> measured:** `20260819000006` now drops all thirteen `event_*` tables, `funds.event_id`,
> `photo_collections.event_id`, `cancel_overdue_event_assignments()` and the `event_expenses`
> term in `fund_balance_cents()`, because no family is using the product and there were no
> records to protect. The registry counts above were re-measured afterwards and did not move —
> the four entries were already out of them. Every Events row in this file is marked struck or
> historical, and the marketing copy that sold RSVPs, head counts and day-of check-in went in
> the same commit. And the RLS suite could not be run cleanly: two
sessions seeding one local Postgres produced a duplicate-key failure in the fixture and then a
run with 205 failures spread across modules nobody had edited. `20260819000008` is verified by a
full-chain `db reset` and by direct SQL assertions against every claim it makes — the resource
row, both grants on all ten templates, and the absence of any map row or policy naming the key —
but the suite itself owes a re-run on an uncontended stack.
