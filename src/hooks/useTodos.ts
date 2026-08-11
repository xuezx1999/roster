import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task, TodoList, RosterExport } from '../types'
import {
  getAllLists,
  saveList,
  saveAllLists,
  deleteList,
  getActiveListId,
  saveActiveListId,
} from '../db'
import { generateId } from '../utils'

function sortTasks(tasks: Task[]): Task[] {
  const inProgress = tasks.filter((t) => t.inProgress && !t.completed)
  const pending = tasks.filter((t) => !t.inProgress && !t.completed)
  const done = tasks.filter((t) => t.completed)
  const sorted = [...inProgress, ...pending, ...done]
  sorted.forEach((t, i) => {
    t.order = i
  })
  return sorted
}

function normalizeTask(t: Task): Task {
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
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    Promise.all([getAllLists(), getActiveListId()]).then(([storedLists, storedActive]) => {
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
        saveActiveListId(first)
      }
      setLoaded(true)
    })
  }, [])

  const activeList = lists.find((l) => l.id === activeListId) ?? null
  const tasks = activeList ? activeList.tasks : []
  const title = activeList ? activeList.title : 'ROSTER'

  const updateActiveList = useCallback(
    (updater: (list: TodoList) => TodoList) => {
      setLists((prev) => {
        const idx = prev.findIndex((l) => l.id === activeListId)
        if (idx === -1) return prev
        const next = [...prev]
        const updated = updater(next[idx])
        next[idx] = updated
        saveList(updated)
        return next
      })
    },
    [activeListId]
  )

  const switchList = useCallback(async (id: string) => {
    setActiveListId(id)
    await saveActiveListId(id)
  }, [])

  const addList = useCallback(async () => {
    const newList: TodoList = {
      id: generateId(),
      title: 'ROSTER',
      tasks: [],
    }
    setLists((prev) => [...prev, newList])
    await saveList(newList)
    setActiveListId(newList.id)
    await saveActiveListId(newList.id)
    return newList.id
  }, [])

  const deleteListById = useCallback(async (id: string) => {
    await deleteList(id)
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== id)
      if (remaining.length === 0) return prev
      if (activeListId === id) {
        const fallback = remaining[0]
        setActiveListId(fallback.id)
        saveActiveListId(fallback.id)
      }
      return remaining
    })
  }, [activeListId])

  const addTask = useCallback(
    async (content: string) => {
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
      updateActiveList((list) => {
        const next = sortTasks([newTask, ...list.tasks])
        return { ...list, tasks: next }
      })
    },
    [updateActiveList]
  )

  const updateTaskContent = useCallback(
    async (id: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      updateActiveList((list) => ({
        ...list,
        tasks: list.tasks.map((t) =>
          t.id === id ? { ...t, content: trimmed, updatedAt: Date.now() } : t
        ),
      }))
    },
    [updateActiveList]
  )

  const toggleComplete = useCallback(
    async (id: string) => {
      updateActiveList((list) => {
        let nextList: TodoList | null = null
        const tasks = list.tasks.map((t) => {
          if (t.id !== id) return t
          if (t.completed) {
            return { ...t, completed: false, completedAt: undefined, inProgress: false, updatedAt: Date.now() }
          }
          return { ...t, completed: true, completedAt: Date.now(), inProgress: false, updatedAt: Date.now() }
        })
        nextList = { ...list, tasks: sortTasks(tasks) }
        return nextList
      })
    },
    [updateActiveList]
  )

  const toggleInProgress = useCallback(
    async (id: string) => {
      updateActiveList((list) => {
        const tasks = list.tasks.map((t) => {
          if (t.id !== id || t.completed) return t
          return { ...t, inProgress: !t.inProgress, updatedAt: Date.now() }
        })
        return { ...list, tasks: sortTasks(tasks) }
      })
    },
    [updateActiveList]
  )

  const removeTask = useCallback(
    async (id: string) => {
      updateActiveList((list) => ({
        ...list,
        tasks: list.tasks.filter((t) => t.id !== id),
      }))
    },
    [updateActiveList]
  )

  const clearCompleted = useCallback(async () => {
    updateActiveList((list) => ({
      ...list,
      tasks: list.tasks.filter((t) => !t.completed),
    }))
  }, [updateActiveList])

  const reorderTasks = useCallback(
    async (activeId: string, overId: string) => {
      updateActiveList((list) => {
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
    [updateActiveList]
  )

  const updateTitle = useCallback(
    async (newTitle: string) => {
      updateActiveList((list) => ({ ...list, title: newTitle }))
    },
    [updateActiveList]
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

  const replaceData = useCallback(async (data: RosterExport) => {
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
    await saveAllLists(importedLists)
    await saveActiveListId(validActive)
  }, [])

  return {
    lists,
    activeListId,
    tasks,
    title,
    loaded,
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
  }
}
