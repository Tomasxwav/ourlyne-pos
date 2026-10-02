import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, desc, eq } from 'drizzle-orm'
import { ShieldCheck } from 'lucide-react'
import { db } from '@/db'
import { invitations, members, roles } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { limitLabel } from '@/lib/plans'
import { initials } from '@/lib/utils'
import { requirePermission } from '@/server/tenant'
import { InvitationRow, InviteDialog, MemberActions } from './team-forms'

export const metadata: Metadata = { title: 'Equipo' }

export default async function TeamPage(props: PageProps<'/app/[tenant]/team'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'team.manage')

  const [memberRows, inviteRows, roleRows] = await Promise.all([
    db.query.members.findMany({
      where: eq(members.tenantId, ctx.tenant.id),
      with: { user: true, role: true, branch: true },
      orderBy: [asc(members.createdAt)],
    }),
    db.query.invitations.findMany({
      where: and(eq(invitations.tenantId, ctx.tenant.id), eq(invitations.status, 'pending')),
      with: { role: true },
      orderBy: [desc(invitations.createdAt)],
    }),
    db.query.roles.findMany({ where: eq(roles.tenantId, ctx.tenant.id), orderBy: [asc(roles.createdAt)] }),
  ])

  const active = memberRows.filter((m) => m.isActive).length
  const roleOptions = roleRows.map((r) => ({ id: r.id, name: r.name, key: r.key }))
  const branchOptions = ctx.branches.map((b) => ({ id: b.id, name: b.name }))

  return (
    <>
      <PageHeader
        title='Equipo'
        description={`${active + inviteRows.length} de ${limitLabel(ctx.plan?.limits.users ?? -1)} usuarios de tu plan (incluye invitaciones).`}
        actions={
          <>
            <Link href={`/app/${slug}/team/roles`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              <ShieldCheck /> Roles y permisos
            </Link>
            <InviteDialog slug={slug} roles={roleOptions.filter((r) => r.key !== 'owner')} />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Miembros</CardTitle>
        </CardHeader>
        <CardContent className='divide-y px-0'>
          {memberRows.map((m) => (
            <div key={m.id} className='flex flex-wrap items-center gap-3 px-4 py-3'>
              <span className='flex size-9 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold-deep dark:text-gold'>
                {initials(m.user.name)}
              </span>
              <div className='min-w-0 flex-1'>
                <p className='flex items-center gap-2 text-sm font-medium'>
                  {m.user.name}
                  {m.userId === ctx.user.id && <span className='text-xs text-muted-foreground'>(tú)</span>}
                </p>
                <p className='truncate text-xs text-muted-foreground'>{m.user.email}</p>
              </div>
              <div className='flex flex-wrap items-center gap-1.5'>
                <StatusBadge tone={m.role.key === 'owner' ? 'gold' : 'info'}>{m.role.name}</StatusBadge>
                {m.branch && <StatusBadge>{m.branch.name}</StatusBadge>}
                {!m.isActive && <StatusBadge tone='danger'>Sin acceso</StatusBadge>}
              </div>
              <span className='hidden w-24 text-right text-xs text-muted-foreground md:block'>
                {format(m.createdAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}
              </span>
              <MemberActions
                slug={slug}
                member={{
                  id: m.id,
                  name: m.user.name,
                  roleId: m.roleId,
                  branchId: m.branchId,
                  pin: m.pin,
                  isActive: m.isActive,
                  isOwner: m.role.key === 'owner',
                  isSelf: m.userId === ctx.user.id,
                }}
                roles={roleOptions}
                branches={branchOptions}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Invitaciones pendientes</CardTitle>
          <CardDescription>Comparte el enlace con la persona invitada. Expira en 7 días.</CardDescription>
        </CardHeader>
        <CardContent className='divide-y px-0'>
          {inviteRows.length === 0 && (
            <p className='px-4 py-6 text-center text-xs text-muted-foreground'>No hay invitaciones pendientes.</p>
          )}
          {inviteRows.map((i) => (
            <InvitationRow
              key={i.id}
              slug={slug}
              invitation={{
                id: i.id,
                email: i.email,
                role: i.role.name,
                token: i.token,
                expiresAt: i.expiresAt.toISOString(),
                expired: i.expiresAt < new Date(),
              }}
            />
          ))}
        </CardContent>
      </Card>
    </>
  )
}
