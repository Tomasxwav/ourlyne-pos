const HOST_CLASSES = ['bg-none!']
const PART_CLASSES = [
  'bg-linear-to-r',
  'from-primary-foreground',
  'to-foreground',
  'bg-size-[var(--sg-w)_var(--sg-h)]',
  'bg-no-repeat',
  'bg-clip-text',
  'text-transparent',
]

export function paintSplitGradient(host: HTMLElement, parts: Element[]) {
  const hostRect = host.getBoundingClientRect()
  const scale = hostRect.width / host.offsetWidth || 1

  host.classList.add(...HOST_CLASSES)
  host.style.setProperty('--sg-w', `${host.offsetWidth}px`)
  host.style.setProperty('--sg-h', `${host.offsetHeight}px`)

  parts.forEach((part) => {
    const el = part as HTMLElement
    const rect = el.getBoundingClientRect()
    el.classList.add(...PART_CLASSES)
    el.style.backgroundPosition = `${-(rect.left - hostRect.left) / scale}px ${-(rect.top - hostRect.top) / scale}px`
  })
}

export function clearSplitGradient(host: HTMLElement | null) {
  host?.classList.remove(...HOST_CLASSES)
}
