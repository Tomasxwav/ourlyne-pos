'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { deleteCoupon, toggleCoupon } from './actions'

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label={`Copiar código ${code}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          toast.success(`Código ${code} copiado`)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('No se pudo copiar el código')
        }
      }}
    >
      {copied ? <Check className='text-success' /> : <Copy />}
    </Button>
  )
}

export function CouponToggle({ slug, id, code, isActive }: { slug: string; id: string; code: string; isActive: boolean }) {
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useState(isActive)
  const [prev, setPrev] = useState(isActive)
  if (prev !== isActive) {
    setPrev(isActive)
    setOptimistic(isActive)
  }
  return (
    <Switch
      checked={optimistic}
      disabled={pending}
      aria-label={optimistic ? `Desactivar ${code}` : `Activar ${code}`}
      onCheckedChange={(v) => {
        setOptimistic(v)
        start(async () => {
          const res = await toggleCoupon(slug, id)
          if (res.ok) toast.success(res.message ?? 'Cupón actualizado')
          else {
            setOptimistic(!v)
            toast.error(res.error)
          }
        })
      }}
    />
  )
}

export function DeleteCouponButton({ slug, id, code, used }: { slug: string; id: string; code: string; used: number }) {
  return (
    <ConfirmAction
      title={used ? `¿Desactivar ${code}?` : `¿Eliminar ${code}?`}
      description={
        used
          ? `Este cupón se ha usado ${used} ${used === 1 ? 'vez' : 'veces'}; se desactivará para conservar el historial de ventas.`
          : 'El cupón se eliminará de forma permanente.'
      }
      confirmLabel={used ? 'Desactivar' : 'Eliminar'}
      action={deleteCoupon.bind(null, slug, id)}
      trigger={
        <Button
          variant='ghost'
          size='icon'
          aria-label={`Eliminar ${code}`}
          className='text-muted-foreground hover:text-destructive'
        >
          <Trash2 />
        </Button>
      }
    />
  )
}
