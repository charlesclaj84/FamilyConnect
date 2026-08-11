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

### [ ] Turn on email confirmation

Built and verified locally; **off on hosted**, where it is the half that matters.

Until it is on, GoTrue stamps `email_confirmed_at` at signup, so the address on an
account is unproven. Concretely, for a live family: `join_family_by_code()` accepts an
applicant who never demonstrated they own the address they signed up with, so the
Member Approvals queue shows an administrator an email that means nothing. Admin
approval still gates access — nobody gets in un-reviewed — but "we emailed them and
they clicked it" is not among the things the administrator can rely on. **Do not
describe the product as email-verified until this box is ticked.**

* Authentication → Providers → Email → **Confirm email: on**
* Authentication → Email Templates → paste **all five** bodies from
  [supabase/templates/](supabase/templates/), subject lines included. `config.toml` wires
  them up locally only; hosted renders whatever was last pasted, so this step is the
  whole deployment. See [supabase/templates/README.md](supabase/templates/README.md).

  | Dashboard tab | File |
  |---|---|
  | Confirm signup | `confirmation.html` |
  | Reset password | `recovery.html` |
  | Invite user | `invite.html` |
  | Change email address | `email-change.html` |
  | Reauthentication | `reauthentication.html` |

  **Paste the dormant three as well.** Every GoTrue default links with
  `{{ .ConfirmationURL }}`, so any tab left stock is a trap set for whoever later enables
  that flow. The `token_hash` link is the load-bearing part: the stock template confirms
  the account and then returns the session in a URL **fragment**, which the browser never
  sends to the server — so this app, which is cookie-based via `@supabase/ssr`, would
  leave the user signed out with nothing explaining why. See
  [app/auth/confirm/route.ts](app/auth/confirm/route.ts).
* Authentication → URL Configuration → site URL and redirect allow-list set to the
  **production** origin — `https://genorra.com` since 2026-08-10, with
  `https://genorra.com/**` on the allow-list. `{{ .SiteURL }}` is what the link in the
  email is built from.

  The vercel.app host must **redirect** to the domain rather than keep serving the app.
  Two live origins is the fragment bug in a different costume: the link in the email is
  built from one origin, `/auth/confirm` writes the session cookie there, and a redirect
  mid-flight lands the user on the other one signed out.

**Do not do this with `npx supabase config push`.** It sends the whole `[auth]` block,
including `site_url = "http://127.0.0.1:3000"` from the local config — production would
start mailing people links to their own laptop.

Sending itself is no longer the blocker: hosted has sent through Resend
(`noreply@genorra.com`) since 2026-08-10, with `email_sent` raised in the dashboard. The
`[auth.email.smtp]` block in `config.toml` stays **commented out** deliberately — see the
comment above it; uncommenting takes local development off Mailpit and starts mailing
real addresses out of `db reset` and the RLS fixture.

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

## Password change still allows a nonce-free path for fresh sessions

`secure_password_change = true` since 2026-08-11, so an emailed reauthentication code is
genuinely mandatory — but GoTrue only enforces it on sessions older than its freshness
window. A member whose session is minutes old can change their password without the code,
by design, and the config carries the full note and the probe to re-run if you touch it.
[components/personal-info/SignInSecurity.tsx](components/personal-info/SignInSecurity.tsx)
says so plainly rather than claiming the code is a gate in both cases; keep it that way.

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
