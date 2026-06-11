export interface RoleSummary {
  role_name: string
  assignment_scope: string
  chapter_name: string | null
}

export function formatRoleTitle(role: RoleSummary): string {
  const { role_name, assignment_scope, chapter_name } = role
  if (assignment_scope === 'chapter') return `${chapter_name ?? 'Chapter'} Chapter ${role_name}`
  if (assignment_scope === 'regional') return chapter_name ? `${chapter_name} Regional ${role_name}` : `Regional ${role_name}`
  return `National ${role_name}`
}
