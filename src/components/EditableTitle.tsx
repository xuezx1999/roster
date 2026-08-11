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
      inputRef.current.focus()
      inputRef.current.select()
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
        className="w-full bg-transparent font-mono text-[18px] leading-[1.4] tracking-[0.08em] text-[#1A1A1A] outline-none border-b border-[#1A1A1A] uppercase"
        style={{ fontFamily: "'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace" }}
      />
    )
  }

  return (
    <button
      onClick={() => editable && setIsEditing(true)}
      className={`w-full text-left font-mono text-[18px] leading-[1.4] tracking-[0.08em] text-[#1A1A1A] uppercase select-none ${editable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ fontFamily: "'IBM Plex Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace" }}
    >
      {title}
    </button>
  )
}
