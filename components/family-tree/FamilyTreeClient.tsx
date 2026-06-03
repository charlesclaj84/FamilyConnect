'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { User, Pencil, Plus, Users, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { upsertAncestor, type AncestorEntry, type FamilyMember } from '@/app/actions/ancestors'
import { upsertSpouse, type SpouseEntry } from '@/app/actions/spouse'
import { SPOUSE_TYPES, type SpouseRelType } from '@/lib/family-constants'
import { type AncestorType } from '@/lib/family-constants'
import type { ChildRecord } from '@/app/actions/children'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatMember(m: FamilyMember) {
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || '(No name)'
  const dob  = m.date_of_birth ? m.date_of_birth : 'DOB unknown'
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
              ? 'bg-[#0f2540] text-[#e6ecfa] shadow-sm'
              : 'text-[#0f2540] hover:bg-[#0f2540]/10',
          )}
        >
          {m === 'select' ? 'Select Existing Person' : 'Add New Person'}
        </button>
      ))}
    </div>
  )
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
  existing_person_id:    z.string().min(1, 'Please select a person'),
  child_relationship_type: z.enum(['Son', 'Daughter']),
  child_is_step:         z.boolean(),
  is_step:               z.boolean(),
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
      existing_person_id:    '',
      child_relationship_type: 'Son',
      child_is_step:         false,
      is_step:               false,
    },
  })

  const isStepNew    = newForm.watch('is_step')
  const isStepSelect = selectForm.watch('is_step')
  const stepLabel    = (isStepNew || isStepSelect) ? `Step-${entry.relationship_type}` : entry.relationship_type

  async function onSubmitNew(data: NewFormData) {
    setServerError('')
    const result = await upsertAncestor({ relationship_type: entry.relationship_type, ...data })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  async function onSubmitSelect(data: SelectFormData) {
    setServerError('')
    const result = await upsertAncestor({
      relationship_type:      entry.relationship_type,
      is_step:                data.is_step,
      existing_person_id:     data.existing_person_id,
      child_relationship_type: isParent ? data.child_relationship_type : undefined,
      child_is_step:          isParent ? data.child_is_step : undefined,
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
            {selectForm.formState.errors.existing_person_id && (
              <p className="text-xs text-destructive">{selectForm.formState.errors.existing_person_id.message}</p>
            )}
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={selectForm.formState.isSubmitting} className="flex-1">
              {selectForm.formState.isSubmitting ? 'Saving…' : 'Link Person'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={newForm.handleSubmit(onSubmitNew)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="anc-first">First Name <span className="text-destructive">*</span></Label>
              <Input id="anc-first" autoFocus {...newForm.register('first_name')} />
              {newForm.formState.errors.first_name && (
                <p className="text-xs text-destructive">{newForm.formState.errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anc-last">Last Name <span className="text-destructive">*</span></Label>
              <Input id="anc-last" {...newForm.register('last_name')} />
              {newForm.formState.errors.last_name && (
                <p className="text-xs text-destructive">{newForm.formState.errors.last_name.message}</p>
              )}
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

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

// ── Spouse modal ───────────────────────────────────────────────────────────────

const spouseNewSchema = z.object({
  my_relationship_type: z.enum(['Husband', 'Wife', 'Partner']),
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  primary_email: z.string().optional(),
  date_of_birth: z.string().optional(),
  is_step:       z.boolean(),
})
type SpouseNewFormData = z.infer<typeof spouseNewSchema>

const spouseSelectSchema = z.object({
  existing_person_id:       z.string().min(1, 'Please select a person'),
  my_relationship_type:     z.enum(['Husband', 'Wife', 'Partner']),
  reverse_relationship_type: z.enum(['Husband', 'Wife', 'Partner']),
  is_step:                  z.boolean(),
})
type SpouseSelectFormData = z.infer<typeof spouseSelectSchema>

function EditSpouseModal({
  spouse,
  familyMembers,
  onClose,
}: {
  spouse: SpouseEntry | null
  familyMembers: FamilyMember[]
  onClose: () => void
}) {
  const [mode, setMode] = useState<'select' | 'create'>('create')
  const [serverError, setServerError] = useState('')
  const hasData = !!spouse
  const isValidated = !!spouse?.user_id

  const newForm = useForm<SpouseNewFormData>({
    resolver: zodResolver(spouseNewSchema),
    defaultValues: {
      my_relationship_type: (spouse?.relationship_type as SpouseRelType) ?? 'Husband',
      first_name:    spouse?.first_name    ?? '',
      last_name:     spouse?.last_name     ?? '',
      primary_email: spouse?.primary_email ?? '',
      date_of_birth: spouse?.date_of_birth ?? '',
      is_step:       spouse?.is_step       ?? false,
    },
  })

  const selectForm = useForm<SpouseSelectFormData>({
    resolver: zodResolver(spouseSelectSchema),
    defaultValues: {
      existing_person_id:       '',
      my_relationship_type:     'Husband',
      reverse_relationship_type: 'Wife',
      is_step:                  false,
    },
  })

  // Auto-suggest reverse type
  const myType = selectForm.watch('my_relationship_type')
  const suggestedReverse: SpouseRelType =
    myType === 'Husband' ? 'Wife' : myType === 'Wife' ? 'Husband' : 'Partner'

  async function onSubmitNew(data: SpouseNewFormData) {
    setServerError('')
    const result = await upsertSpouse({ ...data })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  async function onSubmitSelect(data: SpouseSelectFormData) {
    setServerError('')
    const result = await upsertSpouse({
      existing_person_id:       data.existing_person_id,
      my_relationship_type:     data.my_relationship_type,
      reverse_relationship_type: data.reverse_relationship_type,
      is_step:                  data.is_step,
    })
    if (result.success) onClose()
    else setServerError(result.message ?? 'Something went wrong')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={hasData ? 'Edit Spouse' : 'Add Spouse'}
      description="Link or add your spouse / partner."
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
            {selectForm.formState.errors.existing_person_id && (
              <p className="text-xs text-destructive">{selectForm.formState.errors.existing_person_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-first">First Name <span className="text-destructive">*</span></Label>
              <Input id="sp-first" autoFocus {...newForm.register('first_name')} />
              {newForm.formState.errors.first_name && (
                <p className="text-xs text-destructive">{newForm.formState.errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-last">Last Name <span className="text-destructive">*</span></Label>
              <Input id="sp-last" {...newForm.register('last_name')} />
              {newForm.formState.errors.last_name && (
                <p className="text-xs text-destructive">{newForm.formState.errors.last_name.message}</p>
              )}
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={newForm.formState.isSubmitting} className="flex-1">
              {newForm.formState.isSubmitting ? 'Saving…' : hasData ? 'Save Changes' : 'Add Spouse'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// ── Shared node components ─────────────────────────────────────────────────────

function AncestorNode({ entry, onClick }: { entry: AncestorEntry; onClick: () => void }) {
  const hasData = !!(entry.first_name || entry.last_name)
  const name    = hasData ? [entry.first_name, entry.last_name].filter(Boolean).join(' ') : null
  const label   = entry.is_step ? `Step-${entry.relationship_type}` : entry.relationship_type

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border px-3 py-3 min-w-[136px] text-center transition-all hover:ring-2 hover:ring-primary/40',
        hasData
          ? 'border-border bg-card shadow-sm'
          : 'border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground',
      )}
    >
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasData ? <Pencil className="h-3 w-3 text-muted-foreground" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
      </div>
      <User className="h-5 w-5 mb-1 opacity-50" />
      {hasData ? (
        <>
          <span className="text-sm font-medium leading-tight">{name}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
        </>
      ) : (
        <span className="text-xs">{label}</span>
      )}
    </button>
  )
}

function SpouseNode({ spouse, onClick }: { spouse: SpouseEntry | null; onClick: () => void }) {
  const hasData = !!spouse
  const name    = hasData ? [spouse.first_name, spouse.last_name].filter(Boolean).join(' ') : null
  const label   = spouse ? `${spouse.is_step ? 'Step-' : ''}${spouse.relationship_type}` : 'Spouse'

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border px-3 py-3 min-w-[136px] text-center transition-all hover:ring-2 hover:ring-primary/40',
        hasData
          ? 'border-border bg-card shadow-sm'
          : 'border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground',
      )}
    >
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasData ? <Pencil className="h-3 w-3 text-muted-foreground" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
      </div>
      <Heart className="h-5 w-5 mb-1 opacity-50" />
      {hasData ? (
        <>
          <span className="text-sm font-medium leading-tight">{name}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
        </>
      ) : (
        <span className="text-xs">{label}</span>
      )}
    </button>
  )
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Connector() { return <div className="w-px h-6 bg-border mx-auto" /> }
function HConnector() { return <div className="h-px w-8 bg-border self-center" /> }

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

function PersonBox({ name, sublabel, highlight }: { name: string; sublabel: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border px-3 py-3 min-w-[136px] text-center',
      highlight ? 'ring-2 ring-primary' : 'border-border bg-card shadow-sm',
    )}>
      <User className="h-5 w-5 mb-1 opacity-50" />
      <span className="text-sm font-medium leading-tight">{name}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{sublabel}</span>
    </div>
  )
}

function KidBranch({ child }: { child: ChildRecord }) {
  const name  = [child.first_name, child.last_name].filter(Boolean).join(' ')
  const label = `${child.is_step ? 'Step-' : ''}${child.relationship_type}`
  return (
    <div className="flex flex-col items-center gap-1">
      <PersonBox name={name} sublabel={label} />
      <Connector />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 px-3 py-2 min-w-[136px] text-center text-muted-foreground/50">
        <Plus className="h-3.5 w-3.5 mb-0.5" />
        <span className="text-xs">Add grandchild</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ancestors: AncestorEntry[]
  children: ChildRecord[]
  displayName: string
  spouse: SpouseEntry | null
  familyMembers: FamilyMember[]
}

const GRANDPARENT_TYPES: AncestorType[] = [
  'Paternal Grandfather', 'Paternal Grandmother',
  'Maternal Grandfather', 'Maternal Grandmother',
]
const PARENT_TYPES: AncestorType[] = ['Father', 'Mother']

export function FamilyTreeClient({ ancestors, children, displayName, spouse, familyMembers }: Props) {
  const [editingEntry, setEditingEntry]   = useState<AncestorEntry | null>(null)
  const [editingSpouse, setEditingSpouse] = useState(false)

  const ancestorByType = useMemo(
    () => Object.fromEntries(ancestors.map(a => [a.relationship_type, a])),
    [ancestors],
  )

  function handleClose() {
    setEditingEntry(null)
    setEditingSpouse(false)
    window.location.reload()
  }

  const emptyAncestor = (type: AncestorType): AncestorEntry => ({
    relationship_type: type,
    relationship_id: null,
    person_id: null,
    is_step: false,
    user_id: null,
    first_name: null,
    last_name: null,
    primary_email: null,
    date_of_birth: null,
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Your Tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 py-4 overflow-x-auto">

            <RowLabel>Grandparents</RowLabel>
            <HGroup>
              {GRANDPARENT_TYPES.map(type => {
                const entry = ancestorByType[type] ?? emptyAncestor(type)
                return (
                  <AncestorNode key={type} entry={entry} onClick={() => setEditingEntry(entry)} />
                )
              })}
            </HGroup>

            <Connector />

            <RowLabel>Parents</RowLabel>
            <HGroup>
              {PARENT_TYPES.map(type => {
                const entry = ancestorByType[type] ?? emptyAncestor(type)
                return (
                  <AncestorNode key={type} entry={entry} onClick={() => setEditingEntry(entry)} />
                )
              })}
            </HGroup>

            <Connector />

            <RowLabel>You &amp; Spouse</RowLabel>
            <div className="flex items-center gap-0">
              <SpouseNode spouse={spouse} onClick={() => setEditingSpouse(true)} />
              <HConnector />
              <PersonBox name={displayName} sublabel="You" highlight />
            </div>

            <Connector />

            <RowLabel>Children</RowLabel>
            {children.length > 0 ? (
              <HGroup>
                {children.map(child => <KidBranch key={child.person_id} child={child} />)}
              </HGroup>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No children yet. Add them on the{' '}
                <Link href="/direct-lineage" className="text-primary hover:underline">
                  Direct Lineage
                </Link>{' '}
                page.
              </p>
            )}

          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        Click any node to add or edit. Use &ldquo;Select Existing Person&rdquo; to link someone already in your family.
      </p>

      {editingEntry && (
        <EditAncestorModal
          entry={editingEntry}
          familyMembers={familyMembers}
          onClose={handleClose}
        />
      )}

      {editingSpouse && (
        <EditSpouseModal
          spouse={spouse}
          familyMembers={familyMembers}
          onClose={handleClose}
        />
      )}
    </>
  )
}
