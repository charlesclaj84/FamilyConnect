/**
 * How money changed hands — shared by the two manual-recording forms (a dues
 * payment and a fund contribution).
 *
 * A fixed list rather than a free-text box: these rows are often the only record
 * the payment has, and "Chk", "check" and "Check " in the same column cannot be
 * reconciled against a bank statement.
 *
 * Stored as the display string itself, not a code. The columns behind it
 * (dues_payments.payment_method, fund_contributions.payment_method) are plain TEXT
 * with no CHECK constraint, and they already hold whatever earlier admins typed —
 * so adding or renaming an entry here needs no migration, and old values keep
 * rendering as themselves.
 */
export const PAYMENT_METHODS = [
  'Cash',
  'Check',
  'Card',
  'Zelle',
  'Venmo',
  'Cash App',
  'PayPal',
  'Bank transfer',
  'Money order',
  'Other',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
