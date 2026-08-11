import { useState, useRef, useEffect, useCallback } from 'react'

interface EditableTitleProps {
  title: string
  onSave: (title: string) => void
  editable?: boolean
}

export function EditableTitle({ title, onSave, editable = true }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(title)
  }, [title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current
      input.focus()
      // 光标定位到文本末尾（不选中，便于直接补字/改末尾）
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, [isEditing])

  const save = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) {
      onSave(trimmed)
    } else {
      setValue(title)
    }
    setIsEditing(false)
  }, [value, title, onSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 中文输入法（IME）组合期间的回车用于确认候选词，不提交
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      save()
    } else if (e.key === 'Escape') {
      setValue(title)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent font-mono text-[18px] leading-[1.4] tracking-[0.08em] text-ink outline-none border-b border-ink uppercase"
        style={{ fontFamily: "'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace" }}
      />
    )
  }

  return (
    <button
      onClick={() => editable && setIsEditing(true)}
      className={`w-full text-left font-mono text-[18px] leading-[1.4] tracking-[0.08em] text-ink uppercase select-none ${editable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ fontFamily: "'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace" }}
    >
      {title}
    </button>
  )
}
