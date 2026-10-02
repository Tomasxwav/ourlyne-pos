'use client'

import { useActionState, useState } from 'react'
import { Loader2, SlidersHorizontal } from 'lucide-react'
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
import { formatQty } from '@/lib/money'
import { cn } from '@/lib/utils'
import { adjustStock } from './actions'
import { ADJUST_MODE_UI, ADJUST_MODES, type AdjustMode } from './labels'

export function AdjustDialog({
  slug,
  product,
  branchName,
  allowNegative,
}: {
  slug: string
  product: { id: string; name: string; unit: string; stock: number }
  branchName: string
  allowNegative: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AdjustMode>('in')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(adjustStock.bind(null, slug), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false)
      setQty('')
      setNote('')
      setMode('in')
      setFormKey((k) => k + 1)
    },
  })

  const n = Number(qty)
  const valid = qty !== '' && Number.isFinite(n) && n >= 0
  const result = !valid
    ? null
    : mode === 'in'
      ? product.stock + n
      : mode === 'count'
        ? n
        : product.stock - n
  const delta = result === null ? 0 : result - product.stock
  const blocked = result !== null && result < 0 && !allowNegative

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='sm' aria-label={`Ajustar existencia de ${product.name}`} />}>
        <SlidersHorizontal />
        <span className='hidden 2xl:inline'>Ajustar</span>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Ajustar existencia</DialogTitle>
          <DialogDescription>
            {product.name} · {branchName}
          </DialogDescription>
        </DialogHeader>
        <form key={formKey} action={action}>
          <input type='hidden' name='productId' value={product.id} />
          <input type='hidden' name='mode' value={mode} />
          <FieldGroup>
            <div role='radiogroup' aria-label='Tipo de ajuste' className='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
              {ADJUST_MODES.map((m) => (
                <button
                  key={m}
                  type='button'
                  role='radio'
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:border-gold/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30',
                    mode === m && 'border-gold bg-gold/15 text-gold-deep ring-1 ring-gold hover:text-gold-deep dark:text-gold dark:hover:text-gold',
                  )}
                >
                  {ADJUST_MODE_UI[m].label}
                </button>
              ))}
            </div>
            <Field data-invalid={!!errors?.quantity}>
              <FieldLabel htmlFor='adj-qty'>{mode === 'count' ? 'Cantidad contada' : 'Cantidad'}</FieldLabel>
              <Input
                id='adj-qty'
                name='quantity'
                type='number'
                min={0}
                step='any'
                inputMode='decimal'
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
                required
                className='text-right tabular-nums'
              />
              <FieldDescription>{ADJUST_MODE_UI[mode].hint}</FieldDescription>
              <FieldError>{errors?.quantity?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!errors?.note}>
              <FieldLabel htmlFor='adj-note'>Motivo</FieldLabel>
              <Textarea
                id='adj-note'
                name='note'
                rows={2}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mode === 'waste' ? 'Ej. producto caducado' : 'Ej. corrección por conteo semanal'}
              />
              <FieldError>{errors?.note?.[0]}</FieldError>
            </Field>
            <dl className='grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-xs'>
              <div>
                <dt className='text-muted-foreground'>Actual</dt>
                <dd className='mt-0.5 font-heading text-base font-semibold tabular-nums'>
                  {formatQty(product.stock, product.unit)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>Movimiento</dt>
                <dd
                  className={cn(
                    'mt-0.5 font-heading text-base font-semibold tabular-nums',
                    delta > 0 && 'text-success',
                    delta < 0 && 'text-destructive',
                  )}
                >
                  {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                  {formatQty(Math.abs(Math.round(delta * 1000) / 1000))}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>Resultado</dt>
                <dd className={cn('mt-0.5 font-heading text-base font-semibold tabular-nums', blocked && 'text-destructive')}>
                  {result === null ? '—' : formatQty(Math.round(result * 1000) / 1000, product.unit)}
                </dd>
              </div>
            </dl>
            {blocked && (
              <p className='text-xs text-destructive'>
                La existencia quedaría negativa y tu negocio no permite inventario negativo.
              </p>
            )}
          </FieldGroup>
          <DialogFooter className='mt-6'>
            <Button type='submit' size='lg' disabled={pending || blocked || !valid}>
              {pending && <Loader2 className='animate-spin' />}
              Registrar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
