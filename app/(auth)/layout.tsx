import Image from 'next/image'
import Link from 'next/link'
import { AuthNavButtons } from '@/components/auth/AuthNavButtons'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="border-b bg-[#e6ecf1] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Family Connect" width={120} height={60} className="h-10 w-auto" />
            <span className="text-xl font-bold text-primary">Family Connect</span>
          </Link>
          <AuthNavButtons />
        </div>
      </header>

      {/* Banner hero */}
      <div className="w-full flex justify-center bg-[#011b43] px-4 py-6">
        <Image
          src="/banner.png"
          alt="Family Connect — Stronger Families. Closer Together."
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
