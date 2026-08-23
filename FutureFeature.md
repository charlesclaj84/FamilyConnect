# What the site promises and the product does not have

`lib/features.ts` is what a member can reach. `/pricing` and `/features` are what a visitor is
promised. **This file is the distance between the two, and nothing else.**

It is not a changelog and not a record of what shipped. A closed gap is deleted here rather
than struck through — the git history is where "it used to be broken" lives, and this file was
1,471 lines of epitaphs before 2026-08-22. Context survives only where it drives something
still missing forward: a decision nobody has made, a defect on running code, or an argument
that would otherwise be invented twice.

**Everything below was re-derived on 2026-08-23.** Re-derive rather than quote — the commands
are at the bottom.

---

## Where it stands

| | |
|---|---|
| `FEATURES[]` entries | **45** |
| `status: 'live'` | **44** |
| `status: 'future'` | **1** — `/admin`, the fail-closed catch-all, which is not a page |
| **Marketing claims with no code** | **6** — one on Plus, five on Premium |
| Live features named on no marketing surface | **0**, and gated: `npm run marketing:check` |

**Premium is no longer an empty tier, and since 2026-08-23 it holds two routes.**
`/community/distributions` shipped on 2026-08-22 and was the first; `/community/safety-check-ins`
is the second. `lib/features.ts` said "NOTHING IS PREMIUM" until the first and "ONE ROUTE" until
the second.

**The seventh claim is the one to keep hold of, because it is a NEW SHAPE for this register:
a Premium bullet whose SCREEN is built and whose JUSTIFICATION is not.**
`/community/safety-check-ins` shipped Free on 2026-08-23 and moved to Premium the same day,
because the channel it is meant to run on is **SMS** — the ask arriving as a text message and the
answer coming back as one — and SMS is the only thing in this product that costs money on every
send. That is what Premium is for, and it is not built.

So the table below counts six claims with NO code, and this is a seventh with PARTIAL code. The
distinction matters in both directions:

* A family on Premium today can raise a check-in and watch a roster fill in. That works.
* What they cannot do is reach anybody by text, which is the reason the route is on their card
  rather than on the Free one. **Neither `PLANS[]` nor `PLAN_ADDS` mentions SMS**, deliberately —
  adding it would make this a seventh entry in the table below rather than a footnote to it, on
  the card whose five other bullets are already there.

§5 carries the design and the four decisions underneath it — the second of which is legal rather
than technical, and gates the rest.

**The registry is effectively fully shipped.** For most of this file's life the interesting
question was *which built thing is still gated*; there is one entry left and it is a catch-all.
So the gap has inverted. What is left is (a) six claims nobody has built, (b) obligations that
did not travel with the flips, and (c) two hand-written marketing surfaces no script can check.

**`/admin` stays `'future'` and is not a gap.** It is what an unregistered `admin/…` key
resolves through (`20260817000004`); deleting the row would open every future admin key rather
than tidy anything.

---

## 1. The six claims with no code

**No route means no gate.** `proxy.ts` can only rewrite a path that is registered, so none of
these ever shows a Coming Soon screen — a visitor reads the bullet and there is nothing anywhere
that says "not yet". That is why these six are the most exposed items in the product, and why
this section is first.

**This said seven until 2026-08-22**, when email distributions was built. What is worth carrying
forward from that one is the thing that made it the cheapest of the seven to close and the
thing that made it expensive:

* **Cheap:** the audience was already computable. A distribution's whole value is that its
  recipients are the membership rather than a list, and `people` plus the chapter→region walk
  already answered that. The feature is mostly the honest reporting around it.
* **Expensive:** `sendEmail` takes ONE recipient per call and there is no cron, worker or queue
  anywhere in this product. So the fan-out had to become a resumable queue in the database
  (`distribution_recipients`), driven a batch at a time. **Every remaining Premium bullet except
  the apps hits that same wall** — reminders need a scheduler, push needs a delivery channel —
  so the next one of these to be built should read `app/actions/distributions.ts` first rather
  than rediscovering that this product has nowhere to run background work.

| Claim | Tier | Where it is sold | What it actually needs |
|---|---|---|---|
| **Card, debit, PayPal, Apple Pay, Google Pay, Cash App** | Plus | Bullet 1 of the `featured` card, and `PLAN_ADDS.plus[0]` | Provider decided: Stripe, **Model C** ([payment_info.md](payment_info.md)). Two decisions remain — the platform fee, and what legal entity a "family" is (§5 there). |
| **Automatic dues reminders** | Premium | `PLANS[]`, `PLAN_ADDS` | The hard half is built. A scheduler and a sender. |
| **Push notifications, web and mobile** | Premium | same | No code. Two design questions below. |
| **Apps for iPhone and Android** | Premium | same | The largest single item in the product; it leaves the web app entirely. |
| **The public family website that builds itself** | Premium | same | Three decisions before a line of code. |
| **A per-family public address** | Premium | same | Wildcard subdomain and certificate provisioning for `yourfamily.genorra.com`. |

### Reminders is the cheapest of the five, and BOTH its halves are now done elsewhere

`/reporting/dues-projections` already computes, per approved person, what is owed and whether
they are Active, Invited or Pending Invite. `duesPlanMath` in `lib/dues-utils.ts` computes what
the NEXT installment has to be, arrears included, as a pure function taking `today` as a
parameter and unit-tested under `npm test`. So *what to remind whom about* is built and checked.

**And since 2026-08-22 so is the sending.** `app/actions/distributions.ts` is a working
per-recipient mail fan-out with resumable state, honest per-address delivery reporting, a
provider-rate-limit pacing argument and a claim-under-lock so two callers cannot double-send.
A reminder is a distribution whose audience is "everybody with an installment due" and whose
body is generated rather than typed — so what is left is genuinely just **the scheduler**, plus
one decision that feature will not answer for you:

* **A reminder must not re-send.** A distribution is a one-off somebody pressed a button for;
  a reminder fires on a date and must not fire twice for the same installment. That is a
  uniqueness key on (person, schedule, period) and it belongs in the schema, not in the job.

**The sender still has to read `lib/email/`'s rule first**: never export a sender from a
`'use server'` file, because everything exported from one gets a URL, and a `sendEmail` export
is an open relay carrying our SPF and DKIM.

**The scheduler is the thing this product still does not have, and it is now the binding
constraint on three of the five.** There is no cron, no worker, no queue and no `vercel.json`.
Distributions worked around it by making the client drive a resumable queue, which is fine for
something a person initiates and useless for something that has to happen on the 1st of the
month with nobody watching.

### …AND IT IS ONE MIGRATION AWAY, WHICH THIS FILE SAID OTHERWISE FOR MONTHS

Measured against the local stack on 2026-08-23. Four extensions are **available and not
installed** on this project's Postgres:

| Extension | Available | Installed |
|---|---|---|
| `pg_cron` | 1.6.4 | — |
| `pg_net` | 0.20.3 | — |
| `http` | 1.6 | — |
| `postgis` | 3.3.7 | — |

So "there is no cron anywhere in this product" is true of the APP LAYER and false of the
database — and the database is reached by a migration, which is the one deployment path this repo
already sanctions (`migrate.yml`), with no new infrastructure and nobody holding production
credentials. Three things to know before building on it:

* **`http` (synchronous) probably beats `pg_net` here.** `pg_net` is fire-and-forget — the
  response lands in a `net` table for a limited window, so a job that needs the body is two
  passes and a reaper. A poll that fetches, matches and writes in one statement wants the
  synchronous extension, with an explicit timeout so a hanging endpoint cannot wedge the job.
* **A cron job is DATABASE STATE, and that is the trap.** It is the same invisibility class as
  realtime publication membership: `db:check` compares migration versions, `db:audit` reads
  policies, and a fresh `db reset` schedules nothing. A job created in the dashboard is drift.
  **It must be created in a migration and asserted there**, or local and hosted diverge with
  nothing able to notice — which is the incident "REALTIME NEEDS THE TABLE IN A PUBLICATION"
  records, arriving through `cron.job` instead.
* **It unblocks all three at once.** Reminders, alert polling and anything else on a timer are one
  constraint rather than three.

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

1. **The Dashboard's money band is Free while the whole ledger is Standard.** `/dashboard` still
   renders `FamilyDuesCollectedCard` and `DonationDrivesCard`. A family that has only ever been
   Free can record no payment, so there is nothing to leak; the real case is a family that
   **downgrades** — it keeps every row, as it must, and its dashboard goes on printing a collected
   total for a ledger nobody can open. Two ways to settle it: a sub-key for the dashboard's money
   band, or the decision that a family's own headline total is Free on purpose, in which case say
   so on the card. **Do not settle it by tier-checking the dashboard action**: `/dashboard` has no
   permission row, and giving it one to hide a figure would make the landing screen restrictable,
   which is a much larger change than the one being made.

2. **Bylaws text extraction from PDF and Word is not built.** The table, the GIN index and the
   search are real; plain-text uploads are searchable word by word, and a PDF is searchable by
   title, article and summary only. Every row carries a badge saying which it is, and the
   empty-result state says it too — that is the part this scaffolding must not lose, because "no
   result" and "not indexed" are different facts and a reader who cannot tell them apart
   concludes the bylaws do not say a thing they do say. `bylaws.content_text` is already inside
   the generated `search_vector`, so turning extraction on writes one column: no migration, no
   reindex.

3. **`components/marketing/screenshots/events.png` is a capture of a screen that no longer
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
warns, and the obligation quietly changes from "before launch" to "on running code". With 42 of
43 routes live, that is what this section is.

### Bylaws has a fixture and eight cases — CLOSED 2026-08-22

`bylaws` shipped on 2026-08-22 with no row in `tests/rls/seed.mjs`, no entry in the fixture's
reset list, and `grep bylaw tests/rls/cases.mjs` returning nothing: five actions resting on a
reading of the policy rather than a run of it. `BYLAW_CASES` and `BYLAW_RAW_CASES` in
`cases.mjs` are what closed it — two fixture rows (one with a real object in the private
`documents` bucket, one spare for the delete control), eight action-shaped cases, two raw
probes, and the reset-list line without which a seeded row would have accumulated across runs.

**What the mutation check found is worth more than the cases**, and it is a general finding
rather than one about this table. With `auth_membership_approved()` deleted from
`perm:bylaws:select`, `bylaws.getBylaws (pending member)` STAYED GREEN — because `getBylaws`
opens with `requireMember()`, which refuses an applicant and returns `[]` before a query is
ever sent. **A guard hides a policy exactly as a hand-written filter does.** So every applicant
case in the suite whose action opens with `requireMember()` is evidence for the guard and not
for the conjunct, and `tests/rls/raw/bylaws.mjs` is what reaches the conjunct. That is the same
lesson `raw/journals.mjs` learned through a `.in()` narrowing on the same day, arriving through
a different mechanism.

### 48 server actions have no RLS case — and there is a gate now

`npm run audit:rls-cases` (`scripts/rls-coverage.mjs`), a step in `verify.yml`. It enumerates
every exported action, cross-references `tests/rls/cases.mjs`, and fails until each uncovered
one carries a stated verdict — the same shape and the same promise as `audit:people` and
`audit:family-scope`: **it checks that a verdict EXISTS, never that it is true.**

**This section said 167 and the real figure was 57.** The hand count matched `fn:` and missed
the `read(id, mod, fn)` helper form that most of the suite is written in, which is the whole
argument for the gate in one line: a backlog nobody can count is a backlog nobody can shrink.
Today it is 273 actions, 216 with a case, 57 with a verdict — 48 `BACKLOG`, 3 `RIGHTS-ONLY`
(the whole return value is booleans about the caller's own grants), 6 `STAFF`.

`BACKLOG_CEILING` is a ratchet. Lower it freely — that is what writing a case looks like from
here — and raising it is a deliberate act needing a sentence, so a new action ships with a case
or with somebody deciding in public that the debt should grow.

**Where the backlog is worst, and why those two are worth doing first:**

* **`chat.ts`, eight of twelve.** The only feature whose SELECT policy calls
  `auth_uid_is_room_participant()`, a SECURITY DEFINER function with no other call site and
  load-bearing for the realtime subscription as well as the query — and nothing exercises it.
  `20260822000011` found hosted carrying a `chat_messages` INSERT policy MISSING that conjunct,
  which is a cross-family write path into another family's conversation that no test in this
  repo could have seen.
* **`meetings.ts`, ten of seventeen.** Shipped 2026-08-22 with five guard triggers and a
  `meeting_votes_are_final` trigger that refuses UPDATE for every role including
  `service_role`. The migration's own verify block is the only thing that has ever probed any
  of it, and that is a point-in-time assertion.

Two things about the SHAPE of what is left, both of which change what a case is worth writing:

* **A write narrowed by hand hides its own policy** — measured three times now, twice with a
  filter and once with a guard (see the bylaws entry above). Those belong in `tests/rls/raw/`.
* **Every child table under a scoped parent owes a `raw/` SELECT probe.** A read filtered by
  ids the parent returned is narrowed for free, so the child's own policy is never consulted.


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
| `/pricing` — `PLANS[]` | **Nothing from the registry.** Every bullet is prose typed by hand — but each carries a `claim` id, and `marketing:check` holds the two plan lists to the same set of claims |

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

* **Whether the pricing cards sell the right things.** A pricing bullet is prose about a
  BENEFIT: one bullet spans several routes, several routes are sold in no bullet at all, and the
  words a buyer needs are not the words a member needs. That is why `lib/plans.ts` refuses to
  derive itself from `PLANS[]`, and why neither may be derived from the registry. Those stay a
  judgement, and this file is where their gaps live.

  **It does now check ONE mechanical thing inside them** (added 2026-08-22): that `PLANS[]` and
  `PLAN_ADDS` agree about which claims each tier carries, compared by `claim` id and never by a
  word of copy. See the entry below for what that closes and what it deliberately does not.
* **That the prose is true**, or that a card describes the screen it names. Nothing can.
* **That a pillar's bullets sit at the pillar's tier.** All three pillars span tiers by
  construction — a pillar is the job a family is trying to do, not a row in a price list — so
  they carry no tier tag and must not gain one: a single badge over six bullets sitting at two
  prices is wrong either way it resolves. What used to disclose it was a hand-typed sentence
  naming what each tier covered, which went stale twice; the tier BANDS are that answer now,
  derived, and the sentence is a pointer to them naming no tier and no figure.

### `PLANS[]` and `PLAN_ADDS` are two hand-written lists, and they no longer drift silently

`PLANS[]` on `/pricing` is what a BUYER reads; `PLAN_ADDS` in `lib/plans.ts` is what a MEMBER
reads on `/admin/settings` and `/upgrade`. Neither may be derived from the other — that argument
is sound and is stated in both files — and the cost was real and had been paid twice: a Premium
bullet went missing in-product, so a family on Premium was never told inside the product that the
address comes with the website; and a false detail ("the family's size over time", which nothing
in this product records) survived on both after `/features` had corrected it.

**This section said "there is no gate and there cannot be one". There is one now, and the reason
that sentence was wrong is worth keeping.** It conflated two different claims: that the two lists
must not be derived from each other (true, and unchanged) with the idea that nothing about them
could be compared at all (false). What could never be checked is the WORDS — the buyer's phrasing
and the member's phrasing are different on purpose. What can be checked is WHICH THINGS ARE SOLD,
and that is exactly what drifted both times.

Every bullet in both lists now carries a `claim` id — `<tier>/<slug>`, never rendered — and
`npm run marketing:check` asserts the SETS match per tier, that no card says one thing twice, and
that a claim's prefix names the card it sits on (so a bullet re-priced in one file only is a
finding rather than two clean-looking set differences). The field is required rather than
optional, so `npm run typecheck` refuses a new bullet that declares none: an optional field would
be omitted by exactly the edit this exists to catch.

**What is still a judgement, and still belongs in this file:** whether a claim should exist at
all, whether it is true, and which tier it belongs in. Three things to redo after any edit to
`PLANS[]`:

1. The severity of every claim that moved. Severity here is keyed to the tier a claim is sold in,
   so `PLANS[]` is an input to this file on the same footing as the registry.
2. §1 in both directions: not only "does this claim have code?" but "does this code have a claim,
   and is it in the right tier?"
3. Whether a ROUTE has to move with the bullet. `grep "tier: '" lib/features.ts` is the whole job.

The fourth item was "the `PLANS[]` ↔ `PLAN_ADDS` diff", by hand. The gate does that one.

### A retired route used to owe a copy sweep — DELETED 2026-08-22, and not by being solved

A section here said that a deleted route is invisible to every derived badge (`proxy.ts` cannot
gate what is not there, `isFeatureFuture()` answers `false` because `getFeature()` finds nothing,
and the Coming Soon pill simply comes off), and that a retirement therefore owed a `grep` of the
marketing prose in the same commit. It was true, and it is gone because **nothing is expected to
be retired again** — the retirements it was written for (`/direct-lineage`, Events, the Review
section) were a phase of getting the route tree right, and that phase is over.

Recorded rather than silently dropped so nobody reinstates the obligation from the git history
without first asking whether a route is actually being retired. If one ever is, the sweep is
`grep -rni "<the route, and the WORDS it was sold in>" "app/(marketing)" components/marketing
lib/plans.ts app/page.tsx`, and `marketing:check` catches the other half — a card still pointing
at the dead route — but it cannot see prose.

---

## 5. Proposed — no claim, and no code

The third shape, which the register above cannot hold: a feature nobody has promised and nobody
has built has no bullet to be counted against and no registry entry to be gated. **Nothing here
is scheduled.** It is here so each design is argued once rather than invented twice, and so the
decisions underneath are explicit *before* somebody writes the screen and discovers them.

### SMS for check-ins — the channel the Premium tier is justified by, and the reason it is Premium

`/community/safety-check-ins` is `tier: 'premium'` because the ask is meant to arrive as a **text
message** and the answer is meant to come back as one. Today it goes out by email and by the bell,
which is the channel §5's own first decision calls *"the one a disaster guarantees is closed"* —
the bell needs an open tab and `IdleTimeout` signs a member out after 60 idle minutes.

**This is the highest-value unbuilt item in the product**, because unlike the other six Premium
claims it does not add a screen — it makes an existing screen actually work.

**HALF OF IT IS BUILT AS OF 2026-08-23.** Consent and a verified sending number shipped first,
deliberately: they are what the sending half will have to ask, and they are the only part that is
fully testable with no provider account. Decision 2 below is the record of what shipped; decisions
1, 3 and 4 are what is left, and all three are behind the same external gate.

**And it is the only feature in this file with a LEGAL gate rather than an engineering one.** Read
decision 2 before writing any code.

#### 1. A provider — the seam exists, nothing is behind it

`lib/sms/send.ts` is written and has NO provider: `smsConfigured()` reads four env vars and
`sendSms` answers `{ sent: false, error: 'no SMS provider configured' }`. It copies
`lib/email/send.ts` exactly — one recipient per call, fails soft, never exported from a
`'use server'` file — and for the same reason with a worse payload: *"a `sendSms` export is an
open relay"* is the same sentence about a message that reaches a phone on a nightstand.

Twilio is the default and has the only inbound story worth having (a documented
`X-Twilio-Signature` HMAC over the request URL and parameters, which is what makes an
unauthenticated webhook trustworthy). Vonage, MessageBird and AWS SNS are the alternatives; SNS is
cheapest and its inbound handling is the weakest.

**Wiring one is one function body**, and the checklist is in that file: append the carrier-mandated
opt-out line once (a property of the channel, not of any message), distinguish a permanent 4xx
from a retryable 5xx/429 so a queue can requeue the right one, never log a body, and do not
re-normalise `to` — `toE164` already did.

#### 2. CONSENT — BUILT 2026-08-23, AND IT WAS NEVER A CODE DECISION

**This half is done.** `20260823000002`, `lib/sms/consent.ts`, `app/actions/sms-consent.ts` and
My Profile → **Text Messages**. It was built first, before any provider, because it is what the
sending half will have to ask and because it is the only part that is fully testable with no
account.

The legal frame that shaped it, kept because it is what any change here has to respect: US
**TCPA** statutory damages are $500–$1,500 **per message**, a hundred and forty relatives is not
a number to be wrong about, and "it was an emergency" is a narrower exemption than it sounds.

What shipped, and the four rules it encodes:

* **Explicit per-person opt-in, defaulting to OFF** — an append-only `sms_consent_events` log
  with the status DERIVED by `consentStatus()`, never stored. A boolean column cannot say *when*
  somebody agreed and *how*, which is the only thing a challenge would ever ask for.
* **A number verified by a code before it can be texted**, in `person_sms`, kept deliberately
  separate from `people.phone`. That column is the DIRECTORY number and `normalizePhone` *"returns
  anything it does not recognise unchanged rather than guessing"* — right for a number a human
  dials, and nowhere near enough to send to. `toE164` refuses instead, and is the one normaliser
  in the codebase that does.
* **STOP is a dead end the product cannot undo.** `stopped` is its own status, `grantSmsConsent`
  refuses it, and `consentStatus()` ignores a `granted` event folded over it — two layers,
  because the writer is the thing most likely to be wrong. A carrier-level opt-out is revoked by
  the handset, not by a checkbox.
* **Withdrawing is never harder than granting.** One press, no confirm dialog, and idempotent.

**WHAT IS STILL NOT BUILT, and one item on the old version of this list was PREMATURE:**

* **A2P 10DLC registration.** A carrier requirement, not an option: US application-to-person SMS
  needs a registered brand and campaign with a real-world identity behind it. **Nothing will
  deliver until this exists**, and no migration fixes it. It gates decisions 3 and 4 entirely.
* **The roster state on a check-in.** The earlier version of this section called for `no SMS
  consent` as its own state beside *unreachable*, and that was written a step too early: SMS is
  not a check-in channel yet, so a column about it today would be a claim with no code sitting on
  a screen. **It lands in the same commit as the outbound queue** — which is when it becomes a
  fact — and `smsBlockReason()` already returns exactly the five reasons that column will print.

#### 3. Inbound replies are a NEW KIND OF SURFACE for this codebase

Receiving a text means a **public, unauthenticated route handler**, and there is exactly one route
handler in the whole app today (`app/auth/confirm/route.ts`). Five things follow and the third is
the one with no precedent here:

* **The caller is the provider, verified by signature.** Not a session. The signature IS the
  authentication and there is nothing else.
* **Idempotency.** Providers retry. A retried "SAFE" must not write a second answer.
* **THE PHONE NUMBER IS AN IDENTITY ARRIVING AS A PARAMETER**, which is the shape §2b forbids in
  every other context. What makes it admissible is that it is not *client*-supplied — the provider
  asserts it and the signature vouches for the provider — and that resolution must be to a
  **verified** number (decision 2) or the claim is worthless. This is the single most careful piece
  of code in the feature.
* **A number may resolve to more than one person**, across two families or on a shared family
  phone. And a person may be on **two open check-ins**, so a bare "SAFE" is ambiguous. Decide it
  explicitly: newest open check-in, and the confirmation reply names which one it answered.
* **`answerCheckIn` must not be reused as-is.** It resolves the row from the caller's guard, which
  is exactly right and exactly unavailable here. The shared rule belongs in a pure module both
  paths call, or the two will drift on what an answer means.

#### 4. The fan-out does not fit a request, again — and `reach` stops being one column

A long code sends about 1 message per second, so 140 relatives is over two minutes of wall clock
against a serverless ceiling of 10–15s. **The existing queue is the answer** —
`safety_check_in_people` rows already ARE the work list and `claim_safety_check_in_asks()` already
claims a bounded slice under `FOR UPDATE SKIP LOCKED` — but `reach` is currently a single-channel
column and SMS makes it two.

The shape that keeps the honest reporting: **one row per (person, channel) attempt**, with `reach`
on the roster row becoming a DERIVED roll-up of *"did we reach them by anything at all"*. Do not
add `sms_reach` beside `reach`: two columns describing one question is the `is_minor` trap (§4b),
and the screen's whole job is to answer *could we reach this person* rather than *did the email
work*.

#### What it does NOT change

`tierAllows` must stay out of `app/actions/safety-check-ins.ts`. Answering is `requireMember()` and
the policies' `self_expr` on every channel, so a relative already asked can answer on any plan,
including a family that lapses mid-emergency. A tier withholds screens, never rows.

### Alert-driven check-in suggestions — the automation half of Safety Check-Ins

`/community/safety-check-ins` shipped on 2026-08-23 and is **human-raised only**: a person decides
that something is happening and asks. Nothing in the product watches for a disaster, and this is
the entry for the half that does not exist.

**The feeds are real and free, and that is not the hard part.** Measured 2026-08-23: the National
Weather Service publishes CAP v1.2 alerts at `api.weather.gov/alerts/active/area/{ST}` with **no
API key** — a `User-Agent` header is the only requirement — covering tornado, flood, hurricane,
winter and heat. USGS earthquakes are free GeoJSON with no auth at all. FEMA's IPAWS All-Hazards
feed needs registration through the IPAWS portal and is **not a superset**: since July 2023 NWS
sends IPAWS only the CAP intended to activate Wireless Emergency Alerts, so IPAWS earns its place
for non-weather state and local alerts (evacuation orders, civil emergencies) and not for weather.
NASA FIRMS wildfire detections need a free `MAP_KEY` and are satellite heat pixels rather than
evacuation orders — a hotspot thirty miles away is not a reason to ask a family whether they are
safe, and NWS Red Flag warnings are the better signal.

Four things stand between that and a feature, and the first two are the ones that matter.

1. **THE JOB MUST SUGGEST. A PERSON MUST RAISE.** `raiseCheckIn` is `canAny` because *a false
   alarm to the whole family at 3 a.m. is exactly what the grant exists to prevent* — and an
   automated raiser IS that abuse case, unattended and at scale. NWS issues tens of thousands of
   alerts a year and almost none warrants waking a family. So the shape is a SUGGESTION row
   (*"A Tornado Warning covers 4 relatives in Travis County — raise a check-in?"*) that a human
   confirms in one tap and that expires on its own if nobody acts. A false positive then costs a
   dismissed notification rather than a panic across a hundred and forty people.
2. **A SCHEDULED JOB HAS NO CALLER TO AUTHORIZE, and this codebase has no answer for that.** Every
   action here derives its caller from `auth.uid()`; §2b forbids taking an identity as a parameter.
   Automating the RAISE means inventing a system actor and hanging the family's most sensitive
   write off it. Suggesting sidesteps it entirely: the human who confirms is the caller, and the
   audit trail names a person. **Do not solve this by giving the job a service identity.**
3. **THE MATCHING IS A DATA PROBLEM, NOT A CODE ONE.** `people` holds `city`, `state`, `zip_code`
   — no latitude, no longitude, no geocoding, and PostGIS is not installed. NWS alerts carry county
   FIPS and UGC zones. So:
   * county-level matching needs a ZIP→county crosswalk, which is a data dependency;
   * state-level matching needs no new data **except that `state` is not normalised** —
     `pickProfileColumns` normalises exactly two things, name case and phone country code, so `TX`,
     `Texas` and `texas` are three kinds of record and any state match silently misses two of them.
     Whatever normaliser is added must be conservative and must never reject a value, per that
     file's own header;
   * and state-level is too coarse to be useful anyway. A tornado warning covers three counties out
     of Texas's 254, and asking every Texan relative each time is how the feature gets ignored.
4. **THE SCHEDULER.** See §1 — `pg_cron`, `pg_net` and `http` are all available-and-not-installed,
   so this is one migration rather than new infrastructure. The job must be created IN that
   migration and asserted there, because `cron.job` is database state nothing in the repo can see.

**Sequence matters more than any of it.** The check-in's own first constraint is unchanged: the
bell needs an open tab, `IdleTimeout` signs a member out after 60 idle minutes, and `sendEmail`
fails soft. **Automation improves the TRIGGER, not the REACH — and reach is the feature.** Detecting
a hurricane faster than the family's own group text is worth nothing if the message cannot land, so
the channel (push, or SMS, which is in no plan at all) comes before this.

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
grep -c "status: 'live',"   lib/features.ts          # 44
grep -c "status: 'future'," lib/features.ts          # 1
grep -c "^    href: '"      lib/features.ts          # 45

npm run marketing:check                              # every live feature is sold somewhere

# exported server actions, and how many have an RLS case. DO NOT HAND-COUNT THIS: the pair of
# greps that used to live here reported 95 covered against a real 205, because it matched case
# IDs rather than the (module, function) pairs a case actually names — and §3 then carried a
# backlog of 167 against a real 57 for as long as anybody read it.
npm run audit:rls-cases            # 273 actions, 216 with a case, 57 with a stated verdict

grep -rn "no-img-element" components/ | wc -l                   # the resize decision
```

**When a feature ships:** flip its `status`, and let the derived surfaces correct themselves.
Then run `marketing:check`, which will tell you whether it wants a card or an allowance, and
decide the one thing no mechanism can: whether a `PLANS[]` bullet needs writing. If one does,
`PLAN_ADDS` needs its counterpart in the same commit and the check enforces that half.

**When an action is added,** it owes a case in `tests/rls/cases.mjs` — AGENTS.md §7, and
`audit:rls-cases` is what refuses a commit that skips it. Adding a `BACKLOG` verdict instead
breaches the ceiling, deliberately.

**When a bullet moves between tiers,** this file changes and its `claim` prefix does. §4 has the
three things to redo; the fourth used to be the hand diff and is a gate now.

**Delete a gap when it closes.** Do not strike it through, do not leave it as an epitaph, and do
not add a revision log. The one thing worth keeping from a closed gap is a *mechanism* that will
recur — and that belongs in the section it protects, not in a history at the bottom.
