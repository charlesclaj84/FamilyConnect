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

### [ ] An unconfirmed account is a dead end

**Action:** decide whether the app offers to resend a confirmation, or whether this is a
support case handled by hand.

Email confirmation is on and working on hosted, which is what makes this live rather than
hypothetical: an account that registered and never clicked the link **cannot sign in at
all**, and nothing in the app offers to resend. The member sees a failure with no route
out, and the only fix today is somebody with dashboard access.

`/login` is where they end up, so that is where the offer belongs. Two things to decide
before building it: whether an unauthenticated "resend to this address" endpoint is
acceptable (it discloses whether an address has an account, and it is a mail-sending
endpoint reachable by anyone — rate limiting is not optional), and whether it should
instead be surfaced only after a failed sign-in, which narrows both problems.

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

## The migration pipeline's `workflow_dispatch` path has never been exercised

**Action:** run it once from Actions → Migrate → Run workflow on `master`, and watch what
Vercel does with the build.

`migrate.yml` offers `workflow_dispatch` so a failed run can be retried without an empty
commit. The reasoning is that a re-run writes a fresh commit status, and a fresh status is
what Vercel's `Database migrations` Deployment Check is watching — so a held build should
release. **That is reasoned from the docs, not observed.** The normal push path is verified
end to end; this one is not.

Worth knowing before you need it during an incident, which is the only time anybody reaches
for it. If a dispatch does *not* release a held build, `Force Promote` on the deployment is
the escape hatch, and this section should be rewritten to say so.

Two things to check while doing it: that the environment's deployment branch rule still lets
`master` through (a dispatch from any other ref should get no credentials at all, which is
the point of that rule), and that the run appears in the Environments tab like a push does.

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

## A family cannot be deleted

**Action:** decide what deleting a family *means* before building it — the schema will
not do it for you.

**The rename half shipped 2026-08-12** and is no longer open. What it left behind that
this half will build on, so it is not rediscovered:

* **A family settings surface exists.** `/admin/family`, registered by
  `20260812000000` as the resource `admin/family` — `'restricted'` per family, `view`
  and `edit` only. A delete would be a third action on that key (or a key of its own,
  if the family wants to hand out renaming without handing out destruction, which is
  probably the right call and is a product decision nobody has made).
* **`families` now has an UPDATE policy**, `family renamed by settings admins` — the
  second policy the table has ever carried. It tests
  `auth_permission('admin/family','edit') = 'any'` rather than `auth_can()`, because a
  family has no owner and `'own'` must not be a way in.
* **`family_code` is immutable.** `families_guard_family_code` refuses any change to
  it, for every role. That is the *rename* half of the same problem this section is
  about: 34 tables carry the code and none has a foreign key back, so re-keying a
  family would silently empty it. A delete has to reckon with the same absence.

### Deleting is the dangerous half, and the schema does not help

**34 tables carry `family_code`, and not one of them has a foreign key to `families`.**
So `DELETE FROM families WHERE family_code = …` removes exactly one row and orphans
everything else — no cascade fires, because there is nothing to cascade from. The
obvious implementation leaves every dues payment, fund, chat room and member row in the
database, invisible to the app and belonging to a family that no longer exists.

Two places the schema does anticipate it, both worth reading first:

* `funds_protect_system` releases a system fund for deletion **only** once the
  `families` row is gone. That is the intended order — family first, then the sweep —
  and it is the one spot where family deletion is designed for rather than overlooked.
  `20260812000000`'s verify block is that order run in miniature, against a throwaway
  family it creates and removes: families, then funds, then the templates. It is four
  lines and it is the only worked example of the sequence in the tree.
* The append-only ledgers (`dues_payments`, `fund_disbursements`, `20260806000002`)
  refuse a delete except as the cascade from a person or fund already gone. A sweep
  either runs in dependency order or stands those guards down deliberately.

[supabase/scripts/reset_families.sql](supabase/scripts/reset_families.sql) already
carries that sweep for the data half and deliberately keeps the `families` row. A real
delete is that list, plus the row, plus the family's templates, `resource_visibility`
and system fund. Read it before writing a third copy of the list — and note its §11,
which exists because a hand-written list of tables goes stale the moment a migration
adds one. It already did: `donation_beneficiaries` (`20260811000000`) landed between
that script being written and being run.

Two product questions to settle before any of it is built:

1. **Does deleting a family delete its members' accounts?** It must not. Membership is
   many-to-many since `20260617000000`, so an account can belong to several families;
   deleting one family has to delete its `people` rows and leave `auth.users` alone, or
   removing a test family signs somebody out of their real one.
2. **Is there an "archived" state, or only gone?** There is no half-way house today: a
   family with no members is *unreachable*, not merely empty, because every page resolves
   the caller through a people row and `families.created_by` nulls itself when that
   account goes. Anything short of a full delete needs a state that does not exist yet.

## Seven functions have a mutable `search_path`, and one of them is SECURITY DEFINER

**Action:** set `search_path = ''` on `auth_uid_is_room_participant` first — it is the only
one of the seven where this is a privilege question rather than tidiness. Carefully: see the
trap below.

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

## The inactivity sign-out is only half exercised in a browser

**Action:** the three unverified behaviours below, each about two tabs or a dialog.

[components/layout/IdleTimeout.tsx](components/layout/IdleTimeout.tsx), added 2026-08-12:
`IDLE_LIMIT_MINUTES` (75) without keyboard or pointer activity signs the member out with
`signOut({ scope: 'local' })` — a real revocation, not just a cleared cookie — and sends
them to `/login` with a notice and a `?next=` back to where they were. A warning dialog
appears for the last minute with an "I'm still here" button.

**A first click-through on 2026-08-12 fired the timeout correctly and then could not sign
back in** — every attempt bounced straight back to `/login` about a second later. The cause
was `genorra:last-activity` outliving the session that wrote it: the timeout left a
75-minute-old marker in `localStorage`, and the next signed-in page adopted it at mount and
expired on its first tick. Fixed by `inheritedActivity()` refusing an expired marker, plus
`clearIdleActivity()` on every sign-out and `markIdleActivity()` on every sign-in; the
reasoning is in AGENTS.md under "The shared marker belongs to one session". **That fix is
verified as a boundary function (13 cases) and not yet in a browser** — re-idling a tab and
signing back in is the first thing to check.

What **is** verified: the timeout firing and redirecting, with the notice on `/login`; the
active/warn/expired boundary and the marker-adoption rule, both as pure functions in
[lib/idle-timeout.ts](lib/idle-timeout.ts). Build, typecheck and lint are clean.

What is **not**, because this checkout has no browser driver and adding one was not in
scope — all three need two tabs or an open dialog, which is why the first pass missed them:

* the warning appearing **on top of** a dialog a page already had open — it is mounted after
  the shell for exactly this reason, and every dialog in the app shares `z-50`;
* a second tab not signing itself out when the first one times out (`genorra:idle-signed-out`);
* activity in one tab not keeping the other alive (`genorra:last-activity`, throttled to 5s).

75 minutes is a product decision, not a derived number — one place, and the notice on
`/login` interpolates it so the sentence and the timer cannot drift. It was 10 for the
afternoon it was built, which was too aggressive for pages people genuinely sit and read.
Worth revisiting once real families are using it, against complaints rather than taste.

**One interaction to keep in mind if that number moves:** 75 is above `jwt_expiry` (3600s),
so an access token expires partway through an idle stretch and `autoRefreshToken` renews it.
That is why the page is still alive when the timer fires. It is also, measured, why
`[auth.sessions] inactivity_timeout` can never do this job — AGENTS.md's idle-timeout
section states it and the full results are in `config.toml` beside the block.

## Phase 3 leftovers

Phase 3 (join a family by code, behind an approval gate) shipped and is on hosted. Three
things it owed are still owed:

1. **The §6 sweep has no test through an action, by construction.** What it closes is
   reachable only by calling PostgREST directly with an applicant's JWT, and `tests/rls`
   calls exported actions. Standing in for it: §8 of the migration recomputes the swept
   table list and RAISEs if any policy on any of them lacks the conjunct, so a sweep
   that matches nothing fails the deploy. A raw-query harness is the real answer and is
   not built — recorded in `UNCOVERED` in `cases.mjs`.
2. **The fail-closed default for admin resources is still unbuilt.** Blocker 4's
   stronger fix — deny `view` on an unregistered or unset `category='admin'` key rather
   than allowing it — needs `auth_permission()` and `resolveScope()` changed together,
   and would mean `admin/approvals` could not have been born world-readable in the first
   place instead of being backfilled out of it. Every admin key is currently correct by
   backfill, which is a state that has to be re-established by hand each time one is
   added.
3. **A `people` row can still be moved between statuses by the service role.** By
   design — `link-person.ts` needs it and `tests/rls` seeds with it — but it means the
   guard is a boundary around the `authenticated` role, not around the column. Any new
   service-role write to `people` owes the same look `updateUserProfile` just got.

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
