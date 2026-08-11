# AGENTS.md — AI Coding Agent 协作规则

> 本文件定义 AI Agent 在本仓库**如何参与开发**。面向 AI，不面向用户。
> 未读 docs/ 之前不要改代码；改代码前先过一遍本文件的原则。

## 1. 开始工作前必读

按顺序，缺一不可：

1. `docs/AI_CONTEXT.md` — 5 分钟速览、核心不变量、"不要改"清单、当前项目状态。
2. `docs/ARCHITECTURE.md` — 数据流、分页双同步、动画机制、历史痕迹。
3. `docs/DEVELOPMENT.md` — 构建/验证命令、环境坑（当前 lint 跑不了）、验证清单。
4. 任务相关文档：
   - 改 UI → `docs/DESIGN_SYSTEM.md`
   - 质疑设计/想重构 → `docs/DECISIONS.md`
   - 数据/schema → `docs/ARCHITECTURE.md` §4.2 + `docs/DEVELOPMENT.md` §8

判断已读懂的标准：能回答"数据从哪里来、改哪几个文件、怎么验证、哪些不能动"。

## 2. 修改代码原则

- **任务最小化**：先定位，再改动。不"顺手"重构无关代码（尤其 db.ts 迁移、App.tsx 手势编排、样式原子类）。
- **遵守现有模式**：
  - 数据变更一律走 `useTodos` 的 `updateList(listId, updater)`（乐观更新 + fire-and-forget 落库），禁止直接调 idb 读写绕过 state。
  - 排序后必须调用 `sortTasks`，保持 进行中→待办→已完成 分组语义。
  - 新增 UI 用 Tailwind 原子类 + 既有 4 色 token；新组件参考 `components/*` 现有写法。
  - import 类型用 `import type`（`verbatimModuleSyntax` 强制）。
- **不新增依赖**除非任务明确要求且理由充分（项目依赖极简）。引入前先说明理由。
- **不丢历史兼容**：v1 迁移分支与 v1 导入分支在确认无旧用户前不得删除。
- **每处改动要能自答**："这会破坏哪些不变量？"（见 §3）。
- 改完必须跑 `npx tsc -b`；能跑 `npm run build` 就验证。

## 3. 不可破坏的架构约束

1. **写路径唯一**：`updateList(listId, updater)` 是唯一写入口（`addTask`/`clearCompleted` 等均为其包装）。绕过它会 state/持久化失同步。注意：列表被清空（有任务→无任务）时它会自动删除该列表并回退 `activeListId`（新建的空列表除外）。
2. **排序语义在数组顺序**，`order` 字段是运行时重算的冗余值，不作为真相。
3. **`currentIndex` ↔ `activeListId` 双向同步**（App.tsx:88-130）：改一侧必须同时改另一侧。滚动驱动的变化由 `scrollDrivenRef` 抑制反向 scrollTo（否则打断吸附动画）；`initialScrollDone` 首帧定位。改分页逻辑时两者缺一会导致翻页错乱或各页速度不一致。
4. **`suppressLayout` + requestAnimationFrame**（App.tsx:110-117）：framer layout 与 dnd-kit transform 的协调机制，移除会导致拖拽抖动。
5. **手势时序**：单击=进行中、双击=完成（300ms）、长按 450ms、TouchSensor 150ms/tolerance 12px，相互耦合。改一个必须全量回归。
6. **DB schema**：`DB_VERSION` 只增不降；改动必须写 upgrade 迁移分支，否则老用户数据丢失。
7. **`Bracket` 定宽 3.5ch**：全应用对齐基准，不改。

## 4. UI / UX / 交互原则

- 保持极简终端美学：纯色背景、4 色 token（`bg/ink/mute/danger`，见 DESIGN_SYSTEM §2；亮暗双主题由 `html[data-theme]` 切换，UI 一律用 `text-ink` 等工具类，**禁止硬编码色值**）、`[符号]` 括符、大写、等宽。**不引入**圆角/阴影/彩色/图标库/卡片布局。
- 布局遵守安全区：贴边元素用 `env(safe-area-inset-*)`，桌面 `max-w-[640px] mx-auto`。
- 输入框统一规范：`bg-transparent` + 下边框、关自动补全/拼写。
- 破坏性操作必须**两级确认**（先动作，再"确认XX"），颜色 `#B3261E`。
- 桌面无触屏时，长按类交互需保证鼠标可替代路径——新增交互若只依赖触控手势，视为缺移动端可访问性。
- 视觉方案冻结前，色值 token 化（抽 `@theme`）是改进点，但要求**一次全量完成**，禁止部分替换。

## 5. Debug 与问题修复流程

按顺序排查：

1. **复现并归类**：是 UI/交互、数据、还是 PWA 缓存问题。
2. **查文档**：先对 `docs/AI_CONTEXT.md` 的"不要改"清单与 `docs/DESIGN_SYSTEM.md` §6 时序表，排除已知脆弱点。
3. **查源头**：
   - 数据不对 → `useTodos.ts` 与 `db.ts`（注意 `saveList` 无 catch，检查 IndexedDB 配额/隐私模式）。
   - 分页/标题/底部栏错乱 → App.tsx 双同步逻辑。
   - 动画抖动 → `suppressLayout` 或 layout 与 transform 冲突。
   - 移动端手势异常 → TaskItem 定时器 + TouchSensor 配置，用设备模拟/真机复测。
4. **修最小时**：按 §2 原则改动，不扩大范围。
5. **验证**：`npx tsc -b` + 针对性回归（新增交互按 `docs/DEVELOPMENT.md` §7 清单）。
6. **留痕**：若问题源于已知设计权衡（乐观更新丢写、字体缓存 365 天等），在修复处注释或更新 DECISIONS/CHANGELOG，不"假修复"掩盖根因。

## 6. 文档维护规则

- 改动涉及以下任一：数据结构、数据流、组件职责、交互行为、构建配置 → 同步更新对应 docs/ 文件。
- `docs/CHANGELOG.md`：**每次修改后**在顶部追加条目（格式见该文件 §约定）。
- `docs/DECISIONS.md`：推翻/偏离既有决策时，追加新条目，不删旧条目。
- README 是 Vite 模板原文，与本项目无关；只有做"面向用户的项目介绍"任务时才重写它，日常不动。
- 文档与代码不一致时，以代码为准，并主动修文档。

## 7. 重大修改必须同步的文件

定义"重大修改"：改 schema、改数据流/状态模型、改交互模型、改构建/PWA 配置、改设计 token、引入新依赖。

| 变更类型 | 必须更新 |
|---|---|
| IndexedDB schema / 数据模型 | `docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`、`docs/DECISIONS.md`（DB_VERSION 只增） |
| 数据流 / 状态结构 | `docs/ARCHITECTURE.md`、`docs/AI_CONTEXT.md`（不变量部分） |
| 交互/手势模型 | `docs/DESIGN_SYSTEM.md` §6、`docs/CHANGELOG.md` |
| 设计 token / 视觉 | `docs/DESIGN_SYSTEM.md`、`docs/DECISIONS.md`（D6） |
| 构建 / PWA / 依赖 | `docs/DEVELOPMENT.md`、`docs/CHANGELOG.md` |
| 删除历史兼容（v1） | `docs/CHANGELOG.md`、`docs/ARCHITECTURE.md` §8、`docs/DECISIONS.md`（D8） |
| 排序模型 | `docs/DECISIONS.md`（D3），谨慎——当前数组顺序语义请勿轻改 |

变更完成后：`npx tsc -b` 通过 + 回归验证，然后向用户汇报"改了哪些文件、动了哪些不变量、更新了哪些文档"。
