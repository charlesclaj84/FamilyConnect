# TODO

Running list of things worth revisiting. Add an entry when you find something real
but out of scope for the change you are making, so it does not get lost in a commit
message.

The first section is the active piece of work. Everything after it is a parked note,
except GO LIVE, which is a checklist rather than a backlog.

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
* Authentication → Email Templates → **Confirm signup** → paste the body of
  [supabase/templates/confirmation.html](supabase/templates/confirmation.html)

  The `token_hash` link is the load-bearing part. The stock template's
  `{{ .ConfirmationURL }}` confirms the account and then returns the session in a URL
  **fragment**, which the browser never sends to the server — so this app, which is
  cookie-based via `@supabase/ssr`, would leave the user signed out on the dashboard
  with nothing explaining why. See [app/auth/confirm/route.ts](app/auth/confirm/route.ts).
* Authentication → URL Configuration → site URL and redirect allow-list set to the
  **production** origin. `{{ .SiteURL }}` is what the link in the email is built from.

**Do not do this with `npx supabase config push`.** It sends the whole `[auth]` block,
including `site_url = "http://127.0.0.1:3000"` from the local config — production would
start mailing people links to their own laptop.

### [ ] Configure a real SMTP sender

`[auth.email.smtp]` is commented out on both sides, so hosted falls back to Supabase's
built-in sender and its low per-hour cap. With confirmations on, that cap is now in the
signup path: the first symptom is a confirmation email that never arrives and a resend
button that appears to do nothing. `[auth.rate_limit] email_sent = 2` is worth raising
at the same time.

### [ ] Retire Claude's write access to the hosted database

See the 2026-10-01 section below — it is dated rather than launch-gated, but shipping
with an agent holding unprompted `db push` on production is a decision, not an
oversight.

## FIXED 2026-08-06: every `public` function was callable by anon

Closed by `20260806000015` (grants) and `20260806000016` (an internal guard on the one
function that was actually exploitable), both applied to hosted. Written up as
AGENTS.md §2b. Kept here because the shape of the mistake is worth remembering.

**It was a live vulnerability, not a latent one.** `seed_family_system_groups()` had
`REVOKE ALL … FROM PUBLIC` in its own migration and was granted to nobody. Called with
the **anon** key against hosted it returned 204. Locally, as anon, it wrote 3
`user_groups` + 155 `group_permissions` + 17 `resource_visibility` rows for a family
code that had never existed — `user_groups.family_code` has no foreign key, so every
random string wrote another 175 rows. And because its inserts are `ON CONFLICT DO
NOTHING` — idempotent against re-insertion, no defence at all against a DELETE — an
anonymous call **restored an `Administrators / admin/groups / delete = any` grant that
an administrator had deliberately removed**. Unauthenticated re-grant of an
administrative permission.

**Why every REVOKE in the chain was worthless.** `supabase/seed.sql` ran
`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role`
after every migration, and hosted did the equivalent. Three separate things had to be
fixed or the lockdown would have been a no-op, and each was verified by testing rather
than reasoning:

1. Thirteen functions still carried the built-in `=X/postgres` PUBLIC grant. Revoking
   from `anon, authenticated` and not PUBLIC changes nothing.
2. A schema-scoped `ALTER DEFAULT PRIVILEGES` **cannot** remove PUBLIC's built-in
   EXECUTE — only the schema-less form can. With just the schema-scoped revoke, a newly
   created function still came out anon-executable.
3. `seed.sql` itself. It now asserts the grant counts instead of setting them, so a
   future CLI that grants by default fails the reset loudly.

**What the audit established empirically**, and what the design now rests on:
RLS policy evaluation requires the *querying* role to hold EXECUTE (revoke
`auth_family_code()` and every authenticated query fails); trigger functions need no
grant; a callee of a SECURITY DEFINER function needs no grant; and not one policy in
`public` is `TO anon`, so anon needs exactly one function —
`peek_family_invitation`, for `/invite/<token>` before the visitor has an account.

**Still worth doing, and not done:**

* `cancel_overdue_event_assignments()` keeps its `authenticated` grant although all
  three call sites use the admin client. It is SECURITY INVOKER, so it is RLS-contained
  and confers nothing a direct UPDATE would not — kept because removing a grant nothing
  is *proven* to need was the worse trade at the time. Add a caller check, then revoke.
* `get_my_family_code()` is granted on hosted only if a hosted policy references it,
  because the lockdown derives policy-helper grants from `pg_policies` per database.
  Confirm nothing depends on it, then drop it from both.
* The suite still exercises `anon` through exactly one case. That is one more than
  before, and fewer than the role deserves.

## 1. Members cannot read the dues table, so "what do I owe" is empty for everyone

**Action:** decide which resource governs *reading* `dues_schedules`, then re-point it.
This one is live on every family, not a latent risk — which is why it is now the active
piece of work, Phase 3 having shipped.

`permission_table_map` maps `dues_schedules` to `admin/account`, with `own_expr` and
`self_expr` both `'false'`. The composed SELECT policy therefore reduces to

```
base_qual AND auth_permission('admin/account', 'view') = 'any'
```

and `20260618000000` restricts every `category='admin'` resource per family. So a
member with no Accounting grant reads **zero** dues schedules — and
[`getMyDuesSummary`](app/actions/dues.ts) is the member-facing call behind My Summary
and the dashboard's "you owe" card. It reads `dues_schedules` through the user client
and returns `[]`. `dues_payments` and `dues_member_plans` are unaffected: both map to
`dues`, which is `category='accounting'` and not restricted.

Found because `20260806000008` made the RLS fixture seed `resource_visibility`. Before
that the fixture wrote no visibility rows at all, so `admin/account` fell through to
`'any'` and `dues.getDuesSchedules` / `dues.getMyDuesSummary` passed their positive
controls against a permission configuration **no real family has** — the fixture
failure mode AGENTS.md §7 warns about, in its most literal form. Both cases now pin
`positiveActor: 'alphaAdmin'` with a comment pointing here; that keeps the isolation
assertion meaningful and does nothing about the bug.

The fix is not a one-liner, which is why it was parked: the sweep bakes the resource key
into each policy as a literal, so re-pointing the table needs the policy surgery of
`20260806000000` §6. And it is a product call first — *who may see the family's dues
and donation schedules?* Reading what you owe and editing what everyone owes are
plainly different rights, and one key currently governs both.

## 2. PARKED 2026-08-07: "Were you already added to the family?"

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

## DONE 2026-08-06: Invite into any family you belong to

`20260806000014`. `create_family_invitation()` takes a target family instead of always
using `auth_family_code()`, so /my-families offers the button on every row rather than
only the one being viewed. The caller's **approved** people row in the target family is
both the membership test and the family-isolation test.

**Pre-approval stays tied to the ACTIVE family, and that is the whole subtlety.**
`auth_permission()` resolves groups, overrides and visibility against
`auth_family_code()` and nothing else — so honouring a pre-approval request for some
other family would let an administrator of A admit someone into B, where they are an
ordinary member. Resolving permissions per family would mean a second copy of
`auth_permission()`'s precedence rules, free to drift. Instead the request is downgraded
unless target == active, which costs nothing: Member Approvals is always the active
family, and My Families invitations are never pre-approved by design.

Verified with a user who administers A and is a plain member of B: pre-approved in A,
downgraded in B, refused for a family they are not in. `tests/rls` covers BRAVO's
administrator naming ALPHA as the target.

## DONE 2026-08-06: Invitations, and pre-approved invitations from Member Approvals

`20260806000013` adds `family_invitations` plus four RPCs; the UI is one shared
[InviteMemberDialog](components/invitations/InviteMemberDialog.tsx) used twice, and
[/invite/[token]](<app/invite/[token]/page.tsx>) is where the link lands.

* **From My Families** — the invitee joins the approvals queue like anyone else.
* **From Member Approvals** — `preApproved`, so they are admitted on acceptance. The
  person clicking it is the person who would otherwise approve them.

**The gate is a token, not the email address**, and that is the whole design. Phase 3
deleted claim-by-email because an address proves nothing while confirmation is off —
which it still is on hosted. A pre-approving invitation keyed on email alone would
reintroduce that hole with a bigger payoff, since it skips the only real review. So: 32
random bytes, stored only as SHA-256, returned once; the address narrows who may redeem
on top of the secret rather than being the secret.

Pre-approval is granted by `create_family_invitation()` only to a caller holding
admin/approvals:edit, and **silently downgraded** otherwise — verified in the suite by
having a plain member ask for it and come back with `pre_approved = false`.

**NO EMAIL IS SENT.** There is no mail layer here and SMTP is unconfigured, so the
dialog returns a link to send by hand. That is a real gap rather than a design choice —
it belongs with the SMTP box under GO LIVE, and until then "invite" means "generate a
link". Registration handles `?invite=` so a brand-new invitee is not asked for a family
code they were never given.

**FIXED 2026-08-08: nothing ever linked to `?invite=`.** The sentence above was true of
the register page and false of the flow. `/invite/<token>` sent an unauthenticated
visitor to a bare `/register`, which is the ordinary join form — so the invitation mode
built for exactly this case was unreachable, and every invitee hit a required Family Code
field answering a code an invitation exists to replace. A dead end, reported from a real
invite off Members & Access.

Both links on that page now carry the token, and so does each form's link to the other:

| From | To | Carries |
|---|---|---|
| `/invite/<token>` | Create an account | `/register?invite=<token>` |
| `/invite/<token>` | Sign in | `/login?next=/invite/<token>` |
| `/register?invite=` | Sign in | `/login?next=/invite/<token>` |
| `/login?next=/invite/` | Create one | `/register?invite=<token>` |

The cross-links are the half worth keeping: an invitee who guesses wrong about whether
they already have an account must not be dropped into the other form with the token
stripped, which lands them right back on the family-code question.

`?next=` is validated by [lib/safe-next.ts](lib/safe-next.ts) — same-origin absolute
paths only, `//` and `/\` rejected. It is the rule that was already private to
`/auth/confirm`, extracted rather than copied: two implementations of an open-redirect
guard are two chances for one of them to be the lenient one, and both of these sit on
URLs users are told by email to trust.

Verified end to end against the local stack by calling the real `registerUser` with a
token and no family code: pending for an ordinary invitation, approved for a
pre-approved one, invitation spent, and a mismatched address refused against the email
field with no account created.

### The finding that came out of building it

The first draft had a second RPC taking `(token, user_id)`, granted to `service_role`
only, with a migration assertion that `authenticated` could not execute it. **The
assertion passed and was worthless** — see the section at the top of this file. Anyone
holding a token could have redeemed it onto another account. Replaced with one function
that reads the role from the verified JWT and ignores `p_user_id` for everyone but the
service role. Re-tested against hosted after deploying: an anon call passing another
user's id is refused.

## DONE 2026-08-06: Create a new family from My Families

`20260806000012` adds `create_family()` (and `gen_family_code()`), called with the user
client from `createFamily` in [app/actions/my-families.ts](app/actions/my-families.ts),
behind [CreateFamilyDialog](components/my-families/CreateFamilyDialog.tsx).

The function does almost nothing itself, which is the design: it inserts `families` and
then `people`, **in that order**, and three existing triggers do the rest — seed the
system groups, inherit the caller's profile onto the new row, stamp them `'approved'`
(a founder has nobody to approve them), and put them in General *and* Administrators
via `families.created_by`. Reverse the two inserts and the founder becomes an ordinary
member of a family with no administrator, which is the bug `20260806000008` exists to
prevent. That ordering is asserted by the migration's own verify block against a
throwaway family, which ran on hosted — where there are real `auth.users` rows — and
passed.

Applied to hosted the same day. Verified afterwards that the smoke test left nothing
behind: still two families, both members approved.

**Two general lessons, now in AGENTS.md.** Extension functions must be qualified
`extensions.`, not `public.` — Supabase installs pgcrypto there, and plpgsql resolves
nothing until the body runs, so the first version applied cleanly and threw for its
first caller. And a verify block that can skip must not be the only check: that same
block needed an `auth.users` row and returned early without one, so a fresh local
database reported success over a broken function.

## DONE 2026-08-06: Phase 3 — join a family by code, behind an approval gate

Built, and verified against a local database. Kept as a record because three of its
findings are load-bearing for anyone touching `people` or the permission model, and
because the follow-ups it leaves are listed at the end.

### Applied to hosted 2026-08-06

`20260806000010` and `20260806000011` are on the hosted project; `migration list
--linked` shows nothing pending. Verified afterwards with the service role: both live
members still `approved` (nobody was pended by the deploy), `admin/approvals`
registered with actions view+edit, a `'restricted'` visibility row for both families
`23HAYW` and `ZZTEST`, and both Administrators groups holding view+edit at `'any'`.

**`db push` needs stdin closed when run non-interactively.** Plain
`npx supabase db push --linked` from a non-TTY does nothing at all — exit 0, no output,
no migrations applied, because it is waiting on a confirmation prompt that never
arrives. It is not a permissions problem and there is nothing in the output to say so.
Redirecting stdin makes it proceed:

```bash
npx supabase db push --linked < /dev/null
```

### The app was deployed ahead of its migration, and every page 404'd

**Action:** decide how code and schema land together. Nothing enforces it today.

The dev server points at hosted (`.env.local`), and the Phase 3 app code shipped there
while the migrations were still pending. `getMyFamilies` selects `membership_status`;
hosted did not have the column; PostgREST answered **42703 and killed the whole query**,
not just that column. So the resolver returned no memberships, `requireViewOrPending`
called `notFound()`, and every page in the app answered 404 — including the dashboard.

Two things made it expensive rather than obvious:

* `const { data } = …` discarded the error, exactly as AGENTS.md §8 warns. `[]` means
  "belongs to no family", which every caller correctly denies on — so the app failed
  closed, which is right, and failed closed *silently*, which is not. Diagnosing it
  took a direct query against hosted. `getMyFamilies` now reads the error, logs a
  message naming the likely cause, and still denies.
* A comment in that function claimed the missing column would coalesce to `'approved'`
  and keep the app working on an older database. That is not how a missing column
  behaves, and the claim made the real failure mode harder to suspect. Corrected.

The general problem is unchanged and is the same one recorded under "Replaying an early
migration…" below: there is no path that applies migrations and deploys code as one
step. `db push` from a GitHub Action on merge to `master` fixes both, and is still not
built.

### What shipped

| # | Where | What |
|---|---|---|
| 1 | `20260806000008` | System groups + `resource_visibility` for new families (shipped earlier, commit `47d49a3`). |
| 2 | `20260806000010` | Registers `admin/approvals` ("Member Approvals", admin, 165, actions view+edit), with per-family backfills of BOTH the `'restricted'` visibility row and the Administrators grant. Also added to `20260618000000`'s seed, without the `actions` column — it does not exist that early in the chain. |
| 3 | `20260806000011` | `membership_status` + the four decision columns, CHECK, partial index; the stamp trigger; the promotion guard; `auth_membership_approved()`; the `auth_person_id()` conjunct; the `people` SELECT rewrite; the sweep; and the three RPCs. |
| 4 | `tests/rls` | Four applicant users, statuses stated by UPDATE after the insert loop with an assertion that they took, and 16 new cases — 13 pending-actor, 3 approvals, 1 join. |
| 5 | `lib/auth/*` | `MembershipStatus`, `isApproved`, `getViewingMembership`, `isApprovedMember`, `PermissionSet.approved`, `resolveScope` denial above the legacy branch, `requireViewOrPending`, `requireMember` refusal. |
| 6 | `app/actions/register.ts` | Claim-by-email deleted. |
| 7 | `app/actions/link-person.ts` | Carries `membership_status` onto the target row; refuses a non-approved caller. |
| 8 | `app/actions/my-families.ts` | `validateFamilyCode` / `joinFamilyByCode`, both on the user client, with a per-user rate limit on the lookup. |
| 9 | `components/my-families/JoinFamilyDialog.tsx` | The two-step dialog; `MyFamiliesSection` badges pending and rejected memberships and withholds their switch controls. |
| 10 | `admin/approvals` | Action, page, client, `lib/features.ts` entry, Sidebar row. |
| 11 | dashboard, `/personal-info`, `/my-families` | `requireViewOrPending`; `PendingApproval` + `PendingApprovalScreen`; the dashboard's early return sits above its `Promise.all`. `/personal-info` deliberately renders in full for a pending member, withholding only the two family fetches. |
| 12 | `Navbar`, `lib/notifications.ts` | Bell suppressed unless the active membership is approved; `FamilySwitcher` kept. `notifyAllMembers` filters to approved; `notifyApprovers` added, resolving recipients from the permission model rather than a group name. |

### Three things found while building it that were not in the plan

1. **Self-approval through the profile endpoint.** The `people` UPDATE policy admits a
   member's write to their own row — it must, or nobody could edit their own profile —
   and an RLS policy is a predicate over the ROW, with no opinion about which column
   changed. `saveProfileSection` copied every key the caller sent, so
   `saveProfileSection({ membership_status: 'approved' })` was a self-approval that
   every policy was satisfied by. Closed twice: `lib/profile-columns.ts` allow-lists the
   columns, and `people_guard_membership_status` refuses any change to the column from
   the `authenticated` role. There is a regression case for the pair.
2. **`updateUserProfile` had no family scoping.** `admin.from('people').update(data)
   .eq('id', peopleId)` on the service role, with `data` mass-assigned from the client —
   so a user manager in one family could rewrite a member of another, and could set
   `user_id`, `family_code` or `membership_status` while doing it. Now family-scoped and
   allow-listed.
3. **The plan's "seven `auth.uid()` tables" was stale, and the bigger gap was
   elsewhere.** Read from live `pg_policies` rather than the migration files, the mapped
   set is four (`chat_participants`, `event_rsvp`, `event_assignments`, `user_roles` —
   `adults` does not exist on a current chain). The set the plan missed entirely is the
   tables with NO permission clause at all, scoped only by `auth_family_code()`:
   `person_relationships` (the whole family tree), the `notifications` INSERT policy
   (any member may notify any member), and the four "readable in family" SELECTs on the
   permission tables. The sweep computes the first set from `permission_table_map` and
   names the second explicitly.

### Verified, and how

`npx supabase db reset --local` then `npm run test:rls`: 71 actions, 142 assertions,
all passing, 14 controls not applicable. `npx tsc --noEmit` and `npm run build` clean.

The green was then **mutation-tested**, because a passing isolation suite proves nothing
until you have seen it fail. Removing the single conjunct from `auth_person_id()` and
changing nothing else fails ten of the new cases with real leaks and one real cast vote.
The three that still pass under that mutation are labelled individually in `cases.mjs`
as not being evidence for it — `chat.getMessages` is refused by room participation,
`getNotifications` by the action's own recipient filter, and the self-approval case by
the two fixes above. The exact commands are in the `PENDING_CASES` header.

### What Phase 3 leaves owed

1. ~~Email confirmation does not exist.~~ **Built and on locally; hosted is a GO LIVE
   box at the top of this file.** `enable_confirmations = true`,
   [app/auth/confirm/route.ts](app/auth/confirm/route.ts) is the landing route, and
   [supabase/templates/confirmation.html](supabase/templates/confirmation.html) links to
   it with a `token_hash` rather than letting GoTrue's default return the session in a
   URL fragment a cookie-based app never sees. Verified against a local stack end to
   end: signup returns no session, sign-in is refused `email_not_confirmed`, the link
   confirms and grants one, and `join_family_by_code` refuses an unconfirmed account —
   the Phase 3 check that had been inert since it was written.
2. **The §6 sweep has no test through an action, by construction.** What it closes is
   reachable only by calling PostgREST directly with an applicant's JWT, and `tests/rls`
   calls exported actions. Standing in for it: §8 of the migration recomputes the swept
   table list and RAISEs if any policy on any of them lacks the conjunct, so a sweep
   that matches nothing fails the deploy. A raw-query harness is the real answer and is
   not built — recorded in `UNCOVERED` in `cases.mjs`.
3. **The fail-closed default for admin resources is still unbuilt.** Blocker 4's
   stronger fix — deny `view` on an unregistered or unset `category='admin'` key rather
   than allowing it — needs `auth_permission()` and `resolveScope()` changed together,
   and would mean `admin/approvals` could not have been born world-readable in the first
   place instead of being backfilled out of it. Every admin key is currently correct by
   backfill, which is a state that has to be re-established by hand each time one is
   added.
4. **A `people` row can still be moved between statuses by the service role.** By
   design — `link-person.ts` needs it and `tests/rls` seeds with it — but it means the
   guard is a boundary around the `authenticated` role, not around the column. Any new
   service-role write to `people` owes the same look `updateUserProfile` just got.

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

The durable replacement for both is `db push` from a GitHub Action on merge to
`master` — reviewed, ordered, recorded, and nobody holding write credentials. Not
built.

## Authorization

### Everything below came out of building `tests/rls`

(see AGENTS.md §7). The suite is green — 71 actions, 142 assertions, since Phase 3 —
and none of the three below is an isolation failure or blocks anything today. The dues
finding that used to head this section has been promoted to the active item at the top,
because unlike these it is live on every family.

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

### `npm run test:rls` cannot run twice without a `db reset`

**Action:** teach `teardown()` to get past the append-only ledger, or say in AGENTS.md
that a reset is part of the loop.

`20260806000002_dues_ledger_immutability` installs a `dues_payments_immutable` trigger
that raises on DELETE. `teardown()` in `tests/rls/seed.mjs` deletes `dues_payments`, so
the second run of the suite dies before it seeds:

```
Error: teardown dues_payments: dues_payments is append-only:
payment … cannot be deleted
```

The first run after `npx supabase db reset` is fine, which is why this had not bitten
anyone — AGENTS.md §7 gives the two commands in that order. But the file's own comment
says teardown exists "so the suite is re-runnable", and it is not. A reversal row is
the product-level answer to an unwanted payment; the harness wants a genuine delete, so
this probably means dropping the trigger for the fixture's rows rather than working
around it.

**It did bite, during Phase 3.** Mutation-testing the new cases means reset → patch a
function → run, repeatedly, and every iteration needs its own reset because of this. It
turns a ten-second loop into a two-minute one, which is the kind of friction that stops
people from checking whether a green suite can actually fail. Worth more than it looks.

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
