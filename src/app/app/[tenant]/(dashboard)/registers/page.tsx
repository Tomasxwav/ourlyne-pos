import type { Metadata } from 'next'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { ArrowRight, Wallet } from 'lucide-react'
import { db } from '@/db'
import { registers, registerSessions } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { getSessionSummary } from '@/server/registers'
import { requireModule, requirePermission } from '@/server/tenant'
import { DiffBadge } from './diff-badge'
import { CashMovementDialog, CloseSessionDialog, NewRegisterDialog, ToggleRegisterButton } from './register-dialogs'

export const metadata: Metadata = { title: 'Cajas' }

export default async function RegistersPage(props: PageProps<'/app/[tenant]/registers'>) {
  const { tenant: slug } = await props.params
  await requireModule(slug, 'registers')
  const ctx = await requirePermission(slug, 'registers.operate')
  const manage = ctx.can('registers.manage')
  const money = (v: number) => formatMoney(v, ctx.tenant.currency)

  const registerRows = await db.query.registers.findMany({
    where: and(
      eq(registers.tenantId, ctx.tenant.id),
      manage ? undefined : eq(registers.branchId, ctx.branch?.id ?? ''),
    ),
    with: { branch: true },
    orderBy: [desc(registers.isActive), asc(registers.name)],
  })

  const cards = await Promise.all(
    registerRows.map(async (r) => {
      const open = await db.query.registerSessions.findFirst({
        where: and(eq(registerSessions.registerId, r.id), eq(registerSessions.status, 'open')),
      })
      const summary = open ? await getSessionSummary(db, open.id) : null
      return { register: r, summary }
    }),
  )

  const history = registerRows.length
    ? await db.query.registerSessions.findMany({
        where: and(
          eq(registerSessions.tenantId, ctx.tenant.id),
          eq(registerSessions.status, 'closed'),
          inArray(
            registerSessions.registerId,
            registerRows.map((r) => r.id),
          ),
          manage ? undefined : eq(registerSessions.openedById, ctx.user.id),
        ),
        with: { register: true, openedBy: { columns: { name: true } } },
        orderBy: [desc(registerSessions.closedAt)],
        limit: 15,
      })
    : []

  return (
    <>
      <PageHeader
        title='Cajas'
        description='Apertura, movimientos de efectivo y cortes de caja.'
        actions={
          manage && (
            <NewRegisterDialog
              slug={slug}
              branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
              defaultBranch={ctx.branch?.id}
            />
          )
        }
      />

      {cards.length === 0 ? (
        <EmptyState icon={<Wallet />} title='Sin cajas' description='Crea una caja registradora para la sucursal.' />
      ) : (
        <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-3'>
          {cards.map(({ register, summary }) => {
            const s = summary?.session
            const mine = s?.openedById === ctx.user.id
            return (
              <Card key={register.id} className={register.isActive ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex items-center gap-3'>
                      <span className='flex size-10 items-center justify-center rounded-lg bg-velvet text-gold'>
                        <Wallet className='size-5' />
                      </span>
                      <div>
                        <CardTitle className='text-base'>{register.name}</CardTitle>
                        <p className='text-xs text-muted-foreground'>{register.branch.name}</p>
                      </div>
                    </div>
                    {s ? (
                      <StatusBadge tone='success'>Abierta</StatusBadge>
                    ) : register.isActive ? (
                      <StatusBadge>Cerrada</StatusBadge>
                    ) : (
                      <StatusBadge tone='danger'>Inactiva</StatusBadge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {summary && s ? (
                    <>
                      <p className='text-xs text-muted-foreground'>
                        Abierta por <span className='text-foreground'>{s.openedBy.name}</span>{' '}
                        {formatDistanceToNow(s.openedAt, { locale: es, addSuffix: true })}
                      </p>
                      <dl className='grid grid-cols-2 gap-3 text-xs'>
                        <Metric label='Fondo inicial' value={money(s.openingAmount)} />
                        <Metric label='Ventas' value={`${summary.orders.count} · ${money(summary.orders.total)}`} />
                        <Metric label='Efectivo en ventas' value={money(summary.cashSales)} />
                        <Metric label='Entradas / salidas' value={`+${money(summary.cashIn)} / −${money(summary.cashOut)}`} />
                      </dl>
                      <div className='flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2'>
                        <span className='text-xs text-muted-foreground'>Efectivo esperado</span>
                        <span className='font-heading text-xl font-semibold tabular-nums'>{money(summary.expected)}</span>
                      </div>
                      {(mine || manage) && (
                        <div className='flex flex-wrap gap-2'>
                          <CashMovementDialog slug={slug} sessionId={s.id} type='in' />
                          <CashMovementDialog slug={slug} sessionId={s.id} type='out' />
                          <CloseSessionDialog
                            slug={slug}
                            sessionId={s.id}
                            registerName={register.name}
                            expected={summary.expected}
                            currency={ctx.tenant.currency}
                            byMethod={summary.byMethod}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <p className='text-xs text-muted-foreground'>Sin sesión abierta.</p>
                      {register.isActive && register.branchId === ctx.branch?.id && ctx.can('pos.sell') && (
                        <Link href={`/app/${slug}/pos`} className={buttonVariants({ size: 'lg' })}>
                          Abrir en POS <ArrowRight />
                        </Link>
                      )}
                    </div>
                  )}
                  {manage && !s && (
                    <ToggleRegisterButton slug={slug} registerId={register.id} active={register.isActive} />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Cortes recientes</CardTitle>
        </CardHeader>
        <CardContent className='px-0'>
          {history.length === 0 ? (
            <p className='px-4 py-6 text-center text-xs text-muted-foreground'>Aún no hay cortes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='pl-4'>Caja</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead className='hidden md:table-cell'>Apertura</TableHead>
                  <TableHead className='hidden md:table-cell'>Cierre</TableHead>
                  <TableHead className='text-right'>Esperado</TableHead>
                  <TableHead className='hidden text-right sm:table-cell'>Contado</TableHead>
                  <TableHead className='pr-4 text-right'>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className='pl-4'>
                      <Link href={`/app/${slug}/registers/sessions/${h.id}`} className='font-medium hover:underline'>
                        {h.register.name}
                      </Link>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>{h.openedBy.name}</TableCell>
                    <TableCell className='hidden text-muted-foreground md:table-cell'>
                      {format(h.openedAt, 'd MMM HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell className='hidden text-muted-foreground md:table-cell'>
                      {h.closedAt ? format(h.closedAt, 'd MMM HH:mm', { locale: es }) : '—'}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{money(h.expectedAmount ?? 0)}</TableCell>
                    <TableCell className='hidden text-right tabular-nums sm:table-cell'>{money(h.countedAmount ?? 0)}</TableCell>
                    <TableCell className='pr-4 text-right'>
                      <DiffBadge value={h.difference ?? 0} money={money} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='mt-0.5 font-medium tabular-nums'>{value}</dd>
    </div>
  )
}
