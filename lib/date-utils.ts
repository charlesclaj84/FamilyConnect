const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
 * as "Monday June 12th, 2026". Used site-wide (reports use formatDateNumeric instead).
 */
export function formatDate(date: string | null | undefined): string | null {
  if (!date) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}${ordinal(d)}, ${y}`
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
