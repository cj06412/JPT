import { useEffect, useRef, useState } from 'react'
import { SDVFrame } from './SDVFrame'
import { PaperPanel } from './PaperPanel'
import { PortraitPanel } from './PortraitPanel'
import { InputBar } from './InputBar'
import { Markdown } from './markdown'
import { theme } from '@shared/theme'

interface Msg {
  role: 'user' | 'assistant' | 'error'
  text: string
}

export function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') window.jpt.send('dialog:close') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.jpt.invoke<boolean>('agent:is-ready').then(setReady)
    const off = window.jpt.on('dialog:session-ready', () => setReady(true))
    return () => { off() }
  }, [])

  useEffect(() => {
    const offToken = window.jpt.on('dialog:stream-token', (...args: unknown[]) => {
      const chunk = args[0] as string
      // Append to the trailing assistant message if there is one, otherwise
      // start a new one. Pure updater — works correctly under React 19
      // StrictMode double-invocation (the previous ref-based version had a
      // side-effect inside the updater that crashed on the second call).
      setMsgs((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, text: last.text + chunk }]
        }
        return [...prev, { role: 'assistant', text: chunk }]
      })
    })
    const offComplete = window.jpt.on('dialog:turn-complete', () => {
      setBusy(false)
    })
    const offError = window.jpt.on('dialog:error', (...args: unknown[]) => {
      const msg = args[0] as string
      setMsgs((prev) => [...prev, { role: 'error', text: msg }])
      setBusy(false)
    })
    return () => { offToken(); offComplete(); offError() }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  const onSend = () => {
    const text = input.trim()
    if (!text || busy || !ready) return
    setMsgs((p) => [...p, { role: 'user', text }])
    setInput('')
    setBusy(true)
    window.jpt.send('dialog:user-send', text)
  }

  return (
    <SDVFrame>
      <div style={{ display: 'flex', flex: 1, gap: 8, minHeight: 0 }}>
        <PaperPanel ref={scrollRef}>
          {msgs.length === 0 && (
            <div style={{ color: theme.paperInkFaded }}>说点什么试试…（Esc 关闭）</div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{ marginBottom: 8, color: m.role === 'error' ? theme.error : theme.paperInk }}
            >
              <strong>
                {m.role === 'user' ? '我：' : m.role === 'error' ? '错误：' : 'JPT：'}
              </strong>{' '}
              {m.role === 'assistant' ? <Markdown text={m.text} /> : <span>{m.text}</span>}
            </div>
          ))}
        </PaperPanel>
        <PortraitPanel name="JPT" />
      </div>
      <InputBar
        ref={inputRef}
        value={input}
        onChange={setInput}
        onSend={onSend}
        disabled={busy || !ready}
        placeholder={!ready ? 'JPT 准备中…' : busy ? 'JPT 思考中…' : '说点什么…'}
      />
    </SDVFrame>
  )
}
