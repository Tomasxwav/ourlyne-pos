import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { forbidden, notFound, redirect } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { branches, members, tenants } from '@/db/schema'
import { isModuleKey, type ModuleKey } from '@/lib/modules'
import { hasPermission, PERMISSIONS, type Permission } from '@/lib/permissions'
import { getBillingState } from './billing-state'
import { requireSession } from './session'

export const BRANCH_COOKIE = 'ol_branch'

/**
 * Resuelve el contexto completo del tenant para la petición actual:
 * sesión → membresía → rol/permisos → plan/módulos → sucursal activa.
 * Memoizado por petición con `cache`.
 */
export const getTenantContext = cache(async (slug: string) => {
  const session = await requireSession(`/app/${slug}`)

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    with: { subscription: { with: { plan: true } }, modules: true },
  })
  if (!tenant) notFound()

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.tenantId, tenant.id),
      eq(members.userId, session.user.id),
    ),
    with: { role: true },
  })
  if (!member || !member.isActive) notFound()

  const branchList = await db.query.branches.findMany({
    where: and(eq(branches.tenantId, tenant.id), eq(branches.isActive, true)),
    orderBy: [asc(branches.createdAt)],
  })

  const cookieStore = await cookies()
  const preferred = cookieStore.get(`${BRANCH_COOKIE}_${tenant.id}`)?.value
  const branch =
    branchList.find((b) => b.id === preferred) ??
    branchList.find((b) => b.id === member.branchId) ??
    branchList.find((b) => b.isDefault) ??
    branchList[0]

  const plan = tenant.subscription?.plan ?? null
  const planModules = new Set(plan?.modules ?? [])
  const modules = tenant.modules
    .filter(
      (m) =>
        m.enabled && isModuleKey(m.moduleKey) && planModules.has(m.moduleKey),
    )
    .map((m) => m.moduleKey as ModuleKey)
  const moduleSet = new Set(modules)

  const permissions = member.role.permissions
  const hasModule = (key: ModuleKey) => moduleSet.has(key)
  const can = (permission: Permission) => {
    const required = PERMISSIONS[permission]?.module
    if (required && !moduleSet.has(required)) return false
    return hasPermission(permissions, permission)
  }

  const { subscription, modules: tenantModuleRows, ...tenantRow } = tenant
  void tenantModuleRows

  return {
    session,
    user: session.user,
    tenant: tenantRow,
    member,
    role: member.role,
    isOwner: member.role.key === 'owner',
    plan,
    subscription: subscription ?? null,
    billing: getBillingState(subscription, plan),
    branch,
    branches: branchList,
    modules,
    permissions,
    hasModule,
    can,
  }
})

export type TenantContext = Awaited<ReturnType<typeof getTenantContext>>

/** Para páginas: 403 si falta el permiso (o su módulo está apagado). */
export async function requirePermission(slug: string, permission: Permission) {
  const ctx = await getTenantContext(slug)
  if (!ctx.can(permission)) forbidden()
  return ctx
}

/** Para páginas de un módulo: si está apagado, lleva a la pantalla de módulos. */
export async function requireModule(slug: string, key: ModuleKey) {
  const ctx = await getTenantContext(slug)
  if (!ctx.hasModule(key)) redirect(`/app/${slug}/settings/modules?missing=${key}`)
  return ctx
}
