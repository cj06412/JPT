import { theme } from '@shared/theme'
import { Nameplate } from './Nameplate'
import portraitDefault from '../../assets/sprites/jpt-portrait.png'
import portraitSmile from '../../assets/sprites/jpt-portrait-smile.png'
import portraitThink from '../../assets/sprites/jpt-portrait-think.png'
import portraitConfused from '../../assets/sprites/jpt-portrait-confused.png'

export type Expression = 'default' | 'smile' | 'think' | 'confused'

const EXPR_SRC: Record<Expression, string> = {
  default: portraitDefault,
  smile: portraitSmile,
  think: portraitThink,
  confused: portraitConfused,
}

export interface PortraitPanelProps {
  name: string
  expression: Expression
}

export function PortraitPanel({ name, expression }: PortraitPanelProps) {
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
          src={EXPR_SRC[expression]}
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
