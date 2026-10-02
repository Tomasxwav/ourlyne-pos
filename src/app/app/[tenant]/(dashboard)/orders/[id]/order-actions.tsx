'use client'

import { useState, useTransition } from 'react'
import { Ban, Loader2, Printer, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatMoney, formatQty } from '@/lib/money'
import { refundOrderAction, voidOrderAction } from '../actions'

type Item = { id: string; name: string; available: number; unitTotal: number }

export function OrderActions({
  slug,
  orderId,
  canRefund,
  canVoid,
  hasCustomer,
  currency,
  items,
}: {
  slug: string
  orderId: string
  canRefund: boolean
  canVoid: boolean
  hasCustomer: boolean
  currency: string
  items: Item[]
}) {
  return (
    <>
      <Button variant='outline' size='lg' onClick={() => window.print()}>
        <Printer /> Reimprimir
      </Button>
      {canRefund && <RefundDialog slug={slug} orderId={orderId} items={items} currency={currency} hasCustomer={hasCustomer} />}
      {canVoid && <VoidDialog slug={slug} orderId={orderId} />}
    </>
  )
}

function RefundDialog({
  slug,
  orderId,
  items,
  currency,
  hasCustomer,
}: {
  slug: string
  orderId: string
  items: Item[]
  currency: string
  hasCustomer: boolean
}) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState(true)
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash')
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const refundable = items.filter((i) => i.available > 0)
  const amount = refundable.reduce((a, i) => a + Math.round(i.unitTotal * (qty[i.id] ?? 0)), 0)

  const submit = () =>
    start(async () => {
      const selected = refundable.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ itemId: i.id, quantity: qty[i.id] }))
      if (!selected.length) return void toast.error('Selecciona qué devolver')
      const res = await refundOrderAction(slug, orderId, { items: selected, restock, methodType: method, reason })
      if (!res.ok) return void toast.error(res.error)
      toast.success(res.message ?? 'Devolución registrada')
      setOpen(false)
      setQty({})
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='lg' />}>
        <Undo2 /> Devolución
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
          <DialogDescription>Selecciona las cantidades a devolver.</DialogDescription>
        </DialogHeader>
        <ul className='divide-y rounded-lg border'>
          {refundable.map((i) => (
            <li key={i.id} className='flex items-center gap-3 px-3 py-2 text-xs'>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>{i.name}</p>
                <p className='text-muted-foreground'>
                  Disponible {formatQty(i.available)} · {formatMoney(i.unitTotal, currency)} c/u
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setQty({ ...qty, [i.id]: i.available })}
              >
                Todo
              </Button>
              <Input
                aria-label={`Cantidad a devolver de ${i.name}`}
                type='number'
                min={0}
                max={i.available}
                step='any'
                value={qty[i.id] ?? ''}
                onChange={(e) => setQty({ ...qty, [i.id]: Math.min(i.available, Math.max(0, Number(e.target.value))) })}
                className='w-20 text-right'
              />
            </li>
          ))}
        </ul>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='grid gap-1 text-xs'>
            Reembolso en
            <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value='cash'>Efectivo (sale de caja)</option>
              <option value='card'>Tarjeta</option>
              <option value='transfer'>Transferencia</option>
              {hasCustomer && <option value='credit'>Abono a crédito del cliente</option>}
            </NativeSelect>
          </label>
          <label className='grid gap-1 text-xs'>
            Motivo
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder='Opcional' />
          </label>
        </div>
        <label className='flex items-center gap-2 text-xs'>
          <Checkbox checked={restock} onCheckedChange={(v) => setRestock(Boolean(v))} />
          Reingresar productos al inventario
        </label>
        <DialogFooter className='items-center sm:justify-between'>
          <p className='text-sm'>
            A devolver: <span className='font-heading text-lg font-semibold tabular-nums'>{formatMoney(amount, currency)}</span>
          </p>
          <Button size='lg' onClick={submit} disabled={pending || amount <= 0}>
            {pending && <Loader2 className='animate-spin' />}
            Confirmar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VoidDialog({ slug, orderId }: { slug: string; orderId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='destructive' size='lg' />}>
        <Ban /> Cancelar venta
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cancelar esta venta?</DialogTitle>
          <DialogDescription>
            Se reingresará el inventario y se revertirán saldos de cliente y uso de cupón. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder='Motivo de la cancelación' autoFocus />
        <DialogFooter>
          <Button
            variant='destructive'
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await voidOrderAction(slug, orderId, reason || undefined)
                if (!res.ok) return void toast.error(res.error)
                toast.success('Venta cancelada')
                setOpen(false)
              })
            }
          >
            {pending && <Loader2 className='animate-spin' />}
            Cancelar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
