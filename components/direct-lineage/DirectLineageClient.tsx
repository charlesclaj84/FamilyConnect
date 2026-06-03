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
import { Card, CardContent } from '@/components/ui/card'
import {
  addChild,
  updateChild,
  deleteChild,
  convertChildToAdult,
  type ChildRecord,
  type ChildInput,
} from '@/app/actions/children'
import { CHILD_RELATIONSHIP_TYPES } from '@/lib/family-constants'
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

  async function onSubmit(data: ChildFormData) {
    setServerError('')
    const result = await updateChild(child.person_id, child.relationship_id, data as ChildInput)
    if (result.success) onDone()
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Card className="border-border">
      <CardContent className="pt-4">
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
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ConvertFormData>({
    resolver: zodResolver(convertSchema),
  })

  const fullName = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ')
  const label    = `${child.is_step ? 'Step-' : ''}${child.relationship_type}`

  async function onSubmit(data: ConvertFormData) {
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
  const [deleting, setDeleting] = useState(false)

  const fullName  = [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ')
  const label     = `${child.is_step ? 'Step-' : ''}${child.relationship_type}`
  const dob       = child.date_of_birth
    ? new Date(child.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : '—'
  const shirt     = child.tshirt_category && child.tshirt_size ? `${child.tshirt_category} / ${child.tshirt_size}` : '—'
  const statusBadge = !child.is_minor
    ? <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Adult</span>
    : null

  async function handleDelete() {
    if (!confirm(`Remove ${fullName} from your children list?`)) return
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
        </div>
        <p className="text-sm text-muted-foreground">Born: {dob} &middot; T-Shirt: {shirt}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        {child.is_minor && (
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

// ── Main component ─────────────────────────────────────────────────────────────

export function DirectLineageClient({ initialChildren }: { initialChildren: ChildRecord[] }) {
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

      {convertingChild && (
        <ConvertDialog child={convertingChild} onClose={() => { setConvertingChild(null); refresh() }} />
      )}
    </div>
  )
}
