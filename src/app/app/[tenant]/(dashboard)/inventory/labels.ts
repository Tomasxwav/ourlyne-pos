import type { Tone } from '@/components/app/status-badge'
import type { StockMovementType } from '@/db/schema'

export const MOVEMENT_TYPE_UI: Record<StockMovementType, { label: string; tone: Tone }> = {
  initial: { label: 'Inventario inicial', tone: 'neutral' },
  sale: { label: 'Venta', tone: 'info' },
  refund: { label: 'Devolución', tone: 'gold' },
  purchase: { label: 'Compra', tone: 'success' },
  adjustment: { label: 'Ajuste', tone: 'warning' },
  transfer_in: { label: 'Traspaso entrada', tone: 'info' },
  transfer_out: { label: 'Traspaso salida', tone: 'info' },
  waste: { label: 'Merma', tone: 'danger' },
}

export type StockStatus = 'out' | 'low' | 'ok'

export function stockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return 'out'
  if (quantity <= threshold) return 'low'
  return 'ok'
}

export const STOCK_STATUS_UI: Record<StockStatus, { label: string; tone: Tone }> = {
  out: { label: 'Agotado', tone: 'danger' },
  low: { label: 'Stock bajo', tone: 'warning' },
  ok: { label: 'OK', tone: 'success' },
}

export const ADJUST_MODES = ['in', 'out', 'waste', 'count'] as const
export type AdjustMode = (typeof ADJUST_MODES)[number]

export const ADJUST_MODE_UI: Record<AdjustMode, { label: string; hint: string }> = {
  in: { label: 'Entrada', hint: 'Suma unidades a la existencia.' },
  out: { label: 'Salida', hint: 'Resta unidades (consumo interno, muestra, etc.).' },
  waste: { label: 'Merma', hint: 'Producto dañado, caducado o perdido.' },
  count: { label: 'Conteo físico', hint: 'Captura lo contado; se ajusta la diferencia.' },
}
