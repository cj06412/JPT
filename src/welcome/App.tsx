import { theme } from '@shared/theme'

const PLACEHOLDER_LETTER = `亲爱的小屿：

这是一个会动的小礼物。

桌面底部那个像素小人是我（JPT），点它就能跟我聊天。
我擅长帮你写论文、聊统计、当树洞、改稿、翻译…
有任何疑惑都来找我。

—— 你的男朋友 在 2026 春

PS: 关掉这封信 → 我就开始上岗了 :)
`

export function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 520,
        background: theme.paperBg,
        boxShadow: theme.cardShadow,
        border: `4px solid ${theme.woodOutline}`,
        padding: 24,
        whiteSpace: 'pre-line',
        lineHeight: 1.8,
        cursor: 'pointer',
      }}
      onClick={() => window.jpt.send('welcome:close')}
      >
        {PLACEHOLDER_LETTER}
        <div style={{ marginTop: 16, opacity: 0.6, fontSize: 12, textAlign: 'right' }}>
          点击关闭
        </div>
      </div>
    </div>
  )
}
