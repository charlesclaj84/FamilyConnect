// Pure helpers for matching a freshly-registered user against existing unlinked
// people in their family ("is this you?"). No DB access — easily unit-testable.

export type MatchReason = 'email' | 'phone' | 'dob' | 'name'

export interface MatchablePerson {
  first_name?: string | null
  last_name?: string | null
  nick_name?: string | null
  primary_email?: string | null
  primary_phone?: string | null
  date_of_birth?: string | null
}

export interface MatchResult {
  score: number
  reasons: MatchReason[]
  /** Highest name similarity considered (real name or nickname), in [0, 1]. */
  nameSimilarity: number
  isStrong: boolean
}

// `isStrong` is decided by SIGNALS, not by the score: any one exact identity match
// (email, phone or date of birth), or a name similarity clearing the cutoff below. The
// weights further down only rank candidates against each other.
//
// There was a `STRONG_MATCH_THRESHOLD = 25` here, described as the score a candidate had
// to clear to be strong. Nothing read it — not even this file — and the rule it described
// is not the rule `isStrong` implements, so it was documentation of a scoring behaviour
// the code does not have. Removed rather than wired up; if a score cutoff is ever wanted,
// it is a product decision to make deliberately.
const NAME_MATCH_SIMILARITY = 0.85

const EMAIL_WEIGHT = 50
const PHONE_WEIGHT = 40
const DOB_WEIGHT = 30
const LAST_NAME_WEIGHT = 20
const FIRST_NAME_WEIGHT = 15

/** Trim + lowercase an email for exact comparison. Returns '' for empty input. */
export function normalizeEmail(s?: string | null): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Reduce a phone number to its last 10 digits so formatting and a leading
 * country code don't defeat the comparison. Returns '' if fewer than 10 digits.
 */
export function normalizePhone(s?: string | null): string {
  const digits = (s ?? '').replace(/\D/g, '')
  if (digits.length < 10) return ''
  return digits.slice(-10)
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Case-insensitive name similarity in [0, 1] (1 == identical). */
export function nameSimilarity(a?: string | null, b?: string | null): number {
  const x = (a ?? '').trim().toLowerCase()
  const y = (b ?? '').trim().toLowerCase()
  if (!x && !y) return 1
  if (!x || !y) return 0
  if (x === y) return 1
  const maxLen = Math.max(x.length, y.length)
  return 1 - levenshtein(x, y) / maxLen
}

/**
 * Score how strongly a candidate record matches the registrant. Higher is better.
 * Exact email/phone/dob each contribute a large fixed weight; name contributes
 * proportionally to similarity, comparing the candidate's real name *and* nickname
 * and keeping the better of the two.
 */
export function scoreMatch(
  registrant: MatchablePerson,
  candidate: MatchablePerson,
): MatchResult {
  const reasons: MatchReason[] = []
  let score = 0

  const regEmail = normalizeEmail(registrant.primary_email)
  const candEmail = normalizeEmail(candidate.primary_email)
  if (regEmail && candEmail && regEmail === candEmail) {
    score += EMAIL_WEIGHT
    reasons.push('email')
  }

  const regPhone = normalizePhone(registrant.primary_phone)
  const candPhone = normalizePhone(candidate.primary_phone)
  if (regPhone && candPhone && regPhone === candPhone) {
    score += PHONE_WEIGHT
    reasons.push('phone')
  }

  const regDob = (registrant.date_of_birth ?? '').slice(0, 10)
  const candDob = (candidate.date_of_birth ?? '').slice(0, 10)
  if (regDob && candDob && regDob === candDob) {
    score += DOB_WEIGHT
    reasons.push('dob')
  }

  // Name: compare registrant's first name against the candidate's first name and
  // nickname, take the better. Last name compared directly.
  const firstSim = Math.max(
    nameSimilarity(registrant.first_name, candidate.first_name),
    nameSimilarity(registrant.first_name, candidate.nick_name),
  )
  const lastSim = nameSimilarity(registrant.last_name, candidate.last_name)
  score += lastSim * LAST_NAME_WEIGHT + firstSim * FIRST_NAME_WEIGHT

  const combinedNameSim = (firstSim + lastSim) / 2
  if (combinedNameSim >= NAME_MATCH_SIMILARITY) reasons.push('name')

  const isStrong =
    reasons.some(r => r === 'email' || r === 'phone' || r === 'dob') ||
    combinedNameSim >= NAME_MATCH_SIMILARITY

  return { score, reasons, nameSimilarity: combinedNameSim, isStrong }
}
