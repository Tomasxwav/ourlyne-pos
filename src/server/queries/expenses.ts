import 'server-only'
import { differenceInCalendarDays, format, parseISO, subDays, subMonths } from 'date-fns'
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { branches, expenseCategories, expenses, user } from '@/db/schema'
import { localTs } from './dashboard'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fecha de hoy ("YYYY-MM-DD") en la zona horaria del negocio. */
export function todayIn(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return format(new Date(), 'yyyy-MM-dd')
  }
}

/**
 * Normaliza el rango de fechas (días locales del negocio). Por omisión, el mes en curso.
 * Devuelve también el periodo anterior de la misma duración.
 */
export function resolveExpenseRange(timezone: string, fromParam?: string, toParam?: string) {
  const today = todayIn(timezone)
  let from = fromParam && DAY_RE.test(fromParam) ? fromParam : `${today.slice(0, 7)}-01`
  let to = toParam && DAY_RE.test(toParam) ? toParam : today
  if (from > to) [from, to] = [to, from]
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
  const prevTo = format(subDays(parseISO(from), 1), 'yyyy-MM-dd')
  const prevFrom = format(subDays(parseISO(from), days), 'yyyy-MM-dd')
  // Días transcurridos (para el promedio diario no se cuentan días futuros).
  const elapsed =
    to > today ? Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(from)) + 1) : days
  return { from, to, days, elapsed, prevFrom, prevTo, isDefault: !fromParam && !toParam }
}

export type ExpenseFilters = {
  tenantId: string
  timezone: string
  from: string
  to: string
  categoryId?: string
  branchId?: string
  q?: string
}

function localDay(timezone: string) {
  return sql`(${localTs(sql`${expenses.date}`, timezone)})::date`
}

function baseWhere(f: Omit<ExpenseFilters, 'from' | 'to'>, extra?: SQL) {
  return and(
    eq(expenses.tenantId, f.tenantId),
    f.categoryId
      ? f.categoryId === 'none'
        ? sql`${expenses.categoryId} is null`
        : eq(expenses.categoryId, f.categoryId)
      : undefined,
    f.branchId ? eq(expenses.branchId, f.branchId) : undefined,
    f.q
      ? or(ilike(expenses.description, `%${f.q}%`), ilike(expenses.reference, `%${f.q}%`))
      : undefined,
    extra,
  )
}

export function expenseWhere(f: ExpenseFilters) {
  const day = localDay(f.timezone)
  return baseWhere(f, sql`${day} between ${f.from}::date and ${f.to}::date`)
}

export async function listExpenses(f: ExpenseFilters, limit: number, offset: number) {
  return db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      date: expenses.date,
      paymentMethod: expenses.paymentMethod,
      reference: expenses.reference,
      recurring: expenses.recurring,
      categoryId: expenses.categoryId,
      branchId: expenses.branchId,
      category: expenseCategories.name,
      color: expenseCategories.color,
      branch: branches.name,
      userName: user.name,
      day: sql<string>`to_char(${localTs(sql`${expenses.date}`, f.timezone)}, 'YYYY-MM-DD')`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(branches, eq(branches.id, expenses.branchId))
    .leftJoin(user, eq(user.id, expenses.userId))
    .where(expenseWhere(f))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(limit)
    .offset(offset)
}

async function totals(f: ExpenseFilters) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
      recurring: sql<number>`coalesce(sum(${expenses.amount}) filter (where ${expenses.recurring} <> 'none'), 0)::bigint`,
      recurringCount: sql<number>`count(*) filter (where ${expenses.recurring} <> 'none')::int`,
    })
    .from(expenses)
    .where(expenseWhere(f))
  return {
    total: Number(row.total),
    count: Number(row.count),
    recurring: Number(row.recurring),
    recurringCount: Number(row.recurringCount),
  }
}

export async function getExpenseSummary(f: ExpenseFilters & { prevFrom: string; prevTo: string }) {
  const [current, previous, byCategory] = await Promise.all([
    totals(f),
    totals({ ...f, from: f.prevFrom, to: f.prevTo }),
    db
      .select({
        id: expenses.categoryId,
        name: sql<string>`coalesce(${expenseCategories.name}, 'Sin categoría')`,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint`,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .where(expenseWhere(f))
      .groupBy(expenses.categoryId, expenseCategories.name)
      .orderBy(desc(sql`sum(${expenses.amount})`)),
  ])
  return {
    current,
    previous,
    byCategory: byCategory.map((c) => ({ ...c, amount: Number(c.amount) })),
  }
}

/** Gasto por mes (últimos `months` meses hasta el mes de `to`), con los mismos filtros salvo fechas. */
export async function getExpenseMonthly(
  f: Omit<ExpenseFilters, 'from'>,
  months = 6,
) {
  const end = parseISO(f.to)
  const start = format(subMonths(end, months - 1), 'yyyy-MM-01')
  const endDay = f.to
  const month = sql<string>`to_char(${localTs(sql`${expenses.date}`, f.timezone)}, 'YYYY-MM')`
  const day = localDay(f.timezone)
  const rows = await db
    .select({ month, amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
    .from(expenses)
    .where(baseWhere(f, sql`${day} between ${start}::date and (date_trunc('month', ${endDay}::date) + interval '1 month - 1 day')::date`))
    .groupBy(month)
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.amount)]))
  return Array.from({ length: months }, (_, i) => {
    const key = format(subMonths(end, months - 1 - i), 'yyyy-MM')
    return { month: key, amount: byMonth.get(key) ?? 0 }
  })
}
