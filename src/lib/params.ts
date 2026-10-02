type Param = string | string[] | undefined

export function parsePage(value: Param) {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function str(value: Param) {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export const PAGE_SIZE = 20
