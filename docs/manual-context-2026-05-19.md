# Manual Context Snapshot — 2026-05-19

> Purpose: manual context compression because the automatic context compaction may have lost or distorted state.
> Read this first when resuming the JPT work. It records the repo state, active worktree, verification evidence, and known risks as of this handoff.

## Latest User Intent

The user first asked to deeply understand the repository, then said the Codex backend worktree should be done and asked for a review, then noticed context compression issues and asked to write this manual context document.

Newest instruction: create a durable context document. Do not merge, revert, or continue implementation unless asked.

## Environment

- Main repo path: `C:\Users\LeoinTube\JPT`
- Shell: PowerShell on Windows
- Date: 2026-05-19
- Timezone from environment: Asia/Shanghai
- Network enabled, approval policy `never`
- Current app/workspace is local Codex desktop

## Project Summary

JPT is a Windows desktop AI companion:

- Electron 33 + Vite 5 + React 19 + TypeScript strict
- SDV/Stardew Valley-style transparent desktop pet and dialog UI
- Main process manages transparent always-on-top character window, dialog window, settings window, welcome letter, tray, updates, history, config
- Existing shipping backend on `main`: Claude Code CLI via stream-json NDJSON
- Planned/new backend in worktree: Codex app-server over stdio, default backend, Claude fallback

Important code areas:

- `electron/main.ts`: app startup, windows, agent session/manager, tray, proactive messages
- `electron/ipc.ts`: renderer IPC for dialog, settings, character movement, backend commands
- `electron/agent/claude.ts`: Claude CLI stream-json session
- `src/character/App.tsx`: transparent desktop pet movement, drag, cling, fall, idle/walk rendering
- `src/dialog/App.tsx`: SDV chat UI, streaming tokens, slash commands, tool cards, portrait expression switching
- `src/settings/App.tsx`: settings UI
- `src/shared/config.ts`: persisted settings shape
- `tests/*.test.ts`: pure logic tests

## Main Worktree State

Command snapshot:

```text
worktree C:/Users/LeoinTube/JPT
HEAD 67ce8c80173270ff508a30f60ccb03fc50c6da3c
branch refs/heads/main
```

`main` status at snapshot time:

```text
## main...origin/main [ahead 3]
 M assets/icons/app-icon.ico
 M assets/icons/tray-icon.ico
 M src/welcome/App.tsx
?? assets/icons/icon-src.png
?? assets/sprites/1040g008316sql4463u605npst9cg9600df4hrn8!nd_prv_wgth_webp_3_副本.png
?? assets/sprites/jpt-droping.png
?? assets/sprites/new.png
?? assets/sprites/pixelmotion_clear_1024.png
?? assets/sprites/send.jpg
?? tests/419e9584-8b76-43ac-a820-80cdec645e70.png
?? tests/微信截图_20260515210209.png
```

Do not revert these unless the user explicitly asks. Some are user asset/welcome changes and are unrelated to the Codex backend worktree.

Earlier verification on `main` before these newest icon/welcome edits:

- `npm test`: passed, 9 test files, 56 tests
- `npm run build`: passed

Because `main` became dirty afterward, rerun verification before claiming current `main` is clean.

## Codex Backend Worktree State

Path:

```text
C:\Users\LeoinTube\JPT\.worktrees\codex-backend
```

Branch and HEAD:

```text
branch: codex/codex-backend
HEAD: 642ea3e3a2eb88440600af75fded8af07f3c292f
```

Committed stack on top of `main`:

```text
642ea3e feat(agent): wire Codex backend controls
cfe37d4 feat(agent): manage switchable AI backends
a97cd88 feat(codex): connect to app-server over stdio
6d381f2 feat(codex): add backend lifecycle
926274e feat(codex): map app-server events
bd34344 feat(codex): block whole-file deletion
f1826dd feat(codex): add JSON-RPC stdio peer
8e6605c feat(codex): add minimal app-server protocol types
eab3ebf feat(agent): resolve Codex CLI binary
2875aed refactor(agent): make session interface backend-neutral
3f911dc feat(dialog): parse backend and workdir slash commands
e4a7b69 feat(config): add Codex backend settings
```

Worktree dirty status:

```text
## codex/codex-backend
 M assets/sprites/chatbox.png
 M assets/sprites/droping1.png
 M assets/sprites/droping2.png
 M assets/sprites/jpt-confused.png
 M assets/sprites/jpt-dialog.png
 M assets/sprites/jpt-hanging.png
 M assets/sprites/jpt-happy.png
 M assets/sprites/jpt-sad.png
 M assets/sprites/jpt-stand1.png
 M assets/sprites/jpt-stand2.png
 M assets/sprites/jpt-thinking.png
 M assets/sprites/landing.png
 M assets/sprites/letter.png
 M assets/sprites/send.png
 M assets/sprites/watching.png
 M src/character/App.tsx
?? src/character/scheduler.ts
?? tests/scheduler.test.ts
```

The uncommitted code change introduces `src/character/scheduler.ts`, used by `src/character/App.tsx`, to schedule active animation at about 30fps (`ACTIVE_FRAME_MS = 33`) instead of a perpetual rAF cadence. Stable idle still sleeps until the next idle-to-walk transition.

The uncommitted PNG edits are asset compression/resizing. Current dimensions in the worktree:

```text
chatbox.png        800x84
droping1.png       192x256
droping2.png       192x256
jpt-confused.png   256x256
jpt-dialog.png     1440x492
jpt-hanging.png    192x256
jpt-happy.png      256x256
jpt-sad.png        256x256
jpt-stand1.png     192x256
jpt-stand2.png     192x256
jpt-thinking.png   256x256
landing.png        192x256
letter.png         720x956
send.png           96x96
watching.png       192x256
```

## Worktree Verification Evidence

Commands run in `C:\Users\LeoinTube\JPT\.worktrees\codex-backend`:

- `npm test`: passed, 17 test files, 90 tests
- `npm run build`: passed

Codex local checks:

- `codex --version`: `codex-cli 0.130.0`
- `codex app-server --help`: confirmed `--listen stdio://`
- Generated app-server TS bindings with `codex app-server generate-ts --out <temp>` and confirmed method/notification names exist:
  - `thread/start`
  - `thread/resume`
  - `turn/start`
  - `turn/interrupt`
  - `item/agentMessage/delta`
  - `turn/diff/updated`
  - `fs/remove`
- Direct Node `spawn('codex', ...)` failed with `EPERM` because Windows resolves a shim without extension. Spawning `%APPDATA%\npm\codex.cmd` with `shell: true` and `windowsVerbatimArguments: true` successfully initialized app-server.

## Codex Backend Design Intent

Source docs:

- `docs/superpowers/specs/2026-05-19-codex-backend-design.md`
- `docs/superpowers/plans/2026-05-19-codex-backend.md`

Design goals:

- Default backend becomes `codex`
- `claude` remains a switchable fallback
- Codex uses long-lived `codex app-server --listen stdio://`, not one `codex exec` per message
- User can switch backend via settings and slash commands
- Codex workdir is configurable, defaulting to `%APPDATA%\JPT\codex-workdir`
- Codex runs full agent mode in that directory
- JPT must prevent whole-file and whole-directory deletion
- Dialog remains a natural chat UI, not a terminal
- Idle reclaim after 20 minutes, then resume saved thread or create replacement

## Review Findings From Worktree

Automated tests pass, but the branch should not be treated as fully ready yet. Key risks found:

1. Startup failure can leave the dialog stuck.

   File: `electron/agent/manager.ts`

   `AgentManager.sendAsync()` awaits `backend.start()` without a `try/catch`. If Codex is missing, not logged in, or app-server fails during first message, the error may not be surfaced cleanly through the dialog and the UI can remain in the busy/ready-wrong state.

2. Settings UI workdir changes do not affect the active Codex backend.

   File: `electron/ipc.ts`

   `/workdir ...` uses `agent:set-workdir` and resets state, but `settings:set` with `codexWorkdir` only persists config. It does not create the directory, clear `codexThreadId`, call `session.setCodexWorkdir()`, or reset Codex when Codex is active.

3. Delete protection is incomplete.

   Files: `electron/agent/codex-guard.ts`, `electron/agent/codex-event-mapper.ts`, `electron/agent/codex-app-server.ts`

   `isDeletionCommand()` exists and is tested, but production code does not call it. The mapper only blocks whole-file deletion detected in `turn/diff/updated`. The app-server protocol exposes `fs/remove` and command execution APIs, so the current implementation does not yet fulfill the spec's hard guard for filesystem removal and shell deletion requests.

4. App-server process exit does not fully reset backend running state.

   File: `electron/agent/codex-app-server.ts` and `electron/agent/codex.ts`

   The client clears `proc/peer` on process exit, but `CodexBackend.running` is not informed. A later send can try to use a backend that believes it is still running instead of restarting/resuming cleanly.

5. Slash command UX has a likely ready-state gap.

   File: `src/dialog/App.tsx`

   For `/backend codex` or `/workdir ...`, renderer sets `ready=false` and waits for IPC success. If the backend switch succeeds and `onSessionReady` fires, it recovers. If success returns before a ready event or if code changes later make backend switching lazy, the UI can stay disabled. Keep an eye on this when fixing startup behavior.

## Suggested Next Steps

If the user asks to continue:

1. Work inside `C:\Users\LeoinTube\JPT\.worktrees\codex-backend`, not `main`.
2. Keep uncommitted asset/scheduler changes separate from Codex backend fixes unless the user explicitly wants them bundled.
3. Fix the four primary backend issues:
   - catch startup errors in `AgentManager.sendAsync()` and surface through `onError`
   - handle `codexWorkdir` in `settings:set` the same way as `agent:set-workdir`
   - wire deletion guard into app-server requests/notifications beyond diff-only checks, especially `fs/remove` and shell/command execution requests if the server routes them through this client
   - add process-exit callback or health reset so `CodexBackend` can mark itself stopped and restart on next message
4. Add tests for those regressions.
5. Rerun:
   - `npm test`
   - `npm run build`
6. Optionally perform manual smoke:
   - default backend is Codex
   - send a message and get streaming text
   - `/backend claude` works
   - `/backend codex` works
   - `/workdir C:\path\to\repo` changes workdir
   - deletion request is blocked
   - idle reclaim/restart works

## Important Guardrails

- Do not run destructive git commands.
- Do not revert user changes in `main` or worktree assets unless explicitly asked.
- Use `apply_patch` for manual source edits.
- Before claiming completion, rerun fresh verification.
- When reviewing, lead with findings and file/line references.

## Live Fix Log

### 2026-05-19 TDD RED Tests Added

Added failing tests in the Codex backend worktree for the review findings:

- `tests/agent-manager.test.ts`: startup failure should call `onError` and not call backend `send`.
- `tests/codex-backend.test.ts`: app-server exit should mark Codex backend stopped and allow restart on next send.
- `tests/codex-event-mapper.test.ts`: deletion shell command in `item/started` should be blocked.
- `tests/codex-workdir.test.ts`: workdir changes should normalize path, clear `codexThreadId`, inform Codex backend, and clear only when Codex is active.

Next expected step: run targeted tests and confirm RED failures before editing production code.

### 2026-05-19 Fix 1: AgentManager Startup Errors

Changed `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\manager.ts`.

- `AgentManager.sendAsync()` now wraps lazy backend startup/send in `try/catch`.
- Startup failures now call `onError` instead of becoming an unhandled rejected promise.
- Targeted verification: `npm test -- tests/agent-manager.test.ts` passed, 5 tests.

### 2026-05-19 Fix 2: Codex App-Server Exit State

Changed:

- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex-app-server.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\tests\codex-backend.test.ts`

What changed:

- `CodexAppServerLike` now supports optional `onExit`.
- `CodexAppServerClient` emits `exit` on child `exit` and `error`.
- `CodexBackend` listens for that exit and marks itself not running/busy, so the next send can restart app-server and resume/create a thread.
- Test waits for the async restart path before asserting `turnStart`.

Targeted verification: `npm test -- tests/codex-backend.test.ts` passed, 7 tests.

### 2026-05-19 Fix 3: Deletion Command Guard

Changed:

- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex-event-mapper.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\tests\codex-event-mapper.test.ts`

What changed:

- `mapCodexNotification()` now inspects `item/started` notifications.
- If the item is `commandExecution` and the command matches `rm`, `del`, `erase`, `rmdir`, `rd`, or `Remove-Item`, it surfaces the deletion block message and returns `blocked: true`.
- `CodexBackend` already interrupts blocked results, so this extends the existing interrupt path from whole-file diffs to shell deletion commands.

Targeted verification: `npm test -- tests/codex-event-mapper.test.ts tests/codex-backend.test.ts` passed, 11 tests.

### 2026-05-19 Fix 4: Codex Workdir Settings Apply

Changed:

- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex-workdir.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\ipc.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\tests\codex-workdir.test.ts`

What changed:

- Added `applyCodexWorkdirChange()` helper.
- Workdir changes now normalize/resolve the path, create the directory, persist normalized `codexWorkdir`, clear `codexThreadId`, update the Codex backend workdir, and clear the active Codex thread.
- If Claude is active, Codex workdir is updated without clearing Claude.
- `settings:set` now handles `codexWorkdir` through the same helper used by `/workdir`.

Targeted verification: `npm test -- tests/codex-workdir.test.ts` passed, 2 tests.

### 2026-05-19 TDD RED Tests Added: App-Server Client Request Guard

Added failing tests in `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\tests\codex-guard.test.ts` for:

- blocking `fs/remove` client requests
- blocking `command/exec` client requests whose argv contains deletion commands
- allowing non-destructive app-server client requests

Next expected step: run `npm test -- tests/codex-guard.test.ts`, confirm RED, then wire the guard into app-server requests.

### 2026-05-19 Fix 5: App-Server Client Request Guard

Changed:

- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex-guard.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\electron\agent\codex-app-server.ts`
- `C:\Users\LeoinTube\JPT\.worktrees\codex-backend\tests\codex-guard.test.ts`

What changed:

- Added `blocksClientRequest()`.
- Blocks `fs/remove` requests.
- Blocks `command/exec` requests when the argv contains a deletion command.
- `CodexAppServerClient.request()` now rejects blocked client requests before writing JSON-RPC to app-server.

Targeted verification: `npm test -- tests/codex-guard.test.ts tests/codex-app-server.test.ts` passed, 9 tests.

### 2026-05-19 Full Verification After Fixes

Commands run in `C:\Users\LeoinTube\JPT\.worktrees\codex-backend` after all fixes above:

- `npm test`: passed, 18 test files, 98 tests.
- `npm run build`: passed; TypeScript `tsc --noEmit`, renderer Vite build, and Electron main build completed.

Current worktree still has the pre-existing uncommitted asset compression/scheduler changes plus the new backend fixes. Nothing was committed or staged.

Current `main` still has unrelated dirty files:

- modified icons and welcome letter
- untracked `assets/icons/icon-src.png`
- untracked sprite/test image assets
- this manual context document
