import { differenceInCalendarDays } from 'date-fns'
import type { plans, subscriptions } from '@/db/schema'

type Sub = typeof subscriptions.$inferSelect
type Plan = typeof plans.$inferSelect

export type BillingState = {
  status: Sub['status'] | 'none'
  /** Si el tenant puede operar (vender, editar). */
  active: boolean
  trialDaysLeft: number | null
  warning: string | null
}

export function getBillingState(
  sub: Sub | null | undefined,
  plan?: Plan | null,
): BillingState {
  if (!sub || !plan) {
    return {
      status: 'none',
      active: false,
      trialDaysLeft: null,
      warning: 'Sin suscripción activa.',
    }
  }
  const now = new Date()
  switch (sub.status) {
    case 'active':
      return {
        status: sub.status,
        active: true,
        trialDaysLeft: null,
        warning: sub.cancelAtPeriodEnd
          ? 'Tu suscripción se cancelará al final del periodo actual.'
          : null,
      }
    case 'trialing': {
      const left = sub.trialEndsAt
        ? differenceInCalendarDays(sub.trialEndsAt, now)
        : null
      const active = left === null || left >= 0
      return {
        status: sub.status,
        active,
        trialDaysLeft: left === null ? null : Math.max(left, 0),
        warning: active
          ? null
          : 'Tu periodo de prueba terminó. Elige un plan para continuar.',
      }
    }
    case 'past_due':
      return {
        status: sub.status,
        active: true,
        trialDaysLeft: null,
        warning:
          'Hay un pago pendiente. Actualiza tu método de pago para evitar la suspensión.',
      }
    default:
      return {
        status: sub.status,
        active: false,
        trialDaysLeft: null,
        warning: 'Tu suscripción no está activa. Elige un plan para continuar.',
      }
  }
}
