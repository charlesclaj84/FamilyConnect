import { HELP_PARTS, type HelpBlock, type HelpChapter, type HelpPart } from '@/lib/help/content'
import type { Catalogue, T } from '@/lib/i18n/t'

/**
 * The manual's translation keys, and the English catalogue DERIVED from `content.ts`.
 *
 * ── WHY THE ENGLISH IS DERIVED AND NOT WRITTEN OUT AGAIN ────────────────────────────
 * `lib/help/content.ts` is the manual: 43 chapters, 1,497 strings, and the one place a person
 * edits when a screen changes. Copying all of it into a hand-written `helpEn` would create a
 * second manual to keep in step — and AGENTS.md's rule about the help manual is that a change
 * to a screen owes an edit to the chapter, in the same commit. Two Englishes would mean that
 * edit had to land twice, and `help:check` cannot see the second one.
 *
 * So the English catalogue is BUILT from the content tree at module load. `content.ts` stays
 * exactly what it was — the source, the structure, and the prose — and the translations are
 * catalogues keyed against it.
 *
 * The payoff is that `i18n:check`'s STALE detection works on the manual for free: edit an
 * English paragraph and the fingerprint for that key changes, so every translation of it is
 * reported by name. Nothing else could have told you.
 *
 * ── THE KEYS ARE STRUCTURAL, WHICH MAKES THEM STABLE AND FRAGILE IN ONE WAY ─────────
 *
 *     help.part.<partId>.title / .blurb
 *     help.<slug>.title / .summary
 *     help.<slug>.<sectionId>.heading
 *     help.<slug>.<sectionId>.b<n>              a text or note block
 *     help.<slug>.<sectionId>.b<n>.i<m>         one item of a steps or bullets block
 *     help.<slug>.<sectionId>.b<n>.i<m>.term    a definition's term
 *     help.<slug>.<sectionId>.b<n>.i<m>.text    a definition's body
 *
 * `slug` and `sectionId` are already stable — they are the URL and the anchor, and `help:check`
 * asserts both. The BLOCK INDEX is not: inserting a paragraph in the middle of a section
 * renumbers every block after it, so every translation of those blocks is reported STALE and has
 * to be re-checked. That is the correct behaviour and it is also the reason to APPEND rather than
 * insert where the prose allows it.
 *
 * A key nothing translates falls back to the English through `translate`, so a partly translated
 * manual reads as a mostly-Spanish chapter with an English paragraph in it rather than failing.
 */

export function partKey(part: HelpPart, field: 'title' | 'blurb'): string {
  return `help.part.${part.id}.${field}`
}

export function chapterKey(slug: string, field: 'title' | 'summary'): string {
  return `help.${slug}.${field}`
}

export function sectionKey(slug: string, sectionId: string): string {
  return `help.${slug}.${sectionId}.heading`
}

export function blockKey(slug: string, sectionId: string, index: number): string {
  return `help.${slug}.${sectionId}.b${index}`
}

/** Every string in the manual, keyed. Used to derive English and to localize a chapter. */
function walkBlock(
  base: string,
  block: HelpBlock,
  emit: (key: string, value: string) => void,
): void {
  if (block.kind === 'text' || block.kind === 'note') {
    emit(base, block.text)
    return
  }
  if (block.kind === 'steps' || block.kind === 'bullets') {
    block.items.forEach((item, i) => emit(`${base}.i${i}`, item))
    return
  }
  if (block.kind === 'defs') {
    block.items.forEach((d, i) => {
      emit(`${base}.i${i}.term`, d.term)
      emit(`${base}.i${i}.text`, d.text)
    })
  }
}

/**
 * The English catalogue, read out of the content tree.
 *
 * Built once at module load. It is a plain object of ~1,500 entries — the same order of magnitude
 * as the shell catalogue, and it never ships to a browser: `lib/help/strings/index.ts` is
 * `server-only` and the manual is rendered on the server.
 */
export function deriveHelpEnglish(): Catalogue {
  const out: Catalogue = {}
  const emit = (key: string, value: string) => { out[key] = value }
  for (const part of HELP_PARTS) {
    emit(partKey(part, 'title'), part.title)
    emit(partKey(part, 'blurb'), part.blurb)
    for (const chapter of part.chapters) {
      emit(chapterKey(chapter.slug, 'title'), chapter.title)
      emit(chapterKey(chapter.slug, 'summary'), chapter.summary)
      for (const section of chapter.sections) {
        emit(sectionKey(chapter.slug, section.id), section.heading)
        section.blocks.forEach((block, i) => {
          walkBlock(blockKey(chapter.slug, section.id, i), block, emit)
        })
      }
    }
  }
  return out
}

/**
 * One chapter with every string swapped for the reader's.
 *
 * Returns the SAME SHAPE, so `HelpBlocks` and the three pages that render a chapter are
 * unchanged — the localization happens once, above them, rather than at every leaf. A key with
 * no translation resolves to the English through `translate`, which is why this can be applied
 * unconditionally and why a half-translated chapter still renders.
 */
export function localizeChapter(chapter: HelpChapter, t: T): HelpChapter {
  return {
    ...chapter,
    title: t(chapterKey(chapter.slug, 'title')),
    summary: t(chapterKey(chapter.slug, 'summary')),
    sections: chapter.sections.map(section => ({
      ...section,
      heading: t(sectionKey(chapter.slug, section.id)),
      blocks: section.blocks.map((block, i) =>
        localizeBlock(block, blockKey(chapter.slug, section.id, i), t)),
    })),
  }
}

function localizeBlock(block: HelpBlock, base: string, t: T): HelpBlock {
  if (block.kind === 'text' || block.kind === 'note') {
    return { ...block, text: t(base) }
  }
  if (block.kind === 'steps' || block.kind === 'bullets') {
    return { ...block, items: block.items.map((_, i) => t(`${base}.i${i}`)) }
  }
  if (block.kind === 'defs') {
    return {
      ...block,
      items: block.items.map((_, i) => ({
        term: t(`${base}.i${i}.term`),
        text: t(`${base}.i${i}.text`),
      })),
    }
  }
  return block
}

/** One part, with its own two strings and every chapter under it localized. */
export function localizePart(part: HelpPart, t: T): HelpPart {
  return {
    ...part,
    title: t(partKey(part, 'title')),
    blurb: t(partKey(part, 'blurb')),
    chapters: part.chapters.map(chapter => localizeChapter(chapter, t)),
  }
}
