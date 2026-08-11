<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
client belongs to their family. `submitRsvp` is the worked example: any member may
RSVP, but only to their own family's event, and only for people in it.

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
`auth_uid_is_room_participant()` is load-bearing for chat despite having no call site.

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

## 5. Gate the fetch, not just the button

Hiding a control does not protect the data behind it. Props are serialized into the
RSC payload and reach the browser whether or not a component renders them, so a page
that fetches the member roster and then hides the form has still published the roster.

Decide what the caller may *see*, fetch only that, and let the UI follow.

## 6. New permissioned surfaces need a migration

A new page needs a row in `permission_resources` so administrators can restrict it on
Members & Access. Without one it still works — an unregistered resource defaults
to viewable — but it can never be turned off, which is a silent default nobody can fix
from the UI. Add the row in a new migration *and* in the seed in `20260618000000`,
whose insert is `ON CONFLICT DO UPDATE` and would otherwise revert it on replay.

Since `20260807000000` the row is not quite enough on its own. A member's access is
the grid on their one **permission template**, and that grid is materialized — every
template carries an explicit row for every resource and action, so the screen can show
the whole answer without explaining a fall-through. A resource registered later has no
row in the templates that already exist, so it falls back to `resource_visibility`:
`'everyone'` for view, and none for the rest. That is a working default, not a
complete one. A new resource that should be restricted needs its per-family
`resource_visibility` backfill in the same migration, exactly as `20260806000007` and
`20260806000010` do — and a new resource that a system template should positively
grant needs that backfill too, or only families created afterwards will have it.

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

Two failure modes to watch for in the fixture itself, both of which silently turn a
real finding into a pass: a case whose positive control **mutates a row a later case
depends on** (give it its own row — that is what `deletableChild` is for), and a probe
whose projection **omits the column the control changes**, so a successful write looks
like a no-op.

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
`election_nominations`, `photo_tags`, `event_rsvp_attendees` and
`person_relationships` all have two paths to `people`; `photo_collections` has two to
`photos` (its rows, and its cover). Name the constraint. And check the relationship
exists at all before embedding it — `event_rsvp` has no foreign key to `people`, so
`event_rsvp(people(...))` is PGRST200, equally silent.

To find every pair that needs disambiguating:

```sql
SELECT conrelid::regclass, confrelid::regclass, count(*)
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
GROUP BY 1,2 HAVING count(*) > 1;
```

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
  installs pgcrypto (and the rest) into `extensions`, and every function here sets
  `search_path = ''`, so `public.gen_random_bytes(...)` resolves to nothing.
  `20260806000012` shipped that exact mistake and applied cleanly.
* **A verify block that can skip must not be the only check.** That same migration's
  assertion needed an `auth.users` row and returned early without one, so a fresh local
  database reported success over a function that could not run. Split it: assert what
  needs no fixture unconditionally, and `RAISE NOTICE` for the part that genuinely
  cannot run — a skip should be visible, never silent.

`npx supabase db push --linked` **does nothing from a non-TTY** — exit 0, no output, no
migrations applied — because it is waiting on a confirmation prompt. Redirect stdin:
`npx supabase db push --linked < /dev/null`.

# Sending email is a plain module, never a server action

`lib/email/` sends the mail the **app** composes — membership approved, family invitation.
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
    href: `/transactions?ledger=${id}`,       // optional — see below
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
disagree: `LEDGER_RESOURCE` (Transactions), `SECTION_RESOURCE` (Accounting),
`PANE_RESOURCE` (My Summary). Members & Access is the exception that proves it — its
three tabs have three keys and no table, because its page resolves them one by one.

Sub-keys nest under their page's key (`transactions/dues-payments`,
`admin/account/routing`, `account-summary/history`) and that prefix is **not** cosmetic:
`getResources()` drops any row where `isFeatureFuture('/' + key)`, and `getFeature()`
longest-prefix-matches. A key under a `'future'` prefix vanishes from the grid with no
error at all — `family-finances/foo` would, `transactions/foo` does not.

**Gate the fetch, not the tab.** A hidden tab over data already fetched has published
that data (§5). Each page resolves its rail's grants server-side, skips the query for
every item the caller cannot view, and hands down the surviving list — `visibleLedgers`,
`visiblePanes`, `rights` — so the rail renders from the same answer the fetch used. A
caller who can view none of them gets a sentence saying so, not an empty rail over an
empty pane.

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
Families, My Children and Family Tree are a member's own things, and `20260806000006`
removed their rows so they cannot be restricted; the 2026-08-08 review reconsidered that
and kept it. The empty `personal` heading in `components/admin/resource-groups.ts` is the
trace of that decision, not a gap to fill.

# Colours live in one place

`app/globals.css` is **the only file in the app that may contain a colour literal.**
Not "the preferred place" — the only one. A new page or component that needs a colour
uses a token that already exists, or adds one here first and then uses it.

**The brand ramp has two layers, and you consume the second one.** This is the part
worth understanding before touching a colour.

* **Layer 1 — the palette.** `--genorra-*` in `:root`: Heritage burgundy, Warmth
  terracotta, Growth olive, Legacy gold, Nurturing sand, Light, Ink. Named exactly as
  the brand guide names them, identical in both themes, and taken verbatim from
  `public/Web/genorra-colors.css`. **Do not use these in a component.** They answer
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
  | `--brand-legacy` | `bg-brand-legacy` | Premium gold accent — **surface only** |

  **Why roles and not hues.** A token called `--brand-burgundy` would have to hold sand
  in dark mode to stay readable, and then its name is a lie. `--brand-ink` is burgundy
  on a cream page and sand on a dark one, and both are correct, because the role is
  "strong brand text". This split is the whole reason dark mode was possible without
  renaming anything twice.

  **The pairs are load-bearing.** Every surface role has an `on-` partner guaranteed to
  meet WCAG AA against it in *both* themes. Never put a foreground from one pair on the
  surface of another — `text-brand-on-affirm` on `bg-brand-primary` is not a checked
  combination and there is no reason to expect it to pass.

  **`--brand-legacy` has no `on-` partner, deliberately.** Gold is 2.30 against white
  and 1.65 against sand: it can never carry text in light mode, and a partner token
  would invite exactly that. Use it as a surface with dark text on it (ink on gold is
  6.99), or as a non-text accent — a rule, a dot, a border. The one place it *is* a
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

**There are exactly two sanctioned exceptions, and they earn it the same way: the thing
consuming the colour is not a stylesheet of ours, so a custom property cannot resolve.**

* **`BRAND_THEME_COLOR` in `lib/brand.ts`.** Those two hexes are consumed by the
  *browser* as document metadata — `viewport.themeColor` and the web manifest paint the
  mobile address bar. Keep them in step with `--genorra-heritage` and
  `--genorra-ground-dark` by hand.
* **`supabase/templates/*.html`,** the auth emails. These render in somebody else's mail
  client, where nothing of ours is loaded and even a `<style>` block is unreliable —
  Gmail strips it for non-Gmail accounts in its app. Every colour that matters is
  therefore inline, and inline means literal. The hex→token mapping and the reasoning
  are in [supabase/templates/README.md](supabase/templates/README.md).

Nothing else earns this. In particular, "it's just one component" and "Tailwind won't
let me" do not — the second is a token that needs adding to `globals.css` first.

Two things follow for the email templates specifically, because they are unlike every
other file here. **The template is the payload:** every byte ships to every recipient and
is one "view source" away, which is why the rationale lives in the README and the files
keep a short pointer comment. And **`config.toml` only wires up the local stack** —
hosted renders whatever was last pasted into the dashboard, so editing a template does
nothing to production until somebody pastes it and sends themselves a real signup.

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
literal — `lib/features.ts` and `app/actions/children.ts` are the worked examples.

**`APP_TAGLINE` and `APP_LEAD` are not interchangeable.** The tagline is the acronym
expansion and belongs beside the mark; the lead line — "Where every generation belongs."
— is what leads a page. `APP_VALUES` is the three words as *data*, and `APP_PROMISE`
joins them for running text; a surface that lists the values maps over the array rather
than retyping them, so adding a fourth is one edit.

## Artwork paths, and the versioned kits

`public/` holds exactly three things:

| Folder | What it is |
|---|---|
| `public/identity/` | **The only artwork the site serves.** Named by role, wired through `lib/brand.ts`. |
| `public/v1_1/` | The current vendor kit, exactly as delivered. |
| `public/v1_0/` | The superseded kit, kept for reference. |

**Serve from `identity/`, never from a kit folder.** Two reasons, both of which have
bitten:

* Kit folders are named for a design deliverable — `SVG_Masters`, `PNG_Exports` — and
  those names would end up in public URLs, where they are permanent. Worse, they are
  *version-scoped*: a URL containing `v1_1` has to be rewritten at every kit bump, and
  the one that gets missed 404s in production.
* A `public/brand/` for web assets would be the *same* directory as the kit's `Brand/`
  on Windows and macOS and a *different* one on the Linux box that serves production —
  it works locally and 404s once deployed. `identity/` collides with nothing in either
  direction. This was hit while doing the rebrand, not theorised.

**Bumping the kit is a copy, not a reference change.** Drop the new kit in as
`public/v1_N/`, then re-copy every file in `identity/` (and `app/favicon.ico`,
`app/icon.svg`, `app/apple-icon.png`) from it and `cmp` each one. Skipping that leaves
the site serving the *previous* kit's artwork with no error anywhere — which is exactly
what happened: `identity/` held the v1.0 mark for a full round after v1.1 landed, and
v1.1 existed precisely to correct that mark's silhouette.

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

Two faces, per `public/README.txt`: **Cormorant Garamond** for display and **Inter** for
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
when. They were swept once, during the 2026-08-10 rename; do not make a habit of it.

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

**Not yet applied everywhere,** and that is deliberate rather than half-finished. My
Summary, My Families, My Profile, Members & Access and Member Directory use it. The rest
still carry their own container, and converting them is mechanical but not a no-op: each
has to be read to decide `wide` or `reading`, and widening a page that wanted to be
narrow is the one way this change makes things worse. New pages use `PageShell` from the
start.

# A table is a table

Members & Access and Member Directory list the same people and answer the same question,
so they render the same six columns in the same order — Name, Phone, Email, City/State,
Group, and (where it applies) a row menu.

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
