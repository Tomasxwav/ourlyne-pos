'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function RangeFilter({
  range,
  scope,
  showScope,
}: {
  range: number
  scope: 'all' | 'branch'
  showScope: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {pending && <Loader2 className='size-3.5 animate-spin text-muted-foreground' />}
      {showScope && (
        <ToggleGroup
          variant='outline'
          size='sm'
          value={[scope]}
          onValueChange={(v) => v[0] && set('scope', v[0])}
        >
          <ToggleGroupItem value='all' className='px-2.5'>Todas las sucursales</ToggleGroupItem>
          <ToggleGroupItem value='branch' className='px-2.5'>Sucursal activa</ToggleGroupItem>
        </ToggleGroup>
      )}
      <ToggleGroup
        variant='outline'
        size='sm'
        value={[String(range)]}
        onValueChange={(v) => v[0] && set('range', v[0])}
      >
        {[7, 30, 90].map((r) => (
          <ToggleGroupItem key={r} value={String(r)} className='px-2.5'>
            {r} días
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
