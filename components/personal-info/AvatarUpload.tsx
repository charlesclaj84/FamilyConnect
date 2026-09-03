'use client'

import React, { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { uploadAvatar } from '@/app/actions/personal-info'
import { Avatar } from '@/components/ui/Avatar'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The profile photo, and the one control that changes it.
 *
 * ── ITS OWN MODULE SINCE 2026-09-03, AND `'use client'` IS THE REASON ──────────────
 * It was a nested function inside `PersonalInfoForm.tsx`, which was fine while it rendered
 * inside that form. It renders in the PAGE HEADER now, beside the `h1` — and
 * `app/(protected)/personal-info/page.tsx` is a Server Component, so the thing it renders
 * has to be a module with its own directive.
 *
 * THE DIRECTIVE IS CORRECT HERE RATHER THAN A `t` PROP, which is the other half of
 * AGENTS.md's rule and the half that is easy to get backwards. That rule's test is who
 * renders it: a component rendered from BOTH sides takes `t` as a prop, and one that can only
 * ever be a client component keeps the hook. This is the second — it holds four hooks, a file
 * input and a change handler, so there is no server rendering of it to preserve.
 *
 * ── WHERE IT SITS, AND WHY IT HAS MOVED TWICE ─────────────────────────────────────
 * It was `SectionCard`'s `headerLeft` inside `GeneralSection`, so it appeared on General and
 * nowhere else: opening Address, Additional Info, Notifications or Sign-in made the member's
 * own picture vanish. Reported 2026-09-02, repaired by hoisting it above the rail.
 *
 * It is in the page header now, to the LEFT of "My Profile" and the office chips — asked for
 * 2026-09-03. That is where a portrait belongs on a profile screen: the heading, the offices
 * this person holds and their face are one identity block, and the rail underneath is the
 * document. Above the rail it read as a floating element belonging to nothing.
 *
 * STILL ONE INSTANCE, which is the property to preserve. The panes each `return null` when
 * they are not active, so "render it per pane" would mean five copies of the tier check, the
 * optimistic preview and the 2 MB refusal, four unmounted at any moment and all five free to
 * drift.
 *
 * ── IT SAYS WHEN IT FAILS, AND IT DID NOT ─────────────────────────────────────────
 * `uploadAvatar`'s result was read only to revert the preview: `if (!result.success)
 * setPreview(existingUrl)`. So every refusal — over 2 MB, wrong type, storage down, the
 * `people` update refused — looked identical from the member's side: the picture flickered to
 * the new one and back, with nothing said. The photo they chose did not stick, twice, and then
 * they gave up.
 *
 * That was survivable while the action's only refusals were size and transport. It stopped
 * being survivable on 2026-08-20, when the type check moved server-side — "Choose a JPEG, PNG
 * or WebP image" is a sentence a member can act on, and it was being thrown away.
 *
 * `FormError` and not `FieldError`: the file input is `hidden` and the portrait is the control,
 * so there is no field for a quiet message to sit under, and what failed is the OPERATION
 * rather than one input (AGENTS.md, "Telling somebody something went wrong is a component").
 *
 * ── `allowed` IS THE PLAN, NOT A PERMISSION ───────────────────────────────────────
 * Profile pictures are Standard. When the family being viewed is on Free this renders the
 * portrait frame and NO control — the member sees their initials, exactly as somebody who has
 * not uploaded one does, and there is nothing to press.
 *
 * NOTHING IS SAID ON THIS SCREEN ABOUT WHY. An upsell on a member's own profile page is aimed
 * at the wrong person — most members cannot change their family's plan — and `/upgrade` is the
 * screen that exists for the one who can. The absent control is the same silence every other
 * tier boundary keeps.
 *
 * IT IS NOT THE GATE. `uploadAvatar` refuses on the tier itself, because a `'use server'`
 * export has a URL whether or not a button exists (AGENTS.md §2), and its header carries the
 * one argument in this product for tier-checking a WRITE.
 */
export function AvatarUpload({ initials, existingUrl, allowed }: {
  initials: string
  existingUrl?: string | null
  /** Does the family being viewed include profile pictures? `familyShowsPhotos`. */
  allowed: boolean
}) {
  const t = useT()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = await confirm({
      title: existingUrl ? t('profile.photo.replaceLong') : t('profile.photo.setLong'),
      description: existingUrl
        ? t('profile.photo.replaceConfirm', { name: file.name })
        : t('profile.photo.setConfirm', { name: file.name }),
      confirmLabel: existingUrl ? t('profile.photo.replace') : t('profile.photo.set'),
    })
    if (!ok) { if (fileRef.current) fileRef.current.value = ''; return }
    setError('')
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const result = await uploadAvatar(fd)
      if (!result.success) {
        setPreview(existingUrl ?? null)
        setError(result.message ?? t('profile.photo.failed'))
      }
      // THE INPUT IS CLEARED EITHER WAY. Without it, choosing the same file again after a
      // refusal fires no `change` event at all — the value has not changed — so the member's
      // second attempt does nothing and the message they are looking at stays put, which reads
      // as the control being broken rather than as the file being wrong.
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  // Before the control, and after the hooks — a conditional return above `useState` would
  // change the hook order between a Free family and a Standard one, and switching family
  // re-renders this component rather than remounting the tree above it.
  if (!allowed) {
    return (
      <div className="shrink-0">
        <Avatar url={null} initials={initials} size="lg" />
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      {/* ── THE WHOLE PORTRAIT IS THE CONTROL — 2026-09-03 ────────────────────────────
          Asked for as "move the button to overlay on the profile picture itself". The camera
          chip was already in the corner, and it was a 20px target sitting on an 80px one that
          did nothing — so the picture read as clickable and was not.

          ONE `<button>` WRAPPING THE PORTRAIT, never a button inside a button: an outer
          clickable element containing the existing chip would be nested interactive content,
          which is invalid and gives a screen reader two controls where there is one action.
          So the chip is now decoration (`aria-hidden`) and the button carries the name.

          The scrim appears on hover AND on keyboard focus. Hover alone would make this a
          control that only says what it does to somebody using a mouse. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        aria-label={existingUrl ? t('profile.photo.replaceLong') : t('profile.photo.setLong')}
        className="group relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default"
      >
        <Avatar url={preview} initials={initials} size="lg" />
        {/* The scrim. `--brand-ink` at low alpha rather than a neutral black, so it warms the
            portrait the way every other overlay in the product does; no `on-` token is used on
            it, because nothing is written here — the icon below carries its own colour. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-brand-ink/0 transition-colors group-hover:bg-brand-ink/45 group-focus-visible:bg-brand-ink/45"
        >
          {isPending
            ? <Loader2 className="h-6 w-6 animate-spin text-brand-on-primary" />
            : (
              <Camera className="h-6 w-6 text-brand-on-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            )}
        </span>
        {/* The resting affordance, so the portrait reads as changeable before anybody hovers
            it. Decoration now — the button around it is the named control. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -end-0.5 rounded-full border border-border bg-muted p-1 transition-colors group-hover:bg-accent"
        >
          <Camera className="h-3 w-3 text-muted-foreground" />
        </span>
      </button>
      {/* `hidden`, NOT `sr-only`. Both hide it from the eye; only `display: none` takes it out
          of the tab order and the accessibility tree. Under `sr-only` this was a second,
          UNNAMED "choose file" control sitting immediately after the button that already does
          the job — a keyboard or screen-reader user tabbed into it and was told nothing about
          what it was for.

          The button above is the real control and `.click()` still reaches a `display: none`
          input in every browser this app supports. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      {/* ABSOLUTELY POSITIONED, because this sits in a flex row beside the page heading — a
          message in the normal flow would push the heading sideways every time it appeared.
          `w-max` with a `max-w` so a long sentence wraps into a block rather than stretching
          the row, and `z-10` to sit above whatever it overhangs. It renders nothing at all
          when there is no message, which is what `FormError` guarantees and is why there is no
          `{error && …}` here. */}
      <div className="absolute start-0 top-full z-10 w-max max-w-[16rem] pt-2">
        <FormError message={error} />
      </div>
    </div>
  )
}
