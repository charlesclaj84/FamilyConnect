import type { Metadata } from 'next'
import { describeFeature } from '@/lib/features'
import { ComingSoonScreen } from '@/components/features/ComingSoon'

/**
 * Destination for the roadmap gate in `proxy.ts`. The gate rewrites (rather than
 * redirects) unshipped routes here, so the browser keeps showing the original
 * URL and `from` tells us which feature to name.
 */

interface Props {
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { from } = await searchParams
  const { label } = describeFeature(from ?? '')
  return { title: `${label} — Coming Soon — Family Connect` }
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const { from } = await searchParams
  const { label, blurb } = describeFeature(from ?? '')

  return <ComingSoonScreen label={label} blurb={blurb} />
}
