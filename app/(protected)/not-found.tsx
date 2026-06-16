import Link from 'next/link'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

// Rendered for unmatched routes (or notFound() calls) within the protected
// area — keeps the user inside the app chrome with a clear way back.
export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/dashboard" className={buttonVariants() + ' justify-center'}>
        Back to dashboard
      </Link>
    </div>
  )
}
