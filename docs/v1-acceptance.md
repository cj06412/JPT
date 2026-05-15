# v1.0 Acceptance Log

Source spec: docs/superpowers/specs/2026-05-10-JPT-design.md §10 (v1.0 — 礼物可送)
Source plan: docs/superpowers/plans/2026-05-14-JPT-v1.md
Stage logs:
  - docs/v1-stage1-acceptance.md (Stage 1 — behaviors + sprite + click-through)
  - docs/v1-stage2-acceptance.md (Stage 2 — SDV dialog visuals)

## Acceptance criteria

- [x] All 37 unit tests pass (`npm test`) — verified at T21
- [x] Stage 1 GUI behaviors verified — walk / drag / cling / fall / squash all
      work after the post-v1 GUI bug-fight (commits 570ab0e..aea5bc5)
- [x] Stage 2 dialog visuals verified — SDV frame + paper + portrait + Zpix +
      streaming markdown render correctly
- [x] Dialog ↔ claude streaming works end-to-end with persona isolation
- [x] Character freezes while dialog open, resumes on close (aea5bc5)
- [ ] Settings window opens, saves, persists across restart — user confirmed OK
- [ ] History JSONL files appear in %APPDATA%\jpt\history\YYYY-MM-DD.jsonl
- [ ] Tray icon visible; menu (talk / settings / updates / quit) functional
- [x] `npm run build:installer` produces release/JPT-Setup-1.0.0.exe — verified
      2026-05-15, 81 MB, with latest.yml + .blockmap
- [ ] Installer runs and installs to chosen path (USER must test the .exe)
- [ ] Installed app launches and runs end-to-end identically to dev mode
- [ ] Memory < 200 MB resident (Task Manager check)
- [x] Installer size < 120 MB — 81 MB ✓

## electron-builder cache workaround (Windows, no admin / no Developer Mode)

On a Windows machine without admin rights or Developer Mode, the first
`npm run build:installer` fails twice on electron-builder's
download-then-rename pattern:

1. **winCodeSign** — 7-Zip can't create the darwin .dylib symlinks
   (`Cannot create symbolic link : 客户端没有所需的特权`). macOS-only;
   irrelevant to a Windows NSIS build.
2. **nsis / nsis-resources** — `rename ... : The system cannot move the
   file to a different disk drive` then `ENOENT elevate.exe`, and later
   `Plugin not found, cannot call UAC::_`.

Fix (one-time; the cache persists afterward): manually populate
`%LOCALAPPDATA%\electron-builder\Cache\` —

```
# winCodeSign — extract excluding the 2 macOS symlinks
7za x winCodeSign-2.6.0.7z -o<cache>\winCodeSign\winCodeSign-2.6.0 \
    -xr!libcrypto.dylib -xr!libssl.dylib
# nsis-3.0.4.1 — extract, then move all contents into a nsis-3.0.4.1\ subdir
# nsis-resources-3.4.1 — extract into nsis-resources-3.4.1\
```

Archives: github.com/electron-userland/electron-builder-binaries/releases.
Once these three cache dirs exist, the build completes cleanly. Enabling
Windows Developer Mode would also fix #1 without the manual step.

## Gift-ship checklist (do these BEFORE handing the .exe to 小屿)

- [ ] Replace assets/sprites/jpt-walk.png with real GPT-Image-generated sprite (spec §7)
- [ ] Replace assets/sprites/jpt-portrait.png with real portrait
- [ ] Replace assets/icons/{app,tray}-icon.ico with real icons
- [ ] Edit src/welcome/App.tsx PLACEHOLDER_LETTER with real letter content
- [ ] Settings window persona editor or %APPDATA%\jpt\workdir\CLAUDE.md: write the real persona doc
- [ ] Smoke test the final .exe on a clean Windows machine (or VM) before gifting

## Known v1.5 follow-ups (from plan self-review)

1. tool_use events not rendered as SDV scroll cards in dialog (claude.ts handleEvent ignores them)
2. Character doesn't freeze when dialog is open
3. Click-outside-dialog doesn't close it (only Esc does)
4. Idle breathing / walk wobble (placeholder is static single image)
5. Cling/held sway/jitter (placeholder is static)
6. Taskbar autohide detection
7. Multi-screen active-screen detection
8. soundsEnabled toggle in settings has no real audio yet
9. Persona editor in settings UI writes to electron-store but does NOT re-write workdir/CLAUDE.md — needs an IPC handler change in v1.5

## v1.0 commit summary

21 tasks complete across 5 stages. Each stage's last commit:
- Stage 1: ea80c35 (T5 sprite + behaviors), 5194b6d (T6 acceptance)
- Stage 2: ec602f4 (T11 dialog composition), 14626e3 (T12 acceptance)
- Stage 3: 1d94b0e (T16 settings window)
- Stage 4: d6b889a (T18 welcome letter)
- Stage 5: 5f497b5 (T20 updater wire-up)
