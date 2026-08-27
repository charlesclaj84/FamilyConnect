'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
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

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Languages className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      <label className="sr-only" htmlFor="locale-switcher">{t('language.label')}</label>
      <select
        id="locale-switcher"
        value={locale}
        disabled={isPending}
        onChange={e => choose(e.target.value)}
        aria-label={t('language.choose')}
        className="rounded-md border border-brand-on-hero/20 bg-transparent px-1.5 py-0.5 text-xs text-brand-on-hero disabled:opacity-60"
      >
        {locales.map(l => (
          <option key={l.code} value={l.code} className="text-foreground">
            {l.code.toUpperCase()} · {l.endonym}
          </option>
        ))}
      </select>
      {/* The one place this component says anything on failure. Not `FormError`: that is the
          alert treatment for a refused OPERATION on a form, and this is a control in the top
          bar where a tinted box would be a banner over the whole shell. */}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
