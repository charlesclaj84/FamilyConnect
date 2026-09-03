'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { setMyLocale } from '@/app/actions/personal-info'
import { availableLocales, hasLanguageChoice } from '@/lib/i18n/catalogues'
import { useLocale, useT } from '@/components/layout/LocaleProvider'
import {
  HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS, useCloseOnNavigate,
} from '@/components/layout/header-panel'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'

/**
 * Choose the language the product speaks to you in.
 *
 * ── IT RENDERS NOTHING WHILE THERE IS ONE LANGUAGE ──────────────────────────────────
 * `hasLanguageChoice()` is the whole condition, and it is the honest half of this component.
 * `LOCALES` declares English, Spanish and French; `CATALOGUES` holds the ones that EXIST. A
 * picker offering a language the product cannot speak is a control that lies — a member choosing
 * Español and getting an English screen has been told something false by the product, not by a
 * translator's backlog.
 *
 * ── CODES AND ENDONYMS, NEVER FLAGS ─────────────────────────────────────────────────
 * `ES · Español`. A flag is a COUNTRY and a language is not — Spanish is not Spain to a family
 * in Monterrey, English is not the United States to one in Lagos. The endonym is the word a
 * speaker would use for their own language and is deliberately never translated;
 * `lib/i18n/locales.ts` carries that decision and has no `flag` field for it to be undone with.
 *
 * ── IT WAS A NATIVE `<select>` UNTIL 2026-09-02, AND THAT ARGUMENT LOST ─────────────
 * The case for the native control was real and is worth recording rather than deleting: three
 * options, no icons, no per-row actions, and a `<select>` gets keyboard handling, type-ahead and
 * a phone's wheel picker for free. AGENTS.md' own rule about member pickers says a native
 * `<select>` is right *"for a field on a form"* and only stops being right over a hundred and
 * forty relatives.
 *
 * WHAT IT LEFT OUT IS THAT THIS IS NOT A FIELD ON A FORM. It is the fourth control in a cluster
 * of four in the app header, and the other three — the family chip, the bell, the portrait — all
 * open the same panel, drawn by `HEADER_PANEL_CLASS`, with the same rounded card, the same
 * border, the same tick against the current row and the same behaviour below `sm` (a sheet
 * pinned under the bar rather than a dropdown hanging off a trigger already well inside the
 * edge). A native `<select>` opens the operating system's list instead: a different shape, a
 * different typeface, a different position, and on a desktop it is unmistakably not part of this
 * product. Reported as: the dropdown isn't formatted like the family dropdown.
 *
 * A header cluster whose controls agree about what "open" looks like is worth more here than
 * type-ahead over three rows, which is what the trade actually is. What is NOT given up:
 * `role="menu"` with real `<button role="menuitem">` rows keeps every one of them focusable and
 * Enter-operable, and the trigger says what it is and what it currently holds. What IS given up
 * is arrow-key roving between the rows — the same thing `MainRail` refuses `role="tablist"` over
 * rather than claim, and it is not claimed here either.
 *
 * ── IT WRITES THE PROFILE RATHER THAN A COOKIE ──────────────────────────────────────
 * `setMyLocale` puts it on `people.locale`, so the choice follows the member to every family
 * they belong to and to every device they sign in on — which is what a language preference
 * should do, and what a cookie cannot. The cost is that it needs a session; Home's switcher is a
 * different component with a different mechanism (a path segment).
 *
 * ── IT LIVES IN THE BAR, BESIDE THE BELL, SINCE 2026-08-29 ──────────────────────────
 * It was a row inside `AccountMenu`, filed beside Appearance on the argument that the two are
 * the same kind of thing — how the product presents itself to one person, changed in place.
 * That reading is still true and was not enough: a member who has just been handed an English
 * screen has to guess that the language lives behind a portrait, and the portrait is the one
 * control in the bar whose contents nobody browses. A language switch that cannot be FOUND is
 * a language switch that does not exist, which is the reported complaint.
 *
 * Appearance stays in the menu, and the asymmetry is deliberate rather than an oversight: a
 * theme is a preference somebody sets once and the product remembers, while a language is the
 * thing standing between a reader and every other control on the screen.
 *
 * ── IT IS NOT KEYED, UNLIKE THE BELL NEXT TO IT ─────────────────────────────────────
 * `NotificationBell` carries `key={personId}` because its state is per family and a switch is a
 * `router.refresh()`, which merges without discarding client state. This holds one `error`
 * string and one `open` flag, and `people.locale` is per MEMBER rather than per family —
 * `people_sync_shared_profile` carries it across every row of the account — so there is nothing
 * here for a family switch to make stale.
 *
 * ── THE CLOSED CONTROL SHOWS THE CODE; THE OPEN LIST SHOWS THE ENDONYM ──────────────
 * `EN`, between an icon button and a portrait, in a bar whose whole job is to be narrow. The
 * rows are the full `ES · Español`, because that is the moment somebody is choosing rather
 * than confirming — and `aria-label` names the control and its current value either way, since
 * a bare code is an abbreviation a screen reader spells out with no idea what it abbreviates.
 */
export function LocaleSwitcher({ className }: {
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Same reason as the family switcher and the account menu: TopBar is rendered by the
  // layout and never unmounts, so neither does this flag — see the hook. Both are above
  // the early return below, because hooks may not sit after one.
  useCloseOnNavigate(open, () => setOpen(false))
  useDismissWhenIdle({
    open,
    close: () => setOpen(false),
    parts: () => [trigger.current, panel.current],
  })

  if (!hasLanguageChoice()) return null

  const locales = availableLocales()
  const currentEndonym = locales.find(l => l.code === locale)?.endonym ?? locale

  function choose(next: string) {
    setOpen(false)
    if (next === locale) return
    setError('')
    startTransition(async () => {
      const result = await setMyLocale(next)
      // A FAILURE IS REPORTED, not swallowed. `router.refresh()` on success is what makes the
      // rest of the shell follow; on failure the message says why it did not, and the trigger
      // still reads the language actually in force — which is the one advantage this shape has
      // over the `<select>` it replaced, where the browser had already moved the control before
      // the action ran.
      if (result.success) router.refresh()
      else setError(result.message ?? t('language.changeFailed'))
    })
  }

  return (
    <div className={cn('relative flex shrink-0 items-center', className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="menu"
        // The control AND its current value. `EN` on its own is an abbreviation a screen
        // reader spells out with no idea what it abbreviates, and the face is the only place
        // either fact is otherwise said.
        aria-label={`${t('language.choose')}: ${currentEndonym}`}
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-medium uppercase',
          'tracking-wide text-brand-ink transition-colors',
          // The same hover as the help icon beside it, so the four controls in this cluster
          // read as one set rather than as three buttons and a form field.
          'hover:bg-brand-primary/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-60',
        )}
      >
        <Languages className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        {locale.toUpperCase()}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className={HEADER_PANEL_SCRIM_CLASS}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* `sm:w-56` rather than the switcher's `sm:w-64`: the widest row is a two-letter
              code, a separator and one endonym, and a panel wider than its contents reads as
              a list with something missing from it. Below `sm` the width comes from
              HEADER_PANEL_CLASS and is the screen's, like every other panel in this bar. */}
          <div ref={panel} role="menu" className={cn(HEADER_PANEL_CLASS, 'sm:w-56')}>
            <p className="shrink-0 border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('language.choose')}
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {locales.map(l => {
                const active = l.code === locale
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => choose(l.code)}
                      disabled={isPending}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors disabled:opacity-60',
                        active ? 'bg-brand-soft font-medium text-brand-on-soft' : 'hover:bg-muted',
                      )}
                    >
                      {/* THE TICK IS ALWAYS RENDERED, at zero opacity when it does not apply
                          — the family switcher's device. Rendering it conditionally would
                          shift every other row's text left by 24px, so the list would look
                          ragged and the current row would look indented rather than chosen. */}
                      <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                      {/* THE FULL ENDONYM, unlike the face: this is the moment somebody is
                          CHOOSING rather than confirming, and it is the one place the word a
                          speaker would use for their own language can be read. */}
                      <span className="min-w-0 flex-1 truncate">
                        {l.code.toUpperCase()} · {l.endonym}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* The one place this component says anything on failure. Not `FormError`: that is the
          alert treatment for a refused OPERATION on a form, and this is a control in the top
          bar where a tinted box would be a banner over the whole shell.

          `absolute` and pinned under the control, so a refusal cannot widen the bar and shove
          the bell and the portrait sideways on the one screen where every member knows where
          those two are. */}
      {error && (
        <span className="absolute end-0 top-full z-40 mt-1 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs text-destructive shadow-sm">
          {error}
        </span>
      )}
    </div>
  )
}
