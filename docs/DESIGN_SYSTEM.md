# DESIGN_SYSTEM.md — 设计系统与视觉规范

> 改任何 UI 前必读。本文档给出 token、排版、组件与交互时序，避免新改动破坏现有视觉语言。

## 1. 设计哲学

极简"终端/记事本"美学：
- 等宽字体、大写文字、`[符号]` 括符装饰。
- 纯色背景，无边框卡片，无圆角，无阴影（除非是渐变遮罩）。
- 信息层级靠**灰度**（4 个固定色）而非粗细/字号。
- 交互反馈靠**颜色过渡**（`transition-colors`）与细微位移动画。

**不要引入**：圆角、阴影、彩色、图标库、卡片式布局、图片背景。这些会破坏整体语言。

## 2. 设计 Token（全局 4 色，v0.8.0 起抽入 @theme）

| Token | 亮色值 | 暗色值 | 用途 | 出现方式 |
|---|---|---|---|---|
| `--color-bg` | `#EFEFEF` | `#1A1A1A` | 页面背景、渐变遮罩、图标底色 | `bg-bg` / `text-bg` / `var(--color-bg)` |
| `--color-ink` | `#1A1A1A` | `#EFEFEF` | 主文字、可用按钮 | `text-ink` / `border-ink` |
| `--color-mute` | `#8C8C8C` | `#9C9C9C` | 占位符、ADD 按钮、加载态、hover 目标 | `text-mute` |
| `--color-danger` | `#B3261E` | `#E05B50` | 删除/清除/确认破坏性操作 | `text-danger` / `bg-danger` |

- **定义**：`index.css` 的 `@theme`（亮色默认）+ `html[data-theme='dark']` 覆盖同名变量；Tailwind 工具类（`text-ink` 等）基于 `var()` 自动跟随主题。
- **渐变遮罩**：`linear-gradient(to ..., var(--color-bg) 60%, transparent 100%)`；拖拽手柄用 `color-mix(in srgb, var(--color-bg) 90%, transparent)`。
- **切换**：菜单「◐ 暗色模式/亮色模式」；持久化 `localStorage['roster-theme']`，未设置时跟随系统 `prefers-color-scheme`；`main.tsx` 渲染前设置 `data-theme` 防闪烁。
- ⚠️ 色值已 token 化（原"硬编码重复"警告解除，见 DECISIONS.md D13）。静态外壳（PWA manifest theme_color/background_color、favicon、图标 PNG）不随主题，保持亮色值。

## 3. 排版

| 元素 | 字号 | 行高 | 其他 |
|---|---|---|---|
| 页面标题 | 18px | 1.4 | `tracking-[0.08em]`、大写 `uppercase` |
| 任务/按钮/输入 | 16px | 1.6 | 默认 |
| 完成项 | 16px | 1.6 | 文本与左侧状态按钮颜色均降为 `#8C8C8C` |

字体栈（全局唯一，`--font-mono`）：
```
'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace
```
- 英文字形用 IBM Plex Mono（**自托管** `public/fonts/ibm-plex-mono-{400,500}.woff2`，latin 子集，随 PWA 预缓存；换字体直接替换 woff2 文件）。
- 中文无等宽字形，回退 PingFang/苹方。
- `EditableTitle.tsx` 与 `index.css` 各声明了一份相同栈，改动需同步。

## 4. 布局规范

- **移动端**：满屏。顶部固定标题（safe-area 上缘 + 24px，渐变向下淡出）、底部固定操作栏（safe-area 下缘 + 24px，渐变向上淡出）。
- **桌面端（≥768px）**：滚动容器左右各 32px 留白（`md:px-8`），每个列表为定宽 `400px` 内容 + 左右 16px 内边距的**自包含列面板**（`ListPanel`）——列头（可编辑标题 + ≡ 列菜单）、任务区（内部滚动）、列底（ADD / actionMode 操作）。列间以 **24px 间距 + 1px 细竖线**（`#1A1A1A` 15% 透明度，终端分屏风格）分割：**所有列 `border-l`**（列间单线 + 首列左边界线），**末列额外 `border-r`**（右边界线）；列步进 425px（含间距/线）。**列总宽 < 视口时整组居中**（`w-fit min-w-full md:min-w-0 mx-auto`，桌面取内容宽 + auto margin），**≥ 视口可横向滚动时左对齐**（fit-content 钳制到容器宽、margin 归零）；展示不下的用键盘 `←`/`→` 按屏翻页；单列表/空列表仍禁横向滚动。全局浮层（顶部标题/底部 ADD）在桌面隐藏。不引入卡片/阴影/圆角。
- **安全区**：所有贴边元素必须用 `env(safe-area-inset-*)`，四个方向。
- **横向分页**：`snap-x snap-mandatory`，每列 `w-full md:w-[400px] shrink-0 snap-start`；**仅 >1 个列表时可横向滑动**（线性，首尾不可回绕），单列表/空列表禁用横向滑动（`overflow-x-hidden` + `touch-action: pan-y`）。
- `index.html` 有 `viewport-fit=cover`，页面禁止水平滚动溢出。

## 5. 组件规范

### 5.1 Bracket（`[...]` 括符）
- 总宽 `3.5ch`，中间内容区 `1.5ch`，左右 `[` `]`。
- 用于所有行首标记：`[+]` `[o]` `[●]` `[−]` `[∅]` `[↑]` `[↓]` `[✓]` `[!]` `[≡]` `[↩]`（`∅`=删除列表（空集语义，常态黑色，确认态 `✕` 标红），`✕`=删除类确认）。
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
- 顶部：`linear-gradient(to bottom, #EFEFEF 60%, rgba(239,239,239,0) 100%)`
- 底部：`linear-gradient(to top, ...)` 同构
- 菜单：`linear-gradient(to left, ...)`（向右淡出）
- 拖拽手柄：`linear-gradient(to right, rgba(239,239,239,0) 0%, rgba(239,239,239,.9) 45%, #EFEFEF 75%)`

## 6. 交互时序（改手势必读）

| 手势 | 触发条件 | 实现 |
|---|---|---|
| 文本单击 | — | 进入编辑态 |
| 状态按钮单击 | 300ms 内无第二次点击 | `toggleInProgress` |
| 状态按钮双击 | 300ms 内第二次点击 | `toggleComplete` |
| 长按 | 触屏按住 450ms 不移动（>12px 取消）；**桌面鼠标按住 450ms**（mouseup/mouseleave 取消） | 进入 actionMode（触屏与鼠标独立实现，触发后各抑制随后的 click） |
| 桌面右键 | 右键任务行（编辑态/拖拽中除外） | 阻止系统菜单，直接进入 actionMode（`onContextMenu`） |
| 桌面右键（空白） | 全局拦截 | 禁用系统菜单（APP 沉浸感，App 根容器 `onContextMenu`）；编辑输入框除外（保留复制粘贴） |
| 拖拽排序 | 仅 actionMode 下拖拽手柄 | dnd-kit TouchSensor delay 150ms / tolerance 12px |
| 横向翻页 | 列表数 > 1 时滑动 | 原生 scroll-snap，线性分页（首尾不可回绕） |
| 拖拽结束后 | 一帧内 | `suppressLayout` 关 layout 动画 |

> ⚠️ 横向翻页仅在有多个列表时可用；单列表（或无列表）容器为 `overflow-x-hidden`，不会产生横向滑动。当前列表无任务时主体显示 `NO LISTS` 占位，添加第一个任务后消失。

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
| 标题切换（切列表） | AnimatePresence `mode="wait"`，opacity 淡出→淡入 `0.15s`（key=`activeListId`，编辑保存标题不触发） |
| 菜单/底部栏滑动 | `y ±6/8px`，`0.15s` |
| 完成标记弹入 | scale `0.4→1`，`0.15s` |
| hover 颜色 | `transition-colors duration-200` |

## 8. 移动端 Web 细节（别丢）

- `-webkit-tap-highlight-color: transparent`（禁点击高亮）。
- `overscroll-behavior-y: none`（禁下拉刷新粘连）。
- `font-size: 16px` 于 body（防 iOS 缩放）。
- **键盘避让**：iOS Safari 的 `position: fixed` 底部栏不自动让位键盘——App.tsx 监听 `visualViewport` 的 resize/scroll，按 `innerHeight - vv.height` 抬起底部栏 `bottom`，保证 ADD 输入框在键盘上方。
- 图标/标题：manifest `theme_color` 与 `background_color` 均为 `#EFEFEF`，standalone + portrait。
- 菜单 `≡` 的 `Bracket` 宽度与文字基线对齐靠 `items-baseline`。

## 9. 设计参照

- `design/reference.jpg`：原始设计稿（本模型无法读取图片，未来 Agent 若支持图片输入可对照）。
- `index.html`：字体预加载 `preconnect` + `display=swap`。
