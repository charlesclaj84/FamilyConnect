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
| 1 | migration | System-groups backfill. `20260618000000`'s group seeding is a one-shot DO block over families that existed then; new families have no Administrators group, so there would be nobody to approve anyone. |
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
   Either seed it in `register.ts` create-mode or make the default fail closed.

### Decisions already taken

- Join pends; the founder creating a new family does not. Implemented by the BEFORE
  INSERT trigger asking whether the family already has an approved user-linked member,
  so `register.ts` needs no branch. Leaving `?mode=join` unpended would be a complete
  documented bypass.
- Reject sets `'rejected'` rather than deleting the row — `people(id)` is referenced
  `ON DELETE CASCADE` from four tables, and a delete strands the auth account with
  `app_metadata.family_code` still naming the family.
- Approving also adds the member to the seeded General group; otherwise they fall to
  bare defaults rather than the policy the family configured.
- Replace `generateCode()` — *already done in phase 1*.

### Open, and worth deciding before step 8

Returning the family name for any valid code is an enumeration oracle by construction.
Accepted: codes are meant to be shared and the payoff is only a name. Rate-limit the
lookup anyway.

## Authorization

Both entries below came out of building `tests/rls` (see AGENTS.md §7). The suite is
green: neither of these is an isolation failure, and neither blocks anything today.

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
