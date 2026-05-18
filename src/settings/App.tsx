import { useEffect, useState } from 'react'
import type { ConfigSnapshot } from '@shared/config'

export function App() {
  const [cfg, setCfg] = useState<ConfigSnapshot | null>(null)

  useEffect(() => {
    window.jpt.invoke<ConfigSnapshot>('settings:get').then(setCfg)
  }, [])

  if (!cfg) return <div style={{ padding: 16 }}>加载中…</div>

  const update = (patch: Partial<ConfigSnapshot>) => {
    window.jpt.invoke<ConfigSnapshot>('settings:set', patch).then(setCfg)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>JPT 设置</h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>AI 后端</span>
        <select
          value={cfg.agentBackend}
          onChange={(e) => update({ agentBackend: e.target.value as ConfigSnapshot['agentBackend'] })}
          style={inputStyle}
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Codex 工作目录</span>
        <input
          value={cfg.codexWorkdir}
          onChange={(e) => update({ codexWorkdir: e.target.value })}
          placeholder="%APPDATA%\\JPT\\codex-workdir"
          style={inputStyle}
        />
      </label>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
        Codex 默认完整 agent；JPT 固定阻止删除整个文件。空闲 20 分钟后会回收 Codex 后端。
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>角色名（对话框名牌）</span>
        <input
          value={cfg.characterDisplayName}
          onChange={(e) => update({ characterDisplayName: e.target.value })}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>她的称呼</span>
        <input
          value={cfg.userAddressName}
          onChange={(e) => update({ userAddressName: e.target.value })}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>字体大小</span>
        <select
          value={cfg.fontSize}
          onChange={(e) => update({ fontSize: e.target.value as ConfigSnapshot['fontSize'] })}
          style={inputStyle}
        >
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={cfg.soundsEnabled}
          onChange={(e) => update({ soundsEnabled: e.target.checked })}
        />
        <span>声音（v1.5 启用）</span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={cfg.launchAtStartup}
          onChange={(e) => update({ launchAtStartup: e.target.checked })}
        />
        <span>开机自启</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 200 }}>
        <span>JPT 人格（CLAUDE.md）— 留空使用占位人格</span>
        <textarea
          value={cfg.personaDoc}
          onChange={(e) => update({ personaDoc: e.target.value })}
          style={{ ...inputStyle, flex: 1, fontFamily: 'inherit', resize: 'none' }}
        />
      </label>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  border: '2px solid #3e2410',
  background: '#fff4dc',
  color: '#2a1a08',
}
