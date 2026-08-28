<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Three words that name three different products

When an instruction here says **Home**, **Dashboard** or **Staff**, it means one of these and
never another. They are not three views of one app — they are three apps, with different
audiences, different routers and different rules.

| Word | Who is looking at it | Where it lives |
|---|---|---|
| **Home** | Somebody **not** signed in. The public marketing site at genorra.com — the landing page and everything around it that sells the product. | `app/page.tsx`, `app/(marketing)/*`, `components/marketing/*` |
| **Dashboard** | A signed-in **member**, working with their family. The whole product behind the login. | `app/(protected)/*`, and `app/(protected)/dashboard` specifically when the landing screen is meant |
| **Staff** | A GENORRA **employee**, working across every family at once. Added 2026-08-18. | `app/(staff)/*`, `app/actions/staff/*`, `components/staff/*`, `lib/auth/staff.ts` |

**This said "two" until 2026-08-18** and the third is not a variation on the second. Every rule
below about family isolation is a rule the Dashboard obeys and the Staff console deliberately does
NOT: its whole job is to read across families, so §3's "re-apply what RLS would have done" is
inverted there and each of its actions says so in its own header, because a reviewer's reflex is
that a missing `.eq('family_code', …)` is a bug.

What holds it shut instead is narrower and has to stay that way:

* **`genorra_staff` has RLS enabled and ZERO policies**, so `anon` and `authenticated` can read no
  row of it at all. Staffness is resolved on the SERVER through the service role and passed down
  as a prop; there is no client-side check to spoof and no flag in user metadata.
* **Access is granted from `/staff/access`, and ONLY by an `owner`.** This said "by hand, with
  SQL. There is no UI for it and there must not be one until there is a reason" until
  2026-08-19; the reason arrived, and the screen exists. What made it admissible is that the
  screen is narrower than the console around it: `requireStaffOwner()` in `lib/auth/staff.ts`
  gates the page and **all four** actions in `app/actions/staff/access.ts` — including the READ,
  because a `support` staffer must not learn who else has access, that being the next thing an
  attacker wants. It 404s like everything else here (see below), so the owner-only screen inside
  the console does not advertise itself either. A grant takes an **email**, resolved to an
  account through the admin auth API, never a `user_id` from the client (§2b's rule about taking
  an identity as a parameter); `note` is required, because the column is an audit record and a
  bare uuid is not one; nobody may change or revoke their own row; and the last `owner` cannot be
  demoted or revoked. SQL is still the bootstrap — `supabase/scripts/grant_staff.sql` is how the
  FIRST owner exists on a database with no console access at all — and it is no longer the
  routine path.
* **`genorra_staff.role` is now LOAD-BEARING, and `owner` is the one line it draws.**
  `20260817000005` shipped `support | engineer | owner` as a column "carried now, consumed by
  nothing yet", and `/staff/access` is what changed that: `owner` means "plus deciding who else
  may open the console". **`support` and `engineer` are still the same thing** and must not be
  split on a guess — nothing anywhere distinguishes them, and inventing a distinction would be
  a control nothing consults. The vocabulary stays three-valued because the database's CHECK is,
  and because `owner` needs something to be an escalation from. `20260819000002` §C **promoted
  every existing row to `owner`**, which preserves the status quo exactly rather than being
  generous: while the column governed nothing, every staff member could already do everything
  the console offers, so promoting changes nothing about what any of them can do — whereas
  leaving them `support` would have silently demoted them AND left a granting screen with nobody
  able to grant. New grants still default to `support`, which is where the caution belongs.
* **Every page under `app/(staff)` guards itself and 404s**, never a "denied" screen: a staff
  console should not advertise that it exists. The layout guard is a convenience, not the gate —
  §2's argument about pages and actions, one level up.
* **It has no `permission_resources` row and must not.** Staffness is orthogonal to the family
  permission model, and putting it in that grid would tell a family's administrator the console
  exists.

The distinction is load-bearing, not vocabulary policing, because the two halves are
governed by opposite rules and a change aimed at one is usually wrong in the other:

* **Home is indexed; Dashboard is not.** `app/(protected)/layout.tsx` sets
  `robots: { index: false }` for everything beneath it, and `app/robots.ts` deliberately
  declines to name those routes at all. A page title, a meta description or an
  OpenGraph image is an advertisement on Home and a leak on the Dashboard.
* **Home has no caller to authorize; the Dashboard authorizes every one.** Nothing on
  Home reads family data, so §1's `requireView` preamble does not apply there — and its
  absence on a Dashboard page is the bug that section exists to prevent.
* **Home shows the same bytes to everyone; the Dashboard is different for every
  member.** Marketing copy can be a literal. Dashboard content is whatever the caller's
  one permission template says it is, fetched (never merely hidden) accordingly (§5).
* **"Dashboard" has a narrow sense too** — `/dashboard`, the screen a member lands on.
  Which one is meant is usually plain from the instruction; when it is not, ask.

"Back Office" in a vendor design handoff means Dashboard — **not Staff.** A vendor has never seen
the staff console and is not designing for it.

# Authorization is not optional

Every page, sub-page, feature and server action checks the caller's permissions
itself. No exceptions, and no relying on something upstream having already checked.

The reason is structural, not stylistic: **a server action is a public HTTP endpoint.**
Next.js gives every `'use server'` function a URL, and anyone signed in can call it
with any arguments they like. The page that renders the form is not a gate — it is a
convenience. An action that trusts the page protecting it is unprotected.

## 1. Every page gates at load

Immediately after resolving the user, before any data is read:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
await requireView(user.id, '<resource-key>')   // 404s anyone without view
```

The resource key is the route without its leading slash, and the route must be
registered in `lib/features.ts` — `viewableResources()` walks that registry to build
the sidebar, so an unregistered page can never be hidden from anyone.

The only page exempt is `/coming-soon`, which must render precisely when the caller
*cannot* reach a feature.

## 2. Every server action gates itself

Read the user, then check, then act:

```ts
if (!(await canAny(user.id, 'family-finances', 'edit'))) {
  return { success: false, message: 'Not authorized' }
}
```

Pick the check deliberately — see `lib/auth/permissions.ts`:

| Helper | Use for |
|---|---|
| `can()` | Access at all. True for scope `'own'`, so only where RLS or the action then narrows the write to rows the caller owns. |
| `canOn()` | A specific row, honouring own-vs-any. Pass the people.id that owns it. |
| `canAny()` | Records with no coherent "own" version — family-wide configuration (funds, schedules, milestones, routing), and anything where the row a member would "own" is the abuse case. A disbursement paying **themselves** is the example that motivated this helper. |

Which resource key governs which table is recorded in `permission_table_map`
(migration `20260618000001`). Use the same key the RLS policy uses; the code and the
database must never disagree about who may do what.

`lib/auth/guard.ts` wraps the whole preamble — auth, permission, family code — in one
call, so it cannot be half-written:

```ts
const g = await requireEdit('elections')
if (!g.ok) return { success: false, message: g.message }
// g.familyCode, g.personId, g.userId
```

### Self-service actions check ownership, not a grant

Sending a chat message, submitting an RSVP, casting a vote, editing your own profile:
things every member may do by definition. `create` and `edit` default to scope `'none'`,
so demanding a grant for these would lock the whole family out of chat.

These use `requireMember()` — and they still owe a check, just a different one: that
the row being touched is genuinely the caller's, and that every id arriving from the
client belongs to their family. `submitGatheringTask` is the worked example: any member may
answer a task, but only one assigned to them, and only on their own family's gathering.
`submitRsvp` was the example here until Events was retired; the shape is the point.

"No permission needed" never means "no check needed".

`requireMember()` also demands an **approved** membership, since `20260806000011`.
A `people` row can exist without its owner having been admitted to the family — that
is what joining by family code creates — and every one of these actions is defined as
something a *member* may do. The database refuses them independently, because
`auth_person_id()` gates on `membership_status` and so collapses every own/self
expression a pending caller could match; the guard exists so the caller is told,
rather than watching a policy match zero rows and being shown "saved".

The exception is editing your own profile, which a pending member may do and which
therefore does not go through `requireMember()`. That makes `people` the one table
whose UPDATE policy a non-approved caller can satisfy — so a write to it must
allow-list its columns (`lib/profile-columns.ts`). `membership_status` lives on that
row, and `saveProfileSection({ membership_status: 'approved' })` was a self-approval
every policy in the database was satisfied by, because the row really was theirs.

## 2b. A function in `public` is a public endpoint. Grant it deliberately

PostgREST publishes every function in `public` at `POST /rest/v1/rpc/<name>`, and the
anon key ships in the browser bundle. A SECURITY DEFINER function with a loose grant is
an unauthenticated HTTP endpoint running as its owner with RLS switched off.

**`20260806000015` locked this down**, and until it did, a `REVOKE` in a migration was
documentation rather than enforcement: `supabase/seed.sql` re-granted every function
after every reset, and the hosted project did the same. `seed_family_system_groups()`
was the cost — its own migration revoked it from PUBLIC and granted it to nobody, and
an **anonymous** call still restored an Administrators grant an admin had deleted.

Grants are now the primary control. Three rules follow.

**1. Adding a function means adding its grant.** Default privileges now revoke EXECUTE
from `anon` and `authenticated`, so a new function is unreachable from the browser until
a migration grants it. If the app calls it with the user client, grant it to
`authenticated`; if only with the admin client, grant nothing — `service_role` keeps
EXECUTE by default. `20260806000015`'s assertion block fails the push if a function ends
up executable by a role not on its list, so drift stops the deploy rather than shipping.

**2. A function named in an RLS policy needs the grant too.** Policy expressions are
evaluated as the QUERYING role — revoke `auth_family_code()` and every authenticated
query in the app dies with "permission denied for function". The lockdown derives those
grants from `pg_policies` at migration time rather than hard-coding them, because the
policies here are themselves composed at migration time and hosted has drifted from the
chain before (`d9d91c0`). Realtime counts: it evaluates RLS as the subscribing role, so
`auth_uid_is_room_participant()` is load-bearing for chat despite having no call site — and
that was an aspiration rather than a fact until 2026-08-21, when `chat_messages` finally
joined the publication it was being narrowed for. See "REALTIME NEEDS THE TABLE IN A
PUBLICATION" below.

Trigger functions need no grant — EXECUTE is checked at `CREATE TRIGGER` time, not at
fire time — and neither does a function called only from inside another SECURITY DEFINER
function, which runs as that function's owner.

**3. Grants are the outer layer, not the only one.** Still write the function as if it
were reachable, because twice now the outer layer has been re-opened by something
outside the migration chain:

* Re-derive the caller from `auth.uid()` and the permission model. Never rely on a
  function being unreachable.
* **Never take an identity as a parameter** unless the function distinguishes the caller
  itself. `redeem_family_invitation` needs one for registration, so it reads the role
  from PostgREST's verified JWT claims and honours `p_user_id` only for `service_role`;
  for everyone else the argument is ignored, not validated.
* Inside a SECURITY DEFINER body `current_user` is the owner and tells you nothing. The
  caller shows up in the JWT `role` claim and the `role` GUC — see
  `seed_family_system_groups`, which refuses a known browser role unless it arrived via
  `pg_trigger_depth() > 0`.
* **Do not assert `NOT has_function_privilege(...)` and call it protection** unless you
  have checked what runs after the migration. That assertion passed for ten seconds and
  was false thereafter.

## 2c. A new TABLE is born readable and writable by the browser. RLS is the whole gate

The counterpart to §2b, and the opposite answer. For a FUNCTION the grant is the primary control.
For a TABLE in `public` there is effectively no grant to control, because Supabase ships a default
ACL that hands both browser roles everything before your migration runs. Measured 2026-08-19:

```
SELECT defaclobjtype, defaclacl FROM pg_default_acl
 WHERE defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'r';

 r | {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
    authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

`arwdDxtm` includes SELECT, INSERT, UPDATE and DELETE, for **`anon` as well as `authenticated`**.
So a table created by a migration in this repo already holds them, and three things follow that are
easy to get backwards:

* **A `GRANT SELECT … TO authenticated` in a migration is a no-op.** It records nothing — `relacl`
  does not even change, because the privilege was already held. Writing it is still worth doing as a
  STATEMENT of what the table is for, and `20260811000000` and `20260819000000` both do; just do not
  believe it is what makes the table safe.
* **A column-level grant cannot narrow anything.** `GRANT SELECT (a, b)` is additive; it cannot take
  away a table-level SELECT already granted. A migration that issues column lists to hide a money
  column and then asserts `NOT has_column_privilege(...)` **aborts on its own first `db reset`** —
  §2b's warning about `NOT has_function_privilege` in a second costume. And a `REVOKE` is worse than
  useless: `supabase/seed.sql` re-grants everything within seconds of a local reset, so the revoke
  holds on hosted and not locally, and the divergence is invisible until production.
* **Therefore RLS is the entire boundary, and a table with NO policy for a command denies it.** That
  is why a table can carry a SELECT policy and no INSERT/UPDATE/DELETE policy at all and still be
  safe from the browser (`fund_disbursements`, `fund_transfers`, and all six Gatherings tables).
  Verified by doing it: as `authenticated`, against a real row, SELECT returns 0 rows, UPDATE and
  DELETE affect 0 rows, and INSERT is refused 42501.

**The consequence for a permission key that gates a screen and not a table:** it cannot hide a
column. If a key is meant to withhold FIGURES rather than a screen, the figures have to live on a
table the key actually maps to — otherwise say plainly in the migration that it withholds a screen
band, because an administrator moving that switch will believe otherwise. `gatherings/budget` is the
worked example and says so at length.

## 3. The service-role client bypasses RLS — so redo its work

`createAdminClient()` is the service role. No RLS, no family isolation, nothing.
Every query through it must re-apply by hand what RLS would have done:

```ts
.eq('family_code', familyCode)                 // on every read, write and delete
```

Any id arriving from a caller (`fundId`, `personId`, `scheduleId`) must be verified to
belong to this family *before* it is written onto a row. `.eq('id', id)` alone lets one
family reach another's records.

Prefer the user's client (`createClient()`) where RLS can do the work; reach for the
admin client only when the query genuinely needs to see past it, and say why.

### `npm run audit:family-scope` is the gate for this, and it has already caught one

`scripts/family-scope.mjs` sweeps `app/` and `lib/` for a query on a family-scoped table
through `createAdminClient()` with no `family_code` anywhere in the chained statement, and
fails until each one has a stated verdict — the same shape `audit:people` has for writes to
one table, generalised. It is a step in `verify.yml`.

The reason to generalise it is that this rule has been broken four times and never by
disagreement — always by a query in a file nobody was thinking of as part of the feature.
`deleteRegion` and `deleteChapter` had `.eq('id', id)` as their whole predicate;
`revokeRoleByAssignmentId` was the same hole a day later; `createCustomRole` took
`MAX(sort_order)` across every family in the product. The fourth is the one the script found
on the day it was written: **`addGroupMember` read a chat room by id alone and gated on
`created_by === user.id`**, which authorizes the ACTION and says nothing about which family's
room it acts on — so a member of two families could create a group in ALPHA, switch to BRAVO,
and add a BRAVO relative to the ALPHA room with every check in the function satisfied.

Three verdicts are legitimate and all three are in the list: **TRANSITIVE** (the filter is an
id that came out of a family-scoped read, or one already checked with `belongsToFamily`),
**SELF** (the caller's own person or user id, which is narrower), and **STAFF**
(`app/actions/staff/**` reads across families by design). Like `audit:people` it checks that a
verdict EXISTS and never that it is TRUE.

**It cannot see three things**, and they are named in its header rather than left to be
discovered: a query built by interpolation or issued through `.rpc()`; a SECURITY DEFINER
function that does its own reading; and a table nobody added to `SCOPED_TABLES`, which is
hand-maintained and is the honest weak point.

### And `audit_cross_family_refs.sql` is the DATA half, which no code sweep can answer

`supabase/scripts/audit_cross_family_refs.sql`, hand-run against local or hosted. It walks
`pg_constraint` for every foreign key where BOTH tables carry a `family_code` — 90 of them
today — and reports rows where the two disagree. DERIVED rather than listed, so a table added
next year is checked with no edit, which is the lesson `audit_global_lookups.sql` learned from
`truncate_entire_database.sql`'s hand-written keep-list.

It exists because fixing the code does not repair the rows the holes already wrote. Every one
of them wrote a row whose OWN `family_code` was correct — that is the whole shape of §4 —
carrying a foreign key into somebody else's family, and nothing in the product will ever
surface it: the reading side scopes by family, so the reference resolves to nothing and the
screen renders a blank where a name should be. **That is how this class of damage gets
reported: "chapters from Test Family 1 are showing in Test Family 2."**

It REPAIRS NOTHING, deliberately, and `NOTICE`s rather than `RAISE`s so it is safe to run
against production at any time. There is no correct automatic repair: a `people.chapter_id`
pointing across the boundary could be nulled (losing which chapter somebody said they were in)
or repointed at a same-named chapter (inventing a fact), and a `user_roles` row could be
deleted, removing an officer nobody decided to remove. Each is a judgement about one family's
records.

### A service-role write to `people` answers three questions, and `npm run audit:people` demands it

`people` is the one table where the service role can reach a column the browser cannot.
`people_guard_membership_status` and `people_guard_permission_template` both test
`current_user = 'authenticated'`, so they are a boundary around **the role the browser speaks
as**, not around the column. That is deliberate and cannot easily be otherwise: `link-person`
carries a membership across two rows, `tests/rls/seed.mjs` has to state the statuses
explicitly (the stamp trigger overrides insert values, so without those UPDATEs the whole
suite would go green testing nothing), and a SECURITY DEFINER trigger sees its own owner as
`current_user` for every caller alike — which is why `20260806000011` chose INVOKER and
asserts `NOT prosecdef`.

So the obligation is on the caller, and it is `updateUserProfile`'s three questions:

1. **Family-scoped?** `.eq('family_code', familyCode)` beside `.eq('id', …)`.
2. **Columns allow-listed?** `pickProfileColumns(data)`. A `Partial<T>` annotation is erased
   at runtime and the action is a public HTTP endpoint.
3. **Every referenced id verified?** `belongsToFamily(…)` for each id written onto the row.

That used to be a sentence in this file, which is only ever as good as the next person having
read it. It is now a gate: `scripts/people-writes.mjs` sweeps `app/`, `lib/` and `components/`
for `people` writes on the admin client and fails until each one has a stated verdict — and
it is a step in `verify.yml`. **It checks that a verdict exists, never that it is true**; the
judgement stays a person's, and the verdicts are where that judgement is written down. Two
database functions move `membership_status` and are invisible to any grep of this shape
(`redeem_family_invitation`, `set_membership_status`); both are named in the script so their
absence is recorded rather than assumed.

## 4. RLS checks the row — not the ids the row references

The one hole Row Level Security structurally cannot close, and it applies on the
**user** client too, not just the admin one.

A policy is a predicate over the row being written. When an action takes an id from
the client and writes it onto a row of the caller's *own* family, the row is
genuinely theirs — its `family_code` satisfies every policy — while the id it
carries points into somebody else's family. Nothing in the database objects,
because nothing in the database was asked:

```ts
// caller is in BRAVO; personId is a people.id in ALPHA
await supabase.from('person_relationships').insert({
  person_id: myPeopleId,
  related_person_id: personId,     // ← never checked
  family_code: familyCode,         // ← BRAVO, so RLS is satisfied
})
```

So verify the reference before writing it:

```ts
if (!(await belongsToFamily('people', personId, familyCode))) {
  return { success: false, message: 'Person not found' }
}
```

`belongsToFamily(table, id, familyCode)` is in `lib/auth/family.ts`. It uses the
service-role client on purpose: the answer must not depend on whether the caller
holds view permission on the referenced table, or a family that restricts its
Member Directory would break its own family tree.

This is the rule `upsertSpouse`, `upsertAncestor`, `acceptSpouseChild` and
`setMyDuesPlan` were each missing — all four let one family's member link or enrol
against another family's records, and all four passed a reading of the policies,
because the policies were right. Any parameter named `existing_person_id`,
`personId`, `scheduleId`, `fundId`, `eventId` deserves the same look.

**Three of those four no longer exist**, and the examples are kept anyway. `upsertSpouse`
and `upsertAncestor` were deleted on 2026-08-13 with the per-member lineage view they
served; `acceptSpouseChild` went the same day with `app/actions/children.ts`, when a child
stopped being a record its parent owned. `addRelative` in `app/actions/family-tree.ts`
inherited the first two and takes two such ids, both of which it checks;
`editPersonRecord` and `invitePersonRecord` inherited the third and take one each. The
shape is what this section is about, not the function names — and `tests/rls/cases.mjs`
moved the cases across rather than dropping them, one per id, for exactly that reason.

`editPersonRecord` is worth reading as the current worked example, because it is the
sharpest version of this shape in the tree: it runs on the ADMIN client (the `people`
UPDATE policy admits only a member's own row, so the user client cannot touch a record
belonging to nobody), which means **no policy is underneath it at all**. Removing its
`belongsToFamily` call and its two `family_code` conjuncts lets BRAVO's administrator
rename ALPHA's people — verified by doing it, and `family-tree.editPersonRecord` in the
suite is what catches it.

## 4b. A child is a person. There is one kind of `people` row

There is no child record, no `is_minor`, and no "convert to adult". A child is somebody on
the family tree who has no email address yet, recorded exactly the way a grandmother with
no address and a great-uncle who died in 1998 are recorded — `addRelative`'s `record`
mode, which generates a placeholder address and demands a stated reason.

`/direct-lineage`, `app/actions/children.ts`, `components/direct-lineage/` and
`lib/family-constants.ts` were deleted on 2026-08-13, and `20260813000006` dropped the
column. **Do not reintroduce any of it**, and in particular do not add a "this person is a
minor" flag: the old one was two facts that disagreed with each other — a stored boolean
written only by `addChild`, and `computeIsMinor(date_of_birth)` used at read time by
`members.ts`, which returned `false` for a NULL birthday. A stored boolean about age is
wrong the moment it is written, because the row does not change when the person has a
birthday. `lib/age-utils.ts` is now the single definition and it derives.

**AND THERE IS NO HOUSEHOLD EITHER.** Stated 2026-08-22, because the code said otherwise in
four places. `people` has one kind of row and nothing is filed under anybody else — so no
action may move a second person's row as a side effect of somebody editing their own, with
exactly one exception, and the exception is as narrow as it is because a child too young to
have an account cannot file themselves:

> `propagateChapterToChildren` (`lib/chapter-propagation.ts`) moves a member's **sons and
> daughters, under eighteen, with no account of their own** into the chapter they just picked.
> Nothing else follows anybody, anywhere in the product.

Three conjuncts, and each answers a different question — a `Son`/`Daughter` edge somebody
RECORDED (never derived; §4c), `user_id IS NULL` because they cannot set their own chapter, and
under eighteen because an account-less adult cousin on the tree is still their own person. The
middle one was the whole rule until 2026-08-22 and it is necessary rather than sufficient.

**The age is DERIVED and an unrecorded birthday does not move.** `minorCutoff` in
`lib/age-utils.ts` is the one definition, consumed twice — as a comparison by `isMinorOn` and as
a `.gt('date_of_birth', …)` filter by the propagation — so the two are expressions of one rule
rather than two rules that agree today. `NULL > anything` is never true, exactly as
`computeIsMinor(null)` is false: "under 18" is something a family has recorded about a person,
not something to assume about a blank field. A stored `is_minor` is what this section already
forbids.

**The copy on every surface says which people move**, in those words. It said "everyone in your
household moves with you" on My Profile, on the dashboard's chapter banner and in the manual
until 2026-08-22 — a concept this product does not have, over-promising what the function did in
the same breath.

**The two questions the old flow answered still need answering, and here is where they
went.** Both are in `app/actions/family-tree.ts`:

| Old | New |
|---|---|
| a parent edits their child | `editPersonRecord` — ANY approved member may edit ANY row with no `user_id` |
| "Convert to Adult" | `invitePersonRecord` — sends a real invitation; they join the approvals queue |

**A THIRD EDITING SURFACE ARRIVED 2026-08-20 and it is the one for a member WITH an account.**
`updateUserProfile` had existed since Phase 3 as an endpoint with no caller; the member detail
dialog on Members & Access now offers **Edit profile**, behind `admin/members:edit` at
`canAny`. The three surfaces divide by whose row it is, and the division is worth keeping
straight because each has a different gate:

| Surface | Whose row | Gate |
|---|---|---|
| `saveProfileSection` | your own | `requireMember()` — none needed; it is yours |
| `editPersonRecord` | a record with **no** `user_id` | `requireMember()`, and never a row with an account |
| `updateUserProfile` | anybody in the family | `canAny('admin/members', 'edit')` |

All three go through `pickProfileColumns`, and the last two additionally `delete
patch.primary_email` — the address rule above is about the ROW, not about who is writing it.
`getMemberProfileForEdit` reads the form's initial values behind the SAME grant as the save,
because reading a record in order to edit it must not be one grant cheaper than editing it.

The dialog offers **Send a password reset**, which is not the mail cannon the email rules
forbid: it takes a `people.id` and resolves the address itself from a family-scoped row, so
the caller cannot choose the recipient. It refuses a row with no `user_id` and a placeholder
address — there is no account to reset and a generated address can only hard-bounce.

Four bounds on `editPersonRecord`, and the third is the one that looks like caution and
is not:

* **`requireMember()`, and it is the ONLY gate.** The action writes through the admin
  client, because the `people` UPDATE policy admits a member's own row and so cannot
  reach a record belonging to nobody. There is no policy underneath this — see §4.
* **Never a row with a `user_id`.** Its owner is the authority on their own name; that is
  what `saveProfileSection` is for.
* **Never `primary_email`.** A record holds a GENERATED address paired with
  `email_is_placeholder` and a reason. Writing a real address in would leave both flags
  describing an address that is no longer generated, and anything checking before mailing
  would then refuse a working mailbox. The address changes exactly once, when
  `redeem_family_invitation` clears both flags as the account attaches.
* **`pickProfileColumns` on top**, so the same allow-list that stops a self-approval
  through `saveProfileSection` stops one here.

**"Member" and "person" are now different words.** `user_id IS NOT NULL` is the line, and
which side a surface wants is a real decision rather than a default:

| Surface | Who |
|---|---|
| Member Directory, dashboard "Family Members" tile, family tree | everybody — a recorded grandfather is in the family |
| dues and disbursement PICKERS, chapters, Reports' `totalMembers` | accounts only — a record cannot pay or be paid |
| Dues Projections | **every approved person**, account or not — see below |

The Directory needed no change for this: `tg_person_stamp_membership_status` returns early
for `user_id IS NULL`, so an unclaimed row keeps the `'approved'` default and was always
listed. The dashboard tile was the one that disagreed with it, and now does not.

**PROJECTIONS ARE THE EXCEPTION, and the distinction is a PICKER versus a PROJECTION.** Added
2026-08-18. "Accounts only" is right for a picker, because you cannot record a payment from
somebody who cannot log in — and it is wrong for a projection, because a projection is what the
family is **owed**, and a recorded relative who never finished registering owes it exactly as
much as one who did. Leaving them out did not make the figure conservative; it made it wrong,
and it hid precisely the people an organizer needs to chase.

So `/dues-projections` counts every person whose membership is `'approved'`, and reports each as
**Active** (has an account), **Invited** (no account, an open invitation exists) or **Pending
Invite** (no account, nobody has asked them). WRITES ARE STILL ACCOUNTS-ONLY — the Transactions
picker is untouched, and the ledger still cannot name an account-less person.

Two things about it that look like they should be otherwise:

* **The roster is NOT gated on the bloodline**, although the request that prompted this said
  "bloodline members". Two reasons, and the second is decisive. `bloodline_only` on a schedule is
  the one place descent may decide who owes a due (§4c), so gating the ROSTER on descent would
  bill a step-son and not a blood son on a schedule that had said descent was irrelevant. And
  `bloodlineIds()` answers `null` for a family with no anchor — a bloodline-gated roster would
  therefore count *nobody* in most families, silently. The bloodline keeps its one job and the
  two rules stay orthogonal.
* **A pending, rejected or disabled membership is still excluded**, by the roster rather than by
  the status function. Somebody who has not been admitted has not joined, and nothing is owed by
  them yet.

`family_invitations` is what decides Invited, and it has **three** foreign keys to `people`
(`invited_by`, `accepted_by`, `invited_person_id`) — so a bare `people(...)` embed on it is
PGRST201, which §8 explains answers `[]`. It is joined in TypeScript instead. The link is also
matched on the ADDRESS as well as `invited_person_id`, because only `invitePersonRecord` writes
that column: the invite-by-email dialog takes no person at all, and `resendInvitation` re-mints
without carrying the link across.

## 4c. Blood is a property of the LINK, and it is not derivable

`person_relationships.link_kind` — `blood | step | adopted | foster`, default `'blood'`
(`20260813000007`). It is what the family tree's **Bloodline** toggle walks, through
`bloodlineIds()` in `lib/family-tree.ts`.

**Do not try to compute this from the graph.** Two attempts fail, and the second is the
one that matters:

* *"anyone reachable without crossing a spouse edge"* — right for one generation. Add a
  spouse's mother and she gains a `child` edge, so the walk reaches her through a
  marriage.
* *"a child edge means blood"* — a member with three children, one of them his by blood,
  has three identical `child` rows. **Only a person knows which.** That is the fact the
  database was missing and this column now holds.

Four things follow:

* **On the edge, never on the person.** The same child is a step-child of one parent and a
  blood child of the other, so a `people.is_blood_relative` boolean would have to be wrong
  about one of them — silently, about whichever parent was recorded second.
* **Both directions carry it.** `linkRelationship` writes the inverse row with the same
  kind, and `setRelationshipKind` updates both with the same `.or(...)` shape
  `removeRelationship` uses. Blood must not travel back up an edge it could not travel
  down.
* **A marriage is never blood, and the database enforces it.**
  `person_relationships_marriage_is_not_blood` rewrites `'blood'` to `'step'` on any
  spouse-type edge, on insert and on update. It CORRECTS rather than refuses, because
  failing an ordinary "add my wife" on a column nobody typed is the worse product. So the
  UI does not offer the choice for a marriage — it would be offering a control that
  undoes itself.
* **`is_step` is superseded and must not be written.** It predates this, was never written
  by anything, and two columns describing one fact is how they come to disagree. TODO.md
  carries dropping it.

**The bloodline is family-wide, not per viewer.** `bloodlineIds` walks from ONE anchor —
`families.created_by`'s people row, surfaced as `FamilyTree.bloodlineAnchorId`. A
viewer-relative version would make the toggle mean something different on every screen,
and two members cannot disagree about who is in the family's bloodline. `null` anchor
means "do not know": `bloodlineIds` returns `null` and the canvas hides the toggle rather
than guessing.

## 4d. The tree opens where there is something to see

The canvas is focus-plus-context and draws the four generations around ONE person. That is
right for a family of a hundred and forty and has a cost that bit immediately: it opened on
*you*, and a member who married in has no parents and no children of their own, so they got
their own name, their spouse, and two "+" buttons. Nothing said the family was elsewhere —
they are not unattached, so `leafIds` (which means **no relationships at all**, and is a
narrower thing) did not list them either.

Two fixes, and both are load-bearing:

* **`openingFocus()`** centres on you when you have any non-spouse edge, and otherwise on
  the person you are attached to, preferring a spouse. When it moves it **says so** on
  screen with a "Centre on me" link — a tree that quietly centres on somebody else is worse
  than one that starts empty.
* **The "Everyone in this family" index** lists the whole roster, always, each name
  centring the tree. It is not the "Not on the tree yet" section and does not replace it:
  that one answers *who is connected to nobody*, which is work to do; this one guarantees
  nobody is more than one click from anybody.

## 5. Gate the fetch, not just the button

Hiding a control does not protect the data behind it. Props are serialized into the
RSC payload and reach the browser whether or not a component renders them, so a page
that fetches the member roster and then hides the form has still published the roster.

Decide what the caller may *see*, fetch only that, and let the UI follow.

## 6. New permissioned surfaces need a migration

A new page needs a row in `permission_resources` so administrators can restrict it on
Members & Access. Without one it still works — an unregistered **non-admin** resource
defaults to viewable — but it can never be turned off, which is a silent default nobody can
fix from the UI. Add the row in a new migration *and* in the seed in `20260618000000`,
whose insert is `ON CONFLICT DO UPDATE` and would otherwise revert it on replay.

**An `admin/` key is the exception, and since `20260817000004` it fails CLOSED.** Where the
family has no `resource_visibility` row, `view` resolves to `'none'` for a resource whose
category is `'admin'` — and for an unregistered key shaped `admin/…`, which is the case a
category cannot answer for. Everything else keeps the `'everyone'` default. That closes
Phase 3's second leftover: `admin/approvals` shipped world-readable and had to be backfilled
out of it, and every family created before `20260618000000` had no visibility rows at all.
The `admin/` prefix is a sound stand-in for the category because that migration **asserts**
the two can never disagree, in both directions, or it refuses to apply.

Three resolvers implement this rule and all three must move together — `auth_permission()`
in SQL, and `resolveScope()` **and `scopeInFamilies()`** in `lib/auth/permissions.ts`. TODO
named the first two; the third carries its own copy of the fall-through and its one consumer
is the bell, on `admin/approvals`. Left behind, it would tell an administrator that a queue
was waiting in a family whose page then answered 404.

Since `20260807000000` the row is not quite enough on its own. A member's access is
the grid on their one **permission template**, and that grid is materialized — every
template carries an explicit row for every resource and action, so the screen can show
the whole answer without explaining a fall-through. A resource registered later has no
row in the templates that already exist, so it falls back to `resource_visibility`:
`'everyone'` for view (`'restricted'` for an admin key, per above), and none for the rest.
That is a working default, not a complete one. A new resource that should be restricted needs
its per-family `resource_visibility` backfill in the same migration, exactly as
`20260806000007` and `20260806000010` do — and a new resource that a system template should
positively grant needs that backfill too, or only families created afterwards will have it.

**The visibility backfill for an admin key is still required, and its reason has changed.**
It is no longer what makes the key safe — absence now denies — it is what makes the grid
render a switch an administrator can move. So forgetting it is a screen nobody can grant
rather than a screen everybody can read, which is the right way round and is still a bug.
The Administrators grant in the same migration is the half that must not be skipped either
way: "restricted with nobody granted is a screen that exists and cannot be opened", and in
the worst ordering the screen that just locked is the one that could unlock it.

## 6b. One template per member — no second layer

`permission_templates` and `template_permissions` replaced `user_groups`,
`user_group_members`, `group_permissions` and `person_permissions`. There is no group
membership to union and no per-person override to reconcile: `people
.permission_template_id` names one template, `auth_permission()` reads its grid, and
that is the whole resolution.

Two consequences worth knowing before touching `people`:

* **`permission_template_id` is guarded like `membership_status`.** The `people` UPDATE
  policy admits a member's write to their own row, and a policy has no opinion about
  which column changed — so `saveProfileSection({ permission_template_id: … })` would
  be a self-promotion every policy is satisfied by. `people_guard_permission_template`
  refuses any change made by the `authenticated` role; the only ways in are
  `apply_permission_template()` and the service role.
* **`membership_status` gained `'disabled'`.** Nothing had to be swept for it, because
  every gate in the app and every policy in the database tests positively for
  `'approved'`. Keep it that way: never write `<> 'pending'`.

## 7. Every RLS-path action owes a test

An action that reaches the database through `createClient()` has delegated its family
isolation to Row Level Security. Reading the policy is not the same as running it, and
the policies here are not hand-written — `20260618000001` *composes* them out of
`pg_policies` at migration time, so what actually protects a table is a string that
existed in no file anyone reviewed.

```bash
npx supabase start      # once; local only, never the hosted project
npm run test:rls
```

(`npm test` is the other runner and covers something else entirely — see §7b.)

`tests/rls` calls each action for real — the exported function Next.js publishes as an
HTTP endpoint — against a local Postgres with the real policies applied. Only the
cookie-to-JWT plumbing and two `next/*` modules are substituted; the guards,
`lib/auth/permissions.ts`, the admin client and the policies are all genuine.

**Adding an action means adding a case** to `tests/rls/cases.mjs`. The shape is fixed
and the two halves are both load-bearing:

* **The attack** is BRAVO's *administrator* — scope `'any'` on every resource — passing
  ALPHA's real ids. Giving the attacker every grant their own family can confer takes
  the permission layer out of the result: whatever they still reach, they reached
  because family isolation failed, not because nobody had checked a grant. An attacker
  with no permissions proves nothing.

* **The positive control** is the same call, same arguments, run by someone in ALPHA
  who is entitled to it. Without it the suite rots into decoration: an action that
  returns `[]` for everybody — renamed table, unseeded fixture, unattached JWT, a
  query PostgREST refused — passes an isolation assertion trivially. Three of the
  bugs found while writing this suite were found by the control, not the attack.

* **A second attacker, since Phase 3:** `attacker: 'alphaPending'` — someone who has
  joined ALPHA by family code and not been admitted. They are *inside* the family
  boundary by every test the cross-family cases apply, because `auth_family_code()`
  resolves ALPHATEST for them deliberately and permanently. Add one of these for any
  action that reads or writes family data; the existing default control does the other
  half. `PENDING_CASES` in `cases.mjs` is the worked set.

  Note that the fixture states `membership_status` **explicitly**, by UPDATE after the
  insert loop. The stamp trigger overrides insert values, so left alone it would make
  the first person seeded into each family approved and every one after it pending —
  and the whole suite would then go green while testing nothing, because a pending
  attacker is refused by the membership gate before family scoping is ever consulted.

**A green suite is not evidence until you have seen it fail.** Mutate the thing you
believe is protecting the data — drop the conjunct, neuter the function — and re-run.
Phase 3's ten pending cases fail that way; three others pass, and are labelled in
`cases.mjs` as not being evidence for the conjunct rather than left looking like they
are. The commands are in the `PENDING_CASES` header.

Where a control genuinely cannot apply, say so in the case (`positive:
'not-applicable'` plus a `why`) rather than deleting it. The runner reports those
separately, so a gap stays visible instead of blending into the green.

### `npm run audit:rls-cases` is the gate for that sentence, and it corrected its own backlog

`scripts/rls-coverage.mjs`, a step in `verify.yml`. It enumerates every exported function in
`app/actions/`, cross-references the module-and-function pairs `cases.mjs` names, and fails
until each uncovered one carries a stated verdict — the same shape and the same promise as
`audit:people` and `audit:family-scope`: **it checks that a verdict EXISTS, never that it is
true.**

The reason it is worth having is that this gap is invisible by construction. A missing case
does not fail, does not warn, and reads exactly like a covered action — so it is only ever
found by somebody deciding to count, which had happened once, by hand, and produced the wrong
number: FutureFeature.md carried "167 server actions have no RLS case" against a real figure
of 57, because the hand count matched `fn:` and missed the `read(id, mod, fn)` helper form
most of the suite is written in. **A backlog nobody can count is a backlog nobody can shrink.**

Four things about it, and the third is the one that makes it a gate rather than an inventory:

* **Three verdicts, not 57 sentences.** `BACKLOG` (owed a case, and the honest state),
  `RIGHTS-ONLY` (the whole return value is booleans about the caller's own grants, so no
  cross-family assertion is available — `bylaws.getBylawRights` is the worked example of
  writing one anyway), `STAFF` (`app/actions/staff/**` reads across families by design). A
  bespoke excuse per entry is what `createDuesSchedule` fell off: a reason is read once, and a
  name is diffable.
* **A `raw/` probe is NOT coverage of the action it stands in for.** The two answer different
  questions, and conflating them would let a raw probe retire an action's case.
* **`BACKLOG_CEILING` is a ratchet.** Lower it freely; raising it is a deliberate act needing a
  sentence. Without it a new action could be added to the verdict list in the same commit that
  introduces it, which is this section's rule broken with the audit's blessing.
* **It cannot tell a good case from a bad one.** A vacuous control counts the same as a
  mutation-checked case, so "a green suite is not evidence until you have seen it fail" is
  still addressed to a person.

Two failure modes to watch for in the fixture itself, both of which silently turn a
real finding into a pass: a case whose positive control **mutates a row a later case
depends on** (give it its own row — that is what `deletableChild` is for), and a probe
whose projection **omits the column the control changes**, so a successful write looks
like a no-op.

### An action that narrows a write by hand hides its own policy from the suite

Added 2026-08-21. **Whenever an action states a filter that duplicates a conjunct of the
policy underneath it, no action-shaped case can test that conjunct** — the action narrows
the request before PostgREST ever sees it, so the attack half passes with the policy
conjunct deleted. Measured twice, from opposite directions:

* `retractNomination` states `.eq('person_id', g.personId)` beside a DELETE policy whose
  first conjunct is `person_id = auth_person_id()`. That filter is worth keeping — without
  it the statement asks to remove EVERY supporter of the nomination and is narrowed to one
  row only by the policy, so a future widening would silently turn the control into "remove
  everybody's nomination". With the conjunct dropped, **all ten action-shaped retraction
  assertions stayed green.**
* `tests/rls/raw/elections.mjs`' own header records the same shape with an APP-LAYER filter
  rather than a hand-written one: `lib/election-area.ts` filters in TypeScript as well as in
  SQL, so with `auth_may_see_election()` replaced by `true` the suite reported 649/649.

The answer both times is a **raw probe** — `tests/rls/raw/*.mjs`, driven by `run.mjs` like
any other module — which sends what the action refuses to send. `rawDelete` and
`rawInsert` both take no `.select()`, for the reason `raw.mjs` states at length: PostgreSQL
ANDs the SELECT policy into any statement carrying a RETURNING clause, so a probe with one
reports a refusal that came from the wrong policy.

So the test is not "does this action have a case" but **"if I delete this conjunct, does
something go red"** — and where the answer is no, the case belongs in `raw/`.

#### And for UPDATE and DELETE, the SELECT policy is the FLOOR. A raw probe cannot get under it

Added 2026-08-22, and it is the limit of everything above. **PostgreSQL applies the SELECT
policies to an UPDATE or DELETE whose WHERE clause references the table's columns** — finding
the rows requires SELECT rights on them. PostgREST cannot express an unfiltered UPDATE or
DELETE. So for every caller that comes through the API, a write policy can never be wider *in
practice* than the read policy on the same table, and a raw probe cannot isolate a write
policy's own conjuncts at all.

Measured rather than reasoned, which is the only reason this is written down. `20260822000013`
repairs five photo write policies that said `((owner) OR true) AND <permission>` — `X OR true`
is `true`, so as written all five matched every photograph in the PRODUCT for anybody holding
`community/gallery` at scope `'any'` (then `review/photos`). Five raw probes were written to catch it and **stayed green
with the broken policy restored.** As BRAVO's administrator, with a real JWT, against the local
stack:

| | |
|---|---|
| `auth_permission('review/photos','delete')` (now `community/gallery`) | `'any'` — so the DELETE policy admitted them |
| `DELETE /rest/v1/photos?id=eq.<an ALPHA photo>` | `204`, and the row **survives** |
| the same request, `photos` SELECT widened to `USING (true)` | `204`, and the photograph is **gone** |

The third line is the control: nothing changed but the READ policy, and the write landed.

Four things follow, and the second is the one that will bite:

* **A missing conjunct on a write policy is latent, not live**, as long as the SELECT policy on
  that table is correctly scoped. That is why the photo repair is defence-in-depth rather than
  an incident.
* **Widening a SELECT policy is therefore a WRITE decision too.** A "share an album by link"
  feature on `photos` would have turned all five of those policies live in one edit, in a diff
  that mentions only reading.
* **The conjunct can only be asserted in SQL**, so it is — in the migration's verify block,
  which reads the policy back out of `pg_policies` and additionally refuses **any** policy in
  the schema containing `OR true`. A test that cannot see a thing must not be labelled as
  evidence for it: `PHOTO_RAW_CASES` says at the top what it is and is not evidence for, the
  way four of `SWEEP_CASES` do.
* **`OR true` is worth grepping for on sight.** It is never intentional. All five instances were
  `<owner> OR is_admin(…)` before `20260618000003` replaced the admin half with the literal
  `true` on its way to `auth_permission` — everywhere else that produced a harmless `false OR`
  in the self_expr slot, and on these five it landed on the side of an OR that was carrying the
  family scoping.

**A THIRD REASON AN ACTION-SHAPED CASE CANNOT SEE ANY OF THIS:** `confirmWrite` ends its
statement in `.select(...)`, which ANDs the SELECT policy in explicitly as well. So **an action
that reads its own write back cannot test its write policy** — true of all five `confirmWrite`
call sites by construction, and worth remembering before writing a case that looks like it
covers one.

#### The same blind spot has a READ form, and it arrives whenever a child table is added

Added 2026-08-22. The two cases above are writes narrowed by a hand-written filter. **A READ of
a child table is narrowed by its parent for free, and that hides the child's policy just as
completely** — with nothing in the action that looks like a filter anybody chose.

`getJournalEntries` reads the topics, then their notes with `.in('entry_id', <the ids it just
got back>)`. For a caller who holds no office the first read answers `[]`, so the function
returns before it ever mentions a note. **Measured: the notes SELECT policy reduced to family
plus approval, and all 43 journal assertions stayed green.** The entries policy was answering
for both tables, and a member who knew an entry id could read its notes straight off PostgREST.

That query is right and should not change — narrowing to the rows you can see is what a read
should do. What follows is a rule about the TEST:

**Every child table added under a scoped parent owes a `raw/` SELECT probe of its own**, unless
you have watched its policy's conjunct come out and something go red. The tell is an action that
reads a parent and then filters the child by ids the parent returned; `tests/rls/raw/journals.mjs`
is the worked example, and it found this on its first run. Two further shapes fall out of the
same argument and are in that file:

* **An id the action derives can never be wrong**, so a policy conjunct about it is
  unreachable. `addJournalNote` takes the byline from the caller's own guard (§2b), so the
  INSERT policy's `author_id = auth_person_id()` is satisfied by construction — the probe sends
  somebody else's person id, which no action can.
* **A `family_code` the action always stamps with the caller's own** likewise. The probe stamps
  a different one, which is the only way to reach a §4 guard trigger from a browser role.

#### AND A GUARD HIDES A POLICY EXACTLY AS A HAND-WRITTEN FILTER DOES

Added 2026-08-22, and it is the third instance of one shape rather than a new one. The two
cases above are an action narrowing a statement — by a filter it writes, or by ids its parent
returned. This is an action not sending the statement AT ALL.

Measured on `bylaws`, whose SELECT policy is `family_code = auth_family_code() AND
auth_membership_approved()`. Delete the second conjunct and **`bylaws.getBylaws (pending
member)` stays green** — because `getBylaws` opens with `requireMember()`, which refuses an
applicant and returns `[]` before a query is ever sent. The guard answers, the policy is never
consulted, and the case is evidence for the guard.

That generalises uncomfortably far: **every applicant-shaped case in the suite whose action
opens with `requireMember()` is evidence for the guard rather than for the conjunct**, and the
`PENDING_CASES` header's own instruction — mutate the thing you believe is protecting the data
— is the only way to tell which of your cases are in that position. `tests/rls/raw/bylaws.mjs`
is what reaches the conjunct there; under the same mutation exactly one line in the suite goes
red, which is what a probe is supposed to look like.

The rule this leaves: **an approval or membership conjunct on a policy owes a `raw/` probe**,
because no action that checks membership first can ever reach it.

#### AND TWO POLICIES THAT READ EACH OTHER'S TABLES ARE 42P17. THE ADMIN CLIENT HIDES IT COMPLETELY

Added 2026-08-23, and it is the one entry in this section where the suite found a REAL BUG rather
than a gap in its own coverage — so it is worth reading as the argument for the control half
rather than as another caveat.

`20260823000001` shipped two tables with the ordinary shape: a parent, a child, and a `self_expr`
on each so an addressed relative can always reach their own row (§7's `gathering_tasks` rule).
Written the obvious way that is one line in each direction:

| Policy | reads |
|---|---|
| `safety_check_ins:select` | `EXISTS` on `safety_check_in_people` — *"am I on this roster?"* |
| `safety_check_in_people:select` | `EXISTS` on `safety_check_ins` — *"did I raise it?"* (`own_expr`) |

Each table's policy needs the other, whose policy needs the first. **Every read through the user
client raised `42P17`, "infinite recursion detected in policy".**

**FOUR THINGS COULD NOT SEE IT, and that is the whole lesson:**

* **The migration's verify block.** It reads `pg_policies` as TEXT, and a recursive policy is
  perfectly well-formed text. Every assertion in that file passed.
* **`npm run db:check` and `db:audit`.** Versions and shadowing; neither executes a query.
* **The whole feature.** Every read in the action module but one is on the ADMIN client — which
  ignores RLS entirely, deliberately, because a roster that narrowed to what the reader may see
  would report a WRONG count rather than a withheld one (§3). So the screens all worked.
* **Every attack assertion in the suite.** A policy that errors returns nothing to EVERYBODY, so
  the cross-family halves passed perfectly.

**WHAT FOUND IT WAS THE POSITIVE CONTROL** — ALPHA's own administrator getting `null` from their
own family's list — which is §7's argument made a fourth time, alongside `getPhotoCollections`'
dropped-table embed and the `photos` DELETE policy. *"An action that returns `[]` for everybody
passes an isolation assertion trivially."*

The fix is the one this codebase already had: **a `SECURITY DEFINER` function breaks the cycle**,
because it runs as its owner and the read inside it does not re-enter RLS.
`auth_uid_is_room_participant` (`20260603000001`) exists for precisely this shape;
`auth_is_on_safety_check_in` is the second instance. Three rules come with it:

* **Break ONE side, not both.** The child may still read the parent under RLS once the parent no
  longer reads the child — the chain terminates. Wrapping both hides the cycle rather than
  removing it, and leaves the next person adding a third table with no way to see the rule.
* **The helper needs its `EXECUTE` grant to `authenticated`** (§2b rule 2) and `SET search_path
  = ''`. Without the grant every read *errors* rather than being refused, which on the realtime
  path is indistinguishable from a policy correctly withholding a row.
* **The `permission_table_map` row must carry the FUNCTION CALL, not the subquery it replaced.**
  That column is what a future policy sweep composes from, so the inline `EXISTS` left there
  would have the sweep reintroduce the recursion — silently, in a diff that mentions only
  "recomposing policies".

**The general rule: a `self_expr` that reaches into another table whose own policy reaches back is
a cycle, and the only thing that will tell you is a real query as a real role.** Before writing
one, ask what the other table's policy reads — and `SET LOCAL ROLE authenticated; SELECT count(*)
FROM <table>;` through `psql` is the ten-second check.

## 7b. Arithmetic is tested with `npm test`, not with `tests/rls`

`vitest` runs the pure modules under `lib/`, and its `include` is `lib/**/*.test.ts` as a
BOUNDARY rather than a default: it has no jsdom, no React and no Supabase, and must never
become a second, weaker place to "test" a server action. An action tested without RLS is an
action tested without the thing that protects it.

The two runners answer different questions and neither substitutes for the other. §7's
suite calls actions for real against real policies, because family isolation is enforced by
SQL that exists in no file anyone reviewed. It cannot check a figure: its fixtures seed dues
schedules with **no `start_date` at all**, so an assertion about installment maths there
exercises one null branch and passes while testing nothing — the exact failure §7 warns
about.

`lib/dues-utils.ts` is why this exists. `duesPlanMath` takes `today` as a PARAMETER, so the
whole of the plan arithmetic is checkable; every other helper in that file reads
`new Date()` internally, which is why none of them ever was. A new pure module with real
edge cases — dates, money, rounding — takes `today` (or whatever else it would otherwise
read from the world) as an argument for the same reason.

**And the same rule applies here as to the RLS suite: a green run is not evidence until you
have seen it fail.** The dues tests were checked by mutation — removing the month-end
clamp, freezing the elapsed-rung count, zeroing the covered-rung count and dropping the
future-start guard each trip a different set of them.

## 7c. Dues: what a member pays next is not their installment

`installmentCents` is the steady-state figure — what an installment costs once a member is
level. `nextInstallmentCents` is what the NEXT one has to be. They differ whenever the
calendar has already asked for installments the money never covered, and `duesPlanMath` in
`lib/dues-utils.ts` is the single place that decides both.

The rule: **the next installment covers everything already due plus the one now due**, so
the one after it is the ordinary amount and the member is back on schedule. Switching to
monthly on 14 August on a $600 schedule that opened on 1 January is $450 on 1 September,
then $50 on 1 October.

Four things that were wrong before it, each of which a future change could reintroduce:

* **A ledger row is not money.** The old date was `anchor + (count of payment rows)`, so
  two $1 payments outran one $500 payment — and a REVERSAL, which is written as a `paid`
  row with a negative amount, pushed the next due date FORWARD while the money went
  backward. Count rungs against the clock and cents against the total; never mix them.
* **The ladder starts at the CURRENT period, not at `start_date`.** `remainingBalanceCents`
  is the annual total less what was settled *this period*, so arrears measured from
  anywhere else describes a different debt from the balance beside it. Anchoring on the
  original start date left every second-year schedule pointing at dates a year or more ago.
* **`setUTCMonth` overflows.** From 31 January, +1 month is "31 February", which resolves to
  3 March — a ladder with no February rung, two in March, and one fewer in the year, which
  under-bills by a whole installment. The Accounting form prefills the start date with
  today, so a schedule anchored on the 29th–31st is ordinary. `addCadenceSteps` clamps, and
  takes the day from the ANCHOR each step so a clamped February does not drag March back.
* **`currentPeriodStart` never returns null and `duesPlanMath` must not assume it means
  something.** It defaults to 1 January, so building a ladder on it unconditionally gives
  every schedule with no `start_date` and no `due_month` a year of phantom arrears. Those
  rows are real: the Accounting form writes `due_month: null, due_day: null` on every
  create and does not require a start date.

Two boundaries to keep. **This withholds no rows and changes no ledger:**
`remainingBalanceCents`, the paid totals and the family's collected figure are untouched,
and moving arrears into the balance would change the dashboard headline and every sum built
from it. And **a member who joined mid-year owes from the period start** — which is not this
function inventing a charge, it is the balance's existing policy finally being itemized,
since nothing in the product prorates.

**DUES DO NOT PRORATE, AND SINCE 2026-08-20 THAT IS A DECISION RATHER THAN A DEFAULT.** This
paragraph used to end by naming `dues_member_plans.start_date` as where to floor the ladder if
prorating ever arrived. `20260820000005` DROPPED that column, and the reason is the general
lesson: it was `NOT NULL DEFAULT CURRENT_DATE` and written by nothing, so every row held the
date its plan row happened to be created — a column full of plausible dates that describe
nothing, which is precisely what a later change picks up and trusts. Flooring on it would have
let anybody shrink their own arrears by re-picking their cadence twice. Same shape as
`is_minor` (§4b): a stored value where a derivation belongs.

A family wanting a half-year rate says so with a second schedule at a smaller `amount_cents`
— a figure an organizer states rather than one a derivation invents. If real prorating is ever
wanted, that migration's header carries what it costs, and the first item is that
`remainingBalanceCents` has to move with the ladder or the member's screen shows two numbers
describing different debts.

The catch-up marker is `--brand-withheld`, never `--destructive`. An unpaid installment is
neither an error nor a deletion, and reporting a failure is `form-message.tsx`'s job.

## 8. An empty result is not the same as no rows

`const { data } = await supabase.from(…)` discards the error. When PostgREST refuses a
query the action does not fail — it returns `[]`, and the page renders "nothing here"
over data that exists.

The recurring cause is an ambiguous embed. Where two foreign keys join the same pair
of tables, `people(first_name)` is refused with **PGRST201** and the whole query dies:

```ts
.select('*, people!fund_disbursements_person_id_fkey(first_name, last_name)')
```

`fund_disbursements`, `fund_contributions`, `dues_payments`, `election_votes`,
`election_nominations`, `photo_tags`, `person_relationships`,
— since `20260813000001` — `announcements`, and — since `20260819000000` —
`gathering_tasks` (`assignee_id`, `decided_by`) and `gathering_task_submissions`
(`submitted_by`, `reviewed_by`) all have two paths to `people`;
`photo_collections` has two to `photos` (its rows, and its cover); `fund_transfers` has
two to `funds` — where the money left and where it landed, which is the whole content of
the row. Name the constraint. And check the relationship
exists at all before embedding it — `event_rsvp` had no foreign key to `people`, so
`event_rsvp(people(...))` was PGRST200, equally silent. (That table is dropped now, with every
other `event_*` one, but the failure mode is not: it is what a missing relationship
answers, whatever the table.)

**Two more joined the list on 2026-08-18, and one of them is the shape this section warns about
arriving by accident.** `family_invitations` has **three** paths to `people` — `invited_by`,
`accepted_by` and `invited_person_id` (`20260813000004`) — which is why Dues Projections joins it
in TypeScript rather than embedding it: filing every invited relative under "nobody has asked
them" is the silent `[]` this rule exists to prevent.

And `families` now has **two**, which it did not before: `bloodline_anchor_id`
(`20260813000008`) and `removed_by` (`20260817000006`). Adding one column to one table made a bare
`people(...)` embed on `families` PGRST201 everywhere — verified against the live stack, and the
error names both constraints. Nothing in the tree embeds it today, so nothing broke; the point is
that nothing had to, and next time it might. That is the `announcements` lesson in a second
costume, and it is why the sweep below is worth running after ANY migration that adds a foreign
key, not only after one that adds a junction table.

**A DROPPED TABLE'S EMBED FAILS THE SAME WAY, AND THAT IS HOW `/photos` BROKE.** Retiring
Events took `events` with it, and `getPhotoCollections` was still asking for
`.select('*, events(name), photos!…(…)')` — an embed of a relation PostgREST cannot resolve
refuses the WHOLE query, and this one discards its error, so every family's gallery rendered
empty over photographs that existed. Caught 2026-08-19 by the RLS suite's own POSITIVE CONTROL
("owner saw none of their own data"), which is exactly the half AGENTS.md §7 says the suite rots
without. **When a migration drops a table, grep the tree for `<table>(` as well as for the table
name** — an embed does not name the table it joins in any way a search for `from('events')`
would find.

**AND A NESTED EMBED IS THE ONE THIS LIST DOES NOT SAVE YOU FROM.** `photo_tags` has been on the
list above since it was written, and `getPhotoCollection` was still broken by it, because the
ambiguous pair was one level down:

```ts
.select('*, people(first_name, last_name), photo_tags(person_id, people(first_name, last_name))')
```

The OUTER `people(...)` is fine — `photos` has one path to `people`. The INNER one is
`photo_tags → people`, which has had two (`person_id`, `tagged_by`) since
`20260610000001_photo_collections.sql`, so PostgREST refused the WHOLE query with PGRST201 and
`/photos` rendered an empty collection over photographs that existed. Found on 2026-08-19 while
proving `20260819000000` broke no embeds, measured against the live stack, and proved unrelated to
that migration by dropping its six tables, reloading the schema cache and re-asking. Fixed by
naming the constraint on the inner embed.

Two things follow. **Read a `.select()` right to the leaves** — a table named inside another
table's parentheses is a join in its own right and owes the same check. And **an embed refused
anywhere in the tree takes the whole query with it**, so one unqualified nested join empties a page
whose top-level embeds are all correct.

**A JUNCTION TABLE BREAKS EMBEDS ON TABLES YOU DID NOT TOUCH,** and `announcements` is
how that was learned. It has exactly ONE foreign key to `people` (`author_id`) and its
bare `people(...)` embed was correct for a year. Then `announcement_unpins` arrived with
foreign keys to both — a perfectly ordinary two-column join table — and PostgREST began
reporting a second, *many-to-many* path between the same pair. Every announcement query
started answering PGRST201, which is to say `[]`, on a page nobody had edited.

So after adding any table with two foreign keys, grep for bare embeds of **either** table
it joins. The query below finds the pairs; it will not tell you which call sites are
already qualified.

To find every pair that needs disambiguating:

```sql
SELECT conrelid::regclass, confrelid::regclass, count(*)
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
GROUP BY 1,2 HAVING count(*) > 1;
```

## 8b. A write that changed nothing is a failed write. Report it

§8's rule with the stakes moved from reading to writing, and the same root cause: PostgREST
does not treat an empty match as an error.

`create`, `edit` and `delete` default to scope `'none'` on a permission template, and the
composed policies honour that — so a plain member's UPDATE or DELETE matches **zero rows**
and supabase-js hands back `{ error: null }`. An action whose only failure signal is `error`
then reports success over a write that did not happen:

```ts
const { error } = await supabase.from('photos').delete().eq('id', id)
if (error) return { success: false, message: error.message }
return { success: true }                      // ← a lie whenever 0 rows matched
```

The member-visible version is somebody deleting a photograph, being told it went, and finding
it there on reload — with nothing anywhere to explain why, because nothing went wrong as far
as the database is concerned.

**`confirmWrite` in [lib/confirmed-write.ts](lib/confirmed-write.ts) is the one mechanism.**
It ends the statement in `.select(...)`, so `data` is the rows actually touched; retries once
before reporting, because a transient PostgREST failure is indistinguishable from a refusal at
this layer and recovers where a refusal does not; and returns the ROWS, not a count, so a
DELETE can read the row it just removed. Five call sites today — `deletePhoto`,
`untagPersonFromPhoto`, `respondToNomination`, `clearMyDuesPlan`, `uploadAvatar`.

Four things about it are load-bearing:

* **UPDATE and DELETE only. Never INSERT.** The retry is safe because those two are
  idempotent. A retried INSERT after a first attempt that actually landed creates a second
  row. An INSERT refused by RLS raises 42501 anyway and is already honest — which is why
  `tagPersonInPhoto` was the one row in TODO's table reporting the truth while its two
  neighbours did not.
* **It is for actions that rely on RLS to narrow, not for guarded ones.** An action behind
  `requireEdit` is refused at the GUARD and never reaches the database, so it has no silent
  case to close. The defect lives exactly where there is no grant check because none is
  wanted: the self-service writes, and the ones with no check at all.
* **`.select()` reads the affected rows back THROUGH the SELECT policy**, so a caller who may
  write a row and not read it is told a landed write failed. That inverse is rare here — view
  falls back to `'everyone'`, writes to `'none'` — and where a surface genuinely needs it, the
  answer is a permission check in the action rather than a wider helper.
* **The probe assertion in `tests/rls` cannot see this.** A no-op leaves the row untouched, so
  the attack half goes green over an action that is lying to the caller. `expectRefusal` on a
  write case is a SECOND assertion on the same call for that reason, recorded under its own
  `told` phase so the summary does not report it as a family boundary being crossed.
  `photos.deletePhoto (a photo they did not upload)` is the worked example and was
  mutation-checked: reverting the action turns that one line red and nothing else moves.
  It was `(a member with no delete grant)` until `20260820000007` gave the General template
  `review/photos:delete` (now `community/gallery`) at scope `'own'` — so the refusal it asserts is now the
  OWN-EXPRESSION narrowing rather than a missing grant, which is a better test of the same
  mechanism and the first assertion in that suite that an `own_expr` narrows anything.

**A DEFAULT GRANT IS THE OTHER HALF, AND IT IS A PRODUCT DECISION.** Reporting the refusal
honestly does not answer whether the caller should have been refused. `20260820000007` answered
that for one resource: the General template already granted `review/photos` (now `community/gallery`) at `create: 'any'`
and `edit: 'own'` and simply had no `delete` row, so a member could upload a photograph and
retitle it and never remove it — and its own description says "manages only their own records".
One row fixed it, and it covers tags too, because `permission_table_map` points both `photos`
and `photo_tags` at that key with `uploader_id` and `tagged_by` as their own-expressions.

Two things about that migration are the pattern rather than the instance. It backfills
**`is_system` templates only** — a custom grid is one an administrator built and looked at, and
a migration must not overrule a cell somebody set in a UI that showed them the answer. And it
updates a row **only where it still reads `'none'`**, so a family that had already widened it to
`'any'` keeps what they chose; a backfill that overwrote `'any'` with `'own'` would be a silent
downgrade issued by a migration whose purpose is to widen.

**What is deliberately NOT converted:** `markNotificationRead` and
`markAllNotificationsRead` return `void`. Nothing is told anything, so there is no false
success to correct, and the bell re-reads its list on every navigation — the optimistic
marker is right there. Do not widen this rule into "every write returns a count".

**One instance of this class was a genuine bug rather than a report problem, and it is FIXED
as of 2026-08-21.** `saveChapterAndPropagate`'s child propagation updated other people's rows
on the USER client, and the `people` UPDATE policy admits only the caller's own row — so for
any member without `community/directory:edit` at `'any'` it matched nothing, every time. The
member's own chapter saved and their account-less children silently did not follow. The repair
is `lib/chapter-propagation.ts`: the admin client with §3 scoping by hand, the way
`editPersonRecord` does it. (**Who follows narrowed on 2026-08-22** — sons and daughters
UNDER EIGHTEEN with no account, not every account-less child. See §4b, "there is no household
either".)

Three things about how it was fixed are the reusable part:

* **`confirmWrite` was the wrong tool and that is why it sat open.** The caller's own save DID
  work, so reporting a failure would have been worse than the silence. What the repair adds
  instead is a PARTIAL-success message — the propagation reports `moved` and an optional
  `error`, and both callers say so rather than returning a bare `{ success: true }`.
* **It is a MODULE, not a second copy.** `setMemberChapter` (the administrator's version, new
  the same day) calls the same function. Writing the propagation into the new surface would
  have left a correct implementation beside a broken one, which is how two answers to one rule
  start. It lives in `lib/` rather than beside either caller because `npm run audit:people`
  decides the client by whether the FILE imports `createAdminClient` — putting it in
  `app/actions/personal-info.ts` would have put all six of that file's `people` writes on the
  review list.
* **THE FIXTURE WAS RESTING ON THE BUG, which is the part worth remembering.** `tests/rls`
  seeded `f.child` — the member's account-less son — as the sole occupant of
  `f.occupiedChapter`, and `admin/chapters.getScopeUsage (pending member)` asserted that
  chapter held exactly one member. The moment the propagation started working,
  `saveChapterAndPropagate`'s own control moved that child out and the later case went red;
  in isolation it passed. **A fix can break a test by making something happen that the test
  was built on not happening**, and the tell is a failure that only appears in sequence. The
  occupant is `f.ancestor` now — a FATHER, whom the Son/Daughter walk cannot reach.

## Running the database locally

`supabase/seed.sql` restores the table grants the hosted project has and a current
CLI does not create; without it every query fails `permission denied` and — the part
that matters — the RLS suite goes green while testing nothing. Read the file before
changing it.

Migrations must apply to an empty database. `20260618000002` is deliberately an empty
file: it is superseded by `20260618000003`, and running its `DROP COLUMN` at that point
in the chain fails against the ~64 policies still referencing `people.is_admin`. Verify
with `npx supabase db reset`, not by reading.

**A migration that applies is not a migration that works.** plpgsql does not resolve
names in a function body until the body runs, so a function with a bad reference is
created without complaint and throws for the first caller — in production, if the local
run never called it. Two things follow:

* **Schema-qualify extension functions with `extensions.`,** not `public.`. Supabase
  installs pgcrypto (and the rest) into `extensions`, and functions here set
  `search_path = ''`, so `public.gen_random_bytes(...)` resolves to nothing.
  `20260806000012` shipped that exact mistake and applied cleanly.

  **"Every function" was an overstatement, corrected 2026-08-12.** `db advisors` reports
  seven in `public` with a mutable `search_path`, and one of them —
  `auth_uid_is_room_participant` — is SECURITY DEFINER, which is the combination that
  matters. Set it on any function you add, and see TODO.md for the seven.
* **A verify block that can skip must not be the only check.** That same migration's
  assertion needed an `auth.users` row and returned early without one, so a fresh local
  database reported success over a function that could not run. Split it: assert what
  needs no fixture unconditionally, and `RAISE NOTICE` for the part that genuinely
  cannot run — a skip should be visible, never silent.

# How migrations reach the hosted project

**From CI on merge to `master`, and from nowhere else.** Not from a laptop, not with
`psql`, not with `db push` from a terminal. `.github/workflows/migrate.yml` is the whole
mechanism and nobody needs write credentials for production.

This is not tidiness. Applying migrations by hand has cost two production incidents, and
they are the two halves of the same missing mechanism:

* **Code ahead of schema.** Phase 3's app code shipped to hosted while its migrations were
  still pending. `getMyFamilies` selected `membership_status`, hosted did not have the
  column, and PostgREST answered **42703 and killed the whole query** rather than that one
  column. The resolver returned no memberships, `requireViewOrPending` called
  `notFound()`, and every page in the app answered 404 — the dashboard included.
* **A file replayed out of order.** `20260602000000_families.sql` was run against hosted
  after `20260618000001` had renamed its policy to `perm:…`. Its bare `CREATE POLICY` — no
  `DROP`, no `IF NOT EXISTS` — recreated the original *alongside* the secure one, and
  because permissive policies are OR-ed, the spoofable `user_metadata` policy decided
  every read until Supabase's advisor caught it.

Every migration up to `20260610000007` creates policies with a bare `CREATE POLICY`, and
three sweeps (`20260615000004`, `20260618000001`, `20260618000003`) renamed or rewrote most
of them — so the second incident is available from about thirty files, not one. Guarding
each of them individually was the alternative and was rejected: it is one edit per file
forever, and only ever as complete as the last person's diligence.

## What the mechanism actually is

**Ordering is structural, and `migrate.yml` deploys nothing.** Vercel builds every push to
`master` as usual, and a **Vercel Deployment Check** named `Database migrations` — the job
name in `migrate.yml` — holds that build *unaliased* until the job passes:

```
push to master ─┬─> Vercel builds a production deployment (NOT serving traffic)
                └─> migrate.yml: apply migrations, then audit
                         │
                    pass ├─> Vercel aliases the build to genorra.com, automatically
                    fail └─> never aliased; the current production keeps serving
```

So the old code serves while migrations are applied — the safe direction, because a
migration this repo ships is additive and the running code does not use it yet — and the
new code is released only once the schema it needs is there. A Next build merely being
slower than a `db push` is a race, not a guarantee, and Phase 3 is what losing it looks
like.

**Do not rebuild this as a deploy hook.** The first design fired a Vercel deploy hook from
the end of the job with git auto-deploy for `master` turned off, and it cannot work:
**deploy hooks are part of Vercel's git integration.** Turn git deployments off and the hook
stops firing too, so the arrangement has only two states — auto-deploy on and the hook
deploying a redundant second time, or auto-deploy off and nothing deploying at all. Vercel
support says so for the feature generally and the docs say so for `github.enabled`.
Deployment Checks are the supported way to gate a release, and they require automatic
aliasing to stay **ON** — the opposite of what a hook needs, which is the detail that makes
the two designs mutually exclusive rather than merely different.

**The check is bound by the job's name, not the file's.** Vercel identifies a Deployment
Check by the GitHub check-run name, so `name: Database migrations` in `migrate.yml` is
load-bearing: rename it and the gate silently detaches, leaving every production build
waiting on a check that no longer reports. `Force Promote` on the deployment is the
deliberate override.

**Replay is structural.** `supabase db push` records each version in
`supabase_migrations.schema_migrations` and refuses one already there. Hand-running
`psql -f` records nothing, which is why afterwards nothing can tell you what a database
has. That is the real damage: not the bad policy, the *not knowing*.

**Two flags on the push are load-bearing.** `supabase db push --linked` **does nothing
from a non-TTY** — exit 0, no output, no migrations applied — because it is sitting on a
confirmation prompt it cannot draw, and a CI runner is exactly that. Hence `--yes` and
`< /dev/null`. Without them the job goes green having applied nothing and then deploys the
code: Phase 3 reproduced by the automation built to prevent it. The `--expect-applied`
check after the push exists to catch that class of silent no-op, and is not a formality.

**`--include-all` is never passed.** `db push` refuses a pending migration that sorts
before the newest applied one (`LegacyDbPushMissingRemoteError`), and that refusal is the
guard: every file applied after it was written against a schema that did not include it.
When it fires, the repair is a new migration with a current timestamp — not the override
the CLI helpfully suggests.

## Asking whether it held

```bash
npm run db:check                      # repo only: no database, no credentials
npm run db:check -- --local           # ...and against the local stack
npm run db:check -- --linked          # ...and against hosted (needs SUPABASE_ACCESS_TOKEN)
npm run db:audit -- --linked          # no superseded policy left beside its replacement
```

`scripts/migrations.mjs` exits 1 on a finding, so it reads as a test — the same job
`npm run email:check` does for the auth templates. It reports a version hosted has and
this repo does not (a hand-applied file, or a `migration repair` stamp), a pending
migration that sorts before an applied one, an unversioned `.sql` sitting in
`supabase/migrations/`, and a migration that documents itself as a `psql` command.

`supabase/scripts/audit_policy_shadowing.sql` is the detector for the one case the ledger
cannot see: a bare `psql -f` changes no version, so only the policies themselves show it.
Run it against hosted after **any** hand intervention.

### And the thing that finds drift the ledger AND the shadowing audit both miss: DIFF THE TWO

Added 2026-08-22. A clean ledger means every version this repo has, hosted has. It says nothing
about what hosted has *in addition*, or about a policy hosted holds under a different name with
a different body. `audit_policy_shadowing.sql` finds a superseded policy sitting BESIDE its
replacement — which is the duplicated case — and is blind to the REPLACED case, where the
chain's policy is simply absent and something else stands in its place, leaving nothing to sit
beside.

Ask both databases the same question and diff the answers:

```bash
npx supabase db advisors --linked --type all --level info --fail-on none --output-format json
npx supabase db advisors --local  --type all --level info --fail-on none --output-format json
# then, for the detail the advisors only hint at:
npx supabase db query --linked -f q.sql --output-format json   # and --local
#   q.sql: SELECT tablename, policyname, cmd, roles::text,
#                 md5(coalesce(qual,'') || '~' || coalesce(with_check,'')) FROM pg_policies …
#   and the same for pg_indexes.
```

That is how `20260822000011` and `20260822000014` were found, and every one of the findings was
invisible to everything else in this section:

* **hosted carried 12 policies the chain does not write**, including a `chat_rooms` INSERT
  policy whose CHECK was `true AND <permission>` — the family conjunct gone, OR-ed alongside
  the correct policy. `chat_participants` INSERT the same, and `chat_messages` INSERT REPLACED
  by a version missing `auth_uid_is_room_participant`. Together: a cross-family write path into
  another family's conversation. The fingerprint is the NAME — `perm:chat_messages_insert` is a
  name `20260618000001`'s sweep generates, so the policy existed for it to rename, so something
  outside the chain created it. `chat_install.sql`, the unversioned file, is what did.
* **hosted's `person_relationships` SELECT had no `auth_membership_approved()`**, because
  `20260819000008` restores that policy only if it is MISSING and on hosted it was — so hosted
  took the restored form and never got the conjunct `20260806000011` §6 swept in. An applicant
  nobody had admitted could read the family's whole relationship graph, and `tests/rls` asserts
  they cannot, about the local database only.
* **hosted had eight duplicate indexes named `…_idx` and `…_idx1`**, which is Postgres
  disambiguating a name it has already used: the fingerprint of one file run twice by hand.

The advisor counts alone are enough to start: 34 security warnings hosted / 5 local, and
`multiple_permissive_policies` 11 hosted / 9 local, is the whole tell. **Two findings on hosted
that a fresh `db reset` does not reproduce are drift, and drift is where the holes are** — a
policy nobody wrote is a policy nobody reviewed.

## Three tables in `public` are product data, and emptying one is a one-way door

`relationship_types`, `permission_resources` and `permission_table_map`. They are seeded
**only** by migrations — and a migration a database has already recorded as applied never runs
again — so if one is emptied on hosted, nothing in the app, the chain or a `db reset` will ever
put it back.

That is not hypothetical; `truncate_entire_database.sql` emptied all of them, and a fourth
table besides. `relationship_types` stayed empty for weeks, during which `/family-tree`
answered "That relationship type is not set up" on every addition and drew a canvas of people
with no edges at all. `permission_resources` and `permission_table_map` survived on luck, their
seeding migrations happening to still be pending when the purge ran.

**THIS SAID "FOUR" UNTIL 2026-08-19, and the fourth was the `family_code IS NULL` rows of
`family_roles` — the 25 built-in board positions.** They stayed empty longest and nobody
noticed, because an empty `/admin/boardpositions` is not an error. `20260817000003` restored
them; `20260819000004` retired them. Board positions are per-family now — `family_code` NOT
NULL, `(family_code, name)` unique, `is_global` dropped, `family_role_exclusions` dropped — so
a family configures the offices it actually keeps, starting from none, and there is nothing
global left in that table for a purge to destroy.

**Its departure is kept in this section rather than deleted from it**, because that table is
the reason every paragraph below is worded the way it is: a hybrid — one table holding both
product rows and family rows — defeats every structural test for the difference, and the next
one will too.

Four things follow, and the third is the one that made this invisible for so long.

* **`db reset` re-seeds a laptop from the original migrations, so local is always right.**
  Only production can be wrong, which is why this has to be asked of a *database* rather than
  of the repo. `npm run db:check` compares versions, not rows, and is blind to it.
  `supabase/scripts/audit_global_lookups.sql` is the detector and is a step in `migrate.yml`,
  so hosted is asked on every deploy.
* **Every assertion about a purge has to run in BOTH directions.** `reset_families.sql` §11
  has always checked that no table which should be empty holds rows — the direction that
  catches a hand-written delete list going stale as the schema grows. *Nothing* checked that
  a table which should be full is not empty, which is the direction that catches this. A
  one-way assertion cannot see this class of damage at all.
* **No structural test finds this set, and `family_roles` is why.** `20260604000002` gave it a
  `family_code` so a family could define custom roles beside the 25 built-in board positions,
  so it had the very column every "is this family data?" test looks for, and its product rows
  were the ones where that column was NULL. A new lookup therefore has to be *named*, in three
  places in the same commit: the keep-list in `truncate_entire_database.sql` §1, the keep-list
  in `reset_families.sql` §11, and `audit_global_lookups.sql`. What catches a miss is that
  audit's second check, which derives its candidates instead — any `public` table that is empty
  and has no transitive foreign-key path to a `family_code`.

  **And a hybrid has to leave all three in the same commit too**, which is the half nobody had
  had to do until `20260819000004`: `audit_global_lookups.sql` RAISEs on an empty lookup and is
  a step in `migrate.yml`, so a table retired from that list in the migration and not in the
  script holds the Vercel alias on the next merge with the schema already applied.
  `truncate_entire_database.sql` was worse — its §6b hard-coded `WHERE family_code IS NULL` for
  that one table, so the whole purge, which is a single atomic `DO` block, would have rolled
  itself back forever.
* **`seed_global_lookups()` (`20260817000003`, redefined by `20260819000004`) is the ONE
  reseeder, and it covers one of the three.** It seeded `family_roles` too until board
  positions became per-family, and it must not seed that table again — the `family_code` is NOT
  NULL, so a reseeder could only put rows back by inventing a family, which is the one thing a
  restorer of product reference data may never do. The migration calls it, which is how the
  repair reaches hosted, and the purge script
  calls it, which is what makes a purge survivable — so a vocabulary change edits one function
  and both callers are correct with no further edit. It deliberately does **not** cover
  `permission_resources` or `permission_table_map`: their rows are assembled by about twenty
  migrations of inserts, label and `sort_order` edits, `actions` narrowings and seven deletes,
  and the map holds the `own_expr`/`self_expr` fragments `20260618000001` composed the policies
  from. A copy of either would be stale from the next migration and stale *invisibly* — a wrong
  `actions` array renders grid switches nothing reads. Those two are asserted rather than
  reseeded, so losing them is loud. An empty `permission_resources` fails **open**: every
  resource resolves to view `'any'`, admin pages included, while every write fails closed — and
  Members & Access cannot repair it, because it renders from that table.

## Two things about editing migrations that follow from this

**An unversioned `.sql` file in `supabase/migrations/` applies to nothing.** The CLI skips
anything not matching `<14-digit timestamp>_name.sql`, with one line of output that scrolls
past in a log. `chat_install.sql` and `chat_teardown.sql` sat there for months doing
exactly that, and the teardown dropped `get_my_family_code()` and
`auth_uid_is_room_participant()` — §2b's load-bearing pair. Hand-run SQL goes in
`supabase/scripts/`, which is what that directory is for. `db:check` now fails on it.

**Editing an applied migration changes fresh databases only.** `db push` keys off the
version, so hosted will never see the edit. This is deliberate and load-bearing rather than
a wart: `20260618000000_permissions_foundation.sql` carries the `permission_resources`
seed, §6 tells you to keep it current, and it has been edited in ten commits since it was
applied. That is why §6 says to add a row **in a new migration *and* in the seed** — the
new migration is what reaches hosted, the seed edit is what makes a `db reset` match it.
Never expect an edit to an applied file to deploy.

Comments are the exception that proves the rule: rewriting a comment in an applied
migration is safe precisely *because* the file is never re-read. That is what let the
`USAGE: psql "$DATABASE_URL" -f …` header be swept out of all 18 files that carried it
without touching a database — and it does not license sweeping migration comments
generally, which "What is deliberately *not* in here" still forbids.

# Switching family remounts the page

Family isolation has a client-side half, and §3 and §4 do not cover it. `FamilySwitcher`
lands its change with `router.refresh()`, and a refresh **deliberately merges the new
server payload without discarding client state** — that is the same behaviour
`lib/use-server-state.ts` exists to work around. So every `useState` seeded from a
family-scoped prop keeps rendering the family the user just *left*.

That is not a cosmetic staleness. Where the stale value is writable it is a
cross-family write with every server-side check satisfied, because by the time it is
submitted the caller genuinely *is* in the new family and the row genuinely *is* theirs
— the same shape as §4, arriving from the client's own memory rather than from a
parameter. **Family Settings is the worked example:** the name box kept the old family's
name while the server value beside it updated, so the form read as dirty, offered Save,
and taking it renamed the family you had switched *to* with the name of the one you left.

The fix is one key, in one place:

```tsx
<main key={familyCode} className="flex-1 min-w-0">{children}</main>
```

`app/(protected)/layout.tsx`. Four things about it are load-bearing:

* **It is keyed at the layout, not per page,** so a page cannot forget it and the rule
  holds for pages not yet written. Do not re-key a page underneath it; one mechanism.
* **`family_code` is the key** because it is immutable after insert
  (`families_guard_family_code`, `20260812000000`). It changes when the family changes
  and at no other time, so a rename — or any other `router.refresh()` — remounts
  nothing, and an optimistic row or a half-filled form survives its own revalidation.
* **Chrome rendered outside that `<main>` is not covered and keys itself.** Today that is
  `NotificationBell`, which the layout renders through `Navbar`; it keys on `personId`,
  already per-family and already what its realtime subscription filters on, so the list
  and the channel cannot disagree. Anything new added to the navbar or sidebar that holds
  family data in state owes the same.
* **A list keyed by row id is already safe.** `TemplateCard` and `StepRow` in
  `AdminGatheringTemplatesClient` both seed state from a row prop and are keyed by a
  per-family id — so a switch replaces the ids and React remounts them anyway. (The four named here
  until 2026-08-19 — `AssignmentRow`, `AcceptChildRow`, `BlueprintItemRow`, `EventTypeCard` —
  were all deleted with `/direct-lineage` and with Events; the property is what mattered, not
  the examples.)
  Pages on `[id]` routes are safe for a different reason: they `notFound()` when the
  entity is not in the caller's family, so the client unmounts.

Genuinely UI-local state is *not* what this is about and does not need keying — which
nav section is expanded (`Sidebar`), which dialog is open, a search string. The test is
whether the value came from, or will be written back to, one particular family.

# The shell is built once, and only a refresh rebuilds it

`app/(protected)/layout.tsx` resolves `viewableResources()` and hands it to the rail and
the top bar. **App Router does not re-render a shared layout on a client-side
navigation** — it refetches only the segments below the common layout — so whatever the
shell resolved to when the tab was opened is what it keeps saying, however many pages the
member visits.

That is almost always fine, because almost nothing about a member changes mid-session.
The exception is the one the product creates deliberately: somebody signs in while their
membership is pending, an administrator approves them, and their rail keeps showing the
single Dashboard link `PENDING_RESOURCES` gives them. `revalidatePath('/', 'layout')` in
`approveApplicant` cannot reach them — **it runs in the APPROVER's request and touches the
approver's caches.** Nor is it only approval: `applyTemplate`, `setTemplatePermission`,
`deleteTemplate` and `setFamilyTier` all change what the shell may show, and
`setMemberEnabled` takes it away entirely — a member switched off keeps a full rail of
destinations that now 404.

`components/layout/ShellWatcher.tsx` is what notices, mounted beside `IdleTimeout` and
outside `<main key={familyCode}>`. Four things about it are load-bearing:

* **It compares a FINGERPRINT, not a status.** `getMyShellState()` folds the caller's whole
  membership vector, the active family, its tier and the resolved permission grid into one
  string. Watching `membership_status` alone would miss every one of the four actions
  above, and watching only the ACTIVE membership would miss an applicant pending in two
  families who is approved by the second.
* **It polls on a timer only while the shell is showing a reduced answer,** and otherwise
  re-checks on `visibilitychange`/`focus`. Polling for everybody is one round trip per tab
  per interval — each a GoTrue `getUser()` plus a memberships read — to catch an event that
  happens about once per member per lifetime. Returning to a tab is when a stale shell is
  both most likely and most visible, and it costs nothing when nobody does.
* **It must never call `markIdleActivity()`.** A background poll is not somebody at the
  keyboard; marking it would keep every open tab alive forever and defeat the 60-minute
  sign-out entirely.
* **`router.refresh()` merges without discarding client state,** so a refresh fired from
  here re-syncs anything on `useServerState`. Checked when it was written: nothing a member
  can type into loses work. A page added later that seeds `useServerState` from something
  editable would turn this into a data-loss bug — that is the thing to re-check before
  widening when it fires.

## Telling somebody about something in ANOTHER family

Everything about the notification bell is scoped to the family the caller is currently
viewing, and each piece was right to be: notifications hang off a family-scoped `people`
row, so `getNotifications` filters on `getMyPersonId()` and the realtime channel filters on
the same id. **That is what a notification IS.**

The consequence nobody chose is that an administrator of two families, sitting in the
first, could not be told that somebody was waiting in the second. The row was in the queue,
the notification was in the table, and the only way to find either was to switch family and
look — which is exactly what you do not do when you have no reason to think anything has
happened.

`scopeInFamilies()` in `lib/auth/permissions.ts` is the resolver for that, and
`getPendingApprovalQueues()` is its one consumer. Both are narrow on purpose:

* **It is not a permission check and must never be used as one.** Every page still gates
  with `requireView`, in the family it is rendering. This answers "is there something for
  me somewhere", which is a different question.
* **It reproduces `resolveScope` exactly, per family** — explicit template grant, else the
  family's own `resource_visibility` default. Both conjuncts are kept: only approved
  memberships resolve, and a template only counts for the family it belongs to.
* **It publishes counts and family names, nothing else.** A cross-family read is precisely
  what RLS exists to prevent, so §3's obligation is discharged by hand — the codes come
  from the caller's own memberships and the one query is `.in()`-scoped to them.
* **A family only appears when the caller genuinely holds the grant THERE**, so the count
  for a family they cannot work is never computed rather than computed and hidden (§5).

If a second surface ever needs to speak across families, it uses this resolver. Do not add
a second one.

## Five doors lead into the approvals queue

Every one of these creates the same pending `people` row, and until 2026-08-14 only the
third told anybody:

| Door | Where |
|---|---|
| `/register` with a family code | `registerUser`, mode `'join'` |
| `/register` from an invitation that does not pre-approve | `registerUser` → `redeem_family_invitation` |
| `/my-families` with a family code | `joinFamilyByCode` |
| an invitation accepted while already signed in | `redeemInvitation` |
| an appeal of a decline | `appealMembershipDecision` |

So whether a family heard about an applicant depended on which page the applicant happened
to start from. The message lives in `lib/notifications.ts`
(`notifyMembershipRequest` / `notifyMembershipAppeal`) rather than at five call sites, for
the reason the rest of that module is there: five copies of one sentence are five answers,
and the two that existed had already drifted. **A sixth door owes a call**, and the
registration one is worth reading first — it is reachable without a session, which is why
nothing about the message is chosen at the call site.

`membership_status` is read BACK from the insert rather than inferred from `mode`: the
stamp trigger decides founder versus applicant, and a family whose first member arrives
through `?mode=join` comes out approved.

**And supabase-js RETURNS errors rather than throwing them**, so the `try/catch` every one
of these call sites wraps the notification in — correctly, because a bell entry must never
undo the decision it announces — catches nothing PostgREST produces. The writers in
`lib/notifications.ts` therefore read `error` and log it. Discarding it made a refused
insert indistinguishable from a delivered one at every layer.

# A family can be REMOVED, which destroys nothing

`families.status` is `'active'` or `'removed'` (`20260817000006`), with `removed_at` and
`removed_by` for the record. Removal is a soft disable: **no row anywhere is deleted**, and a
restore brings the family back with every dues payment, photograph and chat message where it was.
`/admin/family` offers it behind its own grant, `admin/family/remove` at `delete`, and behind a
six-digit code emailed to the acting administrator.

Six things about it are load-bearing, and the first two are the ones a future change will get
wrong.

* **THE TEST IS NOT IN `auth_family_code()`, deliberately.** That resolver is a `LIMIT 1` over an
  `ORDER BY`, so a `status = 'active'` conjunct there would not HIDE a removed family — it would
  SKIP to the caller's next one, silently moving which family a request is acting in. And
  `lib/auth/family.ts` promises the TypeScript resolver mirrors that function exactly, while
  `resolveActiveCode` has no skip, so the app and the policies would then disagree. **Enforcement
  is app-layer by design.** No RLS policy consults `families.status` and none may start to.
* **It withholds SCREENS, never rows** — the same boundary the tier gate keeps, and the server
  ACTIONS behind those screens are deliberately not removal-checked, because a restored family
  must find its records untouched. `requireFamilyActive` is folded into `requireView` and
  `requireViewOrPending` for `requireTier`'s reason: a second line every page must also remember
  is a line three pages will not have. It REDIRECTS to `/dashboard` rather than 404ing, because a
  family's own members are entitled to know, and `FamilyRemoved` is where they are told.
  `REMOVED_FAMILY_RESOURCES` in `lib/auth/family.ts` is the exemption list — it lives there rather
  than beside `PENDING_RESOURCES` because `permissions.ts` imports that module and the reverse
  would be a cycle.
* **`families_guard_removal` refuses the `authenticated` role outright**, so removal and restore
  go through the SERVICE ROLE. `families` has an UPDATE policy admitting `admin/family:edit`, and
  a policy has no opinion about which column changed — without the guard,
  `PATCH /families {"status":"removed"}` from devtools would remove a family past the emailed
  code entirely. Same shape as `families_guard_family_code` and `people_guard_permission_template`.
* **A stranger is told nothing.** Six doors refuse a removed family — `validate_family_code`,
  `join_family_by_code`, `peek_family_invitation` (granted to `anon`), `redeem_family_invitation`,
  `set_active_family`'s callers, and `registerUser` — and each answers the message it already gave
  for a code that never existed, character for character. Telling a guesser "that family was
  removed" is an enumeration signal; the family's own members learn the truth from their
  membership instead.
* **`set_active_family` still ALLOWS switching into a removed family**, and that is a decision.
  Refusing would report "not a member", which is false, and would leave somebody with no route to
  find out what happened to a family they belong to. The switcher and `/my-families` therefore
  list a removed family **as removed** rather than hiding it — hiding it loses a family with no
  explanation.
* **Restore is not in the member-facing product.** It lives in the GENORRA staff console, through
  `staff_set_family_status`, which refuses anyone `is_genorra_staff()` does not recognise. The
  copy on the removal panel says so, because a reversible action whose reversal is invisible reads
  as an irreversible one.

The emailed code is a `family_action_challenges` row holding a SHA-256, never the code; 15
minutes, five attempts, single use. It is minted in TypeScript and verified in SQL, and the split
is deliberate: the plaintext has to exist in the Node process because that process composes the
email, whereas verifying is a five-branch read-modify-write that races itself from the app — so
`consume_family_action_challenge` does it in one statement under `FOR UPDATE`. The challenge is
resolved from `(family_code, requested_by, purpose)` and the hash is only ever COMPARED, never used
to find the row.

**IT IS ONE MECHANISM FOR MORE THAN ONE ACT SINCE 2026-08-25**, which is why the table is
`family_action_challenges` rather than `family_removal_challenges` and why `purpose` is part of
that key. **Disconnecting a family's Stripe account** is the second thing behind it, and it
earned the gate for this section's own reason: the act LOOKS reversible and half of it is not.
Reconnecting returns the same `acct_…` — `ensureConnectedAccount` finds the existing row and
returns early — but `disconnectProcessor` cancels every member's recurring dues subscription AT
STRIPE on the way out, and a cancelled subscription cannot be un-cancelled. So the connection
comes back and the enrolments never do.

Four things follow for anything that becomes the third:

* **`purpose` has NO DEFAULT**, deliberately. A caller that forgets it fails loudly rather than
  minting a removal code by accident — and `tests/rls`' own fixture was the first thing that
  forgot, which is the constraint working.
* **The conjunct is on the SUPERSEDE as well as the lookup.** Without it, asking for one kind of
  code silently spends a live code of the other kind that the same person is midway through
  using.
* **Mint through `lib/action-challenge.ts`**, never by hand. The digits, the hash, the lifetime
  and the supersede-then-insert live there for `lib/chapter-propagation.ts`'s reason: a second
  copy is a second place for one of those decisions to drift.
* **A password is not the second factor and must not be described as one.** It is checked in the
  BROWSER against a throwaway client, so it stops an accident and somebody at an unlocked screen,
  and nothing else. The CODE is the factor. Both `PlanPanel` and `ProcessingPanel` say exactly
  that much and no more; `components/ui/challenge-fields.tsx` holds both fields so the wording
  cannot drift into a promise.

# Gatherings replaced Events, and Events is gone entirely

Added 2026-08-19, `20260819000000`. **Gatherings answers *who is doing what, and has it been done
and accepted*.** An administrator authors a TEMPLATE (a named, ordered list of steps of mixed
kinds), a GATHERING is scheduled from one or more templates, every step becomes a TASK held by a
named relative, and each answer an organizer approves or sends back with notes. A gathering carries
a budget drawn on a fund, each task carries a line against it, and one gathering may be **premier**,
which puts it across the top of the Dashboard.

**THIS SECTION SAID "A SECOND PRODUCT BESIDE EVENTS, AND EVENTS IS NOT GOING ANYWHERE" FOR ONE
DAY.** Events is retired (`20260819000006`): `/events`, `/event-planning`, `/admin/events` and
`/admin/event-types` are deleted, along with six action modules, every component, the four
`permission_resources` rows and the twelve `permission_table_map` rows. Do not re-add any of it, and
in particular do not park it behind `status: 'future'` — that gate withholds a ROUTE and does
nothing whatever to the server actions underneath (see "COMING SOON WITHHOLDS A PAGE"), so it would
leave six action modules published as HTTP endpoints with nobody exercising them.

**WHAT IS NOT REPLACED**, and is worth naming so nobody assumes otherwise: RSVPs, hotel room blocks
and day-of check-in. A step of a gathering template can ASK a relative for any of it, but there is
no attendee count, no room block and no check-in list in this product - and **the marketing copy
that sold all three went in the same commit**, on `/pricing`, `/features`, `/how-it-works`,
`/why-us`, `lib/plans.ts` and `components/marketing/pillars.ts`. A retired feature whose sales copy
survives is the drift FutureFeature.md is largely a record of.

**THE STALE ASSET IS GONE, AND IT WAS WORSE THAN STALE** (2026-08-22). This said
`components/marketing/screenshots/events.png` was "a capture of the deleted `/events`" whose alt had
to stay generic until it was re-captured. It was not a capture of anything. All THREE files in that
folder were placeholder cards - a title, the lockup, a line of stock prose and the words **COMING
SOON** in gold - so Home and `/features` were each announcing Gatherings, the treasury and the family
tree as unbuilt, in the largest artwork on the page, a few inches above copy saying every screen
ships today. The `alt` was the sharper failure: it told a screen reader that `finances.png` showed
"fund balances, dues collected against outstanding, and the routing waterfall", none of which was in
the image.

All three are deleted. `components/marketing/PillarVignette.tsx` draws each pillar instead - a
gathering spanning three days of a month strip, the routing waterfall filling one fund before the
next, three generations with a marriage across the middle - in tokens, theme-aware, and honestly a
DRAWING rather than a photograph. `Pillar.image`/`imageAlt` are replaced by `vignette`, and the whole
panel is `aria-hidden` because every fact it draws is written out in the bullets beside it.

**THE ONE RULE FOR EDITING A VIGNETTE**: it may only draw what its pillar's `bullets` already claim.
The copy is reviewed and `npm run marketing:check` walks it against the registry, so a drawing inside
the copy inherits both guards. An RSVP count in one would be exactly how the last set died. **A real
capture is still owed** - it needs a browser pointed at a seeded family; TODO.md carries it, and the
swap back is one field.

**ALL THIRTEEN `event_*` TABLES ARE DROPPED**, along with `funds.event_id`,
`photo_collections.event_id`, `cancel_overdue_event_assignments()` and the `event_expenses` term
in `fund_balance_cents()`. `20260819000006` is the migration and it argues the decision at length.

**THE FIRST DRAFT OF THAT MIGRATION FROZE THE TABLES INSTEAD — dropped every policy, kept every
row — and that was wrong here.** The argument for freezing is that retiring a FEATURE is not
authority to empty a family's records, and it turns entirely on there being a family whose records
they are. There is not: **no family is using this product yet.** So the caution protected nothing
and cost something real: thirteen tables nothing reads, a money term in `fund_balance_cents()`
that could never change again, and two surviving tables pointing into all of it.

**A HALF-RETIREMENT IS THE EXPENSIVE STATE.** Frozen tables are what "Three tables in `public` are
product data" is really about: rows no code reads and no test covers, still holding grants, still
in every `\d` listing, and answering nobody's question. Hence the general rule — **when there is
nothing to lose, drop it; when there is, say whose records they are and why they survive.** Never
freeze by default.

**A FUND'S BALANCE IS NOW contributions - disbursements + transfers in - transfers out.** Four
terms, and three places have to agree about them: `fund_balance_cents()` in SQL, `getFunds` in
`app/actions/funds.ts`, and `getActiveFundsForRouting` in `app/actions/dues.ts`. The P&L's
"Total Spent" is DISBURSEMENTS now - it counted event spend and nothing else, so a family that had
paid a disbursement and never run an event read `$0.00` over money that had demonstrably gone.

**`fund_balance_cents()` STILL HAS NO `authenticated` EXECUTE GRANT AND MUST NOT GAIN ONE.** That
migration's first draft added one on §2b's "adding a function means adding its grant" reflex, which
is right for a function the browser calls and wrong for this one. A balance recomputed on the USER
client silently omits the transfer term for anyone without `accounting/transactions/fund-transfers:view`,
which is why `getGatheringFundOptions` calls it through the admin client - granting it to
`authenticated` would put the per-viewer version back within reach. The migration asserts the grant
is ABSENT.

**THE `event-photos` STORAGE BUCKET IS GONE, as of 2026-08-20** — `20260820000008` deletes the
bucket, its object rows and its read policy, after `scripts/drop-retired-bucket.mjs` removed the
bytes through the Storage API. What follows is kept because it is the argument for why a dropped
TABLE does not drop a BUCKET, and the next retirement will need it. `20260819000006` drops tables;
`storage.*` is out of its scope exactly as it is out of `truncate_entire_database.sql`'s. So the
bucket, its three policies and every object already in it are still there, still `public: true`,
still with no family predicate - nothing writes to it or reads it, and anything uploaded is still
world-readable by URL. Dropping it is a storage operation rather than a migration and is owed;
FutureFeature.md's storage warning carries it.

# REALTIME NEEDS THE TABLE IN A PUBLICATION, AND NOTHING IN THIS REPO COULD SEE IT

A `postgres_changes` subscription reads the WAL through the **`supabase_realtime` PUBLICATION**.
A table that is not a member produces no events — and the subscription still connects, still
reports `SUBSCRIBED`, and still returns a channel. There is no error anywhere, on either side.

**That publication held ZERO tables until 2026-08-21**, measured rather than inferred:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';   -- (0 rows)
```

So all three subscriptions in the product had been fed nothing since the day each shipped —
`NotificationBell`, `MessageThread` and `ChatShell`. `20260821000002` publishes `notifications`
and `chat_messages`; **anything new that subscribes owes its own line in a migration.**

Four things follow, and the first two are why this went unnoticed for months.

* **Publication membership is DATABASE STATE, and the dashboard is how it is normally set.** It
  is therefore invisible to `npm run db:check` (which compares migration versions) and to
  `db:audit` (which reads policies), and a fresh `supabase db reset` publishes nothing at all.
  Before this it was mentioned in the repo exactly once, as a COMMENTED-OUT line in
  `20260603000000_chat.sql` telling a reader to run it in the SQL editor — the same shape as the
  `USAGE: psql "$DATABASE_URL" -f …` headers that caused a production incident. **An
  instruction in a migration, addressed to a person, is not a step; it is a defect with a note
  attached.**
* **A fallback hides it.** The bell survived because `getNotifications` is server-rendered by
  `TopBar` on every page load, so it refreshed on navigation — the feature degraded to something
  that looks *slow* rather than to something visibly broken. Chat had no fallback and simply did
  not deliver until the reader navigated, and that was read as chat being quiet.
* **RLS IS the boundary, and Realtime evaluates it as the SUBSCRIBING ROLE.** This is what makes
  publishing a table a security decision rather than plumbing. Two consequences: every function
  a published table's SELECT policy calls needs `EXECUTE` for `authenticated` (§2b rule 2), and
  the realtime path is where a missing grant is INVISIBLE — a policy that *errors* is
  indistinguishable from one that refuses, because either way no event arrives and there is no
  HTTP response for anybody to see a failure on. A client-side `filter` is a bandwidth decision,
  never the boundary; `ChatShell` subscribes unfiltered and relies entirely on
  `auth_uid_is_room_participant()`.
* **`REPLICA IDENTITY FULL` is the trap on the way out.** Realtime authorizes INSERT and UPDATE
  against the SELECT policy, and **does not authorize DELETE** — a delete is broadcast to every
  subscriber of that event, carrying whatever the replica identity says. `DEFAULT` means the
  primary key alone; `FULL` means the whole deleted row, unauthorized. `20260821000002` asserts
  neither published table carries `FULL`, so a future feature wanting `old_record` has to decide
  what a delete may tell a stranger first.

**`npm run realtime:check` is the only thing that can prove any of this works**
(`scripts/realtime-check.mjs`). A migration can assert membership, the replica identity and the
grants; it cannot open a websocket. That script signs in as a real member, writes as the service
role, and asserts BOTH halves of each pair — the row that must arrive and the row that must be
withheld, the second with an UNFILTERED subscription so the client filter cannot be what
refused it. It reseeds `tests/rls`' fixture and needs the local stack, which is why it is
hand-run like `email:check` and `art:check` rather than a step in `verify.yml`.

**One harness fact worth carrying anywhere else this is tested:** `SUBSCRIBED` is the CLIENT's
acknowledgement, not walrus's. Realtime registers a subscription as a row in
`realtime.subscription` and the replication side picks it up from there, so a row written in
that gap reaches nobody — which reads exactly like a policy refusing it. It produced that
script's first false finding, and **a fixed settle delay is not the fix**: one second passed
twice and failed on the third run, because the first channel on a fresh socket is the slow one.
Wait for a throwaway row to come back instead, and report "never became live" as its own
finding — a publication problem must never present as a withheld row.

# A STORAGE BUCKET IS NOT COVERED BY ANY OF THE ABOVE, AND ONE WAS WIDE OPEN

`storage.objects` has its own policies and none of the machinery in §2c, §3 or
`audit:family-scope` looks at them: those are about `public` tables and the service role.
`20260609000000` created three buckets with write policies of one shape —

    bucket_id = '<name>' AND auth.uid() IS NOT NULL

— which is **any signed-in user, any path**. `avatars` is laid out per user
(`{auth.uid()}/avatar.ext`) and nothing enforced it, so until 2026-08-20 one member could
overwrite another's profile photo. The bucket is `public`, so that is not "replace a file": it
is choose the picture the whole family sees under somebody else's name, in the Directory, on
the tree and in the top bar. DELETE was equally open.

`20260820000002` fixes `avatars` with the pattern the `photos` bucket has had since
`20260610000001` — `(auth.uid())::text = (storage.foldername(name))[1]` — on INSERT, UPDATE
**and** UPDATE's `WITH CHECK`, that last one because without it an owner could RENAME their
object into somebody else's folder, which is the same hole by another route.

## THE OTHER THREE BUCKETS WERE CLOSED THE NEXT DAY, BY A TEST RATHER THAN BY READING

`20260820000006`, and how it was found is the point. `tests/rls` grew a Storage harness
(`tests/rls/raw/storage.mjs`), which is the gap `cases.mjs`'s `UNCOVERED` list had recorded
since Phase 3 — and its **first run** found three holes that had been open for months:

| Bucket | What was measured |
|---|---|
| `photos` INSERT | `bucket_id = 'photos'` and nothing else. BRAVO's administrator wrote an object into `ALPHATEST/<alpha collection>/` and got a 200, in a bucket that is `public: true`. |
| `photos` DELETE | The right pattern aimed at the WRONG LAYOUT — `auth.uid()` against paths that begin with a family code. It matched nothing **for anybody**. |
| `documents` | `auth.uid() IS NOT NULL` on all four commands, on a PRIVATE bucket. BRAVO downloaded ALPHA's document, listed ALPHA's filenames, and DELETED an ALPHA document. |

**The `photos` DELETE one is the one to learn from, and it is not a leak.** Nobody could ever
delete a photograph's FILE, so every image a family had "deleted" was still in a public
bucket, still fetchable at its URL, indefinitely — and `deletePhoto` could not tell, because
**Storage reports a refused `remove()` as 200 with an empty array.** No cross-family
assertion could ever have found that; it was the POSITIVE CONTROL that did, which is
§7's argument for the control half made twice in one day (the other was `getPhotoCollections`
in 2026-08-19's dropped-table embed).

Four things follow, and the first two are the ones a future bucket gets wrong:

* **THE PREDICATE MUST MATCH THE LAYOUT.** `avatars` is per-USER, so
  `(auth.uid())::text = (storage.foldername(name))[1]` is right there. `photos` and
  `documents` are per-FAMILY, and a family code is not a uuid — so the same expression can
  only ever match nothing, which is exactly how a policy comes to be *silently* wrong rather
  than loudly wrong. The family form is
  `(storage.foldername(name))[1] = public.auth_family_code()`, ANDed with
  `public.auth_membership_approved()` so an applicant cannot file objects into a family that
  has not admitted them (measured before the fix: they could).
* **A HELPER IN A STORAGE POLICY NEEDS ITS EXECUTE GRANT, exactly as in `public`.** A policy
  expression is evaluated as the QUERYING role (§2b, rule 2), so a missing grant makes every
  query *error* rather than be refused — a broken feature, not a closed hole. That migration
  asserts both grants before it writes a policy.
* **A public bucket's READ is a separate question and is still deliberately unanswered.**
  Narrowing it is a product decision (every avatar would need a signed URL per render); the
  hole was WRITE. `documents` is the exception and was narrowed, because it is `public: false`
  and its read policy IS the boundary rather than a formality.
* **Probing storage from a migration cannot clean up after itself.** A trigger refuses direct
  `DELETE FROM storage.objects` ("Use the Storage API instead", 42501), so the verify block
  inserts inside a plpgsql `BEGIN … EXCEPTION` — an implicit subtransaction — and raises a
  sentinel to unwind it. Compare the sentinel by MESSAGE, or a policy that wrongly refused the
  OWNER would be swallowed by the same handler and reported as a pass.

**`event-photos` IS DROPPED, and it took a script AND a migration — which is the part worth
carrying forward.** It was frozen first (`20260820000006` dropped its three write policies and
put nothing back, so §2c denied every write) and removed on 2026-08-20. Two removals, because
each tool can only do one of them:

| | |
|---|---|
| `scripts/drop-retired-bucket.mjs` | the BYTES, through the Storage API — the only thing that reaches the storage backend. Refuses any bucket not on its own short retired-list, so it cannot be pointed at `photos`. |
| `20260820000008` | the SCHEMA — the bucket row, the object rows and the read policy. |

**The migration is not optional and the reason is `20260609000000`**: that applied file creates
the bucket on every fresh database, so without a migration deleting it, `db reset` resurrects
it on every laptop forever while hosted no longer has it. That is the local/hosted divergence
"How migrations reach the hosted project" exists to prevent, arriving through storage instead
of through a policy.

**Two mechanics to reuse.** `storage.protect_delete()` refuses a direct
`DELETE FROM storage.objects` (42501, "Use the Storage API instead") and reads its own escape
hatch — `SET LOCAL storage.allow_delete_query = 'true'` — so a migration goes through the
front door rather than disabling a trigger it does not own. And **order matters on hosted**:
run the script BEFORE the merge, because once the rows are gone nothing can enumerate which
bytes to delete, and they become orphans only a manual sweep of the backend would find.

**The test moved with it.** `STORAGE_CASES` asserted an RLS refusal while the bucket existed;
it now asserts the bucket's ABSENCE, which is strictly stronger — the old assertion would have
gone green again the moment somebody re-created the bucket without policies.

**And a test probing Storage cannot use PostgREST.** `db.schema('storage').from('objects')`
answers nothing at all: PostgREST exposes `public` and `graphql_public`, not `storage`. The
first draft of those cases did exactly that, and every probe returned `[]` — so four attack
halves reported perfect isolation over a probe that could not see a single object, and it was
the four positive controls, failing together, that said so. Probe through the service-role
client's own **Storage API** (`db.storage.from(bucket).list(dir)`), and point it at the
object's IMMEDIATE parent, because `list()` is one level deep and reports a folder rather
than the file inside it.

Six tables — `gathering_templates`, `gathering_template_steps`, `gatherings`,
`gathering_template_uses`, `gathering_tasks`, `gathering_task_submissions` — and six resource keys:
`gatherings`, `gatherings/my-tasks`, `gatherings/budget`, `calendar`, `admin/gatherings`,
`admin/gathering-templates`.

**THE SIX KEYS ARE SPLIT ACROSS TWO PLANS SINCE 2026-08-19**, and this said "everything is
`tier: 'free'`, and that is forced rather than generous" — forced because a gathering could only be
created FROM a template, so selling the authoring screen would have made `/pricing`'s Free bullet
false. Standard was inserted between Free and Plus and the boundary now runs THROUGH the feature,
between the DATE and the PLANNING:

| Free | Standard |
|---|---|
| `calendar`, `gatherings`, `admin/gatherings` | `admin/gathering-templates`, `gatherings/my-tasks`, `gatherings/budget` |

What made the split possible is the one behaviour change that went with it: **`scheduleGathering`
and `createGathering` accept an EMPTY template list now**, so a Free family's gathering is a date,
a place and a description on the calendar. Without that the split would have left Free selling a
calendar nothing could be put on, which is the argument the old paragraph was making and it was
right — it was an argument about the ACTION, not about the tier.

Three consequences a change here will get wrong:

* **`/admin/gatherings` is FREE and its Templates pane is not.** That page decomposes
  `requireView` over two keys, so it ands `tierAllows()` into the library pane by hand and
  redirects a templates-only caller to `/upgrade`. Same for `/gatherings` and its My Tasks pane.
  `requireTier` at the top of either page resolves the page's OWN key and cannot see a pane.
* **`gatherings/budget` and `admin/users/templates` have `FEATURES` rows that are not routes**,
  carrying nothing but the tier — the `/accounting/transactions/fund-transfers` device. Both are named in
  `help-check.mjs`'s `UNDOCUMENTED_OK` for that reason.
* **The template READS are tier-gated, the WRITES are not.** `getSchedulableTemplates` and
  `getGatheringTemplates` are skipped for a Free family so the picker offers nothing; the actions
  keep taking `templateIds`, because the actions behind a paid page are deliberately not
  tier-checked (see the tier section below). The tier withholds the screen; the permission model
  is what stops the wrong person.

## FIVE ROUTES ARE REDIRECTS, AND THEIR KEYS ARE WHY THEY EXIST

`/gatherings/my-tasks`, `/admin/gathering-templates`, `/updates`, `/admin/chapters` and — since
2026-08-20 — `/admin/boardpositions` render nothing and `redirect()` to a pane of another
screen. Each is a `FEATURES` entry still, and each
must stay one: `viewableResources()` builds the rail by walking that registry, so a key is only ever
in a caller's answer because there is an entry for its href — and a resource key IS the route
without its leading slash (§1), so keeping the route is what keeps the key honest. Renaming one into
a sub-key is a migration that copies every family's grant across, which is what `20260815000000`
cost when My Summary's panes became screens.

None of the four carries a guard, deliberately. They read nothing and render nothing; the page they
land on resolves `requireFamilyActive`, `requireTier` and every pane grant itself. A `requireView`
on a redirect would be a second, weaker copy of that check whose only effect is to answer 404 where
the real page answers `/upgrade` or the removed-family notice.

## A PAGE THAT MERGED TWO SCREENS RESOLVES ITS PANES BY HAND, AND OWES THREE CHECKS

`/gatherings` (Gatherings · My Tasks), `/admin/gatherings` (Gatherings · Review queue · Templates)
and `/announcements` (General · Updates · Birthdays) all decompose `requireView` into a union of
`can()` calls, because any one of their keys is a sufficient reason to be on the screen. Every one of
them therefore owes `requireFamilyActive` and `requireTier` BY HAND, above the grants, in that
order — see "A PAGE THAT RESOLVES PANES BY HAND OWES THE TIER AND REMOVED-FAMILY CHECKS BY HAND
TOO". All three do, and so does `/admin/users` — it was the exception until the
`requireFamilyActive` line was added to it; the note where that gap was recorded now records the
repair instead.

The pane ids and their ledes live in PURE modules — `lib/gathering-panes.ts`,
`lib/announcement-panes.ts`, `components/admin/account-sections.ts` — and never in the `'use
client'` shell. **A Server Component that imports a runtime VALUE from a client module gets a client
REFERENCE, not the value.** `/announcements` shipped with `ANNOUNCEMENT_PANES` exported from its
shell and threw `.includes is not a function` on every load, rendering the error boundary over the
whole page. Type-only imports across that boundary are erased and are fine; a value never is.

## A TASK IS A COPY OF ITS STEP, NOT A REFERENCE

The single most important decision in the schema. `gathering_tasks` carries its own `label`,
`help_text`, `kind` and `required`, copied from `gathering_template_steps` at instantiation;
`step_id` and `template_id` are kept for PROVENANCE only and go NULL if their parent is deleted.

A task is a thing a named relative was asked to do. Editing the template afterwards must not rewrite
what they were asked, or what their approved answer was an answer *to* — and `answer` is JSONB whose
shape is decided by `kind`, so reading `kind` through `step_id` at render time would let a template
edit make every stored answer unreadable. **Do not "normalise" these four columns away.**

## THE WRITE BOUNDARY IS THE ACTIONS AND FIVE TRIGGERS. THERE IS NO WRITE POLICY

Each of the six tables has exactly ONE policy — `perm:<table>:select` — and no INSERT, UPDATE or
DELETE policy at all, which per §2c denies those to the browser outright. Every write goes through
`createAdminClient()` in a server action that re-applies family scoping by hand (§3), and five
`BEFORE INSERT OR UPDATE` guard triggers refuse a cross-family id underneath it, because the service
role ignores RLS and does not ignore triggers (§4). `gathering_template_steps` needed the fifth and
was missing it for a day: it is the one child table whose parent FK can point into another family.

Two things about the SELECT policies:

* **`gathering_tasks` and `gathering_task_submissions` carry a real `self_expr`** so an assignee can
  always reach their own task and their own denial notes, whatever the family has done to
  `gatherings:view`. `gatherings` deliberately does NOT: a gathering is family-wide configuration,
  like a dues schedule, and the member's own thing is the TASK. The consequence is that
  `getMyGatheringTasks` reads the gathering TITLE on the admin client, the same way it already reads
  template names and assignee names. A `SECURITY DEFINER` helper granted to `authenticated` was
  written for this and backed out: it is a new publicly-reachable function (§2b) bought to save one
  admin-client read the module was already making.
* **Both template tables key on `admin/gathering-templates`**, so an ordinary member cannot read the
  template library at all. `getSchedulableTemplates` and the detail screen's template names
  therefore go through the admin client — and must. Loosening that policy to `gatherings:view` would
  publish every archived draft and suggested budget to every member, and could not express the
  `who_may_schedule = 'family'` subset that action exists to return.

## `gatherings/budget` WITHHOLDS A SCREEN BAND, NOT THE FIGURES

Read §2c. The money lives in columns on `gatherings` and `gathering_tasks`, whose SELECT policy is
keyed on `gatherings:view`, and no grant can narrow a column — so a member holding the default view
grant can read `budget_cents` and `fund_id` through PostgREST whatever this key says. The key gates
whether the app FETCHES them (§5), which is real and is what the screens honour; it is not
confidentiality. The migration says so at length and so does the grid's own entry. **If that ever
needs to become confidentiality, the money has to move to its own table with its own map row** —
that is the only mechanism that works, and it is a migration, not a comment.

## THE RED LINE IS THE FEATURE, SO NOTHING REFUSES AN OVER-FUND BUDGET

A family plans a $12,000 reunion in January and raises the money by June, and the months in between
are exactly when the screen has to say so. There is no over-fund trigger and no CHECK on size — only
`budget_cents >= 0` and `budget_cents IS NULL OR fund_id IS NOT NULL`. `lib/gathering-budget.ts`
computes it, and three rules there are load-bearing: an over-FUND figure is `--destructive` (an error
the family must act on) while an over-ALLOCATED one — task lines claiming more than the gathering
budgeted — is the quieter `--brand-withheld`; a `null` fund balance draws NO marker at all, because
"you may not see it" is not "overspent"; and a failed money READ is distinguishable from a withheld
one, or one transient PostgREST error silently erases every figure on the screen.

Two figures that are NOT the same and both render: this gathering's budget against the fund, and
that budget plus what other live gatherings already claim on the same fund. There is no encumbrance
concept in the schema — a fund balance counts money that has MOVED — so "already committed" is
arithmetic this feature invented, and it is computed on the ADMIN client through
`fund_balance_cents()`, for the same reason `getActiveFundsForRouting` is: a balance read on the
user client silently omits the transfer term for anyone without `accounting/transactions/fund-transfers:view`,
and two members must not disagree about whether a gathering is over its fund.

## `is_premier` HAS NO UNIQUENESS, AND THE SOONEST UPCOMING ONE WINS

Several gatherings may be flagged. The Dashboard renders the soonest whose span has not finished,
and the admin screen and `/help` both say so. A partial unique index was the obvious alternative and
is wrong: it would make last year's premier reunion block this year's, and toggling it would depend
on the order two administrators happened to click in.

## A TASK IS KEYED ON `people.id`, NEVER `auth.users.id`

`event_assignments` keys its assignee on an auth id and has no `family_code`. The retired
the deleted `app/actions/event-planning.ts` documented what that costs, and it is the reason this design was
chosen rather than copied: one auth id is identical across every
family the user belongs to, so every query needs an `!inner` join, and an account-less relative — a
recorded grandmother, §4b — can never hold a task. A `people.id` key makes family scoping structural
and is what `own_expr`/`self_expr` are written in terms of.

## APPROVED IS FINAL FROM THE MEMBER'S SIDE, AND AN ORGANIZER CAN STILL CORRECT THEMSELVES

`submitGatheringTask` refuses an approved task; `reopenGatheringTask` (gated `admin/gatherings:edit`,
so `canAny` — the task an organizer would "own" is the abuse case) sets it back to `'open'`, clears
`decided_at`/`decided_by`, and **leaves the answer and every submission row standing**. A denial is
never an edit of the refused submission: resubmitting writes a NEW row, so the notes and the answer
they were about both survive. That is what makes the loop auditable.

A reopen and a send-back are DIFFERENT bell entries (`task_reopened`, `task_denied`) and the reason
is what the member last heard: a send-back follows a submission they are waiting on, a reopen follows
an approval, and "was sent back with notes" would send them looking for a submission they never made.
So "show me what came back to me" has to name both types — which is the correct direction, because no
surface can un-conflate two events stored as one.

## `who_may_schedule` DECIDES WHO MAY SCHEDULE, AND NEVER WHO MAY EDIT

`'admin'` or `'family'`, on the template. It says nothing about authoring — that is always
`admin/gathering-templates`. `scheduleGathering` resolves BOTH grants before reading a template: a
member with `gatherings:create` may schedule from a `'family'` template, and only somebody who also
holds `admin/gatherings:create` may schedule from an `'admin'` one.

## DATES ARE `DATE`. THERE IS NO TIME OF DAY AND NO TIMEZONE

`starts_on`, `ends_on`, `due_on`. The retired `events.event_date` was a bare DATE too, nothing in this schema records
a family timezone, and a `TIME` here would be a time in no particular zone — the same two-facts-that-
disagree trap as `is_minor` (§4b). `lib/calendar.ts` therefore does its arithmetic on `YYYY-MM-DD`
strings with `Date.UTC` and reads back through `getUTC*`, and its `Intl` formatter pins
`timeZone: 'UTC'`: `new Date('2026-08-01')` is UTC midnight and renders as 31 July in any negative
offset, which is how a calendar comes to put a reunion on the wrong day for half the country.
`shiftMonth` works on (year, month) integers and never carries a day-of-month, because `setUTCMonth`
overflows 31 January into 3 March.

# THE LIBRARY IS FOUR SCREENS, AND ONLY ONE OF THEM BELONGS TO AN OFFICE

The section holds **Officer Notes**, **Meeting Minutes**, **Documents** and **Bylaws**, and what
they have in common is the reader rather than the access model: somebody looking for what the
family wrote down and kept. Their rules are deliberately different and a change that assumes one
applies to all four will be wrong three times.

| Screen | Who reads it | Who writes it |
|---|---|---|
| `library/officer-notes` | whoever holds THAT OFFICE, and nobody else | any holder of the office |
| `library/meeting-minutes` | every approved member | the SECRETARY of that session |
| `library/documents` | every approved member | anybody with the create grant |
| `library/bylaws` | every approved member | anybody with the create grant |

**THE FIRST ROW IS THE ODD ONE AND IT MUST STAY ODD.** A journal is working notes; the other
three are the family's record. A family that could read every officer's notebook would get
officers who keep their notebook somewhere else, which is the whole argument `20260821000005`
makes at length.

**Documents ARRIVED FROM THE RETIRED REVIEW SECTION** (`20260822000018`) rather than going back
to Resources: a family's filings sit beside the notebooks its officers keep. **Meeting Minutes**
and **Bylaws** are new the same day.

**THE SECTION WAS CALLED "Journals" UNTIL 2026-08-22** (`20260822000021`), which was right while
it held one thing and wrong the moment it held four: three of them are not journals, so the
heading named one of its children and told a reader the other three were somewhere else. The
item was renamed with it, from **Officer** to **Officer Notes** — that caption leaned entirely on
the word above it, and under any other section it reads as a list of officers, which is what
`/admin/members/board-positions` is.

**THE CATEGORY VALUE IS STILL `journal` AND MUST STAY.** Its LABEL is "Library" in
`components/admin/resource-groups.ts`, which is the `events`-prints-"Gatherings" precedent
applied again: `auth_permission()` reads that column to decide whether an
unregistered-visibility key fails closed, so renaming the value would change how four keys fail
in order to retitle a heading. The migration asserts it did not move.

**ONE OF THE FOUR KEYS GATES A TABLE AND THREE DO NOT**, and that asymmetry is asserted in both
directions. `library/documents` has a `permission_table_map` row with an `own_expr` of
`uploaded_by = auth_person_id()`, which is what lets an uploader delete their own filing and
nobody else's. The other three have none and must not gain one: their row rules are the office,
the session's secretary and the attendee list, none of which a key can express, and a map row
appearing later would compose an `auth_permission` factor onto those tables with `view`
defaulting to `'everyone'`. The first draft of `20260822000021` claimed all four gated nothing
and was refused by its own verify block.

## Officer Notes: the office's own notebook

`/library/officer-notes`, three tables, and one sentence the schema is built on: **the notes follow
the position, not the member.** A treasurer writes down how the bank reconciliation actually
works; three years later a different treasurer opens it and it is there. `20260821000005` built
it and `20260822000001` turned an entry into a rolling topic; both headers argue every decision
at length and this is the short list of what a change here will get wrong.

**THE ROUTE MOVED THREE TIMES IN THREE DAYS** — `/journal`, `/journals`,
`/journals/officer`, `/library/officer-notes` (`20260822000000`, `20260822000017`,
`20260822000021`) — and each move is one rule being obeyed rather than four opinions: the caption is the route and the route is the key ("The route tree IS the nav rail").
What did NOT move any of the four times: the tables (`position_journal_*`), the
`permission_resources.category` value `journal` — the `events` precedent, "a caption is one line
here; a category is a column three resolvers agree about" — and the help chapter's slug, which
is not a route.

**NO POLICY ON ANY OF THE THREE TABLES EVALUATES `auth_permission`, and that is asserted in
both directions.** `library/officer-notes:view` gates the SCREEN so a family can switch it off; it
decides nothing about who reads what. What the eleven policies test is the OFFICE, through
`auth_holds_family_role(role_id)` on an entry and `auth_holds_journal_entry_office(entry_id)` on
the two child tables. So `library/officer-notes:view` at scope `'any'` buys an administrator their own
offices and no others — deliberately, because these are working notes and a family that could
read every officer's notebook would get officers who keep their notebook somewhere else. There
is **no `permission_table_map` row** for this key and there must not be: a future policy sweep
composing an `auth_permission('library/officer-notes', …)` factor onto these tables would open
every notebook to everybody, `view` defaulting to `'everyone'`. The same is asserted for
`library/meeting-minutes` and `library/bylaws` (`20260822000018` §9f), whose row rules are the
secretary and the attendee list.

**THREE WRITE RULES, AND THEY ARE THREE ON PURPOSE.** They look like one rule and are enforced
by two different expressions:

| What | Who | What enforces it |
|---|---|---|
| add a note to any topic | any holder of the office | the office conjunct alone |
| edit or delete one note | its own author, any position in the thread | `author_id = auth_person_id()` on the NOTE |
| the topic — its title | whoever started it | `author_id = auth_person_id()` on the ENTRY |

The first is the feature: a successor answers a predecessor *underneath* what they wrote instead
of beside it. The rest are the same argument `reopenGatheringTask` makes — the office owns the
record, and a record a successor can quietly rewrite is not one.

**THERE WERE FOUR RULES UNTIL 2026-08-22**, and the fourth was who attended a meeting. That went
with the meeting half (below).

**`body` WAS DROPPED FROM `position_journal_entries`, WHICH IS NOT AN ADDITIVE MIGRATION.** The
existing bodies became the first note of their own thread. Two columns describing one fact is
the `is_minor` trap (§4b), so keeping it was not an option — but a DROP COLUMN inverts the
deployment argument in "How migrations reach the hosted project": the old code runs against the
new schema for one alias window, asks for a column that is gone, and PostgREST answers 42703 by
killing the whole query. It cost an empty screen for one deploy and is admissible **because no
family is using this product yet**. If that stops being true, the shape is two deploys.

**THE MEETING HALF LEFT ON 2026-08-22, AND VOTING WENT WITH IT AND BECAME REAL.** An entry
carried a `kind` of 'note' or 'meeting', with `met_on` and `position_journal_attendees` beside
it, and a sentence on the screen saying voting was not built. `20260822000019` dropped all three
columns and the table. A meeting is not a topic in one office's notebook: it belongs to the
FAMILY, it has a SECRETARY (one named person, which "any holder of the office" cannot express),
and it has VOTES, which a journal has nowhere to put. See Meeting Minutes below.

**THE JUNCTION TABLE THAT MADE AN OLD PAIR AMBIGUOUS IS GONE, AND THE QUALIFIERS STAY.**
`position_journal_attendees` joined entries to people, so PostgREST reported a many-to-many path
between that pair on top of `author_id` — §8's `announcement_unpins` incident, arriving on
schedule. Every `people` embed from a journal table still names its constraint, deliberately:
the hazard was never that table, it was that ANY two-column join table added later reintroduces
it. Removing the qualifiers now would be removing the guard because the last thing to trip it
happened to be deleted.

**AND THE TESTS OWE A `raw/` PROBE, which is where the read-narrowing lesson in §7 came from.**
`getJournalEntries` reads the notes by the entry ids it already holds, so the notes policy is
never consulted for a caller with no office: its office conjunct came out and 43 assertions
stayed green. `tests/rls/raw/journals.mjs` is what catches it. One stated gap lives in
`cases.mjs`: no actor in the fixture holds ZERO offices — `alphaAdmin` holds the President —
so `/library/officer-notes`'s own §5 guard (skip both reads for a member with no office) is asserted
by nothing, and adding an office-less approved member is the fix, not a `setup` that wipes an
assignment.

## Meeting Minutes: the room decides, and a vote is final

`/library/meeting-minutes`, five tables, and `20260822000019` argues every decision at length.
The short list of what a change here will get wrong:

**THE ACCESS MODEL IS THE SESSION, NOT THE KEY.** `library/meeting-minutes:view` gates the
SCREEN; it has no `permission_table_map` row and must not gain one. What decides the writes is
the ROW: the session names one `secretary_id` and carries an attendee list, and those two
columns are the whole of who may write minutes and who may vote. A key cannot express "the
person this session named", which is the same argument the officer's journal makes about the
office.

**EVERY APPROVED MEMBER READS IT.** Five SELECT policies testing family and approval and nothing
else — the opposite of the journal's rule, deliberately: minutes are the family's record of its
own decisions, so somebody who was not in the room still learns what was decided.

**THERE IS NO WRITE POLICY ON ANY OF THE FIVE.** Per §2c that denies the browser those commands
outright, so every write goes through `app/actions/meetings.ts` on the admin client with
`.eq('family_code', …)` by hand (§3), and five guard triggers refuse a cross-family id
underneath (§4). Same arrangement as the six Gatherings tables and for the same reason.

**A VOTE CANNOT BE CHANGED BY ANYBODY, AND THAT IS A TRIGGER RATHER THAN A RULE IN AN ACTION.**
`meeting_votes_are_final` refuses UPDATE for every role including `service_role`, and refuses
DELETE unless `pg_trigger_depth() > 1` — which is true only inside the `ON DELETE CASCADE` from
`meeting_topics`, MEASURED rather than assumed (a direct delete reports depth 1, a cascade
reports 2). So the only way a vote goes is with the QUESTION it answered.

The first draft of that migration refused every DELETE and thereby made a topic undeletable the
moment anybody had voted on it; both directions are asserted in its verify block for that reason.
An escape hatch in the `storage.protect_delete()` style was rejected here: a hatch is a thing any
future action can set, where a depth test can only be satisfied by an actual cascade.

**WHO IS COMING IS A BODY, NOT A LIST OF NAMES — 2026-08-22.** `scheduleMeeting` takes
`boardIds`, `positionIds`, `chapterIds`, `wholeFamily` and `additionalIds`, and everything but
the last is resolved SERVER-SIDE against `getMeetingAttendeeOptions()`. A family meeting is
almost always a body meeting — the whole family, one chapter, the national board, every chapter
president — and ticking eleven names to describe one is both tedious and wrong next month, when
somebody has been replaced.

**THIS SAID "THREE INPUTS" FOR A DAY.** The scheduling form became a three-step wizard the same
week (below), and its second step asks what KIND of meeting this is before showing anything to
pick — which needed two bodies the office vocabulary cannot express: a whole chapter's
membership, and the family's. Five things about the arrangement are load-bearing:

* **There is no `boards` table and this must not grow one.** A board is the set of people
  holding an office at one SCOPE in one AREA, which is what `user_roles` already records
  through `scope` plus `region_id` or `chapter_id`. That is the same three-word vocabulary an
  election scopes itself with and a board position is created with. `lib/meeting-boards.ts` is
  the pure shaping and `boardKey` is the composite id — `national`, `regional:<id>`,
  `chapter:<id>`, PREFIXED because a region id and a chapter id are both uuids from different
  tables and would otherwise collide.
* **A CHAPTER IS NOT ITS BOARD, AND BOTH ARE OFFERED.** `chapter:<id>` in `boards` is whoever
  holds an office there; `<id>` in `chapters` is every adult recorded in the place. The second
  is the room a chapter actually meets in most often, and it is derived from `people.chapter_id`
  rather than from `user_roles` — neither can be expressed as the other. The prefix on the
  board key is what keeps the two ids from colliding.
* **A BODY IS LISTED ONLY WHERE SOMEBODY IS IN IT.** Nine chapters with two filled means two
  boards, not nine — seven empty boards is seven controls that select nobody. The same test
  applies to `chapters`, and the count on each option is what keeps it honest in the other
  direction.
* **THE CLIENT NAMES BODIES AND NEVER SENDS PEOPLE.** `scheduleMeeting` re-resolves the ids
  itself, so `boardIds: ['national']` asks for whoever holds a national office at that moment.
  Accepting a resolved list would let a caller send any names at all — a server action is a
  public HTTP endpoint. It also means a board or chapter id from another family resolves to
  nobody rather than to that family's body. **`wholeFamily` IS A BOOLEAN FOR EXACTLY THAT
  REASON**: there is no id for "everybody", so a client can only ask, and what everybody turns
  out to be comes from the roster the action reads. An `everyoneIds: string[]` parameter would
  be the same endpoint with the rule removed.
* **THE "KIND" NEVER CROSSES THE WIRE.** The form's audience question is a UI narrowing over
  one union: the action takes the four body fields and unions whatever is present. There is
  deliberately no `audience` parameter to validate the selection against — it would be a
  second, weaker copy of what the fields already say, and it is the kind of field that comes
  to disagree with them.

**ADULTS ONLY EVERYWHERE EXCEPT AN OFFICE.** The SECRETARY must be an adult, and so must
anybody added BY NAME — both are the free choices somebody makes in the dialog, both pickers
are filtered server-side (§5), and `scheduleMeeting` refuses one anyway because the dialog in
front of it is a convenience (§2). **A CHAPTER AND THE WHOLE FAMILY ARE ADULT-FILTERED TOO**,
and not by a check in the action: both bodies are BUILT from the adult rows inside
`getMeetingAttendeeOptions`, so a minor is never in them and there is nothing to refuse. That
is the right place for it — one filter, three consumers, and the action's two error messages
stay about the two things a person named themselves.

**BOARD AND POSITION MEMBERS ARE NOT AGE-CHECKED**, and that asymmetry is the decision rather
than an oversight. Somebody on a board is somebody the family put in an office; silently
dropping them from the room over a recorded birthday would be the product overruling that
appointment, invisibly, in a list nobody reads back. If a family should not be able to appoint
a minor, that belongs on `assignBoardPosition` where it can be said out loud. **A chapter's
membership is not an appointment**, which is why it takes the picker's reading rather than the
board's — the two rules are not in tension, they are about two different kinds of fact.

`isMinorOn` in `lib/age-utils.ts` is the ONE definition and **a member with no recorded
birthday is an adult** — its own answer for a null, and the same reading the chapter
propagation takes (§4b). "Under eighteen" is something a family has recorded, not something to
assume about a blank field; assuming it would refuse to let a grandmother whose birthday
nobody entered take the minutes, with nothing on the screen to explain why.

**`setMeetingAttendees` does NOT apply the adult rule**, and its header says so. It takes a
flat list with no idea which ids came from a board, so applying the rule there would refuse to
re-save a room legitimately containing an officer under eighteen. The rule belongs where the
distinction between "you chose this person" and "this person holds an office" still exists.

## SCHEDULING A MEETING IS A THREE-STEP WIZARD, AND THE STEPS ARE THE MEETING'S OWN QUESTIONS

Added 2026-08-22, because the one-screen form asked for six things at once — a title, a date, a
secretary, two checkbox lists over the family's boards and offices, and a searchable
multi-select over a hundred and forty adults, with a room summary under the lot. On a phone that
is a form you scroll four times before you know what it wants.

The split is not cosmetic and it is not "three because three fits": step 1 is WHAT and WHEN
(and who writes it down), step 2 is WHO IS COMING, step 3 is ANYBODY ELSE. Four things about it
are load-bearing, and the third is the one a later edit will get wrong:

* **THE SECRETARY DEFAULTS TO THE CALLER.** `MeetingAttendeeOptions.myPersonId`, resolved from
  the guard. Whoever schedules a meeting is usually the one who writes it up, and making them
  find their own name in a picker of a hundred and forty is the friction that gets a required
  field stared at. It is a DEFAULT and decides nothing on the server — `scheduleMeeting` takes
  whatever secretary it is sent and checks it the same way either way.
* **AN AUDIENCE WITH NOTHING TO PICK IS DISABLED AND SAYS WHY**, never hidden. A family that
  has not set its offices up has no boards to invite, and dropping the choice off the list
  leaves them wondering whether the product can do it at all. Same judgement `CheckGroup`'s
  empty state used to make one level down, moved up to where the choice is.
* **THE SELECTION IS READ THROUGH THE AUDIENCE, NOT CLEARED WHEN IT CHANGES.** `selection` in
  `ScheduleDialog` derives each field from the chosen kind, so a member who ticks two boards,
  presses Back, and switches to a general family meeting does not carry those boards into the
  room. Clearing the tick lists on change would also work and is worse — pressing Back to
  check a date and returning would throw the ticks away.
* **THERE IS A FIFTH CHOICE, "Just the people I name", AND IT IS WHAT LETS STEP 2 BE
  REQUIRED.** Before the wizard a meeting could be three people named by hand; making an
  audience mandatory without an escape hatch would have deleted that. An ad-hoc committee is a
  real meeting and there is no body to point at.

**`submit` RE-CHECKS EVERY EARLIER STEP**, not just the last one. Nothing stops somebody
clearing the title after passing step 1, and the action would then refuse it with a message
they would read three steps away from the field — so a failure sends them back to the step that
owns it.
**A MEETING IS ON ITS ATTENDEES' CALENDARS AND NOBODY ELSE'S**, which is a per-VIEWER narrowing
rather than a permission one and is unlike anything else on that grid. It is filtered in
TypeScript in `app/actions/calendar.ts`, deliberately: the rows it drops are rows the caller may
read anyway, so writing it as a policy-shaped query would tell the next reader it was §5.

## The calendar has three sources, and adding a fourth is a known shape

`/gatherings/calendar` draws gatherings, the meetings you are down for, and — since
2026-08-22 — every published election's nomination and voting windows. `CalendarSources` is a
RECORD rather than a boolean precisely so a fourth plugs in with no re-plumbing, which is what
that field's own header predicted and what elections then did.

Five things a fourth source has to get right, all of them learned from the three:

* **RESOLVE THE GRANT, THEN SKIP THE QUERY (§5).** Each source is gated on the key that owns
  the SCREEN A CELL WOULD LINK TO, not on `calendar:view` — a cell linking to a page the
  member cannot open is the worst thing a calendar can do — and `isFeatureLive` is asked as
  well, so a source whose route serves Coming Soon is not linked from here.
* **A REFUSED QUERY MUST MARK ITS SOURCE WITHHELD (§8).** A source that produced nothing
  because PostgREST refused it must never report itself as shown, or an empty August renders
  as a fact about the family. And the PAGE has to name every withheld source: it listed one of
  three until 2026-08-22, so a member who could read neither meetings nor elections was shown
  an empty month and a page that said nothing was missing.
* **`sources` ANSWERS "IS THIS ON THE GRID", NEVER "WHY NOT".** A refusal and an outage are
  deliberately indistinguishable, so the page must not grow a sentence claiming a reason —
  half the time it would be a guess about somebody's permissions.
* **A MULTI-DAY SPAN FILLS EVERY DAY, and that is free.** `buildCalendarMonth` puts an entry
  on every cell between its start and its end inclusively, so a three-day reunion appears
  three times and a fortnight of voting fourteen. Nothing has to be done to opt in; what has
  to be got right is that the window is the GRID's, six days either side of the month.
* **AND ON THE GRID IT IS ONE BAR, NOT ONE CHIP PER DAY — 2026-08-22.** `day.entries` is the
  per-day list and `day.bars` is the same spans packed into LANES per week: a bar lives in the
  cell its run starts in, is given a width that reaches the end of the run, and overflows the
  cells it crosses. Three things follow, and the first two have already bitten:

  * **A LANE IS A PROPERTY OF THE WEEK, and `packWeek` decides it after every day of that week
    exists.** Sorting entries per day cannot do this: a two-day bar sat in row 0 on Monday and
    row 1 on Tuesday as soon as anything else started on Tuesday, and the "bar" was two chips
    at different heights. Lanes are packed greedily by start day, longer run first, with every
    tie broken down to the id — a greedy assignment is only stable if its input order is total,
    and two renders of one month must not swap two bars between rows.
  * **THE BAR'S WIDTH IS DERIVED FROM THE CELL'S PADDING AND BORDER** (`CELL_GUTTER_PX` in
    `MonthCalendar.tsx`), so changing `p-1` or `border-r` on the cell moves every multi-day
    bar's right edge and reads as a rendering bug. CSS cannot tell us this — `table-fixed`
    column widths are resolved by the layout engine. For the same reason the day-number row
    carries a fixed `h-5`: today's date is a 20px circle and every other date is 16px of text,
    so without it one cell of the week starts its lanes 4px lower and a bar crossing today has
    a step in it.
  * **THE DAY LIST BELOW `sm` STAYS ONE ROW PER DAY**, reading `entries`. It is an agenda and
    has no horizontal axis for a bar to stretch along, so this is not the two renderings
    drifting — it is each asking the question its axis can answer.
* **ONE ROW MAY BE MORE THAN ONE ENTRY, and then the ids must differ.** An election
  contributes TWO — the nomination window and, after a gap, the voting window — because they
  are two different things a member has to do and the days between them are deliberately
  empty. `buildCalendarMonth` keys a chip on `${day}:${entry.id}`, so the two carry
  `:nominations` and `:voting` suffixes. They cannot overlap today (`voting_open_on >
  nominations_close_on` is a CHECK), which is exactly the kind of invariant that would make a
  duplicate-key bug wait years for the schema change that breaks it.

**AND THE LEGEND IS DERIVED FROM WHAT IS ON THE GRID**, not hand-written. It was a list of two
while meetings had been rendering for a day — in the gathering colour, announcing themselves to
a screen reader as "Gathering:" — because `toneOf` looked only at `isPremier`. Deriving it also
fixes the §5-shaped half: a legend row for Voting, shown to a member whose family has
restricted Elections, advertises a kind of thing they will never see a chip for.

## Bylaws is scaffolding, and the screen says which half

`/library/bylaws`, one table, `20260822000020`. The table, the GIN index and the search are
real; **text extraction from PDF and Word is not built**. Plain-text uploads are read on upload
and are searchable word by word; a PDF is searchable by title, article and summary only.

**EVERY ROW CARRIES A BADGE SAYING WHICH IT IS, and the empty-result state says it too.** That is
the one thing this scaffolding must not drop: "no result" and "not indexed" are different facts,
and a reader who cannot tell them apart concludes the bylaws do not say a thing they do say.

`bylaws.content_text` is inside the generated `search_vector`, so turning extraction on is a job
that writes one column — no migration, no reindex.

# The signed-in app signs itself out when left idle

`components/layout/IdleTimeout.tsx`, mounted once by `app/(protected)/layout.tsx`. 60
minutes with no keyboard or pointer activity and the member is signed out — a real
`signOut({ scope: 'local' })`, which revokes the session server-side — and sent to `/login`
with a notice and a `?next=` back. The last minute is a warning dialog.

Four things about it are load-bearing, and the first is the one that gets undone:

* **The number is `IDLE_LIMIT_MINUTES` in `lib/idle-timeout.ts`,** with the phase boundary
  and the storage keys. Nothing else may hold a copy — the notice shown on `/login`
  interpolates it, so the sentence a member reads cannot disagree with the timer. That file
  is plain TypeScript with no JSX precisely so the boundary can be checked without a
  browser. **It is 60 to match `jwt_expiry` (3600s), deliberately** — an idle stretch and
  the life of an access token are one number rather than two that nearly agree. That is an
  alignment, not a dependency: auth-js renews at about t+58.5m, so the tab is still alive
  at t+60m and the sign-out has a valid token to revoke with. The reasoning, and the floor
  to know about if the number moves again, are in the comment above the constant.
* **`[auth.sessions] inactivity_timeout` is NOT this feature** and cannot replace it.
  Measured: GoTrue's window is time since the last token *refresh*, and `autoRefreshToken`
  renews on a timer with nobody at the keyboard — so an open tab never trips it however long
  the person has been gone. It is also a renewal cutoff rather than a kill switch, since the
  token already issued keeps working at GoTrue *and* PostgREST until `jwt_expiry`. The two
  are complements: the timer covers a person who walked away from an open tab, the setting
  covers a browser that is not running. Full results are in `config.toml` beside the block;
  read them before "moving this into config where it belongs".
* **It is mounted AFTER the shell in the layout, deliberately.** Every dialog in the app is
  `fixed z-50`, so among equal z-indexes the later DOM node wins — mounted above
  `{children}` the warning renders *behind* a form dialog the member already had open,
  which is the moment they most need to see it. It is also not keyed on `familyCode` like
  `<main>` is: switching family must not restart the clock.
* **Activity is pointer and keyboard only.** Not `mousemove`, not `scroll` — those fire
  from momentum scrolling, a nudged desk and animated content, so including them makes the
  timeout fail in the only direction that matters, which is never firing. A chat message
  arriving is not activity either; the point is somebody at the keyboard.

## ON A PHONE THERE IS NO LOADED PAGE TO TIME, AND THAT DEFEATED IT ENTIRELY

Added 2026-08-22. Everything above describes a timer running inside a loaded page, and this
section used to treat "the browser was not running" as the half `inactivity_timeout` covers.
**On a phone it is not a corner case, it is the ordinary session:** mobile browsers evict
background tabs as a matter of routine, so a member uses the app, backgrounds it, and hours
later reopens a page that LOADS AGAIN from scratch. No timer ran, because no page existed to
run one. Reported as: mobile doesn't automatically log you out.

The only thing that can notice is the MOUNT of that next page load, reading the marker the
member's last activity left in `localStorage` — and the marker rule as written refused exactly
that, on the argument that "a live tab signs ITSELF out on reaching the limit, so an expired
marker can never describe one". True of a desktop tab, false of an evicted one.

So `inheritedActivity` answers THREE ways now — adopt, expire, or start fresh — and three
things hold it together:

* **THE DISCRIMINATOR IS `user.last_sign_in_at`, RESOLVED ON THE SERVER** and passed to
  `IdleTimeout` as a prop. A marker written after the session began and now past the limit is
  this session's own idleness (sign out); one written before it is residue from an earlier
  session (ignore). Both present identically as "an expired marker on a fresh mount", and
  getting it backwards is not symmetrical — expiring wrongly locks somebody out of a session
  they have just created, which is the unrecoverable-bounce bug this rule already carries a
  paragraph about. **It must not be read from the client:** auth-js keeps the whole session in
  `localStorage`, so a browser that could choose the sign-in time could choose the answer.
* **NO SIGN-IN TIME KEEPS THE OLD, CONSERVATIVE ANSWER.** `last_sign_in_at` is optional on the
  GoTrue user, and `null` falls through to `fresh` — never to `expired`. A gap in the data must
  not sign anybody out.
* **THE MARKER IS WRITTEN AT MOUNT when this tab starts its own clock.** Without it a member
  who loads a page and reads it without touching anything leaves no trace, and the next load
  after an eviction has nothing to measure against. Only in that branch: writing after
  ADOPTING one would overwrite the older marker this tab was supposed to inherit.

`visibilitychange`, `focus` and `pageshow` re-check immediately on return — iOS suspends
JavaScript in a background tab outright, and a back-forward-cache restore resumes a page whose
timers may not be re-armed, so on a phone that handler is frequently the only thing that runs.
It is NOT activity and must never mark any: coming back to a tab is not having been at the
keyboard for the last two hours.

`lib/idle-timeout.test.ts` is the mutation-checked version of all of this, and both directions
are in it — the pre-2026-08-22 code turns three cases red, and dropping the session guard turns
three different ones red.

## The shared marker belongs to one session, and outlives it

`genorra:last-activity` in `localStorage` is how activity in one tab keeps the others
alive, and a tab adopts it at mount so opening a second tab mid-stretch inherits the clock
instead of resetting it. It is also the one piece of this feature that **survives the thing
it is timing** — the sign-out, the redirect, and the browser being closed altogether.

Adopted unconditionally it made the sign-out unrecoverable, which is the bug that shipped:
the timer fired, left a marker as old as the limit behind, and the first signed-in page after
signing back in mounted already expired and bounced to `/login` on its first tick — forever.
The same bounce met anyone returning the next morning, because `localStorage` does not care
that the tab is gone.

Three rules hold it now, and they are three because no one of them is sufficient:

* **`inheritedActivity()` refuses an expired marker** (`lib/idle-timeout.ts`). A live tab
  signs *itself* out on reaching the limit, so a marker past it can never describe one —
  it is residue, and residue is not evidence of somebody sitting idle in a loaded page,
  which is the only thing this component measures. This is the rule that covers the closed
  browser, where no code of ours runs to clean up.
* **Every sign-out that ends *this* browser's session calls `clearIdleActivity()`** — the
  timeout, `SignOutButton`, `InviteMismatchActions`. Needed on top of the above because a
  marker a minute short of the limit is *inside* the window and still residue. The one `signOut` that
  must **not** call it is `SignInSecurity`'s `scope: 'others'`: that leaves this browser
  signed in, with somebody demonstrably at the keyboard.
* **Every sign-in calls `markIdleActivity()`** — `LoginForm`, `RegisterForm`. Signing in is
  activity, and the timer has to hear about it *before* the page it guards mounts, since
  the marker is read once. It is also what stops one person on a shared browser inheriting
  the last person's clock.

Both writes live in `lib/idle-timeout.ts` rather than at the call sites, for the reason the
file exists at all: a `localStorage.removeItem('genorra:last-activity')` typed into a
sign-out handler is a copy of the key that no rename will find.

`genorra:idle-signed-out` is deliberately *not* cleared. It is a broadcast, not state — its
only reader is the `storage` event, which fires on the write — so a stale value confuses
nobody and clearing it would only announce a second, meaningless change.

**Session scope is a decision every `signOut` call owes.** The default is `'global'`, which
revokes every session the *account* has, and that is almost never what a button means:
`SignOutButton` shipped with it and was signing members out of their phone when they signed
out on a laptop. Use `'local'` for "this device" (sign out, idle timeout,
`InviteMismatchActions`) and `'others'` only where evicting the rest is the point, which
today is the password change in `SignInSecurity`.

## A fresh session can change the password without the emailed code

`secure_password_change = true` in `config.toml`, and GoTrue reads its own setting as
"reauthenticate **or have logged in recently**". Recently is `session.created_at + 24h`, a
constant inside GoTrue rather than a setting — nothing in `config.toml` exposes it. **So for
the first day of any session the reauthentication code is sent, typed in, and not checked; a
deliberately wrong one still changes the password.** Measured 2026-08-12, 8/8 as expected.

Three things follow, and the first is the one that gets misread:

* **The current-password field on the Password panel does not close that window, and is not
  there to.** `PUT /auth/v1/user` is a public GoTrue endpoint that accepts the browser's
  session token, so anyone who can open devtools changes the password without loading our
  form. A check on the attacker's side of the wire is not a gate, and moving it into a server
  action would not help — GoTrue's endpoint stays reachable either way. What it buys is real
  but smaller: it stops somebody who sits at an unlocked screen and uses the product. Do not
  let the copy promise more; it did once, and the panel now says what the proof supports.

* **Verify the current password on a THROWAWAY client** (`createPasswordCheckClient` in
  `lib/supabase/client.ts`), never the app's own. Signing in on the app's client replaces the
  session, and a new session's `created_at` resets the 24-hour clock — so checking the
  password on the wrong client would switch the emailed code off permanently, disabling the
  other half of the gate on the way past.

* **GoTrue already revokes other sessions on a password change, unprompted.** Our
  `signOut({ scope: 'others' })` is kept anyway, so the guarantee the copy states belongs to a
  line in our code rather than to an undocumented internal — but it means a failure of that
  call does *not* mean the other devices are still signed in.

`timebox` would cap `created_at` and so remove the window — and must not be set at or under
24h for that reason: no session could then reach the age at which GoTrue demands the code, and
the flag becomes decoration. The note is in `config.toml` beside the block.

# MONEY HAS TWO DIRECTIONS, AND THE TWO LEDGERS MUST NEVER MEET

Stripe arrived on 2026-08-23 and it brought two entirely separate flows. Nearly every mistake
available in this feature is a mistake about WHICH of them you are in.

| | Who pays whom | Whose Stripe account | Recorded in |
|---|---|---|---|
| **Platform** | a family pays GENORRA for its plan | **ours** | `platform_payments` |
| **Connect** | a relative pays THEIR FAMILY its dues | the **family's own**, via `Stripe-Account` | `dues_payments` |

One API key serves both — a direct charge is our platform key plus an account header — which is
exactly why they are easy to cross by accident. `onAccount()` in `lib/stripe/client.ts` is the
ONLY place that header is set, deliberately, so a grep for it is the complete list of calls
GENORRA makes on a family's behalf.

**A SUBSCRIPTION CHARGE IN `dues_payments` WOULD BE THE WORST BUG IN THE PRODUCT**, and it
would look like a working feature. It would inflate `getFamilyDuesCollected()` — the dashboard
headline — with money the family never received; `routePaidPayment` would split it across their
own funds, so a slice of GENORRA's invoice would land in their Reunion fund; it would appear in
`/reporting/pl-summary` as income and in a member's history as a due they paid; and it would be
UNREMOVABLE, because that table is append-only (`20260806000002`) so the correction is a negative
row and the mistake stays in the family's ledger forever. Hence the `platform_*` prefix: nothing
in `app/actions/dues.ts`, `lib/fund-routing.ts` or `fund_balance_cents()` knows those tables
exist.

**THE FAMILY'S DUES GOING THE OTHER WAY IS RIGHT, THOUGH, and needed no schema at all.**
`dues_payments.source` has permitted `'stripe'` since `20260610000005` and
`(source, processor_ref)` has been unique since the same file, with a comment saying it was for
webhook-retry idempotency. A card payment IS the family's money and belongs in the family's
books, routed by the same waterfall as a cheque keyed in by hand.

## WE HOLD NO FAMILY'S API KEY, AND MUST NEVER START

`payment_info.md` §4 is the long argument and it is the single most important rule here. A
family connects its own Stripe account through Stripe's hosted onboarding and we store an
`acct_…` — an identifier, useless without our platform key, revocable by the family, and it
arrives with an event when they revoke it. A family's `sk_live_…` in our database would make a
breach of GENORRA a total compromise of every family's money, with no scoping and no
revocation, in violation of Stripe's own terms.

`20260823000005`'s verify block **fails the deploy** if a column on either processor table so
much as looks like a credential (`%secret%`, `%api_key%`, `%private_key%`, `%access_token%`).
That is the one rule in this feature whose violation would break nothing and cost everything,
which is why it is asserted rather than promised.

## THE BUTTON PRESS IS NOT THE PAYMENT

`app/actions/billing.ts` may create a Checkout Session, update a subscription, and write a
PROMISE (`scheduled_tier`). It may **not** decide that a family has paid. Nothing in any action
writes `families.tier` or `paid_through`; those move in exactly two places:

* `lib/stripe/platform-events.ts`, after a signature-verified event says the money moved;
* `apply_due_platform_tier_changes()`, when a term ends.

A member can press Pay, be redirected, and abandon the page. They can pay and lose the
connection before the return page loads. A delayed-notification method completes the session
while it is still UNPAID and fails three days later. In every one of those the action ran and no
money arrived — so an action that granted the tier would give the product away to anybody who
could reach the endpoint, which is everybody signed in. Hence `payment_status !== 'unpaid'` on
both checkout handlers, and hence the return page only ever REPORTS.

**`families.tier` IS STILL THE ONLY THING ANY GATE READS**, and that is not a stepping stone. No
RLS policy consults it, none may, and making a family's access depend on a billing read would put
a Stripe-shaped query on the hot path of every page load. `entitlementOn()` in TypeScript
DESCRIBES the paid standing; the SQL sweep is the only writer. If a third expression of that rule
appears, one of them is wrong.

## FOUR RULES ABOUT PLANS, WRITTEN INTO COLUMNS RATHER THAN INTO CODE

1. **ONE RATE PER TIER, MONTHLY.** No annual price — `lib/plans.ts` records why one was
   withdrawn, and a year in advance is twelve months at the monthly rate.
2. **NO REFUNDS.** There is no refund column, no credit-note table, and `amount_cents > 0` is a
   CHECK. The one place this is a live hazard is `proration_behavior`: Stripe's DEFAULT is
   `'create_prorations'`, which issues a CREDIT for the unused remainder — a refund that has not
   been paid out yet. `changePlanTier` passes `'none'` on a downgrade for exactly that reason.
3. **A DOWNGRADE WAITS FOR THE TERM TO END.** `scheduled_tier_on` is `paid_through + 1 day`,
   because `paid_through` is INCLUSIVE — a day early is a refund in the one direction this system
   does not do, and `scheduleDowngrade` is mutation-tested on that off-by-one.
4. **AN UPGRADE TAKES EFFECT AT ONCE, AND THE UNUSED TERM IS KEPT AS VALUE.**
   `upgradeCreditDays` converts the remainder at the dearer tier's rate:
   `floor(remainingDays × oldMonthly ÷ newMonthly)`. The alternative — stacking the new months
   on the end — is not an unfairness, it is an EXPLOIT: ten months of Standard plus one of
   Premium would be eleven months of Premium, because the tier in force is a single value.

## IDEMPOTENCY IS THE DATABASE'S JOB, IN THREE LAYERS

Stripe redelivers: on a 500, on a timeout, and days later in the ordinary course of things — past
every in-process cache and past its own 24-hour idempotency window. So:

* **`stripe_webhook_events`** claims each event in ONE statement (`claim_stripe_event`), for the
  reason `claim_distribution_recipients` is one statement: a read-then-write from this process
  lets two concurrent deliveries both decide they are the first, and here that means a family
  credited twice for one payment. **The claim is RECOVERABLE after fifteen minutes** — without
  that, a handler that dies mid-event leaves the row claimed forever and every redelivery is
  refused as a duplicate, so the event is permanently lost by the mechanism meant to protect it.
* **`platform_payments.stripe_ref`** and **`dues_payments(source, processor_ref)`** are unique,
  and both hold the CHARGE rather than the subscription. Every renewal of one subscription shares
  the subscription id, so keying on that makes month two a duplicate of month one and discards it
  forever — silently, because a suppressed duplicate looks exactly like a working integration.
* **`intentKey()`** on outbound POSTs, derived from the INTENT and never from a clock. A fresh
  random key defeats the whole mechanism while looking like it is using it.

**A HANDLER THAT COULD NOT DO ITS JOB MUST ANSWER 500.** Stripe reads the status code and decides
whether to redeliver; swallowing a failure into a 200 loses the event permanently, and the events
lost that way are the ones that grant a tier somebody paid for. `finish_stripe_event` leaves
`processed_at` NULL on a failure for the same reason.

## A TABLE WITH NO `family_code` OWES TWO SCRIPT ENTRIES, AND THIS ONE COST A RED DEPLOY

`stripe_webhook_events` has no `family_code` — deliberately: a platform event is about
GENORRA's own Stripe account and belongs to no family, and the Connect events that DO belong
to one arrive before anything has resolved which. Its only outward-pointing column is a raw
`acct_…` string with no foreign key.

That makes it invisible to `audit_global_lookups.sql`'s §2, whose whole job is to derive rather
than to be told: **any `public` table that is empty and has no transitive foreign-key path to a
`family_code` is reported**, because that is precisely what an emptied global lookup looks
like. It is a step in `migrate.yml`, so it held the Vercel alias with the schema already
applied — the failure mode that section already warns about for a table retired from a list,
arriving from the other direction.

**So a new table with no `family_code` owes an entry in `allowed_empty` in the same commit**,
with a sentence saying which case it is: empty by DESIGN (nothing seeds it and nothing can) or
empty because something emptied it. `marketing_attribution` and `marketing_conversion_events`
got that right in their own commit; this did not, and the entry now says so.

**And `reset_families.sql` §11 is the second entry, which is easy to miss because it DERIVES
its assertion too.** That script deletes by hand and checks dynamically — every `public` table
either gets a DELETE or goes on the keep-list, or §11 rolls the whole reset back naming it. The
four family-scoped billing tables are deleted (§6d-bis); the event ledger is kept, because a
FAMILY reset is not a platform reset. The two scripts disagreeing about that one table is
correct rather than an inconsistency: one empties a family, the other empties everything.

The cheap way to check the second one is a static diff of the script's DELETE targets and
keep-list against `information_schema.tables` — it cannot see cascades, so the residue needs
reading by hand, but it finds a table nobody thought about in seconds.

## AND `/api` IS EXCLUDED FROM `proxy.ts`

The first `app/api` routes in the product arrived with this, and the matcher had to learn about
them. A webhook carries no cookie, so the session plumbing is waste — but the real reason is
that `isGatedPath()` longest-prefix-matches the feature registry, so a future `FEATURES` entry
whose href began `/api` would start REWRITING deliveries to the Coming Soon page, which answers
200. Stripe would record every one as accepted and never retry. `/auth/confirm` is deliberately
NOT excluded: that route needs the cookies this file rotates.

# Sending email is a plain module, never a server action

`lib/email/` sends the mail the **app** composes — membership approved, family invitation, the family-removal code, and email distributions.
`supabase/templates/` is the mail **GoTrue** sends. Both go out through one Resend
account, over different protocols, and [lib/email/README.md](lib/email/README.md) has the
full picture.

One rule matters more than the rest, and it is the same rule `lib/notifications.ts` and
`lib/invitations.ts` are built on:

**Never export a sender from a `'use server'` file.** Everything exported from one gets a
URL, so a `sendEmail` export is an **open relay** — any signed-in user could POST an
arbitrary recipient, subject and body and have it delivered over GENORRA's authenticated
domain, carrying our SPF and DKIM. That is phishing with the product's reputation
attached, not spam. Keep the senders in plain modules and let actions import them.

**And some mail is not ours to send at all.** GoTrue already publishes
`POST /auth/v1/resend` and `POST /auth/v1/recover`, reachable with the anon key that ships in
the browser bundle — so wrapping either in a `'use server'` function creates a *second*
public endpoint whose only job is to reach the first. One that takes an email address as a
parameter, which is the mail cannon `resendConfirmationEmail` takes no arguments to avoid;
and one that hides every caller behind our server's address in front of the only rate limiter
there is. `ForgotPasswordForm` and the resend offer in `LoginForm` therefore call GoTrue
**from the browser**, unauthenticated, with no action between.

The cost is that neither can report what happened, and the copy has to be written for that.
Measured 2026-08-17: resend answers `200` for an unconfirmed address, a confirmed one and an
address with no account alike. The one thing that *does* vary is
`over_email_send_rate_limit` — and it fires only for an address with a **pending**
confirmation, so the refusal is precisely the account-enumeration answer the `200` exists to
withhold. Both screens therefore report ONE sentence for success, rate limit and transport
failure alike, and neither ever surfaces GoTrue's own message.
`PendingApprovalScreen` is the exception that shows the rule: it may say "Sent" because it
read `email_confirmed_at` off a real session first.

Two more that have already shaped call sites:

* **The origin comes from configuration, never a request header.** `Host` and
  `X-Forwarded-Host` are attacker-controlled, and here they would control the hostname
  inside a link an email tells someone to trust. `emailOrigin()` reads
  `NEXT_PUBLIC_SITE_URL`; set it to match `auth.site_url` in `supabase/config.toml`.
* **Sending fails soft, so the UI owes the truth.** `sendEmail()` never throws — every
  call site runs *after* a decision is committed, and a mail outage must not roll back an
  approval or surface as a failure to the administrator who clicked it. The cost is that a
  dropped message is invisible to whoever was expecting it, so a caller must not render
  success over an email that did not go. `inviteMember` is the worked example: it withholds
  the invitation token when the send worked and hands it back, with an explicit failure
  notice, when it did not.

## MAILING THE WHOLE FAMILY IS A QUEUE IN THE DATABASE, NOT A LOOP IN AN ACTION

`/community/distributions` (`20260822000025`), and **the first `tier: 'premium'` route in the
product** — `lib/features.ts` said "NOTHING IS PREMIUM" until 2026-08-22. A member writes a
subject and a message, names an AUDIENCE, and everybody in it gets one email.

**IT IS THE SHAPE THE OPEN-RELAY RULE ABOVE FORBIDS, AND FOUR THINGS ARE WHAT MAKE IT A
FEATURE INSTEAD.** All four have to survive any change here:

* **The caller never names a recipient.** They name a scope — `family | region | chapter` —
  and at most one area id, and the server resolves it against the family's own roster. This
  is `scheduleMeeting`'s rule ("THE CLIENT NAMES BODIES AND NEVER SENDS PEOPLE") with higher
  stakes: a resolved list arriving from a client is an arbitrary recipient list, and a server
  action is a public HTTP endpoint.
* **Sending is `canAny`, never `can`.** Family-wide operation with no coherent "own" version,
  and the row a member would own — a distribution they sent — is exactly the abuse case.
* **`From` is ours and `reply_to` is read off the sender's own `people` row.** A
  caller-chosen reply-to on mail carrying our SPF and DKIM is a phishing header on
  authenticated mail; it is the same rule as the first bullet about a different field. A
  generated placeholder address is never used as one.
* **The BODY is the only member-authored payload in `lib/email/`,** so `esc()` on it is the
  boundary rather than hygiene. `bodyParagraphs()` returns PLAIN text on purpose —
  `lib/distribution-audience.ts` is pure and cannot import the email layer — and
  `distributionEmail` escapes one line away. Keep the two adjacent.

**THE FAN-OUT IS CHUNKED BECAUSE THIS PRODUCT HAS NOWHERE TO RUN BACKGROUND WORK.** No cron,
no worker, no queue, no `vercel.json` — and `sendEmail` takes ONE recipient per call, so a
hundred and forty relatives is a hundred and forty provider calls at a rate limit. That does
not fit a request. So `distribution_recipients` **is** the queue: `sendDistribution` resolves
the audience and mails nobody, and `sendDistributionBatch` claims a bounded slice, sends it,
and records each outcome. The client drives it until nothing is pending.

Three consequences worth knowing before changing any of it, and the third is the one a
future feature will get wrong:

* **A send survives a closed laptop**, because the state is in the table rather than in a
  request. `requeueDistribution` recovers rows stranded in `sending` by a killed batch — that
  is not a nicety, it is the only thing that can move them.
* **`BATCH_SIZE * SEND_SPACING_MS` is bounded by two limits we do not control** — the
  provider's per-second cap and the platform's wall-clock ceiling. Raise either and do the
  multiplication first: exceeding the first records 429s as delivery `failed`, so a pacing
  bug presents as a mail problem and sends somebody looking at DNS.
* **`claim_distribution_recipients()` is SQL because the app races itself.** One statement
  under `FOR UPDATE SKIP LOCKED`; a read-then-write from the action lets two administrators
  pressing Send mail one relative twice, which cannot be recalled. It is granted to NOBODY
  (§2b) and asserts its own family argument anyway (§2b rule 3) — and that assertion is not
  decoration: with the action's family conjunct deleted, the function's 42501 is what still
  refuses the write. Measured.

**SIX RECIPIENT STATES, AND THE LAST THREE ARE THE FEATURE.** `pending | sent | failed` is
not sufficient, and each of the others is a fact that would otherwise be reported as one of
those three and be wrong:

| | |
|---|---|
| `unreachable` | a recorded relative whose address is a GENERATED placeholder. **`placeholderEmail()` builds those on `@genorra.com` — a REAL domain — so `sendEmail`'s reserved-TLD guard does NOT catch them** and mailing one is a hard bounce against our own sending reputation. `lib/family-tree.ts` says every sender owes this check; this is where it is owed. Filed as `failed` it would sit forever in the column an organizer works through. |
| `duplicate` | both relatives sharing a mailbox keep a row, so the family's arithmetic still accounts for both, and only one is mailed. `/pricing`'s "nobody is on it twice", enforced by a **partial unique index** on `(distribution_id, lower(email)) WHERE state <> 'duplicate'` rather than by whichever code path last wrote a row. |
| `cancelled` | addressed and deliberately not mailed. Distinct from `failed` for the reason a reopened gathering task is a different bell entry from a denied one. |

**THERE IS NO `status` COLUMN ON `distributions`.** `distributionProgress()` derives the label
from the counts — a stored status is the `is_minor` trap (§4b), stale the first time a send is
interrupted.

**AN AREA SCOPE NARROWS, WHICH IS DELIBERATELY NOT THE ANNOUNCEMENT RULE.** `addressedTo` in
`lib/announcement-audience.ts` treats a national or regional announcement as reaching
everybody, and an empty area picker as family-wide. Both inversions are right there and wrong
here, and the difference is what the two surfaces DO: an announcement that reaches too far is
a card somebody scrolls past, and a distribution that reaches too far is mail in a hundred and
forty inboxes. So a region reaches that region's chapters and nobody else — **a member in no
chapter is in no region and is not reached**, which is correct and is the sort of correct that
reads as a bug unless the screen prints the excluded count, which it does — and an unnamed
area addresses NOBODY, refused by the action, by `inAudience`, and by a CHECK constraint.

**THE KEY GATES A TABLE, unlike `library/bylaws` or `gatherings/budget`.**
`community/distributions` has a `permission_table_map` row, so its SELECT policies compose
`auth_permission` and the key withholds ROWS rather than a screen band. That is the decision:
a recipient list is every relative's address with a delivery outcome beside it. `own_expr` is
the SENDER; `self_expr` is `false` on both tables, because an expression admitting the
RECIPIENT would publish the whole roster to exactly the set of people the roster is made of.

**AND THE ROSTER READ IS THE ADMIN CLIENT ON PURPOSE (§3 by hand).** If the audience narrowed
to what the SENDER may read, "nobody is missed" would be false — a sender without
`community/directory` at `'any'` would mail a subset and be told it went to everybody. A wrong
number rather than a missing one, which is the argument the four activity reports make.

**WHAT THE RLS SUITE CAN AND CANNOT SEE HERE, because it is unusual.** Every read in that
action module is on the admin client, so **no policy is underneath any of them** — deleting
`perm:distributions:select` leaves every case green, and the policies are asserted in the
migration's verify block instead. And for the writes, three of four mutation checks left every
probe green and were caught only by `expectRefusal`: each is stopped by a *second* layer that
then refuses for a different reason, so the row is genuinely untouched. **`deleteDistribution`
shipped without its `belongsToFamily` check and the `told` assertion is what found it** — §8b,
and the reason to read that column rather than the attack column alone.

# The route tree IS the nav rail. A screen lives where the rail says it does

**One rule, and everything else in this section is its consequences:**

> A screen's route is `/<its rail section>/<its rail caption>`, kebab-cased. Its folder is
> that path, and its permission key is that path without the leading slash.

So Admin > Members is `app/(protected)/admin/members/page.tsx`, route `/admin/members`, key
`admin/members`. Reporting > P&L Summary is `app/(protected)/reporting/pl-summary/`, route
`/reporting/pl-summary`, key `reporting/pl-summary`. There is nothing to look up: given the
rail, you can write the path, and given the path you can find the file and the grant.

`20260820000004` moved 42 keys and 30 route directories to make this true. Before it, the
tree was the archaeology of the order things were built in — `/family-finances` was a
Reporting screen captioned "P&L Summary", `/admin/users` was captioned "Members", `/members`
was captioned "Directory" and sat under Community while `/admin/users` sat under Admin. Every
one of those was defensible on the day it was written and none of them was findable a year
later.

## The three that move together, and the four that do not

**Move together:** the folder, the route, and the key. §1 already forces the last two — "the
resource key is the route without its leading slash" — so the only new obligation is that the
route follows the rail. A rail item renamed or moved to another section is a route change and
therefore a MIGRATION; see below for what one costs.

**The four exceptions, each stated rather than discovered:**

* **A screen with no rail section stays at the root.** The rail's first group has no heading
  and holds Dashboard; Help is its own single-item section at the bottom. `/dashboard` and
  `/help`, not `/dashboard/dashboard`.
* **A screen that is not in the rail at all stays at the root.** My Profile and My Families
  are reached from the account menu in the top bar, and `20260806000006` deliberately removed
  their `permission_resources` rows so they can never be restricted. `/personal-info`,
  `/my-families`.
* **A section whose own index page IS the section does not double up.** The Gatherings
  section holds Gatherings and Calendar; the first is `/gatherings`, not
  `/gatherings/gatherings`, and the second is `/gatherings/calendar`. The test is whether the
  section and the item mean the same thing — and note that `/gatherings/[id]` already lives
  under that segment, so doubling would also have collided.
* **A pane, a redirect or a tier-carrying sub-key nests under its rail item.** These are not
  rail items and have no caption of their own, so they take their parent's path:
  `admin/members/approvals`, `admin/members/organization`, `admin/gatherings/templates`,
  `accounting/transactions/fund-transfers`, `accounting/summary/funds`.

**`/admin` is not an exception and not a page.** It is the prefix catch-all in
`lib/features.ts` that gates every nested admin route nobody has registered, and it stays
`status: 'future'`.

## What a rename actually costs, which is why the rule is worth having

Six things reference a key, and `20260805000006` is the file that enumerated them for one
key; `20260820000004` is the same list applied to 42. Every one of them is a place a rename
can be half-done:

1. `permission_resources.key` — the row itself.
2. `template_permissions.resource_key` — every grant on every template.
3. `resource_visibility.resource_key` — the per-family show/hide.
4. `permission_table_map.resource_key` — which table the key gates.
5. **The composed POLICY EXPRESSIONS.** `_perm_predicate()` interpolates the key with `%L`,
   so 94 policies each carry `auth_permission('old-key'::text, …)` as literal text. Updating
   the map does NOT change them — the map is only read when the sweep runs. Left behind, they
   ask about a key that no longer exists, `auth_permission` falls through to its default, and
   the table goes **world-readable for view while every write fails closed**.
6. **Function bodies.** Six SECURITY DEFINER functions gate themselves with
   `auth_permission('<key>', …)`, `auth_can('<key>', …)` or `resource_key = '<key>'` written
   into their own source — `set_membership_status`, `apply_permission_template` and four
   others. All three shapes were found by an assertion failing, one after another, not by
   reading. Enumerate them, do not recall them:
   `grep -rhoE "auth_[a-z_]+\('[a-z/-]+'" supabase/migrations/*.sql | sort -u`

None of the foreign keys is `ON UPDATE CASCADE`, so a key cannot be `UPDATE`d in place:
dependents are copied to the new key and the old rows dropped, in that order.

## Sweeping the code: routes are safe, bare keys are not

A route literal always has a leading slash and can be replaced mechanically, longest-key
first. **A bare key cannot**, and this is the trap:

| String | Is a permission key | Is also |
|---|---|---|
| `'dues'` | yes | a `dues_schedules.kind`, a ledger id, an Accounting section id |
| `'photos'` | yes | a table, a storage bucket, a document category |
| `'members'` | yes | a tab id, a dashboard tile id |
| `'chat'` | yes | a `chat_rooms.type` |
| `'donations'` | yes | a ledger id, a fund `system_key` |

There were 246 such occurrences and fewer than 30 were keys. So a bare key is replaced ONLY
inside a permission-call shape, and the shapes are enumerated from the signatures rather than
remembered — every exported helper in `lib/auth/*` that takes a `resource: string`, plus
`tierAllows`. The first sweep used a hand-written list and missed `requireFamilyActive`,
`requireTier` and `scopeFor`.

**Four things catch what the sweep misses, and all four earned their place here:**

* `npm run typecheck` caught a local `canSee('dues')` helper that takes a *ledger id* and had
  been rewritten as though it took a key.
* `npm run help:check` caught both halves of the manual: chapter `route`s that had moved, and
  `[label](/route)` links that had NOT been swept, because that form has a `(` before the
  slash rather than a quote.
* **`npm run test:rls` caught the two SQL shapes**, through positive controls — five actions
  where the family's own administrator could no longer do their own job, while every attack
  assertion still passed. An action nobody can perform is perfectly isolated.
* The migration's own assertions caught the rest, and they are written to name the offending
  key rather than to say "something is wrong".

**AND NONE OF THE FOUR CAUGHT THE ONE THAT MATTERED. `20260820000004` LEFT FOUR STALE CALL
SITES AND THEY FAILED OPEN FOR TWO DAYS.** Found on 2026-08-22, by grepping the old keys rather
than by any gate:

```
app/(protected)/reporting/membership/page.tsx   requireView(user.id, 'membership-report')
app/(protected)/reporting/membership/page.tsx   canAny(user.id, 'membership-report', 'view')
app/actions/reports.ts                          requireScope('membership-report', 'view')  ×2
```

**An unregistered non-admin key resolves `view` to the `'everyone'` default** (§6). So
`requireView` admitted every member, `canAny` answered `'any'` to all of them, the Membership
report was readable by the whole family whatever an administrator had set, and the switch on
Members & Access moved nothing. Every one of the four gates above was satisfied: the types are
strings, the manual links a ROUTE and that route was correct, and `test:rls`' control passed
because the caller who was supposed to succeed still did — it is the ATTACK that should have
gone red, and there was no case for a member without the grant.

Three things follow:

* **A bare key that goes stale fails OPEN, so the absence of a failure proves nothing.** That
  is the opposite of every other kind of stale reference in this codebase, and it is why this
  class cannot be left to "something would have broken".
* **After any key move, grep the OLD keys as well as sweeping the new ones**, and grep them
  bare rather than as routes:
  `git grep -nE "'(old-key-1|old-key-2)'" -- '*.ts' '*.tsx'`. A route literal has a leading
  slash and is mechanically sweepable; a bare key is not, which is the whole reason this
  section exists — and the sweep that missed these was written by somebody who had read it.
* **A migration CAN assert this and should.** `permission_resources` is the list of keys that
  exist; a check that every `auth_permission`/`can*` literal in the tree names one would have
  caught all four at deploy time. It does not exist yet and is worth building the next time a
  key moves.
**A help chapter's `slug` is NOT a route and must never be swept with one.** It is the
chapter's identity in `/help/<slug>` and it moves with nothing. Sweeping bare keys across
`lib/help/content.ts` renamed nine chapters — the replacements cascaded down the file — and
the repair was to restore the file and re-apply routes only.

# The main rail is a standard component

`components/layout/MainRail.tsx` is **the default primary in-page navigation**. A page
that switches between panes uses it and decides nothing: a horizontal strip of
underlined tabs sitting on a rule the width of the content, with an optional
right-aligned slot for the active pane's one action.

```tsx
<MainRail
  label="Transaction ledgers"                 // names the nav landmark
  items={LEDGERS.map(id => ({
    id, label: LEDGER_LABELS[id], icon: LEDGER_ICONS[id],
    href: `/accounting/transactions?ledger=${id}`, // optional — see below
  }))}
  active={ledger}
  onSelect={selectLedger}
  action={canRecord && <Button …>New Dues Payment</Button>}
/>
```

It replaced a filled-pill rail down a `xl:grid-cols-[16rem_1fr]` left column, which is
why the rule is worth keeping rather than a preference to relitigate: that column was
charged to every page carrying it, and the routing table on Accounting — then floored at
`min-w-[560px]` — could not spare it much below 1280px. That floor is gone now (see "On
a phone a table narrows"), and the rail stays: the column cost every page, wide table or
not. Members & Access, Transactions and Accounting all use it; there is no second
main-rail style in the codebase, and a new one should not appear.

Four things about it are load-bearing:

* **Supply `href` when the pane has a URL.** The item then renders a real `<a>`, so
  cmd-click, middle-click and copy-link-address work, while a plain left click is
  intercepted and handled locally. That interception is the point on these pages — a
  real navigation refetches the RSC payload and remounts the pane, discarding
  optimistic rows, half-filled forms and `useTransition` state. Omit `href` only where
  the pane genuinely has no address.

* **Never drop the explicit text colours** if you fork or extend it. `app/globals.css`
  carries an unscoped `a { color: var(--brand-accent) }` in its base layer, and every
  link in the rail comes out in the accent colour without them. The same trap is
  commented at each of the older rails.

* **It is not a `role="tablist"`,** deliberately. That role promises arrow-key roving
  focus, Home/End, and `aria-controls` wiring, and a screen reader changes its own key
  handling to match. None of that is implemented, so claiming it would strand those
  users. As a nav landmark holding links, Tab works — which is what is true. Same
  reasoning as `RowMenu` in `AdminAccessClient`.

* **It carries no margin of its own.** Space it from the parent — a `space-y-*` wrapper
  (Members & Access, Accounting) or an explicit `mt-*` on the pane (Transactions).

* **Below `sm` it is a vertical stack, one item per line, and the active marker moves to
  the left edge.** Four ledgers or six profile sections never fit 390px, and `flex-wrap`
  broke them into ragged rows whose second row started under the middle of the first — so
  the underline read as a rule under an arbitrary half of the rail rather than under one
  item. A stack has one item per line by construction; there is nothing left to wrap. The
  marker has to move with it, because a full-width `border-b-2` under a stacked item is
  indistinguishable from a divider between two items. Inactive items carry the same border
  widths in `transparent`, so selecting one changes a colour and never a size — which also
  removed the 2px height jump the horizontal rail had. The `action` slot stacks underneath
  and stretches to match; if you add a rail variant, keep all of this.

**Second-level rails are untouched by this.** Accounting has two levels — groups on the
main rail, then the pages inside the active group — and the inner one keeps the filled
pills in its 16rem column, along with the create trigger that sits under it. The rule is
about the page's *primary* nav, not about every list of links on it.

## One rail item, one permission resource

Every item on a rail — main or second-level — owns a row in `permission_resources`, and
that row's `label` is the caption the rail prints. Both halves are load-bearing.

**A grant per item,** because a rail is where a page divides into jobs, and jobs are what
a family delegates. One grant over a whole rail cannot express "record dues but not pay
money out", which is the division basic accounting exists to make. Every rail is bound to
its keys through one table, next to the labels, so the tab and the server action cannot
disagree: `LEDGER_RESOURCE` (Transactions), `SECTION_RESOURCE` (Accounting). Members &
Access is the exception that proves it — its four tabs have four keys and no table,
because its page resolves them one by one.

### One PANE may span two keys. The test is whether they are two jobs

The heading is the default, not an absolute, and the tree has two counter-examples on purpose.
**A pane may render more than one resource when they are two jobs a family delegates
separately** — and then, without exception, **the pane renders only what the caller holds and
fetches only that** (§5). The keys stay separate in `permission_resources` with their own
labels, because those labels are what the GRID prints and an administrator still moves two
switches.

* **Members & Access** opens on ANY of `admin/users`, `admin/approvals`,
  `admin/users/templates`, `admin/chapters` and — since 2026-08-20 — `admin/boardpositions`,
  each tab resolved one at a time. A caller holding only Organization gets that one tab; a
  caller holding none gets `notFound()`.
* **ORGANIZATION IS ONE PANE OVER TWO KEYS**, and it is the sharpest instance of this rule
  because the two halves are visibly different things: `admin/chapters` is the family's
  GEOGRAPHY (regions and chapters) and `admin/boardpositions` is its OFFICES. They are one
  pane because they answer one question — what shape is this family in — and they stayed two
  keys because a family may well let somebody curate the board roster without trusting them to
  redraw its regions.

  Three things follow that the Dues & Donations precedent does not cover. `showGeography` and
  `showBoard` are separate props from the arrays being empty, because "no board positions yet"
  is a fact the pane says out loud and invites you to fix while "not yours to see" must not be
  mentioned at all — inferring one from the other tells a caller without the grant that the
  family has nothing. The read-only notice tests SIX write grants rather than three, or it
  would print "you can see how the family is organized but not change it" over a board roster
  the caller can fully edit. And the board half resolves on `canAny` while the other four
  panes use `can`, because every read behind it is `requireScope` and `family_roles`' composed
  policy tests `= 'any'` with an `own_expr` of the literal `'false'` — scope `'own'` is not a
  way to hold that key, and `can()` would render the pane over lists that answer `[]`.
* **Accounting's Dues & Donations WAS the third example and is not any more** — it is worth
  keeping as the case that got REVERSED, because the reversal is the sharper lesson. It was one
  rail item over `admin/accounting/dues` and `admin/accounting/donations` for one day
  (2026-08-19 to 2026-08-20), on the argument that the two are one screen in every way a reader
  can see: same table, same CRUD, same edit dialog, split only by `kind`.

  **What that argument left out is the GRANT.** Two keys behind one caption made an
  administrator translate two grid rows into one rail word, and a treasurer holding only one of
  them was shown a caption naming the other. Sameness of TABLE is a weaker fact than difference
  of PERMISSION, and the keys were always separate for a reason the product sells: *"Separation
  of duties — per-feature permissions, so recording dues is not the same as paying money out"*
  is a Free plan bullet in `lib/plans.ts`. So the rail split back into two items, each mapping
  to exactly one key, and `AdminAccountShell` now has no hand-set caption at all.

  **The two-key machinery was KEPT.** `sections` is still a list, `visibleGroups` still narrows
  it, `shows()` still asks — it costs nothing, it is what makes a caller holding one grant of a
  pair see only their half, and this rail has merged and split once already.

**AND THE MEMBER-FACING HALF WENT THE OTHER WAY ON THE SAME DAY, which is not a contradiction.**
`/accounting/dues` and `/accounting/donations` became one screen AND one key
(`accounting/dues-and-donations`, `20260820000009`) — two panes, no per-pane grant, one
`requireView`. The test AGENTS.md sets is the one that separates the two decisions: *could a
family sensibly hold one and not the other?* On the admin side yes, and it is sold. On the
member side no — both are `view`-only, both are the reader's OWN standing, both are `standard`,
and neither has a `permission_table_map` row, so neither gates a table. They were one job.

The general rule that falls out: **merge two ROUTES freely, and merge two KEYS only when no
family could sensibly split them.** A shared route is a layout decision and reversible in an
afternoon; a merged key is a migration that copies every family's grid and cannot be un-merged
without inventing which half each family meant.

One consequence still worth knowing before doing this to a third rail: **one create trigger per
key**, never one that guesses. "New Dues" and "New Donation" are two grants, so the rail's
action slot is written as a LIST even now that every item on it holds at most one — collapsing
it would put the decision back in the shell, which is what made "New Dues" appear for somebody
who could only add a donation.

**A PAGE THAT RESOLVES PANES BY HAND OWES THE TIER AND REMOVED-FAMILY CHECKS BY HAND TOO**, and
this is the trap the third rail will hit. §1's preamble is one call because `requireView` folds
`requireFamilyActive` and `requireTier` in — exactly so that no page has to remember them — so a
page that swaps it for a union of `can()` calls has dropped both, silently and with nothing
reporting it.

`/announcements` is the worked example done right: `requireFamilyActive`, then `requireTier`,
then the union of the two pane grants, in that order and argued in the file. `/admin/users`
does the same now — it carried only half until the removal gap below was closed.
`canViewOrganization` is `can(…) AND tierAllows(…)`, because Organization is a Plus feature
while the Members and Pending Approval tabs are not, and a chapters-only caller on a Free family
gets `redirect('/upgrade…')` rather than a 404 — which is what `requireView('admin/chapters')`
used to answer for them; everyone else gets pane-absence rather than a redirect, because an
administrator who opened the Members tab must not be thrown onto a sales screen over a pane they
were not looking at.

**TWO OF ITS FOUR PANES CARRY A TIER GATE SINCE 2026-08-19**, and the second one is the reason
this is worth reading before touching that page: Permission Templates is `tier: 'standard'`, so
`canViewTemplates` is `can(…) AND tierAllows(…)` on exactly the Organization pattern, and the
no-pane branch offers `/upgrade` for TEMPLATES first because Standard is the cheaper rung. The
sub-key has no route, so a `FEATURES` row in `lib/features.ts` is what carries the tier at all —
without it `tierAllows` longest-prefix-matches `/admin/users` and answers Free.

**AND THE `requireFamilyActive` GAP IS CLOSED.** This paragraph read "it has never called
`requireFamilyActive` … an administrator of a REMOVED family can still open Members & Access.
Whoever next touches that page owes it the line." The line is there. It is keyed on
`admin/users` rather than on the tab being asked for, because none of the four keys is in
`REMOVED_FAMILY_RESOURCES` and so all four would answer identically.

What this is NOT licence for: folding two keys together because one screen happens to show
both. If a family could never sensibly hold one and not the other, they were one job and should
have been one key.

**A rail item that grows a ROUTE stops needing the table, and its key must move with
it.** `PANE_RESOURCE` was the third of those tables until `20260815000000`, and its
disappearance is the rule rather than an exception to it. My Summary was a rail over
Upcoming Dues | Donations | Payment History, each already carrying its own grant under an
`account-summary/` prefix; those three are `/dues`, `/donations` and `/payment-history`
now, on the MAIN rail. §1 leaves no choice about what that does to the keys — the
resource key is the route without its leading slash — so `account-summary/history` became
`payment-history`, and a lookup table became unnecessary the moment the href *was* the
key. The migration copies every family's pane grant onto the new key before deleting the
old row, which is the whole of what promoting a pane costs.

Two things about that migration are worth reading before doing the same to another rail.
It **re-uses the key `dues`**, which `20260808000001` had retired — safe only because the
old one gated a TABLE (`dues_payments` SELECT) and the new one gates a SCREEN, and the
file asserts the difference rather than asserting it in prose: no `permission_table_map`
row may name it, and no policy may evaluate `auth_permission('dues', …)`. And it keeps
one sub-key, `account-summary/funds`, because the family's fund balances on Summary are
the one section there with no screen behind them — which is exactly what a sub-key is
for.

Sub-keys nest under their page's key (`transactions/dues-payments`,
`admin/account/routing`, `account-summary/funds`) and that prefix is **not** cosmetic:
`getResources()` drops any row where `isFeatureFuture('/' + key)`, and `getFeature()`
longest-prefix-matches. A key under a `'future'` prefix vanishes from the grid with no
error at all — `family-finances/foo` would, `transactions/foo` does not. That is why the
funds section on Summary is `account-summary/funds` and not `family-finances/funds`,
though the table it reads is mapped to `family-finances`: the sub-key is an app-layer
gate on whether the section is fetched, and the map row is still what decides which rows
come back.

**Gate the fetch, not the tab.** A hidden tab over data already fetched has published
that data (§5). Each page resolves its rail's grants server-side, skips the query for
every item the caller cannot view, and hands down the surviving list — `visibleLedgers`,
`rights` — so the rail renders from the same answer the fetch used. A caller who can view
none of them gets a sentence saying so, not an empty rail over an empty pane. This holds
for a page that is a DIGEST of other screens too: `/account-summary` resolves `dues`,
`payment-history`, `donations` and `account-summary/funds` before its `Promise.all` and
passes `[]` in place of any query it is not entitled to run.

**Declare only the actions something reads.** `permission_resources.actions` is what
decides which switches the grid renders, and a switch nothing consults reads as a
control being honoured. `transactions` and `account-summary` each carried all four
until `20260808000000` narrowed them to `view`: both are read-only pages over records
owned by other resources, and their write grants live on those. Before adding an
action, name the policy, the `permission_table_map` row or the `can*()` call that will
read it.

**Captions come from the screen.** The grid used to say "Dues Schedules" where the
Accounting rail says "Dues", and "Fund Disbursements" where the Transactions rail says
"Disbursements"; an administrator matching a switch to the thing it switches off should
not have to translate. Two rails may use the same word — "Dues" appears under both
Accounting and Transactions — and that is fine, because each renders under its own
`subsection` heading.

**Dashboard and the Personal pages are deliberately outside all of this.** My Profile, My
Families and Family Tree are a member's own things, and `20260806000006` removed their
rows so they cannot be restricted; the 2026-08-08 review reconsidered that and kept it.
The empty `personal` heading in `components/admin/resource-groups.ts` is the trace of that
decision, not a gap to fill. (My Children was on that list and is gone — see "A child is
a person" below; the row `20260806000006` deleted for it was never re-added, so retiring
the route needed no migration.)

# A family is on a plan, and the plan decides which pages exist

`lib/features.ts` answers *has this shipped at all?* `lib/tiers.ts` answers *is it in
what this family pays for?* Both must be true before a member sees a page, and they
fail differently on purpose:

| | |
|---|---|
| not shipped | Coming Soon, from `proxy.ts`. Nobody can have it yet, on any plan. |
| above the tier | `/upgrade`, from `requireView`. It works, and this family has not bought it. |

**THERE ARE FOUR PLANS SINCE 2026-08-19 — Free, Standard, Plus, Premium — and Standard went in
the MIDDLE.** Everything derived from `TIERS` re-ranked itself, because the array order IS the
semantics: `TIER_RANK`, `tierMeets`, `tiersIncludedIn` and `planAddsBetween` all read it. Two
things did not and had to be edited in the same commit — `families_tier_check` in the database
(`20260819000009`), and `inheritsFrom` on the card above the new one in `PLANS[]`. Nothing else,
which is the property to preserve when a fifth arrives.

What moved, and it is a restructure rather than an addition: the family tree, the whole
dues-and-donations ledger (six routes), the permission-template editor and the planning half of
Gatherings all went UP from Free to Standard, and profile pictures came DOWN from Plus. That was
admissible on one ground, and it is a fact rather than an argument — **no family is using this
product yet**, so there is nobody to grandfather. `20260819000009`'s header is where that is
recorded, along with what a restructure of this shape would owe if it happened after billing
exists.

Answering both with one screen was the obvious shortcut and is wrong in both directions:
telling a paying family that a shipped feature is "coming soon" is a lie, and telling a
free family to wait for something they could have this afternoon is a sale nobody made.

## COMING SOON WITHHOLDS A PAGE. IT DOES NOT WITHHOLD AN ACTION

`status: 'future'` is read by `proxy.ts`, at the edge, and all it does is refuse a **route**.
The server actions behind that route keep their URLs and stay callable by anyone signed in, for
exactly as long as the feature is "not shipped".

This is not a hypothetical. `/admin/chapters` sat behind `'future'` for months, and when it was
relit on 2026-08-18 its action module turned out to predate §3, §4 and the permission model —
every one of these had been a live endpoint the whole time:

* `deleteRegion` and `deleteChapter` had **no `family_code` conjunct at all**. `.eq('id', id)`
  was the entire predicate, on the service-role client, so any signed-in user could delete
  another family's regions and chapters by id.
* `getRegions` and `getChapters` demanded a session and nothing else — no permission check.
* `createChapter` wrote a client-supplied `region_id` onto a row with no `belongsToFamily` (§4).
* `createCustomRole` took `MAX(sort_order)` across **every family in the product**.
* `deleteCustomRole` had no family conjunct either, and four board-position actions were keyed
  on the wrong resource.

**AND IT HAPPENED AGAIN THE NEXT DAY, on `/admin/boardpositions`,** which is the reason this
section is not written as one bad afternoon. That route was relit on 2026-08-19 and its
endpoints were worse than the chapters ones, in a different file — `app/actions/admin/users.ts`,
which nobody had thought of as part of that feature:

* `assignRole` wrote **four** client-supplied ids (`targetUserId`, `roleId`, `chapterId`,
  `regionId`) onto a `user_roles` row carrying the caller's own `family_code`. Every policy was
  satisfied; the row pointed wherever the caller said. §4 exactly — and the `roleId` half is how
  one family assigned another family's board position.
* `revokeRoleByAssignmentId` was `.delete().eq('id', assignmentId)` on the service-role client
  with **no family conjunct at all** — `deleteRegion`'s hole in a second costume, one day later.
* `getFamilyMembersWithRoles`, `getAllRoles` and `getFamilyMemberRoles` demanded a session and
  nothing else. The first publishes the whole roster including `primary_email`.
* All four shared a helper testing `can(…, 'admin/boardpositions', 'edit')`, which scope `'own'`
  satisfies — and `updateUserProfile` used the same helper, so a family that let somebody curate
  its board positions thereby let them rewrite any member's profile.
* `family_roles`' SELECT policy was `USING (true)` — no family conjunct — so anybody holding
  that key in their own family read **every** family's board positions off PostgREST. The sweep
  did not do that; `20260604000000` wrote it and nothing revisited it.
* **None of the four write endpoints had a caller.** There was no UI in the product that gave
  anybody a board position. So they were live HTTP endpoints with holes in them, kept warm for a
  screen that did not exist.

**So a roadmap feature's actions owe the same §1–§5 review as a shipped one**, and the review has
to happen when the code is WRITTEN rather than when the flag flips. Gating the route is a product
decision; it is not a security boundary, and it buys nothing at all for the endpoints underneath.

Two corollaries for reviewing, and the second is the one both of these afternoons cost.
`grep "status: 'future'"` in `lib/features.ts` is a list of action modules nobody has exercised
recently — `/admin/elections`, `/admin/reports` and the rest. And **the module list is not the
feature list**: `grep` for the resource KEY as well, because half of Board Positions' surface
lived in a file named after a different screen.

**Every `FEATURES` entry states a `tier`, and the field has no default.** A new feature
has to decide, because the failure mode of forgetting is invisible and expensive: it
ships to every family on every plan and nothing anywhere says so. That is exactly how
RSVPs, day-of check-in and profile pictures came to be sold as Plus while shipping free
to everybody — three separate special cases in FutureFeature.md §4, because there was no
field to leave blank.

Four things about the mechanism are load-bearing.

* **The two gates live in different places, and that is not arbitrary.** `status` is a
  static fact about the build, so the edge gate decides it with no session and no query.
  `tier` is a fact about the FAMILY, so it needs a database round trip and is decided in
  the page guard, where a trip is already being made. **`proxy.ts` deliberately knows
  nothing about tiers** — do not add a families lookup to it.
* **It is folded into `requireView`, not bolted beside it.** A second line every page must
  also remember is a line three pages will not have. A page written next year is
  tier-gated without its author knowing any of this exists.
* **It withholds SCREENS, never rows.** No RLS policy consults `families.tier` and none
  may start to: a family that lapses to Free keeps every record it ever entered, and
  loses only the pages that read them. That is why there is no `auth_family_tier()` to
  match `auth_family_code()`, and why the server actions behind a paid page are
  deliberately *not* tier-checked — the first time a family downgraded, one would start
  answering "Not authorized" for their own history.

  **A READ ACTION MAY NARROW ON THE PLAN. IT MAY NEVER REFUSE ON ONE.** The exception to the
  sentence above, and the line is sharp enough to state as a test: does the tier change which
  COLUMNS come back, or does it change WHETHER ANYTHING comes back?

  | | |
  |---|---|
  | narrowing — allowed | `getResources()` tier-filters the permission grid; `getAdminGatherings` and `getGatheringDetail` answer `budget: null` for a caller whose plan excludes the money band. Every row still returns. |
  | refusing — forbidden | an action whose whole return value is the withheld thing, answering `[]`. That is not a screen band; it is a lie about the family's own records. |

  Learned by doing it: a tier check went into `getGatheringFundOptions` on 2026-08-19 on §5's
  "gate the fetch" reflex, and `npm run test:rls` refused it on the first run — **through the
  POSITIVE CONTROL, not the attack.** ALPHA's own administrator, entitled to the call, got `[]`
  because the fixture's families are on the default plan. That is §7's argument for the control
  half in one line: the attack passed, because a function that answers nothing to everybody is
  perfectly isolated.

  Where the withheld thing IS the whole answer, the tier belongs at the PAGE, which skips the
  call — so the fetch never happens and §5 is discharged without the action having to lie.
  `/accounting/transactions` puts its Plus ledger's tier there; `/admin/gatherings` and
  `/admin/gatherings/[id]` put the fund picker's there.
* **The browser can never set it; one server action can.** A tier is a billing fact.
  `families_guard_tier` (`20260813000003`) refuses any change made by the `authenticated`
  role — the same shape as `people_guard_permission_template` and
  `families_guard_family_code`, and for the same reason: `families` has an UPDATE policy
  so an administrator can rename their family, and a policy has no opinion about which
  column changed. That guard is what stops `renameFamily`, which writes through the user
  client, from ever carrying a tier along with a name.

  Since 2026-08-13 `setFamilyTier` (`app/actions/admin/family.ts`) moves it deliberately,
  through the **service role**, gated on `admin/family:edit` at scope `'any'`; the Plan
  panel at the top of `/admin/family` offers every one of them. **It is scaffolding, not billing** —
  nothing is charged, and the panel says so rather than dressing itself as a checkout.
  Keep the boundary where the guard draws it: around the ROLE the browser speaks as, never
  around the column, so a new write to `families` cannot become a self-upgrade by accident.

* **Plan copy lives in the product, not on `/pricing`.** `lib/plans.ts` carries what each
  tier includes for the two signed-in surfaces that ask — the Plan panel and `/upgrade`.
  Neither links to `/pricing` any more: that page is Home, and sending a member there to
  read what their family already has drops them into an advertisement with a "Create Your
  Free Account" button on it. The two lists are kept in step **by hand**, for the same
  reason `PLANS[]` and this registry are (see the note above `PLANS[]`).

**What it cannot express: a tier boundary running THROUGH a page.** The worked example was
`/events`, which was Free ("put the reunion on the calendar") while the RSVPs inside it were sold
as Plus — and that route was retired without the problem having been solved. The mechanism is the
one permissions use: give the capability its own sub-key with its own registry entry. Until
somebody does, a page's tier governs everything on it.

**FOUR SUB-KEYS DO IT TODAY, and three of the four arrived on 2026-08-19 with Standard.** This
paragraph read as a gap; it is a pattern now, and the pattern has a shape worth copying exactly:

| Sub-key | On a page that is | Carried by |
|---|---|---|
| `accounting/transactions/fund-transfers` | `/accounting/transactions`, Standard | a `FEATURES` row that is not a route |
| `gatherings/budget` | `/gatherings`, Free | a `FEATURES` row that is not a route |
| `admin/users/templates` | `/admin/users`, Free | a `FEATURES` row that is not a route |
| `admin/gathering-templates` | `/admin/gatherings`, Free | a real route that redirects into the pane |

All four cost the same three things and every one of them is easy to leave out. A `FEATURES` row
with `status: 'live'` (a `'future'` row rewrites the PARENT's paths to Coming Soon at the edge and
drops the grid switch out of `getResources()`); an `UNDOCUMENTED_OK` entry in `help-check.mjs` for
the ones that are not routes; and the PAGE anding `tierAllows()` into that pane's grant by hand,
because `requireView`/`requireTier` resolve the page's own key and cannot see a pane.

**`PLANS[]` on `/pricing` is not derived from this and must not be.** One bullet spans
several routes and several routes are sold in no bullet at all. Moving a bullet between
cards now changes more than a document: check whether a route has to move with it —
`grep "tier: '" lib/features.ts` is the whole job.

### THE TWO PLAN LISTS ARE SEPARATE COPY AND ONE SET OF CLAIMS

`PLANS[]` on `/pricing` is what a BUYER reads; `PLAN_ADDS` in `lib/plans.ts` is what a MEMBER
reads on `/admin/settings` and `/upgrade`. **Neither may be derived from the other** — the words
a buyer needs are not the words a member needs, and both files argue it at length.

For a long time that was the end of it, and both files said so: kept in step by hand, no gate
possible. **They drifted twice** — a Premium bullet went missing in-product, so a family paying
for Premium was never told inside the product that the address comes with the website; and a
false detail survived on both after `/features` had corrected it.

The sentence "there cannot be a gate" was conflating two claims, and separating them is the
reusable part:

| | |
|---|---|
| the WORDS | genuinely uncheckable, and different on purpose |
| WHICH THINGS ARE SOLD | one set per tier, and exactly what drifted both times |

So every bullet in both lists carries **`claim: '<tier>/<slug>'`**, never rendered, and
`npm run marketing:check` asserts the sets match per tier, that neither list says one thing
twice, and that a claim's prefix names the card or key it sits under — so a bullet re-priced in
one file only is a finding rather than two clean-looking set differences. The field is REQUIRED
rather than optional, because an optional field is omitted by exactly the edit this catches, and
`npm run typecheck` is then the first thing to refuse a bullet with no id.

**Adding a bullet is still two edits in one commit.** The gate does not write the member-facing
wording for you; it refuses to let you forget that it is owed. And whether a claim should exist
at all, whether it is true, and which tier it belongs in are untouched by any of this —
FutureFeature.md is where those live.

**A TIER TAG THAT SITS BESIDE A ROUTE *IS* DERIVED, AND MUST BE.** The distinction is the one
above, one level down: a BULLET is prose about benefits and corresponds to nothing, while a
tag on a card that already names a route is a second copy of this registry. `/features`'s
`ALSO` grid carried a hand-typed `'Free' | 'Plus'` next to a `route` for months and went on
printing it while Standard was inserted underneath — nothing in the tree could notice. It reads
`getFeature(route).tier` through `TIER_LABEL` now, and the hand-set field is admissible only for
an item with no route at all.

**AND A PRICE IN PROSE IS STILL A PRICE.** `TIER_PRICE` in `lib/plans.ts` is the one place any
figure is written down — the cards, the FAQ, the plan panel, the upgrade screen and the one
sentence on `/features` all read it. Typing "$5 a month" into a paragraph is how two pages come
to disagree, and the paragraph is the copy nobody thinks to check.

**THERE IS ONE RATE PER TIER, MONTHLY.** An annual price at ten months for twelve existed until
2026-08-19 and both it and the discount were withdrawn. The "two months free" sentence on three
surfaces vanished on its own, because it was DERIVED from the two figures rather than typed
beside them — which is the whole argument for deriving a claim about a number, demonstrated. Do
not put a yearly figure back by multiplying: it commits the product to an annual plan with no
billing, no terms and no answer for a family that downgrades in March.

# A FEATURE THAT RECORDS SOMETHING OWES A REPORT ON IT

Reporting had five screens on 2026-08-22 and every one of them read the MONEY. Membership is
the roster; Payment History, Transactions, Dues Projections and P&L Summary are four views of
the ledger. Meanwhile the product had shipped Gatherings, Elections, Meeting Minutes and a
per-family board of offices, and **nothing anywhere counted any of it.** A family could not
ask how many of a reunion's tasks were done, whether an election drew a turnout worth calling
a mandate, how often the board met, or which offices were standing empty — and the data to
answer all four had been sitting in the tables for months.

That is not four oversights. It is one, made four times, because nothing said the report was
part of the feature.

## THE RULE

> **A feature that RECORDS something across the family owes a report that reads it back, in
> the same commit or in a stated follow-up.**

The test for whether a feature is in scope is one question: **does it accumulate rows that an
organizer would want counted?** A gathering accumulates tasks; an election accumulates
nominations and votes; a meeting accumulates topics and ballots; the board accumulates
assignments. Each of those is a pile of rows that answers a question nobody can answer by
scrolling a list.

Three things are NOT in scope, and stating them is what keeps the rule from becoming a tax on
every commit:

* **A feature that records ONE row per member and shows it to them.** My Profile, My Families.
  There is no aggregate; the member's own screen is the whole answer.
* **A feature that IS a list of the thing.** The Member Directory is not owed a report on
  members — `/reporting/membership` exists because counting them by region, chapter and
  membership status is a different question from listing them, and that difference is the
  test. A report that would restate its screen with a total at the bottom is not a report.
* **Configuration.** Permission templates, board position definitions, dues schedules. What is
  worth counting is what a family DID with them, which belongs to the feature that records the
  doing. `reporting/board` is the edge case and it earns its place by reporting the VACANCIES —
  the offices nobody holds, which is a fact `/admin/members/organization` cannot state because
  it lists what exists rather than what is missing.

## WHAT A REPORT COSTS, WHICH IS THE REASON THIS IS WRITTEN DOWN

`20260822000023` and the four screens it registers are the worked example. Every item below is
a thing that was easy to leave out:

| | |
|---|---|
| a route | `/reporting/<subject>`, and §1 makes the key `reporting/<subject>` |
| a `FEATURES` row | with a `tier`, which has no default and must be decided |
| a `permission_resources` row | `view` ONLY — nothing on a report writes anything |
| a `resource_visibility` backfill | plus the **Administrators grant**, or it is a screen nobody can open |
| `NO_OWNER_KEYS` | there is no "own" version of a family-wide count |
| a rail item | `viewableResources()` cannot conjure one; see the Sidebar |
| a help chapter | `help:check` fails the build without one |
| an RLS case | §7, and the control half is what stops it rotting |
| a pure module and its test | §7b — the roll-up is arithmetic and belongs where `npm test` can reach it |

## AND FIVE RULES ABOUT WHAT A REPORT MAY SAY

These came out of building the four and each one was a decision that could plausibly have gone
the other way.

* **`canAny`, NEVER `can`, and the page checks it TWICE.** `requireView` resolves with `can()`,
  which is TRUE for scope `'own'`, and there is no own version of a family-wide count. Without
  a second `canAny` the page opens, the action answers `null`, and the reader gets an empty
  screen instead of a 404 — unable to tell whether their family has nothing or whether they
  were refused. `/reporting/dues-projections` set the pattern.

* **A `null` is a refusal; an empty report is a fact.** They are different sentences and only
  one of them is about the reader. Every one of these actions returns `null` when the caller
  may not have it and a populated shape with zero rows when the family simply has nothing yet.

* **A REFUSED READ MUST REFUSE THE WHOLE REPORT (§8).** This is the sharpest of the five,
  because the failure is a WRONG number rather than a missing one. A refused `gathering_tasks`
  read leaves a full list of gatherings with every task count at zero — a report claiming the
  family is completely up to date on work it has not started. A refused `user_roles` read
  reports every office as VACANT, which is that report's headline finding invented out of an
  outage. `const { data }` discards the error; read it.

* **COUNT WHAT THE DATA SAYS AND NEVER ESTIMATE THE REST.** `/reporting/meetings` is the case:
  there is no check-in anywhere in this product, so it reports who was ASKED and who VOTED and
  refuses to call either attendance. Averaging the two into an "attendance rate" would be a
  figure no row in the database supports — and it is exactly the sort of number that gets
  quoted in a meeting a year later. Where a fact is not recorded, the report says so on the
  screen.

* **DISTINCT ACROSS THE REPORT, not the sum of the rows.** Somebody helping with two gatherings
  is one helper; somebody voting for three offices is one voter. Summing per-row figures
  reports a family as having more helpers than it has members, and 300% turnout — the kind of
  figure that gets a whole report ignored.

* **A TONE IS A FINDING.** `ReportStats` takes one, and the only three are `plain`, `affirm`
  and `withheld`. There is no `destructive` and there must not be: nothing on a report is an
  error. An overdue task and a vacant office are `--brand-withheld` — something the family has
  not done yet — which is the same reading the dues ladder takes of an unpaid installment.
  `--destructive` is for a failure, and `form-message.tsx` owns reporting one.

## THE ADMIN CLIENT, AND WHY EVERY ONE OF THESE USES IT

Sixteen queries across the four, every one with a hand-written `.eq('family_code', …)` (§3).
It is not laziness about RLS: **a report counts things the reader is not necessarily entitled
to open one by one.** A member who may read the Gatherings report but holds no
`admin/gatherings` grant would, through their own client, receive a subset of the family's
tasks and a total that silently described it — which is worse than a refusal, because it is a
wrong number rather than a missing one.

The cost is that §3 is discharged by hand and nothing but the RLS suite watches it. All four
were mutation-checked: widening every `family_code` conjunct to match any family turns all
four attack halves red and leaves all four controls green.

**Two tables have no `family_code` at all** — `election_votes` and `election_nominations`,
which are scoped through `election_id` and nothing else. They are filtered by
`.in('election_id', <ids from a family-scoped read>)`, which is the TRANSITIVE verdict
`audit:family-scope` recognises, and it is why `getElectionsReport` is two phases rather than
one `Promise.all`. Say so in a case rather than letting a reader assume there is a conjunct
there to protect.

# The product explains itself, and the explanation is part of the screen

`/help` is the in-product manual, covering every live screen in the Dashboard. The whole of
it is `lib/help/content.ts`, and the pages that draw it are `app/(protected)/help/`.

**No count is written down here on purpose.** This paragraph said "twenty chapters over eight
parts" while the manual had grown to twenty-four, which is the same staleness the rule below
is about, one level up. `npm run help:check` prints the parts, chapters and sections it walked
on every run, so the number is always derived and never a copy.

**It names controls verbatim** — "press **New DM**", "the **Group** column", "**Disable
member** from the row menu" — because that is the only kind of instruction worth reading.
It is also why it goes stale exactly the way a screenshot does, and why this section
exists rather than a line in a README.

**THE RULE: a change to a screen owes an edit to the chapter that documents it, in the
same commit.** Adding, removing or renaming a control, a tab, a pane, a form field, a
button caption or a whole route is a change to the manual as much as to the component.
Shipping the screen and leaving the chapter is not "documentation debt" — it is a page in
the product that now tells members something false, in a section they were sent to
*because* they were already confused.

**Finding the chapter is one grep.** Every chapter that documents one screen carries that
screen's `route`, which is what the availability labels resolve against and what makes the
manual searchable by the thing you just changed:

```bash
grep "route: '/gatherings'" lib/help/content.ts  # everything the manual claims about Gatherings
```

A change with no route to grep — the shell, the idle sign-out, the permission model — is
in `finding-your-way-around`, `who-can-do-what` or `troubleshooting`. **A new screen owes a
new chapter**, which is the whole job: add it to the right `HELP_PARTS` entry and it
appears in the contents, in the neighbour links and in `generateMetadata` by existing.

Four things about it that are decisions, not accidents:

* **The manual is DATA, and it stays pure.** No React, no `server-only`, no database in
  `lib/help/content.ts` — three surfaces read one chapter (the contents page, the chapter
  page, and `generateMetadata`, which needs the summary as a plain sentence before anything
  renders), and it is what lets `[slug]/page.tsx` resolve a slug and 404 on a bad one before
  deciding to render. Written as JSX the summary becomes a copy and the contents page
  becomes a hand-maintained list.

* **Two inline forms, and no markdown dependency.** `**bold**` for a control on screen and
  `[label](/route)` for a link — that is the whole of `lib/help/inline.ts`. Anything else
  renders as the literal characters, which is the safe direction, because nothing here can
  emit HTML. Do not reach for a markdown renderer: it is a dependency, a sanitiser, and a
  styling override for every element it can emit, to buy two forms that already exist.

* **Never restate a fact the product already derives.** Which plan a feature belongs to
  comes from `lib/features.ts` through `lib/help/availability.ts`, and what each plan
  includes is `lib/plans.ts`. A chapter that types "this is a Plus feature" into its prose
  is a fourth copy of the tier table and will be wrong the first time one moves. Say what
  the screen DOES; let the label say whether the reader can open it.

* **`help` has no `permission_resources` row, deliberately — do not add one.** It is the
  §6 exception, the class of `/dashboard` and the Personal pages whose rows
  `20260806000006` deleted: the page reads no family data at all, and the one screen that
  explains permissions must not be the screen a misconfigured permission can hide. It is
  also in `PENDING_RESOURCES`, so an applicant can read it while they wait — that list is
  the sidebar's copy of what `requireViewOrPending()` admits, so change one and change the
  other.

**`npm run help:check` is the enforcement, and it is a step in `verify.yml`.** It asserts
six things, all of them derived from `lib/help/content.ts` with no database and no network:
every internal `[link](/route)` resolves — a `/help/<slug>` to a real chapter, a `#anchor` to
a real section id *in that chapter*, anything else to a route `getFeature()` knows; every
chapter's `route` is a `FEATURES` href, exactly once; no duplicate chapter slug, part id, or
section id within a chapter; no inline markup in the five fields the pages interpolate raw;
**every live screen has a chapter**, or an entry in the script's `UNDOCUMENTED_OK` giving
the reason it does not; and **every `<HelpLink slug="…" section="…">` placed in the app
resolves to a real chapter and section**. The fifth is what catches the actual regression — a
screen shipping undocumented — and there are three allowances today, each printed on every run
so the gap stays visible rather than blending into the green. The sixth is the *only*
enforcement those two props have: `HelpLink` deliberately does not import `content.ts`,
because most of its call sites are `'use client'` and the import would bundle the whole
manual — so a renamed section id otherwise leaves a link that loads the right chapter and
silently does not scroll.

Three things about it are worth knowing before editing either file:

* **It walks the DATA, not the source.** `content.ts`'s own doc comment contains
  `[a link](/route)` as an example, so a regex over the file text reports a broken link on day
  one. Importing the module and using the real `parseInline` is what makes 47 checked links
  and 48 textual occurrences the right answer.
* **Section ids are unique per CHAPTER and must not be asserted globally.** The anchor is
  `/help/<slug>#<id>`, and `what-it-is` legitimately appears in four chapters. A global rule
  fails eight times immediately, and a global anchor *set* would pass
  `/help/summary#reversals`, which does not exist.
* **A chapter route is checked by exact href membership, never `getFeature()`** — that
  function longest-prefix-matches, so `/admin/nonexistent` resolves to the `/admin` catch-all
  and would pass.

It cannot check the thing the rule is actually about: whether the prose still describes the
screen. Nothing can, the script says so on every clean run, and that is why the rule above is
still addressed to a person. `lib/help/inline.test.ts` is enforced too, under `npm test`,
which has been a `verify.yml` step since 2026-08-17 — before that it ran on laptops only, and
this paragraph claimed otherwise. Both were checked by mutation the way §7 and §7b require;
the mutations for the checker are listed in its header.

## Two ways into the manual, and only one of them is automatic

`components/help/ContextHelpLink.tsx` is a question mark in the top bar that resolves
`usePathname()` against `HELP_ROUTE_INDEX` — **derived** from the chapters
(`lib/help/routes.ts`), so it cannot name a chapter that is not there, and it renders `null`
when no chapter covers the path. That last property is what makes it safe to mount on every
screen: the affordance degrades to nothing rather than to a broken link.

It is a client component **precisely because the shell does not re-render on a client-side
navigation** (see "The shell is built once"). A server-resolved answer would freeze at
whichever page happened to load first. The index is passed down as a **prop** rather than
imported, because importing `lib/help/routes.ts` from a `'use client'` file drags all ~79KB of
`content.ts` into the browser bundle — which is also why `lib/help/route-match.ts` has no
imports at all and deliberately re-states `getFeature()`'s longest-prefix rule instead of
importing it.

`components/help/HelpLink.tsx` is placed **by hand, and sparingly** — seven today, each beside
one control where a member can be confidently wrong. An icon on everything is an icon on
nothing, which is the same argument `HelpAvailabilityBadge` already makes about badges. Adding
one is a judgement rather than a default, and the test is whether there is a paragraph
somebody standing at that control needs and would not go looking for. Its `slug`/`section`
props are plain strings that nothing but `help:check` can validate — see above.

# Colours live in one place

`app/globals.css` is **the only file in the app that may contain a colour literal.**
Not "the preferred place" — the only one. A new page or component that needs a colour
uses a token that already exists, or adds one here first and then uses it.

**The brand ramp has two layers, and you consume the second one.** This is the part
worth understanding before touching a colour.

* **Layer 1 — the palette.** `--genorra-*` in `:root`: Heritage burgundy, Warmth
  terracotta, Growth olive, Legacy gold, Nurturing sand, Light, Ink. Named exactly as
  the brand guide names them, identical in both themes, and taken verbatim from
  `design/home/v1_1/Web/genorra-colors.css`. **Do not use these in a component.** They answer
  "what colour is GENORRA?", not "what colour is this button?".

* **Layer 2 — the roles.** `--brand-*`, surfaced as Tailwind utilities through
  `@theme inline`. Each names a *job*, and this is the only layer that changes between
  light and dark.

  | Token | Utility | What it is for |
  |---|---|---|
  | `--brand-primary` | `bg-brand-primary`, `border-brand-primary` | Filled chips, buttons, active rail items |
  | `--brand-on-primary` | `text-brand-on-primary` | Text/icons **on** primary |
  | `--brand-ink` | `text-brand-ink` | Strong brand text, `h1`/`h2` |
  | `--brand-soft` | `bg-brand-soft` | Resting pills, hover wells |
  | `--brand-on-soft` | `text-brand-on-soft` | Text **on** soft |
  | `--brand-bar` | `bg-brand-bar` | Header bars |
  | `--brand-hero` | `bg-brand-hero` | The banner band behind the lockup |
  | `--brand-accent` | `text-brand-accent` | Links, `h3`–`h6`, unread markers |
  | `--brand-affirm` / `--brand-on-affirm` | `bg-brand-affirm`, `text-brand-on-affirm` | Affirmative actions: create, record, pay |
  | `--brand-withheld` | `text-brand-withheld` | A capability being **withheld** — foreground only |
  | `--brand-warm` / `--brand-on-warm` | `bg-brand-warm`, `text-brand-on-warm` | Filled Warmth chip — the fourth accent surface |
  | `--brand-legacy` | `bg-brand-legacy` | Premium gold accent — **surface only** |

  **`--brand-withheld` is the counterpart to affirm, and it is not `--destructive`.** A
  capability going away — the pages a family stops being able to open when it downgrades —
  is not a deletion, not a failure and not an error, and affirm had no opposite, so the
  only thing to reach for was the one non-brand hue in the file: shadcn's `#e7000b`. It
  reads as alarm because it *is* alarm, which is right for deleting a chapter and wrong for
  a reversible billing change that removes no rows. This is Warmth again rather than a new
  hue — the same two tones `--brand-warm` fills a chip with, consumed as a foreground and
  as a tint under one, which is why it has no `on-` partner. `--destructive` still owns
  errors and deletions; reporting a failure is
  `components/ui/form-message.tsx`'s job, not this token's.

  **`--brand-warm` is a surface; `--brand-accent` is a foreground. They are both
  Warmth and they are not interchangeable.** The dashboard's At a Glance grid needed a
  fourth filled accent beside primary, legacy and affirm, and reaching for
  `--brand-accent` would have worked in light and broken in dark — that token resolves
  to Legacy **gold** there, so two of the four tiles would have come out gold the
  moment the theme flipped. Filling a chip is a job for a surface role with an `on-`
  partner, which is what this pair is. Text and links stay on `--brand-accent`.

  **Why roles and not hues.** A token called `--brand-burgundy` would have to hold sand
  in dark mode to stay readable, and then its name is a lie. `--brand-ink` is burgundy
  on a cream page and sand on a dark one, and both are correct, because the role is
  "strong brand text". This split is the whole reason dark mode was possible without
  renaming anything twice.

  **The pairs are load-bearing.** Every surface role has an `on-` partner guaranteed to
  meet WCAG AA against it in *both* themes. Never put a foreground from one pair on the
  surface of another — `text-brand-on-affirm` on `bg-brand-primary` is not a checked
  combination and there is no reason to expect it to pass.

  **AND AN `on-` TOKEN ON NO SURFACE AT ALL IS THE WORST VERSION OF THAT, BECAUSE IT IS
  INVISIBLE RATHER THAN MERELY UNCHECKED.** Measured on the calendar: the "Nominations open"
  chip shipped as `bg-transparent text-brand-on-warm`, and `--brand-on-warm` is cream in light
  mode and near-black ink in dark — so against the page ground it was cream-on-cream one way
  and ink-on-near-black the other. The chip rendered, took up space, was a link, and had no
  readable text in either theme. Reported as "you cannot see the text for nominations". An
  unchecked pairing degrades; an `on-` token with its surface removed disappears.

  **When the Warmth is the TEXT, reach for `--brand-warm` itself.** It and
  `--brand-withheld` resolve to the same tone in both themes, so the figures measured on the
  withheld token are this one's too, and `border-brand-warm bg-brand-warm/10 text-brand-warm`
  is the outline form of the filled chip. `globals.css` records that beside the token, which
  is where it belongs — it is a fact about two tokens rather than about one component.

  **`--brand-legacy` has no `on-` partner, deliberately.** Gold is 2.30 against white
  and 1.65 against sand: it can never carry text in light mode, and a partner token
  would invite exactly that. Use it as a surface with dark text on it (ink on gold is
  6.14), or as a non-text accent — a rule, a dot, a border. The one place it *is* a
  foreground is dark mode, where `--brand-accent` resolves to it against a near-black
  ground at 7.91.

* **The shadcn semantic ramp** — `--background`, `--card`, `--muted`, `--border`,
  `--destructive` and the rest. This dresses generic UI. It is no longer neutral grey:
  its values are warm, drawn from the palette, so a `bg-muted` sits in the same family
  as everything around it.

**Reach for the semantic token first.** `bg-card`, `text-muted-foreground`,
`border-border` and `text-destructive` are right far more often than a brand colour is.
Use a `--brand-*` role when the thing you are colouring is specifically GENORRA — a
filled Heritage chip, a link, the "record payment" button — not merely when you want
*a* dark red.

## Never write a hex outside globals.css

`bg-[#0f2540]` is the failure mode this rule exists to prevent, and it is not
hypothetical: it was in 33 files before 2026-08-10, and the sweep that removed it
turned up **two** pale blues, `#e6ecfa` and `#e6ecf1`, differing by one channel and
used interchangeably as "text on navy" — a drift nobody chose and nobody could see.

That drift is now gone. The Premium Family rebrand collapsed it: both roles resolve to
Nurturing sand, because the question the old pair could not answer — *is this "text on
the primary fill" or "the header bar"?* — is exactly what `--brand-on-primary` and
`--brand-bar` now answer separately. The same rebrand found the same bug a second time
in the components: "text on navy" was written `text-brand-tint` in twelve places and
`text-brand-mist` in three, for no reason anyone had chosen.

That is the cost the rule buys off. An arbitrary value in a `className` is invisible to
every search that matters — you cannot count the uses, cannot rename it, and cannot
change the brand without a 33-file diff that is impossible to review for completeness.
A token you can grep, which is why the rebrand itself was a scripted sweep that finished
with `git grep` returning nothing.

The same goes for `style={{ color: … }}` and any SVG `fill`/`stroke`. There are none in
the tree today. If a chart or an illustration ever genuinely needs a colour in JS, read
it from the custom property (`var(--brand-accent)`) rather than restating the hex.

**There are exactly four sanctioned exceptions, and they all earn it the same way: the
thing consuming the colour is not a stylesheet of ours, so a custom property cannot
resolve.**

This said "two" until 2026-08-12, and it was wrong by two — `app/opengraph-image.tsx` and
`lib/email/layout.ts` had been carrying literals for months, both for the same good reason
as the pair that *was* listed. An exception list that does not match the tree teaches
whoever reads it next that the rule is approximate, which is the one thing this rule
cannot afford. If you add a fifth, add it here in the same commit.

* **`BRAND_THEME_COLOR` in `lib/brand.ts`.** Those two hexes are consumed by the
  *browser* as document metadata — `viewport.themeColor` and the web manifest paint the
  mobile address bar. Keep them in step with `--genorra-heritage` and
  `--genorra-ground-dark` by hand.
* **`supabase/templates/*.html`,** the auth emails. These render in somebody else's mail
  client, where nothing of ours is loaded and even a `<style>` block is unreliable —
  Gmail strips it for non-Gmail accounts in its app. Every colour that matters is
  therefore inline, and inline means literal. The hex→token mapping and the reasoning
  are in [supabase/templates/README.md](supabase/templates/README.md).
* **`lib/email/layout.ts`,** the chrome those templates and the app's own mail share.
  Same argument as the templates it wraps, and its ~35 hexes are the reason that argument
  exists — this file is where the inline styling is actually assembled.
* **`app/opengraph-image.tsx`.** Rendered by Satori into a PNG at build time, not by a
  browser. There is no cascade and no `:root` for a custom property to resolve against, so
  the three brand colours it draws with have to be values. Keep them in step with
  `--genorra-heritage-deep`, `--genorra-heritage` and `--genorra-legacy` by hand.

Nothing else earns this. In particular, "it's just one component" and "Tailwind won't
let me" do not — the second is a token that needs adding to `globals.css` first.

Two things follow for the email templates specifically, because they are unlike every
other file here. **The template is the payload:** every byte ships to every recipient and
is one "view source" away, which is why the rationale lives in the README and the files
keep a short pointer comment. And **editing a template reaches production on the next
merge to `master`, and by no other route** — `config.toml` wires up the local stack, while
hosted keeps its own copy of every body until CI replaces it. This said "does nothing to
production until it is pushed" until 2026-08-19, when the push became a step in `migrate.yml`;
the paragraph below carries what that changes. Since 2026-08-12 that push is `npm run email:push`
([scripts/auth-templates.mjs](scripts/auth-templates.mjs)), which reads the same
`[auth.email.template.*]` table and sends only the ten mailer fields; `npm run
email:check` reports drift and exits non-zero. It is deliberately **not** `supabase
config push`, which would send `site_url` along with the copy edit. Pushing still proves
only that the bytes arrived — send yourself a real signup before calling it done.

**And since 2026-08-19 the push happens from CI on merge to `master`, not from a laptop** —
a step named "Auth email templates match the repo" at the end of `migrate.yml`'s one job,
using the `SUPABASE_ACCESS_TOKEN` that job already holds. Three consequences worth knowing
before touching a template:

* **The repo is now unconditionally authoritative.** A template edited in the Supabase
  dashboard is reverted on the next merge that finds drift, and one drifted template rewrites
  all ten fields rather than only itself. `npm run email:pull` is the only route back.
* **The laptop commands keep their jobs**, which are asking rather than writing:
  `email:check` for drift and `email:pull` to recover a dashboard edit. Neither is in
  `verify.yml` and neither may be — that workflow holds no secret at all, and this token is
  account-wide, broader than the database password the argument beside `environment:
  production` is written about.
* **A green step is still not a rendered email.** It reports that the bytes arrived. The GO
  LIVE item that survives in TODO.md is the human half: trigger a real signup and a real
  reauthentication and look at them on a phone.

## Dark mode is real, and the brand has a dark treatment

There is a `.dark` class on `<html>`, put there before first paint by the inline boot
script in `app/layout.tsx` (`THEME_BOOT_SCRIPT` in `lib/theme.ts`), and cycled by
`components/layout/ThemeToggle.tsx` between Light, Dark and System.

**Light is the default, not System** — `DEFAULT_THEME` in `lib/theme.ts`. GENORRA's
identity is burgundy on cream, so someone meeting the product for the first time sees it
as designed rather than having their OS choose. System remains a choice; it is simply not
the fallback. A stored preference of any kind still wins on every load.

If you change that constant, change it **once**: the boot script and `readPreference()`
in `ThemeToggle` both derive from it, and if they ever disagree the page paints one theme
while the button claims the other — visible only on a hard refresh, which is the worst
kind of bug to hunt.

Five things to know before changing any of it:

* **The class, not `data-theme`.** The Next guide on preventing flash uses a
  `data-theme` attribute; this app cannot, because `globals.css` declares
  `@custom-variant dark (&:is(.dark *))` and the `dark:` utilities already in the
  components resolve against the class. Switching would light up the CSS variables and
  silently leave every `dark:` utility dead.

* **The script must stay inline and in `<head>`.** Moved to the body or loaded as a
  file, it runs after first paint and the white flash it exists to prevent comes back.
  `useEffect` cannot do this job for the same reason.

* **`ThemeToggle` uses `useSyncExternalStore`, not `useState`.** The theme lives outside
  React — in `localStorage`, in the OS, and on an element the boot script already
  touched. Reading `localStorage` during render is a hydration mismatch; correcting it
  from an effect is a cascading render that React Compiler rejects as an error. The
  snapshot deliberately encodes *preference and resolved appearance* in one string, so
  that an OS flip while the preference is `system` still repaints.

* **Dark mode takes its cue from the kit's own dark app icon: gold on deep burgundy.**
  That is why `--brand-accent` becomes Legacy gold there rather than a lightened
  terracotta. Grounds are warm near-blacks mixed toward Ink, never neutral grey — grey
  under burgundy reads as a bruise.

**Every pairing in both themes was checked against WCAG AA before it shipped.** If you
add or retune a role, check it the same way rather than by eye; the ratios that matter
are recorded in the comments beside the tokens.

**One trap to know about.** `globals.css` carries an unscoped
`a { color: var(--brand-accent) }` in its base layer, so every anchor takes the accent
unless a component says otherwise. That is why `MainRail`, `Sidebar`, `RoomListItem` and
`AdminAccountShell` all set an explicit text colour on both branches of their
active/inactive ternary — those are not decoration, and removing one recolours that
rail. Each carries a comment saying so.

# The product name lives in one place

`lib/brand.ts` is the counterpart to the colour tokens: colours are centralised in
`app/globals.css` because CSS consumes them, and the name is centralised here because
TypeScript does. **Never type the product name as a literal in a component.**

```tsx
import { APP_NAME, APP_BANNER_ALT, BRAND_LOCKUP_DARK_SRC } from '@/lib/brand'

<span className="gn-wordmark text-xl text-brand-ink">{APP_NAME}</span>
<Image src={BRAND_LOCKUP_DARK_SRC} alt={APP_BANNER_ALT} … />
```

`APP_NAME`, `APP_TAGLINE`, `APP_LEAD`, `APP_VALUES`, `APP_PROMISE`, `APP_DESCRIPTION`,
`APP_BANNER_ALT`, `APP_LOGO_ALT`, `BRAND_MARK_SRC`, `BRAND_LOCKUP_DARK_SRC` and
`BRAND_THEME_COLOR` are the whole surface. In a template string use `${APP_NAME}`, not a
literal — `lib/features.ts` and `app/(auth)/login/page.tsx` are the worked examples.

**`APP_TAGLINE` and `APP_LEAD` are not interchangeable.** The tagline is the acronym
expansion and belongs beside the mark; the lead line — "Where every generation belongs."
— is what leads a page. `APP_VALUES` is the three words as *data*, and `APP_PROMISE`
joins them for running text; a surface that lists the values maps over the array rather
than retyping them, so adding a fourth is one edit.

## Artwork paths, and the versioned kits

**`public/` holds exactly ONE thing, and `design/` holds the kits.** This said "three"
until 2026-08-20, and the two that left are the reason the sentence is worth stating as a
rule rather than as a description:

| Folder | What it is |
|---|---|
| `public/identity/` | **The only artwork the site serves at all.** Named by role, wired through `lib/brand.ts`. |
| `design/home/` | The versioned brand kits, exactly as delivered — `v1_1/` current, `v1_0/` superseded. |
| `design/dashboard/v1_0/` | The Dashboard "Golden Master" handoff kit, exactly as delivered. |

**EVERYTHING UNDER `public/` IS SERVED, WHICH IS WHAT MADE THE OLD ARRANGEMENT A CLAIM
RATHER THAN A FILING DECISION.** Both kits sat there, so every byte of both was fetchable
by anybody, signed in or not — no route, no gate, no referrer check. The part that
mattered was not the payload: `design/dashboard/v1_0/04_MEDIA/` holds seven photographs of
identifiable people, and nothing in the kit states a licence, names a photographer or
carries EXIF. So the product was publishing them under its own domain, indexably, with no
established right to do so. Moving them out is the whole fix, and it costs one commit
because nothing imported them.

The convention is `design/<kit>/<version>/`, and the version folder is not optional even
for a kit that arrived without one — the Dashboard kit did not and was filed as `v1_0`
anyway, so that the next drop has somewhere to go that is not a rename. The kit-bump rule
below turns entirely on being able to diff one version against the next.
[design/README.md](design/README.md) carries the rest, including what a history rewrite
would and would not undo.

Two consequences to keep, because both are easy to undo by accident. **`design/` is out of
the toolchain deliberately** — `eslint.config.mjs` ignores `design/**/*.{ts,tsx,js,jsx}`
and `tsconfig.json` excludes `design`, because the Dashboard kit ships five stub React
components and editing a handoff kit to satisfy our lint and type rules destroys the one
property that makes it useful as a reference. And **`scripts/kit-illustration.mjs` still
reads a kit directly**, which is not serving: it derives a PNG at author time. It is the
one path into `design/` that any code holds.

**Product screenshots are not brand artwork and do not go here.** They are colocated
with the component that renders them and pulled in with a **static import**, never a
`/public` URL string: `next/image` reads the intrinsic width, height and blur
placeholder from the file, and a path that names nothing fails `next build` instead of
rendering an empty box. The landing page shipped for a while with
`image: '/features/events.png'` against a `public/features/` that did not exist, and
nothing anywhere said so.

**There are none in the tree at the moment.** `components/marketing/screenshots/` held
three and all three were placeholder cards rather than captures — see the Gatherings
section above for what they were doing to Home and `/features`, and
`components/marketing/PillarVignette.tsx` for what draws those pillars now. The rule
stands for whenever a real capture arrives.

**Nor are the kits' decorative illustrations, and one of them is DERIVED rather than
copied.** `components/dashboard/illustrations/family-tree.png` — the tree beside the
figures on the Dashboard's Family Tree card — is colocated and statically imported for
the reasons above, and it is not any file the kit ships. The kit's two candidates are
both unusable: `FamilyTree_Golden_ExactPixelVector.svg` is 10,490 one-pixel `<rect>`s,
i.e. a 180×205 bitmap wearing an SVG hat at 608 KB, and `FamilyTree_Golden_DirectTrace.svg`
is a broken trace with severed branches (its own preview PNG shows them). So
`scripts/kit-illustration.mjs` takes the kit's reference bitmap, checks it pixel-for-pixel
against that rect-per-pixel SVG, and lifts the cream matte into an alpha channel so the
artwork composites onto the card's own ground in either theme.

Two things follow, and the second is the one a kit bump gets wrong:

* **`npm run art:check` is a test, not a formality.** It exits 1 when the committed PNG is
  no longer what the kit derives to, so it reads like one — and `art:build` regenerates it.
  It is deliberately **not** a step in `verify.yml`, on the same footing as `email:check`:
  it runs on `sharp`, which reaches the tree as an *optional* dependency of Next, and a
  gate that a legitimate `npm ci --omit=optional` turns red is a gate people learn to
  ignore.
* **A derived asset cannot be verified by `cmp` against the kit,** which is the whole
  procedure the kit-bump rule below relies on. `identity/` silently held the v1.0 mark for
  a round after v1.1 landed; a derived file fails the same way with nothing even to compare.
  Re-run `art:build` as part of any bump, and let `art:check` be what says you did.

**Serve from `identity/`, never from a kit folder.** Since 2026-08-20 a kit path could not
be served even if you tried — `design/` is not under `public/`, so a `src` pointing into
it 404s in development as loudly as in production, which is the right way round and is the
main thing the move bought beyond the licensing question. The two original reasons still
hold and are why the copy into `identity/` is deliberate rather than lazy:

* Kit folders are named for a design deliverable — `SVG_Masters`, `PNG_Exports` — and
  those names would end up in public URLs, where they are permanent. Worse, they are
  *version-scoped*: a URL containing `v1_1` has to be rewritten at every kit bump, and
  the one that gets missed 404s in production.
* A `public/brand/` for web assets would be the *same* directory as the kit's `Brand/`
  on Windows and macOS and a *different* one on the Linux box that serves production —
  it works locally and 404s once deployed. `identity/` collides with nothing in either
  direction. This was hit while doing the rebrand, not theorised.

**Bumping the kit is a copy, not a reference change.** Drop the new kit in as
`design/home/v1_N/`, then re-copy every file in `identity/` (and `app/favicon.ico`,
`app/icon.svg`, `app/apple-icon.png`) from it and `cmp` each one. Skipping that leaves
the site serving the *previous* kit's artwork with no error anywhere — which is exactly
what happened: `identity/` held the v1.0 mark for a full round after v1.1 landed, and
v1.1 existed precisely to correct that mark's silhouette.

**AND THE COPY IS NOT ONE-TO-ONE: THREE DIFFERENT KIT FILES DRESS THREE DIFFERENT SURFACES.**
Since 2026-08-22 the app icons (`genorra-app-{192,256,512}.png` and `app/apple-icon.png`) are
the kit's **Light** app icon — the FULL-COLOUR mark on cream — because that tile is what an
installed GENORRA shows on a home screen, and the gold-on-burgundy treatment is monochrome
there: it does not look like the brand people meet on the site, where the rail draws the
full-colour mark at 64px. Reported by a member who installed it: the icon "wasn't colorful".

**MAIL USES THE FULL-COLOUR TILE TOO, SINCE 2026-08-26, AND THE GOLD ONE IS NOW REFERENCED BY
NOTHING.** This paragraph said the gold tile was "used by the five auth templates and
`lib/email/layout.ts`" because its ground is `#6b2d3a` — the same burgundy as the email
header's band — so the tile DISAPPEARED into the band and left the gold mark on it. That was
the more elegant composition and it had one cost that outweighed it: **mail was the only
surface where GENORRA was monochrome.** The rail draws the full-colour mark at 64px, the
installed icon is the full-colour tile, and the first thing a new member ever saw from this
product was gold on burgundy — so it did not look like the product. Same complaint as the
manifest's, one surface later.

The templates and `lib/email/layout.ts` point at `genorra-app-256.png` now, on the same
burgundy band, with `border-radius:14px` so a cream tile on burgundy reads as an app-icon badge
rather than as a rendering fault. **That cream square is now deliberate** — it is precisely
what the old note warned about happening by accident, which is why it is worth saying twice.

`genorra-mail-mark-256.png` stays in `public/identity/` referenced by nothing: it is the
artwork a dark-banded design would need, and re-deriving it from the kit is a `design/` lookup
rather than a copy. **Do not repoint the manifest at it.** The rule for this folder is still
**a file per ROLE, and a role is a surface with its own constraints** — what changed is that
two roles turned out to want the same file, not that the rule stopped applying.
`supabase/templates/README.md` carries the measurements, including the two dark-mode gaps that
made the confirm button's label invisible.

The favicon is neither tile: `app/favicon.ico` and the kit's own favicons are the burgundy
mark, which is right at 16px. Do not sweep those to match either of the others.

**Asset names move between kits.** v1.0's dark-ground lockup was `Horizontal_Reversed`;
v1_1 renames it `Horizontal_Dark` and drops the old file. Both render, so pointing at
the wrong one is silent. `Dark` and `Light` in this kit name the **ground the artwork
sits on**, not the artwork's own colour: `Horizontal_Dark` carries a cream wordmark and
belongs on Heritage; `Horizontal_Light` is for pale grounds.

## The wordmark is set, not placed

`.gn-wordmark` in `globals.css` reproduces the brand board's letterspaced Cormorant caps
in CSS. Use it for the word GENORRA in a header or footer; do not place an image of the
wordmark. Text stays crisp at every size, recolours per theme, and is selectable — an
`<img>` does none of the three. The mark (`BRAND_MARK_SRC`) *is* artwork and is placed;
it is a stroked form with the heart cut out of it, so the ground shows through and the
one file works on both light and dark.

## Typography

Two faces, per `design/home/v1_0/README.txt`: **Cormorant Garamond** for display and **Inter** for
UI and body, both loaded as variable fonts in `app/layout.tsx`.

`h1`/`h2` take the serif automatically from the base layer. **`h3`–`h6` deliberately do
not** — Cormorant is a high-contrast old-style face that goes thin and hard to read below
about 20px, which is exactly the size a functional subhead runs at. The serif is for
statements; labels stay in Inter.

## Page titles are composed, not written

**A page declares only its own name.** `app/layout.tsx` sets a `title.template`, and
Next appends the product name to every child segment:

```ts
export const metadata = { title: 'Dashboard' }   // renders "Dashboard — GENORRA"
```

Three things follow from how `title.template` actually behaves:

* **Do not write the suffix yourself.** `title: 'Dashboard — GENORRA'` renders
  `Dashboard — GENORRA — GENORRA`. Twenty-seven pages carried that suffix by hand
  before 2026-08-10; the template is why they no longer do.
* **`title.default` is required alongside a template,** and it is what `/` renders,
  because a template does *not* apply to the segment that defines it.
* **A page with no `title` gets the default,** which is the bare product name. That is
  the correct fallback, not a gap to fill.

`generateMetadata` obeys the same rule — see `app/(protected)/coming-soon/page.tsx`,
which returns `` `${label} — Coming Soon` `` and lets the template finish the job.

## What is deliberately *not* in here

**Deployment hostnames.** `supabase/config.toml` carries `site_url` and
`additional_redirect_urls`, and those are DNS names that either resolve or do not.
They are not references to the product name and must never be swept along with one —
changing them to match a rename breaks sign-in and every confirmation-email link until
the deployment is actually renamed to match.

**`project_id` in `supabase/config.toml`.** It namespaces the local Docker containers.
Changing it does not rename a running stack — it orphans it and builds a new one on the
next `supabase start`.

**Applied migrations.** Comments in `supabase/migrations/*` are a record of what ran and
when. They have been swept twice — the 2026-08-10 rename, and the 2026-08-12 removal of the
`USAGE: psql "$DATABASE_URL" -f …` header from the 18 files that carried it. Do not make a
habit of it. The second sweep earned it on a narrow ground worth stating, because it is the
only ground that qualifies: the line was not a record of anything, it was an *instruction*,
it was false, and following it caused a production incident. See "How migrations reach the
hosted project". Prose that merely reads oddly today does not qualify.

# THE PRODUCT READS IN THREE LANGUAGES, AND A LITERAL IN A COMPONENT IS A BUG

English, Spanish and French. `usted` and `vous` throughout — the product addresses a
relative formally, in every language, on every surface. **No user-facing string is written
as a literal in `app/` or `components/`.** Not "preferred"; the gate below reports every one
and its ceiling is **zero**.

## FOUR BUNDLES, ONE MECHANISM, AND A KEY LIVES IN EXACTLY ONE OF THEM

| Bundle | Where | Reached by |
|---|---|---|
| `shell` | `lib/i18n/{en,es,fr}.ts` | everything in `app/` and `components/` — static import, client-reachable |
| `email` | `lib/email/strings/` | `lib/email/templates.ts` — **`server-only`**, never in a browser bundle |
| `help` | `lib/help/strings/` | the manual. `server-only`, and its ENGLISH is **derived** from `lib/help/content.ts` |
| `marketing` | `lib/marketing/strings/` | Home and the five public pages |

`marketing` is neither `server-only` nor in `catalogues.ts`, and that is deliberate: it is
kept out of the Dashboard's chunk by the IMPORT GRAPH alone. Nothing under
`app/(protected)` may import it, and `i18n:check`'s CLIENT-BUNDLE finding is what stops the
email one crossing.

**One key, one bundle.** `i18n:check` reports a DUPLICATE-KEY, because which string rendered
would then depend on which bundle a call site happened to reach for, and both would be
fingerprinted separately — so a stale translation could hide behind its twin. The
consequence to know: a marketing Server Component that needs a SHELL key imports `tFor` and
resolves a second translator, rather than the key being copied. `/features` does exactly
that for `tier.tagline.*`, and the note there says why it costs the browser nothing.

## HOME'S LANGUAGE IS A PATH SEGMENT. THE DASHBOARD'S IS A COLUMN

This follows from the two-products rule at the top of this file, and getting it backwards
breaks one of them.

* **Home is indexed**, so `/es/pricing` and `/fr/pricing` are real URLs with their own
  `hreflang` — three languages at one address are three thin pages competing with each
  other. `proxy.ts` rewrites the prefix onto the unprefixed route and passes the language
  down as a header; `lib/i18n/route-locale.ts` is the pure parser and `localizedAlternates`
  is the `alternates` block every public page owes.
* **English is unprefixed.** `/en/…` 307-redirects to the bare path. A first visit is
  negotiated from `Accept-Language` ONCE and then the URL records it, and
  `LOCALE_PICK_COOKIE` is what stops the negotiation firing again — without it the English
  option in the picker is unusable for a Spanish browser.
* **The Dashboard is `noindex`**, so there is nothing for `hreflang` to consolidate and a
  prefix would only be a second address for a page nobody may link to. `/es/dashboard` 404s,
  deliberately.

**`LOCALIZED_ROOTS` INCLUDES THE FOUR AUTH ROUTES**, and that is the one entry that is not
about crawling: a reader who has been on Spanish Home for four pages must not be handed an
English form by the one click that matters. It was, for a day — see below.

## `resolveLocale` HAS FOUR SOURCES AND THE ORDER IS THE WHOLE FILE

`lib/auth/locale.ts` reads them; `preferredLocale` in `lib/i18n/locales.ts` decides which
wins, and `lib/i18n/locales.test.ts` pins it.

1. **`people.locale`** — what the member SET. An explicit statement about the reader.
2. **the `/es` or `/fr` path segment** — a statement about this PAGE. Below the stored
   choice, because a member who chose Spanish and then opened an English-addressed link has
   not changed their mind; above the browser, because a path segment is something somebody
   navigated to and `Accept-Language` is something their browser was configured with.
3. **`Accept-Language`.**
4. **English**, which always answers, so no call site branches on "we do not know".

**THE SECOND RUNG WAS MISSING AND THE SIGN-IN PAGE WAS THE COST.** This resolver's header
said the URL was none of its business — true of a marketing page, which resolves through
`marketingLocale()` and never comes here, and false of the auth routes. Measured against a
real server:

    GET /es/login   Accept-Language: en-US   →   <html lang="es">, every word English

The `lang` was right because `app/layout.tsx` reads the header itself; the CONTENT was wrong
because `LocaleProvider` in the auth layout came here and got the browser's answer. A screen
reader was told Spanish and given English, which is worse than either being wrong alone.

**The ORDER lives in the pure module for a reason.** `resolveLocale` reads `next/headers` and
queries Supabase, so nothing under `npm test` can call it (§7b's boundary) — and a four-rung
chain that a fifth source might join is worth being able to assert.

## HOW A SURFACE GETS ITS TRANSLATOR — FIVE SHAPES, AND THE FILE'S OWN DIRECTIVE DECIDES

| Surface | How |
|---|---|
| a `'use client'` component | `useT()` / `useIntlTag()` from `LocaleProvider` |
| a Server Component page | `const { t, intl } = await callerI18n(user?.id ?? null)` |
| a nested Server Component | `t` as a PROP — server-to-server is by reference, and a missing prop is a type error |
| a server ACTION | **`g.t`**, off the guard. See below |
| a module-level registry | `Record<K, {label}>` → `function(t)`. The ids are the contract; the words are looked up |

**`GuardOk` CARRIES `t` AND `intl`, RESOLVED IN THE `Promise.all` `resolve()` ALREADY AWAITS.**
So an action reads `g.t('act.…')` with no extra round trip and no extra line. The alternative
was `const { t } = await callerI18n(g.userId)` written out at a hundred call sites, each
adding a third read of `people` for the same user in the same request — and a line every
action must also remember is a line three actions will not have, which is the argument
`requireView` already makes for folding `requireTier` in.

`lib/auth/guard.ts`'s own five refusals resolve theirs **in the failure branch**, which is
what keeps that free: the success path makes no extra call at all.

**A pure helper takes `t` as a LAST parameter** rather than resolving a second one —
`buildNavGroups`, `recorderField`, `adultCheck`, `normalizeBudget`. And **`t` as a prop is
the answer for a component whose other caller ships no JS**: `PillarVignette` takes one
because `FeatureShowcase` opens by saying it is data and markup, and a hook there would put
`'use client'` back on that band by the back door. `PlanningUpsell` and `Avatar` went the
other way on the same day and that is not an inconsistency — one of each of their callers was
already a client component, so the module was in the browser bundle either way.

**Watch for a variable already called `t`.** Four had to move: a string coercer, a loaded
topic, a fund transfer and a `find` callback's row. Every one was a compile error rather than
a silent shadow, which is the lucky direction and is not guaranteed.

## TWO GATES, AND THEY ARE BLIND TO OPPOSITE THINGS

```bash
npm run i18n:check         # every KEY is defined, used, fingerprinted and current
npm run i18n:literals      # every user-facing STRING is keyed at all. Ceiling 0
```

Both are steps in `verify.yml`. The second exists because the first is **structurally blind
to a string nobody keyed** — all seven of its findings are about a key — and that is not a
corner case. With four bundles, 3,900 keys and `i18n:check` clean, a probe against a real
server found **224 lines identical in all three languages**: the sign-in page, the sign-up
page, the quote carousel's chrome, the three pillar drawings and every page title on the auth
flow. Nothing in the tree could say so.

**`i18n:check`'s STALE finding is the one it exists for.** Every translation records a hash
of the English it was made from (`lib/i18n/translated-from.json`), so an edit to the English
that leaves the other two alone is reported by name. Nothing else can see it: the Spanish
string is still fluent, still grammatical, and no longer says what the English says. After a
deliberate re-wording, `npm run i18n:accept <locale>` records the new source — **read the
translation before you run it**, because that command's whole job is to say "I checked".

**The literal gate's CEILING IS A RATCHET at zero.** Raising it is a deliberate act needing a
sentence in the file; the honest reason to want to is a false positive, and the better answer
to one of those is `NOT_COPY` — a named entry with a reason, which is diffable, rather than a
number that quietly admits an unknown quantity of English. It does not sweep `lib/`: the
catalogues live there and their English IS the source.

## WHAT MUST NOT BE TRANSLATED, AND EACH FOR ITS OWN REASON

* **`lib/testimonials.ts`.** Rule 4 in that file: **a translation IS an edit of the words**,
  and one produced during an i18n pass is by construction a sentence the family did not say,
  in quotation marks over their name. That is the fabrication rule 1 is about — 16 CFR Part
  465 — arriving through a door that feels like housekeeping. The quotes stay verbatim, the
  CHROME around them is fully translated, and the section carries one line explaining it to
  readers who are not reading English.
* **A plan name, a person's name, a family's name, a fund a family named.** Proper nouns.
  `TIER_LABEL` is interpolated as `{plan}`, never typed into a value.
* **The product name.** `lib/brand.ts` is still the one place it lives; it reaches a
  catalogue value as `{app}`.
* **A `permission_resources.category` value, a `regconfig` name, a database identifier.**
  Not copy. `SEARCH_CONFIG` in `lib/search-config.ts` is the worked example of one that looks
  like it might be.

## THREE MORE RULES THAT COST SOMETHING TO LEARN

**A COMPARISON AGAINST A RENDERED STRING IS A COMPARISON TRANSLATION BREAKS, SILENTLY, IN THE
LANGUAGE NOBODY READS.** Found twice on `/pricing`, where a card was matched to a tier by its
LABEL. Both are now joins on the `tier` itself. Grep for `=== TIER_LABEL` and its family
before adding one.

**THE WORDS AROUND A FIGURE ARE COPY TOO.** `formatPlanPrice` takes the reader's `Intl` tag
— its old `.replace(/\.00$/, '')` was an English-decimal assumption, so French price cards
kept the zero cents the mechanism existed to remove — and ` a month`, `/month` and `(… a
month)` are keys, because they are English word order with an English preposition. Same for
a CONJUNCTION: `Intl.ListFormat`, never `" and "`.

**A `t`-BEARING REGISTRY IS A FUNCTION, AND ITS TESTS MUST NOT SHADOW.**
`TIERS.reduce((n, t) => n + planAdds(t, t).length, 0)` type-checks and passes a tier as the
translator.

## THE RLS SUITE READS REFUSAL MESSAGES, SO A FIXTURE THAT SETS A LOCALE POISONS IT

`personal-info.setMyLocale`'s positive control wrote `'fr'` onto `alphaMember` — the suite's
default CONTROL actor — and its attack wrote `'fr'` onto `bravoAdmin`, its default ATTACKER.
`resolveLocale` reads `people.locale`, so every action either of them called for the rest of
the run composed its refusal in French, and the **twelve** later `expectRefusal` predicates
that match message text all went red together on `Point de contact introuvable`.

That is §8b's named trap — *a case whose positive control mutates a row a later case depends
on* — arriving through a column that did not exist when the case was written. The tell was the
SHAPE: twelve unrelated modules, all in the `told` phase, all passing their probe.
`alphaOther`/`bravoOther` exist for exactly this and `seed.mjs` says so.

**So a case that writes a SHARED-PROFILE column runs as a spare actor.** `locale` is one;
`people_sync_shared_profile` names the rest.

## SEARCH AND SORTING ARE THE TWO PLACES A LANGUAGE REACHES THE DATABASE

**Full-text search folds accents.** `public.genorra_search` is `english` with `unaccent` in
front of the stemmer (`20260827000000`), and `SEARCH_CONFIG` is the one name the query sites
read. That migration argues at length why `'simple'` was the first plan and was strictly
worse, why a per-row `spanish`/`french` dictionary is a feature rather than a correction, and
why `asciiword` is not `word` — the last of which is why its verify block reads
`pg_ts_config_map` directly rather than inferring the mapping from a token.

**A sortable table sorts in the READER's alphabet.** `lib/sort-rows.ts` took the runtime's
default collation, and `ñ` is a LETTER OF ITS OWN in Spanish that files after `n` — so a
family with a Muñoz in it saw the name in the English position. `sensitivity: 'base'` does
not collapse it, measured. Everything else on the Latin surface sorts identically in all
three, which is the finding that makes threading a locale through the other 81 bare
`localeCompare` sites NOT worth doing.

## THE FIVE AUTH EMAILS COME THROUGH A HOOK NOW, AND IT IS OFF BY DEFAULT

`supabase/templates/*.html` are rendered and sent by GoTrue, which knows nothing about
`people.locale` and substitutes a handful of `{{ .Token }}`-shaped variables. One body is one
body. So the first mail a new member ever receives was English for everybody.

`[auth.hook.send_email]` in `config.toml` points GoTrue at
`app/api/auth/send-email/route.ts`, and with it on **GoTrue sends nothing itself** — measured:
zero messages in Mailpit and one call on the endpoint. `lib/email/auth-mail.ts` composes all
five instead, from the email catalogue.

**IT IS `enabled = false` AND THAT IS NOT CAUTION.** GoTrue calls the hook SYNCHRONOUSLY and a
non-2xx rolls the whole operation back, so with it on, a local signup needs both `npm run dev`
answering AND a working mail path. Without either, every signup 500s and leaves no
`auth.users` row — which reads as a database fault rather than a missing process.
`npm run auth-email:check` is what turns it on and proves it, the arrangement
`realtime:check` already has.

### FIVE THINGS ABOUT IT, MEASURED AGAINST GoTrue v2.195.0

* **The signature IS the gate.** No cookie, no session, no permission — the caller is a Go
  process in another container. `lib/auth/hook-signature.ts` is Standard Webhooks:
  `HMAC-SHA256` over `` `${id}.${timestamp}.${rawBody}` ``, key = base64 after `whsec_`,
  digest base64, prefix `v1,`. Every one of those was found by sweeping five key derivations ×
  four content shapes × three encodings against a CAPTURED request, and that capture is the
  test fixture — a fixture signed by our own code would prove only that the code agrees with
  itself.
* **`request.text()` FIRST.** The HMAC is over the bytes GoTrue sent and `JSON.parse` then
  `JSON.stringify` does not round trip.
* **A 500 response is NOT retried; an unreachable endpoint IS.** So a deliberate refusal is
  final and a deployment gap is not, which is the right way round. A 500 also rolls a signup
  back entirely — no account exists without its confirmation having been sent.
* **AN UNHANDLED ACTION TYPE ANSWERS 200 AND SENDS NOTHING.** `magiclink` is the case: nothing
  here offers a sign-in link, but `POST /auth/v1/otp` is reachable with the anon key. A
  refusal would make that endpoint answer 500 for an address that HAS an account and 200 for
  one that does not — **an account-enumeration oracle**, the exact leak `ForgotPasswordForm`
  is written to avoid. The cost is that a NEW auth flow is silently mailless until the route
  learns it, which is what `auth-email:check` walks every type to catch.
* **`email_change` is ONE hook call and TWO emails.** `token_hash` for the address the
  account has now, `token_hash_new` for the one it is moving to, and `user.email` is still the
  old address while `user.new_email` holds the new one. Sending one leaves a change that can
  never complete.

### THE LANGUAGE, AND THE ONE PLACE A HINT LIVES IN METADATA

`authMailLocale` in `lib/auth/locale.ts`: `people.locale`, then `user_metadata.locale`, then
English. `resolveLocale` cannot answer here — there is no caller, the headers are GoTrue's —
and `localesOfPeople` needs a `family_code` this path does not have.

**THE SECOND RUNG IS THE WHOLE REASON IT EXISTS.** A confirmation is sent before any `people`
row is written, so the first rung answers nothing for precisely the message that most needs to
be right. `registerUser` writes `locale` into the signup metadata from the language the
REGISTRATION PAGE was in, which `/es/register` makes knowable.

That metadata is USER-WRITABLE and it does not matter: it is only ever COMPARED, by
`storedLocale`, against the three languages the product speaks. **Nothing from it is ever
RENDERED** — the same distinction `consume_family_action_challenge` makes about a hash. A
member who writes `locale: "fr"` into their own metadata gets French mail, which is what the
control is for.

And it is **not kept in step** with the column. `setMyLocale` writes `people.locale` and
nothing else, so the metadata goes stale — and is shadowed from that moment on. One
authoritative fact and one hint with a shorter life than the thing it hints at is not the
`is_minor` trap; two maintained copies would be.

### THE TEMPLATES ARE NOT DELETED

They are the fallback for a deployment where the hook is off, and GoTrue's own defaults link
with `{{ .ConfirmationURL }}` — which points at GoTrue rather than `/auth/confirm` and is
wrong for this app. So `email:push` keeps pushing them and they keep their hex literals.

**WHICH MEANS THE ENGLISH EXISTS TWICE, and the mitigation is that the templates are FROZEN.**
A change to any of those words is made in `lib/email/auth-mail.ts` and the HTML is left alone
until the hook is on everywhere and it can be deleted. Two copies both edited is how they come
to disagree; two copies where one is retired is a migration in progress.

### AND `lib/email/` IS OBSERVABLE LOCALLY NOW, WHICH IT NEVER WAS

`sendEmail` posts to Resend's HTTPS API; the local stack captures SMTP in Mailpit. **Those two
have never met**, so no email this app composes has ever been visible locally — it either
returned `{ sent: false }` for want of a key or really sent, from a laptop, to a real inbox.

`EMAIL_CAPTURE_URL` (see `sendEndpoint`) points a send at a local listener instead, and is
read **only when `NODE_ENV !== 'production'`**. That guard is not configurable and must not
become so: set on a deployed environment, every approval, invitation and confirmation code
would go somewhere else and nothing would report a failure. Note that `next start` sets
`NODE_ENV=production` — so the capture works under `npm run dev` and is correctly ignored by a
production build, which is how a real Resend key in `.env.local` came to send real mail during
this work.

# Page width is a component, not a per-page guess

`components/layout/PageShell.tsx` is **the page container**. Every page under
`app/(protected)` used to hand-roll `max-w-* mx-auto px-4 sm:px-6 py-10`, and the
`max-w` drifted to whatever its author last had on screen — 2xl, 3xl, 4xl, 5xl and 6xl
are all still in the tree. The visible cost was that My Summary, My Families and My
Profile sat in a 3xl column with a lake of dead space either side while Members & Access
next door used the full 6xl: same app, same window, different width for no reason a
reader could infer.

```tsx
<PageShell className="space-y-8">…</PageShell>   // wide, the default
<PageShell width="reading">…</PageShell>         // a column of prose
```

**The rule is about content, not about pages.**

* `wide` (6xl, default) — content that is horizontal: tables, card grids, a `MainRail`
  with panes under it, side-by-side panels, multi-column forms. When in doubt, this one.
* `reading` (3xl) — a single column of prose read start to finish: an announcement, an
  event description, a document. This is not "a smaller wide": a 6xl line of body text is
  measurably harder to read, because the eye loses its place on the return sweep.

Do not reach past it for a bespoke `max-w`. A page needing a third measure needs a third
named option **on the component**, so the next page facing that choice finds it instead
of inventing a sixth width.

**Applied everywhere since 2026-08-13.** Every page under `app/(protected)` uses it,
`loading.tsx` included — so a navigation no longer starts at one measure and jumps to
another. Three centred `max-w-*` containers remain in that directory and none is a page
container: `/chat`'s empty-state card, and `error.tsx` and `not-found.tsx`, which are
`max-w-md` messages. Those two are deliberate — an apology in a 6xl column reads as a
layout failure rather than as a message — and the three are the whole exception list. If a
fourth appears, it belongs here or it belongs in `PageShell`. (Grep for both orderings:
those two write `max-w-md mx-auto`.)

**One page is `reading`; the rest are `wide`.** An election ballot — an `[id]` detail page a
member arrives at from a list and reads down. There were two until Events was retired; the other
was an event's own page.

**The test is not "does this page contain sentences."** Announcements and Settings were
`reading` until 2026-08-13 and neither should have been. Announcements is a *board* — a
stack of cards with pills and controls in their corners, and a composer above them — not an
announcement. Settings' case was really about one input: the Save button sits under the
name field rather than beside it, so what the wide measure stretched was the box, and the
box is capped in `FamilySettingsClient` now, which is where a constraint on a field belongs.
The question `reading` answers is whether the CONTENT is one column read start to finish. A
page whose content is cards, controls or a form is `wide` however much text is in it.

**Both measures start at the same left edge.** `reading` narrows the *column*, not the
container: the outer element is the 6xl measure on every page and the content inside it is
constrained flush left. Centring the narrower container was the first reading of this rule
and it put a `reading` page's `h1` about 190px right of every other page's — so nothing
lined up across a navigation, the heading did not line up with the TopBar controls above
it, and `loading.tsx` (which is `wide`, being what most pages resolve to) jumped sideways
on every load of Announcements and Settings. The narrow measure was the decision worth
keeping; the column moving was not part of it.

**The measure itself is `PAGE_MEASURE`, exported from `PageShell`.** Three files need it —
the page, the TopBar's controls, and `/chat`, which cannot use `PageShell` because it sizes
itself against the viewport — and all three held a hand-matched copy of `max-w-6xl px-4
sm:px-6` with a comment saying it must equal the other two. The whole value of the number is
that they agree on it, so it is imported.

**`/chat` owes the vertical half by hand, and owes it for its BODY as well as its heading.**
`pt-10 … pb-10` to start and stop where `PageShell`'s `py-10` does, and the measure on both
elements: the two panes used to run to the edges of the window under a heading that stopped
at 6xl, which is what made the page read as a different app rather than a different screen.
`ChatShell`'s pane row carries `rounded-xl border bg-card` so the panes read as a panel on
the cream, the same as every other page's sections. Its `h-[calc(100vh-4rem)]` arithmetic is
what absorbs all of it — the heading and the padding are `shrink-0`, the panes are `flex-1
min-h-0`.

**Accounting and Transactions lost an `xl:max-w-6xl` step** in that sweep, and it reads
like a regression until you know why. Both were `max-w-4xl … xl:max-w-6xl` — narrower
than every page beside them below 1280px — on the argument that their second-level rail
only appears at `xl`. That rail lives *inside* the measure rather than beside it, so the
argument did not hold, and the visible cost was a page that changed width mid-resize
while Members next door did not.

# A table is a table

Members & Access and Member Directory list the same people and answer the same question,
so they render the same columns in the same order. Today that is four —
**Name · Position · Chapter · Group**, and (where it applies) a row menu. The rule is the
agreement, not the number: a column added to one of those two screens is a column owed to the
other, or an administrator and a member end up comparing two different answers to one
question.

**THE RULE HAS NOW BEEN EXERCISED, and it is worth reading as a worked example.** Region was
the second column until 2026-08-20, when board assignment moved onto the Members row and
Members & Access needed somewhere to put a Position column. It was told, by this section, that
it could not have one alone — so the Directory made the same swap in the same commit, and the
two screens still match.

Two things made Region the one to give up rather than Chapter or Group. It was **derived** from
the chapter beside it (`people.chapter_id → chapters.region_id`), so the pair answered one
question twice — a member in the Austin chapter is in the Texas region by construction. And a
region was never ABSENT: a member under none is National, which is somewhere. Position is the
opposite on both counts — it is a stored fact about the person, and most of a family holds no
office, so it takes an em-dash where Region never could.

**On Members & Access the Position column is absent, not blank, for a caller without
`admin/members/board-positions:view`** — a headed column of em-dashes would tell them the
family has no officers. The Directory's column is unconditional, because
`MemberRecord.primary_role_title` has always been on that projection.

**Phone, Email and City/State moved into a dialog**, `components/members/MemberDetailsDialog.tsx`,
which both tables import so one panel states one person's record whichever screen it was opened
from. Three things about that are load-bearing:

* **It buys the two columns the tables had no room for.** Region and Chapter were on neither
  screen before, and adding them beside Phone, Email and City/State would have meant two more
  columns on a table already carrying five — back to the `min-w-*` floor and the sideways
  scroll the next section exists to forbid. So this is not a trim for its own sake: the width
  goes to the two facts a reader compares ACROSS rows, and the three that are read one person
  at a time go to where one person is read.

  It reads better narrow, too, by more than it looks. Four folded columns became a stacked
  `RowMeta` four lines deep under every name; three of those lines are behind one press now,
  and the two that remain are labelled.
* **THE TRIGGER IS A REAL `<button>` ON THE NAME CELL, NEVER A HANDLER ON THE `<tr>`.** A row
  that is only clickable is unreachable by keyboard and invisible to a screen reader, and the
  name is the right element because the button's text then IS its accessible name. `aria-haspopup="dialog"`
  is honest about what it opens. This is a deliberate departure from `PaymentHistorySection` and
  `TransactionsClient`, which do carry row handlers; on Members & Access a row handler would also
  fire underneath every row-menu item unless each one remembered `stopPropagation`.
* **Nothing new is fetched and nothing is newly published.** Moving a value into a dialog is not
  a reason to start sending it to somebody who could not see it before (§5) — each page's
  projection is unchanged, and the dialog renders what the row already carried.

Region is DERIVED (`people.chapter_id → chapters.region_id → regions.name`) and there is no
`people.region_id` to add; a member in no chapter reads **National**, which is the absence of a
region rather than a row, and is the same word the dues scope prints.

**Use a real `<table>` with `<th scope="col">`,** not a flex row dressed as one. A
screen reader announces the column when it reads the cell, which is the whole difference
between "512 555 0134" and "Phone: 512 555 0134". A column with no heading to give still
needs one — see the `sr-only` "Actions" header.

## On a phone a table narrows. It does not scroll sideways

`components/ui/table-collapse.tsx` is the pattern, and it is the only one. Every table
in the app used to sit in an `overflow-x-auto` box over a `min-w-*` floor — 52rem on the
two member tables, 44rem on Accounting's schedules, 760px on My Summary's dues. There
are no floors left, and a new one should not appear.

A column that is not the row's subject or its headline figure gets `COLLAPSING_CELL` on
**both** its `<th>` and every one of its `<td>`s, and the row restates it in a
`<RowMeta>` inside the first cell:

```tsx
<th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Date</th>
…
<td className="px-3 py-2">
  {row.name}
  <RowMeta>
    <span>{row.fund}</span><MetaDot /><span>{formatDate(row.date)}</span>
  </RowMeta>
</td>
<td className={cn('px-3 py-2', COLLAPSING_CELL)}>{formatDate(row.date)}</td>
```

**Why not sideways scroll.** The gesture is easy to start by accident and hard to aim;
the column parked off-screen is invariably the one people came for — the amount, or the
row menu; and the heading row slides away with the columns it names, so what you scroll
*to* is unlabelled. That last one is the reason this is not a taste question: the
table's whole accessibility argument is that a cell is announced with its column, and a
sideways scroll takes exactly that away from sighted users only. On the permission grid
it was worse than unlabelled — the Feature column scrolled out of view, leaving four
switch groups with no indication of which row you were about to change, on the one
screen where changing the wrong row hands somebody authority they should not have.

**Why not `display: block` on the rows and cells.** That is the usual recipe for a
"responsive table" and it throws the semantics away: a `<td>` set to block loses its
implicit cell role. This section exists because these lists were flex rows once.

**Why not a second stacked rendering below `sm`.** Two renderings of the same row drift,
and a column added to one and not the other is invisible until somebody opens a phone.
The cells here are the *same* cells, hidden by a media query.

Five things to get right:

* **The `<th>` folds with its `<td>`s.** Hide four cells and leave five headings and
  every remaining cell is announced under the wrong column. `display: none` takes both
  out of the accessibility tree, which is what keeps the mobile table coherent.
* **Choose what stays by what the table answers,** not by column order. Funds keeps
  Balance and folds Collected and Disbursed — those are how it got there. Reports leads
  with Type, not Date, and folds the date. Money ledgers keep who and how much.
* **Label a folded value when its heading was doing the work.** Most meta lines are a
  plain run of values; "Next due" and "Remaining" are not self-evident as two bare
  numbers under an installment figure, so those are prefixed.
* **A column holding a CONTROL folds by moving the control,** not by describing it —
  assign the element to a variable and render it in both places, or the field goes
  read-only on a phone. Both copies exist in the DOM, only one is ever visible or
  focusable, and both bind the same state. No `id` on them (it would duplicate); use
  `aria-label`, which they need anyway now the heading is gone.
* **Row cells get `align-top sm:align-middle`** where a meta line makes the first cell
  taller than the figures beside it.

**The one sanctioned `overflow-x-auto` left is the family tree canvas.** A tree is a
wide diagram and panning it is the interaction, not a fallback. It is not a table and
this section does not apply to it.

## A scrolling container clips an absolutely positioned menu

The reason `RowMenu` portals its panel to `document.body` and positions it `fixed`
against the trigger's measured rect: a container with `overflow-x: auto` has its
`overflow-y: visible` computed to `auto`, which clipped the dropdown at the row and made
it unusable.

The tables no longer scroll, so the containers are `overflow-visible` (or
`overflow-hidden` purely to clip the border radius) and the trap is gone from them —
but keep the portal. It costs nothing and the clipping ancestor is one careless
`overflow-x-auto` away from coming back. If you add another row-level popover anywhere,
it needs the same treatment.

# Telling somebody something went wrong is a component

`components/ui/form-message.tsx`. **Never write a line of red text by hand** — not
`text-sm text-destructive`, not a hand-rolled `role="alert"`, not a tinted `bg-destructive/10`
box. Two components own this job and there is no third treatment:

```tsx
<FormError message={error} />     {/* the OPERATION was refused */}
<FieldError message={error} />    {/* ONE INPUT is wrong */}
```

The rule exists because the tree had **four** treatments for one job and nobody had chosen
any of them — 38 sites of bare `text-sm text-destructive`, 14 of the same a size smaller,
12 tinted boxes and one more box with different metrics. The same failure looked like a
footnote on one screen and an alert on the next. That is the same drift, and the same fix,
as the required-field asterisk in `components/ui/label.tsx` and the two "text on navy"
tokens the rebrand collapsed: styling repeated by hand at forty call sites is invisible
until you put two screens side by side.

Five things follow, and the first is the one that gets got wrong:

* **Pick by what failed, not by size.** `FormError` is a refused *operation* — a save the
  server declined, a sign-in that failed, a password check that came back wrong. One per
  form, beside the button that caused it, with the full alert treatment. `FieldError` is
  one *input*, directly under it, deliberately quieter: a tinted box under each of
  RegisterForm's seven fields turns two mistakes into a wall of red.
* **Neither renders anything for an empty message,** so the call site is
  `<FormError message={error} />` and never `{error && <FormError … />}`. That is what
  keeps the `useState('')` every form in this codebase starts from painting an empty box.
* **Both are `role="alert"`,** an assertive live region, because both appear in response
  to something somebody just did and neither moves focus. Do not reach for either to
  render an ordinary hint — a hint that interrupts a screen reader is worse than no hint.
* **Spacing comes from `className`, never a fork.** `confirm.tsx` passes
  `className="mx-6 mt-4 shrink-0"` to sit its refusal in a flex column; that is the whole
  supported way to place one.
* **A message inside a scrolling panel belongs with the buttons, not with the field.**
  The body of a dialog scrolls and its footer does not, so a message rendered beside the
  input it is about can be off-screen at the moment somebody presses the button again.

This is a rule about *reporting a failure*, and it is not a licence to use `--destructive`
for anything else — see "Colours live in one place", and `--brand-withheld` for the case
that looks like an error and is not.

# Build every member list for a hundred-member family

A family with 120 adults in it is an ordinary customer of this product, not an edge
case — holding a whole extended family is the entire premise. So **any control that
lists members must be designed for that size**, and the default is that it is not:
`tests/rls` seeds six people, a hand-built dev family has a dozen, and twelve names
make a bare column of checkboxes look perfectly reasonable.

The failure at 120 is not performance. React will render 120 checkboxes without
complaining. The failure is that the name you came for is three screens down, there is
no way to reach it but scrolling, and the control gives you no way to tell whether you
have already picked it.

Assume 150 whenever you write one of these. It costs nothing at 12.

## `PersonMultiSelect` is the control for choosing several members

`components/ui/person-multi-select.tsx`. Use it. Do not write a second one — this has
already been hand-rolled three times in this codebase, each a little differently, which
is how the Member Directory got accent-insensitive search and the photo tagger did not.

```tsx
<PersonMultiSelect
  people={members}                       // SelectablePerson[] — id + names
  selected={form.beneficiaryIds}
  onChange={next => onChange({ beneficiaryIds: next })}
  label="This drive is for (optional)"
  hint="What choosing someone actually does."
/>
```

Four things in it are load-bearing, and the second is the one that gets left out:

* **Search, matching first, last and nickname**, accent- and punctuation-insensitively,
  so "jose" finds "José" and "oconnor" finds "O'Connor". This is the only way to reach
  one name out of a hundred.

* **Selections stay on screen as chips, above the search.** Filter a list to "mar" and
  every ticked name that does not match *disappears* — so if the checkboxes are the only
  record of what is selected, the control silently stops showing its own state, and a
  user removes someone by forgetting they were there. The chips are the state; the list
  is only a way to change it. Each chip is a remove button in its entirety, because a
  12px × beside a name is the wrong target on the screen where a mis-tap costs most.

* **An honest count, and an honest overflow.** "3 selected · 12 of 137 shown", and when
  a filter still leaves more rows than `RENDER_LIMIT` it says how many are off-screen.
  A list that stops at 60 while *looking* complete is how somebody concludes a person is
  not in the family. Never truncate quietly — same rule as the migration verify blocks:
  a skip must be visible.

* **A bounded height with its own scroll**, so the size of the family cannot push a
  dialog's Save button off the bottom of a phone.

**Names come from `disambiguatedName`, computed against the whole roster** — never the
filtered subset. Two Martha Allens are *more* likely in a large family, not less, and
scoring the name against the filtered list would make them read as unambiguous at
exactly the moment a search had separated them.

**It does not claim `role="combobox"`,** and a variant must not either. That role
promises arrow-key navigation, `aria-activedescendant` and Enter-to-commit, and a screen
reader changes its key handling to match; none of it is implemented, so claiming it
strands the users it is aimed at. It is a search input and a group of real checkboxes,
which is what it says it is. Same reasoning as `MainRail` refusing `role="tablist"`.

## `PersonPicker` is the control for choosing ONE member

`components/ui/person-picker.tsx`. The single-select counterpart, and it exists for the
same reason: a filter box over a bounded, scrolling radio group, with the current choice
stated above the box so a selection the filter excludes is still visible.

**This is a narrowing of the rule below, not a contradiction of it.** A native `<select>`
really is the right answer for a field on a form — the platform gives you type-ahead. It
stops being the right answer inside a dialog over a hundred and forty relatives, because
native type-ahead matches from the START of an option only: typing "allen" finds nobody in
a list of "Martha Allen". Searching any part of any name is the whole job.

**Both pickers import `lib/person-search.ts`.** The matching rule lives beside the data it
is about rather than inside a component, because a rule inside a component can only be
shared by copying it — which is precisely how the Member Directory got accent-insensitive
search and the photo tagger did not.

## Anything else that lists members needs a way to find one

The rule is about the size of the list, not about this one component.

* A **table** of members gets a filter box — `MemberDirectoryClient` is the worked
  example, and Members & Access follows it.
* A **single-select** over members is the one case where the platform helps: a native
  `<select>` has OS-level type-ahead, so it degrades rather than breaks. It still owes
  `disambiguatedName` on every option.
* **Gate the fetch first (§5).** A roster is PII that reaches the browser in the RSC
  payload whether the control renders it or not, and a 150-row roster fetched for a
  field the caller cannot use is both a leak and a payload.

## Known gaps, so nobody reads the above as a description of the tree

* ~~`components/elections/BallotForm.tsx`~~ — **fixed 2026-08-21, and the file was then
  split.** The nominee picker lives in `components/elections/NominationBoard.tsx` now: that
  same day the nominations pane was rebuilt around OFFICES, and the two position `<select>`s
  went with the rebuild rather than being converted — which office you are nominating for is
  which heading you pressed, so there is no position picker to disambiguate. What follows is
  kept because it is the argument for the `PersonPicker` that survived the move.

  It was a native `<select>`
  printing `{m.first_name} {m.last_name}`, which made two Martha Allens indistinguishable on a
  ballot — the worst screen in the product for it, which is why this entry led the list. It is
  `PersonPicker` now, and the list it is given is only the members the election's level admits
  (`getElectionNomineeOptions`), so the picker also stopped offering nominations the policy
  would refuse. The POSITION pickers on that screen stay native selects, deliberately: an
  election has a handful of offices, they are not people, and a search box over four options
  is furniture. Kept here struck through rather than deleted, because the two remaining rows
  are the same defect and this is what fixing one costs.
* `components/transactions/TransactionsClient.tsx` — three native member selects. They
  do disambiguate; they have no search beyond the browser's.
* `components/photos/PhotoCollectionGallery.tsx` — its own `tagSearch`, a plain
  lowercased `.includes()` on the formatted name. No accent or punctuation handling, no
  chips, no count. This is the third hand-rolled copy the shared component exists to
  stop being a fourth. **It is now a one-line fix rather than a rewrite**, since
  `lib/person-search.ts` exists: swap the `.includes()` for `matchesPersonQuery` and the
  accent and punctuation halves come with it.
