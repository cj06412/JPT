import { useEffect } from 'react'
import { theme } from '@shared/theme'

const PLACEHOLDER_LETTER = `亲爱的小屿：

这是一个会动的小礼物。

桌面底部那个像素小人是我（JPT），点它就能跟我聊天。
我擅长帮你写论文、聊统计、当树洞、改稿、翻译…
有任何疑惑都来找我。

—— 你的男朋友 在 2026 春

PS: 关掉这封信 → 我就开始上岗了 :)
`

function close() {
  window.jpt.send('welcome:close')
}

export function App() {
  // Esc closes — same convention as the dialog window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
      onClick={close /* clicking the transparent surround also closes */}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: 520,
          background: theme.paperBg,
          boxShadow: theme.cardShadow,
          border: `4px solid ${theme.woodOutline}`,
          padding: 24,
          whiteSpace: 'pre-line',
          lineHeight: 1.8,
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation()
          close()
        }}
      >
        {/* Explicit × close button in case click-through doesn't register */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
          aria-label="关闭"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            background: theme.nameplate,
            border: `2px solid ${theme.woodOutline}`,
            color: theme.paperInk,
            fontSize: 16,
            fontFamily: 'inherit',
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
        {PLACEHOLDER_LETTER}
        <div style={{ marginTop: 16, opacity: 0.6, fontSize: 12, textAlign: 'right' }}>
          点击信纸 / 点 × / Esc 关闭
        </div>
      </div>
    </div>
  )
}
