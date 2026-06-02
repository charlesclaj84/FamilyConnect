import { redirect } from 'next/navigation'
import { Calendar, MessageCircle, Camera, DollarSign, Store, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const features = [
  {
    title: 'Events',
    description: 'Plan and RSVP to upcoming family gatherings.',
    icon: <Calendar className="h-6 w-6" />,
  },
  {
    title: 'Chat',
    description: 'Message the whole family or create group conversations.',
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    title: 'Photos',
    description: 'Share and tag photos from family moments.',
    icon: <Camera className="h-6 w-6" />,
  },
  {
    title: 'Dues',
    description: 'Pay and track family dues and contributions.',
    icon: <DollarSign className="h-6 w-6" />,
  },
  {
    title: 'Vendors',
    description: 'Shop products and services from family-trusted vendors.',
    icon: <Store className="h-6 w-6" />,
  },
  {
    title: 'Directory',
    description: 'Browse and connect with all family members.',
    icon: <Users className="h-6 w-6" />,
  },
]

export const metadata = { title: 'Dashboard — Family Connect' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const firstName =
    user.user_metadata?.first_name ||
    user.email?.split('@')[0] ||
    'Member'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          Welcome back, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          Your family portal is ready. Features are being added — stay tuned.
        </p>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-xl font-semibold mb-5">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="relative opacity-70 cursor-not-allowed select-none"
            >
              <span className="absolute top-3 right-3 text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
