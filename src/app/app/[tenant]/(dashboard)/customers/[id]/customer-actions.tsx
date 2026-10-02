'use client'

import { startTransition, useActionState, useState } from 'react'
import { HandCoins, Loader2, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput, formatMoney, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import { deleteCustomer, registerCustomerPayment } from '../actions'

export function PaymentDialog({
  slug,
  customerId,
  balance,
  currency,
  needsRegister,
  registerName,
}: {
  slug: string
  customerId: string
  balance: number
  currency: string
  /** Módulo de cajas activo: el efectivo requiere caja abierta. */
  needsRegister: boolean
  registerName: string | null
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(centsToInput(balance))
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>(needsRegister && !registerName ? 'card' : 'cash')
  const [state, action, pending] = useActionState(registerCustomerPayment.bind(null, slug, customerId), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  const cents = toCents(amount)
  const over = cents > balance
  const cashBlocked = method === 'cash' && needsRegister && !registerName

  useActionFeedback(state, {
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setAmount(centsToInput(balance))
      }}
    >
      <DialogTrigger render={<Button size='lg' disabled={balance <= 0} />}>
        <HandCoins /> Registrar abono
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Registrar abono</DialogTitle>
          <DialogDescription>
            Saldo pendiente: <span className='font-medium text-foreground tabular-nums'>{formatMoney(balance, currency)}</span>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            startTransition(() => action(fd))
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!errors?.amount || over}>
              <FieldLabel htmlFor='p-amount'>Importe</FieldLabel>
              <div className='flex gap-1'>
                <Input
                  id='p-amount'
                  name='amount'
                  inputMode='decimal'
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  aria-invalid={over || undefined}
                  className='text-right font-heading text-base tabular-nums'
                />
                <Button type='button' variant='outline' onClick={() => setAmount(centsToInput(balance))}>
                  Liquidar
                </Button>
              </div>
              <FieldError>
                {over ? `No puede superar el saldo de ${formatMoney(balance, currency)}.` : errors?.amount?.[0]}
              </FieldError>
            </Field>
            <Field data-invalid={!!errors?.methodType || cashBlocked}>
              <FieldLabel htmlFor='p-method'>Método de pago</FieldLabel>
              <NativeSelect
                id='p-method'
                name='methodType'
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                <option value='cash'>Efectivo</option>
                <option value='card'>Tarjeta</option>
                <option value='transfer'>Transferencia</option>
              </NativeSelect>
              {method === 'cash' && needsRegister && (
                <FieldDescription className={cn(cashBlocked && 'text-destructive')}>
                  {registerName
                    ? `El efectivo entra a ${registerName}.`
                    : 'Abre tu caja en el punto de venta para recibir efectivo.'}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor='p-note'>Nota</FieldLabel>
              <Input id='p-note' name='note' placeholder='Opcional' maxLength={200} />
            </Field>
          </FieldGroup>
          {cents > 0 && !over && (
            <p className='mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground'>
              Saldo después del abono:{' '}
              <span className='font-medium text-foreground tabular-nums'>{formatMoney(balance - cents, currency)}</span>
            </p>
          )}
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending || over || cents <= 0 || cashBlocked}>
              {pending && <Loader2 className='animate-spin' />}
              Registrar abono
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteCustomerButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  return (
    <ConfirmAction
      title={`¿Eliminar a ${name}?`}
      description='Solo se pueden eliminar clientes sin ventas registradas. Esta acción no se puede deshacer.'
      confirmLabel='Eliminar'
      action={deleteCustomer.bind(null, slug, id)}
      trigger={
        <Button variant='ghost' size='lg' className='text-muted-foreground hover:text-destructive'>
          <Trash2 /> Eliminar
        </Button>
      }
    />
  )
}
