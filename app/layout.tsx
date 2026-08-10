import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/brand'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // `template` suffixes every child segment's title, so a page declares only its
  // own name: `title: 'Dashboard'` renders `Dashboard — GENORRA`. `default` is
  // required alongside a template, and covers routes that declare no title at all.
  // Note the template does NOT apply to this segment — hence `default` carrying
  // the bare name for `/`.
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
