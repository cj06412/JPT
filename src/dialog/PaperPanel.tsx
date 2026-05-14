import { forwardRef, ReactNode } from 'react'
import { theme } from '@shared/theme'

export interface PaperPanelProps {
  children: ReactNode
}

export const PaperPanel = forwardRef<HTMLDivElement, PaperPanelProps>(({ children }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        overflowY: 'auto',
        background: theme.paperBg,
        boxShadow: `inset 0 0 0 1px ${theme.paperHi}`,
        border: `2px solid ${theme.woodOutline}`,
        padding: 12,
        fontSize: 14,
        lineHeight: 1.6,
        color: theme.paperInk,
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  )
})
PaperPanel.displayName = 'PaperPanel'
