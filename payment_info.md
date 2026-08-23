# GENORRA — Stripe Payments Architecture Notes

**Status: BUILT, 2026-08-23. This document is now the DECISION RECORD rather than a proposal.**
**Researched:** 2026-08-12 · **Implemented:** 2026-08-23
**Sources:** Stripe plugin bundled reference material (`connect-recommend`,
`stripe-best-practices`, and its `connect`/`billing`/`payments`/`security` references), plus a
survey of this repository.

> This is engineering decision-support, not legal or tax advice. The entity and tax
> questions in §5 need a CPA or attorney, and §5 IS STILL OPEN.

## What was built, and where

Every recommendation below was followed. Model C, Accounts v2, direct charges, `dashboard:
'full'`, `fees_collector`/`losses_collector` both `stripe`, hosted onboarding, and **no family
API keys anywhere**.

| | |
|---|---|
| Credentials and price lookup | [lib/stripe/config.ts](lib/stripe/config.ts) |
| The one client, and the ONLY place an account header is set | [lib/stripe/client.ts](lib/stripe/client.ts) — `onAccount()` |
| Signature verification and event claiming | [lib/stripe/webhook.ts](lib/stripe/webhook.ts) |
| GENORRA's own revenue, decided from Stripe events | [lib/stripe/platform-events.ts](lib/stripe/platform-events.ts) |
| A family's dues, posted to the family's own ledger | [lib/stripe/connect-events.ts](lib/stripe/connect-events.ts) |
| Pure arithmetic: terms, prepay, upgrade credit | [lib/platform-billing.ts](lib/platform-billing.ts) + its test |
| Schema | `20260823000004` (platform), `20260823000005` (Connect) |
| Endpoints | `app/api/stripe/platform`, `app/api/stripe/connect` |

**THE ONE THING THIS DOCUMENT DID NOT ANTICIPATE** is the rule the whole build turned out to
need, and it is now AGENTS.md's own section: **GENORRA's money and a family's money are two
ledgers and must never meet.** §6 below is right that `dues_payments` was built to receive a
Stripe payment — and the mirror of that is that a family's SUBSCRIPTION charge must never land
there, because it would inflate the family's collected total, route a slice of our invoice into
their Reunion fund, and be unremovable in an append-only table. `platform_payments` exists for
that reason and 20260823000004's header argues it at length.

**What is still open** is in TODO.md rather than here: the credentials and the two webhook
endpoints (GO LIVE), Stripe Tax, delinquency policy, and §5's entity question — which remains
the biggest unresolved item and is not a Stripe question.

---

## 1. The requirement

Members pay family dues online. GENORRA is multi-tenant: many families, one product.
Each family needs its money to reach its own bank account. Families should be able to
see their balance inside GENORRA and request a payout.

Stripe Terminal was considered and **dropped** — no in-person card collection for now.

---

## 2. Three models considered

### Model A — GENORRA holds the money *(rejected)*

GENORRA collects into its own Stripe account, tracks a per-family balance in its own
ledger, stores each family's bank details, and sends money out on request.

**Rejected: this is money transmission.** Receiving funds from one party to transmit to
another triggers, in the US:

- FinCEN MSB registration
- State money transmitter licenses in most of ~50 states
- A written AML program with Customer Identification Program
- SAR filing and OFAC screening

It would also breach Stripe's own services agreement independently of the law — a
platform may not use its balance to pay third parties or act as a payment facilitator
without Stripe's approval.

### Model B — Connect, GENORRA-managed accounts *(viable, not chosen)*

Each family is a connected account with `dashboard: 'express'`, destination charges,
`fees_collector: 'application'`, `losses_collector: 'application'`.

Legally fine — Stripe performs KYC on each connected account, so the licensing problem
in Model A disappears. But it carries costs Model C does not:

- **GENORRA always pays Stripe's processing fees** on destination charges. Not optional,
  not configurable.
- **GENORRA bears chargeback and negative-balance liability.** `losses_collector:
  'application'` is *required* for destination charges — it's what allows a connected
  account balance to go negative so transfers can be reversed.
- GENORRA must self-manage fraud risk (Radar configuration, dispute webhooks).
- The 1099-K still lands on whoever onboarded, and GENORRA is adjacent to that
  conversation.

### Model C — Families own their Stripe accounts *(current direction)*

Each family creates or links **its own** Stripe account. GENORRA connects to it via
Stripe Connect and acts as a SaaS platform enabling payments.

```
dashboard:          'full'      // family gets a real Stripe Dashboard
fees_collector:     'stripe'    // family pays Stripe's processing fees
losses_collector:   'stripe'    // Stripe bears negative-balance liability
charge pattern:     direct      // charge lives on the family's account
configuration:      merchant    // card_payments capability
onboarding:         Account Link / embedded components
```

Stripe's security guidance endorses this as the default posture:

> "Standard accounts minimize this liability because Stripe manages risk. Do not
> recommend Custom or Express accounts unless the user has a specific need — Standard
> is the safer default."

And the account-selection guide names this exact situation as a reason to choose `full`:
*"Sellers already have or expect to have their own Stripe relationship."*

("Standard" is the legacy v1 name. New integrations use the **Accounts v2 API**,
`/v2/core/accounts` — do not use the legacy `type: 'standard' | 'express' | 'custom'`
parameter.)

---

## 3. Why Model C wins

| Axis | Model B (Express/destination) | **Model C (full/direct)** |
|---|---|---|
| Money transmission exposure | None | None |
| Who pays Stripe processing fees | **GENORRA** | The family |
| Platform fee retained | `application_fee_amount` − Stripe fees | **Full `application_fee_amount`** |
| Chargeback / negative balance liability | **GENORRA** | Stripe |
| Fraud risk management | GENORRA must self-manage | Stripe-managed available |
| 1099-K | Issued to whoever onboarded; GENORRA adjacent | Stripe → family directly, GENORRA out of the chain |
| Onboarding weight | Lighter | Heavier (full merchant) |

### What Model C gives up

Real trade-offs, not footnotes — the family genuinely owns the account:

- **They can disconnect at any time.** GENORRA has no ability to prevent it.
- **They control their own payout schedule** from their own Stripe Dashboard. GENORRA's
  payout button is a convenience, not a control.
- **Their name, not GENORRA's, appears on the member's card statement.** For dues this
  is arguably clearer, but it is a visible difference.
- **They handle their own refunds and disputes.** Less support burden on GENORRA, more
  on the family treasurer.
- GENORRA sees less payment detail on direct charges from the platform dashboard.

---

## 4. Do NOT collect families' API keys

The tempting shortcut — "let the family paste their Stripe secret key into GENORRA" —
should not be built.

| | Family pastes `sk_live_…` | Connect with `Stripe-Account` header |
|---|---|---|
| What GENORRA stores | A credential that owns their money | An `acct_…` id — an identifier, not a secret |
| Blast radius if GENORRA is breached | Every family's Stripe account, completely | An account id, useless on its own |
| Scoping | None. A secret key can refund everything, read full PII, change their bank details | Stripe scopes it; GENORRA uses its own platform key |
| Revocation | Treasurer rotates → silent breakage. Treasurer leaves the family → still holds the key | Family disconnects; GENORRA receives an event |
| Stripe's position | *"Never share secret keys with third parties"* | The supported path |

Restricted API keys (`rk_`) narrow the damage, but each treasurer would have to
hand-build one with exactly the right permission set, and GENORRA can neither verify nor
enforce that they did. At a hundred families that is a support queue, not a feature.

**Balances and payouts work fine without keys.** Call the Balance and Payout APIs with
GENORRA's *platform* key plus a `Stripe-Account: acct_…` header. Same two capabilities,
zero family secrets at rest, nothing to encrypt, no vault to operate.

Related: [`components/admin/AdminAccountShell.tsx:346-349`](components/admin/AdminAccountShell.tsx#L346-L349)
already documents this instinct — the processor panel is deliberately inert because "a
form that looked functional would invite someone to type real Stripe keys into a field
that discards them."

---

## 5. Open question — what legal entity is a "family"?

**This is the biggest unresolved item and it is not a Stripe question.** Every Stripe
account needs a verifiable legal recipient, and a "family" usually isn't one.

- **Family association with an EIN** — onboards as a business. Clean. Many reunion
  committees and 501(c)(7) social clubs already have one.
- **No EIN** — the treasurer onboards as an individual with their SSN. Dues then legally
  flow to a private person, who **receives the 1099-K**. A volunteer treasurer
  discovering family dues on their personal tax return is a trust problem for GENORRA,
  not merely an accounting one.

**Still to answer: do target families typically have an EIN?** This decides the
onboarding UX and should be settled before building.

### On the planned tax / entity education section

Good idea, fully decoupled from the payments build, can ship on its own timeline. Three
cautions:

1. **An LLC is probably the wrong default.** It is a for-profit vehicle. A family
   association collecting reunion dues is usually better served by an unincorporated
   nonprofit association or a 501(c)(7) social club. Steering families to LLCs by default
   has real cost — California alone charges an $800/yr minimum franchise tax regardless
   of income, plus registered agent and annual filing fees. On $3k of annual dues that is
   a meaningful bite for advice they got from our product.

2. **This content will rot, and stale tax content is worse than none.** The 1099-K
   threshold has moved repeatedly — ARPA's $600, several IRS delays, then the 2025 budget
   act restoring the higher $20,000 / 200-transaction figure — and roughly a dozen states
   set their own lower thresholds. Any page that *restates* a number will eventually be
   confidently wrong. **Link to IRS and state revenue sources rather than restating
   figures**, stamp the page with a reviewed-on date, and make staleness visible rather
   than silent.

3. **Frame it as information, not advice.** General explanation + primary-source links +
   "talk to a CPA" is fine. A wizard concluding "form an LLC, start here" is a different
   liability posture. Do not file on anyone's behalf.

---

## 6. What this repository already has

The accounting schema was built to receive this. The seam is clean.

| What exists | Where |
|---|---|
| `dues_payments.source` CHECK already permits `'stripe'` | [`20260610000005_accounting.sql:82`](supabase/migrations/20260610000005_accounting.sql#L82) |
| `processor_ref` + unique index on `(source, processor_ref)` — webhook-retry idempotency | [`20260610000005_accounting.sql:87-89`](supabase/migrations/20260610000005_accounting.sql#L87-L89) |
| RLS INSERT policy **pins** `source`/`processor_ref`/`routed_at`, so a browser insert can never forge `source='stripe'` | [`20260806000001_accounting_write_policies.sql:29-34`](supabase/migrations/20260806000001_accounting_write_policies.sql#L29-L34) |
| Processor settings panel, deliberately inert, awaiting this work | [`components/admin/AdminAccountShell.tsx:346-364`](components/admin/AdminAccountShell.tsx#L346-L364) |
| Pure, exact-summing fund routing engine | [`lib/fund-routing.ts`](lib/fund-routing.ts) |
| Payment method list (`'Card'` already present) | [`lib/payment-methods.ts`](lib/payment-methods.ts) |

Stack: Next 16.2.7, React 19.2.4. **No `stripe` dependency installed yet.**

---

## 7. Implementation notes for when we build

Smaller than Model B would have been — no encrypted secrets, no vault.

- **New migration:** `families` gains `stripe_account_id` and a connection/onboarding
  status. No credential columns.
- **Webhooks:** with direct charges the PaymentIntent lives on the *family's* account.
  The handler must resolve `event.account` → family. Do **not** trust a family id
  arriving in metadata alone. Metadata (`family_code`) is for reconciliation, not
  authorization.
- **Webhook route is a route handler, not a server action.** Verify the Stripe signature
  before processing. Use the admin client and re-apply `family_code` scoping by hand
  (AGENTS.md §3). Optionally allowlist Stripe's IPs for defense in depth.
- **The payout-request action is a `canAny()` case.** AGENTS.md cites "a disbursement
  paying *themselves*" as the example that motivated that helper; "request a bank
  transfer to an account I configured" is the same shape.
- **New permissioned surfaces need a migration** (AGENTS.md §6): rows in
  `permission_resources`, the matching insert in the `20260618000000` seed, and a
  per-family `resource_visibility` backfill. Declare only actions something actually
  reads.
- **Every RLS-path action owes a test case** in `tests/rls/cases.mjs` (AGENTS.md §7) —
  attack, positive control, and a pending-member case.
- **Never export a sender from a `'use server'` file** if payment receipts get emailed
  (AGENTS.md, email section).
- **CSP:** add `https://*.stripe.com` to `script-src`, `frame-src`, `connect-src` for
  Stripe.js and any embedded components.
- **Secrets:** GENORRA's own platform key goes in a secrets vault or a Vercel sensitive
  environment variable — never in source, never in a committed env file. A pre-commit
  hook for `sk_`/`rk_` is cheap insurance.

---

## 8. Corrections to earlier reasoning in this thread

- **`on_behalf_of` was suggested and is wrong here.** Stripe's decision matrix lists it
  as an antipattern for platform-collects models — it makes the connected account the
  merchant of record. Moot under Model C anyway, where direct charges make the family the
  merchant of record natively.
- **Model B was recommended before the "families own their accounts" requirement was
  clear.** Model C is better on fees, liability and tax posture simultaneously. Model B's
  notes are retained above only to document why it was set aside.

---

## 9. Next steps

1. **Authenticate the Stripe MCP server** — `/mcp`, select `plugin:stripe:stripe`,
   complete the browser OAuth. (`/reload-plugins` or a fresh session also picks up the
   bundled skills: `stripe-best-practices`, `connect-recommend`, `stripe-docs`.)
2. **Run `stripe_implementation_planner`** with the GENORRA business context and confirm
   the Model C configuration above.
3. **Answer the EIN question** in §5 — it shapes onboarding UX.
4. **Decide the platform fee.** Under Model C, GENORRA retains the full
   `application_fee_amount` and the family pays Stripe's processing fees, so this is a
   clean pricing decision rather than a margin-recovery calculation. See
   [stripe.com/pricing](https://stripe.com/pricing) for region-specific rates.
5. **Visit the Connect platform profile** in the Stripe Dashboard to acknowledge the
   negative-balance-liability model before creating any connected accounts.
6. Then build: migration → Connect onboarding → webhook handler → balance view → payout
   request → RLS tests.
