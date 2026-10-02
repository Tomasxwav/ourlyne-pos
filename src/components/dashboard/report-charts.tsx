'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMoney } from '@/lib/money'

const compact = (currency: string) => (v: number) => formatMoney(v, currency, 'es-MX', { compact: true })

const dailyConfig = { net: { label: 'Ventas netas', color: 'var(--chart-1)' } } satisfies ChartConfig

export function DailySalesBars({ data, currency }: { data: { day: string; net: number }[]; currency: string }) {
  return (
    <ChartContainer config={dailyConfig} className='aspect-auto h-64 w-full'>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' strokeOpacity={0.6} />
        <XAxis
          dataKey='day'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={20}
          tickFormatter={(v: string) => format(parseISO(v), 'd MMM', { locale: es })}
        />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact(currency)} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={
            <ChartTooltipContent
              valueFormatter={(v) => formatMoney(v, currency)}
              labelFormatter={(_, p) => {
                const d = p?.[0]?.payload?.day as string | undefined
                return d ? format(parseISO(d), "EEEE d 'de' MMMM", { locale: es }) : ''
              }}
            />
          }
        />
        <Bar dataKey='net' fill='var(--color-net)' radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  )
}

const pnlConfig = {
  gross: { label: 'Utilidad bruta', color: 'var(--chart-1)' },
  expenses: { label: 'Gastos', color: 'var(--chart-5)' },
  profit: { label: 'Utilidad neta', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function ProfitLossChart({
  data,
  currency,
}: {
  data: { month: string; gross: number; expenses: number; profit: number }[]
  currency: string
}) {
  return (
    <ChartContainer config={pnlConfig} className='aspect-auto h-72 w-full'>
      <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' strokeOpacity={0.6} />
        <XAxis
          dataKey='month'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => format(parseISO(`${v}-01`), 'MMM yy', { locale: es })}
        />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact(currency)} />
        <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => formatMoney(v, currency)} />} />
        <Bar dataKey='gross' fill='var(--color-gross)' radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey='expenses' fill='var(--color-expenses)' radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line dataKey='profit' type='monotone' stroke='var(--color-profit)' strokeWidth={2} dot={{ r: 4 }} />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  )
}

const catConfig = { revenue: { label: 'Ventas', color: 'var(--chart-2)' } } satisfies ChartConfig

export function CategoryBars({ data, currency }: { data: { name: string; revenue: number }[]; currency: string }) {
  return (
    <ChartContainer config={catConfig} className='aspect-auto w-full' style={{ height: Math.max(160, data.length * 36) }}>
      <BarChart data={data} layout='vertical' margin={{ left: 0, right: 16 }}>
        <XAxis type='number' hide />
        <YAxis type='category' dataKey='name' tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent hideLabel valueFormatter={(v) => formatMoney(v, currency)} />}
        />
        <Bar dataKey='revenue' fill='var(--color-revenue)' radius={4} maxBarSize={20} />
      </BarChart>
    </ChartContainer>
  )
}
