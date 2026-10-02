'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, XAxis, YAxis, LabelList } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMoney } from '@/lib/money'

const salesConfig = {
  revenue: { label: 'Periodo actual', color: 'var(--chart-1)' },
  previous: { label: 'Periodo anterior', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export function SalesChart({
  data,
  currency,
}: {
  data: { date: string; revenue: number; previous: number }[]
  currency: string
}) {
  const money = (v: number) => formatMoney(v, currency)
  const dense = data.length > 31
  return (
    <ChartContainer config={salesConfig} className='aspect-auto h-72 w-full'>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id='fillRevenue' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='var(--color-revenue)' stopOpacity={0.35} />
            <stop offset='95%' stopColor='var(--color-revenue)' stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray='3 3' strokeOpacity={0.6} />
        <XAxis
          dataKey='date'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={dense ? 40 : 24}
          tickFormatter={(v: string) => format(parseISO(v), 'd MMM', { locale: es })}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => formatMoney(v, currency, 'es-MX', { compact: true })}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: '4 4' }}
          content={
            <ChartTooltipContent
              indicator='line'
              valueFormatter={money}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.date as string | undefined
                return d ? format(parseISO(d), "EEEE d 'de' MMMM", { locale: es }) : ''
              }}
            />
          }
        />
        <Line
          dataKey='previous'
          type='monotone'
          stroke='var(--color-previous)'
          strokeWidth={1.5}
          strokeDasharray='4 4'
          strokeOpacity={0.6}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          dataKey='revenue'
          type='monotone'
          fill='url(#fillRevenue)'
          stroke='var(--color-revenue)'
          strokeWidth={2}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--background)' }}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}

const paymentConfig = { amount: { label: 'Cobrado', color: 'var(--chart-2)' } } satisfies ChartConfig

export function PaymentsChart({
  data,
  currency,
}: {
  data: { name: string; amount: number; count: number }[]
  currency: string
}) {
  return (
    <ChartContainer config={paymentConfig} className='aspect-auto h-56 w-full'>
      <BarChart data={data} layout='vertical' margin={{ left: 0, right: 72 }} barCategoryGap={10}>
        <XAxis type='number' hide />
        <YAxis
          type='category'
          dataKey='name'
          tickLine={false}
          axisLine={false}
          width={96}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent hideLabel valueFormatter={(v) => formatMoney(v, currency)} />}
        />
        <Bar dataKey='amount' fill='var(--color-amount)' radius={4} maxBarSize={22}>
          <LabelList
            dataKey='amount'
            position='right'
            className='fill-foreground'
            fontSize={11}
            formatter={(v: unknown) => formatMoney(Number(v), currency, 'es-MX', { compact: true })}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Mapa de calor día × hora (secuencial, un solo tono dorado). */
export function HourHeatmap({ data }: { data: { dow: number; hour: number; orders: number }[] }) {
  const hours = data.length ? data.map((d) => d.hour) : [8, 20]
  const minH = Math.max(0, Math.min(...hours))
  const maxH = Math.min(23, Math.max(...hours))
  const cols = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i)
  const max = Math.max(1, ...data.map((d) => d.orders))
  const get = (dow: number, hour: number) => data.find((d) => d.dow === dow && d.hour === hour)?.orders ?? 0

  return (
    <div className='overflow-x-auto'>
      <div
        className='grid min-w-[30rem] gap-[2px] text-[0.6rem] text-muted-foreground'
        style={{ gridTemplateColumns: `2.25rem repeat(${cols.length}, minmax(0, 1fr))` }}
        role='table'
        aria-label='Ventas por día y hora'
      >
        <span />
        {cols.map((h) => (
          <span key={h} className='pb-1 text-center tabular-nums'>
            {h % 2 === 0 ? `${h}h` : ''}
          </span>
        ))}
        {DAYS.map((label, i) => (
          <div key={label} className='contents' role='row'>
            <span className='flex items-center'>{label}</span>
            {cols.map((h) => {
              const v = get(i + 1, h)
              const t = v / max
              return (
                <div
                  key={h}
                  role='cell'
                  title={`${label} ${h}:00 · ${v} ventas`}
                  className='group relative aspect-square rounded-[3px] bg-muted transition-transform hover:z-10 hover:scale-125 hover:ring-2 hover:ring-background'
                >
                  <span
                    className='absolute inset-0 rounded-[3px] bg-chart-1'
                    style={{ opacity: v ? 0.12 + t * 0.88 : 0 }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className='mt-3 flex items-center justify-end gap-2 text-[0.65rem] text-muted-foreground'>
        Menos
        {[0.12, 0.35, 0.6, 0.85, 1].map((o) => (
          <span key={o} className='size-3 rounded-[3px] bg-chart-1' style={{ opacity: o }} />
        ))}
        Más
      </div>
    </div>
  )
}
