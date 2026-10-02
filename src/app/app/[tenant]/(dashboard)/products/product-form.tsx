'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Barcode, Loader2, Wand2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PRODUCT_UNITS } from '@/lib/catalog'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput, formatMoney, toCents } from '@/lib/money'
import { saveProduct } from './actions'

export type ProductFormValues = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  categoryId: string | null
  taxId: string | null
  type: 'product' | 'service'
  unit: string
  price: number
  cost: number
  trackStock: boolean
  lowStockThreshold: number
  imageUrl: string | null
  isActive: boolean
}

export function ProductForm({
  slug,
  product,
  categories,
  taxes,
  currency,
  branchName,
}: {
  slug: string
  product?: ProductFormValues
  categories: { id: string; name: string }[]
  taxes: { id: string; name: string; isDefault: boolean }[]
  currency: string
  branchName?: string
}) {
  const [state, action, pending] = useActionState(saveProduct.bind(null, slug, product?.id ?? null), null)
  const [price, setPrice] = useState(centsToInput(product?.price ?? 0))
  const [cost, setCost] = useState(centsToInput(product?.cost ?? 0))
  const [type, setType] = useState(product?.type ?? 'product')
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true)
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [sku, setSku] = useState(product?.sku ?? '')
  const [formKey, setFormKey] = useState(0)
  const errors = state && !state.ok ? state.fieldErrors : undefined

  useActionFeedback(state, {
    onSuccess: () => {
      if (!product) {
        setFormKey((k) => k + 1)
        setPrice('0.00')
        setCost('0.00')
        setSku('')
      }
    },
  })

  const p = toCents(price)
  const c = toCents(cost)
  const margin = p ? Math.round(((p - c) / p) * 100) : 0
  const defaultTax = taxes.find((t) => t.isDefault)?.id ?? ''

  return (
    <form key={formKey} action={action} className='grid gap-4 lg:grid-cols-[1fr_20rem]'>
      <div className='grid gap-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Información general</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors?.name}>
                <FieldLabel htmlFor='name'>Nombre</FieldLabel>
                <Input id='name' name='name' defaultValue={product?.name} required autoFocus={!product} />
                <FieldError>{errors?.name?.[0]}</FieldError>
              </Field>
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field data-invalid={!!errors?.sku}>
                  <FieldLabel htmlFor='sku'>SKU</FieldLabel>
                  <div className='flex gap-1'>
                    <Input id='sku' name='sku' value={sku} onChange={(e) => setSku(e.target.value)} className='font-mono' />
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label='Generar SKU'
                      onClick={() => setSku(`P-${Date.now().toString(36).toUpperCase().slice(-6)}`)}
                    >
                      <Wand2 />
                    </Button>
                  </div>
                  <FieldError>{errors?.sku?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor='barcode'>Código de barras</FieldLabel>
                  <div className='relative'>
                    <Barcode className='absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground' />
                    <Input id='barcode' name='barcode' defaultValue={product?.barcode ?? ''} className='pl-7 font-mono' />
                  </div>
                  <FieldDescription>Escanéalo con tu lector directamente aquí.</FieldDescription>
                </Field>
              </div>
              <div className='grid gap-4 sm:grid-cols-3'>
                <Field>
                  <FieldLabel htmlFor='categoryId'>Categoría</FieldLabel>
                  <NativeSelect id='categoryId' name='categoryId' defaultValue={product?.categoryId ?? ''}>
                    <option value=''>Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor='type'>Tipo</FieldLabel>
                  <NativeSelect
                    id='type'
                    name='type'
                    value={type}
                    onChange={(e) => setType(e.target.value as 'product' | 'service')}
                  >
                    <option value='product'>Producto</option>
                    <option value='service'>Servicio</option>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor='unit'>Unidad</FieldLabel>
                  <NativeSelect id='unit' name='unit' defaultValue={product?.unit ?? 'pz'}>
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor='description'>Descripción</FieldLabel>
                <Textarea id='description' name='description' rows={3} defaultValue={product?.description ?? ''} />
              </Field>
              <Field data-invalid={!!errors?.imageUrl}>
                <FieldLabel htmlFor='imageUrl'>URL de imagen</FieldLabel>
                <Input id='imageUrl' name='imageUrl' type='url' placeholder='https://…' defaultValue={product?.imageUrl ?? ''} />
                <FieldError>{errors?.imageUrl?.[0]}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Precio e impuestos</CardTitle>
            <CardDescription>Los precios se capturan con impuestos incluidos según la configuración del negocio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Field data-invalid={!!errors?.price}>
                <FieldLabel htmlFor='price'>Precio de venta</FieldLabel>
                <Input
                  id='price'
                  name='price'
                  inputMode='decimal'
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className='text-right tabular-nums'
                />
                <FieldError>{errors?.price?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor='cost'>Costo</FieldLabel>
                <Input
                  id='cost'
                  name='cost'
                  inputMode='decimal'
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className='text-right tabular-nums'
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='taxId'>Impuesto</FieldLabel>
                <NativeSelect id='taxId' name='taxId' defaultValue={product ? (product.taxId ?? '') : defaultTax}>
                  <option value=''>Exento</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className='mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3 text-xs'>
              <div>
                <p className='text-muted-foreground'>Utilidad por unidad</p>
                <p className='mt-0.5 font-heading text-lg font-semibold tabular-nums'>{formatMoney(p - c, currency)}</p>
              </div>
              <div>
                <p className='text-muted-foreground'>Margen</p>
                <p
                  className={`mt-0.5 font-heading text-lg font-semibold tabular-nums ${margin < 0 ? 'text-destructive' : ''}`}
                >
                  {margin}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid content-start gap-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Field orientation='horizontal'>
              <FieldLabel htmlFor='isActive' className='flex-1'>
                Disponible para venta
              </FieldLabel>
              <Switch id='isActive' checked={isActive} onCheckedChange={setIsActive} />
              <input type='hidden' name='isActive' value={isActive ? 'on' : ''} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation='horizontal'>
                <FieldLabel htmlFor='trackStock' className='flex-1'>
                  Controlar existencias
                </FieldLabel>
                <Switch
                  id='trackStock'
                  checked={type === 'product' && trackStock}
                  disabled={type === 'service'}
                  onCheckedChange={setTrackStock}
                />
                <input type='hidden' name='trackStock' value={type === 'product' && trackStock ? 'on' : ''} />
              </Field>
              <Field>
                <FieldLabel htmlFor='lowStockThreshold'>Alerta de stock bajo</FieldLabel>
                <Input
                  id='lowStockThreshold'
                  name='lowStockThreshold'
                  type='number'
                  min={0}
                  step='any'
                  defaultValue={product?.lowStockThreshold ?? 5}
                />
              </Field>
              {!product && type === 'product' && trackStock && (
                <Field>
                  <FieldLabel htmlFor='initialStock'>Existencia inicial</FieldLabel>
                  <Input id='initialStock' name='initialStock' type='number' min={0} step='any' defaultValue={0} />
                  <FieldDescription>Se registra en {branchName}.</FieldDescription>
                </Field>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-2'>
          <Button type='submit' size='lg' className='h-9' disabled={pending}>
            {pending && <Loader2 className='animate-spin' />}
            {product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
          {!product && (
            <Button type='submit' name='_intent' value='another' variant='outline' size='lg' className='h-9' disabled={pending}>
              Guardar y crear otro
            </Button>
          )}
          <Link href={`/app/${slug}/products`} className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-9' })}>
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}
