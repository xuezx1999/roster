# DECISIONS.md — 技术决策记录（ADR）

> 记录每个关键设计的"为什么"。格式：现状 → 理由 → 代价 → 何时可以改变。
> 当你想"为什么要这样"时查这里；当你觉得"这能改得更好"时，先对照"代价"栏是否已知。

---

## D1. 无路由、无状态库，单页 + 单 hook

**现状**：不引 react-router / redux/zustand；所有全局状态在 `useTodos`，交互编排在 `App.tsx`。
**理由**：应用只有一个页面，路由无意义；状态逻辑集中在一个 hook 便于整体把握；减少依赖与心智负担，契合"极简"定位。
**代价**：`App.tsx` 已有 518 行且承担大量 UI 状态，易膨胀；跨组件状态只能靠 props 钻取。
**何时可改**：当 App.tsx 超过 ~700 行或出现第三层状态时，考虑拆 `useAppUi` 之类子 hook；引入 zustand 仅当状态跨组件且性能可观测地变差。

---

## D2. 乐观更新 + fire-and-forget 落库

**现状**：`updateList` 先改 React state，`saveList` 后台执行不 await；写失败由 `reportSave(false)` → `saveError` 置位，App 顶部显示 `[!] 保存失败`（v0.6.0 起）。
**理由**：IndexedDB 单机写入快，UI 无需等待；保证交互即时（长按/快速连续操作不卡顿）。
**代价**：写失败仅提示不重试（无写队列）；`updateList` 在 setState updater 内调副作用（saveList/persistBackup），依赖 StrictMode 双执行幂等。
**何时可改**：不要简单加 `await`（会破坏交互手感）。更优方案是写队列 + 失败重试 + 状态提示，且是**明确的功能增强任务**时再动。

---

## D3. 排序语义：数组顺序承载，`order` 字段冗余

**现状**：`sortTasks` 按 进行中→待办→已完成 分组后**就地重写 `t.order`**，dnd-kit 用 `id` 排序，持久化存整个数组。
**理由**：分组视图让"新任务"和"手动拖拽"天然落在正确位置；数组顺序就是唯一真相，`order` 仅作归档/兼容。
**代价**：`order` 与真实顺序可能漂移；`sortTasks` 就地改对象引用（非纯函数），排查时易困惑。
**何时可改**：若引入"自由排序不受分组约束"的需求，需重写排序模型并更新迁移；常规任务**不要动**，沿用数组顺序即可。

---

## D4. framer-motion `layout` 与 dnd-kit transform 共存

**现状**：列表项 `layout={!suppressLayout}`；拖拽结束一帧内关掉 layout 动画（App.tsx:110-117）。
**理由**：两者都操作 transform，同时开启会产生双重位移抖动。
**代价**：`suppressLayout` 是脆弱协调机制，与手势时序耦合；新增动画需时刻记得此约束。
**何时可改**：仅当迁移到单一动画方案（例如完全用 dnd-kit 自带 + 移除 framer layout）时才可移除；这是大重构，非日常任务。

---

## D5. IndexedDB 存全量，单条操作整表覆盖

**现状**：`saveList` 每次 put 整张 list（含全部 tasks）。
**理由**：数据量级小（个人待办），实现最简单，避免 diff 与事务复杂度。
**代价**：任务量极大时每次写全量有性能损耗；多端并发写入会有覆盖（本应用单端离线，无实际影响）。
**何时可改**：列表超过数百条任务并出现可感知卡顿时，可改为事务级增量写。当前无需优化。

---

## D6. 样式：Tailwind v4 原子类 + 色值硬编码（已由 D13 token 化落地）

**现状**：颜色/字号/行高以内联原子类重复书写（`text-[#F2F2F2]` 等），`@theme` 仅定义字体。
**理由**：v4 快速迭代期最省事；改版未定稿前抽 token 反而反复返工。
**代价**：改主题色需全局 grep（背景色还散落在 index.css / index.html / vite.config.ts manifest / generate-icons.py / favicon.svg）；无法利用 Tailwind 的命名语义。
**何时可改**：视觉方案冻结后，将 4 色 + 字号 + 行高抽入 `@theme`（如 `--color-bg / --color-ink / --color-mute / --color-danger`）并替换全部原子类。**一次完成，别部分替换**（会加剧不一致）。

---

## D7. 手势用原生定时器手写（300ms 双击 / 450ms 长按）

**现状**：TaskItem 用 setTimeout 实现单击-双击区分与长按，配 `justHandledTouchRef` 抑制事件串扰。
**理由**：不引额外手势库，行为完全可控，适配"单击状态按钮=进行中、双击=完成"这种自定义语义。
**代价**：300/450ms + tolerance 12px 三套时序耦合，移动端真机需要反复回归；`justHandledTouchRef` 的 300ms 窗口是隐式魔法。
**何时可改**：出现真实 bug 或要支持桌面拖拽时才引入成熟手势库（如 @use-gesture/react）；改动必须全量回归（见 DESIGN_SYSTEM §6）。

---

## D8. 保留 v1 数据迁移与导入兼容

**现状**：db.ts upgrade 处理 v1→v2；导入识别 v1 旧格式。
**理由**：早期用户（可能）有 v1 数据，避免升级丢数据。
**代价**：迁移代码用 `as unknown as` 强转，无类型保障；升级路径带隐性复杂度。
**何时可改**：确认已无 v1 用户（或产品上线不足 1 个迁移周期）后，删除迁移分支与 v1 导入分支，DB_VERSION 保持不变；否则保留。

---

## D9. PWA：autoUpdate + Google Fonts CacheFirst（1 年）

**现状**：`registerType: 'autoUpdate'`；字体走运行时 CacheFirst 缓存 365 天。
**理由**：个人工具型应用，无需打扰用户升级；字体缓存避免重复下载。
**代价**：字体缓存 1 年，改字体后旧缓存仍命中（需手动清）；autoUpdate 无版本说明，极端情况下新旧资源不匹配。
**何时可改**：改为 `prompt` 需实现更新提示 UI，通常不值得；若换字体，把缓存有效期缩短或换自托管字体。

---

## D10. 测试与工程化（2026-08-11 起补课）

**现状**：Vitest 纯函数测试已落地（`src/roster.test.ts`，8 用例覆盖 sortTasks/normalizeTask/parseRosterImport）；git 仓库已建（main，远程 origin→github.com/xuezx1999/roster.git）；README 已重写；Cloudflare Pages Git 集成部署。无 CI、无组件/交互测试。
**理由**：极简个人项目起步优先功能；首测只覆盖纯函数（Vitest 与 Vite 同源），符合"先纯函数后交互"渐进策略。
**代价**：手势时序、迁移、分页双同步等高危逻辑仍靠手测回归；无 CI 意味着 push 不自动跑 tsc/test。
**何时可改**：引入 GitHub Actions 跑 `tsc -b` + `npm test` + `lint` 属工程化补课；组件/交互测试待真出现回归 bug 时再补。

---

## D11. 列表分页：克隆页无限轮播，单列表禁滑，移除"新增列表"空白页（已由 D12 撤销，保留作历史记录）

**现状**：`>1` 个列表时渲染 `[clone(last), ...lists, clone(first)]` 共 N+2 页，滚到克隆页由 `jumpTo` 无动画瞬移回真实页形成循环；单列表/空列表 `overflow-x-hidden` 禁滑；新增列表入口移到右上角菜单，空列表时底部显示 `[+] ADD`。
**理由**：多列表循环切换是明确的交互需求（首尾相接）；克隆页方案保留原生 scroll-snap 机制，不引入手势库/状态重构，改动面最小；单列表禁滑避免"滑到空处"；去掉末尾空白页后"新增列表"入口自然收敛到菜单与空状态。
**代价**：
- 克隆页使真实列表在 DOM 中双份渲染（首尾各一次），超长列表有轻微性能开销；
- 克隆页上的交互（编辑/长按/拖拽）理论上可达，但瞬移立即发生，实际几乎无法停留；
- `jumpTo` 与 `initialScrollDone` 是脆弱协调机制：smooth 滚动若从克隆页位置出发会误触发瞬移（首帧已用 auto 定位规避，布局重排场景由瞬移自愈）；
- `App.tsx` 行数增至 659，克隆页 section 三份重复代码（未抽组件，遵循任务最小化）。
**何时可改**：若引入"分页指示器/页面 Dots"或需要禁用循环（改为单向），需重写映射逻辑；抽公共 `ListSection` 组件在 App.tsx 继续膨胀时可做。

---

## D12. 分页回退为线性（撤销 D11 的循环方案）

**现状**：>1 个列表时横向滑动**线性分页**，首尾不可回绕；单列表/空列表禁滑；新增列表入口在菜单与空状态 `[+] ADD`。
**理由**：克隆页循环在 iOS 真机反复出现体验问题——首尾瞬移打断吸附造成"各页速度不一致"，scrollend 时机不可靠造成"要多滑一次"，修复成本高于收益。线性分页回到原生 snap-scroll 直通语义，行为可预期。
**代价**：
- 最后一个列表右滑到头即止（无回绕），多列表间只能原路滑回；
- 放弃克隆页方案意味着 v0.2.4/0.2.5 的两处瞬移协调机制（jumpTo/scrollend/停止检测）全部删除，仅保留 `scrollDrivenRef` 抑制反向滚动与 `initialScrollDone` 首帧定位。
**何时可改**：若重新引入循环，优先考虑非克隆页方案（如滚动边界检测 + 方向判定），或等 Safari 对 `scrollend`/`scroll-snap` 行为稳定后重试 D11 方案。

---

## D13. 设计 Token 化 + 暗色模式（落地 D6 的技术债）

**现状**：4 色抽入 Tailwind `@theme`（`--color-bg/ink/mute/danger`），亮色为默认，`html[data-theme='dark']` 覆盖同名变量生成暗色值；全量替换约 70 处硬编码色，渐变改用 `var(--color-bg)` + `color-mix`；菜单「◐」切换 + localStorage 持久化 + 系统偏好回退。
**理由**：暗色模式强制要求色值可切换，D6 一直挂起的"token 化"在此一次完成；工具类基于 `var()` 自动跟随主题，新增 UI 直接写 `text-ink` 即可。
**代价**：
- 静态外壳（PWA manifest theme_color/background_color、favicon、图标 PNG）不随主题，保持亮色值；
- 暗色下红条（bg-danger + text-bg）为红底黑字，对比度可接受；
- `color-mix` 依赖现代浏览器（2023+），旧浏览器渐变遮罩降级。
**何时可改**：若需要 PWA 外壳也随主题，可在 manifest 使用动态 theme_color（浏览器支持有限）；图标换主题化需重新设计。

---

## 决策时间线

按代码痕迹推断的演进顺序：
1. **v1**：单列表，`tasks` store + `meta['list-title']`，无多列表概念。
2. **v2**：多列表（lists store + active-list-id），任务内嵌，新增导入导出与确认交互。
3. **持续迭代**：引入 dnd-kit 拖拽排序、framer-motion 动画、PWA 支持、长按操作模式。
（无 git 历史，以上为结构推断；若未来建立 git，新决策应追加到本文件并补充关联 commit。）
