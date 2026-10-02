'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Search, UserPlus, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatMoney } from '@/lib/money'
import { quickCreateCustomer, searchCustomers, type CustomerOption } from './actions'

export function CustomerPicker({
  slug,
  value,
  onChange,
  canCreate,
}: {
  slug: string
  value: CustomerOption | null
  onChange: (c: CustomerOption | null) => void
  canCreate: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CustomerOption[]>([])
  const [creating, setCreating] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      start(async () => setResults(await searchCustomers(slug, q)))
    }, 200)
    return () => clearTimeout(t)
  }, [q, open, slug])

  if (value) {
    return (
      <div className='flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2'>
        <span className='flex size-7 items-center justify-center rounded-full bg-gold/20 text-gold-deep dark:text-gold'>
          <UserRound className='size-3.5' />
        </span>
        <div className='min-w-0 flex-1 leading-tight'>
          <p className='truncate text-xs font-medium'>{value.name}</p>
          <p className='truncate text-[0.65rem] text-muted-foreground'>
            {value.loyaltyPoints} pts
            {value.creditLimit > 0 && ` · crédito disp. ${formatMoney(value.creditLimit - value.balance)}`}
          </p>
        </div>
        <Button variant='ghost' size='icon' aria-label='Quitar cliente' onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            className='flex w-full items-center gap-2 rounded-lg border border-dashed bg-card px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground'
          />
        }
      >
        <UserRound className='size-4' />
        <span className='flex-1'>Público en general</span>
        <span className='font-medium text-foreground'>Asignar cliente</span>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80 gap-2'>
        {creating ? (
          <form
            className='grid gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              start(async () => {
                const res = await quickCreateCustomer(slug, {
                  name: String(fd.get('name') ?? ''),
                  phone: String(fd.get('phone') ?? ''),
                  email: String(fd.get('email') ?? ''),
                })
                if (!res.ok || !res.data) return void toast.error(res.ok ? 'Error' : res.error)
                onChange(res.data)
                setCreating(false)
                setOpen(false)
              })
            }}
          >
            <p className='text-xs font-medium'>Nuevo cliente</p>
            <Input name='name' placeholder='Nombre' required autoFocus />
            <Input name='phone' placeholder='Teléfono' />
            <Input name='email' type='email' placeholder='Correo (opcional)' />
            <div className='flex justify-end gap-1.5'>
              <Button type='button' variant='ghost' onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button type='submit' disabled={pending}>
                {pending && <Loader2 className='animate-spin' />}
                Guardar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className='relative'>
              <Search className='absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Nombre, teléfono o correo'
                className='pl-7'
              />
            </div>
            <ul className='max-h-64 overflow-y-auto'>
              {pending && results.length === 0 && (
                <li className='flex justify-center py-4'>
                  <Loader2 className='size-4 animate-spin text-muted-foreground' />
                </li>
              )}
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type='button'
                    onClick={() => {
                      onChange(c)
                      setOpen(false)
                    }}
                    className='flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted'
                  >
                    <span className='text-xs font-medium'>{c.name}</span>
                    <span className='text-[0.65rem] text-muted-foreground'>{c.phone ?? c.email ?? '—'}</span>
                  </button>
                </li>
              ))}
              {!pending && results.length === 0 && (
                <li className='px-2 py-3 text-center text-[0.7rem] text-muted-foreground'>Sin resultados</li>
              )}
            </ul>
            {canCreate && (
              <Button variant='outline' onClick={() => setCreating(true)}>
                <UserPlus /> Crear cliente
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
