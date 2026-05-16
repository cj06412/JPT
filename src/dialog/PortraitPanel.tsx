import portraitDefault from '../../assets/sprites/jpt-portrait.png'

export type Expression = 'default' | 'smile' | 'think' | 'confused'

// Expression switching is wired (dialog sets think/smile/confused on
// send/complete/error) but ALL map to the one real portrait for now —
// jpt-portrait-{smile,think,confused}.png are still red-square placeholders.
// When real expression art lands, point these back at the per-expression files.
const EXPR_SRC: Record<Expression, string> = {
  default: portraitDefault,
  smile: portraitDefault,
  think: portraitDefault,
  confused: portraitDefault,
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
