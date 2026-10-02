import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { roles } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { requirePermission } from '@/server/tenant'
import { RoleForm } from '../role-form'

export const metadata: Metadata = { title: 'Editar rol' }

export default async function EditRolePage(props: PageProps<'/app/[tenant]/team/roles/[id]'>) {
  const { tenant: slug, id } = await props.params
  const ctx = await requirePermission(slug, 'team.manage')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const role = await db.query.roles.findFirst({ where: and(eq(roles.id, id), eq(roles.tenantId, ctx.tenant.id)) })
  if (!role || role.key === 'owner') notFound()
  return (
    <>
      <PageHeader eyebrow='Roles y permisos' title={role.name} description={role.description ?? undefined} />
      <RoleForm slug={slug} role={role} activeModules={ctx.modules} />
    </>
  )
}
