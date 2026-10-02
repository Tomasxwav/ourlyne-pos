import { SectionTabs } from '@/components/app/section-tabs'

export function PurchasesTabs({ slug }: { slug: string }) {
  const base = `/app/${slug}/purchases`
  return (
    <SectionTabs
      items={[
        { href: base, label: 'Órdenes de compra', exclude: [`${base}/suppliers`] },
        { href: `${base}/suppliers`, label: 'Proveedores' },
      ]}
    />
  )
}
