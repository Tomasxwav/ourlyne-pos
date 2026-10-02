'use client'

import { startTransition, useActionState, useState } from 'react'
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
import { NativeSelect } from '@/components/ui/native-select'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput } from '@/lib/money'
import { deleteExpense, saveExpense } from './actions'
import { EXPENSE_PAYMENT_METHODS, RECURRING_OPTIONS } from './constants'

export type ExpenseFormValues = {
  id: string
  description: string
  categoryId: string | null
  branchId: string | null
  amount: number
  day: string
  paymentMethod: string | null
  reference: string | null
  recurring: string
}

type Option = { id: string; name: string }

export function ExpenseDialog({
  slug,
  expense,
  categories,
  branches,
  defaultBranchId,
  today,
}: {
  slug: string
  expense?: ExpenseFormValues
  categories: Option[]
  branches: Option[]
  defaultBranchId?: string
  today: string
}) {
  const [open, setOpen] = useState(false)
  // Copia fija de los valores mientras el diálogo está abierto (evita cambiar defaultValue al revalidar).
  const [initial, setInitial] = useState(expense)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(saveExpense.bind(null, slug, expense?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false)
      if (!expense) setFormKey((k) => k + 1)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setInitial(expense)
        setOpen(o)
      }}
    >
      <DialogTrigger
        render={
          expense ? (
            <Button variant='ghost' size='icon' aria-label={`Editar ${expense.description}`} />
          ) : (
            <Button size='lg' />
          )
        }
      >
        {expense ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Nuevo gasto
          </>
        )}
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>Los gastos se descuentan de la utilidad en reportes.</DialogDescription>
        </DialogHeader>
        <form
          key={formKey}
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            startTransition(() => action(fd))
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!errors?.description}>
              <FieldLabel htmlFor='e-desc'>Descripción</FieldLabel>
              <Input
                id='e-desc'
                name='description'
                defaultValue={initial?.description}
                placeholder='Ej. Renta de local'
                required
                autoFocus
                autoComplete='off'
              />
              <FieldError>{errors?.description?.[0]}</FieldError>
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.amount}>
                <FieldLabel htmlFor='e-amount'>Importe</FieldLabel>
                <Input
                  id='e-amount'
                  name='amount'
                  inputMode='decimal'
                  defaultValue={initial ? centsToInput(initial.amount) : ''}
                  placeholder='0.00'
                  onFocus={(e) => e.target.select()}
                  required
                  className='text-right tabular-nums'
                />
                <FieldError>{errors?.amount?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.date}>
                <FieldLabel htmlFor='e-date'>Fecha</FieldLabel>
                <Input
                  id='e-date'
                  name='date'
                  type='date'
                  defaultValue={initial?.day ?? today}
                  required
                  className='dark:[color-scheme:dark]'
                />
                <FieldError>{errors?.date?.[0]}</FieldError>
              </Field>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='e-cat'>Categoría</FieldLabel>
                <NativeSelect id='e-cat' name='categoryId' defaultValue={initial?.categoryId ?? ''}>
                  <option value=''>Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor='e-branch'>Sucursal</FieldLabel>
                <NativeSelect
                  id='e-branch'
                  name='branchId'
                  defaultValue={initial ? (initial.branchId ?? '') : (defaultBranchId ?? '')}
                >
                  <option value=''>General (todas)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='e-method'>Método de pago</FieldLabel>
                <NativeSelect id='e-method' name='paymentMethod' defaultValue={initial?.paymentMethod ?? 'Efectivo'}>
                  <option value=''>Sin especificar</option>
                  {EXPENSE_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor='e-rec'>Recurrencia</FieldLabel>
                <NativeSelect id='e-rec' name='recurring' defaultValue={initial?.recurring ?? 'none'}>
                  {RECURRING_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor='e-ref'>Referencia</FieldLabel>
              <Input
                id='e-ref'
                name='reference'
                defaultValue={initial?.reference ?? ''}
                placeholder='Factura, folio o nota'
                maxLength={100}
                autoComplete='off'
              />
            </Field>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              {expense ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteExpenseButton({ slug, id, description }: { slug: string; id: string; description: string }) {
  return (
    <ConfirmAction
      title='¿Eliminar este gasto?'
      description={`"${description}" se eliminará de forma permanente.`}
      confirmLabel='Eliminar'
      action={deleteExpense.bind(null, slug, id)}
      trigger={
        <Button
          variant='ghost'
          size='icon'
          aria-label={`Eliminar ${description}`}
          className='text-muted-foreground hover:text-destructive'
        >
          <Trash2 />
        </Button>
      }
    />
  )
}
