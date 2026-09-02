'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
// `useWatch`, never the `watch()` the same hook returns — see the note below the imports.
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Pencil, Camera, Loader2, User, MapPin, Info, Bell, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { saveProfileSection, saveChapterAndPropagate, uploadAvatar, type PersonalInfoRecord } from '@/app/actions/personal-info'
import type { Chapter } from '@/app/actions/admin/chapters'
import { Avatar } from '@/components/ui/Avatar'
import { FieldError, FormError } from '@/components/ui/form-message'
import { TSHIRT_CATEGORIES, TSHIRT_SIZES, PREFIXES, SUFFIXES, type TshirtCategory } from '@/lib/tshirt-sizes'
import { GENDERS, GENDER_LABELS, genderLabel } from '@/lib/gender'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'
import { formatDate as fmtDate } from '@/lib/date-utils'
import { TIMEZONES, timezoneLabel } from '@/lib/date-utils'
import { LOCALES } from '@/lib/i18n/locales'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { SignInSecuritySection } from '@/components/personal-info/SignInSecurity'
import { NotificationsSection } from '@/components/personal-info/Notifications'
import type { MyNotificationSettings } from '@/app/actions/notification-prefs'
import {
  profileSectionLabel, type ProfileSection,
} from '@/components/personal-info/profile-sections'
import { formatPhone } from '@/lib/phone-format'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

// ── `useWatch`, never `watch()` ────────────────────────────────────────────────
//
// The reason is bigger than the lint warning that surfaces it. React Compiler knows
// `useForm().watch` by name and refuses to memoize a component that calls it — `watch` is a
// mutable function returning a value that changes without React being told, so anything
// derived from it could be memoized to a stale result. The compiler's response is not to
// skip the call: it is to SKIP COMPILING THE WHOLE COMPONENT, which
// `react-hooks/incompatible-library` reports as "Compilation Skipped". Two of the sections
// below were paying that, so the cost of `watch()` was every other memoization in
// `AddressSection` and `AdditionalInfoSection`, not the one line it appeared on.
//
// `useWatch({ control, name })` is a real hook that subscribes and returns a value, so it is
// memoization-safe and the compiler proceeds. Same value, same re-render on change;
// `control` comes off the same `useForm()` in place of `watch`.
//
// The knowledge is in the compiler's own `defaultModuleTypeProvider` for `react-hook-form`
// (`node_modules/eslint-plugin-react-hooks`), which lists `watch` and nothing else — so this
// is the whole of what the library owes here, and a new form needing a live field value
// should reach for `useWatch` from the start.
//
// ── Shared helpers ─────────────────────────────────────────────────────────────

const tv = (v: string | null | undefined) => v ?? ''

const formatDate = fmtDate

// ── View-mode field ────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  const t = useT()
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">
        {value || <span className="text-muted-foreground/40 italic text-xs">{t('action.notSet')}</span>}
      </p>
    </div>
  )
}

// ── Avatar with upload ─────────────────────────────────────────────────────────

/**
 * The profile photo, and the one control that changes it.
 *
 * ── IT NOW SAYS WHEN IT FAILS, AND IT DID NOT ───────────────────────────────────────
 * `uploadAvatar`'s result was read only to revert the preview: `if (!result.success)
 * setPreview(existingUrl)`. So every refusal — over 2 MB, wrong type, storage down, the
 * `people` update refused — looked identical from the member's side: the picture flickered to
 * the new one and back, with nothing said. The photo they chose simply did not stick, twice,
 * and then they gave up.
 *
 * That was survivable while the action's only refusals were size and transport. It stopped
 * being survivable on 2026-08-20, when the type check moved server-side — "Choose a JPEG, PNG
 * or WebP image" is a sentence a member can act on, and it was being thrown away.
 *
 * `FormError` and not `FieldError`: the file input is `hidden` and the camera button is the
 * control, so there is no field for a quiet message to sit under, and what failed is the
 * OPERATION rather than one input (AGENTS.md, "Telling somebody something went wrong is a
 * component").
 */
/**
 * ── `allowed` IS THE PLAN, NOT A PERMISSION (2026-08-22) ────────────────────────────
 * Profile pictures are Standard. When the family being viewed is on Free this renders the
 * portrait frame and NO control — the member sees their initials, exactly as somebody who has
 * not uploaded one does, and there is no camera button to press.
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
function AvatarUpload({ initials, existingUrl, allowed }: {
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
        <Avatar url={null} initials={initials} size="md" />
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      <Avatar url={preview} initials={initials} size="md" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="absolute -bottom-1 -end-1 rounded-full bg-muted border border-border p-1 hover:bg-accent transition-colors disabled:opacity-50"
        aria-label={t('profile.photo.upload')}
      >
        {isPending
          ? <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          : <Camera className="h-3 w-3 text-muted-foreground" />}
      </button>
      {/* `hidden`, NOT `sr-only`. Both hide it from the eye; only `display: none` takes
          it out of the tab order and the accessibility tree. Under `sr-only` this was a
          second, UNNAMED "choose file" control sitting immediately after the camera
          button that already does the job — a keyboard or screen-reader user tabbed
          into it and was told nothing about what it was for.

          The button above is the real control and `.click()` still reaches a
          `display: none` input in every browser this app supports. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      {/* ABSOLUTELY POSITIONED, because this component is the `headerLeft` of a SectionCard and
          sits in a flex row beside the member's name — a message in the normal flow would push
          the heading sideways every time it appeared. `w-max` with a `max-w` so a long sentence
          wraps into a block rather than stretching the row, and `z-10` to sit above the card
          edge it overhangs. It renders nothing at all when there is no message, which is what
          `FormError` guarantees and is why there is no `{error && …}` here. */}
      <div className="absolute start-0 top-full z-10 w-max max-w-[16rem] pt-2">
        <FormError message={error} />
      </div>
    </div>
  )
}

// ── Section card shell ─────────────────────────────────────────────────────────

/**
 * One section's body.
 *
 * NO BOX, NO EDIT BUTTON, AND SINCE 2026-09-02 NO HEADER EITHER.
 *
 * The box was a `rounded-xl border bg-card` panel, which made sense when all three
 * sections stacked down the page and the border was the only thing saying where one
 * ended. The rail does that now, and a bordered card holding the only thing on screen is
 * a frame around the whole page.
 *
 * The Edit trigger moved to the rail's `action` slot — the same place Transactions and
 * Accounting put their one per-pane action. It is the active pane's single action, so it
 * belongs with the rail rather than floating above the fields; see PersonalInfoForm for
 * what that cost, which is that `editing` had to move up with it.
 *
 * `headerLeft` was the third thing to go, and it existed for exactly one caller: the avatar,
 * on General only. That is why the member's own picture vanished the moment they opened
 * Address — reported, and repaired by hoisting `AvatarUpload` above the RAIL rather than by
 * giving the other four a header of their own. A shared thing rendered once cannot disagree
 * with itself, and five copies of an upload control is five places for the tier check and the
 * optimistic preview to drift.
 *
 * So this is now a plain vertical stack, and the type says so.
 */
function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

// ── Form action row ────────────────────────────────────────────────────────────

function FormActions({
  isSubmitting,
  onCancel,
  error,
}: {
  isSubmitting: boolean
  onCancel: () => void
  error?: string
}) {
  const t = useT()
  return (
    <div className="space-y-3 pt-1">
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? t('action.saving') : t('action.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('action.cancel')}
        </Button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — General Information (name + contact, then chapter)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The chapter field, in a bordered block of its own headed by the family's name.
 *
 * WHY IT IS NOT IN THE GRID ABOVE, which is where it used to sit. Every other field on
 * this page is the SAME VALUE in every family the member belongs to — the sync trigger
 * propagates them, which is what makes "My Profile" one thing that floats. `chapter_id`
 * is the exception: a chapter belongs to exactly one family, so the column is per-family
 * and is excluded from both directions of the sync (20260617000000, 20260617000001).
 *
 * The data was always right — getPersonalInfo() reads the active family's `people` row
 * and getChapters() returns that family's chapters. What was wrong is that nothing said
 * so. One cell in a grid of global fields, labelled just "Chapter", changed value when
 * you used the family switcher and gave no reason; in a family with no chapters it
 * disappeared from the section altogether, which reads as a bug rather than as an
 * answer. Naming the family in the heading makes the scope structural instead of
 * something the reader has to already know.
 *
 * IT KEEPS ITS PLACE ON THIS PAGE rather than moving to an admin screen: which branch of
 * the family you are part of is the member's own statement about themselves, like the
 * rest of the profile, and ChapterReminderBanner on the dashboard already asks them for
 * it directly.
 */
function ChapterBlock({
  familyName, chapters, children,
}: {
  familyName: string
  chapters: Chapter[]
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="mt-6 rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {familyName ? t('profile.inFamily', { family: familyName }) : t('profile.inThisFamily')}
      </p>
      {/* The empty case says so instead of rendering nothing. A family that has not
          created any chapters is the common case, not an error, and a member who was
          told about chapters elsewhere should find the answer here rather than a gap. */}
      {chapters.length > 0 ? (
        <div className="space-y-1.5">{children}</div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('profile.noChapters')}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t('prof.chapterAppliesFamilyOnly')}</p>
      {/* WHAT IT DECIDES ABOUT MONEY, said here because this is the only screen that sets
          it and 20260817000008 made it consequential: a due can belong to one region or one
          chapter, and somebody with no chapter is under National and owes neither. A member
          wondering why a chapter's due is not on their Dues screen has to be able to find
          the answer at the control that causes it. */}
      {chapters.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t('prof.canAlsoDecideWhat')}</p>
      )}
    </div>
  )
}

// A FACTORY, not a constant. The two required-field messages are copy, and a schema built
// at module load cannot reach the reader's catalogue. `GeneralData` is inferred from the
// RETURN type below, so the shape is still checked exactly as before.
const generalSchema = (t: T) => z.object({
  prefix:         z.string().optional(),
  first_name:     z.string().min(1, t('profile.firstNameRequired')),
  middle_name:    z.string().optional(),
  last_name:      z.string().min(1, t('profile.lastNameRequired')),
  nick_name:      z.string().optional(),
  suffix:         z.string().optional(),
  primary_email:  z.string().optional(),
  primary_phone:  z.string().optional(),
  // '' is "not stated" and reaches the row as NULL — saveProfileSection turns an
  // empty string into null before writing, which is also what the CHECK constraint
  // on the column expects. An enum here would reject '' and make the blank option
  // unsubmittable, so the closed set is enforced by the database and by the two
  // <option>s, not by the resolver.
  gender:         z.string().optional(),
})
type GeneralData = z.infer<ReturnType<typeof generalSchema>>

function GeneralSection({
  existing,
  chapters,
  familyName,
  onSaved,
  visible,
  editing,
  onEditDone,
}: {
  existing: PersonalInfoRecord | null
  chapters: Chapter[]
  /* `photosAllowed` LEFT ON 2026-09-02 with the avatar. It gated `AvatarUpload`, which is
     rendered once above the rail now, so this section has nothing to gate — see SectionCard. */
  /** Names the chapter block's scope. See ChapterBlock. */
  familyName: string
  onSaved: () => void
  visible: boolean
  /** Owned by PersonalInfoForm now, because the Edit trigger lives in the rail. */
  editing: boolean
  /** Leave edit mode — saved or cancelled, the parent does not need to know which. */
  onEditDone: () => void
}) {
  const t = useT()
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')
  const existingChapterId = existing?.chapter_id
  const [chapterId, setChapterId]   = useState(existingChapterId ?? '')

  const currentChapter = chapters.find(c => c.id === existingChapterId)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GeneralData>({
    resolver: zodResolver(generalSchema(t)),
    defaultValues: {
      prefix: tv(existing?.prefix), first_name: tv(existing?.first_name),
      middle_name: tv(existing?.middle_name), last_name: tv(existing?.last_name),
      nick_name: tv(existing?.nick_name ?? null),
      suffix: tv(existing?.suffix),
      primary_email: tv(existing?.primary_email), primary_phone: tv(existing?.primary_phone),
      gender: tv(existing?.gender),
    },
  })

  // NO EFFECT HERE, and no re-seed on entering edit mode.
  //
  // The form used to re-seed from `existing` in the Edit click handler. That handler is
  // gone — the trigger lives in the rail now — and doing it in an effect on `editing`
  // means calling setState inside an effect, which cascades a render for every field.
  //
  // Instead CANCEL resets to the CURRENT `existing` rather than to the values captured at
  // mount, which is what the re-seed was really for and is strictly more correct: after a
  // save the form already holds what was saved, so entering edit again finds the right
  // values with nothing having to reset them. The old pairing (mount-time defaults +
  // re-seed on entry) had a hole this closes — save B, edit again, cancel, and the form
  // fell back to the values the page first loaded with rather than to B.
  function handleCancel() {
    reset({
      prefix: tv(existing?.prefix), first_name: tv(existing?.first_name),
      middle_name: tv(existing?.middle_name), last_name: tv(existing?.last_name),
      nick_name: tv(existing?.nick_name ?? null),
      suffix: tv(existing?.suffix),
      primary_email: tv(existing?.primary_email), primary_phone: tv(existing?.primary_phone),
      gender: tv(existing?.gender),
    })
    setChapterId(existingChapterId ?? '')
    setServerError('')
    onEditDone()
  }

  async function onSubmit(data: GeneralData) {
    const chapterChanged = chapterId !== (existingChapterId ?? '')
    const ok = await confirm({
      title: t('profile.confirm.general'),
      description: chapterChanged
        // SAYS WHAT MOVES. There is no household here (AGENTS.md §4b: one kind of `people`
        // row), and what follows a member is narrower than one: a son or daughter under
        // eighteen with no account of their own.
        ? t('profile.confirm.chapterBody', {
            chapter: chapters.find(c => c.id === chapterId)?.name
              ?? t('profile.selectedChapter'),
          })
        : t('profile.confirm.generalBody'),
      confirmLabel: t('action.saveChanges'),
    })
    if (!ok) return
    setServerError('')
    // NO chapter_id IN THIS PAYLOAD. It used to be sent here as well as through
    // saveChapterAndPropagate below, so the column was written twice on every submit —
    // and that redundancy was the only reason it had to sit on the profile allow-list
    // (lib/profile-columns.ts). saveChapterAndPropagate is the real path: it is the only
    // one that also moves the member's minor children.
    const result = await saveProfileSection(data)
    if (!result.success) { setServerError(result.message ?? t('profile.wentWrong')); return }
    if (chapterChanged) {
      const chapterResult = await saveChapterAndPropagate(chapterId || null)
      // Reported rather than swallowed. The chapter is now a SEPARATE write, so it can
      // fail on its own — and it is the half that also moves the member's under-18 children,
      // which is the last thing to report success over silently.
      if (!chapterResult.success) {
        setServerError(chapterResult.message ?? t('profile.chapterNotChanged'))
        onSaved()
        return
      }
    }
    onEditDone()
    onSaved()
  }

  // Returned null AFTER every hook above, and never unmounted by the parent. That is
  // what lets a half-finished edit survive a rail switch: `editing`, the react-hook-form
  // state and the chapter selection all belong to this component, and unmounting it to
  // hide it would throw them away silently. Same reason the Accounting panels stay
  // mounted and return null for the sections they do not own.
  if (!visible) return null

  return (
    <SectionCard>
      {!editing ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
            <Field label={t('field.prefix')}         value={existing?.prefix} />
            <Field label={t('field.firstName')}      value={existing?.first_name} />
            <Field label={t('field.middleName')}     value={existing?.middle_name} />
            <Field label={t('field.lastName')}       value={existing?.last_name} />
            <Field label={t('field.nickname')}       value={existing?.nick_name ?? null} />
            <Field label={t('field.suffix')}         value={existing?.suffix} />
            <Field label={t('field.email')}          value={existing?.primary_email} />
            <Field label={t('field.phone')}          value={formatPhone(existing?.primary_phone)} />
            {/* genderLabel() rather than the raw column: the row holds 'male', the
                screen says Male. It returns '' for a value it does not recognise, so
                Field falls through to "Not set" instead of printing a token. */}
            <Field label={t('field.gender')}         value={genderLabel(existing?.gender)} />
          </div>
          <ChapterBlock familyName={familyName} chapters={chapters}>
            <p className="text-xs text-muted-foreground">
              {t('field.chapterLabel')}
            </p>
            <p className="text-sm">
              {currentChapter?.name ?? <span className="text-muted-foreground">{t('action.notSet')}</span>}
            </p>
          </ChapterBlock>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prefix">{t('field.prefix')}</Label>
              <Select id="prefix" {...register('prefix')}>
                <option value="">— None —</option>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="first_name" required>{t('field.firstName')}</Label>
              <Input id="first_name" {...register('first_name')} />
              <FieldError message={errors.first_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middle_name">{t('field.middleName')}</Label>
              <Input id="middle_name" {...register('middle_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name" required>{t('field.lastName')}</Label>
              <Input id="last_name" {...register('last_name')} />
              <FieldError message={errors.last_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nick_name">{t('field.nickname')}</Label>
              <Input id="nick_name" placeholder={t('field.ph.nickname')} {...register('nick_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suffix">{t('field.suffix')}</Label>
              <Select id="suffix" {...register('suffix')}>
                <option value="">— None —</option>
                {SUFFIXES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_email">{t('field.email')}</Label>
              <Input id="primary_email" type="email" placeholder={t('field.ph.email')} {...register('primary_email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_phone">{t('field.phone')}</Label>
              <Input id="primary_phone" type="tel" placeholder={t('field.ph.phone')} {...register('primary_phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">{t('field.gender')}</Label>
              {/* Blank is a real, keepable answer and it is the default, so the option
                  is worded as one rather than as an empty prompt — nothing here obliges
                  anyone to state it. It saves as NULL. */}
              <Select id="gender" {...register('gender')}>
                <option value="">— Prefer not to say —</option>
                {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </Select>
            </div>
          </div>
          <ChapterBlock familyName={familyName} chapters={chapters}>
            <Label htmlFor="chapter_id">{t('field.chapter')}</Label>
            <select
              id="chapter_id"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
              value={chapterId}
              onChange={e => setChapterId(e.target.value)}
            >
              <option value="">— None —</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </ChapterBlock>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Address
// ══════════════════════════════════════════════════════════════════════════════

const addressSchema = z.object({
  country:        z.string().optional(),
  street_address: z.string().optional(),
  apartment:      z.string().optional(),
  city:           z.string().optional(),
  state:          z.string().optional(),
  zip_code:       z.string().optional(),
})
type AddressData = z.infer<typeof addressSchema>

function AddressSection({
  existing,
  onSaved,
  visible,
  editing,
  onEditDone,
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
  visible: boolean
  editing: boolean
  onEditDone: () => void
}) {
  const t = useT()
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, control, setValue, formState: { isSubmitting } } = useForm<AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: tv(existing?.country), street_address: tv(existing?.street_address), apartment: tv(existing?.apartment), city: tv(existing?.city), state: tv(existing?.state), zip_code: tv(existing?.zip_code) },
  })

  // `useWatch`, NOT `watch()` — see the note below the imports.
  const selectedCountry  = (useWatch({ control, name: 'country' }) ?? '') as Country | ''
  const selectedState    = useWatch({ control, name: 'state' }) ?? ''
  const availableRegions = selectedCountry && selectedCountry in REGIONS ? REGIONS[selectedCountry as Country] : []

  // 'Canada' is the STORED VALUE of the country field, not a caption — it stays English.
  // What is translated is the label the comparison chooses.
  const stateLabel = selectedCountry === 'Canada' ? t('field.province') : t('field.state')

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('country', e.target.value)
    setValue('state', '')
  }

  // Resets to the CURRENT `existing`, not to the mount-time defaults — see
  // GeneralSection for why that replaced a re-seed on entering edit.
  function handleCancel() {
    reset({ country: tv(existing?.country), street_address: tv(existing?.street_address), apartment: tv(existing?.apartment), city: tv(existing?.city), state: tv(existing?.state), zip_code: tv(existing?.zip_code) })
    setServerError('')
    onEditDone()
  }

  async function onSubmit(data: AddressData) {
    const ok = await confirm({
      title: t('profile.confirm.address'),
      description: t('profile.confirm.addressBody'),
      confirmLabel: t('action.saveChanges'),
    })
    if (!ok) return
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { onEditDone(); onSaved() }
    else setServerError(result.message ?? t('profile.wentWrong'))
  }

  // NO `fullAddress`. A newline-joined one-block address was built here and never rendered:
  // the read-only view below prints each part under its own `<Field>` label, which is the
  // same six-column treatment the rest of this page uses. Nothing wanted it as one string.

  // After the hooks — see GeneralSection.
  if (!visible) return null

  return (
    <SectionCard>
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label={t('field.country')}        value={existing?.country} />
          <Field label={t('field.street')}         value={existing?.street_address} />
          <Field label={t('field.apartment')}      value={existing?.apartment} />
          <Field label={t('field.city')}           value={existing?.city} />
          <Field label={stateLabel || t('field.stateProvince')} value={existing?.state} />
          <Field label={t('field.zip')}            value={existing?.zip_code} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="country">{t('field.country')}</Label>
            <Select id="country" value={selectedCountry} onChange={handleCountryChange} className="max-w-xs">
              <option value="">— Select Country —</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="street_address">{t('field.street')}</Label>
              <Input id="street_address" placeholder={t('field.ph.street')} {...register('street_address')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apartment">{t('field.apartment')}</Label>
              <Input id="apartment" placeholder={t('field.ph.apartment')} {...register('apartment')} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city">{t('field.city')}</Label>
                <Input id="city" placeholder={t('field.ph.city')} {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">
                  {selectedCountry === 'Canada' ? t('field.province') : selectedCountry ? t('field.state') : t('field.stateProvince')}
                </Label>
                {availableRegions.length > 0 ? (
                  <Select id="state" value={selectedState} onChange={e => setValue('state', e.target.value)}>
                    <option value="">— Select —</option>
                    {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                ) : (
                  <Input id="state" placeholder={t('field.state')} disabled={!selectedCountry} {...register('state')} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zip_code">{t('field.zip')}</Label>
                <Input id="zip_code" placeholder={t('field.ph.zip')} {...register('zip_code')} />
              </div>
            </div>
          </div>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Additional Information (dates + t-shirt)
// ══════════════════════════════════════════════════════════════════════════════

const additionalSchema = z.object({
  date_of_birth:   z.string().optional(),
  sunset_date:     z.string().optional(),
  tshirt_category: z.string().optional(),
  tshirt_size:     z.string().optional(),
  time_zone:       z.string().optional(),
  locale:          z.string().optional(),
})
type AdditionalData = z.infer<typeof additionalSchema>

function AdditionalInfoSection({ existing, onSaved, visible, editing, onEditDone }: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
  visible: boolean
  editing: boolean
  onEditDone: () => void
}) {
  const t = useT()
  const intl = useIntlTag()
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, control, setValue, formState: { isSubmitting } } = useForm<AdditionalData>({
    resolver: zodResolver(additionalSchema),
    defaultValues: {
      date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date),
      tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size),
      time_zone: tv(existing?.time_zone),
      locale: tv(existing?.locale),
    },
  })

  // `useWatch`, NOT `watch()` — see the note below the imports. Both are read in the JSX
  // below; the size one was an inline `watch()` call in the `<Select>`'s `value`, which the
  // linter never reported separately because the compiler had already given up on the
  // component at the line above it.
  const selectedCategory = (useWatch({ control, name: 'tshirt_category' }) ?? '') as TshirtCategory | ''
  const selectedSize     = useWatch({ control, name: 'tshirt_size' }) ?? ''
  const availableSizes   = selectedCategory && selectedCategory in TSHIRT_SIZES ? TSHIRT_SIZES[selectedCategory as TshirtCategory] : []

  // Resets to the CURRENT `existing` — see GeneralSection.
  function handleCancel() {
    reset({
      date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date),
      tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size),
      time_zone: tv(existing?.time_zone),
      locale: tv(existing?.locale),
    })
    setServerError('')
    onEditDone()
  }

  async function onSubmit(data: AdditionalData) {
    const ok = await confirm({
      title: t('profile.confirm.additional'),
      description: t('profile.confirm.additionalBody'),
      confirmLabel: t('action.saveChanges'),
    })
    if (!ok) return
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { onEditDone(); onSaved() }
    else setServerError(result.message ?? t('profile.wentWrong'))
  }

  const shirtDisplay = existing?.tshirt_category && existing?.tshirt_size
    ? `${existing.tshirt_category} — ${existing.tshirt_size}` : null

  // After the hooks — see GeneralSection.
  if (!visible) return null

  return (
    <SectionCard>
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label={t('field.dob')} value={formatDate(existing?.date_of_birth, intl)} />
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{t('prof.sunsetDate')}</p>
            <p className="text-sm">
              {formatDate(existing?.sunset_date, intl) || <span className="text-muted-foreground/40 italic text-xs">{t('profile.living')}</span>}
            </p>
          </div>
          <Field label={t('field.tshirt')} value={shirtDisplay} />
          <Field label={t('field.timeZone')} value={existing?.time_zone ? timezoneLabel(t, existing.time_zone) : null} />
          {/* LANGUAGE, added 2026-09-02. The edit form has offered a `locale` picker since
              `20260826000002` and the view state never showed one, so a member could choose
              their language, save, and find nothing on the page saying they had.

              THE ENDONYM, NOT A TRANSLATED NAME. `Español` reads as itself in every locale,
              which is the whole reason `LOCALES` carries the field — the same list the picker
              above renders, so the two cannot disagree about what a code is called.

              NULL RENDERS "Not set" through `Field`, and that is the honest answer rather than
              a guess: an unset locale means the reader is followed by their browser, which is
              what the edit form's own hint says. Naming the negotiated language here would
              claim they had chosen it. */}
          <Field
            label={t('field.language')}
            value={LOCALES.find(l => l.code === existing?.locale)?.endonym ?? null}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">{t('field.dob')}</Label>
              <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sunset_date">{t('field.sunset')}</Label>
              <Input id="sunset_date" type="date" {...register('sunset_date')} />
              <p className="text-xs text-muted-foreground">{t('profile.sunsetHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_category">{t('field.tshirtCategory')}</Label>
              <Select id="tshirt_category" value={selectedCategory} onChange={e => { setValue('tshirt_category', e.target.value); setValue('tshirt_size', '') }}>
                <option value="">— Select —</option>
                {TSHIRT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_size">{t('field.tshirtSize')}</Label>
              <Select id="tshirt_size" disabled={availableSizes.length === 0} value={selectedSize} onChange={e => setValue('tshirt_size', e.target.value)}>
                <option value="">— Select —</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              {availableSizes.length === 0 && <p className="text-xs text-muted-foreground">{t('profile.sizeFirst')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time_zone">{t('field.timeZone')}</Label>
              <Select id="time_zone" {...register('time_zone')}>
                <option value="">— Select —</option>
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{timezoneLabel(t, tz)}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t('prof.datesTimesProductRecords')}</p>
            </div>
            {/* ── LANGUAGE ────────────────────────────────────────────────────────────
                THE ENDONYM IS NOT TRANSLATED, and that is the one rule for this control:
                a member looking for their own language scans for the word they would use
                for it, and that word does not change with the interface they happen to be
                reading. See `lib/i18n/locales.ts`.

                No flags. A flag is a country and a language is not — Spanish is not Spain
                to a family in Monterrey. */}
            <div className="space-y-1.5">
              <Label htmlFor="locale">{t('field.language')}</Label>
              <Select id="locale" {...register('locale')}>
                <option value="">— Select —</option>
                {LOCALES.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.code.toUpperCase()} · {l.endonym}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t('prof.leaveEmptyWeFollow')}</p>
            </div>
          </div>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Root export — composes all sections
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The rail's items. No `href`: these sections have no server-rendered address of their
 * own — `?section=` is written by replaceState and read on the next full load — so a real
 * link would promise a round trip that discards whatever is half-typed in a section.
 */
// A FUNCTION, not a constant, since Phase 5: the captions come from the reader's catalogue,
// so they cannot be resolved at module load. The ICONS and the ORDER stay here, which is
// what this list is actually for.
function railItems(t: T): MainRailItem<ProfileSection>[] {
  return [
    { id: 'general', label: profileSectionLabel(t, 'general'), icon: User },
    { id: 'address', label: profileSectionLabel(t, 'address'), icon: MapPin },
    { id: 'additional', label: profileSectionLabel(t, 'additional'), icon: Info },
    { id: 'notifications', label: profileSectionLabel(t, 'notifications'), icon: Bell },
    { id: 'security', label: profileSectionLabel(t, 'security'), icon: ShieldCheck },
  ]
}

/**
 * Sections whose content is not an editable record, so the rail's Edit trigger would be
 * meaningless on them. Sign-in & Security carries its own two forms, each with its own
 * confirmation step; an Edit button above them would suggest a fourth thing to save.
 *
 * ── NOTIFICATIONS CAME OFF THIS LIST ON 2026-08-29 ─────────────────────────────────
 * It was here for a sharper version of the same reason: every cell of its grid commits on its
 * own press, and the SMS column is legally significant, so an Edit/Save frame would imply
 * consent is a draft you can revise before saving — which is the one thing it is not.
 *
 * That argument was against a FORM, and it proved too much. What it cost was a read-only
 * state: the pane opened as nine live switches, on the one screen in the product whose other
 * three sections open as a record. So it has a mode now and still has no draft — the switches
 * appear behind **Edit**, each press is the same immediate write it always was, and the action
 * row says **Done** rather than Save, with no Cancel. See the component, which carries the
 * whole argument including why there is deliberately nothing to cancel.
 */
const NO_EDIT_TRIGGER: ReadonlySet<ProfileSection> =
  new Set<ProfileSection>(['security'])

export function PersonalInfoForm({
  existing, chapters = [], familyName = '', photosAllowed, initialSection, signInEmail,
  notificationSettings,
}: {
  existing: PersonalInfoRecord | null
  chapters?: Chapter[]
  familyName?: string
  /**
   * Does the family being viewed include profile pictures? Resolved on the page with
   * `familyShowsPhotos` and threaded down, rather than read here: this is a client component
   * and the tier is a database fact. NOT optional — a default of `true` is the value that
   * would silently re-open the boundary on the next surface that forgets to pass it.
   */
  photosAllowed: boolean
  /** Resolved from `?section=` on the server, so the first paint is already right. */
  initialSection: ProfileSection
  /** `auth.users.email` — the address the account signs in with, not `primary_email`. */
  signInEmail: string
  /**
   * The caller's own notification grid, resolved on the page.
   *
   * Threaded down rather than fetched here for `photosAllowed`'s reason: this is a client
   * component, and every field of this is a database fact. It also means the panel paints with
   * a real answer rather than flashing "no number on file" at somebody who has one — which on a
   * consent screen would be the product appearing to have forgotten their choice.
   */
  notificationSettings: MyNotificationSettings
}) {
  const t = useT()
  const router = useRouter()
  const [section, setSection] = useState<ProfileSection>(initialSection)

  // WHICH section is being edited, held here rather than in each section, because the
  // Edit trigger now lives in the rail and the rail belongs to this component.
  //
  // One value, not one flag per section: only the active section is on screen, so two
  // cannot be edited at once in any way a member could see. Switching the rail does NOT
  // clear it — the sections stay mounted, so coming back finds the edit still open with
  // whatever was typed still in it.
  const [editingSection, setEditingSection] = useState<ProfileSection | null>(null)

  function handleSaved() { router.refresh() }

  function selectSection(next: ProfileSection) {
    setSection(next)
    // Rebuilt from the live search string so a switch never drops another param, and
    // replaceState rather than a router push: a navigation would remount all three
    // sections and discard any edit in progress.
    const params = new URLSearchParams(window.location.search)
    params.set('section', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  const editing = editingSection === section

  // ── THE MEMBER'S OWN PICTURE, ONCE, FOR EVERY SECTION ──────────────────────────
  // It used to be `SectionCard`'s `headerLeft` inside `GeneralSection`, so it was on General
  // and nowhere else: opening Address, Additional Info, Notifications or Sign-in made it
  // disappear. Reported 2026-09-02.
  //
  // ABOVE THE RAIL, not repeated per pane. The panes each `return null` when they are not the
  // active one, so "render it on all five" by copying would mean five `AvatarUpload`s — five
  // instances of the tier check, the optimistic preview and the 2 MB refusal, four of them
  // unmounted at any moment and all five free to drift. One instance outside the panes is the
  // same judgement `MainRail` itself embodies.
  //
  // NOT INSIDE `<MainRail>`. Its `action` slot is the ACTIVE PANE's one action — Edit lives
  // there — and an avatar is not an action; putting it there would also make it move when the
  // rail stacks below `sm`.
  const initials = [existing?.first_name?.[0], existing?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase()

  return (
    <div className="space-y-5">
      <AvatarUpload
        initials={initials}
        existingUrl={existing?.avatar_url ?? null}
        allowed={photosAllowed}
      />
      <MainRail
        label={t('profile.rail')}
        items={railItems(t)}
        active={section}
        onSelect={selectSection}
        // The active pane's one action, in the slot Transactions and Accounting use for
        // theirs. Hidden while that section is already in edit mode, where Save and
        // Cancel at the foot of the form are the actions that apply.
        action={!editing && !NO_EDIT_TRIGGER.has(section) && (
          <Button size="sm" variant="ghost"
            onClick={() => setEditingSection(section)}
            aria-label={t('profile.editSection', { section: profileSectionLabel(t, section) })}>
            <Pencil className="me-1 h-3.5 w-3.5" />
            {t('action.edit')}
          </Button>
        )}
      />
      {/* All three stay MOUNTED and hide themselves — see GeneralSection on why. */}
      <GeneralSection
        existing={existing} chapters={chapters} familyName={familyName} onSaved={handleSaved}
        visible={section === 'general'}
        editing={editingSection === 'general'}
        onEditDone={() => setEditingSection(null)}
      />
      <AddressSection
        existing={existing} onSaved={handleSaved}
        visible={section === 'address'}
        editing={editingSection === 'address'}
        onEditDone={() => setEditingSection(null)}
      />
      <AdditionalInfoSection
        existing={existing} onSaved={handleSaved}
        visible={section === 'additional'}
        editing={editingSection === 'additional'}
        onEditDone={() => setEditingSection(null)}
      />
      <NotificationsSection
        visible={section === 'notifications'}
        settings={notificationSettings}
        editing={editingSection === 'notifications'}
        onEditDone={() => setEditingSection(null)}
      />
      {/* The last one takes no `editing` prop: it is never in the rail's edit mode — see
          NO_EDIT_TRIGGER. It opens and closes its own two forms. */}
      <SignInSecuritySection
        visible={section === 'security'}
        signInEmail={signInEmail}
      />
    </div>
  )
}

