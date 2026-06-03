'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { User, Pencil, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { upsertAncestor, type AncestorEntry } from '@/app/actions/ancestors'
import { type AncestorType } from '@/lib/family-constants'
import type { ChildRecord } from '@/app/actions/children'

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  primary_email: z.string().optional(),
  date_of_birth: z.string().optional(),
  is_step:       z.boolean(),
})
type FormData = z.infer<typeof schema>

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditAncestorModal({
  entry,
  onClose,
}: {
  entry: AncestorEntry
  onClose: () => void
}) {
  const [serverError, setServerError] = useState('')
  const hasData = !!(entry.first_name || entry.last_name)

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name:    entry.first_name    ?? '',
      last_name:     entry.last_name     ?? '',
      primary_email: entry.primary_email ?? '',
      date_of_birth: entry.date_of_birth ?? '',
      is_step:       entry.is_step,
    },
  })

  const isStep = watch('is_step')
  const stepLabel = isStep
    ? `Step-${entry.relationship_type}`
    : entry.relationship_type

  async function onSubmit(data: FormData) {
    setServerError('')
    const result = await upsertAncestor({
      relationship_type: entry.relationship_type,
      ...data,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="anc-first">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input id="anc-first" autoFocus {...register('first_name')} />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anc-last">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input id="anc-last" {...register('last_name')} />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="anc-email">
            Email <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input id="anc-email" type="email" placeholder="email@example.com" {...register('primary_email')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="anc-dob">
            Date of Birth <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input id="anc-dob" type="date" {...register('date_of_birth')} />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={isStep}
            onChange={e => setValue('is_step', e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Step relationship
          {isStep && (
            <span className="text-xs text-muted-foreground ml-1">
              — displays as &ldquo;{stepLabel}&rdquo;
            </span>
          )}
        </label>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Saving…' : hasData ? 'Save Changes' : 'Add Person'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Ancestor node button ───────────────────────────────────────────────────────

function AncestorNode({
  entry,
  onClick,
}: {
  entry: AncestorEntry
  onClick: () => void
}) {
  const hasData = !!(entry.first_name || entry.last_name)
  const name  = hasData ? [entry.first_name, entry.last_name].filter(Boolean).join(' ') : null
  const label = entry.is_step
    ? `Step-${entry.relationship_type}`
    : entry.relationship_type

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
}

const GRANDPARENT_TYPES: AncestorType[] = [
  'Paternal Grandfather', 'Paternal Grandmother',
  'Maternal Grandfather', 'Maternal Grandmother',
]
const PARENT_TYPES: AncestorType[] = ['Father', 'Mother']

export function FamilyTreeClient({ ancestors, children, displayName }: Props) {
  const [editingEntry, setEditingEntry] = useState<AncestorEntry | null>(null)

  const ancestorByType = useMemo(
    () => Object.fromEntries(ancestors.map(a => [a.relationship_type, a])),
    [ancestors],
  )

  function handleClose() {
    setEditingEntry(null)
    window.location.reload()
  }

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
              {GRANDPARENT_TYPES.map(type => (
                <AncestorNode
                  key={type}
                  entry={ancestorByType[type] ?? { relationship_type: type, relationship_id: null, person_id: null, is_step: false, first_name: null, last_name: null, primary_email: null, date_of_birth: null }}
                  onClick={() => setEditingEntry(ancestorByType[type] ?? { relationship_type: type, relationship_id: null, person_id: null, is_step: false, first_name: null, last_name: null, primary_email: null, date_of_birth: null })}
                />
              ))}
            </HGroup>

            <Connector />

            <RowLabel>Parents</RowLabel>
            <HGroup>
              {PARENT_TYPES.map(type => (
                <AncestorNode
                  key={type}
                  entry={ancestorByType[type] ?? { relationship_type: type, relationship_id: null, person_id: null, is_step: false, first_name: null, last_name: null, primary_email: null, date_of_birth: null }}
                  onClick={() => setEditingEntry(ancestorByType[type] ?? { relationship_type: type, relationship_id: null, person_id: null, is_step: false, first_name: null, last_name: null, primary_email: null, date_of_birth: null })}
                />
              ))}
            </HGroup>

            <Connector />

            <RowLabel>You</RowLabel>
            <PersonBox name={displayName} sublabel="You" highlight />

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
        Click any ancestor node to add or edit their information. Use the Step checkbox to mark step relationships.
      </p>

      {editingEntry && (
        <EditAncestorModal entry={editingEntry} onClose={handleClose} />
      )}
    </>
  )
}
