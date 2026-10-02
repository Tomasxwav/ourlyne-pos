import type { PlanLimits } from '@/db/schema'
import type { ModuleKey } from './modules'

/** Planes por defecto (se insertan con el seed; editables desde /admin). */
export const DEFAULT_PLANS: {
  slug: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  modules: ModuleKey[]
  limits: PlanLimits
  features: string[]
  highlighted?: boolean
  sortOrder: number
}[] = [
  {
    slug: 'emprendedor',
    name: 'Emprendedor',
    description: 'Para tu primer local: cobra rápido y controla tu inventario.',
    priceMonthly: 29900,
    priceYearly: 299000,
    modules: ['inventory', 'customers', 'registers'],
    limits: { branches: 1, users: 2, products: 500, registers: 1 },
    features: [
      '1 sucursal · 2 usuarios',
      'Hasta 500 productos',
      'Punto de venta y tickets',
      'Inventario y clientes',
      'Corte de caja',
    ],
    sortOrder: 1,
  },
  {
    slug: 'negocio',
    name: 'Negocio',
    description: 'Para negocios en crecimiento que necesitan compras y reportes.',
    priceMonthly: 69900,
    priceYearly: 699000,
    modules: [
      'inventory',
      'customers',
      'registers',
      'purchases',
      'expenses',
      'coupons',
      'reports',
    ],
    limits: { branches: 3, users: 10, products: 5000, registers: 6 },
    features: [
      'Hasta 3 sucursales · 10 usuarios',
      'Hasta 5,000 productos',
      'Compras y proveedores',
      'Gastos y cupones',
      'Reportes avanzados',
      'Roles y permisos a la medida',
    ],
    highlighted: true,
    sortOrder: 2,
  },
  {
    slug: 'empresa',
    name: 'Empresa',
    description: 'Cadenas y franquicias con operación multi-sucursal sin límites.',
    priceMonthly: 149900,
    priceYearly: 1499000,
    modules: [
      'inventory',
      'customers',
      'registers',
      'purchases',
      'expenses',
      'coupons',
      'reports',
    ],
    limits: { branches: -1, users: -1, products: -1, registers: -1 },
    features: [
      'Sucursales y usuarios ilimitados',
      'Productos ilimitados',
      'Traspasos entre sucursales',
      'Todos los módulos',
      'Soporte prioritario',
    ],
    sortOrder: 3,
  },
]

export const DEFAULT_PLAN_SLUG = 'negocio'

export function limitLabel(n: number) {
  return n < 0 ? 'Ilimitado' : String(n)
}

export function withinLimit(limit: number, current: number) {
  return limit < 0 || current < limit
}
