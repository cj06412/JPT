# JPT Codex Backend Design

Date: 2026-05-19

## 1. Goal

JPT will support two AI backends:

- `codex` as the default backend.
- `claude` as a retained fallback backend.

The user-facing experience must stay the same as the current Claude-backed JPT:

- The dialog shows natural-language streaming replies.
- The character and dialog UI do not become a terminal.
- Backend switching is available through both settings and slash commands.

Codex must run in full agent mode inside a user-selected working directory, but JPT must prevent deletion of entire files or directories.

## 2. Decisions

### Backend Choice

Default backend is `codex`.

Users can switch between:

- `codex`
- `claude`

Switching is persisted in settings and also available through slash commands.

### Codex Work Directory

Codex works inside a configurable directory:

- Default: `%APPDATA%\JPT\codex-workdir`
- User configurable from settings.
- User configurable by slash command.

Codex gets full agent capability in that directory.

### Permission Model

Codex runs without normal step-by-step confirmation prompts.

JPT provides its own guardrail:

- Whole-file and whole-directory deletion is forbidden.
- Normal file editing is allowed, including deleting lines, functions, or sections inside a file.
- New file creation is allowed.
- File content replacement is allowed.

### Codex Runtime

Codex must behave like the current Claude backend: a continuing conversation, not a one-off command per message.

Use `codex app-server --listen stdio://` as the primary long-lived transport. Local exploration on Codex CLI `0.130.0` showed the app-server protocol exposes thread and turn APIs such as:

- `ThreadStartParams`
- `ThreadResumeParams`
- `TurnStartParams`
- `AgentMessageDeltaNotification`
- `TurnCompletedNotification`
- `TurnDiffUpdatedNotification`
- filesystem operations including `FsRemoveParams`

`codex exec --json` is reserved as a possible diagnostic or emergency fallback, not the primary design.

## 3. Architecture

```text
dialog/settings renderer
  -> window.jpt IPC
  -> electron/ipc.ts
  -> AgentManager
       -> ClaudeBackend
       -> CodexBackend
            -> CodexAppServerClient
            -> CodexThreadStore
            -> CodexGuard
            -> CodexEventMapper
```

### AgentManager

`AgentManager` owns the active backend and exposes the same shape that `ipc.ts` currently expects from `ClaudeSession`.

Responsibilities:

- Read selected backend from config.
- Lazily start the active backend.
- Ensure only one backend process is active at a time.
- Switch backend when settings or slash commands request it.
- Forward callbacks from the active backend to existing dialog IPC events.
- Reset the active backend for `/clear`.

### Backend Interface

The current `AgentSession` interface should evolve into a backend-neutral contract.

```ts
export type AgentBackendId = 'codex' | 'claude'

export interface AgentBackend {
  id: AgentBackendId
  isRunning(): boolean
  isBusy(): boolean
  history(): AgentMessage[]
  start(): Promise<void>
  send(message: string): void
  clear(): Promise<void>
  terminate(): void
  setCallbacks(cb: Partial<AgentSessionCallbacks>): void
}
```

`ClaudeSession` can be adapted with minimal behavior changes. `CodexBackend` implements the same callbacks by mapping app-server protocol notifications.

## 4. Codex Backend Lifecycle

### Lazy Start

JPT does not start Codex at app launch.

Codex starts when:

- The selected backend is `codex`, and
- The user sends the first message, or a command requires Codex state.

### Single Active Backend

Only one backend process should run at a time:

- Selecting Codex terminates Claude if Claude is running.
- Selecting Claude terminates Codex if Codex is running.

### Idle Reclaim

Codex app-server is stopped after 20 minutes of inactivity.

On idle stop, JPT saves:

- backend id
- Codex work directory
- current Codex thread id, if available
- last-used timestamp

### Resume

When the user returns after idle reclaim:

1. Start `codex app-server --listen stdio://`.
2. Try to resume the saved thread id.
3. If resume succeeds, continue the original Codex thread.
4. If resume fails, create a new Codex thread and inject recent JPT conversation history as context.

The dialog history visible to the user is owned by JPT and remains visible regardless of whether Codex app-server was reclaimed.

### Clear

`/clear` clears the current conversation context.

For Codex:

- End or abandon the current thread.
- Create a fresh thread in the same work directory.
- Clear JPT-side in-memory backend history for this conversation.

For Claude:

- Preserve current behavior: terminate and restart the Claude session.

## 5. Codex App-Server Client

`CodexAppServerClient` manages the stdio JSON-RPC connection.

Responsibilities:

- Resolve the `codex` executable on Windows.
- Spawn `codex app-server --listen stdio://`.
- Send JSON-RPC requests.
- Receive JSON-RPC responses and notifications.
- Correlate request ids.
- Surface protocol errors.
- Terminate the child process cleanly.

Windows path resolution should probe:

- `%APPDATA%\npm\codex.cmd`
- `%APPDATA%\npm\codex`
- `%LOCALAPPDATA%\Microsoft\WindowsApps` / packaged Codex app locations when discoverable through `PATH`
- Any `codex.exe`, `codex.cmd`, or `codex` found in `PATH`

Batch files require the same Windows handling already used for Claude: `shell: true` when launching `.cmd` or `.bat`.

## 6. Codex Thread Configuration

When creating or resuming a Codex thread, JPT passes:

- `cwd`: configured Codex work directory.
- `approvalPolicy`: `never`.
- `sandbox`: `danger-full-access` for full agent behavior in the selected work directory.
- `developerInstructions`: JPT persona plus deletion guard instructions.

The deletion guard instructions must say:

```text
You may edit files, but you must not delete entire files or directories.
Do not run deletion commands such as rm, del, erase, rmdir, rd, or Remove-Item.
If a task appears to require deleting a file, explain the reason to the user instead of performing the deletion.
```

The prompt is not the only protection; hard guards are required.

## 7. Delete Guard

`CodexGuard` prevents whole-file and whole-directory deletion.

Allowed:

- Editing file contents.
- Removing lines or functions inside a file.
- Replacing a file's contents.
- Creating files.

Forbidden:

- Removing a file.
- Removing a directory.
- Running shell commands whose primary effect is deletion.
- Applying a diff that deletes a whole file.

### Filesystem API Guard

If app-server requests `fs/remove`, JPT rejects the request.

The user-facing message should be natural and short:

```text
这个操作会删除整个文件，我先停住了。
```

### Shell Command Guard

Before approving or executing shell-related requests, inspect the command.

Block commands that match deletion intent, including:

- `rm`
- `del`
- `erase`
- `rmdir`
- `rd`
- `Remove-Item`
- PowerShell aliases that map to remove operations when they can be identified.

The first implementation may use conservative token-based matching. It should prefer false positives over allowing deletion.

### Diff Guard

Inspect `TurnDiffUpdatedNotification.diff`.

Block and interrupt the turn when the diff shows a whole-file deletion, including patterns such as:

- `deleted file mode`
- `+++ /dev/null`
- a complete file removal in a unified diff

Line-level deletions inside a file are allowed.

### Interrupt Behavior

When a forbidden deletion is detected:

1. Interrupt the active Codex turn.
2. Surface a short message in the dialog.
3. Preserve the backend and thread if possible.
4. Do not hide the fact that the operation was blocked.

## 8. Event Mapping

JPT keeps the current dialog IPC surface.

Codex notifications map to existing callbacks:

```text
AgentMessageDeltaNotification -> onText(delta)
TurnCompletedNotification     -> onTurnComplete()
ErrorNotification             -> onError(message)
TurnDiffUpdatedNotification   -> CodexGuard check only; do not render by default
Plan/tool/command notifications -> history/internal logs only in v1
```

The dialog remains a chat UI. It does not show command logs or raw JSON-RPC events by default.

## 9. Settings

Extend `ConfigSnapshot`:

```ts
export type AgentBackendId = 'codex' | 'claude'

export interface ConfigSnapshot {
  agentBackend: AgentBackendId
  codexWorkdir: string
  codexIdleTimeoutMs: number
  codexNoDeleteFiles: true
  codexThreadId?: string
}
```

Defaults:

```ts
agentBackend: 'codex'
codexWorkdir: '<userData>/codex-workdir'
codexIdleTimeoutMs: 20 * 60_000
codexNoDeleteFiles: true
```

Settings UI adds:

- AI backend select: Codex / Claude.
- Codex work directory input.
- Folder picker button if practical in this stage.
- Read-only note that deleting whole files is blocked.
- Read-only note that Codex is reclaimed after 20 minutes idle.

## 10. Slash Commands

Extend slash command parser:

```text
/backend
/backend codex
/backend claude
/workdir
/workdir C:\path\to\project
```

Behavior:

- `/backend` shows the current backend.
- `/backend codex` persists Codex as backend and switches immediately.
- `/backend claude` persists Claude as backend and switches immediately.
- `/workdir` shows current Codex work directory.
- `/workdir <path>` validates and persists Codex work directory, then resets Codex thread.

Existing commands remain:

- `/clear`
- `/copy`
- `/help`

`/help` must include the new backend and workdir commands.

## 11. History

JPT already writes daily JSONL history. That remains the user-visible history source.

Codex thread persistence is separate:

- The Codex thread id is saved only to resume backend context.
- If resume fails, JPT history is used to seed a new thread with recent context.

The fallback seed should include a bounded number of recent messages to avoid runaway prompt size.

## 12. Error Handling

### Codex Not Found

If `codex` cannot be found:

- Show a friendly error in the dialog.
- Keep settings intact.
- Allow switching to Claude.

### Codex Not Logged In

If app-server reports auth/login failure:

- Show a friendly error.
- Mention that Codex must be logged in on this machine.
- Do not try to launch an interactive login inside JPT in the first implementation.

### App-Server Protocol Failure

If app-server exits or JSON-RPC fails:

- Mark backend not ready.
- Surface the error.
- Allow the next user message to attempt restart.

### Resume Failure

If thread resume fails:

- Create a new thread.
- Inject recent JPT history as context.
- Continue without requiring user action.

## 13. Tests

Add unit tests for pure logic:

- Config defaults: backend defaults to Codex.
- Config updates preserve existing fields.
- Slash parser handles `/backend` and `/workdir`.
- Delete guard blocks whole-file diff deletion.
- Delete guard allows line-level deletion in a diff.
- Delete guard blocks common deletion commands.
- Delete guard allows non-delete commands.
- Codex event mapper converts text delta and turn completion to callbacks.
- AgentManager switches backend and terminates the old backend using fakes.

Integration and manual checks:

- `npm test`
- `npm run build`
- Launch app in dev mode.
- Verify default backend is Codex.
- Send a message and receive streaming text.
- Switch to Claude and send a message.
- Switch back to Codex and send a message.
- Set Codex workdir and confirm Codex uses it.
- Try a deletion request and confirm it is blocked.
- Leave Codex idle past timeout and confirm it restarts/resumes on next message.

## 14. Acceptance Criteria

- JPT defaults to Codex backend.
- Claude remains available and functional.
- Settings can persistently switch backends.
- Slash commands can switch backends.
- Codex runs in a configurable work directory.
- Codex uses a continuing thread via app-server, not one `exec` process per message.
- Codex app-server is lazily started.
- Only one backend process is active at a time.
- Codex app-server is reclaimed after 20 minutes idle.
- After idle reclaim, JPT resumes the saved Codex thread or starts a replacement thread seeded with recent JPT history.
- JPT dialog remains a natural streaming chat UI.
- Whole-file and whole-directory deletion attempts are blocked.
- Normal file edits are allowed.
- `npm test` passes.
- `npm run build` passes.

## 15. Non-Goals

- Exposing raw Codex JSON-RPC events in the dialog.
- Showing terminal logs in the SDV dialog by default.
- Implementing a full Codex desktop client inside JPT.
- Supporting multiple simultaneous Codex work directories.
- Supporting multiple concurrent agent backends.
- Allowing users to disable whole-file deletion protection.
- Launching interactive Codex login flows from JPT.
