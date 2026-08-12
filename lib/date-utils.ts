const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Today as YYYY-MM-DD, in the caller's OWN timezone — the value every `<input
 * type="date">` in the app wants as its default.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)`, which every form here used
 * to do. That string is UTC, and for anyone west of Greenwich it is TOMORROW's date
 * for the last hours of each day: a treasurer in Pacific time opening a payment form
 * at 6pm got a date the family had not reached yet, and dated the cheque accordingly.
 * A date input holds a local calendar date, so its default has to be one too.
 */
/**
 * Whole days from now until `date`, floored at 0, or null when there is no date.
 *
 * WHY THIS IS A FUNCTION HERE rather than a `Date.now()` inline where it is used. It was
 * inline in the Dashboard, and `react-hooks/purity` is right to flag that: reading the
 * clock during render makes a component's output depend on when it happened to render. It
 * is *safe* on the Dashboard specifically, which is a server component rendered once per
 * request — but "safe because of where it is" is exactly the kind of reasoning that stops
 * being true when somebody adds `'use client'`. Putting the impurity behind a named call
 * keeps the component readable as a pure function of its data, and makes the countdown
 * reusable — Events and My Summary both want the same sentence.
 *
 * Compared on absolute time, not calendar days, so this answers "how long until" and not
 * "how many dates away". Callers wanting the latter should compare YYYY-MM-DD strings, the
 * way `getUpcomingEvents` filters past events.
 */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const target = new Date(date).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.round((target - Date.now()) / 86400000))
}

/**
 * "Just now" / "5m ago" / "3h ago", falling back to a full date past a day.
 *
 * HERE RATHER THAN IN A COMPONENT for the reason spelled out on `daysUntil` above: it
 * reads the clock, and reading the clock during render makes a component's output depend
 * on when it happened to render, which `react-hooks/purity` is right to flag. Putting the
 * impurity behind a named call keeps the callers readable as pure functions of their data.
 *
 * It lived as a private helper inside `components/layout/NotificationBell.tsx` until the
 * Dashboard's Recent Updates card needed the same sentence. Two copies of a relative-time
 * formatter is how a bell starts saying "2h ago" beside a card saying "2 hours ago" about
 * the same row — so there is one, and both import it.
 *
 * The handover to `formatDate` at 24h is deliberate. Past a day "yesterday" and "3d ago"
 * stop being more useful than the date itself, and a member scanning a list wants
 * something they can match against a calendar.
 */
export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return formatDate(iso) ?? ''
}

export function todayLocal(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

/**
 * Format a date — either a date-only string (YYYY-MM-DD) or an ISO timestamp —
 * as "June 12th, 2026". Used site-wide (reports use formatDateNumeric instead).
 *
 * No weekday. It used to lead with one ("Monday June 12th, 2026"), which stretched
 * every date in the app to carry a fact almost none of them needed — a payment date,
 * a schedule start, a booking deadline are not read by day of the week.
 */
export function formatDate(date: string | null | undefined): string | null {
  if (!date) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return `${MONTHS[m - 1]} ${d}${ordinal(d)}, ${y}`
}

/** Format a date as MM/DD/YYYY — used on reports. */
export function formatDateNumeric(date: string | null | undefined): string | null {
  if (!date) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`
}

/** Format a TIME string (HH:MM or HH:MM:SS) as "2:30 PM" */
export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null
  const [h, min] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${min.toString().padStart(2, '0')} ${period}`
}

/** Format a date range, e.g. "Jun 15 – Jun 18, 2026" or just "Jun 15, 2026" */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const s = formatDate(start)
  if (!s) return null
  const e = formatDate(end)
  if (!e || e === s) return s
  return `${s} – ${e}`
}

export const TIMEZONES = [
  // US
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  // Canada
  'America/Toronto',
  'America/Vancouver',
  'America/Halifax',
  'America/St_Johns',
  // Common international
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

export const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York':      'Eastern Time (ET)',
  'America/Chicago':       'Central Time (CT)',
  'America/Denver':        'Mountain Time (MT)',
  'America/Phoenix':       'Mountain Time – Arizona (no DST)',
  'America/Los_Angeles':   'Pacific Time (PT)',
  'America/Anchorage':     'Alaska Time (AKT)',
  'Pacific/Honolulu':      'Hawaii Time (HT)',
  'America/Toronto':       'Eastern – Canada',
  'America/Vancouver':     'Pacific – Canada',
  'America/Halifax':       'Atlantic – Canada',
  'America/St_Johns':      'Newfoundland – Canada',
  'Europe/London':         'London (GMT/BST)',
  'Europe/Paris':          'Paris (CET/CEST)',
  'Europe/Berlin':         'Berlin (CET/CEST)',
  'Africa/Lagos':          'West Africa (WAT)',
  'Africa/Johannesburg':   'South Africa (SAST)',
  'Asia/Dubai':            'Gulf Time (GST)',
  'Asia/Kolkata':          'India (IST)',
  'Asia/Tokyo':            'Japan (JST)',
  'Asia/Shanghai':         'China (CST)',
  'Australia/Sydney':      'Sydney (AEST/AEDT)',
  'Pacific/Auckland':      'New Zealand (NZST/NZDT)',
}
