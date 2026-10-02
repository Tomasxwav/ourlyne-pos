import { PageHeader } from '@/components/app/page-header'
import { getTenantContext } from '@/server/tenant'
import { SettingsNav } from './settings-nav'

/** Cada página valida `settings.manage`; /modules también avisa a usuarios sin permiso. */
export default async function SettingsLayout(props: LayoutProps<'/app/[tenant]/settings'>) {
  const { tenant: slug } = await props.params
  const ctx = await getTenantContext(slug)
  const canManage = ctx.can('settings.manage')
  return (
    <>
      <PageHeader title='Configuración' description='Ajusta tu negocio, sucursales, impuestos, cobros y módulos.' />
      <div className={canManage ? 'grid gap-6 lg:grid-cols-[13rem_1fr]' : ''}>
        {canManage && <SettingsNav slug={slug} />}
        <div className='min-w-0'>{props.children}</div>
      </div>
    </>
  )
}
