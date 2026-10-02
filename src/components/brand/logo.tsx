import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({
  href = '/',
  className,
  showTag = true,
  size = 28,
}: {
  href?: string | null
  className?: string
  showTag?: boolean
  size?: number
}) {
  const content = (
    <>
      <Image
        src='/logo.png'
        alt=''
        width={size}
        height={size}
        className='object-contain'
        style={{ width: size, height: size }}
        priority
      />
      <span className='text-sm font-semibold tracking-[0.2em] uppercase'>
        Ourlyne
      </span>
      {showTag && (
        <span className='rounded-full border border-gold/50 px-1.5 py-px text-[0.6rem] font-semibold tracking-[0.15em] text-gold-deep uppercase dark:text-gold'>
          POS
        </span>
      )}
    </>
  )
  const classes = cn('flex items-center gap-2.5', className)
  if (href === null) return <span className={classes}>{content}</span>
  return (
    <Link href={href} className={classes} aria-label='Ourlyne POS'>
      {content}
    </Link>
  )
}

/** Badge con punto pulsante, sello visual de Ourlyne. */
export function PulseBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-background/60 px-4 py-1.5 text-[0.65rem] font-medium tracking-[0.25em] uppercase backdrop-blur-sm',
        className,
      )}
    >
      <span className='relative flex size-1.5'>
        <span className='absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75' />
        <span className='relative size-1.5 rounded-full bg-gold' />
      </span>
      {children}
    </span>
  )
}
