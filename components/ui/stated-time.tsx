import { formatTime } from '@/lib/date-utils'
import { instantAt, sameClock, timeIn, zoneAbbrev } from '@/lib/tz'

/**
 * A wall-clock time as the family stated it, with the reader's own equivalent underneath.
 *
 * ── THE DISPLAY RULE, IN ONE COMPONENT SO TWO SURFACES CANNOT DIVERGE ───────────────
 * `20260826000003`'s header sets it out and it has two halves that must stay in this order:
 *
 *     11:00 AM CDT          <- what the family said. Always shown. NEVER converted.
 *     1:00 PM your time     <- secondary, attributed, and only when the zones differ.
 *
 * Inverting them — the viewer's time large, the stated time small — is the thing that rule
 * forbids, because two relatives on a telephone would then be reading different numbers off the
 * same screen with nothing saying which is the real one. So the stated time is the text and the
 * local reading is a muted line beneath it, and that relationship is fixed here rather than
 * left to each caller.
 *
 * ── THE SECOND LINE IS ABSENT, NOT EMPTY, WHENEVER IT WOULD SAY NOTHING ─────────────
 * Three cases, and all three are silence rather than a dash:
 *
 *   no stated zone       a row written before 20260826000003. There is nothing to compare the
 *                        reader against, and guessing Central would invent the fact.
 *   the same clock       `sameClock` compares the OFFSET at that moment, not the zone name —
 *                        so a member in Winnipeg reading a Chicago gathering is not told their
 *                        own time twice. Two zones can agree in January and differ in July,
 *                        which is why it takes the day.
 *   no time at all       "the reunion is on 4 July" is a complete answer.
 *
 * ── AND IT IS COMPUTED FROM AN INSTANT BUILT OUT OF THE LABEL ───────────────────────
 * This is the one place in the product that deliberately turns a wall-clock label INTO an
 * instant, and it is admissible because the result is thrown away after being rendered as a
 * secondary line — the stored label is untouched and is still what the screen leads with. The
 * instant is `<day>T<time>` interpreted IN THE STATED ZONE, which is what makes "1:00 PM your
 * time" the right answer rather than an offset applied to a naive date.
 */
export function StatedTime({ day, time, endTime, zone, readerZone }: {
  /** `YYYY-MM-DD` — the day the time falls on, which decides the DST answer. */
  day: string
  /** `HH:MM`, or null. Null renders nothing at all. */
  time: string | null
  /** `HH:MM`, or null. */
  endTime?: string | null
  /** The zone the times were STATED in. Null renders the times with no suffix. */
  zone: string | null
  /** The reader's own zone, for the secondary line. */
  readerZone: string
}) {
  if (!time) return null

  const stated = endTime
    ? `${formatTime(time)} – ${formatTime(endTime)}`
    : formatTime(time)

  if (!zone) return <span>{stated}</span>

  // Midday-agnostic: the instant is built from the actual time on the actual day, because the
  // whole point is to convert THAT moment. `Date.UTC` then `AT TIME ZONE`-style correction is
  // not available in JS, so the instant is found by asking what the stated zone reads at a
  // candidate UTC moment and correcting once — accurate to the minute for every real offset.
  const at = instantAt(day, time, zone)
  const abbrev = zoneAbbrev(zone, at)
  const differs = !sameClock(zone, readerZone, at)

  return (
    <span className="inline-flex flex-col">
      <span>{abbrev ? `${stated} ${abbrev}` : stated}</span>
      {differs && (
        <span className="text-xs text-muted-foreground">
          {formatTime(timeIn(at, readerZone))} your time
        </span>
      )}
    </span>
  )
}
