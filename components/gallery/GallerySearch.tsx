'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { PersonMultiSelect, type SelectablePerson } from '@/components/ui/person-multi-select'
import { useT } from '@/components/layout/LocaleProvider'
import { searchPhotos, type PhotoSearchHit } from '@/app/actions/gallery'

/**
 * Search every album at once, by caption and by who is tagged.
 *
 * ── WHY IT EXISTS AT ALL ───────────────────────────────────────────────────────────
 * `CollectionView` already filters the album it is showing, in the browser, from rows it
 * already holds. That answers *where in THIS album is the picture of Martha?* This answers
 * *where in the family's photographs is the picture of Martha?* — which is the question
 * somebody actually has, and which no album page can answer, because it cannot see the
 * other albums. Reported as: search tags and captions across all galleries.
 *
 * ── AND IT IS ITS OWN PANE SINCE 2026-09-03, NOT A CARD ABOVE THE ALBUMS ───────────
 * It shipped as a bordered card over the album grid and that was wrong twice: it pushed the
 * albums — what the screen is FOR — below a control most visits never touch, and its results
 * are a grid of tiles, so a result set under a grid of albums read as more albums. It is the
 * second item on the rail now, which gives the results the page to themselves.
 *
 * THE CARD CHROME WENT WITH THE MOVE. A `rounded-xl border bg-card` panel was right when it
 * was one section among others; as the whole pane it would be a box around the page, with the
 * rail's rule directly above its own border.
 *
 * ── THE TWO INPUTS NARROW TOGETHER ────────────────────────────────────────────────
 * ANDed, not ORed — see `searchPhotos`, which is where that is enforced. "Martha" plus "lake"
 * means the photographs of Martha that are also at the lake. ORing would widen the result the
 * more the reader said about it, which is the opposite of what typing into a search box is for.
 *
 * ── IT IS A REAL FORM, AND THE SEARCH IS NOT LIVE ─────────────────────────────────
 * Enter submits, because that is what somebody typing in a search box does. It deliberately
 * does NOT search on every keystroke: each search is a server round trip that reads the
 * family's photo rows (that module's header argues why it filters in TypeScript), and a
 * per-keystroke version would issue one of those per letter. The person picker is different —
 * choosing a name IS the decision, so that one searches immediately.
 *
 * ── A RESULT LINKS TO ITS ALBUM AND NAMES IT ──────────────────────────────────────
 * Not a lightbox. A hit's value is mostly *which album is this in* — that is the thing the
 * reader could not find out — and a full-screen view here would be a second, lesser copy of
 * the album page's own one, without its navigation, its captions or its tagging.
 *
 * ── AND IT DRAWS `grid_url`, NEVER THE ORIGINAL ───────────────────────────────────
 * A hundred and twenty results at tile size is exactly the page `20260902000003` exists for.
 * The fallback to the full photograph for a row with no thumbnail is resolved server-side, so
 * nothing here can forget it.
 */
export function GallerySearch({ allMembers }: {
  /** Every member who can be searched for, resolved server-side (§5). */
  allMembers: SelectablePerson[]
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [result, setResult] = useState<{ hits: PhotoSearchHit[]; more: number } | null>(null)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function run(nextQuery: string, nextPeople: string[]) {
    setError('')
    // NOTHING ASKED FOR CLEARS THE RESULTS rather than searching for everything. The action
    // refuses an empty search too; doing it here as well is what makes Clear instant.
    if (!nextQuery.trim() && nextPeople.length === 0) {
      setResult(null)
      setSearched(false)
      return
    }
    startTransition(async () => {
      const found = await searchPhotos(nextQuery, nextPeople)
      // `null` IS A REFUSAL, not an empty result — see the action. Reporting it as "nothing
      // matched" would tell the reader a fact about the family instead of about their grant.
      if (found === null) { setError(t('gal.searchRefused')); setResult(null); setSearched(false); return }
      setResult(found)
      setSearched(true)
    })
  }

  function clear() {
    setQuery('')
    setPeople([])
    setResult(null)
    setSearched(false)
    setError('')
  }

  return (
    <section className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={e => { e.preventDefault(); run(query, people) }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="gallery-search" className="text-xs">{t('gal.searchAllLabel')}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="gallery-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('gal.searchAllPh')}
              className="ps-8"
            />
          </div>
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {t('action.search')}
        </Button>
        {(searched || query || people.length > 0) && (
          <Button type="button" variant="ghost" disabled={isPending} onClick={clear}>
            {t('action.clear')}
          </Button>
        )}
      </form>

      {/* CHOOSING A NAME SEARCHES IMMEDIATELY, unlike typing. The choice IS the decision, and
          making somebody press Search after it is friction with nothing behind it. */}
      <PersonMultiSelect
        people={allMembers}
        selected={people}
        onChange={next => { setPeople(next); run(query, next) }}
        label={t('gal.searchWhoIsIn')}
        hint={t('gal.searchWhoIsInHint')}
      />

      <FormError message={error} />

      {isPending && <p className="text-sm text-muted-foreground">{t('gal.looking')}</p>}

      {!isPending && searched && result && (
        result.hits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('gal.searchNoMatches')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t(result.hits.length === 1 ? 'gal.searchFoundOne' : 'gal.searchFoundMany',
                { n: String(result.hits.length) })}
              {/* NEVER TRUNCATE QUIETLY — the rule the tag picker and `PersonMultiSelect`
                  both keep. A grid that stops at a hundred and twenty while looking complete
                  is how somebody concludes a photograph is not there. */}
              {result.more > 0 && ` ${t('gal.searchMoreNotShown', { n: String(result.more) })}`}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {result.hits.map(hit => (
                <li key={hit.id}>
                  <Link
                    href={`/community/gallery/${hit.collection_id}`}
                    className="group block space-y-1 text-inherit"
                  >
                    <span className="block aspect-square overflow-hidden rounded-lg bg-muted">
                      {/* Plain <img>: the bucket is `public: true` and served straight from
                          Supabase — see CollectionCard for that argument, unchanged here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hit.grid_url}
                        alt={hit.caption ?? ''}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </span>
                    {/* THE ALBUM IS THE POINT OF A RESULT, so it is the line that is never
                        omitted. The caption is what matched and may be absent. */}
                    <span className="block truncate text-xs font-medium">{hit.collection_name}</span>
                    {hit.caption && (
                      <span className="block truncate text-xs text-muted-foreground">{hit.caption}</span>
                    )}
                    {hit.tags.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.tags.map(tag => tag.person_name).filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {/* WHAT THE BOX SEARCHES, said once, under it. Two fields that look like one control
          need it: nothing about a caption box suggests it also reaches the tags, and the
          reverse assumption — that typing a relative's name into it finds them — is the one a
          reader makes first and the one that returns nothing. */}
      {!searched && !isPending && (
        <p className="text-xs text-muted-foreground">{t('gal.searchAllHint')}</p>
      )}
    </section>
  )
}
