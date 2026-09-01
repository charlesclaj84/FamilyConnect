import { type T } from '@/lib/i18n/t'

/**
 * A bell entry's words, in the READER's language.
 *
 * ── WHY A NOTIFICATION IS THE ONE STRING THAT NEEDED A COLUMN ──────────────────────
 * `20260901000004` argues it in full and this is the short version. Every other string in the
 * product is chosen at RENDER time, when the reader is known. A notification's text is chosen
 * at EVENT time — when a relative submits a task, when an applicant asks to join — and read
 * later by somebody else. So even a perfectly translated writer composes the message in the
 * language of whoever happened to trigger it, which is the same mistake `lib/i18n/locales.ts`
 * warns about for mail.
 *
 * The row therefore stores a KEY and its parameters, and this resolves them.
 *
 * ── THE ENGLISH FALLBACK IS NOT A COURTESY ─────────────────────────────────────────
 * It covers three real states, and the third is why it survives rather than being a stopgap:
 *
 *   * a row written before that migration, which has no key at all;
 *   * a `type` somebody adds and does not key — the sentence still says something;
 *   * a key that FAILS TO RESOLVE. `t` returns the key itself in that case, and a bell entry
 *     reading `notify.taskSubmitted.title` is worse than one reading English. So a resolution
 *     that comes back as the key is treated as no resolution.
 *
 * That last check is the whole reason this is a function rather than `t(key ?? '')` at the call
 * site — and it is why `notifications.title` is still NOT NULL, asserted by the migration.
 *
 * ── PURE, AND ON THE CLIENT SIDE OF THE LINE ───────────────────────────────────────
 * `NotificationBell` is a client component, so this takes `t` rather than resolving one. No
 * imports beyond the type.
 */
export function notificationText(
  key: string | null | undefined,
  fallback: string | null | undefined,
  params: Record<string, string> | null | undefined,
  t: T,
): string | null {
  if (key) {
    const rendered = t(key, params ?? undefined)
    // `t` echoes an unknown key back. Treated as a miss, never rendered — see the header.
    if (rendered && rendered !== key) return rendered
  }
  return fallback ?? null
}
