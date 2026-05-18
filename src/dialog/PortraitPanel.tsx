import portraitDefault from '../../assets/sprites/jpt-portrait.png'
import portraitHappy from '../../assets/sprites/jpt-happy.png'
import portraitThink from '../../assets/sprites/jpt-thinking.png'
import portraitConfused from '../../assets/sprites/jpt-confused.png'
import portraitSad from '../../assets/sprites/jpt-sad.png'

export type Expression = 'default' | 'smile' | 'think' | 'confused' | 'sad'

// Real expression art ('smile' uses jpt-happy.png).
const EXPR_SRC: Record<Expression, string> = {
  default: portraitDefault,
  smile: portraitHappy,
  think: portraitThink,
  confused: portraitConfused,
  sad: portraitSad,
}

export interface PortraitPanelProps {
  name: string
  expression: Expression
}

/**
 * Just the portrait image. The wood box + purple pin are painted by
 * jpt-dialog.png; the parent positions this over that painted box.
 */
export function PortraitPanel({ name, expression }: PortraitPanelProps) {
  return (
    <img
      src={EXPR_SRC[expression]}
      alt={name}
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        imageRendering: 'pixelated',
        display: 'block',
        userSelect: 'none',
      }}
    />
  )
}
