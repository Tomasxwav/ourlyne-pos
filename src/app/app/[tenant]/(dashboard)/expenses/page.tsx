import type { Metadata } from 'next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { asc, count, eq } from 'drizzle-orm'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, Receipt, Repeat, TrendingUp, Wallet } from 'lucide-react'
import { db } from '@/db'
import { expenseCategories, expenses } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { DateRangeFilter, FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { StatusBadge } from '@/components/app/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney, formatNumber } from '@/lib/money'
import { PAGE_SIZE, parsePage, str } from '@/lib/params'
import { cn } from '@/lib/utils'
import {
  getExpenseMonthly,
  getExpenseSummary,
  listExpenses,
  resolveExpenseRange,
  todayIn,
  type ExpenseFilters,
} from '@/server/queries/expenses'
import { requireModule, requirePermission } from '@/server/tenant'
import { ExpenseCategoriesDialog } from './categories-dialog'
import { RECURRING_LABEL } from './constants'
import { ExpensesByCategoryChart, ExpensesMonthlyChart } from './expense-charts'
import { DeleteExpenseButton, ExpenseDialog } from './expense-dialog'

export const metadata: Metadata = { title: 'Gastos' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function ExpensesPage(props: PageProps<'/app/[tenant]/expenses'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'expenses')
  const ctx = await requirePermission(slug, 'expenses.manage')
  const tz = ctx.tenant.timezone
  const range = resolveExpenseRange(tz, str(sp.from), str(sp.to))
  const categoryParam = str(sp.category)
  const branchParam = str(sp.branch)
  const q = str(sp.q)
  const page = parsePage(sp.page)

  const filters: ExpenseFilters = {
    tenantId: ctx.tenant.id,
    timezone: tz,
    from: range.from,
    to: range.to,
    categoryId: categoryParam === 'none' || (categoryParam && UUID.test(categoryParam)) ? categoryParam : undefined,
    branchId: branchParam && UUID.test(branchParam) ? branchParam : undefined,
    q,
  }

  const [rows, summary, monthly, categories] = await Promise.all([
    listExpenses(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    getExpenseSummary({ ...filters, prevFrom: range.prevFrom, prevTo: range.prevTo }),
    getExpenseMonthly(filters),
    db
      .select({
        id: expenseCategories.id,
        name: expenseCategories.name,
        color: expenseCategories.color,
        expenses: count(expenses.id),
      })
      .from(expenseCategories)
      .leftJoin(expenses, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenseCategories.tenantId, ctx.tenant.id))
      .groupBy(expenseCategories.id)
      .orderBy(asc(expenseCategories.name)),
  ])

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const { current, previous } = summary
  const dailyAvg = Math.round(current.total / range.elapsed)
  const filtered = Boolean(q || filters.categoryId || filters.branchId || !range.isDefault)
  const today = todayIn(tz)
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }))
  const branchOptions = ctx.branches.map((b) => ({ id: b.id, name: b.name }))
  const fmtDay = (d: string) => format(parseISO(d), "d 'de' MMM yyyy", { locale: es })
  const periodLabel = `${fmtDay(range.from)} – ${fmtDay(range.to)}`

  const newButton = (
    <ExpenseDialog
      slug={slug}
      categories={categoryOptions}
      branches={branchOptions}
      defaultBranchId={ctx.branch?.id}
      today={today}
    />
  )

  return (
    <>
      <PageHeader
        title='Gastos'
        description={range.isDefault ? `Mes en curso · ${periodLabel}` : periodLabel}
        actions={
          <>
            <ExpenseCategoriesDialog slug={slug} categories={categories} />
            {newButton}
          </>
        }
      />

      <div className='flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center'>
        <SearchInput placeholder='Descripción o referencia' />
        <DateRangeFilter />
        <FilterSelect
          param='category'
          allLabel='Todas las categorías'
          options={[...categories.map((c) => ({ value: c.id, label: c.name })), { value: 'none', label: 'Sin categoría' }]}
        />
        {ctx.branches.length > 1 && (
          <FilterSelect
            param='branch'
            allLabel='Todas las sucursales'
            options={ctx.branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </div>

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
        <StatTile
          label='Total del periodo'
          icon={<Wallet />}
          value={money(current.total)}
          hint={`${formatNumber(current.count)} ${current.count === 1 ? 'gasto' : 'gastos'}`}
        />
        <StatTile
          label='vs. periodo anterior'
          icon={<TrendingUp />}
          value={money(previous.total)}
          hint={
            <>
              <DeltaBadge current={current.total} previous={previous.total} />
              {`${range.days} ${range.days === 1 ? 'día previo' : 'días previos'}`}
            </>
          }
        />
        <StatTile
          label='Promedio diario'
          icon={<CalendarDays />}
          value={money(dailyAvg)}
          hint={`en ${range.elapsed} ${range.elapsed === 1 ? 'día' : 'días'}`}
        />
        <StatTile
          label='Recurrentes'
          icon={<Repeat />}
          value={money(current.recurring)}
          hint={
            current.total
              ? `${formatNumber(current.recurringCount)} ${current.recurringCount === 1 ? 'gasto' : 'gastos'} · ${Math.round((current.recurring / current.total) * 100)}% del total`
              : 'sin gastos'
          }
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Por categoría</CardTitle>
            <CardDescription>Gasto del periodo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.byCategory.length ? (
              <ExpensesByCategoryChart data={summary.byCategory} currency={ctx.tenant.currency} />
            ) : (
              <p className='py-16 text-center text-xs text-muted-foreground'>Sin gastos en el periodo.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Por mes</CardTitle>
            <CardDescription>Últimos 6 meses hasta {format(parseISO(range.to), "MMMM 'de' yyyy", { locale: es })}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesMonthlyChart data={monthly} currency={ctx.tenant.currency} />
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={filtered ? 'Sin gastos con estos filtros' : 'Sin gastos este mes'}
          description={
            filtered ? 'Prueba con otro periodo o filtros.' : 'Registra renta, servicios, nómina e insumos para conocer tu utilidad real.'
          }
          action={!filtered && newButton}
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Gasto</TableHead>
                <TableHead className='hidden md:table-cell'>Categoría</TableHead>
                <TableHead className='hidden lg:table-cell'>Sucursal</TableHead>
                <TableHead className='hidden sm:table-cell'>Fecha</TableHead>
                <TableHead className='text-right'>Importe</TableHead>
                <TableHead className='w-16' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className='max-w-0 w-full sm:max-w-none sm:w-auto'>
                    <span className='block truncate font-medium'>{e.description}</span>
                    <span className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-muted-foreground'>
                      <span className='sm:hidden'>{format(parseISO(e.day), 'd MMM', { locale: es })}</span>
                      {e.paymentMethod && <span>{e.paymentMethod}</span>}
                      {e.reference && <span className='font-mono'>{e.reference}</span>}
                      {e.recurring !== 'none' && (
                        <StatusBadge tone='info' className='py-0'>
                          {RECURRING_LABEL[e.recurring]}
                        </StatusBadge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className='hidden md:table-cell'>
                    {e.category ? (
                      <span className='inline-flex items-center gap-1.5'>
                        <span aria-hidden className='size-2 rounded-full shadow-[inset_0_0_0_1px_var(--border)]' style={{ background: e.color ?? undefined }} />
                        {e.category}
                      </span>
                    ) : (
                      <span className='text-muted-foreground'>Sin categoría</span>
                    )}
                  </TableCell>
                  <TableCell className='hidden text-muted-foreground lg:table-cell'>{e.branch ?? 'General'}</TableCell>
                  <TableCell className='hidden text-muted-foreground sm:table-cell'>
                    {format(parseISO(e.day), 'd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className='text-right font-medium tabular-nums'>{money(e.amount)}</TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-0.5'>
                      <ExpenseDialog
                        slug={slug}
                        expense={{
                          id: e.id,
                          description: e.description,
                          categoryId: e.categoryId,
                          branchId: e.branchId,
                          amount: e.amount,
                          day: e.day,
                          paymentMethod: e.paymentMethod,
                          reference: e.reference,
                          recurring: e.recurring,
                        }}
                        categories={categoryOptions}
                        branches={branchOptions}
                        today={today}
                      />
                      <DeleteExpenseButton slug={slug} id={e.id} description={e.description} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className='border-t px-4 py-2.5'>
            <Pagination page={page} pageSize={PAGE_SIZE} total={current.count} searchParams={sp} />
          </div>
        </div>
      )}
    </>
  )
}

/** En gastos, subir es malo: rojo si aumenta, verde si disminuye. */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = previous ? (current - previous) / previous : current ? 1 : 0
  const pct = Math.round(delta * 1000) / 10
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
        pct > 0 && 'bg-destructive/10 text-destructive',
        pct < 0 && 'bg-success/10 text-success',
        pct === 0 && 'bg-muted',
      )}
    >
      <Icon className='size-3' aria-hidden />
      <span className='sr-only'>{pct > 0 ? 'Aumento del gasto' : pct < 0 ? 'Disminución del gasto' : 'Sin cambio'}</span>
      {Math.abs(pct)}%
    </span>
  )
}
