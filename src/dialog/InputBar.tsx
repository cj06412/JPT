import { forwardRef } from 'react'
import { theme } from '@shared/theme'
import chatboxUrl from '../../assets/sprites/chatbox.png'
import sendUrl from '../../assets/sprites/send.png'

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: '100%' }}>
      {/* chatbox.png scroll = the text field background */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          height: '100%',
          backgroundImage: `url(${chatboxUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
          placeholder={placeholder}
          style={{
            // sit inside the scroll's flat middle, clear of the curled ends
            width: '100%',
            margin: '0 7%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            fontFamily: theme.fontPixel,
            color: theme.paperInk,
          }}
        />
      </div>
      {/* send.png = the send button */}
      <button
        disabled={disabled}
        onClick={onSend}
        aria-label="发送"
        style={{
          height: '82%',
          aspectRatio: '1 / 1',
          padding: 0,
          background: `url(${sendUrl}) center / contain no-repeat`,
          imageRendering: 'pixelated',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  )
})
InputBar.displayName = 'InputBar'
