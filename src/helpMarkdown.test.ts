import { describe, it, expect } from 'vitest'
import { parseHelpMarkdown } from './helpMarkdown'

const md = `# ROSTER 使用说明

## 数据存储

- ROSTER 为**纯本地应用**。
- 数据存储情况是：

### 桌面端浏览器

- 数据落在 IndexedDB。
- 两种丢法：① 手动清除；② 空间回收。

### 移动端浏览器

- **⚠️ iOS 特有风险**：7 天清除。

## 数据备份

### 导出数据

- 导出为 \`ROSTER-YYYYMMDD-HHMMSS\` 文件。

> 引用示例：请先导出留底。

---

## 开源仓库

- 仓库： https://github.com/xuezx1999/roster 。
`

describe('parseHelpMarkdown', () => {
  const tree = parseHelpMarkdown(md)

  it('顶层只保留 # 之下的 ## 节', () => {
    expect(tree).toHaveLength(3)
    expect(tree.map((s) => s.title)).toEqual(['数据存储', '数据备份', '开源仓库'])
    expect(tree.every((s) => s.level === 2)).toBe(true)
  })

  it('h3/h4 嵌套归属正确（数据存储 下三个 h3 子节）', () => {
    const storage = tree[0]
    expect(storage.children.map((c) => c.title)).toEqual([
      '桌面端浏览器',
      '移动端浏览器',
    ])
  })

  it('标题下直属内容归入该节 blocks（折叠范围语义）', () => {
    const storage = tree[0]
    // 数据存储 的 blocks：一段列表（2 项，引导句 + 说明）
    expect(storage.blocks).toHaveLength(1)
    expect(storage.blocks[0].type).toBe('list')
    if (storage.blocks[0].type === 'list') {
      expect(storage.blocks[0].items).toHaveLength(2)
    }
    // 桌面端浏览器 的 blocks：一个列表（2 项）
    const desktop = storage.children[0]
    expect(desktop.blocks).toHaveLength(1)
    if (desktop.blocks[0].type === 'list') {
      expect(desktop.blocks[0].items).toHaveLength(2)
    }
    // 开源仓库 的 blocks：一个列表；裸 URL 解析为 link 节点
    const repo = tree[2]
    expect(repo.blocks).toHaveLength(1)
    const repoList = repo.blocks[0]
    if (repoList.type !== 'list') throw new Error('expected list')
    const link = repoList.items[0].find((n) => n.type === 'link')
    expect(link && link.type === 'link' && link.href).toBe('https://github.com/xuezx1999/roster')
  })

  it('行内：加粗 / 代码 / 引用 / 分割线', () => {
    const storage = tree[0]
    // 列表首项首节点为 bold（纯本地应用）
    const list = storage.blocks[0]
    if (list.type !== 'list') throw new Error('expected list')
    const bold = list.items[0].find((n) => n.type === 'bold')
    expect(bold && bold.type === 'bold').toBe(true)
    if (bold && bold.type === 'bold') {
      expect(bold.children).toEqual([{ type: 'text', text: '纯本地应用' }])
    }

    // 移动端浏览器 列表首项：**⚠️ iOS 特有风险** 加粗在前
    const mobile = storage.children[1]
    const mobileList = mobile.blocks[0]
    if (mobileList.type !== 'list') throw new Error('expected list')
    expect(mobileList.items[0][0]).toEqual({ type: 'bold', children: [{ type: 'text', text: '⚠️ iOS 特有风险' }] })

    // 导出数据：行内代码
    const exportSec = tree[1].children[0]
    const exportList = exportSec.blocks[0]
    if (exportList.type !== 'list') throw new Error('expected list')
    const code = exportList.items[0].find((n) => n.type === 'code')
    expect(code).toEqual({ type: 'code', text: 'ROSTER-YYYYMMDD-HHMMSS' })

    // 引用块
    expect(exportSec.blocks[1]).toMatchObject({ type: 'quote' })
    // 分割线 `---` 在 导出数据 节尾（其后紧跟 开源仓库 节）
    expect(exportSec.blocks.some((b) => b.type === 'hr')).toBe(true)
  })
})
