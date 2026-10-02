'use server'

import { cookies } from 'next/headers'
import { refresh } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import { BRANCH_COOKIE, getTenantContext } from './tenant'

/** Cambia la sucursal activa del usuario para este tenant (cookie). */
export async function setActiveBranch(slug: string, branchId: string) {
  const ctx = await getTenantContext(slug)
  if (!ctx.branches.some((b) => b.id === branchId)) return
  const store = await cookies()
  store.set(`${BRANCH_COOKIE}_${ctx.tenant.id}`, branchId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  refresh()
}

/** Recuerda el último tenant visitado para redirigir al iniciar sesión. */
export async function rememberTenant(slug: string) {
  const ctx = await getTenantContext(slug)
  if (ctx.user.lastTenantId === ctx.tenant.id) return
  await db.update(user).set({ lastTenantId: ctx.tenant.id }).where(eq(user.id, ctx.user.id))
}
