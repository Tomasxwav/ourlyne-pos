'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton({ label = 'Imprimir' }: { label?: string }) {
  return (
    <Button variant='outline' size='lg' onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  )
}
