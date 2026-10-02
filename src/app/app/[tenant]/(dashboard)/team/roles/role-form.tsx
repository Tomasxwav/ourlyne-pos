'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { MODULES } from '@/lib/modules'
import { PERMISSION_GROUPS } from '@/lib/permissions'
import { saveRole } from '../actions'

export function RoleForm({
  slug,
  role,
  activeModules,
}: {
  slug: string
  role?: { id: string; name: string; description: string | null; permissions: string[] }
  activeModules: string[]
}) {
  const [state, action, pending] = useActionState(saveRole.bind(null, slug, role?.id ?? null), null)
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state)

  const toggle = (perm: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(perm)
      else next.delete(perm)
      return next
    })

  return (
    <form action={action} className='grid gap-4'>
      {[...selected].map((p) => (
        <input key={p} type='hidden' name='permissions' value={p} />
      ))}
      <Card>
        <CardContent>
          <FieldGroup className='sm:flex-row'>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='role-name'>Nombre del rol</FieldLabel>
              <Input id='role-name' name='name' defaultValue={role?.name} required />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor='role-desc'>Descripción</FieldLabel>
              <Input id='role-desc' name='description' defaultValue={role?.description ?? ''} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
          const keys = Object.keys(perms)
          const all = keys.every((k) => selected.has(k))
          return (
            <Card key={group}>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-sm'>{group}</CardTitle>
                <button
                  type='button'
                  className='text-[0.7rem] font-medium text-gold-deep hover:underline dark:text-gold'
                  onClick={() => keys.forEach((k) => toggle(k, !all))}
                >
                  {all ? 'Quitar todos' : 'Seleccionar todos'}
                </button>
              </CardHeader>
              <CardContent className='space-y-2.5'>
                {Object.entries(perms).map(([key, def]) => {
                  const mod = 'module' in def ? (def.module as keyof typeof MODULES) : undefined
                  const off = mod && !activeModules.includes(mod)
                  return (
                    <label key={key} className='flex items-start gap-2.5 text-xs'>
                      <Checkbox checked={selected.has(key)} onCheckedChange={(v) => toggle(key, Boolean(v))} className='mt-0.5' />
                      <span>
                        {def.label}
                        {off && (
                          <span className='block text-[0.65rem] text-muted-foreground'>
                            Módulo {MODULES[mod].name} inactivo
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={`/app/${slug}/team/roles`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          Cancelar
        </Link>
        <Button type='submit' size='lg' disabled={pending}>
          {pending && <Loader2 className='animate-spin' />}
          Guardar rol
        </Button>
      </div>
    </form>
  )
}
