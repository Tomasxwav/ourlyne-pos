import type { ReactNode } from 'react'

export const rollLink = 'group/roll relative inline-flex overflow-hidden'

const rollSpan = 'block transition-transform duration-550 ease-expo'

export default function RollText({ children }: { children: ReactNode }) {
  return (
    <>
      <span className={`${rollSpan} group-hover/roll:-translate-y-full`}>
        {children}
      </span>
      <span
        aria-hidden='true'
        className={`${rollSpan} absolute inset-0 translate-y-full text-gold group-hover/roll:translate-y-0`}
      >
        {children}
      </span>
    </>
  )
}
