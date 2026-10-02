'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Ban, Banknote, Loader2, PackageCheck, Pencil, Send } from 'lucide-react'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput, formatMoney, toCents } from '@/lib/money'
import { cancelPurchaseAction, markOrderedAction, receivePurchaseAction, registerPaymentAction } from '../actions'

export function PurchaseActions({
  slug,
  id,
  status,
  pending,
  branchName,
  stockLines,
  currency,
}: {
  slug: string
  id: string
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  pending: number
  branchName: string
  stockLines: number
  currency: string
}) {
  const open = status === 'draft' || status === 'ordered'
  return (
    <>
      {open && (
        <Link href={`/app/${slug}/purchases/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <Pencil /> Editar
        </Link>
      )}
      {status === 'draft' && (
        <ConfirmAction
          title='¿Marcar como ordenada?'
          description='La orden quedará emitida al proveedor. Podrás seguir editándola hasta recibirla.'
          confirmLabel='Marcar como ordenada'
          destructive={false}
          action={markOrderedAction.bind(null, slug, id)}
          trigger={
            <Button variant='outline' size='lg'>
              <Send /> Ordenar
            </Button>
          }
        />
      )}
      {(status === 'ordered' || status === 'received') && pending > 0 && (
        <PaymentDialog slug={slug} id={id} pending={pending} currency={currency} />
      )}
      {open && (
        <ConfirmAction
          title='¿Cancelar esta compra?'
          description='La orden quedará cancelada y no podrá recibirse ni editarse.'
          confirmLabel='Cancelar compra'
          action={cancelPurchaseAction.bind(null, slug, id)}
          trigger={
            <Button variant='destructive' size='lg'>
              <Ban /> Cancelar
            </Button>
          }
        />
      )}
      {open && (
        <ConfirmAction
          title='¿Recibir mercancía?'
          description={
            stockLines > 0
              ? `Se sumarán ${stockLines} ${stockLines === 1 ? 'producto' : 'productos'} al inventario de ${branchName} y se actualizará su costo con el de esta compra. No se puede deshacer.`
              : 'Se marcará como recibida y se actualizará el costo de los productos.'
          }
          confirmLabel='Recibir mercancía'
          destructive={false}
          action={receivePurchaseAction.bind(null, slug, id)}
          trigger={
            <Button size='lg'>
              <PackageCheck /> Recibir mercancía
            </Button>
          }
        />
      )}
    </>
  )
}

function PaymentDialog({ slug, id, pending, currency }: { slug: string; id: string; pending: number; currency: string }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(centsToInput(pending))
  const [state, action, busy] = useActionState(registerPaymentAction.bind(null, slug, id), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })
  const cents = toCents(amount)
  const over = cents > pending

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setAmount(centsToInput(pending))
      }}
    >
      <DialogTrigger render={<Button variant='outline' size='lg' />}>
        <Banknote /> Registrar pago
      </DialogTrigger>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Registrar pago al proveedor</DialogTitle>
          <DialogDescription>Saldo pendiente: {formatMoney(pending, currency)}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <Field data-invalid={!!errors?.amount || over}>
            <FieldLabel htmlFor='pay-amount'>Importe</FieldLabel>
            <Input
              id='pay-amount'
              name='amount'
              inputMode='decimal'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
              className='text-right tabular-nums'
            />
            <FieldError>{over ? 'Excede el saldo pendiente' : errors?.amount?.[0]}</FieldError>
          </Field>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={busy || over || cents <= 0}>
              {busy && <Loader2 className='animate-spin' />}
              Registrar pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
