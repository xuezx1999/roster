import type { ReactNode } from 'react'

interface BracketProps {
  children: ReactNode
  className?: string
}

export function Bracket({ children, className }: BracketProps) {
  return (
    <span className={`inline-flex items-center shrink-0 ${className ?? ''}`} style={{ width: '3.5ch' }}>
      <span>[</span>
      <span className="inline-flex items-center justify-center overflow-hidden" style={{ width: '1.5ch' }}>
        {children}
      </span>
      <span>]</span>
    </span>
  )
}
