import { StatusBadge } from '@/components/app/status-badge'

export function DiffBadge({ value, money }: { value: number; money: (v: number) => string }) {
  if (value === 0) return <StatusBadge tone='success'>Cuadra</StatusBadge>
  return (
    <StatusBadge tone={value > 0 ? 'warning' : 'danger'}>
      {value > 0 ? 'Sobrante' : 'Faltante'} {money(Math.abs(value))}
    </StatusBadge>
  )
}
