'use client'

import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from 'recharts'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Receipt,
  ScanBarcode,
  Search,
  Store,
  TrendingUp,
} from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/* Ilustraciones de la interfaz del POS hechas con JSX (no son capturas). Son
   decorativas: cada uso lleva aria-hidden y una descripción en texto aparte. */

const money = (cents: number) => formatMoney(cents)
const moneyShort = (cents: number) => formatMoney(cents).replace(/\.00$/, '')

export function MockWindow({
  title,
  children,
  className,
  action,
}: {
  title: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card/90 text-card-foreground shadow-2xl shadow-black/5 backdrop-blur-md dark:shadow-black/40',
        className,
      )}
    >
      <div className='flex items-center gap-2 border-b border-border/70 px-3 py-2'>
        <span className='flex gap-1'>
          <span className='size-1.5 rounded-full bg-foreground/15' />
          <span className='size-1.5 rounded-full bg-foreground/15' />
          <span className='size-1.5 rounded-full bg-gold' />
        </span>
        <span className='truncate text-[0.6rem] font-medium tracking-[0.18em] text-foreground/55 uppercase'>
          {title}
        </span>
        {action && <span className='ml-auto'>{action}</span>}
      </div>
      {children}
    </div>
  )
}

function LiveDot() {
  return (
    <span className='inline-flex items-center gap-1.5 text-[0.6rem] text-success'>
      <span className='relative flex size-1.5'>
        <span className='absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none' />
        <span className='relative size-1.5 rounded-full bg-success' />
      </span>
      En vivo
    </span>
  )
}

/* ------------------------------------------------------------------ Hero */

const HOURLY = [
  { h: '8', v: 120000 },
  { h: '9', v: 260000 },
  { h: '10', v: 310000 },
  { h: '11', v: 280000 },
  { h: '12', v: 420000 },
  { h: '13', v: 610000 },
  { h: '14', v: 560000 },
  { h: '15', v: 380000 },
  { h: '16', v: 340000 },
  { h: '17', v: 450000 },
  { h: '18', v: 590000 },
  { h: '19', v: 520000 },
  { h: '20', v: 310000 },
]

const hourlyConfig = {
  v: { label: 'Ventas', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function HeroDashboardMock() {
  return (
    <div className='relative mx-auto w-full max-w-xl'>
      <div data-depth='0.4'>
        <MockWindow title='Tablero · Sucursal Centro' action={<LiveDot />}>
          <div className='p-4 md:p-5'>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='text-[0.65rem] tracking-[0.18em] text-foreground/50 uppercase'>
                  Ventas de hoy
                </p>
                <p className='mt-1 font-heading text-3xl font-bold tabular-nums md:text-4xl'>
                  {moneyShort(4892050)}
                </p>
              </div>
              <span className='inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[0.65rem] font-medium text-success'>
                <TrendingUp className='size-3' />
                +12.4% vs. ayer
              </span>
            </div>

            <ChartContainer
              config={hourlyConfig}
              className='mt-3 aspect-auto h-32 w-full md:h-40'
            >
              <AreaChart data={HOURLY} margin={{ left: 0, right: 0, top: 6 }}>
                <defs>
                  <linearGradient id='heroFill' x1='0' y1='0' x2='0' y2='1'>
                    <stop
                      offset='5%'
                      stopColor='var(--color-v)'
                      stopOpacity={0.35}
                    />
                    <stop
                      offset='95%'
                      stopColor='var(--color-v)'
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray='3 3'
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey='h'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  interval={2}
                  tickFormatter={(v: string) => `${v}:00`}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  content={
                    <ChartTooltipContent
                      indicator='line'
                      labelFormatter={(_, p) =>
                        p?.[0] ? `${p[0].payload.h}:00 h` : ''
                      }
                      valueFormatter={moneyShort}
                    />
                  }
                />
                <Area
                  dataKey='v'
                  type='monotone'
                  stroke='var(--color-v)'
                  strokeWidth={2}
                  fill='url(#heroFill)'
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>

            <div className='mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3'>
              {[
                ['Tickets', '312'],
                ['Ticket prom.', moneyShort(15680)],
                ['Margen', '38%'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className='text-[0.6rem] text-foreground/50'>{label}</p>
                  <p className='font-mono text-sm font-medium tabular-nums'>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </MockWindow>
      </div>

      <div
        data-depth='1'
        className='absolute -bottom-10 -left-4 hidden w-52 sm:block md:-left-14'
      >
        <TicketMock />
      </div>

      <div
        data-depth='1.4'
        className='absolute -top-6 -right-3 md:-right-8'
      >
        <div className='flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[0.65rem] shadow-xl backdrop-blur-md'>
          <CheckCircle2 className='size-3.5 text-success' />
          <span className='font-medium'>Corte de caja cuadrado</span>
          <span className='font-mono text-foreground/50'>$0.00</span>
        </div>
      </div>

      <div
        data-depth='0.8'
        className='absolute -right-2 bottom-14 hidden md:-right-10 lg:block'
      >
        <div className='flex items-center gap-2 rounded-md border border-warning/40 bg-card/90 px-3 py-2 text-[0.65rem] shadow-xl backdrop-blur-md'>
          <AlertTriangle className='size-3.5 text-warning' />
          <div>
            <p className='font-medium'>Stock bajo</p>
            <p className='text-foreground/55'>Leche entera · 4 pz</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TicketMock() {
  const lines = [
    ['Latte grande', 2, 11800],
    ['Croissant', 1, 4500],
    ['Agua mineral', 1, 2800],
  ] as const
  const total = lines.reduce((s, [, , v]) => s + v, 0)
  return (
    <div className='rounded-md border border-border bg-card p-3 font-mono text-[0.62rem] shadow-2xl shadow-black/10 dark:shadow-black/50'>
      <div className='flex items-center justify-between border-b border-dashed border-border pb-2'>
        <span className='flex items-center gap-1 font-sans font-semibold'>
          <Receipt className='size-3 text-gold-deep dark:text-gold' />
          Ticket
        </span>
        <span className='text-foreground/50'>V-000184</span>
      </div>
      <ul className='space-y-1 py-2'>
        {lines.map(([name, qty, amount]) => (
          <li key={name} className='flex justify-between gap-2'>
            <span className='truncate'>
              {qty} × {name}
            </span>
            <span className='tabular-nums'>{money(amount)}</span>
          </li>
        ))}
      </ul>
      <div className='space-y-0.5 border-t border-dashed border-border pt-2'>
        <div className='flex justify-between text-foreground/55'>
          <span>IVA incl.</span>
          <span className='tabular-nums'>{money(Math.round(total * 0.16 / 1.16))}</span>
        </div>
        <div className='flex justify-between text-xs font-bold'>
          <span>Total</span>
          <span className='tabular-nums'>{money(total)}</span>
        </div>
      </div>
      <div className='mt-2 flex items-center justify-center gap-1 rounded-sm bg-gold/15 py-1 font-sans text-[0.6rem] font-medium text-gold-deep dark:text-gold'>
        <CreditCard className='size-3' /> Pagado con tarjeta
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Showcase */

const PRODUCTS = [
  ['Americano', 4200],
  ['Latte', 5900],
  ['Chai', 6200],
  ['Croissant', 4500],
  ['Bagel', 5500],
  ['Galleta', 2500],
] as const

export function PosMock() {
  return (
    <MockWindow
      title='Punto de venta · Caja 1'
      className='h-full'
      action={
        <span className='font-mono text-[0.55rem] text-foreground/40'>F2</span>
      }
    >
      <div className='grid h-full grid-cols-5 gap-3 p-3'>
        <div className='col-span-3 flex flex-col gap-2'>
          <div className='flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-[0.6rem] text-foreground/45'>
            <Search className='size-3' /> Buscar o escanear…
            <ScanBarcode className='ml-auto size-3 text-gold-deep dark:text-gold' />
          </div>
          <div className='grid flex-1 grid-cols-3 gap-1.5'>
            {PRODUCTS.map(([name, price], i) => (
              <div
                key={name}
                className={cn(
                  'flex flex-col justify-between rounded-sm border border-border bg-background/60 p-1.5',
                  i === 1 && 'border-gold/70 bg-gold/10',
                )}
              >
                <span className='size-4 rounded-full bg-linear-to-br from-gold/60 to-gold-deep/40' />
                <span className='mt-1 text-[0.58rem] leading-tight font-medium'>
                  {name}
                </span>
                <span className='font-mono text-[0.55rem] text-foreground/55'>
                  {moneyShort(price)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className='col-span-2 flex flex-col rounded-sm border border-border bg-background/60 p-2 text-[0.58rem]'>
          <p className='font-semibold'>Venta actual</p>
          <ul className='mt-1.5 space-y-1 font-mono'>
            <li className='flex justify-between'>
              <span>2 × Latte</span>
              <span>{moneyShort(11800)}</span>
            </li>
            <li className='flex justify-between'>
              <span>1 × Bagel</span>
              <span>{moneyShort(5500)}</span>
            </li>
            <li className='flex justify-between text-success'>
              <span>Cupón 10%</span>
              <span>−$17</span>
            </li>
          </ul>
          <div className='mt-auto border-t border-border pt-1.5'>
            <div className='flex justify-between font-mono text-xs font-bold'>
              <span>Total</span>
              <span>$156</span>
            </div>
            <div className='mt-1.5 rounded-full bg-gold py-1 text-center text-[0.6rem] font-semibold text-[#111]'>
              Cobrar
            </div>
          </div>
        </div>
      </div>
    </MockWindow>
  )
}

const STOCK = [
  ['Café molido 1 kg', 42, 18, 3],
  ['Leche entera', 24, 4, 31],
  ['Vaso 12 oz', 860, 540, 410],
  ['Jarabe vainilla', 9, 12, 2],
  ['Pan brioche', 30, 26, 14],
] as const

export function InventoryMock() {
  return (
    <MockWindow
      title='Inventario · Todas las sucursales'
      className='h-full'
      action={<LiveDot />}
    >
      <table className='w-full text-left text-[0.6rem]'>
        <thead className='text-foreground/45'>
          <tr className='border-b border-border/70'>
            <th className='px-3 py-2 font-medium'>Producto</th>
            <th className='px-2 py-2 text-right font-medium'>Centro</th>
            <th className='px-2 py-2 text-right font-medium'>Norte</th>
            <th className='px-3 py-2 text-right font-medium'>Sur</th>
          </tr>
        </thead>
        <tbody className='font-mono tabular-nums'>
          {STOCK.map(([name, ...qty]) => (
            <tr key={name} className='border-b border-border/40 last:border-0'>
              <td className='px-3 py-1.5 font-sans font-medium'>{name}</td>
              {qty.map((q, i) => (
                <td
                  key={i}
                  className={cn(
                    'px-2 py-1.5 text-right last:pr-3',
                    q < 5 && 'text-warning',
                  )}
                >
                  {q < 5 && (
                    <AlertTriangle className='mr-1 inline size-2.5 align-[-1px]' />
                  )}
                  {q}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className='flex items-center justify-between border-t border-border/70 px-3 py-2 text-[0.58rem] text-foreground/55'>
        <span>Traspaso Norte → Sur · Leche entera</span>
        <span className='rounded-full bg-gold/15 px-2 py-0.5 font-medium text-gold-deep dark:text-gold'>
          En camino
        </span>
      </div>
    </MockWindow>
  )
}

export function CashCutMock() {
  const rows = [
    ['Fondo inicial', 100000],
    ['Ventas en efectivo', 1284000],
    ['Entradas', 20000],
    ['Retiros', -300000],
  ] as const
  const methods = [
    { label: 'Efectivo', pct: 46, color: 'var(--chart-1)', icon: Banknote },
    { label: 'Tarjeta', pct: 38, color: 'var(--chart-2)', icon: CreditCard },
    { label: 'Transferencia', pct: 16, color: 'var(--chart-3)', icon: Store },
  ]
  return (
    <MockWindow title='Corte de caja · Turno vespertino' className='h-full'>
      <div className='grid grid-cols-2 gap-3 p-3 text-[0.6rem]'>
        <ul className='space-y-1.5'>
          {rows.map(([label, v]) => (
            <li key={label} className='flex justify-between gap-2'>
              <span className='text-foreground/60'>{label}</span>
              <span className='font-mono tabular-nums'>
                {v < 0 ? `−${moneyShort(-v)}` : moneyShort(v)}
              </span>
            </li>
          ))}
          <li className='flex justify-between border-t border-border pt-1.5 font-semibold'>
            <span>Esperado</span>
            <span className='font-mono tabular-nums'>{moneyShort(1104000)}</span>
          </li>
          <li className='flex justify-between font-semibold'>
            <span>Contado</span>
            <span className='font-mono tabular-nums'>{moneyShort(1104000)}</span>
          </li>
        </ul>
        <div className='flex flex-col justify-between gap-3'>
          <div className='rounded-md border border-success/30 bg-success/10 p-2'>
            <p className='flex items-center gap-1 text-success'>
              <CheckCircle2 className='size-3' /> Diferencia
            </p>
            <p className='mt-0.5 font-heading text-xl font-bold tabular-nums'>
              $0.00
            </p>
          </div>
          <div>
            <p className='mb-1 text-foreground/50'>Formas de pago</p>
            <div className='flex h-2 gap-0.5 overflow-hidden rounded-full'>
              {methods.map((m) => (
                <span
                  key={m.label}
                  className='h-full first:rounded-l-full last:rounded-r-full'
                  style={{ width: `${m.pct}%`, background: m.color }}
                />
              ))}
            </div>
            <ul className='mt-1.5 space-y-0.5'>
              {methods.map((m) => (
                <li key={m.label} className='flex items-center gap-1.5'>
                  <span
                    className='size-1.5 rounded-full'
                    style={{ background: m.color }}
                  />
                  <span className='text-foreground/65'>{m.label}</span>
                  <span className='ml-auto font-mono tabular-nums'>
                    {m.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </MockWindow>
  )
}

const WEEK = [
  { d: 'Lun', v: 3120000 },
  { d: 'Mar', v: 2840000 },
  { d: 'Mié', v: 3360000 },
  { d: 'Jue', v: 3010000 },
  { d: 'Vie', v: 4580000 },
  { d: 'Sáb', v: 5240000 },
  { d: 'Dom', v: 3970000 },
]
const weekConfig = {
  v: { label: 'Ventas', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ReportsMock() {
  return (
    <MockWindow title='Reportes · Ventas por día' className='h-full'>
      <div className='flex h-[calc(100%-2rem)] flex-col p-3'>
        <div className='grid grid-cols-3 gap-2 text-[0.58rem]'>
          {[
            ['Semana', moneyShort(26120000)],
            ['Utilidad', moneyShort(9930000)],
            ['Top', 'Latte'],
          ].map(([label, value]) => (
            <div
              key={label}
              className='rounded-sm border border-border bg-background/60 px-2 py-1.5'
            >
              <p className='text-foreground/50'>{label}</p>
              <p className='font-mono text-[0.7rem] font-semibold tabular-nums'>
                {value}
              </p>
            </div>
          ))}
        </div>
        <ChartContainer
          config={weekConfig}
          className='mt-2 aspect-auto min-h-24 w-full flex-1'
        >
          <BarChart data={WEEK} margin={{ left: 0, right: 0, top: 8 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray='3 3'
              strokeOpacity={0.5}
            />
            <XAxis dataKey='d' tickLine={false} axisLine={false} tickMargin={4} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.3 }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  valueFormatter={moneyShort}
                />
              }
            />
            <Bar
              dataKey='v'
              fill='var(--color-v)'
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </MockWindow>
  )
}

const BRANCHES = [
  { name: 'Centro', sales: 1824000, users: ['AD', 'CJ', 'CJ'] },
  { name: 'Norte', sales: 1310000, users: ['GT', 'CJ'] },
  { name: 'Sur', sales: 972000, users: ['CJ', 'AL'] },
  { name: 'Plaza Oriente', sales: 640000, users: ['CJ'] },
]
const ROLES = ['Administrador', 'Gerente', 'Cajero', 'Almacén']

export function BranchesMock() {
  const max = Math.max(...BRANCHES.map((b) => b.sales))
  return (
    <MockWindow title='Sucursales · Hoy' className='h-full'>
      <ul className='space-y-2.5 p-3 text-[0.6rem]'>
        {BRANCHES.map((b) => (
          <li key={b.name} className='grid grid-cols-[5.5rem_1fr_auto] items-center gap-2'>
            <span className='flex items-center gap-1 truncate font-medium'>
              <Store className='size-3 shrink-0 text-gold-deep dark:text-gold' />
              {b.name}
            </span>
            <span className='flex items-center gap-1.5'>
              <span className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                <span
                  className='block h-full rounded-full bg-chart-1'
                  style={{ width: `${(b.sales / max) * 100}%` }}
                />
              </span>
              <span className='w-12 text-right font-mono tabular-nums'>
                {formatMoney(b.sales, 'MXN', 'es-MX', { compact: true })}
              </span>
            </span>
            <span className='flex -space-x-1'>
              {b.users.map((u, i) => (
                <span
                  key={i}
                  className='flex size-4 items-center justify-center rounded-full border border-card bg-secondary text-[0.45rem] font-semibold'
                >
                  {u}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className='flex flex-wrap gap-1 border-t border-border/70 px-3 py-2'>
        {ROLES.map((r, i) => (
          <span
            key={r}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[0.55rem]',
              i === 0
                ? 'border-gold/60 bg-gold/15 text-gold-deep dark:text-gold'
                : 'border-border text-foreground/60',
            )}
          >
            {r}
          </span>
        ))}
      </div>
    </MockWindow>
  )
}
