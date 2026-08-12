# CHANGELOG.md — 版本演进记录

> 项目已接入 git（main 分支，远程 origin→github.com/xuezx1999/roster.git）；早期版本（v1/v0.x）由代码痕迹推断重建，0.8.5 起有 commit 记录。
> 格式：`[v版本] 日期 — 摘要`。未标注日期处标记为"结构推断"。
> 未来每次变更请在本文件顶部追加条目（这是对 AI 维护者最重要的文档之一）。

---

## [0.9.0] 2026-08-12 — 交互音效：cuelume 接入 + 音效开关

### 新增
- **交互音效**（`cuelume@0.2.2`，Web Audio 实时合成，零运行时依赖，~5kB gzip，MIT）：
  - 菜单开合、主题切换 → `toggle` 音；任务状态切换（单击=进行中 / 双击=完成）→ `toggle` 音（音量 0.5，放在长按抑制之后触发，长按进入操作模式不会误响）；新增列表 → `tick`；删除任务/删除列表/清除完成 → `droplet`；导出数据 → `success`；添加任务提交 → `press`；保存失败横幅出现 → `error`（用户可恢复错误）。
  - 浏览器首次交互前静默（autoplay 限制由库兜底，静默 no-op 不抛错）；`App.tsx` 顶层 `bind()` 一次（幂等、事件委托覆盖动态 DOM）。
- **音效开关**：菜单「♪ 开启音效 / 关闭音效」，与「◐ 亮色模式/暗色模式」同一组（分割线之前）；移动端全局菜单与桌面列菜单两处同步维护。默认开启，持久化 `localStorage['roster-sound']`（`off` = 关闭，未设置/其他值 = 开启；`setEnabled` 由应用在启动与切换时同步）。

### 变更
- `App.tsx` 新增 `handleAddList` 统一入口（全局菜单/列菜单/空态 ADD/双击空白共用，带 `tick` 结果音效）。

### 文档同步
- `package.json` version `0.8.11 → 0.9.0`，dependencies 新增 `cuelume@^0.2.2`。
- `docs/DEVELOPMENT.md` §10 依赖清单、`docs/AI_CONTEXT.md` 技术栈与项目状态同步。

---

## [0.8.11] 2026-08-12 — 使用说明页优化：四级列表缩进 + 全文文案校对

### 修复
- **四级标题下的列表无缩进**：`HelpPage` 中 h4 内容缩进 `pl-12 → pl-16`，列表明确深于四级标题一级（此前与标题左对齐，视觉上无层级）。涉及 PWA 添加方式下的 iOS / Android / 桌面端浏览器三个小节的有序/无序列表。
- **使用说明全文文案校对**（`helpContent.ts`）：
  - 错别字：`实行圆圈` → `实心圆圈`。
  - 语病：`强烈的建议` → `强烈建议`；导出文件句补主语；`被导入文件完整替换` → `被导入文件中的内容完整替换`；自动导出与"存到云端"自相矛盾 → 改为"手动导出并把文件存到云盘等安全位置"；空心圆圈含义句指代不清 → "含义可按您的习惯自定义"；Chromium 句首状语拗口改写。
  - 前后不一致：菜单项统一「清除完成」（含章节标题 `清除已完成` → `清除完成`）；平台名 `安卓` → `Android`；`按站点 Origin 隔离` 两处统一；`导出/导入` 斜杠空格统一；重名标题 `桌面端浏览器` → `桌面端浏览器（安装应用）`；`Enter`/`≡` 加粗规则统一。
  - 引号统一：界面按钮/菜单名/强调概念由英文双引号全部改为「」（共 27 处，含 `共享` → `分享`）；`initError` 加反引号代码样式。
  - 标点空格：删除 `找到 「」`、`导出/ 导入`、`` `文件名` ，`` 等多余空格；顿号连接分句改逗号；列表项结尾标点统一；URL 冒号后/句号前空格去除。
- `helpContent` 标题 `PWA  添加方式` 多余空格去除。

### 变更
- 使用说明页「当前版本」区块内容更新：版本号 `0.8.10 → 0.8.11`，更新日期 2026-08-12，主要更新内容追加"四级标题下列表缩进优化"。

### 文档同步
- `package.json` version `0.8.10 → 0.8.11`。

---

## [0.8.8] 2026-08-11 — 第二轮上线后检查修复：删除失步/导入备份/IME/初始化兜底 + 字体自托管 + 隐私清除

### 修复
- **桌面删除列表后视图失步（P1）**：删除「活动列表左侧」的列表（列菜单删除或清除任务自动删列）后，`lists` 数组变化但 `activeListId` 未变，同步 effect 因 `prevActiveListId === activeListId` 早退，导致 `currentIndex` 陈旧、活动列被滚出视口（显示成右侧另一个列表）。改为以 `activeIndexRef` 检测索引漂移并立即重定位（auto，不打断动画）。同时覆盖 `updateList` 自动删空列表路径。
- **导入覆盖库内备份（P1/P2）**：`replaceData` 此前导入成功后把导入内容覆写进 `meta['backup']`，误导入（形状合法但内容错误，如空文件）后主数据与备份同时丢失、不可恢复。改为：导入前先快照当前数据进备份（导入成功后不再覆写）；导入空数据而原数据非空时自动触发「检测到数据可能丢失」横幅；菜单（移动端 + 桌面列）新增「[↩] 恢复备份」入口（`backupAvailable` 控制显示，`restoreFromBackup` 支持运行中回库读取）。
- **中文输入法（IME）组合回车误提交（P2）**：`AddTask` / `TaskItem` / `EditableTitle` 三处 `handleKeyDown` 未判 `e.nativeEvent.isComposing`，拼音选词按 Enter 会误提交半截文本。已统一加守卫。
- **初始化无错误兜底（P2）**：`useTodos` 初始化 `Promise.all` 无 catch，IndexedDB 打开失败（隐私模式/配额）会永久卡在 `...`。加 catch → `initError` 置位，App 显示「[!] 无法读取本地存储 — 点击重试」。
- **导入不重新排序（P3）**：`replaceData` 现对每个列表 `sortTasks`（v1 旧格式/手工 JSON 导入后任务按 进行中→待办→已完成 分组）。
- **导入 id 重复不校验（P3）**：`parseRosterImport` 增加列表 id / 任务 id 唯一性与任务 id 存在性校验，重复或缺失一律拒收（否则落库 put 互相覆盖、state 与 DB 失同步）。

### 优化
- **滚动性能**：列宽/左 padding 缓存进 `metricsRef`（`offsetWidth`/`getComputedStyle` 读取强制同步布局，滚动事件不再每次重算；窗口 resize 时失效重算）。
- **键盘避让重渲染**：`kbOffset` state 改为 `bottomBarRef` 直接改 `style.bottom`，`visualViewport` 滚动不再触发整个 App 重渲染。
- **备份写放大**：`persistBackup` 500ms 防抖，连续操作只写最后一次全量快照（主数据 `saveList` 仍立即写，备份仅二次保险）。
- **字体自托管**：IBM Plex Mono 400/500（latin 子集，~10KB/字重）下载至 `public/fonts/`，`index.css` 加 `@font-face`；移除 Google Fonts link/preconnect 与 workbox 字体 runtimeCaching（解决境内 CDN 访问不稳 + D9 的 365 天旧字体缓存问题），`globPatterns` 增加 `woff2` 预缓存。
- **隐私清除**：`.workbuddy/` 加入 `.gitignore` 并 `git rm --cached`；该目录下 `memory/2026-08-11.md`（含本机绝对路径/个人习惯）此前已误提交至公开仓库，本次用 `git filter-branch` 从**全部历史**中移除并 force push（见下方「安全备注」）。

### 测试
- `parseRosterImport` 新增 3 用例：列表 id 重复拒收、任务 id 重复拒收、任务缺 id 拒收（10 → 13）。

### 安全备注
- ⚠️ 仓库 `xuezx1999/roster` 为 **public**，`.workbuddy/memory/2026-08-11.md` 曾出现在历史提交中。本次已重写历史清除该文件并强制推送。**若任何协作者克隆过旧历史，请让其重新 clone 或执行 `git fetch && git rebase`；GitHub 侧旧 commit 仍可能被缓存访问，但已无法通过默认分支获取。** 建议：后续个人记忆文件一律放 `.workbuddy/`（已 ignore）。

### 文档同步
- package.json / package-lock.json 版本 0.8.7 → 0.8.8；AI_CONTEXT.md（测试用例数 8→13、App.tsx 行数、版本引用）；DEVELOPMENT.md（PWA 字体缓存移除、验证清单补充）；DECISIONS.md（D9 现状/代价更新）；DESIGN_SYSTEM.md（字体来源自托管说明）。

---

## [0.8.7] 2026-08-11 — 上线后检查（二轮）：导入健壮性 + 暗色横幅 + 工程化

### 修复
- **导入崩溃兜底**：`parseRosterImport` 对 v2 仅校验 `app`/`lists` 数组，不校验每个列表有 `tasks` 数组；`replaceData` 直接 `l.tasks.map(...)` 遇残缺结构抛 `TypeError`，且 `handleConfirmImport` 无 try/catch → 导入流程崩溃、菜单卡确认态。改为：在 `parseRosterImport` 内校验每个 list 含 `id`(string)/`title`(string)/`tasks`(array)，残缺即返回 null；`App` 与 `ListPanel` 的 `handleConfirmImport` 包 try/catch，异常回退到「无效文件」提示。补相应测试用例（残缺 v2 拒收 / 完整空 tasks 接受）。
- **暗色模式「保存失败」横幅对比度**：原用 `text-bg bg-danger`，暗色下 `text-bg`=#1A1A1A（黑字红底），与亮色「红底白字」意图不一致。新增 token `--color-on-danger: #FFFFFF`，横幅改 `text-on-danger`，亮/暗均白字红底。

### 工程化
- **GitHub Actions CI**：新增 `.github/workflows/ci.yml`，push/PR 至 main 时跑 `npx tsc -b && npm run lint && npm test`（Node 20），避免再次"本地通过、线上漏测"。

### 文档同步
- 版本号对齐：package.json `0.8.4 → 0.8.7`；AI_CONTEXT.md 版本引用同步；本文件「当前版本」块更新。

---

## [0.8.6] 2026-08-11 — 上线后检查：修复移动端 v1 导入 + 同步过时文档

### 修复
- **移动端 v1 导入失效**：`App.tsx` 移动端 `handleFileSelect` 内联实现导入解析，要求 `data.app === 'ROSTER'` 才进入校验，v1 旧格式（无 app 字段）被拒。改为统一用 `utils.ts` 的 `parseRosterImport`（与桌面 `ListPanel` 一致，先识别 v1 再校验 v2），消除两套不一致实现。0.8.5 只修了 `parseRosterImport`，未同步 App.tsx 内联副本，本次补齐。
- 涉及：`src/App.tsx`（import 加 `parseRosterImport`、`handleFileSelect` 重写，879→861 行）。

### 文档同步（过时内容修正）
- `DEVELOPMENT.md` §7 验证清单：分页"首尾循环切换"→"线性切换（首尾不可回绕）"（v0.3.0 已回退，验证清单漏改）。
- `AI_CONTEXT.md`：App.tsx 行数 701→861；已知技术债移除"Cloudflare Pages 部署待执行"（已 Git 集成部署）。
- `ARCHITECTURE.md`：useTodos 266→462 行、TaskItem 248→289 行。
- `DECISIONS.md`：D2 现状/代价（写失败已提示，`updateActiveList`→`updateList`）；D6 标题标记"已由 D13 落地"；D10 重写为"测试与工程化"（Vitest/git/README/部署均已落地）；D11 标题标记"已由 D12 撤销"。
- `CHANGELOG.md`：开头"无 git 仓库"→已接入；当前版本 0.0.0→0.8.4；工程化痕迹过时项修正；变更记录约定第 2 条修正。

### 验证
- `tsc -b` ✅、`lint` ✅(0 err)、`test` ✅(8/8)、`build` ✅。

---

## [0.1.1] 2026-08-11 — 背景色微调 #F2F2F2 → #EFEFEF

### 变更
- 全局设计 token「背景」由 `#F2F2F2` 调整为 `#EFEFEF`（页面背景、顶部/底部/菜单渐变遮罩、拖拽手柄渐变同步为 `rgba(239,239,239)`）。
- 同步位置：`src/index.css`、`src/App.tsx`、`src/components/TaskItem.tsx`、`vite.config.ts`（manifest theme_color/background_color）、`index.html`（theme-color meta）、`public/favicon.svg`、`generate-icons.py`（并重新生成 `public/icon-{192,512}.png`）。
- 文档同步：`docs/DESIGN_SYSTEM.md`、`docs/DEVELOPMENT.md`、`AGENTS.md`。

---

## [0.2.0] 2026-08-11 — 列表分页交互改造：菜单新增列表 + 循环分页

### 变更
- **新增列表入口迁移**：移除末尾"新增列表"空白页；新增列表按钮移入右上角 ≡ 菜单（`[+] 新增列表`，置于菜单首位）。
- **空列表状态**：无任何列表时，主体显示占位 `NO LISTS`，底部直接展示 `[+] ADD` 按钮（点击新增列表）；双击空白同样新增列表。
- **循环分页**：>1 个列表时渲染 `[clone(last), ...lists, clone(first)]`（克隆页无限轮播），滚到克隆页由 `jumpTo` 无动画瞬移回真实页，实现首尾无缝循环；单列表/空列表禁用横向滑动（`overflow-x-hidden` + `touch-action: pan-y`）。
- **首帧定位**：新增 `initialScrollDone` ref，加载完成后 auto 定位到 activeListId 对应页，避免初始 scrollLeft=0（落在克隆页）触发误瞬移。
- 涉及文件：`src/App.tsx`（659 行）、`docs/AI_CONTEXT.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/DEVELOPMENT.md`、`docs/DECISIONS.md`（D11）。

---

## [0.2.1] 2026-08-11 — 空列表占位提示修正

### 变更
- `NO LISTS` 占位显示条件由"无任何列表"改为"**当前列表无任务**"：新建（未输入内容）/清除完成后的空列表保持 `NO LISTS`，添加第一个任务后消失。
- 实现：`src/App.tsx` 三处列表 section（clone-end / 真实 / clone-start）内条件渲染占位（`list.tasks.length === 0`），容器加 `h-full`/`min-h-full` 保证占位垂直居中。
- 文档同步：`docs/ARCHITECTURE.md` §5.2、`docs/DESIGN_SYSTEM.md` §6 注记。

---

## [0.2.2] 2026-08-11 — 移动端 ADD 输入框自动唤起键盘

### 修复
- 双击空白打开底部 ADD 输入框时，iOS 真机不自动唤起键盘：原 `setTimeout(10ms)` 延迟 focus 丢失用户手势上下文，iOS Safari 不弹键盘。
- 改为 `flushSync(() => setIsAdding(true))` 同步渲染 + `focus({ preventScroll: true })` + `scrollIntoView`，focus 落在双击手势调用栈内。
- 涉及：`src/components/AddTask.tsx`；文档同步 `docs/ARCHITECTURE.md` §5.2。

---

## [0.2.3] 2026-08-11 — NO LISTS 居中修正 + 键盘避让

### 修复
- **NO LISTS 占位跳动**：列表 section 内 `main` 由 `min-h-full` 改为 `h-full`——`min-height` 不提供确定高度参照，占位 div 的 `h-full` 失效导致占位脱离垂直居中；修复后高度链（section stretch → max-w h-full → main h-full → 占位 flex center）完整。
- **键盘遮住 ADD 输入框**：iOS Safari 的 `position: fixed` 底部栏不随键盘让位，新增 `visualViewport` 监听（App.tsx `kbOffset`），键盘弹出时底部栏 `bottom` 抬起键盘高度（`innerHeight - vv.height`），输入框始终在键盘上方。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §8。

---

## [0.2.4] 2026-08-11 — 循环翻页速度不一致修复

### 修复
- **首尾循环翻页"第一个列表特别快"**：原 `handleScroll` 在滚动途中检测到克隆页即 `jumpTo`（`behavior: 'auto'`）瞬移，**打断进行中的原生吸附动画**，导致从末页滑回首页时后半程被瞬间跳过。
- 修复：克隆页上只同步标题/索引（内容与真实列表一致），瞬移**延迟到 `scrollend`（吸附动画结束）后**执行；不支持 `scrollend` 的浏览器（iOS < 15.4）用 250ms 滚动停止检测兜底。
- 附带：滚动驱动的 `activeListId` 变化标记 `scrollDrivenRef`，同步 effect 跳过反向 `scrollTo`，杜绝 JS 平滑滚动打断原生吸附。
- 涉及：`src/App.tsx`；文档同步 `docs/ARCHITECTURE.md` §5.1、`docs/DESIGN_SYSTEM.md` §6。

---

## [0.2.5] 2026-08-11 — 循环翻页"多滑一次"修复

### 修复
- **正向翻末页要滑两次才回首页 / 反向翻首页要滑两次才到末页**：iOS 上 snap 吸附场景 `scrollend` 可能过早触发，瞬移判断时 `rawIdx` 尚未到克隆页而错过，兜底定时器又被吸附动画的 scroll 事件持续重置，瞬移迟迟不来，用户多滑一次。
- 修复（`src/App.tsx`）：
  - 瞬移统一由**滚动停止 180ms 检测**驱动，`scrollend` 仅作加速（延迟 80ms 等吸附落定）；
  - `jumpTo` 恢复 `scroll-snap-type` 由单 rAF 改为**双 rAF**，防止 snap 恢复瞬间把位置吸附回克隆页；
  - 停止检测天然自愈：万一瞬移后被吸回克隆页，180ms 后自动再次瞬移。
- 文档同步：`docs/ARCHITECTURE.md` §5.1。

---

## [0.2.6] 2026-08-11 — 清空列表自动删除

### 变更
- 多个列表时，某个列表被清空（清除已完成 / 删除任务删光）后**自动删除该列表**，不再保留空列表。
- 若删光后没有任何列表，回到初始空状态（`NO LISTS` + 底部 `[+] ADD`）；否则自动切到第一个剩余列表。
- 新建的空列表（`[+] ADD` / 菜单新增列表）不受影响，可正常添加任务。
- 实现：`src/hooks/useTodos.ts` 的 `updateActiveList`（唯一写入口）内，当更新结果 `tasks.length === 0` 且原列表有任务时，改为删除列表（`deleteList` 落库 + 切换 `activeListId`）。
- 文档同步：`docs/ARCHITECTURE.md` §3.2、§4.1、`docs/AI_CONTEXT.md`、`AGENTS.md`。

---

## [0.2.7] 2026-08-11 — 标题切换动画 + 菜单文案调整

### 变更
- **标题淡出淡入**：切换列表时，顶部标题随内容变化做 opacity 淡出→淡入（AnimatePresence `mode="wait"`，`key`=标题文本，0.15s）。
- **菜单文案**：「清除已完成」→「清除完成」；确认该动作**只清除当前列表**（`clearCompleted` 经 `updateActiveList` 作用于 `activeListId`，本就为当前列表，非全局）。
- 涉及：`src/App.tsx`、`src/hooks/useTodos.ts`（注释）；文档同步 `docs/ARCHITECTURE.md` §5.2、`docs/DESIGN_SYSTEM.md` §7、`docs/DEVELOPMENT.md` §7。

---

## [0.2.8] 2026-08-11 — 标题动画限定为切列表触发

### 修复
- 编辑保存标题不再触发淡入淡出：动画 `key` 由标题文本改为 `activeListId`，仅切换列表（activeListId 变化）时动画。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §7。

---

## [0.3.0] 2026-08-11 — 分页回退为线性（移除克隆页循环）

### 变更
- 多列表横向分页由"循环切换"（克隆页无限轮播）**回退为线性分页**：最后一个列表右滑到头即止，第一个列表左滑到头即止，不再回绕。
- 移除全部循环机制：克隆页渲染、`jumpTo` 瞬移、`scrollend`/180ms 停止检测、`scrollTimerRef`。
- 保留：>1 列表才可横滑、单列表/空列表禁滑、菜单新增列表、空状态 `NO LISTS` + `[+] ADD`、`scrollDrivenRef` 抑制反向滚动（速度一致性）、`initialScrollDone` 首帧定位、标题切列表淡入淡出。
- `src/App.tsx` 659 → 612 行。
- 文档同步：`docs/AI_CONTEXT.md`、`docs/ARCHITECTURE.md` §1/§5.1、`docs/DESIGN_SYSTEM.md` §4/§6、`AGENTS.md`、`docs/DECISIONS.md`（D12 记录回退原因）。

---

## [0.3.1] 2026-08-11 — 已完成项状态按钮置灰

### 变更
- 已完成任务左侧状态按钮（`[●]`）颜色由 `#1A1A1A` 改为 `#8C8C8C`，与完成项文本一致（`transition-colors duration-200`）。
- 涉及：`src/components/TaskItem.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §3。

---

## [0.3.2] 2026-08-11 — 编辑态光标定位到文本末尾

### 变更
- 点击编辑条目内容 / 列表标题时，输入框不再全选文本，光标统一定位到文本末尾（`setSelectionRange(len, len)`），移动端与桌面端一致。
- 涉及：`src/components/TaskItem.tsx`、`src/components/EditableTitle.tsx`。

---

## [0.3.3] 2026-08-11 — favicon 更新为 [●]

### 变更
- 网页 favicon 由 `R` 改为 `[●]`：`#EFEFEF` 灰底 + `#1A1A1A` 黑色字符（与工具内已完成条目 Bracket 样式一致，等宽字体栈，不置灰）。
- 涉及：`public/favicon.svg`（PWA 图标 icon-*.png 未变）。

---

## [0.3.4] 2026-08-11 — PWA 图标同步为 [●]

### 变更
- PWA 图标（`icon-192.png` / `icon-512.png`）由 `R` 改为 `[●]`，与 favicon 视觉一致：`#EFEFEF` 灰底 + `#1A1A1A` 黑色。
- 实现：`generate-icons.py` 重构，`render()` 通用函数画 `"["` + `ellipse(实心圆)` + `"]"`（用 `draw.ellipse` 而非字体字形，跨平台稳定）。
- 涉及：`generate-icons.py`、`public/icon-192.png`、`public/icon-512.png`。

---

## [0.4.0] 2026-08-11 — Web 端响应式多列布局 + 键盘翻页

### 新增
- **Web 宽屏多列**：桌面端（≥768px）每个列表为定宽 `400px` 的列，一屏显示多列（1024→2 列、1440→3 列、1920→4 列…），横向 snap 按列吸附；移动端保持整屏单列 + 滑动。
- **键盘翻页**：`←`/`→` 按屏滚动（每屏 `floor(视口宽/列宽)` 列），输入框/编辑态不拦截；滚动后经 `handleScroll` 同步当前列表。
- 列宽以 `getColWidth`（首个 section `offsetWidth`）动态获取，索引计算/首帧定位/滚动定位统一按列宽。
- 涉及：`src/App.tsx`（612 → 约 640 行）；文档同步 `docs/ARCHITECTURE.md` §5.1、`docs/DESIGN_SYSTEM.md` §4、`docs/AI_CONTEXT.md`。

---

## [0.5.0] 2026-08-11 — 桌面多列自包含面板（ListPanel）+ per-list 数据操作

### 变更
- **桌面多列交互重构**：≥768px 时每个列表为自包含列面板（`ListPanel`）——列头（可编辑标题 + ≡ 列菜单：新增列表 / 清除完成（本列）/ 导出 / 导入）、任务区（内部滚动）、列底（ADD / 长按 actionMode 操作）、双击空白打开本列 ADD。全局浮层（顶部标题、底部 ADD）在桌面隐藏（`md:hidden`），移动端保持现状。
- **useTodos 重构**：唯一写入口由 `updateActiveList` 泛化为 `updateList(listId, updater)`（自动删空列表逻辑保留）；新增 per-list API（`addTaskFor`/`clearCompletedFor`/`toggleCompleteFor`/`reorderTasksFor`/`updateTitleFor` 等），原 activeListId 版 API 保留为包装。
- **utils 抽取**：`downloadJSON`（导出下载）与 `parseRosterImport`（校验 + v1 兼容），App 与 ListPanel 复用。
- 涉及：`src/components/ListPanel.tsx`（新增）、`src/hooks/useTodos.ts`、`src/App.tsx`、`src/utils.ts`。
- 文档同步：`docs/ARCHITECTURE.md` §1/§3.2/§4/§5、`docs/DESIGN_SYSTEM.md` §4、`docs/AI_CONTEXT.md`、`AGENTS.md`。

---

## [0.5.1] 2026-08-11 — 桌面列间距与分割线

### 变更
- 桌面多列：列间增加 **24px 间距 + 1px 细竖线**（`#1A1A1A` 15% 透明度，终端分屏风格，不引入卡片/阴影），列步进 400 → 425px（间距/线内化于列宽，`getColWidth` 仍以 `offsetWidth` 计算，snap/翻页索引不受影响）。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.5.2] 2026-08-11 — 页面与列内左右留白

### 变更
- 桌面端：滚动容器左右各加 32px padding（`md:px-8`），首/末列不再贴边。
- 每个列表列内左右加 16px padding（`ListPanel` 根容器 `px-4`，列头/列底原 4px 归零统一）。
- 滚动定位适配左 padding：新增 `getScrollTarget`（目标 = 左 padding + idx × 列宽），首帧定位 / activeListId 同步 / 键盘翻页三处统一使用；键盘翻页当前索引计算同步减 padding。
- 涉及：`src/App.tsx`、`src/components/ListPanel.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.5.3] 2026-08-11 — 桌面鼠标长按进入操作模式

### 新增
- Web 端（无触屏）长按无响应：为 `TaskItem` 增加**鼠标长按**（mousedown 450ms / mouseup、mouseleave 取消），进入 actionMode（拖拽排序/删除），与触屏路径独立实现；触发后 `justHandledMouseRef` 抑制随后的 click（防误进编辑态/误切换状态）。拖拽开始自动取消鼠标长按定时器。
- 涉及：`src/components/TaskItem.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §6。

---

## [0.5.4] 2026-08-11 — 桌面右键进入操作模式

### 新增
- 桌面端**鼠标右键任务行**直接进入 actionMode（拖拽排序 / 删除），`preventDefault` 禁用系统菜单；编辑态/拖拽中保留系统右键菜单。与 450ms 鼠标长按并存。
- 涉及：`src/components/TaskItem.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §6。

---

## [0.5.5] 2026-08-11 — 列菜单支持删除列表

### 新增
- 桌面列菜单新增「删除列表」：`[×]` 红字 → 两级确认 `[✕] 确认删除` → 删除本列（`deleteListById`）。
- 修复 `deleteListById`：删除最后一个列表后回到初始空状态（`activeListId=''`，NO LISTS + [+] ADD），不再保留空数组。
- 涉及：`src/components/ListPanel.tsx`、`src/hooks/useTodos.ts`、`src/App.tsx`；文档同步 `docs/ARCHITECTURE.md` §4.4、`docs/DESIGN_SYSTEM.md` §5.1。

---

## [0.5.6] 2026-08-11 — 桌面 ADD 按钮对齐任务列表

### 修复
- 桌面列底 `[+] ADD`（及 actionMode 操作栏）补 `pl-8`，与上方任务列表左侧（Bracket 对齐线）对齐。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.5.7] 2026-08-11 — 全局禁用右键系统菜单（沉浸感）

### 变更
- App 根容器 `onContextMenu` 全局拦截：空白区域右击不再弹出浏览器系统菜单（APP 沉浸感）；**编辑输入框除外**（保留复制粘贴）；任务行右击仍进入 actionMode。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §6。

---

## [0.5.8] 2026-08-11 — 删除列表按钮配色与符号调整

### 变更
- 「删除列表」按钮改为**普通色** `#1A1A1A`、符号 `[x]`（与 `[o]`/`[+]` 风格统一）；**二次确认才标红**（`[✕] 确认删除`，`#B3261E`）。
- 涉及：`src/components/ListPanel.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §5.1。

---

## [0.5.9] 2026-08-11 — 桌面列组居中，溢出后左对齐

### 变更
- 桌面多列：列总宽小于视口时**整组居中**（`w-fit min-w-full mx-auto`）；列多到需要横向滚动（总宽 ≥ 视口）时自动**左对齐**（margin auto 溢出归零）。移动端不受影响。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.5.10] 2026-08-11 — 删除列表符号换为 ∅

### 变更
- 「删除列表」符号 `x` → `∅`（空集语义，窄字符不破坏 Bracket 定宽）；确认态仍为 `✕` 标红。
- 涉及：`src/components/ListPanel.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §5.1。

---

## [0.6.0] 2026-08-11 — 数据安全四项加固

### 新增
- **写失败可见**：所有写路径失败时顶部显示 `[!] 保存失败`（此前 fire-and-forget 静默丢失）。
- **库内备份与恢复**：每次写成功后全量数据（RosterExport 格式）写入 `meta['backup']`；启动时主库为空但有非空备份 → 提示「恢复备份 / 忽略」。
- **PWA 安装引导**：移动端且非 standalone 时提示「添加到主屏幕保护数据」（iOS 7 天清除规则豁免），关闭后 localStorage 记住。
- **定期自动导出**：启动时距上次导出 >24h 且列表非空 → 桌面自动下载 JSON 备份（触屏端不自动下载）。
- 涉及：`src/db.ts`（backup 读写）、`src/hooks/useTodos.ts`（saveError/备份/检测/恢复）、`src/App.tsx`（提示 UI / PWA 引导 / 自动导出）。
- 文档同步：`docs/ARCHITECTURE.md` §3.2、`docs/AI_CONTEXT.md`。
- 备注：WebDAV 云同步（跨设备）未实现，需外部服务凭据，另行评估。

---

## [0.6.1] 2026-08-11 — 修复桌面列组居中未生效

### 修复
- 0.5.9 的居中方案（`w-fit min-w-full mx-auto`）未生效：`min-w-full`（min-width:100%）强制容器至少视口宽，`mx-auto` 无居中空间。
- 改为 `w-fit min-w-full md:min-w-0 mx-auto`：桌面 `md:min-w-0` 让容器取内容宽（fit-content），列少时居中、列多时钳制到视口宽左对齐滚动；移动端保留 `min-w-full`（单列全宽依赖）。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.6.2] 2026-08-11 — 第一列左侧加分割线

### 变更
- 桌面列分割线由每列 `border-r` 改为 `border-l`：第一列左侧也有一条线（未填满居中时左右对称），列间仍保持单线（避免相邻列双线叠加）。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.6.3] 2026-08-11 — 末列右侧补分割线

### 变更
- 分割线规则：**首列 `border-l`、末列 `border-r`**（左右边界都有线），中间列 `border-l`（列间保持单线）；单列时两侧都有。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.6.4] 2026-08-11 — 修复末列与倒数第二列间无分割线

### 修复
- 0.6.3 的"末列 border-r"导致末列左缘无线：倒数第二列（border-l）与末列之间缺线。
- 修正：**所有列 `border-l`**（列间单线 + 首列左边界线），末列额外 `border-r`（右边界线）。
- 涉及：`src/App.tsx`；文档同步 `docs/DESIGN_SYSTEM.md` §4。

---

## [0.6.5] 2026-08-11 — 仅剩一个列表时隐藏删除入口

### 变更
- 只剩一个列表（`lists.length === 1`）时，该列表列菜单不再展示「删除列表」项（含确认态），避免删到 0 个列表的边界场景。
- 涉及：`src/components/ListPanel.tsx`（`canDelete` prop）、`src/App.tsx`；文档同步 `docs/ARCHITECTURE.md` §4.4。

---

## [0.6.6] 2026-08-11 — 列头菜单与标题留白对称

### 修复
- 桌面列头菜单按钮（≡）右侧视觉留白偏大：Bracket 3.5ch 定宽使 `≡` 右缘到按钮右缘多出约 1.25ch 空白。
- 菜单按钮加 `margin-right: -1.25ch` 抵消，使 `≡` 视觉右缘与标题左缘留白对称。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.6.7] 2026-08-11 — 列头菜单留白补偿加大

### 修复
- 0.6.6 的 `-1.25ch` 补偿不足（宽视口多列对比仍显右侧大）：`≡` 常走系统字体回退，尾部空白大于理论值。
- 补偿加大为 `-1.5ch`。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.6.8] 2026-08-11 — 列头菜单留白精调 + 下拉面板对齐

### 修复
- 菜单留白补偿精调为 `calc(-1.5ch - 5px)`（实测仍偏大约 5px）。
- 负 margin 从按钮移到菜单容器：此前按钮右移但下拉面板对齐未移动的容器导致错位，现按钮与面板一起右移、右缘对齐。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.6.9] 2026-08-11 — 列头菜单改为直接渲染 [≡]（对齐彻底修复）

### 修复
- 此前负 margin 补偿在 flex 布局中未产生右移（留白无效），且面板对齐 Bracket 的 `]` 右缘而非 `≡`。
- 菜单按钮不再用 `Bracket`（3.5ch 定宽使 ≡ 偏左），直接渲染 `[≡]` 文本：按钮右缘即 `≡` 右缘，与标题左缘留白精确对称，下拉面板 `right-0` 自然对齐 icon 右侧，零估算。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.7.0] 2026-08-11 — 列头 ≡ 留白与下拉菜单对齐（确定性方案）

### 修复
- 0.6.9 直接渲染 `[≡]` 文本失败：`≡` 在系统中文字体为全角，按钮被撑宽、右侧留白更大。
- 回到 `Bracket`（overflow 裁切保证结构稳定），并用确定性偏移：
  - 容器 `right: -1ch` 右移（Bracket 中 `]` 占 1ch）→ `≡` 右缘距列右缘 = 16px = 标题左缘，留白对称；
  - 面板 `right: calc(1ch - 16px)` → 菜单项右缘（扣右 padding）与 `≡` 右缘精确对齐。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.7.1] 2026-08-11 — 列头对齐基准改为右括号 ] 右缘

### 修复
- 用户基准澄清：菜单项应与 **`]` 右缘**（按钮整体右缘）对齐，而非 `≡` 字符右缘。
- 确定性方案（无偏移）：按钮右缘（`]` 右缘）距列右缘 = 16px，与标题左缘对称；面板 `right-0` + 右 padding 归零 → 菜单项右缘 = 面板右缘 = `]` 右缘。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.7.2] 2026-08-11 — [≡] 与右侧分割线间距对称

### 修复
- 多列表视图下 `[≡]` 右缘距右侧分割线 = 40px（列内右 padding 16 + 列间 pr-6 24），标题左缘距左分割线仅 16px，不对称。
- 菜单容器 `transform: translateX(24px)` 右移（= pr-6 列间间距）：`[≡]` 右缘距右分割线 = 16px 与标题对称；transform 不改变布局槽位（不与标题重叠），并成为下拉面板定位基准，菜单项与 ≡ 相对关系不变（菜单现状保持）。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.7.3] 2026-08-11 — PWA 引导条与标题垂直居中

### 变更
- PWA 安装引导条由标题下方（+72px）上移至与顶部标题行垂直居中对齐（+18px，引导条中心 = 标题中心）。
- 涉及：`src/App.tsx`。

---

## [0.7.4] 2026-08-11 — PWA 引导条文案调整

### 变更
- 引导条文案「添加到主屏幕保护数据」→「添加为 PWA 以保护数据」。
- 涉及：`src/App.tsx`。

---

## [0.7.5] 2026-08-11 — 保存失败提示位置与 PWA 引导条对齐

### 变更
- 「[!] 保存失败」提示从顶部 `+8px` 移至 `+18px`（与 PWA 引导条同位置，垂直居中标题行）；saveError 显示时 PWA 引导条让位（避免重叠）。
- 涉及：`src/App.tsx`。

---

## [0.7.6] 2026-08-11 — 保存失败提示改为红底白字

### 变更
- 「[!] 保存失败」提示由红字灰底改为**红底白字**（`#B3261E` 底 + 白字，`px-4 py-2`），样式与 PWA 引导条（黑底白字）统一，位置 `+18px` 垂直居中标题行。
- 涉及：`src/App.tsx`。
- 注：曾临时注入写失败模拟验证红条效果（`useTodos.ts` reportSave），已还原为正常逻辑。

---

## [0.8.0] 2026-08-11 — 暗色模式 + 设计 Token 化

### 新增
- **暗色模式**：菜单（移动端全局菜单 + 桌面列菜单）新增「◐ 暗色模式/亮色模式」切换；持久化 `localStorage['roster-theme']`，未设置时跟随系统 `prefers-color-scheme`；`main.tsx` 渲染前设 `data-theme` 防首帧闪烁；同步 `theme-color` meta。
- **设计 Token 化**（解决长期技术债 D6）：4 色抽入 `@theme`（`--color-bg/ink/mute/danger`），`html[data-theme='dark']` 覆盖为暗色值；全量替换约 70 处硬编码色（`text-[#...]` → `text-ink` 等），渐变改用 `var(--color-bg)` + `color-mix`。
- 暗色值：bg `#1A1A1A` / ink `#EFEFEF` / mute `#9C9C9C` / danger `#E05B50`。
- 涉及：`src/index.css`、`src/main.tsx`、`src/App.tsx`、`src/components/{ListPanel,TaskItem,AddTask,EditableTitle}.tsx`。
- 文档同步：`docs/DESIGN_SYSTEM.md` §2、`docs/DECISIONS.md`（D13）、`AGENTS.md`、`docs/AI_CONTEXT.md`。

---

## [0.8.1] 2026-08-11 — 主题按钮点击穿透修复

### 修复
- 菜单主题切换按钮点击后不再关闭菜单：此前点击即 `setMenuOpen(false)`，连点/双击时第二次点击穿透到菜单原覆盖的第一条任务，误触编辑；主题切换无副作用、可连续切换，菜单保持浮层。
- 涉及：`src/App.tsx`、`src/components/ListPanel.tsx`。

---

## [0.8.2] 2026-08-11 — 桌面列面板任务区顶部 108px 让位

### 变更
- 桌面列面板任务区顶部加 `padding-top: 108px`（与移动端布局一致，标题与第一条任务拉开间距）。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.8.3] 2026-08-11 — 桌面任务让位精确为 108px

### 变更
- 任务区 padding-top 由 108px 改为 `calc(108px - 16px)`：标题到底部任务的总间距恰好 108px（扣除列头底部 16px 内边距）。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.8.4] 2026-08-11 — 桌面列头固定 108px 高（任务起始与移动端一致）

### 修复
- 0.8.2/0.8.3 在列头下方额外加 padding 导致任务起始过深；改为**列头固定高 108px**（标题在顶部、下方留白），任务区紧随 → 任务内容从列顶 108px 开始，标题到任务间距与单列（移动端）一致。
- 涉及：`src/components/ListPanel.tsx`。

---

## [0.8.5] 2026-08-11 — 技术债清理批次

### 工程化
- `package.json` version `0.0.0` → `0.8.4`。
- **oxlint 修复**：`oxlint@latest`（1.78）重装后原生绑定就绪，`npm run lint` 恢复可用（0 errors）。
- **README 重写**：Vite 模板 → 面向用户的 ROSTER 项目介绍（特性/使用/数据隐私/技术栈）。
- **git 落地**：仓库已初始化（main，含 0.1.0 部署配置提交），本批次变更已提交。
- **Vitest 测试**（D10 落地）：安装 vitest，导出 `sortTasks`/`normalizeTask`，覆盖纯函数（排序分组/order 重写、布尔收紧、导入解析 v2/v1/非法），`npm test` 8 用例全绿。

### 修复
- **v1 导入死代码**：`parseRosterImport` 的 v1 分支被 `app !== 'ROSTER'` 前置拦截（v1 数据无 app 字段），实际从未生效；改为先识别 v1 再校验 v2，v1 旧格式导入恢复可用（测试覆盖）。
- **`deleteListById` 备份竞态**：备份数据改由 updater 内构造（与 updateList 一致），移除 `nextListsRef` 时序依赖。
- **移动端菜单加「删除列表」**：`[∅]` 黑字 + `[✕] 确认删除` 红字，`lists.length > 1` 时显示，作用于当前列表（与桌面列菜单对齐）。

### 备注
- `updateList` 在 setState updater 内调副作用（saveList 等）为既有设计（StrictMode 双执行幂等），保留不改（重构风险高）。
- WebDAV 跨设备同步未做（需外部服务凭据）；Cloudflare Pages 部署待执行（需 wrangler 认证）。
- 文档同步：`docs/DEVELOPMENT.md` §5、`docs/AI_CONTEXT.md`。

---

## 当前版本

- `package.json` version：`0.8.8`。
- IndexedDB `roster-db` 版本：`2`。
- 导出格式 `RosterExport.version`：`2`。
- 项目状态检查日期：2026-08-11。

---

## [0.1.0] 2026-08-11 — 部署工程化：Cloudflare Pages 支持

### 新增
- `public/_redirects`：`/* /index.html 200` SPA 回退，防止深链/刷新 404。
- `wrangler.toml`：Pages 项目配置（`pages_build_output_dir = "./dist"`），兼容 CLI 手动部署。

### 变更
- `docs/DEVELOPMENT.md` §11 记录部署流程与自定义域名配置。

---

## v2（当前）

**结构推断时间范围**：2026-08（文件时间戳集中于 08-11）。

### 新增
- **多列表**：`lists` store（keyPath `id`），任务从独立 store 改为内嵌 `TodoList.tasks`。
- **活动列表**：`meta['active-list-id']`，重启恢复上次查看的列表。
- **横向分页 UI**：snap-scroll 多列表切换，末尾固定"新增列表"页。
- **JSON 导入导出**：`RosterExport`（`app: 'ROSTER'` 校验、`version: 2`）；导出文件命名 `ROSTER-YYYYMMDD-HHMMSS.json`。
- **拖拽排序**：dnd-kit，长按 450ms 进入 actionMode 后出现拖拽手柄。
- **PWA**：vite-plugin-pwa，standalone + portrait + 图标 192/512 + maskable；SW 预缓存与字体运行时缓存。
- **动画**：framer-motion 列表 layout / 进出场 / 菜单与底部栏切换。
- **交互强化**：单击状态按钮=进行中，双击=完成；破坏性操作两级确认；双击空白新增任务/列表。
- **标题可编辑**：EditableTitle（点击进入编辑、回车/失焦保存）。

### 变更
- 迁移旧版单列表数据到新结构（db.ts upgrade）。
- 导入兼容 v1 格式（`{ title, tasks }` 包装为单列表）。

---

## v1（历史）

**结构推断**（无确切日期）。

- 单列表待办。
- IndexedDB：独立 `tasks` store + `meta['list-title']`。
- 无多列表、无导入导出、无拖拽排序。
- 遗留痕迹：db.ts:34-61 的迁移分支、App.tsx:176-185 的 v1 导入兼容分支。

---

## 工程化痕迹（非功能版本，2026-08-11 已大部修复）

- ~~README.md 仍为 Vite 官方模板原文（未更新）。~~ → 已于 0.8.5 重写为项目介绍。
- `generate-icons.py`：用 Pillow 生成 `public/icon-{192,512}.png`（运行于 macOS 字体路径）。
- ~~`.oxlintrc.json`：本机 binding 缺失导致 lint 无法运行。~~ → 已于 0.8.5 修复（oxlint@latest 重装，lint 0 errors）。
- 代码中的 `// eslint-disable-next-line react-hooks/exhaustive-deps` 为历史注释，对 oxlint 无效（保留，无实际作用）。

---

## 变更记录约定（给未来的 AI Agent）

1. 每次修改后，在本文件**顶部**新增条目：
   ```
   ## [vX.Y] YYYY-MM-DD — 一句话摘要
   新增/变更/修复：
   - ...
   ```
2. 版本号从 `0.1.0` 起自定（当前 `0.8.7`）。
3. 若改动涉及数据 schema：**必须**同时更新 `db.ts` 的 `DB_VERSION` 与本文档，并在 DECISIONS.md 记录。
4. 若项目某日接入 git，将本文件条目与 commit 关联，并删除"结构推断"标注。
