'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney } from '@/lib/money'

const config = { amount: { label: 'Compras', color: 'var(--chart-1)' } } satisfies ChartConfig

export function MonthlySpendChart({
  data,
  currency,
}: {
  data: { month: string; amount: number; orders: number }[]
  currency: string
}) {
  return (
    <ChartContainer config={config} className='aspect-auto h-48 w-full'>
      <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' strokeOpacity={0.6} />
        <XAxis
          dataKey='month'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => format(parseISO(`${v}-01`), 'MMM', { locale: es })}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatMoney(v, currency, 'es-MX', { compact: true })}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={
            <ChartTooltipContent
              valueFormatter={(v) => formatMoney(v, currency)}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as { month?: string; orders?: number } | undefined
                if (!p?.month) return ''
                const label = format(parseISO(`${p.month}-01`), "MMMM 'de' yyyy", { locale: es })
                return `${label} · ${p.orders ?? 0} ${p.orders === 1 ? 'compra' : 'compras'}`
              }}
            />
          }
        />
        <Bar dataKey='amount' fill='var(--color-amount)' radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  )
}
