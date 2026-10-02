'use client'

import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button, buttonVariants } from '@/components/ui/button'
import { deleteProduct } from './actions'

export function ProductRowActions({ slug, id, name }: { slug: string; id: string; name: string }) {
  return (
    <div className='flex justify-end gap-0.5'>
      <Link
        href={`/app/${slug}/products/${id}`}
        aria-label={`Editar ${name}`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
      >
        <Pencil />
      </Link>
      <ConfirmAction
        title={`¿Eliminar "${name}"?`}
        description='Si el producto ya tiene ventas registradas, se desactivará para conservar el historial.'
        confirmLabel='Eliminar'
        action={deleteProduct.bind(null, slug, id)}
        trigger={
          <Button variant='ghost' size='icon' aria-label={`Eliminar ${name}`} className='text-muted-foreground hover:text-destructive'>
            <Trash2 />
          </Button>
        }
      />
    </div>
  )
}
