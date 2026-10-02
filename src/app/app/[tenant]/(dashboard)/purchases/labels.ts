import type { Tone } from '@/components/app/status-badge'

export const PURCHASE_STATUS_UI: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  ordered: { label: 'Ordenada', tone: 'info' },
  received: { label: 'Recibida', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
}

export const PURCHASE_PAYMENT_UI: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: 'Pendiente', tone: 'warning' },
  partial: { label: 'Parcial', tone: 'gold' },
  paid: { label: 'Pagada', tone: 'success' },
}
