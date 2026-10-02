'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { PlanLimits } from '@/db/schema/platform'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { centsToInput } from '@/lib/money'
import { MODULE_KEYS, MODULES } from '@/lib/modules'
import { savePlan } from '../actions'

type Plan = {
  id: string
  slug: string
  name: string
  description: string | null
  priceMonthly: number
  priceYearly: number
  trialDays: number
  sortOrder: number
  modules: string[]
  limits: PlanLimits
  features: string[]
  highlighted: boolean
  isActive: boolean
  stripePriceMonthlyId: string | null
  stripePriceYearlyId: string | null
}

export function PlanEditor({ plan }: { plan: Plan }) {
  const [state, action, pending] = useActionState(savePlan.bind(null, plan.id), null)
  const [highlighted, setHighlighted] = useState(plan.highlighted)
  const [active, setActive] = useState(plan.isActive)
  useActionFeedback(state)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between text-base'>
          {plan.name} <span className='font-mono text-[0.65rem] text-muted-foreground'>{plan.slug}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <div className='grid grid-cols-[1fr_5rem] gap-3'>
              <Field>
                <FieldLabel>Nombre</FieldLabel>
                <Input name='name' defaultValue={plan.name} />
              </Field>
              <Field>
                <FieldLabel>Orden</FieldLabel>
                <Input name='sortOrder' type='number' defaultValue={plan.sortOrder} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Input name='description' defaultValue={plan.description ?? ''} />
            </Field>
            <div className='grid grid-cols-3 gap-3'>
              <Field>
                <FieldLabel>Mensual</FieldLabel>
                <Input name='priceMonthly' inputMode='decimal' defaultValue={centsToInput(plan.priceMonthly)} />
              </Field>
              <Field>
                <FieldLabel>Anual</FieldLabel>
                <Input name='priceYearly' inputMode='decimal' defaultValue={centsToInput(plan.priceYearly)} />
              </Field>
              <Field>
                <FieldLabel>Prueba (días)</FieldLabel>
                <Input name='trialDays' type='number' defaultValue={plan.trialDays} />
              </Field>
            </div>
            <div className='grid grid-cols-4 gap-2'>
              {(['branches', 'users', 'products', 'registers'] as const).map((k) => (
                <Field key={k}>
                  <FieldLabel className='text-[0.65rem]'>
                    {{ branches: 'Sucursales', users: 'Usuarios', products: 'Productos', registers: 'Cajas' }[k]}
                  </FieldLabel>
                  <Input name={k} type='number' min={-1} defaultValue={plan.limits[k]} />
                </Field>
              ))}
            </div>
            <FieldDescription className='-mt-2'>−1 = ilimitado</FieldDescription>
            <Field>
              <FieldLabel>Módulos incluidos</FieldLabel>
              <div className='grid grid-cols-2 gap-1.5'>
                {MODULE_KEYS.map((k) => (
                  <label key={k} className='flex items-center gap-2 text-xs'>
                    <Checkbox name='modules' value={k} defaultChecked={plan.modules.includes(k)} />
                    {MODULES[k].name}
                  </label>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel>Características (una por línea)</FieldLabel>
              <Textarea name='features' rows={5} defaultValue={plan.features.join('\n')} />
            </Field>
            <div className='grid gap-3'>
              <Field>
                <FieldLabel>Stripe price mensual</FieldLabel>
                <Input name='stripePriceMonthlyId' defaultValue={plan.stripePriceMonthlyId ?? ''} placeholder='price_…' className='font-mono' />
              </Field>
              <Field>
                <FieldLabel>Stripe price anual</FieldLabel>
                <Input name='stripePriceYearlyId' defaultValue={plan.stripePriceYearlyId ?? ''} placeholder='price_…' className='font-mono' />
              </Field>
            </div>
            <div className='flex flex-wrap gap-6 text-xs'>
              <label className='flex items-center gap-2'>
                <Switch checked={highlighted} onCheckedChange={setHighlighted} /> Destacado
                <input type='hidden' name='highlighted' value={highlighted ? 'on' : ''} />
              </label>
              <label className='flex items-center gap-2'>
                <Switch checked={active} onCheckedChange={setActive} /> Activo
                <input type='hidden' name='isActive' value={active ? 'on' : ''} />
              </label>
            </div>
            <Button type='submit' size='lg' disabled={pending}>
              {pending && <Loader2 className='animate-spin' />}
              Guardar plan
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
