import { SectionTabs } from './section-tabs'

export function InventoryTabs({ slug, transfers }: { slug: string; transfers: boolean }) {
  const base = `/app/${slug}/inventory`
  return (
    <SectionTabs
      items={[
        { href: base, label: 'Existencias', exact: true },
        { href: `${base}/movements`, label: 'Movimientos' },
        ...(transfers ? [{ href: `${base}/transfers`, label: 'Traspasos' }] : []),
      ]}
    />
  )
}
