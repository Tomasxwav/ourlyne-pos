'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { addDays } from 'date-fns'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, invitations, members, roles, user } from '@/db/schema'
import { isPermission } from '@/lib/permissions'
import { withinLimit } from '@/lib/plans'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import type { TenantContext } from '@/server/tenant'

async function seatsUsed(tenantId: string) {
  const [{ m }] = await db
    .select({ m: count() })
    .from(members)
    .where(and(eq(members.tenantId, tenantId), eq(members.isActive, true)))
  const [{ i }] = await db
    .select({ i: count() })
    .from(invitations)
    .where(and(eq(invitations.tenantId, tenantId), eq(invitations.status, 'pending')))
  return m + i
}

async function assertSeat(ctx: TenantContext) {
  const limit = ctx.plan?.limits.users ?? -1
  if (!withinLimit(limit, await seatsUsed(ctx.tenant.id))) {
    throw new ActionError(`Tu plan permite ${limit} usuarios (incluye invitaciones pendientes).`)
  }
}

async function loadRole(tenantId: string, roleId: string) {
  const role = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)) })
  if (!role) throw new ActionError('Rol inválido.')
  return role
}

/* ── Invitaciones ───────────────────────────────────────────────────── */

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  roleId: z.string().uuid('Elige un rol'),
})

export async function inviteMember(
  slug: string,
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage' })
    const input = inviteSchema.parse(Object.fromEntries(formData))
    const role = await loadRole(ctx.tenant.id, input.roleId)
    if (role.key === 'owner') throw new ActionError('No se puede invitar como propietario.')

    const existingUser = await db.query.user.findFirst({ where: eq(user.email, input.email) })
    if (existingUser) {
      const already = await db.query.members.findFirst({
        where: and(eq(members.tenantId, ctx.tenant.id), eq(members.userId, existingUser.id)),
      })
      if (already) throw new ActionError('Esa persona ya es parte del equipo.')
    }
    const pending = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.tenantId, ctx.tenant.id),
        eq(invitations.email, input.email),
        eq(invitations.status, 'pending'),
      ),
    })
    if (pending) throw new ActionError('Ya hay una invitación pendiente para ese correo.')
    await assertSeat(ctx)

    const token = randomBytes(24).toString('base64url')
    await db.insert(invitations).values({
      tenantId: ctx.tenant.id,
      email: input.email,
      roleId: role.id,
      token,
      invitedById: ctx.user.id,
      expiresAt: addDays(new Date(), 7),
    })
    await logActivity(db, ctx, { action: 'invite', entity: 'member', summary: `${input.email} como ${role.name}` })
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? ''
    return { url: `${base}/invite/${token}` }
  }, 'Invitación creada')
  revalidatePath(`/app/${slug}/team`)
  return res
}

export async function revokeInvitation(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage', allowInactive: true })
    await db
      .update(invitations)
      .set({ status: 'revoked' })
      .where(and(eq(invitations.id, id), eq(invitations.tenantId, ctx.tenant.id)))
  }, 'Invitación revocada')
  revalidatePath(`/app/${slug}/team`)
  return res
}

/* ── Miembros ───────────────────────────────────────────────────────── */

const memberSchema = z.object({
  roleId: z.string().uuid(),
  branchId: z.preprocess((v) => (v ? v : null), z.string().uuid().nullable()),
  pin: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z.string().regex(/^\d{4,6}$/, 'El PIN debe tener de 4 a 6 dígitos').nullable(),
  ),
})

export async function updateMember(
  slug: string,
  memberId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage' })
    const input = memberSchema.parse(Object.fromEntries(formData))
    const member = await db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.tenantId, ctx.tenant.id)),
      with: { role: true },
    })
    if (!member) throw new ActionError('Miembro no encontrado.')
    const role = await loadRole(ctx.tenant.id, input.roleId)
    if (member.role.key === 'owner' && role.key !== 'owner') {
      throw new ActionError('El propietario no puede cambiar de rol. Transfiere la propiedad primero.')
    }
    if (role.key === 'owner' && member.role.key !== 'owner') {
      throw new ActionError('Solo puede haber un propietario.')
    }
    if (input.branchId) {
      const b = await db.query.branches.findFirst({
        where: and(eq(branches.id, input.branchId), eq(branches.tenantId, ctx.tenant.id)),
      })
      if (!b) throw new ActionError('Sucursal inválida.')
    }
    await db.update(members).set(input).where(eq(members.id, memberId))
    await logActivity(db, ctx, { action: 'update', entity: 'member', entityId: memberId, summary: `Rol ${role.name}` })
  }, 'Miembro actualizado')
  revalidatePath(`/app/${slug}/team`)
  return res
}

export async function toggleMember(slug: string, memberId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage' })
    const member = await db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.tenantId, ctx.tenant.id)),
      with: { role: true },
    })
    if (!member) throw new ActionError('Miembro no encontrado.')
    if (member.role.key === 'owner') throw new ActionError('No puedes desactivar al propietario.')
    if (member.userId === ctx.user.id) throw new ActionError('No puedes desactivarte a ti mismo.')
    if (!member.isActive) await assertSeat(ctx)
    await db.update(members).set({ isActive: !member.isActive }).where(eq(members.id, memberId))
  }, 'Acceso actualizado')
  revalidatePath(`/app/${slug}/team`)
  return res
}

export async function removeMember(slug: string, memberId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage', allowInactive: true })
    const member = await db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.tenantId, ctx.tenant.id)),
      with: { role: true },
    })
    if (!member) throw new ActionError('Miembro no encontrado.')
    if (member.role.key === 'owner') throw new ActionError('No puedes quitar al propietario.')
    if (member.userId === ctx.user.id) throw new ActionError('No puedes quitarte a ti mismo.')
    await db.delete(members).where(eq(members.id, memberId))
    await logActivity(db, ctx, { action: 'remove', entity: 'member', entityId: memberId })
  }, 'Miembro eliminado del negocio')
  revalidatePath(`/app/${slug}/team`)
  return res
}

/* ── Roles ──────────────────────────────────────────────────────────── */

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(40),
  description: z.preprocess((v) => (v ? v : null), z.string().max(160).nullable()),
})

export async function saveRole(
  slug: string,
  roleId: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage' })
    const input = roleSchema.parse(Object.fromEntries(formData))
    const permissions = formData
      .getAll('permissions')
      .map(String)
      .filter(isPermission)
    if (!permissions.length) throw new ActionError('Selecciona al menos un permiso.')
    if (roleId) {
      const role = await loadRole(ctx.tenant.id, roleId)
      if (role.key === 'owner') throw new ActionError('El rol Propietario no se puede modificar.')
      await db.update(roles).set({ ...input, permissions }).where(eq(roles.id, roleId))
    } else {
      await db.insert(roles).values({ ...input, permissions, tenantId: ctx.tenant.id })
    }
    await logActivity(db, ctx, { action: roleId ? 'update' : 'create', entity: 'role', summary: input.name })
  }, 'Rol guardado')
  if (res.ok) {
    revalidatePath(`/app/${slug}/team`)
    redirect(`/app/${slug}/team/roles`)
  }
  return res
}

export async function deleteRole(slug: string, roleId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'team.manage' })
    const role = await loadRole(ctx.tenant.id, roleId)
    if (role.isSystem) throw new ActionError('Los roles del sistema no se pueden eliminar.')
    const [{ n }] = await db.select({ n: count() }).from(members).where(eq(members.roleId, roleId))
    if (n > 0) throw new ActionError('Reasigna a los miembros con este rol antes de eliminarlo.')
    await db.delete(roles).where(eq(roles.id, roleId))
  }, 'Rol eliminado')
  revalidatePath(`/app/${slug}/team/roles`)
  return res
}

