import { ReactNode } from 'react'
import frameUrl from '../../assets/sprites/jpt-dialog.png'

/**
 * The whole dialog is one fixed-layout SDV frame image (jpt-dialog.png).
 * The window's aspect ratio matches the image (see DIALOG_W/H), so the art
 * is drawn 100%×100% with negligible distortion. Children are absolutely
 * positioned over it (percentages of this box) to land in the painted
 * regions: left paper = chat, right box = portrait, scroll = name.
 */
export function SDVFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundImage: `url(${frameUrl})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
