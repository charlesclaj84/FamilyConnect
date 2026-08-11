'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AuthNavButtons() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-2">
      {pathname !== '/login' && (
        <Link href="/login">
          {/* Icon-only below sm — the same trim the landing header makes, so the two
              headers stay the same shape. The aria-label is what names it once the
              word is hidden. */}
          <Button variant="outline" size="icon" aria-label="Login" className="sm:w-auto sm:gap-1.5 sm:px-2.5">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Login</span>
          </Button>
        </Link>
      )}
      {pathname !== '/register' && (
        <Link href="/register">
          <Button>Get Started</Button>
        </Link>
      )}
    </div>
  )
}
