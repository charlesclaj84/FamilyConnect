/**
 * Validate a `?next=` destination.
 *
 * The value comes off a query string, so an unvalidated redirect is an open redirect
 * wearing our own domain — the classic phishing primitive, and it would sit on the two
 * URLs users are explicitly told to trust: the link in a confirmation email, and the
 * sign-in page an invitation sends them to.
 *
 * Only a same-origin ABSOLUTE PATH is accepted. A value starting `//` or `/\` is a
 * protocol-relative URL to somewhere else, so it is rejected along with everything that
 * names a host or a scheme.
 *
 * Shared by /auth/confirm and the sign-in form on purpose. Two copies of this rule are
 * two chances for one of them to be the lenient one.
 */
export function safeNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
