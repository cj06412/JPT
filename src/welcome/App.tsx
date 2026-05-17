import { useEffect } from 'react'
import { theme } from '@shared/theme'
import letterUrl from '../../assets/sprites/letter.png'

// Replace with the real letter before gifting (gift-ship checklist).
const LETTER = `亲爱的小屿：

这是一个会动的小礼物。

桌面底部那个像素小人是我（JPT），
点它就能跟我聊天。我擅长帮你写论文、
聊统计、当树洞、改稿、翻译…
有任何疑惑都来找我。

—— 你的男朋友 · 2026 春

PS: 关掉这封信我就开始上岗啦 :)`

function close() {
  window.jpt.send('welcome:close')
}

export function App() {
  // Esc / Enter closes — redundant path in case the click handler misfires.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // letter.png is the blank parchment; the text is laid over its writable
  // area (insets keep clear of the torn corners/edges). Click anywhere /
  // Esc / Enter dismisses it and the character goes on duty.
  return (
    <div
      onClick={close}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundImage: `url(${letterUrl})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12%',
          bottom: '12%',
          left: '13%',
          right: '13%',
          overflow: 'auto',
          whiteSpace: 'pre-line',
          fontFamily: theme.fontPixel,
          fontSize: 14,
          lineHeight: 1.9,
          color: theme.paperInk,
        }}
      >
        {LETTER}
      </div>
    </div>
  )
}
