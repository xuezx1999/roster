# CHANGELOG.md — 版本演进记录

> 项目**无 git 仓库**，本文件内容由代码痕迹（IndexedDB schema、类型、注释、兼容分支）**推断重建**，非官方发布记录。
> 格式：`[v版本] 日期 — 摘要`。未标注日期处标记为"结构推断"。
> 未来每次变更请在本文件顶部追加条目（这是对 AI 维护者最重要的文档之一）。

---

## 当前版本

- `package.json` version：`0.0.0`（未随功能更新，可忽略）。
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

## 工程化痕迹（非功能版本）

- README.md 仍为 Vite 官方模板原文（未更新）。
- `generate-icons.py`：用 Pillow 生成 `public/icon-{192,512}.png`（运行于 macOS 字体路径）。
- `.oxlintrc.json`：react/typescript/oxc 规则，但本机 `@oxlint/binding-darwin-universal` 缺失导致 lint 无法运行（环境问题，详见 DEVELOPMENT.md §5）。
- 代码中的 `// eslint-disable-next-line react-hooks/exhaustive-deps` 为历史注释，对 oxlint 无效。

---

## 变更记录约定（给未来的 AI Agent）

1. 每次修改后，在本文件**顶部**新增条目：
   ```
   ## [vX.Y] YYYY-MM-DD — 一句话摘要
   新增/变更/修复：
   - ...
   ```
2. 版本号从 `0.1.0` 起自定（当前 `0.0.0` 无参考意义）。
3. 若改动涉及数据 schema：**必须**同时更新 `db.ts` 的 `DB_VERSION` 与本文档，并在 DECISIONS.md 记录。
4. 若项目某日接入 git，将本文件条目与 commit 关联，并删除"结构推断"标注。
