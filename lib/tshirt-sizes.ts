export const TSHIRT_CATEGORIES = ['Infant', 'Youth', 'Adult'] as const
export type TshirtCategory = (typeof TSHIRT_CATEGORIES)[number]

export const TSHIRT_SIZES: Record<TshirtCategory, string[]> = {
  Infant: ['NB', '0-3M', '3-6M', '6-12M', '12-18M', '18-24M'],
  Youth: ['XS', 'S', 'M', 'L', 'XL'],
  Adult: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
}

export const PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Rev.']
export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'Esq.', 'PhD', 'MD']
