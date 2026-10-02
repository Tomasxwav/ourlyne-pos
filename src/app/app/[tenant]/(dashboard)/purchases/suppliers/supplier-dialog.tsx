'use client'

import { useActionState, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { deleteSupplier, saveSupplier } from '../actions'

export type SupplierValues = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  taxId: string | null
  address: string | null
  notes: string | null
}

type Values = Omit<SupplierValues, 'id'>
const EMPTY: Values = { name: '', contactName: '', phone: '', email: '', taxId: '', address: '', notes: '' }

export function SupplierDialog({ slug, supplier }: { slug: string; supplier?: SupplierValues }) {
  const [open, setOpen] = useState(false)
  const initial = (): Values => ({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    taxId: supplier?.taxId ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  })
  const [values, setValues] = useState<Values>(initial)
  const [state, action, pending] = useActionState(saveSupplier.bind(null, slug, supplier?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false)
      if (!supplier) setValues(EMPTY)
    },
  })

  const bind = (key: keyof Values) => ({
    name: key,
    value: values[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o && supplier) setValues(initial())
      }}
    >
      <DialogTrigger
        render={
          supplier ? <Button variant='ghost' size='icon' aria-label={`Editar ${supplier.name}`} /> : <Button size='lg' />
        }
      >
        {supplier ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Nuevo proveedor
          </>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          <DialogDescription>Datos de contacto y fiscales para tus órdenes de compra.</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='sup-name'>Nombre o razón social</FieldLabel>
              <Input id='sup-name' required autoFocus {...bind('name')} />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='sup-contact'>Contacto</FieldLabel>
                <Input id='sup-contact' {...bind('contactName')} />
              </Field>
              <Field data-invalid={!!errors?.phone}>
                <FieldLabel htmlFor='sup-phone'>Teléfono</FieldLabel>
                <Input id='sup-phone' type='tel' {...bind('phone')} />
                <FieldError>{errors?.phone?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor='sup-email'>Correo</FieldLabel>
                <Input id='sup-email' type='email' {...bind('email')} />
                <FieldError>{errors?.email?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.taxId}>
                <FieldLabel htmlFor='sup-rfc'>RFC</FieldLabel>
                <Input id='sup-rfc' className='font-mono uppercase' maxLength={13} {...bind('taxId')} />
                <FieldError>{errors?.taxId?.[0]}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor='sup-address'>Dirección</FieldLabel>
              <Input id='sup-address' {...bind('address')} />
            </Field>
            <Field>
              <FieldLabel htmlFor='sup-notes'>Notas</FieldLabel>
              <Textarea id='sup-notes' rows={2} placeholder='Condiciones de pago, días de entrega…' {...bind('notes')} />
            </Field>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteSupplierButton({ slug, id, name, purchases }: { slug: string; id: string; name: string; purchases: number }) {
  return (
    <ConfirmAction
      title={`¿Eliminar "${name}"?`}
      description={
        purchases > 0
          ? `Este proveedor tiene ${purchases} ${purchases === 1 ? 'compra registrada' : 'compras registradas'} y no puede eliminarse.`
          : 'Esta acción no se puede deshacer.'
      }
      confirmLabel='Eliminar'
      action={deleteSupplier.bind(null, slug, id)}
      trigger={
        <Button variant='ghost' size='icon' aria-label={`Eliminar ${name}`} className='text-muted-foreground hover:text-destructive'>
          <Trash2 />
        </Button>
      }
    />
  )
}
