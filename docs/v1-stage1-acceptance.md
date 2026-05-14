# v1.0 Stage 1 Acceptance Log

Source spec: docs/superpowers/specs/2026-05-10-JPT-design.md §3 (行为模型)
Source plan: docs/superpowers/plans/2026-05-14-JPT-v1.md (Stage 1)

## Acceptance criteria — Stage 1 (behaviors + sprite + click-through)

- [ ] Sprite PNG loads and renders at 96×128 with pixelated scaling
- [ ] Idle / walk states behave as in v0
- [ ] Mousedown + move > 5px enters held
- [ ] Held position follows cursor
- [ ] Release within 30px of right wall snaps to cling (rotated 90°)
- [ ] Release elsewhere triggers fall (parabola)
- [ ] Fall lands on floor and squashes (scale 1.4×0.6) then snaps back
- [ ] Tap on cling returns character to idle on floor
- [ ] Mouse over transparent sprite area passes click to whatever is under (verify in v1.1+ with actual non-red art; placeholder is solid red so untestable until real sprite arrives)
- [ ] Click on solid area still toggles dialog
- [ ] dev mode boots cleanly with no fatal errors in `npm run dev` log

## How to verify

```powershell
cd C:\Users\LeoinTube\JPT
npm run dev
```

Then physically:
1. Wait for the 96×128 red placeholder sprite to appear at the bottom of the primary display (above taskbar)
2. Watch it walk — same speed as v0 (~50 px/s)
3. Click and hold the left mouse button on the sprite, drag > 5px — sprite should follow the cursor
4. While still dragging, move sprite NEAR right edge of screen, then release — sprite should snap to right wall and rotate 90° (cling)
5. Click the clinging sprite — should drop back to floor (tap-cling exit)
6. Drag sprite to middle of screen, release — should fall in a parabola and land on the floor with a brief squash animation
7. Click sprite (no drag) — dialog should open
8. Close dialog (Esc), click sprite again — dialog opens
9. Quit with Ctrl+C in terminal

If anything in steps 1–9 doesn't behave as described, that's a Stage 1 regression — capture the exact failure and we debug before moving to Stage 2.
