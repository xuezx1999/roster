import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task, TodoList, RosterExport } from '../types'
import {
  getAllLists,
  saveList,
  saveAllLists,
  deleteList,
  getActiveListId,
  saveActiveListId,
  saveBackup,
  getBackup,
} from '../db'
import { generateId, parseRosterImport } from '../utils'

export function sortTasks(tasks: Task[]): Task[] {
  const inProgress = tasks.filter((t) => t.inProgress && !t.completed)
  const pending = tasks.filter((t) => !t.inProgress && !t.completed)
  const done = tasks.filter((t) => t.completed)
  const sorted = [...inProgress, ...pending, ...done]
  sorted.forEach((t, i) => {
    t.order = i
  })
  return sorted
}

export function normalizeTask(t: Task): Task {
  return {
    ...t,
    inProgress: t.inProgress === true,
    completed: t.completed === true,
  }
}

export function useTodos() {
  const [lists, setLists] = useState<TodoList[]>([])
  const [activeListId, setActiveListId] = useState<string>('')
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [dataLossDetected, setDataLossDetected] = useState(false)
  const initialized = useRef(false)
  const pendingBackupRef = useRef<string | null>(null)

  // 写成功/失败报告（saveError 提示）；setState 同值自动 bail out，避免无谓重渲染
  const reportSave = useCallback((ok: boolean) => {
    setSaveError(!ok)
  }, [])

  // 写成功后同步库内备份（RosterExport 格式，可被 parseRosterImport 恢复）
  const persistBackup = useCallback((data: RosterExport) => {
    saveBackup(JSON.stringify(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    Promise.all([getAllLists(), getActiveListId(), getBackup()]).then(
      ([storedLists, storedActive, backup]) => {
        const normalized = storedLists.map((l) => ({
          ...l,
          tasks: l.tasks.map(normalizeTask),
        }))
        setLists(normalized)
        if (storedActive && normalized.some((l) => l.id === storedActive)) {
          setActiveListId(storedActive)
        } else if (normalized.length > 0) {
          const first = normalized[0].id
          setActiveListId(first)
          saveActiveListId(first).then(
            () => reportSave(true),
            () => reportSave(false)
          )
        }
        // 数据完整性检测：主库为空但存在非空备份（疑似数据丢失）→ 标记，由 App 提示恢复
        if (normalized.length === 0 && backup) {
          const parsed = parseRosterImport(backup)
          if (parsed && parsed.lists.length > 0) {
            pendingBackupRef.current = backup
            setDataLossDetected(true)
          }
        }
        setLoaded(true)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从库内备份恢复（RosterExport 格式，走 replaceData 覆盖）
  const restoreFromBackup = useCallback(() => {
    const raw = pendingBackupRef.current
    if (!raw) return
    const parsed = parseRosterImport(raw)
    if (!parsed) return
    pendingBackupRef.current = null
    setDataLossDetected(false)
    void replaceData(parsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 忽略数据丢失提示（不清除备份，下次启动若仍空会再提示）
  const dismissDataLoss = useCallback(() => {
    pendingBackupRef.current = null
    setDataLossDetected(false)
  }, [])

  const activeList = lists.find((l) => l.id === activeListId) ?? null
  const tasks = activeList ? activeList.tasks : []
  const title = activeList ? activeList.title : 'ROSTER'

  // 通用写入口（按 listId 定位列表），含"自动删除空列表"：
  // 列表由"有任务"变为"无任务"（清除完成 / 删除任务删光）时移除该列表。
  // 若删的是当前列表：删光后回到初始空状态（NO LISTS + [+] ADD），否则回退到第一个列表。
  // 新建的空列表（addList）不经过本路径，不会被误删。
  const updateList = useCallback(
    (listId: string, updater: (list: TodoList) => TodoList) => {
      setLists((prev) => {
        const idx = prev.findIndex((l) => l.id === listId)
        if (idx === -1) return prev
        const next = [...prev]
        const updated = updater(next[idx])
        if (updated.tasks.length === 0 && next[idx].tasks.length > 0) {
          // 自动删除空列表
          const remaining = next.filter((l) => l.id !== listId)
          let nextActive = activeListId
          if (activeListId === listId) {
            if (remaining.length === 0) {
              nextActive = ''
              setActiveListId('')
            } else {
              nextActive = remaining[0].id
              setActiveListId(nextActive)
            }
          }
          deleteList(listId).then(
            () => {
              reportSave(true)
              saveActiveListId(nextActive).catch(() => {})
              persistBackup({
                app: 'ROSTER',
                version: 2,
                exportedAt: Date.now(),
                activeListId: nextActive,
                lists: remaining,
              })
            },
            () => reportSave(false)
          )
          return remaining
        }
        next[idx] = updated
        saveList(updated).then(
          () => {
            reportSave(true)
            persistBackup({
              app: 'ROSTER',
              version: 2,
              exportedAt: Date.now(),
              activeListId,
              lists: next,
            })
          },
          () => reportSave(false)
        )
        return next
      })
    },
    [activeListId, reportSave, persistBackup]
  )

  const switchList = useCallback((id: string) => {
    setActiveListId(id)
    saveActiveListId(id).then(
      () => reportSave(true),
      () => reportSave(false)
    )
  }, [reportSave])

  const addList = useCallback(() => {
    const newList: TodoList = {
      id: generateId(),
      title: 'ROSTER',
      tasks: [],
    }
    setLists((prev) => {
      const next = [...prev, newList]
      saveList(newList).then(
        () => {
          reportSave(true)
          persistBackup({
            app: 'ROSTER',
            version: 2,
            exportedAt: Date.now(),
            activeListId: newList.id,
            lists: next,
          })
        },
        () => reportSave(false)
      )
      return next
    })
    setActiveListId(newList.id)
    saveActiveListId(newList.id).catch(() => reportSave(false))
    return newList.id
  }, [persistBackup, reportSave])

  const deleteListById = useCallback((id: string) => {
    let nextActive = activeListId
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== id)
      if (activeListId === id) {
        if (remaining.length === 0) {
          nextActive = ''
          setActiveListId('')
        } else {
          nextActive = remaining[0].id
          setActiveListId(nextActive)
        }
      }
      // 副作用统一放 updater 内（与 updateList/addList 一致）：remaining 直接可用，避免 ref 时序竞态
      deleteList(id).then(
        () => {
          reportSave(true)
          saveActiveListId(nextActive).catch(() => {})
          persistBackup({
            app: 'ROSTER',
            version: 2,
            exportedAt: Date.now(),
            activeListId: nextActive,
            lists: remaining,
          })
        },
        () => reportSave(false)
      )
      return remaining
    })
  }, [activeListId, persistBackup, reportSave])

  // ---- per-list 操作（桌面多列每列独立调用）----
  const addTaskFor = useCallback(
    async (listId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const newTask: Task = {
        id: generateId(),
        content: trimmed,
        completed: false,
        inProgress: false,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      updateList(listId, (list) => {
        const next = sortTasks([newTask, ...list.tasks])
        return { ...list, tasks: next }
      })
    },
    [updateList]
  )

  const updateTaskContentFor = useCallback(
    async (listId: string, id: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      updateList(listId, (list) => ({
        ...list,
        tasks: list.tasks.map((t) =>
          t.id === id ? { ...t, content: trimmed, updatedAt: Date.now() } : t
        ),
      }))
    },
    [updateList]
  )

  const toggleCompleteFor = useCallback(
    async (listId: string, id: string) => {
      updateList(listId, (list) => {
        const tasks = list.tasks.map((t) => {
          if (t.id !== id) return t
          if (t.completed) {
            return { ...t, completed: false, completedAt: undefined, inProgress: false, updatedAt: Date.now() }
          }
          return { ...t, completed: true, completedAt: Date.now(), inProgress: false, updatedAt: Date.now() }
        })
        return { ...list, tasks: sortTasks(tasks) }
      })
    },
    [updateList]
  )

  const toggleInProgressFor = useCallback(
    async (listId: string, id: string) => {
      updateList(listId, (list) => {
        const tasks = list.tasks.map((t) => {
          if (t.id !== id || t.completed) return t
          return { ...t, inProgress: !t.inProgress, updatedAt: Date.now() }
        })
        return { ...list, tasks: sortTasks(tasks) }
      })
    },
    [updateList]
  )

  const removeTaskFor = useCallback(
    async (listId: string, id: string) => {
      updateList(listId, (list) => ({
        ...list,
        tasks: list.tasks.filter((t) => t.id !== id),
      }))
    },
    [updateList]
  )

  const clearCompletedFor = useCallback(
    async (listId: string) => {
      updateList(listId, (list) => ({
        ...list,
        tasks: list.tasks.filter((t) => !t.completed),
      }))
    },
    [updateList]
  )

  const reorderTasksFor = useCallback(
    async (listId: string, activeId: string, overId: string) => {
      updateList(listId, (list) => {
        const oldIndex = list.tasks.findIndex((t) => t.id === activeId)
        const newIndex = list.tasks.findIndex((t) => t.id === overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return list
        const next = [...list.tasks]
        const [moved] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, moved)
        next.forEach((t, i) => {
          t.order = i
        })
        return { ...list, tasks: next }
      })
    },
    [updateList]
  )

  const updateTitleFor = useCallback(
    async (listId: string, newTitle: string) => {
      updateList(listId, (list) => ({ ...list, title: newTitle }))
    },
    [updateList]
  )

  // ---- activeListId 版操作（移动端全局浮层 / 默认路径，包装 per-list 版）----
  const addTask = useCallback(
    (content: string) => addTaskFor(activeListId, content),
    [addTaskFor, activeListId]
  )

  const updateTaskContent = useCallback(
    (id: string, content: string) => updateTaskContentFor(activeListId, id, content),
    [updateTaskContentFor, activeListId]
  )

  const toggleComplete = useCallback(
    (id: string) => toggleCompleteFor(activeListId, id),
    [toggleCompleteFor, activeListId]
  )

  const toggleInProgress = useCallback(
    (id: string) => toggleInProgressFor(activeListId, id),
    [toggleInProgressFor, activeListId]
  )

  const removeTask = useCallback(
    (id: string) => removeTaskFor(activeListId, id),
    [removeTaskFor, activeListId]
  )

  const clearCompleted = useCallback(
    () => clearCompletedFor(activeListId),
    [clearCompletedFor, activeListId]
  )

  const reorderTasks = useCallback(
    (activeId: string, overId: string) => reorderTasksFor(activeListId, activeId, overId),
    [reorderTasksFor, activeListId]
  )

  const updateTitle = useCallback(
    (newTitle: string) => updateTitleFor(activeListId, newTitle),
    [updateTitleFor, activeListId]
  )

  const exportData = useCallback((): RosterExport => {
    return {
      app: 'ROSTER',
      version: 2,
      exportedAt: Date.now(),
      activeListId,
      lists: lists.map((l) => ({
        ...l,
        tasks: l.tasks.map((t) => ({ ...t })),
      })),
    }
  }, [lists, activeListId])

  const replaceData = useCallback((data: RosterExport) => {
    const importedLists = data.lists.map((l) => ({
      ...l,
      tasks: l.tasks.map(normalizeTask),
    }))
    setLists(importedLists)
    const validActive = importedLists.some((l) => l.id === data.activeListId)
      ? data.activeListId
      : importedLists.length > 0
        ? importedLists[0].id
        : ''
    setActiveListId(validActive)
    Promise.all([saveAllLists(importedLists), saveActiveListId(validActive)]).then(
      () => {
        reportSave(true)
        persistBackup({
          app: 'ROSTER',
          version: 2,
          exportedAt: Date.now(),
          activeListId: validActive,
          lists: importedLists,
        })
      },
      () => reportSave(false)
    )
  }, [persistBackup, reportSave])

  return {
    lists,
    activeListId,
    tasks,
    title,
    loaded,
    saveError,
    dataLossDetected,
    restoreFromBackup,
    dismissDataLoss,
    addList,
    switchList,
    deleteListById,
    // activeListId 版（移动端全局浮层）
    addTask,
    updateTaskContent,
    toggleComplete,
    toggleInProgress,
    removeTask,
    clearCompleted,
    reorderTasks,
    updateTitle,
    // per-list 版（桌面多列）
    addTaskFor,
    updateTaskContentFor,
    toggleCompleteFor,
    toggleInProgressFor,
    removeTaskFor,
    clearCompletedFor,
    reorderTasksFor,
    updateTitleFor,
    exportData,
    replaceData,
  }
}
