'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Languages } from 'lucide-react'
import { setMyLocale } from '@/app/actions/personal-info'
import { availableLocales, hasLanguageChoice } from '@/lib/i18n/catalogues'
import { useLocale, useT } from '@/components/layout/LocaleProvider'
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
 * So until a second catalogue lands this is invisible, and adding `es.ts` to `CATALOGUES` is the
 * only edit needed to make it appear. That is Phase 3's proof: the plumbing is built, tested and
 * wired, and nothing about it is speculative.
 *
 * ── CODES AND ENDONYMS, NEVER FLAGS ─────────────────────────────────────────────────
 * `ES · Español`. A flag is a COUNTRY and a language is not — Spanish is not Spain to a family
 * in Monterrey, English is not the United States to one in Lagos. The endonym is the word a
 * speaker would use for their own language and is deliberately never translated;
 * `lib/i18n/locales.ts` carries that decision and has no `flag` field for it to be undone with.
 *
 * ── IT IS A `<select>`, AND THAT IS A DECISION ──────────────────────────────────────
 * Not the custom popover `AccountMenu` and `FamilySwitcher` use. Three options, no icons, no
 * badges, no per-row actions — a native control gets keyboard handling, mobile presentation and
 * type-ahead for free, and AGENTS.md' own rule about member pickers says a native `<select>` is
 * right *"for a field on a form"* and only stops being right over a hundred and forty relatives.
 * Three languages is not that.
 *
 * ── AND IT WRITES THE PROFILE RATHER THAN A COOKIE ──────────────────────────────────
 * `setMyLocale` puts it on `people.locale`, so the choice follows the member to every family
 * they belong to and to every device they sign in on — which is what a language preference
 * should do, and what a cookie cannot. The cost is that it needs a session; Home's switcher is a
 * different component with a different mechanism (a path segment), and that is Phase 4.
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
 * string, and `people.locale` is per MEMBER rather than per family — `people_sync_shared_profile`
 * carries it across every row of the account — so there is nothing here for a family switch to
 * make stale.
 *
 * ── THE CLOSED CONTROL SHOWS THE CODE; THE OPEN LIST SHOWS THE ENDONYM ──────────────
 * `EN`, between an icon button and a portrait, in a bar whose whole job is to be narrow. The
 * options are the full `ES · Español`, because that is the moment somebody is choosing rather
 * than confirming — and `aria-label` names the control and its current value either way, since
 * a bare code is an abbreviation a screen reader spells out with no idea what it abbreviates.
 */
export function LocaleSwitcher({ className }: {
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (!hasLanguageChoice()) return null

  const locales = availableLocales()

  function choose(next: string) {
    if (next === locale) return
    setError('')
    startTransition(async () => {
      const result = await setMyLocale(next)
      // A FAILURE IS REPORTED, not swallowed. The `<select>` will already be showing the new
      // value — the browser moved it before the action ran — so silence would leave the control
      // claiming a language the server refused. `router.refresh()` on success is what makes the
      // rest of the shell follow; on failure the message says why it did not.
      if (result.success) router.refresh()
      else setError(result.message ?? 'Could not change the language')
    })
  }

  const currentEndonym = locales.find(l => l.code === locale)?.endonym ?? locale

  return (
    <div className={cn('relative flex shrink-0 items-center', className)}>
      {/* ── THE NATIVE CONTROL, LAID OVER A COMPACT FACE ──────────────────────────────
          The `<select>` is a real, focusable, keyboard-operable select carrying the whole
          interaction — it is only INVISIBLE. The span underneath draws what the bar has room
          for. That buys the compact face without giving up any of the reasons this is a
          native control in the first place (see the header): the keyboard handling, the
          type-ahead, and the wheel-picker a phone puts up instead of a list.

          It is absolutely positioned over the span rather than the other way round because
          the span is what sizes the wrapper, and it comes FIRST in the DOM because Tailwind's
          `peer-*` modifiers only reach a LATER sibling — which is how the focus ring and the
          pending state get onto the visible half. */}
      <select
        id="locale-switcher"
        value={locale}
        disabled={isPending}
        onChange={e => choose(e.target.value)}
        // The control AND its current value. `EN` on its own is an abbreviation a screen
        // reader spells out with no idea what it abbreviates, and the visible face is
        // aria-hidden, so this is the only place either fact is said.
        aria-label={`${t('language.choose')}: ${currentEndonym}`}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      >
        {locales.map(l => (
          // THE FULL ENDONYM IN THE LIST, unlike the face: this is the moment somebody is
          // CHOOSING rather than confirming, and it is the one place the word a speaker
          // would use for their own language can be read.
          <option key={l.code} value={l.code} className="text-foreground">
            {l.code.toUpperCase()} · {l.endonym}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-medium uppercase',
          'tracking-wide text-brand-ink transition-colors',
          // The same hover as the help icon beside it, so the four controls in this cluster
          // read as one set rather than as three buttons and a form field.
          'peer-hover:bg-brand-primary/10',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:outline-none',
          'peer-disabled:opacity-60',
        )}
      >
        <Languages className="h-4 w-4 shrink-0 opacity-70" />
        {locale.toUpperCase()}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </span>
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
