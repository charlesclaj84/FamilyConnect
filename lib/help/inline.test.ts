import { describe, expect, it } from 'vitest'
import { parseInline, stripInline } from './inline'

/**
 * The cases that are not obvious from reading the regex, per AGENTS.md §7b.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL, and this suite was checked
 * that way: making either alternative greedy (`[^*]+` -> `.+`) trips "two bold runs" and
 * "bold either side of a link"; dropping the `\s)` exclusion from the href trips "a link
 * inside parentheses"; and removing the trailing-tail push trips every case whose string
 * does not end in markup.
 */

describe('parseInline', () => {
  it('returns nothing for an empty string', () => {
    expect(parseInline('')).toEqual([])
  })

  it('passes plain prose through as one run', () => {
    expect(parseInline('Open the rail.')).toEqual([{ kind: 'text', text: 'Open the rail.' }])
  })

  it('keeps the whitespace around a token', () => {
    expect(parseInline('press **Save** now')).toEqual([
      { kind: 'text', text: 'press ' },
      { kind: 'strong', text: 'Save' },
      { kind: 'text', text: ' now' },
    ])
  })

  it('handles markup at both ends with no surrounding text', () => {
    expect(parseInline('**Save**')).toEqual([{ kind: 'strong', text: 'Save' }])
  })

  it('keeps two bold runs separate', () => {
    expect(parseInline('**one** and **two**')).toEqual([
      { kind: 'strong', text: 'one' },
      { kind: 'text', text: ' and ' },
      { kind: 'strong', text: 'two' },
    ])
  })

  it('reads a link', () => {
    expect(parseInline('see [Directory](/community/directory) for names')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'link', text: 'Directory', href: '/community/directory' },
      { kind: 'text', text: ' for names' },
    ])
  })

  it('reads bold either side of a link', () => {
    expect(parseInline('**A** [B](/b) **C**')).toEqual([
      { kind: 'strong', text: 'A' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'B', href: '/b' },
      { kind: 'text', text: ' ' },
      { kind: 'strong', text: 'C' },
    ])
  })

  it('does not let a link swallow a closing parenthesis of its own sentence', () => {
    expect(parseInline('(open [Chat](/community/chat) first)')).toEqual([
      { kind: 'text', text: '(open ' },
      { kind: 'link', text: 'Chat', href: '/community/chat' },
      { kind: 'text', text: ' first)' },
    ])
  })

  it('leaves a bracket that is not a link alone', () => {
    expect(parseInline('the [old] way')).toEqual([{ kind: 'text', text: 'the [old] way' }])
  })

  it('leaves unterminated bold as literal text rather than throwing', () => {
    expect(parseInline('a ** b')).toEqual([{ kind: 'text', text: 'a ** b' }])
  })

  it('carries a query string in an href', () => {
    expect(parseInline('[Dues](/accounting/dues?from=summary)')).toEqual([
      { kind: 'link', text: 'Dues', href: '/accounting/dues?from=summary' },
    ])
  })
})

describe('stripInline', () => {
  it('drops every marker and keeps the sentence readable', () => {
    expect(stripInline('press **Save** on [Settings](/admin/settings)'))
      .toBe('press Save on Settings')
  })

  it('is a no-op on plain prose', () => {
    expect(stripInline('nothing to strip')).toBe('nothing to strip')
  })
})
