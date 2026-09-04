import io

# ── 1. The narrow prop, back on the dialog ─────────────────────────────────────────
p = 'components/family-tree/PersonRecordDialog.tsx'
s = io.open(p, encoding='utf-8').read()

s = s.replace(
    "  editPersonRecord, invitePersonRecord, setPersonBloodline,",
    "  editPersonRecord, invitePersonRecord, setPersonBloodline, setRelationshipType,")

s = s.replace(
    "  open, onClose, person, name,\n}: {",
    """  open, onClose, person, name, spouses = [],
}: {""")

s = s.replace(
    """  /** The disambiguated name, so two Martha Allens are told apart in the title. */
  name: string""",
    """  /** The disambiguated name, so two Martha Allens are told apart in the title. */
  name: string
  /**
   * This person's SPOUSE connections, and only those.
   *
   * ── THE CONNECTION LIST IS NOT COMING BACK ──────────────────────────────────────
   * The dialog used to take every edge and render a roll of who somebody was attached to,
   * which was removed on 2026-09-03. This is the one thing that list carried which nothing
   * else could do: a marriage is the only relationship with a word that can CHANGE, and
   * removing it left a family with a divorce in it unable to record one.
   *
   * So the rows are the marriages and nothing else. Every other edge is a word somebody
   * recorded when they drew it, and re-reading it back to them was the part that made the
   * old section noise.
   */
  spouses?: TreeSpouse[]""")

# ── the type, replacing the deleted TreeConnection ────────────────────────────────
old = "/**\n * One person's record, as the family tree hands it over."
new = """/**
 * One marriage, as the dialog needs it.
 *
 * `otherGender` is what narrows six words to three: a spouse recorded as female is offered
 * Wife, Ex-wife and Partner, and never the four that could not apply to her. Null gender
 * falls back to the ungendered pair, which is the honest answer for a person whose gender
 * nobody has recorded.
 */
export interface TreeSpouse {
  /** The `person_relationships` row, which is what `setRelationshipType` takes. */
  edgeId: string
  /** The person on the other end — the SUBJECT of the word, see `saveTypes`. */
  otherId: string
  otherName: string
  otherGender: string | null
  /** The word as it stands, or '' when the inverse could not be named. */
  typeName: string
}

/**
 * One person's record, as the family tree hands it over."""
assert old in s, 'anchor for TreeSpouse'
s = s.replace(old, new, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('prop + type added')
