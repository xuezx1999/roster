import { useState, useRef, useEffect, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import type { Task } from '../types'
import { Bracket } from './Bracket'

interface TaskItemProps {
  task: Task
  isActionMode: boolean
  suppressLayout: boolean
  onToggle: (id: string) => void
  onToggleInProgress: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onLongPress: (task: Task) => void
}

export function TaskItem({
  task,
  isActionMode,
  suppressLayout,
  onToggle,
  onToggleInProgress,
  onUpdate,
  onLongPress,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.content)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const justHandledTouchRef = useRef(false)
  // 桌面鼠标长按（Web 端无 touch 事件，需鼠标替代路径进入 actionMode）
  const mouseLongPressTimerRef = useRef<number | null>(null)
  const justHandledMouseRef = useRef(false)
  const clickTimerRef = useRef<number | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      const input = editInputRef.current
      input.focus()
      // 光标定位到文本末尾（不选中，便于直接补字/改末尾）
      input.setSelectionRange(input.value.length, input.value.length)
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isEditing])

  // 桌面鼠标长按：mousedown 启动 450ms 定时器，mouseup/mouseleave 取消；触发后抑制随后的 click
  const cancelMouseLongPress = useCallback(() => {
    if (mouseLongPressTimerRef.current !== null) {
      window.clearTimeout(mouseLongPressTimerRef.current)
      mouseLongPressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isDragging) {
      touchStartRef.current = null
      cancelLongPress()
      cancelMouseLongPress()
    }
  }, [isDragging, cancelMouseLongPress])

  // 卸载时清理所有定时器，避免组件已卸载后 300ms/450ms 回调仍触发（轻微泄漏）
  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current)
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
      if (mouseLongPressTimerRef.current !== null) window.clearTimeout(mouseLongPressTimerRef.current)
    }
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : undefined,
  }

  const startEditing = useCallback(() => {
    if (isDragging) return
    setEditValue(task.content)
    setIsEditing(true)
  }, [isDragging, task.content])

  const saveEdit = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.content) {
      onUpdate(task.id, trimmed)
    }
    setIsEditing(false)
  }, [editValue, task.content, task.id, onUpdate])

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (justHandledTouchRef.current || justHandledMouseRef.current) return

    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      onToggle(task.id)
      return
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      onToggleInProgress(task.id)
    }, 300)
  }

  const startLongPress = useCallback(() => {
    if (longPressTimerRef.current) return
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      justHandledTouchRef.current = true
      setTimeout(() => { justHandledTouchRef.current = false }, 300)
      onLongPress(task)
    }, 450)
  }, [task, onLongPress])

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isEditing || isDragging) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    startLongPress()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    if (Math.hypot(dx, dy) > 12) {
      cancelLongPress()
    }
  }

  const handleTouchEnd = () => {
    cancelLongPress()
    touchStartRef.current = null
  }

  const handleMouseDown = useCallback(() => {
    if (isEditing || isDragging) return
    cancelMouseLongPress()
    mouseLongPressTimerRef.current = window.setTimeout(() => {
      mouseLongPressTimerRef.current = null
      justHandledMouseRef.current = true
      setTimeout(() => {
        justHandledMouseRef.current = false
      }, 300)
      onLongPress(task)
    }, 450)
  }, [isEditing, isDragging, onLongPress, task, cancelMouseLongPress])

  // 桌面右键：直接进入 actionMode（拖拽/删除），编辑态/拖拽中保留系统右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing || isDragging) return
      e.preventDefault()
      onLongPress(task)
    },
    [isEditing, isDragging, onLongPress, task]
  )

  const handleClick = () => {
    if (justHandledTouchRef.current || justHandledMouseRef.current) return
    if (isActionMode) return
    startEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditValue(task.content)
      setIsEditing(false)
    }
  }

  return (
    <motion.div
      data-task
      layout={!suppressLayout}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ layout: { duration: 0.3, ease: 'easeInOut' }, opacity: { duration: 0.15 } }}
      style={{ transformOrigin: 'top' }}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`relative select-none ${isDragging ? 'opacity-80' : ''}`}
      >
        <div
          className="flex items-baseline gap-3 py-0.5"
          style={{
            touchAction: 'pan-x pan-y',
            WebkitUserSelect: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={cancelMouseLongPress}
          onMouseLeave={cancelMouseLongPress}
          onContextMenu={handleContextMenu}
        >
          <button
            onClick={handleToggle}
            className={`font-mono text-[16px] leading-[1.6] select-none cursor-pointer transition-colors duration-200 ${task.completed ? 'text-mute' : 'text-ink'}`}
            aria-label={task.completed ? 'Mark incomplete' : task.inProgress ? 'Mark not in progress' : 'Mark complete'}
          >
            <Bracket>
              {task.completed ? (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  style={{ fontSize: '0.75em', lineHeight: 1, display: 'inline-block' }}
                >
                  ●
                </motion.span>
              ) : task.inProgress ? (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  style={{ fontSize: '0.75em', lineHeight: 1, display: 'inline-block' }}
                >
                  ○
                </motion.span>
              ) : ''}
            </Bracket>
          </button>

          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent font-mono text-[16px] leading-[1.6] text-ink outline-none border-b border-ink min-w-0"
            />
          ) : (
            <span
              onClick={handleClick}
              className={`flex-1 font-mono text-[16px] leading-[1.6] break-words cursor-pointer transition-colors duration-200 ${task.completed ? 'text-mute' : 'text-ink'}`}
            >
              {task.content}
            </span>
          )}
        </div>

        {/* Drag handle, shown only in action mode */}
        {isActionMode && !isEditing && (
          <div
            className="absolute inset-y-0 right-0 flex items-center z-10"
            style={{
              paddingLeft: '56px',
              background: 'linear-gradient(to right, color-mix(in srgb, var(--color-bg) 0%, transparent) 0%, color-mix(in srgb, var(--color-bg) 90%, transparent) 45%, var(--color-bg) 75%)',
            }}
          >
            <button
              {...attributes}
              {...listeners}
              onTouchStart={(e) => e.stopPropagation()}
              className="font-mono text-[16px] leading-[1.6] text-ink select-none cursor-grab touch-none"
              style={{ touchAction: 'none' }}
              aria-label="Drag to reorder"
            >
              <Bracket>≡</Bracket>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
