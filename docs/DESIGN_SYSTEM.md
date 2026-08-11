# DESIGN_SYSTEM.md — 设计系统与视觉规范

> 改任何 UI 前必读。本文档给出 token、排版、组件与交互时序，避免新改动破坏现有视觉语言。

## 1. 设计哲学

极简"终端/记事本"美学：
- 等宽字体、大写文字、`[符号]` 括符装饰。
- 纯色背景，无边框卡片，无圆角，无阴影（除非是渐变遮罩）。
- 信息层级靠**灰度**（4 个固定色）而非粗细/字号。
- 交互反馈靠**颜色过渡**（`transition-colors`）与细微位移动画。

**不要引入**：圆角、阴影、彩色、图标库、卡片式布局、图片背景。这些会破坏整体语言。

## 2. 设计 Token（全局仅 4 色）

| Token 语义 | 色值 | 用途 | 出现方式 |
|---|---|---|---|
| 背景 | `#F2F2F2` | 页面背景、渐变遮罩、图标底色 | 全局 + 内联 style 重复书写 |
| 主文字 | `#1A1A1A` | 标题、任务文本、可用按钮 | `text-[#1A1A1A]` |
| 次要文字 | `#8C8C8C` | 占位符、ADD 按钮、加载态、hover 目标 | `text-[#8C8C8C]` |
| 危险色 | `#B3261E` | 删除/清除/确认破坏性操作 | `text-[#B3261E]` |

⚠️ 目前这些值在代码中**硬编码重复**（每处 `text-[#F2F2F2]` 等），未抽入 Tailwind `@theme`。**改动色值必须全局 grep 替换**（`src/` 与 `index.css`、`index.html`、`vite.config.ts` 的 manifest、`generate-icons.py`、`public/favicon.svg` 都有 `#F2F2F2`）。这是已知改进点，但不要在常规任务中顺手做（见 DECISIONS.md）。

## 3. 排版

| 元素 | 字号 | 行高 | 其他 |
|---|---|---|---|
| 页面标题 | 18px | 1.4 | `tracking-[0.08em]`、大写 `uppercase` |
| 任务/按钮/输入 | 16px | 1.6 | 默认 |
| 完成项 | 16px | 1.6 | 颜色降为 `#8C8C8C` |

字体栈（全局唯一，`--font-mono`）：
```
'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace
```
- 英文字形用 IBM Plex Mono（Google Fonts CDN 加载，PWA 有 CacheFirst 缓存）。
- 中文无等宽字形，回退 PingFang/苹方。
- `EditableTitle.tsx` 与 `index.css` 各声明了一份相同栈，改动需同步。

## 4. 布局规范

- **移动端**：满屏。顶部固定标题（safe-area 上缘 + 24px，渐变向下淡出）、底部固定操作栏（safe-area 下缘 + 24px，渐变向上淡出）。
- **桌面端**：内容居中 `max-w-[640px] mx-auto`，任务列表额外 `pl-8`（与标题对齐）。
- **安全区**：所有贴边元素必须用 `env(safe-area-inset-*)`，四个方向。
- **横向分页**：`snap-x snap-mandatory`，每页 `w-full shrink-0 snap-start`。
- `index.html` 有 `viewport-fit=cover`，页面禁止水平滚动溢出。

## 5. 组件规范

### 5.1 Bracket（`[...]` 括符）
- 总宽 `3.5ch`，中间内容区 `1.5ch`，左右 `[` `]`。
- 用于所有行首标记：`[+]` `[o]` `[●]` `[−]` `[↑]` `[↓]` `[✓]` `[!]` `[≡]` `[↩]`。
- **定宽不可随意改**，它是全应用纵向对齐的基准。汉字在 1.5ch 里会溢出（用 `overflow-hidden` 裁切），符号务必选窄字符。

### 5.2 按钮
- 全部去默认样式：`bg-transparent`、`select-none`、`cursor-pointer`。
- 常态 `#1A1A1A`，hover 由 `#8C8C8C` 渐变到 `#1A1A1A`（`transition-colors`）。
- 危险操作 `#B3261E`，且一律两级确认（先显示动作，再变"确认XX"）。

### 5.3 输入框
- `bg-transparent` + 下边框 `border-b border-[#1A1A1A]`，无其他描边。
- placeholder 一律 `#8C8C8C`。
- 所有表单关闭浏览器自动补全/拼写：`autoComplete="off" autoCorrect="off" spellCheck={false}`（新增输入框需保持一致）。

### 5.4 渐变遮罩（本应用的"阴影"）
顶部标题与底部操作栏用线性渐变制造淡出效果，而非 box-shadow：
- 顶部：`linear-gradient(to bottom, #F2F2F2 60%, rgba(242,242,242,0) 100%)`
- 底部：`linear-gradient(to top, ...)` 同构
- 菜单：`linear-gradient(to left, ...)`（向右淡出）
- 拖拽手柄：`linear-gradient(to right, rgba(242,242,242,0) 0%, rgba(242,242,242,.9) 45%, #F2F2F2 75%)`

## 6. 交互时序（改手势必读）

| 手势 | 触发条件 | 实现 |
|---|---|---|
| 文本单击 | — | 进入编辑态 |
| 状态按钮单击 | 300ms 内无第二次点击 | `toggleInProgress` |
| 状态按钮双击 | 300ms 内第二次点击 | `toggleComplete` |
| 长按 | 触屏按住 450ms 不移动（>12px 取消） | 进入 actionMode |
| 拖拽排序 | 仅 actionMode 下拖拽手柄 | dnd-kit TouchSensor delay 150ms / tolerance 12px |
| 拖拽结束后 | 一帧内 | `suppressLayout` 关 layout 动画 |

实现位置：TaskItem.tsx:78-93（双击）、95-110（长按）、App.tsx:65-72（传感器）、110-117（suppressLayout）。

**约束**：
- 双击/长按共用同一按钮区域，`justHandledTouchRef` 抑制长按后残留的 click 事件（300ms 窗口）。
- 长按期间移动 >12px 取消（handleTouchMove）。
- 编辑态/拖拽中禁用长按与切换。
- 拖拽手柄 `touch-action: none`，其余容器 `touch-action: pan-x pan-y`（保证分页可横向滚）。

## 7. 动画规格

| 场景 | 参数 |
|---|---|
| 列表 layout 重排 | `duration 0.3` `ease easeInOut` `transformOrigin top` |
| 进出场 opacity | `0.15s` |
| 菜单/底部栏滑动 | `y ±6/8px`，`0.15s` |
| 完成标记弹入 | scale `0.4→1`，`0.15s` |
| hover 颜色 | `transition-colors duration-200` |

## 8. 移动端 Web 细节（别丢）

- `-webkit-tap-highlight-color: transparent`（禁点击高亮）。
- `overscroll-behavior-y: none`（禁下拉刷新粘连）。
- `font-size: 16px` 于 body（防 iOS 缩放）。
- 图标/标题：manifest `theme_color` 与 `background_color` 均为 `#F2F2F2`，standalone + portrait。
- 菜单 `≡` 的 `Bracket` 宽度与文字基线对齐靠 `items-baseline`。

## 9. 设计参照

- `design/reference.jpg`：原始设计稿（本模型无法读取图片，未来 Agent 若支持图片输入可对照）。
- `index.html`：字体预加载 `preconnect` + `display=swap`。
