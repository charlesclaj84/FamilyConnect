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
| **Connect** | `https://genorra.com/api/stripe/connect` | the first four above, plus `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated` |

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
`app/actions/sms-consent.ts`, My Profile → **Text Messages**); the sending half is not, and this
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
and the profile panel says *"Text messages are not switched on yet"* rather than offering a code
that cannot arrive. **Check that sentence is gone from the screen** as the first sign it worked.

**4. Validation, and "the API returned 201" is not it.** Send yourself a verification code from My
Profile → Text Messages on a real handset, confirm it, then reply **STOP** to it and check the
consent status moves to *stopped* on that screen and that `grantSmsConsent` then refuses. That last
step is the whole of the legal model and is the one nobody tests.

Recorded 2026-08-23.

## BUILD: the delinquency ladder — decided 2026-08-23, and it needs the scheduler first

**Action:** build it. `pg_cron` is installed as of `20260823000006`, so the ladder is no longer
blocked — it needs its own daily `cron.schedule` line in the migration that builds it, asserted
in the same file the way the tier sweep's is.

What is built today is the DATA and nothing else: `invoice.payment_failed` stamps
`platform_billing_accounts.delinquent_since` and `last_payment_failure`, the Billing band says
so, and no tier moves. Everything below is the decided policy, recorded so it can be built in
one pass.

### The ladder

Day counted from `delinquent_since`. Every email goes to the ADMINS, meaning **whoever holds
`admin/settings:edit`** — the exact grant that opens the Billing panel and can actually pay
(decided; see "who is an admin" below).

| Day | What happens |
|---|---|
| 0 | `invoice.payment_failed`. `delinquent_since` stamped. Nothing else. |
| 5 | Email every admin asking for payment. Full access continues. |
| 10 | **Members are locked out.** Only admins can sign in. Email every admin saying access is limited until the account is paid. A member signing in sees a message telling them to contact their family administrator about an accounting issue, and can do nothing else. Admins keep FULL access. |
| 30 | **Admins lose full access too** — every screen except the one that takes a payment. Reactivating requires paying **all arrears plus the next month**. |
| 45 | Email: the account will be **deleted** in 15 days. |
| 59 | Email: it will be deleted **tomorrow** unless payment is received. |
| 60 | **The family's records are deleted. This cannot be undone.** |

### Six things to get right

1. **EVERY DELETION EMAIL SAYS IT CANNOT BE REVERSED, in those words.** The day-45 and day-59
   emails and the day-30 lockout screen all carry it. This is the one requirement stated twice
   in the brief and it is the one a summary would smooth over.
2. **THE LOCKOUT IS A GUARD, NOT A TIER.** `families.tier` must not be touched — no policy
   consults it, and a family that pays on day 29 has to find everything where it was. It
   belongs beside `requireFamilyActive` in `requireView`/`requireViewOrPending`, which is where
   the removed-family check already lives and where a page cannot forget it. The day-30 state
   needs its own `REMOVED_FAMILY_RESOURCES`-shaped exemption list containing only the billing
   screen.
3. **"PAY ALL PREVIOUS AND NEXT MONTH" IS ARITHMETIC NOBODY HAS WRITTEN.** It is arrears (every
   month since `delinquent_since`) plus the coming month, and it belongs in
   `lib/platform-billing.ts` as a pure function with tests — not in an action, and not left to
   Stripe's own invoice total, which is what it happens to be rather than what was decided.
4. **A MEMBER MUST NOT BE TOLD IT IS A MONEY PROBLEM IN DETAIL.** "Contact your family
   administrator to resolve an accounting issue" is the whole message. What the family owes
   GENORRA is not every relative's business.
5. **THE DELETION IS THE SAME MECHANISM AS THE 60-DAY DATA DELETION BELOW** — one hard-delete
   path, two callers. Writing it twice is how one of them ends up missing a table.
6. **AN ADMIN WHO PAYS ON DAY 59 MUST BE FULLY RESTORED BY THE `invoice.paid` HANDLER**, which
   means clearing `delinquent_since` (it already does) AND unwinding the lockout in the same
   transaction. A family that pays and stays locked out is the worst possible bug here.

### RESOLVED: a family with no admin who could pay

That hazard is closed rather than mitigated. `20260823000007` makes "a family with approved
members always has at least one `admin/settings:edit` holder" an invariant enforced by three
triggers, so the state the ladder could not recover from is now unreachable: moving the last
holder to another template, switching them off, or taking the grant off the template that
carries it are all refused, by the database, including through the service role.

Two things about it are worth knowing before touching that migration:

* **It refuses a statement that TAKES THE LAST HOLDER AWAY, not one that leaves a family
  without one.** The obvious rule is the second, and it makes an already-broken family
  UNREPAIRABLE — granting the missing permission is itself a template write. That was the first
  version, and `tests/rls` caught it by refusing the very statement on its way to fixing things.
* **It fires on UPDATE and not on DELETE.** Deleting the last administrator's `people` row in
  SQL is not refused; nothing in the product does that, and firing on DELETE would abort
  `reset_families.sql`. Stated in the migration as the honest boundary rather than a complete
  one.

Recorded 2026-08-23.

## SUPERSEDED 2026-08-23: what happens when a family stops paying

**The conversation happened and the ladder above is the answer.** What survives here is the
REASONING — the questions that had to be settled and why each one was left open rather than
guessed at — because the next policy decision on this feature will meet the same shape. The
schedule itself is above; do not build from this section.

`invoice.payment_failed` stamps `platform_billing_accounts.delinquent_since` and
`last_payment_failure` and stops there. No tier drops, no email goes, nothing is scheduled, and
the **Billing** band on `/admin/settings` says so out loud: *"A card payment has been failing
since … Nothing has changed about what this family can reach."*

**THAT IS A HOLDING POSITION, NOT AN ANSWER.** A family whose card expired keeps Premium
indefinitely, and the only trace is a date on a screen an administrator may never open.

**Why it was left open rather than guessed at.** Stripe retries a failed card for days — the
exact schedule is a Dashboard setting — so a family whose payment fails on Tuesday and succeeds
on Thursday must not lose their pages in between. Any rule tighter than that is a product
decision about a real family's real card, and the wrong one closes a hundred and forty people's
family album over a bank's fraud hold.

**The questions, roughly in the order they have to be answered:**

1. **How long is the grace period?** Stripe's own dunning runs about two weeks by default. A
   grace period shorter than that fights it; one much longer is a free plan with extra steps.
2. **What does the family SEE, and when?** The band exists. Does the dashboard say something?
   Does the administrator get an email — and which administrator, given
   `platform_billing_accounts` deliberately holds no billing email (see the entry below)?
3. **What actually happens at the end of it?** The mechanism exists and is one row:
   `scheduled_tier = 'free'`, `scheduled_tier_on = <the day>`, and the sweep does the rest. The
   decision is the DATE, not the code.
4. **Is a prepaid lapse the same thing?** It is not, today. A prepaid term that runs out is
   swept straight to Free with no grace at all, because nothing is retrying and nothing failed —
   the family simply stopped buying. Those two paths reaching the same tier by different rules
   is defensible and is currently undocumented anywhere a family would read it.
5. **Does Stripe's own dunning email replace ours?** It is configurable in the Dashboard, it is
   free, and it comes from Stripe rather than from an address a family might not recognise.
   Probably yes, and then item 2 is much smaller.

**Where the code would go, so the estimate is honest.** `onInvoiceFailed` in
`lib/stripe/platform-events.ts` for the stamp (already there), the sweep in
`20260823000004` §5 for the drop (already there — it would need a `delinquent_since + N days`
branch beside the prepaid one), and `lib/platform-billing.ts` for the pure "is this family past
the grace period" function, which is where it should be tested by value rather than by running
a webhook.

**One thing NOT to do:** put the grace period in a policy or in `families.tier` semantics. No
RLS policy consults the tier and none may, and a family in dunning must keep every row it has —
the whole point of a soft failure is that paying fixes it with nothing to restore.

Recorded 2026-08-23.

## BUILD: a downgrade withholds for 60 days, then deletes — decided 2026-08-23

**Action:** build it. `pg_cron` is installed as of `20260823000006`, so this is no longer
blocked — it needs its own daily `cron.schedule` line in the migration that builds it.

### The rules, as decided

* A downgrade takes effect on the **1st** — the next one for a family paying monthly, and the
  1st after a prepaid term is exhausted. That half is BUILT (`scheduleDowngrade`, tested).
* From that day the tier's data is **withheld, not deleted, for 60 days.**
* Reminder emails at **30, 15, 5 and 1 day** before deletion, each saying the data will be
  deleted unless the family moves back to their tier.
* At 60 days, **any data not available on the family's current tier is deleted from the
  database.**
* Coming back inside the window is **the family's choice of two**:
  * **keep the data** — pay for the months they were away, so the tier's billing has no hole
    in it. Standard July, Standard August, back to Plus in September means Plus for July,
    August and September.
  * **start fresh** — pay nothing extra, lose the withheld data, carry on from today.
* Deleting a family for non-payment (day 60 of the ladder above) **hard-deletes the family's
  records and keeps the sign-in accounts**, because an account can belong to other families.

### Nine things this costs, and the first three are the expensive ones

1. **A TIER→DATA MAP, PER TIER, DECIDED BY A PERSON.** `lib/features.ts` maps ROUTES to tiers
   and says nothing about tables. Standard alone covers the family tree, the whole
   dues-and-donations ledger, permission templates and the planning half of Gatherings — so
   "Standard's data" is `person_relationships`, `dues_schedules`, `dues_payments`, `fund_*`,
   `permission_templates`, `gathering_templates` and more. **There is no derivation available**:
   `permission_table_map` maps keys to tables for POLICY purposes and is not the same question.
   This map has to be written out and reviewed, and it is the single riskiest artefact in the
   feature.
2. **`dues_payments` IS APPEND-ONLY AND REFUSES A DELETE TO THE SERVICE ROLE**
   (`20260806000002`). Deleting a family's ledger means an exemption inside that trigger — the
   `meeting_votes_are_final` shape, where a `pg_trigger_depth() > 1` test admits a cascade and
   nothing else. Do NOT reach for a `SET LOCAL` escape hatch: `storage.protect_delete()` has one
   and its own note in AGENTS.md says a hatch is a thing any future action can set, where a depth
   test can only be satisfied by an actual cascade.
3. **DECIDED 2026-08-23: WITHHOLDING IS *EXACTLY* THE TIER GATE, AND NOTHING MORE.** This item
   asked whether "withheld" had to mean something stronger than closing the route — because the
   rows stay readable to `/reporting/*`, the dashboard tiles and the family tree's own
   `bloodlineIds` walk, none of which live on the withheld route. The answer is no: **a
   downgrade removes the ROUTES, and 60 days later the data is deleted.** There is no third
   state to build.
   
   That is the cheapest possible answer and it is already implemented — the tier gate has closed
   routes since `lib/tiers.ts` shipped. What remains is the CLOCK and the DELETION, which is
   what the rest of this list is about. It also removes the largest unknown from the estimate:
   there is no read-layer gating to write.
4. **A GRACE WINDOW IS NOT OPTIONAL AND 60 DAYS IS IT.** Recorded because the reminder schedule
   only makes sense against a fixed clock: `withheld_since` on the family, set by the sweep when
   the downgrade lands, and the four reminders keyed off it. Not off `scheduled_tier_on`, which
   is cleared when the change applies.
5. **THE "PAY THE MONTHS YOU WERE AWAY" FIGURE IS PURE ARITHMETIC AND BELONGS IN
   `lib/platform-billing.ts`.** Whole months from `withheld_since` to the next 1st at the
   returning tier's rate, plus the coming month. It is the same shape as the delinquency
   arrears figure above and should be ONE function with one set of tests, not two that agree
   today.
6. **"START FRESH" DELETES IMMEDIATELY AND MUST SAY SO IRREVERSIBLY.** It is the same
   hard-delete path as everything else here, taken deliberately by an administrator rather than
   by a clock — so it needs the strongest confirmation in the product. The family-removal
   pattern (an emailed six-digit code, `family_removal_challenges`) already exists and is the
   right precedent; a plain confirm dialog is not enough for a button that destroys a family
   tree.
7. **ONE HARD-DELETE PATH, THREE CALLERS.** The 60-day sweep, "start fresh", and day 60 of the
   delinquency ladder. Writing it three times is how one of them ends up missing a table — and
   the check for that already exists in shape: `reset_families.sql` §11 derives its assertion
   over `information_schema.tables` rather than trusting a list, and this needs the same.
8. **THE ACCOUNTS SURVIVE, THE FAMILY'S ROWS DO NOT.** Decided. `auth.users` is untouched,
   because an account may belong to another family and is a person's login identity. What that
   leaves is an account with no membership, which the product already handles — `/my-families`
   is reachable and the resolver falls through — so the state is not new.
9. **AND THE COPY ON FOUR SURFACES BECOMES FALSE IN THE SAME COMMIT.** `PlanPanel` promises *"a
   family that moves down to Free keeps every record it has ever entered … so moving back up
   restores the pages with their data intact"*; `lib/plans.ts`, `/help/family-settings#plan` and
   `/help/plans` say versions of it. All four are correct TODAY and all four have to change with
   the code, or the product is lying on the screen where the decision is made.

### The concern, stated once, because it inverts a documented invariant

Today a downgrade deletes nothing, and that is asserted rather than merely true: no RLS policy
consults `families.tier` and none may (`20260813000003`), and removing a family — the largest
destructive act in the product — destroys no rows at all. After this, a downgrade becomes the
one operation that does, which means a mis-clicked plan change can destroy a family tree, and a
lapsed card can eventually do the same. The 60-day window and the reminders are what make that
defensible, which is presumably why they are in the brief. It is worth knowing that the window
and the emails are not decoration — they are the whole of the safety argument, so neither can be
dropped later as a simplification.

**No family is using this product yet**, which is what makes the decision cheap to take now and
expensive to take later — the same ground `20260819000006` retired Events on.

Recorded 2026-08-23.

## RESOLVED 2026-08-23: `pg_cron` is installed, and `http` is what is left

**`pg_cron` is in** — `20260823000006` creates the extension and schedules
`apply_due_platform_tier_changes()` hourly at five past, asserting in the same file that the job
exists exactly once, is active, survives a re-schedule without duplicating, and that its command
actually runs. That closes the prepaid-lapse gap the sweep shipped with: a family that paid three
months in advance no longer keeps its tier until some other family's payment happens to arrive.

**The delinquency ladder and the 60-day retention are therefore UNBLOCKED**, and each needs its
own `cron.schedule` line in the migration that builds it — daily rather than hourly, since every
step of both is keyed to a date.

**`http` IS STILL NOT INSTALLED**, and only the weather poller wants it. The note below about
choosing it over `pg_net` stands and is untouched by any of this.

**AND THE INVISIBILITY WARNING NOW HAS A LIVE EXAMPLE.** `cron.job` is database state:
`db:check` compares migration versions, `db:audit` reads policies, and a fresh `db reset`
schedules nothing until the migration runs. A job created in the dashboard is drift with nothing
in the repo able to see it. The sweep's job is created in a migration and asserted there; the
next one must be too.

FutureFeature.md §1 carried *"there is no cron, no worker, no queue and no `vercel.json`"* for
months and it is true of the **app layer only**. On this project's Postgres:

| Extension | Available | Installed |
|---|---|---|
| `pg_cron` | 1.6.4 | — |
| `pg_net` | 0.20.3 | — |
| `http` | 1.6 | — |
| `postgis` | 3.3.7 | — |

All four are available and none is installed. The database is reached by a migration, which is
the one deployment path this repo sanctions — so this is not new infrastructure, and it does not
need anybody to hold production credentials.

**What it unblocks, in the order the value falls:**

1. **A LAPSED PREPAID PLAN, and this one is now REAL rather than prospective.**
   `apply_due_platform_tier_changes()` (`20260823000004` §5) is written for a scheduler and has
   none: it is called at the end of every Stripe webhook delivery, which is EXACT for a monthly
   renewal (the invoice IS the period boundary) and a genuine gap for a term bought outright. A
   family that prepaid three months in January keeps its tier until some OTHER family's payment
   happens to arrive — and on a product with no families paying, until nothing does. The function
   takes no arguments, is idempotent, and is safe hourly forever; scheduling it is one line.
2. **Automatic dues reminders** — the last unbuilt Premium bullet whose two halves are both done
   elsewhere. `/reporting/dues-projections` computes what is owed and `app/actions/distributions.ts`
   is a working resumable per-recipient fan-out. FutureFeature.md §1 has the one decision it still
   needs (a uniqueness key on person/schedule/period, in the schema rather than in the job).
3. **Alert-driven check-in suggestions** — FutureFeature.md §5. A poller over `api.weather.gov`,
   which needs no API key.
4. Anything else that has to happen with nobody watching.

**Three things to get right, and the second is the one that will bite:**

* **`http` (synchronous) probably beats `pg_net` here.** `pg_net` is fire-and-forget — the
  response lands in a `net` table for a limited window, so a job that needs the body is two
  passes and a reaper. A poll that fetches, matches and writes in one statement wants the
  synchronous extension, with an explicit timeout so a hanging endpoint cannot wedge the job.
* **A CRON JOB IS DATABASE STATE, which is the same invisibility class as realtime publication
  membership.** `db:check` compares migration versions, `db:audit` reads policies, and a fresh
  `db reset` schedules nothing. A job created in the dashboard is drift. **It must be created in a
  migration and asserted there** — AGENTS.md's "REALTIME NEEDS THE TABLE IN A PUBLICATION" is the
  same incident arriving through `cron.job`, and that section's warning about an instruction in a
  migration addressed to a person applies word for word.
* **A job has no `auth.uid()`, so it has no caller to authorize.** That is why the alert poller
  must SUGGEST and a person must RAISE (FutureFeature.md §5 argues it): automating the raise means
  inventing a system actor and hanging the family's most sensitive write off it, with §2b's rule
  about never taking an identity as a parameter standing in the way. Whatever is scheduled first
  sets the precedent for that, so it is worth deciding deliberately rather than by whichever job
  lands first.

Recorded 2026-08-23.

## Every connected account is created as American, and the country cannot be changed

**Action:** decide whether a non-US family is in scope. If it is, ask for the country in the
Connect panel and pass it through; if it is not, say so on that panel rather than deciding it
silently. Recorded 2026-08-25.

`CONNECT_ACCOUNT_COUNTRY` in `lib/stripe/config.ts` is the constant `'us'`, sent as
`identity.country` on every `v2.core.accounts.create`. It exists because Stripe refuses the
account without it (`identity_country_required` for anything requesting the merchant
configuration) and because there is nothing in the schema to derive it from: `families` has no
country column, and `people.country` is free text describing where one relative lives.

**Why it is a real gap rather than a theoretical one.** `lib/regions.ts` admits **United
States, Canada and Mexico** for a member's address, so a Canadian family is a thing this
product already supports everywhere except here — and here it would be created as an American
merchant. `identity.country` decides the payout currency, which identity documents Stripe
demands and which regulations apply, and **it cannot be changed after creation**. The failure
is not an error message: onboarding would run, ask for US paperwork, and the family would be
stuck with an account they cannot complete.

**The fix is a question, not a better default.** One `<select>` on the Connect panel, defaulting
to the US, its value passed to `ensureConnectedAccount`. Two things to get right when it is
built: the value is written into `family_stripe_accounts.country` at creation (it already is,
from the create response), so a family created before the picker is distinguishable from one
that chose; and `cross_border_connected_account_creation_not_allowed` is a real refusal — the
PLATFORM's country has to support the connected account's, so offering Canada is a claim about
GENORRA's Stripe account and not only about the family's.

**The rest of the product would need a second look in the same commit.** Every price is USD
(`formatCurrency`, and `currency: 'usd'` on every session) and phone numbers assume +1, so a
Canadian family collecting dues today would be charged in USD into a CAD account. That is
allowed on a direct charge and settles with conversion; it is not obviously what anybody
intended.

## GO LIVE: turn the Send Email hook on hosted, and in this order

**BUILT 2026-08-27 and proven locally** — `npm run auth-email:check` reports all five auth
emails composed by this app, in all three languages, with the right `type=` on every link and
both halves of an address change. What is left is one auth-config change on the hosted
project, and the ORDER matters more than the change does.

### THE ORDER, AND WHY GETTING IT BACKWARDS TAKES AUTH DOWN

GoTrue calls the hook SYNCHRONOUSLY, and a non-2xx rolls the whole operation back — measured:
a failing hook on a signup leaves no `auth.users` row at all. So a hook enabled before the
endpoint answers means **nobody can register, reset a password, or change their address**, and
every attempt fails with `unexpected_failure`.

1. **Merge to `master` and let it deploy.** `/api/auth/send-email` has to be live and
   answering before anything is switched on. Confirm with an unsigned POST — it must answer
   401, which is also the open-relay check.
2. **Set `SUPABASE_AUTH_HOOK_SECRET` in Vercel** (all environments), and `RESEND_API_KEY` must
   already be there — it is, or no mail works today.
3. **Then** enable the hook on the hosted project: `hook_send_email_enabled`,
   `hook_send_email_uri = https://genorra.com/api/auth/send-email`, and
   `hook_send_email_secrets` = the same secret. Dashboard → Authentication → Hooks, or the
   Management API.
4. **Send yourself a real signup and a real password reset** and look at both on a phone. The
   GO LIVE item above already asks for this; it is now the same click.

To undo, disable the hook. GoTrue falls straight back to `supabase/templates/*.html`, which is
why those are still in the repo and still pushed.

### WHY IT IS NOT PUSHED FROM CI, WHICH IS A DECISION RATHER THAN AN OMISSION

`npm run email:push` sends only the ten mailer template fields, deliberately — see
`scripts/auth-templates.mjs`, and AGENTS.md on why it is not `supabase config push`. Adding
the hook fields to it would mean CI enabling an auth hook, and the failure mode is the one
above: a green deploy that has taken authentication down. A human doing step 3 after watching
step 1 land is the whole safeguard.

If it is ever automated, it has to be ordered AFTER the Vercel alias moves — which is
`migrate.yml`'s Deployment Check in reverse, and that is a mechanism nobody has built.

### THE TWO THINGS TO WATCH ONCE IT IS ON

* **Auth mail now depends on the Next deployment.** It did not before. A build that fails to
  alias, or an outage, takes auth email with it — and a signup attempted during one leaves no
  account rather than an account with no email, so nothing is stranded. Worth knowing before
  reading a support ticket that says "I cannot sign up".
* **`supabase/templates/*.html` are FROZEN, not live.** They are the fallback and the English
  in them is now a second copy. Change wording in `lib/email/auth-mail.ts`; delete the HTML
  once the hook has been on for long enough that turning it off is not the plan.

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
installed (see the resolved item above) but nothing in the product runs on a clock except the
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

## A `permission_resources` row grants Administrators an action the resource does not declare

**Action:** decide whether it matters, then either narrow the seed's Administrators insert or
write this down as intended. Ten minutes either way.

Observed 2026-08-23 while checking a new key's grants. `seed_family_permission_templates()` gives
the Administrators template `'any'` on every action in `pr.actions` — correct — but the fixture
shows an `edit` row for two keys that declare only `view`, `create` and `delete`:

```
community/distributions    | Administrators | edit | any
community/safety-check-ins | Administrators | edit | any
```

**It is harmless today and the reason is worth stating**, because it is what makes this a note
rather than a bug: Members & Access renders switches from `resource.actions` through `scopesFor()`,
so the cell is never drawn; and nothing anywhere calls `auth_permission(key, 'edit')` for a key
with no edit action, so the row is read by nothing. AGENTS.md's rule — *"a switch nothing consults
reads as a control being honoured"* — is not violated, because no switch is rendered.

What makes it worth an entry is that it is a row asserting a grant that does not exist, sitting in
the table three resolvers agree about. If a future key gains an `edit` action, that key's
Administrators template already grants it retroactively — which is probably the desired answer and
is definitely not a decided one.

**Both keys were added after the seed was written**, which is the likely cause: an earlier
`ON CONFLICT DO UPDATE` on `permission_resources.actions` narrowing a key from four actions to
three would leave the template row behind. If that is it, the repair is a sweep deleting
`template_permissions` rows whose action is not in their resource's `actions` — and that sweep is
worth a `verify.yml`-shaped assertion more than it is worth the delete.

Recorded 2026-08-23.

## RESOLVED 2026-08-23: Meta's money half is wired

**It has a caller now.** `lib/stripe/platform-events.ts` calls `trackSubscriptionPayment` from
the verified webhook after Stripe confirms the charge, and `app/actions/billing.ts` calls
`trackCheckoutStarted` when a hosted Checkout Session is actually created. All four rules this
entry set out are honoured at the call site: `transactionId` is the invoice or payment-intent id
rather than the subscription, `firstPayment` comes from Stripe's own
`billing_reason === 'subscription_create'`, `amountCents` is `invoice.amount_paid` rather than
`TIER_PRICE`, and a renewal sends `SubscriptionRenewal` alone.

Two things it does that this entry could not have specified:

* **It never throws into the webhook.** A Meta outage must not make the endpoint answer 500,
  because Stripe would then redeliver an event whose money has already been applied. The tier is
  granted first; the analytics are best effort, in that order.
* **A placeholder address is never hashed.** The holder comes from the family's founder row, and
  a generated `@genorra.com` address is passed as `null` rather than as an email — it would be a
  match key that matches nothing and drags Event Match Quality down.

**THE VALIDATION TABLE AT THE BOTTOM IS STILL OWED**, and is now checkable — it moved to the
Stripe GO LIVE item's own table. What remains open here is `Lead`, which still has no lead
surface (no waitlist, no demo request, no newsletter), and the reporting half below.

The rest of this entry is kept because it is the argument for the shape, and because the four
rules are the things a future edit will get wrong:

**What wiring it cost** — one import in the verified webhook handler, after the charge is
confirmed:

```ts
import { trackSubscriptionPayment } from '@/lib/meta/billing'

await trackSubscriptionPayment({
  transactionId: invoice.id,            // the CHARGE, never the subscription — see below
  subscriptionId: invoice.subscription,
  amountCents: invoice.amount_paid,     // what was charged, NEVER TIER_PRICE
  currency: invoice.currency,
  planId: 'standard',
  billingInterval: 'monthly',
  firstPayment: invoice.billing_reason === 'subscription_create',
  holder: { userId, email, firstName, lastName },
  occurredAtMs: invoice.created * 1000,
})
```

Four things about that call that a future edit will get wrong, and each is argued at length
in the file:

* **`transactionId` must identify the CHARGE.** Every renewal of one subscription shares the
  subscription id, so keying on that makes month two look like a duplicate of month one and
  it is discarded forever — silently, because a suppressed duplicate is indistinguishable
  from a working integration.
* **`firstPayment` comes from the PROVIDER**, never inferred from our own records. Inferring
  it ("have we seen this family pay before?") is wrong the first time a family cancels and
  resubscribes, and the first time the ledger is restored from a backup.
* **`amountCents` comes from the transaction.** After a proration, a coupon, a partial refund
  or a tax line, the catalogue price and the charge disagree, and the reported figure has to
  be the one the bank moved.
* **A renewal is deliberately not a `Purchase`.** A subscription business sends far more
  renewals than acquisitions; folding them together makes the new-customer count grow every
  month with no new customers in it, and makes cost per acquisition fall as an artefact of
  the existing base. The revenue is not lost — turn `SubscriptionRenewal` into a custom
  conversion in Events Manager when lifetime revenue is wanted.

**`InitiateCheckout` HAS its real checkout session now.** **`Lead` still waits for a real lead
surface** — there is no waitlist, demo request or newsletter in this product, and using `Lead`
to mean "viewed pricing" would make a Lead-optimised campaign chase readers instead of
prospects.

**Validation, now checkable and therefore OWED rather than hypothetical.** It needs
`META_TEST_EVENT_CODE` and a Stripe test key on the same preview deployment:

| | |
|---|---|
| Refresh the success page repeatedly | One `Purchase` in Test Events, not one per refresh |
| Replay the webhook from Stripe's dashboard | Still one — `stripe_webhook_events` refuses the second delivery before Meta is ever reached |
| Let a renewal charge settle | `SubscriptionRenewal` only. **No `Purchase`, no `Subscribe`** |
| Compare `value` against the Stripe charge | Dollars, not cents. A $5.00 charge reported as `500` is the failure |
| `SELECT * FROM marketing_conversion_events WHERE delivery <> 'sent'` | Empty, or a readable reason in `detail` |

**And the reporting half is owed too, and is now one join rather than none.**
`marketing_attribution` records which campaign found each account, and the question it exists to
answer — *which campaign produced this paying family?* — is answerable the moment
`platform_payments` has rows in it. A `/reporting` screen for it is the natural follow-up, and
the join is `marketing_attribution` → account → `people.family_code` → `platform_payments`.

Recorded 2026-08-23; the wiring half resolved the same day.

## Three smaller Stripe follow-ups, none of them urgent

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
   suite. `BACKLOG_CEILING` was raised from 57 to 68 to admit them and its own comment carries
   the trade.

Recorded 2026-08-23.

## The consent banner has no privacy policy to link to

**Action:** write a privacy page, then link it from the banner. One route, one link.

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

Recorded 2026-08-23.

## `resource-groups.ts` pulls the admin client into the browser's module graph

**Action:** move `PERMISSION_ACTIONS` into a pure module. Three lines, and it removes a
chain that only luck is keeping harmless.

Found 2026-08-23 by `lib/meta/no-client-secrets.test.ts` on its first run, and it predates
the Meta integration entirely:

```
components/admin/resource-groups.ts   (plain module, imported by client components)
  → @/lib/auth/permissions            (for the PERMISSION_ACTIONS value)
    → @/lib/supabase/admin            (which reads SUPABASE_SERVICE_ROLE_KEY)
```

**It is not a leak today**, and the reason is worth being uncomfortable about: the key has no
`NEXT_PUBLIC_` prefix, so Next does not inline it and the reference compiles to `undefined`.
The protection is a build-time convention, not a boundary anybody drew — and the repair for
a symptom of this shape is exactly the wrong instinct, because adding the prefix to "make it
work" would ship the service-role key to every browser.

**The fix is the shape this codebase already uses twice.** `lib/gathering-panes.ts` and
`components/admin/account-sections.ts` both exist because a Server Component importing a
runtime VALUE from a client module gets a client reference rather than the value — same
boundary, opposite direction. `PERMISSION_ACTIONS` is a frozen array of four strings and
wants the same treatment: a pure module under `lib/`, imported by both sides.

`lib/auth/tier.ts` and `lib/auth/family.ts` are reachable the same way and are on the same
list. All four are recorded as stated verdicts in `KNOWN_PRE_EXISTING` in that test file —
an EXACT match on `path → name`, so a new occurrence in the same file fails rather than
being tolerated. **Delete each entry as it is fixed**; the list is a backlog, not a
suppression. Two assertions in that file are absolute and admit no entry at all: nothing may
name `META_CONVERSIONS_API_ACCESS_TOKEN`, and nothing may import a `@/lib/meta/` server
module.

Recorded 2026-08-23.

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

