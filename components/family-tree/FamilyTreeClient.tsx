'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Pencil, Plus, Users, Heart, Info, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError, FormError } from '@/components/ui/form-message'
import {
  upsertAncestor,
  type AncestorEntry,
  type AncestorPerson,
  type AncestorRow,
  type DescendantNode,
  type PartnerGroup,
  type FamilyMember,
} from '@/app/actions/ancestors'
import type { MyRoleSummary } from '@/app/actions/admin/users'
import { formatRoleTitle } from '@/lib/role-utils'
import { formatDate } from '@/lib/date-utils'
import { upsertSpouse, type SpouseEntry } from '@/app/actions/spouse'
import { SPOUSE_TYPES, type SpouseRelType, type AncestorType } from '@/lib/family-constants'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatMember(m: FamilyMember) {
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || '(No name)'
  const dob  = m.date_of_birth ? (formatDate(m.date_of_birth) ?? 'DOB unknown') : 'DOB unknown'
  return `${name} — ${dob}`
}

function ModeToggle({ mode, onChange }: { mode: 'select' | 'create'; onChange: (m: 'select' | 'create') => void }) {
  return (
    <div className="flex rounded-lg border p-1 mb-4">
      {(['select', 'create'] as const).map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            mode === m
              ? 'bg-brand-primary text-brand-on-primary shadow-sm'
              : 'text-brand-ink hover:bg-brand-primary/10',
          )}
        >
          {m === 'select' ? 'Select Existing Person' : 'Add New Person'}
        </button>
      ))}
    </div>
  )
}

// Adapter: AncestorPerson → AncestorEntry (for EditAncestorModal compatibility)
function toAncestorEntry(person: AncestorPerson): AncestorEntry {
  return {
    relationship_type: person.relationship_type as AncestorType,
    relationship_id:   person.relationship_id,
    person_id:         person.person_id,
    is_step:           person.is_step,
    user_id:           person.user_id,
    first_name:        person.first_name,
    last_name:         person.last_name,
    primary_email:     person.primary_email,
    date_of_birth:     person.date_of_birth,
  }
}

// ── Ancestor modal ─────────────────────────────────────────────────────────────

const newSchema = z.object({
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  primary_email: z.string().optional(),
  date_of_birth: z.string().optional(),
  is_step:       z.boolean(),
})
type NewFormData = z.infer<typeof newSchema>

const selectSchema = z.object({
  existing_person_id:      z.string().min(1, 'Please select a person'),
  child_relationship_type: z.enum(['Son', 'Daughter']),
  child_is_step:           z.boolean(),
  is_step:                 z.boolean(),
})
type SelectFormData = z.infer<typeof selectSchema>

function EditAncestorModal({
  entry,
  familyMembers,
  onClose,
}: {
  entry: AncestorEntry
  familyMembers: FamilyMember[]
  onClose: () => void
}) {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'select' | 'create'>('create')
  const [serverError, setServerError] = useState('')
  const hasData = !!(entry.first_name || entry.last_name)
  const isParent = entry.relationship_type === 'Father' || entry.relationship_type === 'Mother'
  const isValidated = !!entry.user_id

  const newForm = useForm<NewFormData>({
    resolver: zodResolver(newSchema),
    defaultValues: {
      first_name:    entry.first_name    ?? '',
      last_name:     entry.last_name     ?? '',
      primary_email: entry.primary_email ?? '',
      date_of_birth: entry.date_of_birth ?? '',
      is_step:       entry.is_step,
    },
  })

  const selectForm = useForm<SelectFormData>({
    resolver: zodResolver(selectSchema),
    defaultValues: {
      existing_person_id:      '',
      child_relationship_type: 'Son',
      child_is_step:           false,
      is_step:                 false,
    },
  })

  const isStepNew    = newForm.watch('is_step')
  const isStepSelect = selectForm.watch('is_step')
  const stepLabel    = (isStepNew || isStepSelect) ? `Step-${entry.relationship_type}` : entry.relationship_type

  // Only an overwrite of an existing entry needs confirming — adding one for the
  // first time is not an edit.
  async function confirmOverwrite() {
    if (!hasData) return true
    return confirm({
      title: `Change ${entry.relationship_type}`,
      description: `Replace the ${entry.relationship_type} currently recorded (${[entry.first_name, entry.last_name].filter(Boolean).join(' ')}) with what you have entered?`,
      confirmLabel: 'Save changes',
    })
  }

  async function onSubmitNew(data: NewFormData) {
    if (!(await confirmOverwrite())) return
    setServerError('')
    const result = await upsertAncestor({ relationship_type: entry.relationship_type, ...data })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  async function onSubmitSelect(data: SelectFormData) {
    if (!(await confirmOverwrite())) return
    setServerError('')
    const result = await upsertAncestor({
      relationship_type:       entry.relationship_type,
      is_step:                 data.is_step,
      existing_person_id:      data.existing_person_id,
      child_relationship_type: isParent ? data.child_relationship_type : undefined,
      child_is_step:           isParent ? data.child_is_step : undefined,
    })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={hasData ? `Edit ${entry.relationship_type}` : `Add ${entry.relationship_type}`}
      description="Only name is required. The Step checkbox changes the displayed relationship label."
    >
      <ModeToggle mode={mode} onChange={m => { setMode(m); setServerError('') }} />

      {mode === 'select' ? (
        <form onSubmit={selectForm.handleSubmit(onSubmitSelect)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="anc-existing">Select person</Label>
            <select
              id="anc-existing"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...selectForm.register('existing_person_id')}
            >
              <option value="">— choose a family member —</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{formatMember(m)}</option>
              ))}
            </select>
            <FieldError message={selectForm.formState.errors.existing_person_id?.message} />
          </div>

          {isParent && (
            <div className="space-y-1.5">
              <Label>I am their…</Label>
              <div className="flex gap-3">
                {(['Son', 'Daughter'] as const).map(val => (
                  <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value={val}
                      {...selectForm.register('child_relationship_type')}
                      className="accent-primary"
                    />
                    {val}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm mt-1">
                <input
                  type="checkbox"
                  checked={selectForm.watch('child_is_step')}
                  onChange={e => selectForm.setValue('child_is_step', e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Step (e.g. Step-Son)
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={isStepSelect}
              onChange={e => selectForm.setValue('is_step', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Step relationship
            {isStepSelect && (
              <span className="text-xs text-muted-foreground ml-1">— displays as &ldquo;{stepLabel}&rdquo;</span>
            )}
          </label>

          <FormError message={serverError} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={selectForm.formState.isSubmitting} className="flex-1">
              {selectForm.formState.isSubmitting ? 'Saving…' : 'Link Person'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={newForm.handleSubmit(onSubmitNew)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="anc-first" required>First Name</Label>
              <Input id="anc-first" autoFocus {...newForm.register('first_name')} />
              <FieldError message={newForm.formState.errors.first_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anc-last" required>Last Name</Label>
              <Input id="anc-last" {...newForm.register('last_name')} />
              <FieldError message={newForm.formState.errors.last_name?.message} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anc-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="anc-email" type="email" placeholder="email@example.com" disabled={isValidated} {...newForm.register('primary_email')} />
            {isValidated && <p className="text-xs text-muted-foreground">Managed by the account holder.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anc-dob">Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="anc-dob" type="date" disabled={isValidated} {...newForm.register('date_of_birth')} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={isStepNew}
              onChange={e => newForm.setValue('is_step', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Step relationship
            {isStepNew && (
              <span className="text-xs text-muted-foreground ml-1">— displays as &ldquo;{stepLabel}&rdquo;</span>
            )}
          </label>

          <FormError message={serverError} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={newForm.formState.isSubmitting} className="flex-1">
              {newForm.formState.isSubmitting ? 'Saving…' : hasData ? 'Save Changes' : 'Add Person'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// ── Partner modal (add new OR edit existing) ───────────────────────────────────

const partnerNewSchema = z.object({
  my_relationship_type: z.enum(SPOUSE_TYPES),
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  primary_email: z.string().optional(),
  date_of_birth: z.string().optional(),
  is_step:       z.boolean(),
})
type PartnerNewFormData = z.infer<typeof partnerNewSchema>

const partnerSelectSchema = z.object({
  existing_person_id:        z.string().min(1, 'Please select a person'),
  my_relationship_type:      z.enum(SPOUSE_TYPES),
  reverse_relationship_type: z.enum(SPOUSE_TYPES),
  is_step:                   z.boolean(),
})
type PartnerSelectFormData = z.infer<typeof partnerSelectSchema>

function EditPartnerModal({
  partner,
  familyMembers,
  onClose,
}: {
  partner: SpouseEntry | null   // null = add new
  familyMembers: FamilyMember[]
  onClose: () => void
}) {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'select' | 'create'>('create')
  const [serverError, setServerError] = useState('')
  const isEditing = !!partner
  const isValidated = !!partner?.user_id

  const newForm = useForm<PartnerNewFormData>({
    resolver: zodResolver(partnerNewSchema),
    defaultValues: {
      my_relationship_type: (partner?.relationship_type as SpouseRelType) ?? 'Husband',
      first_name:    partner?.first_name    ?? '',
      last_name:     partner?.last_name     ?? '',
      primary_email: partner?.primary_email ?? '',
      date_of_birth: partner?.date_of_birth ?? '',
      is_step:       partner?.is_step       ?? false,
    },
  })

  const selectForm = useForm<PartnerSelectFormData>({
    resolver: zodResolver(partnerSelectSchema),
    defaultValues: {
      existing_person_id:        '',
      my_relationship_type:      'Husband',
      reverse_relationship_type: 'Wife',
      is_step:                   false,
    },
  })

  const myType = selectForm.watch('my_relationship_type')
  const suggestedReverse: SpouseRelType =
    myType === 'Husband' ? 'Wife'
    : myType === 'Wife' ? 'Husband'
    : myType === 'Ex-Husband' ? 'Ex-Wife'
    : myType === 'Ex-Wife' ? 'Ex-Husband'
    : 'Partner'

  // Adding a partner for the first time is a create; overwriting an existing one
  // is the edit that needs confirming.
  async function confirmOverwrite() {
    if (!partner) return true
    return confirm({
      title: `Change ${partner.relationship_type}`,
      description: `Replace the ${partner.relationship_type.toLowerCase()} currently recorded (${[partner.first_name, partner.last_name].filter(Boolean).join(' ')}) with what you have entered?`,
      confirmLabel: 'Save changes',
    })
  }

  async function onSubmitNew(data: PartnerNewFormData) {
    if (!(await confirmOverwrite())) return
    setServerError('')
    const result = await upsertSpouse({
      relationship_id: partner?.relationship_id,
      ...data,
    })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  async function onSubmitSelect(data: PartnerSelectFormData) {
    if (!(await confirmOverwrite())) return
    setServerError('')
    const result = await upsertSpouse({
      relationship_id:           partner?.relationship_id,
      existing_person_id:        data.existing_person_id,
      my_relationship_type:      data.my_relationship_type,
      reverse_relationship_type: data.reverse_relationship_type,
      is_step:                   data.is_step,
    })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  const title = isEditing
    ? `Edit ${partner.relationship_type}`
    : 'Add Partner'

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description="Link or add a spouse, partner, or ex-partner."
    >
      <ModeToggle mode={mode} onChange={m => { setMode(m); setServerError('') }} />

      {mode === 'select' ? (
        <form onSubmit={selectForm.handleSubmit(onSubmitSelect)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sp-existing">Select person</Label>
            <select
              id="sp-existing"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...selectForm.register('existing_person_id')}
            >
              <option value="">— choose a family member —</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{formatMember(m)}</option>
              ))}
            </select>
            <FieldError message={selectForm.formState.errors.existing_person_id?.message} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sp-my-type">They are my…</Label>
              <select
                id="sp-my-type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...selectForm.register('my_relationship_type')}
                onChange={e => {
                  selectForm.setValue('my_relationship_type', e.target.value as SpouseRelType)
                  selectForm.setValue('reverse_relationship_type', suggestedReverse)
                }}
              >
                {SPOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-rev-type">I am their…</Label>
              <select
                id="sp-rev-type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...selectForm.register('reverse_relationship_type')}
              >
                {SPOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={selectForm.watch('is_step')}
              onChange={e => selectForm.setValue('is_step', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Step relationship
          </label>

          <FormError message={serverError} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={selectForm.formState.isSubmitting} className="flex-1">
              {selectForm.formState.isSubmitting ? 'Saving…' : 'Link Person'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={newForm.handleSubmit(onSubmitNew)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sp-type">They are my…</Label>
            <select
              id="sp-type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...newForm.register('my_relationship_type')}
            >
              {SPOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sp-first" required>First Name</Label>
              <Input id="sp-first" autoFocus {...newForm.register('first_name')} />
              <FieldError message={newForm.formState.errors.first_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-last" required>Last Name</Label>
              <Input id="sp-last" {...newForm.register('last_name')} />
              <FieldError message={newForm.formState.errors.last_name?.message} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="sp-email" type="email" placeholder="email@example.com" disabled={isValidated} {...newForm.register('primary_email')} />
            {isValidated && <p className="text-xs text-muted-foreground">Managed by the account holder.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-dob">Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="sp-dob" type="date" disabled={isValidated} {...newForm.register('date_of_birth')} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={newForm.watch('is_step')}
              onChange={e => newForm.setValue('is_step', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Step relationship
          </label>

          <FormError message={serverError} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={newForm.formState.isSubmitting} className="flex-1">
              {newForm.formState.isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Partner'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Connector() { return <div className="w-px h-6 bg-border mx-auto" /> }

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </p>
  )
}

function HGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-4">{children}</div>
}

interface PersonBoxProps {
  name: string
  sublabel: string
  highlight?: boolean
  titles?: string[]
  isDashed?: boolean
  icon?: 'user' | 'heart'
  onClick?: () => void
  onEdit?: () => void
}

function PersonBox({ name, sublabel, highlight, titles = [], isDashed, icon = 'user', onClick, onEdit }: PersonBoxProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border px-3 py-3 min-w-[136px] text-center',
        highlight ? 'ring-2 ring-primary bg-card' : '',
        isDashed
          ? 'border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground'
          : 'border-border bg-card shadow-sm',
        onClick ? 'cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-all' : '',
      )}
      onClick={onClick}
    >
      {icon === 'heart'
        ? <Heart className="h-5 w-5 mb-1 opacity-50" />
        : <User className="h-5 w-5 mb-1 opacity-50" />
      }
      <span className={cn('text-sm font-medium leading-tight', isDashed && 'text-xs font-normal')}>{name}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{sublabel}</span>
      {titles.map((t, i) => (
        <span key={i} className="text-xs bg-brand-primary text-brand-on-primary px-1.5 py-0.5 rounded-full mt-0.5 leading-tight whitespace-nowrap">
          {t}
        </span>
      ))}
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted/60"
          // The tree renders one of these per person, so a bare "Edit" would announce
          // identically on every box on the canvas.
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      {isDashed && !onEdit && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// ── DescendantBranch (recursive) ───────────────────────────────────────────────

function DescendantBranch({
  node,
  memberRoles,
  onView,
}: {
  node: DescendantNode
  memberRoles: Record<string, string[]>
  onView: (personId: string) => void
}) {
  const name   = [node.first_name, node.last_name].filter(Boolean).join(' ') || 'Unknown'
  const label  = `${node.is_step ? 'Step-' : ''}${node.relationship_type}`
  const titles = node.user_id ? (memberRoles[node.user_id] ?? []) : []

  return (
    <div className="flex flex-col items-center gap-1">
      <PersonBox
        name={name}
        sublabel={label}
        titles={titles}
        onClick={() => onView(node.person_id)}
      />
      {node.children.length > 0 && (
        <>
          <Connector />
          <HGroup>
            {node.children.map(child => (
              <DescendantBranch
                key={child.person_id}
                node={child}
                memberRoles={memberRoles}
                onView={onView}
              />
            ))}
          </HGroup>
        </>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ancestorRows: AncestorRow[]
  partnerGroups: PartnerGroup[]
  displayName: string
  isViewMode: boolean
  viewSubjectName: string | null
  myPersonId: string | null
  subjectPersonId: string
  familyMembers: FamilyMember[]
  myRoles?: MyRoleSummary[]
  memberRoles?: Record<string, string[]>
}

export function FamilyTreeClient({
  ancestorRows,
  partnerGroups,
  displayName,
  isViewMode,
  viewSubjectName,
  myPersonId,
  subjectPersonId,
  familyMembers,
  myRoles = [],
  memberRoles = {},
}: Props) {
  const router = useRouter()
  const [editingAncestor, setEditingAncestor] = useState<AncestorEntry | null>(null)
  const [editingPartner, setEditingPartner]   = useState<SpouseEntry | null | 'new'>(null)

  function viewPersonTree(personId: string | null) {
    if (!personId) return
    if (personId === myPersonId) router.push('/family-tree')
    else router.push(`/family-tree?view=${personId}`)
  }

  function handleClose() {
    setEditingAncestor(null)
    setEditingPartner(null)
    router.refresh()
  }

  const sortedRows = [...ancestorRows].sort((a, b) => b.generation - a.generation)

  return (
    <>
      {/* View mode banner */}
      {isViewMode && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-brand-soft px-4 py-3 mb-4 text-sm text-brand-on-soft">
          <Info className="h-4 w-4 shrink-0" />
          <span>You are viewing <strong>{viewSubjectName ?? 'this member'}&apos;s</strong> tree.</span>
          <Link href="/family-tree" className="ml-auto flex items-center gap-1 font-medium hover:underline whitespace-nowrap">
            <ArrowLeft className="h-3.5 w-3.5" />
            View Your Tree
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {isViewMode ? `${viewSubjectName ?? 'Member'}'s Tree` : 'Your Tree'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 py-4 overflow-x-auto">

            {/* Dynamic ancestor rows (highest generation first) */}
            {sortedRows.map((row, rowIdx) => (
              <div key={row.generation} className="contents">
                <RowLabel>{row.label}</RowLabel>
                <HGroup>
                  {row.people.map((person, idx) => {
                    const name = person.is_placeholder
                      ? `Add ${person.relationship_label}`
                      : [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unknown'
                    const titles = person.user_id ? (memberRoles[person.user_id] ?? []) : []
                    return (
                      <PersonBox
                        key={person.person_id ?? `ph-${row.generation}-${idx}`}
                        name={name}
                        sublabel={person.relationship_label}
                        titles={titles}
                        isDashed={person.is_placeholder}
                        onClick={person.person_id ? () => viewPersonTree(person.person_id) : undefined}
                        onEdit={person.is_editable && !isViewMode && person.relationship_type
                          ? () => setEditingAncestor(toAncestorEntry(person))
                          : undefined}
                      />
                    )
                  })}
                </HGroup>
                {rowIdx < sortedRows.length - 1 || partnerGroups.length > 0 || !isViewMode ? (
                  <Connector />
                ) : null}
              </div>
            ))}

            {/* You + Partners row */}
            <RowLabel>{isViewMode ? (viewSubjectName ?? 'Member') : 'You'}</RowLabel>
            <HGroup>
              <PersonBox
                name={displayName}
                sublabel={isViewMode ? 'Viewing' : 'You'}
                highlight
                titles={myRoles.map(r => formatRoleTitle(r))}
                onClick={isViewMode && myPersonId ? () => viewPersonTree(myPersonId) : undefined}
              />
              {partnerGroups.map((group, idx) => group.partner && (
                <PersonBox
                  key={group.partner.person_id ?? `partner-${idx}`}
                  name={[group.partner.first_name, group.partner.last_name].filter(Boolean).join(' ') || 'Unknown'}
                  sublabel={`${group.partner.is_step ? 'Step-' : ''}${group.partner.relationship_type}`}
                  titles={group.partner.user_id ? (memberRoles[group.partner.user_id] ?? []) : []}
                  icon="heart"
                  onClick={group.partner.person_id ? () => viewPersonTree(group.partner!.person_id) : undefined}
                  onEdit={!isViewMode ? () => setEditingPartner(group.partner) : undefined}
                />
              ))}
              {!isViewMode && (
                <PersonBox
                  name={partnerGroups.length === 0 ? 'Add Spouse / Partner' : 'Add Partner'}
                  sublabel={partnerGroups.length === 0 ? 'Spouse, ex, partner…' : 'Another partner'}
                  isDashed
                  icon="heart"
                  onClick={() => setEditingPartner('new')}
                />
              )}
            </HGroup>

            {/* Children — grouped by partner when multiple groups have kids */}
            {(() => {
              const groupsWithKids = partnerGroups.filter(g => g.children.length > 0)
              if (groupsWithKids.length === 0) return null
              if (groupsWithKids.length === 1) {
                return (
                  <>
                    <Connector />
                    <HGroup>
                      {groupsWithKids[0].children.map(child => (
                        <DescendantBranch key={child.person_id} node={child} memberRoles={memberRoles} onView={viewPersonTree} />
                      ))}
                    </HGroup>
                  </>
                )
              }
              return groupsWithKids.map((group, idx) => {
                const partnerName = group.partner
                  ? [group.partner.first_name, group.partner.last_name].filter(Boolean).join(' ') || group.partner.relationship_type
                  : null
                return (
                  <div key={group.partner?.person_id ?? `unmatched-${idx}`} className="contents">
                    <Connector />
                    <RowLabel>{partnerName ? `With ${partnerName}` : 'Other children'}</RowLabel>
                    <HGroup>
                      {group.children.map(child => (
                        <DescendantBranch key={child.person_id} node={child} memberRoles={memberRoles} onView={viewPersonTree} />
                      ))}
                    </HGroup>
                  </div>
                )
              })
            })()}

          </div>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground text-center">
        {isViewMode
          ? 'Click any person to view their tree.'
          : 'Click any person to view their tree. Click a node\'s pencil icon to edit.'}
      </p>

      {editingAncestor && (
        <EditAncestorModal
          entry={editingAncestor}
          familyMembers={familyMembers}
          onClose={handleClose}
        />
      )}

      {editingPartner !== null && (
        <EditPartnerModal
          partner={editingPartner === 'new' ? null : editingPartner}
          familyMembers={familyMembers}
          onClose={handleClose}
        />
      )}
    </>
  )
}
