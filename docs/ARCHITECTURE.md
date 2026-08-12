# ARCHITECTURE.md — 项目架构分析

## 1. 总体架构

单页面应用，无路由。所有状态集中在 `useTodos` hook，页面交互编排全部在 `App.tsx`。

```
┌──────────────────────────────────────────────────────┐
│  main.tsx  →  createRoot(<StrictMode><App/>)          │
│            →  仅 PROD 注册 PWA ServiceWorker          │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  App.tsx（唯一页面，交互编排层）                        │
│  • 横向线性 snap-scroll 分页（首尾不可回绕）             │
│  • 响应式双布局：移动端全局浮层 / 桌面多列 ListPanel      │
│  • 菜单/确认/actionMode/suppressLayout 等 UI 状态        │
│  • 双指同步 currentIndex ↔ activeListId                  │
└─────────────────────────┬────────────────────────────┘
                          │ props + 回调
                          ▼
┌──────────────────────────────────────────────────────┐
│  useTodos（hooks/useTodos.ts，全局状态 + 数据操作）    │
│  • lists / activeListId / loaded                      │
│  • 全部 CRUD 经 updateList(listId)（乐观更新+落库）    │
│  • per-list API（桌面多列）与 activeListId 包装 API    │
└─────────────────────────┬────────────────────────────┘
                          │ saveList / getAllLists / ...
                          ▼
┌──────────────────────────────────────────────────────┐
│  db.ts（idb 封装，IndexedDB 'roster-db' v2）          │
│  • lists store（keyPath: id）                         │
│  • meta store（key: 'active-list-id'）                │
│  • 含 v1→v2 迁移                                      │
└──────────────────────────────────────────────────────┘
```

## 2. 分层职责

| 层 | 文件 | 职责 | 禁止做的事 |
|---|---|---|---|
| 入口 | main.tsx | React 挂载、SW 注册 | 不放业务逻辑 |
| 编排 | App.tsx | 页面交互、菜单、分页同步、手势入口 | 不直接读写 DB；不与 IndexedDB 耦合 |
| 状态 | useTodos.ts | 数据源、CRUD、排序、导入导出 | 不碰 DOM；不引入其他 UI 库 |
| 存储 | db.ts | IndexedDB 增删改查 + 迁移 | 不写 UI 逻辑 |
| 视图 | components/* | 渲染 + 局部交互 | 直接改全局数据（必须经回调） |

## 3. 数据流

### 3.1 初始化（StrictMode 双跑防护）
useTodos.ts:38-56：`initialized` ref 保证只执行一次。`Promise.all([getAllLists(), getActiveListId()])` 加载后：
- 归一化所有 task（`normalizeTask`，把旧数据的 `true===` 收紧为布尔）
- 校验 `active-list-id` 是否存在于 lists，失效则回退到第一张列表并落库
- 置 `loaded=true`，在此之前 App.tsx 渲染加载态（`...`）

### 3.2 写路径（唯一的写入口）
```
updateList(listId, updater)  // useTodos.ts:62
  → setLists(prev => { ...不可变更新...; saveList(updated) })
```
特点：
- **乐观更新**：React state 先变，UI 立即响应。
- **写失败可见**（v0.6.0 起）：所有写路径（saveList/saveAllLists/saveActiveListId/deleteList）失败时 `reportSave(false)` → `saveError` 置位，App 顶部显示 `[!] 保存失败`；成功复位。
- **库内备份**（v0.6.0 起）：每次写成功后 `persistBackup` 把全量数据（RosterExport 格式）写入 `meta['backup']`；启动时若主库为空但有非空备份 → `dataLossDetected`，App 询问「恢复备份 / 忽略」（`restoreFromBackup` 走 `replaceData`）。备份写失败静默，不影响主数据。
- **两套 API**：`addTaskFor/clearCompletedFor/...`（per-list，桌面多列按列调用）与 `addTask/clearCompleted/...`（activeListId 包装，移动端全局浮层）。
- **自动删除空列表**（v0.2.6 起）：列表由"有任务"变为"无任务"（清除完成 / 删除任务删光）时，`updateList` 直接移除该列表（`deleteList` 落库）：若删的是当前列表，删光后 `activeListId=''` 回到初始空状态（NO LISTS + [+] ADD），否则回退到第一个列表。新建的空列表（`addList`）不经此路径，不受影响。

### 3.3 读路径
`activeList = lists.find(l => l.id === activeListId)`。App.tsx 通过 `currentIndex` 定位当前展示的列表，两者通过 scroll 事件与 effect 双向同步（见 §5）。

## 4. 核心模块说明

### 4.1 useTodos（hooks/useTodos.ts，462 行）
全部数据操作：
- `updateList(listId, updater)`：**唯一写入口**（v0.5.0 起，原 `updateActiveList` 已并入），含自动删除空列表逻辑。
- 两套 API：`addTaskFor/updateTaskContentFor/toggleCompleteFor/toggleInProgressFor/removeTaskFor/clearCompletedFor/reorderTasksFor/updateTitleFor`（per-list，桌面多列按列调用）；`addTask/updateTaskContent/...`（activeListId 包装，移动端全局浮层）。
- `addTask`：插入头部 → `sortTasks` 重排（新任务因 order=0 会自动排进"待办"段首）
- `updateTaskContent` / `updateTitle`：不可变更新 + `updatedAt`
- `toggleComplete`：完成⇄取消，完成时记 `completedAt`，同时清 `inProgress` → `sortTasks`
- `toggleInProgress`：仅非完成项可切换 → `sortTasks`
- `removeTask` / `clearCompleted`：过滤（若导致列表清空，由 `updateList` 自动删除该列表）
- `reorderTasks`：dnd-kit 拖拽后重排 + 重写 `order` 字段
- `exportData`：生成 `RosterExport` v2
- `replaceData`：导入覆盖（先校验 activeListId 有效性）
- `switchList` / `addList` / `deleteListById`：列表级操作（`deleteListById` 目前无 UI 入口）

**关键点**：`sortTasks` 就地修改 `t.order`（把引用传出的数组元素改了）。这是因为 dnd-kit 依赖 `id` 而非 `order`，`order` 字段实为冗余——实际排序语义靠**数组顺序**承载。改排序逻辑时以数组顺序为准。

### 4.2 db.ts（98 行）
- `getDB()` 单例缓存 promise，首次调用执行 upgrade。
- upgrade 逻辑：建 store → 若 `oldVersion < 2` 且存在旧 `tasks` store → 读出旧任务+旧标题 → 包成默认列表写入 `lists` → 删旧 store（见 §8 历史痕迹）。
- 注意 `DB_VERSION = 2`，**不允许降级**；新增 schema 改动必须递增版本并写迁移分支。

### 4.3 TaskItem（最复杂组件，289 行）
职责：一行任务的渲染 + 全部手势：
- 文本单击 → 编辑态（input 自动 focus + select + scrollIntoView）
- `[o]` 按钮单击/双击 → 进行中/完成（300ms 防抖区分）
- 触屏长按 450ms → 进入 actionMode（回调父组件 `onLongPress`）
- actionMode 下右侧浮现拖拽手柄（渐变遮罩），拖拽排序
- 编辑中回车保存 / Esc 取消 / 失焦保存

### 4.4 ListPanel（桌面多列列面板）
职责：≥768px 时每个列表列的**自包含面板**（App.tsx 在列 section 内 `hidden md:block` 渲染；移动端 `md:hidden` 仍用全局浮层 + 裸任务）：
- 列头：可编辑标题（`EditableTitle`）+ ≡ 列菜单（新增列表 / 清除完成（本列）/ 删除列表（仅 `lists.length > 1` 时显示，两级确认）/ 导出数据 / 导入数据，两级确认）。
- 任务区：`DndContext` + `TaskList`（或 NO LISTS 占位），内部滚动；拖拽/删除/添加均走 **per-list API**（`onDragEnd`/`onClearCompleted` 等由 App 闭包绑定 `list.id`）。
- 列底：actionMode（本列任务被长按时显示"删除此条 / 保存排序"）或 `AddTask`；双击空白打开本列 ADD。
- 菜单状态（menuOpen/confirmAction/importError）为**列内局部 state**，多列互不干扰。

### 4.5 App.tsx 关键状态
| state | 作用 |
|---|---|
| `actionModeId` | 当前长按选中的任务（高亮 + 显示拖拽柄） |
| `suppressLayout` | 拖拽结束后一帧内关闭 framer layout 动画 |
| `menuOpen` | 右上角菜单（移动端浮层；桌面列菜单在 ListPanel 内） |
| `confirmAction` | 'clear' \| 'export' \| 'import' \| null（两级确认） |
| `importError` | 无效文件标记 |
| `currentIndex` | 当前分页索引（与 activeListId 同步） |

## 5. 页面逻辑

### 5.1 横向线性分页与双同步（v0.3.0 起，v0.2.0-0.2.9 曾为克隆页循环分页，已回退）
- 外层 `scrollerRef`：`overflow-x-auto snap-x snap-mandatory`，隐藏滚动条；**仅 `lists.length > 1` 时**启用横向滚动与 snap（`touch-action: pan-x pan-y`），单列表/无列表时为 `overflow-x-hidden` + `pan-y`（禁滑）。首尾页不可回绕（线性）。
- **响应式列宽**：移动端每列 `w-full`（整屏单列）；桌面端（≥768px）每列 `md:w-[400px]` 定宽，宽屏一屏多列。**列宽以 `getColWidth`（首个 section 的 `offsetWidth`）动态获取**，索引计算、首帧定位、滚动定位均按列宽而非视口宽。
- **键盘翻页**（Web 端）：`←`/`→` 按屏滚动（每屏 `floor(clientWidth / 列宽)` 列），输入框/编辑态不拦截；滚动后经 `handleScroll` 同步 `currentIndex`/`activeListId`。
- **滚动 → state**：`handleScroll` 用 `Math.round(scrollLeft / 列宽)` 算索引，变化则更新 `currentIndex` 并 `switchList(id)`；该变化标记 `scrollDrivenRef`，使同步 effect **跳过反向 scrollTo**（位置已由原生滚动就位，再滚动会打断吸附动画、造成各页速度不一致）。`activeIndexRef` 做变化检测，避免每次滚动都 setState。
- **state → 滚动**：effect 监听 `activeListId` 变化，`scrollTo({ left: idx × 列宽, behavior: 'smooth' })` 滚到对应列。**首帧用 `initialScrollDone` ref 做 auto 定位**，避免首帧位置错乱。
- 两个方向都会 `setActionModeId(null)` 复位操作模式。

### 5.2 交互入口（响应式双布局）
- **移动端（<768px）**：全局浮层——双击空白（避开 button/input/[data-task]/header）→ 无列表时 `addList()`，否则打开底部添加框；底部栏 actionMode 时"删除此条 / 保存排序"，无列表时 `[+] ADD`，否则 AddTask；右上角 ≡ 菜单作用于当前列表。
- **桌面端（≥768px）**：每列 `ListPanel` 自包含——列菜单（新增列表/清除完成/导出/导入）、列底 ADD、双击空白打开本列 ADD、长按本列任务出 actionMode 操作；无全局浮层（header/bottom bar `md:hidden`）。
- 空列表状态：**当前列表无任务**（含无任何列表）时显示 `NO LISTS` 占位；无任何列表时移动端由全局底部浮层显示 `[+] ADD`，桌面端进入 `ListPanel` 占位列（与正常空 list 列同构：ROSTER 标题 + `[≡]` 菜单 + `NO LISTS` + 底部 `[+] ADD`，由虚拟 `PLACEHOLDER_LIST` 渲染；placeholder 的所有写操作禁用，底部 ADD 触发 `handleAddList` 新增真实列表）。

## 6. 动画实现（三层叠加）

| 层 | 技术 | 位置 |
|---|---|---|
| 列表重排/进出场 | framer-motion `layout` + AnimatePresence | TaskItem.tsx:150-157、TaskList.tsx |
| 菜单/底部栏 | AnimatePresence `mode="wait"`，opacity+y 位移动画 0.15s | App.tsx |
| 完成/进行中标记 | motion.span scale 弹入（0.4→1） | TaskItem.tsx:183-200 |
| 拖拽 | dnd-kit transform（CSS.Transform.toString） | TaskItem.tsx:59-62 |
| 横向翻页 | CSS scroll-snap（无 JS 动画） | App.tsx 外层容器 |

**冲突点**：framer-motion `layout` 和 dnd-kit 都操纵 transform。拖拽过程中列表重排会产生双重位移，因此 `TaskItem` 的 `layout={!suppressLayout}`，拖拽结束由 App.tsx 用 `requestAnimationFrame` 关一帧。

## 7. 状态与持久化同步矩阵

| 操作 | state 更新 | 持久化 |
|---|---|---|
| 切换/新增列表 | `switchList`/`addList` | `saveActiveListId` / `saveList` |
| 任务增删改 | `updateActiveList` | `saveList(list)` 整表覆盖 |
| 导入 | `replaceData` | `saveAllLists` + `saveActiveListId`（事务） |
| 删除列表 | `deleteListById` | `deleteList` |

## 8. 历史痕迹（版本演进证据）

无 git 历史，以下由代码推断：

### v1（旧）
- 单列表。
- IndexedDB：独立 `tasks` store + `meta['list-title']`。
- 导入格式：`{ title, tasks, exportedAt }`。

### v2（当前）
- 多列表：`lists` store，任务内嵌于 list.tasks。
- `meta['active-list-id']`。
- 导出格式：`RosterExport`（含 `app: 'ROSTER'` 校验标记、`version: 2`）。

### 迁移与兼容
- **DB 迁移**：db.ts:34-61 的 upgrade 分支，读旧 store → 包成默认列表 → 删旧 store。用 `as unknown as` 强转，无类型保障。
- **导入兼容**：App.tsx:173-185 识别 v1 格式（`data.tasks` 数组 + `data.title` 字符串）并包装成 v2。
- `generate-icons.py`：Pillow 脚本，生成 public 下的图标（非业务代码）。
- `design/reference.jpg`：133KB 设计参照稿（当前模型无法读取图片内容）。

## 9. 已知约束与雷区汇总

1. 排序语义在**数组顺序**，不在 `order` 字段（order 每次 sortTasks 重算）。
2. 写入不 await 不 catch —— 引入错误处理时不要破坏乐观更新体验。
3. 手势时序相互耦合（300/450/150ms + tolerance 12px），改动需整体回归。
4. 不支持降级 DB；DB_VERSION 只能增。
5. App.tsx 是最容易膨胀的文件，新增 UI 状态优先考虑收敛进组件或抽 hook。
