import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import type { DbOrTx } from '@/db'
import { auditLogs } from '@/db/schema'
import type { ModuleKey } from '@/lib/modules'
import type { Permission } from '@/lib/permissions'
import { getTenantContext, type TenantContext } from './tenant'

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false
      error: string
      fieldErrors?: Record<string, string[] | undefined>
    }

export class ActionError extends Error {}

function pgCode(err: unknown): string | undefined {
  let e: unknown = err
  for (let i = 0; i < 4 && e; i++) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
    e = (e as { cause?: unknown }).cause
  }
}

/** Ejecuta una acción y normaliza errores en un `ActionResult`. */
export async function runAction<T>(
  fn: () => Promise<T>,
  message?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data, message }
  } catch (err) {
    unstable_rethrow(err)
    if (err instanceof ActionError) return { ok: false, error: err.message }
    if (err instanceof z.ZodError) {
      const flat = z.flattenError(err)
      return {
        ok: false,
        error: flat.formErrors[0] ?? 'Revisa los campos marcados.',
        fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
      }
    }
    const code = pgCode(err)
    if (code === '23505')
      return { ok: false, error: 'Ya existe un registro con esos datos.' }
    if (code === '23503')
      return {
        ok: false,
        error: 'El registro está en uso por otros datos y no puede modificarse así.',
      }
    console.error('[action]', err)
    return { ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' }
  }
}

type AuthorizeOptions = {
  permission?: Permission
  module?: ModuleKey
  /** Permite la acción aunque la suscripción no esté activa (p. ej. facturación). */
  allowInactive?: boolean
}

/** Verifica sesión, membresía, módulo, permiso y suscripción dentro de una acción. */
export async function authorize(
  slug: string,
  opts: AuthorizeOptions = {},
): Promise<TenantContext> {
  const ctx = await getTenantContext(slug)
  if (opts.module && !ctx.hasModule(opts.module)) {
    throw new ActionError('Este módulo no está activo en tu plan.')
  }
  if (opts.permission && !ctx.can(opts.permission)) {
    throw new ActionError('No tienes permiso para realizar esta acción.')
  }
  if (!opts.allowInactive && !ctx.billing.active) {
    throw new ActionError(
      'Tu suscripción no está activa. Ve a Facturación para continuar.',
    )
  }
  return ctx
}

export async function logActivity(
  tx: DbOrTx,
  ctx: TenantContext,
  entry: {
    action: string
    entity: string
    entityId?: string
    summary?: string
    meta?: Record<string, unknown>
  },
) {
  await tx
    .insert(auditLogs)
    .values({ tenantId: ctx.tenant.id, userId: ctx.user.id, ...entry })
}
