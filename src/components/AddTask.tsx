import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
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
    setIsAdding(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 10)
  }, [])

  useImperativeHandle(ref, () => ({ open }))

  const save = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
    }
    setValue('')
    setIsAdding(false)
  }, [value, onAdd])

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        <span className="font-mono text-[16px] leading-[1.6] text-[#1A1A1A] select-none">
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
          className="flex-1 bg-transparent font-mono text-[16px] leading-[1.6] text-[#1A1A1A] outline-none border-b border-[#1A1A1A] placeholder:text-[#8C8C8C] min-w-0"
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
      <span className="font-mono text-[16px] leading-[1.6] text-[#8C8C8C] group-hover:text-[#1A1A1A] transition-colors">
        <Bracket>+</Bracket>
      </span>
      <span className="font-mono text-[16px] leading-[1.6] text-[#8C8C8C] group-hover:text-[#1A1A1A] transition-colors">
        ADD
      </span>
    </button>
  )
})
