import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { members } from '@/db/schema'
import { requireSession } from '@/server/session'

/** Punto de entrada: redirige al último negocio usado o al onboarding. */
export default async function AppIndex() {
  const session = await requireSession('/app')
  const memberships = await db.query.members.findMany({
    where: eq(members.userId, session.user.id),
    with: { tenant: { columns: { id: true, slug: true } } },
  })
  const active = memberships.filter((m) => m.isActive)
  if (!active.length) {
    redirect(session.user.platformRole === 'superadmin' ? '/admin' : '/onboarding')
  }
  const last = active.find((m) => m.tenantId === session.user.lastTenantId) ?? active[0]
  redirect(`/app/${last.tenant.slug}`)
}
