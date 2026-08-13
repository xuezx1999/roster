import { useMemo } from 'react'
import type { ReactNode } from 'react'

// 中英混排自动加窄空格（仅显示层）：在中文（含 CJK 标点/全角字符）与半角英文字母
// 相邻处插入 0.25em 空 span（约四分之一汉字宽，比手动半角空格更贴合）。
// 只做显示层处理——存储数据、编辑框、复制内容始终是原文，不受影响。
// 中文与数字之间不加（"第3个""8月"保持紧凑），符合主流中文排版规范。
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/
const LATIN = /[A-Za-z]/

/** 单字符是否属于"中文侧"（汉字 + CJK 标点 + 全角字符） */
export const isCjk = (ch: string): boolean => CJK.test(ch)
/** 单字符是否属于"拉丁侧"（半角英文字母） */
export const isLatin = (ch: string): boolean => LATIN.test(ch)
/** 两个相邻字符是否构成中英边界（需插入窄空格） */
export const shouldGap = (a: string, b: string): boolean =>
  (isCjk(a) && isLatin(b)) || (isLatin(a) && isCjk(b))

interface AutoSpaceProps {
  text: string
  className?: string
  onClick?: () => void
}

export function AutoSpace({ text, className, onClick }: AutoSpaceProps) {
  const content = useMemo(() => {
    const nodes: ReactNode[] = []
    let last = 0
    for (let i = 1; i < text.length; i++) {
      const prev = text[i - 1]
      const cur = text[i]
      if (shouldGap(prev, cur)) {
        nodes.push(text.slice(last, i))
        nodes.push(
          <span key={`gap-${i}`} className="inline-block" style={{ width: '0.25em' }} />
        )
        last = i
      }
    }
    nodes.push(text.slice(last))
    return nodes
  }, [text])

  return (
    <span className={className} onClick={onClick}>
      {content}
    </span>
  )
}
