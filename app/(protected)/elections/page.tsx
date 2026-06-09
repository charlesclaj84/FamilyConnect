import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllElections } from '@/app/actions/elections'
import { ChevronRight, Vote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Elections — Family Connect' }

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-700',
  nominations: 'bg-amber-100 text-amber-700',
  voting: 'bg-green-100 text-green-700',
  closed: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', nominations: 'Nominations Open', voting: 'Voting Open', closed: 'Closed',
}

export default async function ElectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const elections = await getAllElections()
  const active = elections.filter(e => e.status === 'nominations' || e.status === 'voting')
  const past = elections.filter(e => e.status === 'closed' || e.status === 'draft')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Elections</h1>
        <p className="text-muted-foreground">Participate in family officer elections.</p>
      </div>

      {elections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No elections scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Active</h2>
              <div className="space-y-3">
                {active.map(e => (
                  <Link key={e.id} href={`/elections/${e.id}`}>
                    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 hover:shadow-sm transition-shadow cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{e.title}</p>
                        {e.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.description}</p>}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past & Draft</h2>
              <div className="space-y-3">
                {past.map(e => (
                  <Link key={e.id} href={`/elections/${e.id}`}>
                    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer opacity-70">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{e.title}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
