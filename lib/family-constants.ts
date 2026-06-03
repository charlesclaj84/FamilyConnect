export const CHILD_RELATIONSHIP_TYPES = ['Son', 'Daughter'] as const
export type ChildRelationshipType = (typeof CHILD_RELATIONSHIP_TYPES)[number]

export const SPOUSE_TYPES = ['Husband', 'Wife', 'Partner'] as const
export type SpouseRelType = (typeof SPOUSE_TYPES)[number]

export const ANCESTOR_TYPES = [
  'Paternal Grandfather',
  'Paternal Grandmother',
  'Maternal Grandfather',
  'Maternal Grandmother',
  'Father',
  'Mother',
] as const
export type AncestorType = (typeof ANCESTOR_TYPES)[number]
