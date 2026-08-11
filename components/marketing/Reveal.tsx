'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades and lifts its children in when they scroll into view, once.
 *
 * For content BELOW the fold. Above-the-fold content is already on screen when
 * the page paints, so an intersection observer there either fires immediately
 * (pointless) or holds the hero invisible until React hydrates (harmful) — use
 * the CSS `gn-rise` stagger in `globals.css` for that instead.
 *
 * The observer disconnects after the first intersection: these are entrances,
 * not scroll-linked effects, and re-animating on every scroll-by is the thing
 * that makes this pattern feel cheap.
 *
 * REDUCED MOTION is handled in CSS rather than by branching on `matchMedia` in
 * the effect. Two reasons: reading the media query during render is a hydration
 * mismatch (the server cannot know it), and setting state synchronously in an
 * effect to correct it is a cascading render that React Compiler rejects. The
 * `motion-reduce:` utilities pin opacity and position regardless of state, so
 * someone who has asked for less motion simply sees the content.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-out will-change-transform',
        // Pinned on for reduced motion, whatever `visible` says.
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
