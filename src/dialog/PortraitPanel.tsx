import { theme } from '@shared/theme'
import { Nameplate } from './Nameplate'
import portraitUrl from '../../assets/sprites/jpt-portrait.png'

export interface PortraitPanelProps {
  name: string
}

export function PortraitPanel({ name }: PortraitPanelProps) {
  return (
    <div
      style={{
        width: 96,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          border: `2px solid ${theme.woodOutline}`,
          background: theme.paperBg,
          padding: 4,
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <img
          src={portraitUrl}
          alt={name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
            display: 'block',
            userSelect: 'none',
          }}
        />
        <span style={{
          position: 'absolute',
          right: 6,
          bottom: 6,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: theme.bluePin,
          boxShadow: `0 0 0 1px ${theme.woodOutline}`,
        }} />
      </div>
      <Nameplate name={name} />
    </div>
  )
}
