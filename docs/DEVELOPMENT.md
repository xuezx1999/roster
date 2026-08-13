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

## 5. Lint（已修复，2026-08-11）

`npm run lint`（oxlint）可正常运行（`oxlint@latest` 重装后原生绑定就绪）：`Found 0 warnings and 0 errors`。
- 规则来自 `.oxlintrc.json`：react/typescript/oxc 插件 + `react/rules-of-hooks: error` + `react/only-export-components: warn`。
- 历史遗留：`// eslint-disable-next-line react-hooks/exhaustive-deps`（App.tsx）是旧写法，oxlint 不认识，无实际作用，不要依赖它。

## 6. PWA 细节

配置在 `vite.config.ts`：
- `registerType: 'prompt'`：新 SW 就绪后不自动激活，App 显示「新版本可用」提示，用户点击后 `skipWaiting + reload`（提示 UI 在 `App.tsx`，状态在 `hooks/usePwaUpdate.ts`）。
- **主动更新检查（0.9.7 起）**：SW 更新检查默认只在页面加载时发生——浏览器每次打开都是全新加载所以能及时提示，但已安装 PWA 从主屏/App Switcher 恢复时页面不重新加载，永远不检查更新。`usePwaUpdate.ts` 挂三路主动检查：`visibilitychange`（切回前台）、`window focus`、60 分钟定时器，任一命中调用 `registration.update()`，发现新 SW 即触发既有提示。改动此类逻辑后务必在真机 PWA 复测（浏览器打开无法覆盖该场景）。
- manifest：standalone、portrait、`#EFEFEF` 主题色，图标 192/512 + maskable。
- workbox：预缓存 `**/*.{js,css,html,ico,png,svg,woff2}`。
- 字体：**自托管**（`public/fonts/ibm-plex-mono-{400,500}.woff2`，latin 子集 ~10KB/字重），`index.css` `@font-face` + `font-display: swap`。无外部 CDN 运行时缓存（v0.8.8 起；此前 Google Fonts CacheFirst 1 年已移除，解决了改字体旧缓存命中问题）。若换字体，直接替换 `public/fonts/` 下的 woff2 并保持文件名即可（预缓存 hash 会自动更新）。

**验证 PWA**：
- `npm run build && npm run preview`，打开 DevTools → Application → Service Workers / Cache Storage。
- SW 注册日志输出在 `main.tsx` 的 `console.log('SW Registered')`（仅 PROD）。

## 7. 验证清单（改完代码后）

1. `npx tsc -b` 零错误。
2. `npm run build` 成功产出 dist。
3. 功能回归（按改动范围取子集）：
   - **任务 CRUD**：添加/编辑/删除/清除完成（仅当前列表）。
   - **三态**：单击→进行中（○）、双击→完成（●）、再点→取消。
   - **长按**：450ms 进入 actionMode，出现拖拽柄与底部操作栏，可删除/拖拽排序。
   - **分页**：>1 列表横向滑动线性切换（首尾不可回绕），标题/底部栏跟随；单列表不产生横向滑动；空列表显示 `NO TASKS` + 底部 `[+] ADD`。
   - **菜单**：清除/导出/导入（含 v1 旧格式导入）两级确认；点外部关闭；「从备份恢复」（有备份时显示，点击恢复上次快照）。
   - **数据持久化**：刷新页面数据仍在；IndexedDB（DevTools → Application）里 `roster-db` 的 lists/meta 正确；导入空文件后应出现「检测到数据可能丢失」横幅，点「恢复备份」找回导入前数据。
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
- 分页错乱时先看 `currentIndex` 与 `activeListId` 是否一致（App.tsx 双同步逻辑）；循环布局下先确认是否误触发克隆页瞬移（`jumpTo`）。
- 动画抖动优先怀疑 `suppressLayout`（App.tsx:151-158）被改或 `layout` 与 dnd-kit transform 冲突。
- 数据丢失怀疑：`updateActiveList` 的 `saveList` 未 catch（IndexedDB 配额/隐私模式）。
- 图标再生成：`python3 generate-icons.py`（需 Pillow；首次 `pip install pillow`）。

## 10. 变更边界

- 新增依赖前确认必要（项目依赖极少：react、idb、dnd-kit、framer-motion、tailwind、pwa、cuelume）。
- 不要引入测试框架前先问是否值得——项目当前零测试。
- 修改 `db.ts` 的 schema 必须**递增 DB_VERSION** 并写 upgrade 迁移分支，否则老用户数据直接丢失。

## 11. 部署（Cloudflare Pages）

- 推荐方式：Pages **Git 集成**（连 GitHub 仓库 `xuezx1999/roster`），Build command `npm run build`，Output directory `dist`，Node.js version `20`（可用 env `NODE_VERSION=20`）。
- 已提交 `public/_redirects`（`/* /index.html 200` SPA 回退，避免深链/刷新 404）与 `wrangler.toml`（`pages_build_output_dir = "./dist"`，兼容 CLI 手动部署：`npx wrangler pages deploy dist --project-name roster`）。
- 无需后端、无需环境变量；数据在浏览器 IndexedDB。
- 部署后验证：首页可开、SW 注册日志、离线可访问、深链刷新返回 200。
- 自定义域名：Pages 项目 → Custom domains → 添加 `roster.xuezhixiang.fun`，由 Cloudflare DNS 自动托管（CNAME 指向 pages.dev，代理已开则自动带 HTTPS）。
- 每次 `git push` 触发自动构建；`vite-plugin-pwa` 的 hash 预缓存保证用户自动更新到新版本。
