# TODO

Running list of things worth revisiting. Add an entry when you find something real
but out of scope for the change you are making, so it does not get lost in a commit
message.

Everything here is open. Completed work is deleted rather than archived — the write-ups
are in git history, and the lessons worth keeping have been promoted to AGENTS.md.
GO LIVE is a checklist rather than a backlog.

## GO LIVE

Things that must be true of the **hosted project** before real families use it. These
are not code changes and none of them is done by `db push` — every one is a setting or
a credential on the deployed environment, which is exactly why they are easy to reach
launch day without.

### [ ] Two `[auth]` values are set in `config.toml` and not on hosted

**Action:** one trip to the dashboard, or one PATCH. Both are settings, not code, and
nothing in the repo can detect either. **Still open because no `SUPABASE_ACCESS_TOKEN`
exists in this checkout** — not in `.env.local`, not in the Machine/User/Process
environment, not in `supabase/.env.probe` (which is absent). Whoever has the token does
this in about a minute.

| Setting | `config.toml` | hosted | Where |
|---|---|---|---|
| `secure_password_change` | `true` | **false** | Authentication → Providers → Email → "Secure password change" |
| `sessions_inactivity_timeout` | `168h` (7 days) | **unset** | Authentication → Sessions → "Inactivity timeout" (Pro plan and up) |

**Do not do any of this with `npx supabase config push`.** It sends the whole `[auth]`
block, `site_url` included — so pushing one setting from a checkout whose config points
anywhere but production reconfigures production's redirect handling as a side effect, and
with `site_url = "http://127.0.0.1:3000"` in play it starts mailing people links to their own
laptop. This is the warning `scripts/auth-templates.mjs`,
[supabase/templates/README.md](supabase/templates/README.md) and `config.toml` all point back
here for; it is why the auth email templates were pasted by hand for two months, and it is why
`email:push` sends ten named fields and refuses everything else.

A PATCH is safer than the dashboard is fiddly, and much safer than `config push` — it sends
only the fields named, so it can touch neither `site_url` nor the SMTP credentials that live
on hosted and in no file here:

```bash
# read first (read-only, and the only way to see any of this)
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/jdvzabunhchjetjddgdw/config/auth

# then set both. sessions_inactivity_timeout is an INTEGER OF SECONDS here, not a
# Go duration string like config.toml's — 7 days is 604800.
curl -s -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  https://api.supabase.com/v1/projects/jdvzabunhchjetjddgdw/config/auth \
  -d '{"security_update_password_require_reauthentication":true,"sessions_inactivity_timeout":604800}'
```

Re-read the GET afterwards. Neither value is visible from the app, from
`/auth/v1/settings`, or from any test.

**Why each matters.** `secure_password_change` is what AGENTS.md's "A fresh session can
change the password without the emailed code" is written on — and on hosted the flag is
*off*, so there is no reauthentication code at **any** session age, not merely inside
GoTrue's 24-hour window. `sessions_inactivity_timeout` bounds how long an abandoned cookie
stays renewable; 7 days was chosen because the floor is about an hour (auth-js refreshes a
live tab roughly every 58 minutes at `jwt_expiry = 3600`, and by measurement the only clock
that setting watches is the refresh, so anything lower signs out people who are working).
The reasoning and the measured table live in `config.toml` beside the block.

**Watch the unit — the two places disagree.** `config.toml` takes a Go duration and Go has
no `d`, so seven days is `"168h"`; the Management API takes seconds, so the same value is
`604800`. `"7d"` is a parse error and `7` is seven nanoseconds.

Found 2026-08-12 by a read-only sweep comparing every `[auth]` key `config.toml` declares
against that endpoint. Eighteen keys, three divergences; `otp_length` is now 8 in both and
`max_frequency`'s 1s/60s split is deliberate and says so in `config.toml`. These two are the
residue, and they are the same failure the template sync was built to stop, one field over:
written in `config.toml`, verified locally, never applied to the project that serves real
families.

**`scripts/auth-templates.mjs` will not grow into a checker for this**, deliberately. It
reads and writes nothing but the ten mailer fields; the moment it can write `site_url` it
inherits every hazard `config push` has. A separate read-only auditor over the whole
`[auth]` block is the right shape and is not built.

### [ ] Push the two changed auth email templates to hosted

**Action:** `SUPABASE_ACCESS_TOKEN=sbp_… npm run email:push`. Same blocker as above — no
token in this checkout.

`reauthentication.html` and `email-change.html` both carried a stale `DORMANT` comment
claiming nothing called them. Comments in a template are part of the shipped payload, so
`npm run email:check` reports drift against hosted until somebody pushes. The substance
moved to [supabase/templates/README.md](supabase/templates/README.md), where that
directory's own rule says it belongs.

Pushing proves the bytes arrived, not that the mail renders — send yourself a real signup
before calling it done.

### [ ] Confirm `rate_limit_email_sent` on hosted

**Action:** one look at Authentication → Rate Limits, and nothing to run.

`config.toml` sets `[auth.rate_limit] email_sent = 30` per hour, and says in as many words
that the file is not read for it — the dashboard is. Nothing in the repo can check it, which
is what puts this here.

It became worth confirming on 2026-08-17, when `/login` gained a **Send the link again**
button. `email_sent` is a PROJECT-WIDE hourly cap shared with every signup, reset, invitation
and reauthentication email, so an abused resend does not merely annoy one address — it
starves legitimate registrations. That, rather than the abused address, is the reason the
number matters.

The button is throttled on the client (one press per page load, no countdown) and that is
honesty rather than a control: `/auth/v1/resend` is reachable without our page. If real abuse
ever appears, `[auth.captcha]` plus `ResendParams`' `captchaToken` is the lever GoTrue already
provides.

### [ ] The `production` environment carries all three credentials and a `master` branch rule

**Action:** one look at Settings → Environments → production, and nothing to run.

`migrate.yml` reads `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as environment
**secrets** and `SUPABASE_PROJECT_ID` as an environment **variable**. All three live there
rather than on the repository, for the reason the comment beside `environment: production`
gives: repository secrets are readable by every workflow, `verify.yml` included, and that one
runs `on: pull_request` from any branch a collaborator can push. Nothing in this repo can see
whether they are set, which is what puts this on this list — the job's preflight names them
and points at that screen, and it is the only thing that will ever tell you.

**Set the environment's deployment branch rule to `master` as well.** With
`workflow_dispatch` gone (2026-08-17) nothing but a push to `master` triggers that workflow,
so the rule is no longer closing an open path — it is what makes the restriction a property
of the *environment* rather than of this file happening to have exactly one trigger. A
workflow added later on a branch, whatever it declares, then gets no credentials at all.

Worth confirming at the same time that runs show up in the Environments tab, since that tab
is the "recorded" half of the whole mechanism — the history of what reached production and
when.

### [ ] Confirm the hosted `claude_probe` role has lapsed

**Action on or after 2026-10-01:** thirty seconds of verification.

The `claude_probe` Postgres role is `VALID UNTIL 2026-10-01`. It holds `LOGIN` and no
grants — enough to read `pg_policies` and `pg_catalog`, not enough to read a single row of
family data. Nothing needs doing when it lapses; verifying it lapsed is the item.

The local half of this is already gone: neither `.claude/settings.local.json` nor
`supabase/.env.probe` is present in this checkout — confirmed 2026-08-12, there is no
`.claude/` directory at all. And the durable replacement is live, so granting an agent
`db push` on production has no remaining justification: migrations reach hosted from CI on
merge and gate the Vercel release, reviewed and recorded, with nobody holding write
credentials. See AGENTS.md, "How migrations reach the hosted project".

## The family-wide tree publishes the roster under a key nobody can restrict

**Action:** decide whether `/family-tree` gets a permission resource of its own. It is a
product call — the mechanism is three lines and a migration.

`/family-tree` became a real tree on 2026-08-13: it fetches every `people` row in the
family and every relationship between them, and it writes new ones. It gates on
`family-tree`, which `20260806000006` deliberately left **unregistered** — a member's own
things are not something a family administers — so `auth_permission()` falls through to
the default and resolves `view` to `'any'` for every approved member. **A family cannot
switch this page off.**

That was right when the key meant "my own line". It is a different claim now, and
FutureFeature.md predicted exactly this: *"`/direct-lineage` and `/family-tree` have no
permission row by design, so shipping them ships them to everyone with no switch … It
will matter when the real tree lands."* It has landed.

**What is and is not exposed**, so this is not read as bigger than it is. The tree shows
names, avatars, gender, birthdays and whether somebody has an account — the same columns
the Member Directory shows, plus the relationships. It shows no contact details, no
addresses and no money. The exposure is that a family which has restricted `members` (its
Directory) has not thereby restricted this.

It grew slightly on 2026-08-13: `editPersonRecord` lets any approved member WRITE those
columns for anybody with no account, not merely read them. That is a deliberate choice
(a tree is built collaboratively) and it is bounded — never a row with a `user_id`, never
`primary_email`, never a column outside `lib/profile-columns.ts` — but it means the
missing permission row now withholds an edit as well as a read.

**THE CHOICE NARROWED TO TWO on 2026-08-13**, later the same day, when the per-member
lineage view was deleted. There is now exactly one page on the `family-tree` key, so the
option this list called "probably right" — splitting the key so the two pages could answer
differently — has nothing left to split. What remains:

1. **Register `family-tree` as a resource again.** One migration: a `permission_resources`
   row, a per-family `resource_visibility` backfill, and a place in
   `components/admin/resource-groups.ts`, exactly as AGENTS.md §6 describes. The objection
   this option used to carry — that restricting the tree would also restrict the lineage
   view sharing its key — is gone with that view. This is now the straightforward answer
   and needs only the product call.
2. **Decide the tree is Directory-equivalent** and gate it on `members`. Cheapest, and it
   still carries the trap option 1 avoids: `belongsToFamily` uses the service role
   precisely so that a family restricting its Directory does not break its own family
   tree (AGENTS.md §4), and this would reintroduce that coupling at the page instead.

Whichever is chosen, one more surface reads this key now: the Dashboard's Family Tree card
resolves `can(user.id, 'family-tree', 'view')` before fetching, so registering the resource
starts narrowing the card without anybody having to remember it exists.

**HALF OF OPTION 1 IS NOW BUILT, and it is deliberately the half with no migration in it.**
The canvas has a View/Edit mode, and it takes a `canEdit` boolean resolved on the page —
today `isApprovedMember(user.id)`, which is exactly what every write action behind it
already demands. So the toggle is offered to precisely the people whose edits would
succeed, and the question "who may edit this tree" now has ONE place that answers it.

What is left is the product call and the migration, and swapping the answer is one line:

```ts
const canEdit = await can(user.id, 'family-tree', 'edit')   // instead of isApprovedMember
```

**Do not do that without the backfill**, and this is the trap worth writing down. Since
`20260807000000` a template's grid is materialized, and `create`/`edit` default to
`'none'` — so registering the resource and gating on it, with no `resource_visibility` and
no per-template backfill in the same migration, makes the tree **read-only for the entire
family including its founder**, with no error anywhere. AGENTS.md §6 says this; the tree is
the case where it costs most, because the page keeps working and only the writing stops.
The backfill has to cover existing templates AND whatever `families_seed_permission_templates`
gives a family created afterwards.

Recorded 2026-08-13, when the tree stopped being a placeholder; narrowed the same day; the
UI half built later the same day.

## The family tree's second pass

**Action:** none blocking. This is an ordinary backlog against a finished feature, which
is the change from what this section used to be — it was "the list the beta badge is
standing in for", and the badge came off on 2026-08-13. Nothing below is a caveat a member
needs warning about; each is a thing the tree does not do yet.

Shipped in the first pass: an ancestry-style focus canvas (grandparents, parents, focus
with spouses, children, siblings beside), three ways to add a relative (link an existing
member, invite by email, record without one), detaching a connection without removing
anybody from the family, a list of people connected to nobody, and the Dashboard card that
counts generations, members and those unconnected people.

**The lineage view is gone**, and that answers FutureFeature.md decision 5 — it asked
whether the per-member view retires when the real tree lands or stays as the Directory's
drill-down. `/members/family-tree`, `FamilyTreeClient`, `app/actions/ancestors.ts` and
`app/actions/spouse.ts` were all deleted. It cost nothing in data: both surfaces were
readers of `person_relationships`, so every row it wrote is on the canvas already, and
re-focusing on whoever you click is the same drill-down without a second page.

What is deliberately absent, and what each would take:

* **Step relationships.** `person_relationships.is_step` exists and the builder writes
  `false`. **The column arrived on 2026-08-13** — `person_relationships.link_kind`
  (`20260813000007`), which supersedes `is_step` and drives the Bloodline toggle, and is
  set both when adding a relative and afterwards through the manage dialog. What is left
  is the half this entry always said was the hard one: what a step-parent LOOKS like on a
  canvas that has one row for parents. A step-relative is an ordinary card that does not
  carry the bloodline droplet, and it vanishes in the Bloodline view.

  **The second marriage it implies is now drawn** (2026-08-14, see the entry below), and
  the manage dialog offers the kind for EVERY connection a person has rather than only the
  one their card was reached by — which is what made a step-grandmother expressible at all.
  Before that, a grandparent had no edge to the focus person, so their card carried no
  control and there was nowhere in the product to record it.

  **One follow-up this created.** `is_step` is now dead weight on the table and should be
  dropped in its own migration (see 20260813000006 for how much care a column drop wants).

  **The anchor got its setting** (`20260813000008`), and the case that forced it was not
  the one predicted here. It was not a founder who married in — it was a founder who is a
  SON. Anchored on him the walk goes up through his mother, so his father's former wife
  comes back as a blood relative of the line while the current wife correctly does not,
  from the same rule. `families.bloodline_anchor_id` is nullable and falls back to the
  founder, so nothing changed for a family that does not set it.
* ~~**More than one marriage.**~~ **DONE 2026-08-14.** Once the focus person has more than
  one spouse the children stop being one row and become one panel per marriage
  (`MarriageGroup` in [FamilyTreeBuilder](components/family-tree/FamilyTreeBuilder.tsx)),
  plus a panel for children whose other parent is not a recorded spouse. Each spouse card
  now carries the word for the marriage — Wife, Ex-wife — so three cards in a row read as a
  person and two marriages rather than as three people. The split is derived from the
  `parent` edges the children already carry, and a child the tree cannot attribute falls
  into the residual panel rather than being assigned to a marriage nobody stated. The
  per-marriage "+ Son" carries that spouse as the co-parent, so adding a child to a
  marriage records it.

  This was called "the hardest of the three and the one most likely to force a layout
  change"; it did force one, and the surviving cost is horizontal — three marriages of
  three children each is wider than the canvas, which is what the one sanctioned
  `overflow-x-auto` is for.
* **Dates on the connectors**, and a person card that says more than a name and a status.

**RESOLVED 2026-08-13 — and the answer was to delete the question.** This entry used to
read "`is_minor` is not asked for anywhere in the add flow … fixing it is a checkbox and a
column; deciding whether the tree should be the place a child is created at all is the
actual question, since `/direct-lineage` exists for that". The tree is that place, the
checkbox was never added, and the column is gone (`20260813000006`).

A child is a person nobody has claimed yet, which `user_id IS NULL` already said, and a
birthday answers "how old are they" on the day it is asked — which a stored boolean never
could. `/direct-lineage`, `app/actions/children.ts` and `lib/family-constants.ts` were
deleted with it; `editPersonRecord` and `invitePersonRecord` on the tree replaced the
parent-edits-child and convert-to-adult halves.

## Recent Updates has no archive — there is nowhere to see or search past updates

**Action:** decide whether Recent Updates earns a page of its own, and if so what it
holds. This is a product call first; the query behind it is easy.

2026-08-13 folded announcements into the dashboard's Recent Updates card
([components/dashboard/updates.ts](components/dashboard/updates.ts)) and removed the
pinned-announcements banner above it. That is better in every way it was meant to be —
one feed instead of two surfaces, and a dismissal that is per PERSON rather than per
browser — but it has left the card holding two kinds of thing and showing only the
newest handful of each. What a member cannot do today:

* **Scroll back.** The card shows every pin plus `RECENT_UPDATES_LIMIT` (6) other rows,
  and nothing renders row seven. `getNotifications()` caps at 30 and the bell shows the
  same rows; `getAnnouncementFeed()` caps at 20. Older than that is not merely unseen,
  it is unfetched.
* **Search.** No surface searches either table. "What did they say about the hotel
  block?" has no answer but scrolling `/announcements`, which itself stops at 50.
* **See the two together anywhere but the dashboard.** `/announcements` is the board and
  the bell is the inbox; the merged view exists only in a card five rows tall.

The card deliberately carries **no "View all updates" link** for exactly this reason —
there is nothing at the other end of one, and the comment in
[RecentUpdates.tsx](components/dashboard/RecentUpdates.tsx) says so. When this ships,
that link is the first thing to add.

Three things to settle before building it:

1. **Is it a route or a bigger card?** A route (`/updates`) needs a `permission_resources`
   row, a `resource_visibility` backfill and a rail item under Community — AGENTS.md §6
   and the "one rail item, one permission resource" rule. Note the awkwardness it would
   inherit: the feed mixes rows governed by `announcements` with rows governed by
   nothing at all (notifications lost their resource in `20260805000007`), so a single
   view grant over the page would not describe what is in it.
2. **Whose notifications, and does read-state move?** The card deliberately does not mark
   anything read — the bell owns `read_at`, and two surfaces competing over it would make
   the badge disagree with itself. An archive that opens rows has to answer the same
   question, and probably the same way.
3. **What does search actually search?** Title and body across both tables is the obvious
   answer and needs an index on neither today. Doing it in Postgres rather than in the
   browser is what makes it work for a family with three years of news, which is the case
   this is for.

Recorded 2026-08-13, while moving announcements into the card.

## The Dashboard design kit is world-readable, and seven of its images have no provenance

**Action:** decide whether `public/dashboard/` moves out of the served tree. It is a
licensing question first and a payload question second, and only the first one is urgent.

`public/dashboard/` is the Golden Master handoff kit, added by `c622624`. Everything under
`public/` is served, so **every byte of it is fetchable by anyone, signed in or not** — no
route, no gate, no referrer check. These URLs resolve on production today:

```
genorra.com/dashboard/04_MEDIA/family_hero_source.jpg
genorra.com/dashboard/01_REFERENCE/Dashboard_Golden_Master_OFFICIAL.png
genorra.com/dashboard/08_QA/VISUAL_ACCEPTANCE.md
```

**The images are the part that matters.** `04_MEDIA/` holds seven photographs — a family
group shot and five portraits of an invented family, plus an event thumbnail. Nothing in
the kit states a licence, names a photographer, or carries EXIF. So the position today is
that GENORRA publishes seven photographs of identifiable people under its own domain with
no established right to do so, and they are indexable. That is a different kind of problem
from the rest of this file: it is not a defect that might bite, it is a claim being made
right now on every crawl.

The rest is smaller and worth stating so nobody re-litigates it as if it were the main
point. About 8.5 MB rides in every clone and every deploy, of which 2.3 MB is one reference
PNG and 1.38 MB is a "vector" SVG that is 99 % embedded base64. And `08_QA/`, `07_PAGE_PATTERNS/`
and `00_START_HERE/` are internal design correspondence — no secrets, but written for us
rather than for readers.

**Why it was left where it is.** `public/home/` holds the brand kits by the same convention
— "the versioned vendor kits, exactly as delivered; reference material, nothing is served
out of it" — so `public/dashboard/` is consistent with the rule as written, and moving it
unilaterally during the dashboard build would have been a second decision smuggled into an
unrelated commit. The AGENTS.md table row was corrected to describe what is actually there.

Three options, in the order they are probably worth considering:

1. **`git mv public/dashboard design/dashboard-v1_0`.** Kits are reference material and
   nothing imports them, so nothing breaks. This is the whole fix for all three problems and
   costs one commit. It does leave `public/home/` inconsistent with it, which is an argument
   for moving that too and making `design/` the convention.
2. **Delete `04_MEDIA/` only** and keep the kit in place. Narrowest fix for the licensing
   question; the images are demo photography the implementation does not use and cannot use
   (the design treatment is burnt into the pixels — see the note in `WelcomeHero.tsx`).
3. **Leave it and get provenance.** If the images came from a stock licence that permits
   web distribution, this is a README away from being fine. Somebody has to know the answer.

Note that (1) and (2) are not undone by history: the blobs stay reachable to anyone who
clones, which is a separate question from what genorra.com serves. Only a rewrite changes
that, and for demo photography it is very likely not worth one.

Found 2026-08-12 while implementing the kit.

## 1. PARKED 2026-08-07: "Were you already added to the family?"

**Action:** decide how a registrant proves they are the pre-entered person, then either
rebuild it around that proof or delete the code. It is off, not gone.

Turned off with `LINK_EXISTING_PERSON_ENABLED = false`
([lib/feature-flags.ts](lib/feature-flags.ts)). The dashboard banner
([LinkPersonBanner](components/dashboard/LinkPersonBanner.tsx)) and both actions
(`getLinkPersonBannerData`, `linkPersonToCurrentUser`) remain in the tree.

**It is switched off at the ENDPOINTS, not merely hidden**, and that distinction is the
whole reason this is more than a CSS change. Both actions are `'use server'` exports, so
each has a URL and stays callable by anyone signed in however the dashboard renders
(AGENTS.md §5). Hiding the banner alone would have left:

* `getLinkPersonBannerData` returning the first name, last name and birth date of every
  unlinked person in the caller's family — a roster, one POST away;
* `linkPersonToCurrentUser` still able to move one of those rows onto the caller's
  account.

Verified as the *rightful* caller in their *own* family — an ALPHA newcomer claiming an
ALPHA record — not merely as a cross-family attacker: banner `[]`, link refused.

### Why it was worth parking rather than leaving on

What the feature asks the user is "which of these people is you?", and the answer is
self-asserted. What it hands over on that answer is an existing `people` row, which may
already carry dues history, payments, relationships and photo tags — and, since Phase 3,
a `membership_status` that the action has to carry across by hand precisely so claiming
a record is not a way to launder approval.

It is the same shape as the claim-by-email block Phase 3 deleted from `register.ts`, one
step further along: there the match was automatic, here it is a menu. That deletion is
documented in `register.ts` and its reasoning applies unchanged.

### What has to be decided before it comes back

1. **What counts as proof.** An administrator approving the link is the obvious answer
   and fits the machinery that now exists — Member Approvals already reviews strangers;
   reviewing "this newcomer says they are your Aunt Ada" is the same decision. An
   invitation addressed to the pre-entered person's email is the other, and needs no new
   surface at all now that invitations exist.
2. **Whether the roster should ever reach the browser.** Today it ships names and birth
   dates to anyone who has just registered with a valid family code, before anybody has
   vouched for them. Matching server-side and returning only "we found a likely match,
   ask an administrator to confirm" discloses nothing and probably suffices.
3. **What happens to the stub.** The current implementation deletes it after moving
   `user_id`, which is why the pending status has to be copied first. Any redesign
   inherits that ordering problem.

### Turning it back on

Flip the flag, and in the same commit restore the two suspended assertions in
`tests/rls/cases.mjs` — `getLinkPersonBannerData`'s positive control (it currently
returns `[]` for everyone, so its isolation assertion is vacuous while the flag is off,
and the case says so) and the positive half of
`link-person.linkPersonToCurrentUser (feature off + cross-family)`. The cross-family
half of that case is live either way and needs no change.

## Six functions have a mutable `search_path`, and one of them is SECURITY DEFINER

**Action:** set `search_path = ''` on `auth_uid_is_room_participant` first — it is the only
one of the six where this is a privilege question rather than tidiness. Carefully: see the
trap below.

**SEVEN UNTIL 2026-08-18, and it is six now:** `fund_balance_cents` has gained its
`search_path` somewhere along the way, so the list below is one longer than the advisors
report. Re-measured on that date against the local stack —
`npx supabase db advisors --local --type security --level warn` — and the survivors are
`auth_uid_is_room_participant`, `_perm_predicate`, `cancel_overdue_event_assignments`,
`set_updated_at`, `update_funds_updated_at` and `update_photo_collections_updated_at`.

Worth stating because it is the thing a reader would want to know: **every function added
since is clean.** `seed_global_lookups`, `is_genorra_staff` (both arities),
`staff_set_family_status`, `families_guard_removal`, `consume_family_removal_challenge` and
`auth_permission`'s rewrite all set `search_path = ''`, and none of them appears in the
advisors output. The six are the residue of older files, not a habit.

Found 2026-08-12 by `npx supabase db advisors --local --type security --level warn`, which
`migrate.yml` now runs against hosted on every merge. Seven `function_search_path_mutable`
findings, all WARN, so they do **not** fail the gate (`--fail-on error`). AGENTS.md claimed
"every function here sets `search_path = ''`"; that line is now corrected.

| Function | SECURITY DEFINER | Why it matters |
|---|---|---|
| `auth_uid_is_room_participant` | **yes** | Runs as its owner with RLS off, and is evaluated by **Realtime** as the subscribing role (AGENTS.md §2b). The escalation shape. |
| `_perm_predicate` | no | Central to the composed policies, but SECURITY INVOKER — runs as the caller, so shadowing it buys the caller nothing they did not have. |
| `fund_balance_cents`, `cancel_overdue_event_assignments`, `set_updated_at`, `update_funds_updated_at`, `update_photo_collections_updated_at` | no | Same: INVOKER, so tidiness rather than exposure. |

**The exposure is real but currently narrow**, and worth stating precisely rather than as a
severity label. With a mutable `search_path`, a caller who can CREATE objects in a schema
that resolves earlier than the intended one can shadow a table or function the body
references, and a DEFINER body then runs that shadow as the owner. What stops it today is
that nothing grants `CREATE ON SCHEMA public` to `anon` or `authenticated` —
`supabase/seed.sql` grants USAGE and table/sequence DML, not CREATE. So this is one missing
grant away from mattering, which is exactly the kind of thing that should not depend on a
grant nobody is watching.

**The trap, which is why this is not a two-line fix.** `SET search_path = ''` means every
reference in the body must be schema-qualified, and `20260806000012` is the worked example of
getting that wrong: it used `public.gen_random_bytes(...)` where pgcrypto lives in
`extensions`, the migration applied cleanly, and the function threw for its first caller.
plpgsql does not resolve names until the body runs. So: qualify every reference, and call the
function in the migration's verify block rather than trusting that it applied.

`auth_uid_is_room_participant` has no call site in the tree — Realtime evaluates it through
RLS — so a broken version would surface as chat silently delivering nothing, which is the
worst way to find out. Exercise it directly in the verify block.

## Function grants: what the 2026-08-06 lockdown left behind

`20260806000015` and `20260806000016` closed the anon-callable-function hole and the
reasoning is now AGENTS.md §2b. Three loose ends survived it:

* `cancel_overdue_event_assignments()` keeps its `authenticated` grant although all
  three call sites use the admin client. It is SECURITY INVOKER, so it is RLS-contained
  and confers nothing a direct UPDATE would not — kept because removing a grant nothing
  is *proven* to need was the worse trade at the time. Add a caller check, then revoke.
* `get_my_family_code()` is granted on hosted only if a hosted policy references it,
  because the lockdown derives policy-helper grants from `pg_policies` per database.
  Confirm nothing depends on it, then drop it from both.
* The suite still exercises `anon` through exactly one case. That is one more than
  before, and fewer than the role deserves.

## The idle sign-out's two remaining cross-tab behaviours are still unconfirmed

**Action:** twenty minutes with two tabs, after temporarily dropping the timer — see below.

The single-tab path is **confirmed working in a browser on 2026-08-13**: the timer fires,
the warning dialog appears for the last minute, the sign-out redirects to `/login` with its
notice, and signing back in works — which is the half that had actually shipped broken once
(`genorra:last-activity` outliving the session that wrote it). That is why the larger entry
this replaces is gone. The number is now `IDLE_LIMIT_MINUTES = 60` in
[lib/idle-timeout.ts](lib/idle-timeout.ts), matching `jwt_expiry`.

**The cross-tab sign-out is confirmed too, 2026-08-13** — a second tab follows the first out
via `genorra:idle-signed-out` rather than being left rendering a signed-in page over a
revoked session. That was the riskiest of the three, because the failure mode is silent: the
session is dead server-side and the stale tab looks fine until the next write fails.

What is **not** confirmed is the pair below — one needing an already-open dialog, the other
a second tab left alone for the whole limit. Both are why the first pass and the
click-through missed them:

* **The warning renders on top of a dialog the page already had open.** Every dialog in the
  app is `fixed z-50`, so this rests entirely on `IdleTimeout` being mounted *after*
  `{children}` in `app/(protected)/layout.tsx` — among equal z-indexes the later DOM node
  wins. Open any form dialog, wait, and watch which one is in front. Getting this wrong
  hides the warning at the one moment it is worth showing.
* **Activity in one tab keeps the other alive** (`genorra:last-activity`, written at most
  every `WRITE_THROTTLE_MS` = 5s). Without this, reading in one tab signs you out of both.

**Drop the timer to validate, and put it back.** At 60 minutes these are untestable in
practice — the keep-alive one alone needs an hour of not touching the other tab. Set
`IDLE_LIMIT_MINUTES` to **2** for the session: `WARN_BEFORE_MS` comes *out of* the limit
rather than being added to it, so 2 gives a minute of normal idling and then the last-minute
warning, and anything below 2 is a page that warns from the moment it loads. Three things
that make this safe and are worth knowing before doing it:

* **Everything derives from that one constant**, `inheritedActivity()`'s expiry rule
  included, so nothing else needs touching and nothing goes inconsistent while it is lowered.
* **The `/login` notice interpolates it**, so it will read "signed out after 2 minutes" —
  which is also the cheapest confirmation that the edit took effect at all rather than a
  stale bundle being served.
* **Revert before committing.** The value is a product decision and its comment explains the
  `jwt_expiry` tie; a 2 left in place would sign real families out mid-sentence, and neither
  typecheck nor lint has any opinion about it.

Recorded 2026-08-13, when the single-tab path was confirmed and the timer moved 75 → 60;
narrowed from three to two the same day, when the cross-tab sign-out was validated.

## `/admin/boardpositions` is the last route still on the roadmap, and it is now unblocked

**Action:** decide whether to flip `status: 'future'` → `'live'` in `lib/features.ts`. The page,
the actions and the permission resource all exist. **Read the whole of this entry first** — the
flip is one word and the review it owes is not.

Two things that were in the way are now gone. `family_roles` was EMPTY on hosted, which is what
that page reads, and `20260817000003` restored its 25 global rows. And regions and chapters — the
scoped-leadership half the board positions hang off — went live on 2026-08-18.

**What it owes before the flip, and this is the whole point of the entry.** Relighting
`/admin/chapters` on 2026-08-18 turned up eight live security holes in
`app/actions/admin/chapters.ts`: service-role deletes with no `family_code` conjunct, reads with
no permission check, an unchecked client-supplied `region_id`, a cross-family `MAX(sort_order)`.
Every one had been reachable the whole time the route said Coming Soon, because **Coming Soon
withholds a page and never an action** — now a section of AGENTS.md.

`app/actions/admin/chapters.ts` is the same module the four board-position actions live in, so
those four were swept in that pass and are already scoped and re-keyed. What has *not* been
reviewed is the page and its client component — `AdminUserRolesClient` — against §1, §5 and the
table rules. Do that, then flip.

## `family_roles.name` is UNIQUE globally, so one family can take a name from everybody

**Action:** replace `family_roles_name_key` with `UNIQUE (name, family_code)` plus a partial
unique index for the global rows (`UNIQUE (name) WHERE family_code IS NULL`), in a migration.
Do it before `/admin/boardpositions` goes live, because that page is what lets a family create
the colliding row in the first place.

`family_roles` is a hybrid table: 25 global board positions with `family_code IS NULL,
is_global = true`, and per-family custom roles alongside them. The constraint is `UNIQUE (name)`
**alone**, which is wrong for that shape in two directions at once. Two families cannot both
call a role "Reunion Treasurer", and — the sharper one — a single family creating a role named
`'President'` takes that name from the global list, so no OTHER family is ever offered it.

Nothing is broken today: hosted's `family_roles` was empty until `20260817000003` seeded it, and
`/admin/boardpositions` is still `'future'`, so there is no UI that can create a family-scoped
row. That is why this is an entry and not an incident.

**It has already cost one thing**, which is how it was found. `20260817000003`'s seeder tolerates
the collision (`ON CONFLICT (name) DO NOTHING`, deliberately) while its own §4a assertion demanded
all 25 rows be global — a self-contradiction that aborts the migration on any database where a
family has renamed a role. Fixed 2026-08-18 by testing that each name is *accounted for* and
`RAISE WARNING`-ing the collisions; the warning names this entry as the real repair.

Recorded 2026-08-18.

## `permission_table_map` names a table that does not exist

**Action:** drop the `adults` row in a migration, or say in the sweep's header that the skip
is expected. One line either way; it is here because it is easy to mistake for a bug.

`permission_table_map` carries a row for `adults`, with an `auth.uid()`-based `self_expr` —
so every migration that computes a sweep list from that table names it, and
`to_regclass('public.adults')` is NULL because `20260602000003` dropped the table.
`20260806000011` §6 handles it correctly, skipping with a `RAISE NOTICE`. Nothing is broken.

What it costs is a reader's time, twice over: a `NOTICE` in a migration log that looks like a
finding, and a raw probe written against the computed list that fails with 42P01 rather than
telling you anything. Found 2026-08-17 while writing `SWEEP_CASES`, which deliberately omits
it and says so.

## 30 eslint warnings, and whether the gate should fail on them

**Action:** triage the three groups below, then decide about `--max-warnings 0`.

The 39 **errors** are gone and the Lint step in `verify.yml` is blocking. Warnings are not,
deliberately: `npm run lint` exits 0 on them and no `--max-warnings` is set.

* **`@typescript-eslint/no-unused-vars` (22)** — the cheap half, and genuinely dead code.
  Clearing these first would make the remainder legible.
* **`react-hooks/incompatible-library` (4)** — React Compiler's correct objection to
  react-hook-form's `watch()`, which cannot be memoized safely. Not ours to fix; needs
  either a documented disable or a different form API. This is the group that decides the
  question, because it is the one that cannot simply be cleared.
* **`@next/next/no-img-element` (3)** — `<img>` in the photo gallery. A real change:
  `next/image` needs width/height or `fill`, and these are user uploads of unknown size.

`--max-warnings 0` is only honest once the middle group has an answer.

## Authorization

### Everything below came out of building `tests/rls`

(see AGENTS.md §7). The suite is green, and neither item below is an isolation failure
or blocks anything today.

### Members without a grant are told their write succeeded when it did not

**Action:** decide whether self-service writes need a default grant, or whether the
actions should stop reporting success. It is a product call, which is why it was left.

`create`/`edit`/`delete` default to scope `'none'`, and the composed RLS policies
(`20260618000001`) honour that — so a plain member's write matches zero rows. The
actions do not check how many rows they changed, and PostgREST does not treat an
empty match as an error, so they return `{ success: true }`:

| called by a member with no grants | returns | actually happened |
|---|---|---|
| `updateChild` | `{success:true}` | nothing |
| `deletePhoto` | `{success:true}` | nothing |
| `tagPersonInPhoto` | RLS error, surfaced honestly | nothing |

Verified against a local database: all three work once the caller is granted the
resource at scope `'any'`, so the cause is the missing grant and not the action. The
user-visible version of this is a parent renaming their own child, being told it
saved, and finding it unchanged on reload.

Two separable questions, and they have different answers:

1. *Should a member be able to manage their own child / their own photo without an
   administrator granting it?* If yes, seed the grants — probably in the
   `20260618000000` seed so new families get them too.
2. *Should an action ever report success for a write that changed nothing?* Almost
   certainly not, regardless of how (1) is answered. Selecting the affected rows back
   (`.select()` on the mutation) turns a silent no-op into a real failure message.

`tests/rls` currently runs these positive controls as an ALPHA administrator, so it
stays green either way. If (1) changes, switch those cases back to `alphaMember` —
that is the assertion that would then be meaningful.

### `tests/rls` does not cover the Storage-backed uploads

**Action:** extend the harness, or decide the risk is acceptable and say so.

Not covered: `uploadDocument`, `uploadPhoto`, `uploadEventPhoto`, `uploadAvatar` —
listed in `UNCOVERED` at the bottom of `tests/rls/cases.mjs`.

They take a `FormData` carrying a file and write to Supabase Storage, whose bucket
policies are a **separate access-control system** from the RLS policies the suite
exercises. Nothing in this work says anything about whether one family can read or
overwrite another's objects. Doing it properly means seeding buckets and asserting on
object paths, which is a different harness rather than three more cases.

### `dues_member_plans.start_date` is a live column nothing reads or writes

**Action:** decide whether dues prorate for a member who joins mid-period, and either
use this column or drop it.

`20260610000005_accounting.sql` gives every plan row a `start_date DATE NOT NULL DEFAULT
CURRENT_DATE`. `getMyDuesSummary` does not select it (`select('schedule_id, cadence,
opted_out')`) and `setMyDuesPlan` does not write it, so every row carries the date its
plan happened to be created and nothing has ever consulted it.

It became worth deciding on 2026-08-14, when `duesPlanMath` started itemizing arrears.
A member admitted in August is now told, on screen, that their next installment covers
the year to date. **That is not new behaviour** — `remainingBalanceCents` has always
charged them the full annual total, because nothing in this product prorates — but it
was previously a single number nobody could decompose, and it is now a sentence.

If prorating is wanted, this column is where the ladder should be floored, and **the
balance has to move with it** or the page shows two figures describing different debts.
Two traps if it goes that way: the column must be written once and never on a
re-pick, or a member could reduce their arrears by changing cadence twice; and
`dues_schedules.start_date` is FROZEN once any payment references it
(`20260807000001`), so there is no data-entry remedy for a schedule whose start date
was wrong — the derivation is the only lever.

### `notifications` may not be in the realtime publication

**Action:** run `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime';`
against hosted and record the answer.

`NotificationBell` opens a `postgres_changes` subscription on `notifications`, and
nothing in `supabase/migrations/` adds that table to the publication — the only mention
of `supabase_realtime` in the repo is a commented-out line for `chat_messages` in
`20260603000000_chat.sql`. Publication membership is database state edited by hand in
the Dashboard, so it is invisible to `npm run db:check` and to `db:audit`, and a fresh
`supabase db reset` publishes nothing at all.

Two consequences worth knowing before relying on it. The subscription may never have
fired for anyone, in which case the bell has always been updating on navigation alone
(`getNotifications` is server-rendered by `TopBar` on every page load, so the feature
works either way — which is why nobody noticed). And a realtime-based fix for anything
else would work on hosted and silently do nothing locally, or the reverse.

If it is added, guard it — a bare `ALTER PUBLICATION … ADD TABLE` raises 42710 if the
table was ever added by hand, and under `migrate.yml` a failed job holds the Vercel
alias so nothing deploys.
