'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowLeft,
  Barcode,
  Clock,
  LayoutDashboard,
  Minus,
  PauseCircle,
  Percent,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  TicketPercent,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatMoney, formatQty, toCents } from '@/lib/money'
import { computeTotals, type OrderDiscount } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { CustomerOption } from './actions'
import { validateCoupon } from './actions'
import { CustomerPicker } from './customer-picker'
import { PaymentDialog, type PosPaymentMethod } from './payment-dialog'
import { ReceiptDialog } from './receipt-dialog'
import type { ReceiptData } from '@/components/pos/receipt'

export type PosProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  unit: string
  trackStock: boolean
  imageUrl: string | null
  categoryId: string | null
  color: string | null
  taxRateBps: number
  stock: number
}

type CartLine = { product: PosProduct; quantity: number; discount: number }
type OrderType = 'takeaway' | 'dine_in' | 'delivery'
type Held = {
  id: string
  at: string
  lines: { productId: string; quantity: number; discount: number }[]
  customer: CustomerOption | null
  type: OrderType
}

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'takeaway', label: 'Para llevar' },
  { value: 'dine_in', label: 'Comer aquí' },
  { value: 'delivery', label: 'Domicilio' },
]

export function PosTerminal(props: {
  slug: string
  business: ReceiptData['business']
  branchName: string
  cashier: string
  session: { registerName: string; openedBy: string; openedAt: string } | null
  pricesIncludeTax: boolean
  trackInventory: boolean
  allowNegativeStock: boolean
  products: PosProduct[]
  categories: { id: string; name: string; color: string }[]
  paymentMethods: PosPaymentMethod[]
  permissions: {
    discount: boolean
    customers: boolean
    createCustomer: boolean
    coupons: boolean
    orders: boolean
    registers: boolean
    dashboard: boolean
  }
  billingActive: boolean
}) {
  const { slug, business, permissions } = props
  const router = useRouter()
  const currency = business.currency
  const money = useCallback((v: number) => formatMoney(v, currency), [currency])

  const [stockDelta, setStockDelta] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState<CustomerOption | null>(null)
  const [orderType, setOrderType] = useState<OrderType>('takeaway')
  const [coupon, setCoupon] = useState<{ code: string; type: 'percent' | 'fixed'; value: number } | null>(null)
  const [manual, setManual] = useState<OrderDiscount | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [payKey, setPayKey] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const holdKey = `ol_hold_${slug}`
  const held = useHeldOrders(holdKey)

  const persistHeld = (next: Held[]) => {
    try {
      localStorage.setItem(holdKey, JSON.stringify(next))
    } catch {
      /* almacenamiento no disponible */
    }
    window.dispatchEvent(new Event(HELD_EVENT))
  }

  const productById = useMemo(() => new Map(props.products.map((p) => [p.id, p])), [props.products])
  const stockOf = useCallback((p: PosProduct) => p.stock + (stockDelta[p.id] ?? 0), [stockDelta])
  const inCart = useCallback((id: string) => lines.find((l) => l.product.id === id)?.quantity ?? 0, [lines])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.products.filter(
      (p) =>
        (!category || p.categoryId === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)),
    )
  }, [props.products, query, category])

  const blocked = (p: PosProduct, extra = 1) =>
    props.trackInventory && p.trackStock && !props.allowNegativeStock && stockOf(p) - inCart(p.id) - extra < -1e-9

  const add = (p: PosProduct, qty = 1) => {
    if (blocked(p, qty)) {
      toast.warning(`Sin existencia suficiente de ${p.name}`)
      return
    }
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i === -1) return [...prev, { product: p, quantity: qty, discount: 0 }]
      const next = [...prev]
      next[i] = { ...next[i], quantity: Math.round((next[i].quantity + qty) * 1000) / 1000 }
      return next
    })
  }

  const setQty = (id: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== id) return l
          const max =
            props.trackInventory && l.product.trackStock && !props.allowNegativeStock ? stockOf(l.product) : Infinity
          if (quantity > max) {
            toast.warning(`Solo hay ${formatQty(max, l.product.unit)} de ${l.product.name}`)
            return { ...l, quantity: max }
          }
          return { ...l, quantity }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  const discount = useMemo<OrderDiscount | null>(
    () => (coupon ? { type: coupon.type, value: coupon.value } : manual),
    [coupon, manual],
  )
  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          unitPrice: l.product.price,
          quantity: l.quantity,
          discount: l.discount,
          taxRateBps: l.product.taxRateBps,
        })),
        { pricesIncludeTax: props.pricesIncludeTax, discount },
      ),
    [lines, discount, props.pricesIncludeTax],
  )
  const itemCount = lines.reduce((a, l) => a + (l.product.unit === 'pz' ? l.quantity : 1), 0)

  const reset = () => {
    setLines([])
    setCustomer(null)
    setCoupon(null)
    setManual(null)
    setOrderType('takeaway')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const holdCurrent = () => {
    if (!lines.length) return
    persistHeld([
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, discount: l.discount })),
        customer,
        type: orderType,
      },
      ...held,
    ].slice(0, 20))
    toast.success('Venta puesta en espera')
    reset()
  }

  const restore = (h: Held) => {
    const restored = h.lines
      .map((l) => {
        const product = productById.get(l.productId)
        return product ? { product, quantity: l.quantity, discount: l.discount } : null
      })
      .filter(Boolean) as CartLine[]
    setLines(restored)
    setCustomer(h.customer)
    setOrderType(h.type)
    persistHeld(held.filter((x) => x.id !== h.id))
  }

  const onScan = () => {
    const q = query.trim().toLowerCase()
    if (!q) return
    const exact = props.products.find((p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q)
    const target = exact ?? (visible.length === 1 ? visible[0] : null)
    if (target) {
      add(target)
      setQuery('')
    } else {
      toast.error('No se encontró el producto')
    }
  }

  const openPay = () => {
    if (!props.billingActive) return void toast.error('Tu suscripción no está activa.')
    if (!lines.length) return void toast.info('Agrega productos al ticket')
    setCartOpen(false)
    setPayKey((k) => k + 1)
    setPayOpen(true)
  }

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        openPay()
      } else if (e.key === 'F8') {
        e.preventDefault()
        holdCurrent()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const applyCoupon = async (code: string) => {
    const res = await validateCoupon(slug, code, totals.subtotal - totals.lineDiscounts)
    if (!res.ok || !res.data) return void toast.error(res.ok ? 'Cupón no válido' : res.error)
    setManual(null)
    setCoupon(res.data)
    toast.success(`Cupón ${res.data.code} aplicado`)
  }

  const onPaid = (result: { id: string; number: number; change: number }, payments: { name: string; amount: number }[]) => {
    setStockDelta((prev) => {
      const next = { ...prev }
      for (const l of lines) if (l.product.trackStock) next[l.product.id] = (next[l.product.id] ?? 0) - l.quantity
      return next
    })
    setReceipt({
      business,
      branch: props.branchName,
      cashier: props.cashier,
      customer: customer?.name,
      number: result.number,
      date: new Date(),
      type: orderType,
      items: lines.map((l, i) => ({
        name: l.product.name,
        quantity: l.quantity,
        unitPrice: l.product.price,
        total: totals.lines[i].total,
        discount: totals.lines[i].discount + totals.lines[i].orderDiscountShare,
        unit: l.product.unit,
      })),
      subtotal: totals.subtotal,
      discount: totals.discountTotal,
      tax: totals.taxTotal,
      total: totals.total,
      payments,
      change: result.change,
    })
    setPayOpen(false)
    reset()
    router.refresh()
  }

  const cart = (
    <CartPanel
      lines={lines}
      totals={totals}
      money={money}
      customer={customer}
      setCustomer={setCustomer}
      orderType={orderType}
      setOrderType={setOrderType}
      coupon={coupon}
      clearCoupon={() => setCoupon(null)}
      applyCoupon={applyCoupon}
      manual={manual}
      setManual={(d) => {
        setCoupon(null)
        setManual(d)
      }}
      setQty={setQty}
      setLineDiscount={(id, d) =>
        setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, discount: Math.max(0, d) } : l)))
      }
      clear={reset}
      hold={holdCurrent}
      pay={openPay}
      permissions={permissions}
      slug={slug}
    />
  )

  return (
    <div className='flex h-dvh flex-col overflow-hidden bg-background'>
      {/* Barra superior */}
      <header className='flex h-14 shrink-0 items-center gap-3 border-b px-3 md:px-4'>
        <Link
          href={permissions.dashboard ? `/app/${slug}` : `/app/${slug}/orders`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-lg' })}
          aria-label='Volver al panel'
        >
          <ArrowLeft />
        </Link>
        <Logo href={null} className='hidden sm:flex' />
        <div className='ml-2 hidden min-w-0 flex-col leading-tight md:flex'>
          <span className='truncate text-xs font-medium'>{business.name} · {props.branchName}</span>
          <span className='truncate text-[0.65rem] text-muted-foreground'>
            {props.session ? `${props.session.registerName} · ` : ''}Cajero: {props.cashier}
          </span>
        </div>
        <div className='ml-auto flex items-center gap-1.5'>
          {held.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='outline' size='lg' className='gap-1.5' />}>
                <PauseCircle /> En espera
                <span className='rounded-full bg-gold px-1.5 text-[0.6rem] font-bold text-velvet'>{held.length}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='min-w-64'>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Ventas en espera</DropdownMenuLabel>
                  {held.map((h) => (
                    <DropdownMenuItem key={h.id} onClick={() => restore(h)} className='flex-col items-start gap-0'>
                      <span className='font-medium'>
                        {h.customer?.name ?? 'Público en general'} · {h.lines.length} productos
                      </span>
                      <span className='text-[0.65rem] text-muted-foreground'>
                        {new Date(h.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {permissions.orders && (
            <Link href={`/app/${slug}/orders`} className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'hidden sm:inline-flex' })}>
              <ReceiptText /> Ventas
            </Link>
          )}
          {props.session && permissions.registers && (
            <Link href={`/app/${slug}/registers`} className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'hidden sm:inline-flex' })}>
              <Wallet /> Caja
            </Link>
          )}
          {permissions.dashboard && (
            <Link href={`/app/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'hidden lg:inline-flex' })} aria-label='Tablero'>
              <LayoutDashboard />
            </Link>
          )}
          <Clockface />
          <AnimatedThemeToggler className='flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent [&_svg]:size-3.5' />
        </div>
      </header>

      <div className='flex min-h-0 flex-1'>
        {/* Catálogo */}
        <section className='flex min-w-0 flex-1 flex-col'>
          <div className='space-y-3 border-b p-3 md:p-4'>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onScan()
              }}
              className='relative'
            >
              <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Busca o escanea un código de barras…'
                className='h-11 w-full rounded-lg border border-input bg-card pr-24 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'
              />
              <span className='pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5 text-muted-foreground'>
                <Barcode className='size-4' />
                <Kbd>F2</Kbd>
              </span>
            </form>
            <div className='-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]'>
              <CategoryChip active={!category} onClick={() => setCategory(null)} label='Todo' />
              {props.categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={category === c.id}
                  onClick={() => setCategory(category === c.id ? null : c.id)}
                  label={c.name}
                  color={c.color}
                />
              ))}
            </div>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto p-3 md:p-4'>
            {visible.length === 0 ? (
              <div className='flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground'>
                <ShoppingBag className='size-8 opacity-40' />
                {props.products.length === 0 ? 'Aún no hay productos activos.' : 'Sin coincidencias.'}
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
                {visible.map((p) => {
                  const stock = stockOf(p)
                  const qty = inCart(p.id)
                  const out = props.trackInventory && p.trackStock && stock <= 0
                  return (
                    <button
                      key={p.id}
                      type='button'
                      onClick={() => add(p)}
                      disabled={blocked(p)}
                      className='group relative flex min-h-28 flex-col overflow-hidden rounded-xl border bg-card p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45'
                    >
                      <span aria-hidden className='absolute inset-x-0 top-0 h-1' style={{ background: p.color ?? 'var(--velvet)' }} />
                      {qty > 0 && (
                        <span className='absolute top-2.5 right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[0.65rem] font-bold text-velvet tabular-nums shadow'>
                          {formatQty(qty)}
                        </span>
                      )}
                      <span className='mt-1 line-clamp-2 pr-6 text-sm leading-snug font-medium'>{p.name}</span>
                      <span className='mt-auto flex items-end justify-between gap-2 pt-3'>
                        <span className='font-heading text-lg font-semibold tabular-nums'>{money(p.price)}</span>
                        {props.trackInventory && p.trackStock && (
                          <span className={cn('text-[0.65rem] tabular-nums', out ? 'text-destructive' : 'text-muted-foreground')}>
                            {out ? 'Agotado' : formatQty(stock, p.unit)}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Ticket (escritorio) */}
        <aside className='hidden w-[24rem] shrink-0 flex-col border-l bg-sidebar lg:flex xl:w-[26rem]'>{cart}</aside>
      </div>

      {/* Ticket (móvil/tableta) */}
      <div className='border-t bg-background p-3 lg:hidden'>
        <Button size='lg' className='h-12 w-full justify-between text-sm' onClick={() => setCartOpen(true)}>
          <span className='flex items-center gap-2'>
            <ShoppingBag /> Ticket · {formatQty(itemCount)} art.
          </span>
          <span className='font-heading text-lg tabular-nums'>{money(totals.total)}</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side='right' className='w-full p-0 sm:max-w-md'>
          <SheetHeader className='sr-only'>
            <SheetTitle>Ticket</SheetTitle>
          </SheetHeader>
          <div className='flex h-full flex-col'>{cart}</div>
        </SheetContent>
      </Sheet>

      <PaymentDialog
        key={payKey}
        open={payOpen}
        onOpenChange={setPayOpen}
        slug={slug}
        total={totals.total}
        currency={currency}
        methods={props.paymentMethods}
        customer={customer}
        payload={{
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, discount: l.discount })),
          customerId: customer?.id ?? null,
          type: orderType,
          couponCode: coupon?.code ?? null,
          discount: coupon ? null : manual,
        }}
        onPaid={onPaid}
      />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'border-transparent bg-foreground text-background' : 'bg-card hover:border-gold/50',
      )}
    >
      {color && <span className='size-2 rounded-full' style={{ background: color }} />}
      {label}
    </button>
  )
}

const HELD_EVENT = 'ol-held-change'
const subscribeHeld = (cb: () => void) => {
  window.addEventListener('storage', cb)
  window.addEventListener(HELD_EVENT, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(HELD_EVENT, cb)
  }
}

/** Ventas en espera persistidas en localStorage (sin desajustes de hidratación). */
function useHeldOrders(key: string): Held[] {
  const raw = useSyncExternalStore(
    subscribeHeld,
    () => {
      try {
        return localStorage.getItem(key) ?? '[]'
      } catch {
        return '[]'
      }
    },
    () => '[]',
  )
  return useMemo(() => {
    try {
      return JSON.parse(raw) as Held[]
    } catch {
      return []
    }
  }, [raw])
}

const subscribeMinute = (cb: () => void) => {
  const t = setInterval(cb, 30_000)
  return () => clearInterval(t)
}

function Clockface() {
  const now = useSyncExternalStore(
    subscribeMinute,
    () => new Date().toISOString().slice(0, 16),
    () => null,
  )
  return (
    <span className='hidden items-center gap-1 px-2 text-xs text-muted-foreground tabular-nums xl:flex'>
      <Clock className='size-3.5' />
      {now && new Date(now + ':00Z').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

function CartPanel({
  lines,
  totals,
  money,
  customer,
  setCustomer,
  orderType,
  setOrderType,
  coupon,
  clearCoupon,
  applyCoupon,
  manual,
  setManual,
  setQty,
  setLineDiscount,
  clear,
  hold,
  pay,
  permissions,
  slug,
}: {
  lines: CartLine[]
  totals: ReturnType<typeof computeTotals>
  money: (v: number) => string
  customer: CustomerOption | null
  setCustomer: (c: CustomerOption | null) => void
  orderType: OrderType
  setOrderType: (t: OrderType) => void
  coupon: { code: string; type: 'percent' | 'fixed'; value: number } | null
  clearCoupon: () => void
  applyCoupon: (code: string) => Promise<unknown>
  manual: OrderDiscount | null
  setManual: (d: OrderDiscount | null) => void
  setQty: (id: string, q: number) => void
  setLineDiscount: (id: string, d: number) => void
  clear: () => void
  hold: () => void
  pay: () => void
  permissions: { discount: boolean; customers: boolean; createCustomer: boolean; coupons: boolean }
  slug: string
}) {
  const [couponCode, setCouponCode] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <>
      <div className='space-y-2.5 border-b p-3'>
        {permissions.customers ? (
          <CustomerPicker slug={slug} value={customer} onChange={setCustomer} canCreate={permissions.createCustomer} />
        ) : (
          <p className='text-xs text-muted-foreground'>Público en general</p>
        )}
        <div className='grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5'>
          {ORDER_TYPES.map((t) => (
            <button
              key={t.value}
              type='button'
              onClick={() => setOrderType(t.value)}
              className={cn(
                'rounded-md py-1.5 text-[0.7rem] font-medium transition-colors',
                orderType === t.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {lines.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
            <span className='flex size-14 items-center justify-center rounded-2xl border border-dashed text-muted-foreground'>
              <ShoppingBag className='size-6' />
            </span>
            <p className='text-sm font-medium'>Ticket vacío</p>
            <p className='text-xs text-muted-foreground'>Toca un producto o escanea su código para agregarlo.</p>
          </div>
        ) : (
          <ul className='divide-y'>
            {lines.map((l, i) => {
              const priced = totals.lines[i]
              const step = l.product.unit === 'pz' ? 1 : 0.1
              return (
                <li key={l.product.id} className='px-3 py-2.5'>
                  <div className='flex items-start gap-2'>
                    <button
                      type='button'
                      onClick={() => setEditing(editing === l.product.id ? null : l.product.id)}
                      className='min-w-0 flex-1 text-left'
                    >
                      <p className='truncate text-sm font-medium'>{l.product.name}</p>
                      <p className='text-[0.7rem] text-muted-foreground tabular-nums'>
                        {money(l.product.price)} {l.product.unit !== 'pz' && `/ ${l.product.unit}`}
                        {priced.discount > 0 && <span className='text-success'> · −{money(priced.discount)}</span>}
                      </p>
                    </button>
                    <span className='text-sm font-semibold tabular-nums'>{money(priced.gross - priced.discount)}</span>
                  </div>
                  <div className='mt-1.5 flex items-center gap-1'>
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label='Quitar uno'
                      onClick={() => setQty(l.product.id, Math.round((l.quantity - step) * 1000) / 1000)}
                    >
                      <Minus />
                    </Button>
                    <input
                      aria-label='Cantidad'
                      inputMode='decimal'
                      value={l.quantity}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) setQty(l.product.id, v)
                      }}
                      onFocus={(e) => e.target.select()}
                      className='h-7 w-14 rounded-md border bg-background text-center text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                    />
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label='Agregar uno'
                      onClick={() => setQty(l.product.id, Math.round((l.quantity + step) * 1000) / 1000)}
                    >
                      <Plus />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label='Eliminar'
                      className='ml-auto text-muted-foreground hover:text-destructive'
                      onClick={() => setQty(l.product.id, 0)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {editing === l.product.id && permissions.discount && (
                    <label className='mt-2 flex items-center gap-2 text-[0.7rem] text-muted-foreground'>
                      Descuento en línea ($)
                      <input
                        inputMode='decimal'
                        defaultValue={l.discount ? (l.discount / 100).toFixed(2) : ''}
                        onBlur={(e) => setLineDiscount(l.product.id, toCents(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className='h-7 w-24 rounded-md border bg-background px-2 text-right text-xs tabular-nums outline-none'
                      />
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className='space-y-3 border-t bg-background/60 p-3'>
        {(permissions.coupons || permissions.discount) && lines.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5'>
            {coupon ? (
              <span className='flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[0.7rem] font-medium text-gold-deep dark:text-gold'>
                <TicketPercent className='size-3.5' /> {coupon.code}
                <button type='button' aria-label='Quitar cupón' onClick={clearCoupon}>
                  <X className='size-3' />
                </button>
              </span>
            ) : manual ? (
              <span className='flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[0.7rem] font-medium text-success'>
                <Percent className='size-3.5' />
                {manual.type === 'percent' ? `${manual.value / 100}%` : money(manual.value)}
                <button type='button' aria-label='Quitar descuento' onClick={() => setManual(null)}>
                  <X className='size-3' />
                </button>
              </span>
            ) : (
              <>
                {permissions.coupons && (
                  <form
                    className='flex flex-1 items-center gap-1'
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (couponCode.trim()) await applyCoupon(couponCode)
                    }}
                  >
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder='Cupón'
                      className='h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
                    />
                    <Button type='submit' variant='outline' size='default'>
                      Aplicar
                    </Button>
                  </form>
                )}
                {permissions.discount && (
                  <Button variant='outline' onClick={() => setShowDiscount((s) => !s)}>
                    <Percent /> Descuento
                  </Button>
                )}
              </>
            )}
          </div>
        )}
        {showDiscount && !manual && !coupon && (
          <form
            className='flex items-center gap-1.5'
            onSubmit={(e) => {
              e.preventDefault()
              const v = Number(discountValue)
              if (!v || v < 0) return
              setManual({ type: discountType, value: Math.round(v * 100) })
              setShowDiscount(false)
              setDiscountValue('')
            }}
          >
            <div className='grid grid-cols-2 rounded-md border p-0.5'>
              {(['percent', 'fixed'] as const).map((t) => (
                <button
                  key={t}
                  type='button'
                  onClick={() => setDiscountType(t)}
                  className={cn('rounded px-2 py-1 text-[0.7rem]', discountType === t && 'bg-muted font-medium')}
                >
                  {t === 'percent' ? '%' : '$'}
                </button>
              ))}
            </div>
            <input
              autoFocus
              inputMode='decimal'
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '10' : '50.00'}
              className='h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-right text-xs tabular-nums outline-none'
            />
            <Button type='submit'>Aplicar</Button>
          </form>
        )}

        <dl className='space-y-1 text-xs'>
          <div className='flex justify-between text-muted-foreground'>
            <dt>Subtotal</dt>
            <dd className='tabular-nums'>{money(totals.subtotal)}</dd>
          </div>
          {totals.discountTotal > 0 && (
            <div className='flex justify-between text-success'>
              <dt>Descuentos</dt>
              <dd className='tabular-nums'>−{money(totals.discountTotal)}</dd>
            </div>
          )}
          <div className='flex justify-between text-muted-foreground'>
            <dt>Impuestos</dt>
            <dd className='tabular-nums'>{money(totals.taxTotal)}</dd>
          </div>
          <div className='flex items-baseline justify-between pt-1'>
            <dt className='text-sm font-medium'>Total</dt>
            <dd className='font-heading text-3xl font-bold tabular-nums'>{money(totals.total)}</dd>
          </div>
        </dl>

        <div className='grid grid-cols-[auto_auto_1fr] gap-2'>
          <Button variant='outline' size='icon-lg' className='size-12' aria-label='Vaciar ticket' disabled={!lines.length} onClick={clear}>
            <Trash2 />
          </Button>
          <Button variant='outline' size='icon-lg' className='size-12' aria-label='Poner en espera (F8)' disabled={!lines.length} onClick={hold}>
            <PauseCircle />
          </Button>
          <Button size='lg' className='h-12 justify-between px-4 text-sm' disabled={!lines.length} onClick={pay}>
            <span className='flex items-center gap-2'>
              Cobrar <Kbd className='bg-black/10 text-current'>F9</Kbd>
            </span>
            <span className='font-heading text-lg tabular-nums'>{money(totals.total)}</span>
          </Button>
        </div>
      </div>
    </>
  )
}
