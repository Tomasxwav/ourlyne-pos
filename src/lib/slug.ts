export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Slugs que chocan con rutas o son confusos. */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'new', 'settings', 'billing', 'sign-in', 'sign-up',
  'onboarding', 'ourlyne', 'www', 'pos', 'help', 'support',
])

export const BUSINESS_TYPES = [
  { value: 'retail', label: 'Tienda / Retail' },
  { value: 'cafe', label: 'Cafetería' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'grocery', label: 'Abarrotes / Minisúper' },
  { value: 'pharmacy', label: 'Farmacia' },
  { value: 'fashion', label: 'Ropa y calzado' },
  { value: 'hardware', label: 'Ferretería' },
  { value: 'beauty', label: 'Estética / Belleza' },
  { value: 'other', label: 'Otro' },
] as const
