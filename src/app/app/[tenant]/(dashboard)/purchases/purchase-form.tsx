'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, PackageOpen, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { centsToInput, formatMoney, formatQty, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import { ProductPicker, type PickerItem } from '@/components/app/product-picker'
import { savePurchaseAction, searchPurchaseProducts } from './actions'

export type PurchaseFormValues = {
  id: string
  status: 'draft' | 'ordered'
  supplierId: string | null
  branchId: string
  expectedAt: string
  notes: string | null
  paidTotal: number
  items: { productId: string; name: string; sku: string | null; unit: string; quantity: number; unitCost: number }[]
}

type Line = { key: string; productId: string; name: string; sku: string | null; unit: string; quantity: string; unitCost: string }

export function PurchaseForm({
  slug,
  purchase,
  suppliers,
  branches,
  defaultBranch,
  defaultSupplier,
  currency,
  canCreateSupplier,
}: {
  slug: string
  purchase?: PurchaseFormValues
  suppliers: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  defaultBranch: string
  defaultSupplier?: string | null
  currency: string
  canCreateSupplier: boolean
}) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState(purchase ? (purchase.supplierId ?? '') : (defaultSupplier ?? ''))
  const [branchId, setBranchId] = useState(purchase?.branchId ?? defaultBranch)
  const [expectedAt, setExpectedAt] = useState(purchase?.expectedAt ?? '')
  const [notes, setNotes] = useState(purchase?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(
    () =>
      purchase?.items.map((i, n) => ({
        key: `${i.productId}-${n}`,
        productId: i.productId,
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        quantity: String(i.quantity),
        unitCost: centsToInput(i.unitCost),
      })) ?? [],
  )
  const [pending, start] = useTransition()
  const [intent, setIntent] = useState<'draft' | 'ordered' | null>(null)
  const money = (v: number) => formatMoney(v, currency)

  const lineTotal = (l: Line) => Math.round((Number(l.quantity) || 0) * toCents(l.unitCost))
  const total = lines.reduce((a, l) => a + lineTotal(l), 0)
  const invalid = !lines.length || lines.some((l) => !(Number(l.quantity) > 0) || toCents(l.unitCost) < 0)
  const belowPaid = purchase ? total < purchase.paidTotal : false

  const add = (p: PickerItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l))
      }
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          quantity: '1',
          unitCost: centsToInput(p.cost),
        },
      ]
    })
  }

  const patch = (key: string, values: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...values } : l)))

  const submit = (status: 'draft' | 'ordered') => {
    setIntent(status)
    start(async () => {
      const res = await savePurchaseAction(slug, purchase?.id ?? null, {
        supplierId,
        branchId,
        expectedAt,
        notes,
        status,
        items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: l.unitCost })),
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(res.message ?? 'Compra guardada')
      router.push(`/app/${slug}/purchases/${res.data!.id}`)
    })
  }

  const isOrdered = purchase?.status === 'ordered'

  return (
    <div className='grid gap-4 xl:grid-cols-[1fr_20rem]'>
      <Card className='min-w-0 self-start'>
        <CardHeader>
          <CardTitle className='text-base'>Productos</CardTitle>
          <CardDescription>El costo unitario se toma del último costo registrado; ajústalo según la factura.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <ProductPicker
            key={branchId}
            search={(q) => searchPurchaseProducts(slug, q, branchId)}
            onPick={add}
            placeholder='Agregar producto por nombre, SKU o código…'
          />
          {lines.length === 0 ? (
            <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-xs text-muted-foreground'>
              <PackageOpen className='size-5 text-gold-deep dark:text-gold' />
              Busca productos de tu catálogo para agregarlos a la orden.
            </div>
          ) : (
            <div className='rounded-lg border'>
              <div className='hidden grid-cols-[1fr_5.5rem_7rem_6.5rem_1.75rem] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid'>
                <span>Producto</span>
                <span className='text-right'>Cantidad</span>
                <span className='text-right'>Costo unit.</span>
                <span className='text-right'>Importe</span>
                <span />
              </div>
              <ul className='divide-y'>
                {lines.map((l) => {
                  const qtyBad = !(Number(l.quantity) > 0)
                  return (
                    <li
                      key={l.key}
                      className='grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-xs md:grid-cols-[1fr_5.5rem_7rem_6.5rem_1.75rem]'
                    >
                      <div className='min-w-0'>
                        <p className='truncate font-medium'>{l.name}</p>
                        <p className='font-mono text-[0.65rem] text-muted-foreground'>
                          {l.sku ?? 'Sin SKU'}
                          {l.unit !== 'pz' && ` · ${l.unit}`}
                        </p>
                      </div>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={`Quitar ${l.name}`}
                        className='text-muted-foreground hover:text-destructive md:order-last'
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 />
                      </Button>
                      <div className='col-span-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2 md:col-span-3 md:grid-cols-[5.5rem_7rem_6.5rem]'>
                        <label className='grid gap-0.5'>
                          <span className='text-[0.65rem] text-muted-foreground md:sr-only'>Cantidad</span>
                          <Input
                            aria-label={`Cantidad de ${l.name}`}
                            type='number'
                            min={0}
                            step='any'
                            inputMode='decimal'
                            value={l.quantity}
                            aria-invalid={qtyBad}
                            onChange={(e) => patch(l.key, { quantity: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            className='text-right tabular-nums'
                          />
                        </label>
                        <label className='grid gap-0.5'>
                          <span className='text-[0.65rem] text-muted-foreground md:sr-only'>Costo unit.</span>
                          <Input
                            aria-label={`Costo unitario de ${l.name}`}
                            inputMode='decimal'
                            value={l.unitCost}
                            onChange={(e) => patch(l.key, { unitCost: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => patch(l.key, { unitCost: centsToInput(toCents(l.unitCost)) })}
                            className='text-right tabular-nums'
                          />
                        </label>
                        <p className='self-end pb-1 text-right font-medium tabular-nums md:self-center md:pb-0'>
                          {money(lineTotal(l))}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className='grid content-start gap-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos de la orden</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Field>
              <FieldLabel htmlFor='pur-supplier'>Proveedor</FieldLabel>
              <NativeSelect id='pur-supplier' value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value=''>Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
              {canCreateSupplier && (
                <FieldDescription>
                  ¿No aparece?{' '}
                  <Link href={`/app/${slug}/purchases/suppliers`} className='underline underline-offset-2'>
                    Da de alta un proveedor
                  </Link>
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor='pur-branch'>Sucursal que recibe</FieldLabel>
              <NativeSelect id='pur-branch' value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor='pur-expected'>Fecha esperada</FieldLabel>
              <Input
                id='pur-expected'
                type='date'
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className='dark:[color-scheme:dark]'
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='pur-notes'>Notas</FieldLabel>
              <Textarea
                id='pur-notes'
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Condiciones, número de factura…'
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='space-y-1.5 text-xs'>
            <div className='flex justify-between text-muted-foreground'>
              <span>Renglones</span>
              <span className='tabular-nums'>{lines.length}</span>
            </div>
            <div className='flex justify-between text-muted-foreground'>
              <span>Unidades</span>
              <span className='tabular-nums'>
                {formatQty(Math.round(lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0) * 1000) / 1000)}
              </span>
            </div>
            <div className='flex items-baseline justify-between border-t pt-2'>
              <span className='font-medium'>Total</span>
              <span className={cn('font-heading text-2xl font-semibold tabular-nums', belowPaid && 'text-destructive')}>
                {money(total)}
              </span>
            </div>
            {belowPaid && purchase && (
              <p className='text-destructive'>No puede ser menor a lo ya pagado ({money(purchase.paidTotal)}).</p>
            )}
          </CardContent>
        </Card>

        <div className='flex flex-col gap-2'>
          {isOrdered ? (
            <Button size='lg' className='h-9' disabled={pending || invalid || belowPaid} onClick={() => submit('ordered')}>
              {pending && <Loader2 className='animate-spin' />}
              Guardar cambios
            </Button>
          ) : (
            <>
              <Button size='lg' className='h-9' disabled={pending || invalid || belowPaid} onClick={() => submit('ordered')}>
                {pending && intent === 'ordered' ? <Loader2 className='animate-spin' /> : <Send />}
                Guardar y marcar como ordenada
              </Button>
              <Button
                variant='outline'
                size='lg'
                className='h-9'
                disabled={pending || invalid || belowPaid}
                onClick={() => submit('draft')}
              >
                {pending && intent === 'draft' && <Loader2 className='animate-spin' />}
                Guardar borrador
              </Button>
            </>
          )}
          <Link
            href={purchase ? `/app/${slug}/purchases/${purchase.id}` : `/app/${slug}/purchases`}
            className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-9' })}
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
