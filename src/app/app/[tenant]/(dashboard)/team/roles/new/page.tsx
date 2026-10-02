import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/page-header'
import { requirePermission } from '@/server/tenant'
import { RoleForm } from '../role-form'

export const metadata: Metadata = { title: 'Nuevo rol' }

export default async function NewRolePage(props: PageProps<'/app/[tenant]/team/roles/new'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'team.manage')
  return (
    <>
      <PageHeader eyebrow='Roles y permisos' title='Nuevo rol' />
      <RoleForm slug={slug} activeModules={ctx.modules} />
    </>
  )
}
