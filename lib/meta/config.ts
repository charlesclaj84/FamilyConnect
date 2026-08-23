/**
 * What this deployment is allowed to tell Meta, and with which credentials.
 *
 * ── ONE DECISION, ASKED IN TWO PLACES ───────────────────────────────────────────────
 * The browser Pixel and the Conversions API are two transports for one set of business
 * events, and the thing that most often goes wrong with a dual implementation is that
 * they disagree about whether to fire at all — a preview deployment whose Pixel is off
 * and whose server events land in the production dataset is worse than either being
 * wrong on its own, because the funnel then reports a registration with no PageView in
 * front of it. So `metaMode()` is resolved once, on the server, and both transports
 * obey it: the layout will not render the Pixel when it answers 'off', and
 * `sendMetaEvent` refuses for the same reason.
 *
 * ── THREE MODES, AND `test` IS NOT A DIMMER SWITCH ──────────────────────────────────
 *   'production'  VERCEL_ENV is production. Events are real. `test_event_code` is
 *                 DELIBERATELY IGNORED here even when the variable is set, because the
 *                 failure it prevents — a release shipped with test mode still on, whose
 *                 conversions never reach optimisation and never appear in reporting — is
 *                 silent, and the only place it is expensive.
 *   'test'        Any other deployment, but only when META_TEST_EVENT_CODE is set.
 *                 Events go to the SAME dataset carrying that code, which is what puts
 *                 them in Events Manager's Test Events tab instead of in the dataset's
 *                 live totals. This is the deliberate QA mechanism.
 *   'off'         Everything else, which includes every developer laptop by default.
 *                 Nothing is sent and nothing is loaded, so localhost cannot pollute the
 *                 production dataset by forgetting a flag.
 *
 * ── WHY THE PIXEL ID IS NOT A `NEXT_PUBLIC_` VARIABLE ───────────────────────────────
 * It could be — a Pixel id is public by construction, it is in the page source of every
 * site that runs one. It is a plain server variable anyway because the id is only USEFUL
 * to the browser alongside the decision above, and that decision needs VERCEL_ENV, which
 * is not a NEXT_PUBLIC_ variable and reads as `undefined` in a client bundle. Resolving
 * both here and passing the id down as a prop means the browser is handed an id only on a
 * deployment that is meant to fire, rather than being handed one always and asked to work
 * out whether to use it. It also means there is exactly one `META_` variable the browser
 * can ever see, which makes the security review below a short one.
 *
 * ── THE ACCESS TOKEN ────────────────────────────────────────────────────────────────
 * `metaAccessToken()` is called by ONE file, `lib/meta/capi.ts`, which is imported by
 * server modules only. It is not a `NEXT_PUBLIC_` variable, so Next does not inline it
 * into any client bundle even if a client component were to reference it — the reference
 * would compile to `undefined`. `lib/meta/no-client-secrets.test.ts` asserts that no
 * module reachable from a `'use client'` file names it at all, because relying on that
 * compile-time behaviour to hide a mistake is not the same as not making one.
 */

import { PRODUCTION_ORIGIN, SITE_URL } from '@/lib/site'
import type { ConsentDecision } from '@/lib/consent'

/**
 * The Graph API version the Conversions API is called on.
 *
 * v26.0 is current as of 2026-08-22 (released 2026-07-29). Meta supports a version for
 * roughly two years from release, so this is a date to revisit rather than a thing that
 * breaks — but PIN IT rather than calling the unversioned edge: an unpinned call follows
 * whatever Meta promotes to default, and a breaking change to `user_data` normalisation
 * would then arrive on a Tuesday with no deploy of ours in between.
 *
 * `META_GRAPH_API_VERSION` overrides it, so a version bump can be tested on a preview
 * deployment before it is written into this file.
 */
export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || 'v26.0'

export type MetaMode = 'production' | 'test' | 'off'

/** Trim, and treat an empty string exactly as an unset variable. */
function env(name: string): string | null {
  const raw = process.env[name]
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value.length > 0 ? value : null
}

/**
 * The dataset (Pixel) id. Public — it appears in the page source wherever the Pixel runs.
 *
 * Nothing here validates its shape. Meta ids are numeric today and a length check would
 * be this file inventing a rule Meta has not stated; a wrong id is a diagnostic in Events
 * Manager, which is where somebody would look anyway.
 */
export function metaPixelId(): string | null {
  return env('META_PIXEL_ID')
}

/**
 * The Conversions API access token. SERVER ONLY — see the header.
 *
 * Never logged, never returned to a caller, never interpolated into an error message.
 * `lib/meta/capi.ts` puts it in the request BODY rather than the query string for the
 * same reason: a query string is the half of a URL that ends up in access logs and in
 * exception reports.
 */
export function metaAccessToken(): string | null {
  return env('META_CONVERSIONS_API_ACCESS_TOKEN')
}

/** Raw variable. `metaTestEventCode()` below is what callers should use. */
function rawTestEventCode(): string | null {
  return env('META_TEST_EVENT_CODE')
}

/**
 * Is this the deployment that owns the production dataset?
 *
 * Same test `IS_INDEXABLE_DEPLOYMENT` in lib/site.ts makes, and deliberately the same
 * shape rather than an import: that constant answers a question about SEARCH and this one
 * answers a question about ADVERTISING, and folding them together would mean a change to
 * one silently moved the other. `VERCEL_ENV` is 'production' only for the production
 * deployment — a preview build of the same commit reports 'preview'.
 */
function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

/**
 * Whether this deployment may talk to Meta at all, and how.
 *
 * Resolved fresh on every call rather than captured in a module constant, because the
 * tests set `process.env` per case and a constant evaluated at import time would freeze
 * whichever environment happened to load the module first.
 */
export function metaMode(): MetaMode {
  if (!metaPixelId()) return 'off'
  if (isProductionDeployment()) return 'production'
  return rawTestEventCode() ? 'test' : 'off'
}

/**
 * The `test_event_code` to attach to a server event, or null.
 *
 * Null in production ALWAYS. See the header — this is the one place the "left test mode
 * on" failure can be prevented, and it is prevented by construction rather than by a
 * deployment checklist.
 */
export function metaTestEventCode(): string | null {
  return metaMode() === 'test' ? rawTestEventCode() : null
}

/**
 * What the browser needs, or null when this deployment does not run the Pixel.
 *
 * Deliberately the whole of what crosses into the client bundle from this file. If a
 * future field is added here, it is public by definition — that is the review this shape
 * exists to force.
 */
export interface MetaClientConfig {
  pixelId: string
  /** Surfaced so the Pixel can be labelled in a QA deployment; never sent to Meta. */
  mode: Exclude<MetaMode, 'off'>
}

export function metaClientConfig(): MetaClientConfig | null {
  const mode = metaMode()
  const pixelId = metaPixelId()
  if (mode === 'off' || !pixelId) return null
  return { pixelId, mode }
}

/**
 * What consent resolves to when the visitor has not chosen.
 *
 * It lives HERE rather than in lib/consent.ts because that module is imported by client
 * components, and a `process.env` read in a client-reachable module compiles to `undefined`
 * for anything without a `NEXT_PUBLIC_` prefix — which would work (it falls through to
 * 'denied') while quietly meaning something different in the browser than on the server.
 * One place reads the variable; both halves are handed the answer.
 *
 * See lib/consent.ts for why the default is `'denied'` and why `'granted'` — the opt-out
 * model — is a business decision rather than a setting to flip for more signal.
 */
export function consentDefault(): ConsentDecision {
  return process.env.META_CONSENT_DEFAULT?.trim() === 'granted' ? 'granted' : 'denied'
}

/**
 * The origin every `event_source_url` is built against.
 *
 * CONFIGURATION, NEVER A REQUEST HEADER — the same rule `emailOrigin()` in
 * lib/email/send.ts states at length, for a slightly different reason. There the payload
 * is a link somebody is told to trust; here it is the URL Meta attributes a conversion
 * to, and `Host` is attacker-controlled, so a poisoned header would let anyone file our
 * conversions against a hostname of their choosing. Reading it from configuration also
 * means a server event fired from a background context, where there is no request at all,
 * still carries a canonical URL rather than nothing.
 */
export function metaEventSourceOrigin(): string {
  return metaMode() === 'production' ? PRODUCTION_ORIGIN : SITE_URL
}

/**
 * A path turned into the absolute URL Meta wants for `event_source_url`.
 *
 * The QUERY STRING IS DROPPED, always, and that is a privacy decision rather than tidying:
 * a member can arrive at any screen with anything in the query — a search term, an
 * invitation token, an id — and `event_source_url` is a field Meta stores verbatim. Paths
 * in this product are structural and name features; query strings are not, and none of the
 * events sent from here needs one to be interpretable.
 */
export function metaEventSourceUrl(path: string): string {
  const clean = (path || '/').split('?')[0].split('#')[0]
  return `${metaEventSourceOrigin()}${clean.startsWith('/') ? clean : `/${clean}`}`
}
