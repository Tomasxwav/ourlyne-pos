import { getTenantContext } from '@/server/tenant'

export default async function TenantHome(props: PageProps<'/app/[tenant]'>) {
  const { tenant } = await props.params
  const ctx = await getTenantContext(tenant)
  return (
    <main className='p-10'>
      <h1 className='text-3xl font-bold'>{ctx.tenant.name}</h1>
      <p>{ctx.role.name} · {ctx.plan?.name} · {ctx.modules.join(', ')}</p>
    </main>
  )
}
