import { useEffect } from 'react'

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.jpt.send('dialog:close')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <div style={{ padding: 16 }}>Dialog placeholder — Esc 关闭</div>
}
