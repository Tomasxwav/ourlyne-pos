'use client'

import { useActionState, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { cn } from '@/lib/utils'
import { deleteCategory, saveCategory } from '../products/actions'

export const SWATCHES = [
  '#d2b68a', '#c2904b', '#222d52', '#3f56a6', '#5b6b9a', '#1f9a80',
  '#7a5fc0', '#c0506a', '#e07a3f', '#4f8a3a', '#a3a7b4', '#111827',
]

type Category = { id: string; name: string; color: string; sortOrder: number; products?: number }

export function CategoryDialog({ slug, category }: { slug: string; category?: Category }) {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(category?.color ?? SWATCHES[0])
  const [state, action, pending] = useActionState(saveCategory.bind(null, slug, category?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          category ? (
            <Button variant='ghost' size='icon' aria-label='Editar categoría' />
          ) : (
            <Button size='lg' />
          )
        }
      >
        {category ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Nueva categoría
          </>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field data-invalid={!!errors?.name}>
              <FieldLabel htmlFor='cat-name'>Nombre</FieldLabel>
              <Input id='cat-name' name='name' defaultValue={category?.name} required autoFocus />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Color</FieldLabel>
              <input type='hidden' name='color' value={color} />
              <div role='radiogroup' aria-label='Color' className='flex flex-wrap gap-2'>
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type='button'
                    role='radio'
                    aria-checked={color === s}
                    aria-label={s}
                    onClick={() => setColor(s)}
                    className={cn(
                      'size-7 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110',
                      color === s && 'ring-2 ring-foreground',
                    )}
                    style={{ background: s }}
                  />
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor='cat-order'>Orden</FieldLabel>
              <Input id='cat-order' name='sortOrder' type='number' defaultValue={category?.sortOrder ?? 0} />
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

export function CategoryCard({ slug, category }: { slug: string; category: Category }) {
  return (
    <div className='group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-gold/50'>
      <span aria-hidden className='absolute inset-y-0 left-0 w-1' style={{ background: category.color }} />
      <span
        className='flex size-10 items-center justify-center rounded-lg text-xs font-semibold text-white'
        style={{ background: category.color }}
      >
        {category.name.slice(0, 2).toUpperCase()}
      </span>
      <div className='min-w-0 flex-1'>
        <p className='truncate font-medium'>{category.name}</p>
        <p className='text-xs text-muted-foreground'>
          {category.products ?? 0} {category.products === 1 ? 'producto' : 'productos'}
        </p>
      </div>
      <CategoryDialog slug={slug} category={category} />
      <ConfirmAction
        title={`¿Eliminar "${category.name}"?`}
        description='Los productos de esta categoría quedarán sin categoría.'
        confirmLabel='Eliminar'
        action={deleteCategory.bind(null, slug, category.id)}
        trigger={
          <Button variant='ghost' size='icon' aria-label='Eliminar categoría' className='text-muted-foreground hover:text-destructive'>
            <Trash2 />
          </Button>
        }
      />
    </div>
  )
}
