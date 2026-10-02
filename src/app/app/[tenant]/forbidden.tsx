import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function Forbidden() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center'>
      <span className='flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep'>
        <ShieldOff className='size-6' />
      </span>
      <h1 className='text-gradient text-3xl font-bold'>Sin acceso</h1>
      <p className='max-w-sm text-sm text-muted-foreground'>
        Tu rol no tiene permiso para ver esta sección. Pide a un administrador
        que lo habilite.
      </p>
      <Link href='/app' className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        Volver al inicio
      </Link>
    </div>
  )
}
