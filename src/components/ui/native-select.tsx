import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Select nativo con el estilo de los inputs; ideal para formularios con FormData. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot='native-select-wrapper' className='relative w-full'>
      <select
        data-slot='native-select'
        className={cn(
          'h-7 w-full min-w-0 appearance-none rounded-md border border-input bg-input/20 py-0.5 pr-7 pl-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive md:text-xs/relaxed dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className='pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground' />
    </div>
  )
}

export { NativeSelect }
