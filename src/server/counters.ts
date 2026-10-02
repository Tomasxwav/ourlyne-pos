import { sql } from 'drizzle-orm'
import type { DbOrTx } from '@/db'
import { tenantCounters } from '@/db/schema'

/** Siguiente folio consecutivo por tenant (atómico vía UPSERT). */
export async function nextNumber(tx: DbOrTx, tenantId: string, key: string) {
  const [row] = await tx
    .insert(tenantCounters)
    .values({ tenantId, key, value: 1 })
    .onConflictDoUpdate({
      target: [tenantCounters.tenantId, tenantCounters.key],
      set: { value: sql`${tenantCounters.value} + 1` },
    })
    .returning({ value: tenantCounters.value })
  return row.value
}
