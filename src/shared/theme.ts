/**
 * SDV-flavored palette and typography. Single source of truth — all renderer
 * components import from here so retheming is one-file work.
 *
 * Palette references: lospec.com/palette-list/stardew-valley
 */

export const theme = {
  // Wood frame
  woodLight: '#d18646',
  woodMid: '#a86930',
  woodDark: '#b87632',
  woodOutline: '#3e2410',

  // Paper
  paperBg: '#efc88c',
  paperHi: '#f5d8a4',
  paperInk: '#2a1a08',
  paperInkFaded: '#6b4a23',

  // Nameplate / accents
  nameplate: '#d8b078',
  bluePin: '#5478aa',

  // Errors / streaming cursor
  error: '#a02a2a',
  cursor: '#3e2410',

  // Shadows
  cardShadow: '4px 4px 0 rgba(0, 0, 0, 0.4)',

  // Fonts — Zpix bundled via @font-face in dialog/index.html
  fontPixel: '"Zpix", "Cubic 11", monospace',
} as const

export type Theme = typeof theme
