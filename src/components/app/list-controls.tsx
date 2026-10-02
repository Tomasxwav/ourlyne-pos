'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

function useUpdateParams() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page')
    const qs = next.toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  return { params, update, pending }
}

export function SearchInput({
  placeholder = 'Buscar…',
  param = 'q',
  className,
  autoFocus,
}: {
  placeholder?: string
  param?: string
  className?: string
  autoFocus?: boolean
}) {
  const { params, update, pending } = useUpdateParams()
  const [value, setValue] = useState(params.get(param) ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      {pending ? (
        <Loader2 className='absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground' />
      ) : (
        <Search className='absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
      )}
      <input
        type='search'
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setValue(v)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => update({ [param]: v.trim() || null }), 300)
        }}
        className='h-8 w-full rounded-md border border-input bg-input/20 pr-7 pl-8 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30 [&::-webkit-search-cancel-button]:hidden'
      />
      {value && (
        <button
          type='button'
          aria-label='Limpiar búsqueda'
          onClick={() => {
            setValue('')
            update({ [param]: null })
          }}
          className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
        >
          <X className='size-3.5' />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({
  param,
  options,
  allLabel,
  className,
}: {
  param: string
  options: { value: string; label: string }[]
  allLabel: string
  className?: string
}) {
  const { params, update } = useUpdateParams()
  return (
    <div className={cn('w-full sm:w-44', className)}>
      <NativeSelect
        aria-label={allLabel}
        value={params.get(param) ?? ''}
        onChange={(e) => update({ [param]: e.target.value || null })}
        className='h-8'
      >
        <option value=''>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number
  pageSize: number
  total: number
  searchParams: Record<string, string | string[] | undefined>
}) {
  const pathname = usePathname()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const href = (p: number) => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === 'string') next.set(k, v)
    next.set('page', String(p))
    return `${pathname}?${next}`
  }
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  return (
    <div className='flex items-center justify-between gap-4 px-1 text-xs text-muted-foreground'>
      <span className='tabular-nums'>
        {from}–{to} de {total}
      </span>
      <div className='flex items-center gap-1'>
        <Link
          aria-disabled={page <= 1}
          href={href(Math.max(1, page - 1))}
          className={buttonVariants({
            variant: 'outline',
            size: 'icon',
            className: cn(page <= 1 && 'pointer-events-none opacity-40'),
          })}
          aria-label='Página anterior'
        >
          <ChevronLeft />
        </Link>
        <span className='px-2 tabular-nums'>
          {page} / {pages}
        </span>
        <Link
          aria-disabled={page >= pages}
          href={href(Math.min(pages, page + 1))}
          className={buttonVariants({
            variant: 'outline',
            size: 'icon',
            className: cn(page >= pages && 'pointer-events-none opacity-40'),
          })}
          aria-label='Página siguiente'
        >
          <ChevronRight />
        </Link>
      </div>
    </div>
  )
}

export function DateRangeFilter() {
  const { params, update } = useUpdateParams()
  const cls =
    'h-8 rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30 dark:[color-scheme:dark]'
  return (
    <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
      <input
        type='date'
        aria-label='Desde'
        value={params.get('from') ?? ''}
        onChange={(e) => update({ from: e.target.value || null })}
        className={cls}
      />
      <span>a</span>
      <input
        type='date'
        aria-label='Hasta'
        value={params.get('to') ?? ''}
        onChange={(e) => update({ to: e.target.value || null })}
        className={cls}
      />
    </div>
  )
}
