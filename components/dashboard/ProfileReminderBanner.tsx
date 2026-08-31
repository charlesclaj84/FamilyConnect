import Link from 'next/link'
import { UserRoundPen } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { missingFieldsSentence, type ProfileCompleteness } from '@/lib/profile-completeness'
import type { T } from '@/lib/i18n/t'

/**
 * "Your profile is mostly empty" — the Dashboard's one nudge to finish it.
 *
 * ── IT IS A SERVER COMPONENT, WHICH IS THE DIFFERENCE FROM `ChapterReminderBanner` ──
 * That one is `'use client'` because it CONTAINS the control: a chapter picker and a save.
 * This one contains a link, and a link needs no state — so there is nothing to hydrate and
 * nothing to send. It is the same visual treatment deliberately (they are siblings in the
 * same slot and a member may see both), and the same argument about colour applies verbatim:
 * `bg-brand-soft` under `text-brand-on-soft` is a checked pair in both themes.
 *
 * ── NO DISMISS CONTROL, AND THAT IS A DECISION ─────────────────────────────────────
 * `ChapterReminderBanner` has one because a member may legitimately have no chapter to pick
 * and would otherwise be nagged forever. This one goes away ON ITS OWN the moment half the
 * counted fields are filled in — `profileCompleteness` decides, and the threshold is stated
 * there. A dismiss button would need somewhere to remember the dismissal, which is a column
 * or a table for a prompt that is meant to be temporary.
 *
 * So the way to make it stop is to do the thing it asks, which is the honest shape for a
 * nudge. It also means a member who fills in three fields and stops is left alone rather
 * than followed around by a completeness meter — see `PROMPT_BELOW`.
 *
 * ── IT NAMES WHAT IS MISSING, CAPPED AT THREE ──────────────────────────────────────
 * "Add a phone number, your city and 2 more" is a to-do; "your profile is incomplete" is a
 * complaint. `missingFieldsSentence` does the capping and the grammar, and it is a separate
 * function from the rule so that changing the wording cannot change who is prompted.
 *
 * ── IT DOES NOT SHOW A PERCENTAGE, though one is computed ──────────────────────────
 * `percent` is on the shape because the figure is genuinely useful to a caller — and this
 * banner does not print it, because a number invites a member to optimise it and the fields
 * are a judgement rather than a score. What they need is the list and the way through.
 */
export function ProfileReminderBanner({ completeness, t }: {
  completeness: ProfileCompleteness
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  // The page already decides this, and the component re-checks it: a banner that renders
  // itself over a complete profile because a caller forgot the condition is worse than one
  // that occasionally renders nothing.
  if (!completeness.shouldPrompt) return null

  return (
    <div className="flex gap-3 rounded-xl border border-brand-legacy/40 bg-brand-soft p-4">
      <div className="mt-0.5 shrink-0 self-start rounded-lg bg-brand-primary p-1.5 text-brand-on-primary">
        <UserRoundPen className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm font-medium text-brand-on-soft">
            {t('dash.profile.title')}
          </p>
          <p className="mt-0.5 text-xs text-brand-on-soft/80">
            {/* WHAT IT IS FOR, not what is wrong with it. A member is being asked to do
                something for the rest of the family rather than to satisfy a form. */}
            {t('dash.profile.body', {
              missing: missingFieldsSentence(completeness.missing),
            })}
          </p>
        </div>

        <Link
          href="/personal-info"
          className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
        >
          {t('dash.profile.action')}
        </Link>
      </div>
    </div>
  )
}
