import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { AnimatePresence, motion } from 'framer-motion'
import { useTodos } from './hooks/useTodos'
import { EditableTitle } from './components/EditableTitle'
import { TaskList } from './components/TaskList'
import { AddTask, type AddTaskHandle } from './components/AddTask'
import { Bracket } from './components/Bracket'
import type { Task, RosterExport } from './types'

function App() {
  const {
    lists,
    activeListId,
    loaded,
    addList,
    switchList,
    addTask,
    updateTaskContent,
    toggleComplete,
    toggleInProgress,
    removeTask,
    clearCompleted,
    exportData,
    replaceData,
    reorderTasks,
    updateTitle,
  } = useTodos()

  const [actionModeId, setActionModeId] = useState<string | null>(null)
  const [suppressLayout, setSuppressLayout] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'clear' | 'export' | 'import' | null>(null)
  const [importError, setImportError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImportRef = useRef<RosterExport | null>(null)
  const addTaskRef = useRef<AddTaskHandle>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef(0)

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 12 },
    })
  )

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx
      setCurrentIndex(idx)
      setActionModeId(null)
      if (idx < lists.length) {
        const id = lists[idx].id
        if (id !== activeListId) switchList(id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, activeListId, switchList])

  const isBlankPage = currentIndex >= lists.length
  const headerTitle = isBlankPage ? 'ROSTER' : (lists[currentIndex]?.title ?? 'ROSTER')

  const prevActiveListId = useRef(activeListId)
  useEffect(() => {
    if (prevActiveListId.current === activeListId) return
    prevActiveListId.current = activeListId
    if (!activeListId) return
    const idx = lists.findIndex((l) => l.id === activeListId)
    if (idx === -1) return
    const el = scrollerRef.current
    if (el) {
      el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
    }
    activeIndexRef.current = idx
    setCurrentIndex(idx)
    setActionModeId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId, lists])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderTasks(String(active.id), String(over.id))
    }
    setSuppressLayout(true)
    requestAnimationFrame(() => setSuppressLayout(false))
  }

  const handleLongPress = (task: Task) => {
    setActionModeId(task.id)
  }

  const handleConfirmDelete = () => {
    if (actionModeId) {
      removeTask(actionModeId)
    }
    setActionModeId(null)
  }

  const handleSaveOrder = () => {
    setActionModeId(null)
  }

  const handleBlankDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, [data-task]')) return
    if (actionModeId) return
    if (target.closest('header')) return
    if (currentIndex >= lists.length) {
      addList()
      return
    }
    addTaskRef.current?.open()
  }

  const handleExport = () => {
    const data = exportData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const a = document.createElement('a')
    a.href = url
    a.download = `ROSTER-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMenuOpen(false)
    setConfirmAction(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (data && typeof data === 'object' && data.app === 'ROSTER') {
          if (Array.isArray(data.lists)) {
            pendingImportRef.current = data as RosterExport
          } else if (Array.isArray(data.tasks) && typeof data.title === 'string') {
            // Legacy v1 format: single list
            const legacyId = crypto.randomUUID()
            pendingImportRef.current = {
              app: 'ROSTER',
              version: 2,
              exportedAt: data.exportedAt ?? Date.now(),
              activeListId: legacyId,
              lists: [{ id: legacyId, title: data.title, tasks: data.tasks }],
            }
          } else {
            setImportError(true)
            return
          }
          setImportError(false)
          setConfirmAction('import')
        } else {
          setImportError(true)
        }
      } catch {
        setImportError(true)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = () => {
    if (pendingImportRef.current) {
      replaceData(pendingImportRef.current)
    }
    pendingImportRef.current = null
    setConfirmAction(null)
    setMenuOpen(false)
  }

  if (!loaded) {
    return (
      <div
        className="min-h-svh flex items-center justify-center"
        style={{ backgroundColor: '#F2F2F2' }}
      >
        <span className="font-mono text-[16px] text-[#8C8C8C]">...</span>
      </div>
    )
  }

  return (
    <div
      className="h-svh overflow-hidden"
      onDoubleClick={handleBlankDoubleClick}
      style={{
        backgroundColor: '#F2F2F2',
      }}
    >
      {/* Floating title */}
      <header
        className="fixed top-0 left-0 right-0 z-20"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          paddingBottom: '24px',
          paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
          paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
          background: 'linear-gradient(to bottom, #F2F2F2 60%, rgba(242, 242, 242, 0) 100%)',
        }}
      >
        <div className="max-w-[640px] mx-auto flex items-baseline justify-between">
          <div className="flex-1 min-w-0">
            <EditableTitle
              title={headerTitle}
              onSave={isBlankPage ? () => {} : updateTitle}
              editable={!isBlankPage}
            />
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="font-mono text-[16px] leading-[1.6] text-[#1A1A1A] select-none cursor-pointer"
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
                    padding: '12px 16px 24px 48px',
                    background: 'linear-gradient(to left, #F2F2F2 60%, rgba(242, 242, 242, 0) 100%)',
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {confirmAction === 'clear' ? (
                      <motion.button
                        key="confirm-clear"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => {
                          clearCompleted()
                          setMenuOpen(false)
                          setConfirmAction(null)
                        }}
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#B3261E] cursor-pointer select-none whitespace-nowrap"
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
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#1A1A1A] cursor-pointer select-none whitespace-nowrap"
                      >
                        <Bracket>−</Bracket> 清除已完成
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait" initial={false}>
                    {confirmAction === 'export' ? (
                      <motion.button
                        key="confirm-export"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        onClick={handleExport}
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#B3261E] cursor-pointer select-none whitespace-nowrap"
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
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#1A1A1A] cursor-pointer select-none whitespace-nowrap"
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
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#B3261E] cursor-pointer select-none whitespace-nowrap"
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
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#B3261E] cursor-pointer select-none whitespace-nowrap"
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
                        className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-[#1A1A1A] cursor-pointer select-none whitespace-nowrap"
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
      </header>

      {/* Horizontal scroller of list panels + blank page */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-x-auto snap-x snap-mandatory"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-x pan-y',
        }}
      >
        <div className="flex h-full items-stretch">
          {lists.map((list) => (
            <section
              key={list.id}
              className="w-full shrink-0 snap-start overflow-y-auto"
              style={{
                scrollSnapAlign: 'start',
                paddingTop: 'calc(env(safe-area-inset-top) + 108px)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)',
                paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
                paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
              }}
            >
              <div className="max-w-[640px] mx-auto">
                <main className="pl-8">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <TaskList
                      tasks={list.tasks}
                      actionModeId={actionModeId}
                      suppressLayout={suppressLayout}
                      onToggle={toggleComplete}
                      onToggleInProgress={toggleInProgress}
                      onUpdate={updateTaskContent}
                      onLongPress={handleLongPress}
                    />
                  </DndContext>
                </main>
              </div>
            </section>
          ))}

          {/* Blank / new-list page */}
          <section
            className="w-full shrink-0 snap-start overflow-y-auto"
            style={{
              scrollSnapAlign: 'start',
              paddingTop: 'calc(env(safe-area-inset-top) + 108px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)',
              paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
              paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
            }}
          >
            <div className="max-w-[640px] mx-auto h-full flex items-center justify-center">
              <button
                onClick={addList}
                className="flex items-baseline gap-3 font-mono text-[16px] leading-[1.6] text-[#1A1A1A] cursor-pointer select-none group"
              >
                <span className="text-[#8C8C8C] group-hover:text-[#1A1A1A] transition-colors">
                  <Bracket>+</Bracket>
                </span>
                <span className="text-[#8C8C8C] group-hover:text-[#1A1A1A] transition-colors">
                  新增列表
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Floating bottom bar: delete confirm or add */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          paddingTop: '24px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
          paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
          background: 'linear-gradient(to top, #F2F2F2 60%, rgba(242, 242, 242, 0) 100%)',
        }}
      >
        <div className="max-w-[640px] mx-auto pl-8">
          <AnimatePresence mode="wait" initial={false}>
            {actionModeId ? (
              <motion.div
                key="action"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-baseline justify-between py-0.5">
                  <button
                    onClick={handleConfirmDelete}
                    className="font-mono text-[16px] leading-[1.6] text-[#B3261E] cursor-pointer select-none"
                  >
                    <Bracket>−</Bracket> 删除此条
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    className="font-mono text-[16px] leading-[1.6] text-[#1A1A1A] cursor-pointer select-none"
                  >
                    <Bracket>↩</Bracket> 保存排序
                  </button>
                </div>
              </motion.div>
            ) : !isBlankPage ? (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                <AddTask ref={addTaskRef} onAdd={addTask} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default App
