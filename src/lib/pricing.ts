import { taxFromExclusive, taxFromInclusive } from './money'

/**
 * Cálculo de totales de una venta. Se usa en el POS (vista previa) y en el
 * servidor (fuente de verdad) para garantizar el mismo resultado.
 */
export type PricingLine = {
  unitPrice: number
  quantity: number
  /** Descuento de la línea en centavos. */
  discount?: number
  taxRateBps: number
}

export type OrderDiscount =
  | { type: 'percent'; value: number } // value en puntos base
  | { type: 'fixed'; value: number } // centavos

export type PricedLine = {
  gross: number
  discount: number
  orderDiscountShare: number
  tax: number
  total: number
}

export type Totals = {
  lines: PricedLine[]
  subtotal: number
  lineDiscounts: number
  orderDiscount: number
  discountTotal: number
  taxTotal: number
  total: number
}

export function computeTotals(
  lines: PricingLine[],
  opts: { pricesIncludeTax: boolean; discount?: OrderDiscount | null },
): Totals {
  const base = lines.map((l) => {
    const gross = Math.round(l.unitPrice * l.quantity)
    const discount = Math.min(Math.max(l.discount ?? 0, 0), gross)
    return { gross, discount, net: gross - discount, rate: l.taxRateBps }
  })
  const netSum = base.reduce((s, l) => s + l.net, 0)

  let orderDiscount = 0
  if (opts.discount && netSum > 0) {
    orderDiscount =
      opts.discount.type === 'percent'
        ? Math.round((netSum * Math.min(opts.discount.value, 10000)) / 10000)
        : Math.min(opts.discount.value, netSum)
  }

  // Reparte el descuento global proporcionalmente; el residuo va a la última línea.
  let assigned = 0
  const priced: PricedLine[] = base.map((l, i) => {
    let share = 0
    if (orderDiscount > 0) {
      share =
        i === base.length - 1
          ? orderDiscount - assigned
          : Math.round((orderDiscount * l.net) / netSum)
      assigned += share
    }
    const taxable = l.net - share
    if (opts.pricesIncludeTax) {
      const tax = taxFromInclusive(taxable, l.rate)
      return { gross: l.gross, discount: l.discount, orderDiscountShare: share, tax, total: taxable }
    }
    const tax = taxFromExclusive(taxable, l.rate)
    return {
      gross: l.gross,
      discount: l.discount,
      orderDiscountShare: share,
      tax,
      total: taxable + tax,
    }
  })

  const lineDiscounts = priced.reduce((s, l) => s + l.discount, 0)
  return {
    lines: priced,
    subtotal: priced.reduce((s, l) => s + l.gross, 0),
    lineDiscounts,
    orderDiscount,
    discountTotal: lineDiscounts + orderDiscount,
    taxTotal: priced.reduce((s, l) => s + l.tax, 0),
    total: priced.reduce((s, l) => s + l.total, 0),
  }
}
