export const CHILD_RELATIONSHIP_TYPES = ['Son', 'Daughter'] as const
export type ChildRelationshipType = (typeof CHILD_RELATIONSHIP_TYPES)[number]

export const ANCESTOR_TYPES = [
  'Paternal Grandfather',
  'Paternal Grandmother',
  'Maternal Grandfather',
  'Maternal Grandmother',
  'Father',
  'Mother',
] as const
export type AncestorType = (typeof ANCESTOR_TYPES)[number]
