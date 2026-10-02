'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/server/action'

/** Botón con diálogo de confirmación que ejecuta una Server Action sin argumentos. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive = true,
  success,
  trigger,
  onDone,
}: {
  action: () => Promise<ActionResult<unknown>>
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  success?: string
  trigger: React.ReactElement
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await action()
                if (res.ok) {
                  toast.success(res.message ?? success ?? 'Listo')
                  setOpen(false)
                  onDone?.()
                } else toast.error(res.error)
              })
            }
          >
            {pending && <Loader2 className='animate-spin' />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
