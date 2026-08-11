# DEVELOPMENT.md — 开发、构建与验证指南

> 给 AI Agent 的"怎么跑、怎么验证、环境有哪些坑"。

## 1. 环境要求

- Node.js ≥ 20（实测 v22.11.0）。
- macOS（当前开发机 darwin；`generate-icons.py` 依赖 macOS 字体路径）。
- 包管理器 npm。

## 2. 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 启动 Vite dev server（默认 5173）
npm run build          # tsc -b && vite build → 输出 dist/
npm run preview        # 预览 dist 生产构建
npm run lint           # oxlint
npx tsc -b             # 仅类型检查（build 前置步骤）
```

## 3. 构建管道

```
npm run build
  ├── tsc -b            # 类型检查（tsconfig.json 引用 app + node 两个项目）
  └── vite build        # 打包 + Tailwind 编译 + PWA 生成
        ├── dist/index.html + assets/*.js|css
        ├── dist/sw.js + workbox-*.js    （Service Worker）
        └── dist/manifest.webmanifest    （PWA manifest）
```

PWA 的 `virtual:pwa-register` 模块在**非 PROD 下不存在**——`main.tsx` 已用 `import.meta.env.PROD` 守卫，不要在 dev 下手写导入。

## 4. TypeScript 配置要点

- `tsconfig.app.json`：`target es2023`、`moduleResolution bundler`、`verbatimModuleSyntax`（**import 类型必须用 `import type`**，否则编译报错）、`noUnusedLocals/Parameters`（未使用变量/参数会报错）、`allowImportingTsExtensions`（`./App.tsx` 这种带扩展名导入是允许的）、无 `strict` 显式但继承默认（`strict` 默认 false 在此项目——注意这是模板默认，新增类型断言需自行负责）。
- `tsconfig.node.json`：仅包含 `vite.config.ts`。
- 类型检查输出写到 `node_modules/.tmp/`（gitignore 已覆盖）。

## 5. Lint（当前环境有坑）

`npm run lint` 在本机**无法运行**：
```
Error: Cannot find module '@oxlint/binding-darwin-universal'
```
原因：oxlint 1.75 的原生绑定未随 npm install 拉取（平台匹配问题），属**环境/依赖问题，非代码问题**。
- 解决方案：`npm install -D @oxlint/binding-darwin-universal` 或升级 oxlint，或换 `npx oxlint@latest`。
- 若安装成功，规则来自 `.oxlintrc.json`：react/typescript/oxc 插件 + `react/rules-of-hooks: error` + `react/only-export-components: warn`。
- 代码里残留的 `// eslint-disable-next-line react-hooks/exhaustive-deps`（App.tsx:87,107）是历史写法，oxlint 不认识该注释，无实际作用，不要依赖它。

## 6. PWA 细节

配置在 `vite.config.ts`：
- `registerType: 'autoUpdate'`：新版本自动激活 SW，无用户提示。
- manifest：standalone、portrait、`#F2F2F2` 主题色，图标 192/512 + maskable。
- workbox：预缓存 `**/*.{js,css,html,ico,png,svg}`；Google Fonts（`fonts.googleapis.com` / `fonts.gstatic.com`）CacheFirst，缓存名 `google-fonts-cache` / `gstatic-fonts-cache`，**1 年过期**。
- ⚠️ 改了字体相关配置（新增字体 URL 或 font-family）后，`dist` 里的旧字体缓存不会自动失效，测试时注意 `Cache-First` 会命旧。

**验证 PWA**：
- `npm run build && npm run preview`，打开 DevTools → Application → Service Workers / Cache Storage。
- SW 注册日志输出在 `main.tsx` 的 `console.log('SW Registered')`（仅 PROD）。

## 7. 验证清单（改完代码后）

1. `npx tsc -b` 零错误。
2. `npm run build` 成功产出 dist。
3. 功能回归（按改动范围取子集）：
   - **任务 CRUD**：添加/编辑/删除/清除已完成。
   - **三态**：单击→进行中（○）、双击→完成（●）、再点→取消。
   - **长按**：450ms 进入 actionMode，出现拖拽柄与底部操作栏，可删除/拖拽排序。
   - **分页**：横向滑动切换列表，标题/底部栏跟随，末尾新增列表页。
   - **菜单**：清除/导出/导入（含 v1 旧格式导入）两级确认；点外部关闭。
   - **数据持久化**：刷新页面数据仍在；IndexedDB（DevTools → Application）里 `roster-db` 的 lists/meta 正确。
   - **PWA（PROD）**：SW 注册、离线可打开。

## 8. 数据格式速查（导入导出手工构造用）

```json
{
  "app": "ROSTER",
  "version": 2,
  "exportedAt": 1760000000000,
  "activeListId": "<uuid>",
  "lists": [
    { "id": "<uuid>", "title": "ROSTER", "tasks": [
      { "id": "<uuid>", "content": "task", "completed": false,
        "inProgress": false, "order": 0,
        "createdAt": 0, "updatedAt": 0 }
    ]}
  ]
}
```
导入校验：`app === 'ROSTER'` 且 `Array.isArray(lists)`；或旧版 `Array.isArray(tasks) && typeof title === 'string'`。其他一律"无效文件"。

## 9. 调试技巧

- 布局/手势问题优先在**移动模拟**（DevTools 设备模式）或真机测——桌面端触控事件行为不同。
- 分页错乱时先看 `currentIndex` 与 `activeListId` 是否一致（App.tsx 双同步逻辑）。
- 动画抖动优先怀疑 `suppressLayout`（App.tsx:110-117）被改或 `layout` 与 dnd-kit transform 冲突。
- 数据丢失怀疑：`updateActiveList` 的 `saveList` 未 catch（IndexedDB 配额/隐私模式）。
- 图标再生成：`python3 generate-icons.py`（需 Pillow；首次 `pip install pillow`）。

## 10. 变更边界

- 新增依赖前确认必要（项目依赖极少：react、idb、dnd-kit、framer-motion、tailwind、pwa）。
- 不要引入测试框架前先问是否值得——项目当前零测试。
- 修改 `db.ts` 的 schema 必须**递增 DB_VERSION** 并写 upgrade 迁移分支，否则老用户数据直接丢失。
