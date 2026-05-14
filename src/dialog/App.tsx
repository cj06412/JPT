import { useEffect, useRef, useState } from 'react'

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
  const currentAssistantIdx = useRef<number | null>(null)

  // Esc closes; auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.jpt.send('dialog:close')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Session ready: query current state on mount in case the system/init event
  // fired before we registered the listener, then also listen for the live event.
  useEffect(() => {
    window.jpt.invoke<boolean>('agent:is-ready').then(setReady)
    const off = window.jpt.on('dialog:session-ready', () => setReady(true))
    return () => { off() }
  }, [])

  // Wire IPC events from main
  useEffect(() => {
    const offToken = window.jpt.on('dialog:stream-token', (...args: unknown[]) => {
      const chunk = args[0] as string
      setMsgs((prev) => {
        const next = [...prev]
        if (currentAssistantIdx.current === null) {
          next.push({ role: 'assistant', text: chunk })
          currentAssistantIdx.current = next.length - 1
        } else {
          const i = currentAssistantIdx.current
          next[i] = { ...next[i], text: next[i].text + chunk }
        }
        return next
      })
    })
    const offComplete = window.jpt.on('dialog:turn-complete', () => {
      currentAssistantIdx.current = null
      setBusy(false)
    })
    const offError = window.jpt.on('dialog:error', (...args: unknown[]) => {
      const msg = args[0] as string
      setMsgs((prev) => [...prev, { role: 'error', text: msg }])
      currentAssistantIdx.current = null
      setBusy(false)
    })
    return () => {
      offToken()
      offComplete()
      offError()
    }
  }, [])

  // Pin scroll to bottom on any message change (incl. mid-stream token append).
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
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        gap: 8,
        background: '#efc88c',
        border: '4px solid #3e2410',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#fff4dc',
          padding: 12,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {msgs.length === 0 && (
          <div style={{ opacity: 0.5 }}>说点什么试试…（Esc 关闭）</div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 8,
              color: m.role === 'error' ? '#a02a2a' : '#2a1a08',
            }}
          >
            <strong>
              {m.role === 'user' ? '我：' : m.role === 'error' ? '错误：' : 'JPT：'}
            </strong>{' '}
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={input}
          disabled={busy || !ready}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend()
          }}
          placeholder={!ready ? 'JPT 准备中…' : busy ? 'JPT 思考中…' : '说点什么…'}
          style={{
            flex: 1,
            padding: 8,
            fontSize: 14,
            border: '2px solid #3e2410',
            background: '#fff4dc',
          }}
        />
        <button
          disabled={busy || !ready}
          onClick={onSend}
          style={{
            padding: '6px 14px',
            background: '#d8b078',
            border: '2px solid #3e2410',
            cursor: 'pointer',
          }}
        >
          送
        </button>
      </div>
    </div>
  )
}
