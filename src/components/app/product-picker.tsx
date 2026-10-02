'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { formatQty } from '@/lib/money'
import { cn } from '@/lib/utils'

export type PickerItem = {
  id: string
  name: string
  sku: string | null
  unit: string
  cost: number
  trackStock: boolean
  stock: number
}

/** Buscador de productos con resultados desplegables; llama a una Server Action para buscar. */
export function ProductPicker({
  search,
  onPick,
  placeholder = 'Buscar producto por nombre, SKU o código…',
  showStock = true,
  excludeIds = [],
  className,
}: {
  search: (q: string) => Promise<PickerItem[]>
  onPick: (item: PickerItem) => void
  placeholder?: string
  showStock?: boolean
  excludeIds?: string[]
  className?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PickerItem[]>([])
  const [active, setActive] = useState(0)
  const [pending, start] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const seq = useRef(0)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  const run = (term: string) => {
    const id = ++seq.current
    start(async () => {
      try {
        const rows = await search(term)
        if (id === seq.current) {
          setResults(rows)
          setActive(0)
        }
      } catch {
        if (id === seq.current) setResults([])
      }
    })
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const visible = results.filter((r) => !excludeIds.includes(r.id))

  const pick = (item: PickerItem) => {
    onPick(item)
    setQ('')
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={box} className={cn('relative', className)}>
      {pending ? (
        <Loader2 className='absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground' />
      ) : (
        <Search className='absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
      )}
      <input
        type='search'
        role='combobox'
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete='list'
        aria-label='Buscar producto'
        value={q}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          if (!results.length) run(q)
        }}
        onChange={(e) => {
          const v = e.target.value
          setQ(v)
          setOpen(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => run(v), 250)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(visible.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const item = visible[active]
            if (item) pick(item)
          } else if (e.key === 'Escape') setOpen(false)
        }}
        className='h-8 w-full rounded-md border border-input bg-input/20 pr-2 pl-8 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30 [&::-webkit-search-cancel-button]:hidden'
      />
      {open && (
        <div
          id={listId}
          role='listbox'
          className='absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg'
        >
          {visible.length === 0 ? (
            <p className='px-2 py-3 text-center text-xs text-muted-foreground'>
              {pending ? 'Buscando…' : 'Sin productos que coincidan.'}
            </p>
          ) : (
            visible.map((item, i) => (
              <button
                key={item.id}
                type='button'
                role='option'
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs',
                  i === active && 'bg-muted',
                )}
              >
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>{item.name}</span>
                  <span className='block font-mono text-[0.65rem] text-muted-foreground'>{item.sku ?? 'Sin SKU'}</span>
                </span>
                {showStock && item.trackStock && (
                  <span
                    className={cn(
                      'shrink-0 tabular-nums text-muted-foreground',
                      item.stock <= 0 && 'text-destructive',
                    )}
                  >
                    {formatQty(item.stock, item.unit)}
                  </span>
                )}
                <Plus className='size-3.5 shrink-0 text-gold-deep dark:text-gold' />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
