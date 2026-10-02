const BUSINESSES = [
  'Cafeterías',
  'Restaurantes',
  'Abarrotes',
  'Farmacias',
  'Boutiques',
  'Ferreterías',
  'Estéticas',
  'Franquicias',
]

function Row({ reverse = false }: { reverse?: boolean }) {
  const items = [...BUSINESSES, ...BUSINESSES]
  return (
    <div
      className='flex w-max animate-marquee items-center motion-reduce:animate-none'
      style={reverse ? { animationDirection: 'reverse', animationDuration: '55s' } : undefined}
    >
      {items.map((name, i) => (
        <span key={i} className='flex items-center'>
          <span
            className={
              (i + (reverse ? 1 : 0)) % 2
                ? 'text-gold-deep dark:text-gold'
                : 'text-transparent transition-colors duration-500 hover:text-foreground'
            }
            style={
              (i + (reverse ? 1 : 0)) % 2
                ? undefined
                : { WebkitTextStroke: '1px var(--foreground)' }
            }
          >
            {name}
          </span>
          <svg
            viewBox='0 0 24 24'
            className='mx-6 size-5 shrink-0 text-gold md:mx-10 md:size-8'
            aria-hidden='true'
          >
            <path
              d='M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z'
              fill='currentColor'
            />
          </svg>
        </span>
      ))}
    </div>
  )
}

/** Franja infinita con los giros de negocio. */
export default function Marquee() {
  return (
    <section
      aria-label='Giros de negocio que usan Ourlyne POS'
      className='relative overflow-hidden border-y border-border py-8 md:py-12'
    >
      <p className='sr-only'>{BUSINESSES.join(', ')}.</p>
      <div
        aria-hidden='true'
        className='flex flex-col gap-2 font-heading text-5xl leading-tight font-bold tracking-tight whitespace-nowrap select-none md:gap-4 md:text-8xl'
      >
        <Row />
        <Row reverse />
      </div>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent md:w-40'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent md:w-40'
      />
    </section>
  )
}
