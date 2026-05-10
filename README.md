# JPT

> Stardew Valley 风格的 Windows 桌面 AI 伴侣。

## 这是什么

桌面上一个像素小人在 Windows 任务栏上方走来走去，可以拖到右墙挂着、可以被拎起来；点击它弹出星露谷物语风格的对话框，背后是 Claude Code CLI 在跟用户聊学习和写作。

灵感来源：[ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents)（macOS 版）。

## 状态

🚧 v0 开发中 —— 当前阶段是设计稿完成、实施计划待写。

## 文档

- 📐 [设计稿](docs/superpowers/specs/2026-05-10-JPT-design.md) — 完整 spec（架构 / 行为 / 视觉 / AI 集成 / 美术工作流 / 分期路线）

## 技术栈

- Electron + Vite + React + TypeScript
- PixiJS（角色 sprite + 变换动画）
- Claude Code CLI（AI 后端，spawn 子进程 + NDJSON 协议）
- electron-builder（NSIS 安装器）+ electron-updater（自动更新）

## 平台

Windows 10 / 11（v1）；macOS / Linux 留给 v2。

## License

TBD
