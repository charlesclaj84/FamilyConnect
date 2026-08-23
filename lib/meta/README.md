# Meta Pixel and Conversions API

Advertising measurement for GENORRA. Two transports for one set of business events, one
consent decision, and a privacy boundary that is enforced by allow-lists rather than by
review.

This file is the map. The argument for each decision is in the header of the file that
makes it — those headers are the documentation, and this is the index.

---

## 1. The architecture

```
                    ┌──────────────────────── BROWSER ────────────────────────┐
  ad click ────────▶│ MetaPixel          PageView (once per path)             │
                    │ MetaViewContent    ViewContent (pricing, home, …)       │
                    │ MetaAttributionCapture   → genorra_attribution cookie   │
                    │ ConsentBanner      → genorra_marketing_consent cookie   │
                    └───────────────────────────┬─────────────────────────────┘
                                                │ same eventID
                    ┌──────────────────────── SERVER ─────────────────────────┐
  registerUser ────▶│ conversions.ts     CompleteRegistration, CreateFamily   │
  createFamily ────▶│                                                          │
  payment webhook ─▶│ billing.ts         InitiateCheckout, Purchase,          │
      (not yet)     │                    Subscribe, SubscriptionRenewal       │
                    │        ↓                                                 │
                    │ dispatch.ts   mode? consent? already sent? assemble.     │
                    │        ↓ after()                                         │
                    │ capi.ts       POST graph.facebook.com/v26.0/<id>/events  │
                    └──────────────────────────────────────────────────────────┘
```

| File | What it owns |
|---|---|
| `config.ts` | Whether this deployment may track, which credentials, `event_source_url` |
| `events.ts` | **The allow-list.** Event names, the `custom_data` fields, the ViewContent catalogue |
| `hash.ts` | Meta's normalisation rules and SHA-256. Never double-hashes |
| `identity.ts` | **The allow-list for people.** The nine permitted account-holder fields |
| `event-id.ts` | Deterministic event ids — deduplication and idempotency both rest on this |
| `attribution.ts` | `_fbp`/`_fbc`, `fbclid`, UTM capture, first vs last touch |
| `attribution-store.ts` | Persisting acquisition context into `marketing_attribution` |
| `capi.ts` | The transport. Timeout, one retry, fail-soft, token never in a URL |
| `dispatch.ts` | The one way a server event is sent. Consent, idempotency, `after()` |
| `conversions.ts` | `CompleteRegistration`, `CreateFamily`, `Lead` |
| `billing.ts` | Checkout and subscription payments. **No caller yet — see §7** |
| `pixel.ts` | The browser wrapper. Base code, `trackPixelEvent`, `onPixelReady` |
| `../consent.ts` | The one consent decision, read by both transports |

**None of these is a server action, and none may become one.** An export of a `'use server'`
file gets a URL, so an exported `sendMetaEvents` would let any signed-in visitor post
fabricated purchases into the ad account. Same rule as `lib/email/send.ts`.

---

## 2. Environment variables

| Variable | Where | Required | What it does |
|---|---|---|---|
| `META_PIXEL_ID` | server | to track at all | The dataset (Pixel) id. Public — forwarded to the browser as a prop when tracking is on |
| `META_CONVERSIONS_API_ACCESS_TOKEN` | **server only** | for server events | Never `NEXT_PUBLIC_`, never logged, never in a URL |
| `META_TEST_EVENT_CODE` | server | no | Turns a non-production deployment on, in Test Events mode. **Ignored in production** |
| `META_CONSENT_DEFAULT` | server | no | `denied` (default) or `granted`. See §5 |
| `META_GRAPH_API_VERSION` | server | no | Overrides the pinned `v26.0` |

`.env*` is gitignored in this repo, so there is no committed example file — this table is the
reference. Set them in Vercel's project settings for Production, and in Preview for QA.

### What each deployment does

| Deployment | `metaMode()` | Behaviour |
|---|---|---|
| Production (`VERCEL_ENV=production`) | `production` | Real events. `test_event_code` ignored even if set |
| Preview/QA **with** `META_TEST_EVENT_CODE` | `test` | Same dataset, Test Events tab |
| Preview/QA without it | `off` | Nothing loads, nothing sends |
| A laptop | `off` | Nothing loads, nothing sends |

A developer machine cannot pollute the production dataset by forgetting a flag: the gate is
`VERCEL_ENV`, and the Pixel is not rendered at all when it says `off`.

---

## 3. The events

| Event | Fires when | Pixel | CAPI | Deduplicated | Value |
|---|---|---|---|---|---|
| `PageView` | Each path shown, once | ✓ | — | n/a | — |
| `ViewContent` | Home, Pricing, Features, How It Works, Why Us, About | ✓ | — | n/a | — |
| `Lead` | *(no surface exists — §7)* | — | ✓ | ✓ | — |
| `CompleteRegistration` | An account row exists | ✓ | ✓ | ✓ | — |
| `CreateFamily` (custom) | A family row is committed | ✓ | ✓ | ✓ | — |
| `InitiateCheckout` | Checkout session opened *(§7)* | — | ✓ | ✓ | ✓ |
| `Purchase` | First payment settles *(§7)* | — | ✓ | ✓ | ✓ |
| `Subscribe` | First payment settles *(§7)* | — | ✓ | ✓ | ✓ |
| `SubscriptionRenewal` (custom) | A renewal settles *(§7)* | — | ✓ | ✓ | ✓ |

**Why PageView and ViewContent are Pixel-only.** A server counterpart would mean reading
cookies during the render of `/pricing` and Home, which makes those pages dynamic. They are
statically generated, they are where advertising clicks land, and their time-to-first-byte
is worth more than a duplicate of an event the browser already reports. No CONVERSION is
Pixel-only, which is the half that matters.

**Why every conversion is server-authoritative.** An ad blocker cannot suppress it, a closed
laptop cannot lose it, and a refreshed success page cannot repeat it.

---

## 4. Deduplication and idempotency

Meta collapses a Pixel event and a Conversions API event into one when the Pixel's `eventID`
equals the server's `event_id` **and** the Pixel's `event` equals the server's `event_name`,
within **48 hours**.

Ids are **deterministic**, not random — `metaEventId(event, businessKey)` in `event-id.ts`:

```
CompleteRegistration  ← the account id      registration_<32 hex>
CreateFamily          ← the family code     family_<32 hex>
Purchase / Subscribe  ← the transaction id  purchase_<32 hex> / subscribe_<32 hex>
SubscriptionRenewal   ← the transaction id  renewal_<32 hex>
```

The key is hashed, so no account id, family code or payment reference ever leaves the
building. The event name is folded into the hash, so one key under two events yields two ids.

**Threading the id to the browser.** The server sends its event and returns the id it used;
the form fires the Pixel with that id. `registerUser` returns `meta: { completeRegistration,
createFamily }`; `createFamily` returns `metaCreateFamilyEventId`. Each is **null** when the
server did not send — tracking off, consent refused, id already spent — so the browser cannot
report a conversion the server declined.

**Beyond 48 hours** Meta no longer deduplicates, which is exactly when a provider's
dead-letter retry arrives. `marketing_conversion_events` closes that: the event id is the
primary key and the claim is a single `INSERT … RETURNING`, so a webhook delivered five times
sends once. It is also the only trace a background send leaves anywhere in this product —
query it to see what has not landed:

```sql
SELECT event_name, delivery, detail, claimed_at
  FROM marketing_conversion_events
 WHERE delivery <> 'sent'
 ORDER BY claimed_at DESC;
```

---

## 5. Consent

One cookie, `genorra_marketing_consent`, read by the Pixel **and** by every server event.
Server-side tracking is not a privacy bypass: if consent is not granted, `dispatch.ts` sends
nothing, and the reason is returned as `no-consent`.

**Opt-in by default.** With no cookie, `META_CONSENT_DEFAULT` decides, and it is `denied`
unless configured — an unconfigured deployment collects nothing until somebody chooses.
Setting it to `granted` produces the opt-out model common for US-only advertisers. Which is
lawful where is a business and legal decision, not a code one.

Declining also deletes `_fbp` and `_fbc` — first-party cookies on our origin — so a
withdrawal takes effect immediately rather than at the next navigation.

`ConsentBanner` renders only where a Pixel is configured and only until a choice is made.
Both buttons are the same size: a refusal that is harder to make than an acceptance makes the
recorded consent worth less than no consent at all.

---

## 6. Privacy — what Meta never receives

The guarantee is structural. `buildCustomData` copies a fixed set of named keys and drops
everything else; `MetaAccountHolder` has nine fields and no route for a tenth. Handing either
a `people` row produces the safe subset and drops the rest on the floor.

**Never sent:** children's data of any kind, dates of birth, ages, family member names,
relationships, ancestry, ethnicity, race, religion, health, precise location, street
addresses, photographs, family-tree records, biographies, messages, comments, documents, dues
balances, payment card or bank details, passwords, tokens, family names, family codes.

**Sent, for the adult account holder only:** hashed email, phone, first name, last name, city,
state, postal code, country and `external_id` (the hashed `auth.users` id); plain-text IP,
user agent, `_fbp`, `_fbc`.

Three specific decisions worth knowing before "improving" match quality:

* **Date of birth and gender are not sent**, though Meta accepts both. A birthday is collected
  here so relatives can wish each other happy birthday.
* **`external_id` is the ACCOUNT**, never a `people.id`. One person may hold rows in several
  families, and a `people` row may describe somebody with no account at all.
* **Automatic configuration is off in the base code** — `fbq('set', 'autoConfig', false, …)`
  before `init`. Without it the Pixel sends button-click text and page metadata of its own
  accord, and in this product a button can say "Add Sydnee as a daughter". Automatic Advanced
  Matching is a separate Events Manager setting and **must also be turned off** (§8).

---

## 7. What is built and not wired

**GENORRA has no payment provider.** `payment_info.md` is pre-implementation research,
`TIER_IS_SOLD` is false for every paid tier, and `setFamilyTier` is scaffolding that charges
nothing. So `billing.ts` is complete, typed and tested, and is called by nothing.

Firing `Purchase` from `setFamilyTier` was the alternative and is the anti-pattern: the button
press is not the payment. It would teach Meta to find people who press a free control, and
report revenue the business never received.

**When a provider is integrated**, the webhook handler calls one function:

```ts
import { trackSubscriptionPayment } from '@/lib/meta/billing'

// inside the verified webhook, after the charge is confirmed
await trackSubscriptionPayment({
  transactionId: invoice.id,          // the CHARGE, not the subscription
  subscriptionId: invoice.subscription,
  amountCents: invoice.amount_paid,   // what was charged — never TIER_PRICE
  currency: invoice.currency,
  planId: 'standard',
  billingInterval: 'monthly',
  firstPayment: invoice.billing_reason === 'subscription_create',
  holder: { userId, email, firstName, lastName },
  occurredAtMs: invoice.created * 1000,
})
```

`firstPayment` sends `Purchase` **and** `Subscribe`; anything else sends
`SubscriptionRenewal` only. Renewals are deliberately not `Purchase`: a subscription business
sends far more renewals than acquisitions, and folding them together makes the new-customer
count grow every month with no new customers in it. The revenue is not lost — turn
`SubscriptionRenewal` into a custom conversion when lifetime revenue is wanted.

`InitiateCheckout` likewise waits for a real checkout session. `Lead` waits for a real lead
surface — there is no waitlist, demo request or newsletter in this product, and using `Lead`
to mean "viewed pricing" would make a Lead-optimised campaign chase readers.

---

## 8. Meta configuration required

In **Events Manager**:

1. Create (or identify) the **Dataset / Pixel** and copy its id → `META_PIXEL_ID`.
2. **Settings → Conversions API → Generate access token** →
   `META_CONVERSIONS_API_ACCESS_TOKEN`. Server-side only.
3. **Turn OFF Automatic Advanced Matching.** Settings → *Automatic advanced matching*. This is
   the single most important box for this product: left on, the Pixel scrapes form fields on
   pages where people type their relatives' names and birthdays. The base code disables
   `autoConfig`, which is a different setting; both are needed.
4. **Verify the domain** (`genorra.com`) under Brand Safety → Domains, so conversions can be
   configured under Aggregated Event Measurement.
5. Configure **Aggregated Event Measurement** priorities once volume exists — `Purchase`
   highest, then `Subscribe`, `CreateFamily`, `CompleteRegistration`, `ViewContent`.
6. For QA: **Test Events** tab → copy the test code → set `META_TEST_EVENT_CODE` on the
   Preview environment only.

In **Business Manager**: the dataset must be owned by the business and assigned to the ad
account that will use it.

---

## 9. Verifying it

**Test Events** (Events Manager → Data Sources → your dataset → Test Events):

1. Set `META_TEST_EVENT_CODE` on a preview deployment and redeploy.
2. Open the preview URL with `?fbclid=TEST123&utm_source=facebook&utm_campaign=qa`.
3. **Accept** on the consent banner. Nothing fires before this.
4. Walk the funnel: Home → Pricing → Register (create a family) → `/my-families` → create a
   second family.
5. Expect, in order: `PageView`, `ViewContent` (Home), `PageView`, `ViewContent` (Pricing),
   `PageView`, `CompleteRegistration`, `CreateFamily`.

What to check:

* **PageView appears once per page**, not twice. Twice means the base snippet's own call came
  back, or a second effect was added.
* **`CompleteRegistration` appears once**, marked as received from both Browser and Server.
  Two separate rows means the event ids diverged.
* **`event_source_url`** is the canonical origin and carries **no query string**.
* **`action_source`** is `website`.
* **Matching parameters**: `em`, `fn`, `ln`, `external_id`, `client_ip_address`,
  `client_user_agent`, `fbp`, `fbc`. Confirm `fbc` is present after an `fbclid` landing.
* **No family data anywhere** in `custom_data` — `content_name` should read
  `Family Workspace`, never a family's name.

**Deduplication** shows in the event's detail view as one event with both sources. Also check
Diagnostics for "duplicate events", "missing event_id", "missing currency/value", "invalid
fbc/fbp".

**Locally**, without Meta at all:

```bash
npm test          # 900+ assertions, including the privacy allow-lists
npm run lint
npm run typecheck
```

---

## 10. Adding a new event safely

1. **Does a Meta standard event describe it?** Use that. A custom event needs a custom
   conversion before a campaign can optimise on it.
2. Add the name to `META_STANDARD_EVENTS` or `META_CUSTOM_EVENTS` in `events.ts`.
3. Add a prefix to `EVENT_ID_PREFIX` in `event-id.ts`, and decide **what business key makes it
   unique**. If there isn't one, it is probably a Pixel-only event.
4. Add a function to `conversions.ts` or `billing.ts` — never call `trackServerEvent` from a
   call site, or the event name, the key and the permitted fields drift.
5. **Fire it after the fact, never on intent.**
6. If the browser also fires it, return the id from the action and pass it to
   `trackPixelEvent`.
7. If it carries money, add it to `requiresValue` and take the amount from the transaction.
8. Add a test. `events.test.ts` for the shape, `event-id.test.ts` for the key.

**Do not** add a field to `MetaCustomData` or `MetaAccountHolder` without asking whether every
customer's value for it is safe to send. That question is what these two allow-lists exist to
force.
