'use client'

import { useActionState, useState, useTransition } from 'react'
import { Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmAction } from '@/components/app/confirm-action'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import type { ActionResult } from '@/server/action'
import {
  deleteTax,
  saveBranch,
  savePaymentMethod,
  saveTax,
  setDefaultBranch,
  setDefaultTax,
  toggleBranch,
  toggleModule,
  togglePaymentMethod,
  updateBusiness,
} from './actions'

const CURRENCIES = ['MXN', 'USD', 'COP', 'PEN', 'CLP', 'ARS', 'GTQ', 'EUR']
const TIMEZONES = [
  'America/Mexico_City',
  'America/Monterrey',
  'America/Cancun',
  'America/Tijuana',
  'America/Hermosillo',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Guatemala',
  'America/New_York',
  'Europe/Madrid',
]

type Business = {
  name: string
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  logoUrl: string | null
  currency: string
  timezone: string
  receiptHeader: string | null
  receiptFooter: string | null
  pricesIncludeTax: boolean
  allowNegativeStock: boolean
}

export function BusinessForm({ slug, business }: { slug: string; business: Business }) {
  const [state, action, pending] = useActionState(updateBusiness.bind(null, slug), null)
  const [includeTax, setIncludeTax] = useState(business.pricesIncludeTax)
  const [negative, setNegative] = useState(business.allowNegativeStock)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state)

  return (
    <form action={action} className='grid gap-4'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Datos del negocio</CardTitle>
          <CardDescription>Aparecen en tus tickets y documentos.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field data-invalid={!!errors?.name}>
                <FieldLabel htmlFor='b-name'>Nombre comercial</FieldLabel>
                <Input id='b-name' name='name' defaultValue={business.name} required />
                <FieldError>{errors?.name?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor='b-tax'>RFC / ID fiscal</FieldLabel>
                <Input id='b-tax' name='taxId' defaultValue={business.taxId ?? ''} className='uppercase' />
              </Field>
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor='b-email'>Correo</FieldLabel>
                <Input id='b-email' name='email' type='email' defaultValue={business.email ?? ''} />
                <FieldError>{errors?.email?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor='b-phone'>Teléfono</FieldLabel>
                <Input id='b-phone' name='phone' defaultValue={business.phone ?? ''} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor='b-address'>Dirección</FieldLabel>
              <Input id='b-address' name='address' defaultValue={business.address ?? ''} />
            </Field>
            <Field data-invalid={!!errors?.logoUrl}>
              <FieldLabel htmlFor='b-logo'>URL del logotipo</FieldLabel>
              <Input id='b-logo' name='logoUrl' type='url' placeholder='https://…' defaultValue={business.logoUrl ?? ''} />
              <FieldError>{errors?.logoUrl?.[0]}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Regional y ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='b-currency'>Moneda</FieldLabel>
                <NativeSelect id='b-currency' name='currency' defaultValue={business.currency}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor='b-tz'>Zona horaria</FieldLabel>
                <NativeSelect id='b-tz' name='timezone' defaultValue={business.timezone}>
                  {(TIMEZONES.includes(business.timezone) ? TIMEZONES : [business.timezone, ...TIMEZONES]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field orientation='horizontal'>
              <div className='flex-1'>
                <FieldLabel htmlFor='b-inc'>Precios con impuestos incluidos</FieldLabel>
                <FieldDescription>El precio capturado ya contiene IVA (común en México).</FieldDescription>
              </div>
              <Switch id='b-inc' checked={includeTax} onCheckedChange={setIncludeTax} />
              <input type='hidden' name='pricesIncludeTax' value={includeTax ? 'on' : ''} />
            </Field>
            <Field orientation='horizontal'>
              <div className='flex-1'>
                <FieldLabel htmlFor='b-neg'>Permitir vender sin existencia</FieldLabel>
                <FieldDescription>El inventario puede quedar en negativo.</FieldDescription>
              </div>
              <Switch id='b-neg' checked={negative} onCheckedChange={setNegative} />
              <input type='hidden' name='allowNegativeStock' value={negative ? 'on' : ''} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='b-header'>Encabezado</FieldLabel>
              <Input id='b-header' name='receiptHeader' defaultValue={business.receiptHeader ?? ''} placeholder='Ej. Tostadores desde 2021' />
            </Field>
            <Field>
              <FieldLabel htmlFor='b-footer'>Pie de ticket</FieldLabel>
              <Input id='b-footer' name='receiptFooter' defaultValue={business.receiptFooter ?? ''} placeholder='¡Gracias por su compra!' />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button type='submit' size='lg' className='h-9 px-4' disabled={pending}>
          {pending && <Loader2 className='animate-spin' />}
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

/* ── Diálogo genérico ───────────────────────────────────────────────── */

function FormDialog({
  title,
  trigger,
  action,
  children,
}: {
  title: string
  trigger: React.ReactElement
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>
  children: (errors?: Record<string, string[] | undefined>) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>{children(errors)}</FieldGroup>
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

function useRun() {
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) toast.success(res.message ?? 'Listo')
      else toast.error(res.error)
    })
  return { pending, run }
}

/* ── Sucursales ─────────────────────────────────────────────────────── */

type Branch = { id: string; name: string; code: string | null; address: string | null; phone: string | null; isDefault: boolean; isActive: boolean }

export function BranchDialog({ slug, branch }: { slug: string; branch?: Branch }) {
  return (
    <FormDialog
      title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
      action={saveBranch.bind(null, slug, branch?.id ?? null)}
      trigger={
        branch ? (
          <Button variant='ghost' size='icon' aria-label='Editar sucursal'>
            <Pencil />
          </Button>
        ) : (
          <Button size='lg'>
            <Plus /> Nueva sucursal
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          <div className='grid gap-4 sm:grid-cols-[1fr_6rem]'>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='br-name'>Nombre</FieldLabel>
              <Input id='br-name' name='name' defaultValue={branch?.name} autoFocus />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor='br-code'>Clave</FieldLabel>
              <Input id='br-code' name='code' defaultValue={branch?.code ?? ''} className='uppercase' maxLength={10} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor='br-address'>Dirección</FieldLabel>
            <Input id='br-address' name='address' defaultValue={branch?.address ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor='br-phone'>Teléfono</FieldLabel>
            <Input id='br-phone' name='phone' defaultValue={branch?.phone ?? ''} />
          </Field>
        </>
      )}
    </FormDialog>
  )
}

export function BranchRow({ slug, branch }: { slug: string; branch: Branch }) {
  const { pending, run } = useRun()
  return (
    <div className='flex flex-wrap items-center gap-3 px-4 py-3'>
      <div className='min-w-0 flex-1'>
        <p className='flex items-center gap-2 text-sm font-medium'>
          {branch.name}
          {branch.code && <span className='font-mono text-[0.65rem] text-muted-foreground'>{branch.code}</span>}
          {branch.isDefault && <StatusBadge tone='gold'>Principal</StatusBadge>}
          {!branch.isActive && <StatusBadge>Inactiva</StatusBadge>}
        </p>
        <p className='truncate text-xs text-muted-foreground'>{branch.address ?? 'Sin dirección'}</p>
      </div>
      {!branch.isDefault && (
        <Button variant='ghost' size='sm' disabled={pending} onClick={() => run(() => setDefaultBranch(slug, branch.id))}>
          <Star /> Hacer principal
        </Button>
      )}
      {!branch.isDefault && (
        <Button variant='ghost' size='sm' disabled={pending} onClick={() => run(() => toggleBranch(slug, branch.id))}>
          {branch.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      )}
      <BranchDialog slug={slug} branch={branch} />
    </div>
  )
}

/* ── Impuestos ──────────────────────────────────────────────────────── */

type Tax = { id: string; name: string; rateBps: number; isDefault: boolean }

export function TaxDialog({ slug, tax }: { slug: string; tax?: Tax }) {
  return (
    <FormDialog
      title={tax ? 'Editar impuesto' : 'Nuevo impuesto'}
      action={saveTax.bind(null, slug, tax?.id ?? null)}
      trigger={
        tax ? (
          <Button variant='ghost' size='icon' aria-label='Editar impuesto'>
            <Pencil />
          </Button>
        ) : (
          <Button size='lg'>
            <Plus /> Nuevo impuesto
          </Button>
        )
      }
    >
      {(errors) => (
        <div className='grid gap-4 sm:grid-cols-[1fr_7rem]'>
          <Field data-invalid={!!errors?.name}>
            <FieldLabel htmlFor='tx-name'>Nombre</FieldLabel>
            <Input id='tx-name' name='name' defaultValue={tax?.name} placeholder='IVA 16%' autoFocus />
          </Field>
          <Field data-invalid={!!errors?.rate}>
            <FieldLabel htmlFor='tx-rate'>Tasa (%)</FieldLabel>
            <Input id='tx-rate' name='rate' type='number' step='0.01' min={0} max={100} defaultValue={tax ? tax.rateBps / 100 : ''} />
            <FieldError>{errors?.rate?.[0]}</FieldError>
          </Field>
        </div>
      )}
    </FormDialog>
  )
}

export function TaxRow({ slug, tax }: { slug: string; tax: Tax }) {
  const { pending, run } = useRun()
  return (
    <div className='flex items-center gap-3 px-4 py-3'>
      <span className='flex size-9 items-center justify-center rounded-lg bg-gold/15 font-mono text-xs font-semibold text-gold-deep dark:text-gold'>
        {tax.rateBps / 100}%
      </span>
      <p className='flex flex-1 items-center gap-2 text-sm font-medium'>
        {tax.name}
        {tax.isDefault && <StatusBadge tone='gold'>Predeterminado</StatusBadge>}
      </p>
      {!tax.isDefault && (
        <Button variant='ghost' size='sm' disabled={pending} onClick={() => run(() => setDefaultTax(slug, tax.id))}>
          <Star /> Predeterminar
        </Button>
      )}
      <TaxDialog slug={slug} tax={tax} />
      <ConfirmAction
        title={`¿Eliminar ${tax.name}?`}
        description='Los productos con este impuesto quedarán exentos.'
        confirmLabel='Eliminar'
        action={deleteTax.bind(null, slug, tax.id)}
        trigger={
          <Button variant='ghost' size='icon' aria-label='Eliminar impuesto' className='text-muted-foreground hover:text-destructive'>
            <Trash2 />
          </Button>
        }
      />
    </div>
  )
}

/* ── Métodos de pago ────────────────────────────────────────────────── */

const METHOD_TYPES = [
  { value: 'cash', label: 'Efectivo (entra a caja)' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'credit', label: 'Crédito de cliente' },
  { value: 'other', label: 'Otro (vales, apps…)' },
]

type Method = { id: string; name: string; type: string; isActive: boolean }

export function MethodDialog({ slug, method }: { slug: string; method?: Method }) {
  return (
    <FormDialog
      title={method ? 'Editar método' : 'Nuevo método de pago'}
      action={savePaymentMethod.bind(null, slug, method?.id ?? null)}
      trigger={
        method ? (
          <Button variant='ghost' size='icon' aria-label='Editar método'>
            <Pencil />
          </Button>
        ) : (
          <Button size='lg'>
            <Plus /> Nuevo método
          </Button>
        )
      }
    >
      {(errors) => (
        <>
          <Field data-invalid={!!errors?.name}>
            <FieldLabel htmlFor='pm-name'>Nombre</FieldLabel>
            <Input id='pm-name' name='name' defaultValue={method?.name} placeholder='Ej. Vales de despensa' autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor='pm-type'>Tipo</FieldLabel>
            <NativeSelect id='pm-type' name='type' defaultValue={method?.type ?? 'other'}>
              {METHOD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>Solo el efectivo se suma al arqueo de caja.</FieldDescription>
          </Field>
        </>
      )}
    </FormDialog>
  )
}

export function MethodRow({ slug, method }: { slug: string; method: Method }) {
  const { pending, run } = useRun()
  return (
    <div className='flex items-center gap-3 px-4 py-3'>
      <div className='flex-1'>
        <p className='text-sm font-medium'>{method.name}</p>
        <p className='text-xs text-muted-foreground'>{METHOD_TYPES.find((t) => t.value === method.type)?.label}</p>
      </div>
      <Switch
        checked={method.isActive}
        disabled={pending}
        onCheckedChange={() => run(() => togglePaymentMethod(slug, method.id))}
        aria-label={method.isActive ? 'Desactivar' : 'Activar'}
      />
      <MethodDialog slug={slug} method={method} />
    </div>
  )
}

/* ── Módulos ────────────────────────────────────────────────────────── */

export function ModuleSwitch({ slug, moduleKey, enabled, locked }: { slug: string; moduleKey: string; enabled: boolean; locked: boolean }) {
  const { pending, run } = useRun()
  return (
    <Switch
      checked={enabled && !locked}
      disabled={pending || locked}
      onCheckedChange={(v) => run(() => toggleModule(slug, moduleKey, v))}
      aria-label='Activar módulo'
    />
  )
}
