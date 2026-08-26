import { formatDate, formatTime } from '@/lib/date-utils'

/**
 * Reading an INSTANT in a zone.
 *
 * ── THE ONE DISTINCTION THIS MODULE EXISTS TO KEEP ──────────────────────────────────
 * There are two kinds of time in this product and they must never be handled by the same
 * code:
 *
 *   AN INSTANT        a moment that happened. `timestamptz` — every one of the ~190
 *                     timestamp columns in the schema is one. A payment recorded, a message
 *                     sent, a vote cast. It has no calendar date of its own: the date it
 *                     "was" depends entirely on which zone you ask from.
 *
 *   A WALL-CLOCK      what a paper invitation says. `DATE` and `TIME` columns — a gathering's
 *   LABEL             11:00, an election's closing day, a dues start date. It is never
 *                     converted, never compared across zones, and never turned into a `Date`.
 *                     `20260826000001`'s header argues this at length and its conclusion is
 *                     binding: *"If a family timezone is ever recorded, do NOT convert
 *                     these."*
 *
 * **THIS MODULE IS FOR THE FIRST ONLY.** `lib/date-utils.ts` handles the second, and its
 * formatters take `YYYY-MM-DD` strings apart with `.split('-')` precisely so that no `Date`
 * is ever constructed from a label. Nothing here may be pointed at a `DATE` column, and
 * `dateIn` throws rather than let it happen — see "WHY ONE FAILURE THROWS" below.
 *
 * ── THE BUG IT WAS WRITTEN FOR ──────────────────────────────────────────────────────
 * `formatDate` takes `date.slice(0, 10)`, which for an ISO timestamp is the **UTC** calendar
 * date. So ten call sites rendering `created_at` — Payment History, Transactions, Documents,
 * Officer Notes — were printing the wrong day for every row entered after 7pm Central:
 *
 *     2026-07-31T00:30:00Z   →  formatDate  →  "July 31st, 2026"
 *                            →  the treasurer entered it at 7:30pm on the 30th
 *
 * A payment dated a day late in a ledger a family reconciles against a bank statement. The
 * repair is `formatDate(dateIn(iso, zone))` — resolve the instant to a calendar date in a
 * stated zone FIRST, then hand a label to the label formatter. That composition is the whole
 * design: this module produces `YYYY-MM-DD` and `HH:MM` strings, and `date-utils` keeps its
 * monopoly on how a date is worded.
 *
 * ── THE ZONE IS A PARAMETER, WHICH IS WHAT MAKES THIS TESTABLE ──────────────────────
 * AGENTS.md §7b: a pure module with real edge cases takes what it would otherwise read from
 * the world as an argument, the way `duesPlanMath` takes `today`. Every function here takes
 * its zone, and every clock-reader takes an optional `now`. So `lib/tz.test.ts` needs no
 * `process.env.TZ` reassignment at all — which matters more than convenience: `calendar.ts`
 * records a mutation that shipped GREEN from CI and failed only on a laptop, because an
 * `Intl.DateTimeFormat` resolves its zone when it is CONSTRUCTED and a module-level formatter
 * therefore never notices `TZ` changing. A parameter cannot go stale that way.
 *
 * `lib/auth/zone.ts` is the impure half that answers "which zone is this caller in".
 *
 * ── WHY ONE FAILURE THROWS AND THE OTHER FALLS BACK ─────────────────────────────────
 * The two look inconsistent and are deliberately not the same kind of problem:
 *
 *   a bare `YYYY-MM-DD`   **throws.** A DATE column reaching an instant formatter is a
 *   reaching `dateIn`     PROGRAMMING error, and it is uniform — a column is either a date or
 *                         a timestamp for every row, so it fails on the first render in
 *                         development rather than in production for one member in one zone.
 *                         Failing loudly is safe precisely because it cannot be
 *                         data-dependent. Same reasoning as `monthLabel`'s `TypeError`.
 *
 *   an unusable zone      **falls back to `DEFAULT_ZONE`.** This one IS data-dependent: it
 *                         arrives from `people.time_zone`, a column a member can write. A
 *                         500 on the dashboard because somebody's profile holds a zone the
 *                         runtime's ICU build does not know is not a trade worth making.
 *                         `resolveZone` validates at the source, so this should be
 *                         unreachable; it is the second layer, not the first.
 */

/**
 * The zone to use when nobody has said — Central.
 *
 * Chosen rather than UTC, and that is the point: UTC is the zone in which no member of any
 * family lives, so defaulting to it guarantees a wrong answer for everybody instead of a
 * right one for most. The product's families are US-centred, and Central is the most populous
 * US zone.
 *
 * It is a fallback and never a claim. Where a member has stated a zone, theirs wins; where a
 * gathering states the zone its times were written in, that wins for those times.
 */
export const DEFAULT_ZONE = 'America/Chicago'

/**
 * The cookie the browser writes its own zone into, read by `resolveZone`.
 *
 * DEFINED HERE, IN THE PURE MODULE, AND NOT BESIDE THE RESOLVER — which is where it started.
 * `components/layout/ZoneHint.tsx` is a client component and needs this name, and
 * `lib/auth/zone.ts` imports `createAdminClient`; so importing it from there would have
 * pulled the SERVICE-ROLE CLIENT into the browser bundle. `lib/meta/no-client-secrets.test.ts`
 * caught it, which is exactly the job that test exists for.
 *
 * Same shape as `lib/help/route-match.ts` having no imports of its own so that a client
 * component can use it without dragging the whole help manual across the boundary. **Keep
 * this module free of server imports** for that reason: it is on the client side of the line.
 *
 * Named with the product prefix like `genorra:last-activity`, so this app's whole
 * client-visible storage surface greps as one set.
 */
export const ZONE_HINT_COOKIE = 'genorra:tz'

/** `YYYY-MM-DD` — a wall-clock label, which must never be handed to an instant function. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Does the runtime know this zone?
 *
 * `Intl.DateTimeFormat` throws a `RangeError` for an unknown `timeZone`, which is the only
 * portable way to ask. Used by `resolveZone` to validate a stored preference once, at the
 * source, rather than at every formatting call.
 */
export function isValidZone(zone: string | null | undefined): boolean {
  if (!zone || typeof zone !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** The given zone if the runtime knows it, else `DEFAULT_ZONE`. Never throws. */
function usableZone(zone: string | null | undefined): string {
  return isValidZone(zone) ? (zone as string) : DEFAULT_ZONE
}

interface ZonedParts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}

/**
 * An instant's calendar fields as seen from one zone.
 *
 * `formatToParts` rather than parsing a formatted string, because the shape of a formatted
 * string is a locale's business and this needs the FIELDS. `hourCycle: 'h23'` rather than
 * `hour12: false`: the latter produces `"24"` for midnight on some ICU builds, so a midnight
 * instant would come back as hour 24 of the right day — which is not a time.
 *
 * `null` for anything that is not a parseable instant, matching `date-utils`' convention of
 * answering `null` for absent rather than throwing at a render site.
 */
function zonedParts(iso: string | Date, zone: string): ZonedParts | null {
  const at = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: usableZone(zone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)

  const bag: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  if (!bag.year || !bag.month || !bag.day || !bag.hour || !bag.minute) return null
  return bag as unknown as ZonedParts
}

/**
 * The calendar date an instant fell on, in `zone`, as `YYYY-MM-DD`.
 *
 * This is the function the ten broken call sites needed. Compose it with `formatDate` to keep
 * one date voice in the app:
 *
 *     formatDate(dateIn(row.created_at, zone))    // "July 30th, 2026"
 *
 * `null` for an absent or unparseable value, so it drops straight into the `?? '—'` shape the
 * call sites already use.
 *
 * **Throws for a bare `YYYY-MM-DD`.** That string is a wall-clock label and has no instant to
 * resolve; `new Date('2026-08-01')` is UTC midnight, so converting it into a negative offset
 * would answer 31 July and move a gathering to the wrong day. See the header for why this one
 * is loud.
 */
export function dateIn(iso: string | Date | null | undefined, zone: string): string | null {
  if (iso === null || iso === undefined || iso === '') return null
  if (typeof iso === 'string' && DATE_ONLY_RE.test(iso.trim())) {
    throw new TypeError(
      `dateIn: "${iso}" is a wall-clock date, not an instant. ` +
      'DATE columns are never converted between zones — pass it to formatDate directly.'
    )
  }
  const parts = zonedParts(iso, zone)
  if (!parts) return null
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * The wall-clock time an instant fell on, in `zone`, as `HH:MM` (24-hour).
 *
 * Returns the same shape `lib/gathering-when.ts` normalises to and `formatTime` reads, so an
 * instant can be worded by the app's existing time formatter:
 *
 *     formatTime(timeIn(message.created_at, zone))   // "2:30 PM"
 *
 * That composition is why this returns 24-hour digits rather than a formatted string: one
 * module decides how a time is WORDED, and it is not this one.
 */
export function timeIn(iso: string | Date | null | undefined, zone: string): string | null {
  if (iso === null || iso === undefined || iso === '') return null
  const parts = zonedParts(iso, zone)
  if (!parts) return null
  return `${parts.hour}:${parts.minute}`
}

/**
 * Today's date in `zone`, as `YYYY-MM-DD`.
 *
 * The zoned counterpart of `todayLocal()` in `date-utils`, which reads the RUNTIME's zone —
 * UTC on the server and the member's in the browser, so the two disagree about what day it is
 * for the last hours of every day. Anything server-rendered wants this one.
 *
 * `now` is a parameter, defaulted, for §7b's reason: a function that reads the clock
 * internally is a function whose behaviour cannot be asserted. Callers pass nothing.
 */
export function todayIn(zone: string, now: Date = new Date()): string {
  // Never null: `now` is a real Date and the zone is coerced to a usable one.
  return dateIn(now, zone) as string
}

/**
 * The zone's short name at a given instant — "CDT", "GMT+1".
 *
 * For the label beside a stated time ("11:00 AM CDT"). It takes an instant because the answer
 * genuinely depends on one: the same zone is CST in January and CDT in July, and printing the
 * wrong one beside a summer gathering is exactly the kind of detail a reader checks.
 *
 * `timeZoneName: 'short'` gives a real abbreviation where one exists and a `GMT±H` form where
 * it does not, which is the honest output for zones that have no common abbreviation.
 */
export function zoneAbbrev(zone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: usableZone(zone),
    timeZoneName: 'short',
  }).formatToParts(at)
  return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
}

/**
 * Do two zones show the same wall clock at this instant?
 *
 * What the "your time" line is gated on. A member in `America/Chicago` reading a gathering
 * stated in `America/Chicago` must not be shown "11:00 AM CDT · 11:00 AM your time", which is
 * noise that makes the screen look broken.
 *
 * Compared on the OFFSET at that instant rather than on the zone NAME, deliberately:
 * `America/Chicago` and `America/Mexico_City` are different zones that frequently agree, and
 * a member in the second does not need to be told their own time twice either. It is compared
 * at an instant because two zones can agree in January and differ in July.
 */
export function sameClock(a: string, b: string, at: Date = new Date()): boolean {
  return timeIn(at, a) === timeIn(at, b) && dateIn(at, a) === dateIn(at, b)
}

/**
 * An instant, worded as a date in the reader's zone — "July 30th, 2026".
 *
 * The composition the ten broken call sites needed, as one call so that each of them is a
 * 1:1 swap from `formatDate(row.created_at)` and a reviewer can see at a glance which sites
 * changed and which did not. `formatDate` keeps its monopoly on how a date is WORDED; this
 * only decides which date it is.
 *
 * The import direction is `tz` → `date-utils` and never the reverse: `date-utils` must stay
 * free of any notion of a zone, because its whole job is the values that do not have one.
 */
export function formatInstantDate(
  iso: string | Date | null | undefined,
  zone: string,
): string | null {
  return formatDate(dateIn(iso, zone))
}

/**
 * An instant, worded as a date and a time in the reader's zone — "July 30th, 2026 at 7:30 PM".
 *
 * For the places that show when something happened to the minute: a chat message, a safety
 * check-in response. Both currently call `toLocaleString` with the RUNTIME's zone, which is
 * the browser's in a client component and UTC on the server — so the same row renders
 * differently depending on which side drew it.
 */
export function formatInstant(
  iso: string | Date | null | undefined,
  zone: string,
): string | null {
  const date = formatDate(dateIn(iso, zone))
  if (!date) return null
  const time = formatTime(timeIn(iso, zone))
  return time ? `${date} at ${time}` : date
}

/**
 * The instant at which `zone` reads `day` at `time`.
 *
 * ── THE ONE PLACE A LABEL IS DELIBERATELY TURNED INTO AN INSTANT ────────────────────
 * Everything else in this module goes the other way, and the header is emphatic that a
 * wall-clock label is never converted. This is the sanctioned exception and it is narrow: the
 * result is used ONLY to render a secondary "your time" line beside the stated one, and the
 * stored label is untouched and still what every screen leads with. `components/ui/stated-time.tsx`
 * is the sole caller and states the display rule it serves.
 *
 * ── WHY IT TAKES TWO PASSES ─────────────────────────────────────────────────────────
 * JavaScript has no "interpret this wall clock in that zone" primitive. `new Date('2026-07-04T11:00')`
 * uses the RUNTIME's zone, which is exactly the bug this whole module exists to fix. So: take
 * the naive UTC instant for those digits, ask what the target zone reads there, and shift by
 * the difference.
 *
 * One correction is enough for every real offset — they are whole minutes and within a day —
 * and the fold below handles the case where the naive reading lands on the adjacent DAY, which
 * happens for every zone far enough from UTC (Auckland at 00:15 resolves to the previous UTC
 * day). A second pass would only matter across a DST transition inside the affected hour, where
 * every answer is arguable.
 *
 * MEASURED, not reasoned — see `tz.test.ts`, which asserts that the instant reads BACK as the
 * stated time in the stated zone for Chicago in both seasons, Tokyo near midnight, Auckland
 * across the day boundary, and Kolkata's half-hour offset.
 */
export function instantAt(day: string, time: string, zone: string): Date {
  const naive = new Date(`${day}T${time}:00Z`)
  if (Number.isNaN(naive.getTime())) return new Date()
  const readsBack = timeIn(naive, zone)
  if (!readsBack) return naive
  const [wantH, wantM] = time.split(':').map(Number)
  const [gotH, gotM] = readsBack.split(':').map(Number)
  if (![wantH, wantM, gotH, gotM].every(Number.isFinite)) return naive
  let deltaMinutes = (wantH * 60 + wantM) - (gotH * 60 + gotM)
  // The reading can land on the previous or next day, which shows up as a delta near a whole
  // day. Fold it back into the nearest twelve hours either way.
  if (deltaMinutes > 720) deltaMinutes -= 1440
  if (deltaMinutes < -720) deltaMinutes += 1440
  return new Date(naive.getTime() + deltaMinutes * 60000)
}
