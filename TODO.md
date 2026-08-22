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

### [ ] Look at the reauthentication and email-change mails on a phone

**Action:** trigger one of each and read it. There is nothing to run and nothing to push.

**The push itself is done and is now a mechanism rather than an errand.** `migrate.yml`'s one
job ends with a step named "Auth email templates match the repo", which runs
`npm run email:push -- --yes --project-ref="$PROJECT_REF"` with the `SUPABASE_ACCESS_TOKEN`
that job already holds, so the five templates reach hosted on every merge to `master` and
drift cannot accumulate again. **Both halves after the `--` are load-bearing** — npm eats a
bare `--yes` as its own flag, and without the script's copy of it the push refuses a
non-interactive shell and exits 2; `--project-ref` is what keeps the step independent of
`supabase link` having run first. It is a
no-op when nothing has changed: the script GETs the hosted config first and PATCHes only on
drift. See AGENTS.md, "Sending email is a plain module".

**What that leaves is the half a push cannot prove.** `reauthentication.html` and
`email-change.html` were the two carrying real drift, and it was not the stale `DORMANT`
comment TODO used to describe:

| | repo | hosted, until the first merge after 2026-08-19 |
|---|---|---|
| `.gn-otp` size | 28px / 0.14em, sized for the 8-character code | **38px / 0.26em, sized for six** |
| `@media` override | removed | a second, disagreeing number |

`auth.email.otp_length` is 8, and supabase/templates/README.md measures the old block at 271px
into a 182px budget — it overflows a 320px phone once Gmail strips the `<style>` block, which is
what Gmail does for a non-Gmail account. So the thing to check is a real reauthentication mail on
a narrow screen, not the bytes.

Reauthentication is the awkward one to trigger deliberately: it needs a session older than
GoTrue's 24-hour window, or `secure_password_change` on hosted (the item above). Email change is
a Sign-in & Security away.

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

## `20260820000010` has not reached hosted, and the code already asks for its column

**Action:** merge to `master` so `migrate.yml` applies it. Nothing else, and no code change —
in particular do not make the select tolerate a missing column.

`gatherings.photo_path` was added on 2026-08-21 for the Dashboard band's photograph, and the
same commit widened two selects to ask for it — `GATHERING_SELECT` in
[app/actions/gatherings.ts](app/actions/gatherings.ts) and the admin one in
[app/actions/admin/gatherings.ts](app/actions/admin/gatherings.ts). Migrations reach hosted
from CI on merge and by no other route (AGENTS.md, "How migrations reach the hosted project"),
so a dev server pointed at hosted is running code ahead of the schema **right now**: PostgREST
answers 42703 and kills the WHOLE query rather than that one column, so `getPremierGathering`
returns null and the premier band silently disappears. Six reads are affected —
`getGatherings`, `getGathering`, `getPremierGathering`, `getUpcomingGatheringCount` and both
admin list and detail reads.

This is Phase 3's incident in miniature and it is self-clearing: the ordering CI enforces for
production (old code serves while the migration applies, new code is aliased afterwards) is
exactly what a laptop pointed at hosted opts out of. Recorded because the symptom — a band that
vanished — looks nothing like the cause, and because the fix is to land the migration rather
than to soften the read.

Confirm afterwards with `npm run db:check -- --linked`.

Recorded 2026-08-21.

## Confirm the realtime publication on hosted after the merge

**Action:** one query, once, after `20260821000002` has been applied by CI:

```sql
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- expect exactly: public.chat_messages, public.notifications
```

**The defect this replaces is FIXED, and it was worse than the entry that used to sit here
guessed.** The `supabase_realtime` publication held **zero tables** — measured on 2026-08-21 —
so all three `postgres_changes` subscriptions in the product had been receiving nothing since
the day each shipped: the notification bell, chat's per-room thread, and chat's unread tracker.
`20260821000002` publishes both tables, guarded against 42710 for the databases where somebody
may have toggled one by hand, and `npm run realtime:check` proves an event actually arrives and
that RLS withholds one addressed to somebody else.

**Why anything is left to do.** Publication membership is PER-DATABASE. The migration reaches
hosted from CI on merge like everything else, so nothing needs doing by hand — but this is the
one class of change where local being right says nothing about production, because the
dashboard is the normal way it is done and the repo cannot see whether anybody did. One look
closes it.

**And it is worth looking rather than assuming, because hosted may have MORE than these two.**
A table toggled on in the dashboard months ago is published on hosted and on no laptop, which
is the divergence in the other direction — a feature that works in production and silently
does nothing in development. If the query returns a third table, that is what has been found;
add it to `20260821000002`'s list in a new migration rather than leaving it undeclared.

Recorded 2026-08-21.

## Sorting is on two tables of sixteen

**Action:** work through the list. The pattern is proven and each table is three lines.

`lib/sort-rows.ts` (pure, 18 tests, eight mutations measured) plus `useTableSort` and `SortTh`
in [components/ui/sortable-header.tsx](components/ui/sortable-header.tsx) are the mechanism, and
they are done. What is left is applying them.

**Has sorting:** `MemberDirectoryClient` and `AdminAccessClient` — the pair AGENTS.md requires
to stay in lockstep, four matching columns each — plus `DuesPlanSection` and
`PaymentHistorySection`, which sorted before any of this existed and now share the module.

**Still to do**, and it is mechanical:

| | |
|---|---|
| Accounting | `AdminFundsClient`, `AdminIncomeClient`, `DuesProjectionsClient` |
| Admin | `AdminRegionsChaptersClient`, `AdminBoardPositionsClient` |
| Gatherings | `AdminGatheringsClient`, `AdminGatheringTemplatesClient`, `AdminGatheringDetailClient`, `GatheringDetailClient` |
| Money | `TransactionsClient` |
| Community | `BirthdaysPane` |
| Staff | `StaffFamiliesClient`, `StaffAccountsClient`, `StaffAccessClient` |

**Out of scope and not oversights:** `DonutChart` and `MonthCalendar` use `<th>` for a chart
axis and a weekday header, and `components/ui/table-collapse.tsx` is the shared primitive
rather than a table. None of the three has rows to order.

**Two things to carry into each one**, both learned on the first two rather than guessed. Sort
the value the cell is BUILT from, never the string it prints — a money column sorts on
`amount_cents` or "$9.00" lands after "$10.00", and a date sorts on `YYYY-MM-DD` or the column
orders by month name. And where a column is composed in the browser rather than carried on the
row, sort through the SAME lookup the cell renders from: Members & Access's Position reads
`board.holders`, because `MemberSummary` has no title on it.

**One asymmetry is deliberately unresolved.** Both member tables sort Name on the DISPLAYED name
rather than on surname, which is the less useful order — `MemberRecord` has `last_name` and
`MemberSummary` carries a pre-joined `name`, so surname order on both needs `lastName` added to
`MemberSummary` server-side. Until then the two agree, which is what "a table is a table" is
about. Both call sites say so; if that field is ever added, move both.

Recorded 2026-08-21.

## The family tree's second pass

**Action:** none blocking. An ordinary backlog against a finished feature — the beta badge
came off on 2026-08-13 and nothing here is a caveat a member needs warning about.

* **`person_relationships.is_step` is dead weight and should be dropped.** `link_kind`
  (`20260813000007`) superseded it — four values, `blood | step | adopted | foster`, set when
  a relative is added and afterwards through the manage dialog, and it is what the Bloodline
  toggle walks. `is_step` is written by nothing and read by nothing, and two columns
  describing one fact is how they come to disagree (AGENTS.md §4c says so). Its own
  migration, and see `20260813000006` for how much care a column drop wants.
* **Dates on the connectors**, and a person card that says more than a name and a status.

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

## RESOLVED 2026-08-22: five functions had a mutable `search_path`

`20260822000010` sets `search_path = ''` on all five — `_perm_predicate`, `set_updated_at`,
`update_funds_updated_at`, `update_photo_collections_updated_at` and, the one that mattered,
`auth_uid_is_room_participant`, which is SECURITY DEFINER and is evaluated by **Realtime** as
the subscribing role.

Two things from the old entry are worth keeping because they are what made this a migration
rather than a five-line edit, and the next function that needs pinning will need both.

**The trap.** `SET search_path = ''` means every reference in the body must be
schema-qualified, and plpgsql does not resolve names until the body RUNS — so a broken version
is created without complaint and throws for its first caller. `20260806000012` shipped exactly
that (`public.gen_random_bytes` where pgcrypto lives in `extensions`) and applied cleanly. The
migration therefore CALLS both callable bodies in its verify block rather than asserting the
catalogue, and `auth_uid_is_room_participant` is exercised first precisely because it has no
call site in the tree: a broken version surfaces as chat silently delivering nothing.

**The exposure was real and narrow, and it is worth knowing which.** With a mutable path, a
caller who can create objects in a schema that resolves earlier shadows a table the body
references, and a DEFINER body runs the shadow as its owner. What held it shut was that
nothing grants `CREATE ON SCHEMA public` to `anon` or `authenticated` — one missing grant away
from mattering. The other four were INVOKER, so tidiness rather than exposure.

The verify block asserts **no function in `public` has a mutable path**, so a new one arrives
pinned or the migration chain refuses to apply. Every function added since 2026-08-12 was
already clean; that assertion is what keeps it true.

## The advisors: what is left, and why each one is a decision rather than a fix

**Action:** enable leaked-password protection in the dashboard (below). Nothing else here is
work; the rest of this entry exists so nobody re-litigates findings that are by design.

Measured 2026-08-22 against hosted (`npx supabase db advisors --linked --type all --level
info`) and against a fresh local `db reset`, and the two were DIFFED — which is the part worth
copying, because eight of that day's findings existed only on hosted and no repo-side check can
see them. `20260822000011` reconciles that drift and says how it was found.

What five migrations closed: `function_search_path_mutable` (5), `multiple_permissive_policies`
(11), `auth_rls_initplan` (10, plus five the lint did not report), `duplicate_index` (4) and
`unindexed_foreign_keys` (69). What remains:

* **`auth_leaked_password_protection`, one WARN, and the only one that needs a person.**
  GoTrue can refuse a password that appears in a HaveIBeenPwned breach. There is no
  `config.toml` key for it — the Management API field is `password_hibp_enabled` and the route
  is Authentication → Sign In / Providers → Password. It is NOT pushed from the repo because
  `supabase config push` would carry `site_url` with it. The reasoning is beside
  `password_requirements` in `config.toml`. Note while you are there that
  `minimum_password_length` is 6, which is the CLI default and not a considered number.

* **`authenticated_security_definer_function_executable`, 27 WARN, and every one is
  deliberate.** This is AGENTS.md §2b as a report: a SECURITY DEFINER function that
  `authenticated` may execute is a public HTTP endpoint, and in this product that is the
  DESIGN — grants are the primary control and the bodies re-derive the caller. Audited
  function by function on 2026-08-22 and all 27 are correctly granted: the `auth_*` and
  `election_*` helpers are named in RLS policies, so the grant is load-bearing (revoke
  `auth_family_code()` and every authenticated query in the app dies with "permission denied
  for function"); the other 13 are called with the USER client — `createClient()`, checked at
  each call site — because they need `auth.uid()` from the request's JWT. There is nothing to
  revoke and nothing to fix. **`anon_security_definer_function_executable` (1) is
  `peek_family_invitation`, granted to `anon` on purpose:** somebody following an invitation
  link has no session yet.

* **`rls_enabled_no_policy`, the two INFO.** `genorra_staff` has RLS enabled and ZERO policies
  because that is the whole mechanism — staffness is resolved on the server through the
  service role and there is no client-side check to spoof (AGENTS.md, "Three words"). Same for
  `family_removal_challenges`: the challenge is minted in TypeScript and consumed by
  `consume_family_removal_challenge`, and the browser must never read a hash it could compare
  against. Both are the §2c pattern working as intended, and both would be a finding if they
  ever gained a policy.

* **`unused_index`, and it got LOUDER on purpose — 15 findings locally became 88.**
  `20260822000014` created 73 foreign-key indexes, and an index on a database with no traffic
  has by definition never been scanned. This is not a regression and must not be "fixed" by
  dropping them: index-usage counters on a product no family is using yet measure nothing, and
  Postgres does not index the referencing side of a foreign key, so without them one parent
  delete seq-scans the child table once per row. **The review this deserves is after there are
  families**, against `pg_stat_user_indexes` on hosted, and it is a review rather than a fix.

## Function grants: what the 2026-08-06 lockdown left behind

`20260806000015` and `20260806000016` closed the anon-callable-function hole and the
reasoning is now AGENTS.md §2b. Two loose ends survive it:

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

## `setTemplatePermission` takes a scope from the client and validates it against nothing

**Action:** validate the `(resourceKey, action, scope)` triple against
`permission_resources.actions` and the no-owner rule, server-side. It is every key's problem,
which is why it is here rather than in the commit that found it.

`setTemplatePermission` (`app/actions/admin/permissions.ts`) upserts whatever `scope` the client
sent. Members & Access decides which switches to DRAW through `scopesFor()` in
`components/admin/resource-groups.ts` — that is where `NO_OWNER_KEYS` lives, and where
`transactions/*` has its `'own'` dropped — but nothing on the server reads either. So a caller
holding `admin/users/templates:edit` can POST a scope the grid refuses to offer, on any key.

**What it costs is a screen nobody can diagnose**, and `/admin/boardpositions` is the worked
example. Store `view = 'own'` for that key and every member on the template passes
`requireView` (which is `can()`), while every read behind the page is `requireScope`
(`canAny`) and answers `[]` — a permanently empty screen whose switch the grid no longer
renders. That page now guards itself with an extra `canAny` line for exactly this reason;
seven other keys on `NO_OWNER_KEYS` do not, and neither does the `transactions/*` prefix.

**The fix is a small refactor rather than a line**, which is the other reason it is here:
`scopesFor` and `NO_OWNER_KEYS` live in a `components/` module that imports a TYPE from the
action that would have to import them back, so the rule wants moving into `lib/` first — the
shape `lib/board-positions.ts` took on 2026-08-19 for the same reason. Then one check in the
action, and one `tests/rls` case per refused scope.

Found 2026-08-19 by review, while flipping `/admin/boardpositions` live.

## `tests/rls` has no actor holding scope `'own'`, so no `own_expr` in the schema is tested

**Action:** add a fifth ALPHA actor on a THIRD permission template — one whose grid holds `view` at
scope `'own'` on a resource with a real `own_expr` — and give the existing cases a variant that
uses it. `gatherings` (`own_expr = created_by`), `gathering_tasks` and
`gathering_task_submissions` (`assignee_id` / `submitted_by`, which are also their `self_expr`),
`announcements`, `photos` and `chat_messages` are all waiting for it.

Found on 2026-08-19 while writing the Gatherings cases, and measured rather than assumed. The
fixture gives each family exactly two grids — Administrators, and General with
`gatherings:view = 'any'` — so **every read in the whole suite is satisfied by the `= 'any'`
disjunct** and the `'own'` and `self` branches of every composed policy decide nothing. The proof is
a mutation: neutering three membership gates at once leaked through `auth_permission()` resolving
`'any'` from the applicant's own template, never through `self_expr`.

This is not specific to Gatherings, and it is worth stating plainly what the green suite does
and does not mean: **625 assertions are evidence about CROSS-FAMILY ISOLATION**, which is what
the suite was built for and what `20260618000001`'s composed policies most needed checking.
They are almost no evidence about SCOPE RESOLUTION. Those are different questions, and the
second one has no runner — `lib/auth/permissions.ts`'s `resolveScope` is pure enough to test
under vitest, which may be the cheaper half of this.

**"ALMOST" SINCE 2026-08-20, and the exception arrived as a side effect rather than as work on
this entry.** `20260820000007` gave the General template `review/photos:delete` at scope
`'own'`, so `alphaMember` and `alphaOther` genuinely hold an `'own'` grant now — and
`photos.deletePhoto (a photo they did not upload)` is the first case in the file whose refusal
comes from an `own_expr` (`uploader_id = auth_person_id()`) rather than from a missing grant.
Mutation-checked by neutering that conjunct in the composed policy, which turns it red.

That is one resource, on one action, and a DELETE. What is still missing — and what the fifth
actor is really for — is an `'own'` grant on a resource with a **read** to narrow, which is
where a wrong `own_expr` would quietly hand over rows instead of quietly refusing them.

Recorded 2026-08-19; narrowed 2026-08-20.

## Photo thumbnails download at full size

**Action:** pick one of the three below. It is an infrastructure decision, not a code change.

`npm run lint` is `eslint --max-warnings 0` since 2026-08-20 and the Lint step in
`verify.yml` blocks on a single warning. What that closed was the *reporting* question; this
is the thing the last of those warnings was actually pointing at, and it is real.

`/review/photos` renders a grid of thumbnails at a quarter width, and each `<img>` fetches
the **whole uploaded file** — `uploadPhoto` caps at 10 MB, so a twenty-photograph album can
be 200 MB of downloads to show twenty thumbnails. On a phone, on a family's data plan.

**Why a plain `<img>` was the right pick anyway, and is not the problem.** Every `next/image`
in this tree is a STATIC import of a file in the repo; there is no `images.remotePatterns` in
`next.config.ts` at all, and `components/ui/Avatar.tsx` had already made the same call for the
same class of image — a member's upload in a public Supabase bucket, remote, unknown intrinsic
size. Reaching for `next/image` to clear a lint warning would have introduced the first remote
image pipeline in the product as a side effect of a tidy-up. The three sites now carry a
disable **with the reason written next to it**, which is what makes this entry findable.

Three ways out, and each has a real cost rather than a caveat:

1. **`next/image` with `images.remotePatterns`.** Standard, and it fixes it properly —
   resizing, lazy loading, modern formats. Costs: a pattern derived from
   `NEXT_PUBLIC_SUPABASE_URL`, which means `next.config.ts` (which *ships inside the build* —
   see its own header) gains an environment-dependent rule; and every family photograph goes
   through Vercel's **metered** optimizer.
2. **Supabase Storage image transformations** — `getPublicUrl(path, { transform: { width } })`.
   Resizes at the source, so no remote patterns and no Vercel metering, and it keeps the plain
   `<img>`. Costs: it is a **paid** Supabase add-on, and the container that serves it is
   `imgproxy`, which is **not running** in this local stack (`supabase status` lists it under
   "Stopped services") — so it would work on hosted and silently 404 on every laptop, which is
   the divergence this repo dislikes most.
3. **Generate a thumbnail on upload.** `uploadPhoto` writes a second, small object beside the
   original and `photos` gains a column for it. No new dependency, no metering, works
   identically everywhere. Costs: the most code, and it does nothing for the photographs
   already uploaded without a backfill.

**(3) is probably right for this product** — a family gallery's thumbnails never need to be
recomputed, so paying per-render for something that could be computed once is the wrong shape.
Nobody has decided, which is why this is here.

**The lightbox should keep its `<img>` under every option.** Somebody has clicked a
photograph in order to look at it, so the full-size file is the point; and it has no fixed box
to fill, which is exactly what `next/image`'s `fill` cannot express.

## Authorization

**Nothing open.** This section held the findings that came out of building `tests/rls`
(see AGENTS.md §7), and both of them are closed as of 2026-08-21:

* `notifications` possibly not being in the realtime publication. The publication held no
  tables at all; `20260821000002` fixed it, and the per-database confirmation that survives
  is not an authorization question and has its own entry above.
* `saveChapterAndPropagate` never moving a member's account-less children — a write on the
  user client against a policy that admitted only the caller's own row, so it matched nothing
  and said nothing. `lib/chapter-propagation.ts` is the repair, shared with the administrator's
  new `setMemberChapter`, and `personal-info.saveChapterAndPropagate (the children follow)` is
  the first assertion anywhere that the propagation happens at all. AGENTS.md §8b carries what
  the fix cost, including a fixture that turned out to be resting on the bug.

The heading stays because the next finding of this shape belongs under it.

