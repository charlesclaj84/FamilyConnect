'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, ArrowUpCircle, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { Card, CardContent } from '@/components/ui/card'
import {
  addChild,
  updateChild,
  deleteChild,
  convertChildToAdult,
  acceptSpouseChild,
  type ChildRecord,
  type ChildInput,
  type SpouseChildRecord,
} from '@/app/actions/children'
import { CHILD_RELATIONSHIP_TYPES } from '@/lib/family-constants'
import { formatDate } from '@/lib/date-utils'
import { TSHIRT_CATEGORIES, TSHIRT_SIZES, type TshirtCategory } from '@/lib/tshirt-sizes'

// ── Schemas ────────────────────────────────────────────────────────────────────

const childSchema = z.object({
  first_name:        z.string().min(1, 'First name is required'),
  middle_name:       z.string().optional(),
  last_name:         z.string().min(1, 'Last name is required'),
  date_of_birth:     z.string().optional(),
  tshirt_category:   z.string().optional(),
  tshirt_size:       z.string().optional(),
  relationship_type: z.enum(CHILD_RELATIONSHIP_TYPES, { message: 'Please select a relationship' }),
  is_step:           z.boolean(),
})

const convertSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

type ChildFormData = z.infer<typeof childSchema>
type ConvertFormData = z.infer<typeof convertSchema>

// ── T-shirt double-dropdown ────────────────────────────────────────────────────

interface TshirtFieldsProps {
  category: string
  onCategoryChange: (val: string) => void
  sizeProps: React.ComponentProps<'select'>
}

function TshirtFields({ category, onCategoryChange, sizeProps }: TshirtFieldsProps) {
  const sizes = category in TSHIRT_SIZES ? TSHIRT_SIZES[category as TshirtCategory] : []
  return (
    <>
      <div className="space-y-1.5">
        <Label>T-Shirt Category</Label>
        <Select value={category} onChange={e => onCategoryChange(e.target.value)}>
          <option value="">— Select —</option>
          {TSHIRT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>T-Shirt Size</Label>
        <Select disabled={sizes.length === 0} {...sizeProps}>
          <option value="">— Select —</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
    </>
  )
}

// ── Shared child form fields ───────────────────────────────────────────────────

interface ChildFormFieldsProps {
  register: ReturnType<typeof useForm<ChildFormData>>['register']
  errors: ReturnType<typeof useForm<ChildFormData>>['formState']['errors']
  watch: ReturnType<typeof useForm<ChildFormData>>['watch']
  setValue: ReturnType<typeof useForm<ChildFormData>>['setValue']
  serverError: string
}

function ChildFormFields({ register, errors, watch, setValue, serverError }: ChildFormFieldsProps) {
  const category = watch('tshirt_category') ?? ''
  const isStep   = watch('is_step') ?? false

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>First Name <span className="text-destructive">*</span></Label>
          <Input {...register('first_name')} />
          {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Middle Name</Label>
          <Input {...register('middle_name')} />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name <span className="text-destructive">*</span></Label>
          <Input {...register('last_name')} />
          {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <Input type="date" {...register('date_of_birth')} />
        </div>
        <TshirtFields
          category={category}
          onCategoryChange={val => { setValue('tshirt_category', val); setValue('tshirt_size', '') }}
          sizeProps={register('tshirt_size')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Relationship <span className="text-destructive">*</span></Label>
          <Select {...register('relationship_type')}>
            <option value="">— Select —</option>
            {CHILD_RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          {errors.relationship_type && <p className="text-xs text-destructive">{errors.relationship_type.message}</p>}
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={isStep}
              onChange={e => setValue('is_step', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Step relationship
            <span className="text-xs text-muted-foreground">(e.g. Step-Son)</span>
          </label>
        </div>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </>
  )
}

// ── Add Child form ─────────────────────────────────────────────────────────────

function AddChildForm({ onDone }: { onDone: () => void }) {
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema),
    defaultValues: { first_name: '', middle_name: '', last_name: '', date_of_birth: '', tshirt_category: '', tshirt_size: '', relationship_type: undefined, is_step: false },
  })

  async function onSubmit(data: ChildFormData) {
    setServerError('')
    const result = await addChild(data as ChildInput)
    if (result.success) { reset(); onDone() }
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ChildFormFields register={register} errors={errors} watch={watch} setValue={setValue} serverError={serverError} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              <Check className="h-3.5 w-3.5" />
              {isSubmitting ? 'Saving…' : 'Save Child'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Inline Edit form ───────────────────────────────────────────────────────────

function EditChildForm({ child, onDone }: { child: ChildRecord; onDone: () => void }) {
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      first_name: child.first_name,
      middle_name: child.middle_name ?? '',
      last_name: child.last_name,
      date_of_birth: child.date_of_birth ?? '',
      tshirt_category: child.tshirt_category ?? '',
      tshirt_size: child.tshirt_size ?? '',
      relationship_type: child.relationship_type,
      is_step: child.is_step,
    },
  })

  const fullName = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ')

  async function onSubmit(data: ChildFormData) {
    const ok = await confirm({
      title: 'Save changes',
      description: `Apply your edits to ${fullName}'s record?`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setServerError('')
    const result = await updateChild(child.person_id, child.relationship_id, data as ChildInput)
    if (result.success) onDone()
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Card className="border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="pt-4">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Pencil className="h-3 w-3" /> Editing — {fullName}
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ChildFormFields register={register} errors={errors} watch={watch} setValue={setValue} serverError={serverError} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              <Check className="h-3.5 w-3.5" />
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Convert-to-Adult dialog ────────────────────────────────────────────────────

function ConvertDialog({ child, onClose }: { child: ChildRecord; onClose: () => void }) {
  const confirm = useConfirm()
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ConvertFormData>({
    resolver: zodResolver(convertSchema),
  })

  const fullName = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ')
  const label    = `${child.is_step ? 'Step-' : ''}${child.relationship_type}`

  async function onSubmit(data: ConvertFormData) {
    const ok = await confirm({
      title: 'Convert to adult',
      description: `Move ${fullName} to adult status and invite ${data.email}? This cannot be undone.`,
      confirmLabel: 'Convert',
    })
    if (!ok) return
    setServerError('')
    const result = await convertChildToAdult(child.person_id, data.email)
    if (result.success) { setDone(true); setTimeout(onClose, 1200) }
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Convert to Adult"
      description={`Moving ${fullName} (${label}) to adult status. An email address is required.`}
    >
      {done ? (
        <p className="text-sm text-primary py-2">{fullName} has been converted to adult status.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="convert-email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input id="convert-email" type="email" placeholder="adult@example.com" autoFocus {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Converting…' : 'Convert to Adult'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// ── Child row ──────────────────────────────────────────────────────────────────

function ChildRow({
  child,
  onEdit,
  onConvert,
  onRefresh,
}: {
  child: ChildRecord
  onEdit: () => void
  onConvert: () => void
  onRefresh: () => void
}) {
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(false)

  const fullName  = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ')
  const label     = `${child.is_step ? 'Step-' : ''}${child.relationship_type}`
  const dob       = child.date_of_birth
    ? formatDate(child.date_of_birth) ?? ''
    : '—'
  const shirt     = child.tshirt_category && child.tshirt_size ? `${child.tshirt_category} / ${child.tshirt_size}` : '—'
  const statusBadge = !child.is_minor
    ? <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Adult</span>
    : null
  const joinedBadge = child.has_account
    ? <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">Joined</span>
    : null

  async function handleDelete() {
    const ok = await confirm({
      title: 'Remove from your children',
      description: `Remove ${fullName} (${label}) from your children list? This cannot be undone.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    await deleteChild(child.person_id, child.relationship_id)
    onRefresh()
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b last:border-0">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="font-medium">{fullName}</p>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{label}</span>
          {statusBadge}
          {joinedBadge}
        </div>
        <p className="text-sm text-muted-foreground">Born: {dob} &middot; T-Shirt: {shirt}</p>
        {child.has_account && (
          <p className="text-xs text-muted-foreground">Has joined Family Connect — they manage their own profile.</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!child.has_account && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
        {child.is_minor && !child.has_account && (
          <Button size="sm" variant="outline" onClick={onConvert}>
            <ArrowUpCircle className="h-3.5 w-3.5" /> Convert to Adult
          </Button>
        )}
        <Button size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  )
}

// ── Accept spouse child row ────────────────────────────────────────────────────

function AcceptChildRow({ child, onRefresh }: { child: SpouseChildRecord; onRefresh: () => void }) {
  const confirm = useConfirm()
  const [accepting, setAccepting] = useState(false)
  const [relType, setRelType]     = useState<'Son' | 'Daughter'>(child.spouse_relationship_type as 'Son' | 'Daughter')
  const [isStep, setIsStep]       = useState(child.spouse_is_step)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const fullName = [child.first_name, child.last_name].filter(Boolean).join(' ')
  const dob      = child.date_of_birth
    ? formatDate(child.date_of_birth) ?? ''
    : 'DOB unknown'

  async function handleAccept() {
    const ok = await confirm({
      title: 'Add to your children',
      description: `Add ${fullName} to your children list as your ${isStep ? 'step-' : ''}${relType.toLowerCase()}?`,
      confirmLabel: 'Add',
    })
    if (!ok) return
    setLoading(true)
    setError('')
    const result = await acceptSpouseChild(child.person_id, relType, isStep)
    if (result.success) { onRefresh() }
    else { setError(result.message ?? 'Something went wrong'); setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-3 py-4 border-b last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{fullName}</p>
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending</span>
          </div>
          <p className="text-sm text-muted-foreground">Born: {dob}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Added by your spouse</p>
        </div>
        <Button size="sm" onClick={() => setAccepting(a => !a)}>
          <Check className="h-3.5 w-3.5" /> Accept as My Child
        </Button>
      </div>

      {accepting && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">They are my</p>
            <div className="flex gap-3">
              {(['Son', 'Daughter'] as const).map(val => (
                <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    value={val}
                    checked={relType === val}
                    onChange={() => setRelType(val)}
                    className="accent-primary"
                  />
                  {val}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isStep}
                onChange={e => setIsStep(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Step relationship
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={loading} onClick={handleAccept}>
              {loading ? 'Saving…' : `Confirm — ${isStep ? 'Step-' : ''}${relType}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAccepting(false)}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DirectLineageClient({
  initialChildren,
  spouseChildren = [],
}: {
  initialChildren: ChildRecord[]
  spouseChildren?: SpouseChildRecord[]
}) {
  const [showAddForm,   setShowAddForm]   = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [convertingChild, setConvertingChild] = useState<ChildRecord | null>(null)

  function refresh() { window.location.reload() }

  return (
    <div className="space-y-6">
      {initialChildren.length === 0 && !showAddForm ? (
        <p className="text-sm text-muted-foreground py-4">
          No children added yet. Use the button below to add your first child.
        </p>
      ) : (
        <div>
          {initialChildren.map(child =>
            editingId === child.person_id ? (
              <EditChildForm key={child.person_id} child={child} onDone={() => { setEditingId(null); refresh() }} />
            ) : (
              <ChildRow
                key={child.person_id}
                child={child}
                onEdit={() => setEditingId(child.person_id)}
                onConvert={() => setConvertingChild(child)}
                onRefresh={refresh}
              />
            )
          )}
        </div>
      )}

      {showAddForm ? (
        <AddChildForm onDone={() => { setShowAddForm(false); refresh() }} />
      ) : (
        <Button variant="outline" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Child
        </Button>
      )}

      {spouseChildren.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">Pending from Your Spouse</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {spouseChildren.length} pending
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Your spouse added these children. Accept each one to include them in your own tree.
          </p>
          <div className="rounded-lg border">
            <div className="px-4">
              {spouseChildren.map(child => (
                <AcceptChildRow key={child.person_id} child={child} onRefresh={refresh} />
              ))}
            </div>
          </div>
        </div>
      )}

      {convertingChild && (
        <ConvertDialog child={convertingChild} onClose={() => { setConvertingChild(null); refresh() }} />
      )}
    </div>
  )
}

