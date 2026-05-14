import { ReactNode } from 'react'
import { theme } from '@shared/theme'

export function SDVFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        background: `linear-gradient(180deg, ${theme.woodLight} 0%, ${theme.woodMid} 50%, ${theme.woodDark} 100%)`,
        border: `4px solid ${theme.woodOutline}`,
        boxShadow: theme.cardShadow,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {children}
    </div>
  )
}
