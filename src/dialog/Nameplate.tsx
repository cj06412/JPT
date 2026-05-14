import { theme } from '@shared/theme'

export function Nameplate({ name }: { name: string }) {
  return (
    <div
      style={{
        marginTop: 6,
        padding: '4px 12px',
        background: theme.nameplate,
        border: `2px solid ${theme.woodOutline}`,
        borderRadius: 2,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.paperInk,
        position: 'relative',
      }}
    >
      <span style={rivetStyle('left')} />
      <span style={rivetStyle('right')} />
      {name}
    </div>
  )
}

function rivetStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: -6,
    transform: 'translateY(-50%)',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: theme.woodOutline,
    boxShadow: `0 0 0 2px ${theme.woodMid}`,
  }
}
