import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MessageCircle, Camera, DollarSign, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const features = [
  {
    title: 'Events',
    description: 'Plan and RSVP to family gatherings, reunions, and celebrations.',
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    title: 'Chat',
    description: 'Real-time messaging to stay in touch with the whole family.',
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    title: 'Photos',
    description: 'Upload and share memories, tag family members, build your archive.',
    icon: <Camera className="h-5 w-5" />,
  },
  {
    title: 'Dues',
    description: 'Collect and track family dues and contributions with ease.',
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    title: 'Vendors',
    description: 'Family-trusted vendors offering products and services to members.',
    icon: <Store className="h-5 w-5" />,
  },
  {
    title: 'Directory',
    description: 'A private directory to connect with all your family members.',
    icon: <Users className="h-5 w-5" />,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">Family Connect</span>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="w-full flex justify-center bg-white px-4 py-6">
        <Image
          src="/banner.png"
          alt="Family Connect — Stronger Families. Closer Together."
          width={800}
          height={400}
          className="w-full max-w-2xl h-auto"
          priority
        />
      </div>

      {/* Provides strip */}
      <div className="w-full flex justify-center bg-white px-4 pb-6">
        <Image
          src="/provides.png"
          alt="Connect. Plan. Celebrate."
          width={1200}
          height={200}
          className="w-full max-w-3xl h-auto"
          priority
        />
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-b from-accent/40 to-background py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            Private &amp; Secure for Your Family
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Stay Connected With<br className="hidden sm:block" /> Your Family
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            The all-in-one portal to plan events, share memories, and keep your family close — no matter the distance.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Join Your Family
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Everything Your Family Needs
            </h2>
            <p className="text-muted-foreground">
              Powerful features designed for large families — all in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="relative">
                <span className="absolute top-3 right-3 text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-4 bg-gradient-to-b from-accent/40 to-background">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to connect?</h2>
          <p className="mb-8 text-muted-foreground">
            Create your free account and bring your family together.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-base px-8">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Family Connect</span>
          <span>Keeping families together.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
