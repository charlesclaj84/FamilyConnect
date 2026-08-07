'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Camera, Loader2, User, MapPin, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { saveProfileSection, saveChapterAndPropagate, uploadAvatar, type PersonalInfoRecord } from '@/app/actions/personal-info'
import type { Chapter } from '@/app/actions/admin/chapters'
import { Avatar } from '@/components/ui/Avatar'
import { TSHIRT_CATEGORIES, TSHIRT_SIZES, PREFIXES, SUFFIXES, type TshirtCategory } from '@/lib/tshirt-sizes'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'
import { formatDate as fmtDate } from '@/lib/date-utils'
import { TIMEZONES, TIMEZONE_LABELS } from '@/lib/date-utils'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import {
  PROFILE_SECTION_LABELS, type ProfileSection,
} from '@/components/personal-info/profile-sections'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const tv = (v: string | null | undefined) => v ?? ''

const formatDate = fmtDate

// ── View-mode field ────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">
        {value || <span className="text-muted-foreground/40 italic text-xs">Not set</span>}
      </p>
    </div>
  )
}

// ── Avatar with upload ─────────────────────────────────────────────────────────

function AvatarUpload({ initials, existingUrl }: { initials: string; existingUrl?: string | null }) {
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null)
  const [isPending, startTransition] = useTransition()

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = await confirm({
      title: existingUrl ? 'Replace profile photo' : 'Set profile photo',
      description: existingUrl
        ? `Replace your profile photo with "${file.name}"? Your current photo is removed.`
        : `Use "${file.name}" as your profile photo?`,
      confirmLabel: existingUrl ? 'Replace photo' : 'Set photo',
    })
    if (!ok) { if (fileRef.current) fileRef.current.value = ''; return }
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const result = await uploadAvatar(fd)
      if (!result.success) setPreview(existingUrl ?? null)
    })
  }

  return (
    <div className="relative shrink-0">
      <Avatar url={preview} initials={initials} size="md" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="absolute -bottom-1 -right-1 rounded-full bg-muted border border-border p-1 hover:bg-accent transition-colors disabled:opacity-50"
        title="Upload photo"
      >
        {isPending
          ? <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          : <Camera className="h-3 w-3 text-muted-foreground" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  )
}

// ── Section card shell ─────────────────────────────────────────────────────────

/**
 * One section's body.
 *
 * NO BOX, and NO EDIT BUTTON.
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
 * What is left is a header row that exists only for the avatar, and only General has one.
 */
function SectionCard({
  headerLeft,
  children,
}: {
  headerLeft?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {headerLeft && <div className="flex items-center gap-3">{headerLeft}</div>}
      {children}
    </div>
  )
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
  return (
    <div className="space-y-3 pt-1">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — General Information (name + contact + chapter)
// ══════════════════════════════════════════════════════════════════════════════

const generalSchema = z.object({
  prefix:         z.string().optional(),
  first_name:     z.string().min(1, 'First name is required'),
  middle_name:    z.string().optional(),
  last_name:      z.string().min(1, 'Last name is required'),
  nick_name:      z.string().optional(),
  suffix:         z.string().optional(),
  primary_email:  z.string().optional(),
  primary_phone:  z.string().optional(),
})
type GeneralData = z.infer<typeof generalSchema>

function GeneralSection({
  existing,
  chapters,
  onSaved,
  visible,
  editing,
  onEditDone,
}: {
  existing: PersonalInfoRecord | null
  chapters: Chapter[]
  onSaved: () => void
  visible: boolean
  /** Owned by PersonalInfoForm now, because the Edit trigger lives in the rail. */
  editing: boolean
  /** Leave edit mode — saved or cancelled, the parent does not need to know which. */
  onEditDone: () => void
}) {
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')
  const existingChapterId = existing?.chapter_id
  const [chapterId, setChapterId]   = useState(existingChapterId ?? '')

  const initials = [existing?.first_name?.[0], existing?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
  const avatarUrl = existing?.avatar_url ?? null
  const currentChapter = chapters.find(c => c.id === existingChapterId)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GeneralData>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      prefix: tv(existing?.prefix), first_name: tv(existing?.first_name),
      middle_name: tv(existing?.middle_name), last_name: tv(existing?.last_name),
      nick_name: tv(existing?.nick_name ?? null),
      suffix: tv(existing?.suffix),
      primary_email: tv(existing?.primary_email), primary_phone: tv(existing?.primary_phone),
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
    })
    setChapterId(existingChapterId ?? '')
    setServerError('')
    onEditDone()
  }

  async function onSubmit(data: GeneralData) {
    const chapterChanged = chapterId !== (existingChapterId ?? '')
    const ok = await confirm({
      title: 'Save general information',
      description: chapterChanged
        ? `Save your changes and move to the ${chapters.find(c => c.id === chapterId)?.name ?? 'selected'} chapter? Your household moves with you.`
        : 'Save your changes to your general information?',
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setServerError('')
    const result = await saveProfileSection({ ...data, chapter_id: chapterId || null })
    if (!result.success) { setServerError(result.message ?? 'Something went wrong'); return }
    if (chapterChanged) {
      await saveChapterAndPropagate(chapterId || null)
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
    <SectionCard headerLeft={<AvatarUpload initials={initials} existingUrl={avatarUrl} />}>
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label="Prefix"         value={existing?.prefix} />
          <Field label="First Name"     value={existing?.first_name} />
          <Field label="Middle Name"    value={existing?.middle_name} />
          <Field label="Last Name"      value={existing?.last_name} />
          <Field label="Nickname"       value={existing?.nick_name ?? null} />
          <Field label="Suffix"         value={existing?.suffix} />
          <Field label="Email"          value={existing?.primary_email} />
          <Field label="Phone"          value={existing?.primary_phone} />
          <Field label="Chapter"        value={currentChapter?.name} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prefix">Prefix</Label>
              <Select id="prefix" {...register('prefix')}>
                <option value="">— None —</option>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
              <Input id="first_name" {...register('first_name')} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middle_name">Middle Name</Label>
              <Input id="middle_name" {...register('middle_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last Name <span className="text-destructive">*</span></Label>
              <Input id="last_name" {...register('last_name')} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nick_name">Nickname</Label>
              <Input id="nick_name" placeholder="e.g. Big Mike" {...register('nick_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suffix">Suffix</Label>
              <Select id="suffix" {...register('suffix')}>
                <option value="">— None —</option>
                {SUFFIXES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_email">Email</Label>
              <Input id="primary_email" type="email" placeholder="you@example.com" {...register('primary_email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_phone">Phone</Label>
              <Input id="primary_phone" type="tel" placeholder="(555) 000-0000" {...register('primary_phone')} />
            </div>
            {chapters.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="chapter_id">Chapter</Label>
                <select
                  id="chapter_id"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={chapterId}
                  onChange={e => setChapterId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
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
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: tv(existing?.country), street_address: tv(existing?.street_address), apartment: tv(existing?.apartment), city: tv(existing?.city), state: tv(existing?.state), zip_code: tv(existing?.zip_code) },
  })

  const selectedCountry  = watch('country') as Country | ''
  const selectedState    = watch('state') ?? ''
  const availableRegions = selectedCountry && selectedCountry in REGIONS ? REGIONS[selectedCountry as Country] : []

  const stateLabel = selectedCountry === 'Canada' ? 'Province' : 'State'

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
      title: 'Save address',
      description: 'Save your changes to your address?',
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { onEditDone(); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  const fullAddress = [
    existing?.street_address,
    existing?.apartment,
    [existing?.city, existing?.state, existing?.zip_code].filter(Boolean).join(', '),
    existing?.country,
  ].filter(Boolean).join('\n')

  // After the hooks — see GeneralSection.
  if (!visible) return null

  return (
    <SectionCard>
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label="Country"          value={existing?.country} />
          <Field label="Street Address"   value={existing?.street_address} />
          <Field label="Apartment / Suite" value={existing?.apartment} />
          <Field label="City"             value={existing?.city} />
          <Field label={stateLabel || 'State / Province'} value={existing?.state} />
          <Field label="ZIP / Postal"     value={existing?.zip_code} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Select id="country" value={selectedCountry} onChange={handleCountryChange} className="max-w-xs">
              <option value="">— Select Country —</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="street_address">Street Address</Label>
              <Input id="street_address" placeholder="123 Main Street" {...register('street_address')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apartment">Apartment / Suite</Label>
              <Input id="apartment" placeholder="Apt 4B" {...register('apartment')} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Springfield" {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">
                  {selectedCountry === 'Canada' ? 'Province' : selectedCountry ? 'State' : 'State / Province'}
                </Label>
                {availableRegions.length > 0 ? (
                  <Select id="state" value={selectedState} onChange={e => setValue('state', e.target.value)}>
                    <option value="">— Select —</option>
                    {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                ) : (
                  <Input id="state" placeholder="State" disabled={!selectedCountry} {...register('state')} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zip_code">ZIP / Postal</Label>
                <Input id="zip_code" placeholder="62701" {...register('zip_code')} />
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
})
type AdditionalData = z.infer<typeof additionalSchema>

function AdditionalInfoSection({ existing, onSaved, visible, editing, onEditDone }: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
  visible: boolean
  editing: boolean
  onEditDone: () => void
}) {
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<AdditionalData>({
    resolver: zodResolver(additionalSchema),
    defaultValues: {
      date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date),
      tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size),
      time_zone: tv(existing?.time_zone),
    },
  })

  const selectedCategory = watch('tshirt_category') as TshirtCategory | ''
  const availableSizes   = selectedCategory && selectedCategory in TSHIRT_SIZES ? TSHIRT_SIZES[selectedCategory as TshirtCategory] : []

  // Resets to the CURRENT `existing` — see GeneralSection.
  function handleCancel() {
    reset({
      date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date),
      tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size),
      time_zone: tv(existing?.time_zone),
    })
    setServerError('')
    onEditDone()
  }

  async function onSubmit(data: AdditionalData) {
    const ok = await confirm({
      title: 'Save additional information',
      description: 'Save your changes to your additional information?',
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { onEditDone(); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  const shirtDisplay = existing?.tshirt_category && existing?.tshirt_size
    ? `${existing.tshirt_category} — ${existing.tshirt_size}` : null

  // After the hooks — see GeneralSection.
  if (!visible) return null

  return (
    <SectionCard>
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label="Date of Birth" value={formatDate(existing?.date_of_birth)} />
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Sunset Date</p>
            <p className="text-sm">
              {formatDate(existing?.sunset_date) || <span className="text-muted-foreground/40 italic text-xs">Living</span>}
            </p>
          </div>
          <Field label="T-Shirt" value={shirtDisplay} />
          <Field label="Time Zone" value={existing?.time_zone ? (TIMEZONE_LABELS[existing.time_zone] ?? existing.time_zone) : null} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sunset_date">Sunset Date</Label>
              <Input id="sunset_date" type="date" {...register('sunset_date')} />
              <p className="text-xs text-muted-foreground">Leave blank if living.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_category">T-Shirt Category</Label>
              <Select id="tshirt_category" value={selectedCategory} onChange={e => { setValue('tshirt_category', e.target.value); setValue('tshirt_size', '') }}>
                <option value="">— Select —</option>
                {TSHIRT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_size">T-Shirt Size</Label>
              <Select id="tshirt_size" disabled={availableSizes.length === 0} value={watch('tshirt_size') ?? ''} onChange={e => setValue('tshirt_size', e.target.value)}>
                <option value="">— Select —</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              {availableSizes.length === 0 && <p className="text-xs text-muted-foreground">Select a category first.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time_zone">Time Zone</Label>
              <Select id="time_zone" {...register('time_zone')}>
                <option value="">— Select —</option>
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{TIMEZONE_LABELS[tz] ?? tz}</option>
                ))}
              </Select>
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
const RAIL_ITEMS: MainRailItem<ProfileSection>[] = [
  { id: 'general', label: PROFILE_SECTION_LABELS.general, icon: User },
  { id: 'address', label: PROFILE_SECTION_LABELS.address, icon: MapPin },
  { id: 'additional', label: PROFILE_SECTION_LABELS.additional, icon: Info },
]

export function PersonalInfoForm({ existing, chapters = [], initialSection }: {
  existing: PersonalInfoRecord | null
  chapters?: Chapter[]
  /** Resolved from `?section=` on the server, so the first paint is already right. */
  initialSection: ProfileSection
}) {
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

  return (
    <div className="space-y-5">
      <MainRail
        label="My Profile sections"
        items={RAIL_ITEMS}
        active={section}
        onSelect={selectSection}
        // The active pane's one action, in the slot Transactions and Accounting use for
        // theirs. Hidden while that section is already in edit mode, where Save and
        // Cancel at the foot of the form are the actions that apply.
        action={!editing && (
          <Button size="sm" variant="ghost"
            onClick={() => setEditingSection(section)}
            aria-label={`Edit ${PROFILE_SECTION_LABELS[section]}`}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      />
      {/* All three stay MOUNTED and hide themselves — see GeneralSection on why. */}
      <GeneralSection
        existing={existing} chapters={chapters} onSaved={handleSaved}
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
    </div>
  )
}

