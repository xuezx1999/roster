# AI_CONTEXT.md — 项目速览（入口文档）

> 面向 AI Agent 的 5 分钟入门。先读本文件，再按需深入其他文档。
> 如果只读一个文件，读这个。

## 这是什么项目

**ROSTER**：一款移动端优先的极简单页待办应用（PWA）。
- 无后端、无路由、无第三方状态库。
- 数据全部存浏览器 IndexedDB，支持 JSON 导出/导入备份。
- 多列表横向分页滑动（线性，首尾不可回绕），单列表禁用滑动；Web 宽屏（≥768px）每列定宽 400px 一屏多列，键盘 `←`/`→` 按屏翻页；支持亮/暗双主题（菜单「◐」切换，token 化）。

## 技术栈一句话

Vite 6 + React 19 + TypeScript 5.6 + Tailwind CSS v4（`@tailwindcss/vite`）+ @dnd-kit（拖拽排序）+ framer-motion 13（动画）+ idb 8（IndexedDB）+ vite-plugin-pwa（Workbox）+ cuelume（Web Audio 交互音效，零依赖 ~5kB）。

## 源码文件地图（全部核心代码 11 个文件）

```
src/
  main.tsx              入口 + PWA SW 注册（仅 PROD）
  App.tsx               唯一页面，承载交互编排 + 响应式双布局（931 行，最大文件）
  types.ts              Task / TodoList / RosterExport 类型定义
  db.ts                 IndexedDB 层 + v1→v2 数据迁移
  utils.ts              generateId() + downloadJSON() + parseRosterImport()
  hooks/useTodos.ts     全局状态 + 全部数据操作（写入口 updateList，per-list 与 activeListId 两套 API）
  components/
    EditableTitle.tsx   标题点击编辑
    TaskList.tsx        排序上下文 + 进出场动画容器
    TaskItem.tsx        单行任务（最复杂组件，手势处理全在这里）
    AddTask.tsx         底部添加（forwardRef + useImperativeHandle）
    ListPanel.tsx       桌面多列自包含列面板（标题/列菜单/任务/ADD）
    Bracket.tsx         `[...]` 装饰括符
  index.css             Tailwind 入口 + 全局 token/字体
```

## 数据模型

```ts
interface Task {
  id: string
  content: string
  completed: boolean
  inProgress: boolean
  order: number          // 注意：运行时由 sortTasks 重算，非持久语义
  createdAt: number
  updatedAt: number
  completedAt?: number
}

interface TodoList {
  id: string
  title: string
  tasks: Task[]
}

interface RosterExport {  // JSON 导入导出格式
  app: string            // 必须 === 'ROSTER' 才被接受
  version: number        // 当前为 2
  exportedAt: number
  activeListId: string
  lists: TodoList[]
}
```

IndexedDB：库名 `roster-db`，版本 `2`，两个 store —— `lists`（keyPath `id`）+ `meta`（存 `active-list-id`）。

## 核心不变量（改代码前必读）

1. **所有数据变更都必须经过 `useTodos` 的 `updateList(listId, updater)`**（useTodos.ts:62-92），`addTask`/`clearCompleted` 等均为其包装。它做"乐观更新 + fire-and-forget 落库"：先改 React state，再后台 `saveList`。**列表被清空（有任务→无任务）时它会自动删除该列表并回退 activeListId**。不要绕过它直接操作 DB，否则 state 与持久化失同步。
2. **显示顺序由 `sortTasks` 强制重排**（useTodos.ts:13-22）：进行中 → 待办 → 已完成。任何对 `tasks` 的增删改后都必须调用 `sortTasks` 保持分组语义。
3. **`currentIndex` 与 `activeListId` 双向同步**（App.tsx:88-130）：滚动触发 `switchList`，`activeListId` 变化触发滚动。滚动驱动的变化由 `scrollDrivenRef` 抑制反向滚动（否则打断吸附动画，各页速度不一致）。改任何一侧必须同时考虑另一侧，否则翻页与标题/底部栏错乱。
4. **framer-motion 的 `layout` 与 dnd-kit 的 transform 冲突**：靠 `suppressLayout` 在拖拽结束后一帧内关掉 layout 动画规避（App.tsx:110-117）。这是已知脆弱点，别动这个机制。
5. **移动端手势三套定时器并存**：单击/双击 300ms（TaskItem.tsx:78-93）、长按 450ms（TaskItem.tsx:95-103）、TouchSensor 拖拽延迟 150ms。改动任何一个必须回归全部手势。

## 哪些地方不要改（除非任务明确要求）

- **`db.ts` 的 v1 迁移逻辑**（db.ts:34-61）：用 `as unknown as` 强转访问旧 store，能跑但脆弱。若项目无 v1 用户再考虑删除，不要"顺手重构"。
- **`App.tsx` 的 `suppressLayout` + `requestAnimationFrame`**（App.tsx:151-158）：去掉会导致拖拽结束瞬间列表抖动。
- **`App.tsx` 的首帧定位 `initialScrollDone` + `scrollDrivenRef` 抑制**（App.tsx:88-130）：删掉会导致首帧位置错乱或翻页时吸附动画被 JS 平滑滚动打断。
- **`Bracket.tsx` 的 `3.5ch` 定宽**：改动会破坏所有 `[x]` 符号的对齐。
- **手势时间常数**（300/450/150ms、tolerance 12px）：改一个就要全量回归。

## 当前项目状态（2026-08-13）

- `tsc -b` ✅ 通过；`npm test`（Vitest 纯函数，22 用例）✅ 通过；`npm run lint`（oxlint）✅ 通过。
- 有 git 仓库（main 分支）、GitHub Actions CI（push/PR 跑 tsc/lint/test）、无 CI 失败记录。
- `package.json` version：`0.9.13`。
- PWA 更新：`registerType: 'prompt'`（新 SW 就绪提示「新版本可用」，点击后 skipWaiting + reload）；`usePwaUpdate.ts` 挂 visibilitychange / focus / 60min 定时器三路主动 `registration.update()`，解决 PWA 常驻内存不检查更新的问题（0.9.7）。
- 音效：菜单「♪ 开启/关闭音效」持久化 `localStorage['roster-sound']`（默认开）；`App.tsx` 顶层 `bind()` 一次 + `setEnabled` 跟随开关；浏览器首次交互前自动静默。
- README.md 已重写为面向用户的项目介绍。
- 已知技术债：WebDAV 跨设备同步未做（需外部凭据）；`updateList` 在 updater 内调副作用为既有设计（幂等，保留）；`.workbuddy/` 已 gitignore（个人记忆不入库）。（Cloudflare Pages 已通过 Git 集成部署，push 触发自动构建。）

## 快速上手命令

```bash
npm install
npm run dev        # 开发
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run test       # Vitest（纯函数）
npm run preview    # 预览生产构建
```

## 文档导航

| 文档 | 内容 | 何时读 |
|---|---|---|
| ARCHITECTURE.md | 架构、数据流、页面逻辑、动画机制、历史痕迹 | 要改结构/理解全局时 |
| DESIGN_SYSTEM.md | 设计 token、排版、组件规范、交互时序 | 改任何 UI 前 |
| DEVELOPMENT.md | 构建/配置/验证流程、环境问题、调试技巧 | 要跑/验证代码时 |
| DECISIONS.md | 每个技术决策的"为什么"与代价 | 质疑现有设计时 |
| CHANGELOG.md | 版本演进记录（无 git，靠代码痕迹重建） | 想知道项目怎么长成这样时 |
