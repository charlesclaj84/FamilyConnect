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

### [x] Turn on email confirmation — DONE 2026-08-12

**On and working on hosted.** Confirm-email is enabled, and all five templates are pushed
from this repo rather than pasted.

Verified rather than asserted, because this box has been the difference between "we
emailed them and they clicked it" meaning something and meaning nothing:

* `GET /auth/v1/settings` on the hosted project answers `mailer_autoconfirm: false` —
  i.e. confirmation is required. A real account created 2026-08-11 22:29:25Z carries
  `confirmation_sent_at` stamped and `email_confirmed_at` null, which is the shape only a
  confirming project produces.
* `https://www.genorra.com/auth/confirm` with no token 307s to
  `/login?error=That confirmation link is not valid…`, so the `token_hash` route is live
  on the real host and the fragment trap is not in play.

The five templates are pasted (Charles, 2026-08-12), and **pasting is no longer how they
get there**: [scripts/auth-templates.mjs](scripts/auth-templates.mjs) pushes them over the
Management API, so [supabase/templates/](supabase/templates/) is the source of truth in
the mechanical sense rather than the aspirational one.

```bash
SUPABASE_ACCESS_TOKEN=sbp_… npm run email:check   # exit 1, with a diff, if hosted drifted
SUPABASE_ACCESS_TOKEN=sbp_… npm run email:push    # make hosted match the repo
```

It sends ten fields — a subject and a body per template — and refuses to transmit
anything outside `mailer_subjects_*` / `mailer_templates_*_content`, which is what makes
it safe against production where `supabase config push` is not (see below). `config.toml`
still wires up the local stack and remains the one place a template is declared; the
script reads that same table. Editing a file here still does nothing to production until
somebody pushes it and sends themselves a real signup — the difference is that checking
is now one command instead of a memory.

The dormant three matter for the same reason they always did — every GoTrue default links
with `{{ .ConfirmationURL }}`, which returns the session in a URL fragment this
cookie-based app never sees.

**The product may now be described as email-verified.** One consequence worth knowing,
because it is now a live support case rather than a hypothetical: an account that
registered and never clicked the link cannot sign in at all, and nothing in the app
offers to resend the confirmation. See "An unconfirmed account is a dead end" below.

* Authentication → URL Configuration → site URL and redirect allow-list set to the
  **production** origin — `https://genorra.com` since 2026-08-10, with
  `https://genorra.com/**` on the allow-list. `{{ .SiteURL }}` is what the link in the
  email is built from.

  The vercel.app host must **redirect** to the domain rather than keep serving the app.
  Two live origins is the fragment bug in a different costume: the link in the email is
  built from one origin, `/auth/confirm` writes the session cookie there, and a redirect
  mid-flight lands the user on the other one signed out.

  **Done in code, 2026-08-11** — `next.config.ts` 308s every path on
  `genorra-kappa.vercel.app` to `https://genorra.com`, path and query preserved.
  Verified against `next start` on all four cases that matter: the alias redirects,
  the apex does not (a rule that loops here is a total outage, so the config also
  asserts the two hosts differ and fails the build if they ever stop differing), and
  preview hosts are untouched because `has.host` is an exact match.

  **Settled 2026-08-12, and the arrangement changed — read this before touching a
  redirect.** `https://genorra.com` is canonical and serves the app directly (verified:
  200, no redirect). The two duplicate hosts are handled below the app:

  | Host | What it does now |
  |---|---|
  | `genorra.com` | Canonical. Serves production. |
  | `www.genorra.com` | 308 → `genorra.com`, in Vercel's domain config. Verified on the real host. |
  | `genorra-kappa.vercel.app` | The **dev branch's** preview site. Not production. |

  So `PRODUCTION_ORIGIN`, `site_url` in `supabase/config.toml`, the dashboard Site URL and
  every canonical/OG URL all name the apex, and the apex is what visitors get. All four
  agree, which is what this section was previously wrong about — for a while the apex 308'd
  to **www**, so every one of them advertised a URL that redirected.

  **The `next.config.ts` host redirect is GONE, deliberately, and must not come back.** It
  used to 308 `genorra-kappa.vercel.app` to production. That config ships *inside the
  build*, so once the alias started serving the dev branch the rule would have 308'd every
  request away from the deployment it exists to let you test. A host redirect can only live
  in `next.config.ts` while its source host serves no deployment of its own; once it does,
  the rule belongs in Vercel. `LEGACY_VERCEL_HOST` went with it.

  What still covers the search half: `IS_INDEXABLE_DEPLOYMENT` is false for anything that
  is not the production deployment, so the dev site publishes `Disallow: /` and no sitemap.
  Honest gap: a URL indexed under the old alias no longer 308s anywhere — it serves the dev
  branch, which disallows crawling. Acceptable, because the alias was never advertised in
  any email, sitemap or canonical.

**Do not do this with `npx supabase config push`.** It sends the whole `[auth]` block,
including `site_url = "http://127.0.0.1:3000"` from the local config — production would
start mailing people links to their own laptop.

Sending itself is no longer the blocker: hosted has sent through Resend
(`support@genorra.com`) since 2026-08-10, with `email_sent` raised in the dashboard. The
`[auth.email.smtp]` block in `config.toml` stays **commented out** deliberately — see the
comment above it; uncommenting takes local development off Mailpit and starts mailing
real addresses out of `db reset` and the RLS fixture.

### [ ] `secure_password_change` is `false` on hosted — one dashboard switch

**Action:** Authentication → Providers → Email → turn on "Secure password change" on the
hosted project. No code change does this, and nothing in the repo can detect it.

`config.toml` has said `true` since 2026-08-11, with a carefully measured matrix beside
it; the whole of "Password change: what protects it" below is written on that premise.
All of it describes the **local** stack. On hosted the flag is off, so no reauthentication
code is required to change a password at **any** session age — not merely inside GoTrue's
24-hour freshness window, which is the caveat the repo already knew about and took to be
the whole story. `GET /v1/projects/<ref>/config/auth` answers
`security_update_password_require_reauthentication: false`; re-read it after flipping.

Found 2026-08-12 by a read-only sweep comparing every `[auth]` key `config.toml` declares
against that endpoint. Eighteen keys, three divergences; the other two are closed —
`otp_length` is now 8 in both, and `max_frequency`'s 1s/60s split is deliberate and now
says so in `config.toml`. This one is the residue, and it is the same failure the template
sync was built to stop, one field over: written in `config.toml`, verified locally, never
applied to the project that serves real families.

**`scripts/auth-templates.mjs` will not grow into a checker for this**, deliberately. It
reads and writes nothing but the ten mailer fields; the moment it can write `site_url` it
inherits every hazard `config push` has. A separate read-only auditor over the whole
`[auth]` block is the right shape and is not built.

### [ ] Retire Claude's write access to the hosted database

See "Claude may write to the hosted database unprompted" below — it is dated rather than
launch-gated, but shipping with an agent holding unprompted `db push` on production is a
decision, not an oversight.

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

## Password change: what protects it, and the part that cannot be protected

**Action:** decide about `[auth.sessions] inactivity_timeout` for absolute staleness (item 2
below). Everything else here is done and measured.

Filed as "a nonce-free path for fresh sessions", which described the mechanism accurately
and pointed at the wrong repair. Reframed, fixed and measured 2026-08-12.

### The window is real, there is no knob, and no app-side check can close it

`secure_password_change = true` since 2026-08-11, and GoTrue reads its own setting as
"reauthenticate **or have logged in recently**". Recently is `session.created_at + 24h`, a
constant in GoTrue rather than a setting — nothing in `config.toml` exposes it, and the
measured matrix beside the flag is what that constant looks like from outside. So for the
first day of any session the emailed code is sent, typed in, and not checked; a
deliberately wrong one still changes the password.

**The part worth being clear about, because it was got wrong once while writing this:** the
current-password field does *not* close that window. `PUT /auth/v1/user` is a public GoTrue
endpoint that accepts the browser's session token, so anybody who can open devtools can
change the password without loading our form. A check that runs on the attacker's side of
the wire is not a gate, and moving it into a server action would not help — GoTrue's
endpoint stays reachable either way.

So: within 24 hours of a session being created, a person holding that session can change the
password, and that is a property of GoTrue we host rather than a bug we can patch. What is
left is making the realistic version of the attack harder, not overclaiming on screen, and
making the change recoverable by evicting other sessions.

### What was done, 2026-08-12

* **A current-password field on the Password panel**
  ([SignInSecurity.tsx](components/personal-info/SignInSecurity.tsx)). Verified against a
  throwaway client (`createPasswordCheckClient` in [lib/supabase/client.ts](lib/supabase/client.ts))
  so the live session is untouched — and specifically **not** against the app's own client,
  because signing in on that one replaces the session, and a new session's `created_at`
  resets the 24-hour clock, which would switch the emailed code off for good. Verifying the
  password on the wrong client would have disabled the other half of the gate on the way
  past. Browser-side on purpose: the password reaches GoTrue over TLS exactly as at sign-in
  and never touches our server, and no new `'use server'` export means no new endpoint that
  accepts password guesses.

  What it buys, at its true worth: it stops somebody who sits at an unlocked screen and uses
  the product, which is the realistic version of this threat. It stops nobody who opens
  devtools.

* **Other sessions revoked** — `signOut({ scope: 'others' })`, kept although the probe below
  proved it redundant, so the guarantee the copy states belongs to a line in our code rather
  than to an undocumented GoTrue internal.

* **Copy that matches.** The panel used to promise "a password cannot be changed by someone
  who simply found your screen unlocked", which is more than either proof delivers, and the
  success message said "It applies the next time you sign in", which implied the opposite of
  what the eviction guarantees.

* **`SignOutButton` was signing members out of every device.** Plain `signOut()` defaults to
  `scope: 'global'`, so Sign Out on a laptop also signed out the phone, with nothing on
  screen suggesting it would. Now `'local'`. Same rule `InviteMismatchActions` already
  stated; the password panel's `'others'` is the deliberate exception.

* **A ten-minute inactivity sign-out** — see the next section, which is the mitigation that
  actually addresses an unattended screen.

### Measured 2026-08-12, local stack, 8/8 as expected

The probe is not kept as a test — `tests/rls` is about family isolation and this is GoTrue
behaviour — so the results are recorded here instead:

| Question | Answer |
|---|---|
| Wrong current password refused, identifiably? | yes — `code=invalid_credentials`, status 400 |
| Right current password accepted? | yes |
| **Does GoTrue revoke other sessions on password change by itself?** | **yes**, unprompted |
| Does the changing session survive its own change? | yes — the member is not bounced |
| Does `scope: 'others'` sweep the throwaway check session? | yes |
| Does it evict another device? | yes |
| Does it leave this browser signed in? | yes |

The third row is the one that changed code: because GoTrue already evicts, a failure of our
own `signOut` call does **not** mean the other devices are still signed in — so the success
message states the eviction flatly instead of branching on it, which would have been wrong
in the common case.

### Still owed

1. **Nothing on the password change itself.** The residual exposure is the 24-hour window
   described above, and it is not closable from here.

2. **`inactivity_timeout`** has its own section below, now that it has been measured. It is
   worth setting, and it is not a substitute for either the reauthentication code or the
   client-side idle timer.

3. **The two email templates changed** (`reauthentication.html`, `email-change.html` — both
   carried a stale `DORMANT` comment claiming nothing called them). Comments in a template
   are part of the shipped payload, so `npm run email:check` will report drift against
   hosted until somebody runs `npm run email:push` with a `SUPABASE_ACCESS_TOKEN`. The
   substance moved to [supabase/templates/README.md](supabase/templates/README.md), where
   the directory's own rule says it belongs.

## The inactivity sign-out has not been exercised in a browser

**Action:** click through it once — idle a signed-in tab, watch the warning, let it fire.

[components/layout/IdleTimeout.tsx](components/layout/IdleTimeout.tsx), added 2026-08-12:
`IDLE_LIMIT_MINUTES` (75) without keyboard or pointer activity signs the member out with
`signOut({ scope: 'local' })` — a real revocation, not just a cleared cookie — and sends
them to `/login` with a notice and a `?next=` back to where they were. A warning dialog
appears for the last minute with an "I'm still here" button.

What **is** verified: the active/warn/expired boundary, as a pure function in
[lib/idle-timeout.ts](lib/idle-timeout.ts), across 11 cases including the exact limit, the
sub-second tail and a slept-through clock; and that `/login` server-renders the notice and
carries the `next` parameter. Build, typecheck and lint are clean.

What is **not** verified, because this checkout has no browser driver and adding one was not
in scope: the event wiring, the cross-tab `localStorage` handshake, and the sign-out and
redirect actually firing. Three things to watch for when somebody does click it through:

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
`inactivity_timeout` can never do this job — see the next section.

## Decide whether to set `[auth.sessions] inactivity_timeout`

**Action:** pick a value and set it in the hosted dashboard, or record that unbounded
sessions are accepted. Not a code change either way.

**The gap it closes, which nothing closes today.** A session cookie has no expiry. Neither
`timebox` nor `inactivity_timeout` is set, and refresh tokens do not expire on their own — so
a browser closed while signed in is still signed in whenever it is next opened, indefinitely.
The shared family computer somebody used once is the case. The client-side idle timer above
cannot cover it: nothing is running to time anything out.

**Measured 2026-08-12** against a local stack at a 60-second window (revert-checked; the
repo's `[auth.sessions]` block is commented out as before):

| Question | Answer |
|---|---|
| Does an unrefreshed session die at the window? | yes — `Invalid Refresh Token: Session Expired (Inactivity)` |
| Does a client that keeps refreshing survive it, with no user activity? | **yes** — 3 automatic refreshes inside a 60s window |
| Does the access token issued before the window still work at GoTrue `/user`? | **yes** |
| Does it still read data through PostgREST? | **yes** — HTTP 200 |

Rows 3 and 4 are why it must not be described as a kill switch: for up to `jwt_expiry` (an
hour) after the session dies, the token in hand keeps working everywhere, because PostgREST
verifies a signature and knows nothing about GoTrue sessions. The only thing that ends a
session on the spot is an explicit `signOut`, which revokes — which is what the idle timer
does.

**The floor on the value is about an hour.** auth-js refreshes when the access token is
within ~90s of expiry, so at `jwt_expiry = 3600` a live tab refreshes roughly every 58
minutes; anything below that signs out members who are actively working, since by row 2 the
only clock it watches is the refresh. 75m — matching the idle timer — clears it by about 16
minutes. Hours clear it comfortably.

**So the choice is one product question:** how long may an abandoned cookie stay renewable,
against how often a member has to sign in again. 8h means most visits; 7d bounds abandonment
to a week and keeps "remember me" for regulars. There is no security argument for the low end
that the idle timer does not already make better.

Pro plan and up, and hosted does not read `config.toml` — Authentication → Sessions in the
dashboard. Do **not** reach for `config push` (GO LIVE explains why). And do not set
`timebox` at or under 24h while `secure_password_change` matters: it caps `created_at`, so no
session can reach the age at which GoTrue demands the reauthentication code, and the flag
becomes decoration. The note is in `config.toml` beside the block.


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

## Nothing applies migrations and deploys code as one step

**Action:** decide how code and schema land together. Nothing enforces it today.

This has already cost an outage. The dev server points at hosted (`.env.local`), and the
Phase 3 app code shipped there while its migrations were still pending. `getMyFamilies`
selects `membership_status`; hosted did not have the column; PostgREST answered **42703
and killed the whole query**, not just that column. So the resolver returned no
memberships, `requireViewOrPending` called `notFound()`, and every page in the app
answered 404 — including the dashboard.

`const { data } = …` discarded the error, exactly as AGENTS.md §8 warns. `[]` means
"belongs to no family", which every caller correctly denies on — so the app failed
closed, which is right, and failed closed *silently*, which is not. `getMyFamilies` now
reads the error, logs a message naming the likely cause, and still denies; that is a
better symptom, not a fix for the ordering.

`db push` from a GitHub Action on merge to `master` fixes this and the replay problem
below, and is still not built.

## Expires 2026-10-01: Claude may write to the hosted database unprompted

**Action on 2026-10-01:** delete the `npx supabase` rules from
`.claude/settings.local.json`, and confirm the `claude_probe` role has expired.

Granted 2026-08-06 for the pre-launch window. `.claude/settings.local.json`
auto-approves `db push`, `migration repair`, `db dump`, `db diff` and `db pull`
against the linked project, so migrations get applied to production without a
prompt. **Permission rules have no expiry field — nothing removes this on the date.**
The file is gitignored, so it affects only this machine.

`db reset` is deliberately NOT wildcarded: `--linked` and `--db-url` reset the
*remote* database, so only the bare and `--local` forms are allowed, and both
dangerous forms are in `deny` (which takes precedence) as a second layer.

Also expiring: the `claude_probe` Postgres role, `VALID UNTIL 2026-10-01`. It holds
`LOGIN` and no grants — enough to read `pg_policies` and `pg_catalog`, not enough to
read a single row of family data. Its password sits in plaintext in
`supabase/.env.probe` (gitignored). Nothing needs doing when it lapses; verifying it
lapsed is worth thirty seconds.

Note that neither `.claude/settings.local.json` nor `supabase/.env.probe` is present in
this checkout, so the local half may already be gone — the hosted `claude_probe` role is
the part that still needs confirming.

The durable replacement for both is `db push` from a GitHub Action on merge to
`master` — reviewed, ordered, recorded, and nobody holding write credentials. Not
built.

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

## Review

### Replaying an early migration can resurrect a policy a later one replaced

**Action:** decide how migrations reach the hosted project, and stop applying them by
hand out of order. Guarding all ~30 files individually is not the answer.

This already happened once, in production. `20260602000000_families.sql` was replayed
against hosted after `20260618000001` had renamed its policy to `perm:…`, so its bare
`CREATE POLICY` — no `DROP`, no `IF NOT EXISTS` — recreated the original
`user_metadata` policy *alongside* the secure one. Permissive policies are OR-ed, so
the spoofable one decided every read. Supabase's advisor caught it;
`20260806000009` removed it and that one file now guards on `auth_family_code()`
existing.

The shape is general, and only that one file is guarded. Every migration up to
`20260610000007` creates policies with a bare `CREATE POLICY`, and the three sweeps
(`20260615000004`, `20260618000001`, `20260618000003`) renamed or rewrote most of them
— so replaying any of those files re-adds a legacy policy under a name nothing holds
any more. `20260806000009` cleans up the `user_metadata` variety on sight and is
re-runnable, which makes it a good thing to apply after any manual intervention, but it
says nothing about the `is_admin` variety or about plain duplicates that widen access.

Two things worth knowing before choosing a fix:

- Every migration header says `USAGE: psql "$DATABASE_URL" -f <file>`, which invites
  exactly this. `supabase db push` applies pending migrations in order and records them
  in `supabase_migrations.schema_migrations`; hand-running `psql -f` records nothing, so
  nothing can tell you afterwards what a database actually has.
- The audit query that finds the damage is cheap and worth keeping:

  ```sql
  SELECT a.tablename, a.policyname
    FROM pg_policies a
   WHERE a.schemaname='public' AND a.policyname NOT LIKE 'perm:%'
     AND EXISTS (SELECT 1 FROM pg_policies b
                  WHERE b.schemaname='public' AND b.tablename=a.tablename
                    AND b.policyname='perm:'||a.policyname);
  ```

  It returned exactly one row on hosted — `families` — which is how the blast radius
  was bounded. On a correct database it returns none.

### Dead code: `components/admin/AdminChaptersClient.tsx`

**Action:** review, then most likely delete.

Nothing imports it — the only match for `AdminChaptersClient` in the repo is its own
definition. It was superseded by two components that split its job:

- [AdminRegionsChaptersClient.tsx](components/admin/AdminRegionsChaptersClient.tsx) —
  rendered by [admin/chapters/page.tsx](<app/(protected)/admin/chapters/page.tsx>)
- [AdminUserRolesClient.tsx](components/admin/AdminUserRolesClient.tsx) —
  rendered by [admin/boardpositions/page.tsx](<app/(protected)/admin/boardpositions/page.tsx>)
  (the route was `/admin/user-roles` until `20260805000006` renamed it and its
  permission key together)

Before deleting, confirm neither live component is missing anything the dead one does
— the chapter and custom-role forms look equivalent, but that has not been diffed
carefully.

Two notes if it is instead kept and wired up:

- Its role form calls `createCustomRole`, which revalidates `/admin/boardpositions`
  only — not `/admin/chapters`. Harmless today because the create handler calls
  `router.refresh()` explicitly, which refetches the current route regardless.
- It was included in the server-data-freshness sweep (it uses `useServerState` and
  `router.refresh()` like its live siblings), so it is not stale in that respect.

Found while auditing the site for lists that ignored newly created rows.
