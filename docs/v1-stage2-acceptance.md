# v1.0 Stage 2 Acceptance Log

Source spec: docs/superpowers/specs/2026-05-10-JPT-design.md §4 (视觉设计)
Source plan: docs/superpowers/plans/2026-05-14-JPT-v1.md (Stage 2)

## Acceptance criteria — Stage 2 (SDV dialog visuals)

- [ ] Wood frame renders with horizontal wood grain gradient + dark outline + drop shadow
- [ ] Left paper panel beige (#efc88c) with subtle inset highlight
- [ ] Right portrait panel: 80×80 image inset in a wood-bordered frame
- [ ] Blue pin appears in portrait lower-right
- [ ] Nameplate displays "JPT" with rivet dots on each side
- [ ] Zpix font applied throughout (font-family: Zpix in computed style)
- [ ] Markdown rendering: paragraphs, lists, bold/italic, inline + block code all styled
- [ ] Empty state shows faded "说点什么试试…" placeholder
- [ ] Auto-scroll keeps newest token visible
- [ ] All Phase B fixes (busy gating, session-ready, no error duplication) still work

## How to verify

```powershell
cd C:\Users\LeoinTube\JPT
npm run dev
```

Then:
1. Click red sprite — dialog should appear with棕色木框 + 横纹渐变 + 阴影
2. Left panel: 米色羊皮纸；right panel: 80×80 立绘（红色占位）+ 蓝点 + "JPT" 卷轴名牌
3. 字体应该是像素风（Zpix）—— 如果还是系统字体，DevTools (F12) 查 computed font-family
4. 输入 `用 markdown 列三条建议` 回车 —— assistant 回复应该按列表渲染（不是裸文字）
5. 多输入几条让消息列表滚动 —— 应该自动滚到最新一条
6. Esc 关对话框，再点 sprite 重开

如果像素字体没生效（系统字 fallback），最可能是 `assets/fonts/zpix.ttf` 路径在 dev 模式下解析失败 —— 看浏览器控制台 (F12) network 标签找 404。
