'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Banknote, CreditCard, HandCoins, Landmark, Loader2, Trash2, WalletCards, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { CheckoutInput } from '@/server/orders'
import { checkout, type CustomerOption } from './actions'

export type PosPaymentMethod = { id: string; name: string; type: 'cash' | 'card' | 'transfer' | 'credit' | 'other' }

const ICON: Record<PosPaymentMethod['type'], LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: Landmark,
  credit: HandCoins,
  other: WalletCards,
}

type Line = { method: PosPaymentMethod; amount: number; reference: string }

export function PaymentDialog({
  open,
  onOpenChange,
  slug,
  total,
  currency,
  methods,
  customer,
  payload,
  onPaid,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  slug: string
  total: number
  currency: string
  methods: PosPaymentMethod[]
  customer: CustomerOption | null
  payload: Omit<CheckoutInput, 'payments' | 'notes'>
  onPaid: (r: { id: string; number: number; change: number }, payments: { name: string; amount: number }[]) => void
}) {
  const money = (v: number) => formatMoney(v, currency)
  const [lines, setLines] = useState<Line[]>([])
  const [method, setMethod] = useState<PosPaymentMethod | undefined>(methods[0])
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [pending, start] = useTransition()

  const paid = lines.reduce((a, l) => a + l.amount, 0)
  const remaining = Math.max(0, total - paid)
  const change = Math.max(0, paid - total)

  useEffect(() => {
    if (open) {
      setLines([])
      setMethod(methods[0])
      setAmount((total / 100).toFixed(2))
      setReference('')
    }
  }, [open, total, methods])

  const quick = useMemo(() => {
    const opts = new Set<number>([remaining])
    for (const bill of [2000, 5000, 10000, 20000, 50000, 100000]) {
      const v = Math.ceil(remaining / bill) * bill
      if (v >= remaining) opts.add(v)
    }
    return [...opts].filter((v) => v > 0).sort((a, b) => a - b).slice(0, 5)
  }, [remaining])

  const addLine = (value?: number) => {
    if (!method) return
    const cents = value ?? toCents(amount)
    if (cents <= 0) return void toast.error('Captura un importe válido')
    if (method.type !== 'cash' && cents > remaining) return void toast.error('Solo el efectivo puede exceder el total')
    if (method.type === 'credit' && !customer) return void toast.error('Selecciona un cliente para vender a crédito')
    const next = [...lines, { method, amount: cents, reference }]
    setLines(next)
    const left = Math.max(0, total - next.reduce((a, l) => a + l.amount, 0))
    setAmount((left / 100).toFixed(2))
    setReference('')
    return next
  }

  const confirm = (current = lines) => {
    const sum = current.reduce((a, l) => a + l.amount, 0)
    if (sum < total) return void toast.error('Falta cubrir el total')
    start(async () => {
      const res = await checkout(slug, {
        ...payload,
        payments: current.map((l) => ({ methodId: l.method.id, amount: l.amount, reference: l.reference || null })),
      })
      if (!res.ok || !res.data) return void toast.error(res.ok ? 'Error al cobrar' : res.error)
      toast.success(`Venta #${res.data.number} cobrada`)
      // El ticket muestra lo recibido por método y el cambio por separado.
      onPaid(res.data, current.map((l) => ({ name: l.method.name, amount: l.amount })))
    })
  }

  /** Cobro exacto en un clic con el método seleccionado. */
  const payExact = (m: PosPaymentMethod) => {
    if (m.type === 'credit' && !customer) return void toast.error('Selecciona un cliente para vender a crédito')
    confirm([...lines, { method: m, amount: remaining, reference: '' }])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <div className='grid md:grid-cols-[1fr_15rem]'>
          <div className='p-5'>
            <DialogHeader>
              <DialogTitle className='font-heading text-xl'>Cobrar venta</DialogTitle>
              <DialogDescription>
                {customer ? `Cliente: ${customer.name}` : 'Público en general'} · Enter para confirmar
              </DialogDescription>
            </DialogHeader>

            <div className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4'>
              {methods.map((m) => {
                const Icon = ICON[m.type]
                return (
                  <button
                    key={m.id}
                    type='button'
                    onClick={() => setMethod(m)}
                    onDoubleClick={() => payExact(m)}
                    disabled={m.type === 'credit' && !customer}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-xs font-medium transition-all hover:border-gold/60 disabled:opacity-40',
                      method?.id === m.id && 'border-gold bg-gold/10 shadow-md shadow-gold/10',
                    )}
                  >
                    <Icon className='size-5' />
                    {m.name}
                  </button>
                )
              })}
            </div>

            <form
              className='mt-4 space-y-3'
              onSubmit={(e) => {
                e.preventDefault()
                if (remaining === 0 && lines.length) return confirm()
                const next = addLine()
                if (next && next.reduce((a, l) => a + l.amount, 0) >= total) confirm(next)
              }}
            >
              <label className='block'>
                <span className='text-xs text-muted-foreground'>Importe recibido</span>
                <input
                  autoFocus
                  inputMode='decimal'
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className='mt-1 h-14 w-full rounded-xl border bg-background px-4 text-right font-heading text-3xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'
                />
              </label>
              {method?.type === 'cash' ? (
                <div className='flex flex-wrap gap-1.5'>
                  {quick.map((v) => (
                    <Button key={v} type='button' variant='outline' onClick={() => setAmount((v / 100).toFixed(2))}>
                      {v === remaining ? 'Exacto' : money(v)}
                    </Button>
                  ))}
                </div>
              ) : (
                method && (
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={method.type === 'card' ? 'Últimos 4 dígitos / autorización (opcional)' : 'Referencia (opcional)'}
                    className='h-8 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                  />
                )
              )}
              <div className='flex gap-2'>
                <Button type='button' variant='outline' size='lg' className='flex-1' onClick={() => addLine()} disabled={pending}>
                  Agregar pago parcial
                </Button>
                <Button type='submit' size='lg' className='flex-1' disabled={pending}>
                  {pending && <Loader2 className='animate-spin' />}
                  {remaining === 0 && lines.length ? 'Confirmar cobro' : 'Cobrar'}
                </Button>
              </div>
            </form>
          </div>

          <aside className='flex flex-col border-t bg-muted/40 p-5 md:border-t-0 md:border-l'>
            <p className='text-[0.65rem] font-medium tracking-[0.2em] text-muted-foreground uppercase'>Total</p>
            <p className='font-heading text-3xl font-bold tabular-nums'>{money(total)}</p>
            <ul className='mt-4 flex-1 space-y-1.5 text-xs'>
              {lines.map((l, i) => (
                <li key={i} className='flex items-center justify-between gap-2'>
                  <span className='truncate'>{l.method.name}</span>
                  <span className='flex items-center gap-1 tabular-nums'>
                    {money(l.amount)}
                    <button
                      type='button'
                      aria-label='Quitar pago'
                      className='text-muted-foreground hover:text-destructive'
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    >
                      <Trash2 className='size-3' />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <dl className='mt-4 space-y-1 border-t pt-3 text-xs'>
              <div className='flex justify-between'>
                <dt className='text-muted-foreground'>Pagado</dt>
                <dd className='tabular-nums'>{money(paid)}</dd>
              </div>
              <div className='flex justify-between'>
                <dt className='text-muted-foreground'>Restante</dt>
                <dd className={cn('tabular-nums', remaining > 0 && 'font-semibold text-destructive')}>{money(remaining)}</dd>
              </div>
              <div className='flex items-baseline justify-between pt-1'>
                <dt className='font-medium'>Cambio</dt>
                <dd className='font-heading text-xl font-semibold text-success tabular-nums'>{money(change)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
