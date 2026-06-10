export function computeIsMinor(dob: string | null | undefined): boolean {
  if (!dob) return false
  const birth = new Date(dob)
  const today = new Date()
  const age = today.getFullYear() - birth.getFullYear() -
    (today.getMonth() < birth.getMonth() ||
     (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0)
  return age < 18
}
