'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  addressFrom, suggestionLabel, suggestionsFrom,
  type AddressFields, type GeoapifySuggestion,
} from '@/lib/geo/geoapify-address'
import { useLocale, useT } from '@/components/layout/LocaleProvider'
import { cn } from '@/lib/utils'

/**
 * Start typing an address and pick it from a list.
 *
 * ── THE KEY IS IN THE BROWSER, AND THAT IS THE DELIBERATE CHOICE ──────────────────
 * `NEXT_PUBLIC_GEOAPIFY_API_KEY` ships in the bundle, like the Supabase anon key. The
 * alternative was a `'use server'` proxy, and AGENTS.md's open-relay argument is exactly why
 * it was not taken: *"everything exported from one gets a URL"*, so a server action taking
 * arbitrary text and calling a third party is a public HTTP endpoint any signed-in member can
 * drive — a way to spend somebody else's quota with our credential, from our IP, with no
 * rate limiter in front of it and nowhere in this product to run one.
 *
 * THE CONTROL IS AN HTTP-REFERRER RESTRICTION on the key, set in Geoapify's dashboard. That
 * is dashboard state, in the same invisibility class as realtime publication membership and a
 * `cron.job` row — nothing in this repo can check it, which is why it is a GO LIVE item with
 * the restriction named rather than a line of code.
 *
 * ── WHY IT IS TYPEAHEAD AND NOT A LOOKUP BUTTON ───────────────────────────────────
 * A button would need no debounce and no key in the browser. It would also mean a member
 * typing their address, pressing something, and reading a list — which is three steps for the
 * thing every other product on the web does in one, and the reason this was asked for.
 *
 * ── EVERY REQUEST IS ONE A MEMBER MADE, WHICH IS WHAT KEEPS THE VOLUME TRIVIAL ────
 * An address is entered once per member, ever. A 140-relative family is ~140 addresses in its
 * lifetime, each a handful of debounced requests — comfortably inside a 3,000/day free tier
 * for any number of families this product will have. `DEBOUNCE_MS` and `MIN_CHARS` are what
 * keep it that way, and they are the two numbers to look at before anything else if a quota
 * is ever a problem.
 *
 * ── ATTRIBUTION IS NOT OPTIONAL AND IS NOT DECORATION ─────────────────────────────
 * Geoapify's free plan requires "Powered by Geoapify"; the data is OpenStreetMap, which
 * requires its own credit. Both render under the list whenever it is open, as real links,
 * because that is the licence this product is using the API under. **Do not remove them
 * without moving off the free plan**, and do not `aria-hidden` them — they are a statement
 * about provenance, not chrome.
 *
 * ── IT IS NOT A `combobox`, FOR `MainRail`'S REASON ───────────────────────────────
 * `role="combobox"` promises `aria-activedescendant`, roving focus and a listbox contract,
 * and a screen reader changes its key handling to match. What is implemented is arrow keys,
 * Enter and Escape over a list of buttons — so this is a text input with a group of buttons
 * under it, which is what it says it is. Claiming the role would strand the users it is aimed
 * at, which is the call `MainRail` and `PersonMultiSelect` both make.
 */

/**
 * How long after the last keystroke before asking.
 *
 * 350ms is about the gap between words rather than between letters, so typing an address
 * straight through costs a handful of requests instead of one per character. Lower and the
 * free tier starts mattering; higher and the list feels like it is lagging behind the typing.
 */
const DEBOUNCE_MS = 350

/**
 * Below this, no request is made at all.
 *
 * Three characters of an address match most of a country, so a suggestion list built from one
 * or two is noise a member has to look past — and it is the cheapest possible saving on a
 * metered API.
 */
const MIN_CHARS = 3

/** Ten, as asked for. Geoapify's `limit`. */
const LIMIT = 10

export interface AddressAutocompleteProps {
  /** What the box shows. The caller owns it, so a member can type freely. */
  value: string
  onChange: (value: string) => void
  /**
   * A member picked a suggestion. EVERY field is present, `null` where the suggestion had
   * nothing — see `addressFrom`, which is what lets a pick REPLACE an address rather than
   * merge into the previous one.
   */
  onPick: (fields: AddressFields) => void
  id?: string
  placeholder?: string
  disabled?: boolean
}

export function AddressAutocomplete({
  value, onChange, onPick, id, placeholder, disabled,
}: AddressAutocompleteProps) {
  const t = useT()
  const locale = useLocale()
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  // What the last request was for, so a slow response cannot overwrite a newer one. Typing
  // fast otherwise lands the list for "12 Main" under a box reading "12 Main Street".
  const asked = useRef('')

  const key = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY

  useEffect(() => {
    // NO KEY MEANS AN ORDINARY TEXT BOX, never an error. The field must keep working on a
    // deployment where the credential has not been set — a member typing their own address is
    // not a thing to break over a missing third party. `sendEmail`'s fails-soft reading.
    if (!key) return
    const text = value.trim()

    const timer = setTimeout(async () => {
      // ── THE SHORT-TEXT GUARD IS INSIDE THE TIMER, NOT ABOVE IT ─────────────────
      // It was in the effect body and React Compiler refuses that: `react-hooks/
      // set-state-in-effect`, because a synchronous setState in an effect is a cascading
      // render. Moving it in here satisfies the rule and is also better behaviour — deleting
      // back to two characters no longer clears the list on the same frame as the keystroke,
      // so the panel does not flicker while somebody edits the middle of what they typed.
      if (text.length < MIN_CHARS) { setSuggestions([]); setOpen(false); return }
      asked.current = text
      setLoading(true)
      setFailed(false)
      try {
        const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
        url.searchParams.set('text', text)
        url.searchParams.set('limit', String(LIMIT))
        // ── `format=json` EXPLICITLY, AND IT IS WHY THE LIST WAS EMPTY ─────────
        // The endpoint answers GeoJSON by DEFAULT — a FeatureCollection whose fields live
        // under `features[].properties` — so reading `body.results` got `undefined` and the
        // panel never opened: requests in the Network tab, a valid 200, no dropdown.
        // Asking for the shape we read is the fix; `suggestionsFrom` accepts both anyway, so
        // a changed default cannot empty the list a second time.
        url.searchParams.set('format', 'json')
        // THE READER'S LANGUAGE. Geoapify takes ISO 639-1 and `locale` is already exactly
        // that — 'en', 'es', 'fr' — so a French member reads French place names. It is one of
        // the two places in the product where the reader's language reaches a third party;
        // nothing identifying goes with it.
        url.searchParams.set('lang', locale)
        // NO `filter=countrycode:...`. Worldwide, decided 2026-09-04 — see
        // `lib/geo/geoapify-address.ts` for what that costs and how it is handled.
        url.searchParams.set('apiKey', key)

        const response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
        if (!response.ok) throw new Error(`Geoapify answered ${response.status}`)
        const body = await response.json()
        // A LATE RESPONSE FOR AN OLD QUERY IS DROPPED. `asked` moved on, so this list is
        // about text the member has already changed.
        if (asked.current !== text) return
        const results = suggestionsFrom(body)
        // NULL IS A SHAPE NOBODY RECOGNISED, and it is told apart from an empty list on
        // purpose — see `suggestionsFrom`. An empty list is a real answer and shows nothing;
        // an unreadable payload says the lookup is unavailable, because rendering nothing is
        // precisely what made this bug invisible.
        if (results === null) throw new Error('unrecognised response shape')
        setSuggestions(results)
        setOpen(results.length > 0)
        setActive(-1)
      } catch {
        // SAID, NOT SWALLOWED, and said quietly. A member can always finish typing by hand —
        // the six fields underneath are still there — so this is a notice rather than a
        // refusal, and `FormError`'s alert treatment would be louder than a lookup being
        // unavailable warrants.
        if (asked.current === text) { setFailed(true); setSuggestions([]); setOpen(false) }
      } finally {
        if (asked.current === text) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value, locale, key])

  // Close on a click outside. The list is not a dialog and has no scrim: it sits inside a
  // form a member is filling in, and a scrim over that form would block the fields below.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(suggestion: GeoapifySuggestion) {
    setOpen(false)
    setSuggestions([])
    setActive(-1)
    onPick(addressFrom(suggestion))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      // ONLY WITH A HIGHLIGHTED ROW. Enter in an address box with nothing chosen should
      // submit the form the way it always did, not silently take the first suggestion.
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={box} className="relative">
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        // The BROWSER's own autofill is off, deliberately: two suggestion lists over one box,
        // one of them ours and one the browser's, is a control nobody can aim at.
        spellCheck={false}
      />
      {loading && (
        <Loader2
          className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}

      {/* A NOTICE, NOT A `FormError`. The lookup being unavailable does not stop a member
          finishing the address by hand, and the alert treatment would say otherwise. */}
      {failed && (
        <p className="mt-1 text-xs text-muted-foreground">{t('addr.lookupUnavailable')}</p>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((s, i) => (
              <li key={`${suggestionLabel(s)}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-start text-sm transition-colors',
                    i === active ? 'bg-brand-soft text-brand-on-soft' : 'hover:bg-muted',
                  )}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                  <span className="min-w-0">{suggestionLabel(s)}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* ── ATTRIBUTION. REQUIRED, NOT DECORATION ────────────────────────────────
              Geoapify's free plan requires "Powered by Geoapify" and the underlying data is
              OpenStreetMap, which requires its own credit. Real links, inside the panel so
              they are present exactly when results are, and NOT `aria-hidden` — a statement
              about provenance is not chrome. Do not remove either without moving off the
              free plan. */}
          <p className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            <a
              href="https://www.geoapify.com/"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {t('addr.poweredBy')}
            </a>
            {' · '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {t('addr.osm')}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
