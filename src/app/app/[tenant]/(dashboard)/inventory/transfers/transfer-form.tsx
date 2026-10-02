'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Loader2, PackageOpen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { formatQty } from '@/lib/money'
import { cn } from '@/lib/utils'
import { getBranchStock, searchInventoryProducts, transferStock } from '../actions'
import { ProductPicker, type PickerItem } from '@/components/app/product-picker'

type Line = { product: PickerItem; quantity: string }

export function TransferForm({
  slug,
  branches,
  defaultFrom,
  allowNegative,
}: {
  slug: string
  branches: { id: string; name: string }[]
  defaultFrom: string
  allowNegative: boolean
}) {
  const [fromId, setFromId] = useState(defaultFrom)
  const [toId, setToId] = useState(branches.find((b) => b.id !== defaultFrom)?.id ?? '')
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const [refreshing, startRefresh] = useTransition()

  const changeFrom = (id: string) => {
    setFromId(id)
    if (id === toId) setToId(branches.find((b) => b.id !== id)?.id ?? '')
    if (!lines.length) return
    startRefresh(async () => {
      const stock = await getBranchStock(
        slug,
        id,
        lines.map((l) => l.product.id),
      )
      setLines((prev) => prev.map((l) => ({ ...l, product: { ...l.product, stock: stock[l.product.id] ?? 0 } })))
    })
  }

  const update = (id: string, quantity: string) =>
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, quantity } : l)))

  const invalid = lines.some((l) => {
    const n = Number(l.quantity)
    return !(n > 0) || (!allowNegative && n > l.product.stock + 1e-9)
  })
  const units = lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0)

  const submit = () =>
    start(async () => {
      const res = await transferStock(slug, {
        fromBranchId: fromId,
        toBranchId: toId,
        note,
        lines: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(res.message ?? 'Traspaso registrado')
      setLines([])
      setNote('')
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Nuevo traspaso</CardTitle>
        <CardDescription>Mueve existencias entre sucursales. Se registra una salida en el origen y una entrada en el destino.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]'>
          <Field>
            <FieldLabel htmlFor='tr-from'>Origen</FieldLabel>
            <NativeSelect id='tr-from' value={fromId} onChange={(e) => changeFrom(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <ArrowRight aria-hidden className='mx-auto mb-1.5 hidden size-4 text-gold-deep sm:block dark:text-gold' />
          <Field>
            <FieldLabel htmlFor='tr-to'>Destino</FieldLabel>
            <NativeSelect id='tr-to' value={toId} onChange={(e) => setToId(e.target.value)}>
              {branches
                .filter((b) => b.id !== fromId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>

        <div className='space-y-2'>
          <ProductPicker
            key={fromId}
            search={(q) => searchInventoryProducts(slug, q, fromId)}
            excludeIds={lines.map((l) => l.product.id)}
            onPick={(product) => setLines((prev) => [...prev, { product, quantity: '1' }])}
          />
          {lines.length === 0 ? (
            <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground'>
              <PackageOpen className='size-5 text-gold-deep dark:text-gold' />
              Busca y agrega los productos a traspasar.
            </div>
          ) : (
            <ul className={cn('divide-y rounded-lg border', refreshing && 'opacity-60')}>
              {lines.map((l) => {
                const n = Number(l.quantity)
                const over = !allowNegative && n > l.product.stock + 1e-9
                return (
                  <li key={l.product.id} className='flex items-center gap-3 px-3 py-2 text-xs'>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate font-medium'>{l.product.name}</p>
                      <p className={cn('text-muted-foreground', over && 'text-destructive')}>
                        Disponible en origen: {formatQty(l.product.stock, l.product.unit)}
                      </p>
                    </div>
                    <Input
                      aria-label={`Cantidad de ${l.product.name}`}
                      type='number'
                      min={0}
                      step='any'
                      inputMode='decimal'
                      value={l.quantity}
                      aria-invalid={over || !(n > 0)}
                      onChange={(e) => update(l.product.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className='w-20 text-right tabular-nums'
                    />
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={`Quitar ${l.product.name}`}
                      className='text-muted-foreground hover:text-destructive'
                      onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Field>
          <FieldLabel htmlFor='tr-note'>Nota</FieldLabel>
          <Textarea
            id='tr-note'
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Opcional · ej. reabasto semanal'
          />
        </Field>

        <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-xs text-muted-foreground'>
            {lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {formatQty(Math.round(units * 1000) / 1000)} unidades
          </p>
          <Button size='lg' onClick={submit} disabled={pending || refreshing || !lines.length || invalid || !toId}>
            {pending && <Loader2 className='animate-spin' />}
            Registrar traspaso
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
