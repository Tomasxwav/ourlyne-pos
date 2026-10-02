'use server'

import { revalidatePath } from 'next/cache'
import { authorize, runAction, type ActionResult } from '@/server/action'
import { refundOrder, voidOrder, type refundSchema } from '@/server/orders'
import type { z } from 'zod'

export async function refundOrderAction(
  slug: string,
  orderId: string,
  input: z.infer<typeof refundSchema>,
): Promise<ActionResult<{ amount: number }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'orders.refund' })
    return refundOrder(ctx, orderId, input)
  }, 'Devolución registrada')
  revalidatePath(`/app/${slug}/orders`)
  revalidatePath(`/app/${slug}/orders/${orderId}`)
  return res
}

export async function voidOrderAction(slug: string, orderId: string, reason?: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'orders.refund' })
    await voidOrder(ctx, orderId, reason)
  }, 'Venta cancelada')
  revalidatePath(`/app/${slug}/orders`)
  revalidatePath(`/app/${slug}/orders/${orderId}`)
  return res
}
