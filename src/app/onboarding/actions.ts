'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { tenants, user } from '@/db/schema'
import { RESERVED_SLUGS, slugify } from '@/lib/slug'
import { ActionError, runAction, type ActionResult } from '@/server/action'
import { provisionTenant } from '@/server/provision'
import { requireSession } from '@/server/session'

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de tu negocio').max(80),
  slug: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  businessType: z.string().min(1),
  plan: z.string().min(1),
})

export async function createTenantAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const session = await requireSession('/onboarding')
  const result = await runAction(async () => {
    const input = schema.parse({
      name: formData.get('name'),
      slug: slugify(String(formData.get('slug') || formData.get('name') || '')),
      businessType: formData.get('businessType'),
      plan: formData.get('plan'),
    })
    if (RESERVED_SLUGS.has(input.slug)) throw new ActionError('Esa dirección está reservada, elige otra.')
    const taken = await db.query.tenants.findFirst({ where: eq(tenants.slug, input.slug), columns: { id: true } })
    if (taken) throw new ActionError('Esa dirección ya está en uso, prueba otra.')

    const { tenant } = await db.transaction(async (tx) => {
      const created = await provisionTenant(tx, {
        name: input.name,
        slug: input.slug,
        ownerId: session.user.id,
        businessType: input.businessType,
        planSlug: input.plan,
      })
      await tx.update(user).set({ lastTenantId: created.tenant.id }).where(eq(user.id, session.user.id))
      return created
    })
    return { slug: tenant.slug }
  })
  if (result.ok && result.data) redirect(`/app/${result.data.slug}?welcome=1`)
  return result
}
