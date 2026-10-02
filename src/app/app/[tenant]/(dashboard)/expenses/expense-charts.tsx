'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney } from '@/lib/money'

const categoryConfig = { amount: { label: 'Gasto', color: 'var(--chart-1)' } } satisfies ChartConfig

export function ExpensesByCategoryChart({
  data,
  currency,
}: {
  data: { name: string; amount: number }[]
  currency: string
}) {
  const height = Math.max(160, data.length * 34 + 16)
  return (
    <ChartContainer config={categoryConfig} className='aspect-auto w-full' style={{ height }}>
      <BarChart data={data} layout='vertical' margin={{ left: 0, right: 72 }} barCategoryGap={8}>
        <XAxis type='number' hide />
        <YAxis
          type='category'
          dataKey='name'
          tickLine={false}
          axisLine={false}
          width={104}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent hideLabel={false} valueFormatter={(v) => formatMoney(v, currency)} />}
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

const monthlyConfig = { amount: { label: 'Gastos', color: 'var(--chart-2)' } } satisfies ChartConfig

export function ExpensesMonthlyChart({
  data,
  currency,
}: {
  data: { month: string; amount: number }[]
  currency: string
}) {
  return (
    <ChartContainer config={monthlyConfig} className='aspect-auto h-56 w-full'>
      <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' strokeOpacity={0.6} />
        <XAxis
          dataKey='month'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => format(parseISO(`${v}-01`), 'MMM yy', { locale: es })}
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
                const m = payload?.[0]?.payload?.month as string | undefined
                return m ? format(parseISO(`${m}-01`), "MMMM 'de' yyyy", { locale: es }) : ''
              }}
            />
          }
        />
        <Bar dataKey='amount' fill='var(--color-amount)' radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  )
}
