import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { invitations, members, user } from '@/db/schema'
import { Logo, PulseBadge } from '@/components/brand/logo'
import { Button, buttonVariants } from '@/components/ui/button'
import { getSession } from '@/server/session'

export const metadata: Metadata = { title: 'Invitación' }

async function acceptInvitation(token: string) {
  'use server'
  const session = await getSession()
  if (!session) redirect(`/sign-in?next=/invite/${token}`)
  const inv = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
    with: { tenant: true },
  })
  if (!inv || inv.status !== 'pending' || inv.expiresAt < new Date()) redirect(`/invite/${token}`)
  if (inv.email.toLowerCase() !== session.user.email.toLowerCase()) redirect(`/invite/${token}`)

  await db.transaction(async (tx) => {
    const existing = await tx.query.members.findFirst({
      where: and(eq(members.tenantId, inv.tenantId), eq(members.userId, session.user.id)),
    })
    if (!existing) {
      await tx.insert(members).values({ tenantId: inv.tenantId, userId: session.user.id, roleId: inv.roleId })
    }
    await tx.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, inv.id))
    await tx.update(user).set({ lastTenantId: inv.tenantId }).where(eq(user.id, session.user.id))
  })
  redirect(`/app/${inv.tenant.slug}`)
}

export default async function InvitePage(props: PageProps<'/invite/[token]'>) {
  const { token } = await props.params
  const [inv, session] = await Promise.all([
    db.query.invitations.findFirst({
      where: eq(invitations.token, token),
      with: { tenant: true, role: true, invitedBy: { columns: { name: true } } },
    }),
    getSession(),
  ])

  const invalid = !inv || inv.status !== 'pending' || inv.expiresAt < new Date()
  const next = encodeURIComponent(`/invite/${token}`)

  return (
    <div className='relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6'>
      <div aria-hidden className='absolute top-1/2 left-1/2 -z-10 size-[36rem] -translate-1/2 rounded-full bg-gold/15 blur-3xl' />
      <Logo className='mb-10' />
      <div className='w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl shadow-gold/5'>
        {invalid ? (
          <>
            <h1 className='text-gradient text-2xl font-bold'>Invitación no válida</h1>
            <p className='mt-3 text-sm text-muted-foreground'>
              El enlace expiró, ya fue usado o fue revocado. Pide una nueva invitación al administrador.
            </p>
            <Link href='/' className={buttonVariants({ variant: 'outline', size: 'lg', className: 'mt-6' })}>
              Ir al inicio
            </Link>
          </>
        ) : (
          <>
            <PulseBadge className='mx-auto'>Invitación</PulseBadge>
            <h1 className='text-gradient mt-4 text-2xl font-bold'>Únete a {inv.tenant.name}</h1>
            <p className='mt-3 text-sm text-muted-foreground'>
              {inv.invitedBy?.name ?? 'Un administrador'} te invitó como <strong className='text-foreground'>{inv.role.name}</strong>.
            </p>
            {!session ? (
              <div className='mt-6 grid gap-2'>
                <Link
                  href={`/sign-up?next=${next}&email=${encodeURIComponent(inv.email)}`}
                  className={buttonVariants({ size: 'lg', className: 'h-10' })}
                >
                  Crear mi cuenta
                </Link>
                <Link
                  href={`/sign-in?next=${next}&email=${encodeURIComponent(inv.email)}`}
                  className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10' })}
                >
                  Ya tengo cuenta
                </Link>
              </div>
            ) : session.user.email.toLowerCase() !== inv.email.toLowerCase() ? (
              <p className='mt-6 rounded-lg bg-destructive/10 p-3 text-xs text-destructive'>
                Esta invitación es para <strong>{inv.email}</strong>, pero iniciaste sesión como {session.user.email}.
              </p>
            ) : (
              <form action={acceptInvitation.bind(null, token)} className='mt-6'>
                <Button type='submit' size='lg' className='h-10 w-full'>
                  Aceptar invitación
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
