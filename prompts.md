# JPT 美术资源生产手册 — GPT Image 提示词

> 配套 spec：`docs/superpowers/specs/2026-05-10-JPT-design.md` §7（美术资源生产）。
> 这份是 §7.2 提到的「完整版本写在独立文件」。
> 目标：用开发者自拍 → GPT Image (gpt-image-2) image-to-image → Aseprite 后处理，
> 产出 JPT 的行走 sprite + 立绘，风格严格对齐《星露谷物语》(Stardew Valley, SDV)。

---

## 0. 一句话总览

你要产两份图，都放进 `assets/sprites/`：

| 文件 | 最终像素 | 代码渲染 | 备注 |
|---|---|---|---|
| `jpt-walk.png` | **24×32** | 4× → 96×128（`image-rendering: pixelated`） | v1 一张静态正面站姿 |
| `jpt-portrait.png` | **64×64** | 4× → 256×256（对话框右侧立绘框 80×80 内 padding 4） | v1 一张默认表情 |

外加两个图标（可从立绘裁/缩，不必重画）：

| 文件 | 用途 | 规格 |
|---|---|---|
| `assets/icons/app-icon.ico` | 安装器 / 桌面快捷方式 / 任务栏 | 多分辨率 .ico：16/32/48/64/128/256 |
| `assets/icons/tray-icon.ico` | 系统托盘 | 多分辨率 .ico：16/32/48 |

**关键认知**：GPT Image **不能**直接吐 24×32 / 64×64 的真像素图（太小，i2i 会糊）。
正确做法是让它生成**高分辨率的「像素画风格」图**（1024×1024 左右，块状大像素、有限配色、硬边缘），
然后在 **Aseprite 里降采样 + 索引量化**到目标尺寸。GPT Image 负责「长得像 + SDV 味」，
Aseprite 负责「变成真像素 + 配色收敛 + 抠透明」。

---

## 1. 准备自拍（开发者本人，5 分钟）

拍 3 张，光线均匀、背景简单（白墙最好）：

1. **正脸特写**：头肩，正对镜头或微侧 15°，表情自然微笑 — 决定立绘像不像，最重要
2. **半身**：到腰，正面站姿，能看清常穿的衣服颜色
3. **全身**：站直正面，能看到整体身形 + 鞋子 — 喂行走 sprite 用

命名 `selfie-face.jpg` / `selfie-half.jpg` / `selfie-full.jpg`，放任意临时目录（**不要进 git 仓库**，
`.gitignore` 已排除 `assets/sprites/_drafts/`，你可以丢这里）。

---

## 2. 第一步：立绘 portrait（先做，脸是成败关键）

立绘决定「这个小人是不是你」。脸不像，后面 sprite 再好也白搭。所以**先把立绘磨满意再动 sprite**。

### 2.1 主提示词（喂 `selfie-face.jpg`，image-to-image）

```
Stardew Valley NPC portrait of the exact person in the reference photo.
Pixel art style, chunky hand-drawn pixels, NO anti-aliasing, hard pixel edges.
Head and shoulders composition, facing slightly to the right (~15 degrees),
neutral warm expression, eyes looking at the viewer.
Render LARGE (1024x1024) but make every "pixel" a clearly visible chunky block —
it must read as ~64x64 pixel art scaled up, like a Pelican Town villager portrait.
Limited warm-earth palette, about 40-48 colors total.
Solid flat pale-blue background, hex #c8d8e8, absolutely no gradient or texture.
Match EXACTLY: hairstyle, hair color, glasses (if any), face shape, skin tone,
facial hair (if any). Casual hoodie or T-shirt in dark navy or muted maroon.
Flat cel-shaded color blocks like Stardew Valley character art. No photorealism,
no smooth shading, no blur, no watermark, no signature, no text.
```

### 2.2 出 4 张，挑最像的一张

GPT Image 一次给多张就多挑，不够就重跑。**只看脸像不像 + SDV 味够不够**，背景/尺寸后面修。
脸不像时按 2.3 调，**别在不像的图上继续往下走**。

### 2.3 常见翻车 → 救法（在提示词后面追加一句）

| 症状 | 追加这句 |
|---|---|
| 太写实 / 像照片磨皮 | `Make it MORE pixelated and flat — fewer colors, bigger pixel blocks, zero gradient.` |
| 脸不像本人 | `The face must match the reference photo's bone structure and features precisely; keep the same eyes, nose, and jawline.` |
| 戴了原图没有的帽子/眼镜 | `Do NOT add any hat / glasses / accessories that are not in the reference photo.` |
| 背景有渐变/纹理 | `Background must be a single flat solid color #c8d8e8 — one uniform fill, no shading.` |
| 出现文字/水印/签名 | `Absolutely no text, letters, numbers, watermark, or signature anywhere in the image.` |
| 配色太冷/太杂 | `Use a warm earthy Stardew Valley palette: amber, soft brown, muted maroon, navy. Max ~48 colors.` |

调色板参考贴给模型也行：<https://lospec.com/palette-list/stardew-valley>（约 48 色）。

### 2.4 满意了 → 存原图

挑中那张存为 `portrait-raw.png`（1024×1024 左右，先别管尺寸）。进第 4 节 Aseprite。

---

## 3. 第二步：行走 sprite（立绘满意后再做，必须同款人）

立绘定稿后，把 **`portrait-raw.png` + `selfie-full.jpg` 两张一起喂**给下面提示词，
强制 sprite 和立绘是同一个人、同一套配色。

### 3.1 主提示词（image-to-image，参考图 = 立绘定稿 + 全身自拍）

```
Stardew Valley full-body walking sprite of the SAME character as the attached
portrait (same face, same hair, same outfit, same palette). Use the full-body
reference photo for body proportions and clothing.
Pixel art style, chunky hand-drawn pixels, NO anti-aliasing, hard 1px black outline.
Front-facing, full body head-to-shoes, neutral standing idle pose, arms relaxed
at sides, feet together.
Render LARGE (1024x1024) but it must read as a tiny ~24x32 pixel sprite scaled up:
huge visible pixel blocks, extremely limited palette (4 colors max for skin,
3-4 for hair, 4-6 for clothes), flat fills like a Stardew Valley villager
overworld sprite.
Fully TRANSPARENT background (alpha), no shadow, no ground, no scenery.
Character centered with a little margin. No photorealism, no gradient, no blur,
no watermark, no text. Same warm-earth palette as the portrait.
```

### 3.2 出 4 张，挑「身形 + 配色和立绘一致」的一张

重点看：和立绘是不是一眼同一个人、衣服颜色一致、是不是干净透明背景、像素够不够块。
不行就按 2.3 同款救法追加（把 "portrait" 换成 "sprite" 语境）。

额外 sprite 专属翻车：

| 症状 | 追加这句 |
|---|---|
| 背景不透明 / 有地面阴影 | `Background must be 100% transparent alpha. No drop shadow, no floor, no platform.` |
| 不是正面 / 是侧身走路姿 | `Strictly front-facing, standing still, symmetrical idle pose. Not a walk cycle, not a side view.` |
| 太高细 / 比例不像真人 | `Match the body proportions in the full-body reference photo (height, build).` |
| 和立绘配色对不上 | `Use the EXACT same colors as the attached portrait — same skin, hair, and clothing hex values.` |

### 3.3 满意了 → 存原图

存为 `walk-raw.png`。进第 4 节。

---

## 4. 第三步：Aseprite 后处理（把 raw 大图变成真像素小图）

GPT Image 给的是「像素风格的大图」，不是真像素。Aseprite 负责收尾。
没装 Aseprite 的话：Steam ¥50 / 官网编译免费 / 或用 Photopea + ImageMagick 替代（思路一样）。

### 4.1 立绘 `portrait-raw.png` → `assets/sprites/jpt-portrait.png`

1. Aseprite 打开 `portrait-raw.png`
2. `Sprite → Sprite Size` → 设 **64 × 64**，Interpolation 选 **Nearest-neighbor**（不要 bilinear，会糊）
3. 肉眼检查脸还认得出 — 认不出说明原图细节太多，回第 2 节用「更块状」的提示词重出
4. `Sprite → Color Mode → Indexed`，调色板上限设 **≤ 60**（`Palette` 面板 → 右键 → `Reduce Palette`）
5. 如果对话框里要透明立绘：用魔棒选 `#c8d8e8` 纯蓝背景 → `Delete` → 背景变透明
   （v1 立绘是放在木框米色背景上的，留浅蓝纯色背景也行，看 `PortraitPanel.tsx` 实际效果选；
   保险起见做成透明，框的米色会透出来更自然）
6. `File → Export → Export As` → `assets/sprites/jpt-portrait.png`，PNG，64×64，保留 alpha

### 4.2 行走 sprite `walk-raw.png` → `assets/sprites/jpt-walk.png`

1. Aseprite 打开 `walk-raw.png`
2. 先抠透明：魔棒/选区把背景删干净（边缘有半透明杂边的话，`Edit → Replace Color` 把杂边并掉）
3. `Sprite → Sprite Size` → **24 × 32**，Nearest-neighbor
4. 人物要在 24×32 画布内**居中、贴底**（脚接近底边，头顶留 1-2px）— 否则走起来像浮空
5. `Color Mode → Indexed`，配色收到和立绘**同一套调色板**（可以 `Palette → Load` 把立绘的 palette 存出来再 load 进来，强制一致）
6. 1px 黑描边检查：SDV sprite 都有外描边，没有就 `Edit → Outline`（1px、黑、外侧）
7. `Export As` → `assets/sprites/jpt-walk.png`，PNG，24×32，保留 alpha

### 4.3 图标 `.ico`（从立绘派生，不重画）

1. 用 `jpt-portrait.png`（或它的一个干净裁剪）
2. 在 Aseprite/Photopea 导出多个尺寸 PNG：256/128/64/48/32/16
3. 合成 .ico：在线工具 <https://icoconvert.com> 或 ImageMagick：
   ```
   magick portrait-256.png portrait-128.png portrait-64.png portrait-48.png portrait-32.png portrait-16.png assets/icons/app-icon.ico
   magick portrait-48.png portrait-32.png portrait-16.png assets/icons/tray-icon.ico
   ```
4. 覆盖掉 `scripts/gen-placeholder-art.ps1` 生成的红色占位 .ico

---

## 5. 验收 checklist（spec §7.4，照抄过来勾）

替换占位前逐条过：

- [ ] 立绘背景：透明 或 浅蓝纯色 `#c8d8e8`（按对话框实际观感选，二选一即可）
- [ ] 立绘是真 64×64 实际像素（Aseprite 标题栏显示 64x64，不是放大模糊的大图）
- [ ] sprite 是真 24×32 实际像素
- [ ] sprite 透明背景 alpha 干净（无半透明杂边、无白边）
- [ ] sprite + 立绘**配色一致**（同一套 indexed palette）
- [ ] 像素边缘无反锯齿（放大看是硬方块，不是渐变糊边）
- [ ] 总色数 ≤ 60（Aseprite `Sprite → Color Mode → Indexed`，看 palette 格子数）
- [ ] 没有水印 / 签名 / 文字 / 噪点
- [ ] 脸一眼能认出是开发者本人（最主观也最重要）
- [ ] sprite 在 24×32 画布内居中贴底（不悬空）

全勾 → 覆盖 `assets/sprites/jpt-walk.png` / `jpt-portrait.png` / `assets/icons/*.ico` →
`npm run build:installer` 重新打包 → 在干净机器 smoke test。

---

## 6. Plan B（GPT Image 怎么调都不像本人时，spec §7.3）

按优先级，别死磕 GPT Image：

1. **闲鱼 / 小红书 / Fiverr 找像素画 commission** — ¥200–500，约 1 周。把 3 张自拍 + 这份手册的
   规格表（24×32 / 64×64 / ≤60 色 / 透明 / SDV 风）+ 一张 SDV 立绘截图当参考一起发给画师。最稳。
2. **像素专用 AI**：[Retro Diffusion](https://www.retrodiffusion.ai/) 或 [Pixela](https://pixelaai.com/) —
   它们专做像素，比通用 GPT Image 更容易出干净像素，i2i 喂自拍同理。
3. **[LPC 角色生成器](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)** —
   拼一个发型/肤色/衣服接近的通用像素人，再用 PS/Aseprite 改脸细节。最不像本人但保底能用。

---

## 7. 给 implementer / 接手者的提示

- 这份是**手工美术流程**，没有代码改动。产物就是覆盖 4 个文件。
- 代码侧已经准备好接真图：`src/character/App.tsx` 用 `<img src=jpt-walk.png image-rendering:pixelated>`，
  `src/dialog/PortraitPanel.tsx` 用 `jpt-portrait.png`。换文件即生效，无需改代码。
- 占位生成脚本 `scripts/gen-placeholder-art.ps1` 保留 —— 万一想回退到红块测试还能用。
- v1.5 才做的：4 帧走路 sprite sheet（替换单张 walk）、4 张表情立绘（默认/微笑/思考/困惑）。
  那时这份手册的提示词复用，只是 sprite 改成「4-frame walk cycle horizontal strip」、
  立绘改成「same character, smiling / thinking / confused expression」。
