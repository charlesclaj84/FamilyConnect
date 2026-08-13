/**
 * A NON-FUNCTIONAL sketch of the pedigree layout the new Family Tree is being built
 * towards — three generations fanning left to right, the shape Ancestry draws.
 *
 * IT RENDERS NO DATA, DELIBERATELY, and every choice here is about making that
 * unmistakable rather than about hiding it:
 *
 *   * The cards are captioned with RELATIONSHIPS ("Mother", "Maternal Grandfather"),
 *     never with names. Placeholder names are the failure mode this avoids — a card
 *     reading "Martha Allen · 1948–2019" in a family portal is indistinguishable from a
 *     record, and somebody would reasonably report it as wrong data rather than as a
 *     mock-up.
 *   * Where a real card would carry dates there is a muted bar, so the card reads as a
 *     wireframe of a card. Same reason.
 *   * Nothing is a link or a button. There is no hover state and no cursor change,
 *     because a control that does nothing when pressed is worse than an obvious drawing.
 *
 * The diagram is `aria-hidden` and the page states in words what it is, which is the
 * honest arrangement: a screen reader is told the layout is a preview instead of being
 * walked through seven fictional relatives.
 *
 * ── GEOMETRY ────────────────────────────────────────────────────────────────────────
 * Absolutely positioned inside a fixed 600×344 box, and the numbers are computed rather
 * than eyeballed: generation N has 2^N cards, each column's card sits at the midpoint of
 * the two it connects to, and the elbow lines are three rectangles apiece (stub, spine,
 * stub). A flex/grid version was tried first and cannot do this — the parent's vertical
 * centre has to fall exactly between two children in the NEXT column, which is a
 * function of the whole subtree rather than of the row it sits in.
 *
 * THE `overflow-x-auto` IS SANCTIONED HERE. AGENTS.md bans sideways scroll on tables and
 * names exactly one exception — the family tree canvas — because a tree is a wide diagram
 * and panning it is the interaction rather than a fallback. This is that canvas.
 */

const CARD_W = 168
const CARD_H = 56
const CANVAS_W = 600
const CANVAS_H = 344

/** Column x offsets. The 48px gap between them is where the elbows live. */
const COL_X = [0, 216, 432]

interface Card {
  label: string
  /** Column index into COL_X. */
  col: number
  /** Vertical centre. The card is drawn CARD_H/2 above this. */
  cy: number
}

// Great-grandparents are deliberately absent. Four generations is 8 cards in the last
// column and either a 700px-tall canvas or cards too short to hold a caption — and the
// shape being previewed is already legible at three.
const CARDS: readonly Card[] = [
  { label: 'You', col: 0, cy: 172 },

  { label: 'Mother', col: 1, cy: 76 },
  { label: 'Father', col: 1, cy: 268 },

  { label: 'Maternal Grandmother', col: 2, cy: 28 },
  { label: 'Maternal Grandfather', col: 2, cy: 124 },
  { label: 'Paternal Grandmother', col: 2, cy: 220 },
  { label: 'Paternal Grandfather', col: 2, cy: 316 },
]

/** One parent joined to its two children: `from` is the parent's centre, `to` the pair. */
const LINKS: readonly { col: number; from: number; to: [number, number] }[] = [
  { col: 0, from: 172, to: [76, 268] },
  { col: 1, from: 76, to: [28, 124] },
  { col: 1, from: 268, to: [220, 316] },
]

function Elbow({ col, from, to }: { col: number; from: number; to: [number, number] }) {
  // The spine sits halfway across the gap, so both stubs are the same length.
  const right = COL_X[col] + CARD_W
  const spine = right + 24
  const next = COL_X[col + 1]

  return (
    <>
      {/* Parent's stub, out to the spine. */}
      <span aria-hidden="true" className="absolute bg-border" style={{ left: right, top: from, width: spine - right, height: 1 }} />
      {/* The spine. */}
      <span aria-hidden="true" className="absolute bg-border" style={{ left: spine, top: to[0], width: 1, height: to[1] - to[0] }} />
      {/* One stub per child, in to the card. */}
      {to.map(cy => (
        <span key={cy} aria-hidden="true" className="absolute bg-border" style={{ left: spine, top: cy, width: next - spine, height: 1 }} />
      ))}
    </>
  )
}

function PersonCard({ label, col, cy }: Card) {
  return (
    <div
      className="absolute flex items-center gap-2.5 rounded-lg border bg-card px-2.5 shadow-[var(--shadow-card)]"
      style={{ left: COL_X[col], top: cy - CARD_H / 2, width: CARD_W, height: CARD_H }}
    >
      {/* Where the photograph goes. Not an <Avatar> with initials — initials are data. */}
      <span className="h-7 w-7 shrink-0 rounded-full bg-muted" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{label}</span>
        {/* Where the birth–death line goes. */}
        <span className="mt-1 block h-1.5 w-16 rounded-full bg-muted" />
      </span>
    </div>
  )
}

export function PedigreePreview() {
  return (
    <div className="overflow-x-auto">
      <div aria-hidden="true" className="relative mx-auto" style={{ width: CANVAS_W, height: CANVAS_H }}>
        {LINKS.map(link => (
          <Elbow key={`${link.col}-${link.from}`} {...link} />
        ))}
        {CARDS.map(card => (
          <PersonCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}
