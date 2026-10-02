/** Utilidades de fecha en la zona horaria del negocio (sin dependencias extra). */

function offsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** "2026-10-31" → instante UTC de las 23:59:59 de ese día en `timeZone`. */
export function endOfDayIn(day: string, timeZone: string) {
  const naive = Date.parse(`${day}T23:59:59Z`)
  try {
    const first = naive - offsetMs(new Date(naive), timeZone)
    // Segunda pasada por si el día cruza un cambio de horario.
    return new Date(naive - offsetMs(new Date(first), timeZone))
  } catch {
    return new Date(naive)
  }
}

/** Instante → "YYYY-MM-DD" en `timeZone`. */
export function dayIn(instant: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant)
  } catch {
    return instant.toISOString().slice(0, 10)
  }
}
