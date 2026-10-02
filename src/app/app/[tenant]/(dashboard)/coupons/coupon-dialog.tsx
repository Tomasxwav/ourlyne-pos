'use client'

import { startTransition, useActionState, useState } from 'react'
import { Loader2, Pencil, Plus, Wand2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput } from '@/lib/money'
import { saveCoupon } from './actions'

export type CouponFormValues = {
  id: string
  code: string
  description: string | null
  type: 'percent' | 'fixed'
  value: number
  minTotal: number
  usageLimit: number | null
  usedCount: number
  expiresDay: string | null
  isActive: boolean
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function CouponDialog({
  slug,
  coupon,
  currencySymbol,
  today,
}: {
  slug: string
  coupon?: CouponFormValues
  currencySymbol: string
  today: string
}) {
  const [open, setOpen] = useState(false)
  // Copia fija de los valores mientras el diálogo está abierto (evita cambiar defaultValue al revalidar).
  const [initial, setInitial] = useState(coupon)
  const [formKey, setFormKey] = useState(0)
  const [code, setCode] = useState(coupon?.code ?? '')
  const [type, setType] = useState<'percent' | 'fixed'>(coupon?.type ?? 'percent')
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true)
  const [state, action, pending] = useActionState(saveCoupon.bind(null, slug, coupon?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false)
      if (!coupon) {
        setFormKey((k) => k + 1)
        setCode('')
        setType('percent')
        setIsActive(true)
      }
    },
  })

  const initialValue = initial
    ? initial.type === 'percent'
      ? String(initial.value / 100)
      : centsToInput(initial.value)
    : ''

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setInitial(coupon)
        if (o && coupon) {
          setCode(coupon.code)
          setType(coupon.type)
          setIsActive(coupon.isActive)
        }
        setOpen(o)
      }}
    >
      <DialogTrigger
        render={
          coupon ? (
            <Button variant='ghost' size='icon' aria-label={`Editar ${coupon.code}`} />
          ) : (
            <Button size='lg' />
          )
        }
      >
        {coupon ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Nuevo cupón
          </>
        )}
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{coupon ? 'Editar cupón' : 'Nuevo cupón'}</DialogTitle>
          <DialogDescription>El cliente lo captura en el punto de venta al cobrar.</DialogDescription>
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
            <Field data-invalid={!!errors?.code}>
              <FieldLabel htmlFor='cp-code'>Código</FieldLabel>
              <div className='flex gap-1'>
                <Input
                  id='cp-code'
                  name='code'
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder='VERANO25'
                  maxLength={40}
                  required
                  autoFocus
                  autoComplete='off'
                  className='font-mono tracking-wider uppercase'
                />
                <Button type='button' variant='outline' size='icon' aria-label='Generar código' onClick={() => setCode(randomCode())}>
                  <Wand2 />
                </Button>
              </div>
              <FieldError>{errors?.code?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor='cp-desc'>Descripción</FieldLabel>
              <Input
                id='cp-desc'
                name='description'
                defaultValue={initial?.description ?? ''}
                placeholder='Ej. 10 % en tu primera compra'
                maxLength={200}
                autoComplete='off'
              />
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='cp-type'>Tipo</FieldLabel>
                <NativeSelect
                  id='cp-type'
                  name='type'
                  value={type}
                  onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
                >
                  <option value='percent'>Porcentaje</option>
                  <option value='fixed'>Monto fijo</option>
                </NativeSelect>
              </Field>
              <Field data-invalid={!!errors?.value}>
                <FieldLabel htmlFor='cp-value'>{type === 'percent' ? 'Descuento (%)' : `Descuento (${currencySymbol})`}</FieldLabel>
                <div className='relative'>
                  <Input
                    id='cp-value'
                    name='value'
                    inputMode='decimal'
                    defaultValue={initialValue}
                    placeholder={type === 'percent' ? '10' : '50.00'}
                    onFocus={(e) => e.target.select()}
                    required
                    className='pr-7 text-right tabular-nums'
                  />
                  <span className='pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground'>
                    {type === 'percent' ? '%' : currencySymbol}
                  </span>
                </div>
                <FieldError>{errors?.value?.[0]}</FieldError>
              </Field>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.minTotal}>
                <FieldLabel htmlFor='cp-min'>Compra mínima</FieldLabel>
                <Input
                  id='cp-min'
                  name='minTotal'
                  inputMode='decimal'
                  defaultValue={centsToInput(initial?.minTotal ?? 0)}
                  onFocus={(e) => e.target.select()}
                  className='text-right tabular-nums'
                />
                <FieldDescription>0 = sin mínimo.</FieldDescription>
                <FieldError>{errors?.minTotal?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors?.usageLimit}>
                <FieldLabel htmlFor='cp-limit'>Límite de usos</FieldLabel>
                <Input
                  id='cp-limit'
                  name='usageLimit'
                  type='number'
                  min={1}
                  step={1}
                  defaultValue={initial?.usageLimit ?? ''}
                  placeholder='Ilimitado'
                  className='text-right tabular-nums'
                />
                <FieldDescription>
                  {coupon?.usedCount ? `Usado ${coupon.usedCount} ${coupon.usedCount === 1 ? 'vez' : 'veces'}.` : 'Vacío = sin límite.'}
                </FieldDescription>
                <FieldError>{errors?.usageLimit?.[0]}</FieldError>
              </Field>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.expiresAt}>
                <FieldLabel htmlFor='cp-exp'>Vigente hasta</FieldLabel>
                <Input
                  id='cp-exp'
                  name='expiresAt'
                  type='date'
                  min={coupon ? undefined : today}
                  defaultValue={initial?.expiresDay ?? ''}
                  className='dark:[color-scheme:dark]'
                />
                <FieldDescription>Vacío = sin vencimiento.</FieldDescription>
                <FieldError>{errors?.expiresAt?.[0]}</FieldError>
              </Field>
              <Field orientation='horizontal' className='self-start sm:pt-6'>
                <FieldLabel htmlFor='cp-active' className='flex-1'>
                  Activo
                </FieldLabel>
                <Switch id='cp-active' aria-label='Activo' checked={isActive} onCheckedChange={setIsActive} />
                <input type='hidden' name='isActive' value={isActive ? 'on' : ''} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              {coupon ? 'Guardar cambios' : 'Crear cupón'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
