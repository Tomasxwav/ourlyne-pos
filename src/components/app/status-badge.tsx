import { cn } from '@/lib/utils'

const TONES = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/15 ring-warning/30 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning',
  danger: 'bg-destructive/10 text-destructive ring-destructive/20',
  neutral: 'bg-muted text-muted-foreground ring-border',
  gold: 'bg-gold/15 text-gold-deep ring-gold/30 dark:text-gold',
  info: 'bg-chart-2/10 text-chart-2 ring-chart-2/20',
} as const

export type Tone = keyof typeof TONES

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {children}
    </span>
  )
}

export const ORDER_STATUS_UI: Record<string, { label: string; tone: Tone }> = {
  completed: { label: 'Completada', tone: 'success' },
  partially_refunded: { label: 'Devolución parcial', tone: 'warning' },
  refunded: { label: 'Devuelta', tone: 'danger' },
  voided: { label: 'Cancelada', tone: 'neutral' },
}

export const PAYMENT_STATUS_UI: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Pagada', tone: 'success' },
  partial: { label: 'Pago parcial', tone: 'warning' },
  unpaid: { label: 'Pendiente', tone: 'danger' },
}
