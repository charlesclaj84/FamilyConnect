'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Camera, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { saveProfileSection, type PersonalInfoRecord } from '@/app/actions/personal-info'
import { TSHIRT_CATEGORIES, TSHIRT_SIZES, PREFIXES, SUFFIXES, type TshirtCategory } from '@/lib/tshirt-sizes'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const tv = (v: string | null | undefined) => v ?? ''

function formatDate(d?: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

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

// ── Profile avatar placeholder ─────────────────────────────────────────────────

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="relative shrink-0">
      <div className="w-14 h-14 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center select-none">
        {initials ? (
          <span className="text-lg font-semibold text-muted-foreground">{initials}</span>
        ) : (
          <UserCircle className="h-7 w-7 text-muted-foreground/40" />
        )}
      </div>
      <div
        className="absolute -bottom-1 -right-1 rounded-full bg-muted border border-border p-1"
        title="Photo upload coming soon"
      >
        <Camera className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  )
}

// ── Section card shell ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  headerLeft,
  editing,
  onEditClick,
  children,
}: {
  title: string
  headerLeft?: React.ReactNode
  editing: boolean
  onEditClick: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {headerLeft}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={onEditClick} className="shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        )}
      </div>
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
// SECTION 1 — My Profile (photo + name)
// ══════════════════════════════════════════════════════════════════════════════

const nameSchema = z.object({
  prefix:      z.string().optional(),
  first_name:  z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name:   z.string().min(1, 'Last name is required'),
  suffix:      z.string().optional(),
})
type NameData = z.infer<typeof nameSchema>

function ProfileSection({
  existing,
  onSaved,
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NameData>({
    resolver: zodResolver(nameSchema),
    defaultValues: { prefix: tv(existing?.prefix), first_name: tv(existing?.first_name), middle_name: tv(existing?.middle_name), last_name: tv(existing?.last_name), suffix: tv(existing?.suffix) },
  })

  const initials = [existing?.first_name?.[0], existing?.last_name?.[0]].filter(Boolean).join('').toUpperCase()

  function handleEditClick() {
    reset({ prefix: tv(existing?.prefix), first_name: tv(existing?.first_name), middle_name: tv(existing?.middle_name), last_name: tv(existing?.last_name), suffix: tv(existing?.suffix) })
    setServerError('')
    setEditing(true)
  }

  function handleCancel() {
    reset()
    setEditing(false)
    setServerError('')
  }

  async function onSubmit(data: NameData) {
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { setEditing(false); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <SectionCard
      title="My Profile"
      headerLeft={<Avatar initials={initials} />}
      editing={editing}
      onEditClick={handleEditClick}
    >
      {!editing ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          <Field label="Prefix"      value={existing?.prefix} />
          <Field label="First Name"  value={existing?.first_name} />
          <Field label="Middle Name" value={existing?.middle_name} />
          <Field label="Last Name"   value={existing?.last_name} />
          <Field label="Suffix"      value={existing?.suffix} />
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
              <Label htmlFor="suffix">Suffix</Label>
              <Select id="suffix" {...register('suffix')}>
                <option value="">— None —</option>
                {SUFFIXES.map(s => <option key={s} value={s}>{s}</option>)}
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
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
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

  function handleEditClick() {
    reset({ country: tv(existing?.country), street_address: tv(existing?.street_address), apartment: tv(existing?.apartment), city: tv(existing?.city), state: tv(existing?.state), zip_code: tv(existing?.zip_code) })
    setServerError('')
    setEditing(true)
  }

  function handleCancel() {
    reset()
    setEditing(false)
    setServerError('')
  }

  async function onSubmit(data: AddressData) {
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { setEditing(false); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  const fullAddress = [
    existing?.street_address,
    existing?.apartment,
    [existing?.city, existing?.state, existing?.zip_code].filter(Boolean).join(', '),
    existing?.country,
  ].filter(Boolean).join('\n')

  return (
    <SectionCard title="Address" editing={editing} onEditClick={handleEditClick}>
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
// SECTION 3 — Contact Information
// ══════════════════════════════════════════════════════════════════════════════

const contactSchema = z.object({
  primary_email: z.string().optional(),
  primary_phone: z.string().optional(),
})
type ContactData = z.infer<typeof contactSchema>

function ContactSection({
  existing,
  onSaved,
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ContactData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { primary_email: tv(existing?.primary_email), primary_phone: tv(existing?.primary_phone) },
  })

  function handleEditClick() {
    reset({ primary_email: tv(existing?.primary_email), primary_phone: tv(existing?.primary_phone) })
    setServerError('')
    setEditing(true)
  }

  function handleCancel() {
    reset()
    setEditing(false)
    setServerError('')
  }

  async function onSubmit(data: ContactData) {
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { setEditing(false); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <SectionCard title="Contact Information" editing={editing} onEditClick={handleEditClick}>
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
          <Field label="Primary Email" value={existing?.primary_email} />
          <Field label="Primary Phone" value={existing?.primary_phone} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary_email">Primary Email</Label>
              <Input id="primary_email" type="email" placeholder="you@example.com" {...register('primary_email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_phone">Primary Phone</Label>
              <Input id="primary_phone" type="tel" placeholder="(555) 000-0000" {...register('primary_phone')} />
            </div>
          </div>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Dates
// ══════════════════════════════════════════════════════════════════════════════

const datesSchema = z.object({
  date_of_birth: z.string().optional(),
  sunset_date:   z.string().optional(),
})
type DatesData = z.infer<typeof datesSchema>

function DatesSection({
  existing,
  onSaved,
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<DatesData>({
    resolver: zodResolver(datesSchema),
    defaultValues: { date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date) },
  })

  function handleEditClick() {
    reset({ date_of_birth: tv(existing?.date_of_birth), sunset_date: tv(existing?.sunset_date) })
    setServerError('')
    setEditing(true)
  }

  function handleCancel() {
    reset()
    setEditing(false)
    setServerError('')
  }

  async function onSubmit(data: DatesData) {
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { setEditing(false); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <SectionCard title="Dates" editing={editing} onEditClick={handleEditClick}>
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
          <Field label="Date of Birth" value={formatDate(existing?.date_of_birth)} />
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Sunset Date</p>
            <p className="text-sm">
              {formatDate(existing?.sunset_date) || (
                <span className="text-muted-foreground/40 italic text-xs">Living</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sunset_date">Sunset Date</Label>
              <Input id="sunset_date" type="date" {...register('sunset_date')} />
              <p className="text-xs text-muted-foreground">Leave blank if living.</p>
            </div>
          </div>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — T-Shirt Size
// ══════════════════════════════════════════════════════════════════════════════

const tshirtSchema = z.object({
  tshirt_category: z.string().optional(),
  tshirt_size:     z.string().optional(),
})
type TshirtData = z.infer<typeof tshirtSchema>

function TshirtSection({
  existing,
  onSaved,
}: {
  existing: PersonalInfoRecord | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [serverError, setServerError] = useState('')

  const { handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<TshirtData>({
    resolver: zodResolver(tshirtSchema),
    defaultValues: { tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size) },
  })

  const selectedCategory = watch('tshirt_category') as TshirtCategory | ''
  const availableSizes   = selectedCategory && selectedCategory in TSHIRT_SIZES ? TSHIRT_SIZES[selectedCategory as TshirtCategory] : []

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('tshirt_category', e.target.value)
    setValue('tshirt_size', '')
  }

  function handleEditClick() {
    reset({ tshirt_category: tv(existing?.tshirt_category), tshirt_size: tv(existing?.tshirt_size) })
    setServerError('')
    setEditing(true)
  }

  function handleCancel() {
    reset()
    setEditing(false)
    setServerError('')
  }

  async function onSubmit(data: TshirtData) {
    setServerError('')
    const result = await saveProfileSection(data)
    if (result.success) { setEditing(false); onSaved() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  const shirtDisplay = existing?.tshirt_category && existing?.tshirt_size
    ? `${existing.tshirt_category} — ${existing.tshirt_size}`
    : null

  return (
    <SectionCard title="T-Shirt Size" editing={editing} onEditClick={handleEditClick}>
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
          <Field label="Category" value={existing?.tshirt_category} />
          <Field label="Size"     value={existing?.tshirt_size} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_category">Category</Label>
              <Select id="tshirt_category" value={selectedCategory} onChange={handleCategoryChange}>
                <option value="">— Select —</option>
                {TSHIRT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tshirt_size">Size</Label>
              <Select
                id="tshirt_size"
                disabled={availableSizes.length === 0}
                value={watch('tshirt_size') ?? ''}
                onChange={e => setValue('tshirt_size', e.target.value)}
              >
                <option value="">— Select —</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              {availableSizes.length === 0 && (
                <p className="text-xs text-muted-foreground">Select a category first.</p>
              )}
            </div>
          </div>
          <FormActions isSubmitting={isSubmitting} onCancel={handleCancel} error={serverError} />
        </form>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Root export — composes all five sections
// ══════════════════════════════════════════════════════════════════════════════

export function PersonalInfoForm({ existing }: { existing: PersonalInfoRecord | null }) {
  const router = useRouter()
  function handleSaved() { router.refresh() }

  return (
    <div className="space-y-5">
      <ProfileSection  existing={existing} onSaved={handleSaved} />
      <AddressSection  existing={existing} onSaved={handleSaved} />
      <ContactSection  existing={existing} onSaved={handleSaved} />
      <DatesSection    existing={existing} onSaved={handleSaved} />
      <TshirtSection   existing={existing} onSaved={handleSaved} />
    </div>
  )
}
