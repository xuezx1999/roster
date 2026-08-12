import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { flushSync } from 'react-dom'
import { play } from 'cuelume'
import { Bracket } from './Bracket'

interface AddTaskProps {
  onAdd: (content: string) => void
}

export interface AddTaskHandle {
  open: () => void
}

export const AddTask = forwardRef<AddTaskHandle, AddTaskProps>(function AddTask(
  { onAdd },
  ref
) {
  const [isAdding, setIsAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const open = useCallback(() => {
    // flushSync 同步渲染输入框，让 focus 落在用户手势（双击）调用栈内——
    // iOS Safari 只对用户手势同步触发的 focus 自动唤起键盘，setTimeout 延迟会丢失手势上下文
    flushSync(() => setIsAdding(true))
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  useImperativeHandle(ref, () => ({ open }))

  const save = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      play('press', { volume: 0.5 })
    }
    setValue('')
    setIsAdding(false)
  }, [value, onAdd])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 中文输入法（IME）组合期间的回车用于确认候选词，不提交
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      save()
    } else if (e.key === 'Escape') {
      setValue('')
      setIsAdding(false)
    }
  }

  if (isAdding) {
    return (
      <div className="flex items-baseline gap-3 py-0.5">
        <span className="font-mono text-[16px] leading-[1.6] text-ink select-none">
          <Bracket>+</Bracket>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          placeholder="ADD"
          className="flex-1 bg-transparent font-mono text-[16px] leading-[1.6] text-ink outline-none border-b border-ink placeholder:text-mute min-w-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <button
      onClick={open}
      className="flex items-baseline gap-3 py-0.5 w-full text-left cursor-pointer select-none group"
    >
      <span className="font-mono text-[16px] leading-[1.6] text-mute group-hover:text-ink transition-colors">
        <Bracket>+</Bracket>
      </span>
      <span className="font-mono text-[16px] leading-[1.6] text-mute group-hover:text-ink transition-colors">
        ADD
      </span>
    </button>
  )
})
