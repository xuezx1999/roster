// ROSTER 使用说明的轻量 Markdown 解析器。
// 覆盖 helpContent.ts 用到的语法子集：标题（1-4 级）、无序/有序列表、段落、引用、分割线，
// 行内：**加粗**、`行内代码`、[文本](链接)、裸 http(s) 链接。
// 输出为可折叠的标题树：每个标题节（HelpSection）含直属内容块（blocks）与子节（children）。

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

export type HelpBlock =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'hr' }

export interface HelpSection {
  id: string
  level: number
  title: string
  blocks: HelpBlock[]
  children: HelpSection[]
}

type RawBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' }

const HEADING_RE = /^(#{1,4})\s+(.*)$/
const HR_RE = /^---+$/
const UL_RE = /^[-*]\s+(.*)$/
const OL_RE = /^\d+\.\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

// 行内解析：**加粗**（可嵌套行内代码/链接）、`代码`、[文本](url)、裸 http(s) 链接
const INLINE_RE =
  /(`[^`]+`)|(\*\*([\s\S]+?)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s，。；）)]+)/g

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index !== undefined && m.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, m.index) })
    }
    if (m[1]) {
      nodes.push({ type: 'code', text: m[1].slice(1, -1) })
    } else if (m[2]) {
      nodes.push({ type: 'bold', children: parseInline(m[3]) })
    } else if (m[4]) {
      nodes.push({ type: 'link', text: m[5], href: m[6] })
    } else if (m[7]) {
      nodes.push({ type: 'link', text: m[7], href: m[7] })
    }
    last = (m.index ?? 0) + m[0].length
  }
  if (last < text.length) {
    nodes.push({ type: 'text', text: text.slice(last) })
  }
  return nodes
}

// 把原始行流切分为"块"（块内聚合列表项/引用/段落）
function tokenize(lines: string[]): RawBlock[] {
  const blocks: RawBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].replace(/\u00A0/g, ' ').trim()
    if (!line) {
      i++
      continue
    }
    const h = line.match(HEADING_RE)
    if (h) {
      blocks.push({ kind: 'heading', level: h[1].length, text: h[2].trim() })
      i++
      continue
    }
    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    const q = line.match(QUOTE_RE)
    if (q) {
      const texts = [q[1]]
      i++
      while (i < lines.length) {
        const l = lines[i].replace(/\u00A0/g, ' ').trim()
        const qq = l.match(QUOTE_RE)
        if (!qq || !l) break
        texts.push(qq[1])
        i++
      }
      blocks.push({ kind: 'quote', text: texts.join(' ') })
      continue
    }
    const ul = line.match(UL_RE)
    const ol = line.match(OL_RE)
    if (ul || ol) {
      const ordered = !!ol
      const items = [ordered ? (ol as RegExpMatchArray)[1] : (ul as RegExpMatchArray)[1]]
      i++
      while (i < lines.length) {
        const l = lines[i].replace(/\u00A0/g, ' ').trim()
        if (!l) break
        const u2 = l.match(UL_RE)
        const o2 = l.match(OL_RE)
        if (ordered ? o2 : u2) {
          items.push((ordered ? o2 as RegExpMatchArray : u2 as RegExpMatchArray)[1])
          i++
          continue
        }
        break
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    // 普通段落：连续非空行合并（软换行 → 空格）
    const texts = [line]
    i++
    while (i < lines.length) {
      const l = lines[i].replace(/\u00A0/g, ' ').trim()
      if (!l) break
      if (HEADING_RE.test(l) || HR_RE.test(l) || UL_RE.test(l) || OL_RE.test(l) || QUOTE_RE.test(l)) break
      texts.push(l)
      i++
    }
    blocks.push({ kind: 'paragraph', text: texts.join(' ') })
  }
  return blocks
}

function toHelpBlock(b: RawBlock): HelpBlock {
  switch (b.kind) {
    case 'hr':
      return { type: 'hr' }
    case 'paragraph':
      return { type: 'paragraph', children: parseInline(b.text) }
    case 'quote':
      return { type: 'quote', children: parseInline(b.text) }
    case 'list':
      return { type: 'list', ordered: b.ordered, items: b.items.map((t) => parseInline(t)) }
    default:
      // heading 不会走到这里
      return { type: 'paragraph', children: [] }
  }
}

// 构建标题树：标题按层级嵌套，非标题块归入当前（最近的）标题节
export function parseHelpMarkdown(md: string): HelpSection[] {
  const blocks = tokenize(md.split('\n'))
  const root: HelpSection = { id: 'root', level: 0, title: '', blocks: [], children: [] }
  const stack: HelpSection[] = [root]
  let seq = 0

  for (const b of blocks) {
    if (b.kind === 'heading') {
      // `#` 一级标题是页面标题（由 HelpPage 标题栏显示），不建树节点
      if (b.level === 1) continue
      // 遇到同/更高层级标题：结束（弹出）当前节；直属内容已累积在节自身 blocks
      while (stack.length > 1 && stack[stack.length - 1].level >= b.level) stack.pop()
      const sec: HelpSection = {
        id: `help-sec-${seq++}`,
        level: b.level,
        title: b.text,
        blocks: [],
        children: [],
      }
      stack[stack.length - 1].children.push(sec)
      stack.push(sec)
    } else {
      // 非标题块累积到当前（栈顶）节的直属内容
      stack[stack.length - 1].blocks.push(toHelpBlock(b))
    }
  }
  return root.children
}
