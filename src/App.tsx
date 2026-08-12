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
import { bind, play, setEnabled } from 'cuelume'
import { useTodos } from './hooks/useTodos'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { EditableTitle } from './components/EditableTitle'
import { TaskList } from './components/TaskList'
import { AddTask, type AddTaskHandle } from './components/AddTask'
import { ListPanel } from './components/ListPanel'
import { HelpPage } from './components/HelpPage'
import { Bracket } from './components/Bracket'
import type { Task, TodoList, RosterExport } from './types'
import { downloadJSON, parseRosterImport } from './utils'
import {
  MENU_PANEL_BACKGROUND,
  MENU_PANEL_PADDING,
  MENU_PANEL_RIGHT,
} from './menuStyles'

// 当前列表列宽（含桌面端间距与分隔线，即 snap/翻页步进）：桌面每列 425px（400 内容 + 24 间距 + 1px 分隔线），移动端整屏宽
const getColWidth = (el: HTMLElement) => el.querySelector('section')?.offsetWidth ?? el.clientWidth

// 无列表占位：桌面端无列表时渲染为 ListPanel 占位列（与正常空 list 同构：ROSTER 标题 + [≡] 菜单 + NO LISTS + 底部 ADD），
// 因此桌面端不再渲染独立的「NO LISTS + [+] ADD」section。id 用魔法值避免与真实列表冲突；移动端由全局浮层接管 [+] ADD。
const PLACEHOLDER_LIST: TodoList = { id: '__empty__', title: 'ROSTER', tasks: [] }

function App() {
  const {
    lists,
    activeListId,
    loaded,
    saveError,
    initError,
    dataLossDetected,
    restoreFromBackup,
    dismissDataLoss,
    addList,
    switchList,
    deleteListById,
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
    // per-list（桌面多列）
    addTaskFor,
    updateTaskContentFor,
    toggleCompleteFor,
    toggleInProgressFor,
    removeTaskFor,
    clearCompletedFor,
    reorderTasksFor,
    updateTitleFor,
  } = useTodos()

  const { needRefresh, applyUpdate } = usePwaUpdate()

  const [actionModeId, setActionModeId] = useState<string | null>(null)
  const [suppressLayout, setSuppressLayout] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'clear' | 'export' | 'import' | 'delete' | null>(null)
  const [importError, setImportError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  // 视图切换：'lists' 列表页 / 'help' 使用说明页（菜单「使用说明」进入，右上角返回）
  const [view, setView] = useState<'lists' | 'help'>('lists')
  // 主题：初始值由 main.tsx 渲染前设置的 data-theme 决定
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('roster-theme', next)
    } catch {
      // ignore
    }
    // 同步浏览器地址栏/状态栏主题色
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'dark' ? '#1A1A1A' : '#EFEFEF')
  }
  // 音效：默认开启，localStorage 持久化（cuelume 自身不持久化偏好，由应用管理）
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('roster-sound') !== 'off'
    } catch {
      return true
    }
  })
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('roster-sound', next ? 'on' : 'off')
      } catch {
        // ignore
      }
      return next
    })
  }
  // cuelume：bind 一次（幂等、事件委托覆盖动态 DOM）；setEnabled 跟随用户偏好
  useEffect(() => {
    bind()
  }, [])
  useEffect(() => {
    setEnabled(soundEnabled)
  }, [soundEnabled])
  // 保存失败横幅出现时播放 error 音（用户可恢复的错误反馈；首帧 saveError=false 不触发）
  const prevSaveErrorRef = useRef(saveError)
  useEffect(() => {
    if (saveError && !prevSaveErrorRef.current) play('error', { volume: 0.7 })
    prevSaveErrorRef.current = saveError
  }, [saveError])
  // 键盘弹出高度：iOS Safari 的 fixed 元素不会自动让位键盘，需按 visualViewport 高度差抬起底部栏。
  // 用 ref 直接改 style.bottom 而非 state：避免每次键盘滚动触发整个 App 重渲染
  const bottomBarRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImportRef = useRef<RosterExport | null>(null)
  const addTaskRef = useRef<AddTaskHandle>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef(0)
  // 列宽/左 padding 缓存：offsetWidth 与 getComputedStyle 读取会强制同步布局，
  // 滚动事件高频触发时只读一次、resize 时失效重算
  const metricsRef = useRef<{ col: number; pad: number } | null>(null)
  const getMetrics = (el: HTMLElement) => {
    if (!metricsRef.current) {
      metricsRef.current = {
        col: getColWidth(el),
        pad: parseFloat(getComputedStyle(el).paddingLeft) || 0,
      }
    }
    return metricsRef.current
  }
  // 滚动目标位置：第 idx 列左缘对齐视口（内容盒）左缘 = 容器左 padding + idx × 列宽
  const getScrollTarget = (el: HTMLElement, idx: number) => {
    const m = getMetrics(el)
    return m.pad + idx * m.col
  }
  // 滚动驱动的 activeListId 变化标记：翻页时位置已由原生滚动就位，
  // 若再触发 effect 的 smooth scrollTo 会打断浏览器吸附动画，造成各页入场速度不一致
  const scrollDrivenRef = useRef(false)

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

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height)
      // 直接改 DOM 样式，避免 state 更新触发全树重渲染
      if (bottomBarRef.current) bottomBarRef.current.style.bottom = `${offset}px`
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // 窗口尺寸变化（旋转/缩放/分屏）时列宽失效，下次读取重算
  useEffect(() => {
    const invalidate = () => {
      metricsRef.current = null
    }
    window.addEventListener('resize', invalidate)
    return () => window.removeEventListener('resize', invalidate)
  }, [])

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
    const m = getMetrics(el)
    const idx = Math.round(el.scrollLeft / m.col)
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx
      setCurrentIndex(idx)
      setActionModeId(null)
      const id = lists[idx]?.id
      if (id && id !== activeListId) {
        // 滚动驱动的 activeListId 变化：位置已由原生滚动就位，标记后跳过 effect 的反向 scrollTo
        scrollDrivenRef.current = true
        switchList(id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, activeListId, switchList])

  const isEmpty = lists.length === 0
  const headerTitle = isEmpty ? 'ROSTER' : (lists[currentIndex]?.title ?? 'ROSTER')
  // 当前列表是否含已完成任务：决定菜单「清除完成」是否展示（无已完成时隐藏，与桌面列菜单一致）。
  // 用 activeListId（菜单操作目标）而非 currentIndex（滚动驱动，动画期间可能滞后）
  const hasCompleted = (lists.find((l) => l.id === activeListId)?.tasks.some((t) => t.completed)) ?? false

  const prevActiveListId = useRef(activeListId)
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (!loaded) return
    // 首次加载：auto 定位到 activeListId 对应页，避免首帧落在错误位置
    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      if (activeListId) {
        const idx = lists.findIndex((l) => l.id === activeListId)
        if (idx !== -1 && scrollerRef.current) {
          const el = scrollerRef.current
          const target = getScrollTarget(el, idx)
          if (el.scrollLeft !== target) el.scrollLeft = target
        }
        prevActiveListId.current = activeListId
      }
      return
    }
    // 滚动驱动的 activeListId 变化：位置已由原生滚动就位，跳过反向 scrollTo（否则会打断吸附动画）
    if (scrollDrivenRef.current) {
      scrollDrivenRef.current = false
      prevActiveListId.current = activeListId
      return
    }
    const idx = lists.findIndex((l) => l.id === activeListId)
    if (idx === -1) return
    const el = scrollerRef.current
    if (!el) return
    const target = getScrollTarget(el, idx)
    // activeListId 未变但列表集合变化（删除左侧列表/导入导致 active 列移位）：
    // 用 activeIndexRef 检测索引漂移，立即定位（auto，不打断动画），避免视图停留在错误列
    if (prevActiveListId.current === activeListId) {
      if (activeIndexRef.current !== idx) {
        activeIndexRef.current = idx
        setCurrentIndex(idx)
        setActionModeId(null)
        el.scrollLeft = target
      }
      return
    }
    prevActiveListId.current = activeListId
    if (!activeListId) return
    el.scrollTo({ left: target, behavior: 'smooth' })
    activeIndexRef.current = idx
    setCurrentIndex(idx)
    setActionModeId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, activeListId, lists])

  // Web 端键盘翻页：←/→ 按屏翻（一屏能显示几列翻几列）；输入框/编辑态/使用说明页不拦截
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (view !== 'lists') return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const el = scrollerRef.current
      if (!el || lists.length <= 1) return
      e.preventDefault()
      const m = getMetrics(el)
      const perScreen = Math.max(1, Math.floor(el.clientWidth / m.col))
      const idx = Math.round((el.scrollLeft - m.pad) / m.col)
      const next =
        e.key === 'ArrowRight'
          ? Math.min(idx + perScreen, lists.length - 1)
          : Math.max(idx - perScreen, 0)
      if (next !== idx) el.scrollTo({ left: getScrollTarget(el, next), behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lists.length, view])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderTasks(String(active.id), String(over.id))
    }
    setSuppressLayout(true)
    requestAnimationFrame(() => setSuppressLayout(false))
  }

  // 桌面多列：拖拽排序作用于指定列
  const handleDragEndFor = (listId: string, event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderTasksFor(listId, String(active.id), String(over.id))
    }
    setSuppressLayout(true)
    requestAnimationFrame(() => setSuppressLayout(false))
  }

  const handleLongPress = (task: Task) => {
    setActionModeId(task.id)
  }

  // 新增列表：带轻量结果音效（全局菜单/列菜单/空态 ADD/双击空白共用同一入口）
  const handleAddList = () => {
    addList()
    play('tick', { volume: 0.6 })
  }

  // 占位态（无任何列表）提交首条任务：先新建列表再写入任务，一次完成。
  // 依赖 React 批处理：addList 与 addTaskFor 的 setLists updater 按调用顺序排队执行，
  // 后者执行时 prev 已包含新建列表，findIndex 可命中（不可改为 await 两段式，会破坏原子性）。
  const handleAddFirstTask = (content: string) => {
    const listId = addList()
    addTaskFor(listId, content)
    play('press', { volume: 0.5 })
  }

  const handleConfirmDelete = () => {
    if (actionModeId) {
      removeTask(actionModeId)
      play('droplet', { volume: 0.8 })
    }
    setActionModeId(null)
  }

  // 桌面多列：删除指定列中 actionMode 选中的任务
  const handleConfirmDeleteFor = (listId: string) => {
    if (actionModeId) {
      removeTaskFor(listId, actionModeId)
      play('droplet', { volume: 0.8 })
    }
    setActionModeId(null)
  }

  const handleSaveOrder = () => {
    setActionModeId(null)
  }

  const handleBlankDoubleClick = (e: React.MouseEvent) => {
    if (view !== 'lists') return
    if (window.matchMedia('(min-width: 768px)').matches) return // 桌面多列由各列面板自行处理
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, [data-task]')) return
    if (actionModeId) return
    if (target.closest('header')) return
    if (lists.length === 0) {
      // 占位态（无任何列表）：双击直接打开底部 ADD input（一次进入"新建条目"交互），
      // 提交时经 handleAddFirstTask 自动新建列表 + 写入任务；空列表仍可从菜单「新增列表」创建
      addTaskRef.current?.open()
      return
    }
    addTaskRef.current?.open()
  }

  const doExport = () => {
    const data = exportData()
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    downloadJSON(data, `ROSTER-${stamp}.json`)
  }

  const handleExport = () => {
    doExport()
    play('success', { volume: 0.6 })
    setMenuOpen(false)
    setConfirmAction(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // 统一用 parseRosterImport（与桌面 ListPanel 一致）：先识别 v1 旧格式，再校验 v2
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
    const data = pendingImportRef.current
    if (!data) return
    pendingImportRef.current = null
    try {
      replaceData(data)
      setConfirmAction(null)
      setMenuOpen(false)
    } catch {
      // 畸形数据兜底：parseRosterImport 已校验结构，这里再兜一层，避免菜单卡在确认态
      setImportError(true)
      setConfirmAction(null)
    }
  }

  // 全局禁用右键系统菜单（APP 沉浸感）：仅编辑输入框保留系统菜单（复制粘贴）；
  // 任务行右击进 actionMode 由 TaskItem 的 onContextMenu 处理
  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, [contenteditable="true"]')) return
    e.preventDefault()
  }

  // 自动导出提示横幅：自动导出后显示 5 秒（黑底白字，样式与 PWA 安装引导一致），可点击 ✕ 提前关闭
  const [autoExportNote, setAutoExportNote] = useState(false)
  const autoExportTimerRef = useRef<number | null>(null)
  const showAutoExportNote = () => {
    setAutoExportNote(true)
    if (autoExportTimerRef.current !== null) window.clearTimeout(autoExportTimerRef.current)
    autoExportTimerRef.current = window.setTimeout(() => setAutoExportNote(false), 5000)
  }
  useEffect(() => {
    return () => {
      if (autoExportTimerRef.current !== null) window.clearTimeout(autoExportTimerRef.current)
    }
  }, [])

  // PWA 安装引导：移动端（触屏）且未以 standalone 运行且未关闭过 → 提示添加到主屏幕（iOS 7 天规则豁免）
  const [showPwaHint, setShowPwaHint] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem('pwa-hint-dismissed')) return
      const standalone = window.matchMedia('(display-mode: standalone)').matches
      const coarse = window.matchMedia('(pointer: coarse)').matches
      if (!standalone && coarse) setShowPwaHint(true)
    } catch {
      // localStorage 不可用时静默
    }
  }, [])

  const dismissPwaHint = () => {
    setShowPwaHint(false)
    try {
      localStorage.setItem('pwa-hint-dismissed', '1')
    } catch {
      // ignore
    }
  }

  // 定期自动导出：启动时距上次导出 >7 天且列表非空 → 桌面自动下载 JSON 备份。
  // 触屏端（pointer 非 fine）不下载也不更新时间戳——避免消耗导出机会、避免非桌面环境误判
  useEffect(() => {
    if (!loaded || lists.length === 0) return
    try {
      const last = Number(localStorage.getItem('last-export') ?? '0')
      if (Date.now() - last < 7 * 24 * 3600 * 1000) return
      if (!window.matchMedia('(pointer: fine)').matches) return
      localStorage.setItem('last-export', String(Date.now()))
      doExport()
      showAutoExportNote()
    } catch {
      // localStorage 异常时跳过
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lists.length])

  if (!loaded) {
    return (
      <div
        className="min-h-svh flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {initError ? (
          <button
            onClick={() => window.location.reload()}
            className="font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none"
          >
            [!] 无法读取本地存储 — 点击重试
          </button>
        ) : (
          <span className="font-mono text-[16px] text-mute">...</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative h-svh overflow-hidden"
      onDoubleClick={handleBlankDoubleClick}
      onContextMenu={handleGlobalContextMenu}
      style={{
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* 保存失败提示（写路径失败可见，数据安全底线）；位置与 PWA 引导条一致（垂直居中标题行） */}
      {saveError && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 18px)' }}
        >
          <span className="font-mono text-[14px] leading-[1.4] text-on-danger bg-danger px-4 py-2 select-none">
            [!] 保存失败
          </span>
        </div>
      )}

      {/* 数据丢失检测：主库为空但有备份 → 询问恢复 */}
      {dataLossDetected && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center"
          style={{ top: 'calc(env(safe-area-inset-top) + 48px)' }}
        >
          <div className="flex items-baseline gap-3 font-mono text-[14px] leading-[1.4] text-ink bg-bg border border-ink/15 px-4 py-2">
            <span>检测到数据可能丢失</span>
            <button
              onClick={restoreFromBackup}
              className="text-danger cursor-pointer select-none"
            >
              [恢复备份]
            </button>
            <button onClick={dismissDataLoss} className="text-mute cursor-pointer select-none">
              [忽略]
            </button>
          </div>
        </div>
      )}

      {/* 新版本可用提示（PWA prompt 模式）：新 SW 就绪后提示刷新；
          位置与样式与下方 PWA 安装引导一致（黑底白字），两者互斥显示 */}
      {needRefresh && !saveError && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center"
          style={{ top: 'calc(env(safe-area-inset-top) + 18px)' }}
        >
          <button
            onClick={applyUpdate}
            className="flex items-baseline gap-2 font-mono text-[14px] leading-[1.4] text-bg bg-ink px-4 py-2 cursor-pointer select-none"
          >
            <Bracket>!</Bracket> 新版本可用 <Bracket>↻</Bracket>
          </button>
        </div>
      )}

      {/* PWA 安装引导（iOS 添加到主屏可豁免 7 天清除规则）；垂直居中对齐顶部标题行；saveError/新版本提示时让位 */}
      {showPwaHint && !saveError && !needRefresh && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center"
          style={{ top: 'calc(env(safe-area-inset-top) + 18px)' }}
        >
          <button
            onClick={dismissPwaHint}
            className="flex items-baseline gap-2 font-mono text-[14px] leading-[1.4] text-bg bg-ink px-4 py-2 cursor-pointer select-none"
          >
            <Bracket>!</Bracket> 添加为PWA以保护数据 <Bracket>✕</Bracket>
          </button>
        </div>
      )}

      {/* 自动导出提示（黑底白字，样式与 PWA 安装引导一致；自动导出后短暂显示，5 秒自动消失/点击 ✕ 关闭，exit 淡出 0.15s） */}
      <AnimatePresence>
        {autoExportNote && !saveError && !needRefresh && !showPwaHint && (
          <motion.div
            key="auto-export-note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed left-0 right-0 z-40 flex justify-center"
            style={{ top: 'calc(env(safe-area-inset-top) + 18px)' }}
          >
            <button
              onClick={() => setAutoExportNote(false)}
              className="flex items-baseline gap-2 font-mono text-[14px] leading-[1.4] text-bg bg-ink px-4 py-2 cursor-pointer select-none"
            >
              <Bracket>!</Bracket> 已自动导出备份 <Bracket>✕</Bracket>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Floating title（移动端专属浮层；桌面多列由各列面板自带标题；使用说明页由 HelpPage 自带标题栏） */}
      {view === 'lists' && (
      <header
        className="fixed top-0 left-0 right-0 z-20 md:hidden"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          paddingBottom: '24px',
          paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
          paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
          background: 'linear-gradient(to bottom, var(--color-bg) 60%, transparent 100%)',
        }}
      >
        <div className="max-w-[640px] mx-auto flex items-baseline justify-between">
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeListId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <EditableTitle
                  title={headerTitle}
                  onSave={isEmpty ? () => {} : updateTitle}
                  editable={!isEmpty}
                />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              data-cuelume-toggle
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
                    right: MENU_PANEL_RIGHT,
                    padding: MENU_PANEL_PADDING,
                    background: MENU_PANEL_BACKGROUND,
                  }}
                >
                  <motion.button
                    key="theme"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    data-cuelume-toggle
                    onClick={() => {
                      // 不关闭菜单：避免"关菜单后点击穿透"误触下方任务；可连续切换
                      toggleTheme()
                    }}
                    className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                  >
                    <Bracket>◐</Bracket> {theme === 'dark' ? '亮色模式' : '暗色模式'}
                  </motion.button>

                  <motion.button
                    key="sound"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    data-cuelume-toggle
                    onClick={toggleSound}
                    className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                  >
                    <Bracket>♪</Bracket> {soundEnabled ? '关闭音效' : '开启音效'}
                  </motion.button>

                  {/* 分组分割线（菜单通用分组，两处同步维护） */}
                  <div className="w-full border-t border-ink/15" />

                  <motion.button
                    key="add-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => {
                      handleAddList()
                      setMenuOpen(false)
                      setConfirmAction(null)
                    }}
                    className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                  >
                    <Bracket>+</Bracket> 新增列表
                  </motion.button>

                  {lists.length > 1 && (
                    <AnimatePresence mode="wait" initial={false}>
                      {confirmAction === 'delete' ? (
                        <motion.button
                          key="confirm-delete"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => {
                            if (activeListId) deleteListById(activeListId)
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

                  {hasCompleted && (
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
                  )}

                  {/* 分组分割线：列表管理组 → 数据组 */}
                  <div className="w-full border-t border-ink/15" />

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

                  {/* 分组分割线：数据组 → 帮助组 */}
                  <div className="w-full border-t border-ink/15" />

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.button
                      key="help"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        setView('help')
                        setMenuOpen(false)
                        setConfirmAction(null)
                      }}
                      className="flex items-baseline gap-2 font-mono text-[16px] leading-[1.6] text-ink cursor-pointer select-none whitespace-nowrap"
                    >
                      <Bracket>?</Bracket> 使用说明
                    </motion.button>
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
      )}

      {/* Horizontal scroller of list panels (线性分页: >1 列表时可左右滑动, 首尾不可回绕)
          使用说明页时 hidden（保留 DOM，返回时滚动位置不丢） */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`h-full w-full md:px-8 ${view === 'help' ? 'hidden' : ''} ${lists.length > 1 ? 'overflow-x-auto snap-x snap-mandatory' : 'overflow-x-hidden'}`}
        style={{
          scrollSnapType: lists.length > 1 ? 'x mandatory' : undefined,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: lists.length > 1 ? 'pan-x pan-y' : 'pan-y',
        }}
      >
        {/* 移动端 w-full（固定 100% 宽，避免 fit-content + 百分比宽循环把列撑到内容宽；
            桌面 md:w-fit 保留原逻辑：列总宽 < 视口时整组居中，≥ 视口时左对齐滚动） */}
        <div className="w-full md:w-fit min-w-full md:min-w-0 mx-auto flex h-full items-stretch">
          {lists.map((list, i) => {
            // 分割线：所有列 border-l（列间单线 + 首列左边界线），末列额外 border-r（右边界线）；单列即末列 → 双侧
            const borderCls = i === lists.length - 1 ? 'md:border-l md:border-r' : 'md:border-l'
            return (
            <section
              key={list.id}
              className={`w-full md:w-[425px] ${borderCls} md:border-ink/15 shrink-0 snap-start overflow-y-auto md:overflow-hidden`}
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* 桌面（≥768px）：完整自包含列面板 */}
              <div className="hidden md:block h-full">
                <ListPanel
                  list={list}
                  theme={theme}
                  soundEnabled={soundEnabled}
                  onToggleTheme={toggleTheme}
                  onToggleSound={toggleSound}
                  actionModeId={actionModeId}
                  suppressLayout={suppressLayout}
                  sensors={sensors}
                  onDragEnd={(e) => handleDragEndFor(list.id, e)}
                  onToggle={(id) => toggleCompleteFor(list.id, id)}
                  onToggleInProgress={(id) => toggleInProgressFor(list.id, id)}
                  onUpdate={(id, content) => updateTaskContentFor(list.id, id, content)}
                  onLongPress={handleLongPress}
                  onSaveTitle={(title) => updateTitleFor(list.id, title)}
                  onAddTask={(content) => addTaskFor(list.id, content)}
                  onClearCompleted={() => clearCompletedFor(list.id)}
                  onAddList={handleAddList}
                  onDeleteList={() => deleteListById(list.id)}
                  canDelete={lists.length > 1}
                  onConfirmDelete={() => handleConfirmDeleteFor(list.id)}
                  onSaveOrder={handleSaveOrder}
                  onExport={exportData}
                  onReplace={replaceData}
                  onOpenHelp={() => setView('help')}
                />
              </div>

              {/* 移动端（<768px）：仅任务，配合全局浮层。
                  滚动容器是 section（移动端 overflow-y-auto），padding 直接放在内容容器上——
                  内容可向上滚穿过 paddingTop 进入 header 渐变尾区被遮罩（与桌面列头同构），
                  同时避免嵌套 h-full + overflow:visible 内容穿透 padding 的坑。
                  底部留白 safe+128（减半）：底部操作栏高 ≈ safe+73.6，滚到底最后条距栏顶 ≈ 54px
                  （顶部 108px 的一半，与桌面多列一致）。 */}
              <div
                className="md:hidden"
                style={{
                  paddingTop: 'calc(env(safe-area-inset-top) + 108px)',
                  paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
                  paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
                  paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
                }}
              >
                <div className="max-w-[640px] mx-auto">
                  {list.tasks.length === 0 ? (
                    // 空任务列表：放在 pl-8 的 main 之外，与桌面 ListPanel 同构——
                    // 占满外层 padding 之间的剩余空间（100svh − safe-top − 108 − 128），
                    // 使 NO LISTS 与「无列表」空态一致地垂直居中于页面；
                    // min-h-[40vh] 仅为 svh 兜底（iOS < 16.4 不支持 100svh 时回退原行为）。
                    <div className="min-h-[40vh] min-h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-236px)] flex items-center justify-center">
                      <span className="font-mono text-[16px] leading-[1.6] text-mute select-none">
                        NO LISTS
                      </span>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            </section>
            )
          })}

          {/* 空状态占位（无任何列表时）：
              - 桌面端：渲染占位 ListPanel，与正常空 list 列视觉同构（顶部 ROSTER 标题 + [≡] 菜单 + NO LISTS + 底部 ADD）。
                placeholder list 的所有写操作禁用，ADD 触发 handleAddList 新增真实列表。
              - 移动端：本 section 仅作 snap-start 锚点；视觉效果由全局浮层（顶部 header + 底部 [+] ADD）接管，与原有体验一致。
              末列同时带 `md:border-l md:border-r` 形成左右对称的列边界线，与"移动多列 = 移动端横向重复排列"原则一致。 */}
          {isEmpty && (
            <section
              className="w-full md:w-[425px] md:border-l md:border-r md:border-ink/15 shrink-0 snap-start overflow-y-auto md:overflow-hidden"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* 桌面端：ListPanel 占位列 */}
              <div className="hidden md:block h-full">
                <ListPanel
                  list={PLACEHOLDER_LIST}
                  actionModeId={null}
                  suppressLayout={suppressLayout}
                  sensors={sensors}
                  theme={theme}
                  soundEnabled={soundEnabled}
                  onToggleTheme={toggleTheme}
                  onToggleSound={toggleSound}
                  onDragEnd={() => {}}
                  onToggle={() => {}}
                  onToggleInProgress={() => {}}
                  onUpdate={() => {}}
                  onLongPress={handleLongPress}
                  onSaveTitle={() => {}}
                  // 占位列列底也是 AddTask（list.id === '__empty__' 时 ListPanel 内部渲染），onAdd 提交走 handleAddFirstTask：新建列表 + 写入任务一步到位
                  onAddTask={handleAddFirstTask}
                  onClearCompleted={() => {}}
                  onAddList={handleAddList}
                  onDeleteList={() => {}}
                  canDelete={false}
                  onConfirmDelete={() => {}}
                  onSaveOrder={handleSaveOrder}
                  onExport={exportData}
                  onReplace={replaceData}
                  onOpenHelp={() => setView('help')}
                />
              </div>
              {/* 移动端：占位 section 渲染 NO LISTS 占位（与单个空 list 同构：占满外层 padding 之间的剩余空间，使 NO LISTS 垂直居中于页面）——修复 0.9.5 重构时遗漏的占位文字。
                  顶部 ROSTER / ≡ 菜单由全局 header 浮层接管，[+] ADD 由全局底部浮层接管（见 isEmpty 分支），与桌面 ListPanel 占位列视觉一致。 */}
              <div
                className="md:hidden"
                style={{
                  paddingTop: 'calc(env(safe-area-inset-top) + 108px)',
                  paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
                  paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
                  paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
                }}
              >
                <div className="min-h-[40vh] min-h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-236px)] flex items-center justify-center">
                  <span className="font-mono text-[16px] leading-[1.6] text-mute select-none">
                    NO LISTS
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 使用说明页（全屏独立视图，桌面/移动端共用；scroller 以 hidden 保留在 DOM 中） */}
      {view === 'help' && (
        <div className="absolute inset-0 z-10">
          <HelpPage onBack={() => setView('lists')} />
        </div>
      )}

      {/* Floating bottom bar（移动端专属浮层；桌面多列由各列面板自带底栏） */}
      {view === 'lists' && (
      <div
        ref={bottomBarRef}
        className="fixed bottom-0 left-0 right-0 z-20 md:hidden"
        style={{
          paddingTop: '24px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          paddingLeft: 'calc(env(safe-area-inset-left) + 24px)',
          paddingRight: 'calc(env(safe-area-inset-right) + 24px)',
          background: 'linear-gradient(to top, var(--color-bg) 60%, transparent 100%)',
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
                    className="font-mono text-[16px] leading-[1.6] text-danger cursor-pointer select-none"
                  >
                    <Bracket>−</Bracket> 删除此条
                  </button>
                  <button
                    onClick={handleSaveOrder}
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
                {/* 统一渲染 AddTask（占位态 [+] ADD 与正常态视觉一致）：
                    无列表时 onAdd 走 handleAddFirstTask（新建列表 + 写入任务，一步到位），
                    有列表时走 addTask（写入当前列表）——这样占位态双击/[+] ADD 直接进入"新建条目"交互 */}
                <AddTask ref={addTaskRef} onAdd={isEmpty ? handleAddFirstTask : addTask} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}
    </div>
  )
}

export default App
