import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { members } from '@/db/schema'
import { AppSidebar } from '@/components/app/app-sidebar'
import { BillingBanner } from '@/components/app/billing-banner'
import { Topbar } from '@/components/app/topbar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { NAVIGATION } from '@/lib/navigation'
import { getTenantContext } from '@/server/tenant'

export default async function DashboardLayout(
  props: LayoutProps<'/app/[tenant]'>,
) {
  const { tenant: slug } = await props.params
  const ctx = await getTenantContext(slug)

  const groups = NAVIGATION.map((g) => ({
    label: g.label,
    items: g.items.filter(
      (item) =>
        (!item.module || ctx.hasModule(item.module)) &&
        (!item.permission || ctx.can(item.permission)),
    ),
  })).filter((g) => g.items.length)

  const memberships = await db.query.members.findMany({
    where: eq(members.userId, ctx.user.id),
    with: { tenant: true, role: true },
  })
  const tenants = memberships
    .filter((m) => m.isActive)
    .map((m) => ({
      id: m.tenant.id,
      slug: m.tenant.slug,
      name: m.tenant.name,
      logoUrl: m.tenant.logoUrl,
      role: m.role.name,
    }))

  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        slug={slug}
        groups={groups}
        tenant={{
          id: ctx.tenant.id,
          slug: ctx.tenant.slug,
          name: ctx.tenant.name,
          logoUrl: ctx.tenant.logoUrl,
          role: ctx.role.name,
        }}
        tenants={tenants}
        user={{
          name: ctx.user.name,
          email: ctx.user.email,
          image: ctx.user.image,
        }}
        planName={ctx.plan?.name ?? null}
        trialDaysLeft={
          ctx.billing.status === 'trialing' ? ctx.billing.trialDaysLeft : null
        }
      />
      <SidebarInset className='min-w-0'>
        <Topbar
          slug={slug}
          branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
          branchId={ctx.branch?.id ?? ''}
          groups={groups}
          canSell={ctx.can('pos.sell')}
        />
        <BillingBanner
          slug={slug}
          billing={ctx.billing}
          canManage={ctx.can('billing.manage')}
        />
        <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8'>
          {props.children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
