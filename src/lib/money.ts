/** Utilidades de dinero. Todos los importes se manejan en centavos (enteros). */

const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(
  cents: number,
  currency = 'MXN',
  locale = 'es-MX',
  opts?: { compact?: boolean },
) {
  const key = `${locale}:${currency}:${opts?.compact ? 'c' : ''}`
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(opts?.compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    })
    formatters.set(key, fmt)
  }
  return fmt.format((cents || 0) / 100)
}

/** Convierte "1,234.50" | 1234.5 → 123450 centavos. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** 123450 → "1234.50" (para inputs). */
export function centsToInput(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2)
}

export function formatNumber(value: number, locale = 'es-MX', digits = 0) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value || 0)
}

export function formatQty(value: number, unit?: string) {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '')
  return unit && unit !== 'pz' ? `${n} ${unit}` : n
}

export function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)} %`
}

/** Impuesto contenido en un precio que ya lo incluye. */
export function taxFromInclusive(amount: number, rateBps: number) {
  if (!rateBps) return 0
  return Math.round(amount - amount / (1 + rateBps / 10000))
}

/** Impuesto a sumar a un precio que no lo incluye. */
export function taxFromExclusive(amount: number, rateBps: number) {
  return Math.round((amount * rateBps) / 10000)
}

export function folio(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(6, '0')}`
}
