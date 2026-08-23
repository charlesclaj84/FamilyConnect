import type { FamilyTier } from '@/lib/tiers'

/**
 * ── THE LADDER'S HUES, DEFINED ONCE ─────────────────────────────────────────
 *
 * Growth, Heritage, Warmth, Legacy gold — the brand's own ramp, walked upward, so a
 * plan reads as a rung rather than as a row. `/pricing` climbs it on the plan cards
 * and `/features` climbs it on the tier bands, and the two are the same climb: a
 * visitor who has just read the pricing page should recognise Standard's burgundy and
 * Premium's gold on the catalogue without being told twice in words.
 *
 * ── EVERY PAIR IS A FILLED SURFACE, AND THAT IS NOT A STYLE CHOICE ──────────
 * Each `chip` is a `--brand-*` SURFACE with its measured `--brand-on-*` partner. The
 * tempting version — a 12% tint with the hue as the foreground — cannot be written
 * safely from one table: `--brand-primary` is Heritage-lift in dark and measures 2.46
 * on the dark card, under the 3:1 a meaningful icon owes, and `--brand-legacy` is
 * 2.30 on a cream one and can never carry a foreground at all. Filled, both are
 * correct in both themes by construction. See "Colours live in one place" in
 * AGENTS.md, and the note beside `--brand-legacy` in `app/globals.css`.
 *
 * `rail` is the same surface used as a bare band — a top edge on a card, a marker
 * under a heading. It carries no text, which is the one thing gold may always do.
 *
 * THERE IS NO FOREGROUND IN THIS TABLE, deliberately. Anything in a card that has to
 * be READ in a tier's colour uses `--brand-accent`, the one Warmth token that is a
 * foreground and the only one measured as such in both themes.
 */
export interface TierAccent {
  /** A filled chip: surface plus its measured `on-` partner. */
  chip: string
  /** The same surface as a bare band — a rail, a marker. Never behind text. */
  rail: string
}

/** Keyed by the rung's own name, for surfaces that choose a hue rather than a tier. */
export const ACCENTS = {
  affirm: { chip: 'bg-brand-affirm text-brand-on-affirm', rail: 'bg-brand-affirm' },
  primary: { chip: 'bg-brand-primary text-brand-on-primary', rail: 'bg-brand-primary' },
  warm: { chip: 'bg-brand-warm text-brand-on-warm', rail: 'bg-brand-warm' },
  legacy: { chip: 'bg-brand-legacy text-brand-on-legacy', rail: 'bg-brand-legacy' },
} as const satisfies Record<string, TierAccent>

export type AccentKey = keyof typeof ACCENTS

/**
 * The rung each plan stands on.
 *
 * A `Record<FamilyTier, …>` rather than a lookup with a fallback, so adding a fifth
 * tier to `lib/tiers.ts` is a TYPE ERROR here rather than a band that silently
 * renders in whatever the default was. That is the same property `TIER_LABEL` and
 * `TIER_PRICE` already have, and it is why a fourth tier could be inserted in the
 * middle in 2026-08-19 without anything downstream guessing.
 */
export const TIER_ACCENT: Record<FamilyTier, TierAccent> = {
  free: ACCENTS.affirm,
  standard: ACCENTS.primary,
  plus: ACCENTS.warm,
  premium: ACCENTS.legacy,
}
