'use client'

import { useState } from 'react'
import { Images, Plus, Search } from 'lucide-react'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { Button } from '@/components/ui/button'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { GallerySearch } from '@/components/gallery/GallerySearch'
import { type GalleryPane } from '@/lib/gallery-panes'
import { useT } from '@/components/layout/LocaleProvider'
import type { GalleryRights } from '@/app/actions/gallery'
import type { SelectablePerson } from '@/components/ui/person-multi-select'

/**
 * THE `/community/gallery` RAIL — the albums, and a search across all of them.
 *
 * ── WHY THE SEARCH IS A PANE AND NOT A BOX ON THE ALBUM PAGE ───────────────────────
 * It was a card above the album grid for a day, and that was the wrong shape for two reasons
 * a reader can see. It pushed the albums — the thing the screen is FOR, and what almost
 * everybody arrives wanting — below a control most visits never touch. And its results are
 * themselves a grid of tiles, so a result set rendered under a grid of albums read as more
 * albums.
 *
 * Two panes fixes both: the albums are the whole first screen again, and the results have the
 * page to themselves so nothing above them looks like part of the answer.
 *
 * ── TWO PANES, ONE KEY ────────────────────────────────────────────────────────────
 * `lib/gallery-panes.ts` carries the argument. The short version: the search returns only
 * photographs the caller may already read, so no family could sensibly grant one pane and
 * withhold the other — which is the test AGENTS.md sets for merging keys, and the
 * `accounting/dues-and-donations` precedent for taking it.
 *
 * So there is nothing to resolve per pane, and the PAGE keeps its ordinary
 * `requireView('community/gallery')` preamble rather than decomposing into a union of `can()`
 * calls. That matters: a page that decomposes owes `requireFamilyActive` and `requireTier` BY
 * HAND, which is a line three pages will not have. This one gets both folded in for free.
 *
 * ── THE `?pane=` IS RESOLVED ON THE SERVER AND KEPT WITH `replaceState` ────────────
 * `initialPane` so the first paint already shows the right pane and there is no flash and no
 * hydration mismatch. Switching is `replaceState` rather than a navigation, for the reason
 * `MainRail`'s own header gives — a real navigation refetches the RSC payload and remounts the
 * pane, discarding the album list the client fetched on mount and any half-typed search.
 * `href` is still supplied so cmd-click and copy-link-address work.
 *
 * ── AND THE CREATE TRIGGER IS ON THE RAIL, WHICH LIFTED ONE FLAG ───────────────────
 * `MainRail`'s action slot is where every create trigger in this product lives, and the slot
 * takes ONE action belonging to the ACTIVE pane — so New Album is conditioned on the pane as
 * well as on the grant, and the Search pane shows nothing. The dialog stays in
 * `GalleryClient` with the rest of its form; only the boolean moved, which is the same
 * arrangement `GatheringsShell` has and for the same reason.
 */
export function GalleryShell({ initialPane, rights, myPersonId, allMembers }: {
  initialPane: GalleryPane
  rights: GalleryRights
  /** The caller's own `people.id`, for the creator half of the delete rule. */
  myPersonId: string | null
  /** Every member the search may look for, resolved server-side (§5). */
  allMembers: SelectablePerson[]
}) {
  const t = useT()
  const [pane, setPane] = useState<GalleryPane>(initialPane)
  // The New Album dialog's flag, held here because the TRIGGER is on the rail and the FORM is
  // in `GalleryClient`. See the header.
  const [creating, setCreating] = useState(false)

  function selectPane(next: GalleryPane) {
    setPane(next)
    // Rebuilt from the live search string so switching never drops another param, and
    // `replaceState` so Back leaves the page instead of walking the two panes.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  const items: MainRailItem<GalleryPane>[] = [
    { id: 'albums', label: t('gal.pane.albums'), icon: Images, href: '/community/gallery' },
    {
      id: 'search',
      label: t('gal.pane.search'),
      icon: Search,
      href: '/community/gallery?pane=search',
    },
  ]

  return (
    <div className="space-y-5">
      <MainRail
        label={t('gal.rail')}
        items={items}
        active={pane}
        onSelect={selectPane}
        action={pane === 'albums' && rights.upload ? (
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('gal.newAlbum')}
          </Button>
        ) : undefined}
      />

      {/* BOTH PANES STAY MOUNTED, which is deliberate and is not the pattern the other two
          rails use. `GalleryClient` fetches its albums in an effect on mount, and
          `GallerySearch` holds a query and a result set — unmounting either on a pane switch
          would refetch the albums and throw away a search somebody is midway through reading.
          Neither pane is expensive to keep: one is a grid of tiles already in memory, the
          other is a form.

          `hidden` rather than a ternary, for the same reason: a ternary unmounts. It is the
          attribute rather than a class, so the element is out of the accessibility tree as
          well as off the screen — a tab-stop in a pane nobody can see is worse than a
          visible one. */}
      <div hidden={pane !== 'albums'}>
        <GalleryClient
          rights={rights}
          myPersonId={myPersonId}
          creating={creating}
          onCloseCreate={() => setCreating(false)}
        />
      </div>
      <div hidden={pane !== 'search'}>
        <GallerySearch allMembers={allMembers} />
      </div>
    </div>
  )
}
