'use client'

import { useMemo, useState, useTransition } from 'react'
import { UserCheck, X, Search, ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError } from '@/components/ui/form-message'
import type { UnlinkedPerson } from '@/app/actions/link-person'
import { linkPersonToCurrentUser } from '@/app/actions/link-person'
import { useT } from '@/components/layout/LocaleProvider'

interface Props {
  unlinkedPeople: UnlinkedPerson[]
}


export function LinkPersonBanner({ unlinkedPeople }: Props) {
  const confirm = useConfirm()
  const [dismissed, setDismissed] = useState(false)
  const t = useT()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState('')
  const [linkingId, setLinkingId] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unlinkedPeople
    return unlinkedPeople.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
    )
  }, [unlinkedPeople, search])

  const strongMatches = filtered.filter(p => p.isStrong)
  const others = filtered.filter(p => !p.isStrong)

  if (dismissed) return null

  async function handleLink(id: string) {
    const person = unlinkedPeople.find(p => p.id === id)
    const name = person ? `${person.first_name} ${person.last_name}` : 'this person'
    const ok = await confirm({
      title: t('dash.link.aria'),
      description: t('dash.link.confirm', { name }),
      confirmLabel: t('dash.link.action'),
    })
    if (!ok) return
    setError('')
    setLinkingId(id)
    startTransition(async () => {
      const result = await linkPersonToCurrentUser(id)
      if (result.success) {
        // Page revalidates and the banner data disappears.
        setDismissed(true)
      } else {
        setError(result.message)
        setLinkingId('')
      }
    })
  }

  function PersonCard({ person }: { person: UnlinkedPerson }) {
    const initials = [person.first_name[0], person.last_name[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase()
    const birthYear = person.date_of_birth
      ? new Date(person.date_of_birth).getFullYear()
      : null
    const isThisLinking = isPending && linkingId === person.id

    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        <Avatar initials={initials} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {person.first_name} {person.last_name}
            {birthYear ? <span className="text-muted-foreground font-normal"> · b. {birthYear}</span> : null}
            {person.is_minor ? <span className="text-muted-foreground font-normal"> · minor</span> : null}
          </p>
          {person.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {person.reasons.map(r => (
                <span
                  key={r}
                  className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-warm text-brand-on-warm"
                >
                  {t(`dash.link.match.${r}`)}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleLink(person.id)}
          disabled={isPending}
          className="shrink-0"
        >
          {isThisLinking ? t('dash.link.linking') : t('dash.link.thisIsMe')}
        </Button>
      </div>
    )
  }

  return (
    // Same banner shape as ChapterReminderBanner, and now the same roles: the resting
    // surface is `bg-brand-soft` under `text-brand-on-soft`, a checked pair in both
    // themes. That is why every `dark:` override here could go — the roles already
    // resolve per theme, so a `dark:` colour would only fight the token.
    <div className="rounded-xl border border-brand-legacy/50 bg-brand-soft p-4 flex gap-3">
      <div className="shrink-0 p-1.5 rounded-lg bg-brand-primary text-brand-on-primary self-start mt-0.5">
        <UserCheck className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-brand-on-soft">
            {t('dash.link.title')}
          </p>
          <p className="text-xs text-brand-on-soft/80 mt-0.5">{t('dash.familyMemberMayAlready')}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('dash.link.search')}
            className="pl-8 bg-background"
            disabled={isPending}
          />
        </div>

        {/* Strong matches — the records most likely to be the current user */}
        {strongMatches.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-brand-on-soft">
              {strongMatches.length === 1 ? t('dash.link.isThisYou') : t('dash.link.maybe')}
            </p>
            {strongMatches.map(p => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        )}

        {/* Everyone else — collapsed by default when there's already a strong match */}
        {others.length > 0 && (
          strongMatches.length > 0 && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-on-soft hover:opacity-80"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Don&apos;t see yourself? Browse everyone ({others.length})
            </button>
          ) : (
            <div className="space-y-2">
              {strongMatches.length > 0 && (
                <p className="text-xs font-semibold text-brand-on-soft">
                  {t('dash.link.everyoneElse')}
                </p>
              )}
              {others.map(p => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
          )
        )}

        {strongMatches.length === 0 && others.length === 0 && (
          <p className="text-xs text-brand-on-soft/80">{t('dash.link.none')}</p>
        )}

        <FieldError message={error} />
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 self-start text-brand-on-soft/70 hover:text-brand-on-soft transition-colors"
        aria-label={t('dash.dismiss')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
