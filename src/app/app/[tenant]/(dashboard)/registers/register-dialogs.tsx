'use client'

import { useActionState, useState, useTransition } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Lock, Plus } from 'lucide-react'
import { toast } from 'sonner'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { formatMoney, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import { addCashMovement, closeSession, createRegister, toggleRegister } from './actions'

export function CashMovementDialog({ slug, sessionId, type }: { slug: string; sessionId: string; type: 'in' | 'out' }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(addCashMovement.bind(null, slug, sessionId), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })
  const Icon = type === 'in' ? ArrowDownToLine : ArrowUpFromLine
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='lg' />}>
        <Icon /> {type === 'in' ? 'Entrada' : 'Salida'}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'in' ? 'Entrada de efectivo' : 'Salida de efectivo'}</DialogTitle>
          <DialogDescription>
            {type === 'in' ? 'Ej. cambio adicional, depósito al fondo.' : 'Ej. pago a proveedor, retiro parcial.'}
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type='hidden' name='type' value={type} />
          <FieldGroup>
            <Field data-invalid={!!errors?.amount}>
              <FieldLabel htmlFor='mv-amount'>Importe</FieldLabel>
              <Input id='mv-amount' name='amount' inputMode='decimal' autoFocus className='text-right tabular-nums' />
              <FieldError>{errors?.amount?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!errors?.reason}>
              <FieldLabel htmlFor='mv-reason'>Motivo</FieldLabel>
              <Input id='mv-reason' name='reason' />
              <FieldError>{errors?.reason?.[0]}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CloseSessionDialog({
  slug,
  sessionId,
  registerName,
  expected,
  currency,
  byMethod,
}: {
  slug: string
  sessionId: string
  registerName: string
  expected: number
  currency: string
  byMethod: { methodName: string; amount: number; count: number }[]
}) {
  const [open, setOpen] = useState(false)
  const [counted, setCounted] = useState('')
  const [state, action, pending] = useActionState(closeSession.bind(null, slug, sessionId), null)
  useActionFeedback(state, { onSuccess: () => setOpen(false) })
  const money = (v: number) => formatMoney(v, currency)
  const diff = counted === '' ? null : toCents(counted) - expected

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='lg' />}>
        <Lock /> Corte de caja
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Corte de {registerName}</DialogTitle>
          <DialogDescription>Cuenta el efectivo físico en caja y captúralo.</DialogDescription>
        </DialogHeader>
        <form action={action} className='space-y-4'>
          <ul className='space-y-1 rounded-lg border p-3 text-xs'>
            {byMethod.map((m) => (
              <li key={m.methodName} className='flex justify-between'>
                <span className='text-muted-foreground'>
                  {m.methodName} ({m.count})
                </span>
                <span className='tabular-nums'>{money(m.amount)}</span>
              </li>
            ))}
            <li className='flex justify-between border-t pt-1.5 font-medium'>
              <span>Efectivo esperado</span>
              <span className='tabular-nums'>{money(expected)}</span>
            </li>
          </ul>
          <label className='block'>
            <span className='text-xs font-medium'>Efectivo contado</span>
            <Input
              name='counted'
              autoFocus
              inputMode='decimal'
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className='mt-1 h-12 text-right font-heading text-2xl tabular-nums'
            />
          </label>
          {diff !== null && (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-center text-sm font-medium',
                diff === 0 ? 'bg-success/10 text-success' : diff > 0 ? 'bg-warning/15' : 'bg-destructive/10 text-destructive',
              )}
            >
              {diff === 0 ? 'La caja cuadra ✓' : `${diff > 0 ? 'Sobrante' : 'Faltante'} de ${money(Math.abs(diff))}`}
            </p>
          )}
          <Textarea name='notes' placeholder='Notas del corte (opcional)' rows={2} />
          <DialogFooter>
            <Button type='submit' size='lg' disabled={pending || counted === ''}>
              {pending && <Loader2 className='animate-spin' />}
              Cerrar caja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewRegisterDialog({
  slug,
  branches,
  defaultBranch,
}: {
  slug: string
  branches: { id: string; name: string }[]
  defaultBranch?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createRegister.bind(null, slug), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='lg' />}>
        <Plus /> Nueva caja
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva caja registradora</DialogTitle>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='reg-name'>Nombre</FieldLabel>
              <Input id='reg-name' name='name' placeholder='Caja 2' autoFocus />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor='reg-branch'>Sucursal</FieldLabel>
              <NativeSelect id='reg-branch' name='branchId' defaultValue={defaultBranch}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ToggleRegisterButton({ slug, registerId, active }: { slug: string; registerId: string; active: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant='ghost'
      size='sm'
      disabled={pending}
      className='text-muted-foreground'
      onClick={() =>
        start(async () => {
          const res = await toggleRegister(slug, registerId)
          if (!res.ok) toast.error(res.error)
        })
      }
    >
      {active ? 'Desactivar caja' : 'Reactivar caja'}
    </Button>
  )
}
