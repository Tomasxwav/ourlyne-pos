import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  current,
  previous,
  hint,
  icon,
  className,
}: {
  label: string
  value: React.ReactNode
  current?: number
  previous?: number
  hint?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  const hasDelta = current !== undefined && previous !== undefined
  const delta = hasDelta ? (previous ? (current - previous) / Math.abs(previous) : current ? 1 : 0) : 0
  const pct = Math.round(delta * 1000) / 10
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-gold/50 md:p-5',
        className,
      )}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-linear-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-expo group-hover:scale-x-100'
      />
      <div className='flex items-center justify-between gap-2'>
        <p className='text-[0.65rem] font-medium tracking-[0.18em] text-muted-foreground uppercase'>{label}</p>
        {icon && <span className='text-muted-foreground [&_svg]:size-4'>{icon}</span>}
      </div>
      <p className='mt-3 truncate font-heading text-xl font-semibold tracking-tight tabular-nums sm:text-2xl 2xl:text-3xl'>{value}</p>
      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground'>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
              pct > 0 && 'bg-success/10 text-success',
              pct < 0 && 'bg-destructive/10 text-destructive',
              pct === 0 && 'bg-muted',
            )}
          >
            <Icon className='size-3' aria-hidden />
            <span className='sr-only'>{pct > 0 ? 'Aumento' : pct < 0 ? 'Disminución' : 'Sin cambio'}</span>
            {Math.abs(pct)}%
          </span>
        )}
        {hint}
      </div>
    </div>
  )
}
