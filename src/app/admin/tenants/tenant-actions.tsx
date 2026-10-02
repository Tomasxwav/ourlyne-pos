'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import type { ActionResult } from '@/server/action'
import { assignPlan, extendTrial, toggleSuspend } from '../actions'

export function TenantAdminActions({
  tenantId,
  suspended,
  planId,
  plans,
}: {
  tenantId: string
  suspended: boolean
  planId: string
  plans: { id: string; name: string }[]
}) {
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) toast.success(res.message ?? 'Listo')
      else toast.error(res.error)
    })
  return (
    <div className='flex items-center gap-1'>
      <NativeSelect
        aria-label='Plan'
        value={planId}
        disabled={pending}
        onChange={(e) => run(() => assignPlan(tenantId, e.target.value))}
        className='h-7 w-32'
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </NativeSelect>
      <Button variant='outline' size='sm' disabled={pending} onClick={() => run(() => extendTrial(tenantId, 14))}>
        +14 días
      </Button>
      <Button
        variant={suspended ? 'outline' : 'destructive'}
        size='sm'
        disabled={pending}
        onClick={() => run(() => toggleSuspend(tenantId))}
      >
        {suspended ? 'Reactivar' : 'Suspender'}
      </Button>
    </div>
  )
}
