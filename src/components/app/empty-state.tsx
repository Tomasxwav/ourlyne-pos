import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <div
        aria-hidden
        className='absolute top-1/2 left-1/2 -z-10 size-64 -translate-1/2 rounded-full bg-gold/10 blur-3xl'
      />
      {icon && (
        <span className='flex size-12 items-center justify-center rounded-2xl border bg-card text-gold-deep shadow-sm dark:text-gold [&_svg]:size-5'>
          {icon}
        </span>
      )}
      <h3 className='text-lg font-semibold'>{title}</h3>
      {description && <p className='max-w-sm text-xs text-muted-foreground'>{description}</p>}
      {action && <div className='mt-2'>{action}</div>}
    </div>
  )
}
