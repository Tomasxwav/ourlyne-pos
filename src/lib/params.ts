type Param = string | string[] | undefined

export function parsePage(value: Param) {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function str(value: Param) {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export const PAGE_SIZE = 20

/** "2026-10-01" → Date al inicio del día (hora local del servidor). */
export function parseDate(value: Param, endOfDay = false) {
  const s = str(value)
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const d = new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(d.getTime()) ? undefined : d
}
