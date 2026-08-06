# TODO

Running list of things worth revisiting. Add an entry when you find something real
but out of scope for the change you are making, so it does not get lost in a commit
message.

The first section is the active piece of work. Everything after it is a parked note.

## 1. Phase 3 — join a family by code, behind an approval gate

**Action:** build it. This is the next thing to do, ahead of everything below.

Designed and adversarially reviewed already; what follows is the plan, not a sketch.
Three reviewers returned *sound-with-fixes* — the four blockers are listed at the end
and must be folded in, not discovered again.

### What it delivers

1. **Join by code** from `/my-families`. The family code is public and shareable by
   design — no invite token and no second secret is wanted. Two
   steps with an explicit confirmation between: type a code → server validates it
   exists and returns the **family name** → "yes, join *Name*" → membership created.
2. **New members land PENDING.** They must have a confirmed email, and an
   administrator admits them.
3. **A new admin surface** to review, approve and reject applicants.
4. **While pending:** they may fill in My Profile. Their dashboard shows *only* that
   they are awaiting approval. They read no family data at all.

Explicitly out of scope: leaving a family. Ruled out — a departure can be used to walk
away from a debt, and the last admin leaving bricks the family. Do not build toward it.

### The crux: one conjunct, in the right function

A pending row in `people` carries the `family_code`, so `auth_family_code()` resolves
it and every RLS policy in the app treats that person as a full member. Hiding the
dashboard does nothing about this. The gate has to be in the database:

```sql
-- public.auth_person_id() gains one line:
AND p.membership_status = 'approved'
```

That is nearly all of it. `auth_permission()` already fails closed at
`IF v_person IS NULL`, so the whole permission model denies without a single policy
being rewritten — and the same conjunct nulls the `own`/`self` expressions on 18 of the
40 mapped tables at once.

**`auth_family_code()` must be left alone.** Nulling it would hide the pending member's
own profile from themselves and re-open the people-INSERT bootstrap branch, which fires
precisely when it returns NULL.

**The gap the resolver cannot reach:** seven mapped tables write `self_expr` in terms of
`auth.uid()` rather than `auth_person_id()`, so their OR-ed self branch survives. Those
get a mechanical sweep appending `AND public.auth_membership_approved()`, modelled on
the text-surgery loop in `20260805000006`. `people` is excluded by name — it is the one
table the split must preserve.

State lives on the `people` row with `DEFAULT 'approved'`, so every existing member
backfills with no behaviour change. Every gate is a **positive** test on `'approved'`,
never `<> 'pending'`, so NULL or an unknown value fails closed.

### Order of work

Migrations start at **`20260806000008`** — the plan was written against `…0805000009`,
which phases 1–2 have since used.

| # | Where | What |
|---|---|---|
| 1 | ~~migration~~ | **DONE — `20260806000008_system_groups_for_new_families`.** `seed_family_system_groups()` plus an AFTER INSERT trigger on `families`; a second pair of triggers on `people` (INSERT, and UPDATE OF user_id, for the claim-by-email and link-person paths) puts each member in General and the founder — `families.created_by` — in Administrators. Backfills the families that had none. Also seeds `resource_visibility`, which is most of blocker 4. |
| 2 | migration + `20260618000000` seed | Register `admin/approvals` ("Member Approvals", admin, 165) **before** the enforcement migration — the rewritten `people` SELECT policy calls it, and an unregistered key defaults `view` to `any`. |
| 3 | migration | Enforcement: columns + CHECK + partial index, the two triggers, `set_membership_status()`, the `auth_person_id()` conjunct, `auth_membership_approved()`, the `people` SELECT rewrite, the sweep over the seven `auth.uid()` tables. |
| 4 | `tests/rls/seed.mjs`, `cases.mjs` | Must land in the same commit. The stamp trigger makes the first seeded person approved and every one after PENDING, so the isolation assertions would otherwise go green for the wrong reason. |
| 5 | `lib/auth/*` | `MembershipStatus`; `getViewingMembership()`; `resolveScope` denies a non-approved membership above the legacy branch; `requireMember()` returns "awaiting approval" — that one line covers every self-service write (chat, RSVP, votes). |
| 6 | `app/actions/register.ts` | **Delete the claim-by-email block.** Matching `primary_email` on an unlinked row proves nothing with confirmations off and the code public: it is an account takeover onto a record that may already carry dues history, and it launders approval because an unlinked row stamps as approved. |
| 7 | `app/actions/link-person.ts` | Same launderer by another route: it moves `user_id` onto a pre-existing approved row and deletes the original. Must carry the pending status across. |
| 8 | `app/actions/my-families.ts` (new) | `validateFamilyCode` / `joinFamilyByCode`. Both call the SECURITY DEFINER RPCs with the **user** client — see blocker 2. |
| 9 | `components/my-families/JoinFamilyDialog.tsx` (new) | The two-step dialog. The section already renders for single-family accounts precisely so this is reachable. |
| 10 | `app/actions/admin/approvals.ts`, `admin/approvals/page.tsx`, `AdminApprovalsClient.tsx` (all new) | List / approve / reject, plus the `lib/features.ts` entry and the `Sidebar` `adminItems` row. Without the features entry the key never enters `viewable` and the page 404s for everyone. |
| 11 | dashboard, `/personal-info`, `/my-families` | `requireViewOrPending`; `PendingApprovalScreen` with a resend-confirmation button; early return **above** the dashboard's `Promise.all` so no widget fetches. |
| 12 | `Navbar`, `lib/notifications.ts` | Suppress the bell for pending members; keep `FamilySwitcher` (it is how a multi-family member gets back out). `notifyAllMembers` filters to approved; add `notifyApprovers`. |

### The four blockers

1. **The choke-point claim was false.** 14 exported actions used `createAdminClient()`
   with no `getUser()` and no family scoping. *Already fixed in phase 1* — re-run
   `scan-ungated.js` before trusting it again.
2. **`set_membership_status()` disables its own authorization branch when
   `auth.uid()` IS NULL.** Called with the admin client — the house style — the SQL
   check is a no-op and only the TypeScript guard remains. **Mandate the user client**
   and say so in a comment on the function.
3. **Email confirmation does not exist.** `enable_confirmations = false`
   ([supabase/config.toml:226](supabase/config.toml)), the `[auth.email.smtp]` block is
   commented out, and `find app -name route.ts` returns nothing — there is no
   confirmation landing route. With confirmations off GoTrue stamps
   `email_confirmed_at` at signup, so every check passes trivially. **Decided: ship the
   checks now**, inert, and treat the mail work as a follow-up. Admin approval is still
   a real human gate meanwhile. Do not describe the feature as email-verified until the
   flag is flipped.
4. **`admin/approvals` would default to `view='everyone'` in families created after the
   migration** — the visibility backfill is one-shot, and nothing writes
   `resource_visibility` for a new family. That key unlocks every applicant's PII.
   ~~Either seed it in `register.ts` create-mode or make the default fail closed.~~
   *Half-closed by `20260806000008`*, which seeds a `'restricted'` row for every
   `category='admin'` resource on family creation, and backfilled the pairs that were
   already missing. It was not hypothetical: **every** family created since
   `20260618000000` had no `resource_visibility` rows at all, so all sixteen admin
   surfaces — User Management, Groups & Permissions, Accounting, Reports — were
   viewable by every member of that family, while nobody could administer anything
   because create/edit/delete fail closed with no group to grant them.

   **What is still owed for step 2:** that trigger fires per *family*, not per
   *resource*. Registering `admin/approvals` in a later migration gives existing
   families no visibility row for it, exactly as before. That migration must carry its
   own per-family backfill, the way `20260806000007` does — the pattern is now also in
   §5 of `20260806000008`. The fail-closed default (deny `view` on an unregistered or
   unset `category='admin'` key, rather than allow) is still the stronger fix and is
   still unbuilt; it needs `auth_permission()` and `resolveScope()` changed together,
   which is why it was not folded in here.

### Decisions already taken

- Join pends; the founder creating a new family does not. Implemented by the BEFORE
  INSERT trigger asking whether the family already has an approved user-linked member,
  so `register.ts` needs no branch. Leaving `?mode=join` unpended would be a complete
  documented bypass.
- Reject sets `'rejected'` rather than deleting the row — `people(id)` is referenced
  `ON DELETE CASCADE` from four tables, and a delete strands the auth account with
  `app_metadata.family_code` still naming the family.
- Approving also adds the member to the seeded General group; otherwise they fall to
  bare defaults rather than the policy the family configured. *Since `20260806000008`
  the `people` triggers already do this the moment a user is linked, so the approval
  step is now a belt-and-braces `ON CONFLICT DO NOTHING` rather than the only path. It
  is not redundant to keep: a pending member is denied by the `auth_person_id()`
  conjunct regardless of what groups they are in, so nothing leaks in the meantime.*
- Replace `generateCode()` — *already done in phase 1*.

### Open, and worth deciding before step 8

Returning the family name for any valid code is an enumeration oracle by construction.
Accepted: codes are meant to be shared and the payoff is only a name. Rate-limit the
lookup anyway.

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

### Members cannot read the dues table, so "what do I owe" is empty for everyone

**Action:** decide which resource governs *reading* `dues_schedules`, then re-point it.
This one is live on every family, not a latent risk.

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

The fix is not a one-liner, which is why it is parked: the sweep bakes the resource key
into each policy as a literal, so re-pointing the table needs the policy surgery of
`20260806000000` §6. And it is a product call first — *who may see the family's dues
and donation schedules?* Reading what you owe and editing what everyone owes are
plainly different rights, and one key currently governs both.

### Everything below came out of building `tests/rls`

(see AGENTS.md §7). The suite is green: neither of these is an isolation failure, and
neither blocks anything today.

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

The first run after `npx supabase db reset` is fine, which is why this has not bitten
anyone — AGENTS.md §7 gives the two commands in that order. But the file's own comment
says teardown exists "so the suite is re-runnable", and it is not. A reversal row is
the product-level answer to an unwanted payment; the harness wants a genuine delete, so
this probably means dropping the trigger for the fixture's rows rather than working
around it.

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
