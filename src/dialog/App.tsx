import { useEffect, useRef, useState } from 'react'
import { SDVFrame } from './SDVFrame'
import { PaperPanel } from './PaperPanel'
import { PortraitPanel } from './PortraitPanel'
import { InputBar } from './InputBar'
import { Markdown } from './markdown'
import { theme } from '@shared/theme'
import { ToolUseCard } from './ToolUseCard'
import { parseSlash, slashHelpText } from './slash'
import type { Expression } from './PortraitPanel'
import { playSound, setSoundsEnabled } from './sounds'

type Msg =
  | { role: 'user' | 'assistant' | 'error'; text: string }
  | { role: 'tool'; tool: string; summary: string; result?: string; isError?: boolean }

// Type-sound throttle: streaming tokens arrive far faster than is pleasant to
// hear. Module-level so it persists across renders. ~140ms between blips.
let lastType = 0

export function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [expression, setExpression] = useState<Expression>('default')
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
    window.jpt.invoke<{ soundsEnabled: boolean }>('settings:get').then((c) => setSoundsEnabled(c.soundsEnabled))
    const off = window.jpt.on('settings:sounds-changed', (...a: unknown[]) => setSoundsEnabled(Boolean(a[0])))
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
      if (Date.now() - lastType > 140) {
        lastType = Date.now()
        playSound('type')
      }
    })
    const offComplete = window.jpt.on('dialog:turn-complete', () => {
      setBusy(false)
      setExpression('smile')
      playSound('complete')
    })
    const offError = window.jpt.on('dialog:error', (...args: unknown[]) => {
      const msg = args[0] as string
      setMsgs((prev) => [...prev, { role: 'error', text: msg }])
      setBusy(false)
      setExpression('confused')
    })
    const offToolUse = window.jpt.on('dialog:tool-use', (...args: unknown[]) => {
      const { tool, summary } = args[0] as { tool: string; summary: string }
      setMsgs((prev) => [...prev, { role: 'tool', tool, summary }])
      setExpression('think')
    })
    const offToolResult = window.jpt.on('dialog:tool-result', (...args: unknown[]) => {
      const { summary, isError } = args[0] as { summary: string; isError: boolean }
      setMsgs((prev) => {
        // Attach the result to the most recent tool card lacking one.
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i]
          if (m.role === 'tool' && m.result === undefined) {
            const next = [...prev]
            next[i] = { ...m, result: summary, isError }
            return next
          }
        }
        return [...prev, { role: 'tool', tool: '🔧', summary: '', result: summary, isError }]
      })
    })
    const offProactive = window.jpt.on('dialog:proactive', (...a: unknown[]) => {
      setMsgs((p) => [...p, { role: 'assistant', text: String(a[0]) }])
      setExpression('smile')
    })
    return () => { offToken(); offComplete(); offError(); offToolUse(); offToolResult(); offProactive() }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  const onSend = () => {
    const text = input.trim()
    if (!text || busy || !ready) return
    const slash = parseSlash(text)
    if (slash) {
      setInput('')
      if (slash.cmd === 'clear') {
        setMsgs([])
        window.jpt.send('dialog:slash-clear')
      } else if (slash.cmd === 'copy') {
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant') as { text: string } | undefined
        if (lastAssistant) navigator.clipboard?.writeText(lastAssistant.text).catch(() => {})
        setMsgs((p) => [...p, { role: 'assistant', text: lastAssistant ? '（已复制上一条回复）' : '（没有可复制的回复）' }])
      } else {
        setMsgs((p) => [...p, { role: 'assistant', text: slashHelpText() }])
      }
      return
    }
    setMsgs((p) => [...p, { role: 'user', text }])
    setInput('')
    setBusy(true)
    setExpression('think')
    window.jpt.send('dialog:user-send', text)
    playSound('click')
  }

  return (
    <SDVFrame>
      <div style={{ display: 'flex', flex: 1, gap: 8, minHeight: 0 }}>
        <PaperPanel ref={scrollRef}>
          {msgs.length === 0 && (
            <div style={{ color: theme.paperInkFaded }}>说点什么试试…（Esc 关闭）</div>
          )}
          {msgs.map((m, i) => {
            if (m.role === 'tool') {
              return <ToolUseCard key={i} tool={m.tool} summary={m.summary} result={m.result} isError={m.isError} />
            }
            return (
              <div
                key={i}
                style={{ marginBottom: 8, color: m.role === 'error' ? theme.error : theme.paperInk }}
              >
                <strong>
                  {m.role === 'user' ? '我：' : m.role === 'error' ? '错误：' : 'JPT：'}
                </strong>{' '}
                {m.role === 'assistant' ? <Markdown text={m.text} /> : <span>{m.text}</span>}
              </div>
            )
          })}
        </PaperPanel>
        <PortraitPanel name="JPT" expression={expression} />
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
