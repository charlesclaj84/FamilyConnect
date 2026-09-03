'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { PersonMultiSelect, type SelectablePerson } from '@/components/ui/person-multi-select'
import { useConfirm } from '@/components/ui/confirm'
import { PhotoLightbox } from '@/components/gallery/PhotoLightbox'
import { useT } from '@/components/layout/LocaleProvider'
import {
  deletePhoto, searchPhotos, type GalleryRights, type PhotoSearchHit,
} from '@/app/actions/gallery'

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
 * ── PRESSING A RESULT OPENS THE PHOTOGRAPH; THE ALBUM NAME IS THE LINK ────────────
 * This said "Not a lightbox" for a day, on the argument that a hit's value is mostly *which
 * album is this in* and that a full-screen view here would be a second, lesser copy of the
 * album page's own one.
 *
 * THE FIRST HALF IS TRUE OF THE CAPTION AND FALSE OF THE TILE. Somebody who has just searched
 * for a photograph and found it wants to LOOK at it; being taken to a grid of forty others,
 * where they have to find it again, is the one outcome a search should not produce.
 *
 * THE SECOND HALF WAS AVOIDED RATHER THAN ACCEPTED. There is no second lightbox —
 * `components/gallery/PhotoLightbox.tsx` was lifted out of `CollectionView` and both surfaces
 * render it, so the navigation, the tagging and the delete are the same code. What that cost
 * is two narrowed prop types (`LightboxPhoto`, `TaggablePhoto`) and two extra fields on a
 * search hit; what it buys is that a fix to one is a fix to both, which is the argument
 * `PhotoTagEditor` already made about the matcher.
 *
 * ── AND IT DRAWS `grid_url`, NEVER THE ORIGINAL ───────────────────────────────────
 * A hundred and twenty results at tile size is exactly the page `20260902000003` exists for.
 * The fallback to the full photograph for a row with no thumbnail is resolved server-side, so
 * nothing here can forget it.
 */
export function GallerySearch({ allMembers, rights, myPersonId }: {
  /** Every member who can be searched for, resolved server-side (§5). */
  allMembers: SelectablePerson[]
  /**
   * What the caller may do, for the lightbox the tiles open into.
   *
   * THE SAME RIGHTS THE ALBUM PAGE RESOLVES, and passed for the same reason: they decide
   * which controls are drawn and nothing else. `tagPersonInPhoto`, `untagPersonFromPhoto` and
   * `deletePhoto` each re-resolve their own grant, because a `'use server'` export has a URL
   * whether or not a button exists (§2).
   */
  rights: GalleryRights
  /** The caller's own `people.id`, for the OWN half of the delete rule. */
  myPersonId: string | null
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [result, setResult] = useState<{ hits: PhotoSearchHit[]; more: number } | null>(null)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  /**
   * Which result is open, as an INDEX into `result.hits` rather than an id.
   *
   * The lightbox pages through the result set, so it needs to know where it is in the list —
   * and an index is the only thing that survives a photograph being deleted out from under
   * it, which the delete below then clamps. An id would need a lookup on every arrow press
   * and would leave the previous/next buttons unable to say whether there IS a next.
   */
  const [openAt, setOpenAt] = useState<number | null>(null)

  const hits = result?.hits ?? []
  const open = openAt !== null && openAt >= 0 && openAt < hits.length ? hits[openAt] : null

  /**
   * Remove a photograph from the results without re-running the search.
   *
   * ── WHY NOT JUST RE-SEARCH ─────────────────────────────────────────────────────
   * A second round trip that reads the family's photo rows again, to learn one thing this
   * component already knows. And it would reset `more`, so a result set that had been
   * truncated would silently re-truncate around a different boundary.
   *
   * THE COUNT IS DERIVED FROM THE LIST, so it follows without being touched — the rule the
   * projection screens keep about a figure and the rows beside it never disagreeing.
   */
  function forget(index: number) {
    setResult(prev => prev && {
      hits: prev.hits.filter((_, i) => i !== index),
      more: prev.more,
    })
    // CLAMPED RATHER THAN CLOSED. Deleting the third of ten leaves nine and the lightbox on
    // what is now the third — which is the next photograph, and is what somebody working
    // through a search expects. Deleting the last one closes it, because there is no next.
    setOpenAt(prev => {
      if (prev === null) return null
      const left = hits.length - 1
      return left === 0 ? null : Math.min(prev, left - 1)
    })
  }

  async function removePhoto(index: number) {
    const hit = hits[index]
    if (!hit) return
    // WORD FOR WORD THE ALBUM PAGE'S CONFIRMATION, keys included — see `handleDelete` in
    // `CollectionView`. Deleting a photograph is the same irreversible act from either
    // surface, and two wordings for it would be two answers to how serious it is.
    const ok = await confirm({
      title: t('gal.deletePhoto'),
      description: hit.caption
        ? t('gal.deletePhotoNamedConfirm', { caption: hit.caption })
        : t('gal.deletePhotoBody'),
      confirmLabel: t('gal.deletePhoto'),
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const outcome = await deletePhoto(hit.id)
      // §8b: `deletePhoto` goes through `confirmWrite`, so a refusal that changed no row is
      // reported rather than rendered as success. Forgetting the row on a failure would show
      // it gone and bring it back on the next search.
      if (!outcome.success) { setError(outcome.message ?? t('gal.deletePhotoFailed')); return }
      forget(index)
    })
  }

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
      // A NEW RESULT SET CLOSES THE LIGHTBOX. `openAt` is an index into the OLD list, so
      // leaving it would show whatever photograph happens to sit at that position in the new
      // one — a picture nobody asked for, over a search they did.
      setOpenAt(null)
    })
  }

  function clear() {
    setQuery('')
    setPeople([])
    setResult(null)
    setSearched(false)
    setError('')
    setOpenAt(null)
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
              {result.hits.map((hit, index) => (
                <li key={hit.id} className="space-y-1">
                  {/* ── PRESSING A RESULT OPENS THE PHOTOGRAPH (2026-09-03) ────────────
                      It was a `<Link>` to the album, on the argument that a hit's value is
                      mostly *which album is this in*. That is true of the CAPTION under the
                      tile and false of the tile itself: somebody who has just searched for a
                      photograph and found it wants to LOOK at it, and being taken to a grid
                      of forty others — where they then have to find it again — is the one
                      outcome a search should not produce.

                      So the tile opens the lightbox and the album name below it stays a real
                      link. Both destinations are reachable, and each is on the element that
                      means it.

                      A REAL `<button>`, not a handler on the `<li>`: a list item that is only
                      clickable is unreachable by keyboard and invisible to a screen reader —
                      the same rule the member tables keep. Its accessible name is the caption
                      where there is one and the album where there is not, because "image" is
                      what an empty alt leaves a screen reader to announce. */}
                  <button
                    type="button"
                    onClick={() => setOpenAt(index)}
                    aria-label={t('gal.openPhotographIn', {
                      what: hit.caption || hit.collection_name,
                    })}
                    className="group block w-full text-inherit"
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
                  </button>
                  {/* THE ALBUM IS STILL THE ANSWER TO "WHERE IS THIS", so it keeps its link —
                      and it is OUTSIDE the button, because an `<a>` may not sit inside one and
                      nesting them produces markup a browser may reparent. The same rule
                      `RecentUpdates` and the album tiles follow. */}
                  <Link
                    href={`/community/gallery/${hit.collection_id}`}
                    className="block truncate text-xs font-medium"
                  >
                    {hit.collection_name}
                  </Link>
                  {hit.caption && (
                    <span className="block truncate text-xs text-muted-foreground">{hit.caption}</span>
                  )}
                  {hit.tags.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.tags.map(tag => tag.person_name).filter(Boolean).join(' · ')}
                    </span>
                  )}
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

      {/* ── THE SAME LIGHTBOX THE ALBUM PAGE USES ──────────────────────────────────
          Not a copy — `components/gallery/PhotoLightbox.tsx` was lifted out of
          `CollectionView` for this, so the navigation, the tagging and the delete are one
          implementation. See this component's header.

          `total` AND `index` ARE THE RESULT SET, not the album. Paging with the arrows walks
          what was found rather than what happens to be filed beside it, which is the whole
          reason somebody searched — and the album name under each tile is still the way into
          the album itself.

          `mayEdit` IS THE `'any'` GRANT RATHER THAN `editAny || editOwn`, matching the album
          page: `rights.editOwn` is true for scope `'own'`, and the own-expression on
          `photo_tags` is `tagged_by`, so a member with `'own'` may tag but only untag their
          OWN tags. Offering the ✕ on somebody else's tag would be a control that fails. */}
      {open && (
        <PhotoLightbox
          photo={open}
          index={openAt as number}
          total={hits.length}
          onClose={() => setOpenAt(null)}
          onPrev={() => setOpenAt(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setOpenAt(i => (i !== null && i < hits.length - 1 ? i + 1 : i))}
          allMembers={allMembers}
          mayEdit={rights.editAny}
          mayDelete={rights.deleteAny || (myPersonId !== null && open.uploader_id === myPersonId)}
          onDelete={() => removePhoto(openAt as number)}
          busy={isPending}
          // A TAG CHANGE NEEDS THE ROWS AGAIN, and re-running the search is the honest way to
          // get them: `photo_tags` is what the search MATCHED on, so a tag added or removed
          // can change which photographs belong in this result set at all. Patching the one
          // hit in place would leave a result that no longer matches the query it answered.
          onChanged={() => run(query, people)}
          onError={setError}
        />
      )}
    </section>
  )
}
