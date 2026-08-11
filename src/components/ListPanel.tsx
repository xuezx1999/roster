import { useState, useRef, useEffect } from 'react'
import { DndContext, closestCenter, type DragEndEvent, type SensorDescriptor } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { AnimatePresence, motion } from 'framer-motion'
import { EditableTitle } from './EditableTitle'
import { TaskList } from './TaskList'
import { AddTask, type AddTaskHandle } from './AddTask'
import { Bracket } from './Bracket'
import type { Task, TodoList, RosterExport } from '../types'
import { downloadJSON, parseRosterImport } from '../utils'

interface ListPanelProps {
  list: TodoList
  actionModeId: string | null
  suppressLayout: boolean
  sensors: SensorDescriptor<any>[]
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onDragEnd: (event: DragEndEvent) => void
  onToggle: (id: string) => void
  onToggleInProgress: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onLongPress: (task: Task) => void
  onSaveTitle: (title: string) => void
  onAddTask: (content: string) => void
  onClearCompleted: () => void
  onAddList: () => void
  onDeleteList: () => void
  canDelete: boolean
  onConfirmDelete: () => void
  onSaveOrder: () => void
  onExport: () => RosterExport
  onReplace: (data: RosterExport) => void
}

type ConfirmAction = 'clear' | 'export' | 'import' | 'delete' | null

/**
 * 桌面多列（≥768px）的自包含列表面板：
 * 列头（可编辑标题 + ≡ 列菜单）+ 任务列表（或 NO LISTS 占位）+ 列底（actionMode 操作 / ADD）。
 * 菜单动作全部作用于本列（清除完成），全局动作（新增列表/导出/导入）由 App 回调提供。
 */
export function ListPanel({
  list,
  actionModeId,
  suppressLayout,
  sensors,
  theme,
  onToggleTheme,
  onDragEnd,
  onToggle,
  onToggleInProgress,
  onUpdate,
  onLongPress,
  onSaveTitle,
  onAddTask,
  onClearCompleted,
  onAddList,
  onDeleteList,
  canDelete,
  onConfirmDelete,
  onSaveOrder,
  onExport,
  onReplace,
}: ListPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [importError, setImportError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImportRef = useRef<RosterExport | null>(null)
  const addTaskRef = useRef<AddTaskHandle>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmAction(null)
        setImportError(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  const isActionMode = actionModeId !== null && list.tasks.some((t) => t.id === actionModeId)

  const handleExport = () => {
    const data = onExport()
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    downloadJSON(data, `ROSTER-${stamp}.json`)
    setMenuOpen(false)
    setConfirmAction(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseRosterImport(String(reader.result))
      if (parsed) {
        pendingImportRef.current = parsed
        setImportError(false)
        setConfirmAction('import')
      } else {
        setImportError(true)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = () => {
    if (pendingImportRef.current) {
      onReplace(pendingImportRef.current)
    }
    pendingImportRef.current = null
    setConfirmAction(null)
    setMenuOpen(false)
  }

  const handleBlankDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, [data-task]')) return
    if (actionModeId) return
    addTaskRef.current?.open()
  }

  return (
    <div className="h-full flex flex-col px-4" onDoubleClick={handleBlankDoubleClick}>
      {/* 列头：标题 + 菜单（固定高 108px：标题在顶部，下方留白，任务区紧随 → 任务从列顶 108px 开始，与移动端一致） */}
      <div
        className="flex items-baseline justify-between gap-3 shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          height: 'calc(env(safe-area-inset-top) + 108px)',
        }}
      >
        <div className="flex-1 min-w-0">
          <EditableTitle title={list.title} onSave={onSaveTitle} />
        </div>
        {/* 右移 24px（= 列间 pr-6 间距，两者需同步修改）：[≡] 右缘距右侧分割线 = 16px，与标题左缘对称；
            transform 不改变布局槽位（不与标题重叠），且成为下拉面板的定位基准，菜单相对 ≡ 关系不变 */}
        <div className="relative" ref={menuRef} style={{ transform: 'translateX(24px)' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="font-mono text-[16px] leading-[1.6] text-ink select-none cursor-pointer"
            aria-label="Menu"
          >
            <Bracket>≡</Bracket>
          </button>
          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 z-30 flex flex-col items-end gap-2"
                style={{
                  right: 'calc(1ch - 16px)', // 面板右缘 = 容器右缘 - (1ch - 16px)，菜单项右缘（-16px 右 padding）与 ≡ 右缘对齐
                  padding: '12px 16px 24px 48px',
                  background: 'linear-gradient(to left, var(--color-bg) 60%, transparent 100%)',
                }}
              >
                <motion.button
                  key="theme"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => {
                    // 不关闭菜单：避免"关菜单后点击穿透"误触下方任务；可连续切换
                    onToggleTheme()
                  }}
                  className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                >
                  <Bracket>◐</Bracket> {theme === 'dark' ? '亮色模式' : '暗色模式'}
                </motion.button>

                <motion.button
                  key="add-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => {
                    onAddList()
                    setMenuOpen(false)
                    setConfirmAction(null)
                  }}
                  className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                >
                  <Bracket>+</Bracket> 新增列表
                </motion.button>

                <AnimatePresence mode="wait" initial={false}>
                  {confirmAction === 'clear' ? (
                    <motion.button
                      key="confirm-clear"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        onClearCompleted()
                        setMenuOpen(false)
                        setConfirmAction(null)
                      }}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>✕</Bracket> 确认清除
                    </motion.button>
                  ) : (
                    <motion.button
                      key="clear"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setConfirmAction('clear')}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>−</Bracket> 清除完成
                    </motion.button>
                  )}
                </AnimatePresence>

                {canDelete && (
                  <AnimatePresence mode="wait" initial={false}>
                    {confirmAction === 'delete' ? (
                      <motion.button
                        key="confirm-delete"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => {
                          onDeleteList()
                          setMenuOpen(false)
                          setConfirmAction(null)
                        }}
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none whitespace-nowrap"
                      >
                        <Bracket>✕</Bracket> 确认删除
                      </motion.button>
                    ) : (
                      <motion.button
                        key="delete"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setConfirmAction('delete')}
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                      >
                        <Bracket>∅</Bracket> 删除列表
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  {confirmAction === 'export' ? (
                    <motion.button
                      key="confirm-export"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onClick={handleExport}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>✓</Bracket> 确认导出
                    </motion.button>
                  ) : (
                    <motion.button
                      key="export"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setConfirmAction('export')}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>↑</Bracket> 导出数据
                    </motion.button>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait" initial={false}>
                  {confirmAction === 'import' ? (
                    <motion.button
                      key="confirm-import"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onClick={handleConfirmImport}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>✓</Bracket> 确认导入
                    </motion.button>
                  ) : importError ? (
                    <motion.button
                      key="import-error"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        setImportError(false)
                        fileInputRef.current?.click()
                      }}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>!</Bracket> 无效文件
                    </motion.button>
                  ) : (
                    <motion.button
                      key="import"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>↓</Bracket> 导入数据
                    </motion.button>
                  )}
                </AnimatePresence>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 任务区（紧随列头，任务内容从列顶 108px 开始，与移动端布局一致） */}
      <div className="flex-1 min-h-0 overflow-y-auto pl-8">
        {list.tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="font-mono text-[16px] leading-[1.6] text-mute select-none">
              NO LISTS
            </span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <TaskList
              tasks={list.tasks}
              actionModeId={actionModeId}
              suppressLayout={suppressLayout}
              onToggle={onToggle}
              onToggleInProgress={onToggleInProgress}
              onUpdate={onUpdate}
              onLongPress={onLongPress}
            />
          </DndContext>
        )}
      </div>

      {/* 列底：actionMode 操作或 ADD（pl-8 与任务列表左侧对齐） */}
      <div
        className="shrink-0 pl-8"
        style={{
          paddingTop: '16px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isActionMode ? (
            <motion.div
              key="action"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-baseline justify-between py-0.5">
                <button
                  onClick={onConfirmDelete}
                  className="font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none"
                >
                  <Bracket>−</Bracket> 删除此条
                </button>
                <button
                  onClick={onSaveOrder}
                  className="font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none"
                >
                  <Bracket>↩</Bracket> 保存排序
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <AddTask ref={addTaskRef} onAdd={onAddTask} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
