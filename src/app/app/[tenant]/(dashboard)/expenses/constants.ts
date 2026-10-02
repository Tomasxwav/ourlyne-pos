export const EXPENSE_PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'] as const

export const RECURRING_OPTIONS = [
  { value: 'none', label: 'Único' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
] as const

export const RECURRING_LABEL: Record<string, string> = Object.fromEntries(
  RECURRING_OPTIONS.map((r) => [r.value, r.label]),
)

export const EXPENSE_SWATCHES = [
  '#222d52', '#3f56a6', '#5b6b9a', '#1f9a80', '#4f8a3a', '#c2904b',
  '#d2b68a', '#e07a3f', '#c0506a', '#7a5fc0', '#a3a7b4', '#111827',
]
