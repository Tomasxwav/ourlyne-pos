import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  eyebrow?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className='min-w-0'>
        {eyebrow && (
          <p className='mb-1.5 text-[0.65rem] font-medium tracking-[0.25em] text-gold-deep uppercase dark:text-gold'>
            {eyebrow}
          </p>
        )}
        <h1 className='text-gradient text-2xl leading-tight font-bold md:text-3xl'>
          {title}
        </h1>
        {description && (
          <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
        )}
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
  )
}
