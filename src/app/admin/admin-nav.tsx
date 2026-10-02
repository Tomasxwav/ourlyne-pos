'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/tenants', label: 'Negocios' },
  { href: '/admin/plans', label: 'Planes' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className='flex items-center gap-1'>
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href)
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
