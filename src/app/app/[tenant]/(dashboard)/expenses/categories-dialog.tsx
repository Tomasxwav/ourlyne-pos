'use client'

import { startTransition, useActionState, useState, useTransition } from 'react'
import { Loader2, Pencil, Tags, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { cn } from '@/lib/utils'
import { deleteExpenseCategory, saveExpenseCategory } from './actions'
import { EXPENSE_SWATCHES } from './constants'

type Category = { id: string; name: string; color: string; expenses: number }

export function ExpenseCategoriesDialog({ slug, categories }: { slug: string; categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setEditing(null)
      }}
    >
      <DialogTrigger render={<Button variant='outline' size='lg' />}>
        <Tags /> Categorías
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Categorías de gasto</DialogTitle>
          <DialogDescription>Clasifica tus gastos para compararlos por concepto.</DialogDescription>
        </DialogHeader>

        <CategoryForm
          key={editing?.id ?? 'new'}
          slug={slug}
          category={editing}
          onDone={() => setEditing(null)}
        />

        <ul className='divide-y rounded-lg border'>
          {categories.length === 0 && (
            <li className='px-3 py-6 text-center text-muted-foreground'>Aún no hay categorías.</li>
          )}
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              slug={slug}
              category={c}
              editing={editing?.id === c.id}
              onEdit={() => setEditing(c)}
              onDeleted={() => editing?.id === c.id && setEditing(null)}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

/** Fila con confirmación en línea (evita anidar un diálogo de alerta dentro del diálogo). */
function CategoryRow({
  slug,
  category: c,
  editing,
  onEdit,
  onDeleted,
}: {
  slug: string
  category: Category
  editing: boolean
  onEdit: () => void
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  return (
    <li className={cn('flex items-center gap-3 px-3 py-2', editing && 'bg-gold/10', confirming && 'bg-destructive/5')}>
      <span
        aria-hidden
        className='size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--border)]'
        style={{ background: c.color }}
      />
      {confirming ? (
        <>
          <span className='min-w-0 flex-1'>
            <span className='block truncate font-medium'>¿Eliminar &quot;{c.name}&quot;?</span>
            <span className='block text-[0.65rem] text-muted-foreground'>
              {c.expenses
                ? `${c.expenses} ${c.expenses === 1 ? 'gasto quedará' : 'gastos quedarán'} sin categoría.`
                : 'La categoría no tiene gastos.'}
            </span>
          </span>
          <Button variant='ghost' disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button
            variant='destructive'
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteExpenseCategory(slug, c.id)
                if (res.ok) {
                  toast.success(res.message ?? 'Categoría eliminada')
                  onDeleted()
                } else {
                  toast.error(res.error)
                  setConfirming(false)
                }
              })
            }
          >
            {pending && <Loader2 className='animate-spin' />}
            Eliminar
          </Button>
        </>
      ) : (
        <>
          <span className='min-w-0 flex-1'>
            <span className='block truncate font-medium'>{c.name}</span>
            <span className='block text-[0.65rem] text-muted-foreground'>
              {c.expenses} {c.expenses === 1 ? 'gasto' : 'gastos'}
            </span>
          </span>
          <Button variant='ghost' size='icon' aria-label={`Editar ${c.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            aria-label={`Eliminar ${c.name}`}
            className='text-muted-foreground hover:text-destructive'
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
          </Button>
        </>
      )}
    </li>
  )
}

function CategoryForm({
  slug,
  category,
  onDone,
}: {
  slug: string
  category: Category | null
  onDone: () => void
}) {
  const [color, setColor] = useState(category?.color ?? EXPENSE_SWATCHES[0])
  const [name, setName] = useState(category?.name ?? '')
  const [state, action, pending] = useActionState(saveExpenseCategory.bind(null, slug, category?.id ?? null), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, {
    onSuccess: () => {
      setName('')
      onDone()
    },
  })

  return (
    <form
      className='grid gap-3 rounded-lg border bg-muted/30 p-3'
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => action(fd))
      }}
    >
      <Field data-invalid={!!errors?.name}>
        <FieldLabel htmlFor='ec-name'>{category ? `Editar "${category.name}"` : 'Nueva categoría'}</FieldLabel>
        <div className='flex gap-1.5'>
          <Input
            id='ec-name'
            name='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Ej. Mantenimiento'
            required
            autoComplete='off'
          />
          <Button type='submit' disabled={pending || !name.trim()}>
            {pending && <Loader2 className='animate-spin' />}
            {category ? 'Guardar' : 'Agregar'}
          </Button>
          {category && (
            <Button type='button' variant='ghost' size='icon' aria-label='Cancelar edición' onClick={onDone}>
              <X />
            </Button>
          )}
        </div>
        <FieldError>{errors?.name?.[0]}</FieldError>
      </Field>
      <input type='hidden' name='color' value={color} />
      <div role='radiogroup' aria-label='Color' className='flex flex-wrap gap-2'>
        {EXPENSE_SWATCHES.map((s) => (
          <button
            key={s}
            type='button'
            role='radio'
            aria-checked={color === s}
            aria-label={s}
            onClick={() => setColor(s)}
            className={cn(
              'size-6 rounded-full shadow-[inset_0_0_0_1px_var(--border)] ring-offset-2 ring-offset-background transition-transform hover:scale-110',
              color === s && 'ring-2 ring-foreground',
            )}
            style={{ background: s }}
          />
        ))}
      </div>
    </form>
  )
}
