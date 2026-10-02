'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Loader2, LockOpen, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Logo, PulseBadge } from '@/components/brand/logo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { openRegister, selectRegister } from './actions'

type RegisterOption = {
  id: string
  name: string
  session: { openedBy: string; openedAt: string; opening: number } | null
}

export function RegisterGate({
  slug,
  branchName,
  registers,
  currency,
  canOperate,
}: {
  slug: string
  branchName: string
  registers: RegisterOption[]
  currency: string
  canOperate: boolean
}) {
  const [selected, setSelected] = useState(registers.find((r) => !r.session)?.id ?? registers[0]?.id)
  const [amount, setAmount] = useState('1000.00')
  const [pending, start] = useTransition()
  const current = registers.find((r) => r.id === selected)

  const submit = () =>
    start(async () => {
      if (!current) return
      const res = current.session ? await selectRegister(slug, current.id) : await openRegister(slug, current.id, amount)
      if (!res.ok) toast.error(res.error)
      else toast.success(current.session ? `Usando ${current.name}` : `${current.name} abierta`)
    })

  return (
    <div className='relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden'>
      <div aria-hidden className='absolute -top-40 left-1/2 -z-10 size-[44rem] -translate-x-1/2 rounded-full bg-gold/15 blur-3xl' />
      <header className='flex items-center justify-between px-6 py-5'>
        <Logo href={null} />
        <Link href={`/app/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          <ArrowLeft /> Volver al panel
        </Link>
      </header>
      <main className='mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16'>
        <PulseBadge>{branchName}</PulseBadge>
        <h1 className='text-gradient mt-4 text-4xl font-bold'>Abre tu caja para vender</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Selecciona la caja registradora y captura el fondo inicial en efectivo.
        </p>

        {registers.length === 0 ? (
          <p className='mt-8 rounded-lg border p-4 text-sm text-muted-foreground'>
            Esta sucursal no tiene cajas. Créala en <strong>Cajas</strong>.
          </p>
        ) : (
          <div className='mt-8 grid gap-3'>
            {registers.map((r) => (
              <button
                key={r.id}
                type='button'
                onClick={() => setSelected(r.id)}
                className={cn(
                  'flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-gold/60',
                  selected === r.id && 'border-gold bg-gold/5 shadow-lg shadow-gold/10',
                )}
              >
                <span className='flex size-10 items-center justify-center rounded-lg bg-velvet text-gold'>
                  <Wallet className='size-5' />
                </span>
                <span className='flex-1'>
                  <span className='block font-medium'>{r.name}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {r.session
                      ? `Abierta por ${r.session.openedBy} ${formatDistanceToNow(new Date(r.session.openedAt), { locale: es, addSuffix: true })}`
                      : 'Cerrada'}
                  </span>
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[0.65rem] font-medium',
                    r.session ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {r.session ? 'Abierta' : 'Cerrada'}
                </span>
              </button>
            ))}
          </div>
        )}

        {current && !current.session && (
          <label className='mt-6 block'>
            <span className='text-xs font-medium'>Fondo inicial en efectivo</span>
            <Input
              inputMode='decimal'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              className='mt-1.5 h-11 text-right font-heading text-xl tabular-nums'
            />
            <span className='mt-1 block text-xs text-muted-foreground'>{formatMoney(Math.round(Number(amount) * 100) || 0, currency)}</span>
          </label>
        )}

        <Button
          size='lg'
          className='mt-6 h-11 text-sm'
          disabled={!current || pending || !canOperate}
          onClick={submit}
        >
          {pending ? <Loader2 className='animate-spin' /> : <LockOpen />}
          {current?.session ? `Usar ${current.name}` : 'Abrir caja'}
        </Button>
        {!canOperate && (
          <p className='mt-3 text-xs text-destructive'>Tu rol no tiene permiso para operar cajas.</p>
        )}
      </main>
    </div>
  )
}
