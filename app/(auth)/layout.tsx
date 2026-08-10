import Image from 'next/image'
import Link from 'next/link'
import { AuthNavButtons } from '@/components/auth/AuthNavButtons'
import { APP_NAME, APP_LOGO_ALT, APP_BANNER_ALT } from '@/lib/brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="border-b bg-brand-mist sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt={APP_LOGO_ALT} width={120} height={60} className="h-10 w-auto" />
            <span className="text-xl font-bold text-primary">{APP_NAME}</span>
          </Link>
          <AuthNavButtons />
        </div>
      </header>

      {/* Banner hero */}
      <div className="w-full flex justify-center bg-brand-navy-deep px-4 py-6">
        <Image
          src="/banner.png"
          alt={APP_BANNER_ALT}
          width={800}
          height={400}
          className="w-full max-w-2xl h-auto"
          priority
        />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  )
}
