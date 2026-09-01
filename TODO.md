# TODO

Running list of things worth revisiting. Add an entry when you find something real
but out of scope for the change you are making, so it does not get lost in a commit
message.

Everything here is open. Completed work is deleted rather than archived — the write-ups
are in git history, and the lessons worth keeping have been promoted to AGENTS.md.
GO LIVE is a checklist rather than a backlog.

## Scrubbed 2026-08-29

Every remaining entry was re-checked against the tree. **Nothing was newly closed** — each one
is still real work. What moved is the Send Email hook, which is now ON and whose entry has been
narrowed to what genuinely remains, plus six references that had gone stale under features that
shipped after they were written:

| | |
|---|---|
| Send Email hook | steps 1–3 done; narrowed to proving it and deleting the frozen templates |
| SMS | My Profile → **Text Messages** is **Notifications** since `20260826000000` |
| Photo thumbnails | `/review/photos` is `/community/gallery`; the three `<img>` sites are under `components/gallery/` |
| Advisors | `family_removal_challenges` is `family_action_challenges` since `20260825000000` |
| Privacy policy | no longer "one route, one link" — `LOCALIZED_ROOTS` and three catalogues, and it fails `npm test` without the first |
| Sorting | `useTableSort` threads the reader's collation for free; the 14 remaining are unchanged and were counted one by one |
| `http` | "the last extension anything wants" was falsified four days later by `unaccent` |

Two figures were off by one and are corrected in place: `BACKLOG_CEILING` is 69, and the
"Three smaller Stripe follow-ups" heading listed four.

**This pass landed on top of an earlier, uncommitted one** that had already deleted the four
`RESOLVED` blocks (the admin-who-could-pay invariant, `pg_cron`, Meta's money half, and the five
mutable `search_path` functions) — which is what this file's own header prescribes for completed
work. So `git diff` against `master` shows ~270 deleted lines that are not from this scrub. That
pass left one dangling cross-reference, *"see the resolved item above"* in the birthday entry,
now repointed at the `http` item; it was the only one.

**What this scrub could NOT check, and nobody reading it should assume otherwise:** every GO
LIVE item is a setting in somebody's dashboard, and by construction nothing in this repo can
see any of them. Their code-side halves were verified — `TIER_IS_SOLD.premium` is still
`false`, `CONNECT_ACCOUNT_COUNTRY` is still `'us'`, `smsConfigured()` still reads four
variables, `app/sitemap.ts` still emits one URL per route, `withheld_since` still does not
exist, `LINK_EXISTING_PERSON_ENABLED` is still `false`, and `setTemplatePermission` still
validates no scope — but "is the flag set on hosted" is answered by a person or by nobody.

## GO LIVE

Things that must be true of the **hosted project** before real families use it. These
are not code changes and none of them is done by `db push` — every one is a setting or
a credential on the deployed environment, which is exactly why they are easy to reach
launch day without.

### [ ] `CRON_SECRET` is not set, so no dunning or retention mail is sent

**Action:** set it in Vercel → Project → Settings → Environment Variables, on Production. Any
long random string.

`vercel.json` schedules `/api/billing/notices` daily at 00:40 UTC and Vercel sets
`Authorization: Bearer $CRON_SECRET` on its own cron requests **only if the variable exists**.
The route answers **503** without it rather than running open — a deployment that has not been
configured must not have a mail-sending endpoint reachable by anybody.

**WHAT IS ACTUALLY BROKEN WHILE IT IS UNSET IS NARROWER THAN IT SOUNDS, AND SAFER.** No
dunning mail goes out, so no family is warned — and because both deletion sweeps refuse to act
unless the notices they owed are recorded as `sent`, **nothing is ever deleted either.** The
ladder still locks screens on schedule (that is `delinquent_since` and a guard, not the mail),
but day 60 never fires. Failing in that direction is deliberate; see `20260901000002` §D.

To prove it once it is set:

```bash
curl -i -X POST https://genorra.com/api/billing/notices \
  -H "Authorization: Bearer $CRON_SECRET"
```

A 200 with `{"claimed":0,...}` on a healthy estate is the expected answer. `VERCEL.md` carries
the rest.

### [~] Two `[auth]` values are set in `config.toml` and not on hosted — ONE APPLIED 2026-08-29, THE OTHER NEEDS A PLAN

**Action:** nothing, until somebody decides whether this project goes to Pro. The first half
is done and verified; the second is refused by the API and cannot be done at any price short
of an upgrade.

| Setting | `config.toml` | hosted | State |
|---|---|---|---|
| `secure_password_change` | `true` | ~~false~~ → **`true`** | **DONE 2026-08-29.** PATCHed and confirmed by re-reading |
| `sessions_inactivity_timeout` | `168h` (7 days) | **unset, and must stay so for now** | **BLOCKED: HTTP 402.** *"User sessions can only be configured on Pro Plans and up."* This project is on Free |

**THE BLOCKER WAS NEVER THE TOKEN**, which is what this entry said for two weeks. A
project-scoped Management API token with **`Auth: Read + Write` and nothing else** is
sufficient for both PATCHes — the whole account-wide token the entry implied is not needed,
and the narrower one is what should be minted next time. The second setting is gated on the
PROJECT'S PLAN, which no token can widen.

**Do the two as SEPARATE PATCHes, which is how the split above was learned.** The 402 refuses
the whole request, so the combined `-d` below would have taken the password flag down with the
session timeout and reported one failure for two settings. It is left as written because it is
what the original sweep ran; send one field at a time.

**What changed for members the moment the first one landed.** GoTrue now demands the emailed
reauthentication code for a password change on any session older than 24 hours — before, the
flag was off, so there was no code at ANY session age, which is the gap AGENTS.md's "A fresh
session can change the password without the emailed code" was written against. The mail is
`supabase/templates/reauthentication.html` (the Send Email hook is still off on hosted, so
GoTrue renders it), and that template is pushed by `migrate.yml`. **Nobody has yet seen one
arrive** — see the validation note below.

**One environment fact worth carrying to the other items on this list.** On a machine behind a
TLS-inspecting proxy, Python's verifier rejects the injected CA (`Basic Constraints of CA cert
not marked critical`) while `curl` succeeds, because the Windows build links Schannel and reads
the Windows trust store. Reach for `curl` for anything hitting `api.supabase.com` from here;
the answer is never `verify=False` or `curl -k`, on a channel carrying a bearer token.

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
`/auth/v1/settings`, or from any test — **the GET is the verification, and there is no other.**
In particular a password change on genorra.com proves nothing about the flag: GoTrue reads it
as "reauthenticate *or* have logged in recently", where recent is `session.created_at + 24h`,
so a session you have just created sails through with no code whether the flag is on or off.
**The one functional check that means anything needs a session more than 24 hours old**, and it
is still owed — nobody has watched a reauthentication email arrive on hosted.

The 2026-08-29 run also confirmed `sessions_timebox` is unset, which matters more than it looks:
a timebox at or under 24h caps `session.created_at` so no session ever reaches the age at which
the flag is enforced, silently turning the setting just applied back into decoration. Check it
in the same GET if anybody ever sets one — [config.toml:476](supabase/config.toml#L476) argues
it at length.

**Why each matters.** `secure_password_change` is what AGENTS.md's "A fresh session can
change the password without the emailed code" is written on — and on hosted the flag was
*off* until 2026-08-29, so there was no reauthentication code at **any** session age, not
merely inside GoTrue's 24-hour window. `sessions_inactivity_timeout` bounds how long an abandoned cookie
stays renewable; 7 days was chosen because the floor is about an hour (auth-js refreshes a
live tab roughly every 58 minutes at `jwt_expiry = 3600`, and by measurement the only clock
that setting watches is the refresh, so anything lower signs out people who are working).
The reasoning and the measured table live in `config.toml` beside the block.

**Watch the unit — the two places disagree.** `config.toml` takes a Go duration and Go has
no `d`, so seven days is `"168h"`; the Management API takes seconds, so the same value is
`604800`. `"7d"` is a parse error and `7` is seven nanoseconds.

Found 2026-08-12 by a read-only sweep comparing every `[auth]` key `config.toml` declares
against that endpoint. Eighteen keys, three divergences; `otp_length` is now 8 in both —
re-confirmed on hosted 2026-08-29, `mailer_otp_length = 8` — and `max_frequency`'s 1s/60s
split is deliberate and says so in `config.toml`. **One of the two remaining is now closed and
the other cannot be**, and they are the same failure the template sync was built to stop, one
field over:
written in `config.toml`, verified locally, never applied to the project that serves real
families.

**`scripts/auth-templates.mjs` will not grow into a checker for this**, deliberately. It
reads and writes nothing but the ten mailer fields; the moment it can write `site_url` it
inherits every hazard `config push` has. A separate read-only auditor over the whole
`[auth]` block is the right shape and is not built.

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

The local half of this is already gone: `supabase/.env.probe` is not present in this checkout,
and `.claude/settings.local.json` holds nothing but a Bash permission allowlist — no
credentials of any kind. *(This said "there is no `.claude/` directory at all", confirmed
2026-08-12. There is one now; re-read 2026-08-29 and it carries six `Bash(…)` allow patterns
and nothing else. The substance is unchanged — what mattered was that no probe credential
lives in the checkout, and none does.)* And the durable replacement is live, so granting an agent
`db push` on production has no remaining justification: migrations reach hosted from CI on
merge and gate the Vercel release, reviewed and recorded, with nobody holding write
credentials. See AGENTS.md, "How migrations reach the hosted project".

### [ ] Stripe: two flags, seven variables, two webhook endpoints, one Dashboard switch, one tax decision

**Action:** set the environment variables, create the two webhook endpoints, and flip one
constant. The integration is built and inert; every item below lives in somebody's Stripe
account or on Vercel, and nothing in this repo can detect any of it.

Both flows are implemented and merged — `lib/stripe/`, `app/actions/billing.ts`,
`app/actions/pay-dues.ts`, `app/actions/admin/processing.ts`, `app/api/stripe/*`, and
`20260823000004` / `20260823000005`. `payment_info.md` is the architecture and AGENTS.md's
"MONEY HAS TWO DIRECTIONS" section is the rule.

**1. THE PRODUCT FLAG — DONE for Standard and Plus (2026-08-23), still `false` for Premium.**
`TIER_IS_SOLD` in `lib/plans.ts` is the decision and it is not a credential. Both edits were
made in one commit, as this item required: `TIER_IS_SOLD` and `PLANS[].available` on
`/pricing`. `npm run marketing:check` does not catch that pair — it compares claim SETS, not
availability — so the two were checked by hand and the pricing page's header now says they
move together.

Premium stays off deliberately: it is sold on a mailbox and a website, and nothing provisions
either. Flipping it is the same two edits plus whatever delivers those two things.

**WHAT WENT WITH IT, because enabling a plan is not only a flag.** `setFamilyTier` — the plan
picker on Settings — used to move `families.tier` in both directions with nothing charged,
which was harmless while nothing was for sale and became a free upgrade for every family
administrator the moment it was. It now refuses **every** move up (its header carries the
argument), the Plan rows no longer render an upgrade button, and the only route into a paid
tier is Billing. Do not undo that to restore the "put a family on Plus to see the gates work"
affordance — on a laptop, `psql` and the service role still move the column.

**AND THE SIGNUP HALF.** `/pricing`'s two sellable cards now link to `/register?plan=<tier>`,
the registration form offers the same choice, and the answer is recorded on
`platform_billing_accounts.signup_tier` (`20260823000008`) rather than charged — there is no
family to bill and, with `enable_confirmations` on, no session to authorize a checkout. The
dashboard prompts for it afterwards (`PlanSetupBanner`, `lib/signup-plan.ts`). **Nothing in
that path grants a tier**, so it needs no item on this list; it needs the variables below,
like everything else here.

**2. Environment variables**, on Vercel. Nothing is `NEXT_PUBLIC_` and nothing may become so —
this integration uses hosted Checkout, so the browser never loads Stripe.js and needs no
publishable key at all. `lib/meta/no-client-secrets.test.ts` asserts none of them is reachable
from a client bundle.

> **PREVIEW IS DONE (2026-08-23); PRODUCTION IS NOT, AND THIS ITEM IS ABOUT PRODUCTION.**
> The Preview environment — which builds off `dev` — has the keys, both webhook endpoints and
> the Products, against the **Stripe sandbox**. So the flow below can be walked end to end on a
> preview URL today, and every check in §3 is worth doing there FIRST, because a sandbox is
> where a wrong signing secret is cheap.
>
> None of it carries over. Vercel environment variables are per-environment and a sandbox
> Product has no live counterpart, so production needs its own keys, its own two endpoints
> (pointed at `genorra.com`, not a preview URL) and its own six Prices — created again, by
> hand, at the same figures. **Leave this item open until that is done.**

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | **Prefer a restricted key (`rk_`)** over `sk_`. It needs write on Checkout Sessions, Customers, Subscriptions, Prices (read), Billing Portal, and Connect accounts/account links. |
| `STRIPE_PLATFORM_WEBHOOK_SECRET` | The signing secret of the endpoint in §3. Not interchangeable with the next one. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | The **Connect** endpoint's. One shared secret would make the two endpoints indistinguishable, which is the mix-up that would credit a family's ledger with our revenue. |
| `STRIPE_PRICE_{STANDARD,PLUS,PREMIUM}_RECURRING` | A monthly recurring Price per tier: **$10 / $20 / $30**. |
| `STRIPE_PRICE_{STANDARD,PLUS,PREMIUM}_PREPAID` | A ONE-TIME Price per tier whose unit is **one month**, same figures. Prepaid terms are `quantity: months` against it, up to 60. |

> **EVERY ONE OF THOSE SIX IS A `price_…`, NEVER A `prod_…`.** This is the mistake the sandbox
> setup actually made (2026-08-23) and it is worth its own paragraph, because the error it
> produces argues the opposite of the truth: Stripe answers `resource_missing`, *"No such
> price: 'prod_…'"*, while the Dashboard shows a perfectly healthy Product under that very id.
> A Product is the thing being sold; a Price is the amount charged for it. The id you want is
> on the Product page under **Pricing**, or from `GET /v1/prices?product=prod_…`.
>
> `priceShapeError` in `app/actions/billing.ts` now refuses a non-`price_` id before any API
> call and says which mistake it is, so this costs a log line rather than an afternoon. It
> also catches the other four: the `_RECURRING`/`_PREPAID` slots swapped, an archived price, a
> non-monthly interval, and — the one that would NOT have failed at Stripe — an amount that
> disagrees with `TIER_PRICE`, which would have opened a hosted page asking for a figure the
> button did not promise.
| `STRIPE_API_VERSION` | Leave unset. Pinned to `2026-07-29.dahlia` in code; this is the override for testing a bump. |

**One Product per plan, not one Product with three prices.** Checkout and every invoice print
the Product name on the line item, so three tiers sharing one Product gives every family a
receipt that cannot tell them apart. Both Prices for a tier belong to that tier's Product, and
**both must equal `TIER_PRICE[tier].monthlyCents`** — nothing in this repo can check that, and
the screen quotes `TIER_PRICE`, so a mismatch shows up as a hosted page asking for a different
number than the button promised.

**A LIVE KEY IS REFUSED ON A PREVIEW DEPLOYMENT** (`liveKeyOnNonProduction` in
`lib/stripe/config.ts`), so QA cannot charge a real card. A sandbox `sk_test_`/`rk_test_` key
is what Preview is meant to hold and is accepted there, which is why the sandbox setup above
works — the guard reads the key's PREFIX and `VERCEL_ENV`, nothing else.

**The opposite cannot be detected from inside the process and is the expensive one:** a TEST
key on production means every checkout succeeds, every webhook fires, every tier is granted and
no money is ever collected, with the product working perfectly. **Now that a sandbox key exists
in the project this is a live hazard rather than a hypothetical one** — the two variables differ
by four characters and are set in the same UI. Check the key prefix on production by eye.

**3. Two webhook endpoints.** Both are `POST` only and both verify a signature before parsing
anything.

| Endpoint | URL | Events |
|---|---|---|
| Account | `https://genorra.com/api/stripe/platform` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` |
| **Connect** | `https://genorra.com/api/stripe/connect` | the first four above, plus `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`, **`charge.succeeded`**, **`charge.updated`** |

Then **turn a real payment on and watch it land.** "The endpoint returned 200" is not
validation; these are:

| Check | What wrong looks like |
|---|---|
| Buy a month, then reload `/admin/settings` | **Paid through** moves and the tier is granted. Still Free means the webhook is not arriving — check the signing secret, not the code |
| Replay the same event from the Stripe dashboard | Nothing changes. `platform_payments.stripe_ref` is unique; a second row means the ref is not the charge |
| `SELECT * FROM stripe_webhook_events WHERE processed_at IS NULL` | Empty. A row here with a `last_error` is an event that failed and is being redelivered |
| Buy 12 months, then change it to 3 on Stripe's page | `paid_through` is three months out, not twelve — the quantity is read off the session, and it is the MONTHS line that is read, not the part-month line beside it |
| Sign up on the 20th of a 31-day month | The charge is the rest of the month prorated and rounded UP, and `paid_through` is the last day of that month. Every later invoice is on the 1st |
| Sign up on the 29th on Standard | The remainder alone is under $5, so only the combined "this month and next" option is offered — and the screen says why |
| Upgrade a family with a live prepaid term | Often **nothing to pay**: the unused term is valued at the old rate and spent first. Anything left is a NEGATIVE customer balance transaction at Stripe |
| Move down a tier | The tier does NOT change today, and **Billing** names the date it will |
| Connect a family account and pay a due | A `dues_payments` row with `source='stripe'`, `recorded_by` NULL, and `fund_contributions` rows against it |
| Compare a charge against `platform_payments.amount_cents` | Cents, not dollars. A $5.00 charge stored as `5` is the failure |

**3b. MANAGED PAYMENTS MUST BE OFF, AND IT IS ON BY DEFAULT — IN BOTH MODES SEPARATELY.**
Found the hard way on the first sandbox checkout (2026-08-23), which was refused with *"the
product tax code is missing … Product tax code is required for Managed Payments, which is
enabled by default on your account."*

**This account is not eligible for it in the first place.** Stripe's own eligibility page says
Managed Payments *"supports direct integrations only"* and does **not** support **Connect
platforms** — which is exactly what GENORRA is, the moment one family connects an account. So
the default is switched on for something that cannot legitimately be used here.

**And it conflicts with rule 2, which is no refunds.** Under Managed Payments *"Stripe can
issue refunds within 60 days of purchase in certain cases"* and applies regional cooling-off
periods. There is no refund column, no credit-note table and `amount_cents > 0` is a CHECK, so
a Stripe-initiated refund is a movement the ledger cannot represent.

Turn it off at `dashboard.stripe.com/<acct>/settings/managed-payments`, **once per mode**. The
setting is per-mode, so a sandbox that works proves nothing about live — and the failure is a
refused checkout on the first real customer.

*Why not `managed_payments[enabled]=false` per session, which the error suggests:* it is the
wrong lever twice over. It would have to be added to all four session calls and remembered on
the fifth, and the pinned SDK (22.5.0) does not type the parameter at all, so it would need an
unchecked cast on the money path. An account-level setting for an account-level ineligibility.

**4. Stripe Tax is a decision nobody has taken, and it is not a code change alone.**
`automatic_tax` is NOT enabled on any session in this integration. Turning it on without an
active tax registration in the buyer's jurisdiction collects nothing and reports no error — the
single most common Stripe Tax mistake — so it needs a registration first, and a plan
subscription sold across US states may need several. Read
[Collect taxes for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes.md)
before touching it. **The family side is not ours to decide at all:** on a direct charge the
family is the merchant of record, so their tax position is theirs.

**AND THE AUTOMATIC OPTION IS NOT AVAILABLE TO US, which narrows this item rather than
answering it.** Managed Payments is the arrangement where Stripe takes on the indirect-tax
liability, and §3b above records why this account cannot use it: it is a Connect platform.
Stripe's eligibility page names the fallback in as many words — *"If you don't think your
product is eligible for Managed Payments, you can use Stripe Tax to manage your compliance
requirements."* So the choice is Stripe Tax with real registrations, or a considered decision
not to collect; there is no third door where somebody else handles it.

**5. Set a CSP header if Stripe.js is ever loaded.** It is not today — hosted Checkout is a
redirect — and that is why `next.config.ts` needs no `frame-src`. An embedded Payment Element
would change that.

Recorded 2026-08-23.

### [ ] Meta advertising: two credentials, four dashboard settings, one decision

**Action:** set five environment variables and untick one box. Nothing in this repo can
detect any of it — same shape as the two `[auth]` values above, and the same reason it is
on this list rather than in a commit.

The integration itself is built and tested (`lib/meta/`, and its README is the reference).
What is missing is everything that lives in somebody's Meta account.

**1. Environment variables**, on Vercel. Production and Preview differ deliberately:

| Variable | Production | Preview / QA | Notes |
|---|---|---|---|
| `META_PIXEL_ID` | set | set | The dataset id. Public — it is in the page source of every site that runs a Pixel |
| `META_CONVERSIONS_API_ACCESS_TOKEN` | set | set | **Server only.** Never `NEXT_PUBLIC_`, never logged, never in a URL |
| `META_TEST_EVENT_CODE` | **leave unset** | set | Preview is `off` until this exists — that is the deliberate QA opt-in |
| `META_CONSENT_DEFAULT` | a decision — see 3 | same | `denied` unless set |
| `META_GRAPH_API_VERSION` | leave unset | leave unset | Pinned to `v26.0` in code; this is the override for testing a bump |

With no `META_PIXEL_ID` the whole integration is inert — the Pixel is not rendered, no
server event is sent, and the consent banner does not appear. That is what makes it safe to
merge before any of this is done.

**2. Events Manager**, and the third item is the one that matters for this product:

1. Create or identify the **Dataset / Pixel**; copy its id.
2. Settings → Conversions API → **Generate access token**.
3. **TURN OFF AUTOMATIC ADVANCED MATCHING.** Settings → *Automatic advanced matching*. Left
   on, the Pixel reads form fields and sends what it finds — on a product whose forms hold
   relatives' names, birthdays and relationships. The base code already disables
   `autoConfig` (which stops button-text and page-metadata collection, and is enforced in
   `lib/meta/pixel.ts` rather than left to a toggle), but AAM is a **separate**
   dataset-level setting that no code can reach. Both are needed and only one is in the
   repo.
4. Brand Safety → **Domains** → verify `genorra.com`. Aggregated Event Measurement cannot be
   configured without it.
5. **Aggregated Event Measurement priorities**, once there is volume: Purchase, Subscribe,
   CreateFamily, CompleteRegistration, ViewContent, in that order. This is the ranking iOS
   attribution collapses to, so the most valuable event has to be first.

**3. The consent default is a business and legal decision, not a code one.**
`META_CONSENT_DEFAULT` is `denied` — opt-in — unless set, which is the only defensible
default for a decision that turns on jurisdiction. `granted` produces the opt-out model
common for US-only advertisers, and the banner then reads as a notice with a decline
control. Both are implemented; which is lawful where is a question for a person.

**Validation, and it is not "the API returned 200".** With `META_TEST_EVENT_CODE` set on a
preview deployment, open Events Manager → Test Events, then load the preview with
`?fbclid=TEST123&utm_source=facebook&utm_campaign=qa` and walk Home → Pricing → Register
(create a family) → `/my-families` → create a second family. **Accept on the banner first;
nothing fires before that, which is itself the first thing to confirm.**

| Check | What wrong looks like |
|---|---|
| Sequence is `PageView`, `ViewContent`(Home), `PageView`, `ViewContent`(Pricing), `PageView`, `CompleteRegistration`, `CreateFamily` | A missing step means a page lost its `<MetaViewContent>` |
| PageView appears **once** per page | Twice means the base snippet's own call came back, or a second effect was added |
| `CompleteRegistration` is **one** event marked Browser **and** Server | Two rows means the event ids diverged — the whole deduplication contract |
| `event_source_url` is the canonical origin with **no query string** | A query string here is a leak: invitation tokens and search terms live there |
| `action_source` is `website` | — |
| Matching parameters include `em`, `fn`, `ln`, `external_id`, `client_ip_address`, `client_user_agent`, `fbp`, `fbc` | A missing `fbc` after an `fbclid` landing means attribution is not surviving registration |
| `content_name` reads `Family Workspace` / `GENORRA Account` | **A family's name here is the failure the whole allow-list exists to prevent** |
| Diagnostics is empty of: duplicate events, missing `event_id`, missing currency/value, invalid `fbp`/`fbc` | — |

Then **Event Match Quality** on the dataset. It is a number to improve only through the
nine permitted account-holder fields; it must never be improved by widening
`MetaAccountHolder`. That interface exists to make "send more" a reviewed decision, and the
pressure on it is one-directional.

**Do not set any of this with `supabase config push`** — unrelated to the auth block above,
but worth saying in the same breath: none of these values lives in `config.toml` at all.
They are Vercel environment variables and Meta dashboard settings.

Recorded 2026-08-23.

### [ ] SMS: an account, a registered campaign, and four environment variables

**Action:** open a Twilio account, register a brand and campaign, set four Vercel variables.
Nothing in this repo can detect any of it, and **the registration is not a credential — it is an
onboarding process with a real-world identity behind it.**

`/community/safety-check-ins` is `tier: 'premium'` because the ask is meant to arrive as a text
message. The consent half is built (`20260823000002`, `lib/sms/consent.ts`,
`app/actions/sms-consent.ts`, My Profile → **Notifications**); the sending half is not, and this
is what it is waiting on rather than on code.

**1. A2P 10DLC REGISTRATION IS THE BINDING CONSTRAINT, and it is worth understanding before
anybody estimates the rest.** US carriers will not deliver application-to-person SMS to a mobile
number at all until a brand and a campaign are registered with The Campaign Registry. It is not a
rate limit or a deliverability tax — unregistered traffic is blocked. Turnaround is days, not
minutes, and the campaign has to declare what the messages are for and carry sample copy.

Declare the use case honestly as transactional/notification with the two message shapes this
product actually sends: a verification code, and a safety check-in ask. **A campaign registered
as marketing would be the wrong one**, and re-registering is not free.

**2. TCPA is the reason the consent half was built first**, and the registration does not replace
it. Statutory damages are $500–$1,500 **per message**; the product's answer is an explicit
per-person opt-in defaulting to off, a number verified by code before anything is sent, and STOP
as a state the product cannot undo. All three are in place. What is still owed to that model is
the inbound webhook that HONOURS a STOP — until it exists, a relative who replies STOP is
recorded nowhere, which is the one gap in the consent story that matters.

**3. Environment variables**, on Vercel. `smsConfigured()` in `lib/sms/send.ts` reads all four
and the whole feature is inert until every one is present — which is what makes it safe to have
merged:

| Variable | Notes |
|---|---|
| `SMS_PROVIDER` | `twilio`. The seam exists for one other; nothing else is implemented |
| `SMS_ACCOUNT_SID` | Public-ish, but keep it out of `NEXT_PUBLIC_` — nothing client-side needs it |
| `SMS_AUTH_TOKEN` | **Server only.** It is also what verifies the inbound webhook signature |
| `SMS_FROM_NUMBER` | The registered long code or toll-free number, E.164 |

With any of them missing, `sendSms` answers `{ sent: false, error: 'no SMS provider configured' }`
and the panel says *"Text messages are not switched on yet"* (`notify.smsNotOn`) rather than
offering a code that cannot arrive. **Check that sentence is gone from the screen** as the first
sign it worked — and check it in all three languages, since that string is a catalogue key like
every other.

**4. Validation, and "the API returned 201" is not it.** Send yourself a verification code from My
Profile → **Notifications** on a real handset, confirm it, then reply **STOP** to it and check the
consent status moves to *stopped* on that screen and that `grantSmsConsent` then refuses. That last
step is the whole of the legal model and is the one nobody tests.

**The panel was called "Text Messages" until `20260826000000`**, which replaced it with a
grid — a row per notification, a column per channel — over `notification_preferences`. Nothing
in the consent model moved with it: `person_sms`, `sms_consent_events` and
`phone_verifications` are untouched, and `sms_consent_events` is still the legal record. What
changed is only where a member expresses the choice, so every rule in this item survives the
rename. `components/personal-info/Notifications.tsx` is the screen.

**5. THE SMS COLUMN READS "Coming Soon" UNTIL THIS ITEM IS DONE, as of 2026-08-29,** and that
is one more thing to check when it is. It was a live switch beside a note saying texts were not
switched on yet — a control that collects a consent record for a message nobody can deliver,
which is the dead affordance this codebase refuses everywhere else. `cellState` in that
component is what decides it, from `smsAvailable`, so **setting the four variables above brings
the switches back with no code change**; nothing about it is a second flag to remember.

Two things about it that a change here must not undo. A member whose consent is already
`granted` KEEPS a working switch whatever `smsAvailable` says — rule 2 of that screen, *turning
it off is never harder than turning it on*, and hiding the control would make withdrawing
impossible. And the CATALOGUE is untouched: `sms: 'opt-in'` in `lib/notification-prefs.ts` is
still the right default for the day a provider lands, and marking it `'unavailable'` there
would make `setMyNotificationPref` refuse that withdrawal too.

Recorded 2026-08-23.

## The render diff is a RATCHET now, and it found four classes nothing else could

**Action:** run `npm run i18n:onscreen` after any pass over copy, and keep the ceiling at 0.
It is not in `verify.yml` and the reason is below — that is a decision rather than a gap.

Worked down 2026-09-01, from **37 distinct runs across 46 routes to 0**. About half were
genuine false positives that now sit in `EXPECTED_SAME` with a stated reason each; the rest
were real, and every one of them was invisible to `i18n:check` and `i18n:literals` with both
clean and both ceilings at zero.

### Running it

```
npx supabase start
npm run test:rls          # seeds the two-family fixture
npm run dev:local         # NOT `npm run dev` — see below
npm run i18n:onscreen
npm run i18n:onscreen -- --force-rtl
```

**`dev:local` IS NEW AND IT IS NOT A CONVENIENCE.** The documented invocation was three
`VAR=value` prefixes, which is bash — PowerShell reads the first as a command name and says so
— and the keys were written `<local anon>`, which a shell treats as a redirection. The syntax
error was the harmless half: `npm run dev` on its own uses `.env.local`, which points at
HOSTED, so the probe's forged session cookie matches nothing, every protected route renders
the signed-out shell, and the run reports a short tidy meaningless list. `scripts/dev-local.mjs`
discovers the local keys from `supabase status` so that cannot happen.

### The four classes it found, and why the static gates cannot

| | |
|---|---|
| **A formatter missing its locale** | `PremierGatheringHero` called `formatDateRange` with one argument, so the largest text on the Dashboard read "October 1 – 3, 2026" to every reader. There is no string to key — the defect is an argument nobody passed — and `i18n:check`'s PINNED-FORMATTER count reads 0 because every OTHER call site has a second argument. |
| **A registry holding English** | `GATHERING_STATUS_LABEL` and `GATHERING_TASK_STATUS_LABEL`, on six screens. `i18n:literals` rejects a lone capitalised word deliberately — otherwise every id and enum member in the tree is a finding — so a `Record<K, string>` of them is exactly its blind spot. Both are `function(t)` now. |
| **A sentence returned from `lib/`** | `stripeUnavailableReason()` returned English to ten actions. `lib/` is outside the literals sweep on purpose: the catalogues live there and their English IS the source. It returns a KEY now, and was RENAMED to `stripeUnavailableKey` so `typecheck` had to find all ten — changing the return value alone would have left them rendering `act.onlinePaymentsNotSetUp2` on screen, which is worse than the bug. |
| **Text stored in the database** | Every bell entry. See below — it needed a migration. |

Plus the two shapes the header already warned about: a bare `" in "` concatenated onto a
translated label inside an `sr-only` span, and `people === 1 ? 'Member' : 'Members'` on the
Dashboard, which no catalogue can hold because the plural rule is in the JSX.

### A NOTIFICATION IS THE ONE STRING THAT NEEDED A COLUMN

`20260901000004`. Every other string is chosen at RENDER time, when the reader is known. A
notification's text is chosen at EVENT time and read later by somebody else — so even a
perfectly translated writer composes it in the language of whoever triggered it. The row now
carries `title_key`, `body_key` and `params`, and the English stays as the fallback.

**Two things worth carrying forward from it:**

* **A CHECK constraint's function needs its `EXECUTE` grant, exactly as a policy's does.** The
  first draft revoked it and every authenticated write to `notifications` began failing. AGENTS.md
  §2b rule 2 names policies and not CHECKs; it is the same rule. Found — again — by the RLS
  suite's POSITIVE CONTROL, with every attack half green, because a function that errors refuses
  everybody equally.
* **There were TWO renderers of a notification.** Fixing `NotificationBell` left the Dashboard's
  Recent Updates card still reporting all three seeded titles, because `toUpdateItem` read
  `n.title` directly. Half a fix looks exactly like a whole one.

### Why it is a ceiling and NOT a `verify.yml` step

The ceiling, because without one this is a worklist somebody reads and forgets — every other
i18n gate here is a ratchet for that reason. Above 0 it exits 1.

Not in CI, and **not** for the usual "it needs the local stack" reason: that workflow already
runs `supabase start`, `db reset` and `test:rls`. Two harder facts:

* It needs a RUNNING APP — a build plus 92 route renders on every pull request.
* **It is fixture-dependent, which is the disqualifying one.** Half of what it reports is a row
  `tests/rls/seed.mjs` wrote, and `EXPECTED_SAME` excuses those BY CONTENT. Renaming a probe
  family or seeding a second dues schedule turns it red on a pull request that never touched a
  string, and a gate that cries wolf on unrelated changes is one people learn to ignore.

### What it still cannot see, and what that leaves owed

Its own header lists the limits; the two that matter are that **nothing behind a control is in
the markup** — every dialog's field labels, every confirm — and **nothing an empty fixture does
not render**. A clean run means the default state of 46 routes is clean, and no more than that.

**And one class it will never reach:** the seeded English in the DATABASE.
`Administrators`, `General`, the built-in `Donations` fund and its description are written in
English by `20260618000000` and `20260807000003`, so a Spanish family sees English names for
things they never chose. They are excused in `EXPECTED_SAME` because a per-family row cannot be
keyed — the honest fixes are seeding in the family's language at creation, or letting a family
rename them, and both are product decisions nobody has taken.

## Stripe fees: the two halves that are NOT built

**Action:** surface the fee on the member-facing dues screens, and subscribe the live webhook.

`20260831000003` and `lib/stripe-fees.ts` shipped the mechanism on 2026-08-31 — the actual fee
is captured from `balance_transaction`, apportioned per due, taken back out of the funds it was
routed into, and reported on the P&L as its own expense line. `family_stripe_accounts.fee_payer`
decides whether the family absorbs it or the charge is grossed up so the member covers it. Two
things were deliberately left.

**1. THE STRIPE ENDPOINT MUST BE SUBSCRIBED TO `charge.succeeded` AND `charge.updated`, and
until it is this feature is inert in a way nothing reports.** `settleChargeFee` is the only
writer of `stripe_charge_fees` and it runs only from those two events. An endpoint without them
keeps working perfectly — members pay, dues are credited, funds are routed — and the fee is
never recorded, fund balances stay overstated by it forever, and the P&L's processing-fee line
reads $0.00 over money Stripe demonstrably took. Nothing errors, because from the app's side no
event arrived. The endpoint table in the GO LIVE section above now names both.

**2. THE DUES STATEMENTS DO NOT SHOW IT YET.** The P&L does; `/reporting/dues-projections`,
`/dues` and `/payment-history` do not. The data is there — `dues_payment_fees` carries each
payment's share — so this is presentation, not plumbing. The decision it needs is whose figure
it is: under `fee_payer = 'family'` the fee is the FAMILY's cost and has no business on a
member's own payment history, while under `'member'` they were charged it and it belongs on
their receipt. So the member-facing surfaces probably show it only for the second, and the
projections (an organizer's screen) show it for both.

**And two smaller ones.** The manual says nothing about the setting — `help:check` passes
because Processing is not a new screen, so nothing gates this. And `stripe_charge_fees` records
only fees for charges this product posted (no matching `dues_payments` row, no fee row), which
is deliberate — a family's own unrelated charges on their account must not become an expense on
a P&L that never counted the income — but it means the figure is GENORRA's view of their fees
and not their whole Stripe bill. The panel's caption should probably say so.

Recorded 2026-08-31.

## WHERE THIS GOES NEXT: fifteen languages and fifteen countries, in priority order

**Action:** none yet. This is the target list the next two localization passes are measured
against, so that "add a language" stops being a decision made per pull request. Recorded
2026-08-31 at the same time as the Connect country picker, because the two lists constrain
each other and neither is useful alone.

**Read this with `npm run i18n:onscreen` beside it.** Three languages are shipped and the
product is not finished being read in the two that are not English — a fourth language added
before that number reaches zero multiplies the backlog rather than the reach.

### THE FIFTEEN LANGUAGES

Ordered by the audience this product actually has: a diaspora family whose relatives are
spread across countries. That is a different ranking from raw speaker counts — Mandarin has
more speakers than Portuguese and fewer extended families organizing a reunion across three
countries in it.

| # | Language | Why it is at this position |
|---|---|---|
| 1 | **Spanish** — shipped | The US's second language and Mexico's first. Already the strongest case in the product |
| 2 | **French** — shipped | Canada, Haiti, West Africa. Three diasporas, one language, and Canada is in the Connect set |
| 3 | **Portuguese (Brazil)** | Large families, strong reunion culture, and Brazil is in Stripe's cross-border set |
| 4 | **Haitian Creole** | The single strongest fit for this product's actual early users, and almost never offered. Not French: a Kreyòl speaker handed French is being told their language does not count |
| 5 | **Tagalog / Filipino** | Enormous US and Gulf diaspora, and family associations with dues are already a norm |
| 6 | **Vietnamese** | Same shape, same reason |
| 7 | **Arabic** | First **right-to-left** language, so it is where `dir="rtl"` stops being hypothetical — see the cost note below |
| 8 | **Korean** | Strong US diaspora and organized family associations |
| 9 | **Simplified Chinese** | Largest single addition by speakers; clan associations are the closest existing analogue to this product anywhere |
| 10 | **Traditional Chinese** | Taiwan and Hong Kong. A separate catalogue, not a conversion — the two are not interchangeable copy |
| 11 | **Hindi** | India is in the Connect set; English is widely read in the same audience, which is why it is not higher |
| 12 | **Yoruba** | Nigeria. Extended-family associations with dues are the norm and the language is under-served by software |
| 13 | **Igbo** | Same, and the two together cover most of the Nigerian diaspora's preference |
| 14 | **Swahili** | East Africa, and one language across several countries |
| 15 | **German** | Not diaspora — it is the strongest European market for a paid family product |

**THE FIRST RTL LANGUAGE IS NOT A CATALOGUE, IT IS A LAYOUT PASS — AND THE PASS IS DONE, as
of 2026-09-01.** Every item this paragraph listed is built: `dir` on `<html>` beside `lang`
(plus a boot script, because a flip after hydration is not the invisible attribute change
`lang` is), 430 physical utilities across 119 files converted to logical properties,
`MainRail`'s marker and `header-panel.ts`'s anchoring both mirroring, and the calendar's
Sunday-first week answered — **which turned up a live defect in a language already shipped:
France starts on Monday and the grid was Sunday-first for everybody.**

`npm run i18n:rtl` is a `verify.yml` step at a ceiling of zero and
`npm run i18n:onscreen -- --force-rtl` covers the runtime-built classes it cannot see. AGENTS.md
carries the rules, including the three things `dir` does NOT do.

**SO ADDING ARABIC IS NOW FOUR CATALOGUE FILES AND ONE `LOCALES` ROW**, and the row is
deliberately absent until those files exist: a locale in that array is a locale the switcher
OFFERS, and offering Arabic over 5,682 English keys would tell a reader their language counts
and then not speak it — the same failure the Haitian Creole entry above is about. What is still
owed with the catalogue, and is NOT layout: `firstWeekdayFor` already answers Saturday for
`ar`, and nothing has yet been READ by somebody who reads Arabic.

### THE FIFTEEN COUNTRIES

Ordered by whether a family there can actually be SERVED — a country is only worth adding
when its families can collect dues, and that is Stripe's list rather than ours. Every one
below is in Stripe's cross-border set, so each is a one-flag change in
`lib/stripe/connect-countries.ts` plus the currency work above.

| # | Country | Currency | Language it needs |
|---|---|---|---|
| 1 | **United States** — live | USD | English, Spanish |
| 2 | **Canada** — live | CAD | English, French |
| 3 | **Mexico** — live | MXN | Spanish |
| 4 | **United Kingdom** | GBP | English |
| 5 | **Nigeria** | NGN | English, Yoruba, Igbo |
| 6 | **Brazil** | BRL | Portuguese |
| 7 | **Philippines** | PHP | English, Tagalog |
| 8 | **India** | INR | English, Hindi |
| 9 | **Australia** | AUD | English |
| 10 | **Germany** | EUR | German |
| 11 | **France** | EUR | French |
| 12 | **Spain** | EUR | Spanish |
| 13 | **South Africa** | ZAR | English |
| 14 | **Kenya** | KES | English, Swahili |
| 15 | **United Arab Emirates** | AED | Arabic, English |

**FOUR THINGS THE TABLE HIDES, AND EACH IS A REAL BLOCKER RATHER THAN A TASK:**

* **NIGERIA AND KENYA ARE NOT SIMPLY "in the set".** Stripe's availability there is narrower
  than in the EU and changes; confirm per country against Stripe rather than against this
  table, which will go stale. They are high on the list because the AUDIENCE is strong, not
  because the plumbing is easy.
* **`lib/regions.ts` ADMITS THREE COUNTRIES.** A member's address picker is US, Canada and
  Mexico, so adding a country to Connect without adding it there gives a family a merchant
  account and nowhere to put an address. The two lists have to move together.
* **PHONE NUMBERS ASSUME +1.** `lib/phone-format.ts`'s `DEFAULT_COUNTRY_CODE` and `toE164`
  are written around North America, and `toE164` REFUSES what it cannot parse — which is the
  right behaviour and means a Nigerian mobile is silently unreachable for SMS rather than
  wrongly reachable.
* **A SECOND CURRENCY IS BUILT AS OF 2026-09-01, AND THE COST MOVED RATHER THAN VANISHED.**
  `families.currency` is derived from `families.connect_country` and threaded through every
  figure, so a family in Lagos would no longer set a due in dollars. What enabling a country
  now costs is **a migration as well as a flag**: `families_currency_check` and
  `families_connect_country_check` list the three enabled currencies by hand, deliberately, so
  a value nothing can format, price or charge a minimum against cannot be written. The CHECK
  and `CONNECT_COUNTRIES` have to move together.

* **AND STRIPE PUBLISHES NO MINIMUM CHARGE FOR NGN OR KES**, which is a blocker on rows 5 and
  14 rather than a detail. `stripeMinimumCents` in `lib/currency-utils.ts` is transcribed from
  docs.stripe.com/currencies and answers `null` for both — there is no safely-high fallback in
  a currency you do not know, and the failure of guessing low is a member choosing a small
  payment and meeting a hosted page that fails at the till. Establish the figure with Stripe
  before enabling either, and note that the minimum is measured in the SETTLEMENT currency
  after conversion, not the presentment one.

Recorded 2026-08-31.

## The billing ladder is built. Three things it deliberately did NOT do

**Action:** each is a decision somebody has to take, not work somebody forgot. Recorded
2026-09-01, when `20260901000001`–`20260901000003` built the delinquency ladder and the
sixty-day retention window. AGENTS.md carries the rules; this is only what is still open.

### 1. A DELETED PHOTOGRAPH LEAVES ITS BYTES IN A PUBLIC BUCKET

`delete_family_data_above_tier` removes `photos` rows and cannot touch storage — SQL does not
reach the backend, `storage.protect_delete()` refuses a direct DELETE, and a `pg_cron` job has
no Storage API to call. `staff_delete_family` has the identical limit and its ACTION deletes
the objects first; a sweep has no action in front of it.

**So a family whose Plus data is purged keeps every image file**, in a bucket that is
`public: true`, fetchable by URL to anybody who already has one. Two honest options, and the
first is much the smaller:

* **A reaper on the notice-drain path.** `/api/billing/notices` already runs Node daily with
  the service key. It could read `platform_data_deletions` for rows whose `deleted` mentions
  `photos`, list the family's prefix and remove what no row points at. Needs a marker so it
  does not re-walk the same deletion forever.
* **`pg_net` from the sweep**, which puts an outbound HTTP call in a transaction that deletes a
  family tree. Cheaper to write and much worse to reason about.

Until one exists, the deletion is honest about rows and silent about bytes, and this entry is
the only place that says so.

### 2. `CRON_SECRET` IS A GO LIVE STEP AND THE ENDPOINT REFUSES WITHOUT IT

`vercel.json` schedules `/api/billing/notices` daily at 00:40 UTC; Vercel sets
`Authorization: Bearer $CRON_SECRET` only if the variable exists, and the route answers **503**
when it is unset rather than running open. So an unconfigured deployment sends no dunning mail
— and therefore deletes nothing, which is the correct direction to fail but is not the intended
state. `VERCEL.md` has the setting and the `curl` to prove it by hand.

### 3. NOTHING TESTS THE LADDER END TO END, AND ONE THING STRUCTURALLY CANNOT

What IS tested: `20260901000002` §8 exercises the sweep for real against a throwaway family —
five rungs enqueued, the day-60 drop refused without its warnings and granted with them, the
person surviving, no second drop. `lib/platform-billing.test.ts` pins every boundary of the
derived stage. `tests/rls` covers the three retention actions.

What is NOT: **the mail.** `drainBillingNotices` resolves recipients from the permission grid
and composes nine messages, and no gate renders one. `npm run auth-email:check` is the shape to
copy — a hand-run script against the local stack that drives the queue and reads Mailpit — and
`realtime:check`'s header is the argument for why it stays hand-run.

The gap that matters inside that: **`billingAdmins()` walks `template_permissions` in
TypeScript rather than asking `auth_permission`**, because it answers for a FAMILY rather than
for a caller. If the two ever disagree, dunning mail goes to the wrong people or to nobody, and
nothing anywhere would say so.

## `http` is not installed, and one unbuilt feature wants it

**Action:** decide it when the weather poller is built. Nothing else wants it.

`pg_cron` went in with `20260823000006`, which schedules `apply_due_platform_tier_changes()`;
`20260901000002` added `platform-billing-ladder`. Both run ONCE A DAY since `20260901000005` —
00:05 and 00:20 UTC, in that order because the ladder measures state the sweep has just moved —
and both are created in a migration and asserted there, never in the dashboard. `pg_net` (0.20.3),
`http` (1.6) and `postgis` (3.3.7) are all AVAILABLE on this project and **none is installed**.

**THE LADDER DECLINED `pg_net`, WHICH IS THE PRECEDENT WORTH READING BEFORE INSTALLING EITHER.**
It needed to send email on a schedule and could have done it from SQL. It does not: `pg_cron`
owns the STATE and a Vercel cron drains a queue for the MAIL, because an outbound HTTP call
inside a transaction that also deletes a family tree is not a thing to add casually, and because
a queue in a table is recoverable in a way a fire-and-forget POST is not. `VERCEL.md` argues it.

That is not an argument against the extension in general — it is an argument that "the job needs
the network" is not on its own sufficient, and the alternative is usually a table.

**This said "the last extension anything wants" and that was falsified within four days**, by
`20260827000000`, which installs `unaccent` so full-text search folds accents — a thing
`20260819000005` had explicitly declined to do. The claim was never load-bearing, and the
correction is worth keeping rather than quietly rewording: **an entry that says "this is the
last one" is a prediction, and this file is not the place for those.** What is still true, and
is the whole item, is that `http` is wanted by exactly one unbuilt feature and by nothing else.

**What is still waiting on a scheduler**, in the order the value falls:

1. **Automatic dues reminders** — the last unbuilt Premium bullet whose two halves are both done
   elsewhere. `/reporting/dues-projections` computes what is owed and `app/actions/distributions.ts`
   is a working resumable per-recipient fan-out. FutureFeature.md §1 has the one decision it still
   needs (a uniqueness key on person/schedule/period, in the schema rather than in the job).
2. **Alert-driven check-in suggestions** — FutureFeature.md §5. A poller over `api.weather.gov`,
   which needs no API key, and the only thing in the product that wants `http`.

**`http` (synchronous) probably beats `pg_net` for that poller.** `pg_net` is fire-and-forget —
the response lands in a `net` table for a limited window, so a job that needs the body is two
passes and a reaper. A poll that fetches, matches and writes in one statement wants the
synchronous extension, with an explicit timeout so a hanging endpoint cannot wedge the job.

**Two things to carry into whatever is scheduled next, and the first is the one that will bite.**

* **A CRON JOB IS DATABASE STATE, which is the same invisibility class as realtime publication
  membership.** `db:check` compares migration versions, `db:audit` reads policies, and a fresh
  `db reset` schedules nothing. A job created in the dashboard is drift with nothing in the repo
  able to see it. **It must be created in a migration and asserted there** — the sweep's job is,
  and the next one must be too. AGENTS.md's "REALTIME NEEDS THE TABLE IN A PUBLICATION" is the
  same incident arriving through `cron.job`, and that section's warning about an instruction in a
  migration addressed to a person applies word for word.
* **A job has no `auth.uid()`, so it has no caller to authorize.** That is why the alert poller
  must SUGGEST and a person must RAISE (FutureFeature.md §5 argues it): automating the raise means
  inventing a system actor and hanging the family's most sensitive write off it, with §2b's rule
  about never taking an identity as a parameter standing in the way. Whatever is scheduled first
  sets the precedent for that, so it is worth deciding deliberately rather than by whichever job
  lands first.

Recorded 2026-08-23.

## GO LIVE: the Send Email hook is ON. What is left is proving it and retiring the fallback

**BUILT 2026-08-27, and TURNED ON — reported 2026-08-29.** The hook is configured on the
hosted project; steps 1–3 below are done and are kept as the record of what was done and in
what order, because turning it back on after a rollback is the same three steps and the order
still matters. `npm run auth-email:check` reports all five auth emails composed by this app,
in all three languages, with the right `type=` on every link and both halves of an address
change — and `20260827…`-era work has not touched that path since.

**Nothing in this repo can confirm the hook is on**, which is why this item does not close on
a report. `config.toml`'s `[auth.hook.send_email]` is `enabled = false` and stays that way —
that is the LOCAL stack, and AGENTS.md explains why it is off there (a local signup would then
need `npm run dev` answering, and without it every signup 500s and leaves no `auth.users`
row). The hosted flag is dashboard state, in the same invisibility class as realtime
publication membership and a `cron.job` row.

### WHAT IS ACTUALLY LEFT

1. **Send yourself a real signup and a real password reset, and look at both on a phone.**
   This is the whole remaining item. `auth-email:check` proves the bytes are composed; it
   opens no mail client and renders nothing. The GO LIVE item above already asks for this.
2. **Then delete `supabase/templates/*.html`** — see the second bullet under "THE TWO THINGS
   TO WATCH", which is now a live cleanup rather than a note. Until they go, the English
   exists twice and `email:push` keeps pushing a copy GoTrue no longer reads.
3. **Confirm `/api/auth/send-email` answers 401 to an unsigned POST** on production if it was
   not checked at step 1. That is the open-relay check and it costs one `curl`.

### THE ORDER IT WAS DONE IN, AND WHY GETTING IT BACKWARDS TAKES AUTH DOWN

GoTrue calls the hook SYNCHRONOUSLY, and a non-2xx rolls the whole operation back — measured:
a failing hook on a signup leaves no `auth.users` row at all. So a hook enabled before the
endpoint answers means **nobody can register, reset a password, or change their address**, and
every attempt fails with `unexpected_failure`.

1. **Merge to `master` and let it deploy.** `/api/auth/send-email` has to be live and
   answering before anything is switched on. Confirm with an unsigned POST — it must answer
   401, which is also the open-relay check. *(Done: `e0f03d5`, on `master`.)*
2. **Set `SUPABASE_AUTH_HOOK_SECRET` in Vercel** (all environments), and `RESEND_API_KEY` must
   already be there — it is, or no mail works today.
3. **Then** enable the hook on the hosted project: `hook_send_email_enabled`,
   `hook_send_email_uri = https://genorra.com/api/auth/send-email`, and
   `hook_send_email_secrets` = the same secret. Dashboard → Authentication → Hooks, or the
   Management API.

To undo, disable the hook. GoTrue falls straight back to `supabase/templates/*.html` — which
is exactly why item 2 above is "delete them once turning the hook off is not the plan" rather
than "delete them now".

### WHY IT IS NOT PUSHED FROM CI, WHICH IS A DECISION RATHER THAN AN OMISSION

`npm run email:push` sends only the ten mailer template fields, deliberately — see
`scripts/auth-templates.mjs`, and AGENTS.md on why it is not `supabase config push`. Adding
the hook fields to it would mean CI enabling an auth hook, and the failure mode is the one
above: a green deploy that has taken authentication down. A human doing step 3 after watching
step 1 land is the whole safeguard.

If it is ever automated, it has to be ordered AFTER the Vercel alias moves — which is
`migrate.yml`'s Deployment Check in reverse, and that is a mechanism nobody has built.

### THE TWO THINGS TO WATCH NOW IT IS ON

* **Auth mail now depends on the Next deployment.** It did not before. A build that fails to
  alias, or an outage, takes auth email with it — and a signup attempted during one leaves no
  account rather than an account with no email, so nothing is stranded. Worth knowing before
  reading a support ticket that says "I cannot sign up". **This is live behaviour now, not a
  future consequence.**
* **`supabase/templates/*.html` are FROZEN and now UNREAD in production.** They are the
  fallback, the English in them is a second copy, and `migrate.yml` still pushes all ten
  mailer fields on every merge — so a wording change made in the HTML reaches hosted and
  changes nothing anybody receives, which is the worst kind of edit to make by mistake.
  Change wording in `lib/email/auth-mail.ts`. Delete the HTML — and the `email:push` step
  with it — once the hook has been on long enough that turning it off is not the plan.
  **That deletion is now the second item on the list above rather than a someday note.**

## BUILD: the sitemap lists one URL per route, and there are now three

**Action:** emit `alternates.languages` on every entry in `app/sitemap.ts`. Recorded
2026-08-27, when the public site became three sites.

`/es/pricing` and `/fr/pricing` are real, indexed, canonical addresses — `LOCALIZED_ROOTS`
and `localizedAlternates` are what made them so — and `app/sitemap.ts` names neither. It maps
`MARKETING_ROUTES` to one English URL each, which is what it did when there was one language.

**IT IS NOT BROKEN, WHICH IS WHY THIS IS A BUILD AND NOT A BUG.** Every localized page carries
its own `hreflang` set in the head, naming all three, and that is sufficient for a crawler to
discover and consolidate them — the head and the sitemap are two ways to say one thing, and the
page-level one is the one Google documents as adequate on its own. So the Spanish and French
pages are findable today; they are simply found by following a link rather than by being
announced.

What emitting them buys is discovery for a page nothing links to yet, and a slightly faster
first crawl of a new locale. Next supports it directly on a sitemap entry:

```ts
...MARKETING_ROUTES.map(route => ({
  url: `${SITE_URL}${route.href}`,
  alternates: { languages: localizedAlternates(route.href, BASE_LOCALE).languages },
  lastModified, changeFrequency: route.changeFrequency, priority: route.priority,
})),
```

**Two things to get right, and the second is the trap.** The x-default entry must point at the
unprefixed English URL, which is what `localizedAlternates` already returns rather than
something to hand-write. And `npm run sitemap:check` compares a DATE against the newest commit
touching the public pages — it says nothing about which URLs are listed, so it will stay green
through this whole item and cannot be the thing that tells you it is done.

## BUILD: greet a relative on their birthday, and make it feel like a celebration

**Action:** decide what "automatic" means here, then build it. Recorded 2026-08-25, out of the
lede sweep — the Birthdays pane used to spend a sentence apologising that **nothing is sent
automatically**, and a caption explaining what the product does not do is a feature request
wearing a caption's clothes.

**What exists today.** `/community/announcements?pane=birthdays` lists every relative with a
birthday in the next `BIRTHDAY_HORIZON_DAYS` (60), soonest first, one click from the composer.
That is a list an organizer works through by hand. Nothing is posted, nothing is mailed, nothing
appears on the dashboard, and a birthday that passes unremarked leaves no trace anywhere.

**Three decisions before any code, and the first is the whole feature.**

1. **WHO GREETS — the family, or the product?** A card the product posts in the family's name is
   the cheap version and is worse than nothing: a relative who realises the warm message was
   generated has been told the family did not remember. The alternative is that the product
   PROMPTS — the dashboard says "It's Ada's birthday today" with a composer already open — and
   every word that reaches Ada was typed by a person. **Prefer the second.** It is also the only
   version consistent with the Birthdays pane's own design, which has always been a list to act
   on rather than a machine.
2. **WHERE IT LANDS.** A dashboard band on the day is the obvious surface and reaches only
   whoever opens the app. An announcement pinned for the day reaches everybody and costs a row in
   `announcements` that nobody chose to write. Email is the loudest and needs the distribution
   rules in "MAILING THE WHOLE FAMILY IS A QUEUE IN THE DATABASE" — including that a recorded
   relative's placeholder address must never be mailed.
3. **WHAT "CELEBRATION" MEANS ON SCREEN.** Confetti, a gold band, the person's avatar at size.
   Whatever it is, it is `--brand-legacy` or `--brand-warm` territory and never `--destructive`;
   and it has to degrade to something dignified for a relative with no photograph and no
   recorded birth year, which is most of an older generation on a real family tree.

**Two things the schema already gives you and one it does not.** `people.date_of_birth` is there
and `lib/age-utils.ts` derives from it — and **a NULL birthday is not a birthday**, the same
reading `isMinorOn` takes, so nobody with a blank field is ever greeted or ever counted as
missed. `lib/birthdays.ts` already computes the horizon list. What does not exist is any record
that a greeting HAPPENED, so "did anyone say anything to Ada?" is unanswerable — and without it a
prompt reappears every year whether or not the family acted on it last time.

**And there is no scheduler**, which is the constraint that shapes the whole thing. `pg_cron` is
installed (`20260823000006`; see the `http` item above) but nothing in the product runs on a clock except the
Stripe webhook's opportunistic sweep. A prompt rendered when somebody OPENS the app needs no
scheduler at all and is another reason to prefer option 1.

## `tests/rls` has no member who has replied STOP

**Action:** add a `stop_received` consent event to one ALPHA actor in the fixture, and a case
asserting `grantSmsConsent` refuses them.

`SMS_CONSENT_CASES` in `tests/rls/cases.mjs` names this as a stated gap and it is the one thing in
the consent model with no runtime assertion. The rule it would cover is the sharpest one there:
**a carrier-level opt-out is revoked by the handset, never by a checkbox on a website**, so
`grantSmsConsent` refuses a `stopped` person and `consentStatus()` ignores a `granted` event folded
over a STOP.

**Both halves are tested — separately, and that is the gap.** `lib/sms/consent.test.ts` covers the
FOLD by value and by mutation (removing the guard trips exactly one case). The ACTION's refusal is
covered by nothing, because the fixture has no stopped member and the only way one arrives today
is by texting STOP to an inbound webhook that does not exist.

**Seeding it directly is legitimate and is the fix.** The event is an ordinary row —
`{ event: 'stop_received', source: 'sms_reply' }` — and writing it in `seed.mjs` needs no provider.
Worth doing on a THIRD actor rather than on `alphaMember` or `alphaOther`: both are already
positive controls for the grant and withdraw cases, and a stopped actor cannot be a control for
either (`deletableChild`'s rule).

While there: the same fixture addition makes `smsBlockReason`'s `stopped` branch reachable from an
action-shaped case, which is currently only exercised as a pure function.

Recorded 2026-08-23.

## Meta: `Lead` has no surface, the validation table is owed, and nothing reports on it

**Action:** walk the validation table on a preview deployment, decide what a `Lead` is here, and
build the campaign-to-paying-family report.

**The money half is wired.** `lib/stripe/platform-events.ts` calls `trackSubscriptionPayment`
from the verified webhook after Stripe confirms the charge, and `app/actions/billing.ts` calls
`trackCheckoutStarted` when a hosted Checkout Session is created. The four rules that call site
has to keep — the id is the CHARGE and never the subscription, `firstPayment` comes from the
PROVIDER, `amountCents` comes from the transaction rather than from `TIER_PRICE`, and a renewal
is deliberately not a `Purchase` — are argued at length in `lib/meta/billing.ts`, which is where
a future edit meets them.

**`Lead` still waits for a real lead surface.** There is no waitlist, demo request or newsletter
in this product, and using `Lead` to mean "viewed pricing" would make a Lead-optimised campaign
chase readers instead of prospects.

**Validation, now checkable and therefore OWED rather than hypothetical.** It needs
`META_TEST_EVENT_CODE` and a Stripe test key on the same preview deployment:

| | |
|---|---|
| Refresh the success page repeatedly | One `Purchase` in Test Events, not one per refresh |
| Replay the webhook from Stripe's dashboard | Still one — `stripe_webhook_events` refuses the second delivery before Meta is ever reached |
| Let a renewal charge settle | `SubscriptionRenewal` only. **No `Purchase`, no `Subscribe`** |
| Compare `value` against the Stripe charge | Dollars, not cents. A $5.00 charge reported as `500` is the failure |
| `SELECT * FROM marketing_conversion_events WHERE delivery <> 'sent'` | Empty, or a readable reason in `detail` |

**And the reporting half is one join rather than none.** `marketing_attribution` records which
campaign found each account, and the question it exists to answer — *which campaign produced this
paying family?* — is answerable the moment `platform_payments` has rows in it. A `/reporting`
screen for it is the natural follow-up, and the join is `marketing_attribution` → account →
`people.family_code` → `platform_payments`.

Recorded 2026-08-23.

## Four smaller Stripe follow-ups, none of them urgent

**Action:** four short conversations and a few hours of code, in whatever order they come up.

1. **A FAMILY'S BILLING EMAIL. There is deliberately no column for one.**
   `ensureCustomer` in `app/actions/billing.ts` creates the Stripe customer with the family's
   NAME and no email, and Stripe collects one on the hosted page instead. The obvious value —
   whoever happened to press the button — is wrong the moment that administrator leaves the
   family, and it is where Stripe would mail every future receipt and dunning notice. So it
   wants to be a field on Family Settings, chosen once, and it is not built.

2. **DOES GENORRA TAKE A CUT OF FAMILY DUES?** Today: no.
   `app/actions/pay-dues.ts` sets no `application_fee_amount` and there is no column to hold
   one. That is a real decision rather than an omission — direct charges permit it, so adding
   one later is a line of code, whereas taking one now and reversing it means refunding
   families. If it is ever wanted, the fee has to appear on the member's own screen before they
   pay: a family collecting $40 of dues and receiving $38 needs to have been told.

3. **v2 EVENT DESTINATIONS for connected-account capability changes.** Accounts are created
   through the v2 API, whose capability events —
   `v2.core.account[configuration.merchant].capability_status_updated` — travel through EVENT
   DESTINATIONS rather than a v1 webhook endpoint, and that is not wired up. The Connect handler
   listens for the v1 `account.updated` instead, which still fires and carries enough; and
   `refreshProcessorStatus()` pulls the account on demand, which is the path the return-from-
   onboarding page uses and does not depend on any webhook. So this is a robustness item, not a
   gap: worst case a treasurer presses **Check with Stripe**.

4. **CLOSING THE `STRIPE-INERT` VERDICT.** Eleven actions in `scripts/rls-coverage.mjs` have no
   RLS case because they refuse on a missing credential before they query anything, so a case
   would assert the credential check and pass with every family conjunct deleted. Giving
   `tests/rls` a Stripe TEST key would make all eleven reachable and turn each verdict into a
   real case — and would make the suite talk to the network, which is a slower and flakier
   suite. `BACKLOG_CEILING` was raised from 57 to admit them (69 today) and its own comment carries
   the trade.

Recorded 2026-08-23.

## The consent banner has no privacy policy to link to

**Action:** write a privacy page, then link it from the banner. It was "one route, one link"
when this was recorded; **since 2026-08-27 the public site is three sites and it is four
things.** See the cost below — the second one fails `npm test` rather than shipping quietly.

`components/consent/ConsentBanner.tsx` names Meta, says what the measurement is for, and
states the boundary — no names, relationships, birthdays, photographs or messages — because
"we use cookies" tells nobody anything. What it does not do is link anywhere, and that is
not a design choice: **there is no privacy policy page in this product.** `app/(marketing)`
holds About, Features, How It Works, Pricing and Why Us, and nothing else.

That is a gap the Meta integration makes sharper rather than one it created. A product
holding family trees and children's records should have had one before it had a Pixel, and a
consent banner that asks for agreement while pointing at no policy is the version of the gap
somebody notices.

**Two things to get right when it is written.** It goes under `app/(marketing)` and is
therefore indexable, unlike everything behind the login (`app/(protected)/layout.tsx` sets
`robots: { index: false }`). And it needs its own `alternates: { canonical: '/privacy' }`
like every other page there — a canonical in the shared layout would tell Google that six
pages are duplicates of one, which AGENTS.md calls the one metadata mistake worse than
having none.

`lib/marketing-nav.ts` is what puts it in the header, the footer and the sitemap at once, so
adding it there is the whole of the wiring. `npm run sitemap:check` and `npm run help:check`
will both have opinions.

**AND SINCE 2026-08-27 IT IS A THREE-LANGUAGE PAGE, which is most of what this now costs.**
Re-checked 2026-08-29:

1. **`LOCALIZED_ROOTS` in `lib/i18n/route-locale.ts` needs the entry**, or `/es/privacy` and
   `/fr/privacy` 404 while the English one works — invisible in English and invisible in a
   build. It will not ship quietly: `lib/i18n/route-locale.test.ts` reads `app/(marketing)`
   off disk and asserts every directory in it is on that list, so **the page fails `npm test`
   until it is added**, and the failure names the route. That gate is the reason this is a
   line item rather than a hazard.
2. **The copy is catalogue keys in `lib/marketing/strings/{en,es,fr}.ts`**, not prose in the
   component. `npm run i18n:literals` has a ceiling of ZERO and is a `verify.yml` step, so a
   privacy policy typed into JSX is a red build — and a privacy policy is a page of prose,
   which makes it the largest single addition either bundle has taken.
3. **A legal document translated by this pass is a legal document nobody has reviewed in
   Spanish or French.** That is not the testimonials rule (a translation is an edit of words
   somebody actually said) but it rhymes with it, and it is a decision for a person: publish
   three reviewed versions, or publish English and say so on the localized routes. Deciding
   it is part of writing the page.
4. Then the `alternates` block, exactly as every other page there has it.

Recorded 2026-08-23; the i18n cost added 2026-08-29.

## DONE 2026-08-31: sorting is on every table that should have it

**No action.** Kept because the four decisions below are the ones a new table has to make, and
because three of them are about tables that deliberately do NOT sort.

`lib/sort-rows.ts` (pure, 18 tests, eight mutations measured) plus `useTableSort` and `SortTh`
in [components/ui/sortable-header.tsx](components/ui/sortable-header.tsx) are the mechanism.
Seventeen more tables across eleven files were converted on 2026-08-31, joining
`MemberDirectoryClient`, `AdminAccessClient`, `DuesPlanSection` and `PaymentHistorySection`.

**`SortTh` WAS MISSING `scope="col"` THE WHOLE TIME**, while every hand-written `<th>` in the
app carried it — so the four tables that already sorted had been announcing their cells without
a column since the component was written. Fixed in the component, which fixed all four.

### Four tables do not sort, and each refusal is a different rule

| | |
|---|---|
| the dues-routing waterfall, view AND edit (`AdminFundsClient`) | the row order IS the datum — funds fill in sequence, the first column is that ordinal, and the edit table exists to change it |
| the template steps table (`AdminGatheringTemplatesClient`) | same shape: `StepRow` takes `isFirst`/`isLast`/`onMove`, and "move up" is incoherent under a table sorted by budget |
| `StaffFamiliesClient`, `StaffAccountsClient` | SERVER-PAGED. A client sort orders the 25 rows on screen and looks like it ordered 400 — and Accounts pages through GoTrue's `listUsers`, which cannot order at all, so there is no server-side version to reach for either |

`AdminGatheringTemplatesClient` turned out to hold **only** that steps table — its library is
cards — so the file drops off the list entirely. `DonutChart` and `MonthCalendar` use `<th>` for
a chart axis and a weekday header, and `components/ui/table-collapse.tsx` is the shared
primitive rather than a table; none has rows to order.

### The four decisions, which are what a new table has to make

**1. THE DEFAULT REPRODUCES THE ORDER THE LIST ARRIVES IN.** `useTableSort` has no unsorted
state, so every conversion picks the key that reproduces first paint, and where the incoming
order is a decision somebody made, that is a constraint rather than a preference. Three shapes
came up:

* **A single column says it** — `.order('label')`, `.order('name')`, `.order('starts_on')`.
  Most tables. Pass that key; the stable sort even preserves the secondary `.order()`.
* **A composite says it** — `DuesProjectionsClient`'s member table is already sorted standing,
  then outstanding descending, then name, and the lede says "Least settled first". `sortRows`
  is STABLE, so sorting the already-sorted array by standing alone leaves the other two keys
  exactly where they were. The default is reproduced to the row.
* **Nothing printed says it** — a gathering's tasks are ordered by `position`, the narrative
  the organizer authored, and no heading corresponds to it. Those take an extractor named
  `authored` **with no heading**: nothing shows an active arrow until a heading is pressed. The
  cost is that the authored order cannot be returned to without reloading.

The one default that CHANGED is `AdminBoardPositionsClient`, and deliberately: its `sort_order`
is `max + 1` on create with no reorder control anywhere, so it records the order somebody
happened to add the offices in — not a fact the screen prints or a reader could infer.

**2. AN ENUM SORTS ON THE PRINTED LABEL, NOT ON A RANK — WITH ONE EXCEPTION.** Alphabetical by
the word in the cell is what a reader can predict, and it is locale-correct for free because
`useTableSort` threads the `Intl` tag. A rank has to be INVENTED, and on the staff console
inventing one would have meant saying something about support versus engineer that
`lib/auth/staff.ts` is explicit nothing distinguishes. The exception is
`DuesProjectionsClient`'s Standing, where `STANDING_ORDER` was not invented — the screen
already shipped it, already sorts by it and already draws its pills in it.

`PaymentLedger`'s Status is the sharpest case FOR the label: the pill reads "Reversed" or
"Correcting entry" for rows whose stored `status` is an ordinary `'paid'`, so ordering by the
column would file a reversed payment among the paid ones under a heading plainly saying
otherwise.

**3. SORT THE VALUE THE CELL IS BUILT FROM.** Money on `amount_cents` — about twenty currency
columns in this pass, and "$9.00" sorts after "$10.00" as text. Dates on the stored
`YYYY-MM-DD`, which is chronological as a string, so no `Date` is built and no timezone moves a
row a day from the date printed beside it. And `AdminRegionsChaptersClient`'s Attached column
sorts on a TOTAL of the five counts its caption is assembled from — returning `0` rather than
`null` for nothing-attached, so ascending answers "what can I delete?" instead of burying those
rows as blanks.

**AND AN EXTRACTOR MUST READ ITS OWN ROW AND NOTHING ELSE** — the one defect in this pass that
survived typecheck, lint and build, caught on review rather than by a gate. `useTableSort`'s
memo depends on `rows` and deliberately not on the extractor map, so a column COMPOSED FROM
ANOTHER LIST re-renders its cells with the new figure while keeping the order derived from the
old one. Three tables here do that — a region's chapter count out of `chapters`, a milestone's
fund name out of `funds`, a segment's task count out of `tasks` — and all three panes write
optimistically with **no `router.refresh()`**, so nothing comes along to correct it: an
ascending sort by chapter count sits there showing 5 above 3 for the rest of the visit.

A `deps` parameter on the hook was the obvious fix and **cannot be written**: the React
Compiler lint rule requires that dep list to be an array literal, so there is nothing to spread
into. The answer is to compose the value onto the row in a `useMemo` of the caller's own that
lists the other array — `regionRows`, `milestoneRows`, `segmentRows` — and let the extractor
read the field. That is also the contract the hook documents, and it has a second benefit worth
copying: the milestone Fund cell now reads `m.fundName` instead of running its own second
`funds.find`, so the column's order and both places its text is drawn are one value.

**4. TWO COLUMNS WERE LEFT UNSORTABLE FOR THEIR OWN REASONS**, which is a legitimate outcome:
`BirthdaysPane`'s **Turning**, because `birthdayAge` withholds a number for 30–60 and a sort
keyed on the true age would let a reader read a withheld age off its position; its **Day**,
because a weekday's alphabetical order is nonsense and the row carries no weekday index; and
`GatheringDetailClient`'s **Answer**, because `answer` is JSONB whose shape depends on `kind`.

### Two things fixed on the way through

**`DuesProjectionsClient`'s ten headings were English in all three languages** — the
lone-capitalised-word class AGENTS.md says `i18n:literals` structurally cannot see and only the
render diff can. Six new `proj.col*` keys in all three catalogues; `proj.collected` and
`proj.waived` already existed for the figure tiles on the same screen and are reused rather
than duplicated. **`AdminFundsClient`'s "% of dues"** was the same defect and now uses
`fnd.shareOfDuesPrefix`, the key its own folded `RowMeta` copy was already labelled with.

**`LedgerTable` was widened rather than unpicked.** Four ledgers share it, and a column opts
into sorting by naming its key (`sort: 'amount'`); a generic ties that to the caller's
`useTableSort` map, so naming a column that does not exist is a compile error. Four copies
would have been four chances to sort a rendered string. `PaymentLedger`'s hook had to move
ABOVE its `rows.length === 0` return — a hook after a conditional return breaks exactly when a
ledger takes its first row.

**One asymmetry is still deliberately unresolved.** Both member tables sort Name on the
DISPLAYED name rather than on surname, which is the less useful order — `MemberRecord` has
`last_name` and `MemberSummary` carries a pre-joined `name`, so surname order on both needs
`lastName` added to `MemberSummary` server-side. Until then the two agree, which is what "a
table is a table" is about. Both call sites say so; if that field is ever added, move both.

**And a text column sorts in the READER'S alphabet, which costs a conversion nothing.**
`compareValues` and `sortRows` take an `Intl` tag and **`useTableSort` calls `useIntlTag()`
itself**, so a table converted the ordinary way is locale-correct with no extra line. It
matters because `ñ` is a letter of its own in Spanish and files after `n`, and `sensitivity:
'base'` does not collapse it — measured. The tag defaults to `'en'` rather than `undefined`
deliberately: passing `undefined` asks the RUNTIME, and a comparator that answers differently
on two hosts is a row order nothing in this repo decides.

**Where it still costs something is a table that sorts by hand.** `DuesPlanSection` and
`PaymentHistorySection` use `SortTh` with their own state and their own comparators rather
than `useTableSort` — they sorted before any of this existed and share only the HEADER. Both
already hold an `intl` from `useIntlTag()` for their money and date formatting, so if either is
ever moved onto `useTableSort`, the tag is the thing to check reached the comparator and not
just the labels.

Recorded 2026-08-21; completed 2026-08-31.

**Three things to carry into each one**, all learned on a conversion rather than guessed. Sort
the value the cell is BUILT from, never the string it prints — a money column sorts on
`amount_cents` or "$9.00" lands after "$10.00", and a date sorts on `YYYY-MM-DD` or the column
orders by month name. And where a column is composed in the browser rather than carried on the
row, sort through the SAME lookup the cell renders from: Members & Access's Position reads
`board.holders`, because `MemberSummary` has no title on it.

**And since 2026-08-27 a text column sorts in the READER'S alphabet — which costs a conversion
NOTHING, and is worth knowing so nobody re-plumbs it.** `compareValues` and `sortRows` take an
`Intl` tag, and **`useTableSort` calls `useIntlTag()` itself** and threads it, so a table
converted the ordinary way is locale-correct with no extra line. It matters because `ñ` is a
letter of its own in Spanish and files after `n`, and `sensitivity: 'base'` does not collapse
it — measured. The tag defaults to `'en'` rather than to `undefined`, deliberately: passing
`undefined` asks the RUNTIME, and a comparator that answers differently on two hosts is a row
order nothing in this repo decides.

**Where it does cost something is a table that sorts by hand.** `DuesPlanSection` and
`PaymentHistorySection` use `SortTh` with their own state and their own comparators rather
than `useTableSort` — that is what "sorted before any of this existed and now share the
module" means above, and it is only the HEADER they share. Both already hold an `intl` from
`useIntlTag()` for their money and date formatting, so if either is ever moved onto
`useTableSort`, the tag is the thing to check reached the comparator and not just the labels.

**One asymmetry is deliberately unresolved.** Both member tables sort Name on the DISPLAYED name
rather than on surname, which is the less useful order — `MemberRecord` has `last_name` and
`MemberSummary` carries a pre-joined `name`, so surname order on both needs `lastName` added to
`MemberSummary` server-side. Until then the two agree, which is what "a table is a table" is
about. Both call sites say so; if that field is ever added, move both.

Recorded 2026-08-21.

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
  `family_action_challenges`: the challenge is minted in TypeScript and consumed by
  `consume_family_action_challenge`, and the browser must never read a hash it could compare
  against. Both are the §2c pattern working as intended, and both would be a finding if they
  ever gained a policy. *(That table was `family_removal_challenges` when this was measured;
  `20260825000000` generalised it — a `purpose` column and a second caller, disconnecting
  Stripe — which changes the name and none of the argument.)*

* **`unused_index`, and it got LOUDER on purpose — 15 findings locally became 88.**
  `20260822000014` created 73 foreign-key indexes, and an index on a database with no traffic
  has by definition never been scanned. This is not a regression and must not be "fixed" by
  dropping them: index-usage counters on a product no family is using yet measure nothing, and
  Postgres does not index the referencing side of a foreign key, so without them one parent
  delete seq-scans the child table once per row. **The review this deserves is after there are
  families**, against `pg_stat_user_indexes` on hosted, and it is a review rather than a fix.

## Function grants: `anon` is exercised by one case, and deserves more

`20260806000015` and `20260806000016` closed the anon-callable-function hole and the
reasoning is now AGENTS.md §2b. **The first of its two loose ends is closed**:
`get_my_family_code()` is dropped (`20260831000000`), after asking the database rather than
the repo — no policy, no function body, no view and no app code referenced it, and that
migration's verify block re-asks all three before it drops, so a hosted database that has
drifted into using it fails the deploy instead of losing the function underneath a live
policy. `auth_family_code()` is the one resolver now.

**What survives is the test gap.** `tests/rls` exercises `anon` through exactly ONE case.
That is one more than before and fewer than the role deserves — it is the role the browser
bundle's key speaks as, and §2b's whole argument is that a function in `public` is an
unauthenticated HTTP endpoint. The three worth adding first, because each is granted to
`anon` deliberately and so cannot be covered by asserting a blanket refusal:
`peek_family_invitation`, `validate_family_code` and `join_family_by_code` — the three
doors a stranger can knock on, and the three that must answer the same message for a
family that does not exist as for one that was removed.

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

That is one resource, on one action, and a DELETE. What was still missing — and what the fifth
actor was really for — was an `'own'` grant on a resource with a **read** to narrow, which is
where a wrong `own_expr` would quietly hand over rows instead of quietly refusing them.

**THE READ HALF ARRIVED 2026-08-23, and it needed no fifth actor.**
`community/safety-check-ins` gives the General template `view: 'own'`, so `alphaMember` is now an
own-scoped READER on an existing template — and `safety-check-ins.getCheckIns (an ordinary member,
scope own)` is the suite's first case whose answer is decided by the `'own'` disjunct and a
`self_expr` rather than by `= 'any'`. It asserts both directions at once: the member reaches the
screen, AND `rosterVisible` is false for them while true for `alphaAdmin` on the same data.

**It also caught a real bug on its first run, which is the argument for the rest of this entry.**
`20260823000002` §10 backfilled the General templates that EXISTED and did not teach
`seed_family_permission_templates()`, so every family created afterwards got `view: 'none'` and
`requireView` answered 404 — the feature's own members locked out of answering. Found by querying
a freshly reset database, not by any gate, because that migration's assertion was written as
`IF EXISTS (a General template) AND NOT EXISTS (…)` and on a fresh chain there is no template yet
for the guard to find. `20260823000003` fixes both halves and asserts the FUNCTION SOURCE, which
cannot skip. Mutation-checked by reverting the seed function in place: the new case goes red with
`unexpected: null`.

**What is left is narrower than it was**, and worth restating so nobody re-does the done part:

* an own-scoped read where the `own_expr` names a **column on the row** rather than reaching
  through a parent. `community/safety-check-ins`' is `raised_by = auth_person_id()`, which is that
  shape — so this may be closed already and wants a mutation check rather than new fixture work.
* an own-scoped **write** narrowed by an `own_expr` on a resource where the row is not the
  caller's own by construction. `gatherings` (`created_by`), `announcements` and `chat_messages`
  are still waiting.
* and `resolveScope` in `lib/auth/permissions.ts` is pure enough to test under vitest, which
  remains the cheaper half of the original entry and is untouched.

Recorded 2026-08-19; narrowed 2026-08-20 and again 2026-08-23.

## Photo thumbnails download at full size

**Action:** pick one of the three below. It is an infrastructure decision, not a code change.

`npm run lint` is `eslint --max-warnings 0` since 2026-08-20 and the Lint step in
`verify.yml` blocks on a single warning. What that closed was the *reporting* question; this
is the thing the last of those warnings was actually pointing at, and it is real.

`/community/gallery` renders a grid of thumbnails at a quarter width, and each `<img>` fetches
the **whole uploaded file** — `uploadPhoto` caps at 10 MB, so a twenty-photograph album can
be 200 MB of downloads to show twenty thumbnails. On a phone, on a family's data plan.

*(It was `/review/photos` until 2026-08-22, and the components moved with it: the three sites
carrying the disable are `components/gallery/CollectionCard.tsx` and two in
`components/gallery/CollectionView.tsx`. Re-checked 2026-08-29 — still three, still plain
`<img>`, still no `images.remotePatterns` in `next.config.ts` and still no thumbnail column
on `photos`.)*

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

**Nothing open.** The two findings that came out of building `tests/rls` (see AGENTS.md §7)
are both closed.

The heading stays because the next finding of this shape belongs under it.

