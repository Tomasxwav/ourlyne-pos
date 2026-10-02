'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Blocks, Building2, CreditCard, Percent, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '', label: 'Negocio', icon: Store },
  { href: '/branches', label: 'Sucursales', icon: Building2 },
  { href: '/taxes', label: 'Impuestos', icon: Percent },
  { href: '/payments', label: 'Métodos de pago', icon: CreditCard },
  { href: '/modules', label: 'Módulos', icon: Blocks },
]

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/app/${slug}/settings`
  return (
    <nav className='-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0'>
      {ITEMS.map((item) => {
        const href = `${base}${item.href}`
        const active = item.href ? pathname.startsWith(href) : pathname === base
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className={cn('size-4', active && 'text-gold-deep dark:text-gold')} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
