import { forwardRef } from 'react'
import { theme } from '@shared/theme'

export interface InputBarProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
  placeholder: string
}

export const InputBar = forwardRef<HTMLInputElement, InputBarProps>((props, ref) => {
  const { value, onChange, onSend, disabled, placeholder } = props
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: 8,
          fontSize: 14,
          fontFamily: theme.fontPixel,
          border: `2px solid ${theme.woodOutline}`,
          background: theme.paperBg,
          color: theme.paperInk,
        }}
      />
      <button
        disabled={disabled}
        onClick={onSend}
        style={{
          padding: '6px 14px',
          fontFamily: theme.fontPixel,
          fontSize: 14,
          background: theme.nameplate,
          border: `2px solid ${theme.woodOutline}`,
          color: theme.paperInk,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        送
      </button>
    </div>
  )
})
InputBar.displayName = 'InputBar'
