# What the site promises and the product does not have

`lib/features.ts` is what a member can reach. `/pricing` and `/features` are what a visitor is
promised. **This file is the distance between the two, and nothing else.**

It is not a changelog and not a record of what shipped. A closed gap is deleted here rather
than struck through — the git history is where "it used to be broken" lives, and this file was
1,471 lines of epitaphs before 2026-08-22. Context survives only where it drives something
still missing forward: a decision nobody has made, a defect on running code, or an argument
that would otherwise be invented twice.

**Everything below was re-derived on 2026-08-22.** Re-derive rather than quote — the commands
are at the bottom.

---

## Where it stands

| | |
|---|---|
| `FEATURES[]` entries | **42** |
| `status: 'live'` | **41** |
| `status: 'future'` | **1** — `/admin`, the fail-closed catch-all, which is not a page |
| **Marketing claims with no code** | **7** — one on Plus, six on Premium |
| Live features named on no marketing surface | **0**, and gated: `npm run marketing:check` |

**The registry is effectively fully shipped.** For most of this file's life the interesting
question was *which built thing is still gated*; there is one entry left and it is a catch-all.
So the gap has inverted. What is left is (a) seven claims nobody has built, (b) obligations that
did not travel with the flips, and (c) two hand-written marketing surfaces no script can check.

**`/admin` stays `'future'` and is not a gap.** It is what an unregistered `admin/…` key
resolves through (`20260817000004`); deleting the row would open every future admin key rather
than tidy anything.

---

## 1. The seven claims with no code

**No route means no gate.** `proxy.ts` can only rewrite a path that is registered, so none of
these ever shows a Coming Soon screen — a visitor reads the bullet and there is nothing anywhere
that says "not yet". That is why these seven are the most exposed items in the product, and why
this section is first.

| Claim | Tier | Where it is sold | What it actually needs |
|---|---|---|---|
| **Card, debit, PayPal, Apple Pay, Google Pay, Cash App** | Plus | Bullet 1 of the `featured` card, and `PLAN_ADDS.plus[0]` | Provider decided: Stripe, **Model C** ([payment_info.md](payment_info.md)). Two decisions remain — the platform fee, and what legal entity a "family" is (§5 there). |
| **Automatic dues reminders** | Premium | `PLANS[]`, `PLAN_ADDS` | The hard half is built. A scheduler and a sender. |
| **Push notifications, web and mobile** | Premium | same | No code. Two design questions below. |
| **Apps for iPhone and Android** | Premium | same | The largest single item in the product; it leaves the web app entirely. |
| **Email distributions from membership** | Premium | same | `lib/email/` sends one recipient at a time. Read its open-relay rule first. |
| **The public family website that builds itself** | Premium | same | Three decisions before a line of code. |
| **A per-family public address** | Premium | same | Wildcard subdomain and certificate provisioning for `yourfamily.genorra.com`. |

### Reminders is the cheapest of the six, and its hard half is done

`/reporting/dues-projections` already computes, per approved person, what is owed and whether
they are Active, Invited or Pending Invite. `duesPlanMath` in `lib/dues-utils.ts` computes what
the NEXT installment has to be, arrears included, as a pure function taking `today` as a
parameter and unit-tested under `npm test`. So *what to remind whom about* is built and checked.
What is missing is a scheduler and a sender — and **the sender has to read `lib/email/`'s rule
first**: never export a sender from a `'use server'` file, because everything exported from one
gets a URL, and a `sendEmail` export is an open relay carrying our SPF and DKIM.

### Push has two questions that are not engineering

* **The bell is CROSS-FAMILY and nothing else in the product is.**
  `getPendingApprovalQueues()` deliberately reaches past the active family, because an
  administrator of two families sitting in the first has to be able to learn that somebody is
  waiting in the second. A push design has to decide that question rather than inherit the
  per-family answer by accident.
* **Realtime delivery is publication membership, and nothing in the repo can see it.** A
  `postgres_changes` subscription still reports `SUBSCRIBED` against a table that is not in
  `supabase_realtime`, and simply receives nothing. Two tables are published today
  (`20260821000002`); anything new that subscribes owes its own line in a migration, and
  `npm run realtime:check` is the only thing that can prove it works.

### The website half: three decisions, then build the renderer last

1. **Decide the publish / opt-in model.** Nothing in the permission system can express "visible
   to the world", and a public surface over family data inverts *"One family cannot see another.
   Ever."* — which is published on four surfaces. A design decision, not a build task, and the
   one that gates the other two.
2. **Decide what a REMOVED family's address serves.** `families.status` is a soft disable
   (`20260817000006`): no row is deleted and a restore brings everything back. "The last thing it
   rendered" is not an acceptable answer. This is a question the removal feature created and the
   website inherits.
3. **`app/(auth)/register/page.tsx` currently says the opposite,** in as many words: *"There is
   no public profile and nothing is shared outside the family you join."* That sentence changes
   in the same commit as the first public page, or the product contradicts itself at the moment
   somebody signs up.

Then build the renderer. It is the only part that cannot start before those three.

---

## 2. Decisions nobody has made

Each one has a built feature or a published claim sitting on the wrong side of it. These are
product calls, not engineering work.

1. **Profile pictures are sold as Standard and ship free to everybody.** `AvatarUpload` is on
   `/personal-info`, which is Free and has no `permission_resources` row at all
   (`20260806000006` removed it deliberately, so a member's own things cannot be restricted). So
   this is a capability to **withdraw**, and three calls come with it: whether families already
   using it are grandfathered, what happens to the pictures already uploaded, and where the check
   goes. The mechanism is a sub-key with its own `FEATURES` row — a well-worn device now rather
   than a proposal (`gatherings/budget`, `admin/members/templates`,
   `accounting/transactions/fund-transfers`). **Settle it before `TIER_IS_SOLD` flips**: a paid
   bullet a free family already has is the one error on a pricing page a reader can catch by
   themselves.

2. **The Coming Soon screen offers every member all 41 live routes**, unfiltered by permission or
   tier — every administrator screen and every Plus one included. The fix is to resolve the
   caller's viewable set the way the sidebar already does, and gate the fetch (§5). **Its urgency
   dropped rather than its correctness:** with one `'future'` entry left, and that one a
   catch-all, almost nobody reaches the screen. The product call underneath is whether it should
   list anything at all.

3. **The Dashboard's money band is Free while the whole ledger is Standard.** `/dashboard` still
   renders `FamilyDuesCollectedCard` and `DonationDrivesCard`. A family that has only ever been
   Free can record no payment, so there is nothing to leak; the real case is a family that
   **downgrades** — it keeps every row, as it must, and its dashboard goes on printing a collected
   total for a ledger nobody can open. Two ways to settle it: a sub-key for the dashboard's money
   band, or the decision that a family's own headline total is Free on purpose, in which case say
   so on the card. **Do not settle it by tier-checking the dashboard action**: `/dashboard` has no
   permission row, and giving it one to hide a figure would make the landing screen restrictable,
   which is a much larger change than the one being made.

4. **Bylaws text extraction from PDF and Word is not built.** The table, the GIN index and the
   search are real; plain-text uploads are searchable word by word, and a PDF is searchable by
   title, article and summary only. Every row carries a badge saying which it is, and the
   empty-result state says it too — that is the part this scaffolding must not lose, because "no
   result" and "not indexed" are different facts and a reader who cannot tell them apart
   concludes the bylaws do not say a thing they do say. `bylaws.content_text` is already inside
   the generated `search_vector`, so turning extraction on writes one column: no migration, no
   reindex.

5. **The Gatherings pillar is `tier: 'free'` and five of its six bullets describe Standard
   capabilities.** Templates, assigned steps, the budget and the review loop are all Standard;
   only the calendar half is Free. The tier tag and the Coming Soon pill on `/features` are both
   per CARD, so no badge can express this, and `npm run marketing:check` says in its own header
   that it cannot see it either. It is disclosed today by the paragraph under the pillars naming
   what each tier covers. The alternatives are a fourth pillar or per-bullet tier tags, and both
   are real work — the point of this entry is that the disclosure is currently one sentence a
   reader may not reach.

6. **`components/marketing/screenshots/events.png` is a capture of a screen that no longer
   exists** — the deleted `/events`, showing a multi-day itinerary with RSVP counts. It is shown
   on Home and on `/features` for the Gatherings pillar. A `Pillar` must have an `image` (a
   missing static import fails `next build`, which is the safe direction) and a screenshot cannot
   be re-captured from a script, so `imageAlt` is deliberately generic: naming RSVPs would
   advertise a feature we do not have, and naming tasks would describe the wrong image. **Do not
   make that alt specific until the PNG is replaced.** Open `/gatherings/<id>` on a seeded family
   and capture at the same width as the other two.

---

## 3. Debts on live code

A flip is not the whole job, and what it leaves behind is invisible: nothing fails and nothing
warns, and the obligation quietly changes from "before launch" to "on running code". With 41 of
42 routes live, that is what this section is.

### Bylaws has no fixture and no RLS case, and the whole table is uncovered

`bylaws` shipped on 2026-08-22 and `tests/rls/seed.mjs` plants no row in it — the table is not
in the fixture's reset list either, so a row seeded later would accumulate across runs. `grep
bylaw tests/rls/cases.mjs` returns nothing. Five actions (`getBylaws`, `getBylawRights`,
`addBylaw`, `deleteBylaw`, `getBylawDownloadUrl`) rely entirely on reading the policy rather
than running it, which is exactly what §7 says is not the same thing.

It is worth doing as one piece of work rather than per action, because the cost is the fixture:
one row per family, its entry in the reset list in the right cascade order, and then the cases
are cheap. `documents.getDocumentDownloadUrl` in `STORAGE_CASES` is the nearest shape to copy
— including its `setup: seedObject(...)`, without which `createSignedUrl` has nothing to sign
and the positive control passes vacuously.

### 163 server actions have no RLS case

253 functions are exported from `app/actions/`; `tests/rls/cases.mjs` names 90 of them. Read
that as the real backlog rather than a target — §7's suite is what tests family isolation,
because the policies are *composed* at migration time out of `pg_policies`, so what protects a
table is a string that existed in no file anyone reviewed.

Two things about the shape of it, both of which change what a case is worth writing:

* **A write narrowed by hand hides its own policy.** Where an action states a filter that
  duplicates a conjunct of the policy underneath it, no action-shaped case can test that
  conjunct — measured twice, both times with the conjunct deleted and the suite still green.
  Those belong in `tests/rls/raw/`.
* **Every child table under a scoped parent owes a `raw/` SELECT probe.** A read filtered by ids
  the parent returned is narrowed for free, so the child's own policy is never consulted:
  `getJournalEntries` proved it, with 43 assertions staying green and the notes policy gutted.

### Storage: reads are still open, and nothing resizes

The write half is closed — `avatars` is folder-scoped to its owner (`20260820000002`), `photos`
and `documents` are family-folder-scoped (`20260820000006`), `event-photos` is dropped, bucket
and bytes (`20260820000008`), and `tests/rls/raw/storage.mjs` exists and found three holes on
its first run. What is left:

* **`avatars` and `photos` are `public: true`**, so any object in either is readable by URL by
  anybody holding the URL, signed in or not. Narrowing that is a product decision with a real
  cost — every avatar would need a signed URL per render.
* **`documents` has no mime allow-list**, unlike both image buckets.
* **Nothing in the upload or the render path resizes anything.** Zero hits for a resize in
  either: a phone photograph is stored as handed over and rendered into a 200px square. TODO.md
  carries the decision and its three options; it is an infrastructure call, not a code change.
* **`components/ui/Avatar.tsx` carries a bare `eslint-disable-next-line
  @next/next/no-img-element` with no stated reason** — and it is the most expensive instance in
  the tree, not a marginal one: it renders at 28–80px, downloads whatever the camera produced,
  and is drawn **per row** by both the Directory and the tree, so one pageview of a 140-person
  family fetches 140 originals. `CollectionCard` states its reason at length; this one should
  too, or the comment should come off. A bare disable on the highest-traffic instance of an open
  decision is how the decision stops being made.

### `person_relationships.is_step` is superseded and not dropped

`link_kind` (`20260813000007`) is the one definition of blood, step, adopted and foster.
`is_step` predates it, is written by nothing, and two columns describing one fact is how they
come to disagree. TODO.md carries the drop.

---

## 4. The marketing surfaces: what derives, and what cannot

Three surfaces make claims, and they fail in different ways.

| Surface | Derived from the registry? |
|---|---|
| Landing `FeatureShowcase` — 3 pillar cards | Coming Soon pill, per card |
| `/features` — 3 pillars + 28 cards | Coming Soon pill AND tier tag, per card. No hand-set escape hatch left |
| `/pricing` — `PLANS[]` | **Nothing.** Every bullet is prose typed by hand |

### The catalogue is gated now: `npm run marketing:check`, a step in `verify.yml`

It asserts that every live feature is named on `/features` — a `route:` in `PILLARS` or in the
`ALSO` grid, or an entry in the script's `SOLD_ELSEWHERE` list giving the surface that sells it
instead. It also refuses a card pointing at a route the registry does not have (`getFeature()`
longest-prefix-matches, so a renamed route does not fail — it silently prints the nearest
parent's tier), a route claimed by two cards, and a stale allowance in either direction.

It exists because this had gone wrong twice at scale, in the same direction each time: a feature
ships, the registry gains a row, and the catalogue does not. The grid was checked by hand against
a 34-entry registry, the registry reached 42 two days later, and eleven live screens were named
nowhere — including three whole sections. **A hand-remembered inventory rots exactly as fast as
the hand-typed tier tag that grid's own header already warned about.**

**What it cannot assert**, and the first is why §1 and §2 exist at all:

* **The pricing cards.** A pricing bullet is prose about a BENEFIT: one bullet spans several
  routes, several routes are sold in no bullet at all, and the words a buyer needs are not the
  words a member needs. That is why `lib/plans.ts` refuses to derive itself from `PLANS[]`, and
  why neither may be derived from the registry. Those stay a judgement, and this file is where
  their gaps live.
* **That the prose is true**, or that a card describes the screen it names. Nothing can.
* **That a pillar's bullets sit at the pillar's tier.** Decision 5 above.

### `PLANS[]` and `PLAN_ADDS` are two hand-written lists, and they have drifted twice

`PLANS[]` on `/pricing` is what a BUYER reads; `PLAN_ADDS` in `lib/plans.ts` is what a MEMBER
reads on `/admin/settings` and `/upgrade`. Neither may be derived from the other — that argument
is sound and is stated in both files — and the cost is real and has been paid twice: a Premium
bullet went missing in-product, so a family on Premium was never told inside the product that the
address comes with the website; and a false detail ("the family's size over time", which nothing
in this product records) survived on both after `/features` had corrected it.

**So an edit to either belongs in the same commit as the edit to the other.** There is no gate and
there cannot be one. Four things to redo after any edit to `PLANS[]`:

1. The severity of every claim that moved. Severity here is keyed to the tier a claim is sold in,
   so `PLANS[]` is an input to this file on the same footing as the registry.
2. §1 in both directions: not only "does this claim have code?" but "does this code have a claim,
   and is it in the right tier?"
3. The `PLANS[]` ↔ `PLAN_ADDS` diff.
4. Whether a ROUTE has to move with the bullet. `grep "tier: '" lib/features.ts` is the whole job.

### A RETIRED route is invisible to every derived badge

The one registry movement nothing can see. A flip corrects both marketing surfaces
automatically; a **deletion** corrects neither — `proxy.ts` cannot gate what is not there,
`isFeatureFuture()` answers `false` because `getFeature()` finds nothing, and the pill simply
comes off. `/direct-lineage` was deleted and went on being sold by name in six places on two
files for six days. `/admin/announcements` was retired the same day and cost nothing only
because no surface had ever named it: luck, not process.

**So a retired route owes a copy sweep in the same commit:**

```bash
grep -rni "<the retired route, and the WORDS it was sold in>" \
  "app/(marketing)" components/marketing lib/plans.ts app/page.tsx
```

`marketing:check` catches the other half — a card still pointing at the dead route — but it
cannot see prose.

---

## 5. Proposed — no claim, and no code

The third shape, which the register above cannot hold: a feature nobody has promised and nobody
has built has no bullet to be counted against and no registry entry to be gated. **Nothing here
is scheduled.** It is here so each design is argued once rather than invented twice, and so the
decisions underneath are explicit *before* somebody writes the screen and discovers them.

### Emergency check-in — asking the relatives in one area whether they are safe

A hurricane crosses the Gulf coast. Somebody with the right grant raises a check-in addressed to
the relatives who live there; everybody addressed is asked one question — *are you safe?* — and
answers with one tap. Whoever raised it watches a roster fill in: safe, needs help, not answered.

**The unanswered column is the product.** The other two are only how it gets shorter, and that
governs every decision below: this would be the first capability in GENORRA whose value is
entirely in the response *rate* rather than in the record.

1. **Reaching people is the whole feature, and the product cannot do it yet.** The bell needs an
   open tab, and `IdleTimeout` signs a member out after 60 idle minutes — so the one channel
   that exists is the one a disaster guarantees is closed. Email is the fallback and it **fails
   soft by design**, which is right for an approval and wrong here: a caller must never render
   *"everyone has been asked"* over mail that did not go (`inviteMember` is the pattern for
   saying so honestly). **So this is downstream of a Premium bullet with no code** (push) or of
   SMS, which is in no plan at all. Decide the channel before anybody designs the screen; a
   check-in nobody receives is worse than none, because it is believed.
2. **An area is not a chapter, and neither answer works alone.** A chapter is how a family
   *organised* itself; a disaster addresses where people *are*. Self-reported city and state are
   closer to the truth and stale by an unknown amount. All three — chapter, geography,
   hand-picked names — must resolve to **one explicit roster at raise time**, and the roster is
   then the list rather than the rule that built it. Anything else silently drops the relative
   who moved, who is the person most likely to be in the wrong place. `lib/chapter-places.ts`
   already derives a member's region on the admin client, so that half is a function call.
3. **A record cannot answer, and must not read as unanswered.** A recorded grandmother is in the
   family, on the tree and in the Directory, has a generated placeholder address and no account.
   The roster owes a third state — *no way to reach them* — sitting apart from "not answered".
   Leaving her in the unanswered column turns the one number this feature exists to drive to
   zero into a number that cannot reach zero.
4. **Two different gates, and the second is the abuse case.** Raising is family-wide with no
   coherent "own" version, so `canAny` — a false alarm to the whole family at 3 a.m. is exactly
   what the grant exists to prevent. **Answering is self-service**: `requireMember()`, the
   caller's own row, the `submitGatheringTask` shape (refuse an approved one; write a NEW
   submission rather than editing the refused one), with every client id checked by
   `belongsToFamily` first. Note what that rules out: an *"I spoke to her, she's fine"* button.
   It is the most requested feature in every system of this kind and it is a write to somebody
   else's row.
5. **A completed check-in is the sharpest PII this product would hold** — a list of relatives,
   where they live, and which are unreachable, assembled at the moment it is most useful to
   somebody else. Its own resource key with a **restricted** `resource_visibility` backfill (§6)
   rather than the `everyone`-for-view default, and a retention answer, because an answered
   check-in from three years ago is a location history nobody agreed to keep.
6. **The colour does not exist yet, and it is not `--destructive`.** That token owns errors and
   deletions, `FormError` owns reporting a failure, and `--brand-withheld` is a capability going
   away. An emergency banner is none of the three. It needs a role added to `app/globals.css`
   first, with an `on-` partner checked against AA in both themes.

**Which tier is genuinely undecided.** Free's premise is *"get your whole family in one place.
All of them"*, and safety is a poor thing to sell back to a family; Plus is where coordination
sits; Premium is where *reach* is sold, and this cannot work without push or SMS. **The
dependency argues Premium and the ethics argue Free.**

**One defect it must not inherit.** Any audience mechanism it reuses: `announcements.scope`
filters `chapter` only, and `addressedTo` documents "National and regional reach everybody" as
deliberate. Defensible for an announcement and bad for a check-in — and region derivation now
exists, so the cost of narrowing it is small. Decide it there before building on it.

**At build time** it owes: a `FEATURES` entry with a stated `tier`; `permission_resources` rows
in a new migration *and* in the `20260618000000` seed, with the restricted visibility backfill;
at most two actions, and only ones something reads; a case per action in `cases.mjs` including a
pending-member attacker, then broken on purpose and re-run; a grep for bare `people` embeds if
the audience lands as a junction table; a real `<table>` with `COLLAPSING_CELL` and no `min-w`
floor, because **a phone is the device this is used on**; and a list built for 150.

### Records, sources and images on the tree — the ancestry half GENORRA does not have

Today a person on the tree is a name, a gender, two dates and a set of edges. What a family
doing genealogy accumulates is *evidence*: a scan of a birth certificate, an obituary clipping,
a photograph of a headstone, a paragraph somebody's aunt wrote down before she died. Ancestry's
whole model is that a **fact** is backed by a **source**, and this product has neither noun.

**The tree is where this belongs, and that is the first decision.** The lazy reading is "let a
document be tagged with a person", and it is not the same thing: a document in a shared folder
is filed by the family, and a source on a person is filed by the CLAIM it supports. The
difference shows up the moment two members disagree about a birth date and only one of them has
the certificate.

1. **A fact is not a column, and this is the fork the whole design turns on.** `people` holds
   ONE birth date. A genealogy holds "born 4 July 1908 (per the county register)" beside "born
   1907 (per the 1910 census)", unresolved, both cited, because that is the state of the
   evidence. Modelling facts as rows makes the tree honest and makes `people.date_of_birth` a
   *derived preferred value* — a change to `disambiguatedName`, `isMinorOn`, `ageShareOfPeriod`
   and every screen that reads a birthday. Modelling them as columns keeps all that and cannot
   record a disagreement. **Decide before anybody writes a table**; the two shapes are not
   migrations apart.
2. **Uploading evidence about a LIVING member is not the same act as about a dead one**, and
   §4b's line does not cut here. `editPersonRecord` is bounded by "no `user_id`", which is clean
   for correcting a spelling and poor for attaching a document: a marriage certificate is about
   two people, at least one of whom probably holds an account and did not upload it. The
   workable shape is that a record is attached by whoever holds it and is **visible to its
   subjects**, with a way for a subject to object that is not "ask an administrator to delete
   the family's history".
3. **This is the sharpest PII the product would hold, by a distance.** A birth certificate scan
   carries a full name, a date, a place and usually a mother's maiden name — the standard set of
   banking security answers, assembled for a hundred and forty relatives. Its own resource key
   with a **restricted** visibility backfill, and a retention answer: a family that leaves
   GENORRA leaves this behind.
4. **Two tables joining `people` is two chances at PGRST201, and one of them is not on this
   feature.** A `person_records` table with `person_id` and `uploaded_by` has two foreign keys
   to `people`, so every embed of it needs qualifying — and adding it makes PostgREST report a
   NEW many-to-many path between `people` and whatever else it joins, which breaks **bare embeds
   on tables nobody touched**. That is the `announcement_unpins` lesson. Grep after, not before.
5. **Storage is the gate and it is not this feature's to open.** Scans are larger than avatars
   and are read rarely, which is a different access pattern from anything the current buckets
   serve — and §3's read question and resize decision are both still open.
6. **A rule for what happens to a record when its subject is detached from the tree.**
   `removeRelationship` deletes the EDGE and never the person; this needs the same care stated
   out loud.

**Premium**, and unusually not a close call: it is storage-heavy, it is the capability that
distinguishes a family directory from a genealogy, and Free's premise is about the living.

### Importing a tree from ancestry.com

A family that has spent years on ancestry.com has the tree; what they do not have is their
relatives inside GENORRA. **This is the largest single thing in this file, and most of its
weight is not the parsing.**

1. **Ancestry's GEDCOM is lossy in exactly the places the previous proposal cares about.**
   Names, dates, places and relationships come across; media and source citations largely do
   not. So an import populates the *tree* and not the *evidence* — **these two proposals are
   independent**, and it is worth saying so before somebody sequences them as one project.
2. **An import must not email anybody, and that is a hard constraint.** A real family's GEDCOM
   is hundreds of individuals; `inviteMember` sends on the spot and `sendEmail` fails soft, so a
   loop over it produces hundreds of messages, some silently undelivered, none reviewed. The
   import creates **records** — `addRelative`'s `record` mode — and invitations are a second,
   per-person, human act afterwards. Five doors into the approvals queue are enumerated in
   AGENTS.md; an import must not become a sixth by accident.
3. **Ancestry redacts living people by default**, which is why the point above is easy to get
   wrong. Exporting *with* them hands over names, birth dates and places for relatives who have
   never heard of GENORRA; exporting *without* them yields a tree of `Living Smith`
   placeholders. **Both need answering on the upload screen, in words, before a file is
   accepted.**
4. **Matching an imported individual to an existing member is a review step, never an
   inference.** A name-and-birthdate match is a *suggestion*. Auto-merging is unrecoverable — it
   would attach one person's dues, photo tags and permission template to another's record. A dry
   run reporting "142 new, 6 possible matches, 3 conflicts" that lands nothing until confirmed
   is the shape.
5. **`belongsToFamily` per id does not survive 2,000 individuals, and the answer is not to skip
   it.** §4 exists because a row stamped with the caller's own `family_code` satisfies every
   policy while pointing anywhere, and an import is that hazard at scale. Re-express the check
   as a set operation against one query, and **put a batch id on every row it creates**, so a
   bad import is one `DELETE` rather than an afternoon.
6. **GEDCOM's `PEDI` tag maps onto `link_kind`, and where it is absent the default is a claim.**
   `birth | adopted | foster | sealing` is very nearly `blood | adopted | foster`, which is a
   gift — but §4c is explicit that only a person knows whether a child edge is blood, and
   `link_kind` defaults to `'blood'`. An import that fills the default for every unlabelled
   `FAMC` asserts parentage for a whole family at once, and the Bloodline view will then answer
   confidently and wrongly. Either import unlabelled edges as blood **and say so on the review
   screen**, or introduce an "unstated" kind. Do not let the column default decide it.
7. **A server action is the wrong container.** Parsing, matching and writing a large GEDCOM does
   not fit a request, and `'use server'` exports carry the platform's time limit. It needs an
   upload, a job, and a page that can be left and come back to — none of which this product has.
   Gatherings' instantiation is the right *shape* to copy (a task is a COPY of its step, not a
   reference, with provenance allowed to go NULL) and solves none of the container problem.

**One defect it must not inherit.** `addRelative` writes its shared-parent edges
**best-effort**, deliberately, because a parent link that cannot be written must not lose the
relationship the member asked for. That is right for one addition and catastrophic for ten
thousand: an import that swallows failures produces a tree that is silently half-connected and
nobody can tell which half. **An import reports every row it could not write, or it is not
finished.**

**Premium**, following the proposal above: same customer, same storage work, and the strongest
single reason a family already invested in ancestry.com would move.

**At build time** it owes, beyond the usual `FEATURES` entry and permission rows: `canAny` (it is
family-wide configuration with no coherent "own" version); RLS cases with the bulk write as the
one that matters most, which a per-row fixture will not exercise; and pure parsing and matching
in `lib/` taking their inputs as arguments, tested with `npm test` — the GEDCOM date grammar
alone (`ABT 1908`, `BET 1900 AND 1910`, `4 JUL 1908`) is exactly the edge-case arithmetic that
runner exists for.

---

## Keeping this current

**Citations are quoted strings, not line numbers.** An early pass of this audit had eleven
citations off by a line or two, because the marketing files are edited continuously. Grep the
quote.

**Re-derive, do not quote.** Every figure above came from these:

```bash
grep -c "status: 'live',"   lib/features.ts          # 41
grep -c "status: 'future'," lib/features.ts          # 1
grep -c "^    href: '"      lib/features.ts          # 42

npm run marketing:check                              # every live feature is sold somewhere

# exported server actions, and how many tests/rls names
LC_ALL=C grep -rhoE "^export (async )?function [A-Za-z0-9_]+" app/actions/ | wc -l   # 253
LC_ALL=C grep -oE "id: '[^']+'" tests/rls/cases.mjs \
  | sed "s/id: '//;s/'\$//" | sed 's/ (.*//' | grep -v '^raw:' | sort -u | wc -l     # 90

grep -rn "no-img-element" components/ | wc -l                   # the resize decision
grep -c "bylaw" tests/rls/cases.mjs                             # 0 — see §3
```

**When a feature ships:** flip its `status`, and let the derived surfaces correct themselves.
Then check the two things no mechanism can: whether a `PLANS[]` bullet needs writing, and whether
`marketing:check` wants a card or an allowance. It will tell you which.

**When a route is RETIRED,** sweep the copy in the same commit — §4 has the grep and the reason.

**When a bullet moves between tiers,** this file changes and no code does. §4 has the four things
to redo.

**Delete a gap when it closes.** Do not strike it through, do not leave it as an epitaph, and do
not add a revision log. The one thing worth keeping from a closed gap is a *mechanism* that will
recur — and that belongs in the section it protects, not in a history at the bottom.
