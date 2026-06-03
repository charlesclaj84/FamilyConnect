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
          <Button className="bg-[#e6ecf1] text-[#0f2540] border border-[#0f2540] hover:opacity-80 gap-1.5">
            <User className="h-4 w-4" />
            Login
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
