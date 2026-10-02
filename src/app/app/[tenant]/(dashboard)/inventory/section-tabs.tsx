'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Pestañas de navegación entre páginas hermanas de un módulo (basadas en la URL). */
export function SectionTabs({
  items,
  className,
}: {
  items: { href: string; label: string; exact?: boolean; exclude?: string[] }[]
  className?: string
}) {
  const pathname = usePathname()
  return (
    <nav aria-label='Secciones' className={cn('-mb-1 overflow-x-auto', className)}>
      <ul className='inline-flex h-8 items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground'>
        {items.map((item) => {
          const matches = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const active = matches && !item.exclude?.some((e) => pathname.startsWith(e))
          return (
            <li key={item.href} className='h-full'>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-full items-center rounded-md border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:text-foreground',
                  active && 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
