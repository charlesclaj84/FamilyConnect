/** Format an integer number of cents as USD, e.g. 123456 → "$1,234.56" */
export function formatCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((cents ?? 0) / 100)
}

/** Parse a dollar string (e.g. "12.34") into integer cents. Returns 0 on bad input. */
export function dollarsToCents(input: string | number | null | undefined): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input ?? ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
