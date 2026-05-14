# v0 Acceptance Log

Source spec: `docs/superpowers/specs/2026-05-10-JPT-design.md` §10 (v0 验收)

## Acceptance criteria

- [x] Vite + Electron + React + TS scaffolding runs
- [x] Two windows: transparent AOT character window + transparent AOT dialog window
- [x] Placeholder red rectangle walks back-and-forth at the bottom of primary display
- [x] `ClaudeSession` spawns `claude` CLI; stdin/stdout connected
- [x] Static end-to-end message: dialog → main → claude → dialog (streaming)
- [x] User can click character to open dialog, type "hello", receive Claude response

## How to run (Windows)

```powershell
# from JPT repo root
npm install   # first time only
npm run dev   # opens character + dialog windows
```

## How to test

1. Wait for the red square to appear at the bottom of the primary display (above the taskbar)
2. Wait for it to walk left and right
3. Click the red square → dialog window appears
4. Type `hello` → press Enter
5. Watch Claude's response stream in
6. Press Esc → dialog hides
7. Press Ctrl+C in the terminal to quit
