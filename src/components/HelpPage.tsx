import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EditableTitle } from './EditableTitle'
import { Bracket } from './Bracket'
import { HELP_CONTENT } from '../helpContent'
import { parseHelpMarkdown, type HelpSection, type HelpBlock, type InlineNode } from '../helpMarkdown'

// 模块级解析一次（纯函数、内容静态），避免每次渲染重复解析
const HELP_TREE = parseHelpMarkdown(HELP_CONTENT)

interface HelpPageProps {
  onBack: () => void
}

/** 行内节点渲染：文本 / 加粗（500）/ 行内代码（淡底色）/ 链接（下划线，新窗口） */
function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <span key={i}>{n.text}</span>
          case 'bold':
            return (
              <strong key={i} className="font-medium">
                <Inline nodes={n.children} />
              </strong>
            )
          case 'code':
            return (
              <code key={i} className="bg-ink/10 px-[4px]">
                {n.text}
              </code>
            )
          case 'link':
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink/30 underline-offset-4 hover:text-mute break-all"
              >
                {n.text}
              </a>
            )
        }
      })}
    </>
  )
}

/** 内容块渲染：段落 / 列表 / 引用 / 分割线。
 * 缩进跟随所在节的标题层级（indent 由 Section 传入），保证子级内容不浅于其标题。 */
function Blocks({ blocks, indent }: { blocks: HelpBlock[]; indent: string }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'hr':
            return <div key={i} className={`${indent} border-t border-ink/15 my-8`} />
          case 'paragraph':
            return (
              <p key={i} className={`${indent} mt-3 font-mono text-[16px] leading-[1.6] text-ink`}>
                <Inline nodes={b.children} />
              </p>
            )
          case 'quote':
            return (
              <p key={i} className={`${indent} mt-3 flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink`}>
                <span className="shrink-0 select-none">&gt;</span>
                <span>
                  <Inline nodes={b.children} />
                </span>
              </p>
            )
          case 'list':
            return (
              <ul key={i} className={`${indent} mt-3 flex flex-col gap-1`}>
                {b.items.map((item, j) => (
                  <li key={j} className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink">
                    <span className="shrink-0 select-none">
                      {b.ordered ? `${j + 1}.` : '-'}
                    </span>
                    <span>
                      <Inline nodes={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </>
  )
}

/**
 * 标题节渲染：
 * - 每个标题左侧一个括号按钮（展开态 [-] / 折叠态 [+]），点击收起/展开该层级全部内容（含子节）；
 * - 层级缩进：h2 顶格、h3 缩进 24px、h4 缩进 48px；标题字号/字距与列表标题一致（18px/0.08em）。
 */
function Section({ section, collapsed, onToggle }: {
  section: HelpSection
  collapsed: Set<string>
  onToggle: (id: string) => void
}) {
  const isCollapsed = collapsed.has(section.id)
  const isH2 = section.level === 2
  const isH4 = section.level >= 4
  const titleCls = isH2
    ? 'font-mono text-[18px] leading-[1.4] tracking-[0.08em] text-ink uppercase'
    : 'font-mono text-[16px] leading-[1.6] text-ink font-medium'
  const pad = isH2 ? 'pl-0' : isH4 ? 'pl-12' : 'pl-6'
  const headPad = isH2 ? 'mt-8' : isH4 ? 'mt-4' : 'mt-6'
  // 内容缩进不浅于标题：h2/h3 内容 pl-6（与 h3 标题对齐），h4 内容 pl-16（深于 h4 标题 pl-12 一级，
  // 保证四级标题下的列表有明确的层级缩进）
  const contentIndent = isH4 ? 'pl-16' : 'pl-6'

  return (
    <section className={headPad}>
      <div className={`flex items-baseline gap-2 ${pad}`}>
        <button
          onClick={() => onToggle(section.id)}
          className="font-mono text-[16px] leading-[1.6] text-ink select-none cursor-pointer"
          aria-label={isCollapsed ? '展开' : '收起'}
        >
          <Bracket>{isCollapsed ? '+' : '−'}</Bracket>
        </button>
        <span className={titleCls}>{section.title}</span>
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Blocks blocks={section.blocks} indent={contentIndent} />
            {section.children.map((child) => (
              <Section key={child.id} section={child} collapsed={collapsed} onToggle={onToggle} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/**
 * 使用说明页：独立全屏视图（桌面/移动端共用）。
 * 顶部标题栏与列表标题位置/样式/交互一致（EditableTitle editable=false，不可修改），
 * 右上角原菜单按钮位置为「返回」符号（无文本）。
 */
export function HelpPage({ onBack }: HelpPageProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏：fixed 浮层 + 渐变遮罩（与移动端列表标题一致），
          正文滚动时穿过 header 渐变尾区被自然淡出，避免与下方内容硬切 */}
      <header
        className="fixed top-0 left-0 right-0 z-20"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          paddingBottom: '24px',
          paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
          paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
          background: 'linear-gradient(to bottom, var(--color-bg) 60%, transparent 100%)',
        }}
      >
        <div className="max-w-[640px] mx-auto h-full flex items-baseline justify-between gap-3">
          <div className="flex-1 min-w-0">
            <EditableTitle title="ROSTER 使用说明" onSave={() => {}} editable={false} />
          </div>
          <button
            onClick={onBack}
            className="font-mono text-[16px] leading-[1.6] text-ink select-none cursor-pointer"
            aria-label="Back"
          >
            <Bracket>←</Bracket>
          </button>
        </div>
      </header>

      {/* 正文：可滚动；padding-top 与移动端列表任务区对齐（safe-area + 108px），
          让内容从 header 下方穿过时进入渐变尾区被遮罩 */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div
          className="max-w-[640px] mx-auto px-6 pb-16"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 108px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
          }}
        >
          {HELP_TREE.map((section) => (
            <Section key={section.id} section={section} collapsed={collapsed} onToggle={toggle} />
          ))}
        </div>
      </div>
    </div>
  )
}
