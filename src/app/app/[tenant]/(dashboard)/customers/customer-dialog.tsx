'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useActionState, useState } from 'react'
import { Loader2, Pencil, UserPlus } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput } from '@/lib/money'
import { saveCustomer } from './actions'

export type CustomerFormValues = {
  id: string
  name: string
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  notes: string | null
  creditLimit: number
}

export function CustomerDialog({ slug, customer }: { slug: string; customer?: CustomerFormValues }) {
  const [open, setOpen] = useState(false)
  // Copia fija de los valores mientras el diálogo está abierto (evita cambiar defaultValue al revalidar).
  const [initial, setInitial] = useState(customer)
  const router = useRouter()
  const [state, action, pending] = useActionState(saveCustomer.bind(null, slug, customer?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined

  useActionFeedback(state, {
    onSuccess: (data) => {
      setOpen(false)
      if (!customer && data?.id) router.push(`/app/${slug}/customers/${data.id}`)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setInitial(customer)
        setOpen(o)
      }}
    >
      <DialogTrigger render={<Button size='lg' variant={customer ? 'outline' : 'default'} />}>
        {customer ? (
          <>
            <Pencil /> Editar
          </>
        ) : (
          <>
            <UserPlus /> Nuevo cliente
          </>
        )}
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            Los datos de contacto y RFC se usan en tickets y facturación.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            // Sin reinicio automático del formulario: conserva lo capturado si hay errores.
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            startTransition(() => action(fd))
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='c-name'>Nombre</FieldLabel>
              <Input id='c-name' name='name' defaultValue={initial?.name} required autoFocus autoComplete='off' />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor='c-email'>Correo</FieldLabel>
                <Input id='c-email' name='email' type='email' defaultValue={initial?.email ?? ''} autoComplete='off' />
                <FieldError>{errors?.email?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.phone}>
                <FieldLabel htmlFor='c-phone'>Teléfono</FieldLabel>
                <Input id='c-phone' name='phone' type='tel' inputMode='tel' defaultValue={initial?.phone ?? ''} autoComplete='off' />
                <FieldError>{errors?.phone?.[0]}</FieldError>
              </Field>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.taxId}>
                <FieldLabel htmlFor='c-rfc'>RFC</FieldLabel>
                <Input
                  id='c-rfc'
                  name='taxId'
                  defaultValue={initial?.taxId ?? ''}
                  maxLength={13}
                  className='font-mono uppercase'
                  autoComplete='off'
                />
                <FieldError>{errors?.taxId?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.creditLimit}>
                <FieldLabel htmlFor='c-credit'>Límite de crédito</FieldLabel>
                <Input
                  id='c-credit'
                  name='creditLimit'
                  inputMode='decimal'
                  defaultValue={centsToInput(initial?.creditLimit ?? 0)}
                  onFocus={(e) => e.target.select()}
                  className='text-right tabular-nums'
                />
                <FieldDescription>0 = sin ventas a crédito.</FieldDescription>
                <FieldError>{errors?.creditLimit?.[0]}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor='c-address'>Dirección</FieldLabel>
              <Input id='c-address' name='address' defaultValue={initial?.address ?? ''} autoComplete='off' />
            </Field>
            <Field>
              <FieldLabel htmlFor='c-notes'>Notas</FieldLabel>
              <Textarea id='c-notes' name='notes' rows={3} defaultValue={initial?.notes ?? ''} />
            </Field>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              {customer ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
