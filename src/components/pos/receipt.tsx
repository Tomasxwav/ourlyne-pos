import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { folio, formatMoney, formatQty } from '@/lib/money'

export type ReceiptData = {
  business: {
    name: string
    address?: string | null
    phone?: string | null
    taxId?: string | null
    header?: string | null
    footer?: string | null
    currency: string
  }
  branch?: string
  cashier?: string
  customer?: string | null
  number: number
  date: Date
  type?: string
  items: { name: string; quantity: number; unitPrice: number; total: number; discount?: number; unit?: string }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: { name: string; amount: number }[]
  change: number
  refunded?: number
  status?: string
}

const TYPE_LABEL: Record<string, string> = {
  takeaway: 'Para llevar',
  dine_in: 'Comer aquí',
  delivery: 'A domicilio',
}

/** Ticket de 80 mm. Se imprime con `window.print()` (ver estilos `[data-print]`). */
export function Receipt({ data }: { data: ReceiptData }) {
  const m = (v: number) => formatMoney(v, data.business.currency)
  return (
    <div
      data-print
      className='mx-auto w-full max-w-[80mm] bg-white px-4 py-5 font-mono text-[11px] leading-snug text-black'
    >
      <div className='text-center'>
        <p className='text-sm font-bold tracking-wide uppercase'>{data.business.name}</p>
        {data.business.header && <p>{data.business.header}</p>}
        {data.branch && <p>{data.branch}</p>}
        {data.business.address && <p>{data.business.address}</p>}
        {data.business.phone && <p>Tel. {data.business.phone}</p>}
        {data.business.taxId && <p>RFC {data.business.taxId}</p>}
      </div>
      <div className='my-2 border-t border-dashed border-black' />
      <div className='flex justify-between'>
        <span>Ticket {folio('V', data.number)}</span>
        <span>{format(data.date, 'dd/MM/yy HH:mm', { locale: es })}</span>
      </div>
      {data.cashier && <p>Atendió: {data.cashier}</p>}
      {data.customer && <p>Cliente: {data.customer}</p>}
      {data.type && <p>{TYPE_LABEL[data.type] ?? data.type}</p>}
      {data.status === 'voided' && <p className='mt-1 text-center font-bold'>*** VENTA CANCELADA ***</p>}
      <div className='my-2 border-t border-dashed border-black' />
      <table className='w-full'>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className='align-top'>
              <td className='pr-1'>
                <div>{it.name}</div>
                <div className='text-[10px]'>
                  {formatQty(it.quantity, it.unit)} x {m(it.unitPrice)}
                  {it.discount ? ` (-${m(it.discount)})` : ''}
                </div>
              </td>
              <td className='text-right whitespace-nowrap'>{m(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className='my-2 border-t border-dashed border-black' />
      <div className='space-y-0.5'>
        <Row label='Subtotal' value={m(data.subtotal)} />
        {data.discount > 0 && <Row label='Descuento' value={`-${m(data.discount)}`} />}
        <Row label='IVA incluido' value={m(data.tax)} />
        <Row label='TOTAL' value={m(data.total)} bold />
        {data.payments.map((p, i) => (
          <Row key={i} label={p.name} value={m(p.amount)} />
        ))}
        {data.change > 0 && <Row label='Cambio' value={m(data.change)} />}
        {!!data.refunded && <Row label='Devuelto' value={`-${m(data.refunded)}`} />}
      </div>
      <div className='my-2 border-t border-dashed border-black' />
      <p className='text-center'>{data.business.footer ?? '¡Gracias por su compra!'}</p>
      <p className='mt-1 text-center text-[9px]'>Ourlyne POS</p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-sm font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
