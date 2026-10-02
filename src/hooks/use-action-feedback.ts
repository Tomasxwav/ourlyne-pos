'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ActionResult } from '@/server/action'

/** Muestra un toast con el resultado de una acción y ejecuta `onSuccess`. */
export function useActionFeedback<T>(
  state: ActionResult<T> | null | undefined,
  opts: { success?: string; onSuccess?: (data?: T) => void } = {},
) {
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })
  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success(state.message ?? optsRef.current.success ?? 'Guardado')
      optsRef.current.onSuccess?.(state.data)
    } else if (!state.fieldErrors) {
      toast.error(state.error)
    } else {
      toast.error(state.error)
    }
  }, [state])
}
