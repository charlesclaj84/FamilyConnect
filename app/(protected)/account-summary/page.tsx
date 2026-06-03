import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, CheckCircle2, Clock, CreditCard } from 'lucide-react'

export const metadata = { title: 'Account Summary — Family Connect' }

function ComingSoonBadge() {
  return (
    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
      Coming Soon
    </span>
  )
}

function SummaryStatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function AccountSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Account Summary</h1>
        <p className="text-muted-foreground">
          View your dues history, outstanding balance, and make payments.
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <SummaryStatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Total Paid"
          value="$0.00"
          sub="No payments on record"
        />
        <SummaryStatCard
          icon={<Clock className="h-4 w-4" />}
          label="Amount Due"
          value="$0.00"
          sub="No outstanding balance"
        />
        <SummaryStatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Next Due Date"
          value="—"
          sub="No upcoming dues"
        />
      </div>

      {/* Payment history */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>All dues paid to date</CardDescription>
            </div>
            <ComingSoonBadge />
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">No payment history available yet.</p>
            <p className="text-xs mt-1">
              Dues tracking will be enabled when your family administrator sets up dues.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding dues */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Outstanding Dues</CardTitle>
              <CardDescription>Upcoming and overdue amounts</CardDescription>
            </div>
            <ComingSoonBadge />
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">No outstanding dues.</p>
          </div>
        </CardContent>
      </Card>

      {/* Make a payment */}
      <Card className="opacity-70">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Make a Payment
              </CardTitle>
              <CardDescription>
                Pay dues online once your family administrator enables payments.
              </CardDescription>
            </div>
            <ComingSoonBadge />
          </div>
        </CardHeader>
        <CardContent>
          <Button disabled className="cursor-not-allowed">
            Pay Now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
