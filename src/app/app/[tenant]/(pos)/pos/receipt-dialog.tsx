'use client'

import { CheckCircle2, Printer } from 'lucide-react'
import { Receipt, type ReceiptData } from '@/components/pos/receipt'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'

export function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptData | null; onClose: () => void }) {
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader className='items-center text-center'>
          <span className='flex size-12 items-center justify-center rounded-full bg-success/15 text-success'>
            <CheckCircle2 className='size-6' />
          </span>
          <DialogTitle className='font-heading text-2xl'>¡Venta completada!</DialogTitle>
          {receipt && receipt.change > 0 && (
            <p className='text-sm'>
              Cambio:{' '}
              <span className='font-heading text-xl font-semibold text-success tabular-nums'>
                {formatMoney(receipt.change, receipt.business.currency)}
              </span>
            </p>
          )}
        </DialogHeader>
        {receipt && (
          <div className='rounded-lg border bg-white shadow-inner'>
            <Receipt data={receipt} />
          </div>
        )}
        <div className='grid grid-cols-2 gap-2'>
          <Button variant='outline' size='lg' className='h-10' onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
          <Button size='lg' className='h-10' autoFocus onClick={onClose}>
            Nueva venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
