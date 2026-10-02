import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, count, eq } from 'drizzle-orm'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db'
import { members, roles } from '@/db/schema'
import { ConfirmAction } from '@/components/app/confirm-action'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/server/tenant'
import { deleteRole } from '../actions'

export const metadata: Metadata = { title: 'Roles y permisos' }

export default async function RolesPage(props: PageProps<'/app/[tenant]/team/roles'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'team.manage')
  const rows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      members: count(members.id),
    })
    .from(roles)
    .leftJoin(members, eq(members.roleId, roles.id))
    .where(eq(roles.tenantId, ctx.tenant.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.createdAt))

  return (
    <>
      <PageHeader
        eyebrow='Equipo'
        title='Roles y permisos'
        description='Define qué puede hacer cada persona. Los permisos de módulos apagados no aplican.'
        actions={
          <Link href={`/app/${slug}/team/roles/new`} className={buttonVariants({ size: 'lg' })}>
            <Plus /> Nuevo rol
          </Link>
        }
      />
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {rows.map((r) => {
          const all = r.permissions.includes('*')
          const n = all ? ALL_PERMISSIONS.length : r.permissions.length
          return (
            <div key={r.id} className='flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-gold/50'>
              <div className='flex items-start justify-between gap-2'>
                <div>
                  <p className='flex items-center gap-2 font-medium'>
                    {r.name}
                    {r.isSystem && <StatusBadge tone='gold'>Sistema</StatusBadge>}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>{r.description ?? 'Rol personalizado'}</p>
                </div>
                {r.key === 'owner' && <Lock className='size-4 text-muted-foreground' />}
              </div>
              <div className='mt-4'>
                <div className='flex justify-between text-[0.7rem] text-muted-foreground'>
                  <span>
                    {n} de {ALL_PERMISSIONS.length} permisos
                  </span>
                  <span>
                    {r.members} {r.members === 1 ? 'miembro' : 'miembros'}
                  </span>
                </div>
                <div className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted'>
                  <div className='h-full rounded-full bg-chart-1' style={{ width: `${(n / ALL_PERMISSIONS.length) * 100}%` }} />
                </div>
              </div>
              {r.key !== 'owner' && (
                <div className='mt-4 flex justify-end gap-1'>
                  <Link href={`/app/${slug}/team/roles/${r.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Pencil /> Editar
                  </Link>
                  {!r.isSystem && (
                    <ConfirmAction
                      title={`¿Eliminar el rol ${r.name}?`}
                      confirmLabel='Eliminar'
                      action={deleteRole.bind(null, slug, r.id)}
                      trigger={
                        <Button variant='ghost' size='icon-sm' aria-label='Eliminar rol' className='text-muted-foreground hover:text-destructive'>
                          <Trash2 />
                        </Button>
                      }
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
