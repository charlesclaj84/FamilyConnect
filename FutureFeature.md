# Future features — what the site promises, and what is still gated

The marketing site describes the product GENORRA is becoming. `lib/features.ts` describes
what a member can reach today. This file is the distance between the two, so the gap is
tracked rather than discovered.

**It is not a defect list.** The revamp is deliberate and every gated feature is already
built. What follows is a delivery order and, for each feature, the specific work that has to
land with the flip.

Generated 2026-08-12 from a six-agent audit of `lib/features.ts`, the eight marketing
surfaces, `PLANS[]`, and the storage migrations. Two independent verifiers corrected the
first pass; their corrections are folded in.

---

## Where things stand

| | Count |
|---|---|
| `FEATURES[]` entries | 27 |
| `status: 'live'` | 10 |
| `status: 'future'` | 17 |
| **Gated features already built** | **17 of 17** |
| Marketing claims with no code at all | 5 |
| Marketing claims resolving to a gated feature | 22 |

**Nothing in the registry is unbuilt.** Every gated route has its page, its client and its
server actions in the repo — `AdminEventDetailClient` is 1,361 lines, `FamilyTreeClient` 853,
`ancestors.ts` 1,014, `admin/events.ts` 1,078. `/admin/boardpositions` says so in its own
comment: *"shipping it again is this one word."* So the remaining work is a status flip plus
targeted fixes, not construction. That is the single most important fact in this document,
because it sets the size of everything below.

**Two mitigations already in place, worth knowing before reading the gap list:**

- **No public click path into Coming Soon.** The marketing site links no gated route —
  `ACCOUNT_ROUTES` is exactly `{ login, register }`. A visitor cannot walk from a promise into
  a wall; only a signed-in member can, from the sidebar.
- **The sidebar removes gated items rather than badging them,** and drops a whole section when
  it empties. So Events and Resources are currently absent from the nav entirely. A member
  does not see a teased door — they see no door. (Side effect: the header comment in
  `lib/features.ts` still describes "Soon badges in the sidebar", which is stale.)

### How the gate works

`proxy.ts` *rewrites* — not redirects — any gated path to `/coming-soon`, which names the
feature from its `blurb` and lists the live ones as "Available now". Nested paths inherit
their parent entry's status. **An unregistered path is not gated**, which is why the five
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

### Free — 6 blocking gaps

| # | Ship | Why here |
|---|---|---|
| 0 | **Storage rework** | Not a feature, but it gates `/photos`, `/documents` and `/events`, and it is the only item that touches a **live** page (avatar upload on `/personal-info`). Long pole; three features queue behind it. Start first. |
| 1 | `/family-tree` + `/direct-lineage` | Ship together. Two one-word flips closing the largest single Free promise, plus the SEO description, a landing spotlight, a features pillar, the footer, the default `CtaBand` lede and both auth pages. Blocked on a decision, not a migration — see below. |
| 2 | `/announcements` + `/admin/announcements` | Ship together: pinning is half the Free promise and lives only in the admin route. **The flip must include a `Sidebar.tsx` `adminItems` entry** or it surfaces nowhere. |
| 3 | `/events` + `/admin/events` + `/admin/event-types` | Ship together — Free's "put the reunion on the calendar" cannot work without the admin route that creates the event. Heaviest item in the repo. Do it last in Free because everything else here is cheap and this is not. |

### Plus — 7 high gaps, then one build

| # | Ship | Why here |
|---|---|---|
| 1 | `/family-finances` | One-word flip. Resolves the sharpest inconsistency in the registry: its admin counterpart `/admin/account` is **already live**, so funds are configurable but their balances and the P&L are unreachable. Needs a restricted `resource_visibility` backfill in the same migration. |
| 2 | `/admin/boardpositions` | Cheapest item in the repo by its own comment, and a structural dependency of the elections claim. |
| 3 | `/elections` + `/admin/elections` | Immediately after board positions — the roster feeds the ballot. `BallotForm` needs `disambiguatedName` + search **first** (AGENTS.md names it). Its "launch announcement goes out automatically" sub-claim needs `/announcements`, already shipped in Free. |
| 4 | `/documents` | Gated on the storage rework, and it is the worst bucket. Also `documents.ts` returns `getPublicUrl` for a **private** bucket, so downloads cannot work at all. |
| 5 | `/photos` | Same storage rework, plus three defects of its own — see the register. |
| 6 | `/admin/chapters` | Flip plus deleting the dead duplicate client. Also unblocks the dashboard's `ChapterReminderBanner`. |
| 7 | `/admin/reports` | Flip **last**: RSVP turnout and t-shirt counts are event data, so two of its four advertised columns stay empty until `/events` has shipped and collected some. |
| 8 | **Payment processing** | The only Plus item that is a build, not a flip. Needs a provider and a fee decision before a route exists. **It is also the one claim with no gate at all** — so it must not be the thing left outstanding when `PRICING_IS_ANNOUNCED` flips. |

### Premium — nothing can start yet

1. **Ship `/events`, `/photos` and `/announcements` first.** Not prerequisites in a loose
   sense — they *are* the content the public site renders. Premium has nothing to show until
   all three exist.
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
4. **Where do child management and convert-to-adult sit?** Note the answer *cannot be
   enforced by a grant* — `/direct-lineage` has no permission row by design.
5. **Does the `/admin` hub survive?** Nothing links to it, `Sidebar` has no `/admin` item, it
   gates on the wrong key, it has no permission row, and two of its three tiles point at
   gated routes.
6. **Trusted Vendors** — directory, marketplace, or discount list? No code exists.

---

## Gap register

Grouped by feature, because the question this answers is "what does shipping X close?"

### Blocking — sold in Free

| Feature | Route | Claims | Shipping it requires |
|---|---|---|---|
| Family tree — multi-generation, spouses, children, ancestors | `/family-tree` | 15 | Flip + the no-permission-row decision |
| My Children — add, manage, convert to adult members | `/direct-lineage` | 4 | Flip + same decision; also a silent-success no-op write |
| Announcements — family-wide news pinned to the dashboard | `/announcements` | 8 | Flip + `resource_visibility` backfill |
| Announcement management — post and pin | `/admin/announcements` | 3 | Flip + **a `Sidebar.tsx` entry**, or it surfaces nowhere |
| Events — shared event page, itineraries, hotel blocks, RSVPs | `/events` | 19 | Flip + storage rework (event-photos) + sub-keys + RLS cases |
| Event management — build events, assign the checklist, day-of check-in | `/admin/events` | 7 | Flip + **33 uncased actions behind one key** + sub-keys per rail item |

### High — paid-tier headlines

| Feature | Route | Tier | Claims | Notes |
|---|---|---|---|---|
| Family finances — fund balances, P&L | `/family-finances` | Plus | 12 | Admin counterpart already live. **The dues half ships today** (`/transactions`, `/account-summary`, dues schedules under `/admin/account`) — only balances and the P&L are gated, so do not attribute the whole "dues and fund accounting" claim here. |
| Photos — galleries, captions, tagging | `/photos` | Plus | 11 | Storage rework + a **live `PGRST201`** that makes every gallery render empty + `deletePhoto` trusting a client-supplied path + the hand-rolled tag search that `/features` explicitly sells |
| Documents — bylaws, forms, minutes | `/documents` | Plus | 7 | Worst bucket; `getPublicUrl` against a private bucket |
| Elections — nominate, accept/decline, vote | `/elections` | Plus | 6 | `BallotForm` member-picker defect must land with it |
| Election management | `/admin/elections` | Plus | 3 | After board positions |
| Regions & chapters | `/admin/chapters` | Plus | 5 | Delete the dead duplicate client |
| Leadership reports | `/admin/reports` | Plus | 6 | Two of four columns need `/events` data first |
| **Payment processing** — card, debit, PayPal, Apple Pay, Google Pay, Cash App | **none** | Plus | 6 | **No route, so `proxy.ts` cannot gate it and Coming Soon never appears.** The most exposed claim in this file. |
| **The public family website that builds itself** | **none** | Premium | 6 | No route, no entry, no code |
| **Per-family public address** | **none** | Premium | 3 | No route, no config, no code |

### Medium / low

| Feature | Route | Claims |
|---|---|---|
| Board positions | `/admin/boardpositions` | 4 |
| Event templates | `/admin/event-types` | 1 |
| Event planning — assigned tasks with deadlines | `/event-planning` | 3 |
| Untiered event sub-capabilities (hotel blocks, nested itineraries, per-event budgets) | `/admin/events` | 4 |
| Trusted vendors | none | 2 |
| Family stories and traditions as a first-class thing | none | 2 |

---

## Supporting work

### 1. Storage rework — the long pole

Four buckets, **15 policies**, and the shape is wrong in three ways. This is the checklist for
the rework, not an incident report: the features these buckets serve are all gated, so nothing
is exposed today except the avatar path.

| Bucket | `public` | Effect today |
|---|---|---|
| `avatars` | `true` | World-readable by URL |
| `event-photos` | `true` | World-readable by URL |
| `photos` | `true` | World-readable by URL |
| `documents` | `false` | Any signed-in user of **any** family can read, overwrite, delete and enumerate |

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
the object path from the client.

**And `tests/rls` does not cover storage at all.** A storage test harness is part of this item,
not a follow-up — without it the rework's correctness is unverified, and this is the one area
of the schema with no attacker case anywhere.

> The claim *"One family cannot see another. Ever."* is published on four surfaces and is
> currently true of every table and false of storage. This rework is what makes an
> already-published promise true, which is why it sits at position zero.

### 2. Per-feature launch obligations

Each gated feature owes these at flip time. AGENTS.md requires them; they are listed here so
"flip the status" is never mistaken for the whole job.

- **~85 uncased server actions** across the gated set. §7 requires a case per action, with a
  real attacker *and* a positive control.
- **`resource_visibility` backfill** for the 7 non-admin gated keys (§6): `/family-finances`,
  `/documents`, `/announcements`, `/events`, `/event-planning`, `/photos`, `/elections`.
  Without it a resource falls back to `everyone` for view and nothing else.
- **An `actions` audit** on all 14 gated `permission_resources` rows — §6 says never declare an
  action nothing reads.
- **Sub-keys per rail item** for pages that divide into jobs. `admin/events` has 33 actions
  behind one key, which cannot express "record an RSVP but do not delete the event".
- **Replace the two hand-rolled member pickers** with `PersonMultiSelect` — `BallotForm` and
  `PhotoCollectionGallery`, both named in AGENTS.md's known-gaps list. Each lands with its
  feature.

### 3. Registry inconsistencies to resolve

- `/family-finances` gated while `/admin/account` is live — funds configurable, balances
  unreachable.
- `/admin` gated while three of its children are live; it gates on the wrong key and has no
  permission row.
- `/admin/announcements` is built and permissioned but absent from the sidebar.
- `/direct-lineage` and `/family-tree` have no permission row by design, so shipping them
  ships them to everyone with no switch.
- The Coming Soon screen offers every member three administrator links they cannot use.
- `AdminChaptersClient.tsx` (220 lines) is orphaned dead code duplicating the chapters client
  actually in use.
- The protected layout queries gated event-planning data on every request.
- `cancel_overdue_event_assignments` holds an `authenticated` EXECUTE grant nothing needs.

### 4. Two claims that are LIVE but sold as unreleased

Decide before `PRICING_IS_ANNOUNCED` flips — these are the mirror image of everything else
here, and they cost revenue rather than trust.

---

## Already true

So this file is not only a list of failures. The site accurately claims, and a member can
reach today: the member directory, family chat, dues plans and the contribution ledger, the
four transaction ledgers, `My Summary`, Members & Access with permission templates, member
approvals, and Accounting — dues schedules, funds and payment routing.

`FeatureShowcase` also already badges honestly: all **3 of 3** spotlights and **7 of 8**
mini-cards carry a Coming Soon pill derived from `isFeatureFuture()`, so the landing page is
the one surface that tells the truth automatically. Note the limit — `isComingSoon` is
evaluated per spotlight, not per bullet, so a badged spotlight can still contain a bullet
describing something live and vice versa.

`/features` has **no** badging mechanism and asserts in its own header that it needs none. It
is therefore the surface that will silently misrepresent every flip above.

---

## Keeping this current

**Citations here are quoted strings, not line numbers.** The first pass of this audit had
seven citations systematically off by two lines and four more off by one, because the
marketing files are edited continuously. Grep the quote.

Two figures are worth re-deriving rather than trusting when you next read this: the
uncased-action count (~85) and the claim counts per feature. Both move every time copy or an
action lands.

When a feature ships: flip its `status` in `lib/features.ts`, tick its supporting-work items,
move its row from the gap register to **Already true**, and check whether `/features` now needs
a badge it does not have a mechanism for.
