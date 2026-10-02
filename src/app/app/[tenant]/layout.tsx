import type { Metadata } from 'next'
import { after } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import { getTenantContext } from '@/server/tenant'

export async function generateMetadata(
  props: LayoutProps<'/app/[tenant]'>,
): Promise<Metadata> {
  const { tenant } = await props.params
  const ctx = await getTenantContext(tenant)
  return {
    title: { default: ctx.tenant.name, template: `%s · ${ctx.tenant.name}` },
  }
}

export default async function TenantLayout(props: LayoutProps<'/app/[tenant]'>) {
  const { tenant } = await props.params
  const ctx = await getTenantContext(tenant)

  if (ctx.user.lastTenantId !== ctx.tenant.id) {
    after(() =>
      db
        .update(user)
        .set({ lastTenantId: ctx.tenant.id })
        .where(eq(user.id, ctx.user.id)),
    )
  }

  return props.children
}
